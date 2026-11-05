# Agent / Contributor Working Context

This is a **talk/demo project** using one cohesive miniature Game Cloud application to teach Dev Containers and GitHub Codespaces, not a full production game platform.

Read `docs/project-context.md`, `docs/architecture.md`, `docs/talk-outline.md`, and `docs/demo-runbook.md` before changing architecture. Preserve the 5-demo narrative and portability between local Docker, Codespaces, VS Code desktop and remote Docker. Favor simple zero-dependency Node 22 code, port 3000, safe JSON game packages, and ephemeral in-memory rooms. Use tests; no secrets or public Docker sockets. Keep Git commits/pushes and cloud resources explicit.
