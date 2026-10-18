import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import ModuleInstance from '../main.js'

function sceneHarness(): {
	instance: ModuleInstance
	writes: Buffer[]
	socket: { readyState: string; writable: boolean; destroyed: boolean; write: (message: Buffer) => boolean }
} {
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
	instance.config = { midiBase: 6 } as ModuleInstance['config']
	instance.tcpSocket = socket as unknown as ModuleInstance['tcpSocket']
	instance.connectionSerial = 1
	instance.pendingSceneSequences = []
	instance.sceneNameCache = {}
	instance.lastSceneNumber = 0
	instance.lastSceneName = 'Unknown'
	instance.log = () => undefined
	instance.setVariableValues = () => undefined
	instance.checkFeedbacks = () => undefined
	return { instance, writes, socket }
}

void describe('scene action execution', () => {
	void it('writes immediate action recalls through the live command socket', () => {
		const { instance, writes } = sceneHarness()
		instance.action({ action: 'scene_recall', options: { sceneNumber: 1 } })
		instance.action({ action: 'scene_recall', options: { sceneNumber: { value: 2 } } })
		assert.deepEqual(
			writes.map((message) => message.toString('hex')),
			['b50000c501', 'b50000c502'],
		)
	})

	async function waitForQueue(instance: ModuleInstance, timeoutMs = 1500): Promise<void> {
		const deadline = Date.now() + timeoutMs
		while (instance.pendingSceneSequences.length > 0 || instance.sceneSequenceTimer) {
			if (Date.now() >= deadline) throw new Error('Timed out waiting for the scene queue')
			await new Promise((resolve) => setTimeout(resolve, 10))
		}
	}

	void it('writes every queued recall through the same command socket', async () => {
		const { instance, writes } = sceneHarness()
		instance.queueSceneSequence(['2', '3'], 0, 100, false)
		await waitForQueue(instance)
		assert.deepEqual(
			writes.map((message) => message.toString('hex')),
			['b50000c501', 'b50000c502'],
		)
		assert.equal(instance.pendingSceneSequences.length, 0)
	})

	void it('writes several rapid recalls from one requested sequence in order', async () => {
		const { instance, writes } = sceneHarness()
		instance.queueSceneSequence(['2', '3', '4'], 0, 100, false)
		await waitForQueue(instance)
		assert.deepEqual(
			writes.map((message) => message.toString('hex')),
			['b50000c501', 'b50000c502', 'b50000c503'],
		)
	})

	void it('replaces the remaining queue when a new queue action is used during an active recall', async () => {
		const { instance, writes } = sceneHarness()
		instance.queueSceneSequence(['2', '3'], 0, 100, false)
		await new Promise((resolve) => setTimeout(resolve, 20))
		instance.queueSceneSequence(['4', '5'], 0, 100, false)
		await waitForQueue(instance)
		assert.deepEqual(
			writes.map((message) => message.toString('hex')),
			['b50000c501', 'b50000c503', 'b50000c504'],
		)
	})

	void it('preserves duplicate scene numbers in queue order', async () => {
		const { instance, writes } = sceneHarness()
		instance.queueSceneSequence(['2', '2', '3'], 0, 100, false)
		await waitForQueue(instance)
		assert.deepEqual(
			writes.map((message) => message.toString('hex')),
			['b50000c501', 'b50000c501', 'b50000c502'],
		)
	})

	void it('retains an unsent queue entry through a connection interruption and resumes it after recovery', async () => {
		const { instance, writes, socket } = sceneHarness()
		socket.readyState = 'closed'
		socket.writable = false
		instance.queueSceneSequence(['2', '3'], 0, 100, false)
		assert.equal(instance.pendingSceneSequences.length, 1)
		assert.equal(writes.length, 0)

		socket.readyState = 'open'
		socket.writable = true
		instance.connectionSerial++
		instance.processSceneQueue()
		await waitForQueue(instance)
		assert.deepEqual(
			writes.map((message) => message.toString('hex')),
			['b50000c501', 'b50000c502'],
		)
	})
})
