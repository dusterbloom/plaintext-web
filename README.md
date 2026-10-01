# Plaintext Web

Plaintext Web is an unofficial, dependency-free web adaptation inspired by
JP Aumasson's [Plaintext](https://github.com/veorq/Plaintext).

It is a quiet plain-text editor delivered as one self-contained HTML file. It
is always ready to type in, and it is built so you never lose a word.

## Never lose a word

Every pause in your typing is saved to the browser with strict durability, along
with a version history thinned like Time Machine: the latest version every two
minutes for an hour, then hourly for a day, daily for a month, and weekly after
that. Before a restore, New, or Open, the text on screen is pinned so it is never
thinned away.

Plaintext then nudges you once to choose a **safety-copy folder** (click the
title). It keeps `Plaintext/document.md` and readable versions in
`Plaintext/history/` there, remembers the folder, and re-grants access on your
next click or key press if the browser asks again. If the browser and the folder
ever disagree, the newer text stays open and the other becomes a pinned version;
nothing is overwritten silently.

If the browser's data is cleared, open Plaintext, click the title, and choose
**Restore from safety copy…**. Older `recovery/` snapshots in that folder are
merged into the history automatically. Put the folder somewhere that is itself
backed up to survive a dead disk too.

## Try it

Open the [live demo](https://dusterbloom.github.io/plaintext-web/), or download
index.html and open it locally.

## Offline use

Download index.html and open it directly in a current browser. The editor,
styles, scripts, and fonts are embedded; the app makes no runtime network
requests.

## Features

- Strict autosave, thinned version history, and a remembered safety-copy folder
- Undo and Redo
- Open, Save, Save As, and Download a copy fallbacks
- Find and replace
- Light, dark, and system-matched themes
- Goal-based writing sessions
- Fullscreen when the browser supports it

## Browser support

The safety-copy folder needs a desktop Chromium browser with the File System
Access API, such as current Chrome or Edge. Other browsers keep full editing with
browser storage; use Save As or Download a copy for a backup.

## Privacy

Plaintext Web has no analytics, accounts, cloud sync, or runtime network
dependencies. Text and history are kept in the browser's IndexedDB. Saving or
downloading uses only the folder or file location you explicitly select.

## Credits

The editor is inspired by
[Plaintext](https://github.com/veorq/Plaintext) by JP Aumasson. This repository
is an independent web adaptation and is not affiliated with or endorsed by the
upstream author.

## License

The upstream Plaintext code is distributed under its MIT licence. Embedded
fonts retain their SIL Open Font Licence terms. See LICENSE,
THIRD_PARTY_NOTICES.md, and ThirdPartyLicenses/.
