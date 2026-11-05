# Dev Container examples

DOSCloud Mini is a **Node.js 22** application. It is not written in Go. These examples install no Go, Python, Docker-in-Docker, IDE extensions, or other optional toolchains.

Open the repository root in VS Code or GitHub Codespaces and select a configuration from **Dev Containers: Reopen in Container** (VS Code) or the Codespaces configuration picker.

| Example | Configuration | What it does |
| --- | --- | --- |
| 1 — Hello World | `.devcontainer/01-hello-world/devcontainer.json` | Uses the standard Node.js 22 image and runs `node demos/01-basic/hello.js`. No application server or port. |
| 2 — Node application | `.devcontainer/02-node-app/devcontainer.json` | Uses the standard Node.js 22 image, runs `npm ci && npm test`, starts DOSCloud Mini and forwards HTTP port `3000`. |
| 3 — Custom Docker image | `.devcontainer/03-custom-docker/devcontainer.json` | Builds `.devcontainer/Dockerfile`, with Node 22 and the app's npm dependencies preinstalled. Runs tests, starts DOSCloud Mini and forwards port `3000`. |

The root `.devcontainer/devcontainer.json` remains the **default** and is equivalent to Example 3. The older standalone `demos/01-basic/.devcontainer/devcontainer.json` still works when opening that demo folder by itself.

## Start and access DOSCloud Mini

Examples 2 and 3 run these commands automatically when opening the container:

```sh
npm ci && npm test
bash .devcontainer/start-app.sh
```

The startup script launches `npm run dev` only if port 3000 is not already serving DOSCloud Mini. The Node server binds `0.0.0.0:3000` by default. Its HTTP, uploads, IPX multiplayer WebSocket and remote C: filesystem WebSocket all share **port 3000**, so no other port forwarding is needed.

In local VS Code, select **Ports** → **DOSCloud Mini** → **Open in Browser**, or open `http://localhost:3000/`. In Codespaces, open the generated **HTTPS** forwarded-port URL. The port must remain **Private**: this demo does not authenticate users.

From the container terminal, verify:

```sh
npm test
curl -fsS http://localhost:3000/api/health
```

For Hello World, run `node demos/01-basic/hello.js` if you want to repeat the startup output.

## Persistent DOS drive

`drive/` is mounted as part of the source workspace and contains the committed DOOM v1.9 shareware files. Files installed or saved in the host's DOS C: drive remain in this working tree. Use `git add`, `git commit` and `git push` to publish them to GitHub; this is **not** automatic synchronization. IPX guest clone overlays are temporary and excluded from Git.

## Custom Dockerfile

The Dockerfile only needs the Node 22 development base image and the project's npm dependencies. The source files and DOS drive are provided by the Dev Container's workspace mount. `compose.yaml` also uses this Dockerfile, so the dependencies are preinstalled in the image for standalone Compose runs.
