"use strict";

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const QRCode = require("qrcode");
const { DriveError, upload, MAX_UPLOAD } = require("./drive");
const { IpxRooms, IpxRoomError } = require("./ipx-rooms");
const { RoomDriveManager } = require("./room-drive");
const { FilesystemRPC } = require("./fs-rpc");

const PUBLIC_DIR = path.resolve(__dirname, "../public");
const DRIVE_DIR = path.resolve(__dirname, "../drive");
const MAX_JSON = 16 * 1024;
const CONTENT_TYPES = new Map([
  [".html", "text/html"], [".js", "text/javascript"], [".mjs", "text/javascript"],
  [".css", "text/css"], [".wasm", "application/wasm"], [".png", "image/png"],
  [".woff", "font/woff"], [".svg", "image/svg+xml"], [".txt", "text/plain"]
]);
const STATIC_CSP = "default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src 'self' ws: wss:; img-src 'self' data: blob:; object-src 'none'";

function json(res, status, data) {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length, "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff" });
  res.end(body);
}
async function readBody(req, limit) {
  let size = 0, chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Upload is too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function readJson(req) {
  try {
    const input = JSON.parse((await readBody(req, MAX_JSON)).toString("utf8"));
    if (!input || typeof input !== "object" || Array.isArray(input)) throw Error();
    return input;
  } catch (error) {
    if (error.status === 413) throw error;
    throw Object.assign(new Error("Invalid JSON object"), { status: 400 });
  }
}
function staticFile(res, pathname, publicDir) {
  if (!/^\/(?:jsdos\/|emulators\/|app\.js$|styles\.css$|ipx-websocket-net\.js$|$)/.test(pathname)) return false;
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const target = path.resolve(publicDir, relative);
  if (!target.startsWith(publicDir + path.sep)) return false;
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return false;
  const type = CONTENT_TYPES.get(path.extname(target));
  if (!type) return false;
  const info = fs.statSync(target);
  res.writeHead(200, {
    "Content-Type": type + (type.startsWith("text/") ? "; charset=utf-8" : ""),
    "Content-Length": info.size,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": STATIC_CSP,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp"
  });
  fs.createReadStream(target).pipe(res);
  return true;
}

function createApp({ driveDir = DRIVE_DIR, publicDir = PUBLIC_DIR, snapshotParent, deltaParent } = {}) {
  fs.mkdirSync(driveDir, { recursive: true });
  const roomDrives = new RoomDriveManager(driveDir, { snapshotParent, deltaParent });
  const rooms = new IpxRooms();
  const filesystem = new FilesystemRPC({ rooms, roomDrives, hostRoot: driveDir });

  rooms.onDispose = (room) => {
    // Dispose filesystem handles before deleting a room's temporary clone.
    void filesystem.disposeRoom(room.code);
  };

  const tls = process.env.TLS_KEY_PATH && process.env.TLS_CERT_PATH
    ? { key: fs.readFileSync(process.env.TLS_KEY_PATH), cert: fs.readFileSync(process.env.TLS_CERT_PATH) }
    : null;
  const server = tls ? https.createServer(tls, requestHandler) : http.createServer(requestHandler);

  function view(token) {
    const launch = filesystem.getLaunch(token);
    if (launch.role === "guest") {
      return { root: roomDrives.guest(launch.code, launch.peerId).meta.overlay, role: "guest" };
    }
    return { root: driveDir, role: "host" };
  }

  async function requestHandler(req, res) {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      const name = url.pathname;
      if (req.method === "GET" && name === "/api/health")
        return json(res, 200, { ok: true, app: "DOSCloud Mini", emulator: "DOSBox-X / js-dos",
          ipx: "websocket", filesystem: "DOSCloud REMOTEFS + room COW overlays" });
      if (req.method === "POST" && name === "/api/drive/session") {
        const token = crypto.randomBytes(24).toString("base64url");
        filesystem.newHostToken(token);
        return json(res, 201, { token, role: "host" });
      }
      if (req.method === "POST" && name === "/api/upload") {
        const token = url.searchParams.get("token");
        const destination = view(token);
        const body = await readBody(req, MAX_UPLOAD);
        const result = upload(destination.root,
          url.searchParams.get("folder") || "C:\\", url.searchParams.get("filename"), body);
        return json(res, 201, { ...result, role: destination.role, transient: destination.role === "guest" });
      }
      if (req.method === "POST" && name === "/api/rooms") {
        const { players } = await readJson(req);
        const session = rooms.create(players);
        try {
          // A frozen, hardlink-backed base snapshot is created ONCE per room,
          // before any player joins. Guest creation is then an empty overlay.
          const snapshot = roomDrives.create(session.code);
          return json(res, 201, { session, snapshot });
        } catch (error) {
          rooms.remove(session.code);
          throw error;
        }
      }
      const join = name.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})\/join$/);
      if (req.method === "POST" && join)
        return json(res, 201, { session: rooms.join(join[1]) });
      const endRoom = name.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})\/end$/);
      if (req.method === "POST" && endRoom) {
        const { token } = await readJson(req);
        const peer = rooms.tokens.get(token);
        if (!peer || peer.role !== "host" || peer.room.code !== endRoom[1])
          return json(res, 403, { error: "Only the room host can end the session" });
        await filesystem.disposeRoom(endRoom[1]);
        rooms.remove(endRoom[1]);
        return json(res, 200, { ended: true });
      }
      if (req.method === "GET" && name === "/api/rooms/session")
        return json(res, 200, { session: rooms.session(url.searchParams.get("token")) });
      if (req.method === "GET" && name === "/api/rooms/qr") {
        const code = url.searchParams.get("code") || "";
        if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return json(res, 400, { error: "Invalid room code" });
        const origin = process.env.DEMO_ORIGIN ||
          ((req.socket.encrypted ? "https://" : "http://") + (req.headers.host || "localhost:3000"));
        const invite = new URL("/", origin);
        invite.searchParams.set("join", code);
        const png = await QRCode.toBuffer(invite.toString(), { type: "png", margin: 2, width: 320 });
        res.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length, "Cache-Control": "no-store" });
        return res.end(png);
      }
      if (req.method === "POST" && name === "/api/fs") {
        const token = url.searchParams.get("launch");
        filesystem.getLaunch(token);
        const reply = await filesystem.dispatch(token, url.searchParams.get("session"), await readBody(req, 4 * 1024 * 1024 + 65536));
        res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": reply.length,
          "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        return res.end(reply);
      }
      if (req.method === "GET" && name === "/favicon.ico") { res.writeHead(204); return res.end(); }
      if (req.method === "GET" && staticFile(res, name, publicDir)) return;
      return json(res, 404, { error: "Not found" });
    } catch (error) {
      const status = error.status || (error instanceof DriveError || error instanceof IpxRoomError ? 400 : 500);
      if (status >= 500) console.error("DOSCloud Mini", error);
      if (!res.headersSent) json(res, status, { error: status >= 500 ? "Internal server error" : error.message });
      else res.end();
    }
  }

  server.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url, "http://127.0.0.1").pathname;
    if (pathname === "/ws/ipx") return rooms.handleUpgrade(req, socket, head);
    if (pathname === "/ws/fs") return filesystem.upgrade(req, socket, head);
    socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
  });

  const close = async () => {
    rooms.close();
    await filesystem.close();
    roomDrives.close();
    server.closeAllConnections();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  };
  return { server, rooms, filesystem, roomDrives, close };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";
  const app = createApp();
  app.server.listen(port, host, () =>
    console.log("DOSCloud Mini ready at " + (process.env.TLS_CERT_PATH ? "https://" : "http://") + host + ":" + port));
  const shutdown = () => void app.close().then(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
module.exports = { createApp };
