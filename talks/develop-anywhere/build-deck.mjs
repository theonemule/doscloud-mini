#!/usr/bin/env node
// Convert authored multi-slide Markdown into LiveDeck-compatible JSON + private notes.
// No third-party dependencies are required.
import fs from "node:fs";
import path from "node:path";
const dir = path.dirname(new URL(import.meta.url).pathname);
const source = fs.readFileSync(path.join(dir, "slides.md"), "utf8");
const css = fs.readFileSync(path.join(dir, "dos-theme.css"), "utf8");
const sections = source.split(/<!-- next-slide -->/).filter(x => /^<!-- slide:/m.test(x));
const slides=[]; const notes={}; let total=0;
for (const section of sections) {
  const meta = section.match(/<!-- slide: ([a-z0-9-]+) \| ([a-z-]+) \| ([0-9.]+) -->\s*\n# ([^\n]+)\s*\n/);
  if (!meta) throw Error("Invalid slide metadata near: " + section.slice(0,120));
  const [_,id,layout,minText,title]=meta;
  const n = section.match(/<!-- presenter-notes\s*\n([\s\S]*?)\n-->/);
  if(!n) throw Error("Missing presenter notes for "+id);
  const content = section.slice(meta.index+meta[0].length, n.index).trim();
  if (!content) throw Error("Empty slide content: "+id);
  if (content.length > 20000) throw Error("Slide exceeds LiveDeck 20KB: "+id);
  if (slides.some(s=>s.id===id)) throw Error("Duplicate ID: "+id);
  const minutes=Number(minText);
  if (!Number.isFinite(minutes) || minutes<=0) throw Error("Invalid minutes: "+id);
  total+=minutes;
  slides.push({id,type:"slide",title,markdown:content,layout,theme:"custom"});
  notes[id]=`[${minutes} min] ${n[1].trim()}`;
}
if(slides.length < 10 || slides.length > 200) throw Error("Unexpected slide count: "+slides.length);
const deck={id:"develop-anywhere-doscloud-2026",title:"Develop Anywhere — Dev Containers, Codespaces and Remote Development",style:{name:"DOSCloud / Atlanta retro DOS",baseTheme:"custom",customCss:css},handoutMode:"off",slides};
fs.writeFileSync(path.join(dir,"livedeck.json"),JSON.stringify(deck,null,2)+"\n");
fs.writeFileSync(path.join(dir,"presenter-notes.json"),JSON.stringify(notes,null,2)+"\n");
console.log(`Built ${slides.length} slides (${total.toFixed(2)} minutes budget) for LiveDeck.`);
