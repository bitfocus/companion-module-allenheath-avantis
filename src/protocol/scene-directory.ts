import { AVANTIS_SCENE_COUNT } from './scene.js'

export const SCENE_DIRECTORY_HANDLE = 0x000a

/** Build the captured, read-only Scene Manager request for one zero-based scene slot. */
export function buildSceneDirectoryNameRequest(sceneIndex: number): Buffer {
	if (!Number.isInteger(sceneIndex) || sceneIndex < 0 || sceneIndex >= AVANTIS_SCENE_COUNT) {
		throw new RangeError(`Scene directory index must be 0-${AVANTIS_SCENE_COUNT - 1}`)
	}
	return Buffer.from([
		0xf0,
		0x00,
		0x01,
		0x00,
		0x0c,
		(SCENE_DIRECTORY_HANDLE >> 8) & 0xff,
		SCENE_DIRECTORY_HANDLE & 0xff,
		0x01,
		0x04,
		0x00,
		0x02,
		(sceneIndex >> 8) & 0xff,
		sceneIndex & 0xff,
		0xf7,
	])
}

/** Parse the name payload. The protocol does not echo the requested index. */
export function parseSceneDirectoryNameFrame(frame: Buffer): string | undefined {
	if (
		frame.length < 13 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame.toString('hex', 3, 11) !== '000a000c00020148' ||
		frame.at(-1) !== 0xf7
	) {
		return undefined
	}
	let end = 11
	while (end < frame.length - 1 && frame[end] !== 0x00 && frame[end] !== 0xff) end++
	return frame.subarray(11, end).toString('utf8').trim()
}
