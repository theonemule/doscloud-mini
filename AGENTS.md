# Contributor guidance — DOSCloud Mini

This is the user's **talk demo** repository, not the production DOSCloud service. Read `docs/project-context.md`, `docs/architecture.md`, `docs/talk-outline.md`, and `docs/demo-runbook.md` before editing.

Keep one emulator screen with 46px toolbar, Upload file, IPX room, and Fullscreen. Reuse the current js-dos/DOSBox-X 8.4.1 assets and DOSCloud-compatible IPX adapter. No auth/catalog/dashboard/DB; demo intentionally stays on private network and browser localhost/HTTPS. Browser C: snapshots start from `drive/` but are not synchronized continuously. Preserve five live demos (not phases) showing local minimal, local custom, Codespaces, desktop VS Code attached to Codespace, and remote Docker via SSH.

Do not touch production DOSCloud services or expose this upload API publicly. Tests must pass before commits; don't push/deploy without authorization. Verify js-dos GPL-2.0 licensing before distribution.
