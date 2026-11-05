# Game Cloud Architecture

## Architectural objective
Demonstrate a portable, self-bootstrapping **developer** workspace using Docker Dev Containers, GitHub Codespaces and remote VS Code. A small game portal gives continuity across five demos. Avoid databases, production authentication, orchestration platforms and external managed services.

## Diagram

```text
                       GitHub repository (versioned source of truth)
            +-------------------------------------------------------+
            | .devcontainer/     frontend/public/    games/*.json   |
            | Dockerfile         API/src/            tests/         |
            |                    room service                       |
            +--------------------------+----------------------------+
                                       |
               same source + devcontainer definition
              /                        |                       \
     LOCAL DOCKER                GITHUB CODESPACES          REMOTE DOCKER HOST
     VS Code Dev Containers      browser or VS Code        SSH + Dev Containers
              \                        |                       /
               +-----------------------+----------------------+
                                       |
                  one container / one Node.js process / :3000
                   +---------------------------------------+
                   | Web UI (single pane of glass)         |
                   | /api/games  /api/rooms  /api/health   |
                   | Room events (SSE) + room actions      |
                   | static built-in game player          |
                   +---------------------------------------+
                      |                              |
               games/*.json                  in-memory rooms
            tracked in Git when             not persisted; reset
           explicitly committed/pushed      when server restarts
```

## Logical components

1. **Frontend:** static responsive HTML/CSS/vanilla JS portal. Catalog, launch game, import declarative game, create/join room, live lobby. Built-in simple game renderer makes the demo visual and interactive.
2. **Backend API:** a single Node 22 HTTP process serves static assets and JSON endpoints; validates imports and reports health.
3. **Game catalog:** `games/*.json` are small declarative packages in the repository. Import writes a new validated manifest under `games/`. A Git commit/push is required to preserve it in GitHub.
4. **Multiplayer prototype:** in-process room and player state with Server-Sent Events for updates. SSE is sufficient for *lobby presence/score demo*, not a low-latency real-time game networking engine; a production game would generally use WebSockets/authoritative game state.
5. **Development environment:** root `.devcontainer/devcontainer.json`, Dockerfile, lifecycle script, forwarded TCP port 3000. `demos/01-basic` is deliberately independent and minimal.
6. **Remote example:** optional `compose.yaml` builds the same Dockerfile and binds the app to loopback on the remote host, avoiding unintended public access.

## Endpoints / responsibilities

| Route | Purpose | Persistence |
|---|---|---|
| `GET /api/health` | health/smoke check | none |
| `GET /api/games` | list repository game manifests | filesystem |
| `POST /api/games/import` | validate and save JSON game package | new local Git-working-tree file |
| `GET /api/rooms` | list active rooms | RAM |
| `POST /api/rooms` | create a game room | RAM |
| `POST /api/rooms/:id/join` | join as a demo player | RAM |
| `POST /api/rooms/:id/score` | submit a demo score | RAM |
| `GET /api/rooms/:id/events` | stream room updates via SSE | RAM/live connection |

## Deployment / development views

- **Demo 1:** `demos/01-basic`; base Node image; no custom Dockerfile; basic JSON.
- **Demo 2:** root repo with custom Dockerfile; `postStartCommand` launches the server; `forwardPorts: [3000]`.
- **Demo 3:** publish this repository to GitHub and create a Codespace; retain port privacy. A Codespace does not automatically sync all uncommitted files back to GitHub.
- **Demo 4:** desktop VS Code attaches to the **same Codespace**; no Docker Engine required on the local machine.
- **Demo 5:** remote Linux host with Docker; connect via Remote-SSH, open repo, Reopen in Container. If showing Compose, use `docker compose up --build -d` and attach to the running app container.

## Security and scope
- Sample has **no authentication** and is a local/private-port development demonstration; do not expose it as an Internet-facing service.
- Game packages are strictly constrained **JSON data**, not arbitrary executables, scripts or ZIP uploads. No remote code execution in import flow.
- Limit game package sizes, path traversal, data fields and room count; do not provide shell access through the portal.
- Do not store secrets in Git; use Codespaces secrets / host environment for future real tokens.
- Remote Docker TCP socket is not publicly exposed. Prefer VS Code Remote-SSH or Docker-over-SSH.
- Future upgrade path (not required for talk): authenticated uploads, GitHub API commits, WebSocket networking, asset storage, persistence, observability, production Docker runtime.
