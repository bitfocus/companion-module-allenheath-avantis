import {
	type CompanionActionDefinition,
	type CompanionActionDefinitions,
	type CompanionActionEvent,
	type CompanionActionSchema,
	type CompanionOptionValues,
	type DropdownChoice,
} from '@companion-module/base'
import avantisConfig from './avantisconfig.json' with { type: 'json' }
import fader from './fader.json' with { type: 'json' }
import type ModuleInstance from './main.js'
import { getChannelCapacities, getConfiguredMixLayout } from './config.js'
import {
	UFX_GLOBAL_KEY_CHOICES,
	UFX_GLOBAL_SCALE_CHOICES,
	UFX_RETURN_COUNT,
	UFX_RETURN_FIRST_CHANNEL,
	UFX_SEND_COUNT,
	UFX_SEND_FIRST_CHANNEL,
} from './protocol/ufx.js'
import { VIRTUAL_SOUNDCHECK_MODE_CHOICES } from './protocol/virtual-soundcheck.js'
import { MMC_TRANSPORT_CHOICES } from './protocol/mmc.js'
import { GLOBAL_TEMPO_MAX_BPM, GLOBAL_TEMPO_MIN_BPM } from './protocol/global-tempo.js'
import { UFX_BYPASS_COUNT } from './protocol/ufx-bypass.js'
import { buildConsoleFaderTargets } from './protocol/console-fader-sync.js'

type ChoiceGroup = {
	name: string
	offset: number
	values: DropdownChoice[]
}

export type ActionsSchema = Record<string, CompanionActionSchema<CompanionOptionValues>>

function buildChoices(name: string, key: string, quantity: number, offset: number): ChoiceGroup {
	const values: DropdownChoice[] = []

	for (let i = 1; i <= quantity; i++) {
		values.push({ label: `${key} ${i}`, id: i + offset })
	}

	return {
		name,
		offset,
		values,
	}
}

function dispatchAction(self: ModuleInstance, action: CompanionActionEvent): void {
	self.action({
		action: action.actionId,
		options: action.options,
	})
}

function resolvedSceneValue(value: unknown): string {
	let raw = ''
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		raw = String(value)
	} else if (value && typeof value === 'object' && 'value' in value) {
		const wrappedValue = (value as { value?: unknown }).value
		if (typeof wrappedValue === 'string' || typeof wrappedValue === 'number' || typeof wrappedValue === 'boolean') {
			raw = String(wrappedValue)
		}
	}
	return raw.trim()
}

export function UpdateActions(self: ModuleInstance): void {
	const actions: CompanionActionDefinitions = {}
	const avantis = avantisConfig.config
	const capacities = getChannelCapacities(self.config)

	const inputChannels = buildChoices('Input Channel', 'CH', capacities.inputCount, -1)
	const scenes = buildChoices('Scene', 'SCENE', avantis.sceneCount, -1)
	const dca = buildChoices('DCA', 'DCA', avantis.dcaCount, 0x35)
	const muteGroups = buildChoices('Mute Group', 'MUTE', avantis.muteGroupCount, 0x45)
	const mainMix = buildChoices('Main Mix', 'MAIN', avantis.mainsCount, 0x2f)
	const monoGroups = buildChoices('Mono Group', 'Mono Group', capacities.monoBusCount, -1)
	const stereoGroups = buildChoices('Stereo Group', 'Stereo Group', capacities.stereoBusCount, 0x3f)
	const monoAuxes = buildChoices('Mono Aux', 'Mono Aux', capacities.monoBusCount, -1)
	const stereoAuxes = buildChoices('Stereo Aux', 'Stereo Aux', capacities.stereoBusCount, 0x3f)
	const monoMatrices = buildChoices('Mono Matrix', 'Mono Matrix', capacities.monoBusCount, -1)
	const stereoMatrices = buildChoices('Stereo Matrix', 'Stereo Matrix', capacities.stereoBusCount, 0x3f)
	const monoFxSends = buildChoices('Mono FX Send', 'Mono FX Send', avantis.mono.fxSendCount, -1)
	const stereoFxSends = buildChoices('Stereo FX Send', 'Stereo FX Send', avantis.stereo.fxSendCount, 0x0f)
	const fxReturns = buildChoices('FX Return', 'FX Return', avantis.fxReturnCount, 0x1f)
	const ufxSends = buildChoices('RackUltraFX Send', 'UFX Send', UFX_SEND_COUNT, UFX_SEND_FIRST_CHANNEL - 1)
	const ufxReturns = buildChoices('RackUltraFX Return', 'UFX Return', UFX_RETURN_COUNT, UFX_RETURN_FIRST_CHANNEL - 1)

	const faderChoices: ChoiceGroup = {
		name: 'Fader Level',
		offset: -1,
		values: fader.level.map(([dbValue, hexValue]) => ({
			label: `${dbValue} dB`,
			id: parseInt(hexValue, 16),
		})),
	}

	const colorChoices: ChoiceGroup = {
		name: 'Color',
		offset: -1,
		values: [
			{ label: 'Off', id: 0 },
			{ label: 'Red', id: 1 },
			{ label: 'Green', id: 2 },
			{ label: 'Yellow', id: 3 },
			{ label: 'Blue', id: 4 },
			{ label: 'Purple', id: 5 },
			{ label: 'Lt Blue', id: 6 },
			{ label: 'White', id: 7 },
		],
	}
	const stripNameChoices: DropdownChoice[] = [
		...inputChannels.values.map((choice) => ({ label: choice.label, id: `0:${choice.id}` })),
		...buildConsoleFaderTargets(getConfiguredMixLayout(self.config), self.config.rackUfxInstalled === true).map(
			(target) => ({ label: target.label, id: `${target.midiOffset}:${target.midiChannel}` }),
		),
	]

	const muteActionBuilder = (label: string, choice: ChoiceGroup): CompanionActionDefinition => ({
		name: label,
		description: `Mute, unmute, or toggle one ${choice.name.toLowerCase()}.`,
		options: [
			{
				type: 'dropdown',
				label: choice.name,
				id: 'channel',
				default: 1 + choice.offset,
				choices: choice.values,
				minChoicesForSearch: 0,
			},
			{
				type: 'dropdown',
				label: 'Mute',
				id: 'mute',
				default: 'mute',
				allowCustom: true,
				regex: '/^(mute|unmute|toggle|true|false)$/',
				choices: [
					{ label: 'Mute', id: 'mute' },
					{ label: 'Unmute', id: 'unmute' },
					{ label: 'Toggle', id: 'toggle' },
				],
				minChoicesForSearch: 0,
			},
		],
		callback: (action) => dispatchAction(self, action),
	})

	const faderActionBuilder = (label: string, choice: ChoiceGroup): CompanionActionDefinition => ({
		name: label,
		description: `Set one ${choice.name.toLowerCase()} fader to an exact level, optionally fading over time.`,
		options: [
			{
				type: 'dropdown',
				label: choice.name,
				id: 'channel',
				default: 1 + choice.offset,
				choices: choice.values,
				minChoicesForSearch: 0,
			},
			{
				type: 'dropdown',
				label: faderChoices.name,
				id: 'level',
				default: 1 + faderChoices.offset,
				choices: faderChoices.values,
				minChoicesForSearch: 0,
			},
			{
				type: 'textinput',
				label: 'Fade Duration (seconds)',
				id: 'fadeDuration',
				default: '0',
				regex: '/^(?:|(?:\\d+(?:\\.\\d+)?))$/',
				tooltip: 'Optional smooth fade duration from 0 to 20 seconds; blank or 0 = immediate.',
			},
		],
		callback: (action) => dispatchAction(self, action),
	})

	const relativeFaderActionBuilder = (label: string, choice: ChoiceGroup): CompanionActionDefinition => ({
		name: label,
		description: `Move one ${choice.name.toLowerCase()} fader up or down by a relative dB amount.`,
		options: [
			{
				type: 'dropdown',
				label: choice.name,
				id: 'channel',
				default: 1 + choice.offset,
				choices: choice.values,
				minChoicesForSearch: 0,
			},
			{
				type: 'dropdown',
				label: 'Direction',
				id: 'direction',
				default: 'increase',
				choices: [
					{ label: 'Increase', id: 'increase' },
					{ label: 'Decrease', id: 'decrease' },
				],
				minChoicesForSearch: 0,
			},
			{
				type: 'number',
				label: 'Amount (dB)',
				id: 'amountDb',
				min: 0.5,
				max: 60,
				step: 0.5,
				default: 3,
			},
			{
				type: 'number',
				label: 'Fade Duration (seconds)',
				id: 'fadeDuration',
				min: 0,
				max: 20,
				step: 0.5,
				default: 0,
				tooltip: 'Optional smooth fade duration; 0 = immediate.',
			},
		],
		callback: (action) => dispatchAction(self, action),
	})

	const sendLevelActionBuilder = (
		label: string,
		srcChoice: ChoiceGroup,
		destChoice: ChoiceGroup,
	): CompanionActionDefinition => ({
		name: label,
		description: `Set the send level from one or more ${srcChoice.name.toLowerCase()}s to a ${destChoice.name.toLowerCase()}.`,
		options: [
			{
				type: 'multidropdown',
				label: srcChoice.name,
				id: 'srcChannel',
				default: [],
				choices: srcChoice.values,
				minChoicesForSearch: 0,
			},
			{
				type: 'dropdown',
				label: destChoice.name,
				id: 'destChannel',
				default: 1 + destChoice.offset,
				choices: destChoice.values,
				minChoicesForSearch: 0,
			},
			{
				type: 'dropdown',
				label: faderChoices.name,
				id: 'level',
				default: 1 + faderChoices.offset,
				choices: faderChoices.values,
				minChoicesForSearch: 0,
			},
		],
		callback: (action) => dispatchAction(self, action),
	})

	const sendLevelActionNumberBuilder = (
		label: string,
		srcChoice: ChoiceGroup,
		destChoice: ChoiceGroup,
	): CompanionActionDefinition => ({
		name: label,
		description: `Set a send level from one ${srcChoice.name.toLowerCase()} to a ${destChoice.name.toLowerCase()} using the legacy numbered scale.`,
		options: [
			{
				type: 'dropdown',
				label: srcChoice.name,
				id: 'srcChannel',
				default: 1 + srcChoice.offset,
				choices: srcChoice.values,
				minChoicesForSearch: 0,
			},
			{
				type: 'dropdown',
				label: destChoice.name,
				id: 'destChannel',
				default: 1 + destChoice.offset,
				choices: destChoice.values,
				minChoicesForSearch: 0,
			},
			{
				type: 'number',
				label: 'Level (0-20)',
				id: 'level-int',
				default: 0,
				min: 0,
				max: 19,
				step: 1,
			},
		],
		callback: (action) => dispatchAction(self, action),
	})

	const assignActionBuilder = (
		label: string,
		srcChoice: ChoiceGroup,
		destId: string,
		destChoice: ChoiceGroup,
	): CompanionActionDefinition => ({
		name: label,
		description: `Assign or unassign one ${srcChoice.name.toLowerCase()} to the selected ${destChoice.name.toLowerCase()} destinations.`,
		options: [
			{
				type: 'dropdown',
				label: srcChoice.name,
				id: 'channel',
				default: 1 + srcChoice.offset,
				choices: srcChoice.values,
				minChoicesForSearch: 0,
			},
			{
				type: 'multidropdown',
				label: destChoice.name,
				id: destId,
				default: [],
				choices: destChoice.values,
			},
			{
				type: 'checkbox',
				label: 'Assign',
				id: 'assign',
				default: true,
			},
		],
		callback: (action) => dispatchAction(self, action),
	})

	actions['mute_input'] = muteActionBuilder('Input: Mute', inputChannels)
	actions['mute_master'] = muteActionBuilder('Main Mix: Mute', mainMix)
	actions['mute_mono_group'] = muteActionBuilder('Mono Group: Mute', monoGroups)
	actions['mute_stereo_group'] = muteActionBuilder('Stereo Group: Mute', stereoGroups)
	actions['mute_mono_aux'] = muteActionBuilder('Mono Aux: Mute', monoAuxes)
	actions['mute_stereo_aux'] = muteActionBuilder('Stereo Aux: Mute', stereoAuxes)
	actions['mute_mono_matrix'] = muteActionBuilder('Mono Matrix: Mute', monoMatrices)
	actions['mute_stereo_matrix'] = muteActionBuilder('Stereo Matrix: Mute', stereoMatrices)
	actions['mute_mono_fx_send'] = muteActionBuilder('Mono FX Send: Mute', monoFxSends)
	actions['mute_stereo_fx_send'] = muteActionBuilder('Stereo FX Send: Mute', stereoFxSends)
	actions['mute_fx_return'] = muteActionBuilder('FX Return: Mute', fxReturns)
	actions['mute_group'] = muteActionBuilder('Mute Group: Mute', muteGroups)
	actions['mute_dca'] = muteActionBuilder('DCA: Mute', dca)

	actions['fader_input'] = faderActionBuilder('Input: Set Fader Level', inputChannels)
	actions['fader_mono_group'] = faderActionBuilder('Mono Group: Set Fader Level', monoGroups)
	actions['fader_stereo_group'] = faderActionBuilder('Stereo Group: Set Fader Level', stereoGroups)
	actions['fader_mono_aux'] = faderActionBuilder('Mono Aux: Set Fader Level', monoAuxes)
	actions['fader_stereo_aux'] = faderActionBuilder('Stereo Aux: Set Fader Level', stereoAuxes)
	actions['fader_mono_matrix'] = faderActionBuilder('Mono Matrix: Set Fader Level', monoMatrices)
	actions['fader_stereo_matrix'] = faderActionBuilder('Stereo Matrix: Set Fader Level', stereoMatrices)
	actions['fader_mono_fx_send'] = faderActionBuilder('Mono FX Send: Set Fader Level', monoFxSends)
	actions['fader_stereo_fx_send'] = faderActionBuilder('Stereo FX Send: Set Fader Level', stereoFxSends)
	actions['fader_master'] = faderActionBuilder('Main Mix: Set Fader Level', mainMix)
	actions['fader_fx_return'] = faderActionBuilder('FX Return: Set Fader Level', fxReturns)
	actions['fader_DCA'] = faderActionBuilder('DCA: Set Fader Level', dca)
	actions['relative_fader_input'] = relativeFaderActionBuilder('Input: Move Fader Relative', inputChannels)
	actions['relative_fader_mono_group'] = relativeFaderActionBuilder('Mono Group: Move Fader Relative', monoGroups)
	actions['relative_fader_stereo_group'] = relativeFaderActionBuilder('Stereo Group: Move Fader Relative', stereoGroups)
	actions['relative_fader_mono_aux'] = relativeFaderActionBuilder('Mono Aux: Move Fader Relative', monoAuxes)
	actions['relative_fader_stereo_aux'] = relativeFaderActionBuilder('Stereo Aux: Move Fader Relative', stereoAuxes)
	actions['relative_fader_mono_matrix'] = relativeFaderActionBuilder('Mono Matrix: Move Fader Relative', monoMatrices)
	actions['relative_fader_stereo_matrix'] = relativeFaderActionBuilder(
		'Stereo Matrix: Move Fader Relative',
		stereoMatrices,
	)
	actions['relative_fader_mono_fx_send'] = relativeFaderActionBuilder('Mono FX Send: Move Fader Relative', monoFxSends)
	actions['relative_fader_stereo_fx_send'] = relativeFaderActionBuilder(
		'Stereo FX Send: Move Fader Relative',
		stereoFxSends,
	)
	actions['relative_fader_master'] = relativeFaderActionBuilder('Main Mix: Move Fader Relative', mainMix)
	actions['relative_fader_fx_return'] = relativeFaderActionBuilder('FX Return: Move Fader Relative', fxReturns)
	actions['relative_fader_DCA'] = relativeFaderActionBuilder('DCA: Move Fader Relative', dca)

	if (self.config.rackUfxInstalled === true) {
		actions['mute_ufx_send'] = muteActionBuilder('RackUltraFX Send: Mute', ufxSends)
		actions['mute_ufx_return'] = muteActionBuilder('RackUltraFX Return: Mute', ufxReturns)
		actions['fader_ufx_send'] = faderActionBuilder('RackUltraFX Send: Set Fader Level', ufxSends)
		actions['fader_ufx_return'] = faderActionBuilder('RackUltraFX Return: Set Fader Level', ufxReturns)
		actions['relative_fader_ufx_send'] = relativeFaderActionBuilder('RackUltraFX Send: Move Fader Relative', ufxSends)
		actions['relative_fader_ufx_return'] = relativeFaderActionBuilder(
			'RackUltraFX Return: Move Fader Relative',
			ufxReturns,
		)
	}

	actions['dca_assign'] = assignActionBuilder('Input: Assign to DCA', inputChannels, 'dcaGroup', dca)
	actions['mute_group_assign'] = assignActionBuilder(
		'Input: Assign to Mute Group',
		inputChannels,
		'muteGroup',
		muteGroups,
	)
	actions['channel_main_assign'] = assignActionBuilder('Input: Assign to Main Mix', inputChannels, 'mainMix', mainMix)

	actions['channel_name'] = {
		name: 'Input: Set Name',
		description: 'Set the name of one input channel using text, variables, or expressions.',
		options: [
			{
				type: 'dropdown',
				label: inputChannels.name,
				id: 'channel',
				default: 1 + inputChannels.offset,
				choices: inputChannels.values,
				minChoicesForSearch: 0,
			},
			{
				type: 'textinput',
				label: 'Name of the Channel',
				id: 'channelName',
				default: '',
				useVariables: true,
				tooltip: 'Up to 8 characters. Companion variables are supported.',
			},
		],
		callback: (action) => dispatchAction(self, action),
	}

	actions['strip_name'] = {
		name: 'Strip: Set Name',
		description: 'Set the name of an input, bus, main, matrix, FX strip, DCA, or RackUltraFX strip.',
		options: [
			{
				type: 'dropdown',
				label: 'Strip',
				id: 'target',
				default: '0:0',
				choices: stripNameChoices,
				minChoicesForSearch: 0,
			},
			{
				type: 'textinput',
				label: 'Name',
				id: 'name',
				default: '',
				useVariables: true,
				tooltip: 'Up to 8 printable ASCII characters. Companion variables are supported.',
			},
		],
		callback: (action) => dispatchAction(self, action),
	}

	actions['channel_color'] = {
		name: 'Input: Set Color',
		description: 'Set the display color of one input channel.',
		options: [
			{
				type: 'dropdown',
				label: inputChannels.name,
				id: 'channel',
				default: 1 + inputChannels.offset,
				choices: inputChannels.values,
				minChoicesForSearch: 0,
			},
			{
				type: 'dropdown',
				label: colorChoices.name,
				id: 'color',
				default: 1 + colorChoices.offset,
				choices: colorChoices.values,
				minChoicesForSearch: 0,
			},
		],
		callback: (action) => dispatchAction(self, action),
	}

	actions['console_sync_refresh_names_colors'] = {
		name: 'Console Sync: Refresh Names and Colors',
		description:
			'Request current names and colors for all inputs and configured console strips, paced to avoid flooding the console.',
		options: [],
		callback: () => self.synchronizeInputNamesAndColors(),
	}

	actions['console_sync_refresh_scene_names'] = {
		name: 'Console Sync: Refresh Scene Names',
		description:
			'Request a fresh scene-name directory from the console for the configured retrieval range without reconnecting.',
		options: [],
		callback: () => self.refreshSceneNames(),
	}

	actions['scene_recall'] = {
		name: 'Scenes: Recall Scene',
		description: 'Recall one Avantis scene by selecting its scene number.',
		options: [
			{
				type: 'dropdown',
				label: scenes.name,
				id: 'sceneNumber',
				default: 1 + scenes.offset,
				choices: scenes.values,
				minChoicesForSearch: 0,
			},
		],
		callback: (action) => dispatchAction(self, action),
	}

	actions['scene_recall_variable'] = {
		name: 'Scenes: Recall from Variable or Expression',
		description: 'Recall Scene 1-500 using a number, Companion variable, or expression result',
		options: [
			{
				type: 'textinput',
				label: 'Scene Number',
				id: 'sceneNumber',
				default: '1',
				useVariables: true,
				tooltip: 'Enter a scene number from 1 to 500 or a Companion variable that resolves to one.',
			},
		],
		callback: (action) => {
			const sceneNumber = resolvedSceneValue(action.options.sceneNumber)
			self.recallSceneNumber(sceneNumber)
		},
	}

	actions['scene_recall_name'] = {
		name: 'Scenes: Recall Scene by Name',
		description: 'Recall one scene by an exact name from the synchronized Avantis scene directory.',
		options: [
			{
				type: 'textinput',
				label: 'Scene Name',
				id: 'sceneName',
				default: '',
				useVariables: true,
				description: 'Enter the complete scene name. Capitalization and surrounding spaces are ignored.',
				tooltip:
					'Requires Console Sync and Retrieve Scene Names. The scene must be within the configured retrieval range. Duplicate names are rejected for safety.',
			},
		],
		callback: (action) => {
			self.recallSceneName(resolvedSceneValue(action.options.sceneName))
		},
	}

	actions['scene_recall_sequence'] = {
		name: 'Scenes: Recall or Queue Sequence',
		description:
			'Recall a comma-separated list of scenes in order, or replace the sequence held for the Avantis next TCP connection',
		options: [
			{
				type: 'textinput',
				label: 'Scene Numbers',
				id: 'scenes',
				default: '1',
				useVariables: true,
				description:
					'Enter scene numbers from 1 to 500 separated by commas. They recall from left to right. Example: 12, 25, 40, 63',
				tooltip:
					'Comma-separated scene numbers only. Spaces are optional. Companion variables and expressions may resolve to the complete list.',
			},
			{
				type: 'number',
				label: 'Delay after connection (milliseconds)',
				id: 'initialDelayMs',
				description: 'Used only when the sequence waits for a console connection. Online recalls begin immediately.',
				default: 1000,
				min: 0,
				max: 120000,
			},
			{
				type: 'number',
				label: 'Delay between scene recalls (milliseconds)',
				id: 'intervalMs',
				default: 1000,
				min: 100,
				max: 60000,
			},
			{
				type: 'dropdown',
				label: 'When to recall',
				id: 'when',
				default: 'now-or-connect',
				choices: [
					{ id: 'now-or-connect', label: 'Now if connected; otherwise at next connection' },
					{ id: 'next-connect', label: 'Always wait for the next connection' },
				],
			},
		],
		callback: (action) => {
			const resolved = resolvedSceneValue(action.options.scenes)
			self.queueSceneSequence(
				resolved.split(',').map((value) => value.trim()),
				Number(action.options.initialDelayMs),
				Number(action.options.intervalMs),
				action.options.when === 'next-connect',
			)
		},
	}

	actions['scene_recall_name_sequence'] = {
		name: 'Scenes: Recall or Queue Scene Names',
		description:
			'Recall a comma-separated list of exact scene names in order, or replace the sequence held for the Avantis next TCP connection.',
		options: [
			{
				type: 'textinput',
				label: 'Scene Names',
				id: 'sceneNames',
				default: '',
				useVariables: true,
				description: 'Enter complete scene names separated by commas. Example: Sunday AM, Lobby, Overflow',
				tooltip:
					'Requires Console Sync and Retrieve Scene Names. Every name is validated before the queue is replaced or any scene is recalled. Scene names cannot contain commas.',
			},
			{
				type: 'number',
				label: 'Delay after connection (milliseconds)',
				id: 'initialDelayMs',
				description: 'Used only when the sequence waits for a console connection. Online recalls begin immediately.',
				default: 1000,
				min: 0,
				max: 120000,
			},
			{
				type: 'number',
				label: 'Delay between scene recalls (milliseconds)',
				id: 'intervalMs',
				default: 1000,
				min: 100,
				max: 60000,
			},
			{
				type: 'dropdown',
				label: 'When to recall',
				id: 'when',
				default: 'now-or-connect',
				choices: [
					{ id: 'now-or-connect', label: 'Now if connected; otherwise at next connection' },
					{ id: 'next-connect', label: 'Always wait for the next connection' },
				],
			},
			{
				type: 'dropdown',
				label: 'Invalid or ambiguous names',
				id: 'invalidNames',
				default: 'skip',
				choices: [
					{ id: 'skip', label: 'Skip invalid names and continue' },
					{ id: 'stop', label: 'Reject the entire queue' },
				],
			},
		],
		callback: (action) => {
			const resolved = resolvedSceneValue(action.options.sceneNames)
			self.queueSceneNameSequence(
				resolved.split(',').map((value) => value.trim()),
				Number(action.options.initialDelayMs),
				Number(action.options.intervalMs),
				action.options.when === 'next-connect',
				action.options.invalidNames !== 'stop',
			)
		},
	}

	actions['scene_queue_clear'] = {
		name: 'Scenes: Clear Queue',
		description: 'Cancel scene sequences waiting in this Avantis connection',
		options: [],
		callback: () => self.clearSceneQueue(),
	}

	actions['raw_midi'] = {
		name: 'Advanced: Send Raw MIDI Command',
		description:
			'Send exact MIDI bytes over this Avantis connection. The module does not alter the MIDI channel or append any bytes.',
		options: [
			{
				type: 'textinput',
				label: 'MIDI Hex Command',
				id: 'command',
				default: '',
				useVariables: true,
				description:
					'Enter 1-1024 MIDI bytes as two-digit hexadecimal pairs. Use optional spaces, for example B1 0A 7F or B10A7F. SysEx must be one complete F0 ... F7 message.',
				tooltip:
					'Only hexadecimal byte pairs and spaces are accepted. MIDI data bytes must be 00-7F. Variables and expressions may resolve to the complete command.',
			},
		],
		callback: (action) => self.sendRawMidiCommand(resolvedSceneValue(action.options.command)),
	}

	for (const choice of MMC_TRANSPORT_CHOICES) {
		const actionId = `mmc_${choice.label.toLowerCase().replaceAll(' ', '_')}`
		actions[actionId] = {
			name: `MMC Transport: ${choice.label}`,
			description: `Send the documented MMC ${choice.label} transport command`,
			options: [],
			callback: () => self.sendMmcTransport(choice.id),
		}
	}

	actions['usb_audio_record_toggle'] = {
		name: 'USB Play/Record: Record Toggle',
		description: 'Start or stop the native USB recorder from synchronized recorder state. This never sends MMC.',
		options: [],
		callback: () => self.toggleUsbRecorder(),
	}
	actions['usb_audio_record_start'] = {
		name: 'USB Play/Record: Record Start',
		description: 'Start the native built-in USB recorder. This is separate from MMC Record.',
		options: [],
		callback: () => self.startUsbRecorder(),
	}
	actions['usb_audio_record_stop'] = {
		name: 'USB Play/Record: Record Stop',
		description: 'Stop the native built-in USB recorder. This is separate from MMC Stop.',
		options: [],
		callback: () => self.stopUsbRecorder(),
	}

	/* These are native Avantis USB Play/Record controls, not MMC transport commands. */
	actions['usb_audio_play_pause'] = {
		name: 'USB Play/Record: Play/Pause',
		description: 'Pause or resume native USB playback using the synchronized console playback state.',
		options: [],
		callback: () => self.toggleUsbPlayback(),
	}
	actions['usb_audio_playback_stop'] = {
		name: 'USB Play/Record: Stop',
		description: 'Stop native playback from the built-in USB Play/Record screen.',
		options: [],
		callback: () => self.stopUsbPlayback(),
	}

	actions['virtual_soundcheck_mode'] = {
		name: 'Virtual Soundcheck: Set Mode',
		description: 'Set the console to Inactive, Record Send, or Virtual Soundcheck using AH-Net',
		options: [
			{
				type: 'dropdown',
				label: 'Mode',
				id: 'mode',
				default: 0,
				choices: [...VIRTUAL_SOUNDCHECK_MODE_CHOICES],
				minChoicesForSearch: 0,
			},
		],
		callback: (action) => dispatchAction(self, action),
	}

	actions['global_tap_tempo'] = {
		name: 'Global Tempo: Tap',
		description: `Tap the Avantis Global Tempo. The first press starts timing; following presses set ${GLOBAL_TEMPO_MIN_BPM}-${GLOBAL_TEMPO_MAX_BPM} BPM over AH-Net.`,
		options: [],
		callback: () => self.tapGlobalTempo(),
	}

	actions['global_set_tempo_bpm'] = {
		name: 'Global Tempo: Set BPM',
		description: `Set the Avantis Global Tempo directly from a fixed number, Companion variable, or expression (${GLOBAL_TEMPO_MIN_BPM}-${GLOBAL_TEMPO_MAX_BPM} BPM).`,
		options: [
			{
				type: 'textinput',
				label: 'Tempo (BPM)',
				id: 'bpm',
				default: '120',
				useVariables: true,
				tooltip: 'Enter 20-300, or use a Companion variable/expression that resolves to a number in that range.',
			},
		],
		callback: (action) => self.setGlobalTempoBpm(resolvedSceneValue(action.options.bpm)),
	}

	if (self.config.rackUfxInstalled === true) {
		actions['ufx_bypass'] = {
			name: 'RackUltraFX: Set Unit Bypass',
			description: 'Bypass, enable, or toggle one RackUltraFX unit using AH-Net.',
			options: [
				{
					type: 'dropdown',
					label: 'UFX Unit',
					id: 'unit',
					default: 1,
					choices: Array.from({ length: UFX_BYPASS_COUNT }, (_, index) => ({
						id: index + 1,
						label: `UFX ${index + 1}`,
					})),
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Bypass State',
					id: 'mode',
					default: 'toggle',
					choices: [
						{ id: 'bypass', label: 'Bypass' },
						{ id: 'enable', label: 'Enable' },
						{ id: 'toggle', label: 'Toggle' },
					],
					minChoicesForSearch: 0,
				},
			],
			callback: (action) => {
				const unit = Number(action.options.unit)
				const mode = typeof action.options.mode === 'string' ? action.options.mode : 'toggle'
				const bypassed = mode === 'bypass' || (mode === 'toggle' && self.ufxBypassStates[unit - 1] !== true)
				self.setUfxBypass(unit, bypassed)
			},
		}
		actions['ufx_bypass_all'] = {
			name: 'RackUltraFX: Bypass All Units',
			description: 'Bypass all eight RackUltraFX units.',
			options: [],
			callback: () => self.setAllUfxBypass('bypass'),
		}
		actions['ufx_plugin_bypass'] = {
			name: 'RackUltraFX: Set Plugin Bypass',
			description: 'Bypass, enable, or toggle the plugin/algorithm inside a RackUltraFX unit.',
			options: [
				{
					type: 'dropdown',
					label: 'UFX Unit',
					id: 'unit',
					default: 1,
					choices: Array.from({ length: UFX_BYPASS_COUNT }, (_, index) => ({
						id: index + 1,
						label: `UFX ${index + 1}`,
					})),
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Plugin Bypass State',
					id: 'mode',
					default: 'toggle',
					choices: [
						{ id: 'bypass', label: 'Bypass' },
						{ id: 'enable', label: 'Enable' },
						{ id: 'toggle', label: 'Toggle' },
					],
					minChoicesForSearch: 0,
				},
			],
			callback: (action) => {
				const unit = Number(action.options.unit)
				const mode = typeof action.options.mode === 'string' ? action.options.mode : 'toggle'
				const bypassed = mode === 'bypass' || (mode === 'toggle' && self.ufxPluginBypassStates[unit - 1] !== true)
				self.setUfxPluginBypass(unit, bypassed)
			},
		}
		actions['ufx_toggle_all_plugin_bypass'] = {
			name: 'RackUltraFX: Toggle Bypass All Plugins',
			description: 'Enable all UFX plugins when every plugin is bypassed; otherwise bypass all eight plugins.',
			options: [],
			callback: () => self.setAllUfxPluginBypass('toggle'),
		}
		actions['ufx_enable_all'] = {
			name: 'RackUltraFX: Enable All Units',
			description: 'Remove bypass from all eight RackUltraFX units.',
			options: [],
			callback: () => self.setAllUfxBypass('enable'),
		}
		actions['ufx_toggle_bypass_all'] = {
			name: 'RackUltraFX: Toggle Bypass All Units',
			description: 'Enable all units when every unit is bypassed; otherwise bypass all eight units.',
			options: [],
			callback: () => self.setAllUfxBypass('toggle'),
		}

		actions['ufx_global_key'] = {
			name: 'RackUltraFX: Set Global Key',
			description: 'Set the global musical key for all UFX units',
			options: [
				{
					type: 'dropdown',
					label: 'Key',
					id: 'key',
					default: 0,
					choices: UFX_GLOBAL_KEY_CHOICES,
					minChoicesForSearch: 0,
				},
			],
			callback: (action) => dispatchAction(self, action),
		}

		actions['ufx_global_scale'] = {
			name: 'RackUltraFX: Set Global Scale',
			description: 'Set the global Major, Minor, or Chromatic scale for all UFX units',
			options: [
				{
					type: 'dropdown',
					label: 'Scale',
					id: 'scale',
					default: 0,
					choices: UFX_GLOBAL_SCALE_CHOICES,
					minChoicesForSearch: 0,
				},
			],
			callback: (action) => dispatchAction(self, action),
		}

		actions['ufx_unit_parameter'] = {
			name: 'RackUltraFX: Set Unit Parameter',
			description: 'Send a user-mapped control change to the MIDI channel assigned to a UFX unit',
			options: [
				{
					type: 'number',
					label: 'UFX MIDI Channel',
					id: 'midiChannel',
					default: 1,
					min: 1,
					max: 16,
				},
				{
					type: 'number',
					label: 'Control Number',
					id: 'controlNumber',
					default: 0,
					min: 0,
					max: 127,
				},
				{
					type: 'number',
					label: 'Control Value',
					id: 'controlValue',
					default: 0,
					min: 0,
					max: 127,
				},
			],
			callback: (action) => dispatchAction(self, action),
		}
	}

	actions['send_input_to_mono_aux'] = sendLevelActionBuilder(
		'Routing: Set Input Send to Mono Aux',
		inputChannels,
		monoAuxes,
	)
	actions['send_input_to_mono_aux_number'] = sendLevelActionNumberBuilder(
		'Routing: Set Input Send to Mono Aux (Legacy Number)',
		inputChannels,
		monoAuxes,
	)
	actions['send_input_to_stereo_aux'] = sendLevelActionBuilder(
		'Routing: Set Input Send to Stereo Aux',
		inputChannels,
		stereoAuxes,
	)
	actions['send_input_to_fx_return'] = sendLevelActionBuilder(
		'Legacy (Unsupported): Set Input Send to FX Return',
		inputChannels,
		fxReturns,
	)
	actions['send_input_to_fx_return'].description =
		'Retained so saved 1.x configurations continue to load. Avantis does not provide an input send to an FX Return; use a Mono or Stereo FX Send instead.'
	actions['send_input_to_mono_fx_return'] = sendLevelActionBuilder(
		'Routing: Set Input Send to Mono FX',
		inputChannels,
		monoFxSends,
	)
	actions['send_input_to_stereo_fx_return'] = sendLevelActionBuilder(
		'Routing: Set Input Send to Stereo FX',
		inputChannels,
		stereoFxSends,
	)
	actions['send_input_to_mono_matrix'] = sendLevelActionBuilder(
		'Routing: Set Input Send to Mono Matrix',
		inputChannels,
		monoMatrices,
	)
	actions['send_input_to_stereo_matrix'] = sendLevelActionBuilder(
		'Routing: Set Input Send to Stereo Matrix',
		inputChannels,
		stereoMatrices,
	)

	actions['send_input_to'] = {
		name: 'Legacy (Unsupported): Set Input Send to Main Mix',
		description:
			'Retained so saved 1.x configurations continue to load. Avantis does not provide a separate input-to-main send level; use Input: Assign to Main Mix and the input fader.',
		options: [
			{
				type: 'dropdown',
				label: inputChannels.name,
				id: 'srcChannel',
				default: 1 + inputChannels.offset,
				choices: inputChannels.values,
				minChoicesForSearch: 0,
			},
			{
				type: 'dropdown',
				label: mainMix.name,
				id: 'destChannel',
				default: 1 + mainMix.offset,
				choices: mainMix.values,
				minChoicesForSearch: 0,
			},
			{
				type: 'dropdown',
				label: faderChoices.name,
				id: 'level',
				default: 1 + faderChoices.offset,
				choices: faderChoices.values,
				minChoicesForSearch: 0,
			},
		],
		callback: (action) => dispatchAction(self, action),
	}

	self.setActionDefinitions(actions)
}

export default UpdateActions
