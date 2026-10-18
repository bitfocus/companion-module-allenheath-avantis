export type VirtualSoundcheckMode = 0 | 1 | 2
export type VirtualSoundcheckModeName = 'Unknown' | 'Inactive' | 'Record Send' | 'Virtual Soundcheck'

export const VIRTUAL_SOUNDCHECK_MODE_CHOICES = [
	{ id: 0, label: 'Inactive' },
	{ id: 1, label: 'Record Send' },
	{ id: 2, label: 'Virtual Soundcheck' },
] as const

export function virtualSoundcheckModeName(mode: VirtualSoundcheckMode): VirtualSoundcheckModeName {
	return VIRTUAL_SOUNDCHECK_MODE_CHOICES[mode].label
}

export function buildVirtualSoundcheckModeMessage(mode: VirtualSoundcheckMode): Buffer {
	if (![0, 1, 2].includes(mode)) throw new RangeError('Virtual Soundcheck mode must be 0, 1, or 2')
	return Buffer.from([0xf0, 0x00, 0x01, 0x00, 0x3a, 0x18, 0xe5, 0x10, 0x66, 0x00, 0x01, mode, 0xf7])
}

export function buildVirtualSoundcheckRegistrationMessage(): Buffer {
	return Buffer.from('f00001003a00030006000a00000ccb1000106600fff7', 'hex')
}

export function buildVirtualSoundcheckValueRequest(): Buffer {
	return Buffer.from('f00001003a0ccb00080000f7', 'hex')
}

export function parseVirtualSoundcheckModeFrame(frame: Buffer): VirtualSoundcheckMode | undefined {
	if (
		frame.length === 13 &&
		frame[0] === 0xf0 &&
		frame[1] === 0x00 &&
		frame[2] >= 0x01 &&
		frame[2] <= 0x05 &&
		((frame[3] === 0x18 && frame[4] === 0xe5) || (frame[3] === 0x0c && frame[4] === 0xcb)) &&
		frame[5] === 0x00 &&
		frame[6] === 0x3a &&
		frame[7] === 0x10 &&
		frame[8] === 0x00 &&
		frame[9] === 0x00 &&
		frame[10] === 0x01 &&
		(frame[11] === 0 || frame[11] === 1 || frame[11] === 2) &&
		frame[12] === 0xf7
	) {
		return frame[11]
	}
	return undefined
}
