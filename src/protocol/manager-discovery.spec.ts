import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildManagerIdentificationRequest, parseManagerIdentificationFrame } from './manager-discovery.js'

void describe('portable AH-Net manager discovery', () => {
	void it('builds the name lookups captured from Director', () => {
		assert.equal(
			buildManagerIdentificationRequest('Bank Switcher Manager').toString('hex'),
			'f00001000000030004001642616e6b205377697463686572204d616e6167657200f7',
		)
		assert.equal(
			buildManagerIdentificationRequest('Scene Manager Intermediate').toString('hex'),
			'f000010000000f0004001b5363656e65204d616e6167657220496e7465726d65646961746500f7',
		)
		assert.equal(
			buildManagerIdentificationRequest('Playback Manager').toString('hex'),
			'f00001000002d000040011506c61796261636b204d616e6167657200f7',
		)
	})

	void it('parses manager-family replies from two console configurations', () => {
		assert.equal(
			parseManagerIdentificationFrame(Buffer.from('f0000100030000000200021258f7', 'hex'), 'Bank Switcher Manager'),
			0x1258,
		)
		assert.equal(
			parseManagerIdentificationFrame(Buffer.from('f0000200030000000200021258f7', 'hex'), 'Bank Switcher Manager'),
			0x1258,
		)
		assert.equal(
			parseManagerIdentificationFrame(Buffer.from('f00002000f00000002000213d6f7', 'hex'), 'Scene Manager Intermediate'),
			0x13d6,
		)
		assert.equal(
			parseManagerIdentificationFrame(Buffer.from('f0000202d000000002000210f1f7', 'hex'), 'Playback Manager'),
			0x10f1,
		)
		assert.equal(
			parseManagerIdentificationFrame(Buffer.from('f0000302d000000002000210f1f7', 'hex'), 'Playback Manager'),
			0x10f1,
		)
		assert.equal(
			parseManagerIdentificationFrame(Buffer.from('f0000402d000000002000210f1f7', 'hex'), 'Playback Manager'),
			0x10f1,
		)
		assert.equal(
			parseManagerIdentificationFrame(Buffer.from('f00002000800000002000210faf7', 'hex'), 'Bank Switcher Manager'),
			undefined,
		)
	})
})
