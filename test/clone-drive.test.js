"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { RoomDriveManager, DurableHostDriveStore } = require("../src/room-drive");
const { upload } = require("../src/drive");

test("room creation hardlinks host base once, guest clone contains only delta, host persists", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mini-clone-test-"));
  const host = path.join(root, "drive");
  const snapshots = path.join(root, "snapshots");
  const guestTmp = path.join(root, "guest-tmp");
  fs.mkdirSync(host);
  fs.mkdirSync(guestTmp);
  fs.writeFileSync(path.join(host, "HOST.DAT"), "ORIGINAL HOST SAVE");
  fs.writeFileSync(path.join(host, "PLAY.EXE"), Buffer.alloc(512 * 1024, 7));
  const clones = new RoomDriveManager(host, { snapshotParent: snapshots, deltaParent: guestTmp });
  t.after(() => { clones.close(); fs.rmSync(root, { recursive: true, force: true }); });

  const stats = clones.create("ABCDEF");
  assert.equal(stats.entries, 2);
  assert.equal(stats.linked, 2, "source files should be linked rather than copied");
  assert.equal(stats.copied, 0);
  const initial = clones.rooms.get("ABCDEF");
  assert.equal(fs.statSync(path.join(host, "HOST.DAT")).ino, fs.statSync(path.join(initial.base, "HOST.DAT")).ino);
  const store = clones.guest("ABCDEF", 2);
  const overlay = clones.getOverlay("ABCDEF", 2);
  assert.deepEqual(fs.readdirSync(overlay), [], "guest clone starts with an empty delta");
  assert.equal((await store.list("")).entries.length, 2);
  assert.equal((await store.stat("PLAY.EXE")).size, 512 * 1024);
  assert.deepEqual(fs.readdirSync(overlay), [], "reading from the shared base copies nothing");

  // Host editing an existing file must break its link to room's frozen base.
  const durable = new DurableHostDriveStore(host);
  const h = await durable.open("HOST.DAT", "w");
  await durable.write(h.handle, Buffer.from("HOST NEW"), 0);
  await durable.close(h.handle);
  assert.equal(fs.readFileSync(path.join(host, "HOST.DAT"), "utf8"), "HOST NEW");
  assert.equal(fs.readFileSync(path.join(initial.base, "HOST.DAT"), "utf8"), "ORIGINAL HOST SAVE");
  const g = await store.open("HOST.DAT", "r");
  assert.equal((await store.read(g.handle, 30, 0)).payload.toString("utf8"), "ORIGINAL HOST SAVE");
  await store.close(g.handle);

  // A guest write is copy-on-write; only the touched file enters the delta.
  const change = await store.open("HOST.DAT", "w");
  await store.write(change.handle, Buffer.from("GUEST ONLY"), 0);
  await store.close(change.handle);
  assert.deepEqual(fs.readdirSync(overlay), ["HOST.DAT"]);
  assert.equal(fs.readFileSync(path.join(overlay, "HOST.DAT"), "utf8"), "GUEST ONLY");
  assert.equal(fs.readFileSync(path.join(host, "HOST.DAT"), "utf8"), "HOST NEW");
  assert.equal(fs.readFileSync(path.join(initial.base, "HOST.DAT"), "utf8"), "ORIGINAL HOST SAVE");

  const guest3 = clones.guest("ABCDEF", 3);
  assert.deepEqual(fs.readdirSync(clones.getOverlay("ABCDEF", 3)), []);
  const peer3file = await guest3.open("HOST.DAT", "r");
  assert.equal((await guest3.read(peer3file.handle, 30, 0)).payload.toString("utf8"), "ORIGINAL HOST SAVE");
  await guest3.close(peer3file.handle);

  // Deleting a base file creates only a whiteout in the guest delta.
  await store.unlink("PLAY.EXE");
  assert.equal((await store.list("")).entries.some((e) => e.name === "PLAY.EXE"), false);
  assert.equal(fs.existsSync(path.join(host, "PLAY.EXE")), true);
  assert.equal(fs.existsSync(path.join(initial.base, "PLAY.EXE")), true);

  // Host upload replacement is atomic, preserving hardlinked room snapshot.
  upload(host, "C:\\", "PLAY.EXE", Buffer.from("HOST UPLOAD"));
  assert.equal(fs.readFileSync(path.join(host, "PLAY.EXE"), "utf8"), "HOST UPLOAD");
  assert.equal(fs.statSync(path.join(initial.base, "PLAY.EXE")).size, 512 * 1024);
  await durable.closeAll();
  await store.closeAll();
  await guest3.closeAll();
  clones.dispose("ABCDEF");
  assert.equal(fs.existsSync(initial.roomDir), false);
  assert.equal(fs.existsSync(overlay), false);
  assert.equal(fs.existsSync(path.join(host, "PLAY.EXE")), true);
});

test("room snapshot has bounded file count and rejects symlinks", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mini-clone-path-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const host = path.join(root, "drive"); fs.mkdirSync(host);
  fs.symlinkSync("/etc/passwd", path.join(host, "BAD"));
  const clones = new RoomDriveManager(host);
  t.after(() => clones.close());
  assert.throws(() => clones.create("ABCDEF"), /Symlinks are not allowed/);
  assert.equal(clones.rooms.size, 0);
});
