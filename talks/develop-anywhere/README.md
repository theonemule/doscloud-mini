# Develop Anywhere — Dev Containers talk

**Presentation:** ~60 minutes, with four live demos (the demos intentionally take most of the session).

This uses the navy/cyan/mint/yellow retro-DOS visual language of the original `DOSCloud.pptx` presentation, reworked as editable Markdown for **LiveDeck**.

## What is here

- `slides.md` — **primary editable source**, with presenter notes embedded as Markdown comments.
- `dos-theme.css` — deck-wide LiveDeck custom CSS matching the original DOSCloud aesthetic.
- `build-deck.mjs` — no-dependency Node.js converter from Markdown into a LiveDeck JSON deck and separately exported presenter notes JSON.
- `livedeck.json` — directly importable LiveDeck deck object with Markdown slides, layouts and theme.
- `presenter-notes.json` — presenter notes keyed by slide ID. **These notes are public because this GitHub repository is public**, but LiveDeck does not project them to the audience.
- `demo-runbook.md` — practical runbook, timing, commands, fallback steps.

## Rebuild after editing Markdown

```bash
cd talks/develop-anywhere
node build-deck.mjs
```

Then import `livedeck.json` into LiveDeck Creator as a new deck using its JSON import option. The notes JSON is an authoring aid: copy or transfer the individual notes into LiveDeck’s presenter-notes editor separately, as LiveDeck keeps notes out of the public deck JSON. Do not insert the whole `slides.md` into a single Markdown slide—it contains multiple slide sections.

**Access note:** LiveDeck's connected API returned HTTP 403 during creation, so no LiveDeck-hosted deck was created or modified; the import-ready files are versioned here instead.

## Confirmed project paths

- `https://github.com/theonemule/doscloud-mini`
- `.devcontainer/01-hello-world/devcontainer.json`
- `.devcontainer/02-node-app/devcontainer.json`
- `.devcontainer/03-custom-docker/devcontainer.json`
- `.devcontainer/Dockerfile`
- `docs/devcontainer-examples.md`
- Node app port `3000`; debugger `9229` is optional/private and not included by default.

Keep Codespaces forwarding private: the demo server allows unauthenticated uploads.
