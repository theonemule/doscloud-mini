# Speaker Notes and Demo Narration

## Story through all five demos
"Imagine the repo doesn't just have the code for your game portal: it also knows how developers should work on it. Frontend, API, simple multiplayer and games live together. One command opens the workshop. Then I can choose where that workshop lives."

### Demo 1 narrative
- "This is not a Docker tutorial. This JSON describes what my editor needs to create."
- Point to `image`, run `node -v`, and emphasize this is checked into source control.
- Transition: "A base image is useful. What if my app needs a tailored environment and several running capabilities?"

### Demo 2 narrative
- Reveal Dockerfile and lifecycle commands side by side.
- Show the portal as a single pane of glass: game catalog, launch, import, create/join lobby.
- "There is no database. Git holds definitions; RAM holds temporary sessions."
- "Importing a game edits the local working tree. GitHub only gets it when I commit and push."
- Transition: "What if my laptop doesn't have Docker or the right tooling?"

### Demo 3 narrative
- Open GitHub Codespaces and demonstrate it consumes the same devcontainer configuration.
- "The runtime is now running in GitHub-managed compute, but the repo is familiar."
- Show Ports tab and browser preview. Contrast forwarded URL with a production app host.
- Transition: "A browser editor is useful; I may want my full desktop editor."

### Demo 4 narrative
- Connect VS Code desktop to the existing Codespace. Show status bar and hot reload.
- "I changed clients, not code locations."
- Transition: "The same idea isn't limited to GitHub's infrastructure."

### Demo 5 narrative
- SSH into remote machine, reopen folder in container.
- "The dev environment is defined by source, not tied to a laptop, Codespace or remote VM."
- For Compose path: distinguish building and starting a container from attaching the VS Code development client.
- End: "Your laptop is a client. Git is the source of truth. The container is the repeatable workshop."

## Audience FAQ
**Is GitHub a database?** No. It's a good repository for small versioned game definitions and source; not live session state.

**Does a devcontainer automatically start all services?** Only if lifecycle hooks or a supervisor does so. A `postStartCommand` must exit; our script starts an idempotent background dev server.

**Can I transfer a running Codespace to any Docker server?** Not as a live migration. Clone repository and recreate/rebuild from the Dockerfile.

**Is this how you host production multiplayer games?** No. A durable service would have auth, state storage, WebSocket/UDP choice, isolation, scaling and operations.

**Do I need local Docker to edit Codespaces in VS Code desktop?** No. The runtime is remote.

## Optional visual slide sequence
1. Title and hook
2. Repository as the "portable workstation" diagram
3. Demo 1 JSON only
4. Demo 2 Dockerfile and lifecycle
5. Game Cloud portal and versioned game repository
6. Demo 3 Codespaces/port preview
7. Demo 4 desktop VS Code client
8. Demo 5 remote Docker + SSH
9. Comparison table: local vs Codespaces vs remote host
10. Three takeaways + QR/link to demo repo
