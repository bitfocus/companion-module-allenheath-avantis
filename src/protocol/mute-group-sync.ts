export const MUTE_GROUP_COUNT = 8
const FIRST_HANDLE = 0x02c1
const FIRST_PROPERTY = 0x1028

export type MuteGroupUpdate = { group: number; muted: boolean }

export function buildMuteGroupSyncMessages(): Buffer[] {
	const messages: Buffer[] = []
	for (let index = 0; index < MUTE_GROUP_COUNT; index++) {
		const handle = FIRST_HANDLE + index
		const property = FIRST_PROPERTY + index
		messages.push(
			Buffer.from([
				0xf0,
				0x00,
				0x01,
				0x00,
				0x25,
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
				(property >> 8) & 0xff,
				property & 0xff,
				0x00,
				0xff,
				0xf7,
			]),
			Buffer.from([0xf0, 0x00, 0x01, 0x00, 0x25, (handle >> 8) & 0xff, handle & 0xff, 0x00, 0x08, 0x00, 0x00, 0xf7]),
		)
	}
	return messages
}

export function parseMuteGroupFrame(frame: Buffer): MuteGroupUpdate | undefined {
	if (
		frame.length !== 13 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame[5] !== 0x00 ||
		frame[6] !== 0x25 ||
		frame[7] !== 0x10 ||
		frame[8] !== 0x00 ||
		frame[9] !== 0x00 ||
		frame[10] !== 0x01 ||
		(frame[11] !== 0x00 && frame[11] !== 0x01) ||
		frame[12] !== 0xf7
	) {
		return undefined
	}
	const handle = (frame[3] << 8) | frame[4]
	const index = handle - FIRST_HANDLE
	return index >= 0 && index < MUTE_GROUP_COUNT ? { group: index + 1, muted: frame[11] === 1 } : undefined
}
