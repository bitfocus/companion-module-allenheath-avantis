import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildUfxPluginBypassMessage,
	buildUfxPluginBypassSyncMessages,
	parseUfxPluginBypassFrame,
	ufxPluginBypassTarget,
} from './ufx-plugin-bypass.js'
import ModuleInstance from '../main.js'

void describe('UFX plugin bypass', () => {
	void it('maps captured UFX 4 manager', () => {
		assert.deepEqual(ufxPluginBypassTarget(4), { family: 0x0ae0, handle: 0x4203 })
		assert.equal(buildUfxPluginBypassSyncMessages().length, 16)
	})

	void it('builds writes using the registered Companion handles', () => {
		assert.equal(buildUfxPluginBypassMessage(4, true).toString('hex'), 'f000010ae04203101600028010f7')
		assert.equal(buildUfxPluginBypassMessage(4, false).toString('hex'), 'f000010ae04203101600028000f7')
	})

	void it('parses initial values and pushes', () => {
		assert.deepEqual(parseUfxPluginBypassFrame(Buffer.from('f0000242030ae0100000028010f7', 'hex')), {
			kind: 'ufx-plugin',
			unit: 4,
			bypassed: true,
		})
	})

	void it('updates Companion state immediately after a successful plugin bypass write', () => {
		const writes: Buffer[] = []
		const values: Record<string, unknown>[] = []
		const feedbackChecks: string[][] = []
		const instance = Object.create(ModuleInstance.prototype) as ModuleInstance
		instance.ahNetSessionInitialized = true
		instance.ahNetSocket = {
			readyState: 'open',
			writable: true,
			destroyed: false,
			write: (message: Buffer) => {
				writes.push(Buffer.from(message))
				return true
			},
		} as unknown as ModuleInstance['ahNetSocket']
		instance.ufxPluginBypassStates = Array.from({ length: 8 })
		instance.log = () => undefined
		instance.setVariableValues = (update) => values.push(update)
		instance.checkFeedbacks = (...feedbacks) => feedbackChecks.push(feedbacks)
		instance.scheduleStateVerification = () => undefined

		instance.setUfxPluginBypass(3, true)

		assert.deepEqual(
			writes.map((message) => message.toString('hex')),
			['f000010ad94202101600028010f7'],
		)
		assert.equal(instance.ufxPluginBypassStates[2], true)
		assert.deepEqual(values, [{ ufx_3_plugin_bypass_state: 'Bypassed' }])
		assert.deepEqual(feedbackChecks, [['ufx_plugin_bypass', 'ufx_all_plugins_bypassed']])
	})
})
