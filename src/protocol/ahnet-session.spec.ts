import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { buildAhNetSessionInitializationMessage, parseAhNetSessionInitializationResponse } from './ahnet-session.js'

void describe('AH-Net session initialization', () => {
	void it('builds the Director-compatible initialization frame with a supplied client token', () => {
		assert.equal(buildAhNetSessionInitializationMessage(Buffer.from([0xc7, 0x3e])).toString('hex'), 'e000040103c73ee7')
	})

	void it('recognizes the captured console acknowledgement', () => {
		assert.equal(parseAhNetSessionInitializationResponse(Buffer.from('e000040203c87de7', 'hex')), true)
		assert.equal(parseAhNetSessionInitializationResponse(Buffer.from('e000040103c73ee7', 'hex')), false)
	})
})
