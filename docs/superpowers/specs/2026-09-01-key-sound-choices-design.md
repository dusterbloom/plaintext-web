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

## Sound synthesis

The existing Typewriter waveform remains unchanged in character.

Soft tap is a separate deterministic synthesized buffer: roughly 40 ms of
quickly decaying, smoothed noise with a soft attack, no 235 Hz tonal body, and
a lower output level than Typewriter. It should resemble a muted paper or felt
tap rather than a quieter copy of the typewriter sound.

Both buffers are generated lazily by the existing Web Audio path. The app adds
no audio files, dependencies, requests, or downloads. One audio context is
shared, and the selected buffer is dispatched for printable keys, Backspace,
Enter, and Delete under the existing throttle.

If Web Audio is absent, blocked, or fails, typing continues normally. The app
does not display a disruptive error for an optional effect.

## Verification

Automated tests cover:

- preference parsing, including legacy `soft` migration and unknown values;
- the three selector options and accessible label;
- storing the selected canonical value;
- dispatching Typewriter and Soft tap through distinct synthesis paths;
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
- imported or downloadable audio samples;
- additional sound packs;
- changing the existing typing-key set or throttle.
