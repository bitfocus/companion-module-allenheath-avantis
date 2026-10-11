import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import ModuleInstance from '../main.js'

function faderHarness(): { instance: ModuleInstance; writes: Buffer[] } {
	const writes: Buffer[] = []
	const socket = {
		readyState: 'open',
		writable: true,
		destroyed: false,
		write: (message: Buffer) => {
			writes.push(Buffer.from(message))
			return true
		},
	}
	const instance = Object.create(ModuleInstance.prototype) as ModuleInstance
	instance.config = { midiBase: 1, fadeUpdatesPerSecond: 20 } as ModuleInstance['config']
	instance.tcpSocket = socket as unknown as ModuleInstance['tcpSocket']
	instance.faderFadeTimers = {}
	instance.faderLevelCache = {}
	instance.log = () => undefined
	instance.setVariableValues = () => undefined
	instance.checkFeedbacks = () => undefined
	return { instance, writes }
}

// Fader NRPN: B<n> 63 <channel> B<n> 62 17 B<n> 06 <level>
const faderWrites = (writes: Buffer[], channel: number): number[] =>
	writes.filter((message) => message[2] === channel && message[5] === 0x17).map((message) => message[8])

const wait = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

void describe('fader fades', () => {
	void it('cancels a running fade when the same fader is set immediately', async () => {
		const { instance, writes } = faderHarness()
		instance.faderLevelCache['0:0'] = 0x00
		instance.handleFaderAction({ channel: 0, level: String(0x6b), fadeDuration: 0.5 }, 0)
		await wait(120)
		instance.handleFaderAction({ channel: 0, level: '0', fadeDuration: 0 }, 0)
		const writesAtCancel = faderWrites(writes, 0).length
		await wait(600)

		const levels = faderWrites(writes, 0)
		assert.equal(levels.length, writesAtCancel, 'no fade steps may follow the immediate set')
		assert.equal(levels.at(-1), 0x00)
		assert.equal(instance.faderLevelCache['0:0'], 0x00)
		assert.equal(instance.faderFadeTimers['0:0'], undefined)
	})

	void it('leaves fades on other faders running', async () => {
		const { instance, writes } = faderHarness()
		instance.faderLevelCache['0:1'] = 0x00
		instance.handleFaderAction({ channel: 1, level: String(0x6b), fadeDuration: 0.3 }, 0)
		instance.handleFaderAction({ channel: 0, level: '0', fadeDuration: 0 }, 0)
		await wait(450)

		assert.equal(faderWrites(writes, 1).at(-1), 0x6b)
		assert.equal(instance.faderLevelCache['0:1'], 0x6b)
	})
})
