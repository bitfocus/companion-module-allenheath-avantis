import { buildNamedManagerDiscoveryMessage, parseNamedManagerDiscoveryFrame } from './console-config-discovery.js'

export const IO_PORT_1_DISCOVERY_HANDLE = 0x7201
export const IO_PORT_2_DISCOVERY_HANDLE = 0x7202
export const SLINK_DISCOVERY_HANDLE = 0x7203
export const SLINK_RACK_1_HANDLE = 0x7301
export const SLINK_RACK_2_HANDLE = 0x7302

export function buildHardwareStatusDiscoveryMessages(): Buffer[] {
	return [
		buildNamedManagerDiscoveryMessage('Port B Plus Dante Option Card, 01', IO_PORT_1_DISCOVERY_HANDLE),
		buildNamedManagerDiscoveryMessage('Port B Plus Dante Option Card, 02', IO_PORT_2_DISCOVERY_HANDLE),
		buildNamedManagerDiscoveryMessage('Stagebox GX NetObject', SLINK_DISCOVERY_HANDLE),
	]
}

export function parseIoPortDiscovery(frame: Buffer): 1 | 2 | undefined {
	if (parseNamedManagerDiscoveryFrame(frame, IO_PORT_1_DISCOVERY_HANDLE) !== undefined) return 1
	if (parseNamedManagerDiscoveryFrame(frame, IO_PORT_2_DISCOVERY_HANDLE) !== undefined) return 2
	return
}

export function parseSlinkManagerDiscovery(frame: Buffer): number | undefined {
	return parseNamedManagerDiscoveryFrame(frame, SLINK_DISCOVERY_HANDLE)
}

const registration = (family: number, handle: number, path: number, property: number): Buffer =>
	Buffer.from([
		0xf0,
		0x00,
		0x01,
		family >> 8,
		family & 0xff,
		0x00,
		0x03,
		0x00,
		0x06,
		0x00,
		0x0a,
		0x00,
		0x00,
		handle >> 8,
		handle & 0xff,
		path >> 8,
		path & 0xff,
		property >> 8,
		property & 0xff,
		0x00,
		0xff,
		0xf7,
	])

const request = (family: number, handle: number): Buffer =>
	Buffer.from([0xf0, 0x00, 0x01, family >> 8, family & 0xff, handle >> 8, handle & 0xff, 0x00, 0x08, 0x00, 0x00, 0xf7])

export function buildSlinkStatusSyncMessages(family: number): Buffer[] {
	return [
		registration(family, SLINK_RACK_1_HANDLE, 0x1008, 0x101d),
		request(family, SLINK_RACK_1_HANDLE),
		registration(family, SLINK_RACK_2_HANDLE, 0x1004, 0x1019),
		request(family, SLINK_RACK_2_HANDLE),
	]
}

export function parseSlinkStatusFrame(
	frame: Buffer,
	family: number | undefined,
): { rack: 1 | 2; connected: boolean } | undefined {
	if (
		family === undefined ||
		frame.length !== 44 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame.readUInt16BE(5) !== family ||
		frame.readUInt16BE(9) !== 32 ||
		frame.at(-1) !== 0xf7
	)
		return
	const handle = frame.readUInt16BE(3)
	const rack = handle === SLINK_RACK_1_HANDLE ? 1 : handle === SLINK_RACK_2_HANDLE ? 2 : undefined
	if (!rack) return
	const expectedProperty = rack === 1 ? 0x1008 : 0x1004
	if (frame.readUInt16BE(7) !== expectedProperty) return
	// Captured online records carry a concrete socket/type value at payload byte 13
	// (08 for GX4816 and 04 for DX168). The disconnected sentinel is FF.
	return { rack, connected: frame[24] !== 0xff }
}
