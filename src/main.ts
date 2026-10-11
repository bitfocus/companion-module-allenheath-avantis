import {
	InstanceBase,
	InstanceStatus,
	type CompanionOptionValues,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import * as net from 'net'
import {
	buildAhNetSessionInitializationMessage,
	parseAhNetSessionInitializationResponse,
} from './protocol/ahnet-session.js'
import UpdateActions from './actions.js'
import avantisConfig from './avantisconfig.json' with { type: 'json' }
import fader from './fader.json' with { type: 'json' }
import {
	GetConfigFields,
	getChannelCapacities,
	getFadeUpdatesPerSecond,
	getConfiguredMixLayout,
	getSceneNameRetrievalLimit,
	isAhNetStateSyncEnabled,
	shouldRetrieveAllSceneNames,
	type ModuleConfig,
} from './config.js'
import UpdateFeedbacks from './feedbacks.js'
import type { ActionsSchema } from './actions.js'
import type { FeedbacksSchema } from './feedbacks.js'
import UpdatePresets from './presets.js'
import { UpgradeScripts } from './upgrades.js'
import UpdateVariableDefinitions, { type VariablesSchema } from './variables.js'
import {
	buildSceneRecallMessage,
	parseSceneNumberList,
	resolveAvailableSceneNames,
	resolveSceneNames,
} from './protocol/scene.js'
import { buildSceneStateSyncMessages, parseSceneNameFrame, parseSceneStateFrame } from './protocol/scene-sync.js'
import { buildSceneDirectoryNameRequest, parseSceneDirectoryNameFrame } from './protocol/scene-directory.js'
import { parseRawMidiHex } from './protocol/raw-midi.js'
import { faderVariableId } from './protocol/fader-variable.js'
import { buildMmcTransportMessage } from './protocol/mmc.js'
import {
	buildGlobalTempoPeriodMessage,
	buildGlobalTempoBpmMessage,
	buildGlobalTempoSyncMessages,
	GLOBAL_TEMPO_RESET_MS,
	globalTempoPeriodToBpm,
	parseGlobalTempoFrame,
} from './protocol/global-tempo.js'

import {
	buildChannelColorRequest,
	buildChannelNameRequest,
	buildInputColorRequest,
	buildInputNameRequest,
	CHANNEL_COLOR_LABELS,
	parseChannelInfoReply,
} from './protocol/channel-info.js'
import { buildStripNameMessage } from './protocol/strip-name.js'
import {
	buildStripMetadataSyncMessages,
	buildStripMetadataTargetMap,
	buildStripMetadataTargets,
	parseStripMetadataUpdate,
	stripMetadataVariableId,
	type StripMetadataTarget,
} from './protocol/strip-metadata-sync.js'
import {
	buildControlChangeMessage,
	parseUfxGlobalControlChange,
	UFX_GLOBAL_KEY_CHOICES,
	UFX_GLOBAL_SCALE_CHOICES,
} from './protocol/ufx.js'
import {
	buildVirtualSoundcheckModeMessage,
	buildVirtualSoundcheckRegistrationMessage,
	buildVirtualSoundcheckValueRequest,
	parseVirtualSoundcheckModeFrame,
	type VirtualSoundcheckMode,
	type VirtualSoundcheckModeName,
	virtualSoundcheckModeName,
} from './protocol/virtual-soundcheck.js'
import {
	buildAhNetSurfaceIdentificationRequest,
	buildInputFaderSubscriptionMessages,
	inputFaderSubscription,
	parseInputFaderUpdate,
} from './protocol/fader-sync.js'
import {
	buildGlobalKeyScaleSyncMessages,
	buildGlobalKeySetterMessage,
	buildGlobalScaleSetterMessage,
	parseGlobalKeyScaleFrame,
} from './protocol/global-key-scale-sync.js'
import { MUTE_GROUP_COUNT, parseMuteGroupFrame } from './protocol/mute-group-sync.js'
import { buildPriorityStateSyncBatches } from './protocol/state-sync-priority.js'
import {
	UfxFeedbackState,
	UFX_WRITE_FEEDBACK_GRACE_MS,
	type UfxFeedbackTarget,
	type UfxFeedbackValue,
} from './protocol/ufx-feedback-state.js'
import {
	buildUfxBypassMessage,
	buildUfxBypassSyncMessages,
	parseUfxBypassFrame,
	UFX_BYPASS_COUNT,
} from './protocol/ufx-bypass.js'
import {
	buildMasterStripsLockSyncMessages,
	buildUsbRecorderStateSyncMessages,
	parseConsoleStateFrame,
} from './protocol/console-state-sync.js'
import {
	buildConsoleFaderSubscriptionMessage,
	buildConsoleFaderTargets,
	parseConsoleFaderUpdate,
	type ConsoleFaderTarget,
} from './protocol/console-fader-sync.js'
import {
	buildUsbPlaybackStartMessage,
	buildUsbPlaybackSyncMessages,
	buildUsbPlaybackTransportMessage,
	parseUsbPlaybackFrame,
	type UsbPlaybackState,
} from './protocol/usb-playback.js'
import { buildUsbRecorderStartMessage, buildUsbRecorderStopMessage } from './protocol/usb-recorder.js'
import {
	buildUfxPluginBypassMessage,
	buildUfxPluginBypassSyncMessages,
	parseUfxPluginBypassFrame,
	UFX_PLUGIN_BYPASS_COUNT,
} from './protocol/ufx-plugin-bypass.js'
import {
	buildFirmwareSyncMessages,
	parseFirmwareFrame,
	parseSurfaceIdentificationFrame,
} from './protocol/firmware-sync.js'
import {
	buildManagerIdentificationRequest,
	parseManagerIdentificationFrame,
	nextManagerToDiscover,
	type AhNetManagerName,
} from './protocol/manager-discovery.js'
import {
	buildConsoleConfigManagerDiscoveryMessage,
	buildConsoleMixConfigSyncMessages,
	buildDPackCapabilityDiscoveryMessage,
	buildRackUfxCapabilityDiscoveryMessage,
	parseConsoleConfigManagerDiscoveryFrame,
	parseConsoleMixConfigurationFrame,
	parseNamedManagerDiscoveryFrame,
	DPACK_DISCOVERY_HANDLE,
	RACK_UFX_DISCOVERY_HANDLE,
	type AvantisConsoleMixConfiguration,
} from './protocol/console-config-discovery.js'
import {
	buildHardwareStatusDiscoveryMessages,
	buildSlinkStatusSyncMessages,
	parseIoPortDiscovery,
	parseSlinkManagerDiscovery,
	parseSlinkStatusFrame,
} from './protocol/hardware-status.js'

const AHNET_RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000] as const
const COMMAND_RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000] as const

export function getAhNetReconnectDelay(attempt: number): number {
	const delayIndex = Math.min(Math.max(0, Math.trunc(attempt)), AHNET_RECONNECT_DELAYS_MS.length - 1)
	return AHNET_RECONNECT_DELAYS_MS[delayIndex]
}

export function getCommandReconnectDelay(attempt: number): number {
	const delayIndex = Math.min(Math.max(0, Math.trunc(attempt)), COMMAND_RECONNECT_DELAYS_MS.length - 1)
	return COMMAND_RECONNECT_DELAYS_MS[delayIndex]
}

const PORT = 51325
const AHNET_PORT = 51321
const CONNECTION_ATTEMPT_TIMEOUT_MS = 8000
const COMMAND_HEALTH_PROBE_INTERVAL_MS = 15000
const COMMAND_HEALTH_PROBE_TIMEOUT_MS = 5000
// Targeted AH-Net messages are small (the largest captured state record is far
// below this limit). Do not allow a damaged stream without an F7 terminator to
// retain unbounded memory.
const MAX_AHNET_INCOMPLETE_FRAME_BYTES = 64 * 1024
// Commands pressed during a routine AH-Net lease renewal are held briefly and
// sent once the new session is acknowledged, instead of being dropped.
const MAX_HELD_AHNET_COMMANDS = 32
const HELD_AHNET_COMMAND_MAX_AGE_MS = 2500
const SysExHeader = [0xf0, 0x00, 0x00, 0x1a, 0x50, 0x10, 0x01, 0x00]
const configFields = GetConfigFields()

const faderLevelToDbMap: string[] = new Array(128).fill('-inf')

function initFaderLevelToDbMap(): void {
	const faderLevels = fader.level.map(([db, hex]) => ({ db, val: parseInt(hex, 16) }))
	faderLevels.sort((a, b) => a.val - b.val)

	let currentIdx = 0
	for (let val = 0; val <= 127; val++) {
		while (
			currentIdx < faderLevels.length - 1 &&
			Math.abs(faderLevels[currentIdx + 1].val - val) <= Math.abs(faderLevels[currentIdx].val - val)
		) {
			currentIdx++
		}
		faderLevelToDbMap[val] = faderLevels[currentIdx].db
	}
}

initFaderLevelToDbMap()

type ActionExecution = {
	action: string
	options: CompanionOptionValues
}

type PendingSceneSequence = {
	scenes: number[]
	nextIndex: number
	initialDelayMs: number
	intervalMs: number
	notBeforeConnection: number
}

/** initial: first start; renewal: routine 24 s lease renewal; recovery: reconnect after a lost session. */
export type AhNetStartMode = 'initial' | 'renewal' | 'recovery'

export type ConnectionLifecycleState =
	| 'Disabled'
	| 'Offline'
	| 'Connecting'
	| 'Synchronizing'
	| 'Ready'
	| 'Recovering'
	| 'Degraded'

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
	ahNetSocket?: net.Socket
	ahNetReceiveBuffer = Buffer.alloc(0)
	ahNetSessionInitialized = false
	ahNetSceneStateReceived = false
	pendingAhNetSessionStart?: () => void
	ahNetSessionTimer?: NodeJS.Timeout
	ahNetLeaseRenewalTimer?: NodeJS.Timeout
	commandHealthProbeTimer?: NodeJS.Timeout
	commandHealthProbeTimeout?: NodeJS.Timeout
	commandHealthProbeSocket?: net.Socket
	stateVerificationTimers: NodeJS.Timeout[] = []
	ahNetRenewalInProgress = false
	heldAhNetCommands: Array<{ command: Buffer; description: string; heldAt: number; onDrop?: () => void }> = []
	ahNetSessionMode: AhNetStartMode = 'initial'
	ahNetSceneDirectoryStartTimer?: NodeJS.Timeout
	faderLevelCache: Record<string, number> = {}
	muteStateCache: Record<string, boolean> = {}
	faderFadeTimers: Record<string, NodeJS.Timeout[]> = {}
	nrpnMSB: Record<number, number> = {}
	nrpnLSB: Record<number, number> = {}
	sceneBankByMidiChannel: Record<number, number> = {}
	incomingRunningStatus = 0
	lastSceneNumber = 0
	lastSceneName = 'Unknown'
	sceneNameCache: Record<number, string> = {}
	pendingSceneDirectoryIndex?: number
	sceneDirectoryNextIndex = 0
	sceneDirectoryConsecutiveTimeouts = 0
	sceneDirectoryTimer?: NodeJS.Timeout
	sceneDirectoryResponseTimer?: NodeJS.Timeout
	virtualSoundcheckMode: VirtualSoundcheckModeName = 'Unknown'
	virtualSoundcheckModeValue?: VirtualSoundcheckMode
	ufxGlobalKey?: number
	ufxGlobalScale?: number
	ufxFeedbackState?: UfxFeedbackState
	ufxWriteFeedbackTimers?: Map<UfxFeedbackTarget, NodeJS.Timeout>
	reconnectTimer?: NodeJS.Timeout
	commandOnline?: boolean
	commandConnectionStatus?: string
	commandConnectionState: ConnectionLifecycleState = 'Offline'
	synchronizationConnectionState: ConnectionLifecycleState = 'Disabled'
	ahNetReconnectTimer?: NodeJS.Timeout
	ahNetReconnectAttempt = 0
	commandReconnectAttempt = 0
	connectionLifecycleActive = false
	ahNetSyncTimer?: NodeJS.Timeout
	subscribedInputFaders: number[] = []
	ahNetFaderChannelsByHandle = new Map<number, number>()
	ahNetConsoleFadersByHandle = new Map<string, ConsoleFaderTarget>()
	pendingInitialFaderSync = new Set<number>()
	pendingInitialConsoleFaderSync = new Set<string>()
	initialFaderSyncRetryCount = 0
	faderSyncStatus = 'Disabled'
	connectionSerial = 0
	pendingSceneSequences: PendingSceneSequence[] = []
	sceneSequenceTimer?: NodeJS.Timeout
	midiSysexBuffer = Buffer.alloc(0)
	midiReceiveBuffer = Buffer.alloc(0)
	inputInfoSyncTimers: NodeJS.Timeout[] = []
	inputNameCache: Record<number, string> = {}
	inputColorCache: Record<number, number> = {}
	consoleStripInfoTargets = new Map<string, { nameVariableId: string; colorVariableId: string }>()
	consoleStripNameCache: Record<string, string> = {}
	consoleStripColorCache: Record<string, number> = {}
	stripMetadataTargets = new Map<string, { target: StripMetadataTarget; kind: 'name' | 'color' }>()
	lastGlobalTempoTapAt?: number
	globalTempoBpm?: number
	muteGroupStates: Array<boolean | undefined> = Array.from({ length: MUTE_GROUP_COUNT })
	ufxBypassStates: Array<boolean | undefined> = Array.from({ length: UFX_BYPASS_COUNT })
	ufxPluginBypassStates: Array<boolean | undefined> = Array.from({ length: UFX_PLUGIN_BYPASS_COUNT })
	ufxBypassSyncTimer?: NodeJS.Timeout
	talkbackActive?: boolean
	masterStripsLocked?: boolean
	usbRecorderRecording?: boolean
	usbPlaybackState?: UsbPlaybackState
	usbPlaybackFilename?: string
	firmwareVersion?: string
	firmwareRevision?: string
	ahNetConsoleFamily?: number
	ahNetBankSwitcherFamily?: number
	ahNetSceneManagerFamily?: number
	ahNetPlaybackManagerFamily?: number
	pendingAhNetManagerDiscovery?: AhNetManagerName
	discoveredConsoleLayout?: AvantisConsoleMixConfiguration
	discoveredDPack?: boolean
	discoveredRackUfx?: boolean
	consoleConfigFamily?: number
	consoleDiscoverySettled = false
	ioPortInstalled: Array<boolean | undefined> = [undefined, undefined]
	slinkRackConnected: Array<boolean | undefined> = [undefined, undefined]
	slinkManagerFamily?: number

	async init(config: ModuleConfig, _isFirstInit: boolean, _secrets: undefined): Promise<void> {
		this.config = config
		this.connectionLifecycleActive = true
		this.commandReconnectAttempt = 0
		this.ahNetReconnectAttempt = 0
		this.refreshConsoleStripInfoTargets()

		this.updateStatus(InstanceStatus.Connecting)
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		this.initTcp()
		this.initAhNet()
	}

	async destroy(): Promise<void> {
		this.connectionLifecycleActive = false
		this.setCommandConnectionState('Offline')
		this.setSynchronizationConnectionState('Offline')
		this.clearFaderFadeTimers()
		this.clearReconnectTimer()
		this.clearAhNetReconnectTimer()
		this.clearAhNetSyncTimer()
		this.clearCommandHealthMonitor()
		this.clearSceneDirectorySync()
		this.clearSceneQueue()
		this.clearInputInfoSyncTimers()
		delete this.lastGlobalTempoTapAt

		if (this.tcpSocket) {
			this.tcpSocket.destroy()
		}
		this.destroyAhNetConnection(false)

		this.log('debug', `destroyed ${this.id}`)
	}

	async configUpdated(config: ModuleConfig, _secrets: undefined): Promise<void> {
		this.config = config
		this.connectionLifecycleActive = true
		this.commandReconnectAttempt = 0
		this.ahNetReconnectAttempt = 0
		this.clearCommandHealthMonitor()
		this.consoleDiscoverySettled = config.useManualConsoleConfig === true
		delete this.discoveredConsoleLayout
		delete this.discoveredDPack
		delete this.discoveredRackUfx
		this.refreshConsoleStripInfoTargets()
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		this.initTcp()
		this.initAhNet()
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

	initTcp(isBackgroundReconnect = false): void {
		if (!this.connectionLifecycleActive) return
		this.clearFaderFadeTimers()
		this.clearReconnectTimer()
		this.clearCommandSessionTimers()
		this.midiSysexBuffer = Buffer.alloc(0)
		this.midiReceiveBuffer = Buffer.alloc(0)
		this.incomingRunningStatus = 0
		this.nrpnMSB = {}
		this.nrpnLSB = {}
		this.sceneBankByMidiChannel = {}

		if (this.tcpSocket) {
			this.tcpSocket.destroy()
			delete this.tcpSocket
		}

		if (this.config.host) {
			this.updateStatus(InstanceStatus.Connecting)
			this.setCommandConnectionState('Connecting')
			if (!isBackgroundReconnect) this.setConnectionVariables(false, 'Connecting')
			const socket = new net.Socket().connect({
				host: this.config.host,
				port: PORT,
			})
			this.tcpSocket = socket
			socket.setTimeout(CONNECTION_ATTEMPT_TIMEOUT_MS, () => {
				if (this.tcpSocket !== socket || socket.destroyed || socket.readyState === 'open') return
				socket.destroy(new Error('Avantis MIDI/TCP connection attempt timed out'))
			})
			// Monitor the same TCP path used for commands. This is intentionally not an
			// ICMP ping: the online variable should answer "can this connection carry
			// Avantis commands?". A short keepalive idle period also helps the OS detect
			// silently broken network paths instead of leaving the socket open forever.
			socket.setKeepAlive(true, 5000)
			socket.setNoDelay(true)

			socket.on('error', (err: { message: string }) => {
				if (this.tcpSocket !== socket) return
				this.log('warn', `TCP connection error: ${err.message}`)
				// Some socket errors are not immediately followed by close. Retire this
				// socket ourselves so it cannot suppress the bounded reconnect loop.
				this.retireCommandSocket(socket)
			})

			socket.on('connect', () => {
				if (this.tcpSocket !== socket) return
				socket.setTimeout(0)
				this.connectionSerial++
				this.commandReconnectAttempt = 0
				this.log('debug', `TCP Connected to ${this.config.host}`)
				this.updateStatus(InstanceStatus.Ok)
				this.setCommandConnectionState('Ready')
				this.setConnectionVariables(true, 'Connected')
				this.clearReconnectTimer()
				// A working command connection is a useful opportunity to restore an
				// unavailable AH-Net session without waiting for its current backoff.
				if (!this.ahNetSocket) this.initAhNet(this.ahNetReconnectTimer ? 'recovery' : 'initial')
				this.processSceneQueue()
				this.scheduleCommandHealthProbe(socket)
			})

			socket.on('close', () => {
				if (this.tcpSocket !== socket) return
				delete this.tcpSocket
				this.clearCommandSessionTimers()
				this.handleCommandConnectionUnavailable()
			})

			socket.on('data', (data: Buffer) => {
				if (this.tcpSocket !== socket) return
				this.handleCommandData(data)
			})
		} else {
			this.setCommandConnectionState('Offline')
			this.setConnectionVariables(false, 'Disconnected')
		}
	}

	clearCommandHealthMonitor(): void {
		if (this.commandHealthProbeTimer) clearTimeout(this.commandHealthProbeTimer)
		if (this.commandHealthProbeTimeout) clearTimeout(this.commandHealthProbeTimeout)
		delete this.commandHealthProbeTimer
		delete this.commandHealthProbeTimeout
		delete this.commandHealthProbeSocket
	}

	scheduleCommandHealthProbe(socket: net.Socket): void {
		this.clearCommandHealthMonitor()
		if (this.tcpSocket !== socket || socket.destroyed || !this.connectionLifecycleActive) return
		this.commandHealthProbeTimer = setTimeout(() => {
			delete this.commandHealthProbeTimer
			if (this.tcpSocket !== socket || socket.destroyed || !this.isCommandConnectionReady()) return

			this.commandHealthProbeSocket = socket
			try {
				// This is the existing documented, read-only Input 1 name request. A reply
				// proves the Avantis MIDI service is processing commands, not merely that
				// the local TCP stack still accepts writes.
				socket.write(buildInputNameRequest(this.config.midiBase ?? 1, 0))
			} catch (error) {
				this.log(
					'warn',
					`MIDI/TCP health probe write failed: ${error instanceof Error ? error.message : String(error)}`,
				)
				this.retireCommandSocket(socket)
				return
			}

			this.commandHealthProbeTimeout = setTimeout(() => {
				delete this.commandHealthProbeTimeout
				if (this.commandHealthProbeSocket !== socket || this.tcpSocket !== socket || socket.destroyed) return
				this.log('warn', 'MIDI/TCP health probe timed out; reconnecting command connection')
				this.retireCommandSocket(socket)
			}, COMMAND_HEALTH_PROBE_TIMEOUT_MS)
		}, COMMAND_HEALTH_PROBE_INTERVAL_MS)
	}

	acknowledgeCommandHealthProbe(reply: ReturnType<typeof parseChannelInfoReply>): void {
		if (!reply || reply.type !== 'name' || reply.channel !== 0 || reply.midiChannel !== (this.config.midiBase ?? 1) - 1)
			return
		const socket = this.commandHealthProbeSocket
		if (!socket || this.tcpSocket !== socket) return
		this.clearCommandHealthMonitor()
		this.scheduleCommandHealthProbe(socket)
	}

	/**
	 * Clears timers bound to one command connection. Every teardown path (close,
	 * retire, re-init) uses this so no scene step, name request or health probe
	 * from a retired connection fires on its replacement. Fades are deliberately
	 * kept: a brief outage should not leave a fader stopped halfway.
	 */
	clearCommandSessionTimers(): void {
		this.clearSceneSequenceTimer()
		this.clearInputInfoSyncTimers()
		this.clearCommandHealthMonitor()
	}

	retireCommandSocket(socket: net.Socket): void {
		if (this.tcpSocket !== socket) return
		this.clearCommandSessionTimers()
		delete this.tcpSocket
		socket.destroy()
		this.handleCommandConnectionUnavailable()
	}

	handleCommandConnectionUnavailable(): void {
		if (!this.connectionLifecycleActive) return
		this.updateStatus(InstanceStatus.Disconnected)
		this.setCommandConnectionState('Recovering')
		this.setConnectionVariables(false, 'Disconnected')
		this.triggerReconnect()
	}

	setCommandConnectionState(state: ConnectionLifecycleState): void {
		if (this.commandConnectionState === state) return
		this.commandConnectionState = state
		this.setVariableValues({ command_connection_state: state })
	}

	setSynchronizationConnectionState(state: ConnectionLifecycleState): void {
		if (this.synchronizationConnectionState === state) return
		this.synchronizationConnectionState = state
		this.setVariableValues({ synchronization_connection_state: state })
	}

	setConnectionVariables(online: boolean, status: string): void {
		const values: VariablesSchema = {}
		const onlineChanged = this.commandOnline !== online
		if (onlineChanged) {
			this.commandOnline = online
			values.online = online
		}
		if (this.commandConnectionStatus !== status) {
			this.commandConnectionStatus = status
			values.connection_status = status
		}
		if (Object.keys(values).length > 0) this.setVariableValues(values)
		if (onlineChanged) this.checkFeedbacks('online')
	}

	setIoPortInstalled(port: number, installed: boolean): void {
		if (port !== 1 && port !== 2) return
		this.ioPortInstalled[port - 1] = installed
		this.setVariableValues({ [`io_port_${port}_status`]: installed ? 'Installed' : 'Not Installed' })
	}

	setSlinkRackConnected(rack: number, connected: boolean): void {
		if (rack !== 1 && rack !== 2) return
		this.slinkRackConnected[rack - 1] = connected
		this.setVariableValues({ [`slink_rack_${rack}_status`]: connected ? 'Connected' : 'Disconnected' })
	}

	applyDiscoveredConsoleConfiguration(): void {
		if (this.config.useManualConsoleConfig === true || this.consoleDiscoverySettled) return
		const layout = this.discoveredConsoleLayout
		if (!layout) return
		const previousLayout = getConfiguredMixLayout(this.config)
		const previousInputCount = getChannelCapacities(this.config).inputCount
		const previousRackUfxInstalled = this.config.rackUfxInstalled === true
		const nextDPackEnabled = this.discoveredDPack ?? this.config.dPackEnabled === true
		const nextRackUfxInstalled = this.discoveredRackUfx ?? previousRackUfxInstalled
		const synchronizationShapeChanged =
			previousInputCount !== (nextDPackEnabled ? 96 : 64) ||
			previousRackUfxInstalled !== nextRackUfxInstalled ||
			previousLayout.monoGroups !== layout.monoGroups ||
			previousLayout.stereoGroups !== layout.stereoGroups ||
			previousLayout.monoFxSends !== layout.monoFx ||
			previousLayout.stereoFxSends !== layout.stereoFx ||
			previousLayout.monoAuxes !== layout.monoAuxes ||
			previousLayout.stereoAuxes !== layout.stereoAuxes ||
			previousLayout.monoMatrices !== layout.monoMatrices ||
			previousLayout.stereoMatrices !== layout.stereoMatrices ||
			previousLayout.mSumEnabled !== (layout.mainMode === 'LR+MSum')
		this.consoleDiscoverySettled = true
		this.config.monoGroupCount = layout.monoGroups
		this.config.stereoGroupCount = layout.stereoGroups
		this.config.monoFxSendCount = layout.monoFx
		this.config.stereoFxSendCount = layout.stereoFx
		this.config.monoAuxCount = layout.monoAuxes
		this.config.stereoAuxCount = layout.stereoAuxes
		this.config.monoMatrixCount = layout.monoMatrices
		this.config.stereoMatrixCount = layout.stereoMatrices
		this.config.mSumEnabled = layout.mainMode === 'LR+MSum'
		this.config.dPackEnabled = nextDPackEnabled
		this.config.rackUfxInstalled = nextRackUfxInstalled
		this.setVariableValues({
			dpack_upgrade_enabled: this.discoveredDPack === undefined ? 'Unknown' : this.discoveredDPack,
			rack_ultrafx_card_installed: this.discoveredRackUfx === undefined ? 'Unknown' : this.discoveredRackUfx,
			console_input_count: this.discoveredDPack ? 96 : 64,
			console_mono_group_count: layout.monoGroups,
			console_stereo_group_count: layout.stereoGroups,
			console_mono_fx_count: layout.monoFx,
			console_stereo_fx_count: layout.stereoFx,
			console_mono_aux_count: layout.monoAuxes,
			console_stereo_aux_count: layout.stereoAuxes,
			console_mono_matrix_count: layout.monoMatrices,
			console_stereo_matrix_count: layout.stereoMatrices,
			console_main_mode: layout.mainMode,
			console_stereo_pafl_count: layout.stereoPafl,
		})
		if (synchronizationShapeChanged) {
			this.log('debug', 'Discovered console topology differs from the active layout; restarting synchronization once')
			this.refreshConsoleStripInfoTargets()
			this.updateActions()
			this.updateFeedbacks()
			this.updatePresets()
			this.updateVariableDefinitions()
			setTimeout(() => this.initAhNet(), 50)
		} else {
			this.log('debug', 'Console topology confirmed without restarting synchronization')
		}
	}

	setLastSceneNumber(sceneNumber: number): void {
		if (!Number.isInteger(sceneNumber) || sceneNumber < 1 || sceneNumber > avantisConfig.config.sceneCount) return
		if (this.lastSceneNumber !== sceneNumber) {
			this.lastSceneName = this.sceneNameCache[sceneNumber] ?? 'Unknown'
			this.setVariableValues({ last_scene_name: this.lastSceneName })
		}
		this.lastSceneNumber = sceneNumber
		this.setVariableValues({ last_scene_number: sceneNumber })
		this.checkFeedbacks('last_scene')
	}

	setLastSceneName(sceneNumber: number, name: string): void {
		if (!Number.isInteger(sceneNumber) || sceneNumber < 1 || sceneNumber > avantisConfig.config.sceneCount || !name)
			return
		this.lastSceneName = name
		this.sceneNameCache[sceneNumber] = name
		this.setVariableValues({ last_scene_name: name })
		if (shouldRetrieveAllSceneNames(this.config)) {
			this.setVariableValues({ [`scene_name_${sceneNumber}`]: name })
		}
	}

	applySynchronizedSceneState(sceneNumber: number): void {
		// AH-Net reports the console's selected/current scene, which can legitimately differ from the
		// most recently recalled scene. Use it only to initialize the variables before MIDI/TCP has
		// reported a recall; subsequent recall ownership remains with Program Change events.
		if (this.lastSceneNumber <= 0) this.setLastSceneNumber(sceneNumber)
	}

	applySynchronizedSceneName(sceneNumber: number, name: string): void {
		if (!Number.isInteger(sceneNumber) || sceneNumber < 1 || sceneNumber > avantisConfig.config.sceneCount || !name)
			return
		this.sceneNameCache[sceneNumber] = name
		// The synchronized name event identifies the scene that was actually recalled. Unlike the
		// selected/current-scene snapshot, it is authoritative for last-recalled scene tracking.
		this.setLastSceneNumber(sceneNumber)
		this.setLastSceneName(sceneNumber, name)
	}

	setMuteGroupState(group: number, muted: boolean): void {
		if (!Number.isInteger(group) || group < 1 || group > MUTE_GROUP_COUNT) return
		this.muteGroupStates[group - 1] = muted
		const midiChannel = (this.config.midiBase ?? 1) - 1 + 4
		const note = 0x45 + group
		this.muteStateCache[`${midiChannel}:${note}`] = muted
		this.setVariableValues({ [`mute_group_${group}_state`]: muted ? 'Muted' : 'Unmuted' })
		this.checkFeedbacks('mute_group')
	}

	setMuteGroupsUnknown(): void {
		const values: Record<string, string> = {}
		const midiChannel = (this.config.midiBase ?? 1) - 1 + 4
		for (let group = 1; group <= MUTE_GROUP_COUNT; group++) {
			this.muteGroupStates[group - 1] = undefined
			delete this.muteStateCache[`${midiChannel}:${0x45 + group}`]
			values[`mute_group_${group}_state`] = 'Unknown'
		}
		this.setVariableValues(values)
		this.checkFeedbacks('mute_group')
	}

	setUfxBypassState(unit: number, bypassed?: boolean): void {
		if (!Number.isInteger(unit) || unit < 1 || unit > UFX_BYPASS_COUNT) return
		this.ufxBypassStates[unit - 1] = bypassed
		this.setVariableValues({
			[`ufx_${unit}_bypass_state`]: bypassed === undefined ? 'Unknown' : bypassed ? 'Bypassed' : 'Enabled',
		})
		this.checkFeedbacks('ufx_bypass', 'ufx_all_bypassed')
	}

	setUfxBypassStatesUnknown(): void {
		for (let unit = 1; unit <= UFX_BYPASS_COUNT; unit++) this.setUfxBypassState(unit, undefined)
	}

	getUfxFeedbackState(): UfxFeedbackState {
		return (this.ufxFeedbackState ??= new UfxFeedbackState())
	}

	setUfxFeedbackValue(target: UfxFeedbackTarget, value: UfxFeedbackValue): void {
		if (target === 'key' && typeof value === 'number') this.setUfxGlobalKey(value)
		else if (target === 'scale' && typeof value === 'number') this.setUfxGlobalScale(value)
		else if (target.startsWith('rack:') && typeof value === 'boolean') {
			this.setUfxBypassState(Number(target.slice(5)), value)
		} else if (target.startsWith('plugin:') && typeof value === 'boolean') {
			this.setUfxPluginBypassState(Number(target.slice(7)), value)
		}
	}

	receiveUfxFeedback(target: UfxFeedbackTarget, value: UfxFeedbackValue): void {
		if (this.getUfxFeedbackState().receive(target, value, Date.now())) this.setUfxFeedbackValue(target, value)
	}

	publishUfxWriteFeedback(target: UfxFeedbackTarget, value: UfxFeedbackValue, request: Buffer): void {
		const state = this.getUfxFeedbackState()
		const write = state.expect(target, value, Date.now())
		this.setUfxFeedbackValue(target, value)
		this.scheduleStateVerification([request])
		const timers = (this.ufxWriteFeedbackTimers ??= new Map())
		const previous = timers.get(target)
		if (previous) clearTimeout(previous)
		const socket = this.ahNetSocket
		const timer = setTimeout(() => {
			timers.delete(target)
			if (this.ahNetSocket !== socket || socket?.destroyed) return
			const result = state.finish(target, write)
			if (!result) return
			// A manual console change or rejected command must win once the grace period
			// ends. Ask again so a deferred snapshot cannot leave the display stale.
			if (result.deferred !== undefined) this.setUfxFeedbackValue(target, result.deferred)
			this.writeAhNetCommand(request, 'verify RackUltraFX state after write grace period')
		}, UFX_WRITE_FEEDBACK_GRACE_MS)
		timers.set(target, timer)
	}

	clearUfxWriteFeedback(): void {
		for (const timer of this.ufxWriteFeedbackTimers?.values() ?? []) clearTimeout(timer)
		this.ufxWriteFeedbackTimers?.clear()
		this.ufxFeedbackState?.resetSession()
	}

	setUfxPluginBypassState(unit: number, bypassed?: boolean): void {
		if (!Number.isInteger(unit) || unit < 1 || unit > UFX_PLUGIN_BYPASS_COUNT) return
		this.ufxPluginBypassStates[unit - 1] = bypassed
		this.setVariableValues({
			[`ufx_${unit}_plugin_bypass_state`]: bypassed === undefined ? 'Unknown' : bypassed ? 'Bypassed' : 'Enabled',
		})
		this.checkFeedbacks('ufx_plugin_bypass', 'ufx_all_plugins_bypassed')
	}

	setUfxPluginBypassStatesUnknown(): void {
		for (let unit = 1; unit <= UFX_PLUGIN_BYPASS_COUNT; unit++) this.setUfxPluginBypassState(unit, undefined)
	}

	clearUfxBypassSyncTimer(): void {
		if (this.ufxBypassSyncTimer) clearTimeout(this.ufxBypassSyncTimer)
		delete this.ufxBypassSyncTimer
	}

	scheduleUfxBypassSyncValidation(socket: net.Socket, initialDelay = 750): void {
		this.clearUfxBypassSyncTimer()
		this.ufxBypassSyncTimer = setTimeout(() => {
			delete this.ufxBypassSyncTimer
			if (this.ahNetSocket !== socket || socket.destroyed) return
			if (this.ufxBypassStates.some((_, index) => !this.getUfxFeedbackState().hasReceived(`rack:${index + 1}`))) {
				for (const message of buildUfxBypassSyncMessages()) socket.write(message)
			}
			if (
				this.ufxPluginBypassStates.some((_, index) => !this.getUfxFeedbackState().hasReceived(`plugin:${index + 1}`))
			) {
				for (const message of buildUfxPluginBypassSyncMessages()) socket.write(message)
			}
			this.ufxBypassSyncTimer = setTimeout(() => {
				delete this.ufxBypassSyncTimer
				if (this.ahNetSocket !== socket || socket.destroyed) return
				if (!this.ufxBypassStates.some((state) => state !== undefined)) return
				const values: Record<string, string> = {}
				for (let unit = 1; unit <= UFX_BYPASS_COUNT; unit++) {
					if (this.ufxBypassStates[unit - 1] === undefined) values[`ufx_${unit}_bypass_state`] = 'Slot Not Configured'
					if (this.ufxPluginBypassStates[unit - 1] === undefined) {
						values[`ufx_${unit}_plugin_bypass_state`] =
							this.ufxBypassStates[unit - 1] === undefined ? 'Slot Not Configured' : 'Not Reported by Console'
					}
				}
				if (Object.keys(values).length > 0) this.setVariableValues(values)
			}, 1000)
		}, initialDelay)
	}

	setConsoleStateUnknown(): void {
		this.setTalkbackActive(undefined)
		this.setMasterStripsLocked(undefined)
		this.setUsbRecorderRecording(undefined)
	}

	setTalkbackActive(active?: boolean): void {
		this.talkbackActive = active
		this.setVariableValues({ talkback_state: active === undefined ? 'Unknown' : active ? 'Active' : 'Inactive' })
		this.checkFeedbacks('talkback_active')
	}

	setMasterStripsLocked(locked?: boolean): void {
		this.masterStripsLocked = locked
		this.setVariableValues({
			master_strips_lock_state: locked === undefined ? 'Unknown' : locked ? 'Locked' : 'Unlocked',
		})
		this.checkFeedbacks('master_strips_locked')
	}

	setUsbRecorderRecording(recording?: boolean): void {
		this.usbRecorderRecording = recording
		this.setVariableValues({
			usb_recorder_state: recording === undefined ? 'Unknown' : recording ? 'Recording' : 'Stopped',
		})
		this.checkFeedbacks('usb_recorder_recording')
	}

	setUfxBypass(unit: number, bypassed: boolean): void {
		this.sendUfxBypassCommands([{ unit, bypassed }])
	}

	sendUfxBypassCommands(commands: Array<{ unit: number; bypassed: boolean }>): void {
		if (!this.isAhNetCommandAvailable()) {
			this.log('warn', 'Cannot change RackUltraFX bypass because console synchronization is not connected')
			return
		}
		let messages: Array<{ unit: number; bypassed: boolean; message: Buffer }>
		try {
			messages = commands.map((command) => ({
				...command,
				message: buildUfxBypassMessage(command.unit, command.bypassed),
			}))
		} catch (error) {
			this.log('error', error instanceof Error ? error.message : String(error))
			return
		}
		const sync = buildUfxBypassSyncMessages()
		for (const command of messages) {
			if (!this.writeAhNetCommand(command.message, 'change RackUltraFX bypass')) return
			this.publishUfxWriteFeedback(`rack:${command.unit}`, command.bypassed, sync[(command.unit - 1) * 2 + 1])
		}
	}

	setAllUfxBypass(mode: 'bypass' | 'enable' | 'toggle'): void {
		const bypassed = mode === 'bypass' || (mode === 'toggle' && !this.ufxBypassStates.every((state) => state === true))
		this.sendUfxBypassCommands(Array.from({ length: UFX_BYPASS_COUNT }, (_, index) => ({ unit: index + 1, bypassed })))
	}

	setUfxPluginBypass(unit: number, bypassed: boolean): void {
		if (!this.isAhNetCommandAvailable()) {
			this.log('warn', 'Cannot change UFX plugin bypass because console synchronization is not connected')
			return
		}
		if (!this.writeAhNetCommand(buildUfxPluginBypassMessage(unit, bypassed), 'change UFX plugin bypass')) return
		this.publishUfxWriteFeedback(`plugin:${unit}`, bypassed, buildUfxPluginBypassSyncMessages()[(unit - 1) * 2 + 1])
	}

	setAllUfxPluginBypass(mode: 'bypass' | 'enable' | 'toggle'): void {
		if (!this.isAhNetCommandAvailable()) {
			this.log('warn', 'Cannot change UFX plugin bypass because console synchronization is not connected')
			return
		}
		const bypassed =
			mode === 'bypass' || (mode === 'toggle' && !this.ufxPluginBypassStates.every((state) => state === true))
		const sync = buildUfxPluginBypassSyncMessages()
		for (let unit = 1; unit <= UFX_PLUGIN_BYPASS_COUNT; unit++) {
			if (!this.writeAhNetCommand(buildUfxPluginBypassMessage(unit, bypassed), 'change UFX plugin bypass')) return
			this.publishUfxWriteFeedback(`plugin:${unit}`, bypassed, sync[(unit - 1) * 2 + 1])
		}
	}

	setVirtualSoundcheckMode(mode?: VirtualSoundcheckMode): void {
		this.virtualSoundcheckModeValue = mode
		this.virtualSoundcheckMode = mode === undefined ? 'Unknown' : virtualSoundcheckModeName(mode)
		this.setVariableValues({ virtual_soundcheck_mode: this.virtualSoundcheckMode })
		this.checkFeedbacks('virtual_soundcheck_mode')
	}

	destroyAhNetConnection(markUnknown: boolean, preserveDiscovery = false): void {
		this.dropHeldAhNetCommands('console synchronization was restarted')
		this.clearAhNetLeaseRenewalTimer()
		this.clearStateVerificationTimers()
		this.clearSceneDirectorySync()
		this.clearUfxBypassSyncTimer()
		if (this.ahNetSocket) {
			const socket = this.ahNetSocket
			delete this.ahNetSocket
			socket.destroy()
		}
		this.ahNetReceiveBuffer = Buffer.alloc(0)
		this.ahNetSessionInitialized = false
		this.ahNetSceneStateReceived = false
		this.clearUfxWriteFeedback()
		delete this.pendingAhNetSessionStart
		if (this.ahNetSessionTimer) clearTimeout(this.ahNetSessionTimer)
		delete this.ahNetSessionTimer
		if (!preserveDiscovery) {
			delete this.ahNetConsoleFamily
			delete this.ahNetBankSwitcherFamily
			delete this.ahNetSceneManagerFamily
			delete this.ahNetPlaybackManagerFamily
			delete this.pendingAhNetManagerDiscovery
		}
		this.clearAhNetSyncTimer()
		if (!this.connectionLifecycleActive) this.setSynchronizationConnectionState('Offline')
		if (markUnknown) {
			this.setVirtualSoundcheckMode(undefined)
			this.setUfxGlobalKey(undefined)
			this.setUfxGlobalScale(undefined)
			this.setUfxBypassStatesUnknown()
			this.setUfxPluginBypassStatesUnknown()
		}
	}

	shouldMaintainAhNetConnection(): boolean {
		return (
			this.connectionLifecycleActive &&
			this.config !== undefined &&
			Boolean(this.config.host) &&
			(isAhNetStateSyncEnabled(this.config) || this.virtualSoundcheckModeValue !== undefined)
		)
	}

	retireAhNetSocket(socket: net.Socket): void {
		if (this.ahNetSocket !== socket) return
		delete this.ahNetSocket
		this.dropHeldAhNetCommands('the console synchronization connection was lost')
		this.ahNetReceiveBuffer = Buffer.alloc(0)
		this.ahNetSessionInitialized = false
		this.ahNetSceneStateReceived = false
		this.clearUfxWriteFeedback()
		delete this.pendingAhNetSessionStart
		this.clearAhNetLeaseRenewalTimer()
		this.clearStateVerificationTimers()
		// Values only AH-Net reports must not look live during an outage. Mute groups
		// and faders stay: MIDI/TCP keeps reporting them independently.
		this.setUfxGlobalKey(undefined)
		this.setUfxGlobalScale(undefined)
		this.setUfxBypassStatesUnknown()
		this.setUfxPluginBypassStatesUnknown()
		this.setConsoleStateUnknown()
		this.setUsbPlaybackUnknown()
		this.setGlobalTempoUnknown()
		if (this.ahNetSessionTimer) clearTimeout(this.ahNetSessionTimer)
		delete this.ahNetSessionTimer
		this.clearAhNetSyncTimer()
		this.clearUfxBypassSyncTimer()
		this.clearSceneDirectorySync()
		if (this.subscribedInputFaders.length > 0) this.setFaderSyncStatus('Waiting to reconnect')
		this.setSynchronizationConnectionState(this.shouldMaintainAhNetConnection() ? 'Recovering' : 'Disabled')
		socket.destroy()
		if (this.shouldMaintainAhNetConnection()) this.triggerAhNetReconnect()
	}

	sendVirtualSoundcheckMode(mode: VirtualSoundcheckMode): void {
		const previous = this.virtualSoundcheckModeValue
		if (
			!this.writeAhNetCommand(buildVirtualSoundcheckModeMessage(mode), 'set Virtual Soundcheck mode', () =>
				this.setVirtualSoundcheckMode(previous),
			)
		)
			return
		this.setVirtualSoundcheckMode(mode)
		this.scheduleStateVerification([buildVirtualSoundcheckValueRequest()])
	}

	tapGlobalTempo(): void {
		const now = Date.now()
		const previous = this.lastGlobalTempoTapAt
		this.lastGlobalTempoTapAt = now

		if (previous === undefined || now - previous > GLOBAL_TEMPO_RESET_MS) {
			this.log('debug', 'Global Tap Tempo sequence started')
			return
		}

		const periodMs = now - previous
		let message: Buffer
		try {
			message = buildGlobalTempoPeriodMessage(periodMs)
		} catch (error) {
			this.log('warn', `Global Tap Tempo ignored: ${error instanceof Error ? error.message : String(error)}`)
			return
		}

		if (!this.config.host) {
			this.log('warn', 'Global Tap Tempo failed: Console IP is missing')
			return
		}

		this.sendGlobalTempoMessage(message, globalTempoPeriodToBpm(periodMs))
	}

	setGlobalTempoBpm(value: string | number): void {
		const bpm = Number(String(value).trim())
		try {
			const tempo = buildGlobalTempoBpmMessage(bpm)
			this.sendGlobalTempoMessage(tempo.message, tempo.actualBpm)
		} catch (error) {
			this.log('error', error instanceof Error ? error.message : String(error))
		}
	}

	setGlobalTempoPeriod(periodMs: number): void {
		if (!Number.isInteger(periodMs) || periodMs <= 0) return
		this.globalTempoBpm = Number(globalTempoPeriodToBpm(periodMs).toFixed(1))
		this.setVariableValues({ global_tempo_bpm: this.globalTempoBpm })
	}

	setGlobalTempoUnknown(): void {
		delete this.globalTempoBpm
		this.setVariableValues({ global_tempo_bpm: 'Unknown' })
	}

	sendGlobalTempoMessage(message: Buffer, bpm: number): void {
		const previous = this.globalTempoBpm
		const restore = () => {
			if (previous === undefined) this.setGlobalTempoUnknown()
			else {
				this.globalTempoBpm = previous
				this.setVariableValues({ global_tempo_bpm: previous })
			}
		}
		if (!this.writeAhNetCommand(message, `set Global Tempo to ${bpm.toFixed(1)} BPM`, restore)) return
		this.globalTempoBpm = Number(bpm.toFixed(1))
		this.setVariableValues({ global_tempo_bpm: this.globalTempoBpm })
		this.scheduleStateVerification([buildGlobalTempoSyncMessages()[1]])
	}

	initAhNet(mode: AhNetStartMode = 'initial'): void {
		if (!this.connectionLifecycleActive) return
		const isLeaseRenewal = mode === 'renewal'
		this.clearAhNetReconnectTimer()
		// Renewal and recovery keep the discovered manager families (validated in RC12
		// power-loss recovery); only a first start rediscovers them.
		this.destroyAhNetConnection(false, mode !== 'initial')
		this.ahNetRenewalInProgress = isLeaseRenewal
		this.ahNetSessionMode = mode
		this.ahNetFaderChannelsByHandle.clear()
		this.ahNetConsoleFadersByHandle.clear()
		this.pendingInitialFaderSync.clear()
		this.pendingInitialConsoleFaderSync.clear()
		this.initialFaderSyncRetryCount = 0
		if (mode === 'initial') {
			this.setUfxGlobalKey(undefined)
			this.setUfxGlobalScale(undefined)
			this.setMuteGroupsUnknown()
			this.setUfxBypassStatesUnknown()
			this.setUfxPluginBypassStatesUnknown()
			this.ioPortInstalled.fill(undefined)
			this.slinkRackConnected.fill(undefined)
			delete this.slinkManagerFamily
			this.setConsoleStateUnknown()
			this.setUsbPlaybackUnknown()
			this.setFirmwareUnknown()
		} else if (mode === 'recovery') {
			// The console may have rebooted (possibly into new firmware or with changed
			// hardware), so rediscover hardware and firmware like a first start.
			this.ioPortInstalled.fill(undefined)
			this.slinkRackConnected.fill(undefined)
			delete this.slinkManagerFamily
			this.setFirmwareUnknown()
		}

		const inputCount = getChannelCapacities(this.config).inputCount
		this.subscribedInputFaders = isAhNetStateSyncEnabled(this.config)
			? Array.from({ length: inputCount }, (_, index) => index + 1)
			: []

		for (const channel of this.subscribedInputFaders) {
			const subscription = inputFaderSubscription(channel)
			this.ahNetFaderChannelsByHandle.set(subscription.handle, channel)
		}
		const syncGlobalKeyScale = isAhNetStateSyncEnabled(this.config) && this.config.rackUfxInstalled === true
		const syncState = isAhNetStateSyncEnabled(this.config)
		const consoleFaderTargets = syncState
			? buildConsoleFaderTargets(getConfiguredMixLayout(this.config), this.config.rackUfxInstalled === true)
			: []
		for (const target of consoleFaderTargets) {
			this.ahNetConsoleFadersByHandle.set(`${target.family}:${target.handle}`, target)
		}
		const stripMetadataTargets = syncState
			? buildStripMetadataTargets(
					inputCount,
					getConfiguredMixLayout(this.config),
					this.config.rackUfxInstalled === true,
				)
			: []
		this.stripMetadataTargets = buildStripMetadataTargetMap(stripMetadataTargets)
		const needsConnection = this.shouldMaintainAhNetConnection()
		if (!needsConnection || !this.config.host) {
			this.ahNetRenewalInProgress = false
			this.setSynchronizationConnectionState(this.config.host ? 'Disabled' : 'Offline')
			this.setFaderSyncStatus(this.subscribedInputFaders.length === 0 ? 'Disabled' : 'Error: Console IP is missing')
			return
		}
		// A routine renewal keeps the published state steady so triggers and feedback
		// keyed on these variables do not flicker every 24 seconds.
		if (!isLeaseRenewal) {
			this.setSynchronizationConnectionState('Connecting')
			this.setFaderSyncStatus(this.subscribedInputFaders.length > 0 ? 'Connecting' : 'Disabled')
		}
		const socket = net.createConnection({ host: this.config.host, port: AHNET_PORT })
		socket.setTimeout(CONNECTION_ATTEMPT_TIMEOUT_MS, () => {
			if (this.ahNetSocket !== socket || socket.destroyed || socket.readyState === 'open') return
			socket.destroy(new Error('Avantis console-sync connection attempt timed out'))
		})
		socket.setKeepAlive(true, 5000)
		socket.setNoDelay(true)
		this.ahNetSocket = socket
		this.ahNetReceiveBuffer = Buffer.alloc(0)

		socket.once('connect', () => {
			if (this.ahNetSocket !== socket) return
			socket.setTimeout(0)
			this.pendingAhNetSessionStart = () => {
				if (this.ahNetSocket !== socket || socket.destroyed) return
				delete this.pendingAhNetSessionStart
				this.ahNetRenewalInProgress = false
				this.flushHeldAhNetCommands(socket)
				if (!isLeaseRenewal) this.setSynchronizationConnectionState('Synchronizing')
				this.scheduleAhNetLeaseRenewal(socket)
				if (this.ahNetSessionTimer) clearTimeout(this.ahNetSessionTimer)
				delete this.ahNetSessionTimer
				if (syncState) this.requestNextAhNetManagerDiscovery(socket)
				if (!this.consoleDiscoverySettled) {
					socket.write(buildConsoleConfigManagerDiscoveryMessage())
					socket.write(buildDPackCapabilityDiscoveryMessage())
					socket.write(buildRackUfxCapabilityDiscoveryMessage())
					setTimeout(() => {
						if (this.ahNetSocket !== socket || socket.destroyed || this.consoleDiscoverySettled) return
						this.discoveredDPack ??= false
						this.discoveredRackUfx ??= false
						this.applyDiscoveredConsoleConfiguration()
					}, 1200)
				}
				if (!isLeaseRenewal) {
					for (const message of buildHardwareStatusDiscoveryMessages()) socket.write(message)
					setTimeout(() => {
						if (this.ahNetSocket !== socket || socket.destroyed) return
						for (let port = 1; port <= 2; port++) {
							if (this.ioPortInstalled[port - 1] === undefined) this.setIoPortInstalled(port, false)
						}
						for (let rack = 1; rack <= 2; rack++) {
							if (this.slinkRackConnected[rack - 1] === undefined) this.setSlinkRackConnected(rack, false)
						}
					}, 1500)
				}
				let nextInitialSyncDelay = 75
				const syncBatches = buildPriorityStateSyncBatches({
					syncState,
					syncUfx: syncGlobalKeyScale,
					syncVirtualSoundcheck: syncState || this.virtualSoundcheckModeValue !== undefined,
					managers: {
						bankSwitcher: this.ahNetBankSwitcherFamily,
						scene: this.ahNetSceneManagerFamily,
						playback: this.ahNetPlaybackManagerFamily,
					},
				})
				for (const batch of syncBatches) {
					nextInitialSyncDelay = this.scheduleAhNetMessages(
						socket,
						batch.messages,
						nextInitialSyncDelay,
						batch.interval,
					)
					if (batch.kind === 'ufx') this.scheduleUfxBypassSyncValidation(socket, nextInitialSyncDelay + 250)
				}
				if (syncState) {
					for (const delay of [250, 1000]) {
						setTimeout(() => {
							if (this.ahNetSocket !== socket || socket.destroyed || this.firmwareVersion !== undefined) return
							socket.write(buildAhNetSurfaceIdentificationRequest())
						}, delay)
						setTimeout(() => {
							if (this.ahNetSocket !== socket || socket.destroyed || !this.pendingAhNetManagerDiscovery) return
							socket.write(buildManagerIdentificationRequest(this.pendingAhNetManagerDiscovery))
						}, delay + 100)
					}
				}
				if (syncState || syncGlobalKeyScale || this.virtualSoundcheckModeValue !== undefined) {
					this.scheduleInitialStateRetries(socket, syncState, syncGlobalKeyScale)
				}

				let metadataSyncStartDelay = nextInitialSyncDelay
				if (this.subscribedInputFaders.length > 0) {
					const faderSyncStartDelay = Math.max(250, nextInitialSyncDelay + 25)
					this.pendingInitialFaderSync = new Set(this.subscribedInputFaders)
					this.pendingInitialConsoleFaderSync = new Set(consoleFaderTargets.map((target) => target.variableId))
					if (!isLeaseRenewal) this.setFaderSyncStatus('Synchronizing')
					this.subscribedInputFaders.forEach((channel, index) => {
						setTimeout(
							() => {
								if (this.ahNetSocket !== socket || socket.destroyed) return
								for (const message of buildInputFaderSubscriptionMessages(channel)) socket.write(message)
							},
							faderSyncStartDelay + index * 5,
						)
					})
					consoleFaderTargets.forEach((target, index) => {
						setTimeout(
							() => {
								if (this.ahNetSocket !== socket || socket.destroyed) return
								socket.write(buildConsoleFaderSubscriptionMessage(target))
							},
							faderSyncStartDelay + (this.subscribedInputFaders.length + index) * 5,
						)
					})
					const faderRequestEndDelay =
						faderSyncStartDelay + (this.subscribedInputFaders.length + consoleFaderTargets.length) * 5
					metadataSyncStartDelay = faderRequestEndDelay + 25
					if (!isLeaseRenewal) this.startSceneDirectorySyncAfter(faderRequestEndDelay + 250)
					this.scheduleInitialFaderSyncTimeout(socket, consoleFaderTargets)
				} else if (syncState && !isLeaseRenewal) {
					this.startSceneDirectorySyncAfter(750)
				}
				// Strip names and colours follow operational state and fader subscriptions.
				if (syncState) {
					const colorSyncStartDelay = this.scheduleAhNetMessages(
						socket,
						buildStripMetadataSyncMessages(stripMetadataTargets, 'name'),
						metadataSyncStartDelay,
						2,
					)
					this.scheduleAhNetMessages(
						socket,
						buildStripMetadataSyncMessages(stripMetadataTargets, 'color'),
						colorSyncStartDelay,
						2,
					)
				}
				if (this.subscribedInputFaders.length === 0) this.setSynchronizationConnectionState('Ready')
			}

			// Match Director's startup exactly: initialize the AH-Net control session
			// and identify the surface in the first TCP payload. Do not send any other
			// discovery or subscription traffic until the console acknowledges it.
			socket.write(Buffer.concat([buildAhNetSessionInitializationMessage(), buildAhNetSurfaceIdentificationRequest()]))
			this.ahNetSessionTimer = setTimeout(() => {
				delete this.ahNetSessionTimer
				if (this.ahNetSocket !== socket || socket.destroyed || this.ahNetSessionInitialized) return
				socket.destroy(new Error('AH-Net control session initialization timed out'))
			}, 2000)
		})
		socket.on('data', (data) => this.handleAhNetData(socket, data))
		socket.once('error', (error) => {
			if (this.ahNetSocket !== socket) return
			this.log('warn', `AH-Net synchronization error: ${error.message}`)
			this.retireAhNetSocket(socket)
		})
		socket.once('close', (hadError) => {
			if (this.ahNetSocket !== socket) return
			this.log(
				hadError ? 'warn' : 'debug',
				`AH-Net synchronization connection closed (error: ${hadError ? 'yes' : 'no'})`,
			)
			this.retireAhNetSocket(socket)
		})
	}

	scheduleAhNetLeaseRenewal(socket: net.Socket): void {
		this.clearAhNetLeaseRenewalTimer()
		this.ahNetLeaseRenewalTimer = setTimeout(() => {
			delete this.ahNetLeaseRenewalTimer
			if (
				!this.connectionLifecycleActive ||
				this.ahNetSocket !== socket ||
				socket.destroyed ||
				!this.ahNetSessionInitialized
			)
				return
			this.log('debug', 'Renewing AH-Net synchronization session')
			this.initAhNet('renewal')
		}, 24000)
	}

	clearAhNetLeaseRenewalTimer(): void {
		if (this.ahNetLeaseRenewalTimer) clearTimeout(this.ahNetLeaseRenewalTimer)
		delete this.ahNetLeaseRenewalTimer
	}

	requestAhNetManagerDiscovery(socket: net.Socket, name: AhNetManagerName): void {
		if (this.ahNetSocket !== socket || socket.destroyed) return
		this.pendingAhNetManagerDiscovery = name
		socket.write(buildManagerIdentificationRequest(name))
	}

	getNextAhNetManagerDiscovery(): AhNetManagerName | undefined {
		return nextManagerToDiscover({
			scene: this.ahNetSceneManagerFamily,
			bankSwitcher: this.ahNetBankSwitcherFamily,
			playback: this.ahNetPlaybackManagerFamily,
		})
	}

	requestNextAhNetManagerDiscovery(socket: net.Socket): void {
		const name = this.pendingAhNetManagerDiscovery ?? this.getNextAhNetManagerDiscovery()
		if (name) this.requestAhNetManagerDiscovery(socket, name)
	}

	scheduleAhNetMessages(socket: net.Socket, messages: Buffer[], startDelay: number, interval = 15): number {
		messages.forEach((message, index) => {
			setTimeout(
				() => {
					if (this.ahNetSocket !== socket || socket.destroyed) return
					socket.write(message)
				},
				startDelay + index * interval,
			)
		})
		return startDelay + messages.length * interval
	}

	scheduleInitialStateRetries(socket: net.Socket, syncState: boolean, syncGlobalKeyScale: boolean): void {
		for (const delay of [1000, 3000, 7000, 15000]) {
			setTimeout(() => {
				if (this.ahNetSocket !== socket || socket.destroyed) return

				const messages: Buffer[] = []
				if (syncState && !this.ahNetSceneStateReceived && this.ahNetSceneManagerFamily !== undefined) {
					messages.push(...buildSceneStateSyncMessages(this.ahNetSceneManagerFamily))
				}
				if (this.virtualSoundcheckModeValue === undefined) {
					messages.push(buildVirtualSoundcheckRegistrationMessage(), buildVirtualSoundcheckValueRequest())
				}
				if (syncGlobalKeyScale) {
					const state = this.getUfxFeedbackState()
					const sync = buildGlobalKeyScaleSyncMessages()
					if (!state.hasReceived('key')) messages.push(...sync.slice(0, 2))
					if (!state.hasReceived('scale')) messages.push(...sync.slice(2, 4))
				}

				if (syncState) {
					if (this.firmwareVersion === undefined) {
						if (this.ahNetConsoleFamily === undefined) messages.push(buildAhNetSurfaceIdentificationRequest())
						else messages.push(...buildFirmwareSyncMessages(this.ahNetConsoleFamily))
					}
					if (this.masterStripsLocked === undefined && this.ahNetBankSwitcherFamily !== undefined) {
						messages.push(...buildMasterStripsLockSyncMessages(this.ahNetBankSwitcherFamily))
					}
					if (
						(this.usbPlaybackState === undefined || this.usbRecorderRecording === undefined) &&
						this.ahNetPlaybackManagerFamily !== undefined
					) {
						messages.push(
							...buildUsbPlaybackSyncMessages(this.ahNetPlaybackManagerFamily),
							...buildUsbRecorderStateSyncMessages(this.ahNetPlaybackManagerFamily),
						)
					}

					const manager = this.pendingAhNetManagerDiscovery ?? this.getNextAhNetManagerDiscovery()
					if (manager) {
						this.pendingAhNetManagerDiscovery = manager
						messages.unshift(buildManagerIdentificationRequest(manager))
					}
				}

				this.scheduleAhNetMessages(socket, messages, 0, 25)
			}, delay)
		}
	}

	/** Starts the scene-name directory read on the AH-Net session, independent of the command connection. */
	startSceneDirectorySyncAfter(delay: number): void {
		if (this.ahNetSceneDirectoryStartTimer) clearTimeout(this.ahNetSceneDirectoryStartTimer)
		this.ahNetSceneDirectoryStartTimer = setTimeout(() => {
			delete this.ahNetSceneDirectoryStartTimer
			this.scheduleSceneDirectorySync()
		}, delay)
	}

	clearSceneDirectorySync(): void {
		if (this.ahNetSceneDirectoryStartTimer) clearTimeout(this.ahNetSceneDirectoryStartTimer)
		delete this.ahNetSceneDirectoryStartTimer
		if (this.sceneDirectoryTimer) clearTimeout(this.sceneDirectoryTimer)
		if (this.sceneDirectoryResponseTimer) clearTimeout(this.sceneDirectoryResponseTimer)
		delete this.sceneDirectoryTimer
		delete this.sceneDirectoryResponseTimer
		delete this.pendingSceneDirectoryIndex
		this.sceneDirectoryNextIndex = 0
		this.sceneDirectoryConsecutiveTimeouts = 0
	}

	startSceneDirectorySync(): void {
		this.clearSceneDirectorySync()
		if (!shouldRetrieveAllSceneNames(this.config)) return
		this.requestNextSceneDirectoryName()
	}

	refreshSceneNames(): void {
		if (!shouldRetrieveAllSceneNames(this.config)) {
			this.log('warn', 'Cannot refresh scene names because scene-name retrieval is disabled in module settings')
			return
		}
		if (!this.ahNetSocket || this.ahNetSocket.destroyed) {
			this.log('warn', 'Cannot refresh scene names because console synchronization is not connected')
			return
		}
		this.log('debug', `Refreshing Scene 1-${getSceneNameRetrievalLimit(this.config)} names from the console`)
		this.startSceneDirectorySync()
	}

	requestNextSceneDirectoryName(): void {
		const socket = this.ahNetSocket
		if (!socket || socket.destroyed || !shouldRetrieveAllSceneNames(this.config)) return
		const retrievalLimit = getSceneNameRetrievalLimit(this.config)
		if (this.sceneDirectoryNextIndex >= retrievalLimit) {
			this.log('debug', `Scene directory synchronization completed (${retrievalLimit} slots)`)
			return
		}

		const sceneIndex = this.sceneDirectoryNextIndex++
		this.pendingSceneDirectoryIndex = sceneIndex
		socket.write(buildSceneDirectoryNameRequest(sceneIndex))
		this.sceneDirectoryResponseTimer = setTimeout(() => {
			delete this.sceneDirectoryResponseTimer
			if (this.pendingSceneDirectoryIndex !== sceneIndex) return
			delete this.pendingSceneDirectoryIndex
			this.log('warn', `No scene-name response for Scene ${sceneIndex + 1}; continuing directory sync`)
			this.sceneDirectoryConsecutiveTimeouts++
			if (this.sceneDirectoryConsecutiveTimeouts >= 3) {
				this.log('error', 'Scene directory synchronization stopped after three consecutive response timeouts')
				return
			}
			this.sceneDirectoryTimer = setTimeout(() => this.requestNextSceneDirectoryName(), 20)
		}, 1000)
	}

	applySceneDirectoryName(name: string): void {
		const sceneIndex = this.pendingSceneDirectoryIndex
		if (sceneIndex === undefined) return
		if (this.sceneDirectoryResponseTimer) clearTimeout(this.sceneDirectoryResponseTimer)
		delete this.sceneDirectoryResponseTimer
		delete this.pendingSceneDirectoryIndex
		this.sceneDirectoryConsecutiveTimeouts = 0
		const sceneNumber = sceneIndex + 1
		this.sceneNameCache[sceneNumber] = name
		this.setVariableValues({ [`scene_name_${sceneNumber}`]: name })
		if (this.lastSceneNumber === sceneNumber) this.setLastSceneName(sceneNumber, name)
		this.sceneDirectoryTimer = setTimeout(() => {
			delete this.sceneDirectoryTimer
			this.requestNextSceneDirectoryName()
		}, 1)
	}

	setFaderSyncStatus(status: string): void {
		this.faderSyncStatus = status
		this.setVariableValues({ fader_sync_status: status })
	}

	setUsbPlaybackState(state: UsbPlaybackState, filename?: string): void {
		this.usbPlaybackState = state
		if (filename) this.usbPlaybackFilename = filename
		this.setVariableValues({
			usb_playback_state: state,
			usb_playback_filename: this.usbPlaybackFilename ?? 'Not Reported by Console',
		})
		this.checkFeedbacks('usb_playback_playing', 'usb_playback_paused', 'usb_playback_stopped')
	}

	setUsbPlaybackUnknown(): void {
		delete this.usbPlaybackState
		delete this.usbPlaybackFilename
		this.setVariableValues({ usb_playback_state: 'Unknown', usb_playback_filename: 'Unknown' })
		this.checkFeedbacks('usb_playback_playing', 'usb_playback_paused', 'usb_playback_stopped')
	}

	setFirmwareInfo(version: string, revision: string): void {
		this.firmwareVersion = version
		this.firmwareRevision = revision
		this.setVariableValues({ firmware_version: version, firmware_revision: revision })
	}

	setFirmwareUnknown(): void {
		delete this.firmwareVersion
		delete this.firmwareRevision
		this.setVariableValues({ firmware_version: 'Unknown', firmware_revision: 'Unknown' })
	}

	sendUsbPlaybackMessage(message: Buffer, description: string): void {
		if (!this.isAhNetConnectionReady()) {
			this.log('warn', `Cannot ${description}: the native USB Play/Record connection is not ready`)
			return
		}
		if (!this.writeAhNetCommand(message, description)) return
		const verification: Buffer[] = []
		if (this.ahNetPlaybackManagerFamily !== undefined) {
			verification.push(buildUsbPlaybackSyncMessages(this.ahNetPlaybackManagerFamily)[1])
			verification.push(
				...buildUsbRecorderStateSyncMessages(this.ahNetPlaybackManagerFamily).filter((_, i) => i % 2 === 1),
			)
		}
		this.scheduleStateVerification(verification)
	}

	toggleUsbPlayback(): void {
		const family = this.ahNetPlaybackManagerFamily
		if (family === undefined) {
			this.log('warn', 'Cannot toggle USB playback because the Playback Manager has not been discovered')
			return
		}
		if (this.usbPlaybackState === 'Playing') {
			this.sendUsbPlaybackMessage(buildUsbPlaybackTransportMessage('pause', family), 'pause USB playback')
		} else if (this.usbPlaybackState === 'Paused') {
			this.sendUsbPlaybackMessage(buildUsbPlaybackTransportMessage('resume', family), 'resume USB playback')
		} else if (this.usbPlaybackState === 'Stopped' && this.usbPlaybackFilename) {
			this.sendUsbPlaybackMessage(buildUsbPlaybackStartMessage(this.usbPlaybackFilename, family), 'start USB playback')
		} else {
			this.log('warn', 'Cannot start USB playback because no selected recording filename is synchronized')
		}
	}

	stopUsbPlayback(): void {
		const family = this.ahNetPlaybackManagerFamily
		if (family === undefined) {
			this.log('warn', 'Cannot stop USB playback because the Playback Manager has not been discovered')
			return
		}
		this.sendUsbPlaybackMessage(buildUsbPlaybackTransportMessage('stop', family), 'stop USB playback')
	}

	scheduleInitialFaderSyncTimeout(socket: net.Socket, consoleFaderTargets: ConsoleFaderTarget[]): void {
		this.clearAhNetSyncTimer()
		const requestCount = this.pendingInitialFaderSync.size + this.pendingInitialConsoleFaderSync.size
		this.ahNetSyncTimer = setTimeout(
			() => {
				delete this.ahNetSyncTimer
				if (this.ahNetSocket !== socket || socket.destroyed) return
				this.handleInitialFaderSyncTimeout(socket, consoleFaderTargets)
			},
			Math.max(5000, 1500 + requestCount * 30),
		)
	}

	handleInitialFaderSyncTimeout(socket: net.Socket, consoleFaderTargets: ConsoleFaderTarget[]): void {
		const missingCount = this.pendingInitialFaderSync.size + this.pendingInitialConsoleFaderSync.size
		if (missingCount === 0) {
			this.finishInitialFaderSyncIfComplete()
			return
		}

		if (this.initialFaderSyncRetryCount < 8) {
			this.initialFaderSyncRetryCount++
			const totalCount = this.subscribedInputFaders.length + consoleFaderTargets.length
			const syncedCount = totalCount - missingCount
			if (this.ahNetSessionMode !== 'renewal')
				this.setFaderSyncStatus(
					`Synchronizing (${syncedCount}/${totalCount}, retry ${this.initialFaderSyncRetryCount}/8)`,
				)
			let requestIndex = 0
			for (const channel of this.pendingInitialFaderSync) {
				setTimeout(() => {
					if (this.ahNetSocket !== socket || socket.destroyed) return
					for (const message of buildInputFaderSubscriptionMessages(channel)) socket.write(message)
				}, requestIndex++ * 30)
			}
			for (const target of consoleFaderTargets) {
				if (!this.pendingInitialConsoleFaderSync.has(target.variableId)) continue
				setTimeout(() => {
					if (this.ahNetSocket !== socket || socket.destroyed) return
					socket.write(buildConsoleFaderSubscriptionMessage(target))
				}, requestIndex++ * 30)
			}
			this.scheduleInitialFaderSyncTimeout(socket, consoleFaderTargets)
			return
		}

		const totalCount = this.subscribedInputFaders.length + consoleFaderTargets.length
		const syncedCount = totalCount - missingCount
		this.setFaderSyncStatus(
			syncedCount === 0
				? 'Recovering: awaiting fader values'
				: `Recovering: ${syncedCount}/${totalCount} faders synced`,
		)
		this.setSynchronizationConnectionState('Degraded')
		const missingInputs = [...this.pendingInitialFaderSync].map((channel) => `Input ${channel}`)
		const targetsByVariable = new Map(consoleFaderTargets.map((target) => [target.variableId, target.label]))
		const missingConsoleFaders = [...this.pendingInitialConsoleFaderSync].map(
			(variableId) => targetsByVariable.get(variableId) ?? variableId,
		)
		this.log(
			'warn',
			`Console fader synchronization unavailable for: ${[...missingInputs, ...missingConsoleFaders].join(', ')}`,
		)
		this.initialFaderSyncRetryCount = 0
		this.ahNetSyncTimer = setTimeout(() => {
			delete this.ahNetSyncTimer
			if (this.ahNetSocket !== socket || socket.destroyed) return
			this.handleInitialFaderSyncTimeout(socket, consoleFaderTargets)
		}, 15000)
	}

	scheduleSceneDirectorySync(): void {
		if (
			!shouldRetrieveAllSceneNames(this.config) ||
			this.sceneDirectoryTimer ||
			this.pendingSceneDirectoryIndex !== undefined
		)
			return
		this.sceneDirectoryTimer = setTimeout(() => {
			delete this.sceneDirectoryTimer
			this.startSceneDirectorySync()
		}, 50)
	}

	applyAhNetInputFaderUpdate(update: { channel: number; db: number; midiLevel: number }): void {
		const channelIndex = update.channel - 1
		const midiBase = (this.config.midiBase ?? 1) - 1
		this.faderLevelCache[`${midiBase}:${channelIndex}`] = update.midiLevel
		const display = update.db <= -60 ? '-inf dB' : `${Number(update.db.toFixed(1))} dB`
		this.setVariableValues({ [`fader_input_${update.channel}`]: display })
		this.pendingInitialFaderSync.delete(update.channel)
		this.finishInitialFaderSyncIfComplete()
	}

	applyAhNetConsoleFaderUpdate(update: ConsoleFaderTarget & { db: number; midiLevel: number }): void {
		const midiBase = (this.config.midiBase ?? 1) - 1
		this.faderLevelCache[`${midiBase + update.midiOffset}:${update.midiChannel}`] = update.midiLevel
		const display = update.db <= -60 ? '-inf dB' : `${Number(update.db.toFixed(1))} dB`
		this.setVariableValues({ [update.variableId]: display })
		this.pendingInitialConsoleFaderSync.delete(update.variableId)
		this.finishInitialFaderSyncIfComplete()
	}

	finishInitialFaderSyncIfComplete(): void {
		if (
			this.subscribedInputFaders.length > 0 &&
			this.pendingInitialFaderSync.size === 0 &&
			this.pendingInitialConsoleFaderSync.size === 0
		) {
			this.clearAhNetSyncTimer()
			this.setFaderSyncStatus('Synced')
			this.setSynchronizationConnectionState('Ready')
		}
	}

	clearAhNetReconnectTimer(): void {
		if (this.ahNetReconnectTimer) {
			clearTimeout(this.ahNetReconnectTimer)
			delete this.ahNetReconnectTimer
		}
	}

	clearAhNetSyncTimer(): void {
		if (this.ahNetSyncTimer) {
			clearTimeout(this.ahNetSyncTimer)
			delete this.ahNetSyncTimer
		}
	}

	triggerAhNetReconnect(): void {
		if (!this.shouldMaintainAhNetConnection() || this.ahNetReconnectTimer) return
		this.setSynchronizationConnectionState('Recovering')
		const delay = getAhNetReconnectDelay(this.ahNetReconnectAttempt)
		this.ahNetReconnectAttempt++
		this.ahNetReconnectTimer = setTimeout(() => {
			delete this.ahNetReconnectTimer
			this.log('debug', `Attempting to reconnect AH-Net synchronization after ${delay / 1000}s backoff...`)
			this.initAhNet('recovery')
		}, delay)
	}

	processAhNetData(data: Buffer): void {
		if (this.ahNetReceiveBuffer.length + data.length > MAX_AHNET_INCOMPLETE_FRAME_BYTES) {
			this.log('warn', 'AH-Net receive buffer exceeded the incomplete-frame limit; reconnecting synchronization')
			const socket = this.ahNetSocket
			if (socket) this.retireAhNetSocket(socket)
			else this.ahNetReceiveBuffer = Buffer.alloc(0)
			return
		}
		this.ahNetReceiveBuffer = Buffer.concat([this.ahNetReceiveBuffer, data])

		while (this.ahNetReceiveBuffer.length > 0) {
			const sessionStart = this.ahNetReceiveBuffer.indexOf(0xe0)
			const objectStart = this.ahNetReceiveBuffer.indexOf(0xf0)
			const start =
				sessionStart < 0 ? objectStart : objectStart < 0 ? sessionStart : Math.min(sessionStart, objectStart)
			if (start < 0) {
				this.ahNetReceiveBuffer = Buffer.alloc(0)
				return
			}
			if (start > 0) this.ahNetReceiveBuffer = this.ahNetReceiveBuffer.subarray(start)

			if (this.ahNetReceiveBuffer[0] === 0xe0) {
				if (this.ahNetReceiveBuffer.length < 8) return
				const sessionFrame = this.ahNetReceiveBuffer.subarray(0, 8)
				this.ahNetReceiveBuffer = this.ahNetReceiveBuffer.subarray(8)
				if (parseAhNetSessionInitializationResponse(sessionFrame)) {
					this.ahNetSessionInitialized = true
					this.ahNetReconnectAttempt = 0
					this.log('debug', 'AH-Net control session initialized')
					this.pendingAhNetSessionStart?.()
				}
				continue
			}

			const end = this.ahNetReceiveBuffer.indexOf(0xf7, 1)
			if (end < 0) return

			const frame = this.ahNetReceiveBuffer.subarray(0, end + 1)
			this.ahNetReceiveBuffer = this.ahNetReceiveBuffer.subarray(end + 1)

			const configFamily = parseConsoleConfigManagerDiscoveryFrame(frame)
			if (configFamily !== undefined) {
				this.consoleConfigFamily = configFamily
				const socket = this.ahNetSocket
				if (socket && !socket.destroyed)
					for (const message of buildConsoleMixConfigSyncMessages(configFamily)) socket.write(message)
			}
			if (parseNamedManagerDiscoveryFrame(frame, DPACK_DISCOVERY_HANDLE) !== undefined) this.discoveredDPack = true
			if (parseNamedManagerDiscoveryFrame(frame, RACK_UFX_DISCOVERY_HANDLE) !== undefined) this.discoveredRackUfx = true
			if (this.consoleConfigFamily !== undefined) {
				const layout = parseConsoleMixConfigurationFrame(frame, this.consoleConfigFamily)
				if (layout) {
					this.discoveredConsoleLayout = layout
					setTimeout(() => this.applyDiscoveredConsoleConfiguration(), 700)
				}
			}
			const ioPort = parseIoPortDiscovery(frame)
			if (ioPort !== undefined) this.setIoPortInstalled(ioPort, true)
			const slinkFamily = parseSlinkManagerDiscovery(frame)
			if (slinkFamily !== undefined) {
				this.slinkManagerFamily = slinkFamily
				const socket = this.ahNetSocket
				if (socket && !socket.destroyed)
					for (const message of buildSlinkStatusSyncMessages(slinkFamily)) socket.write(message)
			}
			const slinkStatus = parseSlinkStatusFrame(frame, this.slinkManagerFamily)
			if (slinkStatus) this.setSlinkRackConnected(slinkStatus.rack, slinkStatus.connected)
			const mode = parseVirtualSoundcheckModeFrame(frame)
			if (mode !== undefined) this.setVirtualSoundcheckMode(mode)

			const globalKeyScale = parseGlobalKeyScaleFrame(frame)
			if (globalKeyScale) this.receiveUfxFeedback(globalKeyScale.kind, globalKeyScale.value)

			const globalTempoPeriod = parseGlobalTempoFrame(frame)
			if (globalTempoPeriod !== undefined) {
				this.setGlobalTempoPeriod(globalTempoPeriod)
			}

			const sceneNumber = this.ahNetSceneManagerFamily
				? parseSceneStateFrame(frame, this.ahNetSceneManagerFamily)
				: undefined
			if (sceneNumber !== undefined) {
				this.ahNetSceneStateReceived = true
				this.applySynchronizedSceneState(sceneNumber)
			}
			const sceneName = this.ahNetSceneManagerFamily
				? parseSceneNameFrame(frame, this.ahNetSceneManagerFamily)
				: undefined
			if (sceneName !== undefined) {
				this.applySynchronizedSceneName(sceneName.sceneNumber, sceneName.name)
			}
			const directorySceneName = parseSceneDirectoryNameFrame(frame)
			if (directorySceneName !== undefined) this.applySceneDirectoryName(directorySceneName)

			const stripMetadata = parseStripMetadataUpdate(frame, this.stripMetadataTargets)
			if (stripMetadata?.kind === 'name') {
				this.setVariableValues({ [stripMetadataVariableId(stripMetadata.target, 'name')]: stripMetadata.name })
			} else if (stripMetadata?.kind === 'color') {
				this.setVariableValues({
					[stripMetadataVariableId(stripMetadata.target, 'color')]:
						CHANNEL_COLOR_LABELS[stripMetadata.color] ?? 'Unknown',
				})
			}

			const muteGroup = parseMuteGroupFrame(frame)
			if (muteGroup !== undefined) this.setMuteGroupState(muteGroup.group, muteGroup.muted)

			const ufxBypass = parseUfxBypassFrame(frame)
			if (ufxBypass !== undefined) this.receiveUfxFeedback(`rack:${ufxBypass.unit}`, ufxBypass.bypassed)
			const pluginBypass = parseUfxPluginBypassFrame(frame)
			if (pluginBypass?.kind === 'ufx-plugin')
				this.receiveUfxFeedback(`plugin:${pluginBypass.unit}`, pluginBypass.bypassed)

			const consoleState = parseConsoleStateFrame(frame, this.ahNetBankSwitcherFamily, this.ahNetPlaybackManagerFamily)
			if (consoleState?.kind === 'talkback') this.setTalkbackActive(consoleState.active)
			if (consoleState?.kind === 'master-strips-lock') this.setMasterStripsLocked(consoleState.locked)
			if (consoleState?.kind === 'usb-recorder') this.setUsbRecorderRecording(consoleState.recording)

			const usbPlayback = parseUsbPlaybackFrame(frame, this.ahNetPlaybackManagerFamily)
			if (usbPlayback) this.setUsbPlaybackState(usbPlayback.state, usbPlayback.filename)

			const identifiedFamily = parseSurfaceIdentificationFrame(frame)
			if (identifiedFamily !== undefined) {
				const familyChanged = identifiedFamily !== this.ahNetConsoleFamily
				this.ahNetConsoleFamily = identifiedFamily
				if (familyChanged) this.log('debug', `Discovered AH-Net console family 0x${identifiedFamily.toString(16)}`)
				const socket = this.ahNetSocket
				if (this.firmwareVersion === undefined && socket && !socket.destroyed) {
					for (const message of buildFirmwareSyncMessages(identifiedFamily)) socket.write(message)
				}
			}

			const pendingManager = this.pendingAhNetManagerDiscovery
			const managerFamily = pendingManager ? parseManagerIdentificationFrame(frame, pendingManager) : undefined
			if (managerFamily !== undefined && pendingManager) {
				const managerName = pendingManager
				delete this.pendingAhNetManagerDiscovery
				const socket = this.ahNetSocket
				if (managerName === 'Bank Switcher Manager') {
					this.ahNetBankSwitcherFamily = managerFamily
					this.log('debug', `Discovered Bank Switcher Manager family 0x${managerFamily.toString(16)}`)
					if (socket && !socket.destroyed) {
						for (const message of buildMasterStripsLockSyncMessages(managerFamily)) socket.write(message)
					}
				} else if (managerName === 'Scene Manager Intermediate') {
					this.ahNetSceneManagerFamily = managerFamily
					this.log('debug', `Discovered Surface Scene Manager family 0x${managerFamily.toString(16)}`)
					if (socket && !socket.destroyed) {
						for (const message of buildSceneStateSyncMessages(managerFamily)) socket.write(message)
					}
				} else {
					this.ahNetPlaybackManagerFamily = managerFamily
					this.log('debug', `Discovered Playback Manager family 0x${managerFamily.toString(16)}`)
					if (socket && !socket.destroyed) {
						for (const message of [
							...buildUsbPlaybackSyncMessages(managerFamily),
							...buildUsbRecorderStateSyncMessages(managerFamily),
						])
							socket.write(message)
					}
				}
				if (socket && !socket.destroyed) this.requestNextAhNetManagerDiscovery(socket)
			}

			const firmware = parseFirmwareFrame(frame, this.ahNetConsoleFamily)
			if (firmware) this.setFirmwareInfo(firmware.version, firmware.revision)

			const faderUpdate = parseInputFaderUpdate(frame, this.ahNetFaderChannelsByHandle)
			if (faderUpdate !== undefined) this.applyAhNetInputFaderUpdate(faderUpdate)

			const consoleFaderUpdate = parseConsoleFaderUpdate(frame, this.ahNetConsoleFadersByHandle)
			if (consoleFaderUpdate !== undefined) this.applyAhNetConsoleFaderUpdate(consoleFaderUpdate)
		}
	}

	clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			delete this.reconnectTimer
		}
	}

	triggerReconnect(): void {
		if (!this.connectionLifecycleActive || this.isCommandConnectionReady() || this.reconnectTimer) return
		const delay = getCommandReconnectDelay(this.commandReconnectAttempt)
		this.commandReconnectAttempt++
		this.reconnectTimer = setTimeout(() => {
			delete this.reconnectTimer
			if (!this.connectionLifecycleActive || this.isCommandConnectionReady()) return
			this.log('debug', `Attempting to reconnect to Avantis mixer after ${delay / 1000}s backoff...`)
			this.initTcp(true)
		}, delay)
	}

	/** Processes command-socket data without letting a parser fault crash the module. */
	handleCommandData(data: Buffer): void {
		try {
			this.validateResponseData(data)
		} catch (error) {
			this.log('error', `Discarded unreadable MIDI/TCP data: ${error instanceof Error ? error.message : String(error)}`)
			this.midiSysexBuffer = Buffer.alloc(0)
			this.midiReceiveBuffer = Buffer.alloc(0)
			this.incomingRunningStatus = 0
			this.nrpnMSB = {}
			this.nrpnLSB = {}
		}
	}

	/** Processes AH-Net data; a parser fault restarts synchronization instead of crashing the module. */
	handleAhNetData(socket: net.Socket, data: Buffer): void {
		if (this.ahNetSocket !== socket) return
		try {
			this.processAhNetData(data)
		} catch (error) {
			this.log(
				'error',
				`Discarded unreadable AH-Net data; reconnecting synchronization: ${error instanceof Error ? error.message : String(error)}`,
			)
			if (this.ahNetSocket === socket) this.retireAhNetSocket(socket)
		}
	}

	validateResponseData(data: Buffer): void {
		this.processIncomingSysex(data)
		this.processIncomingMidi(data)

		const values = data.toJSON().data
		if (!values) {
			return
		}

		this.log('debug', `Response DATA: ${JSON.stringify(values)}`)
	}

	processIncomingSysex(data: Buffer): void {
		let combined = Buffer.concat([this.midiSysexBuffer, data])
		this.midiSysexBuffer = Buffer.alloc(0)

		while (combined.length > 0) {
			const start = combined.indexOf(0xf0)
			if (start < 0) return
			const end = combined.indexOf(0xf7, start + 1)
			if (end < 0) {
				this.midiSysexBuffer = combined.subarray(start)
				if (this.midiSysexBuffer.length > 4096) this.midiSysexBuffer = Buffer.alloc(0)
				return
			}

			const frame = combined.subarray(start, end + 1)
			const reply = parseChannelInfoReply(frame)
			this.acknowledgeCommandHealthProbe(reply)
			const baseMidiChannel = (this.config.midiBase ?? 1) - 1
			if (reply?.midiChannel === baseMidiChannel && reply.channel <= 95 && reply.type === 'name') {
				this.inputNameCache[reply.channel] = reply.name
				this.setVariableValues({ [`input_name_${reply.channel + 1}`]: reply.name })
			} else if (reply?.midiChannel === baseMidiChannel && reply.channel <= 95 && reply.type === 'color') {
				this.inputColorCache[reply.channel] = reply.color
				this.setVariableValues({
					[`input_color_${reply.channel + 1}`]: CHANNEL_COLOR_LABELS[reply.color] ?? 'Unknown',
				})
			} else if (reply !== undefined) {
				const target = this.consoleStripInfoTargets.get(`${reply.midiChannel}:${reply.channel}`)
				if (target && reply.type === 'name') {
					this.consoleStripNameCache[target.nameVariableId] = reply.name
					this.setVariableValues({ [target.nameVariableId]: reply.name })
				} else if (target && reply.type === 'color') {
					this.consoleStripColorCache[target.colorVariableId] = reply.color
					this.setVariableValues({ [target.colorVariableId]: CHANNEL_COLOR_LABELS[reply.color] ?? 'Unknown' })
				}
			}
			combined = combined.subarray(end + 1)
		}
	}

	processIncomingMidi(data: Buffer): void {
		data = Buffer.concat([this.midiReceiveBuffer, data])
		this.midiReceiveBuffer = Buffer.alloc(0)
		let changedMutes = false
		const changedFeedbacks = new Set<keyof FeedbacksSchema>()
		let runningStatus = this.incomingRunningStatus

		let i = 0
		while (i < data.length) {
			const messageStart = i
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
							if (relCh === 4 && note >= 0x46 && note <= 0x4d) this.setMuteGroupState(note - 0x45, isMuted)
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
								if (this.config.rackUfxInstalled === true) {
									changedFeedbacks.add('mute_ufx_send')
									changedFeedbacks.add('mute_ufx_return')
								}
							}
						}
					}
				} else {
					this.midiReceiveBuffer = Buffer.from(data.subarray(messageStart))
					break
				}
			} else if (msgType === 0x80) {
				// Note Off (3 bytes total: status, note, velocity) - ignore for mute state
				if (i + 1 < data.length) {
					i += 2
				} else {
					this.midiReceiveBuffer = Buffer.from(data.subarray(messageStart))
					break
				}
			} else if (msgType === 0xb0) {
				// Control Change (3 bytes total: status, controller, value)
				if (i + 1 < data.length) {
					const controller = data[i]
					const val = data[i + 1]
					i += 2
					const midiBase = (this.config.midiBase ?? 1) - 1
					const ufxUpdate =
						this.config.rackUfxInstalled === true && midiCh === midiBase
							? parseUfxGlobalControlChange(controller, val)
							: undefined

					if (ufxUpdate?.type === 'key') {
						this.receiveUfxFeedback('key', ufxUpdate.value)
					} else if (ufxUpdate?.type === 'scale') {
						this.receiveUfxFeedback('scale', ufxUpdate.value)
					}

					if (controller === 0x63) {
						// NRPN MSB
						this.nrpnMSB[midiCh] = val
					} else if (controller === 0x00) {
						this.sceneBankByMidiChannel[midiCh] = val
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
					this.midiReceiveBuffer = Buffer.from(data.subarray(messageStart))
					break
				}
			} else if (msgType === 0xa0 || msgType === 0xe0) {
				if (i + 1 < data.length) {
					i += 2
				} else {
					this.midiReceiveBuffer = Buffer.from(data.subarray(messageStart))
					break
				}
			} else if (msgType === 0xc0) {
				if (i < data.length) {
					const program = data[i]
					i += 1
					const midiBase = (this.config.midiBase ?? 1) - 1
					if (midiCh === midiBase) {
						const bank = this.sceneBankByMidiChannel[midiCh] ?? 0
						const sceneNumber = bank * 128 + program + 1
						if (sceneNumber >= 1 && sceneNumber <= avantisConfig.config.sceneCount) {
							this.setLastSceneNumber(sceneNumber)
						}
					}
				} else {
					this.midiReceiveBuffer = Buffer.from(data.subarray(messageStart))
					break
				}
			} else if (msgType === 0xd0) {
				if (i < data.length) i += 1
				else {
					this.midiReceiveBuffer = Buffer.from(data.subarray(messageStart))
					break
				}
			} else if (status === 0xf0) {
				// Sysex
				while (i < data.length && data[i] !== 0xf7) {
					i++
				}
				if (i < data.length) {
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

		this.incomingRunningStatus = runningStatus

		if (changedMutes && changedFeedbacks.size > 0) {
			const arr = Array.from(changedFeedbacks)
			const first = arr[0]
			if (first) {
				this.checkFeedbacks(first, ...arr.slice(1))
			}
		}
	}

	updateFaderLevelVariable(midiOffset: number, channel: number, level: number): void {
		const midiBase = (this.config.midiBase ?? 1) - 1
		const variableId = faderVariableId(midiOffset - midiBase, channel)
		if (!variableId) return
		const dbStr = faderLevelToDbMap[level] ?? '-inf'
		this.setVariableValues({ [variableId]: `${dbStr} dB` })
	}

	action(action: ActionExecution): void {
		const opt = action.options
		let bufferCommands: Buffer[] = []
		const midiBase = (this.config.midiBase ?? 1) - 1
		const usesAhNet = ['virtual_soundcheck_mode', 'ufx_global_key', 'ufx_global_scale'].includes(action.action)
		if (!usesAhNet && !this.isCommandConnectionReady()) {
			this.log('warn', `Cannot run '${action.action}': the Avantis MIDI/TCP command connection is not ready`)
			return
		}

		switch (action.action) {
			case 'mute_input':
				this.handleMuteAction(opt as { channel: number; mute: string | boolean }, midiBase)
				break
			case 'fader_input':
				bufferCommands = this.handleFaderAction(
					opt as { level: string; channel: number; fadeDuration?: string | number },
					midiBase,
				)
				break
			case 'relative_fader_input':
				this.handleRelativeFaderAction(
					opt as { channel: number; direction: string; amountDb: number; fadeDuration?: string | number },
					midiBase,
				)
				break
			case 'mute_mono_group':
			case 'mute_stereo_group':
				this.handleMuteAction(opt as { channel: number; mute: string | boolean }, midiBase + 1)
				break
			case 'fader_mono_group':
			case 'fader_stereo_group':
				bufferCommands = this.handleFaderAction(
					opt as { level: string; channel: number; fadeDuration?: string | number },
					midiBase + 1,
				)
				break
			case 'relative_fader_mono_group':
			case 'relative_fader_stereo_group':
				this.handleRelativeFaderAction(
					opt as { channel: number; direction: string; amountDb: number; fadeDuration?: string | number },
					midiBase + 1,
				)
				break
			case 'mute_mono_aux':
			case 'mute_stereo_aux':
				this.handleMuteAction(opt as { channel: number; mute: string | boolean }, midiBase + 2)
				break
			case 'fader_mono_aux':
			case 'fader_stereo_aux':
				bufferCommands = this.handleFaderAction(
					opt as { level: string; channel: number; fadeDuration?: string | number },
					midiBase + 2,
				)
				break
			case 'relative_fader_mono_aux':
			case 'relative_fader_stereo_aux':
				this.handleRelativeFaderAction(
					opt as { channel: number; direction: string; amountDb: number; fadeDuration?: string | number },
					midiBase + 2,
				)
				break
			case 'mute_mono_matrix':
			case 'mute_stereo_matrix':
				this.handleMuteAction(opt as { channel: number; mute: string | boolean }, midiBase + 3)
				break
			case 'fader_mono_matrix':
			case 'fader_stereo_matrix':
				bufferCommands = this.handleFaderAction(
					opt as { level: string; channel: number; fadeDuration?: string | number },
					midiBase + 3,
				)
				break
			case 'relative_fader_mono_matrix':
			case 'relative_fader_stereo_matrix':
				this.handleRelativeFaderAction(
					opt as { channel: number; direction: string; amountDb: number; fadeDuration?: string | number },
					midiBase + 3,
				)
				break
			case 'mute_mono_fx_send':
			case 'mute_stereo_fx_send':
			case 'mute_fx_return':
			case 'mute_dca':
			case 'mute_master':
			case 'mute_group':
			case 'mute_ufx_send':
			case 'mute_ufx_return':
				this.handleMuteAction(opt as { channel: number; mute: string | boolean }, midiBase + 4)
				break
			case 'fader_DCA':
			case 'fader_mono_fx_send':
			case 'fader_stereo_fx_send':
			case 'fader_fx_return':
			case 'fader_master':
			case 'fader_ufx_send':
			case 'fader_ufx_return':
				bufferCommands = this.handleFaderAction(
					opt as { level: string; channel: number; fadeDuration?: string | number },
					midiBase + 4,
				)
				break
			case 'relative_fader_DCA':
			case 'relative_fader_mono_fx_send':
			case 'relative_fader_stereo_fx_send':
			case 'relative_fader_fx_return':
			case 'relative_fader_master':
			case 'relative_fader_ufx_send':
			case 'relative_fader_ufx_return':
				this.handleRelativeFaderAction(
					opt as { channel: number; direction: string; amountDb: number; fadeDuration?: string | number },
					midiBase + 4,
				)
				break
			case 'dca_assign':
				bufferCommands = this.buildAssignCommands(
					opt as { dcaGroup?: number[]; muteGroup?: number[]; assign: boolean; channel: number },
					midiBase,
					true,
				)
				break
			case 'mute_group_assign':
				bufferCommands = this.buildAssignCommands(
					opt as { dcaGroup?: number[]; muteGroup?: number[]; assign: boolean; channel: number },
					midiBase,
					false,
				)
				break
			case 'scene_recall':
				{
					const savedValue = (opt as { sceneNumber: unknown }).sceneNumber
					const zeroBasedScene =
						typeof savedValue === 'object' && savedValue !== null && 'value' in savedValue
							? savedValue.value
							: savedValue
					this.recallSceneNumber(Number(zeroBasedScene) + 1)
				}
				break
			case 'virtual_soundcheck_mode':
				this.sendVirtualSoundcheckMode(Number(opt.mode) as VirtualSoundcheckMode)
				break
			case 'ufx_global_key':
				if (this.writeAhNetCommand(buildGlobalKeySetterMessage(Number(opt.key)), 'set RackUltraFX Global Key')) {
					this.publishUfxWriteFeedback('key', Number(opt.key), buildGlobalKeyScaleSyncMessages()[1])
				}
				break
			case 'ufx_global_scale':
				if (this.writeAhNetCommand(buildGlobalScaleSetterMessage(Number(opt.scale)), 'set RackUltraFX Global Scale')) {
					this.publishUfxWriteFeedback('scale', Number(opt.scale), buildGlobalKeyScaleSyncMessages()[3])
				}
				break
			case 'ufx_unit_parameter':
				bufferCommands = [
					buildControlChangeMessage(Number(opt.midiChannel), Number(opt.controlNumber), Number(opt.controlValue)),
				]
				break
			case 'channel_main_assign':
				bufferCommands = this.buildChannelAssignCommand(opt as { channel: number; assign: boolean }, midiBase)
				break
			case 'channel_name':
				bufferCommands = this.buildChannelNameCommand(opt as { channel: string; channelName: string }, midiBase)
				break
			case 'strip_name':
				bufferCommands = this.buildStripNameCommand(opt as { target: string; name: string }, midiBase)
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
			case 'send_input_to_mono_fx_return':
			case 'send_input_to_stereo_fx_return':
				bufferCommands = this.buildSendLevelCommand(
					opt as { srcChannel: string | number; destChannel: number; level: string },
					midiBase,
					0,
					4,
				)
				break
			case 'send_input_to_fx_return':
				this.log('warn', 'This legacy action is unsupported: Avantis inputs can send to FX Sends, not FX Returns.')
				break
			case 'send_input_to':
				this.log('warn', 'This legacy action is unsupported: use Input: Assign to Main Mix and the input fader.')
				break
		}

		for (let i = 0; i < bufferCommands.length; i++) {
			this.log(
				'debug',
				`sending '${bufferCommands[i].toString('hex')}' ${i + 1}/${bufferCommands.length} via TCP @${this.config.host}`,
			)
			this.writeCommand(bufferCommands[i], action.action)
		}
	}

	setUfxGlobalKey(value?: number): void {
		if (value !== undefined && (!Number.isInteger(value) || value < 0 || value >= UFX_GLOBAL_KEY_CHOICES.length)) return
		this.ufxGlobalKey = value
		this.setVariableValues({
			ufx_global_key: value === undefined ? 'Unknown' : (UFX_GLOBAL_KEY_CHOICES[value]?.label ?? 'Unknown'),
		})
		this.checkFeedbacks('ufx_global_key')
	}

	setUfxGlobalScale(value?: number): void {
		if (value !== undefined && (!Number.isInteger(value) || value < 0 || value >= UFX_GLOBAL_SCALE_CHOICES.length))
			return
		this.ufxGlobalScale = value
		this.setVariableValues({
			ufx_global_scale: value === undefined ? 'Unknown' : (UFX_GLOBAL_SCALE_CHOICES[value]?.label ?? 'Unknown'),
		})
		this.checkFeedbacks('ufx_global_scale')
	}

	buildMuteCommand(opt: { channel: number; mute: string | boolean }, midiOffset: number): Buffer[] {
		const channel = Number(opt.channel)
		const key = `${midiOffset}:${channel}`
		const muteState =
			opt.mute === 'toggle'
				? !this.muteStateCache[key]
				: opt.mute === true || opt.mute === 'true' || opt.mute === 'mute'

		return [Buffer.from([0x90 + midiOffset, channel, muteState ? 0x7f : 0x3f, 0x90 + midiOffset, channel, 0x00])]
	}

	handleMuteAction(opt: { channel: number; mute: string | boolean }, midiOffset: number): boolean {
		const channel = Number(opt.channel)
		const key = `${midiOffset}:${channel}`
		const muteState =
			opt.mute === 'toggle'
				? !this.muteStateCache[key]
				: opt.mute === true || opt.mute === 'true' || opt.mute === 'mute'
		const command = this.buildMuteCommand(opt, midiOffset)[0]
		if (!this.writeCommand(command, `mute channel ${channel + 1}`)) return false

		if (this.muteStateCache[key] !== muteState) {
			this.muteStateCache[key] = muteState
			const relOffset = midiOffset - ((this.config.midiBase ?? 1) - 1)
			if (relOffset === 0) this.checkFeedbacks('mute_input')
			else if (relOffset === 1) this.checkFeedbacks('mute_mono_group', 'mute_stereo_group')
			else if (relOffset === 2) this.checkFeedbacks('mute_mono_aux', 'mute_stereo_aux')
			else if (relOffset === 3) this.checkFeedbacks('mute_mono_matrix', 'mute_stereo_matrix')
			else if (relOffset === 4) {
				if (channel >= 0x46 && channel <= 0x4d) this.setMuteGroupState(channel - 0x45, muteState)
				this.checkFeedbacks(
					'mute_mono_fx_send',
					'mute_stereo_fx_send',
					'mute_fx_return',
					'mute_master',
					'mute_dca',
					'mute_group',
					'mute_ufx_send',
					'mute_ufx_return',
				)
			}
		}
		return true
	}

	handleFaderAction(
		opt: { level: string; channel: number; fadeDuration?: string | number },
		midiOffset: number,
	): Buffer[] {
		const requestedFadeDuration = Number(opt.fadeDuration ?? 0)
		const fadeDuration = Number.isFinite(requestedFadeDuration) ? Math.max(0, Math.min(20, requestedFadeDuration)) : 0
		if (Number.isFinite(fadeDuration) && fadeDuration > 0) {
			this.fadeFaderCommand(opt, midiOffset, fadeDuration)
			return []
		}

		// An immediate set supersedes any fade still running on the same fader.
		this.clearFaderFadeTimers(`${midiOffset}:${Number(opt.channel)}`)
		this.sendFaderLevel(opt, midiOffset)
		return []
	}

	handleRelativeFaderAction(
		opt: { channel: number; direction: string; amountDb: number; fadeDuration?: string | number },
		midiOffset: number,
	): void {
		const channel = Number(opt.channel)
		const currentLevel = this.faderLevelCache[`${midiOffset}:${channel}`]
		const currentDbLabel = currentLevel === undefined ? undefined : faderLevelToDbMap[currentLevel]
		const currentDb = currentDbLabel === undefined || currentDbLabel === '-inf' ? undefined : Number(currentDbLabel)
		const amountDb = Number(opt.amountDb)

		if (currentDb === undefined || !Number.isFinite(amountDb) || amountDb <= 0) {
			this.log('warn', `Cannot move fader relatively because its current level is unknown (channel ${channel + 1}).`)
			return
		}

		const signedAmount = opt.direction === 'decrease' ? -amountDb : amountDb
		const requestedDb = Math.max(-50, Math.min(10, currentDb + signedAmount))
		const availableLevels = fader.level
			.filter(([db]) => db !== '-inf')
			.map(([db, hex]) => ({ db: Number(db), level: parseInt(hex, 16) }))
		const target = availableLevels.reduce((closest, candidate) =>
			Math.abs(candidate.db - requestedDb) < Math.abs(closest.db - requestedDb) ? candidate : closest,
		)

		this.handleFaderAction({ channel, level: String(target.level), fadeDuration: opt.fadeDuration }, midiOffset)
	}

	fadeFaderCommand(opt: { level: string; channel: number }, midiOffset: number, fadeDuration: number): void {
		const targetLevel = parseInt(opt.level)
		const channel = Number(opt.channel)
		const key = `${midiOffset}:${channel}`
		const startLevel = this.faderLevelCache[key]

		this.clearFaderFadeTimers(key)

		if (startLevel === undefined || startLevel === targetLevel) {
			this.sendFaderLevel(opt, midiOffset)
			return
		}

		const updatesPerSecond = getFadeUpdatesPerSecond(this.config)
		const stepCount = Math.max(2, Math.min(800, Math.round(fadeDuration * updatesPerSecond)))
		const values = Array.from(
			new Set(
				Array.from({ length: stepCount }, (_, index) =>
					Math.round(startLevel + ((targetLevel - startLevel) * (index + 1)) / stepCount),
				),
			),
		)
		const intervalMs = Math.max(25, Math.round((fadeDuration * 1000) / values.length))

		this.faderFadeTimers[key] = values.map((level, index) =>
			setTimeout(
				() => {
					this.sendFaderLevel({ level: String(level), channel: opt.channel }, midiOffset)
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

	sendFaderLevel(opt: { level: string; channel: number }, midiOffset: number): boolean {
		const faderLevel = parseInt(opt.level)
		const channel = Number(opt.channel)
		const command = this.buildFaderCommand(opt, midiOffset)[0]
		if (!this.writeCommand(command, `fader channel ${channel + 1}`)) return false
		this.faderLevelCache[`${midiOffset}:${channel}`] = faderLevel
		this.updateFaderLevelVariable(midiOffset, channel, faderLevel)
		return true
	}

	buildAssignCommands(
		opt: { dcaGroup?: number[]; muteGroup?: number[]; assign: boolean; channel: number },
		midiOffset: number,
		isDca: boolean,
	): Buffer[] {
		const routingCmds: Buffer[] = []
		const groups = isDca ? (opt.dcaGroup ?? []) : (opt.muteGroup ?? [])

		for (const groupCode of groups) {
			const numericGroupCode = Number(groupCode)
			const groupIndex = isDca
				? numericGroupCode >= 0x36 && numericGroupCode <= 0x45
					? numericGroupCode - 0x36
					: numericGroupCode
				: numericGroupCode >= 0x46 && numericGroupCode <= 0x4d
					? numericGroupCode - 0x46
					: numericGroupCode
			const maximumIndex = isDca ? 15 : 7
			if (!Number.isInteger(groupIndex) || groupIndex < 0 || groupIndex > maximumIndex) continue
			const assignmentBase = isDca ? (opt.assign ? 0x40 : 0x00) : opt.assign ? 0x50 : 0x10
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
					assignmentBase + groupIndex,
				]),
			)
		}

		return routingCmds
	}

	buildSceneCommand(opt: { sceneNumber: string }, midiOffset: number): Buffer[] {
		const zeroBasedScene = Number(opt.sceneNumber)
		return [buildSceneRecallMessage(zeroBasedScene + 1, midiOffset + 1)]
	}

	recallSceneNumber(value: string | number): boolean {
		const sceneNumber = Number(String(value).trim())
		const midiBaseChannel = this.config.midiBase ?? 1
		let message: Buffer
		try {
			message = buildSceneRecallMessage(sceneNumber, midiBaseChannel)
		} catch (error) {
			this.log('error', error instanceof Error ? error.message : String(error))
			return false
		}

		this.log('debug', `Recalling Scene ${sceneNumber}`)
		const sent = this.writeCommand(message, `Scene ${sceneNumber} recall`)
		if (sent) this.setLastSceneNumber(sceneNumber)
		return sent
	}

	recallSceneName(value: string): boolean {
		let scenes: number[]
		try {
			scenes = resolveSceneNames([value], this.sceneNameCache)
		} catch (error) {
			this.log('error', error instanceof Error ? error.message : String(error))
			return false
		}
		return this.recallSceneNumber(scenes[0])
	}

	sendRawMidiCommand(command: string): void {
		let message: Buffer
		try {
			message = parseRawMidiHex(command)
		} catch (error) {
			this.log('error', error instanceof Error ? error.message : String(error))
			return
		}

		this.log('debug', `Sending raw MIDI '${message.toString('hex').toUpperCase()}'`)
		this.writeCommand(message, 'raw MIDI command')
	}

	sendMmcTransport(command: number): void {
		try {
			this.writeCommand(buildMmcTransportMessage(command), 'MMC transport command')
		} catch (error) {
			this.log('error', error instanceof Error ? error.message : String(error))
		}
	}

	toggleUsbRecorder(): void {
		if (this.usbRecorderRecording === undefined) {
			this.log('warn', 'Cannot toggle USB recording because the synchronized recorder state is unknown')
			return
		}
		if (this.usbRecorderRecording) this.stopUsbRecorder()
		else this.startUsbRecorder()
	}

	startUsbRecorder(): void {
		const family = this.ahNetPlaybackManagerFamily
		if (family === undefined) {
			this.log('warn', 'Cannot start USB recording because the Playback Manager has not been discovered')
			return
		}
		this.sendUsbPlaybackMessage(buildUsbRecorderStartMessage(family), 'start USB recording')
	}

	stopUsbRecorder(): void {
		const family = this.ahNetPlaybackManagerFamily
		if (family === undefined) {
			this.log('warn', 'Cannot stop USB recording because the Playback Manager has not been discovered')
			return
		}
		this.sendUsbPlaybackMessage(buildUsbRecorderStopMessage(family), 'stop USB recording')
	}

	requestInputName(channel: number): void {
		this.writeCommand(buildInputNameRequest(this.config.midiBase ?? 1, channel))
	}

	requestInputColor(channel: number): void {
		this.writeCommand(buildInputColorRequest(this.config.midiBase ?? 1, channel))
	}

	refreshConsoleStripInfoTargets(): void {
		this.consoleStripInfoTargets.clear()
		const baseMidiChannel = (this.config.midiBase ?? 1) - 1
		for (const target of buildConsoleFaderTargets(
			getConfiguredMixLayout(this.config),
			this.config.rackUfxInstalled === true,
		)) {
			const variableRoot = target.variableId.replace(/^fader_/, '')
			this.consoleStripInfoTargets.set(`${baseMidiChannel + target.midiOffset}:${target.midiChannel}`, {
				nameVariableId: `${variableRoot}_name`,
				colorVariableId: `${variableRoot}_color`,
			})
		}
	}

	synchronizeInputNamesAndColors(scheduleSceneNamesAfter = false): void {
		this.clearInputInfoSyncTimers()
		if (!this.isCommandConnectionReady()) {
			this.log('warn', 'Cannot synchronize input names and colors: the command connection is not ready')
			return
		}
		const inputCount = getChannelCapacities(this.config).inputCount
		const nameRequests: Array<() => void> = []
		const colorRequests: Array<() => void> = []
		for (let channel = 0; channel < inputCount; channel++) {
			nameRequests.push(() => this.requestInputName(channel))
			colorRequests.push(() => this.requestInputColor(channel))
		}
		if (isAhNetStateSyncEnabled(this.config)) {
			for (const [address] of this.consoleStripInfoTargets) {
				const [midiChannelText, channelText] = address.split(':')
				const midiChannel = Number(midiChannelText)
				const channel = Number(channelText)
				nameRequests.push(() => this.writeCommand(buildChannelNameRequest(midiChannel, channel)))
				colorRequests.push(() => this.writeCommand(buildChannelColorRequest(midiChannel, channel)))
			}
		}
		nameRequests.forEach((request, index) => this.inputInfoSyncTimers.push(setTimeout(request, index * 5)))
		const colorStartDelay = nameRequests.length * 5 + 25
		colorRequests.forEach((request, index) =>
			this.inputInfoSyncTimers.push(setTimeout(request, colorStartDelay + index * 5)),
		)
		if (scheduleSceneNamesAfter) {
			const sceneNameStartDelay = colorStartDelay + colorRequests.length * 5 + 50
			this.inputInfoSyncTimers.push(setTimeout(() => this.scheduleSceneDirectorySync(), sceneNameStartDelay))
		}
	}

	clearInputInfoSyncTimers(): void {
		for (const timer of this.inputInfoSyncTimers) clearTimeout(timer)
		this.inputInfoSyncTimers = []
	}

	queueSceneSequence(
		values: string[],
		initialDelayMs: number,
		intervalMs: number,
		alwaysWaitForNextConnection: boolean,
	): void {
		let scenes: number[]
		try {
			scenes = parseSceneNumberList(values)
		} catch (error) {
			this.log('error', error instanceof Error ? error.message : String(error))
			return
		}

		if (scenes.length === 0) {
			this.log('error', 'A queued scene sequence must contain at least one scene')
			return
		}

		const connected = this.isCommandConnectionReady()
		// There is intentionally only one pending sequence. A newer operator choice
		// supersedes any scenes that have not yet been sent from the previous one.
		this.clearSceneSequenceTimer()
		this.pendingSceneSequences = []
		this.pendingSceneSequences.push({
			scenes,
			nextIndex: 0,
			initialDelayMs:
				connected && !alwaysWaitForNextConnection ? 0 : Math.max(0, Math.min(120000, Math.round(initialDelayMs || 0))),
			intervalMs: Math.max(100, Math.min(60000, Math.round(intervalMs || 1000))),
			notBeforeConnection:
				alwaysWaitForNextConnection || !connected ? this.connectionSerial + 1 : this.connectionSerial,
		})
		this.updateSceneQueueVariables()
		this.processSceneQueue()
	}

	queueSceneNameSequence(
		values: string[],
		initialDelayMs: number,
		intervalMs: number,
		alwaysWaitForNextConnection: boolean,
		skipInvalid = false,
	): void {
		let scenes: number[]
		try {
			if (skipInvalid) {
				const resolved = resolveAvailableSceneNames(values, this.sceneNameCache)
				for (const error of resolved.errors) this.log('warn', `Skipped queued scene name: ${error}`)
				scenes = resolved.scenes
				if (scenes.length === 0) throw new Error('No valid scene names remain after skipping invalid entries')
			} else scenes = resolveSceneNames(values, this.sceneNameCache)
		} catch (error) {
			this.log('error', error instanceof Error ? error.message : String(error))
			return
		}
		this.queueSceneSequence(scenes.map(String), initialDelayMs, intervalMs, alwaysWaitForNextConnection)
	}

	scheduleStateVerification(messages: Buffer[]): void {
		// While a renewal is pending the new session's full state sync re-reads everything.
		if (messages.length === 0 || this.ahNetRenewalInProgress) return
		const socket = this.ahNetSocket
		if (!socket || socket.destroyed) return
		for (const delay of [200, 900]) {
			const timer = setTimeout(() => {
				this.stateVerificationTimers = this.stateVerificationTimers.filter((candidate) => candidate !== timer)
				if (this.ahNetSocket !== socket || socket.destroyed) return
				for (const message of messages) socket.write(message)
			}, delay)
			this.stateVerificationTimers.push(timer)
		}
	}

	clearStateVerificationTimers(): void {
		for (const timer of this.stateVerificationTimers) clearTimeout(timer)
		this.stateVerificationTimers = []
	}

	processSceneQueue(): void {
		if (this.sceneSequenceTimer || !this.isCommandConnectionReady()) return
		const sequence = this.pendingSceneSequences[0]
		if (!sequence || sequence.notBeforeConnection > this.connectionSerial) return

		const delay = sequence.nextIndex === 0 ? sequence.initialDelayMs : sequence.intervalMs
		this.sceneSequenceTimer = setTimeout(() => {
			delete this.sceneSequenceTimer
			if (!this.isCommandConnectionReady()) return

			const scene = sequence.scenes[sequence.nextIndex]
			if (scene !== undefined) {
				if (this.recallSceneNumber(scene)) sequence.nextIndex++
			}

			if (sequence.nextIndex >= sequence.scenes.length) {
				this.pendingSceneSequences.shift()
			}
			this.updateSceneQueueVariables()
			this.processSceneQueue()
		}, delay)
	}

	clearSceneSequenceTimer(): void {
		if (this.sceneSequenceTimer) {
			clearTimeout(this.sceneSequenceTimer)
			delete this.sceneSequenceTimer
		}
	}

	clearSceneQueue(): void {
		this.clearSceneSequenceTimer()
		this.pendingSceneSequences = []
		this.updateSceneQueueVariables()
	}

	updateSceneQueueVariables(): void {
		const remainingScenes = this.pendingSceneSequences.reduce(
			(total, sequence) => total + sequence.scenes.length - sequence.nextIndex,
			0,
		)
		this.setVariableValues({
			queued_scene_count: remainingScenes,
			queued_scenes: this.pendingSceneSequences
				.flatMap((sequence) => sequence.scenes.slice(sequence.nextIndex))
				.join(', '),
		})
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
		const { message, transmittedName } = buildStripNameMessage(
			midiOffset,
			{ midiOffset: 0, channel: parseInt(opt.channel) },
			opt.channelName,
		)
		const channel = parseInt(opt.channel)
		this.inputNameCache[channel] = transmittedName
		this.setVariableValues({ [`input_name_${channel + 1}`]: transmittedName })
		return [message]
	}

	buildStripNameCommand(opt: { target: string; name: string }, midiBase: number): Buffer[] {
		const [midiOffsetText, channelText] = opt.target.split(':')
		const { message } = buildStripNameMessage(
			midiBase,
			{ midiOffset: Number(midiOffsetText), channel: Number(channelText) },
			opt.name,
		)
		return [message]
	}

	buildChannelColorCommand(opt: { channel: string; color: string }, midiOffset: number): Buffer[] {
		const channel = parseInt(opt.channel)
		const color = parseInt(opt.color)
		this.inputColorCache[channel] = color
		this.setVariableValues({ [`input_color_${channel + 1}`]: CHANNEL_COLOR_LABELS[color] ?? 'Unknown' })
		return [Buffer.from([...SysExHeader, 0x00 + midiOffset, 0x06, channel, color, 0xf7])]
	}

	buildSendLevelCommand(
		opt: { srcChannel: string | number | (string | number)[]; destChannel: number; level: string },
		baseMidi: number,
		srcMidiChnl: number,
		destMidiChnl: number,
	): Buffer[] {
		const sourceChannels = Array.isArray(opt.srcChannel) ? opt.srcChannel : [opt.srcChannel]
		return sourceChannels.map((sourceChannel) =>
			Buffer.from([
				...SysExHeader,
				0x00 + baseMidi + srcMidiChnl,
				0x0d,
				parseInt(String(sourceChannel)),
				baseMidi + destMidiChnl,
				opt.destChannel,
				parseInt(opt.level),
				0xf7,
			]),
		)
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

	isCommandConnectionReady(): boolean {
		return this.tcpSocket?.readyState === 'open' && this.tcpSocket.writable && !this.tcpSocket.destroyed
	}

	isAhNetConnectionReady(): boolean {
		return (
			this.ahNetSessionInitialized &&
			this.ahNetSocket?.readyState === 'open' &&
			this.ahNetSocket.writable &&
			!this.ahNetSocket.destroyed
		)
	}

	/** True when an AH-Net command can be sent now or held for the renewal in progress. */
	isAhNetCommandAvailable(): boolean {
		return this.isAhNetConnectionReady() || this.canHoldAhNetCommands()
	}

	canHoldAhNetCommands(): boolean {
		return this.ahNetRenewalInProgress && this.ahNetSocket !== undefined && !this.ahNetSocket.destroyed
	}

	flushHeldAhNetCommands(socket: net.Socket): void {
		const held = this.heldAhNetCommands
		this.heldAhNetCommands = []
		const now = Date.now()
		for (const entry of held) {
			if (now - entry.heldAt > HELD_AHNET_COMMAND_MAX_AGE_MS) {
				this.log('warn', `Dropped ${entry.description}: the AH-Net session renewal took too long`)
				entry.onDrop?.()
				continue
			}
			try {
				socket.write(entry.command)
				this.log('debug', `${entry.description} sent after AH-Net session renewal`)
			} catch (error) {
				this.log('error', `Failed to ${entry.description}: ${error instanceof Error ? error.message : String(error)}`)
			}
		}
	}

	dropHeldAhNetCommands(reason: string): void {
		this.ahNetRenewalInProgress = false
		if (this.heldAhNetCommands.length === 0) return
		const held = this.heldAhNetCommands
		this.heldAhNetCommands = []
		for (const entry of held) {
			this.log('warn', `Cannot ${entry.description}: ${reason}`)
			entry.onDrop?.()
		}
	}

	/**
	 * Writes an AH-Net command, or holds it during a lease renewal. `onDrop` restores
	 * any optimistic display update if a held command is never sent.
	 */
	writeAhNetCommand(command: Buffer, description: string, onDrop?: () => void): boolean {
		const socket = this.ahNetSocket
		if (!this.isAhNetConnectionReady() && this.canHoldAhNetCommands()) {
			if (this.heldAhNetCommands.length >= MAX_HELD_AHNET_COMMANDS) {
				this.log('warn', `Cannot ${description}: too many commands are waiting for the AH-Net session renewal`)
				return false
			}
			this.heldAhNetCommands.push({ command: Buffer.from(command), description, heldAt: Date.now(), onDrop })
			this.log('debug', `${description} held until the AH-Net session renewal completes`)
			return true
		}
		if (!this.isAhNetConnectionReady() || !socket) {
			this.log('warn', `Cannot ${description}: console synchronization is not connected`)
			return false
		}
		try {
			socket.write(command)
			this.log('debug', `${description} via existing AH-Net connection`)
			return true
		} catch (error) {
			this.log('error', `Failed to ${description}: ${error instanceof Error ? error.message : String(error)}`)
			return false
		}
	}

	writeCommand(command: Buffer, description = 'command'): boolean {
		if (!this.isCommandConnectionReady()) {
			this.log('warn', `Cannot send ${description}: the Avantis MIDI/TCP command connection is not ready`)
			return false
		}
		try {
			this.tcpSocket!.write(command)
			return true
		} catch (error) {
			this.log('error', `Failed to send ${description}: ${error instanceof Error ? error.message : String(error)}`)
			this.tcpSocket?.destroy()
			return false
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
