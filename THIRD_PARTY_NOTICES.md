# Third-party components and public distribution

DOSCloud Mini reuses browser DOSBox-X/js-dos assets and the IPX/remote filesystem integration from the user's existing DOSCloud project. Bundled js-dos emulator assets are GPL-2.0 licensed; the license text is provided in `public/jsdos/LICENSE-GPL-2.0.txt`. Those binaries contain upstream and DOSCloud-specific integrations. Before releasing or redistributing the compiled emulator assets, verify the corresponding-source availability and GPL license requirements for the exact versions distributed.

Node dependencies are documented in `package-lock.json`. Refer to upstream package notices for their licenses.

DOS games, WADs, archives, executable installers, game manuals, fonts, and other uploaded media may carry their own copyrights and redistribution conditions. Inclusion in the developer's persistent C: drive **does not** authorize publication on GitHub. Do not publicly commit those files without suitable redistribution rights.

No third-party DOS game package was intentionally staged for this repository's initial public publication.
