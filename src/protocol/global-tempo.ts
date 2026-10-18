export const GLOBAL_TEMPO_MIN_BPM = 20
export const GLOBAL_TEMPO_MAX_BPM = 300
export const GLOBAL_TEMPO_RESET_MS = 3000
export const GLOBAL_TEMPO_REGISTRATION = Buffer.from('f00001003800030006000a00000f0d100010000001f7', 'hex')
export const GLOBAL_TEMPO_REQUEST = Buffer.from('f0000100380f0d00080000f7', 'hex')

export function buildGlobalTempoSyncMessages(): Buffer[] {
	return [GLOBAL_TEMPO_REGISTRATION, GLOBAL_TEMPO_REQUEST]
}

export function globalTempoPeriodToBpm(periodMs: number): number {
	if (!Number.isFinite(periodMs) || periodMs <= 0) throw new RangeError('Global tempo period must be positive')
	return 60000 / periodMs
}

export function buildGlobalTempoPeriodMessage(periodMs: number): Buffer {
	if (!Number.isInteger(periodMs)) throw new RangeError('Global tempo period must be a whole number of milliseconds')
	const minPeriod = Math.ceil(60000 / GLOBAL_TEMPO_MAX_BPM)
	const maxPeriod = Math.floor(60000 / GLOBAL_TEMPO_MIN_BPM)
	if (periodMs < minPeriod || periodMs > maxPeriod) {
		throw new RangeError(`Global tempo period must be ${minPeriod}-${maxPeriod} ms`)
	}

	return Buffer.from([
		0xf0,
		0x00,
		0x01,
		0x00,
		0x38,
		0x0f,
		0x0d,
		0x10,
		0x00,
		0x00,
		0x02,
		(periodMs >> 8) & 0xff,
		periodMs & 0xff,
		0xf7,
	])
}

export function buildGlobalTempoBpmMessage(bpm: number): { message: Buffer; periodMs: number; actualBpm: number } {
	if (!Number.isFinite(bpm) || bpm < GLOBAL_TEMPO_MIN_BPM || bpm > GLOBAL_TEMPO_MAX_BPM) {
		throw new RangeError(`Global tempo must be ${GLOBAL_TEMPO_MIN_BPM}-${GLOBAL_TEMPO_MAX_BPM} BPM`)
	}
	const periodMs = Math.round(60000 / bpm)
	return { message: buildGlobalTempoPeriodMessage(periodMs), periodMs, actualBpm: globalTempoPeriodToBpm(periodMs) }
}

export function parseGlobalTempoFrame(frame: Buffer): number | undefined {
	if (
		frame.length === 14 &&
		frame[0] === 0xf0 &&
		frame[1] === 0x00 &&
		frame[2] >= 0x01 &&
		frame[2] <= 0x05 &&
		frame.toString('hex', 3, 11) === '0f0d003810000002' &&
		frame[13] === 0xf7
	) {
		return (frame[11] << 8) | frame[12]
	}
	return undefined
}
