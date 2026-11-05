# Speaker Notes — DOSCloud Mini as the running example

The talk is about portable **development environments**, not an emulator platform rollout. Keep the five demos as five editor/hosting locations around the *same* tiny, one-screen emulator.

## Opening line
"What if cloning a repository were enough to open a complete development workstation in a browser—not just code, but a running application, emulator, its API, and multiplayer networking?"

## Demo 1: minimal local JSON
"A development environment can start with one source-controlled JSON file." Explain the base image and VS Code attachment.

## Demo 2: custom Dockerfile and application
"Now we tailor the image and bootstrap the app. The page doesn't open to a launch dashboard. It simply IS the DOS emulator." Highlight port forwarding, Node process, static JS/WASM, upload and ZIP extraction to C:, and launch IPX room.

Why not use the same live C: drive for all players? "Each DOSBox-X runs separately; each starts from the same server-side files, while IPX carries the multiplayer packets. Sharing one live mutable filesystem would need conflict handling and is outside our demo."

## Demo 3: Codespaces
"GitHub stores the source and dev-container definition. Codespaces gives us the machine. We still have the same emulator and tools."

Important: uploaded games are **not** automatically saved to GitHub and must not be silently committed. Port visibility stays private.

## Demo 4: desktop VS Code
"The code and running app are unchanged; only the editor client is different." Show a CSS or label edit.

## Demo 5: remote Docker
"Now run the same environment on infrastructure you control. We rebuild from the repo rather than pretending to move the live Codespace." Remote SSH + devcontainer; connect local browser via port forwarding.

## Closing
"The laptop is a client; the repository is the versioned description of how to work; the container is the reproducible workshop."

## Frequently asked
**Is this the full DOSCloud product?** No. It reuses the same js-dos 8.4.1 / DOSBox-X engine and WebSocket IPX adapter, but strips the auth, catalog, DB and application scaffolding for a presenter-friendly microcosm.

**Can guests play together?** They have independent emulators and a shared IPX room. Full interoperability of a specific game needs compatible game files and in-game multiplayer setup; validate a title before promising live game play.

**Where do uploaded games go?** To the demo server's `drive/` directory, and into the uploading browser's active emulator. A new browser loads the current snapshot at boot. DOS-side saves are not automatically backed up.

**Why HTTPS?** Modern browser emulator filesystem/storage APIs require a secure context on non-localhost hosts.

**Is a dev container a production server?** No. This intentionally unauthenticated app is private and for development only.
