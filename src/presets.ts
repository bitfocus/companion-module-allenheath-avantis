import {
	combineRgb,
	type CompanionPresetDefinitions,
	type CompanionPresetSection,
	type CompanionSimplePresetDefinition,
} from '@companion-module/base'
import { createRequire } from 'node:module'
import type ModuleInstance from './main.js'
import type { ModuleSchema } from './main.js'

const require = createRequire(import.meta.url)
const avantisConfig = require('./avantisconfig.json') as typeof import('./avantisconfig.json')

function buildMutePreset(
	id: string,
	name: string,
	text: string,
	actionId: 'mute_input' | 'mute_dca' | 'mute_group',
	channel: number,
): CompanionSimplePresetDefinition<ModuleSchema> {
	return {
		type: 'simple',
		name,
		style: {
			text,
			size: '18',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [
			{
				down: [
					{
						actionId,
						options: {
							channel,
							mute: true,
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

export function GetPresetDefinitions(): CompanionPresetDefinitions<ModuleSchema> {
	const presets: CompanionPresetDefinitions<ModuleSchema> = {}
	const avantis = avantisConfig.config

	for (let i = 1; i <= avantis.inputCount; i++) {
		presets[`mute_input_${i}`] = buildMutePreset(
			`mute_input_${i}`,
			`Mute Input ${i}`,
			`Mute\nIn ${i}`,
			'mute_input',
			i - 1,
		)
	}

	for (let i = 1; i <= avantis.dcaCount; i++) {
		presets[`mute_dca_${i}`] = buildMutePreset(`mute_dca_${i}`, `Mute DCA ${i}`, `Mute\nDCA ${i}`, 'mute_dca', i + 0x35)
	}

	for (let i = 1; i <= avantis.muteGroupCount; i++) {
		presets[`mute_group_${i}`] = buildMutePreset(
			`mute_group_${i}`,
			`Mute Group ${i}`,
			`Mute\nGrp ${i}`,
			'mute_group',
			i + 0x45,
		)
	}

	return presets
}

export function GetPresetSections(): CompanionPresetSection<ModuleSchema>[] {
	const avantis = avantisConfig.config

	return [
		{
			id: 'input-mutes',
			name: 'Input Mutes',
			definitions: [
				{
					id: 'input-mutes-group',
					type: 'simple',
					name: 'Input Mutes',
					presets: Array.from({ length: avantis.inputCount }, (_, index) => `mute_input_${index + 1}`),
				},
			],
		},
		{
			id: 'dca-mutes',
			name: 'DCA Mutes',
			definitions: [
				{
					id: 'dca-mutes-group',
					type: 'simple',
					name: 'DCA Mutes',
					presets: Array.from({ length: avantis.dcaCount }, (_, index) => `mute_dca_${index + 1}`),
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
					presets: Array.from({ length: avantis.muteGroupCount }, (_, index) => `mute_group_${index + 1}`),
				},
			],
		},
	]
}

export function UpdatePresets(self: ModuleInstance): void {
	self.setPresetDefinitions(GetPresetSections(), GetPresetDefinitions())
}

export default UpdatePresets
