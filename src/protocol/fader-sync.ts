export type InputFaderSubscription = {
	channel: number
	handle: number
}

export type InputFaderUpdate = {
	channel: number
	ahNetValue: number
	db: number
	midiLevel: number
}

// Client-selected registration handles. Keep these out of the console's 0x10xx
// property/handle range: 0x1010 and 0x1011 fail specifically for Inputs 17/18.
const INPUT_FADER_HANDLE_BASE = 0x2000
const AHNET_ZERO_DB = 0x8000
const AHNET_STEPS_PER_DB = 256

export function parseInputFaderSubscriptions(value: unknown, inputCount: number): number[] {
	const text = typeof value === 'string' ? value.trim() : ''
	if (text === '') return []
	if (!Number.isInteger(inputCount) || inputCount < 1) throw new RangeError('Input capacity must be positive')

	const channels = text.split(',').map((entry) => {
		const trimmed = entry.trim()
		if (!/^\d+$/.test(trimmed)) {
			throw new Error(`Invalid subscribed input '${trimmed || '(blank)'}'. Use comma-separated channel numbers.`)
		}
		const channel = Number(trimmed)
		if (channel < 1 || channel > inputCount) {
			throw new RangeError(`Subscribed input ${channel} is outside the enabled 1-${inputCount} input range.`)
		}
		return channel
	})

	return [...new Set(channels)].sort((a, b) => a - b)
}

export function inputFaderSubscription(channel: number): InputFaderSubscription {
	if (!Number.isInteger(channel) || channel < 1 || channel > 96) {
		throw new RangeError('Input fader subscription channel must be between 1 and 96')
	}
	return { channel, handle: INPUT_FADER_HANDLE_BASE + channel - 1 }
}

export function buildAhNetSurfaceIdentificationRequest(): Buffer {
	return Buffer.from('f00001000000080004001753757266616365204964656e74696669636174696f6e00f7', 'hex')
}

export function buildInputFaderSubscriptionMessages(channel: number): Buffer[] {
	const subscription = inputFaderSubscription(channel)
	const channelIndex = channel - 1
	const handleMsb = (subscription.handle >> 8) & 0xff
	const handleLsb = subscription.handle & 0xff

	return [
		// Read-only discovery of Input CH fader object 28/2B/CH. Live testing
		// confirmed this returns the initial value and subscribes the open AH-Net
		// connection to subsequent changes without moving the fader.
		Buffer.from([
			0xf0,
			0x00,
			0x01,
			0x00,
			0x28,
			0x00,
			0x03,
			0x00,
			0x06,
			0x00,
			0x0a,
			0x00,
			0x00,
			handleMsb,
			handleLsb,
			0x10,
			0x00,
			0x2b,
			channelIndex,
			0x00,
			0xff,
			0xf7,
		]),
	]
}

export function ahNetFaderValueToDb(value: number): number {
	if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new RangeError('AH-Net fader value is invalid')
	return (value - AHNET_ZERO_DB) / AHNET_STEPS_PER_DB
}

export function dbToNearestMidiFaderLevel(db: number): number {
	if (!Number.isFinite(db)) return 0
	if (db <= -50) return db < -59 ? 0 : 0x07
	if (db <= -10) return Math.max(0x07, Math.min(0x57, Math.round(0x57 + (db + 10) * 2)))
	return Math.max(0x57, Math.min(0x7f, Math.round(0x57 + (db + 10) * 2)))
}

export function parseInputFaderUpdate(
	frame: Buffer,
	subscriptionsByHandle: ReadonlyMap<number, number>,
): InputFaderUpdate | undefined {
	if (
		frame.length !== 14 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame[5] !== 0x00 ||
		frame[6] !== 0x28 ||
		frame[7] !== 0x10 ||
		frame[8] !== 0x00 ||
		frame[9] !== 0x00 ||
		frame[10] !== 0x02 ||
		frame[13] !== 0xf7
	) {
		return undefined
	}

	const handle = (frame[3] << 8) | frame[4]
	const channel = subscriptionsByHandle.get(handle)
	if (channel === undefined) return undefined
	const ahNetValue = (frame[11] << 8) | frame[12]
	const db = ahNetFaderValueToDb(ahNetValue)
	return { channel, ahNetValue, db, midiLevel: dbToNearestMidiFaderLevel(db) }
}
