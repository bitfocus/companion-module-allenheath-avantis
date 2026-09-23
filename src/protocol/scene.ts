export const AVANTIS_SCENE_COUNT = 500
export const SCENES_PER_BANK = 128

export function parseSceneNumberList(values: string[]): number[] {
	if (values.length === 0) throw new RangeError('A scene list must contain at least one scene')
	return values.map((value) => {
		const trimmed = value.trim()
		if (trimmed.length === 0) throw new RangeError('Scene lists cannot contain an empty entry')
		const sceneNumber = Number(trimmed)
		if (!Number.isInteger(sceneNumber) || sceneNumber < 1 || sceneNumber > AVANTIS_SCENE_COUNT) {
			throw new RangeError(`Scene number must be an integer from 1 to ${AVANTIS_SCENE_COUNT}`)
		}
		return sceneNumber
	})
}

export function resolveSceneNames(values: string[], sceneNames: Record<number, string>): number[] {
	if (values.length === 0) throw new RangeError('A scene-name list must contain at least one scene name')
	const indexedNames = new Map<string, number[]>()
	for (const [sceneNumberText, sceneName] of Object.entries(sceneNames)) {
		const sceneNumber = Number(sceneNumberText)
		const normalizedName = sceneName.trim().toLocaleLowerCase()
		if (!normalizedName || !Number.isInteger(sceneNumber) || sceneNumber < 1 || sceneNumber > AVANTIS_SCENE_COUNT)
			continue
		const matches = indexedNames.get(normalizedName) ?? []
		matches.push(sceneNumber)
		indexedNames.set(normalizedName, matches)
	}

	return values.map((value) => {
		const name = value.trim()
		if (!name) throw new RangeError('Scene-name lists cannot contain an empty entry')
		const matches = indexedNames.get(name.toLocaleLowerCase()) ?? []
		if (matches.length === 0)
			throw new RangeError(`Scene name “${name}” was not found in the synchronized scene directory`)
		if (matches.length > 1) {
			throw new RangeError(`Scene name “${name}” is ambiguous because it matches Scenes ${matches.join(', ')}`)
		}
		return matches[0]
	})
}

export function resolveAvailableSceneNames(
	values: string[],
	sceneNames: Record<number, string>,
): { scenes: number[]; errors: string[] } {
	const scenes: number[] = []
	const errors: string[] = []
	for (const value of values) {
		try {
			scenes.push(...resolveSceneNames([value], sceneNames))
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error))
		}
	}
	return { scenes, errors }
}

export function buildSceneRecallMessage(sceneNumber: number, midiBaseChannel: number): Buffer {
	if (!Number.isInteger(sceneNumber) || sceneNumber < 1 || sceneNumber > AVANTIS_SCENE_COUNT) {
		throw new RangeError(`Scene number must be an integer from 1 to ${AVANTIS_SCENE_COUNT}`)
	}
	if (!Number.isInteger(midiBaseChannel) || midiBaseChannel < 1 || midiBaseChannel > 12) {
		throw new RangeError('Base MIDI channel must be an integer from 1 to 12')
	}

	const zeroBasedScene = sceneNumber - 1
	const bank = Math.floor(zeroBasedScene / SCENES_PER_BANK)
	const program = zeroBasedScene % SCENES_PER_BANK
	const midiChannelOffset = midiBaseChannel - 1

	return Buffer.from([0xb0 + midiChannelOffset, 0x00, bank, 0xc0 + midiChannelOffset, program])
}
