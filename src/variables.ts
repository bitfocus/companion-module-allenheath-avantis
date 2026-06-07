import type { CompanionVariableValue } from '@companion-module/base'
import type ModuleInstance from './main.js'

export type VariablesSchema = Record<string, CompanionVariableValue>

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions({})
}

export default UpdateVariableDefinitions
