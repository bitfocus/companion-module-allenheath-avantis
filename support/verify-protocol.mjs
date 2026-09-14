// Verifies the patched Avantis module against the published A&H protocol.
import ModuleInstance from '../dist/main.js'
import { levelToDb, formatLevel, adjustLevel, dbToLevel } from '../dist/levels.js'
import faderTable from '../dist/fader.json' with { type: 'json' }

let pass = 0
let fail = 0
const check = (name, actual, expected) => {
	const a = JSON.stringify(actual)
	const e = JSON.stringify(expected)
	if (a === e) {
		pass++
	} else {
		fail++
		console.log(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`)
	}
}
const hex = (buffers) => buffers.map((b) => b.toString('hex').toUpperCase().match(/../g).join(' '))

// --- 1. Level law must reproduce every entry in the published table ---------
for (const [db, hexVal] of faderTable.level) {
	const level = parseInt(hexVal, 16)
	if (db === '-inf') {
		check(`table -inf -> ${hexVal}`, levelToDb(level), null)
		check(`format -inf`, formatLevel(level), '-inf dB')
	} else {
		check(`table ${db} dB = ${hexVal}`, levelToDb(level), Number(db))
		check(`dbToLevel(${db})`, dbToLevel(Number(db)), level)
	}
}
check('unity is 0x6B', dbToLevel(0), 0x6b)
check('format unity', formatLevel(0x6b), '0 dB')
check('format +10', formatLevel(0x7f), '+10 dB')
check('format half step', formatLevel(0x56), '-10.5 dB')

// --- 2. Relative stepping ---------------------------------------------------
check('1 dB up from unity', adjustLevel(0x6b, 1, 0, 127), 0x6d)
check('1 dB down from unity', adjustLevel(0x6b, -1, 0, 127), 0x69)
check('0.5 dB up', adjustLevel(0x6b, 0.5, 0, 127), 0x6c)
check('clamped at top', adjustLevel(0x7f, 1, 0, 127), 0x7f)
check('clamped at bottom', adjustLevel(0x00, -1, 0, 127), 0x00)
check('window ceiling honoured', adjustLevel(0x6b, 6, 0, 0x6b), 0x6b)
check('window floor honoured', adjustLevel(0x43, -6, 0x43, 0x7f), 0x43)
check(
	'ten 1 dB steps = 10 dB',
	[...Array(10)].reduce((l) => adjustLevel(l, 1, 0, 127), 0x6b),
	dbToLevel(10),
)

// --- 3. Real message bytes, base MIDI channel 12 (the Avantis default) ------
const self = Object.create(ModuleInstance.prototype)
self.config = { host: '10.0.0.5', midiBase: 12, inputCount: 64 }
self.faderLevelCache = {}
self.sendLevelCache = {}
self.sendVariableNames = {}
self.lastAdjustAt = {}
const vars = {}
self.setVariableValues = (v) => Object.assign(vars, v)
self.setVariableDefinitions = () => {}
self.log = () => {}

const midiBase = self.config.midiBase - 1 // 11 (0x0B)

// Spec: Fader Level = BN, 63, CH, BN, 62, 17, BN, 06, LV
check('input 12 fader to 0 dB', hex(self.buildFaderCommand({ level: String(0x6b), channel: 11 }, midiBase)), [
	'BB 63 0B BB 62 17 BB 06 6B',
])
// DCA 1 is note 0x36 on N+4 per the reference table
check('DCA 1 fader to -10 dB', hex(self.buildFaderCommand({ level: String(0x57), channel: 0x36 }, midiBase + 4)), [
	'BF 63 36 BF 62 17 BF 06 57',
])

// Spec: Aux/FX/Mtx Sends = SysEx Header, 0N, 0D, CH, SndN, SndCH, LV, F7
check(
	'input 12 send to mono aux 3 at 0 dB',
	hex(self.buildSendLevelCommand({ srcChannel: 11, destChannel: 2, level: String(0x6b) }, midiBase, 0, 2)),
	['F0 00 00 1A 50 10 01 00 0B 0D 0B 0D 02 6B F7'],
)
check(
	'input 1 send to stereo aux 1 (note 0x40) at -20 dB',
	hex(self.buildSendLevelCommand({ srcChannel: 0, destChannel: 0x40, level: String(0x43) }, midiBase, 0, 2)),
	['F0 00 00 1A 50 10 01 00 0B 0D 00 0D 40 43 F7'],
)

// --- 4. Variable mapping against the reference table note numbers -----------
self.updateFaderLevelVariable(midiBase, 0x00, 0x6b)
check('input 1 variable', vars['fader_input_1'], '0 dB')
self.updateFaderLevelVariable(midiBase + 4, 0x36, 0x57)
check('DCA 1 variable (note 0x36)', vars['fader_dca_1'], '-10 dB')
self.updateFaderLevelVariable(midiBase + 4, 0x45, 0x6b)
check('DCA 16 variable (note 0x45)', vars['fader_dca_16'], '0 dB')
self.updateFaderLevelVariable(midiBase + 4, 0x30, 0x6b)
check('Main 1 variable (note 0x30)', vars['fader_main_1'], '0 dB')
self.updateFaderLevelVariable(midiBase + 2, 0x40, 0x6b)
check('stereo aux 1 variable (note 0x40)', vars['fader_stereo_aux_1'], '0 dB')
self.updateFaderLevelVariable(midiBase + 2, 0x00, 0x6b)
check('mono aux 1 variable', vars['fader_mono_aux_1'], '0 dB')
self.updateFaderLevelVariable(midiBase + 4, 0x20, 0x6b)
check('FX return 1 variable (note 0x20)', vars['fader_fx_return_1'], '0 dB')

// --- 5. Relative behaviour end to end --------------------------------------
self.faderLevelCache = {}
check(
	'relative move with unknown level sends nothing',
	self.buildFaderAdjustCommand({ channel: 11, delta: 1, unknownLevel: 'none' }, midiBase),
	[],
)
check(
	'relative move with a declared starting level',
	hex(self.buildFaderAdjustCommand({ channel: 11, delta: 1, unknownLevel: 0x6b }, midiBase)),
	['BB 63 0B BB 62 17 BB 06 6D'],
)
// cache is now seeded at 0x6D, so the next turn continues from there
check(
	'relative move continues from the cache',
	hex(self.buildFaderAdjustCommand({ channel: 11, delta: 1 }, midiBase)),
	['BB 63 0B BB 62 17 BB 06 6F'],
)
check('variable follows the relative move', vars['fader_input_12'], '+2 dB')

// a desk-reported level wins over what we last sent
self.updateFaderLevelVariable(midiBase, 11, 0x6b)
self.faderLevelCache[`${midiBase}:11`] = 0x6b
check(
	'relative move follows the desk after a surface move',
	hex(self.buildFaderAdjustCommand({ channel: 11, delta: -1 }, midiBase)),
	['BB 63 0B BB 62 17 BB 06 69'],
)

// sends: seeded by an absolute set, then nudged
self.sendLevelCache = {}
self.buildSendLevelCommand({ srcChannel: 11, destChannel: 2, level: String(0x43) }, midiBase, 0, 2)
check('send variable registered on use', vars['send_in12_to_mono_aux_3'], '-20 dB')
check(
	'relative send move',
	hex(self.buildSendAdjustCommand({ srcChannel: 11, destChannel: 2, delta: 1 }, midiBase, 0, 2)),
	['F0 00 00 1A 50 10 01 00 0B 0D 0B 0D 02 45 F7'],
)
check('send variable follows', vars['send_in12_to_mono_aux_3'], '-19 dB')

// --- 5b. The (Number) send variant must seed the cache too ------------------
self.sendLevelCache = {}
// Level index 13 on the 0-19 scale is 0x5F (-6 dB); CH 42 -> Mono Aux 8.
check(
	'number-variant send bytes',
	hex(self.buildSendLevelNumberCommand({ srcChannel: 41, destChannel: 7, 'level-int': 13 }, midiBase, 0, 2)),
	['F0 00 00 1A 50 10 01 00 0B 0D 29 0D 07 5F F7'],
)
check('number-variant seeds the cache', self.sendLevelCache['0:41:2:7'], 0x5f)
check('number-variant sets the variable', vars['send_in42_to_mono_aux_8'], '-6 dB')
check(
	'dial can then move relative to it',
	hex(self.buildSendAdjustCommand({ srcChannel: 41, destChannel: 7, delta: 1 }, midiBase, 0, 2)),
	['F0 00 00 1A 50 10 01 00 0B 0D 29 0D 07 61 F7'],
)

// --- 6. Learning a send level from an incoming SysEx ------------------------
self.sendLevelCache = {}
self.handleIncomingSysex(Buffer.from([0x00, 0x00, 0x1a, 0x50, 0x10, 0x01, 0x00, 0x0b, 0x0d, 0x05, 0x0d, 0x01, 0x57]))
check('learned send level from desk', self.sendLevelCache['0:5:2:1'], 0x57)
check('learned send variable', vars['send_in6_to_mono_aux_2'], '-10 dB')
self.handleIncomingSysex(Buffer.from([0x00, 0x00, 0x1a, 0x50, 0x10, 0x01, 0x00, 0x0b, 0x99, 0x05, 0x0d, 0x01, 0x57]))
check('unrelated sysex ignored', Object.keys(self.sendLevelCache).length, 1)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
