"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("@companion-module/base");
const actions_1 = __importDefault(require("./actions"));
const feedbacks_1 = __importDefault(require("./feedbacks"));
const variables_1 = __importDefault(require("./variables"));
const net = __importStar(require("net"));
const avantisconfig_json_1 = __importDefault(require("./avantisconfig.json"));
const PORT = 51325;
const SysExHeader = [0xF0, 0x00, 0x00, 0x1A, 0x50, 0x10, 0x01, 0x00];
const configFields = [
    {
        type: 'static-text',
        id: 'info',
        width: 12,
        value: 'This module is for the Allen & Heath Avantis mixer',
        label: 'Information',
    },
    {
        type: 'textinput',
        id: 'host',
        label: 'Target IP',
        width: 6,
        default: '192.168.1.70',
        regex: base_1.Regex.IP,
    },
    {
        type: 'number',
        label: 'MIDI Base Channel',
        id: 'midiBase',
        tooltip: 'The base channel selected in Utility / Control / MIDI and cannot exceed 12',
        width: 6,
        default: 1,
        min: 1,
        max: 12,
    },
];
class ModuleInstance extends base_1.InstanceBase {
    devMode;
    config;
    tcpSocket;
    scenes;
    tSockets;
    tSocket;
    init = async (config) => {
        this.config = config;
        this.updateStatus(base_1.InstanceStatus.Ok);
        this.updateActions(); // export actions
        this.updateFeedbacks(); // export feedbacks
        this.updateVariableDefinitions(); // export variable definitions
        this.devMode = true;
        this.init_tcp();
        this.setupSceneSelection();
    };
    // When module gets deleted
    destroy = async () => {
        if (this.tcpSocket !== undefined) {
            this.tcpSocket.destroy();
        }
        this.log('debug', `destroyed ${this.id}`);
    };
    async configUpdated(config) {
        this.config = config;
        this.init_tcp();
    }
    // Return config fields for web config
    getConfigFields() {
        return configFields;
    }
    updateActions = () => {
        (0, actions_1.default)(this);
    };
    updateFeedbacks() {
        (0, feedbacks_1.default)(this);
    }
    updateVariableDefinitions() {
        (0, variables_1.default)(this);
    }
    /**
     * Creates the configuration fields for web config.
     *
     * @returns {Array} the config fields
     * @access public
     * @since 1.0.0
     */
    config_fields() {
        return [
            {
                type: 'text',
                id: 'info',
                width: 12,
                label: 'Information',
                value: 'This module is for the Allen & Heath Avantis mixer',
            },
            {
                type: 'textinput',
                id: 'host',
                label: 'Target IP',
                width: 6,
                default: '192.168.1.70',
            },
            {
                type: 'number',
                label: 'MIDI Base Channel',
                id: 'midiBase',
                tooltip: 'The base channel selected in Utility / Control / MIDI and cannot exceed 12',
                min: 1,
                max: 12,
                default: 1,
                step: 1,
                required: true,
                range: false,
            },
        ];
    }
    init_tcp = async () => {
        const self = this;
        if (this.tcpSocket !== undefined) {
            this.tcpSocket.destroy();
            delete this.tcpSocket;
        }
        if (this.config.host) {
            this.tcpSocket = new net.Socket().connect({
                host: this.config.host,
                port: PORT
            });
            this.tcpSocket.on('status_change', (status, message) => {
                this.updateStatus(status, message);
            });
            this.tcpSocket.on('error', (err) => {
                self.log('error', 'TCP error: ' + err.message);
            });
            this.tcpSocket.on('connect', () => {
                self.log('debug', `TCP Connected to ${this.config.host}`);
            });
            this.tcpSocket.on('data', (data) => {
                self.validateResponseData(data);
            });
        }
    };
    updateVariables() {
        throw new Error('Method not implemented.');
    }
    validateResponseData(data) {
        if (!data) {
            return;
        }
        const val = JSON.parse(JSON.stringify(data))['data'];
        if (!val) {
            return;
        }
        console.log(`Response DATA:  ${JSON.stringify(val, null, 2)}`);
    }
    /**
     * Sets up a Constant Scenes selection.
     *
     * @returns {void}
     * @access private
     * @since 1.0.0
     */
    setupSceneSelection() {
        this.scenes = [];
        let getSceneBank = (sceneNumber) => {
            if (sceneNumber <= 128) {
                return 0x00;
            }
            if (sceneNumber <= 256) {
                return 0x01;
            }
            if (sceneNumber <= 384) {
                return 0x02;
            }
            return 0x03;
        };
        let getSceneSSNumber = (sceneNumber) => {
            if (sceneNumber > 128) {
                do {
                    sceneNumber -= 128;
                } while (sceneNumber > 128);
            }
            return sceneNumber - 1;
        };
        for (let i = 1; i <= avantisconfig_json_1.default.config.sceneCount; i++) {
            this.scenes.push({
                sceneNumber: i,
                block: getSceneBank(i),
                ss: getSceneSSNumber(i),
            });
        }
    }
    /**
     * Executes the provided action.
     *
     * @param {Object} action - the action to be executed
     * @access public
     * @since 1.0.0
     */
    action = (action) => {
        console.log('action execute:');
        var opt = action.options;
        let bufferCommands = [];
        // Have to Minus 1 for converting it to Hex on Send
        let midiBase = this.config.midiBase - 1;
        switch (action.action // Note that only available actions for the type (TCP or MIDI) will be processed
        ) {
            case 'mute_input':
                bufferCommands = this.buildMuteCommand(opt, midiBase);
                break;
            case 'fader_input':
                bufferCommands = this.buildFaderCommand(opt, midiBase);
                break;
            case 'mute_mono_group':
            case 'mute_stereo_group':
                bufferCommands = this.buildMuteCommand(opt, midiBase + 1);
                break;
            case 'fader_mono_group':
            case 'fader_stereo_group':
                bufferCommands = this.buildFaderCommand(opt, midiBase + 1);
                break;
            case 'mute_mono_aux':
            case 'mute_stereo_aux':
                bufferCommands = this.buildMuteCommand(opt, midiBase + 2);
                break;
            case 'fader_mono_aux':
            case 'fader_stereo_aux':
                bufferCommands = this.buildFaderCommand(opt, midiBase + 2);
                break;
            case 'mute_mono_matrix':
            case 'mute_stereo_matrix':
                bufferCommands = this.buildMuteCommand(opt, midiBase + 3);
                break;
            case 'fader_mono_matrix':
            case 'fader_stereo_matrix':
                bufferCommands = this.buildFaderCommand(opt, midiBase + 3);
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
                bufferCommands = this.buildFaderCommand(opt, midiBase + 4);
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
                bufferCommands = this.buildSendLevelCommand(opt, midiBase, 0, 2);
                break;
            case 'send_input_to_mono_aux_number':
                bufferCommands = this.buildSendLevelNumberCommand(opt, midiBase, 0, 2);
                break;
            case 'send_input_to_stereo_aux':
                bufferCommands = this.buildSendLevelCommand(opt, midiBase, 0, 2);
                break;
            case 'send_input_to_mono_matrix':
                bufferCommands = this.buildSendLevelCommand(opt, midiBase, 0, 3);
                break;
            case 'send_input_to_stereo_matrix':
                bufferCommands = this.buildSendLevelCommand(opt, midiBase, 0, 3);
                break;
            case 'send_input_to_fx_return':
                bufferCommands = this.buildSendLevelCommand(opt, midiBase, 0, 4);
                break;
            case 'send_input_to_mono_fx_return':
                bufferCommands = this.buildSendLevelCommand(opt, midiBase, 0, 4);
                break;
            case 'send_input_to_stereo_fx_return':
                bufferCommands = this.buildSendLevelCommand(opt, midiBase, 0, 4);
                break;
            case 'send_input_to':
                bufferCommands = this.buildSendLevelCommand(opt, midiBase, 0, 4);
                break;
            // MIDI Transport
            // MIDI Strips
            // SoftKeys
        }
        console.log(bufferCommands);
        for (let i = 0; i < bufferCommands.length; i++) {
            if (this.tcpSocket) {
                this.dumpData(opt, midiBase, bufferCommands);
                this.log('debug', `sending '${bufferCommands[i].toString('hex')}' ${i}/${bufferCommands.length} via TCP @${this.config.host}`);
                this.tcpSocket.write(bufferCommands[i]);
            }
        }
    };
    buildMuteCommand(opt, midiOffset) {
        // 9N, CH, 7F(3F), 9N, CH, 00
        return [Buffer.from([0x90 + midiOffset, opt.channel, opt.mute ? 0x7f : 0x3f, 0x90 + midiOffset, opt.channel, 0x00])];
    }
    buildFaderCommand(opt, midiOffset) {
        let faderLevel = parseInt(opt.level);
        // BN, 63, CH, BN, 62, 17, BN, 06, LV
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
        ];
    }
    buildAssignCommands(opt, midiOffset, isDca) {
        let routingCmds = [];
        let groups = isDca ? opt.dcaGroup : opt.muteGroup;
        let offset = 0;
        if (isDca) {
            // DCA
            if (opt.assign) {
                // Assign ON
                offset = 0x40;
            }
        }
        else {
            // Group Mute
            if (opt.assign) {
                // Assign ON
                offset = 0x50;
            }
            else {
                // Assign OFF
                offset = 0x10;
            }
        }
        for (let i = 0; i < groups.length; i++) {
            let grpCode = groups[i];
            // BN, 63, CH, BN, 62, 40, BN, 06, DB(DA)
            routingCmds.push(Buffer.from([
                0xb0 + midiOffset,
                0x63,
                opt.channel,
                0xb0 + midiOffset,
                0x62,
                0x40,
                0xb0 + midiOffset,
                0x06,
                grpCode + offset,
            ]));
        }
        return routingCmds;
    }
    buildSceneCommand(opt, midiOffset) {
        let scene = this.scenes[parseInt(opt.sceneNumber)];
        // BN, 00, Bank, CN, SS
        return [Buffer.from([0xb0 + midiOffset, 0x00, scene.block, 0xc0 + midiOffset, scene.ss])];
    }
    buildChannelAssignCommand(opt, midiOffset) {
        // BN, 63, CH, BN, 62, 18, BN, 06, 7F(3F)
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
        // SysEx Header, 0N, 03, CH, Name, F7
        const commandArray = [...SysExHeader, 0x00 + midiOffset, 0x03, parseInt(opt.channel)];
        // Add Name from opt.channelName
        for (let i = 0; i < opt.channelName.length; i++) {
            const char = opt.channelName[i];
            // @ts-ignore
            const value = avantisconfig_json_1.default.name[char];
            if (value) {
                commandArray.push(parseInt(value, 16));
            }
        }
        commandArray.push(0xf7);
        return [Buffer.from(commandArray)];
    }
    buildChannelColorCommand(opt, midiOffset) {
        // SysEx Header, 0N, 06, CH, Col, F7
        return [Buffer.from([...SysExHeader, 0x00 + midiOffset, 0x06, parseInt(opt.channel), parseInt(opt.color), 0xf7])];
    }
    buildSendLevelCommand(opt, baseMidi, srcMidiChnl, destMidiChnl) {
        // SysEx Header, 0N, 0D, CH, SndN, SndCH, LV, F7
        return [
            Buffer.from([
                ...SysExHeader,
                0x00 + baseMidi + srcMidiChnl,
                0x0d,
                parseInt(opt.srcChannel),
                baseMidi + destMidiChnl,
                opt.destChannel,
                parseInt(opt.level),
                0xf7,
            ]),
        ];
    }
    buildSendLevelNumberCommand(opt, baseMidi, srcMidiChnl, destMidiChnl) {
        const levelMap = [
            ['0', '0x6B'],
            ['-1', '0x69'],
            ['-2', '0x67'],
            ['-3', '0x65'],
            ['-4', '0x63'],
            ['-5', '0x61'],
            ['-6', '0x5F'],
            ['-7', '0x5D'],
            ['-8', '0x5B'],
            ['-9', '0x59'],
            ['-10', '0x57'],
            ['-11', '0x55'],
            ['-13', '0x51'],
            ['-17', '0x49'],
            ['-20', '0x43'],
            ['-24', '0x3B'],
            ['-25', '0x39'],
            ['-30', '0x2F'],
            ['-40', '0x1B'],
            ['-inf', '0x00'],
        ].reverse();
        // @ts-ignore
        const levelAsHexString = levelMap[opt['level-int']][1];
        this.log('debug', `levelAsHexString: ${opt.level} ${levelAsHexString}`);
        // SysEx Header, 0N, 0D, CH, SndN, SndCH, LV, F7
        return [
            Buffer.from([
                ...SysExHeader,
                0x00 + baseMidi + srcMidiChnl,
                0x0d,
                parseInt(opt.srcChannel),
                baseMidi + destMidiChnl,
                opt.destChannel,
                parseInt(levelAsHexString),
                0xf7,
            ]),
        ];
    }
    dumpData(opt, midiBase, bufferCommands) {
        console.log(`dumpData: ${JSON.stringify(opt, null, 2)} ${midiBase} ${bufferCommands}`);
    }
}
(0, base_1.runEntrypoint)(ModuleInstance, [base_1.EmptyUpgradeScript]);
//# sourceMappingURL=main.js.map