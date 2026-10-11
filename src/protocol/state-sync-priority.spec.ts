import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPriorityStateSyncBatches } from './state-sync-priority.js'
import { buildGlobalKeyScaleSyncMessages } from './global-key-scale-sync.js'
import { buildGlobalTempoSyncMessages } from './global-tempo.js'
import { buildSceneStateSyncMessages } from './scene-sync.js'
import { buildUfxBypassSyncMessages } from './ufx-bypass.js'
import { buildUfxPluginBypassSyncMessages } from './ufx-plugin-bypass.js'
import { buildStripMetadataSyncMessages, buildStripMetadataTargets } from './strip-metadata-sync.js'
import { nextManagerToDiscover } from './manager-discovery.js'
import net from 'node:net'
import { EventEmitter } from 'node:events'
import { syncBuiltinESMExports } from 'node:module'
import ModuleInstance from '../main.js'
import { buildInputFaderSubscriptionMessages } from './fader-sync.js'
import { buildConsoleFaderSubscriptionMessage, buildConsoleFaderTargets } from './console-fader-sync.js'
import { getConfiguredMixLayout } from '../config.js'

void describe('AH-Net subscription priorities', () => {
	void it('schedules names after all faders and colours after every name on a replacement session', (context) => {
		context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
		const writes: Array<{ message: Buffer; at: number }> = []
		const socket = Object.assign(new EventEmitter(), {
			destroyed: false,
			setTimeout: () => undefined,
			setKeepAlive: () => undefined,
			setNoDelay: () => undefined,
			destroy: () => {
				socket.destroyed = true
			},
			write: (message: Buffer) => {
				writes.push({ message: Buffer.from(message), at: Date.now() })
				return true
			},
		})
		context.mock.method(net, 'createConnection', () => socket)
		syncBuiltinESMExports()
		const instance = Object.create(ModuleInstance.prototype) as ModuleInstance
		instance.config = {
			host: '192.0.2.1',
			midiBase: 1,
			dPackEnabled: true,
			ahNetStateSyncEnabled: true,
			rackUfxInstalled: true,
		} as ModuleInstance['config']
		instance.connectionLifecycleActive = true
		instance.ahNetFaderChannelsByHandle = new Map()
		instance.ahNetConsoleFadersByHandle = new Map()
		instance.pendingInitialFaderSync = new Set()
		instance.pendingInitialConsoleFaderSync = new Set()
		instance.stateVerificationTimers = []
		instance.heldAhNetCommands = []
		instance.inputInfoSyncTimers = []
		instance.ufxBypassStates = Array.from({ length: 8 })
		instance.ufxPluginBypassStates = Array.from({ length: 8 })
		instance.consoleDiscoverySettled = true
		instance.ahNetSceneManagerFamily = 0x1234
		instance.ahNetBankSwitcherFamily = 0x12a7
		instance.ahNetPlaybackManagerFamily = 0x113f
		instance.setVariableValues = () => undefined
		instance.checkFeedbacks = () => undefined
		instance.log = () => undefined
		context.after(() => {
			instance.destroyAhNetConnection(false)
			context.mock.restoreAll()
			syncBuiltinESMExports()
		})
		instance.initAhNet('renewal')
		socket.emit('connect')
		instance.ahNetSessionInitialized = true
		instance.pendingAhNetSessionStart?.()
		context.mock.timers.tick(2500)
		const layout = getConfiguredMixLayout(instance.config)
		const targets = buildStripMetadataTargets(96, layout, true)
		const names = buildStripMetadataSyncMessages(targets, 'name')
		const colors = buildStripMetadataSyncMessages(targets, 'color')
		const faders = [
			...Array.from({ length: 96 }, (_, channel) => buildInputFaderSubscriptionMessages(channel + 1)).flat(),
			...buildConsoleFaderTargets(layout, true).map(buildConsoleFaderSubscriptionMessage),
		]
		const firstWriteIndex = (message: Buffer): number => {
			const index = writes.findIndex((write) => write.message.equals(message))
			assert.ok(index >= 0, `Missing subscription: ${message.toString('hex')}`)
			return index
		}
		const sceneIndexes = buildSceneStateSyncMessages(0x1234).map(firstWriteIndex)
		const musicalIndexes = buildGlobalKeyScaleSyncMessages().map(firstWriteIndex)
		assert.ok(Math.max(...sceneIndexes) < Math.min(...musicalIndexes))
		assert.ok(Math.max(...faders.map(firstWriteIndex)) < Math.min(...names.map(firstWriteIndex)))
		assert.ok(Math.max(...names.map(firstWriteIndex)) < Math.min(...colors.map(firstWriteIndex)))
		instance.destroyAhNetConnection(false)
	})
	void it('restores scene state first on renewal, with musical state before bypass and other controls', () => {
		const batches = buildPriorityStateSyncBatches({
			syncState: true,
			syncUfx: true,
			syncVirtualSoundcheck: true,
			managers: { bankSwitcher: 0x12a7, scene: 0x1234, playback: 0x113f },
		})
		assert.deepEqual(
			batches.map((batch) => batch.kind),
			['scene', 'musical', 'ufx', 'general', 'managers'],
		)
		assert.deepEqual(batches[0].messages, buildSceneStateSyncMessages(0x1234))
		assert.deepEqual(batches[1].messages.slice(0, 6), [
			...buildGlobalKeyScaleSyncMessages(),
			...buildGlobalTempoSyncMessages(),
		])
		assert.deepEqual(batches[2].messages, [...buildUfxBypassSyncMessages(), ...buildUfxPluginBypassSyncMessages()])
		// Request timing remains independent of input count and strip metadata.
		const musicalStart = 75 + batches[0].messages.length * batches[0].interval
		assert.equal(musicalStart + 15, 135)
		assert.equal(musicalStart + 45, 165)
		assert.equal(75 + (batches.slice(0, 3).reduce((total, batch) => total + batch.messages.length, 0) - 1) * 15, 705)
	})

	void it('starts musical synchronization while a cold connection discovers scene addresses', () => {
		const batches = buildPriorityStateSyncBatches({
			syncState: true,
			syncUfx: true,
			syncVirtualSoundcheck: true,
			managers: {},
		})
		assert.equal(batches[0].kind, 'musical')
		assert.deepEqual(batches[0].messages.slice(0, 4), buildGlobalKeyScaleSyncMessages())
		assert.equal(nextManagerToDiscover({}), 'Scene Manager Intermediate')
		assert.equal(nextManagerToDiscover({ scene: 0x1234 }), 'Bank Switcher Manager')
		assert.equal(nextManagerToDiscover({ scene: 0x1234, bankSwitcher: 0x12a7 }), 'Playback Manager')
		assert.equal(nextManagerToDiscover({ scene: 0x1234, bankSwitcher: 0x12a7, playback: 0x113f }), undefined)
	})

	void it('preserves every captured metadata registration when names and colours are scheduled separately', () => {
		const targets = buildStripMetadataTargets(
			96,
			{
				monoGroups: 2,
				stereoGroups: 4,
				monoAuxes: 2,
				stereoAuxes: 7,
				monoMatrices: 2,
				stereoMatrices: 2,
				monoFxSends: 0,
				stereoFxSends: 4,
				mSumEnabled: true,
			},
			true,
		)
		const original = buildStripMetadataSyncMessages(targets)
			.map((message) => message.toString('hex'))
			.sort()
		const separated = [
			...buildStripMetadataSyncMessages(targets, 'name'),
			...buildStripMetadataSyncMessages(targets, 'color'),
		]
			.map((message) => message.toString('hex'))
			.sort()
		assert.deepEqual(separated, original)
	})

	void it('does not introduce UFX or other state subscriptions when synchronization is disabled', () => {
		const batches = buildPriorityStateSyncBatches({
			syncState: false,
			syncUfx: false,
			syncVirtualSoundcheck: true,
			managers: {},
		})
		assert.equal(batches.length, 1)
		assert.equal(batches[0].messages.length, 2)
		assert.deepEqual(
			buildPriorityStateSyncBatches({ syncState: false, syncUfx: false, syncVirtualSoundcheck: false, managers: {} }),
			[],
		)
	})
})
