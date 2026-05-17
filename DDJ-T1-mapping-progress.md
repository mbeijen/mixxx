# Pioneer DDJ-T1 Mixxx mapping — progress log

Last updated: 2026-05-16

## Setup context

- Controller: Pioneer DDJ-T1 (USB ID `08e4:015b`)
- Mixxx: 2.5.0, installed via apt
- User config dir: `~/.mixxx/`
- Audio API: ALSA, sample rate 44100 Hz, 4-channel device

## Files created

In the repo clone (`~/mixxx/res/controllers/`) and copied to `~/.mixxx/controllers/`:

- `Pioneer-DDJ-T1.midi.xml` — control + (empty) outputs definitions
- `Pioneer-DDJ-T1-scripts.js` — jog wheel + shift handling

## Audio configuration (Mixxx → Preferences → Sound Hardware → Output)

| Output     | Device         | Channels |
|------------|----------------|----------|
| Master     | PIONEER DDJ-T1 | 1-2      |
| Headphones | PIONEER DDJ-T1 | 3-4      |

Stored in `~/.mixxx/soundconfig.xml`.

## Physical-to-logical channel mapping

The mixer columns are labeled C / A / B / D from left to right (crossfader sits
between A and B). In the XML mapping these route to:

| Physical column | Mixxx group |
|---|---|
| Ch1 (leftmost, C) | `[Channel3]` |
| Ch2 (A)           | `[Channel1]` |
| Ch3 (B)           | `[Channel2]` |
| Ch4 (rightmost, D)| `[Channel4]` |

## MIDI message reference (captured 2026-05-16)

### Per-deck channels (ch0 = deck A, ch1 = deck B)

| Function           | Status   | Note/CC | Notes |
|--------------------|----------|---------|-------|
| Play/Pause         | 0x90/91  | 0x0B    | toggle |
| Cue                | 0x90/91  | 0x0C    | `cue_default` |
| Shift              | 0x90/91  | 0x1A    | script binding for modifier state |
| Key Lock           | 0x90/91  | 0x56    | direct toggle |
| Filter knob turn   | 0xB0/B1  | 0x04    | `[QuickEffectRack1_[ChannelN]] super1` |
| Filter knob push   | 0x90/91  | 0x45    | toggles filter enabled |
| Pitch fader        | 0xB0/B1  | 0x00 + 0x20 | 14-bit (MSB+LSB); we use only MSB for now |
| Jog touch (top)    | 0x90/91  | 0x36    | scratch enable/disable |
| Jog rotation (top) | 0xB0/B1  | 0x22    | signed 7-bit, scratch tick |
| Jog rotation (side)| 0xB0/B1  | 0x21    | signed 7-bit, pitch bend |

Jog wheel encoding: LSB carries the signed delta (1..63 = +1..+63 forward,
127..65 = -1..-63 backward). MSB just carries the sign bit and is ignored by
the current script.

### Global mixer channel (ch6 → status 0x96 for notes, 0xB6 for CCs)

| Function           | Status | Note/CC | Notes |
|--------------------|--------|---------|-------|
| Crossfader         | 0xB6   | 0x1F    | `[Master] crossfader` |
| Browse rotate      | 0xB6   | 0x40    | `<SelectKnob/>` relative encoder |
| Browse push        | 0x96   | 0x41    | `[Library] MoveFocusForward` |
| LOAD A             | 0x96   | 0x46    | `[Channel1] LoadSelectedTrack` |
| LOAD B             | 0x96   | 0x47    | `[Channel2] LoadSelectedTrack` |
| Headphone VOLUME   | 0xB6   | 0x02    | `[Master] headGain` |
| Headphone MIX      | 0xB6   | 0x01    | `[Master] headMix` |
| Headphone CUE A/B/C/D | 0x96 | 0x54/55/56/57 | PFL toggles, by deck letter |

Volume faders (by deck letter):
| Deck | Status | CC   |
|------|--------|------|
| A    | 0xB6   | 0x13 |
| B    | 0xB6   | 0x15 |
| C    | 0xB6   | 0x17 |
| D    | 0xB6   | 0x19 |

EQ + trim columns (by deck letter, stride +1):
| Knob | A   | B   | C   | D (predicted) |
|------|-----|-----|-----|---------------|
| TRIM | 03  | 04  | 05  | 06            |
| HI   | 07  | 08  | 09  | 0A            |
| MID  | 0B  | 0C  | 0D  | 0E            |
| LOW  | 0F  | 10  | 11  | 12            |

All EQ/trim CCs are on status `0xB6`. Deck D was not physically tested —
predicted by extrapolation from the +1 stride pattern.

## What works (confirmed)

- Play / Cue on both decks
- All 4 volume faders
- EQ and trim on tested channels (A, B, C confirmed; D predicted but not
  hands-on tested)
- Crossfader
- Filter knobs (turn + push enable) for A and B
- Pitch faders for A and B
- Jog wheels: scratch on top touch + rotate, pitch bend on side
- Headphone Cue (PFL) buttons for all 4 channels
- Headphone Volume and Mix knobs
- Browse rotation, push, and Load to deck A / B
- Audio: Master out on RCA, headphone out on the front jack

## Known gaps / TODO

1. **No LEDs.** See `DDJ-T1-LED-findings.md`. LEDs require an HID mapping and
   that is not currently implemented.
2. **Pitch fader is 7-bit, not 14-bit.** Functional but coarse near small
   tempo changes; upgrade by combining cc0 (MSB) + cc32 (LSB) in script.
3. **Pitch fader inversion.** Currently uses `<Invert/>`. If the direction
   feels wrong (turning up = slowing down), remove the `<Invert/>` option for
   the two `rate` controls.
4. **Deck D EQ/trim untested.** Predicted CCs `0x06/0x0A/0x0E/0x12/0x19`.
   Verify by physically twisting deck D's knobs and watching `aseqdump` (or
   the Mixxx EQ widgets).
5. **Not mapped yet** (left for later):
   - Hot cue pads
   - Loop in / out / reloop, auto-loop
   - Effects section (FX1, FX2, beat selector)
   - 4-deck switching buttons (if any — DDJ-T1 has two jogs but the mixer
     supports 4 channels; deck-switch logic for deck C/D control would be
     useful)
   - Sampler pads (if present)

## How to capture more MIDI for the unmapped controls

1. Close Mixxx (or disable the controller in Preferences → Controllers).
2. Run a clean capture into a file (line-buffered to avoid NUL garbage):
   ```sh
   stdbuf -oL aseqdump -p 'PIONEER DDJ-T1' > /tmp/ddj_t1_midi.log &
   ```
3. Press / move one control at a time with ~2-second pauses.
4. Inspect with:
   ```sh
   grep "Control change\|Note " /tmp/ddj_t1_midi.log \
     | sed -E 's/.* ([0-9]+), (note|controller) ([0-9]+).*/ch\1 \2\3/' \
     | awk '!seen[$0]++'
   ```
5. Add the new bindings to `Pioneer-DDJ-T1.midi.xml`, copy to
   `~/.mixxx/controllers/`, restart Mixxx (or toggle the controller off/on in
   Preferences).

## Gotchas we hit (don't waste time on these again)

- **`aseqdump` corrupts its log file under high traffic** when stdout is
  redirected directly. Always wrap in `stdbuf -oL` to force line buffering,
  otherwise the file fills with NUL bytes and grep returns nothing useful.
- **Channel volume fader Ch2 (deck A) jitters at rest** between two adjacent
  values, producing a constant CC stream we initially mistook for an "idle
  ping". It's just an unstable analog reading on that physical fader.
- **`<Switch/>` vs `<Normal/>` for buttons:** for toggle-style controls like
  `play`, `pfl`, `keylock`, `enabled`, use `<Normal/>`. `<Switch/>` would
  cause press-to-set, release-to-unset behavior (i.e. play only while held).
