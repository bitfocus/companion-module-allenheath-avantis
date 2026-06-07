import { Regex, type JsonValue, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	[key: string]: JsonValue
	host: string | null
	midiBase: number
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
	]
}
