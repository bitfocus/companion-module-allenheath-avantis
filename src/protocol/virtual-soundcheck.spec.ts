import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	buildVirtualSoundcheckModeMessage,
	buildVirtualSoundcheckRegistrationMessage,
	buildVirtualSoundcheckValueRequest,
	parseVirtualSoundcheckModeFrame,
	virtualSoundcheckModeName,
} from './virtual-soundcheck.js'

void describe('Avantis Virtual Soundcheck AH-Net protocol', () => {
	void it('encodes all three live-tested modes', () => {
		assert.equal(buildVirtualSoundcheckModeMessage(0).toString('hex'), 'f00001003a18e51066000100f7')
		assert.equal(buildVirtualSoundcheckModeMessage(1).toString('hex'), 'f00001003a18e51066000101f7')
		assert.equal(buildVirtualSoundcheckModeMessage(2).toString('hex'), 'f00001003a18e51066000102f7')
	})

	void it('builds the registration and value-request messages', () => {
		assert.equal(
			buildVirtualSoundcheckRegistrationMessage().toString('hex'),
			'f00001003a00030006000a00000ccb1000106600fff7',
		)
		assert.equal(buildVirtualSoundcheckValueRequest().toString('hex'), 'f00001003a0ccb00080000f7')
	})

	void it('parses console-originated mode feedback', () => {
		assert.equal(parseVirtualSoundcheckModeFrame(Buffer.from('f0000318e5003a1000000100f7', 'hex')), 0)
		assert.equal(parseVirtualSoundcheckModeFrame(Buffer.from('f0000318e5003a1000000101f7', 'hex')), 1)
		assert.equal(parseVirtualSoundcheckModeFrame(Buffer.from('f0000318e5003a1000000102f7', 'hex')), 2)
		assert.equal(parseVirtualSoundcheckModeFrame(Buffer.from('f000030ccb003a1000000101f7', 'hex')), 1)
		assert.equal(parseVirtualSoundcheckModeFrame(Buffer.from('f0000218e5003a1000000101f7', 'hex')), 1)
		assert.equal(parseVirtualSoundcheckModeFrame(Buffer.from('f0000418e5003a1000000101f7', 'hex')), 1)
		assert.equal(parseVirtualSoundcheckModeFrame(Buffer.from('f0000318e5003a00080000f7', 'hex')), undefined)
	})

	void it('maps mode values to Companion labels', () => {
		assert.equal(virtualSoundcheckModeName(0), 'Inactive')
		assert.equal(virtualSoundcheckModeName(1), 'Record Send')
		assert.equal(virtualSoundcheckModeName(2), 'Virtual Soundcheck')
	})
})
