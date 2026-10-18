import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildGlobalTempoPeriodMessage,
	buildGlobalTempoBpmMessage,
	buildGlobalTempoSyncMessages,
	GLOBAL_TEMPO_MAX_BPM,
	GLOBAL_TEMPO_MIN_BPM,
	GLOBAL_TEMPO_RESET_MS,
	globalTempoPeriodToBpm,
	parseGlobalTempoFrame,
} from './global-tempo.js'

void describe('Avantis AH-Net Global Tap Tempo', () => {
	void it('encodes the captured 46.3 BPM period exactly', () => {
		assert.equal(buildGlobalTempoPeriodMessage(1295).toString('hex'), 'f0000100380f0d10000002050ff7')
		assert.equal(Number(globalTempoPeriodToBpm(1295).toFixed(1)), 46.3)
	})

	void it('uses production-safe limits and a reset timeout', () => {
		assert.equal(GLOBAL_TEMPO_MIN_BPM, 20)
		assert.equal(GLOBAL_TEMPO_MAX_BPM, 300)
		assert.equal(GLOBAL_TEMPO_RESET_MS, 3000)
		assert.throws(() => buildGlobalTempoPeriodMessage(199), RangeError)
		assert.throws(() => buildGlobalTempoPeriodMessage(3001), RangeError)
	})

	void it('sets BPM and parses the captured Director initial value', () => {
		const set = buildGlobalTempoBpmMessage(120)
		assert.equal(set.periodMs, 500)
		assert.equal(set.actualBpm, 120)
		assert.equal(set.message.toString('hex'), 'f0000100380f0d1000000201f4f7')
		assert.deepEqual(
			buildGlobalTempoSyncMessages().map((message) => message.toString('hex')),
			['f00001003800030006000a00000f0d100010000001f7', 'f0000100380f0d00080000f7'],
		)
		assert.equal(parseGlobalTempoFrame(Buffer.from('f000020f0d0038100000020412f7', 'hex')), 1042)
		assert.equal(parseGlobalTempoFrame(Buffer.from('f000040f0d00381000000202d7f7', 'hex')), 727)
	})
})
