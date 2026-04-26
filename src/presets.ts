import { CompanionPresetDefinitions } from '@companion-module/base'
import avantisConfig from './avantisconfig.json'

const BLACK = 0x000000
const WHITE = 0xffffff
const RED = 0xff0000
const GREEN = 0x00a000
const BLUE = 0x0040ff
const AMBER = 0xffa000
const PURPLE = 0x8000ff

export default function (self: any) {
	const presets: CompanionPresetDefinitions = {}
	const config = avantisConfig.config

	const addButton = (
		id: string,
		category: string,
		name: string,
		text: string,
		actionId: string,
		options: Record<string, any>,
		bgcolor = BLACK,
		color = WHITE,
	) => {
		presets[id] = {
			type: 'button',
			category,
			name,
			style: {
				text,
				size: '18',
				color,
				bgcolor,
			},
			feedbacks: [],
			steps: [
				{
					down: [
						{
							actionId,
							options,
						},
					],
					up: [],
				},
			],
		}
	}

	for (let channel = 1; channel <= config.inputCount; channel++) {
		const channelId = channel - 1

		addButton(
			`mute_input_${channel}`,
			'Input Mutes',
			`Mute CH ${channel}`,
			`CH ${channel}\nMUTE`,
			'mute_input',
			{ channel: channelId, mute: true },
			RED,
		)

		addButton(
			`unmute_input_${channel}`,
			'Input Mutes',
			`Unmute CH ${channel}`,
			`CH ${channel}\nON`,
			'mute_input',
			{ channel: channelId, mute: false },
			GREEN,
		)

		addButton(
			`fader_input_0db_${channel}`,
			'Input Faders',
			`CH ${channel} to 0 dB`,
			`CH ${channel}\n0 dB`,
			'fader_input',
			{ channel: channelId, level: 0x6b },
			BLUE,
		)

		addButton(
			`fader_input_off_${channel}`,
			'Input Faders',
			`CH ${channel} to -inf`,
			`CH ${channel}\n-inf`,
			'fader_input',
			{ channel: channelId, level: 0x00 },
			BLACK,
		)
	}

	for (let mix = 1; mix <= config.mainsCount; mix++) {
		const mixId = mix + 0x2f

		addButton(
			`mute_main_${mix}`,
			'Main Mix',
			`Mute Main ${mix}`,
			`MAIN ${mix}\nMUTE`,
			'mute_master',
			{ channel: mixId, mute: true },
			RED,
		)

		addButton(
			`unmute_main_${mix}`,
			'Main Mix',
			`Unmute Main ${mix}`,
			`MAIN ${mix}\nON`,
			'mute_master',
			{ channel: mixId, mute: false },
			GREEN,
		)

		addButton(
			`fader_main_0db_${mix}`,
			'Main Mix',
			`Main ${mix} to 0 dB`,
			`MAIN ${mix}\n0 dB`,
			'fader_master',
			{ channel: mixId, level: 0x6b },
			BLUE,
		)
	}

	for (let dca = 1; dca <= config.dcaCount; dca++) {
		const dcaId = dca + 0x35

		addButton(
			`mute_dca_${dca}`,
			'DCA',
			`Mute DCA ${dca}`,
			`DCA ${dca}\nMUTE`,
			'mute_dca',
			{ channel: dcaId, mute: true },
			RED,
		)

		addButton(
			`unmute_dca_${dca}`,
			'DCA',
			`Unmute DCA ${dca}`,
			`DCA ${dca}\nON`,
			'mute_dca',
			{ channel: dcaId, mute: false },
			GREEN,
		)
	}

	for (let scene = 1; scene <= Math.min(config.sceneCount, 32); scene++) {
		addButton(
			`scene_recall_${scene}`,
			'Scenes',
			`Recall Scene ${scene}`,
			`SCENE\n${scene}`,
			'scene_recall',
			{ sceneNumber: scene - 1 },
			PURPLE,
		)
	}

	for (let aux = 1; aux <= Math.min(config.mono.auxCount, 16); aux++) {
		addButton(
			`send_ch1_mono_aux_${aux}_0db`,
			'Send Levels',
			`Send CH 1 to Mono Aux ${aux} at 0 dB`,
			`CH 1 > AUX ${aux}\n0 dB`,
			'send_input_to_mono_aux',
			{ srcChannel: [0], destChannel: aux - 1, level: 0x6b },
			AMBER,
			BLACK,
		)
	}

	addButton(
		'channel_1_name',
		'Channel Name & Color',
		'Set CH 1 Name',
		`CH 1\nNAME`,
		'channel_name',
		{ channel: 0, channelName: 'CH 1' },
		BLUE,
	)

	const colors = [
		['red', 'Red', 1, RED],
		['green', 'Green', 2, GREEN],
		['yellow', 'Yellow', 3, AMBER],
		['blue', 'Blue', 4, BLUE],
		['purple', 'Purple', 5, PURPLE],
	] as const

	for (const [id, label, colorId, bgcolor] of colors) {
		addButton(
			`channel_1_color_${id}`,
			'Channel Name & Color',
			`Set CH 1 ${label}`,
			`CH 1\n${label.toUpperCase()}`,
			'channel_color',
			{ channel: 0, color: colorId },
			bgcolor,
			id === 'yellow' || id === 'green' ? BLACK : WHITE,
		)
	}

	self.setPresetDefinitions(presets)
}
