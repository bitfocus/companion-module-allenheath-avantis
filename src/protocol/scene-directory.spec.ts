import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildSceneDirectoryNameRequest, parseSceneDirectoryNameFrame } from './scene-directory.js'

void describe('Avantis AH-Net scene directory', () => {
	void it('builds captured read-only requests by zero-based index', () => {
		assert.equal(buildSceneDirectoryNameRequest(0).toString('hex'), 'f00001000c000a010400020000f7')
		assert.equal(buildSceneDirectoryNameRequest(2).toString('hex'), 'f00001000c000a010400020002f7')
		assert.equal(buildSceneDirectoryNameRequest(499).toString('hex'), 'f00001000c000a0104000201f3f7')
	})

	void it('parses captured scene directory names', () => {
		assert.equal(
			parseSceneDirectoryNameFrame(Buffer.from('f00002000a000c00020148537461727400fffffffff7', 'hex')),
			'Start',
		)
		assert.equal(
			parseSceneDirectoryNameFrame(Buffer.from('f00002000a000c0002014853756e64617900fffffffff7', 'hex')),
			'Sunday',
		)
	})

	void it('supports an empty unused scene and rejects unrelated frames', () => {
		assert.equal(parseSceneDirectoryNameFrame(Buffer.from('f00002000a000c0002014800fffffffff7', 'hex')), '')
		assert.equal(
			parseSceneDirectoryNameFrame(Buffer.from('f00002000f142f100100080002000200020002f7', 'hex')),
			undefined,
		)
		assert.throws(() => buildSceneDirectoryNameRequest(500), RangeError)
	})
})
