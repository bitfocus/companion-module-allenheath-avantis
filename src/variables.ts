import type { CompanionVariableValue, CompanionVariableDefinitions } from '@companion-module/base'
import avantisConfig from './avantisconfig.json' with { type: 'json' }
import type ModuleInstance from './main.js'

export type VariablesSchema = Record<string, CompanionVariableValue>

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const definitions: CompanionVariableDefinitions<VariablesSchema> = {}
	const initialValues: Record<string, CompanionVariableValue> = {}
	const avantis = avantisConfig.config
	const inputCount = self.config.inputCount ?? avantis.inputCount

	const addVar = (prefix: string, index: number, label: string) => {
		const varId = `${prefix}_${index}`
		definitions[varId] = {
			name: `${label} ${index} Fader Level (dB)`,
		}
		initialValues[varId] = '-inf dB'
	}

	// Inputs
	for (let i = 1; i <= inputCount; i++) {
		addVar('fader_input', i, 'Input')
	}

	// Main Mixes
	for (let i = 1; i <= avantis.mainsCount; i++) {
		addVar('fader_main', i, 'Main Mix')
	}

	// DCAs
	for (let i = 1; i <= avantis.dcaCount; i++) {
		addVar('fader_dca', i, 'DCA')
	}

	// Mono Groups
	for (let i = 1; i <= avantis.mono.groupCount; i++) {
		addVar('fader_mono_group', i, 'Mono Group')
	}

	// Stereo Groups
	for (let i = 1; i <= avantis.stereo.groupCount; i++) {
		addVar('fader_stereo_group', i, 'Stereo Group')
	}

	// Mono Auxes
	for (let i = 1; i <= avantis.mono.auxCount; i++) {
		addVar('fader_mono_aux', i, 'Mono Aux')
	}

	// Stereo Auxes
	for (let i = 1; i <= avantis.stereo.auxCount; i++) {
		addVar('fader_stereo_aux', i, 'Stereo Aux')
	}

	// Mono Matrices
	for (let i = 1; i <= avantis.mono.matrixCount; i++) {
		addVar('fader_mono_matrix', i, 'Mono Matrix')
	}

	// Stereo Matrices
	for (let i = 1; i <= avantis.stereo.matrixCount; i++) {
		addVar('fader_stereo_matrix', i, 'Stereo Matrix')
	}

	// Mono FX Sends
	for (let i = 1; i <= avantis.mono.fxSendCount; i++) {
		addVar('fader_mono_fx_send', i, 'Mono FX Send')
	}

	// Stereo FX Sends
	for (let i = 1; i <= avantis.stereo.fxSendCount; i++) {
		addVar('fader_stereo_fx_send', i, 'Stereo FX Send')
	}

	// FX Returns
	for (let i = 1; i <= avantis.fxReturnCount; i++) {
		addVar('fader_fx_return', i, 'FX Return')
	}

	self.setVariableDefinitions(definitions)
	self.setVariableValues(initialValues)
}

export default UpdateVariableDefinitions
