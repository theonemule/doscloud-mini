# Talk Outline — From Dev Containers to GitHub Codespaces

## Hook (about 4 minutes)
**Question:** What if I could open a GitHub repository and have my *entire development environment* appear, with my application already running?

We will follow a miniature "Game Cloud" inspired by Dots Cloud. It is not Dots Cloud itself. GitHub is the source of truth for code and game definitions; the container is our reproducible workshop. Start with a tiny JSON file and end with the same application developing on remote infrastructure.

**Audience promise:** Understand the division of responsibility between Git, Docker, the Dev Container specification, Codespaces, and VS Code Remote.

## Demo 1 — Environment as code (5 minutes; local)
- Begin with `demos/01-basic/.devcontainer/devcontainer.json`.
- Explain `image` and `name`, then invoke **Dev Containers: Reopen in Container**.
- In the container terminal run `node --version` and `node hello.js`.
- Contrast "works on my machine" with versioned, repeatable tooling.
- **Takeaway:** a dev container is a developer environment described in source control, not an application deployment.

## Demo 2 — Custom Dockerfile & bootstrap (9 minutes; local)
- Switch to the repository root; show `.devcontainer/Dockerfile` and `.devcontainer/devcontainer.json`.
- Explain `build`, `forwardPorts`, `customizations`, `postCreateCommand`, `postStartCommand`.
- Reopen in Container and let the lifecycle script start Game Cloud.
- Preview dashboard at port 3000; browse and launch a sample game.
- Import a small JSON game package (example in `examples/game-import.json`).
- Create a multiplayer room; open a second browser to join; show in-memory room changes.
- Show `git status`: imported game is a *new source file*, not automatically saved to GitHub.
- **Takeaway:** the environment, services, and code travel together. We do not need a database to explain the pattern.

## Demo 3 — GitHub Codespaces (7 minutes; cloud)
- Push the repository to an accessible GitHub repository **ahead of the talk**.
- In GitHub choose **Code → Codespaces → Create codespace on main**.
- Watch the same `.devcontainer` setup and verify the app health/preview.
- Show port 3000 forwarding; keep access private unless deliberately sharing.
- Explain Git-tracked game content versus ephemeral active multiplayer rooms.
- **Takeaway:** Codespaces supplies cloud compute for the same dev-container definition.

## Demo 4 — Connect VS Code desktop (6 minutes; same Codespace)
- From the Codespace choose **Open in Visual Studio Code**, or connect using VS Code's Codespaces extension.
- Make a tiny UI change to the application; save and show reload/preview.
- Verify you are editing the *same Codespace*, not a new local copy.
- **Takeaway:** the IDE is a client; the working source and toolchain remain remote.

## Demo 5 — Your own remote environment (7 minutes; remote Docker)
- Prepare a remote Linux host with Docker and SSH access in advance.
- Remote-SSH into the host using desktop VS Code.
- Clone/open the same repository on that remote host and choose **Dev Containers: Reopen in Container**.
- Alternatively demonstrate `docker compose up --build -d`, then **Dev Containers: Attach to Running Container**; see remote caveats in runbook.
- Open the forwarded app and verify the same catalog/room UI works.
- **Takeaway:** portability is about rebuilding equivalent environments, not physically migrating a running Codespace container.

## Close (3 minutes)
**Five demos, one repository, one developer experience.** The JSON specifies developer intent; Docker builds it; Codespaces hosts it; VS Code connects to it anywhere; GitHub preserves the versioned project.

Suggested closing line: **"The laptop becomes a client. The repository becomes the starting point. The environment becomes code."**

## Teaching distinctions
- **GitHub != a database.** Versioned game manifests are appropriate to track in Git. Active rooms/players are transient; large game assets will eventually need Git LFS, releases, or object storage.
- **Dev container != production deployment.** We reuse Docker build primitives, but development mounts, debug ports, and tools are not hardened production services.
- **Codespaces != Docker with a public IP.** Port forwarding controls access and lifecycle; an idle Codespace may stop.
- **Remote Docker != a moved running container.** We recreate the same environment from its definition on another host.

## Suggested total: ~41 minutes plus Q&A
