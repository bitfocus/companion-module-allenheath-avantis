import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildStripNameMessage, encodeStripName } from './strip-name.js'

void describe('Avantis strip name protocol', () => {
	void it('encodes printable names up to eight characters', () => {
		assert.deepEqual(encodeStripName('Vox é$12345'), {
			bytes: [0x56, 0x6f, 0x78, 0x20, 0x24, 0x31, 0x32],
			transmittedName: 'Vox $12',
		})
	})

	void it('encodes input, mono bus, and stereo bus writes', () => {
		assert.equal(
			buildStripNameMessage(5, { midiOffset: 0, channel: 30 }, 'Mic 1').message.toString('hex'),
			'f000001a5010010005031e4d69632031f7',
		)
		assert.equal(
			buildStripNameMessage(5, { midiOffset: 2, channel: 0 }, 'MON AUX').message.toString('hex'),
			'f000001a501001000703004d4f4e20415558f7',
		)
		assert.equal(
			buildStripNameMessage(5, { midiOffset: 2, channel: 0x40 }, 'ST AUX').message.toString('hex'),
			'f000001a50100100070340535420415558f7',
		)
	})

	void it('encodes matrix, main, DCA, FX, and RackUltraFX addresses', () => {
		for (const [midiOffset, channel] of [
			[3, 0],
			[3, 0x40],
			[4, 0x30],
			[4, 0x32],
			[4, 0x36],
			[4, 0x20],
			[4, 0x56],
			[4, 0x5e],
		] as const) {
			const result = buildStripNameMessage(5, { midiOffset, channel }, 'TEST')
			assert.equal(result.message[8], 5 + midiOffset)
			assert.equal(result.message[9], 0x03)
			assert.equal(result.message[10], channel)
		}
	})

	void it('rejects invalid MIDI addresses', () => {
		assert.throws(() => buildStripNameMessage(12, { midiOffset: 4, channel: 0 }, 'TEST'), RangeError)
		assert.throws(() => buildStripNameMessage(5, { midiOffset: 2, channel: 128 }, 'TEST'), RangeError)
	})
})
