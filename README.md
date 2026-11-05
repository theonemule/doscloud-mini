# DOSCloud Mini — Dev Containers & Codespaces Talk

A minimal, **one-screen DOSBox-X browser emulator**, reusing the js-dos 8.4.1 emulator assets and WebSocket IPX adapter from the user's existing DOSCloud implementation.

This is a **portable developer demonstration**, not a public DOSCloud deployment. The application has **no login**, so bind it only to localhost, a trusted private LAN, or the private Codespaces port.

## Single screen
- **Upload file**: choose any file and a target C: folder (defaults to `C:\\`); a `.zip` is unpacked automatically in that folder. Uploaded files are copied into the current emulator and saved on the dev server.
- **IPX room**: choose 2–8 players; host starts its own DOSBox-X IPX server. The right-hand drawer shows room code, link and QR code. Each invited player opens an independent browser emulator and gets the same starting C: drive snapshot.
- **Fullscreen**: expand the emulator.

The app immediately boots into DOS. There is **no catalog, dashboard, authentication, database, or JavaScript quiz/game renderer**.

## Start in a Dev Container

Open the repo root in VS Code and choose **Dev Containers: Reopen in Container**. Port `3000` forwards automatically. Open `http://localhost:3000/` in your local browser. Localhost is a trusted browser context needed by js-dos' virtual filesystem. `npm ci && npm test` validates backend behavior.

## Start directly

```bash
npm ci
npm test
npm start
# http://localhost:3000/
```

**LAN preview requires HTTPS**, because js-dos uses secure-context browser storage APIs. The dev-server preview uses a locally generated development certificate; accept it only if you trust the server.

## Drive behavior

The server maintains `drive/`. Uploads are held there between preview restarts. ZIP paths are validated and constrained to the drive. Loading a page creates that browser's own snapshot in a dedicated emulator, while upload also writes into the currently-running emulator. DOS-side saves/writes made by games are **not automatically synchronized back to the server**, nor between players. Do not mistake the room's common *initial* files for one live shared writable drive. Files can be committed to Git manually if desired; `drive/` is ignored by default to avoid accidentally committing uploaded copyrighted games.

Room state and the WebSocket IPX relay are in memory and lost on restart. Player invite codes are temporary. Room membership is based on possession of the invite code/session token, not accounts. Keep the service on a private network.

## Five talk demos

1. Minimal local devcontainer JSON: open `demos/01-basic`.
2. Custom local Dockerfile and DOSCloud Mini bootstrap: open root.
3. Launch the exact repo in GitHub Codespaces.
4. Connect desktop VS Code to the *same* Codespace.
5. Recreate the repo/dev container on an SSH-connected remote Docker host.

See `docs/talk-outline.md`, `docs/architecture.md`, `docs/demo-runbook.md`, and `docs/project-context.md`.

## Credits and licensing

The emulator files under `public/jsdos/` and `public/emulators/` originate from DOSCloud's vendored **js-dos 8.4.1**, licensed GPL-2.0. The WebSocket IPX browser adapter is adapted from the user's DOSCloud project. Dependencies include `ws`, `adm-zip`, and `qrcode` (MIT-licensed). Verify licensing and distribution obligations before redistributing the repository.
