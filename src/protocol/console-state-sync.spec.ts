import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildConsoleStateSyncMessages,
	buildMasterStripsLockSyncMessages,
	parseConsoleStateFrame,
} from './console-state-sync.js'

void describe('captured console state synchronization', () => {
	void it('builds registrations and reads for all three states', () => {
		const messages = buildConsoleStateSyncMessages().map((message) => message.toString('hex'))
		assert.equal(messages.length, 6)
		assert.equal(messages[0], 'f00001003a00030006000a000002cf100210c20000f7')
		assert.equal(messages[2], 'f00001113f00030006000a000002d1100210030001f7')
		assert.equal(messages[4], 'f00001113f00030006000a000002d2100210030001f7')
		assert.deepEqual(
			buildMasterStripsLockSyncMessages(0x1258).map((message) => message.toString('hex')),
			['f00001125800030006000a00000173101e101e0001f7', 'f000011258017300080000f7'],
		)
	})

	void it('parses talkback, master lock, and USB recorder pushes', () => {
		assert.deepEqual(parseConsoleStateFrame(Buffer.from('f0000202cf003a00080000f7', 'hex')), {
			kind: 'talkback',
			active: false,
		})
		assert.deepEqual(parseConsoleStateFrame(Buffer.from('f0000202cf003a1002000101f7', 'hex')), {
			kind: 'talkback',
			active: true,
		})
		assert.deepEqual(parseConsoleStateFrame(Buffer.from('f0000502cf003a1002000100f7', 'hex')), {
			kind: 'talkback',
			active: false,
		})
		assert.deepEqual(parseConsoleStateFrame(Buffer.from('f00002017312a7101e000100f7', 'hex')), {
			kind: 'master-strips-lock',
			locked: false,
		})
		assert.deepEqual(parseConsoleStateFrame(Buffer.from('f0000401731258101e000101f7', 'hex'), 0x1258), {
			kind: 'master-strips-lock',
			locked: true,
		})
		assert.deepEqual(parseConsoleStateFrame(Buffer.from('f0000202d1113f100200070100005e910e90f7', 'hex')), {
			kind: 'usb-recorder',
			recording: true,
		})
		assert.deepEqual(parseConsoleStateFrame(Buffer.from('f0000202d1113f100200070000085e910e90f7', 'hex')), {
			kind: 'usb-recorder',
			recording: false,
		})
		assert.deepEqual(parseConsoleStateFrame(Buffer.from('f0000202d2113f100200070100005e910e90f7', 'hex')), {
			kind: 'usb-recorder',
			recording: true,
		})
		assert.deepEqual(
			parseConsoleStateFrame(Buffer.from('f0000402d110f1100200070000007f080e90f7', 'hex'), 0x1258, 0x10f1),
			{ kind: 'usb-recorder', recording: false },
		)
	})
})
