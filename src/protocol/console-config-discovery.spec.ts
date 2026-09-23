import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildConsoleConfigManagerDiscoveryMessage,
	buildDPackCapabilityDiscoveryMessage,
	buildConsoleMixConfigSyncMessages,
	buildRackUfxCapabilityDiscoveryMessage,
	parseConsoleConfigManagerDiscoveryFrame,
	parseConsoleMixConfigurationFrame,
	parseNamedManagerDiscoveryFrame,
	DPACK_DISCOVERY_HANDLE,
	RACK_UFX_DISCOVERY_HANDLE,
} from './console-config-discovery.js'

void describe('Avantis console mix configuration discovery', () => {
	void it('discovers the configuration manager and builds a targeted read', () => {
		assert.equal(
			buildConsoleConfigManagerDiscoveryMessage().toString('hex'),
			'f00001000061ff00040016445220426f78204964656e74696669636174696f6e00f7',
		)
		assert.equal(parseConsoleConfigManagerDiscoveryFrame(Buffer.from('f0000261ff0000000200020007f7', 'hex')), 0x0007)
		assert.equal(parseConsoleConfigManagerDiscoveryFrame(Buffer.from('f0000561ff0000000200020007f7', 'hex')), 0x0007)
		assert.deepEqual(
			buildConsoleMixConfigSyncMessages(0x0007).map((message) => message.toString('hex')),
			['f00001000700030006000a000062001002100200fff7', 'f000010007620000080000f7'],
		)
	})

	void it('builds independent positive capability probes for RackUltraFX and dPack input capacity', () => {
		assert.equal(
			buildRackUfxCapabilityDiscoveryMessage().toString('hex'),
			'f00001000061fe00040014556c747261204658204d616e6167657220303100f7',
		)
		assert.equal(
			buildDPackCapabilityDiscoveryMessage().toString('hex'),
			'f00001000061fd0004002a496e7365727420312c20496e707574204368616e6e656c203936202d20496e7465726d65646961746500f7',
		)
		assert.equal(
			parseNamedManagerDiscoveryFrame(Buffer.from('f0000261fe0000000200020acbf7', 'hex'), RACK_UFX_DISCOVERY_HANDLE),
			0x0acb,
		)
		assert.equal(
			parseNamedManagerDiscoveryFrame(Buffer.from('f0000461fd000000020002100ef7', 'hex'), DPACK_DISCOVERY_HANDLE),
			0x100e,
		)
	})

	void it('parses captured console configuration A exactly', () => {
		assert.deepEqual(
			parseConsoleMixConfigurationFrame(Buffer.from('f00002620000071002000c0204000402070202020101fff7', 'hex'), 0x0007),
			{
				monoGroups: 2,
				stereoGroups: 4,
				monoFx: 0,
				stereoFx: 4,
				monoAuxes: 2,
				stereoAuxes: 7,
				monoMatrices: 2,
				stereoMatrices: 2,
				mainMode: 'LR+MSum',
				stereoPafl: 1,
			},
		)
	})

	void it('accepts the captured cold-boot response class', () => {
		assert.deepEqual(
			parseConsoleMixConfigurationFrame(Buffer.from('f00005620000071002000c0204000402070202020101fff7', 'hex'), 0x0007),
			{
				monoGroups: 2,
				stereoGroups: 4,
				monoFx: 0,
				stereoFx: 4,
				monoAuxes: 2,
				stereoAuxes: 7,
				monoMatrices: 2,
				stereoMatrices: 2,
				mainMode: 'LR+MSum',
				stereoPafl: 1,
			},
		)
	})

	void it('parses captured console configuration B exactly', () => {
		assert.deepEqual(
			parseConsoleMixConfigurationFrame(Buffer.from('f00004620000071002000c0404000600000000010101fff7', 'hex'), 0x0007),
			{
				monoGroups: 4,
				stereoGroups: 4,
				monoFx: 0,
				stereoFx: 6,
				monoAuxes: 0,
				stereoAuxes: 0,
				monoMatrices: 0,
				stereoMatrices: 0,
				mainMode: 'LR',
				stereoPafl: 1,
			},
		)
	})

	void it('rejects unrelated families and malformed state', () => {
		const frame = Buffer.from('f00002620000071002000c0204000402070202020101fff7', 'hex')
		assert.equal(parseConsoleMixConfigurationFrame(frame, 0x0008), undefined)
		assert.equal(parseConsoleMixConfigurationFrame(frame.subarray(0, -1), 0x0007), undefined)
	})
})
