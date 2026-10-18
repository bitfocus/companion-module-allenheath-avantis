import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildFirmwareSyncMessages, parseFirmwareFrame, parseSurfaceIdentificationFrame } from './firmware-sync.js'

void describe('Avantis firmware synchronization', () => {
	void it('discovers each console family and builds its read-only firmware request', () => {
		assert.equal(parseSurfaceIdentificationFrame(Buffer.from('f0000400080000000200021148f7', 'hex')), 0x1148)
		assert.equal(parseSurfaceIdentificationFrame(Buffer.from('f00004000800000002000210faf7', 'hex')), 0x10fa)
		assert.equal(parseSurfaceIdentificationFrame(Buffer.from('f00003000800000002000210faf7', 'hex')), 0x10fa)
		assert.equal(parseSurfaceIdentificationFrame(Buffer.from('f00005000800000002000210faf7', 'hex')), 0x10fa)
		assert.deepEqual(
			buildFirmwareSyncMessages(0x1148).map((message) => message.toString('hex')),
			['f000011148000801020000f7'],
		)
		assert.deepEqual(
			buildFirmwareSyncMessages(0x10fa).map((message) => message.toString('hex')),
			['f0000110fa000801020000f7'],
		)
	})

	void it('parses firmware version and revision from captured console replies', () => {
		assert.deepEqual(
			parseFirmwareFrame(Buffer.from('f00002000811480002001256322e3031202d205265762e203937323431f7', 'hex'), 0x1148),
			{ version: '2.01', revision: '97241' },
		)
		assert.deepEqual(
			parseFirmwareFrame(
				Buffer.from('f00002000811480002001a4272696467652056322e3031202d205265762e20393732343100f7', 'hex'),
				0x1148,
			),
			{ version: '2.01', revision: '97241' },
		)
		assert.deepEqual(
			parseFirmwareFrame(Buffer.from('f00004000810fa0002001256322e3031202d205265762e203937323431f7', 'hex'), 0x10fa),
			{ version: '2.01', revision: '97241' },
		)
		assert.deepEqual(
			parseFirmwareFrame(Buffer.from('f00005000811480002001256322e3031202d205265762e203937323431f7', 'hex'), 0x1148),
			{ version: '2.01', revision: '97241' },
		)
		assert.equal(
			parseFirmwareFrame(Buffer.from('f00004000810fa0002001256322e3031202d205265762e203937323431f7', 'hex'), 0x1148),
			undefined,
		)
	})
})
