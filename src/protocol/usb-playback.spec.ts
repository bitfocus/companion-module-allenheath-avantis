import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildUsbPlaybackStartMessage,
	buildUsbPlaybackSyncMessages,
	buildUsbPlaybackTransportMessage,
	parseUsbPlaybackFrame,
} from './usb-playback.js'

void describe('native Avantis USB playback', () => {
	void it('builds the read-only state registration and request', () => {
		assert.deepEqual(
			buildUsbPlaybackSyncMessages().map((message) => message.toString('hex')),
			['f00001113f00030006000a000002d0100210020001f7', 'f00001113f02d000080000f7'],
		)
	})

	void it('parses playing, paused, and stopped states', () => {
		assert.deepEqual(
			parseUsbPlaybackFrame(
				Buffer.from(
					'f0000202d0113f1002002b00000000000e9032312d4a756e2d32362d5265636f7264696e672d61742d31372d34382d30312e77617600f7',
					'hex',
				),
			),
			{ state: 'Playing', filename: '21-Jun-26-Recording-at-17-48-01.wav' },
		)
		assert.equal(parseUsbPlaybackFrame(Buffer.from('f0000202d0113f100200080000000001000000f7', 'hex'))?.state, 'Paused')
		assert.equal(
			parseUsbPlaybackFrame(Buffer.from('f0000202d0113f100200080000000002000000f7', 'hex'))?.state,
			'Stopped',
		)
		assert.equal(
			parseUsbPlaybackFrame(Buffer.from('f0000402d010f1100200080000000002000000f7', 'hex'), 0x10f1)?.state,
			'Stopped',
		)
	})

	void it('builds native pause, resume, stop, and selected-file play commands', () => {
		assert.equal(buildUsbPlaybackTransportMessage('resume').toString('hex'), 'f00001113f02d0100900020000f7')
		assert.equal(buildUsbPlaybackTransportMessage('pause').toString('hex'), 'f00001113f02d0100900020001f7')
		assert.equal(buildUsbPlaybackTransportMessage('stop').toString('hex'), 'f00001113f02d0100900020002f7')
		assert.equal(buildUsbPlaybackTransportMessage('stop', 0x10f1).toString('hex'), 'f0000110f102d0100900020002f7')
		assert.equal(
			buildUsbPlaybackStartMessage('test.wav').toString('hex'),
			'f00001113f02d01008000c0001746573742e7761760000f7',
		)
		assert.equal(
			buildUsbPlaybackStartMessage('test.wav', 0x10f1).toString('hex'),
			'f0000110f102d01008000c0001746573742e7761760000f7',
		)
	})
})
