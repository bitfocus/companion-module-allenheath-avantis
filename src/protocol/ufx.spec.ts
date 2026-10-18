import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildControlChangeMessage,
	buildUfxGlobalKeyMessage,
	buildUfxGlobalScaleMessage,
	parseUfxGlobalControlChange,
	UFX_GLOBAL_KEY_CHOICES,
	UFX_RETURN_COUNT,
	UFX_RETURN_FIRST_CHANNEL,
	UFX_SEND_COUNT,
	UFX_SEND_FIRST_CHANNEL,
} from './ufx.js'

void describe('Avantis UFX protocol', () => {
	void it('defines the documented RackUltraFX send and return strip ranges', () => {
		assert.equal(UFX_SEND_COUNT, 8)
		assert.equal(UFX_SEND_FIRST_CHANNEL, 0x56)
		assert.equal(UFX_RETURN_COUNT, 8)
		assert.equal(UFX_RETURN_FIRST_CHANNEL, 0x5e)
		assert.equal(UFX_SEND_FIRST_CHANNEL + UFX_SEND_COUNT, UFX_RETURN_FIRST_CHANNEL)
	})
	void it('encodes global key and scale on the configured base MIDI channel', () => {
		assert.deepEqual([...buildUfxGlobalKeyMessage(9, 12)], [0xbb, 0x0c, 0x09])
		assert.deepEqual([...buildUfxGlobalScaleMessage(1, 12)], [0xbb, 0x0d, 0x01])
		assert.deepEqual([...buildUfxGlobalScaleMessage(2, 6)], [0xb5, 0x0d, 0x02])
	})

	void it('encodes a unit parameter on its independently assigned MIDI channel', () => {
		assert.deepEqual([...buildControlChangeMessage(3, 42, 127)], [0xb2, 42, 127])
	})

	void it('uses enharmonic key labels and parses console key/scale feedback', () => {
		assert.equal(UFX_GLOBAL_KEY_CHOICES[1]?.label, 'C#/Db')
		assert.equal(UFX_GLOBAL_KEY_CHOICES[10]?.label, 'A#/Bb')
		assert.deepEqual(parseUfxGlobalControlChange(0x0c, 1), { type: 'key', value: 1 })
		assert.deepEqual(parseUfxGlobalControlChange(0x0d, 2), { type: 'scale', value: 2 })
		assert.equal(parseUfxGlobalControlChange(0x0d, 3), undefined)
	})

	void it('rejects values outside documented MIDI ranges', () => {
		assert.throws(() => buildUfxGlobalKeyMessage(12, 1), RangeError)
		assert.throws(() => buildUfxGlobalScaleMessage(3, 1), RangeError)
		assert.throws(() => buildControlChangeMessage(17, 0, 0), RangeError)
		assert.throws(() => buildControlChangeMessage(1, 128, 0), RangeError)
		assert.throws(() => buildControlChangeMessage(1, 0, 128), RangeError)
	})
})
