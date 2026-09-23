import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildMasterStripsLockSyncMessages, buildUsbRecorderStateSyncMessages } from './console-state-sync.js'
import { buildManagerSessionSyncMessages } from './manager-session-sync.js'
import { buildSceneStateSyncMessages } from './scene-sync.js'
import { buildUsbPlaybackSyncMessages } from './usb-playback.js'

void describe('AH-Net manager subscriptions across replacement sessions', () => {
	void it('restores every known manager-specific subscription', () => {
		const families = { bankSwitcher: 0x12a5, scene: 0x142d, playback: 0x113f }
		const expected = [
			...buildMasterStripsLockSyncMessages(families.bankSwitcher),
			...buildSceneStateSyncMessages(families.scene),
			...buildUsbPlaybackSyncMessages(families.playback),
			...buildUsbRecorderStateSyncMessages(families.playback),
		]
		assert.deepEqual(buildManagerSessionSyncMessages(families), expected)
	})

	void it('does not guess manager families that have not been discovered', () => {
		assert.deepEqual(buildManagerSessionSyncMessages({}), [])
	})
})
