import {
	combineRgb,
	type CompanionPresetDefinitions,
	type CompanionPresetSection,
	type CompanionSimplePresetDefinition,
} from '@companion-module/base'
import avantisConfig from './avantisconfig.json' with { type: 'json' }
import type ModuleInstance from './main.js'
import type { ModuleSchema } from './main.js'

const BLACK = combineRgb(0, 0, 0)
const WHITE = combineRgb(255, 255, 255)
const RED = combineRgb(255, 0, 0)
const GREEN = combineRgb(0, 160, 0)
const BLUE = combineRgb(0, 64, 255)
const AMBER = combineRgb(255, 160, 0)
const PURPLE = combineRgb(128, 0, 255)

const channelRange = (start: number, end: number) =>
	Array.from({ length: end - start + 1 }, (_, index) => start + index)

/** Level byte for 0 dB, used as the press-to-grab point on fader dials. */
const LEVEL_UNITY = 0x6b

/** Level byte for -20 dB: a deliberately quiet place to take hold of a send. */
const SEND_SEED_LEVEL = 0x43

function buildMutePreset(
	id: string,
	name: string,
	text: string,
	actionId: 'mute_input' | 'mute_dca' | 'mute_group' | 'mute_master',
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
			size: '18',
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
	actionId: 'fader_input' | 'fader_master' | 'fader_DCA',
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
			size: '18',
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

/**
 * A rotary preset for a Stream Deck+ dial (or any surface with rotation).
 *
 * Turning nudges the level; pressing sets it to a known value.  The press
 * matters more than it looks: relative moves need a starting point, and the
 * actions ship set to sit still until the level is known rather than assume
 * one and jump a live fader on the first turn.
 */
function buildFaderDialPreset(
	id: string,
	name: string,
	text: string,
	actionId:
		| 'fader_adjust_input'
		| 'fader_adjust_mono_aux'
		| 'fader_adjust_stereo_aux'
		| 'fader_adjust_dca'
		| 'fader_adjust_master',
	seedActionId: 'fader_input' | 'fader_mono_aux' | 'fader_stereo_aux' | 'fader_DCA' | 'fader_master',
	channel: number,
	bgcolor: number,
): CompanionSimplePresetDefinition<ModuleSchema> {
	const adjust = { channel, minLevel: 0x00, maxLevel: 0x7f, unknownLevel: 'none', accel: false }

	return {
		type: 'simple',
		name,
		style: { text, size: '14', color: WHITE, bgcolor },
		steps: [
			{
				down: [{ actionId: seedActionId, options: { channel, level: LEVEL_UNITY, fadeDuration: 0 } }],
				up: [],
				rotate_left: [{ actionId, options: { ...adjust, delta: -1 } }],
				rotate_right: [{ actionId, options: { ...adjust, delta: 1 } }],
			},
		],
		feedbacks: [],
		keywords: [id, 'dial', 'rotary', 'fader', 'trim'],
	}
}

function buildSendDialPreset(
	id: string,
	name: string,
	text: string,
	srcChannel: number,
	destChannel: number,
	bgcolor: number,
): CompanionSimplePresetDefinition<ModuleSchema> {
	const adjust = {
		srcChannel,
		destChannel,
		minLevel: 0x00,
		maxLevel: 0x7f,
		unknownLevel: 'none',
		accel: false,
	}

	return {
		type: 'simple',
		name,
		style: { text, size: '14', color: WHITE, bgcolor },
		steps: [
			{
				// The desk never reports send levels, so the press is the only way
				// this dial learns where it is starting from.
				down: [
					{
						actionId: 'send_input_to_mono_aux',
						options: { srcChannel: [srcChannel], destChannel, level: SEND_SEED_LEVEL },
					},
				],
				up: [],
				rotate_left: [{ actionId: 'send_adjust_input_to_mono_aux', options: { ...adjust, delta: -1 } }],
				rotate_right: [{ actionId: 'send_adjust_input_to_mono_aux', options: { ...adjust, delta: 1 } }],
			},
		],
		feedbacks: [],
		keywords: [id, 'dial', 'rotary', 'send', 'monitor', 'aux'],
	}
}

export function GetPresetDefinitions(
	inputCount: number,
	connectionLabel: string,
): CompanionPresetDefinitions<ModuleSchema> {
	const presets: CompanionPresetDefinitions<ModuleSchema> = {}
	const avantis = avantisConfig.config

	// Input Mutes & Faders
	for (let channel = 1; channel <= inputCount; channel++) {
		const channelId = channel - 1

		presets[`mute_input_${channel}`] = buildMutePreset(
			`mute_input_${channel}`,
			`Mute CH ${channel}`,
			`CH ${channel}\nMUTE`,
			'mute_input',
			channelId,
			'mute',
			RED,
			WHITE,
		)

		presets[`unmute_input_${channel}`] = buildMutePreset(
			`unmute_input_${channel}`,
			`Unmute CH ${channel}`,
			`CH ${channel}\nON`,
			'mute_input',
			channelId,
			'unmute',
			GREEN,
			WHITE,
		)

		presets[`toggle_mute_input_${channel}`] = buildMutePreset(
			`toggle_mute_input_${channel}`,
			`Toggle Mute CH ${channel}`,
			`CH ${channel}\nTOGGLE`,
			'mute_input',
			channelId,
			'toggle',
			GREEN,
			WHITE,
		)

		presets[`fader_input_0db_${channel}`] = buildFaderPreset(
			`fader_input_0db_${channel}`,
			`CH ${channel} to 0 dB`,
			`CH ${channel}\n0 dB`,
			'fader_input',
			channelId,
			0x6b,
			BLUE,
			WHITE,
		)

		presets[`fader_input_off_${channel}`] = buildFaderPreset(
			`fader_input_off_${channel}`,
			`CH ${channel} to -inf`,
			`CH ${channel}\n-inf`,
			'fader_input',
			channelId,
			0x00,
			BLACK,
			WHITE,
		)
	}

	// Input Bank Mutes
	for (let start = 1; start <= inputCount; start += 8) {
		const end = Math.min(start + 7, inputCount)
		const channels = channelRange(start, end)

		presets[`mute_input_bank_${start}_${end}`] = {
			type: 'simple',
			name: `Mute CH ${start}-${end}`,
			style: {
				text: `CH ${start}-${end}\nMUTE`,
				size: '18',
				color: WHITE,
				bgcolor: RED,
			},
			steps: [
				{
					down: channels.map((channel) => ({
						actionId: 'mute_input',
						options: { channel: channel - 1, mute: 'mute' },
					})),
					up: [],
				},
			],
			feedbacks: [],
			keywords: [`mute_input_bank_${start}_${end}`, 'mute'],
		}

		presets[`unmute_input_bank_${start}_${end}`] = {
			type: 'simple',
			name: `Unmute CH ${start}-${end}`,
			style: {
				text: `CH ${start}-${end}\nON`,
				size: '18',
				color: WHITE,
				bgcolor: GREEN,
			},
			steps: [
				{
					down: channels.map((channel) => ({
						actionId: 'mute_input',
						options: { channel: channel - 1, mute: 'unmute' },
					})),
					up: [],
				},
			],
			feedbacks: [],
			keywords: [`unmute_input_bank_${start}_${end}`, 'mute'],
		}
	}

	// Mute All Inputs
	presets['mute_all_inputs'] = {
		type: 'simple',
		name: 'Mute All Inputs',
		style: {
			text: `ALL CH\nMUTE`,
			size: '18',
			color: WHITE,
			bgcolor: RED,
		},
		steps: [
			{
				down: channelRange(1, inputCount).map((channel) => ({
					actionId: 'mute_input',
					options: { channel: channel - 1, mute: 'mute' },
				})),
				up: [],
			},
		],
		feedbacks: [],
		keywords: ['mute_all_inputs', 'mute'],
	}

	presets['unmute_all_inputs'] = {
		type: 'simple',
		name: 'Unmute All Inputs',
		style: {
			text: `ALL CH\nON`,
			size: '18',
			color: WHITE,
			bgcolor: GREEN,
		},
		steps: [
			{
				down: channelRange(1, inputCount).map((channel) => ({
					actionId: 'mute_input',
					options: { channel: channel - 1, mute: 'unmute' },
				})),
				up: [],
			},
		],
		feedbacks: [],
		keywords: ['unmute_all_inputs', 'mute'],
	}

	// Main Mix
	for (let mix = 1; mix <= avantis.mainsCount; mix++) {
		const mixId = mix + 0x2f

		presets[`mute_main_${mix}`] = buildMutePreset(
			`mute_main_${mix}`,
			`Mute Main ${mix}`,
			`MAIN ${mix}\nMUTE`,
			'mute_master',
			mixId,
			'mute',
			RED,
			WHITE,
		)

		presets[`unmute_main_${mix}`] = buildMutePreset(
			`unmute_main_${mix}`,
			`Unmute Main ${mix}`,
			`MAIN ${mix}\nON`,
			'mute_master',
			mixId,
			'unmute',
			GREEN,
			WHITE,
		)

		presets[`toggle_mute_main_${mix}`] = buildMutePreset(
			`toggle_mute_main_${mix}`,
			`Toggle Mute Main ${mix}`,
			`MAIN ${mix}\nTOGGLE`,
			'mute_master',
			mixId,
			'toggle',
			GREEN,
			WHITE,
		)

		presets[`fader_main_0db_${mix}`] = buildFaderPreset(
			`fader_main_0db_${mix}`,
			`Main ${mix} to 0 dB`,
			`MAIN ${mix}\n0 dB`,
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
			`DCA ${dcaNumber}\nMUTE`,
			'mute_dca',
			dcaId,
			'mute',
			RED,
			WHITE,
		)

		presets[`unmute_dca_${dcaNumber}`] = buildMutePreset(
			`unmute_dca_${dcaNumber}`,
			`Unmute DCA ${dcaNumber}`,
			`DCA ${dcaNumber}\nON`,
			'mute_dca',
			dcaId,
			'unmute',
			GREEN,
			WHITE,
		)

		presets[`toggle_mute_dca_${dcaNumber}`] = buildMutePreset(
			`toggle_mute_dca_${dcaNumber}`,
			`Toggle Mute DCA ${dcaNumber}`,
			`DCA ${dcaNumber}\nTOGGLE`,
			'mute_dca',
			dcaId,
			'toggle',
			GREEN,
			WHITE,
		)

		presets[`fader_dca_0db_${dcaNumber}`] = buildFaderPreset(
			`fader_dca_0db_${dcaNumber}`,
			`DCA ${dcaNumber} to 0 dB`,
			`DCA ${dcaNumber}\n0 dB`,
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

		presets[`mute_group_${group}`] = buildMutePreset(
			`mute_group_${group}`,
			`Mute Group ${group}`,
			`MUTE GRP ${group}\nMUTE`,
			'mute_group',
			groupId,
			'mute',
			RED,
			WHITE,
		)

		presets[`unmute_group_${group}`] = buildMutePreset(
			`unmute_group_${group}`,
			`Unmute Group ${group}`,
			`MUTE GRP ${group}\nON`,
			'mute_group',
			groupId,
			'unmute',
			GREEN,
			WHITE,
		)

		presets[`toggle_mute_group_${group}`] = buildMutePreset(
			`toggle_mute_group_${group}`,
			`Toggle Mute Group ${group}`,
			`MUTE GRP ${group}\nTOGGLE`,
			'mute_group',
			groupId,
			'toggle',
			GREEN,
			WHITE,
		)
	}

	// Scenes (1-100)
	for (let scene = 1; scene <= Math.min(avantis.sceneCount, 100); scene++) {
		presets[`scene_recall_${scene}`] = {
			type: 'simple',
			name: `Recall Scene ${scene}`,
			style: {
				text: `SCENE\n${scene}`,
				size: '18',
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
				text: `CH 1 > AUX ${aux}\n0 dB`,
				size: '18',
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
			text: `CH 1\nNAME`,
			size: '18',
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
		['red', 'Red', 1, RED, WHITE],
		['green', 'Green', 2, GREEN, WHITE],
		['yellow', 'Yellow', 3, AMBER, BLACK],
		['blue', 'Blue', 4, BLUE, WHITE],
		['purple', 'Purple', 5, PURPLE, WHITE],
	] as const

	for (const [id, label, colorId, bgcolor, color] of colors) {
		presets[`channel_1_color_${id}`] = {
			type: 'simple',
			name: `Set CH 1 ${label}`,
			style: {
				text: `CH 1\n${label.toUpperCase()}`,
				size: '18',
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

	addDialPresets(presets, inputCount, connectionLabel)

	return presets
}

/**
 * Ready-made rotary buttons for Stream Deck+ dials.
 *
 * `label` is this connection's own label, which is the prefix its variables are
 * addressed by. Reading it at runtime rather than assuming the module shortname
 * keeps the button text working when the connection has been renamed.
 */
function addDialPresets(presets: CompanionPresetDefinitions<ModuleSchema>, inputCount: number, label: string): void {
	const avantis = avantisConfig.config
	const auxDialCount = Math.min(8, avantis.mono.auxCount)

	for (let channel = 1; channel <= inputCount; channel++) {
		presets[`dial_fader_input_${channel}`] = buildFaderDialPreset(
			`dial_fader_input_${channel}`,
			`Dial: CH ${channel} fader`,
			`CH ${channel}\n$(${label}:fader_input_${channel})\npress 0dB`,
			'fader_adjust_input',
			'fader_input',
			channel - 1,
			BLUE,
		)
	}

	for (let dca = 1; dca <= avantis.dcaCount; dca++) {
		presets[`dial_fader_dca_${dca}`] = buildFaderDialPreset(
			`dial_fader_dca_${dca}`,
			`Dial: DCA ${dca} fader`,
			`DCA ${dca}\n$(${label}:fader_dca_${dca})\npress 0dB`,
			'fader_adjust_dca',
			'fader_DCA',
			dca + 0x35,
			PURPLE,
		)
	}

	for (let main = 1; main <= avantis.mainsCount; main++) {
		presets[`dial_fader_main_${main}`] = buildFaderDialPreset(
			`dial_fader_main_${main}`,
			`Dial: Main ${main} fader`,
			`MAIN ${main}\n$(${label}:fader_main_${main})\npress 0dB`,
			'fader_adjust_master',
			'fader_master',
			main + 0x2f,
			GREEN,
		)
	}

	for (let aux = 1; aux <= auxDialCount; aux++) {
		presets[`dial_fader_mono_aux_${aux}`] = buildFaderDialPreset(
			`dial_fader_mono_aux_${aux}`,
			`Dial: Mono Aux ${aux} master fader`,
			`AUX ${aux}\n$(${label}:fader_mono_aux_${aux})\npress 0dB`,
			'fader_adjust_mono_aux',
			'fader_mono_aux',
			aux - 1,
			AMBER,
		)

		// Monitor sends: input 1 into each aux, as a template to edit.
		presets[`dial_send_in1_mono_aux_${aux}`] = buildSendDialPreset(
			`dial_send_in1_mono_aux_${aux}`,
			`Dial: CH 1 send to Mono Aux ${aux}`,
			`CH 1>AUX ${aux}\n$(${label}:send_in1_to_mono_aux_${aux})\npress -20dB`,
			0,
			aux - 1,
			AMBER,
		)
	}
}

export function GetPresetSections(inputCount: number): CompanionPresetSection<ModuleSchema>[] {
	const avantis = avantisConfig.config

	const inputMutePresets: string[] = []
	for (let i = 1; i <= inputCount; i++) {
		inputMutePresets.push(`mute_input_${i}`)
		inputMutePresets.push(`unmute_input_${i}`)
		inputMutePresets.push(`toggle_mute_input_${i}`)
	}

	const inputFaderPresets: string[] = []
	for (let i = 1; i <= inputCount; i++) {
		inputFaderPresets.push(`fader_input_0db_${i}`)
		inputFaderPresets.push(`fader_input_off_${i}`)
	}

	const inputBankMutePresets: string[] = []
	for (let start = 1; start <= inputCount; start += 8) {
		const end = Math.min(start + 7, inputCount)
		inputBankMutePresets.push(`mute_input_bank_${start}_${end}`)
		inputBankMutePresets.push(`unmute_input_bank_${start}_${end}`)
	}

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
		muteGroupPresets.push(`mute_group_${i}`)
		muteGroupPresets.push(`unmute_group_${i}`)
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

	const dialPresets: string[] = []
	for (let i = 1; i <= inputCount; i++) {
		dialPresets.push(`dial_fader_input_${i}`)
	}
	for (let i = 1; i <= avantis.dcaCount; i++) {
		dialPresets.push(`dial_fader_dca_${i}`)
	}
	for (let i = 1; i <= avantis.mainsCount; i++) {
		dialPresets.push(`dial_fader_main_${i}`)
	}
	for (let i = 1; i <= Math.min(8, avantis.mono.auxCount); i++) {
		dialPresets.push(`dial_fader_mono_aux_${i}`)
		dialPresets.push(`dial_send_in1_mono_aux_${i}`)
	}

	const colorPresets: string[] = ['channel_1_name']
	const colors = ['red', 'green', 'yellow', 'blue', 'purple']
	for (const id of colors) {
		colorPresets.push(`channel_1_color_${id}`)
	}

	return [
		{
			id: 'input-mutes',
			name: 'Input Mutes',
			definitions: [
				{
					id: 'input-mutes-group',
					type: 'simple',
					name: 'Input Mutes',
					presets: inputMutePresets,
				},
			],
		},
		{
			id: 'input-faders',
			name: 'Input Faders',
			definitions: [
				{
					id: 'input-faders-group',
					type: 'simple',
					name: 'Input Faders',
					presets: inputFaderPresets,
				},
			],
		},
		{
			id: 'input-bank-mutes',
			name: 'Input Bank Mutes',
			definitions: [
				{
					id: 'input-bank-mutes-group',
					type: 'simple',
					name: 'Input Bank Mutes',
					presets: inputBankMutePresets,
				},
			],
		},
		{
			id: 'all-input-mutes',
			name: 'All Input Mutes',
			definitions: [
				{
					id: 'all-input-mutes-group',
					type: 'simple',
					name: 'All Input Mutes',
					presets: ['mute_all_inputs', 'unmute_all_inputs'],
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
			id: 'dials',
			name: 'Dials (Stream Deck+)',
			definitions: [
				{
					id: 'dials-group',
					type: 'simple',
					name: 'Dials (Stream Deck+)',
					presets: dialPresets,
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
}

export function UpdatePresets(self: ModuleInstance): void {
	const inputCount = self.config.inputCount ?? avantisConfig.config.inputCount
	self.setPresetDefinitions(GetPresetSections(inputCount), GetPresetDefinitions(inputCount, self.label))
}

export default UpdatePresets
