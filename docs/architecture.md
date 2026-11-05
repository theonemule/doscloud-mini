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
- **Upload file modal:** destination folder, file picker. Ordinary binary upload writes that file to the selected folder of the demo C drive. ZIP upload validates and extracts entries within the selected folder, then writes the files into that player’s server-backed C: drive (the host original or a guest delta layer).
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
                     | /api/upload                     |
                     | /api/fs and /ws/fs (REMOTEFS)   |
                     | /api/rooms + /api/rooms/qr       |
                     | /ws/ipx (room-scoped relay)      |
                     +----------------------------------+
                           |                   |
                     host drive/          room state (RAM)
                     persistent           one hardlink snapshot
                                          guest COW overlays
                           |
             +-------------+---------------+
             |                             |
       Browser Emulator A            Browser Emulator B
       DOSBox-X + host C:            DOSBox-X + base+delta C:
       IPX peer 1 (host)             IPX peer 2 (guest)
             +------ WebSocket IPX relay --+
```

Each browser runs a separate DOSBox-X emulator with a **remote-mounted server-backed C: drive**, reusing DOSCloud's existing binary filesystem protocol and worker/WebSocket bridge. There is no full C: download at emulator boot. The host's C: drive persists in `drive/`, including files DOS programs write. Creating an IPX room freezes one hardlink-backed snapshot of that host drive, then gives each guest a disposable copy-on-write overlay. Reads go to the base unless shadowed; only files modified by that guest are copied into their overlay. These are **file-level** deltas, not block-level patches. A guest's writes never update the host or another guest.

The room snapshot is a point-in-time view. Host writes after snapshot creation preserve the original base by atomically replacing files or detaching hardlinked inodes. The host's changes persist; guests keep their old view until a new room is created. End room or idle expiration discards temporary room files. The IPX relay remains independent of filesystem transport.

## APIs
| Path | Operation |
|---|---|
| `GET /api/health` | health check |
| `POST /api/drive/session` | create a transient host-console access token |
| `POST /api/upload?token=...&filename=...&folder=C:\` | host upload persists; guest upload writes to their delta overlay; ZIP extracts |
| `POST /api/rooms` | snapshot host C: once and create IPX room with 2–8 players |
| `POST /api/rooms/:code/join` | create a guest peer and empty overlay on first access |
| `POST /api/rooms/:code/end` | host stops room and deletes temporary snapshots/deltas |
| `GET /api/rooms/session?token=...` | peer session metadata |
| `GET /api/rooms/qr?code=...` | QR invitation PNG |
| `POST /api/fs?launch=...&session=...` | original DOSCloud binary filesystem RPC fallback |
| `WS /ws/fs?launch=...&session=...` | DOSCloud REMOTEFS WebSocket bridge |
| `WS /ws/ipx?token=...` | DOSCloud-compatible room IPX packet relay |

Room host announces readiness after DOSBox-X IPX server startup; guests register through DOSCloud's `sharedNet` adapter. IPX messages are not filesystem writes.

## Security, portability and limitations
- **This app has no user authentication** per demo requirements. Only run on a trusted host/private LAN or private forwarded port. Invite codes are not strong access control. Do not expose open uploads or guest invitations to the public Internet.
- Uploaded files may be executables for DOS. Treat content as untrusted and **run only in the browser emulation environment**; never execute them on the host.
- One host drive is durable, and room snapshots use metadata-only hardlinks on the same volume. Guest overlays are under temporary OS storage and removed at explicit room end/inactive expiry. This is not a production-grade crash-proof erasure guarantee.
- Server validates DOS paths against traversal, bounds file/ZIP sizes, and stores uploads in a single `drive/` directory. The persistent C: directory is Git-trackable; explicitly commit/push authorized content. Guest overlays remain outside Git.
- ZIP and file imports are kept in that server's workspace; when moving to another dev machine, initial drive content does not magically migrate unless intentionally copied/versioned.
- DOSCloud's js-dos 8.4.1 emulator is GPL-2.0. Check reuse and distribution obligations before publishing a public repository.
- Browser js-dos requires a **secure context** (localhost or HTTPS) for filesystem APIs. LAN demos use development HTTPS with a self-signed certificate; VS Code forwarded localhost also works.
- No persistence of in-memory rooms on restart. No production isolation, rate limiting, user storage quotas, or authorization. Keep Codespaces port private and do not expose HTTP file-writing endpoints publicly.
- Tested: browser DOS boot, host file and ZIP uploads, DOS-side host `MKDIR` persisted, DOS-side guest `MKDIR` wrote only to its temporary delta and was erased at room end; host/guest browser IPX peer IDs 1 and 2, filesystem WebSocket worker, backend filesystem and binary relay. Full game-to-game IPX networking has **not yet been validated with a particular DOS title**.
