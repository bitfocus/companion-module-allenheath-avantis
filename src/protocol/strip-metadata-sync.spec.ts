import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildStripMetadataSyncMessages,
	buildStripMetadataTargetMap,
	buildStripMetadataTargets,
	parseStripMetadataUpdate,
	stripMetadataVariableId,
} from './strip-metadata-sync.js'

const layout = {
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

void describe('event-driven Avantis strip metadata synchronization', () => {
	void it('builds the exact captured Input 39 name and color subscriptions', () => {
		const targets = buildStripMetadataTargets(96, layout, true)
		const input39 = targets.find((target) => target.variableRoot === 'input_39')
		assert.ok(input39)
		assert.deepEqual(
			buildStripMetadataSyncMessages([input39]).map((message) => message.toString('hex')),
			['f00001001500030006000a000003f41026102600fff7', 'f00001001500030006000a000003f41086108600fff7'],
		)
	})

	void it('parses captured console pushes for input, DCA, and stereo aux names and colors', () => {
		const targets = buildStripMetadataTargetMap(buildStripMetadataTargets(96, layout, true))
		assert.deepEqual(
			parseStripMetadataUpdate(Buffer.from('f0000203f40015102600094a6f6e616832000040f7', 'hex'), targets),
			{
				target: targets.get('21:4134')?.target,
				kind: 'name',
				name: 'Jonah2',
			},
		)
		assert.equal(parseStripMetadataUpdate(Buffer.from('f0000203f400151086000107f7', 'hex'), targets)?.kind, 'color')
		assert.equal(
			parseStripMetadataUpdate(Buffer.from('f0000203f40020134400094472756d7332000040f7', 'hex'), targets)?.target
				.variableRoot,
			'dca_1',
		)
		assert.equal(
			parseStripMetadataUpdate(Buffer.from('f0000203f4001911d8000949454d203132000040f7', 'hex'), targets)?.target
				.variableRoot,
			'stereo_aux_1',
		)
	})

	void it('stops short names at the first null instead of exposing stale field bytes', () => {
		const targets = buildStripMetadataTargetMap(buildStripMetadataTargets(96, layout, true))
		const drums = parseStripMetadataUpdate(Buffer.from('f0000203f40020134400094472756d7300006767f7', 'hex'), targets)
		const bass = parseStripMetadataUpdate(Buffer.from('f0000203f4002013450009426173730000006767f7', 'hex'), targets)
		const talk = parseStripMetadataUpdate(Buffer.from('f0000203f4001610c0000954616c6b0000700000f7', 'hex'), targets)
		const mics = parseStripMetadataUpdate(Buffer.from('f0000203f4001610c100094d6963730000700000f7', 'hex'), targets)
		const ufxReturn1 = parseStripMetadataUpdate(
			Buffer.from('f0000203f4002213340009310000acf47f0000d0f7', 'hex'),
			targets,
		)
		const ufxReturn4 = parseStripMetadataUpdate(
			Buffer.from('f0000203f4002213370009340000acf47f0000d0f7', 'hex'),
			targets,
		)
		const stereoGroup2 = parseStripMetadataUpdate(
			Buffer.from('f0000203f400171131000932006e6400000000c0f7', 'hex'),
			targets,
		)
		const stereoGroup4 = parseStripMetadataUpdate(
			Buffer.from('f0000203f400171133000934006e6400000000c0f7', 'hex'),
			targets,
		)
		assert.equal(drums?.kind === 'name' ? drums.name : undefined, 'Drums')
		assert.equal(bass?.kind === 'name' ? bass.name : undefined, 'Bass')
		assert.equal(talk?.kind === 'name' ? talk.name : undefined, 'Talk')
		assert.equal(mics?.kind === 'name' ? mics.name : undefined, 'Mics')
		assert.equal(ufxReturn1?.kind === 'name' ? ufxReturn1.name : undefined, '1')
		assert.equal(ufxReturn4?.kind === 'name' ? ufxReturn4.name : undefined, '4')
		assert.equal(stereoGroup2?.kind === 'name' ? stereoGroup2.name : undefined, '2')
		assert.equal(stereoGroup4?.kind === 'name' ? stereoGroup4.name : undefined, '4')
	})

	void it('covers only the configured bus layout while retaining fixed DCA, FX return, and optional UFX strips', () => {
		const targets = buildStripMetadataTargets(96, layout, true)
		assert.equal(targets.filter((target) => target.variableRoot.startsWith('mono_aux_')).length, 2)
		assert.equal(targets.filter((target) => target.variableRoot.startsWith('stereo_aux_')).length, 7)
		assert.equal(targets.filter((target) => target.variableRoot.startsWith('dca_')).length, 16)
		assert.equal(targets.filter((target) => target.variableRoot.startsWith('fx_return_')).length, 12)
		assert.equal(targets.filter((target) => target.variableRoot.startsWith('ufx_send_')).length, 8)
		assert.equal(targets.filter((target) => target.variableRoot.startsWith('ufx_return_')).length, 8)
	})

	void it('maps inputs to their legacy-compatible variable IDs and buses to suffix IDs', () => {
		const targets = buildStripMetadataTargets(96, layout, true)
		const input39 = targets.find((target) => target.variableRoot === 'input_39')
		const dca1 = targets.find((target) => target.variableRoot === 'dca_1')
		assert.ok(input39)
		assert.ok(dca1)
		assert.equal(stripMetadataVariableId(input39, 'name'), 'input_name_39')
		assert.equal(stripMetadataVariableId(input39, 'color'), 'input_color_39')
		assert.equal(stripMetadataVariableId(dca1, 'name'), 'dca_1_name')
		assert.equal(stripMetadataVariableId(dca1, 'color'), 'dca_1_color')
	})
})
