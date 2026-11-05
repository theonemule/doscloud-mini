"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const AdmZip = require("adm-zip");
const { once } = require("node:events");
const { createApp } = require("../src/server");
const { DriveError, upload, listFiles } = require("../src/drive");

test("plain files go into the selected folder of the shared DOS drive", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mini-drive-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const result = upload(dir, "C:\\GAMES", "HELLO.COM", Buffer.from([0x90, 0x90]));
  assert.equal(result.extracted, false);
  assert.deepEqual(result.changes, [{ path: "GAMES/HELLO.COM", size: 2 }]);
  assert.equal(fs.readFileSync(path.join(dir, "GAMES/HELLO.COM")).length, 2);
  assert.deepEqual(listFiles(dir), [{ path: "GAMES/HELLO.COM", size: 2 }]);
});

test("ZIP files extract into target C: folder; traversal is blocked", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mini-zip-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const archive = new AdmZip();
  archive.addFile("LEVELS/LEVEL1.TXT", Buffer.from("Level one"));
  archive.addFile("PLAY.EXE", Buffer.from("demo"));
  const result = upload(dir, "C:\\GAMES", "game.zip", archive.toBuffer());
  assert.equal(result.extracted, true);
  assert.deepEqual(result.changes.map((e) => e.path).sort(), ["GAMES/LEVELS/LEVEL1.TXT", "GAMES/PLAY.EXE"]);
  assert.equal(fs.readFileSync(path.join(dir, "GAMES/PLAY.EXE"), "utf8"), "demo");
  assert.throws(() => upload(dir, "C:\\", "../oops.exe", Buffer.from("x")), DriveError);
  assert.throws(() => upload(dir, "C:\\..", "oops.exe", Buffer.from("x")), DriveError);
  assert.throws(() => upload(dir, "D:\\", "oops.exe", Buffer.from("x")), DriveError);
});

test("HTTP server serves emulator assets, accepts file/zip and creates QR and IPX rooms", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mini-http-"));
  const { server, rooms } = createApp({ driveDir: dir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  t.after(async () => {
    rooms.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const health = await (await fetch(base + "/api/health")).json();
  assert.equal(health.ok, true);
  const page = await (await fetch(base)).text();
  assert.match(page, /DOSCloud Mini/);
  assert.match(page, /IPX room/);
  const script = await fetch(base + "/jsdos/js-dos.js");
  assert.equal(script.status, 200);
  const wasm = await fetch(base + "/emulators/wdosbox-x.wasm");
  assert.equal(wasm.status, 200);
  assert.equal(wasm.headers.get("content-type"), "application/wasm");
  await wasm.body.cancel();

  const uploaded = await fetch(base + "/api/upload?filename=HELLO.TXT&folder=C%3A%5C", {
    method: "POST", body: Buffer.from("WELCOME TO DOS")
  });
  assert.equal(uploaded.status, 201);
  assert.deepEqual((await uploaded.json()).changes, [{ path: "HELLO.TXT", size: 14 }]);
  const drive = await (await fetch(base + "/api/drive")).json();
  assert.equal(drive.files[0].path, "HELLO.TXT");
  assert.equal(await (await fetch(base + "/api/drive/file?path=HELLO.TXT")).text(), "WELCOME TO DOS");

  const createdResponse = await fetch(base + "/api/rooms", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ players: 2 })
  });
  assert.equal(createdResponse.status, 201);
  const host = (await createdResponse.json()).session;
  assert.equal(host.role, "host");
  assert.match(host.code, /^[A-HJ-NP-Z2-9]{6}$/);
  const joined = await fetch(base + "/api/rooms/" + host.code + "/join", { method: "POST" });
  assert.equal(joined.status, 201);
  const guest = (await joined.json()).session;
  assert.equal(guest.role, "guest");
  assert.equal(guest.peerId, 2);
  assert.notEqual(guest.token, host.token);
  assert.equal((await fetch(base + "/api/rooms/" + host.code + "/join", { method: "POST" })).status, 409);
  const session = await (await fetch(base + "/api/rooms/session?token=" + host.token)).json();
  assert.equal(session.session.code, host.code);
  assert.equal((await fetch(base + "/api/rooms/session?token=wrong")).status, 404);

  const qr = await fetch(base + "/api/rooms/qr?code=" + host.code);
  assert.equal(qr.status, 200);
  assert.equal(qr.headers.get("content-type"), "image/png");
  assert.equal(Buffer.from(await qr.arrayBuffer()).subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
});
