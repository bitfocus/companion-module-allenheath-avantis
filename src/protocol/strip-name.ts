const SYSEX_HEADER = [0xf0, 0x00, 0x00, 0x1a, 0x50, 0x10, 0x01, 0x00]

export type StripNameAddress = {
	midiOffset: number
	channel: number
}

export type EncodedStripName = {
	message: Buffer
	transmittedName: string
}

export function encodeStripName(name: string): { bytes: number[]; transmittedName: string } {
	const bytes: number[] = []
	let transmittedName = ''
	for (const character of name.slice(0, 8)) {
		const byte = character.codePointAt(0)
		if (byte !== undefined && byte >= 0x20 && byte <= 0x7e) {
			bytes.push(byte)
			transmittedName += character
		}
	}
	return { bytes, transmittedName }
}

export function buildStripNameMessage(
	baseMidiChannel: number,
	address: StripNameAddress,
	name: string,
): EncodedStripName {
	if (!Number.isInteger(baseMidiChannel) || baseMidiChannel < 0 || baseMidiChannel > 15) {
		throw new RangeError('Base MIDI channel must be an integer from 0 to 15')
	}
	if (!Number.isInteger(address.midiOffset) || address.midiOffset < 0 || baseMidiChannel + address.midiOffset > 15) {
		throw new RangeError('Strip MIDI offset exceeds the available MIDI channels')
	}
	if (!Number.isInteger(address.channel) || address.channel < 0 || address.channel > 127) {
		throw new RangeError('Strip channel must be an integer from 0 to 127')
	}

	const encoded = encodeStripName(name)
	return {
		message: Buffer.from([
			...SYSEX_HEADER,
			baseMidiChannel + address.midiOffset,
			0x03,
			address.channel,
			...encoded.bytes,
			0xf7,
		]),
		transmittedName: encoded.transmittedName,
	}
}
