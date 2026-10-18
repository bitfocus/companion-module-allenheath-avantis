import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import ModuleInstance from '../main.js'

function createInstance(): ModuleInstance {
	const instance = Object.create(ModuleInstance.prototype) as ModuleInstance
	instance.config = { midiBase: 1 } as ModuleInstance['config']
	instance.midiReceiveBuffer = Buffer.alloc(0)
	instance.incomingRunningStatus = 0
	instance.muteStateCache = {}
	instance.nrpnMSB = {}
	instance.nrpnLSB = {}
	instance.sceneBankByMidiChannel = {}
	instance.sceneNameCache = {}
	instance.lastSceneNumber = 0
	instance.setVariableValues = () => undefined
	instance.checkFeedbacks = () => undefined
	return instance
}

void describe('MIDI/TCP stream parsing', () => {
	void it('retains a split Note On message until the final byte arrives', () => {
		const instance = createInstance()

		instance.processIncomingMidi(Buffer.from([0x90, 0x05]))
		assert.equal(instance.muteStateCache['0:5'], undefined)
		assert.deepEqual(instance.midiReceiveBuffer, Buffer.from([0x90, 0x05]))

		instance.processIncomingMidi(Buffer.from([0x7f]))
		assert.equal(instance.muteStateCache['0:5'], true)
		assert.equal(instance.midiReceiveBuffer.length, 0)
	})

	void it('retains split running-status data without duplicating the prior message', () => {
		const instance = createInstance()

		instance.processIncomingMidi(Buffer.from([0x90, 0x05, 0x7f, 0x06]))
		assert.equal(instance.muteStateCache['0:5'], true)
		assert.equal(instance.muteStateCache['0:6'], undefined)
		assert.deepEqual(instance.midiReceiveBuffer, Buffer.from([0x06]))

		instance.processIncomingMidi(Buffer.from([0x7f]))
		assert.equal(instance.muteStateCache['0:6'], true)
		assert.equal(instance.midiReceiveBuffer.length, 0)
	})

	void it('retains a split Program Change used for scene state', () => {
		const instance = createInstance()

		instance.processIncomingMidi(Buffer.from([0xb0, 0x00, 0x01, 0xc0]))
		assert.equal(instance.lastSceneNumber, 0)
		assert.deepEqual(instance.midiReceiveBuffer, Buffer.from([0xc0]))

		instance.processIncomingMidi(Buffer.from([0x00]))
		assert.equal(instance.lastSceneNumber, 129)
		assert.equal(instance.midiReceiveBuffer.length, 0)
	})
})
