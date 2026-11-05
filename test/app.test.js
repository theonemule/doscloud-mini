"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { createApp } = require("../src/server");
const { validateGame, GameValidationError } = require("../src/catalog");
const { RoomStore } = require("../src/rooms");

test("validates game manifests and rejects executable/path traversal input", () => {
  assert.deepEqual(validateGame({
    id: "new-game", title: " Demo ", description: "Cool", kind: "tap",
    targetLabel: "GO", extra: "<script>ignored</script>"
  }), {
    id: "new-game", title: "Demo", description: "Cool",
    kind: "tap", durationSeconds: 20, targetLabel: "GO"
  });
  assert.throws(() => validateGame({
    id: "../outside", title: "Bad", description: "Invalid", kind: "tap"
  }), GameValidationError);
  assert.throws(() => validateGame({
    id: "bad-game", title: "Bad", description: "Executable", kind: "javascript"
  }), GameValidationError);
});

test("room store creates, joins and scores without a database", () => {
  const store = new RoomStore();
  const host = store.create("star-tap", "Presenter");
  assert.equal(store.list().length, 1);
  const guest = store.join(host.room.id, "Audience");
  const room = store.score(host.room.id, guest.playerId, 7);
  assert.equal(room.players.length, 2);
  assert.equal(room.players[1].score, 7);
  assert.throws(() => store.score(host.room.id, "fake", 3), /Player not found/);
  assert.throws(() => store.join("BAD", "Guest"), /Room not found/);
});

test("HTTP app serves frontend, handles game imports and live room APIs", async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "game-cloud-test-"));
  const gameDir = path.join(temp, "games");
  fs.mkdirSync(gameDir);
  fs.copyFileSync(path.resolve(__dirname, "../games/star-tap.json"), path.join(gameDir, "star-tap.json"));
  const { server } = createApp({ gamesDir: gameDir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  });

  async function post(url, payload) {
    return fetch(base + url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  const health = await (await fetch(base + "/api/health")).json();
  assert.equal(health.ok, true);
  const page = await fetch(base + "/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Game Cloud/);
  assert.equal((await (await fetch(base + "/api/games")).json()).games.length, 1);

  const newGame = {
    id: "imported-quiz", title: "Imported Quiz", description: "Safe JSON",
    kind: "quiz", questions: [{ prompt: "Test?", answers: ["Yes", "No"], correctIndex: 0 }]
  };
  const imported = await post("/api/games/import", newGame);
  assert.equal(imported.status, 201);
  assert.equal(fs.existsSync(path.join(gameDir, "imported-quiz.json")), true);
  assert.equal((await post("/api/games/import", newGame)).status, 409);
  assert.equal((await post("/api/games/import", { ...newGame, id: "../attack" })).status, 400);
  assert.equal((await fetch(base + "/api/games")).status, 200);

  const createdResponse = await post("/api/rooms", { gameId: "star-tap", name: "Host" });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  const joined = await (await post("/api/rooms/" + created.room.id + "/join", { name: "Guest" })).json();
  assert.equal(joined.room.players.length, 2);
  const scored = await (await post("/api/rooms/" + created.room.id + "/score", {
    playerId: joined.playerId, score: 9
  })).json();
  assert.equal(scored.room.players[1].score, 9);
  const listed = await (await fetch(base + "/api/rooms")).json();
  assert.equal(listed.rooms.length, 1);
  assert.equal((await post("/api/rooms", { gameId: "not-real" })).status, 400);
});
