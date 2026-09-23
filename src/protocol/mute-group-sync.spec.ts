import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildMuteGroupSyncMessages, MUTE_GROUP_COUNT, parseMuteGroupFrame } from './mute-group-sync.js'

void describe('Avantis AH-Net Mute Group synchronization', () => {
	void it('builds read-only wildcard subscriptions for all eight groups', () => {
		const messages = buildMuteGroupSyncMessages()
		assert.equal(MUTE_GROUP_COUNT, 8)
		assert.equal(messages.length, 16)
		assert.equal(messages[0].toString('hex'), 'f00001002500030006000a000002c11000102800fff7')
		assert.equal(messages[1].toString('hex'), 'f00001002502c100080000f7')
		assert.equal(messages[14].toString('hex'), 'f00001002500030006000a000002c81000102f00fff7')
		assert.equal(messages[15].toString('hex'), 'f00001002502c800080000f7')
	})

	void it('parses the live initial states for Groups 1, 3, and 8', () => {
		assert.deepEqual(parseMuteGroupFrame(Buffer.from('f0000302c100251000000100f7', 'hex')), { group: 1, muted: false })
		assert.deepEqual(parseMuteGroupFrame(Buffer.from('f0000302c300251000000101f7', 'hex')), { group: 3, muted: true })
		assert.deepEqual(parseMuteGroupFrame(Buffer.from('f0000302c800251000000100f7', 'hex')), { group: 8, muted: false })
	})
})
