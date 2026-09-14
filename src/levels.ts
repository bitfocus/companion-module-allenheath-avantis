/**
 * Avantis level helpers.
 *
 * The MIDI level byte used by both the NRPN fader messages and the SysEx send
 * level messages runs 0x00 (-inf) to 0x7F (+10 dB).  Above the -inf point the
 * law is linear: 0x07 is -50 dB and every further unit adds 0.5 dB, so
 * 0x6B (107) lands exactly on unity and 0x7F (127) on +10 dB.  Every entry in
 * the published Allen & Heath level table fits that line, which is what makes
 * relative moves possible without carrying the whole table around.
 */

export const LEVEL_MIN = 0x00
export const LEVEL_MAX = 0x7f
export const LEVEL_UNITY = 0x6b

/** Level byte for -50 dB, the lowest point the published table names. */
const LEVEL_MINUS_50DB = 0x07

/** Level units per dB. */
const UNITS_PER_DB = 2

/** Convert a level byte to dB, or null for -inf. */
export function levelToDb(level: number): number | null {
	if (level <= LEVEL_MIN) {
		return null
	}

	return (level - LEVEL_MINUS_50DB) / UNITS_PER_DB - 50
}

/** Convert dB to the nearest level byte. */
export function dbToLevel(db: number): number {
	return clampLevel(Math.round(db * UNITS_PER_DB) + LEVEL_MINUS_50DB + 50 * UNITS_PER_DB)
}

/** Format a level byte the way the fader table labels it, e.g. `+3.5 dB`, `0 dB`, `-inf dB`. */
export function formatLevel(level: number): string {
	const db = levelToDb(level)
	if (db === null) {
		return '-inf dB'
	}

	const rounded = Math.round(db * 10) / 10
	return `${rounded > 0 ? '+' : ''}${rounded} dB`
}

export function clampLevel(level: number): number {
	return Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Math.round(level)))
}

/**
 * Move a level by a number of dB, clamped to the supplied window.
 *
 * The window is applied after the move so a dial can be limited to a sane
 * working range (say -20 dB to +10 dB) without the caller having to think
 * about level bytes.
 */
export function adjustLevel(current: number, deltaDb: number, minLevel: number, maxLevel: number): number {
	const low = clampLevel(Math.min(minLevel, maxLevel))
	const high = clampLevel(Math.max(minLevel, maxLevel))
	const moved = clampLevel(current) + Math.round(deltaDb * UNITS_PER_DB)

	return Math.max(low, Math.min(high, clampLevel(moved)))
}

/**
 * Multiplier for a turn that arrived `gapMs` after the previous one on the same
 * control.  A Stream Deck+ dial reports one event per detent with no velocity,
 * so a fast spin is only distinguishable by how close together the events land.
 * Opt-in per action: predictable 1 dB steps are usually what you want on a live
 * desk, but a long throw from -inf back up to unity is tedious without it.
 */
export function accelerationFactor(gapMs: number): number {
	if (gapMs < 60) {
		return 6
	}
	if (gapMs < 120) {
		return 3
	}

	return 1
}
