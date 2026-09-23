import type { ConfiguredMixLayout } from '../config.js'

export type StripMetadataTarget = {
	variableRoot: string
	family: number
	nameProperty: number
	namePath: number
	colorProperty: number
	colorPath: number
}

export function stripMetadataVariableId(target: StripMetadataTarget, kind: 'name' | 'color'): string {
	const inputMatch = /^input_(\d+)$/.exec(target.variableRoot)
	return inputMatch ? `input_${kind}_${inputMatch[1]}` : `${target.variableRoot}_${kind}`
}

export type StripMetadataUpdate =
	| { target: StripMetadataTarget; kind: 'name'; name: string }
	| { target: StripMetadataTarget; kind: 'color'; color: number }

const METADATA_HANDLE = 0x03f4

function addRange(
	targets: StripMetadataTarget[],
	variablePrefix: string,
	count: number,
	family: number,
	namePropertyBase: number,
	namePathBase: number,
	colorPropertyBase: number,
	colorPathBase: number,
): void {
	for (let index = 0; index < count; index++) {
		targets.push({
			variableRoot: `${variablePrefix}_${index + 1}`,
			family,
			nameProperty: namePropertyBase + index,
			namePath: namePathBase + index,
			colorProperty: colorPropertyBase + index,
			colorPath: colorPathBase + index,
		})
	}
}

/** Strip families and property ranges captured from Avantis Director 2.x. */
export function buildStripMetadataTargets(
	inputCount: number,
	layout: ConfiguredMixLayout,
	rackUfxInstalled: boolean,
): StripMetadataTarget[] {
	const targets: StripMetadataTarget[] = []
	addRange(targets, 'input', inputCount, 0x15, 0x1000, 0x1000, 0x1060, 0x1060)
	addRange(targets, 'mono_group', layout.monoGroups, 0x16, 0x10c0, 0x1000, 0x10f8, 0x1038)
	addRange(targets, 'stereo_group', layout.stereoGroups, 0x17, 0x1130, 0x1000, 0x114c, 0x101c)
	addRange(targets, 'mono_aux', layout.monoAuxes, 0x18, 0x1168, 0x1000, 0x11a0, 0x1038)
	addRange(targets, 'stereo_aux', layout.stereoAuxes, 0x19, 0x11d8, 0x1000, 0x11f4, 0x101c)
	addRange(targets, 'mono_fx_send', layout.monoFxSends, 0x1a, 0x1210, 0x1000, 0x1220, 0x1010)
	addRange(targets, 'stereo_fx_send', layout.stereoFxSends, 0x1b, 0x1230, 0x1000, 0x1240, 0x1010)

	// Main slot indexes follow their MIDI channel numbers: LR is 1 and Msum is 3.
	addRange(targets, 'main', 1, 0x1c, 0x1260, 0x1000, 0x1266, 0x1006)
	if (layout.mSumEnabled) {
		targets.push({
			variableRoot: 'main_3',
			family: 0x1c,
			nameProperty: 0x1262,
			namePath: 0x1002,
			colorProperty: 0x1268,
			colorPath: 0x1008,
		})
	}

	addRange(targets, 'mono_matrix', layout.monoMatrices, 0x1d, 0x126c, 0x1000, 0x12a4, 0x1038)
	addRange(targets, 'stereo_matrix', layout.stereoMatrices, 0x1e, 0x12dc, 0x1000, 0x12f8, 0x101c)
	addRange(targets, 'fx_return', 12, 0x1f, 0x1314, 0x1000, 0x1324, 0x1010)
	addRange(targets, 'dca', 16, 0x20, 0x1344, 0x1000, 0x1354, 0x1010)
	if (rackUfxInstalled) {
		addRange(targets, 'ufx_send', 8, 0x23, 0x1250, 0x1000, 0x1258, 0x1008)
		addRange(targets, 'ufx_return', 8, 0x22, 0x1334, 0x1000, 0x133c, 0x1008)
	}
	return targets
}

function buildRegistration(family: number, property: number, path: number): Buffer {
	return Buffer.from([
		0xf0,
		0x00,
		0x01,
		(family >> 8) & 0xff,
		family & 0xff,
		0x00,
		0x03,
		0x00,
		0x06,
		0x00,
		0x0a,
		0x00,
		0x00,
		(METADATA_HANDLE >> 8) & 0xff,
		METADATA_HANDLE & 0xff,
		(property >> 8) & 0xff,
		property & 0xff,
		(path >> 8) & 0xff,
		path & 0xff,
		0x00,
		0xff,
		0xf7,
	])
}

export function buildStripMetadataSyncMessages(targets: readonly StripMetadataTarget[]): Buffer[] {
	return targets.flatMap((target) => [
		buildRegistration(target.family, target.nameProperty, target.namePath),
		buildRegistration(target.family, target.colorProperty, target.colorPath),
	])
}

export function buildStripMetadataTargetMap(
	targets: readonly StripMetadataTarget[],
): Map<string, { target: StripMetadataTarget; kind: 'name' | 'color' }> {
	const result = new Map<string, { target: StripMetadataTarget; kind: 'name' | 'color' }>()
	for (const target of targets) {
		result.set(`${target.family}:${target.nameProperty}`, { target, kind: 'name' })
		result.set(`${target.family}:${target.colorProperty}`, { target, kind: 'color' })
	}
	return result
}

export function parseStripMetadataUpdate(
	frame: Buffer,
	targets: ReadonlyMap<string, { target: StripMetadataTarget; kind: 'name' | 'color' }>,
): StripMetadataUpdate | undefined {
	if (
		frame.length < 13 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame[3] !== METADATA_HANDLE >> 8 ||
		frame[4] !== (METADATA_HANDLE & 0xff) ||
		frame.at(-1) !== 0xf7
	)
		return undefined

	const family = (frame[5] << 8) | frame[6]
	const property = (frame[7] << 8) | frame[8]
	const entry = targets.get(`${family}:${property}`)
	if (!entry) return undefined
	const payloadLength = (frame[9] << 8) | frame[10]
	if (entry.kind === 'color') {
		const color = frame[11]
		return payloadLength === 1 && color !== undefined && color <= 7
			? { target: entry.target, kind: 'color', color }
			: undefined
	}
	if (payloadLength !== 9 || frame.length < 21) return undefined
	const rawName = frame.subarray(11, 19)
	const nullTerminator = rawName.indexOf(0x00)
	const name = rawName
		.subarray(0, nullTerminator < 0 ? rawName.length : nullTerminator)
		.toString('utf8')
		.trimEnd()
	return { target: entry.target, kind: 'name', name }
}
