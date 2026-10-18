import { UFX_RETURN_COUNT, UFX_RETURN_FIRST_CHANNEL, UFX_SEND_COUNT, UFX_SEND_FIRST_CHANNEL } from './ufx.js'

// Avantis MIDI fader channels (relative MIDI offset → channel number), matching
// the action choice IDs and the AH-Net fader targets in console-fader-sync.ts.
const STEREO_BUS_FIRST_CHANNEL = 0x40
const STEREO_FX_SEND_FIRST_CHANNEL = 0x10
const FX_RETURN_FIRST_CHANNEL = 0x20
const MAIN_FIRST_CHANNEL = 0x30
const DCA_FIRST_CHANNEL = 0x36

const STEREO_FX_SEND_COUNT = 12
const FX_RETURN_COUNT = 12
const MAIN_COUNT = 3
const DCA_COUNT = 16
const MONO_FX_SEND_COUNT = 12

const BUS_PREFIXES: Record<number, string> = { 1: 'group', 2: 'aux', 3: 'matrix' }

/**
 * Returns the fader level variable ID for a MIDI fader channel, or undefined
 * when the channel has no fader variable. `relativeOffset` is the MIDI channel
 * offset from the configured base (0 inputs, 1 groups, 2 auxes, 3 matrices,
 * 4 FX/mains/DCAs/RackUltraFX).
 */
export function faderVariableId(relativeOffset: number, channel: number): string | undefined {
	if (!Number.isInteger(channel) || channel < 0 || channel > 0x7f) return undefined

	const within = (first: number, count: number) => channel >= first && channel < first + count

	if (relativeOffset === 0) return `fader_input_${channel + 1}`

	const bus = BUS_PREFIXES[relativeOffset]
	if (bus) {
		if (channel >= STEREO_BUS_FIRST_CHANNEL) return `fader_stereo_${bus}_${channel - STEREO_BUS_FIRST_CHANNEL + 1}`
		return `fader_mono_${bus}_${channel + 1}`
	}

	if (relativeOffset !== 4) return undefined
	if (within(0, MONO_FX_SEND_COUNT)) return `fader_mono_fx_send_${channel + 1}`
	if (within(STEREO_FX_SEND_FIRST_CHANNEL, STEREO_FX_SEND_COUNT))
		return `fader_stereo_fx_send_${channel - STEREO_FX_SEND_FIRST_CHANNEL + 1}`
	if (within(FX_RETURN_FIRST_CHANNEL, FX_RETURN_COUNT))
		return `fader_fx_return_${channel - FX_RETURN_FIRST_CHANNEL + 1}`
	if (within(MAIN_FIRST_CHANNEL, MAIN_COUNT)) return `fader_main_${channel - MAIN_FIRST_CHANNEL + 1}`
	if (within(DCA_FIRST_CHANNEL, DCA_COUNT)) return `fader_dca_${channel - DCA_FIRST_CHANNEL + 1}`
	if (within(UFX_SEND_FIRST_CHANNEL, UFX_SEND_COUNT)) return `fader_ufx_send_${channel - UFX_SEND_FIRST_CHANNEL + 1}`
	if (within(UFX_RETURN_FIRST_CHANNEL, UFX_RETURN_COUNT))
		return `fader_ufx_return_${channel - UFX_RETURN_FIRST_CHANNEL + 1}`
	return undefined
}
