import { CompanionPresetDefinitions } from '@companion-module/base'
import avantisConfig from './avantisconfig.json'

export function GetPresets(): CompanionPresetDefinitions {
	const presets: CompanionPresetDefinitions = {}
	const avantis = avantisConfig['config']

	// -----------------------------------------------------------------------
	// INPUT MUTES
	// offset: -1 (from actions.ts)
	// -----------------------------------------------------------------------
	for (let i = 1; i <= avantis.inputCount; i++) {
		presets[`mute_input_${i}`] = {
			type: 'button',
			category: 'Input Mutes',
			name: `Mute Input ${i}`,
			style: {
				text: `Mute\\nIn ${i}`,
				size: '18',
				color: 16777215, // White text
				bgcolor: 0,      // Black background
			},
			steps: [
				{
					down: [
						{
							actionId: 'mute_input',
							options: {
								channel: i - 1, // Offset is -1
								mute: true,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}
	}

	// -----------------------------------------------------------------------
	// DCA MUTES
	// offset: 0x35 / 53 (from actions.ts)
	// -----------------------------------------------------------------------
	for (let i = 1; i <= avantis.dcaCount; i++) {
		presets[`mute_dca_${i}`] = {
			type: 'button',
			category: 'DCA Mutes',
			name: `Mute DCA ${i}`,
			style: {
				text: `Mute\\nDCA ${i}`,
				size: '18',
				color: 16777215,
				bgcolor: 0,
			},
			steps: [
				{
					down: [
						{
							actionId: 'mute_dca',
							options: {
								channel: i + 0x35, // Offset is 0x35
								mute: true,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}
	}

	// -----------------------------------------------------------------------
	// MUTE GROUPS
	// offset: 0x45 / 69 (from actions.ts)
	// -----------------------------------------------------------------------
	for (let i = 1; i <= avantis.muteGroupCount; i++) {
		presets[`mute_group_${i}`] = {
			type: 'button',
			category: 'Mute Groups',
			name: `Mute Group ${i}`,
			style: {
				text: `Mute\\nGrp ${i}`,
				size: '18',
				color: 16777215,
				bgcolor: 0,
			},
			steps: [
				{
					down: [
						{
							actionId: 'mute_group',
							options: {
								channel: i + 0x45, // Offset is 0x45
								mute: true,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}
	}

	return presets
}