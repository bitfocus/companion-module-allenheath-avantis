import {
	type CompanionUpgradeContext,
	type CompanionStaticUpgradeProps,
	type CompanionStaticUpgradeResult,
} from '@companion-module/base'

export function upgradeFaderDuration(
	_context: CompanionUpgradeContext<any>,
	props: CompanionStaticUpgradeProps<any, any>,
): CompanionStaticUpgradeResult<any, any> {
	const faderActions = [
		'fader_input',
		'fader_mono_group',
		'fader_stereo_group',
		'fader_mono_aux',
		'fader_stereo_aux',
		'fader_mono_matrix',
		'fader_stereo_matrix',
		'fader_mono_fx_send',
		'fader_stereo_fx_send',
		'fader_master',
		'fader_fx_return',
		'fader_DCA',
	]

	const actions = props.actions
	let changed = false

	for (const action of actions) {
		if (faderActions.includes(action.actionId)) {
			if (action.options.fadeDuration === undefined) {
				action.options.fadeDuration = { value: 0, isExpression: false }
				changed = true
			}
		}
	}

	return {
		updatedConfig: null,
		updatedActions: changed ? actions : [],
		updatedFeedbacks: [],
	}
}

export function upgradeDPackSetting(
	_context: CompanionUpgradeContext<any>,
	props: CompanionStaticUpgradeProps<any, any>,
): CompanionStaticUpgradeResult<any, any> {
	if (props.config.dPackEnabled !== undefined) {
		return {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
	}

	const updatedConfig = { ...props.config }
	updatedConfig.dPackEnabled = Number(updatedConfig.inputCount) === 96
	delete updatedConfig.inputCount

	return {
		updatedConfig,
		updatedActions: [],
		updatedFeedbacks: [],
	}
}

export function upgradeAhNetStateSyncSetting(
	_context: CompanionUpgradeContext<any>,
	props: CompanionStaticUpgradeProps<any, any>,
): CompanionStaticUpgradeResult<any, any> {
	if (props.config.ahNetStateSyncEnabled !== undefined) {
		return { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] }
	}

	const updatedConfig = { ...props.config }
	updatedConfig.ahNetStateSyncEnabled =
		typeof updatedConfig.faderSubscriptions === 'string' && updatedConfig.faderSubscriptions.trim() !== ''
	delete updatedConfig.faderSubscriptions
	return { updatedConfig, updatedActions: [], updatedFeedbacks: [] }
}

export function upgradeMixLayoutSettings(
	_context: CompanionUpgradeContext<any>,
	props: CompanionStaticUpgradeProps<any, any>,
): CompanionStaticUpgradeResult<any, any> {
	const updatedConfig = { ...props.config }
	let changed = false
	for (const id of [
		'monoGroupCount',
		'stereoGroupCount',
		'monoFxSendCount',
		'stereoFxSendCount',
		'monoAuxCount',
		'stereoAuxCount',
		'monoMatrixCount',
		'stereoMatrixCount',
	]) {
		if (updatedConfig[id] === undefined || updatedConfig[id] === null || updatedConfig[id] === '') {
			updatedConfig[id] = 0
			changed = true
		}
	}
	if (updatedConfig.mSumEnabled === undefined || updatedConfig.mSumEnabled === null) {
		updatedConfig.mSumEnabled = false
		changed = true
	}
	if (updatedConfig.retrieveAllSceneNames === undefined || updatedConfig.retrieveAllSceneNames === null) {
		updatedConfig.retrieveAllSceneNames = false
		changed = true
	}
	if (
		!Number.isInteger(Number(updatedConfig.sceneNameRetrievalLimit)) ||
		Number(updatedConfig.sceneNameRetrievalLimit) < 1
	) {
		updatedConfig.sceneNameRetrievalLimit = 100
		changed = true
	}
	return {
		updatedConfig: changed ? updatedConfig : null,
		updatedActions: [],
		updatedFeedbacks: [],
	}
}

export function upgradeConsoleSyncActions(
	_context: CompanionUpgradeContext<any>,
	props: CompanionStaticUpgradeProps<any, any>,
): CompanionStaticUpgradeResult<any, any> {
	let changed = false
	for (const action of props.actions) {
		if (['request_input_name', 'request_input_color', 'sync_input_names_colors'].includes(action.actionId)) {
			action.actionId = 'console_sync_refresh_names_colors'
			action.options = {}
			changed = true
		}
	}
	return { updatedConfig: null, updatedActions: changed ? props.actions : [], updatedFeedbacks: [] }
}

export function upgradeFadeResolutionSetting(
	_context: CompanionUpgradeContext<any>,
	props: CompanionStaticUpgradeProps<any, any>,
): CompanionStaticUpgradeResult<any, any> {
	const current = Number(props.config.fadeUpdatesPerSecond)
	if (Number.isFinite(current) && current >= 5 && current <= 40) {
		return { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] }
	}
	return {
		updatedConfig: { ...props.config, fadeUpdatesPerSecond: 20 },
		updatedActions: [],
		updatedFeedbacks: [],
	}
}

export function upgradeLegacyMuteModes(
	_context: CompanionUpgradeContext<any>,
	props: CompanionStaticUpgradeProps<any, any>,
): CompanionStaticUpgradeResult<any, any> {
	let changed = false
	for (const action of props.actions) {
		if (!action.actionId.startsWith('mute_') || action.options.mute === undefined) continue

		const saved = action.options.mute
		if (typeof saved === 'object' && saved !== null && 'value' in saved) {
			if (saved.value === true || saved.value === 'true') {
				saved.value = 'mute'
				changed = true
			} else if (saved.value === false || saved.value === 'false') {
				saved.value = 'unmute'
				changed = true
			}
		} else if (saved === true || saved === 'true') {
			;(action.options as Record<string, unknown>).mute = 'mute'
			changed = true
		} else if (saved === false || saved === 'false') {
			;(action.options as Record<string, unknown>).mute = 'unmute'
			changed = true
		}
	}

	return { updatedConfig: null, updatedActions: changed ? props.actions : [], updatedFeedbacks: [] }
}

export const UpgradeScripts = [
	upgradeFaderDuration,
	upgradeDPackSetting,
	upgradeAhNetStateSyncSetting,
	upgradeMixLayoutSettings,
	upgradeConsoleSyncActions,
	upgradeFadeResolutionSetting,
	upgradeLegacyMuteModes,
]

export default UpgradeScripts
