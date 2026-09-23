import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildSceneRecallMessage,
	parseSceneNumberList,
	resolveAvailableSceneNames,
	resolveSceneNames,
} from './scene.js'

void describe('Avantis scene recall protocol', () => {
	const boundaryCases = [
		[1, [0xbb, 0x00, 0x00, 0xcb, 0x00]],
		[127, [0xbb, 0x00, 0x00, 0xcb, 0x7e]],
		[128, [0xbb, 0x00, 0x00, 0xcb, 0x7f]],
		[129, [0xbb, 0x00, 0x01, 0xcb, 0x00]],
		[256, [0xbb, 0x00, 0x01, 0xcb, 0x7f]],
		[257, [0xbb, 0x00, 0x02, 0xcb, 0x00]],
		[384, [0xbb, 0x00, 0x02, 0xcb, 0x7f]],
		[385, [0xbb, 0x00, 0x03, 0xcb, 0x00]],
		[500, [0xbb, 0x00, 0x03, 0xcb, 0x73]],
	] as const

	for (const [scene, expected] of boundaryCases) {
		void it(`encodes scene ${scene} on the default base MIDI channel`, () => {
			assert.deepEqual([...buildSceneRecallMessage(scene, 12)], expected)
		})
	}

	void it('applies the configured base MIDI channel to both status bytes', () => {
		assert.deepEqual([...buildSceneRecallMessage(1, 1)], [0xb0, 0x00, 0x00, 0xc0, 0x00])
		assert.deepEqual([...buildSceneRecallMessage(1, 12)], [0xbb, 0x00, 0x00, 0xcb, 0x00])
	})

	void it('rejects scenes and MIDI channels outside the documented ranges', () => {
		assert.throws(() => buildSceneRecallMessage(0, 12), RangeError)
		assert.throws(() => buildSceneRecallMessage(501, 12), RangeError)
		assert.throws(() => buildSceneRecallMessage(1, 0), RangeError)
		assert.throws(() => buildSceneRecallMessage(1, 13), RangeError)
	})

	void it('parses an unlimited comma-separated scene list after splitting', () => {
		assert.deepEqual(parseSceneNumberList(['1', ' 128', '500 ', '42']), [1, 128, 500, 42])
		assert.throws(() => parseSceneNumberList(['1', '', '3']), RangeError)
		assert.throws(() => parseSceneNumberList(['1', '501']), RangeError)
		assert.throws(() => parseSceneNumberList(['1', '2.5']), RangeError)
	})

	void it('resolves exact scene names without case or surrounding-space sensitivity', () => {
		const directory = { 2: 'Sunday AM', 18: ' Lobby ', 42: 'Overflow' }
		assert.deepEqual(resolveSceneNames([' sunday am ', 'LOBBY', 'Overflow'], directory), [2, 18, 42])
	})

	void it('rejects missing, empty, and ambiguous scene names before recall', () => {
		assert.throws(() => resolveSceneNames(['Missing'], { 1: 'Known' }), /not found/)
		assert.throws(() => resolveSceneNames([''], { 1: 'Known' }), /empty entry/)
		assert.throws(() => resolveSceneNames(['Service'], { 1: 'Service', 20: 'service' }), /Scenes 1, 20/)
	})

	void it('can skip invalid names while preserving valid queue order', () => {
		assert.deepEqual(
			resolveAvailableSceneNames(['Event', 'Lobby Music', 'Overflow Mute'], { 10: 'Lobby Music', 20: 'Overflow Mute' }),
			{
				scenes: [10, 20],
				errors: ['Scene name “Event” was not found in the synchronized scene directory'],
			},
		)
	})
})
