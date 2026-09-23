import {
	combineRgb,
	type CompanionBooleanFeedbackDefinition,
	type CompanionFeedbackDefinitions,
	type DropdownChoice,
} from '@companion-module/base'
import avantisConfig from './avantisconfig.json' with { type: 'json' }
import type ModuleInstance from './main.js'
import { getChannelCapacities } from './config.js'
import {
	UFX_GLOBAL_KEY_CHOICES,
	UFX_GLOBAL_SCALE_CHOICES,
	UFX_RETURN_COUNT,
	UFX_RETURN_FIRST_CHANNEL,
	UFX_SEND_COUNT,
	UFX_SEND_FIRST_CHANNEL,
} from './protocol/ufx.js'
import { VIRTUAL_SOUNDCHECK_MODE_CHOICES } from './protocol/virtual-soundcheck.js'

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
	online: {
		type: 'boolean'
		options: Record<string, never>
	}
	last_scene: {
		type: 'boolean'
		options: {
			sceneNumber: number
		}
	}
	virtual_soundcheck_mode: {
		type: 'boolean'
		options: {
			mode: number
		}
	}
	virtual_soundcheck_inactive: { type: 'boolean'; options: Record<string, never> }
	virtual_soundcheck_record_send: { type: 'boolean'; options: Record<string, never> }
	virtual_soundcheck_active: { type: 'boolean'; options: Record<string, never> }
	ufx_global_key: {
		type: 'boolean'
		options: { key: number }
	}
	ufx_global_scale: {
		type: 'boolean'
		options: { scale: number }
	}
	ufx_bypass: { type: 'boolean'; options: { unit: number } }
	ufx_plugin_bypass: { type: 'boolean'; options: { unit: number } }
	ufx_all_bypassed: { type: 'boolean'; options: Record<string, never> }
	ufx_all_plugins_bypassed: { type: 'boolean'; options: Record<string, never> }
	talkback_active: { type: 'boolean'; options: Record<string, never> }
	master_strips_locked: { type: 'boolean'; options: Record<string, never> }
	usb_recorder_recording: { type: 'boolean'; options: Record<string, never> }
	usb_playback_playing: { type: 'boolean'; options: Record<string, never> }
	usb_playback_paused: { type: 'boolean'; options: Record<string, never> }
	usb_playback_stopped: { type: 'boolean'; options: Record<string, never> }
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
	mute_ufx_send: {
		type: 'boolean'
		options: { channel: number }
	}
	mute_ufx_return: {
		type: 'boolean'
		options: { channel: number }
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
	const capacities = getChannelCapacities(self.config)

	const inputChannels = buildChoices('Input Channel', 'CH', capacities.inputCount, -1)
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

	feedbacks['online'] = {
		type: 'boolean',
		name: 'Console Online',
		description: 'Change button style while the Avantis MIDI/TCP command connection is ready',
		defaultStyle: {
			bgcolor: combineRgb(0, 150, 0),
			color: combineRgb(255, 255, 255),
		},
		options: [],
		callback: () => self.tcpSocket?.readyState === 'open',
	}

	feedbacks['last_scene'] = {
		type: 'boolean',
		name: 'Last Scene Recalled',
		description: 'Change button style when the selected scene was the last scene recalled',
		defaultStyle: {
			bgcolor: combineRgb(0, 150, 0),
			color: combineRgb(255, 255, 255),
		},
		options: [
			{
				type: 'number',
				label: 'Scene Number',
				id: 'sceneNumber',
				default: 1,
				min: 1,
				max: avantis.sceneCount,
			},
		],
		callback: (feedback) => self.lastSceneNumber === Number(feedback.options.sceneNumber),
	}

	feedbacks['virtual_soundcheck_mode'] = {
		type: 'boolean',
		name: 'Virtual Soundcheck Mode',
		description: 'Change button style when the console is in the selected Virtual Soundcheck mode',
		defaultStyle: {
			bgcolor: combineRgb(0, 150, 0),
			color: combineRgb(255, 255, 255),
		},
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
		callback: (feedback) => self.virtualSoundcheckModeValue === Number(feedback.options.mode),
	}

	const virtualSoundcheckStyles = [
		{
			id: 'virtual_soundcheck_inactive',
			name: 'Virtual Soundcheck: Inactive',
			mode: 0,
			bgcolor: combineRgb(0, 160, 0),
		},
		{
			id: 'virtual_soundcheck_record_send',
			name: 'Virtual Soundcheck: Record Send',
			mode: 1,
			bgcolor: combineRgb(128, 0, 255),
		},
		{
			id: 'virtual_soundcheck_active',
			name: 'Virtual Soundcheck: Virtual Soundcheck',
			mode: 2,
			bgcolor: combineRgb(255, 160, 0),
		},
	] as const
	for (const style of virtualSoundcheckStyles) {
		feedbacks[style.id] = {
			type: 'boolean',
			name: style.name,
			description: `Use the console-matching color when ${style.name.replace('Virtual Soundcheck: ', '')} is active`,
			defaultStyle: { bgcolor: style.bgcolor, color: combineRgb(255, 255, 255) },
			options: [],
			callback: () => self.virtualSoundcheckModeValue === style.mode,
		}
	}

	feedbacks['talkback_active'] = {
		type: 'boolean',
		name: 'Talkback Active',
		description: 'Change button style while console Talkback is active, including momentary and latched operation.',
		defaultStyle: { bgcolor: combineRgb(255, 0, 0), color: combineRgb(255, 255, 255) },
		options: [],
		callback: () => self.talkbackActive === true,
	}
	feedbacks['master_strips_locked'] = {
		type: 'boolean',
		name: 'Master Strips Locked',
		description: 'Change button style while the Avantis Master Strips are locked.',
		defaultStyle: { bgcolor: combineRgb(255, 160, 0), color: combineRgb(255, 255, 255) },
		options: [],
		callback: () => self.masterStripsLocked === true,
	}
	feedbacks['usb_recorder_recording'] = {
		type: 'boolean',
		name: 'USB Recorder Recording',
		description: 'Change button style while the built-in Avantis USB recorder is actively recording.',
		defaultStyle: { bgcolor: combineRgb(255, 0, 0), color: combineRgb(255, 255, 255) },
		options: [],
		callback: () => self.usbRecorderRecording === true,
	}
	feedbacks['usb_playback_playing'] = {
		type: 'boolean',
		name: 'USB Playback Playing',
		description: 'Change button style while a recording is playing from the built-in USB Play/Record screen.',
		defaultStyle: { bgcolor: combineRgb(0, 150, 0), color: combineRgb(255, 255, 255) },
		options: [],
		callback: () => self.usbPlaybackState === 'Playing',
	}
	feedbacks['usb_playback_paused'] = {
		type: 'boolean',
		name: 'USB Playback Paused',
		description: 'Change button style while built-in USB playback is paused.',
		defaultStyle: { bgcolor: combineRgb(255, 160, 0), color: combineRgb(255, 255, 255) },
		options: [],
		callback: () => self.usbPlaybackState === 'Paused',
	}
	feedbacks['usb_playback_stopped'] = {
		type: 'boolean',
		name: 'USB Playback Stopped',
		description: 'Change button style while built-in USB playback is stopped.',
		defaultStyle: { bgcolor: combineRgb(0, 0, 0), color: combineRgb(255, 255, 255) },
		options: [],
		callback: () => self.usbPlaybackState === 'Stopped',
	}

	if (self.config.rackUfxInstalled === true) {
		feedbacks['ufx_bypass'] = {
			type: 'boolean',
			name: 'RackUltraFX Unit Bypassed',
			description: 'Change button style when the selected RackUltraFX unit is bypassed.',
			defaultStyle: { bgcolor: combineRgb(255, 0, 0), color: combineRgb(255, 255, 255) },
			options: [
				{
					type: 'dropdown',
					label: 'UFX Unit',
					id: 'unit',
					default: 1,
					choices: Array.from({ length: 8 }, (_, index) => ({ id: index + 1, label: `UFX ${index + 1}` })),
					minChoicesForSearch: 0,
				},
			],
			callback: (feedback) => self.ufxBypassStates[Number(feedback.options.unit) - 1] === true,
		}
		feedbacks['ufx_all_bypassed'] = {
			type: 'boolean',
			name: 'RackUltraFX All Units Bypassed',
			description: 'Change button style when all eight RackUltraFX units are bypassed.',
			defaultStyle: { bgcolor: combineRgb(255, 0, 0), color: combineRgb(255, 255, 255) },
			options: [],
			callback: () => self.ufxBypassStates.every((state) => state === true),
		}
		feedbacks['ufx_plugin_bypass'] = {
			type: 'boolean',
			name: 'RackUltraFX Plugin Bypassed',
			description: 'Change button style when the plugin/algorithm inside the selected UFX unit is bypassed.',
			defaultStyle: { bgcolor: combineRgb(255, 0, 0), color: combineRgb(255, 255, 255) },
			options: [
				{
					type: 'dropdown',
					label: 'UFX Unit',
					id: 'unit',
					default: 1,
					choices: Array.from({ length: 8 }, (_, index) => ({ id: index + 1, label: `UFX ${index + 1}` })),
					minChoicesForSearch: 0,
				},
			],
			callback: (feedback) => self.ufxPluginBypassStates[Number(feedback.options.unit) - 1] === true,
		}
		feedbacks['ufx_all_plugins_bypassed'] = {
			type: 'boolean',
			name: 'RackUltraFX All Plugins Bypassed',
			description: 'Change button style when all eight UFX plugins are bypassed.',
			defaultStyle: { bgcolor: combineRgb(255, 0, 0), color: combineRgb(255, 255, 255) },
			options: [],
			callback: () => self.ufxPluginBypassStates.every((state) => state === true),
		}

		feedbacks['ufx_global_key'] = {
			type: 'boolean',
			name: 'RackUltraFX Global Key',
			description: 'Change button style when the selected RackUltraFX global key is active',
			defaultStyle: {
				bgcolor: combineRgb(0, 150, 0),
				color: combineRgb(255, 255, 255),
			},
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
			callback: (feedback) => self.ufxGlobalKey === Number(feedback.options.key),
		}

		feedbacks['ufx_global_scale'] = {
			type: 'boolean',
			name: 'RackUltraFX Global Scale',
			description: 'Change button style when the selected RackUltraFX global scale is active',
			defaultStyle: {
				bgcolor: combineRgb(0, 150, 0),
				color: combineRgb(255, 255, 255),
			},
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
			callback: (feedback) => self.ufxGlobalScale === Number(feedback.options.scale),
		}
	}

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
	if (self.config.rackUfxInstalled === true) {
		feedbacks['mute_ufx_send'] = muteFeedbackBuilder('RackUltraFX Send Muted', ufxSends, 4)
		feedbacks['mute_ufx_return'] = muteFeedbackBuilder('RackUltraFX Return Muted', ufxReturns, 4)
	}

	self.setFeedbackDefinitions(feedbacks)
}

export default UpdateFeedbacks
