# DOSCloud Mini — Dev Containers & Codespaces Talk

Public GitHub repository: **https://github.com/theonemule/doscloud-mini**.

A minimal, **one-screen DOSBox-X browser emulator**, reusing the js-dos 8.4.1 emulator assets and WebSocket IPX adapter from the user's existing DOSCloud implementation.

This is a **portable developer demonstration**, not a public DOSCloud deployment. The application has **no login**, so bind it only to localhost, a trusted private LAN, or the private Codespaces port.

## Single screen
- **Upload file**: choose any file and a target C: folder (defaults to `C:\\`); a `.zip` is unpacked automatically in that folder. Uploaded files are copied into the current emulator and saved on the dev server.
- **IPX room**: choose 2–8 players; host starts its own DOSBox-X IPX server. The right-hand drawer shows room code, link and QR code. Each invited player opens an independent browser emulator backed by a temporary copy-on-write clone of the host C: drive.
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

The host's **persistent** DOS C: drive is `drive/`. DOSBox-X mounts it directly using the original DOSCloud REMOTEFS worker and server-backed filesystem RPC (`/api/fs` or `/ws/fs`). DOS file operations (including game saves) are written to that server drive, not just to the browser's memory. Uploads and unzipped files also land there. The persistent C: folder is Git-trackable. The original DOOM v1.9 shareware game files are included in this versioned C: drive. Manually commit and push additional game files you have the right to redistribute. Guest room overlays are excluded. See `docs/github-publication.md`.

On **room creation**, the server creates one frozen base snapshot: a filesystem **hard link** for each host file (metadata only, without duplicating its contents on the same volume). The host's later writes break any shared hard links before modifying files, preserving the snapshot. Each joining guest gets an **empty, disposable writable overlay** on top of that frozen base. Reads are served from the base; a guest's first modification to a file copies only that file into their overlay (file-level copy-on-write), while newly created files go straight into the overlay. Other players never see that guest's changes. There is **no up-front full drive download**, no per-guest full copy and no guest-drive persistence. Guest data is deleted when the host clicks **End room** or an inactive room expires (up to 2 hours); the host's originals survive. A crash can leave temporary server files until cleanup, so this is not a security-grade ephemeral storage system.

If the host uploads or changes a file after the room is created, existing guests retain the room's original snapshot; to receive new files they need a newly created room. Cloning uses hard links only when the host and snapshot are on the same filesystem; it falls back to a one-time copy otherwise. This is **file-level**, not block-level, delta handling.

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
