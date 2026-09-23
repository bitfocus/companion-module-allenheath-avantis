import {
	combineRgb,
	type CompanionPresetDefinitions,
	type CompanionPresetSection,
	type CompanionSimplePresetDefinition,
} from '@companion-module/base'
import avantisConfig from './avantisconfig.json' with { type: 'json' }
import type ModuleInstance from './main.js'
import { getChannelCapacities, getSceneNameRetrievalLimit } from './config.js'
import type { ModuleSchema } from './main.js'
import {
	UFX_GLOBAL_KEY_CHOICES,
	UFX_GLOBAL_SCALE_CHOICES,
	UFX_RETURN_COUNT,
	UFX_RETURN_FIRST_CHANNEL,
	UFX_SEND_COUNT,
	UFX_SEND_FIRST_CHANNEL,
} from './protocol/ufx.js'
import { MMC_TRANSPORT_CHOICES } from './protocol/mmc.js'
import { VIRTUAL_SOUNDCHECK_MODE_CHOICES } from './protocol/virtual-soundcheck.js'

const BLACK = combineRgb(0, 0, 0)
const WHITE = combineRgb(255, 255, 255)
const RED = combineRgb(255, 0, 0)
const GREEN = combineRgb(0, 160, 0)
const BLUE = combineRgb(0, 64, 255)
const LIGHT_BLUE = combineRgb(0, 192, 255)
const AMBER = combineRgb(255, 160, 0)
const PURPLE = combineRgb(128, 0, 255)

const consoleNameText = (variableId: string, operation: string): string => `$(this:${variableId})\n${operation}`

function buildMutePreset(
	id: string,
	name: string,
	text: string,
	actionId: 'mute_input' | 'mute_dca' | 'mute_group' | 'mute_master' | 'mute_ufx_send' | 'mute_ufx_return',
	channel: number,
	mute: 'mute' | 'unmute' | 'toggle',
	bgcolor: number,
	color: number,
): CompanionSimplePresetDefinition<ModuleSchema> {
	return {
		type: 'simple',
		name,
		style: {
			text,
			size: 'auto',
			color,
			bgcolor,
		},
		steps: [
			{
				down: [
					{
						actionId,
						options: {
							channel,
							mute,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: actionId,
				options: {
					channel,
				},
				style: {
					bgcolor: RED,
					color: WHITE,
				},
			},
		],
		keywords: [id, 'mute'],
	}
}

function buildFaderPreset(
	id: string,
	name: string,
	text: string,
	actionId: 'fader_input' | 'fader_master' | 'fader_DCA' | 'fader_ufx_send' | 'fader_ufx_return',
	channel: number,
	level: number,
	bgcolor: number,
	color: number,
): CompanionSimplePresetDefinition<ModuleSchema> {
	return {
		type: 'simple',
		name,
		style: {
			text,
			size: 'auto',
			color,
			bgcolor,
		},
		steps: [
			{
				down: [
					{
						actionId,
						options: {
							channel,
							level,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
		keywords: [id, 'fader'],
	}
}

export function GetPresetDefinitions(
	_inputCount: number,
	rackUfxInstalled = false,
	sceneNameRetrievalLimit = 0,
): CompanionPresetDefinitions<ModuleSchema> {
	const presets: CompanionPresetDefinitions<ModuleSchema> = {}
	const avantis = avantisConfig.config

	// Input 1 examples. Full channel selection remains available in the actions.
	presets['toggle_mute_input_1'] = buildMutePreset(
		'toggle_mute_input_1',
		'Toggle Mute CH 1',
		consoleNameText('input_name_1', 'MUTE'),
		'mute_input',
		0,
		'toggle',
		BLACK,
		WHITE,
	)
	presets['fader_input_0db_1'] = buildFaderPreset(
		'fader_input_0db_1',
		'CH 1 to 0 dB',
		consoleNameText('input_name_1', '0 dB'),
		'fader_input',
		0,
		0x6b,
		BLACK,
		WHITE,
	)
	presets['fader_input_off_1'] = buildFaderPreset(
		'fader_input_off_1',
		'CH 1 to -inf',
		consoleNameText('input_name_1', '-inf'),
		'fader_input',
		0,
		0x00,
		BLACK,
		WHITE,
	)

	// Main Mix
	for (let mix = 1; mix <= avantis.mainsCount; mix++) {
		const mixId = mix + 0x2f

		presets[`mute_main_${mix}`] = buildMutePreset(
			`mute_main_${mix}`,
			`Mute Main ${mix}`,
			consoleNameText(`main_${mix}_name`, 'MUTE'),
			'mute_master',
			mixId,
			'mute',
			RED,
			WHITE,
		)

		presets[`unmute_main_${mix}`] = buildMutePreset(
			`unmute_main_${mix}`,
			`Unmute Main ${mix}`,
			consoleNameText(`main_${mix}_name`, 'ON'),
			'mute_master',
			mixId,
			'unmute',
			GREEN,
			WHITE,
		)

		presets[`toggle_mute_main_${mix}`] = buildMutePreset(
			`toggle_mute_main_${mix}`,
			`Toggle Mute Main ${mix}`,
			consoleNameText(`main_${mix}_name`, 'TOGGLE'),
			'mute_master',
			mixId,
			'toggle',
			GREEN,
			WHITE,
		)

		presets[`fader_main_0db_${mix}`] = buildFaderPreset(
			`fader_main_0db_${mix}`,
			`Main ${mix} to 0 dB`,
			consoleNameText(`main_${mix}_name`, '0 dB'),
			'fader_master',
			mixId,
			0x6b,
			BLUE,
			WHITE,
		)
	}

	// DCA
	for (let dcaNumber = 1; dcaNumber <= avantis.dcaCount; dcaNumber++) {
		const dcaId = dcaNumber + 0x35

		presets[`mute_dca_${dcaNumber}`] = buildMutePreset(
			`mute_dca_${dcaNumber}`,
			`Mute DCA ${dcaNumber}`,
			consoleNameText(`dca_${dcaNumber}_name`, 'MUTE'),
			'mute_dca',
			dcaId,
			'mute',
			RED,
			WHITE,
		)

		presets[`unmute_dca_${dcaNumber}`] = buildMutePreset(
			`unmute_dca_${dcaNumber}`,
			`Unmute DCA ${dcaNumber}`,
			consoleNameText(`dca_${dcaNumber}_name`, 'ON'),
			'mute_dca',
			dcaId,
			'unmute',
			GREEN,
			WHITE,
		)

		presets[`toggle_mute_dca_${dcaNumber}`] = buildMutePreset(
			`toggle_mute_dca_${dcaNumber}`,
			`Toggle Mute DCA ${dcaNumber}`,
			consoleNameText(`dca_${dcaNumber}_name`, 'TOGGLE'),
			'mute_dca',
			dcaId,
			'toggle',
			GREEN,
			WHITE,
		)

		presets[`fader_dca_0db_${dcaNumber}`] = buildFaderPreset(
			`fader_dca_0db_${dcaNumber}`,
			`DCA ${dcaNumber} to 0 dB`,
			consoleNameText(`dca_${dcaNumber}_name`, '0 dB'),
			'fader_DCA',
			dcaId,
			0x6b,
			BLUE,
			WHITE,
		)
	}

	// Mute Groups
	for (let group = 1; group <= avantis.muteGroupCount; group++) {
		const groupId = group + 0x45

		presets[`toggle_mute_group_${group}`] = buildMutePreset(
			`toggle_mute_group_${group}`,
			`Toggle Mute Group ${group}`,
			`MUTE GRP ${group}`,
			'mute_group',
			groupId,
			'toggle',
			BLACK,
			WHITE,
		)
	}

	// Scenes (1-100)
	for (let scene = 1; scene <= Math.min(avantis.sceneCount, 100); scene++) {
		presets[`scene_recall_${scene}`] = {
			type: 'simple',
			name: `Recall Scene ${scene}`,
			style: {
				text: scene <= sceneNameRetrievalLimit ? `$(this:scene_name_${scene})\nSCENE ${scene}` : `SCENE\n${scene}`,
				size: 'auto',
				color: WHITE,
				bgcolor: PURPLE,
			},
			steps: [
				{
					down: [
						{
							actionId: 'scene_recall',
							options: { sceneNumber: String(scene - 1) },
						},
					],
					up: [],
				},
			],
			feedbacks: [],
			keywords: [`scene_recall_${scene}`, 'scene'],
		}
	}

	// Send Level CH 1 to Mono Aux (1-16)
	for (let aux = 1; aux <= Math.min(avantis.mono.auxCount, 16); aux++) {
		presets[`send_ch1_mono_aux_${aux}_0db`] = {
			type: 'simple',
			name: `Send CH 1 to Mono Aux ${aux} at 0 dB`,
			style: {
				text: `$(this:input_name_1) > $(this:mono_aux_${aux}_name)\n0 DB`,
				size: 'auto',
				color: BLACK,
				bgcolor: AMBER,
			},
			steps: [
				{
					down: [
						{
							actionId: 'send_input_to_mono_aux',
							options: {
								srcChannel: [0],
								destChannel: aux - 1,
								level: 0x6b,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
			keywords: [`send_ch1_mono_aux_${aux}_0db`, 'send'],
		}
	}

	// Set Channel 1 Name
	presets['channel_1_name'] = {
		type: 'simple',
		name: 'Set CH 1 Name',
		style: {
			text: consoleNameText('input_name_1', 'SET NAME'),
			size: 'auto',
			color: WHITE,
			bgcolor: BLUE,
		},
		steps: [
			{
				down: [
					{
						actionId: 'channel_name',
						options: {
							channel: 0,
							channelName: 'CH 1',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
		keywords: ['channel_1_name', 'name'],
	}

	// Set Channel 1 Color
	const colors = [
		['off', 'Off', 0, BLACK, WHITE],
		['red', 'Red', 1, RED, WHITE],
		['green', 'Green', 2, GREEN, WHITE],
		['yellow', 'Yellow', 3, AMBER, BLACK],
		['blue', 'Blue', 4, BLUE, WHITE],
		['purple', 'Purple', 5, PURPLE, WHITE],
		['light_blue', 'Light Blue', 6, LIGHT_BLUE, BLACK],
		['white', 'White', 7, WHITE, BLACK],
	] as const

	for (const [id, label, colorId, bgcolor, color] of colors) {
		presets[`channel_1_color_${id}`] = {
			type: 'simple',
			name: `Set CH 1 ${label}`,
			style: {
				text: consoleNameText('input_name_1', label.toUpperCase()),
				size: 'auto',
				color,
				bgcolor,
			},
			steps: [
				{
					down: [
						{
							actionId: 'channel_color',
							options: {
								channel: 0,
								color: String(colorId),
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
			keywords: [`channel_1_color_${id}`, 'color'],
		}
	}

	for (const choice of VIRTUAL_SOUNDCHECK_MODE_CHOICES) {
		const mode = Number(choice.id)
		const label = String(choice.label)
		const modeColor = mode === 0 ? GREEN : mode === 1 ? PURPLE : AMBER
		presets[`virtual_soundcheck_mode_${mode}`] = {
			type: 'simple',
			name: `Set Virtual Soundcheck Mode: ${label}`,
			style: {
				text: label.toUpperCase(),
				size: 'auto',
				color: WHITE,
				bgcolor: BLACK,
			},
			steps: [{ down: [{ actionId: 'virtual_soundcheck_mode', options: { mode } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'virtual_soundcheck_mode',
					options: { mode },
					style: { bgcolor: modeColor, color: WHITE },
				},
			],
			keywords: ['virtual soundcheck', 'record send', label],
		}
	}

	presets['utility_usb_recorder_status'] = {
		type: 'simple',
		name: 'USB Recorder Status',
		style: { text: 'USB RECORDER\n$(this:usb_recorder_state)', size: 'auto', color: WHITE, bgcolor: BLACK },
		steps: [{ down: [], up: [] }],
		feedbacks: [{ feedbackId: 'usb_recorder_recording', options: {}, style: { bgcolor: RED, color: WHITE } }],
		keywords: ['usb', 'recorder', 'recording', 'status', 'utility'],
	}
	presets['utility_master_strips_lock_status'] = {
		type: 'simple',
		name: 'Master Strips Lock Status',
		style: { text: 'MASTER STRIPS\n$(this:master_strips_lock_state)', size: 'auto', color: WHITE, bgcolor: BLACK },
		steps: [{ down: [], up: [] }],
		feedbacks: [{ feedbackId: 'master_strips_locked', options: {}, style: { bgcolor: AMBER, color: WHITE } }],
		keywords: ['master', 'strips', 'lock', 'locked', 'status', 'utility'],
	}
	presets['utility_talkback_status'] = {
		type: 'simple',
		name: 'Talkback Status',
		style: { text: 'TALKBACK\n$(this:talkback_state)', size: 'auto', color: WHITE, bgcolor: BLACK },
		steps: [{ down: [], up: [] }],
		feedbacks: [{ feedbackId: 'talkback_active', options: {}, style: { bgcolor: RED, color: WHITE } }],
		keywords: ['talkback', 'active', 'status', 'utility'],
	}

	presets['global_tap_tempo'] = {
		type: 'simple',
		name: 'Tap Global Tempo',
		style: { text: 'GLOBAL TAP\n$(this:global_tempo_bpm) BPM', size: 'auto', color: WHITE, bgcolor: BLUE },
		steps: [{ down: [{ actionId: 'global_tap_tempo', options: {} }], up: [] }],
		feedbacks: [],
		keywords: ['global', 'tempo', 'tap', 'fx'],
	}

	presets['global_set_tempo_bpm'] = {
		type: 'simple',
		name: 'Set Global Tempo BPM',
		style: { text: 'SET TEMPO\n$(this:global_tempo_bpm) BPM', size: 'auto', color: WHITE, bgcolor: PURPLE },
		steps: [{ down: [{ actionId: 'global_set_tempo_bpm', options: { bpm: '120' } }], up: [] }],
		feedbacks: [],
		keywords: ['global', 'tempo', 'bpm', 'set', 'fx'],
	}

	if (rackUfxInstalled) {
		presets['ufx_toggle_bypass_all'] = {
			type: 'simple',
			name: 'Toggle Bypass All RackUltraFX Units',
			style: { text: 'BYPASS ALL UFX', size: 'auto', color: WHITE, bgcolor: BLACK },
			steps: [{ down: [{ actionId: 'ufx_toggle_bypass_all', options: {} }], up: [] }],
			feedbacks: [{ feedbackId: 'ufx_all_bypassed', options: {}, style: { bgcolor: RED, color: WHITE } }],
			keywords: ['rackultrafx', 'ufx', 'bypass', 'all', 'toggle'],
		}
		presets['ufx_toggle_all_plugin_bypass'] = {
			type: 'simple',
			name: 'Toggle Bypass All RackUltraFX Plugins',
			style: { text: 'BYPASS ALL UFX PLUGINS', size: 'auto', color: WHITE, bgcolor: BLACK },
			steps: [{ down: [{ actionId: 'ufx_toggle_all_plugin_bypass', options: {} }], up: [] }],
			feedbacks: [{ feedbackId: 'ufx_all_plugins_bypassed', options: {}, style: { bgcolor: RED, color: WHITE } }],
			keywords: ['rackultrafx', 'ufx', 'plugin', 'bypass', 'all', 'toggle'],
		}
		for (let unit = 1; unit <= 8; unit++) {
			presets[`ufx_toggle_bypass_${unit}`] = {
				type: 'simple',
				name: `Toggle RackUltraFX ${unit} Bypass`,
				style: { text: `UFX ${unit}\nBYPASS`, size: 'auto', color: WHITE, bgcolor: BLACK },
				steps: [{ down: [{ actionId: 'ufx_bypass', options: { unit, mode: 'toggle' } }], up: [] }],
				feedbacks: [
					{
						feedbackId: 'ufx_bypass',
						options: { unit },
						style: { bgcolor: RED, color: WHITE },
					},
				],
				keywords: ['rackultrafx', 'ufx', 'bypass', 'toggle', String(unit)],
			}
			presets[`ufx_toggle_plugin_bypass_${unit}`] = {
				type: 'simple',
				name: `Toggle RackUltraFX ${unit} Plugin Bypass`,
				style: { text: `UFX ${unit}\nPLUGIN BYPASS`, size: 'auto', color: WHITE, bgcolor: BLACK },
				steps: [{ down: [{ actionId: 'ufx_plugin_bypass', options: { unit, mode: 'toggle' } }], up: [] }],
				feedbacks: [
					{
						feedbackId: 'ufx_plugin_bypass',
						options: { unit },
						style: { bgcolor: RED, color: WHITE },
					},
				],
				keywords: ['rackultrafx', 'ufx', 'plugin', 'insert', 'bypass', 'toggle', String(unit)],
			}
		}

		for (const [kind, count, firstChannel, muteAction, faderAction] of [
			['send', UFX_SEND_COUNT, UFX_SEND_FIRST_CHANNEL, 'mute_ufx_send', 'fader_ufx_send'],
			['return', UFX_RETURN_COUNT, UFX_RETURN_FIRST_CHANNEL, 'mute_ufx_return', 'fader_ufx_return'],
		] as const) {
			for (let unit = 1; unit <= count; unit++) {
				const channel = firstChannel + unit - 1
				const label = `UFX ${kind.toUpperCase()} ${unit}`
				presets[`mute_ufx_${kind}_${unit}`] = buildMutePreset(
					`mute_ufx_${kind}_${unit}`,
					`Mute ${label}`,
					consoleNameText(`ufx_${kind}_${unit}_name`, 'MUTE'),
					muteAction,
					channel,
					'mute',
					RED,
					WHITE,
				)
				presets[`unmute_ufx_${kind}_${unit}`] = buildMutePreset(
					`unmute_ufx_${kind}_${unit}`,
					`Unmute ${label}`,
					consoleNameText(`ufx_${kind}_${unit}_name`, 'ON'),
					muteAction,
					channel,
					'unmute',
					GREEN,
					WHITE,
				)
				presets[`toggle_mute_ufx_${kind}_${unit}`] = buildMutePreset(
					`toggle_mute_ufx_${kind}_${unit}`,
					`Toggle Mute ${label}`,
					consoleNameText(`ufx_${kind}_${unit}_name`, 'TOGGLE'),
					muteAction,
					channel,
					'toggle',
					GREEN,
					WHITE,
				)
				presets[`fader_ufx_${kind}_0db_${unit}`] = buildFaderPreset(
					`fader_ufx_${kind}_0db_${unit}`,
					`${label} to 0 dB`,
					consoleNameText(`ufx_${kind}_${unit}_name`, '0 DB'),
					faderAction,
					channel,
					0x6b,
					BLUE,
					WHITE,
				)
			}
		}

		for (const choice of UFX_GLOBAL_KEY_CHOICES) {
			const key = Number(choice.id)
			const label = String(choice.label)
			presets[`ufx_global_key_${key}`] = {
				type: 'simple',
				name: `RackUltraFX Global Key ${label}`,
				style: { text: label, size: 'auto', color: WHITE, bgcolor: BLACK },
				steps: [{ down: [{ actionId: 'ufx_global_key', options: { key } }], up: [] }],
				feedbacks: [
					{
						feedbackId: 'ufx_global_key',
						options: { key },
						style: { bgcolor: GREEN, color: WHITE },
					},
				],
				keywords: ['rackultrafx', 'ufx', 'global key', label],
			}
		}

		for (const choice of UFX_GLOBAL_SCALE_CHOICES) {
			const scale = Number(choice.id)
			const label = String(choice.label)
			presets[`ufx_global_scale_${scale}`] = {
				type: 'simple',
				name: `RackUltraFX Global Scale ${label}`,
				style: { text: label.toUpperCase(), size: 'auto', color: WHITE, bgcolor: BLACK },
				steps: [{ down: [{ actionId: 'ufx_global_scale', options: { scale } }], up: [] }],
				feedbacks: [
					{
						feedbackId: 'ufx_global_scale',
						options: { scale },
						style: { bgcolor: GREEN, color: WHITE },
					},
				],
				keywords: ['rackultrafx', 'ufx', 'global scale', label],
			}
		}

		presets['ufx_unit_parameter'] = {
			type: 'simple',
			name: 'Set RackUltraFX Unit Parameter',
			style: {
				text: 'UFX UNIT PARAMETER',
				size: 'auto',
				color: WHITE,
				bgcolor: AMBER,
			},
			steps: [
				{
					down: [
						{
							actionId: 'ufx_unit_parameter',
							options: { midiChannel: 1, controlNumber: 0, controlValue: 0 },
						},
					],
					up: [],
				},
			],
			feedbacks: [],
			keywords: ['rackultrafx', 'ufx', 'unit', 'parameter', 'midi', 'control change'],
		}
	}

	for (const choice of MMC_TRANSPORT_CHOICES) {
		const slug = choice.label.toLowerCase().replaceAll(' ', '_')
		presets[`mmc_${slug}`] = {
			type: 'simple',
			name: `MMC ${choice.label}`,
			style: {
				text: `MMC\n${choice.label.toUpperCase()}`,
				size: 'auto',
				color: WHITE,
				bgcolor: choice.label === 'Record' ? RED : BLUE,
			},
			steps: [{ down: [{ actionId: `mmc_${slug}`, options: {} }], up: [] }],
			feedbacks: [],
			keywords: ['mmc', 'transport', choice.label],
		}
	}

	presets['usb_audio_record_toggle'] = {
		type: 'simple',
		name: 'USB Play/Record: Record Toggle',
		style: { text: 'RECORD\nTOGGLE', size: 'auto', color: WHITE, bgcolor: BLACK },
		steps: [{ down: [{ actionId: 'usb_audio_record_toggle', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'usb_recorder_recording', options: {}, style: { bgcolor: RED, color: WHITE } }],
		keywords: ['usb', 'audio', 'recorder', 'record', 'toggle'],
	}
	presets['usb_audio_record_start'] = {
		type: 'simple',
		name: 'USB Play/Record: Record Start',
		style: { text: 'RECORD\nSTART', size: 'auto', color: WHITE, bgcolor: BLACK },
		steps: [{ down: [{ actionId: 'usb_audio_record_start', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'usb_recorder_recording', options: {}, style: { bgcolor: RED, color: WHITE } }],
		keywords: ['usb', 'audio', 'recorder', 'record', 'start'],
	}
	presets['usb_audio_record_stop'] = {
		type: 'simple',
		name: 'USB Play/Record: Record Stop',
		style: { text: 'RECORD\nSTOP', size: 'auto', color: WHITE, bgcolor: BLACK },
		steps: [{ down: [{ actionId: 'usb_audio_record_stop', options: {} }], up: [] }],
		feedbacks: [],
		keywords: ['usb', 'audio', 'recorder', 'record', 'stop'],
	}

	presets['usb_audio_play_pause'] = {
		type: 'simple',
		name: 'USB Play/Record: Play/Pause',
		style: { text: 'PLAY /\nPAUSE', size: 'auto', color: WHITE, bgcolor: BLACK },
		steps: [{ down: [{ actionId: 'usb_audio_play_pause', options: {} }], up: [] }],
		feedbacks: [
			{ feedbackId: 'usb_playback_playing', options: {}, style: { bgcolor: GREEN, color: WHITE } },
			{ feedbackId: 'usb_playback_paused', options: {}, style: { bgcolor: AMBER, color: WHITE } },
		],
		keywords: ['usb', 'audio', 'playback', 'play', 'pause', 'resume'],
	}
	presets['usb_audio_playback_stop'] = {
		type: 'simple',
		name: 'USB Play/Record: Stop',
		style: { text: 'STOP', size: 'auto', color: WHITE, bgcolor: BLACK },
		steps: [{ down: [{ actionId: 'usb_audio_playback_stop', options: {} }], up: [] }],
		feedbacks: [],
		keywords: ['usb', 'audio', 'playback', 'stop'],
	}

	return presets
}

export function GetPresetSections(
	_inputCount: number,
	rackUfxInstalled = false,
): CompanionPresetSection<ModuleSchema>[] {
	const avantis = avantisConfig.config

	const mainMixPresets: string[] = []
	for (let i = 1; i <= avantis.mainsCount; i++) {
		mainMixPresets.push(`mute_main_${i}`)
		mainMixPresets.push(`unmute_main_${i}`)
		mainMixPresets.push(`toggle_mute_main_${i}`)
		mainMixPresets.push(`fader_main_0db_${i}`)
	}

	const dcaPresets: string[] = []
	for (let i = 1; i <= avantis.dcaCount; i++) {
		dcaPresets.push(`mute_dca_${i}`)
		dcaPresets.push(`unmute_dca_${i}`)
		dcaPresets.push(`toggle_mute_dca_${i}`)
		dcaPresets.push(`fader_dca_0db_${i}`)
	}

	const muteGroupPresets: string[] = []
	for (let i = 1; i <= avantis.muteGroupCount; i++) {
		muteGroupPresets.push(`toggle_mute_group_${i}`)
	}

	const scenePresets: string[] = []
	for (let i = 1; i <= Math.min(avantis.sceneCount, 100); i++) {
		scenePresets.push(`scene_recall_${i}`)
	}

	const sendLevelPresets: string[] = []
	for (let i = 1; i <= Math.min(avantis.mono.auxCount, 16); i++) {
		sendLevelPresets.push(`send_ch1_mono_aux_${i}_0db`)
	}

	const colorPresets: string[] = ['channel_1_name']
	const colors = ['off', 'red', 'green', 'yellow', 'blue', 'purple', 'light_blue', 'white']
	for (const id of colors) {
		colorPresets.push(`channel_1_color_${id}`)
	}

	const sections: CompanionPresetSection<ModuleSchema>[] = [
		{
			id: 'inputs',
			name: 'Inputs',
			definitions: [
				{
					id: 'input-examples',
					type: 'simple',
					name: 'Input 1 Examples',
					presets: ['toggle_mute_input_1', 'fader_input_0db_1', 'fader_input_off_1'],
				},
			],
		},
		{
			id: 'main-mix',
			name: 'Main Mix',
			definitions: [
				{
					id: 'main-mix-group',
					type: 'simple',
					name: 'Main Mix',
					presets: mainMixPresets,
				},
			],
		},
		{
			id: 'dca',
			name: 'DCA',
			definitions: [
				{
					id: 'dca-group',
					type: 'simple',
					name: 'DCA',
					presets: dcaPresets,
				},
			],
		},
		{
			id: 'mute-groups',
			name: 'Mute Groups',
			definitions: [
				{
					id: 'mute-groups-group',
					type: 'simple',
					name: 'Mute Groups',
					presets: muteGroupPresets,
				},
			],
		},
		{
			id: 'virtual-soundcheck',
			name: 'Virtual Soundcheck',
			definitions: [
				{
					id: 'virtual-soundcheck-group',
					type: 'simple',
					name: 'Virtual Soundcheck Modes',
					presets: VIRTUAL_SOUNDCHECK_MODE_CHOICES.map((choice) => `virtual_soundcheck_mode_${Number(choice.id)}`),
				},
			],
		},
		{
			id: 'usb-play-record',
			name: 'USB Play/Record',
			definitions: [
				{
					id: 'usb-play-record-controls',
					type: 'simple',
					name: 'Recorder and Playback',
					presets: [
						'usb_audio_record_toggle',
						'usb_audio_record_start',
						'usb_audio_record_stop',
						'usb_audio_play_pause',
						'usb_audio_playback_stop',
					],
				},
			],
		},
		{
			id: 'console-utility',
			name: 'Console Utility',
			definitions: [
				{
					id: 'console-utility-status',
					type: 'simple',
					name: 'Status',
					presets: ['utility_usb_recorder_status', 'utility_master_strips_lock_status', 'utility_talkback_status'],
				},
			],
		},
		{
			id: 'global-musical-control',
			name: 'Global Key, Scale & Tempo',
			definitions: [
				...(rackUfxInstalled
					? [
							{
								id: 'global-key',
								type: 'simple' as const,
								name: 'Global Key',
								presets: UFX_GLOBAL_KEY_CHOICES.map((choice) => `ufx_global_key_${Number(choice.id)}`),
							},
							{
								id: 'global-scale',
								type: 'simple' as const,
								name: 'Global Scale',
								presets: UFX_GLOBAL_SCALE_CHOICES.map((choice) => `ufx_global_scale_${Number(choice.id)}`),
							},
						]
					: []),
				{
					id: 'global-tempo',
					type: 'simple',
					name: 'Global Tempo',
					presets: ['global_tap_tempo', 'global_set_tempo_bpm'],
				},
			],
		},
		{
			id: 'scenes',
			name: 'Scenes',
			definitions: [
				{
					id: 'scenes-group',
					type: 'simple',
					name: 'Scenes',
					presets: scenePresets,
				},
			],
		},
		{
			id: 'send-levels',
			name: 'Send Levels',
			definitions: [
				{
					id: 'send-levels-group',
					type: 'simple',
					name: 'Send Levels',
					presets: sendLevelPresets,
				},
			],
		},
		{
			id: 'channel-name-color',
			name: 'Channel Name & Color',
			definitions: [
				{
					id: 'channel-name-color-group',
					type: 'simple',
					name: 'Channel Name & Color',
					presets: colorPresets,
				},
			],
		},
	]

	if (rackUfxInstalled) {
		const ufxBypassPresets = [
			'ufx_toggle_bypass_all',
			...Array.from({ length: 8 }, (_, index) => `ufx_toggle_bypass_${index + 1}`),
		]
		const ufxPluginBypassPresets = [
			'ufx_toggle_all_plugin_bypass',
			...Array.from({ length: 8 }, (_, index) => `ufx_toggle_plugin_bypass_${index + 1}`),
		]
		const ufxSendPresets: string[] = []
		const ufxReturnPresets: string[] = []
		for (let unit = 1; unit <= UFX_SEND_COUNT; unit++) {
			ufxSendPresets.push(
				`mute_ufx_send_${unit}`,
				`unmute_ufx_send_${unit}`,
				`toggle_mute_ufx_send_${unit}`,
				`fader_ufx_send_0db_${unit}`,
			)
		}
		for (let unit = 1; unit <= UFX_RETURN_COUNT; unit++) {
			ufxReturnPresets.push(
				`mute_ufx_return_${unit}`,
				`unmute_ufx_return_${unit}`,
				`toggle_mute_ufx_return_${unit}`,
				`fader_ufx_return_0db_${unit}`,
			)
		}
		sections.push({
			id: 'rackultrafx',
			name: 'RackUltraFX',
			definitions: [
				{
					id: 'rackultrafx-bypass',
					type: 'simple',
					name: 'Bypass',
					presets: ufxBypassPresets,
				},
				{
					id: 'rackultrafx-plugin-bypass',
					type: 'simple',
					name: 'Plugin Bypass',
					presets: ufxPluginBypassPresets,
				},
				{
					id: 'rackultrafx-sends',
					type: 'simple',
					name: 'UFX Sends',
					presets: ufxSendPresets,
				},
				{
					id: 'rackultrafx-returns',
					type: 'simple',
					name: 'UFX Returns',
					presets: ufxReturnPresets,
				},
				{
					id: 'rackultrafx-unit-parameter',
					type: 'simple',
					name: 'Unit Parameter',
					presets: ['ufx_unit_parameter'],
				},
			],
		})
	}

	sections.push({
		id: 'mmc-transport',
		name: 'MMC Transport',
		definitions: [
			{
				id: 'mmc-transport-group',
				type: 'simple',
				name: 'Transport Controls',
				presets: MMC_TRANSPORT_CHOICES.map((choice) => `mmc_${choice.label.toLowerCase().replaceAll(' ', '_')}`),
			},
		],
	})

	return sections
}

export function UpdatePresets(self: ModuleInstance): void {
	const inputCount = getChannelCapacities(self.config).inputCount
	const rackUfxInstalled = self.config.rackUfxInstalled === true
	const sceneNameRetrievalLimit = getSceneNameRetrievalLimit(self.config)
	self.setPresetDefinitions(
		GetPresetSections(inputCount, rackUfxInstalled),
		GetPresetDefinitions(inputCount, rackUfxInstalled, sceneNameRetrievalLimit),
	)
}

export default UpdatePresets
