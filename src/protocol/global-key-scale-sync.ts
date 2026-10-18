export type GlobalKeyScaleUpdate = { kind: 'key' | 'scale'; value: number }

export const GLOBAL_KEY_REGISTRATION = Buffer.from('f00001003900030006000a0000111b100010000001f7', 'hex')
export const GLOBAL_KEY_REQUEST = Buffer.from('f000010039111b00080000f7', 'hex')
export const GLOBAL_SCALE_REGISTRATION = Buffer.from('f00001003900030006000a0000111c100010010001f7', 'hex')
export const GLOBAL_SCALE_REQUEST = Buffer.from('f000010039111c00080000f7', 'hex')

export function buildGlobalKeyScaleSyncMessages(): Buffer[] {
	return [GLOBAL_KEY_REGISTRATION, GLOBAL_KEY_REQUEST, GLOBAL_SCALE_REGISTRATION, GLOBAL_SCALE_REQUEST]
}

function buildGlobalKeyScaleSetter(handle: number, path: number, value: number): Buffer {
	return Buffer.from([
		0xf0,
		0x00,
		0x01,
		0x00,
		0x39,
		(handle >> 8) & 0xff,
		handle & 0xff,
		(path >> 8) & 0xff,
		path & 0xff,
		0x00,
		0x01,
		value,
		0xf7,
	])
}

export function buildGlobalKeySetterMessage(key: number): Buffer {
	if (!Number.isInteger(key) || key < 0 || key > 11) throw new RangeError('Global key must be an integer from 0 to 11')
	return buildGlobalKeyScaleSetter(0x0f6c, 0x1000, key)
}

export function buildGlobalScaleSetterMessage(scale: number): Buffer {
	if (!Number.isInteger(scale) || scale < 0 || scale > 2)
		throw new RangeError('Global scale must be 0 (Major), 1 (Minor), or 2 (Chromatic)')
	return buildGlobalKeyScaleSetter(0x0f6d, 0x1001, scale)
}

export function parseGlobalKeyScaleFrame(frame: Buffer): GlobalKeyScaleUpdate | undefined {
	if (
		frame.length !== 13 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame[12] !== 0xf7
	)
		return
	if (frame[3] !== 0x11 || frame[7] !== 0x10 || frame[10] !== 0x01) return
	const value = frame[11]
	if (value === undefined) return
	if (frame[4] === 0x1b && value <= 11) return { kind: 'key', value }
	if (frame[4] === 0x1c && value <= 2) return { kind: 'scale', value }
	return
}
