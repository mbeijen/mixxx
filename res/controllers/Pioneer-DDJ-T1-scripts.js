// Pioneer-DDJ-T1-scripts.js
// Mixxx controller mapping for the Pioneer DDJ-T1.
//
// Scope: transport, mixer, EQ, filter, pitch faders, jog wheels
// (scratch + pitch bend), headphone cue, browse, load, hot cues,
// loops, autoloop, sync.
//
// MIDI channel convention used by the DDJ-T1:
//   ch0 (status 0x90/0xB0) = deck A
//   ch1 (status 0x91/0xB1) = deck B
//   ch2/ch3                = decks C/D when deck-switch is active
//   ch6 (status 0x96/0xB6) = global mixer / library
//
// SHIFT is a hardware-internal modifier — it sends no MIDI on its own but
// changes which note other buttons emit (e.g. CUE -> 0x0C, SHIFT+CUE -> 0x48).
// Shift-variants are bound directly to their distinct notes in the XML.
//
// Jog wheel rotation encoding (relative, signed 7-bit):
//   1..63   = forward ticks
//   65..127 = backward ticks (127 = -1, 126 = -2, ...)

var PioneerDDJT1 = {};

// Scratch parameters
PioneerDDJT1.scratchAlpha = 1.0 / 8;
PioneerDDJT1.scratchBeta = PioneerDDJT1.scratchAlpha / 32;
PioneerDDJT1.scratchIntervalsPerRev = 720;
PioneerDDJT1.scratchRpm = 33 + 1 / 3;

// Pitch-bend scaling when not scratching (top wheel) and for the side ring
PioneerDDJT1.jogBendScale = 1.0;
PioneerDDJT1.jogSideScale = 0.4;

PioneerDDJT1.init = function() {};

PioneerDDJT1.shutdown = function() {
    // Make sure scratching is disabled when Mixxx exits.
    for (var deck = 1; deck <= 2; deck++) {
        if (engine.isScratching(deck)) {
            engine.scratchDisable(deck);
        }
    }
};

// Convert a 7-bit MIDI value into a signed tick delta.
PioneerDDJT1.signed7 = function(value) {
    return value < 64 ? value : value - 128;
};

// channel comes from the lower nibble of the MIDI status byte:
//   ch0 -> deck 1 (A), ch1 -> deck 2 (B).
PioneerDDJT1.deckFromChannel = function(channel) {
    return channel + 1;
};

PioneerDDJT1.jogTouch = function(channel, control, value) {
    var deck = PioneerDDJT1.deckFromChannel(channel);
    if (value > 0) {
        engine.scratchEnable(
            deck,
            PioneerDDJT1.scratchIntervalsPerRev,
            PioneerDDJT1.scratchRpm,
            PioneerDDJT1.scratchAlpha,
            PioneerDDJT1.scratchBeta
        );
    } else {
        engine.scratchDisable(deck);
    }
};

PioneerDDJT1.jogTop = function(channel, control, value, status, group) {
    var deck = PioneerDDJT1.deckFromChannel(channel);
    var delta = PioneerDDJT1.signed7(value);
    if (engine.isScratching(deck)) {
        engine.scratchTick(deck, delta);
    } else {
        engine.setValue(group, "jog", delta * PioneerDDJT1.jogBendScale);
    }
};

PioneerDDJT1.jogSide = function(channel, control, value, status, group) {
    var delta = PioneerDDJT1.signed7(value);
    engine.setValue(group, "jog", delta * PioneerDDJT1.jogSideScale);
};

// AUTO LOOP encoder: rotating doubles (value 1) or halves (value 127) the
// current beatloop_size, clamped to Mixxx's accepted range.
PioneerDDJT1.autoLoop = function(channel, control, value, status, group) {
    var current = engine.getParameter(group, "beatloop_size");
    var next = (value === 1) ? current * 2 : current / 2;
    if (next >= 0.03125 && next <= 512) {
        engine.setParameter(group, "beatloop_size", next);
    }
};
