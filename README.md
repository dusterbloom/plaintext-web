# Plaintext Web

Plaintext Web is an unofficial, dependency-free web adaptation inspired by
JP Aumasson's [Plaintext](https://github.com/veorq/Plaintext).

It is a quiet plain-text editor delivered as one self-contained HTML file. Its
durable state lives in a folder you explicitly select; browser storage is only
a recovery cache.

## Durable workspace

Plaintext is read-only until a workspace is connected. Choose a folder you
control; Plaintext creates `Plaintext/document.md`, recovery metadata at
`Plaintext/recovery/latest.json`, and immutable snapshots under
`Plaintext/recovery/snapshots/`. Writes are serialized, closed, and read back
before they count as saved. Saving is silent while it works; a status line
appears under the title only when editing is locked or a write fails. Browser
storage is only a recovery cache. A permission or verification failure locks
editing until reconnection.

On each launch:

1. Click the document title to open the menu and choose **Connect workspace…**. After the first time, Plaintext reconnects to the same folder on launch; if the browser asks again, choose **Reconnect** from the menu.
2. Choose the parent folder that should contain Plaintext's durable data.
3. Resolve any disk/browser divergence when prompted.

If you try to close the page while a write is still in progress, the browser
asks you to stay.

Plaintext preserves the existing disk revision before reconciliation and never
automatically deletes snapshots. Copy the whole `Plaintext` directory to
restore or migrate a document. `document.md` is the current readable document;
`recovery/latest.json` and `recovery/snapshots/` retain revision metadata and
complete recovery states.

## Try it

Open the [live demo](https://dusterbloom.github.io/plaintext-web/), or download
index.html and open it locally.

## Offline use

Download index.html and open it directly in a current browser. The editor,
styles, scripts, and fonts are embedded; the app makes no runtime network
requests.

## Features

- Verified disk autosave, local recovery, and immutable snapshots
- Undo and Redo
- Open, Save, Save As, and Download a copy fallbacks
- Find and replace
- Light, dark, and system-matched themes
- Goal-based writing sessions
- Fullscreen when the browser supports it

## Browser support

Durable editing requires a desktop Chromium browser that implements the File
System Access API, such as current Chrome or Edge. Browsers without directory
access remain read-only so they cannot silently make browser storage the only
copy. Opening files and downloading copies remain available as transfer tools,
but they do not replace the required verified workspace.

## Privacy

Plaintext Web has no analytics, accounts, cloud sync, or runtime network
dependencies. Browser recovery uses localStorage when available. Saving or
downloading uses only the workspace or file location you explicitly select.

## Credits

The editor is inspired by
[Plaintext](https://github.com/veorq/Plaintext) by JP Aumasson. This repository
is an independent web adaptation and is not affiliated with or endorsed by the
upstream author.

## License

The upstream Plaintext code is distributed under its MIT licence. Embedded
fonts retain their SIL Open Font Licence terms. See LICENSE,
THIRD_PARTY_NOTICES.md, and ThirdPartyLicenses/.
