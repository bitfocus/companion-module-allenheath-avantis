export type UfxFeedbackTarget = 'key' | 'scale' | `rack:${number}` | `plugin:${number}`
export type UfxFeedbackValue = number | boolean
export const UFX_WRITE_FEEDBACK_GRACE_MS = 1000

type PendingWrite = { value: UfxFeedbackValue; expiresAt: number; deferred?: UfxFeedbackValue }

/** AH-Net values have no command IDs. Hold contradictory responses only for a bounded write grace period. */
export class UfxFeedbackState {
	private readonly received = new Set<UfxFeedbackTarget>()
	private readonly pending = new Map<UfxFeedbackTarget, PendingWrite>()

	expect(target: UfxFeedbackTarget, value: UfxFeedbackValue, now: number): PendingWrite {
		const write = { value, expiresAt: now + UFX_WRITE_FEEDBACK_GRACE_MS }
		this.pending.set(target, write)
		return write
	}

	receive(target: UfxFeedbackTarget, value: UfxFeedbackValue, now: number): boolean {
		this.received.add(target)
		const write = this.pending.get(target)
		if (write && value !== write.value && now < write.expiresAt) {
			write.deferred = value
			return false
		}
		this.pending.delete(target)
		return true
	}

	finish(target: UfxFeedbackTarget, write: PendingWrite): { deferred?: UfxFeedbackValue } | undefined {
		if (this.pending.get(target) !== write) return
		this.pending.delete(target)
		return { deferred: write.deferred }
	}

	hasReceived(target: UfxFeedbackTarget): boolean {
		return this.received.has(target)
	}

	resetSession(): void {
		this.received.clear()
		this.pending.clear()
	}
}
