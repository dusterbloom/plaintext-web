# Plaintext Web Key Sound Choices

**Date:** 2026-09-01

## Goal

Make typing audio easy to discover and give writers a genuinely gentler sound
without weakening the app's one-file, offline design.

## User interface

Replace the current **Key sound** checkbox in Settings with one labeled native
`select` containing:

- Off
- Typewriter
- Soft tap

Off remains the first-run default. A native selector keeps the relationship
between enabled state and sound choice explicit, works with keyboard and screen
readers, and stays compact on narrow screens.

Selecting Typewriter or Soft tap plays one preview. Besides confirming the
choice, this user gesture gives browsers a reliable opportunity to activate
their audio context. Selecting Off is silent.

## Preference compatibility

The setting becomes an enum rather than a boolean. Canonical stored values are
`off`, `typewriter`, and `tap`.

The existing build stores `soft` when its single typewriter sound is enabled.
On load, that legacy value maps to `typewriter` and is rewritten to the
canonical value when storage is available. Missing, `off`, and unknown values
resolve safely to Off.

## Audio sources and playback

The existing Typewriter waveform remains unchanged in character.

Soft tap uses the exact `zen/press.mp3` asset from
[`romainsimon/uisfx`](https://github.com/romainsimon/uisfx), pinned to upstream
commit `99d287a1d27ef49c02a5262184a7fda91612321e`. The 1,714-byte MP3 is embedded
as a base64 data URL inside `index.html`; there is no runtime request or
separate audio file. MP3 is used instead of the smaller Ogg version so the
downloaded HTML also works on Safari and iOS versions predating Ogg support.

One audio context is shared. The Typewriter buffer is synthesized lazily as it
is today. The embedded Soft tap bytes are decoded once with Web Audio and the
decoded buffer is cached. The existing request invalidation remains active
across audio-context resume and asynchronous MP3 decoding so stale previews or
muted sounds cannot play later. The selected buffer is dispatched for printable
keys, Backspace, Enter, and Delete under the existing throttle.

If Web Audio is absent, blocked, or fails, typing continues normally. The app
does not display a disruptive error for an optional effect.

## Attribution and licensing

UI SFX code is MIT licensed and its generated audio is dedicated to the public
domain under CC0 1.0. Add the upstream project, exact asset path, pinned commit,
and CC0 notice to `THIRD_PARTY_NOTICES.md`, the standalone legal-notices block,
and `ThirdPartyLicenses/UISFX-CC0.txt`. Attribution is retained even though CC0
does not require it.

## Verification

Automated tests cover:

- preference parsing, including legacy `soft` migration and unknown values;
- the three selector options and accessible label;
- storing the selected canonical value;
- the embedded MP3's exact base64 bytes and pinned upstream provenance;
- dispatching Typewriter and decoded Soft tap buffers through distinct paths;
- caching one decode, cancelling stale async playback, and containing decode
  failures;
- complete UI SFX attribution in repository and standalone legal notices;
- preserving the single-file and zero-runtime-network invariants.

Manual browser acceptance confirms:

- both audible choices preview when selected;
- Typewriter retains its current character;
- Soft tap is clearly distinct and noticeably gentler;
- typing uses the selected sound after the Settings dialog closes;
- Off remains silent;
- the selector fits desktop, narrow portrait, and short landscape layouts.

## Non-goals

- volume sliders or per-sound volume controls;
- external or runtime-downloaded audio samples;
- additional sound packs;
- changing the existing typing-key set or throttle.
