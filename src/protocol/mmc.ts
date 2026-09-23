export const MMC_TRANSPORT_CHOICES = [
	{ id: 0x01, label: 'Stop' },
	{ id: 0x02, label: 'Play' },
	{ id: 0x04, label: 'Fast Forward' },
	{ id: 0x05, label: 'Rewind' },
	{ id: 0x06, label: 'Record' },
	{ id: 0x09, label: 'Pause' },
] as const

export function buildMmcTransportMessage(command: number): Buffer {
	if (!MMC_TRANSPORT_CHOICES.some((choice) => choice.id === command)) {
		throw new RangeError('Unsupported MMC transport command')
	}
	return Buffer.from([0xf0, 0x7f, 0x7f, 0x06, command, 0xf7])
}
