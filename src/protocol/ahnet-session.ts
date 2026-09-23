import { randomBytes } from 'node:crypto'

const AHNET_SESSION_FRAME_LENGTH = 8

/**
 * Director opens an AH-Net control session before requesting any NetObject data.
 * The final two payload bytes are a per-connection client token.
 */
export function buildAhNetSessionInitializationMessage(clientToken = randomBytes(2)): Buffer {
	if (clientToken.length !== 2) throw new RangeError('AH-Net session client token must contain exactly two bytes')
	return Buffer.from([0xe0, 0x00, 0x04, 0x01, 0x03, clientToken[0], clientToken[1], 0xe7])
}

export function parseAhNetSessionInitializationResponse(frame: Buffer): boolean {
	return (
		frame.length === AHNET_SESSION_FRAME_LENGTH &&
		frame[0] === 0xe0 &&
		frame[1] === 0x00 &&
		frame[2] === 0x04 &&
		frame[3] === 0x02 &&
		frame[4] === 0x03 &&
		frame[7] === 0xe7
	)
}
