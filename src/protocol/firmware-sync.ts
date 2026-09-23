export type FirmwareInfo = { version: string; revision: string }

const HANDLE = 0x0008

export function parseSurfaceIdentificationFrame(frame: Buffer): number | undefined {
	if (
		frame.length !== 14 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame.readUInt16BE(3) !== HANDLE ||
		frame.readUInt16BE(5) !== 0x0000 ||
		frame.readUInt16BE(7) !== 0x0002 ||
		frame.readUInt16BE(9) !== 0x0002 ||
		frame.at(-1) !== 0xf7
	)
		return

	return frame.readUInt16BE(11)
}

export function buildFirmwareSyncMessages(family: number): Buffer[] {
	if (!Number.isInteger(family) || family < 0 || family > 0xffff) throw new RangeError('AH-Net family is invalid')
	const message = Buffer.from('f000010000000801020000f7', 'hex')
	message.writeUInt16BE(family, 3)
	return [message]
}

export function parseFirmwareFrame(frame: Buffer, expectedFamily?: number): FirmwareInfo | undefined {
	if (
		frame.length < 13 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame.readUInt16BE(3) !== HANDLE ||
		frame.readUInt16BE(7) !== 0x0002 ||
		frame.at(-1) !== 0xf7
	)
		return
	if (expectedFamily !== undefined && frame.readUInt16BE(5) !== expectedFamily) return

	const payloadLength = frame.readUInt16BE(9)
	if (frame.length !== payloadLength + 12) return
	const text = frame
		.subarray(11, frame.length - 1)
		.toString('utf8')
		.replaceAll('\0', '')
		.trim()
	const match = text.match(/V([^\s]+)\s*-\s*Rev\.\s*([^\s]+)/i)
	if (!match) return
	return { version: match[1], revision: match[2] }
}
