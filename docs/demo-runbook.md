# Presenter Runbook — DOSCloud Mini

## Setup
- Local VS Code with **Dev Containers** extension and Docker.
- GitHub account with Codespaces for the cloud demos; this repo must be published first.
- Desktop VS Code with Codespaces support; remote host with SSH/Docker for Demo 5.
- Use only a private LAN, forwarded localhost, or a *private* Codespaces preview, because this intentionally unauthenticated demo accepts binary uploads.
- Validate `npm ci && npm test` before demo. See `docs/devcontainer-examples.md` for all three Node-only configurations and port 3000 forwarding. First browser boot should show real DOSBox-X console, not a home screen.
- js-dos uses browser filesystem APIs requiring **https://** on remote LAN addresses or **http://localhost**. A self-signed cert creates a browser warning and should only be accepted for the known private dev server.

## Demo 1 — minimal local
1. Open `demos/01-basic` in VS Code.
2. Show the `.devcontainer/devcontainer.json` with a single base image.
3. **Dev Containers: Reopen in Container**.
4. `node --version`; `node hello.js`. Close window before opening repo root.

## Demo 2 — custom local + real emulator
1. Open repository root, select `.devcontainer/03-custom-docker/devcontainer.json` (or the equivalent default `.devcontainer/devcontainer.json`), and show `.devcontainer/Dockerfile`. Example 2 (`.devcontainer/02-node-app/devcontainer.json`) is the prebuilt Node-only alternative.
2. Reopen in Container. `postCreateCommand` installs deps and runs tests; `postStartCommand` launches Node server.
3. Open forwarded **localhost:3000**. DOSBox-X boots immediately to C: prompt.
4. Click **Upload file**; select destination `C:\\`; choose any text file; upload; in DOS type `DIR` and `TYPE FILENAME.TXT`.
5. Upload a sample ZIP with nested content, then `DIR` and `CD` into the extracted directory.
6. Click **IPX room**, choose 2 players; click Launch. Show code/link/QR in right drawer. Open a second browser and follow invitation, verifying two separate DOS consoles.
7. Explain: the host's persistent C: is backed by DOSCloud REMOTEFS; each guest has a snapshot base plus an empty, disposable write delta. Have a guest type `MKDIR GUESTSAVE` and show no such directory in the host's C:. Click **End room** and explain the temporary overlay is removed.

## Demo 3 — Codespaces
1. Publish the repo on GitHub beforehand. Choose **Code → Codespaces → Create codespace**.
2. Show same Dockerfile and devcontainer, booted emulator preview in port 3000.
3. Ensure forwarded port visibility is **Private**; user uploads and room invitation endpoints have no authentication.
4. Explain uploaded drive files are not automatically checked into Git or available in other Codespaces.

## Demo 4 — desktop VS Code
1. Open the *same existing Codespace* in VS Code desktop.
2. Change a toolbar label in `public/index.html` or color in `public/styles.css`, then refresh preview.
3. Show you have changed the editing client, not moved the compute.

## Demo 5 — remote Docker / SSH
**Preferred:** Remote-SSH into remote Linux host with Docker, open clone of repo, **Dev Containers: Reopen in Container**, then forward port 3000 through VS Code. Browse on localhost.

**Alternate Compose service:**
```bash
DEMO_UID=$(id -u) DEMO_GID=$(id -g) docker compose up --build -d
# Local-only host port. Connect through SSH tunnel or HTTPS proxy, not exposed public HTTP.
```
If port 3000 is taken, set `DEMO_PORT=34124`. Then `docker compose down` when appropriate. A LAN URL using plain HTTP will **not** boot js-dos on Chrome; use SSH localhost forwarding or HTTPS.

## Backup / pitfalls
- Pre-pull the devcontainer base image, cache npm dependencies, and precreate Codespace before talk.
- Keep a sample text file/ZIP ready on presenter desktop. Avoid using copyrighted game assets for audience handout.
- File additions to the host after room creation do not appear in existing guest snapshots; end the room and create a new one to share the new base. A host upload may take a short time to appear in its own DOS listing due to the remote FS cache.
- Joining a room proves emulator peers and transport connections; launching a particular IPX game's built-in multiplayer still requires game-specific commands and configuration.
- Do not modify or redeploy the original DOSCloud production services.
