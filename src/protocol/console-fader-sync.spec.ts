import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildConsoleFaderSubscriptionMessage,
	buildConsoleFaderTargets,
	parseConsoleFaderUpdate,
} from './console-fader-sync.js'

const consoleLayoutA = {
	monoGroups: 2,
	stereoGroups: 4,
	monoAuxes: 2,
	stereoAuxes: 7,
	monoMatrices: 2,
	stereoMatrices: 2,
	monoFxSends: 0,
	stereoFxSends: 4,
	mSumEnabled: true,
}

void describe('console fader synchronization', () => {
	void it('maps captured console layout A to the observed paths', () => {
		const targets = buildConsoleFaderTargets(consoleLayoutA, true)
		const byVariable = new Map(targets.map((target) => [target.variableId, target]))
		assert.equal(byVariable.get('fader_mono_group_2')?.path, 0x1fc1)
		assert.equal(byVariable.get('fader_stereo_group_4')?.path, 0x1fc8)
		assert.equal(byVariable.get('fader_stereo_group_1')?.midiChannel, 0x40)
		assert.equal(byVariable.get('fader_mono_aux_2')?.path, 0x1fcb)
		assert.equal(byVariable.get('fader_stereo_aux_7')?.path, 0x1fe0)
		assert.equal(byVariable.get('fader_stereo_aux_1')?.midiChannel, 0x40)
		assert.equal(byVariable.get('fader_main_1')?.path, 0x1fe2)
		assert.equal(byVariable.get('fader_main_3')?.path, 0x1fe4)
		assert.equal(byVariable.get('fader_mono_matrix_2')?.path, 0x1fe9)
		assert.equal(byVariable.get('fader_stereo_matrix_2')?.path, 0x1fec)
		assert.equal(byVariable.get('fader_stereo_matrix_1')?.midiChannel, 0x40)
		assert.equal(byVariable.get('fader_stereo_fx_send_1')?.path, 0x1000)
		assert.equal(byVariable.get('fader_fx_return_12')?.path, 0x1e16)
		assert.equal(byVariable.get('fader_ufx_send_7')?.path, 0x1006)
		assert.equal(byVariable.get('fader_ufx_return_7')?.path, 0x148c)
		assert.equal(byVariable.get('fader_dca_16')?.path, 0x100f)
		assert.equal(byVariable.get('fader_dca_1')?.midiChannel, 0x36)
	})

	void it('maps console layout B without phantom auxes or matrices', () => {
		const targets = buildConsoleFaderTargets(
			{
				monoGroups: 4,
				stereoGroups: 4,
				monoAuxes: 0,
				stereoAuxes: 0,
				monoMatrices: 0,
				stereoMatrices: 0,
				monoFxSends: 0,
				stereoFxSends: 6,
				mSumEnabled: false,
			},
			true,
		)
		assert.equal(
			targets.some((target) => target.variableId.includes('_aux_')),
			false,
		)
		assert.equal(
			targets.some((target) => target.variableId.includes('_matrix_')),
			false,
		)
		assert.equal(
			targets.some((target) => target.variableId === 'fader_main_3'),
			false,
		)
		assert.equal(targets.filter((target) => target.variableId.startsWith('fader_stereo_fx_send_')).length, 6)
	})

	void it('builds a read-only message and parses its initial value', () => {
		const target = buildConsoleFaderTargets(consoleLayoutA, true).find(
			(candidate) => candidate.variableId === 'fader_main_1',
		)
		assert.ok(target)
		assert.equal(
			buildConsoleFaderSubscriptionMessage(target).toString('hex'),
			'f00001003100030006000a0000300f10001fe200fff7',
		)
		const update = parseConsoleFaderUpdate(
			Buffer.from('f00002300f0031100000028000f7', 'hex'),
			new Map([[`${target.family}:${target.handle}`, target]]),
		)
		assert.equal(update?.variableId, 'fader_main_1')
		assert.equal(update?.db, 0)
		assert.equal(
			parseConsoleFaderUpdate(
				Buffer.from('f00005300f0031100000028000f7', 'hex'),
				new Map([[`${target.family}:${target.handle}`, target]]),
			)?.variableId,
			'fader_main_1',
		)
	})
})
