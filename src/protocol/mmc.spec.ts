import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildMmcTransportMessage } from './mmc.js'

void describe('Avantis MMC transport protocol', () => {
	void it('encodes every documented transport command', () => {
		for (const command of [0x01, 0x02, 0x04, 0x05, 0x06, 0x09]) {
			assert.deepEqual([...buildMmcTransportMessage(command)], [0xf0, 0x7f, 0x7f, 0x06, command, 0xf7])
		}
	})

	void it('rejects unsupported commands', () => {
		assert.throws(() => buildMmcTransportMessage(0x03), RangeError)
	})
})
