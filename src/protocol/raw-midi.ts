export const RAW_MIDI_MAX_BYTES = 1024

function channelMessageDataLength(status: number): number | undefined {
	switch (status & 0xf0) {
		case 0x80:
		case 0x90:
		case 0xa0:
		case 0xb0:
		case 0xe0:
			return 2
		case 0xc0:
		case 0xd0:
			return 1
		default:
			return undefined
	}
}

function systemMessageDataLength(status: number): number | undefined {
	switch (status) {
		case 0xf1:
		case 0xf3:
			return 1
		case 0xf2:
			return 2
		case 0xf6:
		case 0xf8:
		case 0xf9:
		case 0xfa:
		case 0xfb:
		case 0xfc:
		case 0xfd:
		case 0xfe:
		case 0xff:
			return 0
		default:
			return undefined
	}
}

function validateDataBytes(bytes: number[], start: number, length: number): void {
	if (start + length > bytes.length) throw new RangeError('Raw MIDI command ends before the message is complete')
	for (let index = start; index < start + length; index++) {
		if ((bytes[index] ?? 0x80) >= 0x80) {
			throw new RangeError('MIDI data bytes must be between 00 and 7F')
		}
	}
}

function validateMidiStream(bytes: number[]): void {
	if (bytes[0] === 0xf0) {
		if (bytes.at(-1) !== 0xf7) throw new RangeError('SysEx commands must end with F7')
		if (bytes.slice(1, -1).some((byte) => byte >= 0x80)) {
			throw new RangeError('SysEx payload bytes must be between 00 and 7F')
		}
		return
	}

	let runningStatus: number | undefined
	let index = 0
	while (index < bytes.length) {
		const byte = bytes[index] ?? 0
		let status: number
		if (byte >= 0x80) {
			status = byte
			index++
			if (status === 0xf0 || status === 0xf7) {
				throw new RangeError('SysEx must be supplied as one complete F0 ... F7 command')
			}
			if (status < 0xf0) runningStatus = status
			else if (status < 0xf8) runningStatus = undefined
		} else {
			if (runningStatus === undefined) throw new RangeError('Raw MIDI command must begin with a MIDI status byte')
			status = runningStatus
		}

		const dataLength = channelMessageDataLength(status) ?? systemMessageDataLength(status)
		if (dataLength === undefined)
			throw new RangeError(`Unsupported MIDI status byte ${status.toString(16).toUpperCase()}`)
		validateDataBytes(bytes, index, dataLength)
		index += dataLength
	}
}

export function parseRawMidiHex(input: string): Buffer {
	const trimmed = input.trim()
	if (trimmed.length === 0) throw new RangeError('Raw MIDI command cannot be empty')
	if (!/^[0-9a-fA-F\s]+$/.test(trimmed)) {
		throw new RangeError('Use hexadecimal byte pairs separated only by optional spaces')
	}

	const compact = trimmed.replace(/\s/g, '')
	if (compact.length % 2 !== 0) throw new RangeError('Every MIDI byte must contain exactly two hexadecimal digits')
	const byteCount = compact.length / 2
	if (byteCount < 1 || byteCount > RAW_MIDI_MAX_BYTES) {
		throw new RangeError(`Raw MIDI commands must contain 1 to ${RAW_MIDI_MAX_BYTES} bytes`)
	}

	const bytes = compact.match(/.{2}/g)?.map((value) => Number.parseInt(value, 16)) ?? []
	validateMidiStream(bytes)
	return Buffer.from(bytes)
}
