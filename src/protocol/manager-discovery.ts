export type AhNetManagerName = 'Bank Switcher Manager' | 'Scene Manager Intermediate' | 'Playback Manager'

function managerDiscoveryHandle(name: AhNetManagerName): number {
	if (name === 'Scene Manager Intermediate') return 0x000f
	if (name === 'Playback Manager') return 0x02d0
	return 0x0003
}

export function buildManagerIdentificationRequest(name: AhNetManagerName): Buffer {
	const encodedName = Buffer.from(`${name}\0`, 'utf8')
	const handle = managerDiscoveryHandle(name)
	return Buffer.concat([
		Buffer.from([0xf0, 0x00, 0x01, 0x00, 0x00, (handle >> 8) & 0xff, handle & 0xff, 0x00, 0x04]),
		Buffer.from([(encodedName.length >> 8) & 0xff, encodedName.length & 0xff]),
		encodedName,
		Buffer.from([0xf7]),
	])
}

export function parseManagerIdentificationFrame(frame: Buffer, name: AhNetManagerName): number | undefined {
	if (
		frame.length !== 14 ||
		frame[0] !== 0xf0 ||
		frame[1] !== 0x00 ||
		frame[2] < 0x01 ||
		frame[2] > 0x05 ||
		frame.readUInt16BE(3) !== managerDiscoveryHandle(name) ||
		frame.readUInt16BE(5) !== 0x0000 ||
		frame.readUInt16BE(7) !== 0x0002 ||
		frame.readUInt16BE(9) !== 0x0002 ||
		frame.at(-1) !== 0xf7
	)
		return
	return frame.readUInt16BE(11)
}
