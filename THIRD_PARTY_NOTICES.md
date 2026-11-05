# Third-party components and public distribution

DOSCloud Mini reuses browser DOSBox-X/js-dos assets and the IPX/remote filesystem integration from the user's existing DOSCloud project. Bundled js-dos emulator assets are GPL-2.0 licensed; the license text is provided in `public/jsdos/LICENSE-GPL-2.0.txt`. Those binaries contain upstream and DOSCloud-specific integrations. Before releasing or redistributing the compiled emulator assets, verify the corresponding-source availability and GPL license requirements for the exact versions distributed.

Node dependencies are documented in `package-lock.json`. Refer to upstream package notices for their licenses.

The persistent DOS drive contains **DOOM shareware v1.9**, including the original DOS shareware installer and installed shareware executable/data files. This is copyrighted id Software game content, not public domain or GPL source code. The original license and permissions must be respected; the DOOM shareware IWAD is redistributable, as affirmed by John Carmack in the Debian copyright record for `doom-wad-shareware`. See `docs/doom-shareware-notice.md` for package provenance, checksum and references.

Other DOS games, WADs, installers, modifications, and uploads may carry different copyright and distribution rules. Their presence in the persistent C: drive does not itself authorize public redistribution. Check additional game licenses before future commits.
