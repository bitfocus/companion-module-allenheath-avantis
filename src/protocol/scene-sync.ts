import { AVANTIS_SCENE_COUNT } from './scene.js'

const DEFAULT_FAMILY = 0x142f

export function buildSceneStateSyncMessages(family = DEFAULT_FAMILY): Buffer[] {
	if (!Number.isInteger(family) || family < 0 || family > 0xffff)
		throw new RangeError('Scene Manager family is invalid')
	const messages = [
		Buffer.from('f00001000000030006000a0000000f1001100100fff7', 'hex'),
		Buffer.from('f00001000000030006000a0000000f100010000000f7', 'hex'),
		Buffer.from('f000010000000f00080000f7', 'hex'),
	]
	for (const message of messages) message.writeUInt16BE(family, 3)
	return messages
}

export function parseSceneNameFrame(
	frame: Buffer,
	expectedFamily = DEFAULT_FAMILY,
): { sceneNumber: number; name: string } | undefined {
	if (
		frame.length < 16 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame.readUInt16BE(3) !== 0x000f ||
		frame.readUInt16BE(5) !== expectedFamily ||
		frame.toString('hex', 7, 11) !== '10000017' ||
		frame.at(-1) !== 0xf7
	)
		return
	const sceneNumber = ((frame[11] << 8) | frame[12]) + 1
	if (sceneNumber < 1 || sceneNumber > AVANTIS_SCENE_COUNT) return
	let end = 13
	while (end < frame.length - 1 && frame[end] !== 0 && frame[end] !== 0xff) end++
	const name = frame.subarray(13, end).toString('utf8').trim()
	return name ? { sceneNumber, name } : undefined
}

export function parseSceneStateFrame(frame: Buffer, expectedFamily = DEFAULT_FAMILY): number | undefined {
	if (
		frame.length !== 20 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame.readUInt16BE(3) !== 0x000f ||
		frame.readUInt16BE(5) !== expectedFamily ||
		frame.toString('hex', 7, 11) !== '10010008' ||
		frame[19] !== 0xf7
	) {
		return undefined
	}

	const zeroBasedScene = (frame[11] << 8) | frame[12]
	for (const offset of [13, 15, 17]) {
		if (((frame[offset] << 8) | frame[offset + 1]) !== zeroBasedScene) return undefined
	}
	const sceneNumber = zeroBasedScene + 1
	return sceneNumber <= AVANTIS_SCENE_COUNT ? sceneNumber : undefined
}
