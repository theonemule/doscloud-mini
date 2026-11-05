# Public GitHub repository: DOSCloud Mini

Published public GitHub repository: **https://github.com/theonemule/doscloud-mini** (default branch: `main`).

## What GitHub will contain

- All versioned application source and browser emulator assets, tests, Dev Container/Docker configuration, and docs.
- The real, persistent `drive/` folder (host C: drive): it is no longer ignored by Git. Files installed there appear in `git status` and can be explicitly committed and pushed.
- Initial publicly distributable drive placeholder (`drive/.gitkeep`) and `drive/README.TXT`.

**Included:** the original DOS DOOM v1.9 shareware distribution and its installed files in `drive/`, including the original split installer (`DOOMS_19.1`, `DOOMS_19.2`, `DEICE.EXE`, `DOOMS_19.DAT`, `INSTALL.BAT`), the shareware executable and `DOOM1.WAD`, the bundled setup/network utilities, and their manuals/configuration. The `DOOM1.WAD` is the verified v1.9 shareware edition (MD5 `f0cefca49926d00903cf57551d901abe`). DOOM retains its historical id Software shareware license, not the GPL. The rights record is documented in `docs/doom-shareware-notice.md`.

The mounted persistent C: directory is versioned in this repository. Future DOS files and changes made by the host appear in `git status` and can be committed/pushed manually. DOOM shareware does **not** mean arbitrary later games added to the C: drive are redistributable. Review those separately before committing to the public repository.

**Never version:** `.runtime/` (self-signed TLS private key, room hardlink snapshots, temporary server data), guest room overlays (temporary OS directories), `node_modules/`, credentials, development secrets or logs.

GitHub is version control, **not live filesystem synchronization**. Installing a game into DOSCloud Mini modifies the host's persistent `drive/` immediately; it appears in the remote GitHub repository only after a `git add`, `git commit`, and `git push` from that workspace. Other Codespaces/hosts must `git pull` to see those files. Temporary room guest writes are never committed.

## Published and connected

The repository has been created as **PUBLIC** and the existing source history and full original DOOM shareware C: drive were pushed to `origin/main`. The development server's GitHub CLI authentication is kept locally in an ignored `.runtime/gh-cli/` directory; no credentials are committed.

To push later commits from this already authenticated development server:

```bash
cd /var/lib/sandbox-mcp/workspaces/codespaces-game-cloud-talk
git push origin main
```

For a fresh clone or another machine, sign in with GitHub CLI or configure your own Git credentials before pushing. The original `drive/` files are included when cloning the repository.

## When you install or update a game

**Verify redistribution rights for each additional game first.** In the project workspace:

```bash
git status --short -- drive/
git add --all -- drive/
git diff --cached --stat -- drive/
git commit -m "Install DOS game on persistent C drive"
git push origin main
```

Or use the provided guardrailed manual command:

```bash
bash scripts/save-drive.sh --confirm-distribution-rights
```

The command only stages `drive/`, requires an explicit rights acknowledgment, and doesn't include temporary IPX guest clones.

For **licensed/private game data**, use a private repository, a separate private content repository, or private object storage rather than publishing the files to this public project. A public repository can coexist with a private game vault on the developer's machine.
