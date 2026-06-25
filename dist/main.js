import { InstanceBase, InstanceStatus, } from '@companion-module/base';
import * as net from 'net';
import UpdateActions from './actions.js';
import avantisConfig from './avantisconfig.json' with { type: 'json' };
import fader from './fader.json' with { type: 'json' };
import { GetConfigFields } from './config.js';
import UpdateFeedbacks from './feedbacks.js';
import UpdatePresets from './presets.js';
import { UpgradeScripts } from './upgrades.js';
import UpdateVariableDefinitions from './variables.js';
const PORT = 51325;
const SysExHeader = [0xf0, 0x00, 0x00, 0x1a, 0x50, 0x10, 0x01, 0x00];
const configFields = GetConfigFields();
const faderLevelToDbMap = new Array(128).fill('-inf');
function initFaderLevelToDbMap() {
    const faderLevels = fader.level.map(([db, hex]) => ({ db, val: parseInt(hex, 16) }));
    faderLevels.sort((a, b) => a.val - b.val);
    let currentIdx = 0;
    for (let val = 0; val <= 127; val++) {
        while (currentIdx < faderLevels.length - 1 &&
            Math.abs(faderLevels[currentIdx + 1].val - val) <= Math.abs(faderLevels[currentIdx].val - val)) {
            currentIdx++;
        }
        faderLevelToDbMap[val] = faderLevels[currentIdx].db;
    }
}
initFaderLevelToDbMap();
export { UpgradeScripts };
export default class ModuleInstance extends InstanceBase {
    config;
    tcpSocket;
    scenes = [];
    faderLevelCache = {};
    muteStateCache = {};
    faderFadeTimers = {};
    nrpnMSB = {};
    nrpnLSB = {};
    reconnectTimer;
    async init(config, _isFirstInit, _secrets) {
        this.config = config;
        this.updateStatus(InstanceStatus.Connecting);
        this.updateActions();
        this.updateFeedbacks();
        this.updatePresets();
        this.updateVariableDefinitions();
        this.initTcp();
        this.setupSceneSelection();
    }
    async destroy() {
        this.clearFaderFadeTimers();
        this.clearReconnectTimer();
        if (this.tcpSocket) {
            this.tcpSocket.destroy();
        }
        this.log('debug', `destroyed ${this.id}`);
    }
    async configUpdated(config, _secrets) {
        this.config = config;
        this.updateActions();
        this.updatePresets();
        this.initTcp();
    }
    getConfigFields() {
        return configFields;
    }
    updateActions() {
        UpdateActions(this);
    }
    updateFeedbacks() {
        UpdateFeedbacks(this);
    }
    updatePresets() {
        UpdatePresets(this);
    }
    updateVariableDefinitions() {
        UpdateVariableDefinitions(this);
    }
    initTcp() {
        this.clearFaderFadeTimers();
        this.clearReconnectTimer();
        if (this.tcpSocket) {
            this.tcpSocket.destroy();
            delete this.tcpSocket;
        }
        if (this.config.host) {
            this.updateStatus(InstanceStatus.Connecting);
            this.tcpSocket = new net.Socket().connect({
                host: this.config.host,
                port: PORT,
            });
            this.tcpSocket.on('error', (err) => {
                this.log('error', `TCP error: ${err.message}`);
                this.updateStatus(InstanceStatus.ConnectionFailure, err.message);
                this.triggerReconnect();
            });
            this.tcpSocket.on('connect', () => {
                this.log('debug', `TCP Connected to ${this.config.host}`);
                this.updateStatus(InstanceStatus.Ok);
                this.clearReconnectTimer();
            });
            this.tcpSocket.on('close', () => {
                this.updateStatus(InstanceStatus.Disconnected);
                this.triggerReconnect();
            });
            this.tcpSocket.on('data', (data) => {
                this.validateResponseData(data);
            });
        }
    }
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            delete this.reconnectTimer;
        }
    }
    triggerReconnect() {
        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
            this.log('debug', 'Attempting to reconnect to Avantis mixer...');
            this.initTcp();
        }, 5000);
    }
    validateResponseData(data) {
        this.processIncomingMidi(data);
        const values = data.toJSON().data;
        if (!values) {
            return;
        }
        this.log('debug', `Response DATA: ${JSON.stringify(values)}`);
    }
    processIncomingMidi(data) {
        let changedMutes = false;
        const changedFeedbacks = new Set();
        let runningStatus = 0;
        let i = 0;
        while (i < data.length) {
            let status = data[i];
            const isStatusByte = (status & 0x80) !== 0;
            if (isStatusByte) {
                runningStatus = status;
                i++;
            }
            else {
                status = runningStatus;
            }
            if ((status & 0x80) === 0) {
                // No valid status byte available, skip
                i++;
                continue;
            }
            const msgType = status & 0xf0;
            const midiCh = status & 0x0f;
            if (msgType === 0x90) {
                // Note On (3 bytes total: status, note, velocity)
                if (i + 1 < data.length) {
                    const note = data[i];
                    const velocity = data[i + 1];
                    i += 2;
                    // Ignore momentary key release (velocity 0x00)
                    if (velocity !== 0x00) {
                        const isMuted = velocity >= 0x40;
                        const key = `${midiCh}:${note}`;
                        if (this.muteStateCache[key] !== isMuted) {
                            this.muteStateCache[key] = isMuted;
                            changedMutes = true;
                            const midiBase = (this.config.midiBase ?? 1) - 1;
                            const relCh = midiCh - midiBase;
                            if (relCh === 0)
                                changedFeedbacks.add('mute_input');
                            else if (relCh === 1) {
                                changedFeedbacks.add('mute_mono_group');
                                changedFeedbacks.add('mute_stereo_group');
                            }
                            else if (relCh === 2) {
                                changedFeedbacks.add('mute_mono_aux');
                                changedFeedbacks.add('mute_stereo_aux');
                            }
                            else if (relCh === 3) {
                                changedFeedbacks.add('mute_mono_matrix');
                                changedFeedbacks.add('mute_stereo_matrix');
                            }
                            else if (relCh === 4) {
                                changedFeedbacks.add('mute_mono_fx_send');
                                changedFeedbacks.add('mute_stereo_fx_send');
                                changedFeedbacks.add('mute_fx_return');
                                changedFeedbacks.add('mute_master');
                                changedFeedbacks.add('mute_dca');
                                changedFeedbacks.add('mute_group');
                            }
                        }
                    }
                }
                else {
                    break;
                }
            }
            else if (msgType === 0x80) {
                // Note Off (3 bytes total: status, note, velocity) - ignore for mute state
                if (i + 1 < data.length) {
                    i += 2;
                }
                else {
                    break;
                }
            }
            else if (msgType === 0xb0) {
                // Control Change (3 bytes total: status, controller, value)
                if (i + 1 < data.length) {
                    const controller = data[i];
                    const val = data[i + 1];
                    i += 2;
                    if (controller === 0x63) {
                        // NRPN MSB
                        this.nrpnMSB[midiCh] = val;
                    }
                    else if (controller === 0x62) {
                        // NRPN LSB
                        this.nrpnLSB[midiCh] = val;
                    }
                    else if (controller === 0x06) {
                        // Data Entry MSB
                        if (this.nrpnLSB[midiCh] === 0x17) {
                            const channel = this.nrpnMSB[midiCh];
                            if (channel !== undefined) {
                                this.faderLevelCache[`${midiCh}:${channel}`] = val;
                                this.updateFaderLevelVariable(midiCh, channel, val);
                            }
                        }
                    }
                }
                else {
                    break;
                }
            }
            else if (msgType === 0xa0 || msgType === 0xe0) {
                if (i + 1 < data.length) {
                    i += 2;
                }
                else {
                    break;
                }
            }
            else if (msgType === 0xc0 || msgType === 0xd0) {
                if (i < data.length) {
                    i += 1;
                }
                else {
                    break;
                }
            }
            else if (status === 0xf0) {
                // Sysex
                while (i < data.length && data[i] !== 0xf7) {
                    i++;
                }
                if (i < data.length) {
                    i++;
                }
                runningStatus = 0;
            }
            else {
                if (isStatusByte) {
                    // Already advanced i
                }
                else {
                    i++;
                }
            }
        }
        if (changedMutes && changedFeedbacks.size > 0) {
            const arr = Array.from(changedFeedbacks);
            const first = arr[0];
            if (first) {
                this.checkFeedbacks(first, ...arr.slice(1));
            }
        }
    }
    updateFaderLevelVariable(midiOffset, channel, level) {
        const midiBase = (this.config.midiBase ?? 1) - 1;
        const relOffset = midiOffset - midiBase;
        let prefix = '';
        let index = 1;
        if (relOffset === 0) {
            prefix = 'fader_input';
            index = channel + 1;
        }
        else if (relOffset === 1) {
            if (channel >= 0x3f) {
                prefix = 'fader_stereo_group';
                index = channel - 0x3f + 1;
            }
            else {
                prefix = 'fader_mono_group';
                index = channel + 1;
            }
        }
        else if (relOffset === 2) {
            if (channel >= 0x3f) {
                prefix = 'fader_stereo_aux';
                index = channel - 0x3f + 1;
            }
            else {
                prefix = 'fader_mono_aux';
                index = channel + 1;
            }
        }
        else if (relOffset === 3) {
            if (channel >= 0x3f) {
                prefix = 'fader_stereo_matrix';
                index = channel - 0x3f + 1;
            }
            else {
                prefix = 'fader_mono_matrix';
                index = channel + 1;
            }
        }
        else if (relOffset === 4) {
            if (channel >= 0x35 && channel <= 0x44) {
                prefix = 'fader_dca';
                index = channel - 0x35 + 1;
            }
            else if (channel >= 0x2f && channel <= 0x31) {
                prefix = 'fader_main';
                index = channel - 0x2f + 1;
            }
            else if (channel >= 0x0f && channel <= 0x1a) {
                prefix = 'fader_stereo_fx_send';
                index = channel - 0x0f + 1;
            }
            else if (channel >= 0x1f && channel <= 0x2a) {
                prefix = 'fader_fx_return';
                index = channel - 0x1f + 1;
            }
            else if (channel < 0x0f) {
                prefix = 'fader_mono_fx_send';
                index = channel + 1;
            }
        }
        if (prefix) {
            const dbStr = faderLevelToDbMap[level] ?? '-inf';
            this.setVariableValues({
                [`${prefix}_${index}`]: `${dbStr} dB`,
            });
        }
    }
    setupSceneSelection() {
        const getSceneBank = (sceneNumber) => {
            if (sceneNumber <= 128)
                return 0x00;
            if (sceneNumber <= 256)
                return 0x01;
            if (sceneNumber <= 384)
                return 0x02;
            return 0x03;
        };
        const getSceneSSNumber = (sceneNumber) => {
            while (sceneNumber > 128) {
                sceneNumber -= 128;
            }
            return sceneNumber - 1;
        };
        this.scenes = [];
        for (let i = 1; i <= avantisConfig.config.sceneCount; i++) {
            this.scenes.push({
                sceneNumber: i,
                block: getSceneBank(i),
                ss: getSceneSSNumber(i),
            });
        }
    }
    action(action) {
        const opt = action.options;
        let bufferCommands = [];
        const midiBase = (this.config.midiBase ?? 1) - 1;
        switch (action.action) {
            case 'mute_input':
                bufferCommands = this.buildMuteCommand(opt, midiBase);
                break;
            case 'fader_input':
                bufferCommands = this.handleFaderAction(opt, midiBase);
                break;
            case 'mute_mono_group':
            case 'mute_stereo_group':
                bufferCommands = this.buildMuteCommand(opt, midiBase + 1);
                break;
            case 'fader_mono_group':
            case 'fader_stereo_group':
                bufferCommands = this.handleFaderAction(opt, midiBase + 1);
                break;
            case 'mute_mono_aux':
            case 'mute_stereo_aux':
                bufferCommands = this.buildMuteCommand(opt, midiBase + 2);
                break;
            case 'fader_mono_aux':
            case 'fader_stereo_aux':
                bufferCommands = this.handleFaderAction(opt, midiBase + 2);
                break;
            case 'mute_mono_matrix':
            case 'mute_stereo_matrix':
                bufferCommands = this.buildMuteCommand(opt, midiBase + 3);
                break;
            case 'fader_mono_matrix':
            case 'fader_stereo_matrix':
                bufferCommands = this.handleFaderAction(opt, midiBase + 3);
                break;
            case 'mute_mono_fx_send':
            case 'mute_stereo_fx_send':
            case 'mute_fx_return':
            case 'mute_dca':
            case 'mute_master':
            case 'mute_group':
                bufferCommands = this.buildMuteCommand(opt, midiBase + 4);
                break;
            case 'fader_DCA':
            case 'fader_mono_fx_send':
            case 'fader_stereo_fx_send':
            case 'fader_fx_return':
            case 'fader_master':
                bufferCommands = this.handleFaderAction(opt, midiBase + 4);
                break;
            case 'dca_assign':
                bufferCommands = this.buildAssignCommands(opt, midiBase + 4, true);
                break;
            case 'mute_group_assign':
                bufferCommands = this.buildAssignCommands(opt, midiBase + 4, false);
                break;
            case 'scene_recall':
                bufferCommands = this.buildSceneCommand(opt, midiBase);
                break;
            case 'channel_main_assign':
                bufferCommands = this.buildChannelAssignCommand(opt, midiBase);
                break;
            case 'channel_name':
                bufferCommands = this.buildChannelNameCommand(opt, midiBase);
                break;
            case 'channel_color':
                bufferCommands = this.buildChannelColorCommand(opt, midiBase);
                break;
            case 'send_input_to_mono_aux':
            case 'send_input_to_stereo_aux':
                bufferCommands = this.buildSendLevelCommand(opt, midiBase, 0, 2);
                break;
            case 'send_input_to_mono_aux_number':
                bufferCommands = this.buildSendLevelNumberCommand(opt, midiBase, 0, 2);
                break;
            case 'send_input_to_mono_matrix':
            case 'send_input_to_stereo_matrix':
                bufferCommands = this.buildSendLevelCommand(opt, midiBase, 0, 3);
                break;
            case 'send_input_to_fx_return':
            case 'send_input_to_mono_fx_return':
            case 'send_input_to_stereo_fx_return':
            case 'send_input_to':
                bufferCommands = this.buildSendLevelCommand(opt, midiBase, 0, 4);
                break;
        }
        for (let i = 0; i < bufferCommands.length; i++) {
            if (this.tcpSocket) {
                this.dumpData(opt, midiBase, bufferCommands);
                this.log('debug', `sending '${bufferCommands[i].toString('hex')}' ${i}/${bufferCommands.length} via TCP @${this.config.host}`);
                this.tcpSocket.write(bufferCommands[i]);
            }
        }
    }
    buildMuteCommand(opt, midiOffset) {
        const channel = Number(opt.channel);
        const key = `${midiOffset}:${channel}`;
        const muteState = opt.mute === 'toggle'
            ? !this.muteStateCache[key]
            : opt.mute === true || opt.mute === 'true' || opt.mute === 'mute';
        if (this.muteStateCache[key] !== muteState) {
            this.muteStateCache[key] = muteState;
            const midiBase = (this.config.midiBase ?? 1) - 1;
            const relOffset = midiOffset - midiBase;
            if (relOffset === 0) {
                this.checkFeedbacks('mute_input');
            }
            else if (relOffset === 1) {
                this.checkFeedbacks('mute_mono_group', 'mute_stereo_group');
            }
            else if (relOffset === 2) {
                this.checkFeedbacks('mute_mono_aux', 'mute_stereo_aux');
            }
            else if (relOffset === 3) {
                this.checkFeedbacks('mute_mono_matrix', 'mute_stereo_matrix');
            }
            else if (relOffset === 4) {
                this.checkFeedbacks('mute_mono_fx_send', 'mute_stereo_fx_send', 'mute_fx_return', 'mute_master', 'mute_dca', 'mute_group');
            }
        }
        return [Buffer.from([0x90 + midiOffset, channel, muteState ? 0x7f : 0x3f, 0x90 + midiOffset, channel, 0x00])];
    }
    handleFaderAction(opt, midiOffset) {
        const fadeDuration = Number(opt.fadeDuration ?? 0);
        if (Number.isFinite(fadeDuration) && fadeDuration > 0) {
            this.fadeFaderCommand(opt, midiOffset, fadeDuration);
            return [];
        }
        return this.buildFaderCommand(opt, midiOffset);
    }
    fadeFaderCommand(opt, midiOffset, fadeDuration) {
        const targetLevel = parseInt(opt.level);
        const channel = Number(opt.channel);
        const key = `${midiOffset}:${channel}`;
        const startLevel = this.faderLevelCache[key];
        this.clearFaderFadeTimers(key);
        if (startLevel === undefined || startLevel === targetLevel) {
            this.writeCommand(this.buildFaderCommand(opt, midiOffset)[0]);
            return;
        }
        const stepCount = Math.max(2, Math.min(40, Math.round(fadeDuration * 10)));
        const values = Array.from(new Set(Array.from({ length: stepCount }, (_, index) => Math.round(startLevel + ((targetLevel - startLevel) * (index + 1)) / stepCount))));
        const intervalMs = Math.max(50, Math.round((fadeDuration * 1000) / values.length));
        this.faderFadeTimers[key] = values.map((level, index) => setTimeout(() => {
            this.writeCommand(this.buildFaderCommand({ level: String(level), channel: opt.channel }, midiOffset)[0]);
            if (index === values.length - 1) {
                delete this.faderFadeTimers[key];
            }
        }, intervalMs * (index + 1)));
    }
    buildFaderCommand(opt, midiOffset) {
        const faderLevel = parseInt(opt.level);
        const channel = Number(opt.channel);
        this.faderLevelCache[`${midiOffset}:${channel}`] = faderLevel;
        this.updateFaderLevelVariable(midiOffset, channel, faderLevel);
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
        ];
    }
    buildAssignCommands(opt, midiOffset, isDca) {
        const routingCmds = [];
        const groups = isDca ? (opt.dcaGroup ?? []) : (opt.muteGroup ?? []);
        let offset = 0;
        if (isDca) {
            if (opt.assign)
                offset = 0x40;
        }
        else if (opt.assign) {
            offset = 0x50;
        }
        else {
            offset = 0x10;
        }
        for (const groupCode of groups) {
            routingCmds.push(Buffer.from([
                0xb0 + midiOffset,
                0x63,
                opt.channel,
                0xb0 + midiOffset,
                0x62,
                0x40,
                0xb0 + midiOffset,
                0x06,
                groupCode + offset,
            ]));
        }
        return routingCmds;
    }
    buildSceneCommand(opt, midiOffset) {
        const scene = this.scenes[parseInt(opt.sceneNumber)];
        return [Buffer.from([0xb0 + midiOffset, 0x00, scene.block, 0xc0 + midiOffset, scene.ss])];
    }
    buildChannelAssignCommand(opt, midiOffset) {
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
        ];
    }
    buildChannelNameCommand(opt, midiOffset) {
        const commandArray = [...SysExHeader, 0x00 + midiOffset, 0x03, parseInt(opt.channel)];
        const nameMap = avantisConfig.name;
        for (const char of opt.channelName) {
            const value = nameMap[char];
            if (value) {
                commandArray.push(parseInt(value, 16));
            }
        }
        commandArray.push(0xf7);
        return [Buffer.from(commandArray)];
    }
    buildChannelColorCommand(opt, midiOffset) {
        return [Buffer.from([...SysExHeader, 0x00 + midiOffset, 0x06, parseInt(opt.channel), parseInt(opt.color), 0xf7])];
    }
    buildSendLevelCommand(opt, baseMidi, srcMidiChnl, destMidiChnl) {
        const sourceChannels = Array.isArray(opt.srcChannel) ? opt.srcChannel : [opt.srcChannel];
        return sourceChannels.map((sourceChannel) => Buffer.from([
            ...SysExHeader,
            0x00 + baseMidi + srcMidiChnl,
            0x0d,
            parseInt(String(sourceChannel)),
            baseMidi + destMidiChnl,
            opt.destChannel,
            parseInt(opt.level),
            0xf7,
        ]));
    }
    buildSendLevelNumberCommand(opt, baseMidi, srcMidiChnl, destMidiChnl) {
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
        ];
        const levelAsHexString = levelMap[opt['level-int']] ?? '0x00';
        this.log('debug', `levelAsHexString: ${levelAsHexString}`);
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
        ];
    }
    dumpData(opt, midiBase, bufferCommands) {
        this.log('debug', `dumpData: ${JSON.stringify(opt)} ${midiBase} ${bufferCommands.length}`);
    }
    writeCommand(command) {
        if (this.tcpSocket?.writable) {
            this.tcpSocket.write(command);
        }
    }
    clearFaderFadeTimers(key) {
        const keys = key ? [key] : Object.keys(this.faderFadeTimers);
        for (const timerKey of keys) {
            for (const timer of this.faderFadeTimers[timerKey] ?? []) {
                clearTimeout(timer);
            }
            delete this.faderFadeTimers[timerKey];
        }
    }
}
//# sourceMappingURL=main.js.map