// Native Avantis USB Play/Record recorder transport. This is not MIDI MMC.
export function buildUsbRecorderStartMessage(family = 0x113f): Buffer {
	validateFamily(family)
	return Buffer.from([0xf0, 0x00, 0x01, family >> 8, family & 0xff, 0x02, 0xd1, 0x10, 0x0a, 0x00, 0x00, 0xf7])
}

export function buildUsbRecorderStopMessage(family = 0x113f): Buffer {
	validateFamily(family)
	return Buffer.from([0xf0, 0x00, 0x01, family >> 8, family & 0xff, 0x02, 0xd2, 0x10, 0x0b, 0x00, 0x00, 0xf7])
}

function validateFamily(family: number): void {
	if (!Number.isInteger(family) || family < 0 || family > 0xffff)
		throw new RangeError('Playback Manager family is invalid')
}
