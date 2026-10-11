import assert from 'node:assert/strict'
import { describe, it, type TestContext } from 'node:test'
import net from 'node:net'
import { EventEmitter } from 'node:events'
import { syncBuiltinESMExports } from 'node:module'
import ModuleInstance, { type AhNetStartMode } from '../main.js'
import { buildHardwareStatusDiscoveryMessages } from './hardware-status.js'

type FakeSocket = EventEmitter & {
	destroyed: boolean
	readyState: string
	writable: boolean
	setTimeout: () => void
	setKeepAlive: () => void
	setNoDelay: () => void
	destroy: () => void
	write: (message: Buffer) => boolean
}

function harness(context: TestContext): {
	instance: ModuleInstance
	writes: Buffer[]
	logs: string[]
	states: string[]
	variables: Record<string, unknown>
	start: (mode: AhNetStartMode, connect?: boolean) => FakeSocket
} {
	context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
	const writes: Buffer[] = []
	const logs: string[] = []
	const states: string[] = []
	const variables: Record<string, unknown> = {}
	let current: FakeSocket | undefined
	context.mock.method(net, 'createConnection', () => {
		const socket = Object.assign(new EventEmitter(), {
			destroyed: false,
			readyState: 'open',
			writable: true,
			setTimeout: () => undefined,
			setKeepAlive: () => undefined,
			setNoDelay: () => undefined,
			destroy: () => {
				socket.destroyed = true
			},
			write: (message: Buffer) => {
				writes.push(Buffer.from(message))
				return true
			},
		})
		current = socket
		return socket
	})
	syncBuiltinESMExports()

	const instance = Object.create(ModuleInstance.prototype) as ModuleInstance
	instance.config = {
		host: '192.0.2.1',
		midiBase: 1,
		ahNetStateSyncEnabled: true,
		rackUfxInstalled: true,
		retrieveAllSceneNames: true,
	} as ModuleInstance['config']
	instance.connectionLifecycleActive = true
	instance.ahNetReconnectAttempt = 0
	instance.ahNetFaderChannelsByHandle = new Map()
	instance.ahNetConsoleFadersByHandle = new Map()
	instance.pendingInitialFaderSync = new Set()
	instance.pendingInitialConsoleFaderSync = new Set()
	instance.stateVerificationTimers = []
	instance.inputInfoSyncTimers = []
	instance.heldAhNetCommands = []
	instance.ahNetRenewalInProgress = false
	instance.ahNetReceiveBuffer = Buffer.alloc(0)
	instance.ufxBypassStates = Array.from({ length: 8 })
	instance.ufxPluginBypassStates = Array.from({ length: 8 })
	instance.ioPortInstalled = [true, undefined]
	instance.slinkRackConnected = [undefined, undefined]
	instance.consoleDiscoverySettled = true
	instance.ahNetSceneManagerFamily = 0x1234
	instance.ahNetBankSwitcherFamily = 0x12a7
	instance.ahNetPlaybackManagerFamily = 0x113f
	instance.synchronizationConnectionState = 'Ready'
	instance.setVariableValues = (values: Record<string, unknown>) => Object.assign(variables, values)
	instance.checkFeedbacks = () => undefined
	instance.log = (level: string, message: string) => logs.push(`${level}: ${message}`)
	const setState = instance.setSynchronizationConnectionState.bind(instance)
	instance.setSynchronizationConnectionState = (state) => {
		states.push(state)
		setState(state)
	}
	instance.scheduleSceneDirectorySync = () => logs.push('scene directory sync scheduled')
	context.after(() => {
		instance.connectionLifecycleActive = false
		instance.destroyAhNetConnection(false)
		context.mock.restoreAll()
		syncBuiltinESMExports()
	})

	const start = (mode: AhNetStartMode, connect = true): FakeSocket => {
		instance.initAhNet(mode)
		const socket = current!
		if (connect) socket.emit('connect')
		return socket
	}
	return { instance, writes, logs, states, variables, start }
}

const acknowledge = (instance: ModuleInstance): void => {
	instance.ahNetSessionInitialized = true
	instance.pendingAhNetSessionStart?.()
}

void describe('AH-Net renewal and recovery', () => {
	void it('holds a command pressed during renewal and sends it first once the session is acknowledged', (context) => {
		const { instance, writes, start } = harness(context)
		start('renewal')
		const command = Buffer.from('f0000100aabbf7', 'hex')

		assert.equal(instance.writeAhNetCommand(command, 'set test value'), true)
		assert.equal(
			writes.some((write) => write.equals(command)),
			false,
			'nothing may be sent before the session acknowledgement',
		)

		const before = writes.length
		acknowledge(instance)
		assert.ok(writes[before]?.equals(command), 'the held command is the first write of the new session')
		assert.equal(instance.heldAhNetCommands.length, 0)
	})

	void it('drops held commands instead of sending them late after a real outage', (context) => {
		const { instance, writes, logs, start } = harness(context)
		const socket = start('renewal')
		const command = Buffer.from('f0000100ccddf7', 'hex')
		instance.writeAhNetCommand(command, 'set test value')

		instance.retireAhNetSocket(socket as unknown as net.Socket)
		assert.equal(instance.heldAhNetCommands.length, 0)
		assert.ok(logs.some((line) => /^warn: Cannot set test value: the console synchronization connection/.test(line)))
		assert.equal(
			writes.some((write) => write.equals(command)),
			false,
		)
		assert.equal(instance.writeAhNetCommand(command, 'set test value'), false, 'outage writes are refused')
	})

	void it('drops a held command that waited longer than the hold limit', (context) => {
		const { instance, writes, logs, start } = harness(context)
		// A slow TCP connect (up to the 8 s attempt timeout) precedes the session handshake.
		const socket = start('renewal', false)
		const command = Buffer.from('f0000100eeffaa', 'hex')
		instance.writeAhNetCommand(command, 'set test value')
		context.mock.timers.tick(2600)
		socket.emit('connect')
		acknowledge(instance)
		assert.equal(
			writes.some((write) => write.equals(command)),
			false,
		)
		assert.ok(logs.some((line) => line.startsWith('warn: Dropped set test value')))
	})

	void it('keeps the published status steady during a routine renewal', (context) => {
		const { instance, states, start } = harness(context)
		start('renewal')
		acknowledge(instance)
		context.mock.timers.tick(5000)
		assert.equal(
			states.some((state) => state === 'Connecting' || state === 'Synchronizing'),
			false,
			`unexpected states: ${states.join(', ')}`,
		)
	})

	void it('rediscovers hardware and scene names on recovery but not on renewal', (context) => {
		const { instance, writes, logs, variables, start } = harness(context)
		const discovery = buildHardwareStatusDiscoveryMessages()[0]

		start('renewal')
		acknowledge(instance)
		context.mock.timers.tick(5000)
		assert.equal(
			writes.some((write) => write.equals(discovery)),
			false,
		)
		assert.equal(logs.includes('scene directory sync scheduled'), false)

		writes.length = 0
		start('recovery')
		assert.equal(variables.firmware_version, 'Unknown')
		assert.equal(instance.ioPortInstalled[0], undefined)
		acknowledge(instance)
		context.mock.timers.tick(5000)
		assert.ok(writes.some((write) => write.equals(discovery)))
		assert.ok(logs.includes('scene directory sync scheduled'))
	})

	void it('restores Virtual Soundcheck and tempo displays when a held change is never sent', (context) => {
		const { instance, variables, start } = harness(context)
		instance.setVirtualSoundcheckMode(0)
		instance.globalTempoBpm = 120
		start('renewal')

		instance.sendVirtualSoundcheckMode(2)
		instance.setGlobalTempoBpm(90)
		assert.equal(variables.virtual_soundcheck_mode, 'Virtual Soundcheck')
		assert.equal(variables.global_tempo_bpm, 90)

		instance.destroyAhNetConnection(false)
		assert.equal(variables.virtual_soundcheck_mode, 'Inactive')
		assert.equal(variables.global_tempo_bpm, 120)
	})

	void it('keeps the recovery scene-name read when the command connection drops', (context) => {
		const { instance, logs, start } = harness(context)
		start('recovery')
		acknowledge(instance)
		instance.clearCommandSessionTimers()
		context.mock.timers.tick(5000)
		assert.ok(logs.includes('scene directory sync scheduled'))
	})

	void it('shows AH-Net-only values as Unknown during an outage and leaves mute groups alone', (context) => {
		const { instance, variables, start } = harness(context)
		const socket = start('recovery')
		acknowledge(instance)
		instance.globalTempoBpm = 120
		instance.setTalkbackActive(true)
		const muteGroupsBefore = Object.keys(variables).filter((key) => key.startsWith('mute_group_'))

		instance.retireAhNetSocket(socket as unknown as net.Socket)
		assert.equal(variables.global_tempo_bpm, 'Unknown')
		assert.equal(instance.globalTempoBpm, undefined)
		assert.equal(variables.talkback_state, 'Unknown')
		assert.equal(variables.usb_playback_state, 'Unknown')
		assert.deepEqual(
			Object.keys(variables).filter((key) => key.startsWith('mute_group_')),
			muteGroupsBefore,
		)
	})
})
