export const CONSOLE_CONFIG_MANAGER_NAME = 'DR Box Identification'
export const CONSOLE_CONFIG_DISCOVERY_HANDLE = 0x61ff
export const CONSOLE_CONFIG_HANDLE = 0x6200
export const RACK_UFX_DISCOVERY_HANDLE = 0x61fe
export const DPACK_DISCOVERY_HANDLE = 0x61fd

export type AvantisMainMode = 'None' | 'LR' | 'LR+MSum' | 'LR+M' | 'L C R' | 'L C R +' | `Unknown (${number})`

export type AvantisConsoleMixConfiguration = {
	monoGroups: number
	stereoGroups: number
	monoFx: number
	stereoFx: number
	monoAuxes: number
	stereoAuxes: number
	monoMatrices: number
	stereoMatrices: number
	mainMode: AvantisMainMode
	stereoPafl: number
}

export function buildConsoleConfigManagerDiscoveryMessage(): Buffer {
	return buildNamedManagerDiscoveryMessage(CONSOLE_CONFIG_MANAGER_NAME, CONSOLE_CONFIG_DISCOVERY_HANDLE)
}

export function buildNamedManagerDiscoveryMessage(nameValue: string, handle: number): Buffer {
	if (!Number.isInteger(handle) || handle < 1 || handle > 0xffff)
		throw new RangeError('Discovery handle must be 1-65535')
	const name = Buffer.from(`${nameValue}\0`, 'utf8')
	return Buffer.concat([
		Buffer.from([0xf0, 0x00, 0x01, 0x00, 0x00, handle >> 8, handle & 0xff, 0x00, 0x04, 0x00, name.length]),
		name,
		Buffer.from([0xf7]),
	])
}

export function parseConsoleConfigManagerDiscoveryFrame(frame: Buffer): number | undefined {
	return parseNamedManagerDiscoveryFrame(frame, CONSOLE_CONFIG_DISCOVERY_HANDLE)
}

export function parseNamedManagerDiscoveryFrame(frame: Buffer, handle: number): number | undefined {
	if (
		frame.length !== 14 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame.readUInt16BE(3) !== handle ||
		frame.readUInt16BE(5) !== 0x0000 ||
		frame.readUInt16BE(7) !== 0x0002 ||
		frame.readUInt16BE(9) !== 0x0002 ||
		frame.at(-1) !== 0xf7
	)
		return
	return frame.readUInt16BE(11)
}

export function buildRackUfxCapabilityDiscoveryMessage(): Buffer {
	return buildNamedManagerDiscoveryMessage('Ultra FX Manager 01', RACK_UFX_DISCOVERY_HANDLE)
}

export function buildDPackCapabilityDiscoveryMessage(): Buffer {
	return buildNamedManagerDiscoveryMessage('Insert 1, Input Channel 96 - Intermediate', DPACK_DISCOVERY_HANDLE)
}

export function buildConsoleMixConfigSyncMessages(family: number): Buffer[] {
	if (!Number.isInteger(family) || family < 1 || family > 0xffff) throw new RangeError('Manager family must be 1-65535')
	return [
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
			CONSOLE_CONFIG_HANDLE >> 8,
			CONSOLE_CONFIG_HANDLE & 0xff,
			0x10,
			0x02,
			0x10,
			0x02,
			0x00,
			0xff,
			0xf7,
		]),
		Buffer.from([
			0xf0,
			0x00,
			0x01,
			family >> 8,
			family & 0xff,
			CONSOLE_CONFIG_HANDLE >> 8,
			CONSOLE_CONFIG_HANDLE & 0xff,
			0x00,
			0x08,
			0x00,
			0x00,
			0xf7,
		]),
	]
}

function mainMode(value: number): AvantisMainMode {
	if (value === 0) return 'None'
	if (value === 1) return 'LR'
	if (value === 2) return 'LR+MSum'
	if (value === 3) return 'LR+M'
	if (value === 4) return 'L C R'
	if (value === 5) return 'L C R +'
	return `Unknown (${value})`
}

export function parseConsoleMixConfigurationFrame(
	frame: Buffer,
	family: number,
): AvantisConsoleMixConfiguration | undefined {
	if (
		frame.length !== 24 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame.readUInt16BE(3) !== CONSOLE_CONFIG_HANDLE ||
		frame.readUInt16BE(5) !== family ||
		frame.readUInt16BE(7) !== 0x1002 ||
		frame.readUInt16BE(9) !== 12 ||
		frame.at(-1) !== 0xf7
	)
		return
	return {
		monoGroups: frame[11],
		stereoGroups: frame[12],
		monoFx: frame[13],
		stereoFx: frame[14],
		monoAuxes: frame[15],
		stereoAuxes: frame[16],
		monoMatrices: frame[17],
		stereoMatrices: frame[18],
		mainMode: mainMode(frame[19]),
		stereoPafl: frame[20],
	}
}
