import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import ModuleInstance from '../main.js'

type SceneHarness = ModuleInstance & {
	variableUpdates: Record<string, unknown>[]
}

function createHarness(): SceneHarness {
	const instance = Object.create(ModuleInstance.prototype) as SceneHarness
	instance.config = { midiBase: 1, sceneNameRetrievalLimit: 500 } as ModuleInstance['config']
	instance.midiReceiveBuffer = Buffer.alloc(0)
	instance.incomingRunningStatus = 0
	instance.muteStateCache = {}
	instance.nrpnMSB = {}
	instance.nrpnLSB = {}
	instance.sceneBankByMidiChannel = {}
	instance.sceneNameCache = {}
	instance.lastSceneNumber = 0
	instance.lastSceneName = 'Unknown'
	instance.variableUpdates = []
	instance.log = () => undefined
	instance.setVariableValues = (values) => instance.variableUpdates.push(values)
	instance.checkFeedbacks = () => undefined
	return instance
}

void describe('last recalled scene ownership', () => {
	void it('initializes from AH-Net before any recall has been observed', () => {
		const instance = createHarness()

		instance.applySynchronizedSceneState(3)
		instance.applySynchronizedSceneName(3, 'Scene 3')

		assert.equal(instance.lastSceneNumber, 3)
		assert.equal(instance.lastSceneName, 'Scene 3')
	})

	void it('updates immediately for a console-originated recalled-scene name event', () => {
		const instance = createHarness()
		instance.applySynchronizedSceneState(3)
		instance.applySynchronizedSceneName(3, 'Scene 3')

		instance.applySynchronizedSceneName(113, 'Scene 113')
		instance.applySynchronizedSceneState(3)

		assert.equal(instance.lastSceneNumber, 113)
		assert.equal(instance.lastSceneName, 'Scene 113')
		assert.equal(instance.sceneNameCache[3], 'Scene 3')
	})

	void it('updates immediately after a successful Companion recall write', () => {
		const instance = createHarness()
		instance.applySynchronizedSceneState(3)
		instance.applySynchronizedSceneName(3, 'Scene 3')
		instance.sceneNameCache[113] = 'Scene 113'
		instance.writeCommand = () => true

		assert.equal(instance.recallSceneNumber(113), true)
		instance.applySynchronizedSceneState(3)

		assert.equal(instance.lastSceneNumber, 113)
		assert.equal(instance.lastSceneName, 'Scene 113')
	})

	void it('does not report a Companion recall when its socket write fails', () => {
		const instance = createHarness()
		instance.applySynchronizedSceneState(3)
		instance.applySynchronizedSceneName(3, 'Scene 3')
		instance.sceneNameCache[113] = 'Scene 113'
		instance.writeCommand = () => false

		assert.equal(instance.recallSceneNumber(113), false)
		assert.equal(instance.lastSceneNumber, 3)
		assert.equal(instance.lastSceneName, 'Scene 3')
	})
})
