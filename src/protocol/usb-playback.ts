export type UsbPlaybackState = 'Playing' | 'Paused' | 'Stopped'

const DEFAULT_FAMILY = 0x113f
const HANDLE = 0x02d0

export function buildUsbPlaybackSyncMessages(family = DEFAULT_FAMILY): Buffer[] {
	if (!Number.isInteger(family) || family < 0 || family > 0xffff)
		throw new RangeError('Playback Manager family is invalid')
	return [
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
			0x02,
			0xd0,
			0x10,
			0x02,
			0x10,
			0x02,
			0x00,
			0x01,
			0xf7,
		]),
		Buffer.from([0xf0, 0x00, 0x01, family >> 8, family & 0xff, 0x02, 0xd0, 0x00, 0x08, 0x00, 0x00, 0xf7]),
	]
}

export function parseUsbPlaybackFrame(
	frame: Buffer,
	family = DEFAULT_FAMILY,
): { state: UsbPlaybackState; filename?: string } | undefined {
	if (
		frame.length < 20 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame.readUInt16BE(3) !== HANDLE ||
		frame.readUInt16BE(5) !== family ||
		frame.readUInt16BE(7) !== 0x1002 ||
		frame.at(-1) !== 0xf7
	)
		return

	const payloadLength = frame.readUInt16BE(9)
	if (payloadLength < 5 || frame.length !== payloadLength + 12) return
	const stateValue = frame[15]
	const state: UsbPlaybackState | undefined =
		stateValue === 0 ? 'Playing' : stateValue === 1 ? 'Paused' : stateValue === 2 ? 'Stopped' : undefined
	if (!state) return

	let filename: string | undefined
	if (payloadLength > 7) {
		let end = 18
		while (end < frame.length - 1 && frame[end] !== 0) end++
		const parsed = frame.subarray(18, end).toString('utf8').trim()
		if (parsed) filename = parsed
	}
	return { state, filename }
}

export function buildUsbPlaybackTransportMessage(
	command: 'resume' | 'pause' | 'stop',
	family = DEFAULT_FAMILY,
): Buffer {
	if (!Number.isInteger(family) || family < 0 || family > 0xffff)
		throw new RangeError('Playback Manager family is invalid')
	const value = command === 'resume' ? 0 : command === 'pause' ? 1 : 2
	return Buffer.from([
		0xf0,
		0x00,
		0x01,
		family >> 8,
		family & 0xff,
		0x02,
		0xd0,
		0x10,
		0x09,
		0x00,
		0x02,
		0x00,
		value,
		0xf7,
	])
}

export function buildUsbPlaybackStartMessage(filename: string, family = DEFAULT_FAMILY): Buffer {
	if (!Number.isInteger(family) || family < 0 || family > 0xffff)
		throw new RangeError('Playback Manager family is invalid')
	const encoded = Buffer.from(filename.trim(), 'utf8')
	if (encoded.length === 0 || encoded.length > 255 || encoded.includes(0)) {
		throw new Error('A valid selected USB recording filename is required to start playback')
	}
	const payloadLength = encoded.length + 4
	return Buffer.concat([
		Buffer.from([
			0xf0,
			0x00,
			0x01,
			family >> 8,
			family & 0xff,
			0x02,
			0xd0,
			0x10,
			0x08,
			payloadLength >> 8,
			payloadLength & 0xff,
			0x00,
			0x01,
		]),
		encoded,
		Buffer.from([0x00, 0x00, 0xf7]),
	])
}
