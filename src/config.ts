import { Regex, type JsonValue, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	[key: string]: JsonValue
	host: string | null
	midiBase: number
	inputCount: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			value: 'This module is for the Allen & Heath Avantis mixer',
			label: 'Information',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 6,
			default: '192.168.1.70',
			regex: Regex.IP,
		},
		{
			type: 'number',
			label: 'MIDI Base Channel',
			id: 'midiBase',
			tooltip: 'The base channel selected in Utility / Control / MIDI and cannot exceed 12',
			width: 6,
			default: 1,
			min: 1,
			max: 12,
		},
		{
			type: 'dropdown',
			label: 'Input Channel Count',
			id: 'inputCount',
			tooltip: 'Avantis V2.0 expands dPack systems from 64 to 96 input channels.',
			width: 6,
			default: 64,
			choices: [
				{ id: 64, label: '64 Inputs' },
				{ id: 96, label: '96 Inputs (V2.0 dPack)' },
			],
		},
	]
}
