import type { CompanionVariableValue, CompanionVariableDefinitions } from '@companion-module/base'
import avantisConfig from './avantisconfig.json' with { type: 'json' }
import type ModuleInstance from './main.js'
import {
	getChannelCapacities,
	getConfiguredMixLayout,
	getSceneNameRetrievalLimit,
	isAhNetStateSyncEnabled,
} from './config.js'
import { UFX_GLOBAL_KEY_CHOICES, UFX_GLOBAL_SCALE_CHOICES, UFX_RETURN_COUNT, UFX_SEND_COUNT } from './protocol/ufx.js'
import { CHANNEL_COLOR_LABELS } from './protocol/channel-info.js'
import { MUTE_GROUP_COUNT } from './protocol/mute-group-sync.js'
import { UFX_BYPASS_COUNT } from './protocol/ufx-bypass.js'
import { buildConsoleFaderTargets } from './protocol/console-fader-sync.js'

export type VariablesSchema = Record<string, CompanionVariableValue>

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const definitions: CompanionVariableDefinitions<VariablesSchema> = {}
	const initialValues: Record<string, CompanionVariableValue> = {}
	const avantis = avantisConfig.config
	const capacities = getChannelCapacities(self.config)
	const configuredLayout = getConfiguredMixLayout(self.config)
	const synchronizedLayout = isAhNetStateSyncEnabled(self.config)

	definitions['online'] = { name: 'Command Connection Ready (true/false)' }
	definitions['connection_status'] = { name: 'Command Connection Status' }
	definitions['command_connection_state'] = { name: 'Command Connection Lifecycle State' }
	definitions['synchronization_connection_state'] = { name: 'Synchronization Connection Lifecycle State' }
	definitions['fader_sync_status'] = { name: 'Console Synchronization Status' }
	definitions['last_scene_number'] = { name: 'Last Scene Recalled (1-500)' }
	definitions['queued_scene_count'] = { name: 'Queued Scene Recall Count' }
	definitions['queued_scenes'] = { name: 'Queued Scene Numbers' }
	const commandConnected =
		self.tcpSocket !== undefined && !self.tcpSocket.destroyed && self.tcpSocket.readyState === 'open'
	initialValues['online'] = commandConnected
	initialValues['connection_status'] = commandConnected ? 'Connected' : 'Disconnected'
	initialValues['command_connection_state'] = self.commandConnectionState ?? (commandConnected ? 'Ready' : 'Offline')
	initialValues['synchronization_connection_state'] =
		self.synchronizationConnectionState ?? (synchronizedLayout ? 'Offline' : 'Disabled')
	initialValues['fader_sync_status'] = synchronizedLayout ? self.faderSyncStatus : 'Disabled'
	initialValues['last_scene_number'] = self.lastSceneNumber > 0 ? self.lastSceneNumber : 'Unknown'
	initialValues['queued_scene_count'] = self.pendingSceneSequences.reduce(
		(total, sequence) => total + sequence.scenes.length - sequence.nextIndex,
		0,
	)
	initialValues['queued_scenes'] = self.pendingSceneSequences
		.flatMap((sequence) => sequence.scenes.slice(sequence.nextIndex))
		.join(', ')

	if (!synchronizedLayout) {
		self.setVariableDefinitions(definitions)
		self.setVariableValues(initialValues)
		return
	}

	definitions['firmware_version'] = { name: 'Console Firmware Version' }
	definitions['firmware_revision'] = { name: 'Console Firmware Revision' }
	definitions['last_scene_name'] = { name: 'Last Scene Recalled Name' }
	definitions['global_tempo_bpm'] = { name: 'Global Tempo (BPM)' }
	definitions['virtual_soundcheck_mode'] = { name: 'Virtual Soundcheck Mode' }
	definitions['talkback_state'] = { name: 'Talkback State' }
	definitions['master_strips_lock_state'] = { name: 'Master Strips Lock State' }
	definitions['usb_recorder_state'] = { name: 'USB Recorder State' }
	definitions['usb_playback_state'] = { name: 'USB Playback State' }
	definitions['usb_playback_filename'] = { name: 'USB Playback Selected Recording' }
	definitions['dpack_upgrade_enabled'] = { name: 'dPack Upgrade Enabled' }
	definitions['rack_ultrafx_card_installed'] = { name: 'RackUltraFX Card Installed' }
	definitions['console_input_count'] = { name: 'Console Input Count' }
	definitions['console_mono_group_count'] = { name: 'Console Mono Group Count' }
	definitions['console_stereo_group_count'] = { name: 'Console Stereo Group Count' }
	definitions['console_mono_fx_count'] = { name: 'Console Mono FX Count' }
	definitions['console_stereo_fx_count'] = { name: 'Console Stereo FX Count' }
	definitions['console_mono_aux_count'] = { name: 'Console Mono Aux Count' }
	definitions['console_stereo_aux_count'] = { name: 'Console Stereo Aux Count' }
	definitions['console_mono_matrix_count'] = { name: 'Console Mono Matrix Count' }
	definitions['console_stereo_matrix_count'] = { name: 'Console Stereo Matrix Count' }
	definitions['console_main_mode'] = { name: 'Console Main Mode' }
	definitions['console_stereo_pafl_count'] = { name: 'Console Stereo PAFL Count' }
	definitions['io_port_1_status'] = { name: 'I/O Port 1 Status' }
	definitions['io_port_2_status'] = { name: 'I/O Port 2 Status' }
	definitions['slink_rack_1_status'] = { name: 'SLink Rack 1 Status' }
	definitions['slink_rack_2_status'] = { name: 'SLink Rack 2 Status' }
	initialValues['firmware_version'] = self.firmwareVersion ?? 'Unknown'
	initialValues['firmware_revision'] = self.firmwareRevision ?? 'Unknown'
	initialValues['last_scene_name'] = self.lastSceneName
	initialValues['global_tempo_bpm'] = self.globalTempoBpm ?? 'Unknown'
	initialValues['virtual_soundcheck_mode'] = self.virtualSoundcheckMode
	initialValues['talkback_state'] =
		self.talkbackActive === undefined ? 'Unknown' : self.talkbackActive ? 'Active' : 'Inactive'
	initialValues['master_strips_lock_state'] =
		self.masterStripsLocked === undefined ? 'Unknown' : self.masterStripsLocked ? 'Locked' : 'Unlocked'
	initialValues['usb_recorder_state'] =
		self.usbRecorderRecording === undefined ? 'Unknown' : self.usbRecorderRecording ? 'Recording' : 'Stopped'
	initialValues['usb_playback_state'] = self.usbPlaybackState ?? 'Unknown'
	initialValues['usb_playback_filename'] = self.usbPlaybackFilename ?? 'Unknown'
	const discoveredLayout = self.discoveredConsoleLayout
	initialValues['dpack_upgrade_enabled'] = self.discoveredDPack ?? 'Unknown'
	initialValues['rack_ultrafx_card_installed'] = self.discoveredRackUfx ?? 'Unknown'
	initialValues['console_input_count'] = self.discoveredDPack === undefined ? 'Unknown' : self.discoveredDPack ? 96 : 64
	initialValues['console_mono_group_count'] = discoveredLayout?.monoGroups ?? 'Unknown'
	initialValues['console_stereo_group_count'] = discoveredLayout?.stereoGroups ?? 'Unknown'
	initialValues['console_mono_fx_count'] = discoveredLayout?.monoFx ?? 'Unknown'
	initialValues['console_stereo_fx_count'] = discoveredLayout?.stereoFx ?? 'Unknown'
	initialValues['console_mono_aux_count'] = discoveredLayout?.monoAuxes ?? 'Unknown'
	initialValues['console_stereo_aux_count'] = discoveredLayout?.stereoAuxes ?? 'Unknown'
	initialValues['console_mono_matrix_count'] = discoveredLayout?.monoMatrices ?? 'Unknown'
	initialValues['console_stereo_matrix_count'] = discoveredLayout?.stereoMatrices ?? 'Unknown'
	initialValues['console_main_mode'] = discoveredLayout?.mainMode ?? 'Unknown'
	initialValues['console_stereo_pafl_count'] = discoveredLayout?.stereoPafl ?? 'Unknown'
	for (let port = 1; port <= 2; port++) {
		const installed = self.ioPortInstalled[port - 1]
		initialValues[`io_port_${port}_status`] =
			installed === undefined ? 'Unknown' : installed ? 'Installed' : 'Not Installed'
	}
	for (let rack = 1; rack <= 2; rack++) {
		const connected = self.slinkRackConnected[rack - 1]
		initialValues[`slink_rack_${rack}_status`] =
			connected === undefined ? 'Unknown' : connected ? 'Connected' : 'Disconnected'
	}
	const sceneNameRetrievalLimit = getSceneNameRetrievalLimit(self.config)
	if (sceneNameRetrievalLimit > 0) {
		for (let scene = 1; scene <= sceneNameRetrievalLimit; scene++) {
			definitions[`scene_name_${scene}`] = { name: `Scene ${scene} Name` }
			initialValues[`scene_name_${scene}`] = self.sceneNameCache[scene] ?? 'Unknown'
		}
	}
	for (let group = 1; group <= MUTE_GROUP_COUNT; group++) {
		definitions[`mute_group_${group}_state`] = { name: `Mute Group ${group} State` }
		const state = self.muteGroupStates[group - 1]
		initialValues[`mute_group_${group}_state`] = state === undefined ? 'Unknown' : state ? 'Muted' : 'Unmuted'
	}
	if (self.config.rackUfxInstalled === true) {
		definitions['ufx_global_key'] = { name: 'RackUltraFX Global Key' }
		definitions['ufx_global_scale'] = { name: 'RackUltraFX Global Scale' }
		initialValues['ufx_global_key'] =
			self.ufxGlobalKey === undefined ? 'Unknown' : (UFX_GLOBAL_KEY_CHOICES[self.ufxGlobalKey]?.label ?? 'Unknown')
		initialValues['ufx_global_scale'] =
			self.ufxGlobalScale === undefined
				? 'Unknown'
				: (UFX_GLOBAL_SCALE_CHOICES[self.ufxGlobalScale]?.label ?? 'Unknown')
		for (let unit = 1; unit <= UFX_BYPASS_COUNT; unit++) {
			definitions[`ufx_${unit}_bypass_state`] = { name: `RackUltraFX ${unit} Bypass State` }
			const state = self.ufxBypassStates[unit - 1]
			initialValues[`ufx_${unit}_bypass_state`] = state === undefined ? 'Unknown' : state ? 'Bypassed' : 'Enabled'
			definitions[`ufx_${unit}_plugin_bypass_state`] = { name: `RackUltraFX ${unit} Plugin Bypass State` }
			const pluginState = self.ufxPluginBypassStates[unit - 1]
			initialValues[`ufx_${unit}_plugin_bypass_state`] =
				pluginState === undefined ? 'Unknown' : pluginState ? 'Bypassed' : 'Enabled'
		}
	}

	const addVar = (prefix: string, index: number, label: string) => {
		const varId = `${prefix}_${index}`
		definitions[varId] = {
			name: `${label} ${index} Fader Level (dB)`,
		}
		initialValues[varId] = 'Unknown'
	}

	// Inputs
	for (let i = 1; i <= capacities.inputCount; i++) {
		addVar('fader_input', i, 'Input')
		definitions[`input_name_${i}`] = { name: `Input ${i} Name` }
		definitions[`input_color_${i}`] = { name: `Input ${i} Color` }
		initialValues[`input_name_${i}`] = self.inputNameCache[i - 1] ?? 'Unknown'
		const color = self.inputColorCache[i - 1]
		initialValues[`input_color_${i}`] = color === undefined ? 'Unknown' : (CHANNEL_COLOR_LABELS[color] ?? 'Unknown')
	}

	// Main Mixes. LR is Main 1 and the optional Msum is Main 3 in the MIDI protocol.
	addVar('fader_main', 1, 'LR Main')
	if (!synchronizedLayout || configuredLayout.mSumEnabled) addVar('fader_main', 3, 'Msum Main')

	// DCAs
	for (let i = 1; i <= avantis.dcaCount; i++) {
		addVar('fader_dca', i, 'DCA')
	}

	// Mono Groups
	for (let i = 1; i <= (synchronizedLayout ? configuredLayout.monoGroups : capacities.monoBusCount); i++) {
		addVar('fader_mono_group', i, 'Mono Group')
	}

	// Stereo Groups
	for (let i = 1; i <= (synchronizedLayout ? configuredLayout.stereoGroups : capacities.stereoBusCount); i++) {
		addVar('fader_stereo_group', i, 'Stereo Group')
	}

	// Mono Auxes
	for (let i = 1; i <= (synchronizedLayout ? configuredLayout.monoAuxes : capacities.monoBusCount); i++) {
		addVar('fader_mono_aux', i, 'Mono Aux')
	}

	// Stereo Auxes
	for (let i = 1; i <= (synchronizedLayout ? configuredLayout.stereoAuxes : capacities.stereoBusCount); i++) {
		addVar('fader_stereo_aux', i, 'Stereo Aux')
	}

	// Mono Matrices
	for (let i = 1; i <= (synchronizedLayout ? configuredLayout.monoMatrices : capacities.monoBusCount); i++) {
		addVar('fader_mono_matrix', i, 'Mono Matrix')
	}

	// Stereo Matrices
	for (let i = 1; i <= (synchronizedLayout ? configuredLayout.stereoMatrices : capacities.stereoBusCount); i++) {
		addVar('fader_stereo_matrix', i, 'Stereo Matrix')
	}

	// Mono FX Sends
	for (let i = 1; i <= (synchronizedLayout ? configuredLayout.monoFxSends : avantis.mono.fxSendCount); i++) {
		addVar('fader_mono_fx_send', i, 'Mono FX Send')
	}

	// Stereo FX Sends
	for (let i = 1; i <= (synchronizedLayout ? configuredLayout.stereoFxSends : avantis.stereo.fxSendCount); i++) {
		addVar('fader_stereo_fx_send', i, 'Stereo FX Send')
	}

	// FX Returns
	for (let i = 1; i <= avantis.fxReturnCount; i++) {
		addVar('fader_fx_return', i, 'FX Return')
	}

	if (self.config.rackUfxInstalled === true) {
		for (let i = 1; i <= UFX_SEND_COUNT; i++) {
			addVar('fader_ufx_send', i, 'RackUltraFX Send')
		}
		for (let i = 1; i <= UFX_RETURN_COUNT; i++) {
			addVar('fader_ufx_return', i, 'RackUltraFX Return')
		}
	}

	if (synchronizedLayout) {
		for (const target of buildConsoleFaderTargets(configuredLayout, self.config.rackUfxInstalled === true)) {
			const variableRoot = target.variableId.replace(/^fader_/, '')
			const nameVariableId = `${variableRoot}_name`
			const colorVariableId = `${variableRoot}_color`
			definitions[nameVariableId] = { name: `${target.label} Name` }
			definitions[colorVariableId] = { name: `${target.label} Color` }
			initialValues[nameVariableId] = self.consoleStripNameCache[nameVariableId] ?? 'Unknown'
			const color = self.consoleStripColorCache[colorVariableId]
			initialValues[colorVariableId] = color === undefined ? 'Unknown' : (CHANNEL_COLOR_LABELS[color] ?? 'Unknown')
		}
	}

	self.setVariableDefinitions(definitions)
	self.setVariableValues(initialValues)
}

export default UpdateVariableDefinitions
