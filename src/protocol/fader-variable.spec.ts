import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildConsoleFaderTargets } from './console-fader-sync.js'
import { faderVariableId } from './fader-variable.js'

void describe('MIDI fader variable mapping', () => {
	void it('maps the first and last channel of every fader type to its variable', () => {
		const cases: Array<[number, number, string]> = [
			[0, 0x00, 'fader_input_1'],
			[0, 0x3f, 'fader_input_64'],
			[1, 0x00, 'fader_mono_group_1'],
			[1, 0x27, 'fader_mono_group_40'],
			[1, 0x40, 'fader_stereo_group_1'],
			[1, 0x53, 'fader_stereo_group_20'],
			[2, 0x40, 'fader_stereo_aux_1'],
			[3, 0x40, 'fader_stereo_matrix_1'],
			[4, 0x00, 'fader_mono_fx_send_1'],
			[4, 0x0b, 'fader_mono_fx_send_12'],
			[4, 0x10, 'fader_stereo_fx_send_1'],
			[4, 0x1b, 'fader_stereo_fx_send_12'],
			[4, 0x20, 'fader_fx_return_1'],
			[4, 0x2b, 'fader_fx_return_12'],
			[4, 0x30, 'fader_main_1'],
			[4, 0x32, 'fader_main_3'],
			[4, 0x36, 'fader_dca_1'],
			[4, 0x45, 'fader_dca_16'],
			[4, 0x56, 'fader_ufx_send_1'],
			[4, 0x5d, 'fader_ufx_send_8'],
			[4, 0x5e, 'fader_ufx_return_1'],
			[4, 0x65, 'fader_ufx_return_8'],
		]
		for (const [offset, channel, expected] of cases) {
			assert.equal(faderVariableId(offset, channel), expected, `offset ${offset} channel 0x${channel.toString(16)}`)
		}
	})

	void it('ignores gaps, mute groups, unknown offsets, and invalid channels', () => {
		for (const channel of [0x0c, 0x1c, 0x2c, 0x33, 0x46, 0x4d, 0x66, 0x7f]) {
			assert.equal(faderVariableId(4, channel), undefined, `channel 0x${channel.toString(16)}`)
		}
		assert.equal(faderVariableId(5, 0x00), undefined)
		assert.equal(faderVariableId(-1, 0x00), undefined)
		assert.equal(faderVariableId(0, -1), undefined)
		assert.equal(faderVariableId(0, 0x80), undefined)
		assert.equal(faderVariableId(0, Number.NaN), undefined)
	})

	void it('agrees with every AH-Net fader target on the same MIDI channel', () => {
		const layout = {
			monoGroups: 40,
			stereoGroups: 20,
			monoAuxes: 40,
			stereoAuxes: 20,
			monoMatrices: 40,
			stereoMatrices: 20,
			monoFxSends: 12,
			stereoFxSends: 12,
			mSumEnabled: true,
		}
		const targets = buildConsoleFaderTargets(layout, true)
		assert.ok(targets.length > 0)
		for (const target of targets) {
			assert.equal(faderVariableId(target.midiOffset, target.midiChannel), target.variableId, target.label)
		}
	})
})
