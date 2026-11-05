"use strict";

// Existing DOSCloud remote filesystem binary protocol, but with the
// persistent host/ephemeral guest root determined by a room session token.
const { WebSocketServer, WebSocket } = require("ws");
const { encodePacket, decodePacket } = require("./dos-protocol");
const { DurableHostDriveStore } = require("./room-drive");

function errorPacket(request, err) {
  const code = /^[A-Z]+$/.test(err?.code || "") ? err.code : "EIO";
  return encodePacket({
    id: request?.header?.id ?? null,
    ok: false,
    code,
    error: code === "EIO" ? "DOS filesystem operation failed" : (err.message || code)
  });
}

class FilesystemRPC {
  constructor({ rooms, roomDrives, hostRoot }) {
    this.rooms = rooms;
    this.roomDrives = roomDrives;
    this.hostRoot = hostRoot;
    this.hostTokens = new Set();
    this.sessions = new Map();
    this.wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 4 * 1024 * 1024 + 65536 });
  }

  newHostToken(token) { this.hostTokens.add(token); }

  getLaunch(token) {
    if (this.hostTokens.has(token)) return { role: "host", code: null };
    const peer = this.rooms.tokens.get(token);
    if (!peer) throw Object.assign(new Error("Invalid DOS drive launch"), { status: 403 });
    return { role: peer.role, code: peer.room.code, peerId: peer.peerId };
  }

  getStore(token, name = "default") {
    const launch = this.getLaunch(token);
    const safeName = String(name || "default").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 96);
    const key = token + ":" + safeName;
    if (!this.sessions.has(key)) {
      const store = launch.role === "guest"
        ? this.roomDrives.guest(launch.code, launch.peerId)
        : new DurableHostDriveStore(this.hostRoot);
      this.sessions.set(key, { store, key, launch });
    }
    return this.sessions.get(key);
  }

  async dispatch(token, session, raw) {
    let request;
    try {
      request = decodePacket(raw);
      const { id, op, ...args } = request.header;
      if (typeof op !== "string" || !/^[a-z]+$/.test(op)) throw Error("Invalid FS operation");
      const target = this.getStore(token, session);
      const value = await target.store.dispatch(op, args, request.payload);
      return encodePacket({ id, ok: true, ...(value?.header || value || {}) }, value?.payload || new Uint8Array(0));
    } catch (error) {
      return errorPacket(request, error);
    }
  }

  upgrade(req, socket, head) {
    const url = new URL(req.url, "http://127.0.0.1");
    const token = url.searchParams.get("launch");
    let launch;
    try { launch = this.getLaunch(token); }
    catch {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    const sessionId = url.searchParams.get("session") || "default";
    this.wss.handleUpgrade(req, socket, head, ws => {
      // Keep per-launch IO serialized; no operation may interleave a file
      // close/write in a single browser's FS session.
      let chain = Promise.resolve();
      ws.on("message", (raw, binary) => {
        if (!binary) { ws.close(1003, "Binary filesystem packets only"); return; }
        chain = chain.then(async () => {
          const reply = await this.dispatch(token, sessionId, raw);
          if (ws.readyState === WebSocket.OPEN) ws.send(reply, { binary: true });
        }).catch(() => ws.close(1011, "Filesystem bridge failed"));
      });
    });
  }

  async disposeRoom(code) {
    const affected = [...this.sessions.values()].filter(s => s.launch.code === code);
    for (const session of affected) {
      this.sessions.delete(session.key);
      await session.store.closeAll();
    }
    this.roomDrives.dispose(code);
  }

  async close() {
    for (const connection of this.wss.clients) connection.terminate();
    for (const session of this.sessions.values()) await session.store.closeAll();
    this.sessions.clear();
    this.wss.close();
    this.hostTokens.clear();
  }
}
module.exports = { FilesystemRPC };
