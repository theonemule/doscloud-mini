# Four-demo runbook (~60 minutes)

**Preflight (before audience arrives):** log into GitHub and VS Code, Docker daemon available; have the local Dev Container built, a Codespace already created as a fallback, and a Remote-SSH development host reachable. Run `npm test` and check port 3000 private. Save a known-good screenshot of browser DOSBox-X only as a fallback, not as a replacement for live work.

## Demo 1 — Minimal Hello World (~6 minutes)

1. VS Code → open repo root → **Dev Containers: Reopen in Container**.
2. Choose `01 — Hello World`.
3. Show `.devcontainer/01-hello-world/devcontainer.json`.
4. In terminal: `node --version` and `node demos/01-basic/hello.js`.
5. Emphasize no local Node install, no custom Dockerfile, no port forwarding.

**Fallback:** if image pull is slow, show the pre-created container or run `node demos/01-basic/hello.js` in an already-open container. Do not stall the talk for a full download.

## Demo 2 — Node app + custom Docker (~10 minutes)

1. Show `.devcontainer/02-node-app/devcontainer.json`: base image, `postCreateCommand`, `postStartCommand`, `forwardPorts: [3000]`.
2. Reopen in that container. Verify `npm test` and `curl -fsS http://localhost:3000/api/health`.
3. Open **Ports** → **DOSCloud Mini** → **Open in Browser**. DOSBox-X boots.
4. Show the custom `.devcontainer/Dockerfile`, then select `03 — Custom Dockerfile` (or root default). Explain base image, copy manifests, npm install, image cache.
5. Reopen the forwarded browser; verify `C:\DOOMS` and demonstrate a host-side save.

**Fallback:** prebuild the custom image. If browser secure-context APIs fail over LAN HTTP, use forwarded localhost or Codespaces HTTPS. Leave runtime preview unchanged.

## Demo 3 — GitHub Codespaces (~8 minutes)

1. Open `https://github.com/theonemule/doscloud-mini`.
2. Code → Codespaces. Select a prepared Codespace (or create one and choose `02 — Node.js app`).
3. Show VS Code browser editor and terminal; `node --version`, `npm test`.
4. Open the automatically forwarded port `3000`, check it is **Private**, use the generated HTTPS link.
5. Show DOSCloud Mini works identically despite cloud compute.

**Fallback:** a prepared Codespace tab with port visibility already set to Private and app running.

## Demo 4 — Remote development and debugging (~7 minutes)

1. Connect VS Code **Remote-SSH** to a development VM with Docker.
2. Open the DOSCloud Mini clone on the remote host; **Reopen in Container**.
3. Run `docker ps`; show app on remote `:3000` and local forwarded browser.
4. Explain **Attach to Running Container** as a different workflow from Reopen in Container.
5. For optional Node debugging, stop the existing Node watcher and run:

```bash
node --inspect=127.0.0.1:9229 src/server.js
```

Use the VS Code debugger from the same remote dev environment, or privately forward 9229 if needed. Set a breakpoint in `src/server.js`, hit `/api/health`, and show the stop. Never publicly expose the inspector.

**Fallback:** demonstrate remote process and forwarded port without debugger if network conditions are unreliable.

## Reset and safety

- Host C: contents live in `drive/` and are Git-trackable but require explicit commit/push.
- IPX guest COW overlays are disposable and must not be mistaken for persisted or Git-synced state.
- Leave Codespaces forward 3000 **Private**; the app has no login.
- Don't publish Node inspector 9229.
- Do not deploy new or modified source into the original production DOSCloud infrastructure.
