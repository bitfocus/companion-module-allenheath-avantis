import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type ModuleInstance from '../main.js'
import { UpdateVariableDefinitions } from '../variables.js'

function variableHarness(syncEnabled: boolean) {
	let definitions: Record<string, unknown> = {}
	let values: Record<string, unknown> = {}
	const instance = {
		config: {
			midiBase: 6,
			dPackEnabled: false,
			ahNetStateSyncEnabled: syncEnabled,
			rackUfxInstalled: false,
			monoGroupCount: 0,
			stereoGroupCount: 0,
			monoFxSendCount: 0,
			stereoFxSendCount: 0,
			monoAuxCount: 0,
			stereoAuxCount: 0,
			monoMatrixCount: 0,
			stereoMatrixCount: 0,
			mSumEnabled: false,
			retrieveAllSceneNames: false,
			sceneNameRetrievalLimit: 100,
		},
		faderSyncStatus: syncEnabled ? 'Synchronizing' : 'Disabled',
		commandConnectionState: 'Offline',
		synchronizationConnectionState: syncEnabled ? 'Connecting' : 'Disabled',
		lastSceneNumber: 0,
		lastSceneName: 'Unknown',
		pendingSceneSequences: [],
		inputNameCache: [],
		inputColorCache: [],
		muteGroupStates: [],
		ufxBypassStates: [],
		ufxPluginBypassStates: [],
		consoleStripNameCache: {},
		consoleStripColorCache: {},
		ioPortInstalled: [],
		slinkRackConnected: [],
		sceneNameCache: {},
		setVariableDefinitions: (next: Record<string, unknown>) => {
			definitions = next
		},
		setVariableValues: (next: Record<string, unknown>) => {
			values = next
		},
	} as unknown as ModuleInstance
	UpdateVariableDefinitions(instance)
	return { definitions, values }
}

void describe('console synchronization variable visibility', () => {
	void it('publishes only meaningful TCP and queue variables while synchronization is disabled', () => {
		const { definitions, values } = variableHarness(false)
		assert.deepEqual(Object.keys(definitions).sort(), [
			'command_connection_state',
			'connection_status',
			'fader_sync_status',
			'last_scene_number',
			'online',
			'queued_scene_count',
			'queued_scenes',
			'synchronization_connection_state',
		])
		assert.equal(values.fader_sync_status, 'Disabled')
		assert.equal(definitions.firmware_version, undefined)
		assert.equal(definitions.fader_input_1, undefined)
	})

	void it('restores synchronization-dependent definitions when enabled', () => {
		const { definitions } = variableHarness(true)
		assert.ok(definitions.firmware_version)
		assert.ok(definitions.virtual_soundcheck_mode)
		assert.ok(definitions.fader_input_1)
		assert.ok(definitions.input_name_1)
	})
})
