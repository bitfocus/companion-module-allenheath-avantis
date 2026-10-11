import { buildGlobalKeyScaleSyncMessages } from './global-key-scale-sync.js'
import { buildUfxBypassSyncMessages } from './ufx-bypass.js'
import { buildUfxPluginBypassSyncMessages } from './ufx-plugin-bypass.js'
import { buildVirtualSoundcheckRegistrationMessage, buildVirtualSoundcheckValueRequest } from './virtual-soundcheck.js'
import { buildGlobalTempoSyncMessages } from './global-tempo.js'
import { buildMuteGroupSyncMessages } from './mute-group-sync.js'
import { buildConsoleStateSyncMessages } from './console-state-sync.js'
import { buildManagerSessionSyncMessages, type ManagerSessionFamilies } from './manager-session-sync.js'
import { buildSceneStateSyncMessages } from './scene-sync.js'

export type StateSyncBatch = {
	kind: 'scene' | 'musical' | 'ufx' | 'general' | 'managers'
	messages: Buffer[]
	interval: number
}

/** Restore scene state first, then musical state, bypass and other controls. Faders, names and colours follow. */
export function buildPriorityStateSyncBatches(options: {
	syncState: boolean
	syncUfx: boolean
	syncVirtualSoundcheck: boolean
	managers: ManagerSessionFamilies
}): StateSyncBatch[] {
	const batches: StateSyncBatch[] = []
	if (options.syncState && options.managers.scene !== undefined) {
		batches.push({ kind: 'scene', messages: buildSceneStateSyncMessages(options.managers.scene), interval: 15 })
	}
	const musicalMessages: Buffer[] = []
	if (options.syncUfx) musicalMessages.push(...buildGlobalKeyScaleSyncMessages())
	if (options.syncState) musicalMessages.push(...buildGlobalTempoSyncMessages())
	if (options.syncVirtualSoundcheck) {
		musicalMessages.push(buildVirtualSoundcheckRegistrationMessage(), buildVirtualSoundcheckValueRequest())
	}
	if (musicalMessages.length > 0) batches.push({ kind: 'musical', messages: musicalMessages, interval: 15 })
	if (options.syncUfx) {
		batches.push({
			kind: 'ufx',
			messages: [...buildUfxBypassSyncMessages(), ...buildUfxPluginBypassSyncMessages()],
			interval: 15,
		})
	}
	if (options.syncState) {
		batches.push(
			{
				kind: 'general',
				messages: [...buildMuteGroupSyncMessages(), ...buildConsoleStateSyncMessages()],
				interval: 15,
			},
			{
				kind: 'managers',
				messages: buildManagerSessionSyncMessages({ ...options.managers, scene: undefined }),
				interval: 15,
			},
		)
	}
	return batches
}
