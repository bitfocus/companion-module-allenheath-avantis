import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { UpgradeScripts, upgradeFadeResolutionSetting, upgradeLegacyMuteModes } from '../upgrades.js'

const props = (fadeUpdatesPerSecond?: number) =>
	({ config: { fadeUpdatesPerSecond }, secrets: null, actions: [], feedbacks: [] }) as Parameters<
		typeof upgradeFadeResolutionSetting
	>[1]

void describe('fade resolution saved-configuration upgrade', () => {
	void it('writes the visible default for missing and zero values', () => {
		assert.equal(upgradeFadeResolutionSetting({} as never, props()).updatedConfig?.fadeUpdatesPerSecond, 20)
		assert.equal(upgradeFadeResolutionSetting({} as never, props(0)).updatedConfig?.fadeUpdatesPerSecond, 20)
	})

	void it('preserves an existing valid operator choice', () => {
		assert.equal(upgradeFadeResolutionSetting({} as never, props(10)).updatedConfig, null)
		assert.equal(upgradeFadeResolutionSetting({} as never, props(40)).updatedConfig, null)
	})
})

void describe('released v1.0.0 connection upgrade', () => {
	void it('migrates the real v1 config shape without changing legacy action identities or choices', () => {
		let config: Record<string, unknown> = { host: '192.0.2.101', midiBase: 6 }
		let actions: Array<{ actionId: string; options: Record<string, unknown> }> = [
			{
				actionId: 'scene_recall',
				options: { sceneNumber: { value: 122, isExpression: false } },
			},
			{
				actionId: 'mute_input',
				options: {
					channel: { value: 60, isExpression: false },
					mute: { value: true, isExpression: false },
				},
			},
			{
				actionId: 'fader_input',
				options: {
					channel: { value: 60, isExpression: false },
					level: { value: 57, isExpression: false },
				},
			},
			{
				actionId: 'channel_name',
				options: {
					channel: { value: 30, isExpression: false },
					channelName: { value: '$(custom:ch1_name)', isExpression: false },
				},
			},
		]

		for (const upgrade of UpgradeScripts) {
			const result = upgrade(
				{} as never,
				{
					config,
					secrets: null,
					actions,
					feedbacks: [],
				} as never,
			)
			if (result.updatedConfig) config = result.updatedConfig
			if (result.updatedActions.length > 0) actions = result.updatedActions
		}

		assert.equal(config.host, '192.0.2.101')
		assert.equal(config.midiBase, 6)
		assert.equal(config.dPackEnabled, false)
		assert.equal(config.ahNetStateSyncEnabled, false)
		assert.equal(config.retrieveAllSceneNames, false)
		assert.equal(config.sceneNameRetrievalLimit, 100)
		assert.equal(config.fadeUpdatesPerSecond, 20)
		assert.deepEqual(
			actions.map((action) => action.actionId),
			['scene_recall', 'mute_input', 'fader_input', 'channel_name'],
		)
		assert.deepEqual(actions[0]?.options.sceneNumber, { value: 122, isExpression: false })
		assert.deepEqual(actions[1]?.options.mute, { value: 'mute', isExpression: false })
		assert.deepEqual(actions[2]?.options.level, { value: 57, isExpression: false })
		assert.deepEqual(actions[2]?.options.fadeDuration, { value: 0, isExpression: false })
		assert.deepEqual(actions[3]?.options.channelName, {
			value: '$(custom:ch1_name)',
			isExpression: false,
		})
	})
})

void describe('legacy mute option upgrade', () => {
	void it('converts wrapped v1 checkbox values into current dropdown choices', () => {
		const actions = [
			{ actionId: 'mute_input', options: { mute: { value: true, isExpression: false } } },
			{ actionId: 'mute_dca', options: { mute: { value: false, isExpression: false } } },
		]
		const result = upgradeLegacyMuteModes({} as never, { config: {}, secrets: null, actions, feedbacks: [] } as never)
		assert.equal((result.updatedActions[0]?.options.mute as { value: unknown }).value, 'mute')
		assert.equal((result.updatedActions[1]?.options.mute as { value: unknown }).value, 'unmute')
	})

	void it('also repairs raw booleans and leaves current values untouched', () => {
		const actions = [
			{ actionId: 'mute_master', options: { mute: true } },
			{ actionId: 'mute_group', options: { mute: false } },
			{ actionId: 'mute_input', options: { mute: 'toggle' } },
		]
		const result = upgradeLegacyMuteModes({} as never, { config: {}, secrets: null, actions, feedbacks: [] } as never)
		assert.equal(result.updatedActions[0]?.options.mute, 'mute')
		assert.equal(result.updatedActions[1]?.options.mute, 'unmute')
		assert.equal(result.updatedActions[2]?.options.mute, 'toggle')
	})
})
