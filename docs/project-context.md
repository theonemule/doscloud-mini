# Project Context — Durable Brief

## Why this workspace exists
Talk scheduled for the week following 2026-11-05. User requested a **talk with five distinct live demos**, **not five product phases**, about Docker Dev Containers, GitHub Codespaces, VS Code remote development. Each demo uses a small Dots Cloud-like "Game Cloud" to illustrate real workflows. Create project workspace on user's Blaize Dev server and retain architecture, outline, code context and next actions.

## Locked decisions
- Working project: `codespaces-game-cloud-talk` under configured Blaize Dev workspace root.
- Audience-facing name: **Game Cloud**, subtitle **Build Once. Develop Anywhere.**
- Five demos in order: (1) minimal local JSON, (2) custom local Dockerfile/bootstrap, (3) browser Codespace, (4) desktop VS Code to same Codespace, (5) remote host Docker + VS Code.
- Single Node.js app listening on port 3000 to minimize forwarding friction; UI, API, room service from one process.
- No database. Small declarative game manifests saved in `games/`; multiplayer lobbies/scores in-memory.
- GitHub is the future canonical versioned game vault (source + manifests), but only after explicit repository publication and commits. Do not claim it stores live sessions.
- Prefer free/zero-dependency examples to keep talk robust and understandable.
- Avoid public services, production secrets, untrusted executable uploads, costly infrastructure.
- Dev container builds must work on local Docker, Codespaces, and remote host once source is pushed.

## Success / acceptance
- Minimal Demo 1 JSON parses and Hello script runs.
- Root Demo 2 Dockerfile + devcontainer config parse; container image builds; application starts; port 3000 responds.
- Dashboard can list, launch and import a safe JSON game package; rooms can be created/joined and state updated in a second client.
- Node tests cover core JSON API and safe import/room behavior.
- Talk outline and runbook include precise demos, transitions, prerequisites, fallbacks, and architecture cautions.
- Git project registered for future V5.1 work; actual remote Codespaces and SSH demos need outside GitHub/remote host configuration.

## Not in initial scope
- Full Dots Cloud recreation, production multiplayer networking, relational DB, real user authentication, live game asset uploads, external game runtime isolation, platform deployment.
- Publishing to GitHub or an external remote system without clear repository/host target.

## Immediate future tasks
1. Finish and verify runnable scaffold for demo 2.
2. Rehearse local Dev Containers image build and client attachment.
3. Publish to an appropriate GitHub repository once target/permission is established.
4. Rehearse actual Codespace and desktop VS Code connection.
5. Choose/test a remote SSH Docker host, rehearse two-minute rebuild.
6. Optional: add slides and short audience handout after demos settle.

## Important operational note
Do not confuse a developer container with a production runtime. Demo 5 should show **reconstruction** on remote Docker (via SSH), not claim to migrate a live container.
