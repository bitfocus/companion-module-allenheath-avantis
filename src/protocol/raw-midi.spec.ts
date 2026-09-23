import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseRawMidiHex } from './raw-midi.js'

void describe('Avantis raw MIDI validation', () => {
	void it('accepts spaced and compact channel messages without changing bytes', () => {
		assert.deepEqual([...parseRawMidiHex('B1 0A 7F')], [0xb1, 0x0a, 0x7f])
		assert.deepEqual([...parseRawMidiHex('b10a00')], [0xb1, 0x0a, 0x00])
	})

	void it('accepts complete SysEx and running-status messages', () => {
		assert.deepEqual(
			[...parseRawMidiHex('F0 00 00 1A 50 10 01 00 F7')],
			[0xf0, 0x00, 0x00, 0x1a, 0x50, 0x10, 0x01, 0x00, 0xf7],
		)
		assert.deepEqual([...parseRawMidiHex('90 00 7F 01 7F')], [0x90, 0x00, 0x7f, 0x01, 0x7f])
	})

	void it('rejects malformed or incomplete commands', () => {
		assert.throws(() => parseRawMidiHex(''), RangeError)
		assert.throws(() => parseRawMidiHex('B1 0A 7'), RangeError)
		assert.throws(() => parseRawMidiHex('B1-0A-7F'), RangeError)
		assert.throws(() => parseRawMidiHex('B1 0A'), RangeError)
		assert.throws(() => parseRawMidiHex('F0 00 01'), RangeError)
		assert.throws(() => parseRawMidiHex('0A 7F'), RangeError)
	})
})
