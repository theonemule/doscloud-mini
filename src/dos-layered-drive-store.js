// Adapted from the existing DOSCloud filesystem source.
"use strict";
// A per-user union view for DOSCloud's remote C: drive. The shared game base
// is immutable; all DOS writes, copies, renames, deletions and whiteouts stay
// inside the user's existing private GAMES/<folder> directory.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { DriveStore, DriveError } = require("./dos-drive-store");
const MARKER = ".doscloud-layer.json";
const TOMBSTONES = ".doscloud-whiteouts.json";
const folded = x => String(x).toLocaleLowerCase("en-US");
const hidden = x => [MARKER,TOMBSTONES].includes(folded(x));
function norm(p) {
 const bits = String(p || "").replace(/^[A-Za-z]:/, "").replaceAll("\\", "/").split("/").filter(Boolean);
 if(bits.some(x=>x===".."||x==="."||x.includes("\0")))throw new DriveError("EINVAL","invalid DOS path");
 return bits;
}
function existing(root, segments) {
 let curr=root;
 for(const part of segments){
   let names;
   try{names=fs.readdirSync(curr)}catch(e){if(e.code==="ENOENT"||e.code==="ENOTDIR")return null;throw e}
   const name=names.find(x=>x===part)||names.find(x=>folded(x)===folded(part));
   if(!name)return null;
   curr=path.join(curr,name);
   if(fs.lstatSync(curr).isSymbolicLink())throw new DriveError("EACCES","links not supported on DOS drive");
 }
 return curr;
}
function filenameError(code){return Object.assign(new Error(code),{code});}
class LayeredDriveStore extends DriveStore {
 constructor(root,{sharedRoot}){super(root);this.sharedRoot=path.resolve(sharedRoot);this.layers=new Map()}
 layer(dosPath){
  const bits=norm(dosPath);
  if(bits.length<2 || folded(bits[0])!=="games")return null;
  const games=existing(this.root,[bits[0]]);
  if(!games)return null;
  const overlay=existing(games,[bits[1]]);
  if(!overlay||!fs.statSync(overlay).isDirectory())return null;
  if(!fs.existsSync(path.join(overlay,MARKER)))return null;
  let meta=this.layers.get(overlay);
  if(!meta){
   meta=JSON.parse(fs.readFileSync(path.join(overlay,MARKER),"utf8"));
   if(meta.format!==1||!/^[a-f0-9]{64}$/.test(meta.baseKey))throw new DriveError("EACCES","invalid layer pointer");
   meta={...meta,base:path.join(this.sharedRoot,meta.baseKey),overlay,whiteouts:null};
   if(!fs.statSync(meta.base).isDirectory())throw new DriveError("ENOENT","shared game base missing");
   this.layers.set(overlay,meta);
  }
  if(bits.slice(2).some(hidden))throw new DriveError("EACCES","private layer metadata is not a DOS file");
  return {meta,parts:bits.slice(2)};
 }
 tombstones(meta){
  if(meta.whiteouts)return meta.whiteouts;
  let entries=[];
  try{entries=JSON.parse(fs.readFileSync(path.join(meta.overlay,TOMBSTONES),"utf8"))}catch(e){if(e.code!=="ENOENT")throw e}
  if(!Array.isArray(entries)||entries.some(v=>typeof v!=="string"))throw new DriveError("EIO","invalid whiteouts");
  meta.whiteouts=new Set(entries);
  return meta.whiteouts;
 }
 isHidden(meta,parts){
  const key=folded(parts.join("/"));const whiteouts=this.tombstones(meta);
  return [...whiteouts].some(x=>key===x||key.startsWith(x+"/"));
 }
 writeTombstones(meta){
  const target=path.join(meta.overlay,TOMBSTONES);
  const temp=target+"-"+process.pid+"-"+Math.random().toString(36).slice(2);
  fs.writeFileSync(temp,JSON.stringify([...this.tombstones(meta)]));
  fs.renameSync(temp,target);
 }
 whiteout(meta,parts){this.tombstones(meta).add(folded(parts.join('/')));this.writeTombstones(meta)}
 unwhiteout(meta,parts){
  const key=folded(parts.join('/'));
  if(this.tombstones(meta).delete(key))this.writeTombstones(meta);
 }
 locations({meta,parts}){
  const writable=existing(meta.overlay,parts);
  const base=(!this.isHidden(meta,parts))?existing(meta.base,parts):null;
  return {writable,base,selected:writable||base};
 }
 overlayPath(meta,parts){
  const parent=existing(meta.overlay,parts.slice(0,-1));
  return path.join(parent||path.join(meta.overlay,...parts.slice(0,-1)),parts.at(-1)||'');
 }
 async materialize(info,{truncate=false}={}){
  const {meta,parts}=info;
  let {writable,base}=this.locations(info);
  if(!writable){
   const dest=this.overlayPath(meta,parts);
   await fsp.mkdir(path.dirname(dest),{recursive:true});
   if(base){
    const st=await fsp.stat(base);
    if(st.isDirectory())await fsp.mkdir(dest,{recursive:true});
    else if(truncate)await fsp.writeFile(dest,Buffer.alloc(0));
    else await fsp.copyFile(base,dest,fs.constants.COPYFILE_EXCL);
   }
   writable=dest;
  }
  this.unwhiteout(meta,parts);
  return writable;
 }
 async open(dosPath,flags='r'){
  const info=this.layer(dosPath);
  if(!info)return super.open(dosPath,flags);
  if(!info.parts.length)throw filenameError('EISDIR');
  const numeric=typeof flags==='number';
  const modifies=numeric?Boolean(flags&(fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_TRUNC|fs.constants.O_APPEND)):/[wa+]/.test(flags);
  const creates=numeric?Boolean(flags&fs.constants.O_CREAT):/^[wax]/.test(flags)||flags.startsWith('a');
  const truncates=numeric?Boolean(flags&fs.constants.O_TRUNC):flags.startsWith('w');
  const exclusive=numeric?Boolean(flags&fs.constants.O_EXCL):flags.includes('x');
  const loc=this.locations(info);
  if(exclusive && creates && loc.selected)throw filenameError('EEXIST');
  if(!loc.selected && !creates)throw filenameError('ENOENT');
  const filepath=modifies?await this.materialize(info,{truncate:truncates}):loc.selected;
  if(!filepath)throw filenameError('ENOENT');
  const file=await fsp.open(filepath,flags);
  const stat=await file.stat();
  const append=numeric?Boolean(flags&fs.constants.O_APPEND):flags.startsWith('a');
  const handle=this.nextHandle++;
  this.handles.set(handle,{file,position:append?stat.size:0});
  return {handle,position:append?stat.size:0,size:stat.size};
 }
 async stat(dosPath){
  const info=this.layer(dosPath);
  if(!info)return super.stat(dosPath);
  const file=this.locations(info).selected;
  if(!file)throw filenameError('ENOENT');
  const s=await fsp.stat(file);
  return {size:s.size,directory:s.isDirectory(),file:s.isFile(),mtimeMs:s.mtimeMs};
 }
 async list(dosPath=''){
  const info=this.layer(dosPath);
  if(!info)return super.list(dosPath);
  const {meta,parts}=info;
  const {writable,base,selected}=this.locations(info);
  if(!selected)throw filenameError('ENOENT');
  if(!(await fsp.stat(selected)).isDirectory())throw filenameError('ENOTDIR');
  const names=new Map();
  if(base && (await fsp.stat(base)).isDirectory()){
   for(const e of await fsp.readdir(base)){
    if(hidden(e)||this.isHidden(meta,[...parts,e]))continue;
    names.set(folded(e),{name:e,at:path.join(base,e)});
   }
  }
  if(writable && (await fsp.stat(writable)).isDirectory()){
   for(const e of await fsp.readdir(writable)){
    if(hidden(e))continue;
    names.set(folded(e),{name:e,at:path.join(writable,e)});
   }
  }
  const entries=[];
  for(const {name,at} of names.values()){
   const s=await fsp.stat(at);
   entries.push({name,directory:s.isDirectory(),size:s.size,mtimeMs:s.mtimeMs});
  }
  return {entries};
 }
 async mkdir(dosPath){
  const info=this.layer(dosPath);
  if(!info)return super.mkdir(dosPath);
  if(this.locations(info).selected)throw filenameError('EEXIST');
  const dest=this.overlayPath(info.meta,info.parts);
  await fsp.mkdir(path.dirname(dest),{recursive:true});
  await fsp.mkdir(dest);
  this.unwhiteout(info.meta,info.parts);
  return {};
 }
 async create(dosPath){
  const info=this.layer(dosPath);
  if(!info)return super.create(dosPath);
  const dest=await this.materialize(info);
  const f=await fsp.open(dest,fs.constants.O_CREAT|fs.constants.O_WRONLY,0o666);
  await f.close();return {};
 }
 async truncate(dosPath,size=0){
  const info=this.layer(dosPath);
  if(!info)return super.truncate(dosPath,size);
  if(!this.locations(info).selected)throw filenameError('ENOENT');
  const dest=await this.materialize(info,{truncate:Number(size)===0});
  await fsp.truncate(dest,Math.max(0,Number(size)||0));return {};
 }
 async unlink(dosPath){
  const info=this.layer(dosPath);
  if(!info)return super.unlink(dosPath);
  const {writable,base,selected}=this.locations(info);
  if(!selected)throw filenameError('ENOENT');
  if((await fsp.stat(selected)).isDirectory())throw filenameError('EISDIR');
  if(writable)await fsp.unlink(writable);
  if(base)this.whiteout(info.meta,info.parts);
  return {};
 }
 async rmdir(dosPath){
  const info=this.layer(dosPath);
  if(!info)return super.rmdir(dosPath);
  const loc=this.locations(info);
  if(!loc.selected)throw filenameError('ENOENT');
  if(!(await fsp.stat(loc.selected)).isDirectory())throw filenameError('ENOTDIR');
  if((await this.list(dosPath)).entries.length)throw filenameError('ENOTEMPTY');
  if(loc.writable)await fsp.rmdir(loc.writable);
  if(loc.base)this.whiteout(info.meta,info.parts);
  return {};
 }
 async copyMerged(from,to){
  const stat=await this.stat(from);
  if(stat.directory){
   await this.mkdir(to);
   for(const item of (await this.list(from)).entries){
    await this.copyMerged(from.replace(/[\\/]$/,'')+'/'+item.name,to.replace(/[\\/]$/,'')+'/'+item.name);
   }
  }else{
   const input=await this.open(from,'r');
   const output=await this.open(to,'w');
   try{let position=0;while(true){const r=await this.read(input.handle,1024*1024,position);if(!r.payload.length)break;await this.write(output.handle,r.payload,position);position+=r.payload.length}}
   finally{await this.close(input.handle);await this.close(output.handle)}
  }
 }
 async rename(from,to){
  const src=this.layer(from),dst=this.layer(to);
  if(!src&&!dst)return super.rename(from,to);
  if(!src||!dst||src.meta.overlay!==dst.meta.overlay)throw filenameError('EXDEV');
  if(!src.parts.length||!dst.parts.length)throw filenameError('EACCES');
  const oldKey=folded(src.parts.join('/')),newKey=folded(dst.parts.join('/'));
  if(oldKey===newKey)return {};
  if(newKey.startsWith(oldKey+'/'))throw filenameError('EINVAL');
  const oldLoc=this.locations(src),targetLoc=this.locations(dst);
  if(!oldLoc.selected)throw filenameError('ENOENT');
  const sourceStat=await fsp.stat(oldLoc.selected);
  if(targetLoc.selected){
   const targetStat=await fsp.stat(targetLoc.selected);
   if(sourceStat.isDirectory()!==targetStat.isDirectory())throw filenameError('EEXIST');
   if(targetStat.isDirectory() && (await this.list(to)).entries.length)throw filenameError('ENOTEMPTY');
   if(targetLoc.writable)await fsp.rm(targetLoc.writable,{recursive:targetStat.isDirectory()});
   if(targetLoc.base)this.whiteout(dst.meta,dst.parts);
  }
  await this.copyMerged(from,to);
  if(oldLoc.writable)await fsp.rm(oldLoc.writable,{recursive:sourceStat.isDirectory()});
  if(oldLoc.base)this.whiteout(src.meta,src.parts);
  return {};
 }
}
module.exports={LayeredDriveStore,MARKER};
