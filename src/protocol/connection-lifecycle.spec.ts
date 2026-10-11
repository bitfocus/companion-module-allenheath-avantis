import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type net from 'node:net'
import ModuleInstance, { type AhNetStartMode, getCommandReconnectDelay } from '../main.js'

type LifecycleTestInstance = ModuleInstance & {
	initTcpCalls: boolean[]
	initAhNetCalls: AhNetStartMode[]
}

function createInstance(): LifecycleTestInstance {
	const instance = Object.create(ModuleInstance.prototype) as LifecycleTestInstance
	instance.config = { host: '192.0.2.1', midiBase: 1, ahNetStateSyncEnabled: true } as LifecycleTestInstance['config']
	instance.connectionLifecycleActive = true
	instance.commandReconnectAttempt = 0
	instance.initTcpCalls = []
	instance.initAhNetCalls = []
	instance.inputInfoSyncTimers = []
	instance.initTcp = (isBackgroundReconnect = false) => instance.initTcpCalls.push(isBackgroundReconnect)
	instance.initAhNet = (mode = 'initial') => instance.initAhNetCalls.push(mode)
	instance.updateStatus = () => undefined
	instance.setConnectionVariables = () => undefined
	instance.setCommandConnectionState = () => undefined
	instance.setSynchronizationConnectionState = () => undefined
	instance.log = () => undefined
	return instance
}

function fakeCommandSocket(): {
	socket: net.Socket
	writes: Buffer[]
	getDestroyed: () => boolean
} {
	const writes: Buffer[] = []
	let destroyed = false
	const socket = {
		readyState: 'open',
		writable: true,
		get destroyed() {
			return destroyed
		},
		write: (message: Buffer) => {
			writes.push(Buffer.from(message))
			return true
		},
		destroy: () => {
			destroyed = true
		},
	} as unknown as net.Socket
	return { socket, writes, getDestroyed: () => destroyed }
}

void describe('command connection lifecycle', () => {
	void it('uses a low-impact ten-second reconnect ceiling for an unavailable console', () => {
		assert.deepEqual(
			[0, 1, 2, 3, 4, 20].map((attempt) => getCommandReconnectDelay(attempt)),
			[1000, 2000, 5000, 10000, 10000, 10000],
		)
	})

	void it('keeps one reconnect timer while a console remains offline', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()

		instance.triggerReconnect()
		instance.triggerReconnect()
		assert.equal(instance.commandReconnectAttempt, 1)
		context.mock.timers.tick(999)
		assert.deepEqual(instance.initTcpCalls, [])
		context.mock.timers.tick(1)
		assert.deepEqual(instance.initTcpCalls, [true])
		assert.equal(instance.reconnectTimer, undefined)
	})

	void it('does not reconnect after module cleanup', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()

		instance.handleCommandConnectionUnavailable()
		instance.connectionLifecycleActive = false
		context.mock.timers.tick(30_000)
		assert.deepEqual(instance.initTcpCalls, [])
	})

	void it('starts independent command and AH-Net recovery after a full console outage', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()

		instance.handleCommandConnectionUnavailable()
		instance.triggerAhNetReconnect()
		context.mock.timers.tick(1000)
		assert.deepEqual(instance.initTcpCalls, [true])
		assert.deepEqual(instance.initAhNetCalls, ['recovery'])
	})

	void it('reports recovering command state before the scheduled reboot retry', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()
		const states: string[] = []
		instance.setCommandConnectionState = (state) => states.push(state)

		instance.handleCommandConnectionUnavailable()
		assert.deepEqual(states, ['Recovering'])
		context.mock.timers.tick(1000)
		assert.deepEqual(instance.initTcpCalls, [true])
	})

	void it('retires and reconnects a command socket when its read-only health probe does not reply', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()
		const { socket, writes, getDestroyed } = fakeCommandSocket()
		instance.tcpSocket = socket

		instance.scheduleCommandHealthProbe(socket)
		context.mock.timers.tick(15_000)
		assert.deepEqual(
			writes.map((message) => message.toString('hex')),
			['f000001a50100100000100f7'],
		)
		context.mock.timers.tick(5_000)
		assert.equal(getDestroyed(), true)
		assert.equal(instance.tcpSocket, undefined)
		context.mock.timers.tick(1000)
		assert.deepEqual(instance.initTcpCalls, [true])
	})

	void it('keeps a command socket when the health request receives its expected reply', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()
		const { socket, writes, getDestroyed } = fakeCommandSocket()
		instance.tcpSocket = socket

		instance.scheduleCommandHealthProbe(socket)
		context.mock.timers.tick(15_000)
		instance.acknowledgeCommandHealthProbe({ type: 'name', midiChannel: 0, channel: 0, name: 'Input 1' })
		context.mock.timers.tick(5_000)
		assert.equal(getDestroyed(), false)
		context.mock.timers.tick(10_000)
		assert.equal(writes.length, 2)
	})

	void it('cancels a pending scene step and name requests when a command socket is retired', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] })
		const instance = createInstance()
		const { socket } = fakeCommandSocket()
		instance.tcpSocket = socket
		let sceneStepFired = false
		let nameRequestFired = false
		instance.sceneSequenceTimer = setTimeout(() => (sceneStepFired = true), 500)
		instance.inputInfoSyncTimers = [setTimeout(() => (nameRequestFired = true), 500)]

		instance.retireCommandSocket(socket)
		context.mock.timers.tick(1000)
		assert.equal(sceneStepFired, false)
		assert.equal(nameRequestFired, false)
		assert.equal(instance.sceneSequenceTimer, undefined)
	})
})
