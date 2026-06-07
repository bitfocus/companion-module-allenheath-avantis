import {
	InstanceBase,
	InstanceStatus,
	type CompanionOptionValues,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { createRequire } from 'node:module'
import * as net from 'net'
import UpdateActions from './actions.js'
import { GetConfigFields, type ModuleConfig } from './config.js'
import UpdateFeedbacks from './feedbacks.js'
import type { ActionsSchema } from './actions.js'
import type { FeedbacksSchema } from './feedbacks.js'
import { UpgradeScripts } from './upgrades.js'
import UpdateVariableDefinitions, { type VariablesSchema } from './variables.js'

const require = createRequire(import.meta.url)
const avantisConfig = require('./avantisconfig.json') as typeof import('./avantisconfig.json')

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

	async init(config: ModuleConfig, _isFirstInit: boolean, _secrets: undefined): Promise<void> {
		this.config = config

		this.updateStatus(InstanceStatus.Ok)
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.initTcp()
		this.setupSceneSelection()
	}

	async destroy(): Promise<void> {
		if (this.tcpSocket) {
			this.tcpSocket.destroy()
		}

		this.log('debug', `destroyed ${this.id}`)
	}

	async configUpdated(config: ModuleConfig, _secrets: undefined): Promise<void> {
		this.config = config
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

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	initTcp(): void {
		if (this.tcpSocket) {
			this.tcpSocket.destroy()
			delete this.tcpSocket
		}

		if (this.config.host) {
			this.tcpSocket = new net.Socket().connect({
				host: this.config.host,
				port: PORT,
			})

			this.tcpSocket.on('status_change', (status: any, message: any) => {
				this.updateStatus(status, message)
			})

			this.tcpSocket.on('error', (err: { message: string }) => {
				this.log('error', `TCP error: ${err.message}`)
			})

			this.tcpSocket.on('connect', () => {
				this.log('debug', `TCP Connected to ${this.config.host}`)
			})

			this.tcpSocket.on('data', (data: Buffer) => {
				this.validateResponseData(data)
			})
		}
	}

	validateResponseData(data: Buffer): void {
		const values = data.toJSON().data
		if (!values) {
			return
		}

		this.log('debug', `Response DATA: ${JSON.stringify(values)}`)
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
				bufferCommands = this.buildMuteCommand(opt as { channel: number; mute: boolean }, midiBase)
				break
			case 'fader_input':
				bufferCommands = this.buildFaderCommand(opt as { level: string; channel: number }, midiBase)
				break
			case 'mute_mono_group':
			case 'mute_stereo_group':
				bufferCommands = this.buildMuteCommand(opt as { channel: number; mute: boolean }, midiBase + 1)
				break
			case 'fader_mono_group':
			case 'fader_stereo_group':
				bufferCommands = this.buildFaderCommand(opt as { level: string; channel: number }, midiBase + 1)
				break
			case 'mute_mono_aux':
			case 'mute_stereo_aux':
				bufferCommands = this.buildMuteCommand(opt as { channel: number; mute: boolean }, midiBase + 2)
				break
			case 'fader_mono_aux':
			case 'fader_stereo_aux':
				bufferCommands = this.buildFaderCommand(opt as { level: string; channel: number }, midiBase + 2)
				break
			case 'mute_mono_matrix':
			case 'mute_stereo_matrix':
				bufferCommands = this.buildMuteCommand(opt as { channel: number; mute: boolean }, midiBase + 3)
				break
			case 'fader_mono_matrix':
			case 'fader_stereo_matrix':
				bufferCommands = this.buildFaderCommand(opt as { level: string; channel: number }, midiBase + 3)
				break
			case 'mute_mono_fx_send':
			case 'mute_stereo_fx_send':
			case 'mute_fx_return':
			case 'mute_dca':
			case 'mute_master':
			case 'mute_group':
				bufferCommands = this.buildMuteCommand(opt as { channel: number; mute: boolean }, midiBase + 4)
				break
			case 'fader_DCA':
			case 'fader_mono_fx_send':
			case 'fader_stereo_fx_send':
			case 'fader_fx_return':
			case 'fader_master':
				bufferCommands = this.buildFaderCommand(opt as { level: string; channel: number }, midiBase + 4)
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

	buildMuteCommand(opt: { channel: number; mute: boolean }, midiOffset: number): Buffer[] {
		return [Buffer.from([0x90 + midiOffset, opt.channel, opt.mute ? 0x7f : 0x3f, 0x90 + midiOffset, opt.channel, 0x00])]
	}

	buildFaderCommand(opt: { level: string; channel: number }, midiOffset: number): Buffer[] {
		const faderLevel = parseInt(opt.level)

		return [
			Buffer.from([
				0xb0 + midiOffset,
				0x63,
				opt.channel,
				0xb0 + midiOffset,
				0x62,
				0x17,
				0xb0 + midiOffset,
				0x06,
				faderLevel,
			]),
		]
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
		opt: { srcChannel: string | number; destChannel: number; level: string },
		baseMidi: number,
		srcMidiChnl: number,
		destMidiChnl: number,
	): Buffer[] {
		return [
			Buffer.from([
				...SysExHeader,
				0x00 + baseMidi + srcMidiChnl,
				0x0d,
				parseInt(String(opt.srcChannel)),
				baseMidi + destMidiChnl,
				opt.destChannel,
				parseInt(opt.level),
				0xf7,
			]),
		]
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
}
