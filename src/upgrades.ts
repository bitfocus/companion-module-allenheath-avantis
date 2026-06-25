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

export const UpgradeScripts = [upgradeFaderDuration]

export default UpgradeScripts
