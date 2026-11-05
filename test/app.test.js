"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const AdmZip = require("adm-zip");
const { once } = require("node:events");
const { createApp } = require("../src/server");
const { DriveError, upload } = require("../src/drive");
const { encodePacket, decodePacket } = require("../src/dos-protocol");

test("plain files and ZIP upload to durable host with traversal validation", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mini-upload-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(upload(root, "C:\\GAMES", "HELLO.TXT", Buffer.from("hi")).changes, [
    { path: "GAMES/HELLO.TXT", size: 2 }
  ]);
  const zip = new AdmZip();
  zip.addFile("TITLE/GAME.EXE", Buffer.from("DOS"));
  assert.equal(upload(root, "C:\\", "GAME.ZIP", zip.toBuffer()).extracted, true);
  assert.equal(fs.readFileSync(path.join(root, "TITLE/GAME.EXE"), "utf8"), "DOS");
  assert.throws(() => upload(root, "C:\\", "../BAD", Buffer.from("x")), DriveError);
  assert.throws(() => upload(root, "D:\\", "BAD", Buffer.from("x")), DriveError);
});

test("HTTP creates a hardlink snapshot once per room; FS RPC mounts host and guest overlays", async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mini-api-clone-"));
  const driveDir = path.join(temp, "drive");
  fs.mkdirSync(driveDir);
  fs.writeFileSync(path.join(driveDir, "BASE.TXT"), "ORIGINAL");
  const app = createApp({ driveDir, snapshotParent: path.join(temp, "snap"), deltaParent: temp });
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const base = "http://127.0.0.1:" + app.server.address().port;
  t.after(async () => { await app.close(); fs.rmSync(temp, { recursive: true, force: true }); });

  const health = await (await fetch(base + "/api/health")).json();
  assert.equal(health.ok, true);
  assert.match(health.filesystem, /COW/);
  assert.match(await (await fetch(base)).text(), /DOSCloud Mini/);
  assert.equal((await fetch(base + "/emulators/remote-fs-bridge.js")).status, 200);
  const wasm = await fetch(base + "/emulators/wdosbox-x.wasm");
  assert.equal(wasm.status, 200);
  await wasm.body.cancel();

  const owner = (await (await fetch(base + "/api/drive/session", { method: "POST" })).json()).token;
  const createdResponse = await fetch(base + "/api/rooms", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ players: 2 })
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  const host = created.session;
  assert.equal(host.role, "host");
  assert.equal(created.snapshot.linked, 1);
  assert.equal(created.snapshot.copied, 0);
  const join = await fetch(base + "/api/rooms/" + host.code + "/join", { method: "POST" });
  assert.equal(join.status, 201);
  const guest = (await join.json()).session;
  assert.equal(guest.peerId, 2);
  const snapshot = app.roomDrives.rooms.get(host.code);
  assert.equal(fs.statSync(path.join(snapshot.base, "BASE.TXT")).ino, fs.statSync(path.join(driveDir, "BASE.TXT")).ino);

  async function rpc(token, id, op, args = {}, payload) {
    const res = await fetch(base + "/api/fs?launch=" + token + "&session=test", {
      method: "POST", headers: { "content-type": "application/octet-stream" },
      body: encodePacket({ id, op, ...args }, payload)
    });
    assert.equal(res.status, 200);
    return decodePacket(Buffer.from(await res.arrayBuffer()));
  }
  async function fetchContents(token, name) {
    const opened = await rpc(token, 1, "open", { path: name, flags: "r" });
    assert.equal(opened.header.ok, true, JSON.stringify(opened.header));
    const data = await rpc(token, 2, "read", { handle: opened.header.handle, length: 64, position: 0 });
    await rpc(token, 3, "close", { handle: opened.header.handle });
    return Buffer.from(data.payload).toString("utf8");
  }

  assert.equal(await fetchContents(guest.token, "BASE.TXT"), "ORIGINAL");

  // Original host persists a different version AFTER creating the room.
  const uploadHost = await fetch(base + "/api/upload?token=" + owner + "&filename=BASE.TXT", {
    method: "POST", body: Buffer.from("DURABLE HOST")
  });
  assert.equal(uploadHost.status, 201);
  assert.equal(await fetchContents(host.token, "BASE.TXT"), "DURABLE HOST");
  assert.equal(await fetchContents(guest.token, "BASE.TXT"), "ORIGINAL");

  // Guest copies only the modified bytes into a disposable delta directory.
  const guestOverlayBefore = app.roomDrives.getOverlay(host.code, guest.peerId);
  assert.deepEqual(fs.readdirSync(guestOverlayBefore), []);
  const result = await fetch(base + "/api/upload?token=" + guest.token + "&filename=BASE.TXT", {
    method: "POST", body: Buffer.from("GUEST SAVE")
  });
  assert.equal(result.status, 201);
  assert.equal((await result.json()).transient, true);
  assert.equal(await fetchContents(guest.token, "BASE.TXT"), "GUEST SAVE");
  assert.equal(await fetchContents(host.token, "BASE.TXT"), "DURABLE HOST");
  assert.deepEqual(fs.readdirSync(guestOverlayBefore), ["BASE.TXT"]);

  const qr = await fetch(base + "/api/rooms/qr?code=" + host.code);
  assert.equal(qr.status, 200);
  assert.equal(Buffer.from(await qr.arrayBuffer()).subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const invalid = await fetch(base + "/api/upload?token=not-valid&filename=BAD", {
    method: "POST", body: Buffer.from("x")
  });
  assert.equal(invalid.status, 403);
  const guestEnd = await fetch(base + "/api/rooms/" + host.code + "/end", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: guest.token })
  });
  assert.equal(guestEnd.status, 403, "guest must not end another player's room");
  const ended = await fetch(base + "/api/rooms/" + host.code + "/end", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: host.token })
  });
  assert.equal(ended.status, 200);
  assert.equal(fs.existsSync(snapshot.roomDir), false);
  assert.equal(fs.existsSync(guestOverlayBefore), false);
  assert.equal(fs.readFileSync(path.join(driveDir, "BASE.TXT"), "utf8"), "DURABLE HOST");
});
