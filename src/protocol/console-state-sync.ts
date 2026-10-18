export type ConsoleStateUpdate =
	| { kind: 'talkback'; active: boolean }
	| { kind: 'master-strips-lock'; locked: boolean }
	| { kind: 'usb-recorder'; recording: boolean }

const registration = (family: number, handle: number, path: number, property: number, mask = 1): Buffer =>
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
		(path >> 8) & 0xff,
		path & 0xff,
		(property >> 8) & 0xff,
		property & 0xff,
		0x00,
		mask,
		0xf7,
	])

const request = (family: number, handle: number): Buffer =>
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
	])

export function buildConsoleStateSyncMessages(recorderFamily = 0x113f): Buffer[] {
	return [
		registration(0x003a, 0x02cf, 0x1002, 0x10c2, 0),
		request(0x003a, 0x02cf),
		...buildUsbRecorderStateSyncMessages(recorderFamily),
	]
}

export function buildUsbRecorderStateSyncMessages(family: number): Buffer[] {
	if (!Number.isInteger(family) || family < 0 || family > 0xffff)
		throw new RangeError('Playback Manager family is invalid')
	return [
		registration(family, 0x02d1, 0x1002, 0x1003),
		request(family, 0x02d1),
		registration(family, 0x02d2, 0x1002, 0x1003),
		request(family, 0x02d2),
	]
}

export function buildMasterStripsLockSyncMessages(family: number): Buffer[] {
	if (!Number.isInteger(family) || family < 0 || family > 0xffff)
		throw new RangeError('Bank Switcher Manager family is invalid')
	return [registration(family, 0x0173, 0x101e, 0x101e), request(family, 0x0173)]
}

export function parseConsoleStateFrame(
	frame: Buffer,
	masterStripsFamily = 0x12a7,
	recorderFamily = 0x113f,
): ConsoleStateUpdate | undefined {
	if (frame[0] !== 0xf0 || frame[1] !== 0x00 || frame[2] < 0x01 || frame[2] > 0x05 || frame.at(-1) !== 0xf7) return
	const handle = (frame[3] << 8) | frame[4]
	const family = (frame[5] << 8) | frame[6]
	// The console acknowledges the Talkback value request without a payload when Talkback is inactive.
	// Active/inactive transitions then arrive as the state pushes parsed below.
	if (
		frame.length === 12 &&
		family === 0x003a &&
		handle === 0x02cf &&
		frame[7] === 0x00 &&
		frame[8] === 0x08 &&
		frame[9] === 0x00 &&
		frame[10] === 0x00
	)
		return { kind: 'talkback', active: false }

	if (frame.length === 13 && frame[7] === 0x10 && frame[9] === 0x00 && frame[10] === 0x01) {
		const state = frame[11]
		if (state !== 0 && state !== 1) return
		if (family === 0x003a && handle === 0x02cf && frame[8] === 0x02) return { kind: 'talkback', active: state === 1 }
		if (family === masterStripsFamily && handle === 0x0173 && frame[8] === 0x1e)
			return { kind: 'master-strips-lock', locked: state === 1 }
	}

	if (
		frame.length === 19 &&
		family === recorderFamily &&
		(handle === 0x02d1 || handle === 0x02d2) &&
		frame[7] === 0x10 &&
		frame[8] === 0x02 &&
		frame[9] === 0x00 &&
		frame[10] === 0x07 &&
		(frame[11] === 0 || frame[11] === 1)
	) {
		return { kind: 'usb-recorder', recording: frame[11] === 1 }
	}
	return
}
