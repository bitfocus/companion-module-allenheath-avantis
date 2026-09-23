import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	ahNetFaderValueToDb,
	buildAhNetSurfaceIdentificationRequest,
	buildInputFaderSubscriptionMessages,
	dbToNearestMidiFaderLevel,
	inputFaderSubscription,
	parseInputFaderSubscriptions,
	parseInputFaderUpdate,
} from './fader-sync.js'

void describe('Avantis selective AH-Net input fader synchronization', () => {
	void it('parses, sorts, and deduplicates comma-separated subscriptions', () => {
		assert.deepEqual(parseInputFaderSubscriptions('', 64), [])
		assert.deepEqual(parseInputFaderSubscriptions('64, 61, 62, 61', 64), [61, 62, 64])
		assert.deepEqual(parseInputFaderSubscriptions('65, 96', 96), [65, 96])
	})

	void it('enforces the configured input capacity', () => {
		assert.throws(() => parseInputFaderSubscriptions('65', 64), /1-64/)
		assert.throws(() => parseInputFaderSubscriptions('1, two', 96), /comma-separated/)
		assert.throws(() => parseInputFaderSubscriptions('1,', 96), /blank/)
	})

	void it('builds the live-tested read-only discovery with a channel-specific handle', () => {
		assert.deepEqual(inputFaderSubscription(17), { channel: 17, handle: 0x2010 })
		assert.deepEqual(inputFaderSubscription(18), { channel: 18, handle: 0x2011 })
		assert.deepEqual(inputFaderSubscription(31), { channel: 31, handle: 0x201e })
		assert.equal(
			buildAhNetSurfaceIdentificationRequest().toString('hex'),
			'f00001000000080004001753757266616365204964656e74696669636174696f6e00f7',
		)
		assert.deepEqual(
			buildInputFaderSubscriptionMessages(31).map((message) => message.toString('hex')),
			['f00001002800030006000a0000201e10002b1e00fff7'],
		)
	})

	void it('decodes the captured fader scale and compact feedback frame', () => {
		assert.equal(ahNetFaderValueToDb(0x6d4a).toFixed(1), '-18.7')
		assert.equal(dbToNearestMidiFaderLevel(-18.7), 0x46)
		assert.deepEqual(
			parseInputFaderUpdate(Buffer.from('f00003201e0028100000026d4af7', 'hex'), new Map([[0x201e, 31]])),
			{
				channel: 31,
				ahNetValue: 0x6d4a,
				db: (0x6d4a - 0x8000) / 256,
				midiLevel: 0x46,
			},
		)
		assert.deepEqual(
			parseInputFaderUpdate(Buffer.from('f0000120000028100000027d90f7', 'hex'), new Map([[0x2000, 1]])),
			{
				channel: 1,
				ahNetValue: 0x7d90,
				db: (0x7d90 - 0x8000) / 256,
				midiLevel: dbToNearestMidiFaderLevel((0x7d90 - 0x8000) / 256),
			},
		)
		assert.deepEqual(
			parseInputFaderUpdate(Buffer.from('f00005201e0028100000026d4af7', 'hex'), new Map([[0x201e, 31]])),
			{
				channel: 31,
				ahNetValue: 0x6d4a,
				db: (0x6d4a - 0x8000) / 256,
				midiLevel: 0x46,
			},
		)
	})

	void it('ignores unrelated handles and message families', () => {
		assert.equal(parseInputFaderUpdate(Buffer.from('f00003101e0028100000026d4af7', 'hex'), new Map()), undefined)
		assert.equal(
			parseInputFaderUpdate(Buffer.from('f0000318e5003a1000000101f7', 'hex'), new Map([[0x201e, 31]])),
			undefined,
		)
	})
})
