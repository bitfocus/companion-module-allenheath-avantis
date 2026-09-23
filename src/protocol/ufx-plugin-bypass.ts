export const UFX_PLUGIN_BYPASS_COUNT = 8

const UFX_FIRST_FAMILY = 0x0acb
const UFX_FAMILY_STEP = 0x07
const UFX_HANDLE_BASE = 0x4200
export type UfxPluginBypassUpdate = { kind: 'ufx-plugin'; unit: number; bypassed: boolean }

const registration = (family: number, handle: number, path: number, property: number): Buffer =>
	Buffer.from([
		0xf0,
		0x00,
		0x01,
		family >> 8,
		family & 0xff,
		0x00,
		0x03,
		0x00,
		0x06,
		0x00,
		0x0a,
		0x00,
		0x00,
		handle >> 8,
		handle & 0xff,
		path >> 8,
		path & 0xff,
		property >> 8,
		property & 0xff,
		0x00,
		0x01,
		0xf7,
	])

const request = (family: number, handle: number): Buffer =>
	Buffer.from([0xf0, 0x00, 0x01, family >> 8, family & 0xff, handle >> 8, handle & 0xff, 0x00, 0x08, 0x00, 0x00, 0xf7])

export function ufxPluginBypassTarget(unit: number): { family: number; handle: number } {
	if (!Number.isInteger(unit) || unit < 1 || unit > UFX_PLUGIN_BYPASS_COUNT)
		throw new RangeError('UFX unit must be 1-8')
	return { family: UFX_FIRST_FAMILY + (unit - 1) * UFX_FAMILY_STEP, handle: UFX_HANDLE_BASE + unit - 1 }
}

export function buildUfxPluginBypassSyncMessages(): Buffer[] {
	const messages: Buffer[] = []
	for (let unit = 1; unit <= UFX_PLUGIN_BYPASS_COUNT; unit++) {
		const { family, handle } = ufxPluginBypassTarget(unit)
		messages.push(registration(family, handle, 0x1000, 0x1016), request(family, handle))
	}
	return messages
}

export function buildUfxPluginBypassMessage(unit: number, bypassed: boolean): Buffer {
	const { family, handle } = ufxPluginBypassTarget(unit)
	return Buffer.from([
		0xf0,
		0x00,
		0x01,
		family >> 8,
		family & 0xff,
		handle >> 8,
		handle & 0xff,
		0x10,
		0x16,
		0x00,
		0x02,
		0x80,
		bypassed ? 0x10 : 0x00,
		0xf7,
	])
}

export function parseUfxPluginBypassFrame(frame: Buffer): UfxPluginBypassUpdate | undefined {
	if (
		frame.length < 13 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame[7] !== 0x10 ||
		frame.at(-1) !== 0xf7
	)
		return

	const handle = frame.readUInt16BE(3)
	const family = frame.readUInt16BE(5)
	if (frame.length === 14 && frame[8] === 0x00 && frame.readUInt16BE(9) === 2 && frame[11] === 0x80) {
		const unit = handle - UFX_HANDLE_BASE + 1
		if (unit >= 1 && unit <= UFX_PLUGIN_BYPASS_COUNT && family === ufxPluginBypassTarget(unit).family) {
			if (frame[12] === 0 || frame[12] === 0x10) return { kind: 'ufx-plugin', unit, bypassed: frame[12] === 0x10 }
		}
	}
	return
}
