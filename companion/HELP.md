# Allen & Heath Avantis module

Controls the Allen & Heath Avantis mixer.

## Functions:

- Faders: Input, main mix, mono/stereo groups, mono/stereo auxes, mono/stereo matrices, mono/stereo FX sends, FX returns, and DCA
- Relative fader and send moves, for rotary controls such as Stream Deck+ dials
- Mutes: Input, main mix, mono/stereo groups, mono/stereo auxes, mono/stereo matrices, mono/stereo FX sends, FX returns, DCA, and mute groups
- Send levels: Input to aux, FX send/return, matrix, and main mix destinations
- Assignments: DCA, mute group, and input to main mix
- Channel controls: Name and color
- Scene recall

## Setup

- Enter the target IP address of your Avantis console.
- Enter the MIDI base channel configured on the console under Utility > Control > MIDI. The console's factory default is 12; this module's field defaults to 1, so check it matches or nothing will respond.

## Dials and other rotary controls

Every fader and send has an **Adjust ... (relative)** action alongside the absolute
"set to level" one. Put the same action on a button's Rotate Left and Rotate Right
with opposite `Adjust by (dB)` values — `-1` and `+1` — and the dial trims the level.

On a Stream Deck+, turn on **Enable Rotary Actions** in the button's options first,
otherwise the Rotate Left and Rotate Right action groups are not shown.

The **Dials (Stream Deck+)** preset section has these already built for input faders,
DCAs, mains, aux masters, and channel-to-aux sends. Drag one onto a dial and change
the channel to suit.

### Options on the relative actions

- **Adjust by (dB)** — how far one detent moves the level.
- **Lower limit / Upper limit** — the level is never driven outside this window.
  Narrowing it (say -20 dB to +10 dB) makes a dial feel much better, and stops a
  fader being wound all the way to -inf by accident.
- **If the current level is unknown** — see below.
- **Accelerate on fast turns** — spinning quickly moves further per detent. Off by
  default, because predictable steps usually matter more on a live desk.

### Where relative moves start from

A relative move has to know where the level is now.

For **faders**, the console reports level changes, so the module learns the current
value as soon as a fader is moved on the surface, set from Companion, or reported
after a scene recall. Until that happens the level is unknown.

For **sends**, the Avantis protocol has no way to read a send level back. The module
knows a send level only if Companion set it, or if the console reports one.

When the level is unknown, the relative actions **do nothing** by default and log a
line saying so. That is deliberate: assuming a level would mean the first turn of the
dial jumps a live fader from wherever it actually is to wherever the module guessed.

Two ways to deal with it:

- **Press to grab.** Put an absolute "set to level" action on the button's press. The
  shipped dial presets do this — pressing a fader dial sets it to 0 dB, pressing a
  send dial sets it to -20 dB — after which turning works from that known point.
- **Declare a starting point.** Set **If the current level is unknown** to a level.
  The first turn then moves relative to that assumed value.

### Showing the level on the button

Fader levels are exposed as variables, e.g. `$(avantis:fader_input_12)` or
`$(avantis:fader_dca_1)`, and follow the console. Send levels appear as
`$(avantis:send_in12_to_mono_aux_3)` the first time that send is used — there are too
many source and destination combinations to declare them all up front.

Substitute your connection's own label for `avantis` above; the shipped dial presets
already do this for you, using whatever the connection is actually called.

> Current version: 2.0.0
