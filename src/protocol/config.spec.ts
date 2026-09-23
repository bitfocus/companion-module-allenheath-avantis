import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getFadeUpdatesPerSecond, getSceneNameRetrievalLimit, type ModuleConfig } from '../config.js'

const config = (sceneNameRetrievalLimit: number | null): ModuleConfig =>
	({
		ahNetStateSyncEnabled: true,
		retrieveAllSceneNames: true,
		sceneNameRetrievalLimit,
	}) as ModuleConfig

void describe('scene-name retrieval configuration', () => {
	void it('defaults missing and zero values from existing connections to 100', () => {
		assert.equal(getSceneNameRetrievalLimit(config(null)), 100)
		assert.equal(getSceneNameRetrievalLimit(config(0)), 100)
	})

	void it('honors valid limits and clamps values above the console capacity', () => {
		assert.equal(getSceneNameRetrievalLimit(config(200)), 200)
		assert.equal(getSceneNameRetrievalLimit(config(900)), 500)
	})

	void it('disables retrieval when console synchronization or retrieval is disabled', () => {
		assert.equal(getSceneNameRetrievalLimit({ ...config(100), ahNetStateSyncEnabled: false }), 0)
		assert.equal(getSceneNameRetrievalLimit({ ...config(100), retrieveAllSceneNames: false }), 0)
	})
})

void describe('fader fade resolution configuration', () => {
	void it('defaults existing connections to 20 updates per second', () => {
		assert.equal(getFadeUpdatesPerSecond({ fadeUpdatesPerSecond: null } as ModuleConfig), 20)
	})

	void it('honors the setting and clamps it to the production-safe range', () => {
		assert.equal(getFadeUpdatesPerSecond({ fadeUpdatesPerSecond: 10 } as ModuleConfig), 10)
		assert.equal(getFadeUpdatesPerSecond({ fadeUpdatesPerSecond: 2 } as ModuleConfig), 5)
		assert.equal(getFadeUpdatesPerSecond({ fadeUpdatesPerSecond: 100 } as ModuleConfig), 40)
	})
})
