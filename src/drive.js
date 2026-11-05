"use strict";

const fs = require("node:fs");
const path = require("node:path");
const AdmZip = require("adm-zip");

const MAX_UPLOAD = 64 * 1024 * 1024;
const MAX_EXTRACTED = 200 * 1024 * 1024;
const MAX_ENTRIES = 2000;

class DriveError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function components(raw) {
  if (typeof raw !== "string" || raw.length > 240 || raw.includes("\0")) {
    throw new DriveError("Invalid DOS path");
  }
  let normalized = raw.replace(/\\/g, "/");
  if (/^[a-z]:/i.test(normalized)) {
    if (!/^c:/i.test(normalized)) throw new DriveError("Only the C: drive is writable");
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith("//")) throw new DriveError("Absolute paths are not permitted");
  if (normalized.startsWith("/")) normalized = normalized.slice(1);
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((p) => p === "." || p === ".." || /[<>:"|?*\x00-\x1f]/.test(p) || p.length > 80)) {
    throw new DriveError("Unsafe path component");
  }
  if (parts.length > 20) throw new DriveError("Path too deep");
  return parts;
}

function filePath(root, raw) {
  const parts = components(raw);
  if (!parts.length) throw new DriveError("File name required");
  const base = path.resolve(root);
  const location = path.resolve(base, ...parts);
  if (!location.startsWith(base + path.sep)) throw new DriveError("Path escapes drive");
  let p = base;
  for (const piece of parts) {
    p = path.join(p, piece);
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) {
      throw new DriveError("Links are not supported on the demo drive");
    }
  }
  return location;
}

function ensureDrive(root) {
  fs.mkdirSync(root, { recursive: true });
}

function listFiles(root) {
  ensureDrive(root);
  const out = [];
  function visit(current, prefix, depth) {
    if (depth > 20) throw new DriveError("Directory too deep");
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const relative = prefix ? prefix + "/" + entry.name : entry.name;
      if (entry.isDirectory()) visit(path.join(current, entry.name), relative, depth + 1);
      else if (entry.isFile()) out.push({ path: relative, size: fs.statSync(path.join(current, entry.name)).size });
    }
  }
  visit(root, "", 0);
  if (out.length > MAX_ENTRIES) throw new DriveError("Demo drive file limit reached", 413);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function upload(root, folder, filename, bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_UPLOAD) {
    throw new DriveError("Upload must be 1 byte to 64 MiB", 413);
  }
  const destination = components(folder ?? "");
  const file = components(filename);
  if (file.length !== 1) throw new DriveError("Upload a file name, not a path");
  ensureDrive(root);
  const changes = [];
  if (/\.zip$/i.test(file[0])) {
    let archive;
    try { archive = new AdmZip(bytes); }
    catch { throw new DriveError("Invalid ZIP archive"); }
    const entries = archive.getEntries();
    if (entries.length > MAX_ENTRIES) throw new DriveError("Too many ZIP entries", 413);
    const files = [];
    let size = 0;
    for (const entry of entries) {
      const inner = components(entry.entryName);
      if (!inner.length) continue;
      const relative = [...destination, ...inner].join("/");
      filePath(root, relative);
      if (entry.isDirectory) continue;
      size += entry.header.size;
      if (size > MAX_EXTRACTED) throw new DriveError("ZIP expands beyond 200 MiB", 413);
      files.push({ entry, relative });
    }
    for (const { entry, relative } of files) {
      let data;
      try { data = entry.getData(); }
      catch { throw new DriveError("ZIP extraction failed"); }
      if (data.length > MAX_EXTRACTED) throw new DriveError("ZIP entry too large", 413);
      const target = filePath(root, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data, { flag: "w" });
      changes.push({ path: relative, size: data.length });
    }
  } else {
    const relative = [...destination, file[0]].join("/");
    const target = filePath(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: "w" });
    changes.push({ path: relative, size: bytes.length });
  }
  return { changes, extracted: /\.zip$/i.test(file[0]) };
}

function readFile(root, relative) {
  const target = filePath(root, relative);
  try {
    return fs.readFileSync(target);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      throw new DriveError("File not found", 404);
    }
    throw error;
  }
}

module.exports = { DriveError, components, filePath, listFiles, upload, readFile, MAX_UPLOAD };
