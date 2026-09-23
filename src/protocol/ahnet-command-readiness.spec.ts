import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import ModuleInstance from '../main.js'

function commandHarness(sessionInitialized: boolean): { instance: ModuleInstance; writes: Buffer[] } {
	const writes: Buffer[] = []
	const instance = Object.create(ModuleInstance.prototype) as ModuleInstance
	instance.ahNetSessionInitialized = sessionInitialized
	instance.ahNetSocket = {
		readyState: 'open',
		writable: true,
		destroyed: false,
		write: (message: Buffer) => {
			writes.push(Buffer.from(message))
			return true
		},
	} as unknown as ModuleInstance['ahNetSocket']
	instance.log = () => undefined
	return { instance, writes }
}

void describe('AH-Net command readiness', () => {
	void it('does not write controls before the AH-Net session handshake completes', () => {
		const { instance, writes } = commandHarness(false)
		assert.equal(instance.isAhNetConnectionReady(), false)
		assert.equal(instance.writeAhNetCommand(Buffer.from('f000f7', 'hex'), 'test command'), false)
		assert.deepEqual(writes, [])
	})

	void it('writes controls after the AH-Net session handshake completes', () => {
		const { instance, writes } = commandHarness(true)
		assert.equal(instance.isAhNetConnectionReady(), true)
		assert.equal(instance.writeAhNetCommand(Buffer.from('f000f7', 'hex'), 'test command'), true)
		assert.deepEqual(
			writes.map((message) => message.toString('hex')),
			['f000f7'],
		)
	})
})
