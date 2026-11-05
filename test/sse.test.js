"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createApp } = require("../src/server");

test("a second client joining a multiplayer room pushes a live SSE update", async () => {
  const { server, rooms } = createApp();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const room = rooms.create("star-tap", "Host");
  const base = "http://127.0.0.1:" + server.address().port;
  const controller = new AbortController();
  let reader;
  try {
    const response = await fetch(base + "/api/rooms/" + room.room.id + "/events", {
      signal: controller.signal
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/event-stream/);
    reader = response.body.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    assert.match(first, /"Host"/);
    rooms.join(room.room.id, "Guest");
    const second = new TextDecoder().decode((await reader.read()).value);
    assert.match(second, /"Guest"/);
  } finally {
    controller.abort();
    if (reader) await reader.cancel().catch(() => {});
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
