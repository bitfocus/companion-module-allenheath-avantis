import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildSceneStateSyncMessages, parseSceneNameFrame, parseSceneStateFrame } from './scene-sync.js'

void describe('Avantis AH-Net current scene synchronization', () => {
	void it('builds the live-proven read-only scene registration and request', () => {
		assert.deepEqual(
			buildSceneStateSyncMessages().map((message) => message.toString('hex')),
			[
				'f00001142f00030006000a0000000f1001100100fff7',
				'f00001142f00030006000a0000000f100010000000f7',
				'f00001142f000f00080000f7',
			],
		)
		assert.deepEqual(
			buildSceneStateSyncMessages(0x13d6).map((message) => message.toString('hex')),
			[
				'f0000113d600030006000a0000000f1001100100fff7',
				'f0000113d600030006000a0000000f100010000000f7',
				'f0000113d6000f00080000f7',
			],
		)
	})

	void it('parses captured Scene 3 and Scene 2 names', () => {
		assert.deepEqual(
			parseSceneNameFrame(Buffer.from('f00002000f142f1000001700025363656e6500fffffffffffffffffffffffffffffff7', 'hex')),
			{ sceneNumber: 3, name: 'Scene' },
		)
		assert.deepEqual(
			parseSceneNameFrame(Buffer.from('f00002000f142f10000017000153616d706c6500fffffffffffffffffffffffffffff7', 'hex')),
			{ sceneNumber: 2, name: 'Sample' },
		)
	})

	void it('parses captured Scene 3, Scene 2, and the fresh live probe', () => {
		assert.equal(parseSceneStateFrame(Buffer.from('f00002000f142f100100080002000200020002f7', 'hex')), 3)
		assert.equal(parseSceneStateFrame(Buffer.from('f00002000f142f100100080001000100010001f7', 'hex')), 2)
		assert.equal(parseSceneStateFrame(Buffer.from('f00004000f142f100100080001000100010001f7', 'hex')), 2)
		assert.equal(parseSceneStateFrame(Buffer.from('f00005000f142f100100080001000100010001f7', 'hex')), 2)
		assert.equal(parseSceneStateFrame(Buffer.from('f00002000f13d6100100080004000400040004f7', 'hex'), 0x13d6), 5)
	})

	void it('rejects inconsistent or out-of-range state', () => {
		assert.equal(parseSceneStateFrame(Buffer.from('f00004000f142f100100080001000200010001f7', 'hex')), undefined)
		assert.equal(parseSceneStateFrame(Buffer.from('f00004000f142f1001000801f401f401f401f4f7', 'hex')), undefined)
	})
})
