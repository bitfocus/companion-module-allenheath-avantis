import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildUsbRecorderStartMessage, buildUsbRecorderStopMessage } from './usb-recorder.js'

void describe('native Avantis USB recorder transport', () => {
	void it('builds the captured recorder start and stop commands separately from MIDI MMC', () => {
		assert.equal(buildUsbRecorderStartMessage().toString('hex'), 'f00001113f02d1100a0000f7')
		assert.equal(buildUsbRecorderStopMessage().toString('hex'), 'f00001113f02d2100b0000f7')
		assert.equal(buildUsbRecorderStartMessage(0x10f1).toString('hex'), 'f0000110f102d1100a0000f7')
		assert.equal(buildUsbRecorderStopMessage(0x10f1).toString('hex'), 'f0000110f102d2100b0000f7')
	})
})
