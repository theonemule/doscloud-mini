# From Dev Containers to GitHub Codespaces — five live demos

**Subtitle:** Build once. Develop anywhere.

## Story and scope
Imagine the repository for a miniature DOSCloud: instead of creating a whole gaming platform, opening the repo immediately boots a DOSBox-X console in the browser. A 46px toolbar above the console provides **Upload file** and **IPX room**. The application is intentionally tiny so the talk teaches the **developer environment**, not the product UI.

Git tracks the code, configurations, and tools. Docker runs the developer environment. GitHub Codespaces hosts that environment. VS Code is a client that can connect from local, Codespaces, or remote SSH.

**Presentation format:** five *demos*, not application development phases.

## Intro — the portable workstation (4 min)
Show the one-screen end state. No dashboard, account, database or hosted game service. Just a browser DOS console, upload ZIP and IPX join code.

## Demo 1 — Minimal JSON, local (5 min)
- Open `demos/01-basic` in local VS Code.
- Explain its tiny `.devcontainer/devcontainer.json` using an image.
- **Dev Containers: Reopen in Container**, run `node -v` and `node hello.js`.
- Key message: the developer environment is reproducible from a checked-in JSON definition.

## Demo 2 — Custom Dockerfile + application bootstrapping, local (9 min)
- Open the repository root; introduce `.devcontainer/Dockerfile` and `.devcontainer/devcontainer.json`.
- Explain `postCreateCommand`, `postStartCommand`, port forwarding and how Node dependencies are installed.
- **Dev Containers: Reopen in Container** and visit forwarded port `3000`.
- Emulator boots immediately. Upload a text file to `C:\\`, show `DIR` or `TYPE`; then upload a ZIP and show its extracted files.
- Create a two-player IPX room. Show code/QR and open another browser tab to join.
- Key message: repeatable tooling, frontend, API, DOSBox-X assets, and IPX relay all start from the dev environment.

## Demo 3 — Move into GitHub Codespaces (7 min)
- Publish the repo beforehand; create a Codespace from GitHub's Code menu.
- Same `.devcontainer` definition builds the environment on GitHub-managed compute.
- Open the port-3000 preview: same DOS console. Show local uploaded files **are not automatically GitHub commits**.
- Key message: the repository is the source of truth for application/tooling. The emulator drive is runtime content.

## Demo 4 — VS Code desktop connects to the SAME Codespace (6 min)
- Open existing Codespace in desktop VS Code.
- Change the toolbar label or a CSS variable and refresh browser.
- Confirm remote status indicator: source and tools still run in that same Codespace, not on the laptop.
- Key message: moving your editor does not move your working environment.

## Demo 5 — Recreate on a remote Docker host (7 min)
- Connect VS Code to remote Linux using Remote-SSH; open a clone of the repo; run Reopen in Container.
- Alternatively: `DEMO_UID=$(id -u) DEMO_GID=$(id -g) docker compose up --build -d` and attach to running container.
- Preview with SSH-forwarded localhost or HTTPS. Re-create the same DOS console, IPX room, and upload tools.
- Key message: the running container is rebuilt on a different host; there is no magic live migration of a Codespace.

## Close (3 min)
**One repository, one dev environment definition, three compute locations, five demos.**

- Git/GitHub version code. They do not function as a shared DOS game filesystem or session database.
- A devcontainer is a reproducible development environment, not a production hosting contract.
- IPX rooms connect independent emulators. They load a common **initial** file snapshot; DOS writes are not continuously shared.

**About 41 minutes + Q&A.**
