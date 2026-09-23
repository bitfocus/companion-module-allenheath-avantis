import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import {
	buildUfxBypassMessage,
	buildUfxBypassSyncMessages,
	parseUfxBypassFrame,
	ufxBypassTarget,
} from './ufx-bypass.js'

void describe('RackUltraFX bypass AH-Net protocol', () => {
	void it('maps all eight captured manager families and handles', () => {
		assert.deepEqual(ufxBypassTarget(1), { family: 0x0acb, handle: 0x1116 })
		assert.deepEqual(ufxBypassTarget(8), { family: 0x0afc, handle: 0x11d3 })
		assert.equal(buildUfxBypassSyncMessages().length, 16)
	})

	void it('builds the captured writes', () => {
		assert.equal(buildUfxBypassMessage(1, false).toString('hex'), 'f000010acb1116101600028000f7')
		assert.equal(buildUfxBypassMessage(8, true).toString('hex'), 'f000010afc11d3101600028010f7')
	})

	void it('parses initial values and live pushes', () => {
		assert.deepEqual(parseUfxBypassFrame(Buffer.from('f0000211160acb100000028010f7', 'hex')), {
			unit: 1,
			bypassed: true,
		})
		assert.deepEqual(parseUfxBypassFrame(Buffer.from('f0000311d30afc100000028000f7', 'hex')), {
			unit: 8,
			bypassed: false,
		})
	})
})
