import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import ModuleInstance from '../main.js'

type FeedbackHarness = ModuleInstance & {
	variableUpdates: Record<string, unknown>[]
	feedbackChecks: string[][]
}

function createHarness(): FeedbackHarness {
	const instance = Object.create(ModuleInstance.prototype) as FeedbackHarness
	instance.config = { host: '192.0.2.1', midiBase: 1 } as ModuleInstance['config']
	instance.ahNetSessionInitialized = true
	instance.ahNetSocket = {
		readyState: 'open',
		writable: true,
		destroyed: false,
		write: () => true,
	} as unknown as ModuleInstance['ahNetSocket']
	instance.ufxBypassStates = Array.from({ length: 8 })
	instance.ufxPluginBypassStates = Array.from({ length: 8 })
	instance.variableUpdates = []
	instance.feedbackChecks = []
	instance.log = () => undefined
	instance.setVariableValues = (values) => instance.variableUpdates.push(values)
	instance.checkFeedbacks = (...feedbacks) => instance.feedbackChecks.push(feedbacks)
	instance.scheduleStateVerification = () => undefined
	return instance
}

void describe('immediate AH-Net write feedback', () => {
	void it('updates RackUltraFX rack bypass after a successful write', () => {
		const instance = createHarness()

		instance.setUfxBypass(3, true)

		assert.equal(instance.ufxBypassStates[2], true)
		assert.deepEqual(instance.variableUpdates, [{ ufx_3_bypass_state: 'Bypassed' }])
		assert.deepEqual(instance.feedbackChecks, [['ufx_bypass', 'ufx_all_bypassed']])
	})

	void it('updates Virtual Soundcheck mode after a successful write', () => {
		const instance = createHarness()

		instance.sendVirtualSoundcheckMode(2)

		assert.equal(instance.virtualSoundcheckModeValue, 2)
		assert.deepEqual(instance.variableUpdates, [{ virtual_soundcheck_mode: 'Virtual Soundcheck' }])
		assert.deepEqual(instance.feedbackChecks, [['virtual_soundcheck_mode']])
	})

	void it('updates Global Key and Scale after successful writes', () => {
		const instance = createHarness()

		instance.action({ action: 'ufx_global_key', options: { key: 7 } })
		instance.action({ action: 'ufx_global_scale', options: { scale: 1 } })

		assert.equal(instance.ufxGlobalKey, 7)
		assert.equal(instance.ufxGlobalScale, 1)
		assert.deepEqual(instance.variableUpdates, [{ ufx_global_key: 'G' }, { ufx_global_scale: 'Minor' }])
		assert.deepEqual(instance.feedbackChecks, [['ufx_global_key'], ['ufx_global_scale']])
	})

	void it('updates Global Tempo after a successful write', () => {
		const instance = createHarness()

		instance.setGlobalTempoBpm('123.4')

		assert.equal(instance.globalTempoBpm, 123.5)
		assert.deepEqual(instance.variableUpdates, [{ global_tempo_bpm: 123.5 }])
	})
})
