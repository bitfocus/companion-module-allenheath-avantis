"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetPresets = GetPresets;
const avantisconfig_json_1 = __importDefault(require("./avantisconfig.json"));
const BLACK = 0x000000;
const WHITE = 0xffffff;
const RED = 0xff0000;
const GREEN = 0x00a000;
const BLUE = 0x0040ff;
const AMBER = 0xffa000;
const PURPLE = 0x8000ff;
function GetPresets(config) {
    const presets = {};
    const avantis = avantisconfig_json_1.default.config;
    const inputCount = config?.inputCount ?? avantis.inputCount;
    const addButton = (id, category, name, text, actions, bgcolor = BLACK, color = WHITE) => {
        presets[id] = {
            type: 'button',
            category,
            name,
            style: {
                text,
                size: '18',
                color,
                bgcolor,
            },
            feedbacks: [],
            steps: [
                {
                    down: actions,
                    up: [],
                },
            ],
        };
    };
    const inputChannel = (channel) => channel - 1;
    const mainMix = (mix) => mix + 0x2f;
    const dca = (dcaNumber) => dcaNumber + 0x35;
    const muteGroup = (group) => group + 0x45;
    const channelRange = (start, end) => Array.from({ length: end - start + 1 }, (_value, index) => start + index);
    for (let channel = 1; channel <= inputCount; channel++) {
        const channelId = inputChannel(channel);
        addButton(`mute_input_${channel}`, 'Input Mutes', `Mute CH ${channel}`, `CH ${channel}\nMUTE`, [{ actionId: 'mute_input', options: { channel: channelId, mute: true } }], RED);
        addButton(`unmute_input_${channel}`, 'Input Mutes', `Unmute CH ${channel}`, `CH ${channel}\nON`, [{ actionId: 'mute_input', options: { channel: channelId, mute: false } }], GREEN);
        addButton(`fader_input_0db_${channel}`, 'Input Faders', `CH ${channel} to 0 dB`, `CH ${channel}\n0 dB`, [{ actionId: 'fader_input', options: { channel: channelId, level: 0x6b } }], BLUE);
        addButton(`fader_input_off_${channel}`, 'Input Faders', `CH ${channel} to -inf`, `CH ${channel}\n-inf`, [{ actionId: 'fader_input', options: { channel: channelId, level: 0x00 } }], BLACK);
    }
    for (let start = 1; start <= inputCount; start += 8) {
        const end = Math.min(start + 7, inputCount);
        const muteActions = channelRange(start, end).map((channel) => ({
            actionId: 'mute_input',
            options: { channel: inputChannel(channel), mute: true },
        }));
        const unmuteActions = channelRange(start, end).map((channel) => ({
            actionId: 'mute_input',
            options: { channel: inputChannel(channel), mute: false },
        }));
        addButton(`mute_input_bank_${start}_${end}`, 'Input Bank Mutes', `Mute CH ${start}-${end}`, `CH ${start}-${end}\nMUTE`, muteActions, RED);
        addButton(`unmute_input_bank_${start}_${end}`, 'Input Bank Mutes', `Unmute CH ${start}-${end}`, `CH ${start}-${end}\nON`, unmuteActions, GREEN);
    }
    addButton('mute_all_inputs', 'Input Bank Mutes', 'Mute All Inputs', `ALL CH\nMUTE`, channelRange(1, inputCount).map((channel) => ({
        actionId: 'mute_input',
        options: { channel: inputChannel(channel), mute: true },
    })), RED);
    addButton('unmute_all_inputs', 'Input Bank Mutes', 'Unmute All Inputs', `ALL CH\nON`, channelRange(1, inputCount).map((channel) => ({
        actionId: 'mute_input',
        options: { channel: inputChannel(channel), mute: false },
    })), GREEN);
    for (let mix = 1; mix <= avantis.mainsCount; mix++) {
        const mixId = mainMix(mix);
        addButton(`mute_main_${mix}`, 'Main Mix', `Mute Main ${mix}`, `MAIN ${mix}\nMUTE`, [{ actionId: 'mute_master', options: { channel: mixId, mute: true } }], RED);
        addButton(`unmute_main_${mix}`, 'Main Mix', `Unmute Main ${mix}`, `MAIN ${mix}\nON`, [{ actionId: 'mute_master', options: { channel: mixId, mute: false } }], GREEN);
        addButton(`fader_main_0db_${mix}`, 'Main Mix', `Main ${mix} to 0 dB`, `MAIN ${mix}\n0 dB`, [{ actionId: 'fader_master', options: { channel: mixId, level: 0x6b } }], BLUE);
    }
    for (let dcaNumber = 1; dcaNumber <= avantis.dcaCount; dcaNumber++) {
        const dcaId = dca(dcaNumber);
        addButton(`mute_dca_${dcaNumber}`, 'DCA', `Mute DCA ${dcaNumber}`, `DCA ${dcaNumber}\nMUTE`, [{ actionId: 'mute_dca', options: { channel: dcaId, mute: true } }], RED);
        addButton(`unmute_dca_${dcaNumber}`, 'DCA', `Unmute DCA ${dcaNumber}`, `DCA ${dcaNumber}\nON`, [{ actionId: 'mute_dca', options: { channel: dcaId, mute: false } }], GREEN);
        addButton(`fader_dca_0db_${dcaNumber}`, 'DCA', `DCA ${dcaNumber} to 0 dB`, `DCA ${dcaNumber}\n0 dB`, [{ actionId: 'fader_DCA', options: { channel: dcaId, level: 0x6b } }], BLUE);
    }
    for (let group = 1; group <= avantis.muteGroupCount; group++) {
        const groupId = muteGroup(group);
        addButton(`mute_group_${group}`, 'Mute Groups', `Mute Group ${group}`, `MUTE GRP ${group}\nMUTE`, [{ actionId: 'mute_group', options: { channel: groupId, mute: true } }], RED);
        addButton(`unmute_group_${group}`, 'Mute Groups', `Unmute Group ${group}`, `MUTE GRP ${group}\nON`, [{ actionId: 'mute_group', options: { channel: groupId, mute: false } }], GREEN);
    }
    for (let scene = 1; scene <= Math.min(avantis.sceneCount, 100); scene++) {
        const bankStart = Math.floor((scene - 1) / 25) * 25 + 1;
        const bankEnd = Math.min(bankStart + 24, avantis.sceneCount);
        addButton(`scene_recall_${scene}`, `Scenes ${bankStart}-${bankEnd}`, `Recall Scene ${scene}`, `SCENE\n${scene}`, [{ actionId: 'scene_recall', options: { sceneNumber: scene - 1 } }], PURPLE);
    }
    for (let aux = 1; aux <= Math.min(avantis.mono.auxCount, 16); aux++) {
        addButton(`send_ch1_mono_aux_${aux}_0db`, 'Send Levels', `Send CH 1 to Mono Aux ${aux} at 0 dB`, `CH 1 > AUX ${aux}\n0 dB`, [{ actionId: 'send_input_to_mono_aux', options: { srcChannel: [0], destChannel: aux - 1, level: 0x6b } }], AMBER, BLACK);
    }
    addButton('channel_1_name', 'Channel Name & Color', 'Set CH 1 Name', `CH 1\nNAME`, [{ actionId: 'channel_name', options: { channel: 0, channelName: 'CH 1' } }], BLUE);
    const colors = [
        ['red', 'Red', 1, RED],
        ['green', 'Green', 2, GREEN],
        ['yellow', 'Yellow', 3, AMBER],
        ['blue', 'Blue', 4, BLUE],
        ['purple', 'Purple', 5, PURPLE],
    ];
    for (const [id, label, colorId, bgcolor] of colors) {
        addButton(`channel_1_color_${id}`, 'Channel Name & Color', `Set CH 1 ${label}`, `CH 1\n${label.toUpperCase()}`, [{ actionId: 'channel_color', options: { channel: 0, color: colorId } }], bgcolor, id === 'yellow' || id === 'green' ? BLACK : WHITE);
    }
    return presets;
}
//# sourceMappingURL=presets.js.map