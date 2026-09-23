import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import failedMigrationFixture from './fixtures/v1-migration-failed-actions.json' with { type: 'json' }
import { UpdateActions } from '../actions.js'
import ModuleInstance from '../main.js'
import type { ModuleConfig } from '../config.js'

const V1_ACTION_IDS = [
	'channel_color',
	'channel_main_assign',
	'channel_name',
	'dca_assign',
	'fader_DCA',
	'fader_fx_return',
	'fader_input',
	'fader_master',
	'fader_mono_aux',
	'fader_mono_fx_send',
	'fader_mono_group',
	'fader_mono_matrix',
	'fader_stereo_aux',
	'fader_stereo_fx_send',
	'fader_stereo_group',
	'fader_stereo_matrix',
	'mute_dca',
	'mute_fx_return',
	'mute_group',
	'mute_group_assign',
	'mute_input',
	'mute_master',
	'mute_mono_aux',
	'mute_mono_fx_send',
	'mute_mono_group',
	'mute_mono_matrix',
	'mute_stereo_aux',
	'mute_stereo_fx_send',
	'mute_stereo_group',
	'mute_stereo_matrix',
	'scene_recall',
	'send_input_to',
	'send_input_to_fx_return',
	'send_input_to_mono_aux',
	'send_input_to_mono_fx_return',
	'send_input_to_mono_matrix',
	'send_input_to_stereo_aux',
	'send_input_to_stereo_fx_return',
	'send_input_to_stereo_matrix',
] as const

const config: ModuleConfig = {
	host: '192.0.2.101',
	midiBase: 6,
	fadeUpdatesPerSecond: 20,
	dPackEnabled: false,
	inputCount: 64,
	rackUfxInstalled: false,
	ahNetStateSyncEnabled: false,
	useManualConsoleConfig: false,
	retrieveAllSceneNames: false,
	sceneNameRetrievalLimit: 100,
	monoGroupCount: 0,
	stereoGroupCount: 0,
	monoAuxCount: 0,
	stereoAuxCount: 0,
	monoMatrixCount: 0,
	stereoMatrixCount: 0,
	monoFxSendCount: 0,
	stereoFxSendCount: 0,
	mSumEnabled: false,
	faderSubscriptions: '',
}

function actionDefinitions(): Record<string, { options: Array<{ id: string }> }> {
	let definitions: Record<string, { options: Array<{ id: string }> }> = {}
	UpdateActions({
		config,
		setActionDefinitions: (value: typeof definitions) => {
			definitions = value
		},
	} as unknown as ModuleInstance)
	return definitions
}

function protocolInstance(): ModuleInstance {
	const instance = Object.create(ModuleInstance.prototype) as ModuleInstance
	instance.config = config
	instance.muteStateCache = {}
	instance.inputNameCache = {}
	instance.inputColorCache = {}
	instance.setVariableValues = () => undefined
	return instance
}

void describe('released v1.0.0 saved-configuration compatibility', () => {
	void it('retains every v1 action ID', () => {
		const definitions = actionDefinitions()
		assert.deepEqual(
			V1_ACTION_IDS.filter((id) => !definitions[id]),
			[],
		)
	})

	void it('retains the option IDs used by the production v1 configuration', () => {
		const definitions = actionDefinitions()
		const expected = {
			channel_name: ['channel', 'channelName'],
			fader_DCA: ['channel', 'level', 'fadeDuration'],
			fader_input: ['channel', 'level', 'fadeDuration'],
			fader_mono_matrix: ['channel', 'level', 'fadeDuration'],
			mute_dca: ['channel', 'mute'],
			mute_group: ['channel', 'mute'],
			mute_input: ['channel', 'mute'],
			scene_recall: ['sceneNumber'],
		}
		for (const [id, optionIds] of Object.entries(expected)) {
			assert.deepEqual(
				definitions[id]?.options.map((option) => option.id),
				optionIds,
			)
		}
	})

	void it('adds the generic strip naming action without changing the v1 input naming action', () => {
		const definitions = actionDefinitions()
		assert.deepEqual(
			definitions.channel_name?.options.map((option) => option.id),
			['channel', 'channelName'],
		)
		assert.deepEqual(
			definitions.strip_name?.options.map((option) => option.id),
			['target', 'name'],
		)
	})

	void it('directly accepts the option shapes preserved by the failed real-world v1 migration', () => {
		const definitions = actionDefinitions()
		const muteDefinition = definitions.mute_input
		const muteOption = muteDefinition?.options.find((option) => option.id === 'mute') as
			| { type?: string; allowCustom?: boolean }
			| undefined
		assert.equal(muteOption?.type, 'dropdown')
		assert.equal('allowCustom' in (muteOption ?? {}) ? muteOption.allowCustom : false, true)
		const faderDefinition = definitions.fader_input
		const fadeOption = faderDefinition?.options.find((option) => option.id === 'fadeDuration') as
			| { type?: string }
			| undefined
		assert.equal(fadeOption?.type, 'textinput')
		assert.deepEqual(
			failedMigrationFixture.actions.map((action) => {
				const options = action.options as Record<string, { value: unknown } | undefined>
				return [action.definitionId, options.mute?.value ?? options.fadeDuration?.value ?? '']
			}),
			[
				['mute_input', true],
				['mute_input', false],
				['fader_input', ''],
			],
		)
	})

	void it('encodes production v1 mute and fader options byte-for-byte', () => {
		const instance = protocolInstance()
		assert.equal(instance.buildMuteCommand({ channel: 60, mute: true }, 5)[0]?.toString('hex'), '953c7f953c00')
		assert.equal(instance.buildMuteCommand({ channel: 60, mute: false }, 5)[0]?.toString('hex'), '953c3f953c00')
		assert.equal(instance.buildFaderCommand({ channel: 60, level: '57' }, 5)[0]?.toString('hex'), 'b5633cb56217b50639')
		assert.equal(instance.buildFaderCommand({ channel: 59, level: '77' }, 9)[0]?.toString('hex'), 'b9633bb96217b9064d')
	})

	void it('preserves v1 scene bank/program encoding for all 500 scenes', () => {
		const instance = protocolInstance()
		for (let zeroBased = 0; zeroBased < 500; zeroBased++) {
			const sceneNumber = zeroBased + 1
			const expected = Buffer.from([0xb5, 0x00, Math.floor(zeroBased / 128), 0xc5, zeroBased % 128])
			assert.deepEqual(
				instance.buildSceneCommand({ sceneNumber: String(zeroBased) }, 5),
				[expected],
				`Scene ${sceneNumber}`,
			)
		}
	})

	void it('preserves representative v1 routing, naming, and color messages', () => {
		const instance = protocolInstance()
		assert.equal(
			instance.buildChannelAssignCommand({ channel: 30, assign: true }, 5)[0]?.toString('hex'),
			'b5631eb56218b5067f',
		)
		assert.equal(
			instance.buildSendLevelCommand({ srcChannel: 60, destChannel: 0, level: '57' }, 5, 0, 2)[0]?.toString('hex'),
			'f000001a50100100050d3c070039f7',
		)
		assert.equal(
			instance.buildChannelNameCommand({ channel: '30', channelName: 'Mic 1' }, 5)[0]?.toString('hex'),
			'f000001a5010010005031e4d69632031f7',
		)
		assert.equal(
			instance.buildChannelNameCommand({ channel: '30', channelName: '$1234567' }, 5)[0]?.toString('hex'),
			'f000001a5010010005031e2431323334353637f7',
		)
		assert.equal(
			instance.buildChannelColorCommand({ channel: '30', color: '7' }, 5)[0]?.toString('hex'),
			'f000001a5010010005061e07f7',
		)
	})

	void it('corrects the inherited v1 DCA assignment mapping for all 16 DCAs', () => {
		const instance = protocolInstance()
		for (let dca = 1; dca <= 16; dca++) {
			const legacyChoiceId = 0x35 + dca
			const on = instance.buildAssignCommands({ channel: 0, dcaGroup: [legacyChoiceId], assign: true }, 5, true)[0]
			const off = instance.buildAssignCommands({ channel: 0, dcaGroup: [legacyChoiceId], assign: false }, 5, true)[0]
			assert.equal(on?.toString('hex'), `b56300b56240b506${(0x3f + dca).toString(16).padStart(2, '0')}`)
			assert.equal(off?.toString('hex'), `b56300b56240b506${(dca - 1).toString(16).padStart(2, '0')}`)
		}
	})

	void it('corrects the inherited v1 Mute Group assignment mapping for all 8 groups', () => {
		const instance = protocolInstance()
		for (let group = 1; group <= 8; group++) {
			const legacyChoiceId = 0x45 + group
			const on = instance.buildAssignCommands({ channel: 0, muteGroup: [legacyChoiceId], assign: true }, 5, false)[0]
			const off = instance.buildAssignCommands({ channel: 0, muteGroup: [legacyChoiceId], assign: false }, 5, false)[0]
			assert.equal(on?.toString('hex'), `b56300b56240b506${(0x4f + group).toString(16).padStart(2, '0')}`)
			assert.equal(off?.toString('hex'), `b56300b56240b506${(0x0f + group).toString(16).padStart(2, '0')}`)
		}
	})
})
