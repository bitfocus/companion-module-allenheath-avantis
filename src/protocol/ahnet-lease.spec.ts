import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type net from 'node:net'
import ModuleInstance, { type AhNetStartMode, getAhNetReconnectDelay } from '../main.js'

type LeaseTestInstance = ModuleInstance & {
	initAhNetCalls: AhNetStartMode[]
}

function createInstance(): LeaseTestInstance {
	const instance = Object.create(ModuleInstance.prototype) as LeaseTestInstance
	instance.config = { host: '192.0.2.1', midiBase: 1, ahNetStateSyncEnabled: true } as LeaseTestInstance['config']
	instance.connectionLifecycleActive = true
	instance.ahNetReconnectAttempt = 0
	instance.subscribedInputFaders = []
	instance.ahNetReceiveBuffer = Buffer.alloc(0)
	instance.tcpSocket = {
		readyState: 'open',
		writable: true,
		destroyed: false,
	} as net.Socket
	instance.initAhNetCalls = []
	instance.initAhNet = (mode = 'initial') => {
		instance.initAhNetCalls.push(mode)
	}
	instance.ufxBypassStates = Array.from({ length: 8 })
	instance.ufxPluginBypassStates = Array.from({ length: 8 })
	instance.stateVerificationTimers = []
	instance.heldAhNetCommands = []
	instance.setVariableValues = () => undefined
	instance.checkFeedbacks = () => undefined
	instance.log = () => undefined
	instance.setSynchronizationConnectionState = () => undefined
	return instance
}

function fakeSocket(destroyed = false): net.Socket {
	return { destroyed, destroy: () => undefined } as unknown as net.Socket
}

void describe('AH-Net lease renewal lifecycle', () => {
	void it('renews an initialized active session after 24 seconds', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()
		const socket = fakeSocket()
		instance.ahNetSocket = socket
		instance.ahNetSessionInitialized = true

		instance.scheduleAhNetLeaseRenewal(socket)
		context.mock.timers.tick(23_999)
		assert.deepEqual(instance.initAhNetCalls, [])
		context.mock.timers.tick(1)
		assert.deepEqual(instance.initAhNetCalls, ['renewal'])
		assert.equal(instance.ahNetLeaseRenewalTimer, undefined)
	})

	void it('does not renew a stale, destroyed, or uninitialized session', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const cases = [
			{ current: fakeSocket(), scheduled: fakeSocket(), initialized: true },
			{ current: fakeSocket(true), scheduled: undefined, initialized: true },
			{ current: fakeSocket(), scheduled: undefined, initialized: false },
		]

		for (const testCase of cases) {
			const instance = createInstance()
			const scheduled = testCase.scheduled ?? testCase.current
			instance.ahNetSocket = testCase.current
			instance.ahNetSessionInitialized = testCase.initialized
			instance.scheduleAhNetLeaseRenewal(scheduled)
			context.mock.timers.tick(24_000)
			assert.deepEqual(instance.initAhNetCalls, [])
		}
	})

	void it('cancels a pending renewal during cleanup', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()
		const socket = fakeSocket()
		instance.ahNetSocket = socket
		instance.ahNetSessionInitialized = true

		instance.scheduleAhNetLeaseRenewal(socket)
		instance.clearAhNetLeaseRenewalTimer()
		context.mock.timers.tick(24_000)
		assert.deepEqual(instance.initAhNetCalls, [])
		assert.equal(instance.ahNetLeaseRenewalTimer, undefined)
	})

	void it('does not renew after the module lifecycle has stopped', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()
		const socket = fakeSocket()
		instance.ahNetSocket = socket
		instance.ahNetSessionInitialized = true

		instance.scheduleAhNetLeaseRenewal(socket)
		instance.connectionLifecycleActive = false
		context.mock.timers.tick(24_000)
		assert.deepEqual(instance.initAhNetCalls, [])
	})

	void it('backs off failed reconnects and caps retries at ten seconds', () => {
		assert.deepEqual(
			[0, 1, 2, 3, 4, 20].map((attempt) => getAhNetReconnectDelay(attempt)),
			[1000, 2000, 5000, 10000, 10000, 10000],
		)
	})

	void it('reconnects AH-Net independently when the command socket is unavailable', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()
		delete instance.tcpSocket

		instance.triggerAhNetReconnect()
		context.mock.timers.tick(1000)
		assert.deepEqual(instance.initAhNetCalls, ['recovery'])
	})

	void it('keeps a single AH-Net retry pending across repeated outage signals', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()

		instance.triggerAhNetReconnect()
		instance.triggerAhNetReconnect()
		assert.equal(instance.ahNetReconnectAttempt, 1)
		context.mock.timers.tick(999)
		assert.deepEqual(instance.initAhNetCalls, [])
		context.mock.timers.tick(1)
		assert.deepEqual(instance.initAhNetCalls, ['recovery'])
	})

	void it('resets reconnect backoff after a valid session response', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()
		instance.ahNetReconnectAttempt = 3
		instance.ahNetReceiveBuffer = Buffer.alloc(0)

		instance.processAhNetData(Buffer.from('e000040203c87de7', 'hex'))
		assert.equal(instance.ahNetReconnectAttempt, 0)

		instance.triggerAhNetReconnect()
		context.mock.timers.tick(999)
		assert.deepEqual(instance.initAhNetCalls, [])
		context.mock.timers.tick(1)
		assert.deepEqual(instance.initAhNetCalls, ['recovery'])
	})

	void it('retires and reconnects AH-Net immediately when a current session reports an error', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()
		let destroyed = false
		const socket = { destroyed: false, destroy: () => (destroyed = true) } as unknown as net.Socket
		instance.ahNetSocket = socket
		instance.ahNetSessionInitialized = true

		instance.retireAhNetSocket(socket)
		assert.equal(destroyed, true)
		assert.equal(instance.ahNetSocket, undefined)
		context.mock.timers.tick(1000)
		assert.deepEqual(instance.initAhNetCalls, ['recovery'])
	})

	void it('reports synchronization recovery before retrying a retired session', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()
		const states: string[] = []
		instance.setSynchronizationConnectionState = (state) => states.push(state)
		const socket = fakeSocket()
		instance.ahNetSocket = socket

		instance.retireAhNetSocket(socket)
		assert.deepEqual(states, ['Recovering', 'Recovering'])
	})

	void it('bounds an incomplete AH-Net frame and reconnects instead of retaining unbounded data', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()
		let destroyed = false
		const socket = { destroyed: false, destroy: () => (destroyed = true) } as unknown as net.Socket
		instance.ahNetSocket = socket
		instance.processAhNetData(Buffer.alloc(64 * 1024 + 1, 0xf0))

		assert.equal(destroyed, true)
		assert.equal(instance.ahNetReceiveBuffer.length, 0)
		context.mock.timers.tick(1000)
		assert.deepEqual(instance.initAhNetCalls, ['recovery'])
	})
})
