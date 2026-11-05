"use strict";

const { randomBytes } = require("node:crypto");
const { EventEmitter } = require("node:events");

function nameOf(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 40) {
    throw new Error("Player name must be 1-40 characters");
  }
  return value.trim();
}

class RoomStore extends EventEmitter {
  constructor() {
    super();
    this.rooms = new Map();
  }

  snapshot(room) {
    return {
      id: room.id,
      gameId: room.gameId,
      createdAt: room.createdAt,
      players: room.players.map((player) => ({ ...player }))
    };
  }

  list() {
    return [...this.rooms.values()].map((room) => this.snapshot(room));
  }

  get(id) {
    const room = this.rooms.get(id);
    return room ? this.snapshot(room) : null;
  }

  create(gameId, playerName) {
    if (this.rooms.size >= 100) throw new Error("Demo room limit reached");
    let id;
    do { id = randomBytes(3).toString("hex").toUpperCase(); } while (this.rooms.has(id));
    const playerId = randomBytes(8).toString("hex");
    const room = {
      id, gameId, createdAt: new Date().toISOString(),
      players: [{ id: playerId, name: nameOf(playerName), score: 0 }]
    };
    this.rooms.set(id, room);
    this.emit("change", this.snapshot(room));
    return { room: this.snapshot(room), playerId };
  }

  join(id, playerName) {
    const room = this.rooms.get(id);
    if (!room) throw new Error("Room not found");
    if (room.players.length >= 12) throw new Error("Room is full");
    const playerId = randomBytes(8).toString("hex");
    room.players.push({ id: playerId, name: nameOf(playerName), score: 0 });
    this.emit("change", this.snapshot(room));
    return { room: this.snapshot(room), playerId };
  }

  score(id, playerId, score) {
    const room = this.rooms.get(id);
    if (!room) throw new Error("Room not found");
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new Error("Player not found");
    if (!Number.isInteger(score) || score < 0 || score > 1000) {
      throw new Error("Score must be an integer from 0 to 1000");
    }
    player.score = score;
    this.emit("change", this.snapshot(room));
    return this.snapshot(room);
  }

  subscribe(id, response) {
    const first = this.get(id);
    if (!first) return false;
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    const send = (room) => {
      if (room.id === id && !response.destroyed) response.write("data: " + JSON.stringify(room) + "\n\n");
    };
    this.on("change", send);
    send(first);
    const heartbeat = setInterval(() => {
      if (!response.destroyed) response.write(": ping\n\n");
    }, 25000);
    heartbeat.unref();
    response.on("close", () => {
      clearInterval(heartbeat);
      this.off("change", send);
    });
    return true;
  }
}

module.exports = { RoomStore };
