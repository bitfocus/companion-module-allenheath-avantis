import { Regex, type JsonValue, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	[key: string]: JsonValue
	host: string | null
	midiBase: number
	fadeUpdatesPerSecond: number | null
	dPackEnabled: boolean | null
	/** Legacy setting retained so existing 64/96 configurations can be migrated safely. */
	inputCount: number | null
	rackUfxInstalled: boolean
	ahNetStateSyncEnabled: boolean | null
	useManualConsoleConfig: boolean | null
	retrieveAllSceneNames: boolean | null
	sceneNameRetrievalLimit: number | null
	monoGroupCount: number | null
	stereoGroupCount: number | null
	monoAuxCount: number | null
	stereoAuxCount: number | null
	monoMatrixCount: number | null
	stereoMatrixCount: number | null
	monoFxSendCount: number | null
	stereoFxSendCount: number | null
	mSumEnabled: boolean | null
	/** Legacy selective setting retained only for automatic migration to all-input synchronization. */
	faderSubscriptions: string | null
}

export interface ChannelCapacities {
	inputCount: number
	monoBusCount: number
	stereoBusCount: number
}

export function isDPackEnabled(config: ModuleConfig): boolean {
	return config.dPackEnabled ?? config.inputCount === 96
}

export function getChannelCapacities(config: ModuleConfig): ChannelCapacities {
	return isDPackEnabled(config)
		? { inputCount: 96, monoBusCount: 54, stereoBusCount: 27 }
		: { inputCount: 64, monoBusCount: 40, stereoBusCount: 20 }
}

export function isAhNetStateSyncEnabled(config: ModuleConfig): boolean {
	return (
		config.ahNetStateSyncEnabled ??
		(typeof config.faderSubscriptions === 'string' && config.faderSubscriptions.trim() !== '')
	)
}

export function shouldRetrieveAllSceneNames(config: ModuleConfig): boolean {
	return isAhNetStateSyncEnabled(config) && config.retrieveAllSceneNames === true
}

export function getSceneNameRetrievalLimit(config: ModuleConfig): number {
	if (!shouldRetrieveAllSceneNames(config)) return 0
	const configured = Number(config.sceneNameRetrievalLimit)
	return Number.isInteger(configured) && configured >= 1 ? Math.min(500, configured) : 100
}

export const DEFAULT_FADE_UPDATES_PER_SECOND = 20
export const MIN_FADE_UPDATES_PER_SECOND = 5
export const MAX_FADE_UPDATES_PER_SECOND = 40

export function getFadeUpdatesPerSecond(config: ModuleConfig): number {
	const configured = Number(config.fadeUpdatesPerSecond)
	if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_FADE_UPDATES_PER_SECOND
	return Math.max(MIN_FADE_UPDATES_PER_SECOND, Math.min(MAX_FADE_UPDATES_PER_SECOND, Math.round(configured)))
}

export interface ConfiguredMixLayout {
	monoGroups: number
	stereoGroups: number
	monoAuxes: number
	stereoAuxes: number
	monoMatrices: number
	stereoMatrices: number
	monoFxSends: number
	stereoFxSends: number
	mSumEnabled: boolean
}

export function getConfiguredMixLayout(config: ModuleConfig): ConfiguredMixLayout {
	const numberOrZero = (value: number | null): number =>
		Number.isInteger(value) && Number(value) > 0 ? Number(value) : 0

	return {
		monoGroups: numberOrZero(config.monoGroupCount),
		stereoGroups: numberOrZero(config.stereoGroupCount),
		monoAuxes: numberOrZero(config.monoAuxCount),
		stereoAuxes: numberOrZero(config.stereoAuxCount),
		monoMatrices: numberOrZero(config.monoMatrixCount),
		stereoMatrices: numberOrZero(config.stereoMatrixCount),
		monoFxSends: numberOrZero(config.monoFxSendCount),
		stereoFxSends: numberOrZero(config.stereoFxSendCount),
		mSumEnabled: config.mSumEnabled === true,
	}
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			value:
				'This independent community module is not endorsed or supported by Allen & Heath. MIDI connections are not user-profile aware, and this module does not implement the supported AH-Net user authentication used by MixPad or Director. Use only on a trusted console network and restrict access to Companion.',
			label: 'Information',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Console IP address',
			width: 6,
			default: '192.168.1.70',
			regex: Regex.IP,
		},
		{
			type: 'number',
			label: 'MIDI Base Channel',
			id: 'midiBase',
			tooltip: 'The base channel is set on the console under Utility > Control > MIDI and cannot exceed 12.',
			width: 6,
			default: 1,
			min: 1,
			max: 12,
		},
		{
			type: 'number',
			label: 'Fade updates per second (5-40)',
			id: 'fadeUpdatesPerSecond',
			width: 6,
			default: DEFAULT_FADE_UPDATES_PER_SECOND,
			min: MIN_FADE_UPDATES_PER_SECOND,
			max: MAX_FADE_UPDATES_PER_SECOND,
			step: 1,
			asInteger: true,
			clampValues: true,
			tooltip:
				'Controls how many intermediate fader commands are sent per second during a fade. Higher values produce smoother movement but increase MIDI/TCP traffic while fades are active. 20 is recommended. This does not affect actions with a fade time of 0.',
		},
		{
			type: 'checkbox',
			label: 'Use manual console configuration fallback',
			id: 'useManualConsoleConfig',
			tooltip:
				'Normally the module discovers dPack, RackUltraFX, bus counts, and Main mode automatically. Enable only if automatic discovery is unavailable.',
			width: 12,
			default: false,
			isVisibleExpression: '$(options:ahNetStateSyncEnabled)',
		},
		{
			type: 'checkbox',
			label: 'dPack upgrade enabled (manual fallback)',
			id: 'dPackEnabled',
			tooltip:
				'Enable the expanded Avantis V2 capacities: 96 inputs, 54 mono groups/auxes/matrices, and 27 stereo groups/auxes/matrices.',
			width: 6,
			default: false,
			isVisibleExpression: '$(options:useManualConsoleConfig)',
		},
		{
			type: 'checkbox',
			label: 'RackUltraFX card installed (manual fallback)',
			id: 'rackUfxInstalled',
			tooltip:
				'Show RackUltraFX sends, returns, fader and mute controls, global key, scale, and user-mapped unit parameters.',
			width: 6,
			default: false,
			isVisibleExpression: '$(options:useManualConsoleConfig)',
		},
		{
			type: 'checkbox',
			label: 'Enable console synchronization',
			id: 'ahNetStateSyncEnabled',
			width: 12,
			default: false,
			disableAutoExpression: true,
			tooltip:
				'Synchronize supported console states and variables when connected, including faders, names, colors, scenes, Mute Groups, Virtual Soundcheck, Global Key, Scale, and Tempo. This optional feature uses Allen & Heath proprietary, internal AH-Net behavior that may change or become unavailable after a firmware update.',
		},
		{
			type: 'checkbox',
			label: 'Retrieve scene names',
			id: 'retrieveAllSceneNames',
			width: 12,
			default: false,
			disableAutoExpression: true,
			isVisibleExpression: '$(options:ahNetStateSyncEnabled)',
			tooltip:
				'Read a chosen range of scene names from the console after each connection and expose them as Companion variables. This optional one-time directory read adds network traffic during initial synchronization. It does not recall or modify scenes.',
		},
		{
			type: 'number',
			label: 'Retrieve scene names 1 through',
			id: 'sceneNameRetrievalLimit',
			width: 12,
			default: 100,
			min: 1,
			max: 500,
			step: 1,
			asInteger: true,
			clampValues: true,
			isVisibleExpression: '$(options:ahNetStateSyncEnabled) && $(options:retrieveAllSceneNames)',
			tooltip:
				'Choose the highest scene number to retrieve. For example, 100 retrieves Scenes 1-100 and creates variables only for those scenes.',
		},
		{
			type: 'static-text',
			id: 'mixLayoutInfo',
			label: 'Console mix configuration',
			width: 12,
			isVisibleExpression: '$(options:ahNetStateSyncEnabled) && $(options:useManualConsoleConfig)',
			value:
				'Enter the quantities currently allocated under Setup > Mixer Config > Bus Config. Only configured mixes are synchronized and shown as variables.',
		},
		...[
			['monoGroupCount', 'Mono Groups', 0, 54],
			['stereoGroupCount', 'Stereo Groups', 0, 27],
			['monoFxSendCount', 'Mono FX', 0, 12],
			['stereoFxSendCount', 'Stereo FX', 0, 12],
			['monoAuxCount', 'Mono Auxes', 0, 54],
			['stereoAuxCount', 'Stereo Auxes', 0, 27],
			['monoMatrixCount', 'Mono Matrices', 0, 54],
			['stereoMatrixCount', 'Stereo Matrices', 0, 27],
		].map(([id, label, min, max]) => ({
			type: 'number' as const,
			id: id as string,
			label: label as string,
			width: 6,
			default: 0,
			min: min as number,
			max: max as number,
			step: 1,
			asInteger: true,
			clampValues: true,
			isVisibleExpression: '$(options:ahNetStateSyncEnabled) && $(options:useManualConsoleConfig)',
		})),
		{
			type: 'checkbox',
			id: 'mSumEnabled',
			label: 'Msum Main enabled',
			width: 6,
			default: false,
			isVisibleExpression: '$(options:ahNetStateSyncEnabled) && $(options:useManualConsoleConfig)',
			tooltip: 'Enable when the console Main configuration is LR+Msum. Leave unchecked for LR mode.',
		},
	]
}
