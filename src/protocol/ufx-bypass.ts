export const UFX_BYPASS_COUNT = 8

const FIRST_MANAGER_FAMILY = 0x0acb
const MANAGER_FAMILY_STEP = 0x07
const FIRST_HANDLE = 0x1116
const HANDLE_STEP = 0x1b
const PROPERTY = 0x1016

export type UfxBypassUpdate = { unit: number; bypassed: boolean }

export function ufxBypassTarget(unit: number): { family: number; handle: number } {
	if (!Number.isInteger(unit) || unit < 1 || unit > UFX_BYPASS_COUNT) throw new RangeError('UFX unit must be 1-8')
	const index = unit - 1
	return { family: FIRST_MANAGER_FAMILY + index * MANAGER_FAMILY_STEP, handle: FIRST_HANDLE + index * HANDLE_STEP }
}

export function buildUfxBypassSyncMessages(): Buffer[] {
	const messages: Buffer[] = []
	for (let unit = 1; unit <= UFX_BYPASS_COUNT; unit++) {
		const { family, handle } = ufxBypassTarget(unit)
		messages.push(
			Buffer.from([
				0xf0,
				0x00,
				0x01,
				(family >> 8) & 0xff,
				family & 0xff,
				0x00,
				0x03,
				0x00,
				0x06,
				0x00,
				0x0a,
				0x00,
				0x00,
				(handle >> 8) & 0xff,
				handle & 0xff,
				0x10,
				0x00,
				(PROPERTY >> 8) & 0xff,
				PROPERTY & 0xff,
				0x00,
				0x01,
				0xf7,
			]),
			Buffer.from([
				0xf0,
				0x00,
				0x01,
				(family >> 8) & 0xff,
				family & 0xff,
				(handle >> 8) & 0xff,
				handle & 0xff,
				0x00,
				0x08,
				0x00,
				0x00,
				0xf7,
			]),
		)
	}
	return messages
}

export function buildUfxBypassMessage(unit: number, bypassed: boolean): Buffer {
	const { family, handle } = ufxBypassTarget(unit)
	return Buffer.from([
		0xf0,
		0x00,
		0x01,
		(family >> 8) & 0xff,
		family & 0xff,
		(handle >> 8) & 0xff,
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

export function parseUfxBypassFrame(frame: Buffer): UfxBypassUpdate | undefined {
	if (frame.length !== 14 || frame[0] !== 0xf0 || frame[1] !== 0x00 || frame[2] < 0x01 || frame[2] > 0x05) return
	if (
		frame[7] !== 0x10 ||
		frame[8] !== 0x00 ||
		frame[9] !== 0x00 ||
		frame[10] !== 0x02 ||
		frame[11] !== 0x80 ||
		frame[13] !== 0xf7
	)
		return
	if (frame[12] !== 0x00 && frame[12] !== 0x10) return
	const handle = (frame[3] << 8) | frame[4]
	const family = (frame[5] << 8) | frame[6]
	const handleIndex = (handle - FIRST_HANDLE) / HANDLE_STEP
	const familyIndex = (family - FIRST_MANAGER_FAMILY) / MANAGER_FAMILY_STEP
	if (
		!Number.isInteger(handleIndex) ||
		handleIndex !== familyIndex ||
		handleIndex < 0 ||
		handleIndex >= UFX_BYPASS_COUNT
	)
		return
	return { unit: handleIndex + 1, bypassed: frame[12] === 0x10 }
}
