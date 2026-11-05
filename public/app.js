"use strict";

// A deliberately small shell around the same js-dos 8.4.1 / DOSBox-X runtime
// and IPX adapter used by DOSCloud. Each browser owns its emulator instance.
const byId = (name) => document.getElementById(name);
let emulator = null;
let roomSession = null;
let network = null;

function showStatus(message) {
  byId("runtime-status").textContent = message;
}
function showModalError(message) {
  const status = byId("modal-status");
  status.textContent = message;
  status.className = "error";
}
function showModalInfo(message) {
  const status = byId("modal-status");
  status.textContent = message;
  status.className = "";
}
async function requestJSON(path, options = {}) {
  const response = await fetch(path, options);
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.error || "HTTP " + response.status);
  return data;
}
function openModal(which) {
  byId("upload-panel").hidden = which !== "upload";
  byId("room-panel").hidden = which !== "room";
  byId("modal-title").textContent = which === "upload" ? "Upload to DOS" : "IPX multiplayer";
  byId("modal-status").textContent = "";
  byId("modal-backdrop").hidden = false;
  byId("close-modal").focus();
}
function closeModal() { byId("modal-backdrop").hidden = true; }
function joinUrl(code) {
  const url = new URL("/", location.origin);
  url.searchParams.set("join", code);
  return url.href;
}
function showRoom(session) {
  const drawer = byId("room-drawer");
  drawer.hidden = false;
  byId("room-label").textContent = session.role === "host" ? "Host · " + session.players + " players" : "Guest · " + session.players + " players";
  byId("room-code").textContent = session.code;
  byId("room-link").value = joinUrl(session.code);
  byId("room-qr").src = "/api/rooms/qr?code=" + encodeURIComponent(session.code);
  byId("room-detail").textContent = session.role === "host"
    ? "Launching DOSBox-X IPX host. Share this link or QR code."
    : "Connecting this emulator to the host's DOSBox-X IPX network.";
}
function goToSession(session) {
  const url = new URL("/", location.origin);
  url.searchParams.set("session", session.token);
  location.assign(url.href);
}

async function startRoom() {
  const button = byId("create-room");
  button.disabled = true;
  showModalInfo("Creating the IPX room…");
  try {
    const response = await requestJSON("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ players: Number(byId("players").value) })
    });
    goToSession(response.session);
  } catch (error) {
    showModalError(error.message);
    button.disabled = false;
  }
}
async function joinRoom(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(normalized)) throw new Error("Enter a valid six-character room code");
  const response = await requestJSON("/api/rooms/" + normalized + "/join", { method: "POST" });
  goToSession(response.session);
}

async function uploadSelected() {
  const file = byId("upload-file").files?.[0];
  if (!file) return showModalError("Choose a file first");
  if (file.size > 64 * 1024 * 1024) return showModalError("Maximum ZIP/file size is 64 MiB");
  const button = byId("submit-upload");
  button.disabled = true;
  showModalInfo("Uploading " + file.name + "…");
  try {
    const url = "/api/upload?filename=" + encodeURIComponent(file.name) +
      "&folder=" + encodeURIComponent(byId("upload-folder").value.trim() || "C:\\");
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: file
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Upload failed");
    // Sync the newly changed files into THIS running emulator. A new room
    // participant receives the full shared-drive snapshot during boot.
    let synced = 0;
    if (emulator) {
      for (const item of data.changes) {
        const bytes = await fetchFile(item.path);
        await emulator.fsWriteFile("/" + item.path, bytes);
        synced++;
      }
    }
    const count = data.changes.length;
    showStatus((data.extracted ? "Extracted " : "Uploaded ") + count + " file(s) to C: drive");
    showModalInfo(data.extracted
      ? "Extracted " + count + " file(s) into C: (" + synced + " loaded into this emulator)."
      : "Saved to C: (" + synced + " loaded into this emulator).");
  } catch (error) {
    showModalError(error.message + " (Files already saved on the server may be available after refresh.)");
  } finally {
    button.disabled = false;
  }
}

async function fetchFile(filePath) {
  const response = await fetch("/api/drive/file?path=" + encodeURIComponent(filePath));
  if (!response.ok) throw new Error("Could not read DOS file: " + filePath);
  return new Uint8Array(await response.arrayBuffer());
}

async function loadDrive() {
  const data = await requestJSON("/api/drive");
  const entries = [];
  let total = 0;
  for (const item of data.files) {
    total += item.size;
    if (total > 200 * 1024 * 1024) {
      throw new Error("Demo drive exceeds 200 MiB; remove some uploads before booting");
    }
    entries.push({ path: item.path, contents: await fetchFile(item.path) });
  }
  return entries;
}

async function boot() {
  const url = new URL(location.href);
  let token = url.searchParams.get("session");
  const invite = url.searchParams.get("join");
  if (invite && !token) {
    showStatus("Joining IPX room " + invite.toUpperCase() + "…");
    await joinRoom(invite);
    return;
  }
  if (token) {
    roomSession = (await requestJSON("/api/rooms/session?token=" + encodeURIComponent(token))).session;
    showRoom(roomSession);
  }

  showStatus("Preparing DOS C: drive…");
  const initFs = await loadDrive();
  if (roomSession) {
    showStatus("Connecting IPX channel…");
    network = await window.createIpxWebSocketNet({
      role: roomSession.role,
      code: roomSession.code,
      expectedPlayers: roomSession.players,
      hostPeerId: 1,
    }, roomSession.token);
  }
  const dosboxConf = [
    "[sdl]", "autolock=false", "",
    "[dosbox]", "machine=svga_s3", "memsize=16", "",
    "[cpu]", "core=auto", "cycles=auto", "",
    "[autoexec]", "@echo off",
    "mount c .",
    "c:",
    "cd \\",
    ""
  ].join("\n");

  // Match DOSCloud's tested runtime options (DOSBox-X, worker backend and
  // shared IPX Net contract). The first page loads straight into this surface.
  const options = {
    dosboxConf,
    initFs,
    pathPrefix: "/emulators/",
    backend: "dosboxX",
    backendLocked: true,
    backendHardware: false,
    renderBackend: "canvas",
    workerThread: true,
    autoStart: true,
    autoSave: false,
    kiosk: false,
    imageRendering: "pixelated",
    renderAspect: "4/3",
    onEvent(event, ci) {
      if (event !== "ci-ready") return;
      emulator = ci;
      window.__ci = ci; // developer console / live demo debugging
      byId("boot-overlay").hidden = true;
      showStatus(roomSession ? "DOS ready · IPX " + roomSession.code : "DOS ready · C:\\");
      if (roomSession?.role === "host" && network) {
        const announce = (message) => {
          if (/IPX:\s*Connected to server/i.test(String(message))) {
            network.announceHostReady();
            byId("room-detail").textContent = "IPX server ready. Share the invite code with your players.";
          }
        };
        ci.events?.()?.onStdout?.(announce);
        ci.events?.()?.onMessage?.((type, ...messages) => announce([type, ...messages].join(" ")));
        // Existing DOSCloud fallback when the loopback readiness log is not emitted.
        setTimeout(() => network.announceHostReady(), 10000);
      }
    }
  };
  if (network) {
    options.sharedNet = network;
    if (roomSession.role === "host") options.startIpxServer = true;
    else options.connectIpxAddress = "host";
  }
  showStatus(roomSession ? "Booting DOS with IPX…" : "Booting DOSBox-X…");
  window.Dos(byId("dos"), options);
}

byId("upload-button").addEventListener("click", () => openModal("upload"));
byId("room-button").addEventListener("click", () => {
  if (roomSession) showRoom(roomSession);
  else openModal("room");
});
byId("close-modal").addEventListener("click", closeModal);
byId("modal-backdrop").addEventListener("pointerdown", (event) => {
  if (event.target === byId("modal-backdrop")) closeModal();
});
byId("submit-upload").addEventListener("click", uploadSelected);
byId("create-room").addEventListener("click", startRoom);
byId("join-room").addEventListener("click", () => {
  joinRoom(byId("join-code").value).catch((error) => showModalError(error.message));
});
byId("close-drawer").addEventListener("click", () => { byId("room-drawer").hidden = true; });
byId("copy-link").addEventListener("click", async () => {
  const link = byId("room-link");
  try {
    await navigator.clipboard.writeText(link.value);
    byId("copy-link").textContent = "Copied!";
    setTimeout(() => { byId("copy-link").textContent = "Copy join link"; }, 1600);
  } catch {
    link.select();
    document.execCommand("copy");
  }
});
byId("fullscreen-button").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else byId("stage").requestFullscreen?.();
});
document.addEventListener("keydown", (event) => {
  if (byId("modal-backdrop").hidden) return;
  if (event.key === "Escape") { closeModal(); event.preventDefault(); }
  // js-dos installs global key listeners; modal inputs must keep their keys.
  event.stopImmediatePropagation();
}, true);
document.addEventListener("keyup", (event) => {
  if (!byId("modal-backdrop").hidden) event.stopImmediatePropagation();
}, true);
window.addEventListener("doscloud-ipx-status", (event) => {
  const state = event.detail?.state;
  if (!roomSession) return;
  if (state === "room-ready") {
    byId("room-detail").textContent = "All players connected to the IPX room.";
  } else if (state === "host-ready") {
    byId("room-detail").textContent = "Host DOSBox-X IPX server is ready.";
  } else if (state === "peer-joined") {
    byId("room-detail").textContent = "Another DOS emulator joined your room.";
  } else if (state === "peer-left") {
    byId("room-detail").textContent = "A player disconnected.";
  }
});
boot().catch((error) => {
  console.error("DOSCloud Mini boot:", error);
  showStatus("Error: " + error.message);
  byId("boot-overlay").textContent = "Unable to boot DOS: " + error.message;
});
