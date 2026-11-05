# DOSCloud Mini — architecture

## Purpose
A deliberately minimal, browser-first **DOSBox-X / js-dos 8.4.1** emulator application for a talk about portable development. Its emulator assets and IPX browser adapter come from the existing DOSCloud project. It is **not the DOSCloud production app**. No login, DB, catalog, launch cards or permanent room store.

## User interface
```text
+-------------------------------------------------------------+
| DOSCLOUD mini   [Upload file]  [IPX room] [Fullscreen]  READY |
+-------------------------------------------------------------+
|                                                             |
|                        DOSBox-X console                     |
|                                                             |
|                    C:\\>                                   |
|                                                             |
|                                                             |
+-------------------------------------------------------------+
               ^ IPX room has right-hand invite drawer
```

- One page, toolbar 46px tall; the emulator occupies the remaining viewport.
- **Upload file modal:** destination folder, file picker. Ordinary binary upload writes that file to the selected folder of the demo C drive. ZIP upload validates and extracts entries within the selected folder, then synchronizes changed files into the current running emulator.
- **IPX room modal:** select 2–8 players, click Launch; shows join code, link and QR in a right slide-over. Other players follow that link and get their own running DOS console.
- **Fullscreen** for the emulator.

## Components and lifecycle
```text
                  GitHub repo: source + devcontainer definitions
                    /                |                  \
             Local Docker      Codespaces          Remote Docker via SSH
                    \                |                  /
                     +----------- Node :3000 -----------+
                     | static emulator JS/WASM + UI     |
                     | /api/drive + /api/upload         |
                     | /api/rooms + /api/rooms/qr       |
                     | /ws/ipx (room-scoped relay)      |
                     +----------------------------------+
                           |                   |
                     server drive/       ephemeral room state
                     (single snapshot    and peer tokens in RAM
                      source for boot)
                           |
             +-------------+---------------+
             |                             |
       Browser Emulator A            Browser Emulator B
       DOSBox-X + local C:           DOSBox-X + local C:
       IPX peer 1 (host)             IPX peer 2 (guest)
             +------ WebSocket IPX relay --+
```

Each browser creates a **separate running emulator with its own writable in-browser filesystem**. Both download the same initial C: files from the demo server. Their DOS process writes are *not* automatically uploaded or synchronized. The IPX relay forwards game network packets, not the DOS filesystem. Uploading through the toolbar updates the server and the *current* emulator; reload other browsers to get the new snapshot. Shared live filesystem semantics would require a different design.

## APIs
| Path | Operation |
|---|---|
| `GET /api/health` | health check |
| `GET /api/drive` | list uploaded C: files |
| `GET /api/drive/file?path=...` | retrieve file bytes |
| `POST /api/upload?filename=...&folder=C:\\` | upload file bytes; auto-extract ZIP |
| `POST /api/rooms` | create IPX room with 2–8 players |
| `POST /api/rooms/:code/join` | create a guest peer session |
| `GET /api/rooms/session?token=...` | peer session metadata |
| `GET /api/rooms/qr?code=...` | QR invitation PNG |
| `WS /ws/ipx?token=...` | DOSCloud-compatible binary IPX transport |

Room host announces readiness only after DOSBox-X IPX server startup; guests register through DOSCloud's `sharedNet` adapter. The room relay does not translate DOS game protocols or synchronize filesystem files.

## Security, portability and limitations
- **This app has no user authentication** per demo requirements. Only run on a trusted host/private LAN or private forwarded port. Invite codes are not strong access control. Do not expose open uploads or guest invitations to the public Internet.
- Uploaded files may be executables for DOS. Treat content as untrusted and **run only in the browser emulation environment**; never execute them on the host.
- Server validates DOS paths against traversal, bounds file/ZIP sizes, and stores uploads in a single `drive/` directory. The directory is ignored by Git to prevent accidentally checking in copyrighted binaries.
- ZIP and file imports are kept in that server's workspace; when moving to another dev machine, initial drive content does not magically migrate unless intentionally copied/versioned.
- DOSCloud's js-dos 8.4.1 emulator is GPL-2.0. Check reuse and distribution obligations before publishing a public repository.
- Browser js-dos requires a **secure context** (localhost or HTTPS) for filesystem APIs. LAN demos use development HTTPS with a self-signed certificate; VS Code forwarded localhost also works.
- No persistence of in-memory rooms on restart. No production isolation, rate limiting, user storage quotas, or authorization.
- Tested: browser DOS boot, direct upload and ZIP extraction into running emulator, host/guest browser connection with IPX peer IDs 1 and 2, backend binary relay. Full game-to-game IPX networking has **not yet been validated with a particular DOS title**.
