"use strict";

// The same union-filesystem idea DOSCloud uses for shared game installations,
// applied to the whole DOS C: volume. No guest receives a physical full copy.
//
// At room creation: hard-link one frozen snapshot of host C: (metadata only).
// For each guest: an empty ephemeral directory containing only changed files
// and whiteouts. All guest changes are discarded when the room is removed.
// Host writes break snapshot hard links, preserving the old room base.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { DriveStore } = require("./dos-drive-store");
const { LayeredDriveStore } = require("./dos-layered-drive-store");
const { components } = require("./drive");

const MAX_FILES = 2000;
const MAX_BYTES = 200 * 1024 * 1024;

function frozenSnapshot(from, to) {
  let entries = 0;
  let bytes = 0;
  let linked = 0;
  let copied = 0;
  function visit(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
      // Never follow symlinks out of the published host drive.
      if (ent.isSymbolicLink()) throw Error("Symlinks are not allowed in a DOS drive snapshot");
      const source = path.join(src, ent.name);
      const target = path.join(dest, ent.name);
      if (ent.isDirectory()) { visit(source, target); continue; }
      if (!ent.isFile()) throw Error("Unsupported DOS drive entry: " + ent.name);
      entries++;
      bytes += fs.statSync(source).size;
      if (entries > MAX_FILES || bytes > MAX_BYTES) {
        throw Object.assign(new Error("DOS drive exceeds demo room snapshot limits"), { status: 413 });
      }
      try {
        fs.linkSync(source, target);
        linked++;
      } catch (err) {
        if (err.code !== "EXDEV" && err.code !== "EPERM" && err.code !== "ENOTSUP") throw err;
        // Cross-device volumes cannot hard link. Fall back to an actual copy
        // once per room; guests still share this one immutable base.
        fs.copyFileSync(source, target, fs.constants.COPYFILE_FICLONE);
        copied++;
      }
    }
  }
  visit(from, to);
  return { entries, bytes, linked, copied };
}

class DurableHostDriveStore extends DriveStore {
  // All host DOS mutations through the FS RPC go through this class.
  // A snapshot's inode is never edited by a host's open(O_RDWR)/truncate.
  detachIfShared(name) {
    const full = this.resolve(name, { allowMissingLast: true });
    if (!fs.existsSync(full)) return;
    const st = fs.lstatSync(full);
    if (st.isSymbolicLink()) throw Error("DOS symbolic links are forbidden");
    if (!st.isFile() || st.nlink < 2) return;
    const temp = path.join(path.dirname(full), ".mini-" + crypto.randomBytes(10).toString("hex"));
    try {
      fs.copyFileSync(full, temp, fs.constants.COPYFILE_EXCL);
      fs.renameSync(temp, full);
    } finally {
      try { fs.unlinkSync(temp); } catch (err) { if (err.code !== "ENOENT") throw err; }
    }
  }

  async open(name, flags = "r") {
    const numeric = typeof flags === "number";
    const modifying = numeric
      ? Boolean(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND))
      : /[wax+]/.test(flags) || flags.startsWith("a");
    if (modifying) this.detachIfShared(name);
    return super.open(name, flags);
  }
  async truncate(name, size) {
    this.detachIfShared(name);
    return super.truncate(name, size);
  }
}

class GuestOverlayDriveStore extends LayeredDriveStore {
  constructor(baseRoot, overlayRoot) {
    super(overlayRoot, { sharedRoot: baseRoot });
    this.meta = {
      base: path.resolve(baseRoot),
      overlay: path.resolve(overlayRoot),
      whiteouts: null
    };
  }
  // Root-drive union, not the original DOSCloud GAMES/<title> subdirectory.
  layer(dosPath) {
    const parts = components(String(dosPath ?? ""));
    return { meta: this.meta, parts };
  }
}

class RoomDriveManager {
  constructor(hostRoot, { snapshotParent, deltaParent } = {}) {
    this.hostRoot = path.resolve(hostRoot);
    this.snapshotParent = snapshotParent || path.join(path.dirname(this.hostRoot), ".runtime", "mini-room-snapshots");
    this.deltaParent = deltaParent || os.tmpdir();
    this.rooms = new Map();
    fs.mkdirSync(this.hostRoot, { recursive: true });
    fs.mkdirSync(this.snapshotParent, { recursive: true });
  }

  create(code) {
    if (this.rooms.has(code)) throw Error("Room snapshot exists");
    // Place snapshot alongside drive/ so hardlinks remain on the same volume.
    const roomDir = fs.mkdtempSync(path.join(this.snapshotParent, "room-"));
    const base = path.join(roomDir, "base");
    try {
      const stats = frozenSnapshot(this.hostRoot, base);
      this.rooms.set(code, { code, roomDir, base, stats, guests: new Map() });
      return stats;
    } catch (error) {
      fs.rmSync(roomDir, { recursive: true, force: true });
      throw error;
    }
  }

  guest(code, peerId) {
    const room = this.rooms.get(code);
    if (!room) throw Object.assign(new Error("IPX room snapshot missing"), { status: 404 });
    if (!room.guests.has(peerId)) {
      const overlay = fs.mkdtempSync(path.join(this.deltaParent, "doscloud-guest-"));
      room.guests.set(peerId, overlay);
    }
    return new GuestOverlayDriveStore(room.base, room.guests.get(peerId));
  }

  getOverlay(code, peerId) {
    return this.rooms.get(code)?.guests.get(peerId);
  }

  dispose(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    this.rooms.delete(code);
    for (const overlay of room.guests.values()) {
      fs.rmSync(overlay, { recursive: true, force: true });
    }
    fs.rmSync(room.roomDir, { recursive: true, force: true });
  }

  close() {
    for (const code of [...this.rooms.keys()]) this.dispose(code);
  }
}

module.exports = { RoomDriveManager, DurableHostDriveStore, GuestOverlayDriveStore, frozenSnapshot };
