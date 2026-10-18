import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildChannelColorRequest,
	buildChannelNameRequest,
	buildInputColorRequest,
	buildInputNameRequest,
	parseChannelInfoReply,
	parseInputChannelInfoReply,
} from './channel-info.js'

void describe('Avantis input name and color protocol', () => {
	void it('encodes name and color requests', () => {
		assert.deepEqual([...buildInputNameRequest(6, 60)], [0xf0, 0, 0, 0x1a, 0x50, 0x10, 1, 0, 5, 1, 60, 0xf7])
		assert.deepEqual([...buildInputColorRequest(3, 95)], [0xf0, 0, 0, 0x1a, 0x50, 0x10, 1, 0, 2, 4, 95, 0xf7])
	})

	void it('parses name and color replies for the configured base channel', () => {
		assert.deepEqual(
			parseInputChannelInfoReply(Buffer.from([0xf0, 0, 0, 0x1a, 0x50, 0x10, 1, 0, 5, 2, 30, 86, 79, 88, 0xf7]), 6),
			{ type: 'name', midiChannel: 5, channel: 30, name: 'VOX' },
		)
		assert.deepEqual(
			parseInputChannelInfoReply(Buffer.from([0xf0, 0, 0, 0x1a, 0x50, 0x10, 1, 0, 5, 5, 30, 4, 0xf7]), 6),
			{ type: 'color', midiChannel: 5, channel: 30, color: 4 },
		)
	})

	void it('encodes and parses names and colors for bus-family MIDI channels', () => {
		assert.deepEqual([...buildChannelNameRequest(6, 0x40)], [0xf0, 0, 0, 0x1a, 0x50, 0x10, 1, 0, 6, 1, 0x40, 0xf7])
		assert.deepEqual([...buildChannelColorRequest(9, 0x30)], [0xf0, 0, 0, 0x1a, 0x50, 0x10, 1, 0, 9, 4, 0x30, 0xf7])
		assert.deepEqual(
			parseChannelInfoReply(Buffer.from([0xf0, 0, 0, 0x1a, 0x50, 0x10, 1, 0, 6, 2, 0x40, 83, 85, 66, 83, 0xf7])),
			{ type: 'name', midiChannel: 6, channel: 0x40, name: 'SUBS' },
		)
	})

	void it('ignores unrelated frames and rejects invalid requests', () => {
		assert.equal(parseInputChannelInfoReply(Buffer.from([0xf0, 1, 2, 0xf7]), 6), undefined)
		assert.throws(() => buildInputNameRequest(13, 0), RangeError)
		assert.throws(() => buildInputColorRequest(1, 96), RangeError)
	})
})
