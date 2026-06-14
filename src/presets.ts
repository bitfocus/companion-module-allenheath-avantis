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
		feedbacks: [],
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

export function GetPresetDefinitions(inputCount: number): CompanionPresetDefinitions<ModuleSchema> {
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
			AMBER,
			BLACK,
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
			AMBER,
			BLACK,
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
			AMBER,
			BLACK,
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
			AMBER,
			BLACK,
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

	return presets
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
	self.setPresetDefinitions(GetPresetSections(inputCount), GetPresetDefinitions(inputCount))
}

export default UpdatePresets
