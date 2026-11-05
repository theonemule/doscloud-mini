# Public GitHub repository: DOSCloud Mini

Target owner: **theonemule**. Suggested new public repository name: **doscloud-mini**.

## What GitHub will contain

- All versioned application source and browser emulator assets, tests, Dev Container/Docker configuration, and docs.
- The real, persistent `drive/` folder (host C: drive): it is no longer ignored by Git. Files installed there appear in `git status` and can be explicitly committed and pushed.
- Initial publicly distributable drive placeholder (`drive/.gitkeep`) and `drive/README.TXT`.

**Not included by default:** preexisting third-party game packages in the local host C: drive, because rights to redistribute those binaries publicly have not been verified. Existing DOSCloud Mini preview data and files stay intact on the development host. These files can be included in a later commit *only after* confirming permission to distribute them in a public repository.

**Never version:** `.runtime/` (self-signed TLS private key, room hardlink snapshots, temporary server data), guest room overlays (temporary OS directories), `node_modules/`, credentials, development secrets or logs.

GitHub is version control, **not live filesystem synchronization**. Installing a game into DOSCloud Mini modifies the host's persistent `drive/` immediately; it appears in the remote GitHub repository only after a `git add`, `git commit`, and `git push` from that workspace. Other Codespaces/hosts must `git pull` to see those files. Temporary room guest writes are never committed.

## Publishing from the development server

The server has Git and the `gh` CLI but **is not currently signed in to GitHub**. After authenticating as the GitHub owner:

```bash
cd /var/lib/sandbox-mcp/workspaces/codespaces-game-cloud-talk
gh auth login
gh repo create theonemule/doscloud-mini --public --source=. --remote=origin --push
```

Do **not** initialize the GitHub repository with a README or other first commit; the existing local Git repository already has source history. If the public repo has already been created empty through GitHub's web UI, use:

```bash
git remote add origin https://github.com/theonemule/doscloud-mini.git
git push -u origin main
```

The `gh` authentication enables private Git operations when needed; otherwise configure a GitHub credential manager, SSH, or compatible Git credential. Public repo creation/publishing was not performed unless explicitly verified.

## When you install or update a game

**Verify public redistribution rights first.** In the project workspace:

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
