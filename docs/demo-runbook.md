# Live Demo Runbook

## Prerequisites / rehearsal setup
- Local: VS Code + **Dev Containers** extension + running Docker Engine.
- Cloud: GitHub account with Codespaces available, repo pushed ahead of time, VS Code desktop with GitHub Codespaces support.
- Remote: Linux SSH host with Docker, Git, project clone, key-based SSH login; VS Code **Remote - SSH** + **Dev Containers**.
- Prebuild or prelaunch the Codespace if talk time or bandwidth is tight; confirm any billed Codespaces resources/limits.
- Use the same sample game catalog and Game Cloud port `3000` everywhere. Show one environment at a time.
- Preflight: `npm test`; `npm start`; `curl -fsS http://localhost:3000/api/health` and browser visit.

## Demo 1 — local minimal JSON
1. In VS Code, **File → Open Folder**: `demos/01-basic`.
2. Show `.devcontainer/devcontainer.json` before invoking anything.
3. Run **Dev Containers: Reopen in Container**.
4. In terminal: `node --version`, `node hello.js`.
5. Close this VS Code container window before demo 2.

**Backup:** show the JSON + local terminal output if image pull fails.

## Demo 2 — local custom environment
1. Open **repository root** in VS Code, reveal `.devcontainer/Dockerfile`, `.devcontainer/devcontainer.json`, `.devcontainer/start-app.sh`.
2. Run **Dev Containers: Reopen in Container** and wait for bootstrap to finish.
3. Open forwarded **Game Cloud** port 3000 (local URL typically `http://localhost:3000`).
4. Launch a built-in game; import `examples/game-import.json` using the dashboard.
5. Start a multiplayer lobby. Open a second browser window and join it; the first window should update live.
6. `git status --short` — point to the newly created `games/*.json` (do not auto-commit).

**Backup:** on host `npm start` or `docker compose up --build` and preview app; demonstrate Dockerfile separately.

## Demo 3 — GitHub Codespaces
1. **Before live talk**, push branch to the planned GitHub repository. Container workspace on dev server does not itself create a GitHub remote.
2. Open GitHub repo → **Code** → **Codespaces** → create a Codespace from the desired branch.
3. Observe VS Code in browser; open the Ports view; use forwarded port 3000.
4. `curl -fsS http://localhost:3000/api/health`; compare Game Cloud UI to local.
5. Show that catalog changes are Git working-tree changes; use Git deliberately to preserve them.
6. Keep port visibility private unless the event requires a public demo link; never demonstrate confidential data on a public port.

**Backup:** maintain a pre-created Codespace and screenshots/recording of first-build steps.

## Demo 4 — VS Code desktop ↔ Codespace
1. In the Codespace browser use **Open in VS Code** or connect via the Codespaces extension.
2. Confirm the remote connection label in VS Code status bar and same file change/status.
3. Change text in `public/index.html` or `public/app.js`; save; refresh preview.
4. Switch browser/desktop editors to highlight same compute environment.

**Backup:** show Codespaces desktop picker and Ports view; avoid committing unnecessary demo edits.

## Demo 5 — remote Docker / SSH
**Preferred path (faithful Dev Containers experience):**
1. SSH to the approved remote host using VS Code **Remote-SSH: Connect to Host**.
2. Clone/open repo on the **remote host filesystem**. Ensure Docker Engine works for the remote user.
3. Run **Dev Containers: Reopen in Container**. The Docker daemon and the source checkout are remote.
4. Forward port 3000 through VS Code and open Game Cloud. Show the same app, config, API.

**Alternate 'inject a service container' path:**
1. On remote Linux (not a production machine): clone repo, run `DEMO_UID=$(id -u) DEMO_GID=$(id -g) docker compose up --build -d` so imported games are writable in the host bind mount.
2. VS Code Remote-SSH → use **Dev Containers: Attach to Running Container** (option may need extension), or remote terminal `docker compose exec gamecloud sh`.
3. Use SSH/VS Code port forwarding to reach the port bound to remote loopback.
4. `docker compose down` after showing the service, if appropriate.

**Crucial distinction:** we are **recreating** an environment from an image/definition on another host. We are not moving a live Codespaces container to a remote machine.

## Contingency & demo hygiene
- Pre-fetch base images in both local and remote Docker to remove pull time.
- Do not rely on Wi-Fi to build the first Codespace live; pre-create if necessary.
- Don't assume port forwarding makes a service public: check privacy settings.
- Do not hardcode GitHub tokens or change remote Docker daemon exposure.
- If the game import from demo 2 is uncommitted, it will not automatically appear in demo 3. Either commit/push a known sample manifest, or explain why that difference proves the Git model.
- If the Codespace has stopped, the backend must start again. Live lobbies will be reset.
- If remote port 3000 is already occupied, prefix the Compose command with `DEMO_PORT=34124` to change only the host port.
