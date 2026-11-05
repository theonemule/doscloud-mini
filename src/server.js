"use strict";

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const QRCode = require("qrcode");
const { DriveError, listFiles, upload, readFile, MAX_UPLOAD } = require("./drive");
const { IpxRooms, IpxRoomError } = require("./ipx-rooms");

const PUBLIC_DIR = path.resolve(__dirname, "../public");
const DRIVE_DIR = path.resolve(__dirname, "../drive");
const MAX_JSON = 16 * 1024;
const CONTENT_TYPES = new Map([
  [".html", "text/html"], [".js", "text/javascript"], [".mjs", "text/javascript"],
  [".css", "text/css"], [".wasm", "application/wasm"], [".png", "image/png"],
  [".woff", "font/woff"], [".svg", "image/svg+xml"], [".txt", "text/plain"]
]);

function errorJson(res, status, message) {
  json(res, status, { error: message });
}
function json(res, status, data) {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(body);
}
async function readBody(req, limit) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      throw Object.assign(new Error("Upload is too large"), { status: 413 });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function readJson(req) {
  const data = await readBody(req, MAX_JSON);
  try {
    const input = JSON.parse(data.toString("utf8"));
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
    return input;
  } catch {
    throw Object.assign(new Error("Invalid JSON object"), { status: 400 });
  }
}

function streamFile(res, target, type) {
  const info = fs.statSync(target);
  if (!info.isFile()) throw Object.assign(new Error("File not found"), { status: 404 });
  res.writeHead(200, {
    "Content-Type": type || "application/octet-stream",
    "Content-Length": info.size,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src 'self' ws: wss:; img-src 'self' data: blob:; object-src 'none'"
  });
  fs.createReadStream(target).pipe(res);
}

function staticFile(res, pathname, publicDir) {
  if (!/^\/(?:jsdos\/|emulators\/|app\.js$|styles\.css$|ipx-websocket-net\.js$|$)/.test(pathname)) return false;
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const target = path.resolve(publicDir, relative);
  if (!target.startsWith(publicDir + path.sep)) return false;
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return false;
  const type = CONTENT_TYPES.get(path.extname(target));
  if (!type) return false;
  streamFile(res, target, type + (type.startsWith("text/") ? "; charset=utf-8" : ""));
  return true;
}

function createApp({ driveDir = DRIVE_DIR, publicDir = PUBLIC_DIR } = {}) {
  fs.mkdirSync(driveDir, { recursive: true });
  const rooms = new IpxRooms();
  const tls = process.env.TLS_KEY_PATH && process.env.TLS_CERT_PATH
    ? { key: fs.readFileSync(process.env.TLS_KEY_PATH), cert: fs.readFileSync(process.env.TLS_CERT_PATH) }
    : null;
  const server = tls ? https.createServer(tls, requestHandler) : http.createServer(requestHandler);
  async function requestHandler(req, res) {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      const name = url.pathname;
      if (req.method === "GET" && name === "/api/health") {
        return json(res, 200, { ok: true, app: "DOSCloud Mini", emulator: "DOSBox-X / js-dos", ipx: "websocket" });
      }
      if (req.method === "GET" && name === "/api/drive") {
        return json(res, 200, { files: listFiles(driveDir) });
      }
      if (req.method === "GET" && name === "/api/drive/file") {
        const target = readFile(driveDir, url.searchParams.get("path") || "");
        res.writeHead(200, {
          "Content-Type": "application/octet-stream", "Content-Length": target.length,
          "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"
        });
        return res.end(target);
      }
      if (req.method === "POST" && name === "/api/upload") {
        const fileName = url.searchParams.get("filename");
        const folder = url.searchParams.get("folder") || "C:\\";
        const body = await readBody(req, MAX_UPLOAD);
        return json(res, 201, upload(driveDir, folder, fileName, body));
      }
      if (req.method === "POST" && name === "/api/rooms") {
        const { players } = await readJson(req);
        return json(res, 201, { session: rooms.create(players) });
      }
      const join = name.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})\/join$/);
      if (req.method === "POST" && join) {
        return json(res, 201, { session: rooms.join(join[1]) });
      }
      if (req.method === "GET" && name === "/api/rooms/session") {
        return json(res, 200, { session: rooms.session(url.searchParams.get("token")) });
      }
      if (req.method === "GET" && name === "/api/rooms/qr") {
        const code = url.searchParams.get("code") || "";
        if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return errorJson(res, 400, "Invalid room code");
        // Only include a short join code in the QR; never include the host's session token.
        const origin = process.env.DEMO_ORIGIN || ((req.socket.encrypted ? "https://" : "http://") + (req.headers.host || "localhost:3000"));
        const invite = new URL("/", origin);
        invite.searchParams.set("join", code);
        const png = await QRCode.toBuffer(invite.toString(), { type: "png", margin: 2, width: 320 });
        res.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length, "Cache-Control": "no-store" });
        return res.end(png);
      }
      if (req.method === "GET" && name === "/favicon.ico") { res.writeHead(204); return res.end(); }
      if (req.method === "GET" && staticFile(res, name, publicDir)) return;
      return errorJson(res, 404, "Not found");
    } catch (error) {
      const status = error.status || (error instanceof DriveError || error instanceof IpxRoomError ? 400 : 500);
      if (status >= 500) console.error("DOSCloud Mini", error);
      if (!res.headersSent) errorJson(res, status, error.message);
      else res.end();
    }
  }
  server.on("upgrade", (req, socket, head) => rooms.handleUpgrade(req, socket, head));
  return { server, rooms };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";
  createApp().server.listen(port, host, () =>
    console.log("DOSCloud Mini ready at " + (process.env.TLS_CERT_PATH ? "https://" : "http://") + host + ":" + port));
}
module.exports = { createApp };
