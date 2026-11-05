# DOOM v1.9 shareware redistribution notice

This repository includes the **original DOS DOOM v1.9 shareware episode** in the persistent `drive/` C: directory. The game data and binaries are copyright id Software and subject to the historical DOOM shareware license; they are not public-domain, MIT, or GPL game content.

## Provenance and verification

- The complete original DOS shareware installer consists of `INSTALL.BAT`, `DEICE.EXE`, `DOOMS_19.DAT`, `DOOMS_19.1`, and `DOOMS_19.2`, matching the file names and byte sizes listed by the historical DoomGate/Gamers.org distribution guide.
- Installed game and accompanying files are under `drive/DOOMS/` and include `DOOM.EXE`, the original `DOOM1.WAD`, setup and IPX executables, and manuals/FAQ files. They are preserved as installed; this project does not patch their levels or assets.
- `drive/DOOMS/DOOM1.WAD` is **4,196,020 bytes**, with MD5 **`f0cefca49926d00903cf57551d901abe`** and SHA-256 **`1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771`**, matching the known canonical shareware v1.9 IWAD.

## Redistribution terms

The historical id Software shareware license allows copying the shareware software to give to others, prohibits modification/derivative works and restrictions on charging, and retains copyright. Debian's copyright record for the v1.9 shareware WAD includes a 1999 written clarification by John Carmack confirming that the DOOM shareware WAD is freely distributable. This repository is provided without charging for the shareware game and preserves the original documentation.

References:

- Debian original license and John Carmack clarification: https://sources.debian.org/src/doom-wad-shareware/1.9.fixed-4/debian/copyright
- Original DOS shareware package file list: https://www.gamers.org/dhs/helpdocs/ftpdoom.html
- Original DOOM shareware distribution: https://www.gamers.org/games/doom/

Game assets are not covered by the separate GPL license of the released DOOM engine or of the js-dos emulator. The public-source application is separate from the proprietary shareware content it runs. Do not assume that other registered DOOM games or additional uploaded titles have the same redistribution permission.
