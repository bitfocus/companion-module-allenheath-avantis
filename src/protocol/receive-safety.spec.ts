import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import ModuleInstance from '../main.js'

function receiveHarness(): { instance: ModuleInstance; logs: string[]; retired: unknown[] } {
	const logs: string[] = []
	const retired: unknown[] = []
	const instance = Object.create(ModuleInstance.prototype) as ModuleInstance
	instance.config = { midiBase: 1 } as ModuleInstance['config']
	instance.log = (level: string, message: string) => logs.push(`${level}: ${message}`)
	instance.setVariableValues = () => undefined
	instance.checkFeedbacks = () => undefined
	instance.retireAhNetSocket = (socket) => {
		retired.push(socket)
	}
	return { instance, logs, retired }
}

void describe('receive safety', () => {
	void it('retires AH-Net instead of crashing when a frame cannot be processed', () => {
		const { instance, logs, retired } = receiveHarness()
		const socket = {} as ModuleInstance['ahNetSocket']
		instance.ahNetSocket = socket
		instance.processAhNetData = () => {
			throw new RangeError('unexpected frame')
		}
		assert.doesNotThrow(() => instance.handleAhNetData(socket!, Buffer.from([0xf0, 0xf7])))
		assert.deepEqual(retired, [socket])
		assert.match(logs.at(-1) ?? '', /^error: Discarded unreadable AH-Net data/)
	})

	void it('does not retire a newer AH-Net socket after a fault on a stale one', () => {
		const { instance, retired } = receiveHarness()
		const stale = {} as ModuleInstance['ahNetSocket']
		instance.ahNetSocket = {} as ModuleInstance['ahNetSocket']
		instance.processAhNetData = () => {
			throw new Error('fault')
		}
		instance.handleAhNetData(stale!, Buffer.from([0xf0, 0xf7]))
		assert.deepEqual(retired, [])
	})

	void it('keeps MIDI/TCP running and clears parser carryover after a fault', () => {
		const { instance, logs } = receiveHarness()
		instance.midiReceiveBuffer = Buffer.from([0xb0, 0x63])
		instance.midiSysexBuffer = Buffer.from([0xf0, 0x00])
		instance.incomingRunningStatus = 0xb0
		instance.validateResponseData = () => {
			throw new Error('fault')
		}
		assert.doesNotThrow(() => instance.handleCommandData(Buffer.from([0xb0])))
		assert.equal(instance.midiReceiveBuffer.length, 0)
		assert.equal(instance.midiSysexBuffer.length, 0)
		assert.equal(instance.incomingRunningStatus, 0)
		assert.match(logs.at(-1) ?? '', /^error: Discarded unreadable MIDI\/TCP data/)
	})
})
