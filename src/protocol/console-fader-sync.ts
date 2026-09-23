import type { ConfiguredMixLayout } from '../config.js'
import { UFX_RETURN_FIRST_CHANNEL, UFX_SEND_FIRST_CHANNEL } from './ufx.js'
import { ahNetFaderValueToDb, dbToNearestMidiFaderLevel } from './fader-sync.js'

export type ConsoleFaderTarget = {
	variableId: string
	label: string
	family: number
	handle: number
	path: number
	midiOffset: number
	midiChannel: number
}

export type ConsoleFaderUpdate = ConsoleFaderTarget & {
	ahNetValue: number
	db: number
	midiLevel: number
}

const STANDARD_FX_RETURN_COUNT = 12
const DCA_COUNT = 16

export function buildConsoleFaderTargets(layout: ConfiguredMixLayout, rackUfxInstalled: boolean): ConsoleFaderTarget[] {
	const targets: ConsoleFaderTarget[] = []
	let nextHandle = 0x3000
	const add = (
		variableId: string,
		label: string,
		family: number,
		path: number,
		midiOffset: number,
		midiChannel: number,
	) => targets.push({ variableId, label, family, handle: nextHandle++, path, midiOffset, midiChannel })

	for (let i = 0; i < layout.monoGroups; i++)
		add(`fader_mono_group_${i + 1}`, `Mono Group ${i + 1}`, 0x31, 0x1fc0 + i, 1, i)
	for (let i = 0; i < layout.stereoGroups; i++)
		add(`fader_stereo_group_${i + 1}`, `Stereo Group ${i + 1}`, 0x31, 0x1fc0 + layout.monoGroups + i * 2, 1, 0x40 + i)
	for (let i = 0; i < layout.monoAuxes; i++) add(`fader_mono_aux_${i + 1}`, `Mono Aux ${i + 1}`, 0x31, 0x1fca + i, 2, i)
	for (let i = 0; i < layout.stereoAuxes; i++)
		add(`fader_stereo_aux_${i + 1}`, `Stereo Aux ${i + 1}`, 0x31, 0x1fd4 + i * 2, 2, 0x40 + i)

	add('fader_main_1', 'LR Main', 0x31, 0x1fe2, 4, 0x30)
	if (layout.mSumEnabled) add('fader_main_3', 'Msum Main', 0x31, 0x1fe4, 4, 0x32)

	for (let i = 0; i < layout.monoMatrices; i++)
		add(`fader_mono_matrix_${i + 1}`, `Mono Matrix ${i + 1}`, 0x31, 0x1fe8 + i, 3, i)
	for (let i = 0; i < layout.stereoMatrices; i++)
		add(
			`fader_stereo_matrix_${i + 1}`,
			`Stereo Matrix ${i + 1}`,
			0x31,
			0x1fe8 + layout.monoMatrices + i * 2,
			3,
			0x40 + i,
		)

	for (let i = 0; i < layout.monoFxSends; i++)
		add(`fader_mono_fx_send_${i + 1}`, `Mono FX Send ${i + 1}`, 0x2c, 0x1000 + i, 4, i)
	for (let i = 0; i < layout.stereoFxSends; i++)
		add(`fader_stereo_fx_send_${i + 1}`, `Stereo FX Send ${i + 1}`, 0x2d, 0x1000 + i, 4, 0x10 + i)
	for (let i = 0; i < STANDARD_FX_RETURN_COUNT; i++)
		add(`fader_fx_return_${i + 1}`, `FX Return ${i + 1}`, 0x2b, 0x1e00 + i * 2, 4, 0x20 + i)
	for (let i = 0; i < DCA_COUNT; i++) add(`fader_dca_${i + 1}`, `DCA ${i + 1}`, 0x25, 0x1000 + i, 4, 0x36 + i)

	if (rackUfxInstalled) {
		for (let i = 0; i < 8; i++)
			add(`fader_ufx_send_${i + 1}`, `RackUltraFX Send ${i + 1}`, 0x2e, 0x1000 + i, 4, UFX_SEND_FIRST_CHANNEL + i)
		for (let i = 0; i < 8; i++)
			add(
				`fader_ufx_return_${i + 1}`,
				`RackUltraFX Return ${i + 1}`,
				0x2f,
				0x1480 + i * 2,
				4,
				UFX_RETURN_FIRST_CHANNEL + i,
			)
	}

	return targets
}

export function buildConsoleFaderSubscriptionMessage(target: ConsoleFaderTarget): Buffer {
	return Buffer.from([
		0xf0,
		0x00,
		0x01,
		0x00,
		target.family,
		0x00,
		0x03,
		0x00,
		0x06,
		0x00,
		0x0a,
		0x00,
		0x00,
		(target.handle >> 8) & 0xff,
		target.handle & 0xff,
		0x10,
		0x00,
		(target.path >> 8) & 0xff,
		target.path & 0xff,
		0x00,
		0xff,
		0xf7,
	])
}

export function parseConsoleFaderUpdate(
	frame: Buffer,
	targetsByHandle: ReadonlyMap<string, ConsoleFaderTarget>,
): ConsoleFaderUpdate | undefined {
	if (
		frame.length !== 14 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame[5] !== 0x00 ||
		frame[7] !== 0x10 ||
		frame[8] !== 0x00 ||
		frame[9] !== 0x00 ||
		frame[10] !== 0x02 ||
		frame[13] !== 0xf7
	) {
		return undefined
	}

	const handle = (frame[3] << 8) | frame[4]
	const target = targetsByHandle.get(`${frame[6]}:${handle}`)
	if (!target) return undefined
	const ahNetValue = (frame[11] << 8) | frame[12]
	const db = ahNetFaderValueToDb(ahNetValue)
	return { ...target, ahNetValue, db, midiLevel: dbToNearestMidiFaderLevel(db) }
}
