# DDJ-T1 LED feedback — findings

**TL;DR:** The DDJ-T1's button LEDs are not controlled via MIDI. They're driven
through the controller's HID interface, which Mixxx's MIDI mapping cannot
address. Getting them working is a separate, much larger project.

## What we tested

Sent the following MIDI messages to the DDJ-T1 while Mixxx was closed (so the
device was fully released):

| Message | Description | LED result |
|---|---|---|
| `90 0C 7F` | Note On, ch0, note 0x0C (deck A CUE), velocity 127 | nothing |
| `90 0C 40` | Note On, ch0, note 0x0C, velocity 64 | nothing |
| `91 0C 7F` | Note On, ch1, note 0x0C (deck B CUE), velocity 127 | nothing |
| `94 0C 7F` | Note On, ch4, note 0x0C | nothing |
| `99 0C 7F` | Note On, ch9 (a common LED channel), note 0x0C | nothing |

No LED lit up under any of these.

## Why MIDI won't work

1. The DDJ-T1 exposes both a USB MIDI interface **and** a USB HID interface
   (`/dev/hidraw4`, vendor `08E4` = Pioneer, product `015B` = DDJ-T1).
2. Mixxx's repo has mappings for the closely related **DDJ-SB** and **DDJ-SB2**.
   Both have `<outputs/>` (empty) — i.e. no LED feedback. This confirms a
   Pioneer family pattern: input over MIDI, LEDs over HID.
3. The DDJ-T1 was originally bundled with Traktor LE. Traktor talks to the
   controller's HID interface for LEDs.

## Path forward (if we ever pursue LEDs)

This is a multi-evening project, with no documentation publicly available:

1. **Capture HID traffic from Traktor** to reverse the LED report format. Two
   approaches:
   - Run Traktor LE (Win/Mac only) in a VM and use `usbmon` on the Linux host
     to capture USB traffic to interface `:1.5` while clicking around in
     Traktor; correlate report bytes with LED states.
   - Find someone who's already done the reverse engineering — search GitHub
     for "ddj-t1 hid", "ddj-t1 led", and any Reddit / mixxx forum threads
     mentioning HID for this controller.
2. **Write a Mixxx HID mapping** for the DDJ-T1 alongside the MIDI mapping.
   - The HID mapping uses a different XML schema (`MixxxHIDPreset`) and a
     companion `*.hid.xml` file with byte-offset packet definitions.
   - See `Pioneer CDJ HID.hid.xml` + `Pioneer-CDJ-HID.js` in
     `res/controllers/` for an example of a Pioneer HID mapping.
3. **Run MIDI + HID side by side** for the same device. Mixxx supports this
   but the two mappings need to coexist without fighting over the device.

## What you still get with the current mapping

- Tactile button click feedback (the buttons themselves)
- Mixxx UI state on screen (deck play/cue/PFL indicators in the main window)
- Everything else (controls work fine, audio works fine)

LEDs are nice-to-have, not essential.
