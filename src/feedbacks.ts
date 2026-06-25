import {
	combineRgb,
	type CompanionBooleanFeedbackDefinition,
	type CompanionFeedbackDefinitions,
	type DropdownChoice,
} from '@companion-module/base'
import avantisConfig from './avantisconfig.json' with { type: 'json' }
import type ModuleInstance from './main.js'

type ChoiceGroup = {
	name: string
	offset: number
	values: DropdownChoice[]
}

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

export type FeedbacksSchema = {
	mute_input: {
		type: 'boolean'
		options: {
			channel: number
		}
	}
	mute_mono_group: {
		type: 'boolean'
		options: {
			channel: number
		}
	}
	mute_stereo_group: {
		type: 'boolean'
		options: {
			channel: number
		}
	}
	mute_mono_aux: {
		type: 'boolean'
		options: {
			channel: number
		}
	}
	mute_stereo_aux: {
		type: 'boolean'
		options: {
			channel: number
		}
	}
	mute_mono_matrix: {
		type: 'boolean'
		options: {
			channel: number
		}
	}
	mute_stereo_matrix: {
		type: 'boolean'
		options: {
			channel: number
		}
	}
	mute_mono_fx_send: {
		type: 'boolean'
		options: {
			channel: number
		}
	}
	mute_stereo_fx_send: {
		type: 'boolean'
		options: {
			channel: number
		}
	}
	mute_fx_return: {
		type: 'boolean'
		options: {
			channel: number
		}
	}
	mute_master: {
		type: 'boolean'
		options: {
			channel: number
		}
	}
	mute_dca: {
		type: 'boolean'
		options: {
			channel: number
		}
	}
	mute_group: {
		type: 'boolean'
		options: {
			channel: number
		}
	}
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	const feedbacks: CompanionFeedbackDefinitions<FeedbacksSchema> = {} as any
	const avantis = avantisConfig.config

	const inputChannels = buildChoices('Input Channel', 'CH', self.config.inputCount ?? avantis.inputCount, -1)
	const dca = buildChoices('DCA', 'DCA', avantis.dcaCount, 0x35)
	const muteGroups = buildChoices('Mute Group', 'MUTE', avantis.muteGroupCount, 0x45)
	const mainMix = buildChoices('Main Mix', 'MAIN', avantis.mainsCount, 0x2f)
	const monoGroups = buildChoices('Mono Group', 'Mono Group', avantis.mono.groupCount, -1)
	const stereoGroups = buildChoices('Stereo Group', 'Stereo Group', avantis.stereo.groupCount, 0x3f)
	const monoAuxes = buildChoices('Mono Aux', 'Mono Aux', avantis.mono.auxCount, -1)
	const stereoAuxes = buildChoices('Stereo Aux', 'Stereo Aux', avantis.stereo.auxCount, 0x3f)
	const monoMatrices = buildChoices('Mono Matrix', 'Mono Matrix', avantis.mono.matrixCount, -1)
	const stereoMatrices = buildChoices('Stereo Matrix', 'Stereo Matrix', avantis.stereo.matrixCount, 0x3f)
	const monoFxSends = buildChoices('Mono FX Send', 'Mono FX Send', avantis.mono.fxSendCount, -1)
	const stereoFxSends = buildChoices('Stereo FX Send', 'Stereo FX Send', avantis.stereo.fxSendCount, 0x0f)
	const fxReturns = buildChoices('FX Return', 'FX Return', avantis.fxReturnCount, 0x1f)

	const muteFeedbackBuilder = (
		label: string,
		choice: ChoiceGroup,
		midiOffset: number,
	): CompanionBooleanFeedbackDefinition<{ channel: number }> => ({
		type: 'boolean',
		name: label,
		description: `Change button style based on ${label} status`,
		defaultStyle: {
			bgcolor: combineRgb(255, 0, 0),
			color: combineRgb(255, 255, 255),
		},
		options: [
			{
				type: 'dropdown',
				label: choice.name,
				id: 'channel',
				default: 1 + choice.offset,
				choices: choice.values,
				minChoicesForSearch: 0,
			},
		],
		callback: (feedback) => {
			const channel = Number(feedback.options.channel)
			const midiBase = (self.config.midiBase ?? 1) - 1
			const key = `${midiBase + midiOffset}:${channel}`
			return self.muteStateCache[key] === true
		},
	})

	feedbacks['mute_input'] = muteFeedbackBuilder('Input Muted', inputChannels, 0)
	feedbacks['mute_mono_group'] = muteFeedbackBuilder('Mono Group Muted', monoGroups, 1)
	feedbacks['mute_stereo_group'] = muteFeedbackBuilder('Stereo Group Muted', stereoGroups, 1)
	feedbacks['mute_mono_aux'] = muteFeedbackBuilder('Mono Aux Muted', monoAuxes, 2)
	feedbacks['mute_stereo_aux'] = muteFeedbackBuilder('Stereo Aux Muted', stereoAuxes, 2)
	feedbacks['mute_mono_matrix'] = muteFeedbackBuilder('Mono Matrix Muted', monoMatrices, 3)
	feedbacks['mute_stereo_matrix'] = muteFeedbackBuilder('Stereo Matrix Muted', stereoMatrices, 3)
	feedbacks['mute_mono_fx_send'] = muteFeedbackBuilder('Mono FX Send Muted', monoFxSends, 4)
	feedbacks['mute_stereo_fx_send'] = muteFeedbackBuilder('Stereo FX Send Muted', stereoFxSends, 4)
	feedbacks['mute_fx_return'] = muteFeedbackBuilder('FX Return Muted', fxReturns, 4)
	feedbacks['mute_master'] = muteFeedbackBuilder('Main Mix Muted', mainMix, 4)
	feedbacks['mute_dca'] = muteFeedbackBuilder('DCA Muted', dca, 4)
	feedbacks['mute_group'] = muteFeedbackBuilder('Mute Group Muted', muteGroups, 4)

	self.setFeedbackDefinitions(feedbacks)
}

export default UpdateFeedbacks
