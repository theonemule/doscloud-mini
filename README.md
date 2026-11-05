# Game Cloud — Dev Containers & GitHub Codespaces Talk

**Talk:** From Dev Containers to GitHub Codespaces — Build Once. Develop Anywhere.

This repository is both the **speaker workspace** and a **tiny, runnable Game Cloud**: a Dots Cloud-inspired microcosm that illustrates portable development rather than attempting to reproduce a full game hosting service.

## Five live demos (not product phases)

| Demo | Location | Audience takeaway |
| --- | --- | --- |
| 1. Environment as code | Local VS Code + Docker | A tiny `devcontainer.json` defines a reproducible environment. |
| 2. Custom bootstrap | Local VS Code + Docker | Dockerfile + lifecycle hooks start our Game Cloud development stack. |
| 3. GitHub Codespaces | Cloud/browser | The same repo and config run in GitHub's hosted development environment. |
| 4. VS Code desktop | Connected to existing Codespace | Switch clients without moving application files or rebuilding the stack. |
| 5. Remote Docker host | Remote Linux + Docker over SSH | Re-create the environment on infrastructure you control, then attach VS Code. |

## App narrative

The GitHub repo acts as our **game vault**: it version-controls the frontend, API, multiplayer prototype, and small declarative game manifests. The container supplies the runtimes and development tools. The Game Cloud page acts as a single place to **browse, launch, import games and start multiplayer rooms**. Active room state is intentionally in memory; no database is required.

## Quick start

Requires Node.js 22+ (or Docker + VS Code Dev Containers).

```bash
npm test
npm start
# open http://localhost:3000
```

For dev-container bootstrapping, use **Dev Containers: Reopen in Container** on this repository. For the minimal local demo, separately open `demos/01-basic` in VS Code and reopen it in a container.

See:
- [Talk outline](docs/talk-outline.md)
- [Architecture](docs/architecture.md)
- [Live demo runbook](docs/demo-runbook.md)
- [Speaker notes](docs/speaker-notes.md)
- [Project context and acceptance criteria](docs/project-context.md)

**Status:** Local dev-server workspace. GitHub repository publication, Codespaces creation, and remote-host VS Code connection are **separate external actions** and are not implied by this checkout.
