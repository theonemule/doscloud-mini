# Durable Project Context — DOSCloud Mini Codespaces Talk

## Current request (2026-11-05)
The user simplified the originally planned Game Cloud portal. Deliver a **single screen**: real DOSCloud js-dos 8.4.1/DOSBox-X emulator boots immediately, tiny top toolbar with **Upload file**, **IPX room** (2–8 players, host/join code/link/QR in right drawer), and **Fullscreen**. There is no home/catalog, backend demo games, authentication, production DB, or persistent lobby view.

User specifically requested **reuse** the original DOSCloud emulator and IPX technology, not a fake game renderer. Reference DOSCloud source at `/var/lib/sandbox-mcp/workspaces/dos-cloud-multiplayer-draft/phase-06-change-ipx-multiplayer`. The actual DOSCloud production containers are separate and must not be modified.

## Implemented architecture
- js-dos 8.4.1 / DOSBox-X browser runtime assets under `public/jsdos/` and `public/emulators/`, copied from DOSCloud; browser `public/ipx-websocket-net.js` adapted to this minimal app.
- One Node 22 server in `src/server.js`, packages `ws`, `adm-zip`, `qrcode`. Served over port 3000.
- Browser `public/app.js` boots emulator directly to C: via js-dos `Dos()`; no HTML game catalog.
- `src/drive.js`: file upload or ZIP extract into `drive/` root/selected folder, path traversal checks and size caps. Browser syncs changed files with `ci.fsWriteFile`.
- Each emulator loads the same server snapshot on boot. **No live synchronized C: drive**; DOS-side game saves not automatically uploaded/merged. The independently running emulators share an IPX transport only.
- `src/ipx-rooms.js`: temporary room codes and tokens, 2–8 players, WebSocket relay preserving DOSCloud host readiness and binary packet framing.
- Optional HTTPS if `TLS_KEY_PATH` and `TLS_CERT_PATH` set. LAN must use HTTPS/secure context for js-dos browser filesystem APIs; devcontainer localhost forwarded port works over HTTP.
- No authentication: private/LAN/demo use only, never publish an unauthenticated upload endpoint to the Internet.
- GPL-2.0 js-dos assets need license notice/distribution compliance.

## Talk structure (five DEMOS, not product phases)
1. Local tiny devcontainer JSON in `demos/01-basic`.
2. Local customized Dockerfile + bootstrapped DOS emulator.
3. Same repo in GitHub Codespaces web editor.
4. VS Code desktop attaches to same Codespace.
5. Remote SSH + Dev Container/Compose on a remote Docker host.

## Verification completed as of 2026-11-05
- Node API tests: 4/4 passed (normal file, ZIP+traversal, HTTP/QR/asset API, real WebSocket IPX packet relay).
- Dev Docker image builds; HTTPS preview live at `https://10.0.1.183:34131/` with a self-signed cert.
- Headless real Chrome shows DOSBox-X canvas and `window.__ci`, boots to C:.
- Real Chrome upload modal writes an ordinary file into running DOS emulator, `fsTree/fsReadFile` verified.
- Real Chrome ZIP modal extracts nested ZIP and `fsReadFile` verified.
- Two independent Chromium browser contexts hosted/joined an IPX room, peer IDs 1/2, room-ready status, no JS page errors.
- Not yet proven: a complete DOS game actually exchanging multiplayer traffic via IPX end-to-end. May need game-specific setup.

## Next tasks
Clean unused quiz/catalog/SSE implementation, update docs, commit. Rehearse true VS Code devcontainer attachment, GitHub Codespaces and remote SSH host in their environments; they are not inherently verified by a Docker image build.
