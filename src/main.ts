import {
	InstanceBase,
	InstanceStatus,
	type CompanionOptionValues,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import * as net from 'net'
import UpdateActions from './actions.js'
import avantisConfig from './avantisconfig.json' with { type: 'json' }
import { GetConfigFields, type ModuleConfig } from './config.js'
import { accelerationFactor, adjustLevel, clampLevel, formatLevel, LEVEL_MAX, LEVEL_MIN } from './levels.js'
import UpdateFeedbacks from './feedbacks.js'
import type { ActionsSchema } from './actions.js'
import type { FeedbacksSchema } from './feedbacks.js'
import UpdatePresets from './presets.js'
import { UpgradeScripts } from './upgrades.js'
import UpdateVariableDefinitions, { type VariablesSchema } from './variables.js'

const PORT = 51325
const SysExHeader = [0xf0, 0x00, 0x00, 0x1a, 0x50, 0x10, 0x01, 0x00]
const configFields = GetConfigFields()

type SceneDefinition = {
	sceneNumber: number
	block: number
	ss: number
}

type ActionExecution = {
	action: string
	options: CompanionOptionValues
}

type AdjustOptions = {
	channel: number
	delta: string | number
	minLevel?: string | number
	maxLevel?: string | number
	unknownLevel?: string | number
	accel?: boolean
}

type SendAdjustOptions = Omit<AdjustOptions, 'channel'> & {
	srcChannel: string | number
	destChannel: number
}

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig
	tcpSocket?: net.Socket
	scenes: SceneDefinition[] = []
	faderLevelCache: Record<string, number> = {}
	muteStateCache: Record<string, boolean> = {}
	faderFadeTimers: Record<string, NodeJS.Timeout[]> = {}
	nrpnMSB: Record<number, number> = {}
	nrpnLSB: Record<number, number> = {}
	reconnectTimer?: NodeJS.Timeout

	/**
	 * Send levels, keyed by source and destination.  Unlike fader levels there
	 * is no NRPN readback for these, so this is seeded by whatever we send and
	 * by any send-level SysEx the desk reports.
	 */
	sendLevelCache: Record<string, number> = {}

	/** Variables registered on demand for the sends that have actually been touched. */
	sendVariableNames: Record<string, string> = {}

	/** Timestamp of the last relative move per control, used for acceleration. */
	lastAdjustAt: Record<string, number> = {}

	async init(config: ModuleConfig, _isFirstInit: boolean, _secrets: undefined): Promise<void> {
		this.config = config

		this.updateStatus(InstanceStatus.Connecting)
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		this.initTcp()
		this.setupSceneSelection()
	}

	async destroy(): Promise<void> {
		this.clearFaderFadeTimers()
		this.clearReconnectTimer()

		if (this.tcpSocket) {
			this.tcpSocket.destroy()
		}

		this.log('debug', `destroyed ${this.id}`)
	}

	async configUpdated(config: ModuleConfig, _secrets: undefined): Promise<void> {
		this.config = config
		this.updateActions()
		this.updatePresets()
		this.initTcp()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return configFields
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	initTcp(): void {
		this.clearFaderFadeTimers()
		this.clearReconnectTimer()

		if (this.tcpSocket) {
			this.tcpSocket.destroy()
			delete this.tcpSocket
		}

		if (this.config.host) {
			this.updateStatus(InstanceStatus.Connecting)
			this.tcpSocket = new net.Socket().connect({
				host: this.config.host,
				port: PORT,
			})

			this.tcpSocket.on('error', (err: { message: string }) => {
				this.log('error', `TCP error: ${err.message}`)
				this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
				this.triggerReconnect()
			})

			this.tcpSocket.on('connect', () => {
				this.log('debug', `TCP Connected to ${this.config.host}`)
				this.updateStatus(InstanceStatus.Ok)
				this.clearReconnectTimer()
			})

			this.tcpSocket.on('close', () => {
				this.updateStatus(InstanceStatus.Disconnected)
				this.triggerReconnect()
			})

			this.tcpSocket.on('data', (data: Buffer) => {
				this.validateResponseData(data)
			})
		}
	}

	clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			delete this.reconnectTimer
		}
	}

	triggerReconnect(): void {
		this.clearReconnectTimer()
		this.reconnectTimer = setTimeout(() => {
			this.log('debug', 'Attempting to reconnect to Avantis mixer...')
			this.initTcp()
		}, 5000)
	}

	validateResponseData(data: Buffer): void {
		this.processIncomingMidi(data)

		const values = data.toJSON().data
		if (!values) {
			return
		}

		this.log('debug', `Response DATA: ${JSON.stringify(values)}`)
	}

	processIncomingMidi(data: Buffer): void {
		let changedMutes = false
		const changedFeedbacks = new Set<keyof FeedbacksSchema>()
		let runningStatus = 0

		let i = 0
		while (i < data.length) {
			let status = data[i]
			const isStatusByte = (status & 0x80) !== 0

			if (isStatusByte) {
				runningStatus = status
				i++
			} else {
				status = runningStatus
			}

			if ((status & 0x80) === 0) {
				// No valid status byte available, skip
				i++
				continue
			}

			const msgType = status & 0xf0
			const midiCh = status & 0x0f

			if (msgType === 0x90) {
				// Note On (3 bytes total: status, note, velocity)
				if (i + 1 < data.length) {
					const note = data[i]
					const velocity = data[i + 1]
					i += 2

					// Ignore momentary key release (velocity 0x00)
					if (velocity !== 0x00) {
						const isMuted = velocity >= 0x40
						const key = `${midiCh}:${note}`

						if (this.muteStateCache[key] !== isMuted) {
							this.muteStateCache[key] = isMuted
							changedMutes = true
							const midiBase = (this.config.midiBase ?? 1) - 1
							const relCh = midiCh - midiBase
							if (relCh === 0) changedFeedbacks.add('mute_input')
							else if (relCh === 1) {
								changedFeedbacks.add('mute_mono_group')
								changedFeedbacks.add('mute_stereo_group')
							} else if (relCh === 2) {
								changedFeedbacks.add('mute_mono_aux')
								changedFeedbacks.add('mute_stereo_aux')
							} else if (relCh === 3) {
								changedFeedbacks.add('mute_mono_matrix')
								changedFeedbacks.add('mute_stereo_matrix')
							} else if (relCh === 4) {
								changedFeedbacks.add('mute_mono_fx_send')
								changedFeedbacks.add('mute_stereo_fx_send')
								changedFeedbacks.add('mute_fx_return')
								changedFeedbacks.add('mute_master')
								changedFeedbacks.add('mute_dca')
								changedFeedbacks.add('mute_group')
							}
						}
					}
				} else {
					break
				}
			} else if (msgType === 0x80) {
				// Note Off (3 bytes total: status, note, velocity) - ignore for mute state
				if (i + 1 < data.length) {
					i += 2
				} else {
					break
				}
			} else if (msgType === 0xb0) {
				// Control Change (3 bytes total: status, controller, value)
				if (i + 1 < data.length) {
					const controller = data[i]
					const val = data[i + 1]
					i += 2

					if (controller === 0x63) {
						// NRPN MSB
						this.nrpnMSB[midiCh] = val
					} else if (controller === 0x62) {
						// NRPN LSB
						this.nrpnLSB[midiCh] = val
					} else if (controller === 0x06) {
						// Data Entry MSB
						if (this.nrpnLSB[midiCh] === 0x17) {
							const channel = this.nrpnMSB[midiCh]
							if (channel !== undefined) {
								this.faderLevelCache[`${midiCh}:${channel}`] = val
								this.updateFaderLevelVariable(midiCh, channel, val)
							}
						}
					}
				} else {
					break
				}
			} else if (msgType === 0xa0 || msgType === 0xe0) {
				if (i + 1 < data.length) {
					i += 2
				} else {
					break
				}
			} else if (msgType === 0xc0 || msgType === 0xd0) {
				if (i < data.length) {
					i += 1
				} else {
					break
				}
			} else if (status === 0xf0) {
				// Sysex
				const sysexStart = i
				while (i < data.length && data[i] !== 0xf7) {
					i++
				}
				if (i < data.length) {
					this.handleIncomingSysex(data.subarray(sysexStart, i))
					i++
				}
				runningStatus = 0
			} else {
				if (isStatusByte) {
					// Already advanced i
				} else {
					i++
				}
			}
		}

		if (changedMutes && changedFeedbacks.size > 0) {
			const arr = Array.from(changedFeedbacks)
			const first = arr[0]
			if (first) {
				this.checkFeedbacks(first, ...arr.slice(1))
			}
		}
	}

	/**
	 * The desk is not required to report send levels, but if it ever does we
	 * would rather learn the real value than trust what we last sent.
	 */
	handleIncomingSysex(body: Buffer): void {
		const header = SysExHeader.slice(1) // everything after the 0xF0 status byte
		if (body.length < header.length + 6) {
			return
		}

		for (let index = 0; index < header.length; index++) {
			if (body[index] !== header[index]) {
				return
			}
		}

		const payload = body.subarray(header.length)
		if (payload[1] !== 0x0d) {
			return
		}

		const midiBase = (this.config.midiBase ?? 1) - 1
		const srcMidiChnl = payload[0] - midiBase
		const destMidiChnl = payload[3] - midiBase
		const srcChannel = payload[2]
		const destChannel = payload[4]
		const level = payload[5]

		if (srcMidiChnl < 0 || destMidiChnl < 0 || level > LEVEL_MAX) {
			return
		}

		this.updateSendLevel(
			`${srcMidiChnl}:${srcChannel}:${destMidiChnl}:${destChannel}`,
			srcChannel,
			destMidiChnl,
			destChannel,
			level,
		)
	}

	updateFaderLevelVariable(midiOffset: number, channel: number, level: number): void {
		const midiBase = (this.config.midiBase ?? 1) - 1
		const relOffset = midiOffset - midiBase

		let prefix = ''
		let index = 1

		// Note numbers per the Avantis MIDI TCP protocol reference table:
		// inputs 00-3F, mono types 00-27, stereo types 40-53, mono FX sends
		// 00-0B, stereo FX sends 10-1B, FX returns 20-2B, mains 30-32,
		// DCAs 36-45.
		if (relOffset === 0) {
			prefix = 'fader_input'
			index = channel + 1
		} else if (relOffset === 1) {
			if (channel >= 0x40) {
				prefix = 'fader_stereo_group'
				index = channel - 0x40 + 1
			} else {
				prefix = 'fader_mono_group'
				index = channel + 1
			}
		} else if (relOffset === 2) {
			if (channel >= 0x40) {
				prefix = 'fader_stereo_aux'
				index = channel - 0x40 + 1
			} else {
				prefix = 'fader_mono_aux'
				index = channel + 1
			}
		} else if (relOffset === 3) {
			if (channel >= 0x40) {
				prefix = 'fader_stereo_matrix'
				index = channel - 0x40 + 1
			} else {
				prefix = 'fader_mono_matrix'
				index = channel + 1
			}
		} else if (relOffset === 4) {
			if (channel >= 0x36 && channel <= 0x45) {
				prefix = 'fader_dca'
				index = channel - 0x36 + 1
			} else if (channel >= 0x30 && channel <= 0x32) {
				prefix = 'fader_main'
				index = channel - 0x30 + 1
			} else if (channel >= 0x10 && channel <= 0x1b) {
				prefix = 'fader_stereo_fx_send'
				index = channel - 0x10 + 1
			} else if (channel >= 0x20 && channel <= 0x2b) {
				prefix = 'fader_fx_return'
				index = channel - 0x20 + 1
			} else if (channel <= 0x0b) {
				prefix = 'fader_mono_fx_send'
				index = channel + 1
			}
		}

		if (prefix) {
			this.setVariableValues({
				[`${prefix}_${index}`]: formatLevel(level),
			})
		}
	}

	setupSceneSelection(): void {
		const getSceneBank = (sceneNumber: number): number => {
			if (sceneNumber <= 128) return 0x00
			if (sceneNumber <= 256) return 0x01
			if (sceneNumber <= 384) return 0x02
			return 0x03
		}

		const getSceneSSNumber = (sceneNumber: number): number => {
			while (sceneNumber > 128) {
				sceneNumber -= 128
			}

			return sceneNumber - 1
		}

		this.scenes = []
		for (let i = 1; i <= avantisConfig.config.sceneCount; i++) {
			this.scenes.push({
				sceneNumber: i,
				block: getSceneBank(i),
				ss: getSceneSSNumber(i),
			})
		}
	}

	action(action: ActionExecution): void {
		const opt = action.options
		let bufferCommands: Buffer[] = []
		const midiBase = (this.config.midiBase ?? 1) - 1

		switch (action.action) {
			case 'mute_input':
				bufferCommands = this.buildMuteCommand(opt as { channel: number; mute: string | boolean }, midiBase)
				break
			case 'fader_input':
				bufferCommands = this.handleFaderAction(
					opt as { level: string; channel: number; fadeDuration?: string | number },
					midiBase,
				)
				break
			case 'mute_mono_group':
			case 'mute_stereo_group':
				bufferCommands = this.buildMuteCommand(opt as { channel: number; mute: string | boolean }, midiBase + 1)
				break
			case 'fader_mono_group':
			case 'fader_stereo_group':
				bufferCommands = this.handleFaderAction(
					opt as { level: string; channel: number; fadeDuration?: string | number },
					midiBase + 1,
				)
				break
			case 'mute_mono_aux':
			case 'mute_stereo_aux':
				bufferCommands = this.buildMuteCommand(opt as { channel: number; mute: string | boolean }, midiBase + 2)
				break
			case 'fader_mono_aux':
			case 'fader_stereo_aux':
				bufferCommands = this.handleFaderAction(
					opt as { level: string; channel: number; fadeDuration?: string | number },
					midiBase + 2,
				)
				break
			case 'mute_mono_matrix':
			case 'mute_stereo_matrix':
				bufferCommands = this.buildMuteCommand(opt as { channel: number; mute: string | boolean }, midiBase + 3)
				break
			case 'fader_mono_matrix':
			case 'fader_stereo_matrix':
				bufferCommands = this.handleFaderAction(
					opt as { level: string; channel: number; fadeDuration?: string | number },
					midiBase + 3,
				)
				break
			case 'mute_mono_fx_send':
			case 'mute_stereo_fx_send':
			case 'mute_fx_return':
			case 'mute_dca':
			case 'mute_master':
			case 'mute_group':
				bufferCommands = this.buildMuteCommand(opt as { channel: number; mute: string | boolean }, midiBase + 4)
				break
			case 'fader_DCA':
			case 'fader_mono_fx_send':
			case 'fader_stereo_fx_send':
			case 'fader_fx_return':
			case 'fader_master':
				bufferCommands = this.handleFaderAction(
					opt as { level: string; channel: number; fadeDuration?: string | number },
					midiBase + 4,
				)
				break
			case 'fader_adjust_input':
				bufferCommands = this.buildFaderAdjustCommand(opt as AdjustOptions, midiBase)
				break
			case 'fader_adjust_mono_group':
			case 'fader_adjust_stereo_group':
				bufferCommands = this.buildFaderAdjustCommand(opt as AdjustOptions, midiBase + 1)
				break
			case 'fader_adjust_mono_aux':
			case 'fader_adjust_stereo_aux':
				bufferCommands = this.buildFaderAdjustCommand(opt as AdjustOptions, midiBase + 2)
				break
			case 'fader_adjust_mono_matrix':
			case 'fader_adjust_stereo_matrix':
				bufferCommands = this.buildFaderAdjustCommand(opt as AdjustOptions, midiBase + 3)
				break
			case 'fader_adjust_mono_fx_send':
			case 'fader_adjust_stereo_fx_send':
			case 'fader_adjust_fx_return':
			case 'fader_adjust_master':
			case 'fader_adjust_dca':
				bufferCommands = this.buildFaderAdjustCommand(opt as AdjustOptions, midiBase + 4)
				break
			case 'send_adjust_input_to_mono_aux':
			case 'send_adjust_input_to_stereo_aux':
				bufferCommands = this.buildSendAdjustCommand(opt as SendAdjustOptions, midiBase, 0, 2)
				break
			case 'send_adjust_input_to_mono_matrix':
			case 'send_adjust_input_to_stereo_matrix':
				bufferCommands = this.buildSendAdjustCommand(opt as SendAdjustOptions, midiBase, 0, 3)
				break
			case 'send_adjust_input_to_mono_fx_send':
			case 'send_adjust_input_to_stereo_fx_send':
			case 'send_adjust_input_to_main':
				bufferCommands = this.buildSendAdjustCommand(opt as SendAdjustOptions, midiBase, 0, 4)
				break
			case 'dca_assign':
				bufferCommands = this.buildAssignCommands(
					opt as { dcaGroup?: number[]; muteGroup?: number[]; assign: boolean; channel: number },
					midiBase + 4,
					true,
				)
				break
			case 'mute_group_assign':
				bufferCommands = this.buildAssignCommands(
					opt as { dcaGroup?: number[]; muteGroup?: number[]; assign: boolean; channel: number },
					midiBase + 4,
					false,
				)
				break
			case 'scene_recall':
				bufferCommands = this.buildSceneCommand(opt as { sceneNumber: string }, midiBase)
				break
			case 'channel_main_assign':
				bufferCommands = this.buildChannelAssignCommand(opt as { channel: number; assign: boolean }, midiBase)
				break
			case 'channel_name':
				bufferCommands = this.buildChannelNameCommand(opt as { channel: string; channelName: string }, midiBase)
				break
			case 'channel_color':
				bufferCommands = this.buildChannelColorCommand(opt as { channel: string; color: string }, midiBase)
				break
			case 'send_input_to_mono_aux':
			case 'send_input_to_stereo_aux':
				bufferCommands = this.buildSendLevelCommand(
					opt as { srcChannel: string | number; destChannel: number; level: string },
					midiBase,
					0,
					2,
				)
				break
			case 'send_input_to_mono_aux_number':
				bufferCommands = this.buildSendLevelNumberCommand(
					opt as { srcChannel: string | number; destChannel: number; 'level-int': number },
					midiBase,
					0,
					2,
				)
				break
			case 'send_input_to_mono_matrix':
			case 'send_input_to_stereo_matrix':
				bufferCommands = this.buildSendLevelCommand(
					opt as { srcChannel: string | number; destChannel: number; level: string },
					midiBase,
					0,
					3,
				)
				break
			case 'send_input_to_fx_return':
			case 'send_input_to_mono_fx_return':
			case 'send_input_to_stereo_fx_return':
			case 'send_input_to':
				bufferCommands = this.buildSendLevelCommand(
					opt as { srcChannel: string | number; destChannel: number; level: string },
					midiBase,
					0,
					4,
				)
				break
		}

		for (let i = 0; i < bufferCommands.length; i++) {
			if (this.tcpSocket) {
				this.dumpData(opt, midiBase, bufferCommands)
				this.log(
					'debug',
					`sending '${bufferCommands[i].toString('hex')}' ${i}/${bufferCommands.length} via TCP @${this.config.host}`,
				)
				this.tcpSocket.write(bufferCommands[i])
			}
		}
	}

	buildMuteCommand(opt: { channel: number; mute: string | boolean }, midiOffset: number): Buffer[] {
		const channel = Number(opt.channel)
		const key = `${midiOffset}:${channel}`
		const muteState =
			opt.mute === 'toggle'
				? !this.muteStateCache[key]
				: opt.mute === true || opt.mute === 'true' || opt.mute === 'mute'

		if (this.muteStateCache[key] !== muteState) {
			this.muteStateCache[key] = muteState
			const midiBase = (this.config.midiBase ?? 1) - 1
			const relOffset = midiOffset - midiBase
			if (relOffset === 0) {
				this.checkFeedbacks('mute_input')
			} else if (relOffset === 1) {
				this.checkFeedbacks('mute_mono_group', 'mute_stereo_group')
			} else if (relOffset === 2) {
				this.checkFeedbacks('mute_mono_aux', 'mute_stereo_aux')
			} else if (relOffset === 3) {
				this.checkFeedbacks('mute_mono_matrix', 'mute_stereo_matrix')
			} else if (relOffset === 4) {
				this.checkFeedbacks(
					'mute_mono_fx_send',
					'mute_stereo_fx_send',
					'mute_fx_return',
					'mute_master',
					'mute_dca',
					'mute_group',
				)
			}
		}
		return [Buffer.from([0x90 + midiOffset, channel, muteState ? 0x7f : 0x3f, 0x90 + midiOffset, channel, 0x00])]
	}

	handleFaderAction(
		opt: { level: string; channel: number; fadeDuration?: string | number },
		midiOffset: number,
	): Buffer[] {
		const fadeDuration = Number(opt.fadeDuration ?? 0)
		if (Number.isFinite(fadeDuration) && fadeDuration > 0) {
			this.fadeFaderCommand(opt, midiOffset, fadeDuration)
			return []
		}

		return this.buildFaderCommand(opt, midiOffset)
	}

	fadeFaderCommand(opt: { level: string; channel: number }, midiOffset: number, fadeDuration: number): void {
		const targetLevel = parseInt(opt.level)
		const channel = Number(opt.channel)
		const key = `${midiOffset}:${channel}`
		const startLevel = this.faderLevelCache[key]

		this.clearFaderFadeTimers(key)

		if (startLevel === undefined || startLevel === targetLevel) {
			this.writeCommand(this.buildFaderCommand(opt, midiOffset)[0])
			return
		}

		const stepCount = Math.max(2, Math.min(40, Math.round(fadeDuration * 10)))
		const values = Array.from(
			new Set(
				Array.from({ length: stepCount }, (_, index) =>
					Math.round(startLevel + ((targetLevel - startLevel) * (index + 1)) / stepCount),
				),
			),
		)
		const intervalMs = Math.max(50, Math.round((fadeDuration * 1000) / values.length))

		this.faderFadeTimers[key] = values.map((level, index) =>
			setTimeout(
				() => {
					this.writeCommand(this.buildFaderCommand({ level: String(level), channel: opt.channel }, midiOffset)[0])
					if (index === values.length - 1) {
						delete this.faderFadeTimers[key]
					}
				},
				intervalMs * (index + 1),
			),
		)
	}

	buildFaderCommand(opt: { level: string; channel: number }, midiOffset: number): Buffer[] {
		const faderLevel = parseInt(opt.level)
		const channel = Number(opt.channel)
		this.faderLevelCache[`${midiOffset}:${channel}`] = faderLevel
		this.updateFaderLevelVariable(midiOffset, channel, faderLevel)

		return [
			Buffer.from([
				0xb0 + midiOffset,
				0x63,
				channel,
				0xb0 + midiOffset,
				0x62,
				0x17,
				0xb0 + midiOffset,
				0x06,
				faderLevel,
			]),
		]
	}

	/**
	 * Resolve the starting level for a relative move.
	 *
	 * Returns null when we have never seen a level for this control and the
	 * action is set to wait rather than assume one.  Guessing here would mean a
	 * dial's first turn jumping a live fader from wherever it really is to
	 * whatever we assumed, so waiting is the default.
	 */
	resolveCurrentLevel(cached: number | undefined, opt: AdjustOptions | SendAdjustOptions): number | null {
		if (cached !== undefined) {
			return cached
		}

		if (opt.unknownLevel === undefined || opt.unknownLevel === 'none') {
			return null
		}

		return clampLevel(Number(opt.unknownLevel))
	}

	/** Apply a relative move, with optional acceleration for fast turns. */
	resolveAdjustedLevel(key: string, current: number, opt: AdjustOptions | SendAdjustOptions): number {
		const now = Date.now()
		const previous = this.lastAdjustAt[key]
		this.lastAdjustAt[key] = now

		let delta = Number(opt.delta ?? 0)
		if (opt.accel && previous !== undefined) {
			delta *= accelerationFactor(now - previous)
		}

		const minLevel = opt.minLevel === undefined ? LEVEL_MIN : Number(opt.minLevel)
		const maxLevel = opt.maxLevel === undefined ? LEVEL_MAX : Number(opt.maxLevel)

		return adjustLevel(current, delta, minLevel, maxLevel)
	}

	buildFaderAdjustCommand(opt: AdjustOptions, midiOffset: number): Buffer[] {
		const channel = Number(opt.channel)
		const key = `${midiOffset}:${channel}`
		const current = this.resolveCurrentLevel(this.faderLevelCache[key], opt)

		if (current === null) {
			this.log(
				'info',
				`Ignoring relative fader move: no level known yet for this channel. Move it once on the desk, set it from Companion, or choose a starting level in the action.`,
			)
			return []
		}

		const level = this.resolveAdjustedLevel(key, current, opt)
		if (level === current) {
			return []
		}

		return this.buildFaderCommand({ level: String(level), channel }, midiOffset)
	}

	buildSendAdjustCommand(
		opt: SendAdjustOptions,
		baseMidi: number,
		srcMidiChnl: number,
		destMidiChnl: number,
	): Buffer[] {
		const srcChannel = Number(opt.srcChannel)
		const destChannel = Number(opt.destChannel)
		const key = `${srcMidiChnl}:${srcChannel}:${destMidiChnl}:${destChannel}`
		const current = this.resolveCurrentLevel(this.sendLevelCache[key], opt)

		if (current === null) {
			this.log(
				'info',
				`Ignoring relative send move: no level known yet for this send. The desk does not report send levels, so set it once from Companion or choose a starting level in the action.`,
			)
			return []
		}

		const level = this.resolveAdjustedLevel(key, current, opt)
		if (level === current) {
			return []
		}

		return this.buildSendLevelCommand(
			{ srcChannel, destChannel, level: String(level) },
			baseMidi,
			srcMidiChnl,
			destMidiChnl,
		)
	}

	/**
	 * Name for a send target, following the note numbers in the protocol
	 * reference table.
	 */
	describeSendTarget(destMidiChnl: number, destChannel: number): string {
		if (destMidiChnl === 2) {
			return destChannel >= 0x40 ? `stereo_aux_${destChannel - 0x40 + 1}` : `mono_aux_${destChannel + 1}`
		}
		if (destMidiChnl === 3) {
			return destChannel >= 0x40 ? `stereo_matrix_${destChannel - 0x40 + 1}` : `mono_matrix_${destChannel + 1}`
		}
		if (destMidiChnl === 4) {
			if (destChannel >= 0x30 && destChannel <= 0x32) {
				return `main_${destChannel - 0x30 + 1}`
			}
			if (destChannel >= 0x20 && destChannel <= 0x2b) {
				return `fx_return_${destChannel - 0x20 + 1}`
			}
			if (destChannel >= 0x10 && destChannel <= 0x1b) {
				return `stereo_fx_send_${destChannel - 0x10 + 1}`
			}
			return `mono_fx_send_${destChannel + 1}`
		}

		return `mix_${destMidiChnl}_${destChannel}`
	}

	/**
	 * Record a send level and expose it as a variable.  There are far too many
	 * source/destination pairs to declare up front, so a variable appears the
	 * first time a given send is used.
	 */
	updateSendLevel(key: string, srcChannel: number, destMidiChnl: number, destChannel: number, level: number): void {
		this.sendLevelCache[key] = level

		const variableId = `send_in${srcChannel + 1}_to_${this.describeSendTarget(destMidiChnl, destChannel)}`
		if (!this.sendVariableNames[key]) {
			this.sendVariableNames[key] = variableId
			UpdateVariableDefinitions(this, false)
		}

		this.setVariableValues({ [variableId]: formatLevel(level) })
	}

	buildAssignCommands(
		opt: { dcaGroup?: number[]; muteGroup?: number[]; assign: boolean; channel: number },
		midiOffset: number,
		isDca: boolean,
	): Buffer[] {
		const routingCmds: Buffer[] = []
		const groups = isDca ? (opt.dcaGroup ?? []) : (opt.muteGroup ?? [])
		let offset = 0

		if (isDca) {
			if (opt.assign) offset = 0x40
		} else if (opt.assign) {
			offset = 0x50
		} else {
			offset = 0x10
		}

		for (const groupCode of groups) {
			routingCmds.push(
				Buffer.from([
					0xb0 + midiOffset,
					0x63,
					opt.channel,
					0xb0 + midiOffset,
					0x62,
					0x40,
					0xb0 + midiOffset,
					0x06,
					groupCode + offset,
				]),
			)
		}

		return routingCmds
	}

	buildSceneCommand(opt: { sceneNumber: string }, midiOffset: number): Buffer[] {
		const scene = this.scenes[parseInt(opt.sceneNumber)]
		return [Buffer.from([0xb0 + midiOffset, 0x00, scene.block, 0xc0 + midiOffset, scene.ss])]
	}

	buildChannelAssignCommand(opt: { channel: number; assign: boolean }, midiOffset: number): Buffer[] {
		return [
			Buffer.from([
				0xb0 + midiOffset,
				0x63,
				opt.channel,
				0xb0 + midiOffset,
				0x62,
				0x18,
				0xb0 + midiOffset,
				0x06,
				opt.assign ? 0x7f : 0x3f,
			]),
		]
	}

	buildChannelNameCommand(opt: { channel: string; channelName: string }, midiOffset: number): Buffer[] {
		const commandArray = [...SysExHeader, 0x00 + midiOffset, 0x03, parseInt(opt.channel)]
		const nameMap = avantisConfig.name as Record<string, string | undefined>

		for (const char of opt.channelName) {
			const value = nameMap[char]
			if (value) {
				commandArray.push(parseInt(value, 16))
			}
		}

		commandArray.push(0xf7)
		return [Buffer.from(commandArray)]
	}

	buildChannelColorCommand(opt: { channel: string; color: string }, midiOffset: number): Buffer[] {
		return [Buffer.from([...SysExHeader, 0x00 + midiOffset, 0x06, parseInt(opt.channel), parseInt(opt.color), 0xf7])]
	}

	buildSendLevelCommand(
		opt: { srcChannel: string | number | (string | number)[]; destChannel: number; level: string },
		baseMidi: number,
		srcMidiChnl: number,
		destMidiChnl: number,
	): Buffer[] {
		const sourceChannels = Array.isArray(opt.srcChannel) ? opt.srcChannel : [opt.srcChannel]
		const level = parseInt(opt.level)

		return sourceChannels.map((sourceChannel) => {
			const source = parseInt(String(sourceChannel))
			this.updateSendLevel(
				`${srcMidiChnl}:${source}:${destMidiChnl}:${opt.destChannel}`,
				source,
				destMidiChnl,
				opt.destChannel,
				level,
			)

			return Buffer.from([
				...SysExHeader,
				0x00 + baseMidi + srcMidiChnl,
				0x0d,
				source,
				baseMidi + destMidiChnl,
				opt.destChannel,
				level,
				0xf7,
			])
		})
	}

	buildSendLevelNumberCommand(
		opt: { srcChannel: string | number; destChannel: number; 'level-int': number },
		baseMidi: number,
		srcMidiChnl: number,
		destMidiChnl: number,
	): Buffer[] {
		const levelMap = [
			'0x00',
			'0x1B',
			'0x2F',
			'0x39',
			'0x3B',
			'0x43',
			'0x49',
			'0x51',
			'0x55',
			'0x57',
			'0x59',
			'0x5B',
			'0x5D',
			'0x5F',
			'0x61',
			'0x63',
			'0x65',
			'0x67',
			'0x69',
			'0x6B',
		]
		const levelAsHexString = levelMap[opt['level-int']] ?? '0x00'

		this.log('debug', `levelAsHexString: ${levelAsHexString}`)

		return [
			Buffer.from([
				...SysExHeader,
				0x00 + baseMidi + srcMidiChnl,
				0x0d,
				parseInt(String(opt.srcChannel)),
				baseMidi + destMidiChnl,
				opt.destChannel,
				parseInt(levelAsHexString),
				0xf7,
			]),
		]
	}

	dumpData(opt: CompanionOptionValues, midiBase: number, bufferCommands: Buffer[]): void {
		this.log('debug', `dumpData: ${JSON.stringify(opt)} ${midiBase} ${bufferCommands.length}`)
	}

	writeCommand(command: Buffer): void {
		if (this.tcpSocket?.writable) {
			this.tcpSocket.write(command)
		}
	}

	clearFaderFadeTimers(key?: string): void {
		const keys = key ? [key] : Object.keys(this.faderFadeTimers)
		for (const timerKey of keys) {
			for (const timer of this.faderFadeTimers[timerKey] ?? []) {
				clearTimeout(timer)
			}
			delete this.faderFadeTimers[timerKey]
		}
	}
}
