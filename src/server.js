"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { GameValidationError, listGames, importGame } = require("./catalog");
const { RoomStore } = require("./rooms");

const DEFAULT_GAMES = path.resolve(__dirname, "../games");
const DEFAULT_PUBLIC = path.resolve(__dirname, "../public");
const MAX_JSON_BYTES = 64 * 1024;

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

async function readJson(req) {
  let bytes = 0;
  const parts = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_JSON_BYTES) {
      const error = new Error("JSON body is too large (64 KiB maximum)");
      error.httpStatus = 413;
      throw error;
    }
    parts.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Expected a JSON object");
    }
    return value;
  } catch (error) {
    const wrapped = new Error("Invalid JSON object: " + error.message);
    wrapped.httpStatus = 400;
    throw wrapped;
  }
}

function serveStatic(res, publicDir, pathname) {
  const allowed = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/styles.css": ["styles.css", "text/css"] };
  const file = allowed[pathname];
  if (!file) return false;
  const filepath = path.join(publicDir, file[0]);
  const body = fs.readFileSync(filepath);
  res.writeHead(200, {
    "Content-Type": file[1] + "; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'"
  });
  res.end(body);
  return true;
}

function createApp({ gamesDir = DEFAULT_GAMES, publicDir = DEFAULT_PUBLIC } = {}) {
  const rooms = new RoomStore();
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://127.0.0.1").pathname;
      if (req.method === "GET" && pathname === "/api/health") {
        return sendJson(res, 200, { ok: true, app: "Game Cloud", storage: "git-working-tree+memory" });
      }
      if (req.method === "GET" && pathname === "/api/games") {
        return sendJson(res, 200, { games: listGames(gamesDir) });
      }
      if (req.method === "POST" && pathname === "/api/games/import") {
        const input = await readJson(req);
        const game = importGame(gamesDir, input);
        return sendJson(res, 201, { game, note: "Saved in working tree. Commit and push to persist on GitHub." });
      }
      if (req.method === "GET" && pathname === "/api/rooms") {
        return sendJson(res, 200, { rooms: rooms.list() });
      }
      if (req.method === "POST" && pathname === "/api/rooms") {
        const input = await readJson(req);
        if (!listGames(gamesDir).some((g) => g.id === input.gameId)) {
          return sendJson(res, 400, { error: "Choose a game in the catalog" });
        }
        const created = rooms.create(input.gameId, input.name ?? "Host");
        return sendJson(res, 201, created);
      }
      const match = pathname.match(/^\/api\/rooms\/([A-F0-9]{6})(?:\/(join|score|events))?$/);
      if (match) {
        const [, id, action] = match;
        if (req.method === "GET" && action === "events") {
          if (!rooms.subscribe(id, res)) return sendJson(res, 404, { error: "Room not found" });
          return;
        }
        if (req.method === "POST" && (action === "join" || action === "score")) {
          const input = await readJson(req);
          const result = action === "join"
            ? rooms.join(id, input.name ?? "Guest")
            : { room: rooms.score(id, input.playerId, input.score) };
          return sendJson(res, 200, result);
        }
      }
      if (req.method === "GET" && pathname === "/favicon.ico") {
        res.writeHead(204); return res.end();
      }
      if (req.method === "GET" && serveStatic(res, publicDir, pathname)) return;
      return sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      const status = error.code === "EEXIST" ? 409 :
        error.httpStatus || (error instanceof GameValidationError ? 400 : 400);
      console.error("Game Cloud request:", error.message);
      if (!res.headersSent) sendJson(res, status, { error: error.code === "EEXIST" ? "A game with this ID already exists" : error.message });
      else res.end();
    }
  });
  return { server, rooms };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const { server } = createApp();
  server.listen(port, "0.0.0.0", () => {
    console.log("Game Cloud running on http://localhost:" + port);
  });
}

module.exports = { createApp };
