# Allen & Heath Avantis

Control an Allen & Heath Avantis running firmware 2.0 or newer from Bitfocus Companion. The module combines documented MIDI/TCP control with optional console synchronization for live state, automatic configuration discovery, and Avantis 2.0/RackUltraFX features.

This is an independent community module. It is not endorsed or supported by Allen & Heath, and Allen & Heath cannot provide support for it. AH-Net is proprietary intellectual property of Allen & Heath, is intended for internal use, and may change or be removed in future firmware. A future move to secure TLS ports may also make the optional synchronization features unavailable. Review the [Allen & Heath General EULA](https://www.allen-heath.com/legal/general-eula/) and test module and firmware updates before production use.

Allen & Heath confirms that MIDI connections are not aware of console user profiles or restrictions. Supported AH-Net clients such as MixPad and Director do respect user profiles, but this community module does not implement their supported user authentication. Treat Companion and console-network access as privileged control access: use a trusted network, restrict access to Companion, and do not assume a function blocked on the console surface is also blocked from this module.

## Setup

1. Add an **Allen & Heath Avantis** connection in Companion.
2. Enter the console IP address.
3. Enter the MIDI Base Channel configured under **Utility > Control > MIDI**. It cannot exceed 12.
4. Enable **Console synchronization** only if its additional AH-Net features are needed and the limitations above are acceptable.
5. Save the connection and confirm that its status is **OK**.

Normal commands use the documented Avantis MIDI/TCP service on port 51325. Console synchronization uses the AH-Net service on port 51321. Use one module connection for each physical console.

## Main features

- Mute, fader, relative-fader, and timed-fade control for inputs, mains, groups, auxes, matrices, FX, DCAs, and RackUltraFX strips
- Input assignment to Main, DCA, and Mute Groups
- Input send levels to supported Aux, FX Send, and Matrix destinations
- Scene recall by number, variable/expression, or synchronized scene name
- Delayed scene sequences that run immediately when online or replace the pending queue while offline
- Strip names for inputs, configured buses, mains, matrices, FX strips, DCAs, and RackUltraFX strips; input colors; and Companion variable/expression support for names
- Virtual Soundcheck mode, Global Key, Global Scale, and Global Tempo control and feedback
- Native USB recorder/playback controls, separate from MMC transport
- RackUltraFX rack and plugin bypass control, including individual and bypass-all presets
- Validated raw MIDI action for documented or user-mapped commands
- Presets and feedbacks for common workflows

## Console synchronization

Console synchronization is optional. It automatically discovers dPack capacity, RackUltraFX availability, configured bus counts, Main mode, I/O Port presence, and supported SLink status. It also retrieves initial state and listens for supported changes, including:

- Fader levels, names, and colors for inputs and configured console strips
- Current and last recalled scene information
- Mute Group state
- Virtual Soundcheck, Global Key, Global Scale, and Global Tempo
- Firmware, master-strip lock, and USB playback/recorder state
- RackUltraFX and UFX plugin bypass state

The console closes lightweight AH-Net sessions after roughly 30 seconds unless high-volume metering is active. To avoid unnecessary meter traffic, the module renews its synchronization session every 24 seconds while retaining cached variables. Normal MIDI/TCP commands continue independently.

Scene-name retrieval is optional. Choose the highest scene number to load, up to 500. Use **Console Sync: Refresh Scene Names** after renaming scenes. The scene-name cache and pending scene queue do not survive a Companion/module restart.

## Scenes and queued recall

**Recall or Queue Sequence** accepts an unlimited comma-separated list such as `12, 25, 40`. When connected, recalls begin immediately with the configured safe interval. When disconnected, the latest sequence waits for the next connection. Running it again replaces—not appends to—the pending sequence. **Clear Queue** cancels it.

Name-based recall requires Console synchronization and scene-name retrieval. Matching ignores capitalization and surrounding spaces. Missing or ambiguous names are rejected; the optional skip-invalid setting can continue a queued name sequence using only valid matches. Number-based queues are recommended for the most critical production workflows.

## Faders

Set a fade time of `0` for an immediate move. Timed and relative moves require a known synchronized starting level. If the starting value is unknown, the module refuses the move rather than guessing with live audio.

**Fade updates per second (5–40)** controls timed-fade resolution. The default of 20 is recommended. Higher values are smoother but send more commands only while a fade is running.

## Connection variables

- `online`: true only while the MIDI/TCP command socket can receive commands
- `connection_status`: Connecting, Connected, Disconnected, or Connection failure
- `command_connection_state`: Offline, Connecting, Ready, Recovering, or Degraded command-path lifecycle state
- `synchronization_connection_state`: Disabled, Offline, Connecting, Synchronizing, Ready, Recovering, or Degraded AH-Net lifecycle state
- `fader_sync_status`: status of the separate optional synchronization session

The module reconnects automatically after a command-path or network interruption. A console may be ready for MIDI/TCP commands even while optional state synchronization is recovering. Do not treat synchronized values as current until `synchronization_connection_state` is `Ready` and the relevant value is no longer `Unknown`.

## RackUltraFX and transports

RackUltraFX availability is discovered automatically when Console synchronization is enabled. Manual configuration remains available as a fallback. **Set Unit Parameter** uses the independently assigned UFX MIDI channel and user-configured CC number/value.

USB Play/Record controls use Avantis-native endpoints and are separate from MIDI Machine Control. MMC Stop, Play, Fast Forward, Rewind, Record, and Pause remain available for external transport workflows.

## Legacy compatibility and limitations

Saved actions from module 1.x retain their action and option IDs. The upgrade also repairs the previously nonfunctional Input-to-DCA and Input-to-Mute-Group assignment actions.

Two inherited 1.x actions are retained only so old configurations load cleanly:

- **Legacy (Unsupported): Set Input Send to FX Return** — use a Mono or Stereo FX Send instead.
- **Legacy (Unsupported): Set Input Send to Main Mix** — use Input: Assign to Main Mix and the input fader.

These operations are not defined by the Allen & Heath protocol and intentionally send no command.

## Troubleshooting

- Confirm the console IP address, MIDI Base Channel, and reachability of ports 51325 and 51321.
- Check `online` before using command-dependent triggers; check `fader_sync_status` separately for synchronized state.
- If a timed or relative fader move is refused, enable Console synchronization or first establish the fader's current value.
- If scene-name recall fails, refresh the configured scene-name range and check for missing or duplicate names.
- Review the Companion connection log for rejected, unsupported, or unavailable commands.

Test critical scene, routing, mute, Virtual Soundcheck, and fade workflows against the intended console and show file before production deployment.
