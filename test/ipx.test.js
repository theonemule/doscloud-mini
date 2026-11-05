"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { WebSocket } = require("ws");
const { createApp } = require("../src/server");

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once("error", reject);
    ws.once("open", () => {
      ws.off("error", reject);
      resolve(ws);
    });
  });
}
function jsonMessage(ws, predicate = () => true, timeout = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off("message", onMessage); reject(Error("Timed out waiting for WS message")); }, timeout);
    function onMessage(message, binary) {
      if (binary) return;
      const value = JSON.parse(message.toString());
      if (predicate(value)) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve(value);
      }
    }
    ws.on("message", onMessage);
  });
}

test("real IPX relay binds tokens, announces host readiness and passes room-scoped binary packets", async (t) => {
  const { server, rooms } = createApp();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "ws://127.0.0.1:" + server.address().port;
  const host = rooms.create(2);
  const guest = rooms.join(host.code);
  t.after(async () => {
    rooms.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  const hostWs = await connect(base + "/ws/ipx?token=" + host.token);
  t.after(() => hostWs.terminate());
  const guestWs = await connect(base + "/ws/ipx?token=" + guest.token);
  t.after(() => guestWs.terminate());

  const hostReadyPromise = jsonMessage(guestWs, (m) => m.type === "host-ready");
  hostWs.send(JSON.stringify({ type: "ipx-server-ready" }));
  assert.equal((await hostReadyPromise).hostPeerId, 1);

  const nextPacket = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("No forwarded IPX data")), 2500);
    guestWs.once("message", (bytes, isBinary) => {
      clearTimeout(timer);
      resolve({ bytes, isBinary });
    });
  });
  const frame = Buffer.alloc(9);
  frame.writeUInt32BE(guest.peerId, 0);
  frame.set([1, 2, 3, 4, 5], 4);
  hostWs.send(frame, { binary: true });
  const { bytes, isBinary } = await nextPacket;
  assert.equal(isBinary, true);
  assert.equal(bytes.readUInt32BE(0), host.peerId);
  assert.deepEqual([...bytes.subarray(4)], [1, 2, 3, 4, 5]);
});
