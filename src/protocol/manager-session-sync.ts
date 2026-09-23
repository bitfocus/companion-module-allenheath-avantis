import { buildMasterStripsLockSyncMessages, buildUsbRecorderStateSyncMessages } from './console-state-sync.js'
import { buildSceneStateSyncMessages } from './scene-sync.js'
import { buildUsbPlaybackSyncMessages } from './usb-playback.js'

export interface ManagerSessionFamilies {
	bankSwitcher?: number
	scene?: number
	playback?: number
}

/**
 * Build registrations that belong to one AH-Net session and therefore must be
 * restored whenever the module replaces or reconnects that session.
 */
export function buildManagerSessionSyncMessages(families: ManagerSessionFamilies): Buffer[] {
	const messages: Buffer[] = []
	if (families.bankSwitcher !== undefined) {
		messages.push(...buildMasterStripsLockSyncMessages(families.bankSwitcher))
	}
	if (families.scene !== undefined) {
		messages.push(...buildSceneStateSyncMessages(families.scene))
	}
	if (families.playback !== undefined) {
		messages.push(
			...buildUsbPlaybackSyncMessages(families.playback),
			...buildUsbRecorderStateSyncMessages(families.playback),
		)
	}
	return messages
}
