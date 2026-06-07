import type { CompanionFeedbackSchema, CompanionOptionValues } from '@companion-module/base'
import type ModuleInstance from './main.js'

export type FeedbacksSchema = Record<string, CompanionFeedbackSchema<CompanionOptionValues>>

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({})
}

export default UpdateFeedbacks
