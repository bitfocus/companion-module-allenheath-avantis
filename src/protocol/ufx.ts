import type { DropdownChoice } from '@companion-module/base'

export const UFX_SEND_COUNT = 8
export const UFX_RETURN_COUNT = 8
export const UFX_SEND_FIRST_CHANNEL = 0x56
export const UFX_RETURN_FIRST_CHANNEL = 0x5e

export const UFX_GLOBAL_KEY_CHOICES: DropdownChoice[] = [
	{ label: 'C', id: 0 },
	{ label: 'C#/Db', id: 1 },
	{ label: 'D', id: 2 },
	{ label: 'D#/Eb', id: 3 },
	{ label: 'E', id: 4 },
	{ label: 'F', id: 5 },
	{ label: 'F#/Gb', id: 6 },
	{ label: 'G', id: 7 },
	{ label: 'G#/Ab', id: 8 },
	{ label: 'A', id: 9 },
	{ label: 'A#/Bb', id: 10 },
	{ label: 'B', id: 11 },
]

export const UFX_GLOBAL_SCALE_CHOICES: DropdownChoice[] = [
	{ label: 'Major', id: 0 },
	{ label: 'Minor', id: 1 },
	{ label: 'Chromatic', id: 2 },
]

export type UfxGlobalStateUpdate = { type: 'key'; value: number } | { type: 'scale'; value: number }

export function parseUfxGlobalControlChange(controller: number, value: number): UfxGlobalStateUpdate | undefined {
	if (controller === 0x0c && value >= 0 && value <= 0x0b) return { type: 'key', value }
	if (controller === 0x0d && value >= 0 && value <= 0x02) return { type: 'scale', value }
	return undefined
}

function assertSevenBitValue(value: number, label: string): void {
	if (!Number.isInteger(value) || value < 0 || value > 0x7f) {
		throw new RangeError(`${label} must be an integer from 0 to 127`)
	}
}

export function buildUfxGlobalKeyMessage(key: number, midiBaseChannel: number): Buffer {
	if (!Number.isInteger(key) || key < 0 || key > 0x0b) {
		throw new RangeError('UFX global key must be an integer from 0 to 11')
	}
	return buildControlChangeMessage(midiBaseChannel, 0x0c, key)
}

export function buildUfxGlobalScaleMessage(scale: number, midiBaseChannel: number): Buffer {
	if (!Number.isInteger(scale) || scale < 0 || scale > 2) {
		throw new RangeError('UFX global scale must be 0 (major), 1 (minor), or 2 (chromatic)')
	}
	return buildControlChangeMessage(midiBaseChannel, 0x0d, scale)
}

export function buildControlChangeMessage(midiChannel: number, controlNumber: number, value: number): Buffer {
	if (!Number.isInteger(midiChannel) || midiChannel < 1 || midiChannel > 16) {
		throw new RangeError('MIDI channel must be an integer from 1 to 16')
	}
	assertSevenBitValue(controlNumber, 'Control number')
	assertSevenBitValue(value, 'Control value')
	return Buffer.from([0xb0 + midiChannel - 1, controlNumber, value])
}
