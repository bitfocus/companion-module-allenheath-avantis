import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildGlobalKeyScaleSyncMessages,
	buildGlobalKeySetterMessage,
	buildGlobalScaleSetterMessage,
	parseGlobalKeyScaleFrame,
} from './global-key-scale-sync.js'

void describe('Avantis AH-Net Global Key and Scale synchronization', () => {
	void it('builds the proven read-only registration and request sequence', () => {
		assert.deepEqual(
			buildGlobalKeyScaleSyncMessages().map((message) => message.toString('hex')),
			[
				'f00001003900030006000a0000111b100010000001f7',
				'f000010039111b00080000f7',
				'f00001003900030006000a0000111c100010010001f7',
				'f000010039111c00080000f7',
			],
		)
	})

	void it('parses captured initial values', () => {
		assert.deepEqual(parseGlobalKeyScaleFrame(Buffer.from('f00003111bffff1000000102f7', 'hex')), {
			kind: 'key',
			value: 2,
		})
		assert.deepEqual(parseGlobalKeyScaleFrame(Buffer.from('f00003111cffff1000000101f7', 'hex')), {
			kind: 'scale',
			value: 1,
		})
		assert.equal(parseGlobalKeyScaleFrame(Buffer.from('f00002111bffff1000000102f7', 'hex'))?.value, 2)
		assert.equal(parseGlobalKeyScaleFrame(Buffer.from('f00004111cffff1000000101f7', 'hex'))?.value, 1)
	})

	void it('builds the captured AH-Net Global Key setter', () => {
		assert.equal(buildGlobalKeySetterMessage(11).toString('hex'), 'f0000100390f6c100000010bf7')
		assert.throws(() => buildGlobalKeySetterMessage(12), /0 to 11/)
	})

	void it('builds the captured AH-Net Global Scale setter', () => {
		assert.equal(buildGlobalScaleSetterMessage(2).toString('hex'), 'f0000100390f6d1001000102f7')
		assert.throws(() => buildGlobalScaleSetterMessage(3), /Major.*Minor.*Chromatic/)
	})
})
