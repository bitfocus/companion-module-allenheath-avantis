import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import ModuleInstance from '../main.js'
import { UfxFeedbackState } from './ufx-feedback-state.js'
import { GLOBAL_KEY_REQUEST, GLOBAL_SCALE_REQUEST } from './global-key-scale-sync.js'
import { buildUfxBypassSyncMessages } from './ufx-bypass.js'
import { buildUfxPluginBypassSyncMessages } from './ufx-plugin-bypass.js'
import { buildSceneStateSyncMessages } from './scene-sync.js'
import { buildManagerIdentificationRequest } from './manager-discovery.js'

type Harness = ModuleInstance & { writes: Buffer[]; values: Record<string, unknown>[]; checks: string[][] }

function harness(): Harness {
	const instance = Object.create(ModuleInstance.prototype) as Harness
	instance.config = { host: '192.0.2.1', midiBase: 1 } as ModuleInstance['config']
	instance.writes = []
	instance.values = []
	instance.checks = []
	instance.ahNetSessionInitialized = true
	instance.ahNetSocket = {
		readyState: 'open',
		writable: true,
		destroyed: false,
		write: (message: Buffer) => {
			instance.writes.push(Buffer.from(message))
			return true
		},
		destroy: () => undefined,
	} as unknown as ModuleInstance['ahNetSocket']
	instance.ufxBypassStates = Array.from({ length: 8 })
	instance.ufxPluginBypassStates = Array.from({ length: 8 })
	instance.ahNetReceiveBuffer = Buffer.alloc(0)
	instance.stripMetadataTargets = new Map()
	instance.ahNetFaderChannelsByHandle = new Map()
	instance.ahNetConsoleFadersByHandle = new Map()
	instance.stateVerificationTimers = []
	instance.heldAhNetCommands = []
	instance.subscribedInputFaders = []
	instance.setVariableValues = (values) => instance.values.push(values)
	instance.checkFeedbacks = (...checks) => instance.checks.push(checks)
	instance.log = () => undefined
	return instance
}

const keyFrame = (value: number): Buffer => Buffer.from([0xf0, 0, 2, 0x11, 0x1b, 0, 0x39, 0x10, 0, 0, 1, value, 0xf7])

void describe('RackUltraFX feedback freshness and write reconciliation', () => {
	void it('subscribes to scene state immediately on discovery before requesting lock and playback managers', () => {
		const instance = harness()
		instance.requestNextAhNetManagerDiscovery(instance.ahNetSocket!)
		assert.deepEqual(instance.writes, [buildManagerIdentificationRequest('Scene Manager Intermediate')])
		instance.writes.length = 0
		instance.processAhNetData(Buffer.from('f00002000f0000000200021234f7', 'hex'))
		assert.deepEqual(instance.writes, [
			...buildSceneStateSyncMessages(0x1234),
			buildManagerIdentificationRequest('Bank Switcher Manager'),
		])
		instance.processAhNetData(Buffer.from('f00002000300000002000212a7f7', 'hex'))
		assert.deepEqual(instance.writes.at(-1), buildManagerIdentificationRequest('Playback Manager'))
	})

	void it('retries scene state ahead of key and scale even when the scene cache was populated before renewal', (context) => {
		context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
		const instance = harness()
		instance.ahNetSceneManagerFamily = 0x1234
		instance.ahNetBankSwitcherFamily = 0x12a7
		instance.ahNetPlaybackManagerFamily = 0x113f
		instance.lastSceneNumber = 113
		instance.virtualSoundcheckModeValue = 0
		instance.scheduleInitialStateRetries(instance.ahNetSocket!, true, true)
		context.mock.timers.tick(1000)
		context.mock.timers.tick(200)
		assert.deepEqual(instance.writes.slice(0, 3), buildSceneStateSyncMessages(0x1234))
		instance.applySynchronizedSceneState = () => undefined
		instance.processAhNetData(Buffer.from('f00002000f1234100100080070007000700070f7', 'hex'))
		assert.equal(instance.ahNetSceneStateReceived, true)
		instance.writes.length = 0
		context.mock.timers.tick(1800)
		context.mock.timers.tick(200)
		assert.equal(
			instance.writes.some((message) => message.equals(buildSceneStateSyncMessages(0x1234)[0])),
			false,
		)
	})

	void it('rechecks bypass subscriptions on renewal even when all bypass display values are cached', (context) => {
		context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
		const instance = harness()
		instance.ufxBypassStates.fill(true)
		instance.ufxPluginBypassStates.fill(false)
		instance.scheduleUfxBypassSyncValidation(instance.ahNetSocket!)
		context.mock.timers.tick(750)
		assert.deepEqual(instance.writes, [...buildUfxBypassSyncMessages(), ...buildUfxPluginBypassSyncMessages()])
	})
	void it('keeps rapid commands immediate while older, fragmented console feedback is held until confirmation', (context) => {
		context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
		const instance = harness()
		instance.action({ action: 'ufx_global_key', options: { key: 2 } })
		instance.action({ action: 'ufx_global_key', options: { key: 7 } })
		assert.equal(instance.ufxGlobalKey, 7)
		const old = keyFrame(2)
		instance.processAhNetData(old.subarray(0, 8))
		instance.processAhNetData(old.subarray(8))
		assert.equal(instance.ufxGlobalKey, 7)
		instance.processAhNetData(keyFrame(7))
		context.mock.timers.tick(1000)
		assert.equal(instance.ufxGlobalKey, 7)
		// Once confirmed, a subsequent real console change is immediate.
		instance.processAhNetData(keyFrame(5))
		assert.equal(instance.ufxGlobalKey, 5)
	})

	void it('allows a persistent conflicting console value to win after one second and asks for a fresh read', (context) => {
		context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
		const instance = harness()
		instance.action({ action: 'ufx_global_key', options: { key: 7 } })
		instance.processAhNetData(keyFrame(2))
		context.mock.timers.tick(999)
		assert.equal(instance.ufxGlobalKey, 7)
		context.mock.timers.tick(1)
		assert.equal(instance.ufxGlobalKey, 2)
		assert.deepEqual(instance.writes.at(-1), GLOBAL_KEY_REQUEST)
		assert.deepEqual(instance.values.at(-1), { ufx_global_key: 'D' })
	})

	void it('protects scale, rack bypass and plugin bypass independently and preserves aggregate feedback checks', (context) => {
		context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
		const instance = harness()
		instance.action({ action: 'ufx_global_scale', options: { scale: 1 } })
		instance.setUfxBypass(3, true)
		instance.setUfxPluginBypass(3, true)
		instance.processAhNetData(Buffer.from('f00002111c00391001000100f7', 'hex'))
		instance.processAhNetData(Buffer.from('f00002114c0ad9100000028000f7', 'hex'))
		instance.processAhNetData(Buffer.from('f0000242020ad9100000028000f7', 'hex'))
		assert.equal(instance.ufxGlobalScale, 1)
		assert.equal(instance.ufxBypassStates[2], true)
		assert.equal(instance.ufxPluginBypassStates[2], true)
		context.mock.timers.tick(1000)
		assert.equal(instance.ufxGlobalScale, 0)
		assert.equal(instance.ufxBypassStates[2], false)
		assert.equal(instance.ufxPluginBypassStates[2], false)
		assert.ok(instance.checks.some((checks) => checks.includes('ufx_all_bypassed')))
		assert.ok(instance.checks.some((checks) => checks.includes('ufx_all_plugins_bypassed')))
	})

	void it('supersedes the previous grace timer when a newer command arrives', (context) => {
		context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
		const instance = harness()
		instance.action({ action: 'ufx_global_key', options: { key: 2 } })
		context.mock.timers.tick(500)
		instance.action({ action: 'ufx_global_key', options: { key: 7 } })
		instance.processAhNetData(keyFrame(2))
		context.mock.timers.tick(500)
		assert.equal(instance.ufxGlobalKey, 7)
		context.mock.timers.tick(500)
		assert.equal(instance.ufxGlobalKey, 2)
		assert.equal(instance.ufxWriteFeedbackTimers?.size, 0)
	})

	void it('does not publish or protect controls whose socket write throws', (context) => {
		context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
		const instance = harness()
		instance.ahNetSocket!.write = () => {
			throw new Error('write failed')
		}
		instance.action({ action: 'ufx_global_key', options: { key: 7 } })
		instance.action({ action: 'ufx_global_scale', options: { scale: 1 } })
		instance.setUfxBypass(3, true)
		instance.setUfxPluginBypass(3, true)
		assert.deepEqual(instance.values, [])
		assert.equal(instance.ufxWriteFeedbackTimers, undefined)
		instance.processAhNetData(keyFrame(2))
		assert.equal(instance.ufxGlobalKey, 2)
	})

	void it('retries cached key and scale until each has a fresh report in the new session', (context) => {
		context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
		const instance = harness()
		instance.ufxGlobalKey = 7
		instance.ufxGlobalScale = 1
		instance.virtualSoundcheckModeValue = 0
		instance.scheduleInitialStateRetries(instance.ahNetSocket!, false, true)
		context.mock.timers.tick(1000)
		context.mock.timers.tick(100)
		assert.ok(instance.writes.some((message) => message.equals(GLOBAL_KEY_REQUEST)))
		assert.ok(instance.writes.some((message) => message.equals(GLOBAL_SCALE_REQUEST)))
		instance.processAhNetData(keyFrame(7))
		instance.writes.length = 0
		context.mock.timers.tick(1900)
		context.mock.timers.tick(100)
		assert.equal(
			instance.writes.some((message) => message.equals(GLOBAL_KEY_REQUEST)),
			false,
		)
		assert.ok(instance.writes.some((message) => message.equals(GLOBAL_SCALE_REQUEST)))
		instance.clearUfxWriteFeedback()
		assert.equal(instance.getUfxFeedbackState().hasReceived('key'), false)
	})

	void it('clears misleading key, scale and bypass displays on an actual outage and cancels pending correction', (context) => {
		context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
		const instance = harness()
		instance.ufxGlobalScale = 1
		instance.setUfxBypass(3, true)
		instance.setUfxPluginBypass(3, true)
		instance.action({ action: 'ufx_global_key', options: { key: 7 } })
		instance.processAhNetData(keyFrame(2))
		instance.retireAhNetSocket(instance.ahNetSocket!)
		const updates = instance.values.length
		context.mock.timers.tick(1000)
		assert.equal(instance.values.length, updates)
		assert.equal(instance.ufxGlobalKey, undefined)
		assert.equal(instance.ufxGlobalScale, undefined)
		assert.equal(instance.ufxBypassStates[2], undefined)
		assert.equal(instance.ufxPluginBypassStates[2], undefined)
		assert.equal(instance.ufxWriteFeedbackTimers?.size, 0)
	})

	void it('does not let an older command expiry release protection for the latest command', () => {
		const state = new UfxFeedbackState()
		const old = state.expect('key', 2, 0)
		const latest = state.expect('key', 7, 500)
		assert.equal(state.finish('key', old), undefined)
		assert.equal(state.receive('key', 2, 1000), false)
		assert.deepEqual(state.finish('key', latest), { deferred: 2 })
	})
})
