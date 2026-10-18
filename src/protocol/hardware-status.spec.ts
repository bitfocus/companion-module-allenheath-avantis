import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSlinkStatusFrame } from './hardware-status.js'

void describe('SLink stage-rack status', () => {
	void it('distinguishes captured GX4816 online and offline socket sentinels', () => {
		const online = Buffer.from(
			'f000027301004c100800200000000004c410852b0131080008000100000000000010101010000100000007f7',
			'hex',
		)
		const offline = Buffer.from(
			'f000027301004c100800200000000004c410852b00310800ff000000000000000000000000000100000007f7',
			'hex',
		)
		assert.deepEqual(parseSlinkStatusFrame(online, 0x004c), { rack: 1, connected: true })
		assert.deepEqual(parseSlinkStatusFrame(offline, 0x004c), { rack: 1, connected: false })
	})
})
