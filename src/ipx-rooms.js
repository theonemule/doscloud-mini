"use strict";

const crypto = require("node:crypto");
const { WebSocketServer, WebSocket } = require("ws");

const MAX_ROOMS = 100;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_AGE_MS = 2 * 60 * 60 * 1000;
class IpxRoomError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function roomCode() {
  return Array.from(crypto.randomBytes(6), (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}
function token() { return crypto.randomBytes(24).toString("base64url"); }

class IpxRooms {
  constructor() {
    this.rooms = new Map();
    this.tokens = new Map();
    this.onDispose = null;
    this.expiryTimer = setInterval(() => this.trim(), 60_000);
    this.expiryTimer.unref?.();
    this.wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 65540 });
  }
  remove(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    this.rooms.delete(code);
    for (const peer of room.peers) {
      this.tokens.delete(peer.token);
      peer.socket?.close(1001, "Room removed");
    }
    this.onDispose?.(room);
  }
  trim() {
    for (const room of this.rooms.values()) {
      if (Date.now() - room.createdAt > MAX_AGE_MS && room.peers.every((p) => !p.socket))
        this.remove(room.code);
    }
  }
  create(players) {
    this.trim();
    if (!Number.isInteger(players) || players < 2 || players > 8)
      throw new IpxRoomError("Select 2 to 8 players");
    if (this.rooms.size >= MAX_ROOMS) throw new IpxRoomError("Room limit reached", 429);
    let code;
    do { code = roomCode(); } while (this.rooms.has(code));
    const room = { code, players, createdAt: Date.now(), hostReady: false, peers: [] };
    this.rooms.set(code, room);
    return this.newPeer(room, "host");
  }
  newPeer(room, role) {
    if (room.peers.length >= room.players) throw new IpxRoomError("Room is full", 409);
    const peer = { peerId: room.peers.length + 1, role, token: token(), room, socket: null };
    room.peers.push(peer);
    this.tokens.set(peer.token, peer);
    return this.describe(peer);
  }
  join(code) {
    this.trim();
    const room = this.rooms.get(String(code || "").toUpperCase());
    if (!room) throw new IpxRoomError("Room not found or expired", 404);
    return this.newPeer(room, "guest");
  }
  describe(peer) {
    return {
      token: peer.token, code: peer.room.code, role: peer.role,
      players: peer.room.players, peerId: peer.peerId
    };
  }
  session(value) {
    this.trim();
    const peer = this.tokens.get(value);
    if (!peer) throw new IpxRoomError("Invalid IPX session", 404);
    return this.describe(peer);
  }
  handleUpgrade(req, socket, head) {
    let value;
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname !== "/ws/ipx") throw new Error("Wrong endpoint");
      value = url.searchParams.get("token");
    } catch {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return;
    }
    const peer = this.tokens.get(value);
    if (!peer) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.connect(ws, peer));
  }
  send(peer, payload) {
    if (peer.socket?.readyState === WebSocket.OPEN) peer.socket.send(JSON.stringify(payload));
  }
  broadcast(room, message, skip = null) {
    for (const peer of room.peers) if (peer !== skip) this.send(peer, message);
  }
  connect(ws, peer) {
    const room = peer.room;
    peer.socket?.close(1000, "New connection");
    peer.socket = ws;
    if (peer.role === "host") room.hostReady = false;
    this.send(peer, {
      type: "welcome", peerId: peer.peerId, role: peer.role,
      hostPeerId: 1, hostOnline: Boolean(room.peers[0].socket),
      hostReady: room.hostReady, roomCode: room.code,
      peers: room.peers.filter((p) => p.socket).map((p) => ({ peerId: p.peerId, role: p.role })),
      roomReady: room.peers.filter((p) => p.socket).length >= room.players
    });
    this.broadcast(room, { type: "peer-joined", peerId: peer.peerId, role: peer.role }, peer);
    if (room.peers.filter((p) => p.socket).length >= room.players)
      this.broadcast(room, { type: "room-ready", connectedPlayers: room.players });
    if (room.hostReady) this.send(peer, { type: "host-ready", hostPeerId: 1 });
    ws.on("message", (message, binary) => {
      if (peer.socket !== ws) return;
      if (!binary) {
        if (message.length > 256) return ws.close(1003, "Invalid control message");
        let data;
        try { data = JSON.parse(message.toString()); } catch { return ws.close(1003); }
        if (peer.role === "host" && data.type === "ipx-server-ready") {
          room.hostReady = true;
          this.broadcast(room, { type: "host-ready", hostPeerId: 1 });
        } else ws.close(1003, "Unknown control message");
        return;
      }
      if (message.length < 5 || message.length > 65540) return;
      const targetId = message.readUInt32BE(0);
      if (targetId === peer.peerId || targetId === 0) return;
      if (peer.role === "host" && !room.hostReady) return;
      const target = room.peers.find((p) => p.peerId === targetId);
      if (!target || target.socket?.readyState !== WebSocket.OPEN) return;
      if (target.socket.bufferedAmount > 2 * 1024 * 1024) return target.socket.close(1013, "Slow IPX peer");
      const frame = Buffer.alloc(message.length);
      frame.writeUInt32BE(peer.peerId, 0);
      message.copy(frame, 4, 4);
      target.socket.send(frame, { binary: true });
    });
    ws.on("close", () => {
      if (peer.socket !== ws) return;
      peer.socket = null;
      if (peer.role === "host") room.hostReady = false;
      this.broadcast(room, { type: "peer-left", peerId: peer.peerId, role: peer.role });
    });
  }
  close() {
    clearInterval(this.expiryTimer);
    for (const client of this.wss.clients) client.terminate();
    this.wss.close();
  }
}
module.exports = { IpxRooms, IpxRoomError };
