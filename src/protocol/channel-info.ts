const SYSEX_HEADER = [0xf0, 0x00, 0x00, 0x1a, 0x50, 0x10, 0x01, 0x00]

export const CHANNEL_COLOR_LABELS = ['Off', 'Red', 'Green', 'Yellow', 'Blue', 'Purple', 'Light Blue', 'White']

export type ChannelInfoReply =
	| { type: 'name'; midiChannel: number; channel: number; name: string }
	| { type: 'color'; midiChannel: number; channel: number; color: number }

function validateRequest(midiBaseChannel: number, channel: number): void {
	if (!Number.isInteger(midiBaseChannel) || midiBaseChannel < 1 || midiBaseChannel > 12) {
		throw new RangeError('Base MIDI channel must be an integer from 1 to 12')
	}
	if (!Number.isInteger(channel) || channel < 0 || channel > 95) {
		throw new RangeError('Input channel must be an integer from 1 to 96')
	}
}

export function buildChannelNameRequest(midiChannel: number, channel: number): Buffer {
	if (!Number.isInteger(midiChannel) || midiChannel < 0 || midiChannel > 15)
		throw new RangeError('MIDI channel must be 0-15')
	if (!Number.isInteger(channel) || channel < 0 || channel > 127) throw new RangeError('Channel number must be 0-127')
	return Buffer.from([...SYSEX_HEADER, midiChannel, 0x01, channel, 0xf7])
}

export function buildChannelColorRequest(midiChannel: number, channel: number): Buffer {
	if (!Number.isInteger(midiChannel) || midiChannel < 0 || midiChannel > 15)
		throw new RangeError('MIDI channel must be 0-15')
	if (!Number.isInteger(channel) || channel < 0 || channel > 127) throw new RangeError('Channel number must be 0-127')
	return Buffer.from([...SYSEX_HEADER, midiChannel, 0x04, channel, 0xf7])
}

export function buildInputNameRequest(midiBaseChannel: number, channel: number): Buffer {
	validateRequest(midiBaseChannel, channel)
	return buildChannelNameRequest(midiBaseChannel - 1, channel)
}

export function buildInputColorRequest(midiBaseChannel: number, channel: number): Buffer {
	validateRequest(midiBaseChannel, channel)
	return buildChannelColorRequest(midiBaseChannel - 1, channel)
}

export function parseChannelInfoReply(frame: Buffer): ChannelInfoReply | undefined {
	if (frame.length < 13 || frame[0] !== 0xf0 || frame.at(-1) !== 0xf7) return undefined
	if (!SYSEX_HEADER.every((byte, index) => frame[index] === byte)) return undefined
	const midiChannel = frame[8]
	const command = frame[9]
	const channel = frame[10]
	if (midiChannel === undefined || midiChannel > 15 || channel === undefined || channel > 127) return undefined

	if (command === 0x02) {
		const name = frame
			.subarray(11, frame.length - 1)
			.toString('ascii')
			.replace(/[\0 ]+$/g, '')
		return { type: 'name', midiChannel, channel, name }
	}
	if (command === 0x05 && frame.length === 13) {
		const color = frame[11]
		if (color !== undefined && color <= 7) return { type: 'color', midiChannel, channel, color }
	}
	return undefined
}

export function parseInputChannelInfoReply(frame: Buffer, midiBaseChannel: number): ChannelInfoReply | undefined {
	const reply = parseChannelInfoReply(frame)
	return reply?.midiChannel === midiBaseChannel - 1 && reply.channel <= 95 ? reply : undefined
}
