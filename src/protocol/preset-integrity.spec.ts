import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { GetPresetDefinitions, GetPresetSections } from '../presets.js'
import { UpdateActions } from '../actions.js'
import { UpdateFeedbacks } from '../feedbacks.js'
import type ModuleInstance from '../main.js'
import type { ModuleConfig } from '../config.js'

function referencedPresetIds(inputCount: number, rackUfxInstalled: boolean): string[] {
	return GetPresetSections(inputCount, rackUfxInstalled).flatMap((section) =>
		section.definitions.flatMap((definition) =>
			typeof definition !== 'string' && definition.type === 'simple' ? definition.presets : [],
		),
	)
}

function collectIds(value: unknown, key: 'actionId' | 'feedbackId', result = new Set<string>()): Set<string> {
	if (Array.isArray(value)) {
		for (const item of value) collectIds(item, key, result)
	} else if (value && typeof value === 'object') {
		for (const [entryKey, entryValue] of Object.entries(value)) {
			if (entryKey === key && typeof entryValue === 'string') result.add(entryValue)
			else collectIds(entryValue, key, result)
		}
	}
	return result
}

function publicDefinitions(rackUfxInstalled: boolean): {
	actions: Record<string, { description?: string }>
	feedbacks: Record<string, unknown>
} {
	let actions: Record<string, unknown> = {}
	let feedbacks: Record<string, unknown> = {}
	const config = {
		host: '127.0.0.1',
		midiBase: 1,
		fadeUpdatesPerSecond: 20,
		dPackEnabled: true,
		inputCount: 96,
		rackUfxInstalled,
		ahNetStateSyncEnabled: true,
		useManualConsoleConfig: false,
		retrieveAllSceneNames: true,
		sceneNameRetrievalLimit: 100,
		monoGroupCount: 2,
		stereoGroupCount: 4,
		monoAuxCount: 2,
		stereoAuxCount: 7,
		monoMatrixCount: 2,
		stereoMatrixCount: 2,
		monoFxSendCount: 0,
		stereoFxSendCount: 4,
		mSumEnabled: true,
		faderSubscriptions: '',
	} satisfies ModuleConfig
	const instance = {
		config,
		setActionDefinitions: (definitions: Record<string, unknown>) => {
			actions = definitions
		},
		setFeedbackDefinitions: (definitions: Record<string, unknown>) => {
			feedbacks = definitions
		},
	} as unknown as ModuleInstance
	UpdateActions(instance)
	UpdateFeedbacks(instance)
	return { actions, feedbacks } as {
		actions: Record<string, { description?: string }>
		feedbacks: Record<string, unknown>
	}
}

void describe('preset structure integrity', () => {
	for (const scenario of [
		{ inputCount: 64, rackUfxInstalled: false, sceneNameLimit: 0 },
		{ inputCount: 96, rackUfxInstalled: true, sceneNameLimit: 100 },
	]) {
		void it(`contains every referenced preset for ${scenario.inputCount} inputs and RackUltraFX ${scenario.rackUfxInstalled ? 'enabled' : 'disabled'}`, () => {
			const definitions = GetPresetDefinitions(scenario.inputCount, scenario.rackUfxInstalled, scenario.sceneNameLimit)
			const missing = referencedPresetIds(scenario.inputCount, scenario.rackUfxInstalled).filter(
				(id) => !definitions[id],
			)
			assert.deepEqual(missing, [])
		})
	}

	for (const rackUfxInstalled of [false, true]) {
		void it(`references only available actions and feedbacks with RackUltraFX ${rackUfxInstalled ? 'enabled' : 'disabled'}`, () => {
			const presets = GetPresetDefinitions(96, rackUfxInstalled, 100)
			const publicIds = publicDefinitions(rackUfxInstalled)
			const missingActions = [...collectIds(presets, 'actionId')].filter((id) => !(id in publicIds.actions))
			const missingFeedbacks = [...collectIds(presets, 'feedbackId')].filter((id) => !(id in publicIds.feedbacks))
			assert.deepEqual(missingActions, [])
			assert.deepEqual(missingFeedbacks, [])
			const actionsWithoutDescriptions = Object.entries(publicIds.actions)
				.filter(([, definition]) => !definition.description?.trim())
				.map(([id]) => id)
			assert.deepEqual(actionsWithoutDescriptions, [])
		})
	}
})
