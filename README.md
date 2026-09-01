# Plaintext Web

Plaintext Web is an unofficial, dependency-free web adaptation inspired by
JP Aumasson's [Plaintext](https://github.com/veorq/Plaintext).

It is a quiet plain-text editor delivered as one self-contained HTML file.
Your document stays in your browser unless you explicitly open or save a file.

## Try it

The hosted demo link will be added after the final browser acceptance pass.

## Offline use

Download index.html and open it directly in a current browser. The editor,
styles, scripts, and fonts are embedded; the app makes no runtime network
requests.

## Features

- Local recovery and version history
- Undo and Redo
- Open, Save, Save As, and Download a copy fallbacks
- Find and replace
- Light, dark, and system-matched themes
- Goal-based writing sessions
- Fullscreen when the browser supports it

## Browser support

The release targets current Chrome, Edge, Firefox, and Safari on desktop,
Safari on iOS/iPadOS, and Chrome on Android. Direct connected-file writes use
the File System Access API where available; file input and downloads work as the
cross-browser fallback.

## Privacy

Plaintext Web has no analytics, accounts, cloud sync, or runtime network
dependencies. Browser recovery uses localStorage when available. Saving or
downloading a file happens only when you ask.

## Credits

The editor is inspired by
[Plaintext](https://github.com/veorq/Plaintext) by JP Aumasson. This repository
is an independent web adaptation and is not affiliated with or endorsed by the
upstream author.

## License

The upstream Plaintext code is distributed under its MIT licence. Embedded
fonts retain their SIL Open Font Licence terms. See LICENSE,
THIRD_PARTY_NOTICES.md, and ThirdPartyLicenses/.
