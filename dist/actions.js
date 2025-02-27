"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const fader_json_1 = __importDefault(require("./fader.json"));
const avantisconfig_json_1 = __importDefault(require("./avantisconfig.json"));
// update actions
function default_1(self) {
    self.getActions = () => {
        self.log('debug', 'getActions');
        let actions = {};
        var avantis = avantisconfig_json_1.default['config'];
        self.buildChoices = (name, key, qty, ofs) => {
            const choice = {
                name: name,
                offset: ofs,
                values: [],
            };
            for (let i = 1; i <= qty; i++) {
                choice.values.push({ label: `${key} ${i}`, id: i + ofs, offset: ofs });
            }
            return choice;
        };
        // -----------------------
        // CHOICES
        // -----------------------
        self.CHOICES_INPUT_CHANNEL = self.buildChoices(`Input Channel`, `CH`, avantis.inputCount, -1);
        self.CHOICES_SCENES = self.buildChoices(`Scene`, `SCENE`, avantis.sceneCount, -1);
        self.CHOICES_DCA = self.buildChoices(`DCA`, `DCA`, avantis.dcaCount, 0x35);
        self.CHOICES_MUTE_GROUP = self.buildChoices(`Mute Group`, `MUTE`, avantis.muteGroupCount, 0x45);
        self.CHOICES_MAIN_MIX = self.buildChoices(`Main Mix`, `MAIN`, avantis.mainsCount, 0x2f);
        self.CHOICES_MONO_GROUP = self.buildChoices(`Mono Group`, `Mono Group`, avantis.mono.groupCount, -1);
        self.CHOICES_STEREO_GROUP = self.buildChoices(`Stereo Group`, `Stereo Group`, avantis.stereo.groupCount, 0x3f);
        self.CHOICES_MONO_AUX = self.buildChoices(`Mono Aux`, `Mono Aux`, avantis.mono.auxCount, -1);
        self.CHOICES_STEREO_AUX = self.buildChoices(`Stereo Aux`, `Stereo Aux`, avantis.stereo.auxCount, 0x3f);
        self.CHOICES_MONO_MATRIX = self.buildChoices(`Mono Matrix`, `Mono Matrix`, avantis.mono.matrixCount, -1);
        self.CHOICES_STEREO_MATRIX = self.buildChoices(`Stereo Matrix`, `Stereo Matrix`, avantis.stereo.matrixCount, 0x3f);
        self.CHOICES_MONO_FX_SEND = self.buildChoices(`Mono FX Send`, `Mono FX Send`, avantis.stereo.fxSendCount, -1);
        self.CHOICES_STEREO_FX_SEND = self.buildChoices(`Stereo FX Send`, `Stereo FX Send`, avantis.stereo.fxSendCount, 0x0f);
        self.CHOICES_FX_RETURN = self.buildChoices(`FX Return`, `FX Return`, avantis.fxReturnCount, 0x1f);
        self.CHOICES_FADER = {
            name: `Fader Level`,
            offset: -1,
            values: [],
        };
        for (let i = 0; i < fader_json_1.default.level.length; i++) {
            let dbStr = fader_json_1.default.level[i][0];
            // TODO: Check if the Offset fixes the fader changed value
            self.CHOICES_FADER.values.push({ label: `${dbStr} dB`, id: parseInt(fader_json_1.default.level[i][1], 16) });
        }
        self.CHOICES_COLOR = {
            name: `Color`,
            offset: -1,
            values: [
                { label: `Off`, id: 0 },
                { label: `Red`, id: 1 },
                { label: `Green`, id: 2 },
                { label: `Yellow`, id: 3 },
                { label: `Blue`, id: 4 },
                { label: `Purple`, id: 5 },
                { label: `Lt Blue`, id: 6 },
                { label: `White`, id: 7 },
            ],
        };
        // -----------------------
        // OPTIONS
        // -----------------------
        self.muteActionBuilder = (label, choice) => {
            return {
                name: label,
                options: [
                    {
                        type: 'dropdown',
                        label: choice.name,
                        id: 'channel',
                        default: 1 + choice.offset,
                        choices: choice.values,
                        minChoicesForSearch: 0,
                    },
                    {
                        type: 'checkbox',
                        label: 'Mute',
                        id: 'mute',
                        default: true,
                    },
                ],
                callback: (action, context) => {
                    self.action({
                        action: action.actionId,
                        options: action.options,
                    });
                },
            };
        };
        self.faderActionBuilder = (label, choice) => {
            return {
                name: label,
                options: [
                    {
                        type: 'dropdown',
                        label: choice.name,
                        id: 'channel',
                        default: 1 + choice.offset,
                        choices: choice.values,
                        minChoicesForSearch: 0,
                    },
                    {
                        type: 'dropdown',
                        label: self.CHOICES_FADER.name,
                        id: 'level',
                        default: 1 + self.CHOICES_FADER.offset,
                        choices: self.CHOICES_FADER.values,
                        minChoicesForSearch: 0,
                    },
                ],
                callback: (action, context) => {
                    self.action({
                        action: action.actionId,
                        options: action.options,
                    });
                },
            };
        };
        self.sendLevelActionBuilder = (label, srcChoice, destChoice) => {
            return {
                name: label,
                options: [
                    {
                        type: 'dropdown',
                        label: srcChoice.name,
                        id: 'srcChannel',
                        default: [],
                        multiple: true,
                        choices: srcChoice.values,
                        minChoicesForSearch: 0,
                    },
                    {
                        type: 'dropdown',
                        label: destChoice.name,
                        id: 'destChannel',
                        default: 1 + destChoice.offset,
                        choices: destChoice.values,
                        minChoicesForSearch: 0,
                    },
                    {
                        type: 'dropdown',
                        label: self.CHOICES_FADER.name,
                        id: 'level',
                        default: 1 + self.CHOICES_FADER.offset,
                        choices: self.CHOICES_FADER.values,
                        minChoicesForSearch: 0,
                    },
                ],
                callback: (action, context) => {
                    self.action({
                        action: action.actionId,
                        options: action.options,
                    });
                },
            };
        };
        self.sendLevelActionNumberBuilder = (label, srcChoice, destChoice) => {
            return {
                name: label,
                options: [
                    {
                        type: 'dropdown',
                        label: srcChoice.name,
                        id: 'srcChannel',
                        default: 1 + srcChoice.offset,
                        choices: srcChoice.values,
                        minChoicesForSearch: 0,
                    },
                    {
                        type: 'dropdown',
                        label: destChoice.name,
                        id: 'destChannel',
                        default: 1 + destChoice.offset,
                        choices: destChoice.values,
                        minChoicesForSearch: 0,
                    },
                    {
                        type: 'number',
                        label: 'Level (0-20)',
                        id: 'level-int',
                        min: 0,
                        max: 19,
                        step: 1,
                    },
                ],
                callback: (action, context) => {
                    self.action({
                        action: action.actionId,
                        options: action.options,
                    });
                },
            };
        };
        self.assignActionBuilder = (label, srcChoice, destId, destChoice) => {
            return {
                name: label,
                options: [
                    {
                        type: 'dropdown',
                        label: srcChoice.name,
                        id: 'channel',
                        default: 1 + srcChoice.offset,
                        choices: srcChoice.values,
                        minChoicesForSearch: 0,
                    },
                    {
                        type: 'dropdown',
                        label: destChoice.name,
                        id: destId,
                        default: [],
                        multiple: true,
                        choices: destChoice.values,
                    },
                    {
                        type: 'checkbox',
                        label: 'Assign',
                        id: 'assign',
                        default: true,
                    },
                ],
                callback: (action, context) => {
                    self.action({
                        action: action.actionId,
                        options: action.options,
                    });
                },
            };
        };
        // -----------------------
        // ACTIONS
        // -----------------------
        actions['mute_input'] = self.muteActionBuilder('Mute Input', self.CHOICES_INPUT_CHANNEL);
        actions['mute_master'] = self.muteActionBuilder('Mute Main', self.CHOICES_MAIN_MIX);
        actions['mute_mono_group'] = self.muteActionBuilder('Mute Mono Group', self.CHOICES_MONO_GROUP);
        actions['mute_stereo_group'] = self.muteActionBuilder('Mute Stereo Group', self.CHOICES_STEREO_GROUP);
        actions['mute_mono_aux'] = self.muteActionBuilder('Mute Mono Aux', self.CHOICES_MONO_AUX);
        actions['mute_stereo_aux'] = self.muteActionBuilder('Mute Stereo Aux', self.CHOICES_STEREO_AUX);
        actions['mute_mono_matrix'] = self.muteActionBuilder('Mute Mono Matrix', self.CHOICES_MONO_MATRIX);
        actions['mute_stereo_matrix'] = self.muteActionBuilder('Mute Stereo Matrix', self.CHOICES_STEREO_MATRIX);
        actions['mute_mono_fx_send'] = self.muteActionBuilder('Mute Mono FX Send', self.CHOICES_MONO_FX_SEND);
        actions['mute_stereo_fx_send'] = self.muteActionBuilder('Mute Stereo FX Send', self.CHOICES_STEREO_FX_SEND);
        actions['mute_fx_return'] = self.muteActionBuilder('Mute FX Return', self.CHOICES_FX_RETURN);
        actions['mute_group'] = self.muteActionBuilder('Mute Group', self.CHOICES_MUTE_GROUP);
        actions['mute_dca'] = self.muteActionBuilder('Mute DCA', self.CHOICES_DCA);
        actions['fader_input'] = self.faderActionBuilder('Set Input Fader to Level', self.CHOICES_INPUT_CHANNEL);
        actions['fader_mono_group'] = self.faderActionBuilder('Set Mono Group Master Fader to Level', self.CHOICES_MONO_GROUP);
        actions['fader_stereo_group'] = self.faderActionBuilder('Set Stereo Group Master Fader to Level', self.CHOICES_STEREO_GROUP);
        actions['fader_mono_aux'] = self.faderActionBuilder('Set Mono Aux Master Fader to Level', self.CHOICES_MONO_AUX);
        actions['fader_stereo_aux'] = self.faderActionBuilder('Set Stereo Aux Master Fader to Level', self.CHOICES_STEREO_AUX);
        actions['fader_mono_matrix'] = self.faderActionBuilder('Set Mono Matrix Master Fader to Level', self.CHOICES_MONO_MATRIX);
        actions['fader_stereo_matrix'] = self.faderActionBuilder('Set Stereo Matrix Master Fader to Level', self.CHOICES_STEREO_MATRIX);
        actions['fader_mono_fx_send'] = self.faderActionBuilder('Set Mono FX Send Master Fader to Level', self.CHOICES_MONO_FX_SEND);
        actions['fader_stereo_fx_send'] = self.faderActionBuilder('Set Stereo FX Send Master Fader to Level', self.CHOICES_STEREO_FX_SEND);
        actions['fader_master'] = self.faderActionBuilder('Set Main Master Fader to Level', self.CHOICES_MAIN_MIX);
        actions['fader_fx_return'] = self.faderActionBuilder('Set FX Return Fader to Level', self.CHOICES_FX_RETURN);
        actions['fader_DCA'] = self.faderActionBuilder('Set DCA Fader to Level', self.CHOICES_DCA);
        actions['dca_assign'] = self.assignActionBuilder('Assign DCA Groups for channel', self.CHOICES_INPUT_CHANNEL, 'dcaGroup', self.CHOICES_DCA);
        actions['mute_group_assign'] = self.assignActionBuilder('Assign Mute Groups for channel', self.CHOICES_INPUT_CHANNEL, 'muteGroup', self.CHOICES_MUTE_GROUP);
        actions['channel_main_assign'] = self.assignActionBuilder('Assign Channel to Main Mix', self.CHOICES_INPUT_CHANNEL, 'mainMix', self.CHOICES_MAIN_MIX);
        actions['channel_name'] = {
            name: 'Set Channel Name',
            options: [
                {
                    type: 'dropdown',
                    label: self.CHOICES_INPUT_CHANNEL.name,
                    id: 'channel',
                    default: 1 + self.CHOICES_INPUT_CHANNEL.offset,
                    choices: self.CHOICES_INPUT_CHANNEL.values,
                    minChoicesForSearch: 0,
                },
                {
                    type: 'textinput',
                    label: 'Name of the Channel',
                    id: 'channelName',
                    tooltip: 'In this option you can enter whatever you want as long as it is the number one',
                },
            ],
            callback: (action, context) => {
                self.action({
                    action: action.actionId,
                    options: action.options,
                });
            },
        };
        actions['channel_color'] = {
            name: 'Set Channel Color',
            options: [
                {
                    type: 'dropdown',
                    label: self.CHOICES_INPUT_CHANNEL.name,
                    id: 'channel',
                    default: 1 + self.CHOICES_INPUT_CHANNEL.offset,
                    choices: self.CHOICES_INPUT_CHANNEL.values,
                    minChoicesForSearch: 0,
                },
                {
                    type: 'dropdown',
                    label: self.CHOICES_COLOR.name,
                    id: 'color',
                    default: 1 + self.CHOICES_COLOR.offset,
                    choices: self.CHOICES_COLOR.values,
                    minChoicesForSearch: 0,
                },
            ],
            callback: (action, context) => {
                self.action({
                    action: action.actionId,
                    options: action.options,
                });
            },
        };
        actions['scene_recall'] = {
            name: 'Scene recall',
            options: [
                {
                    type: 'dropdown',
                    label: self.CHOICES_SCENES.name,
                    id: 'sceneNumber',
                    default: 1 + self.CHOICES_SCENES.offset,
                    choices: self.CHOICES_SCENES.values,
                    minChoicesForSearch: 0,
                },
            ],
            callback: (action, context) => {
                self.action({
                    action: action.actionId,
                    options: action.options,
                });
            },
        };
        actions['send_input_to_mono_aux'] = self.sendLevelActionBuilder('Send Input to Mono Aux', self.CHOICES_INPUT_CHANNEL, self.CHOICES_MONO_AUX);
        actions['send_input_to_mono_aux_number'] = self.sendLevelActionNumberBuilder('Send Input to Mono Aux (Number)', self.CHOICES_INPUT_CHANNEL, self.CHOICES_MONO_AUX);
        actions['send_input_to_stereo_aux'] = self.sendLevelActionBuilder('Send Input to Stereo Aux', self.CHOICES_INPUT_CHANNEL, self.CHOICES_STEREO_AUX);
        actions['send_input_to_fx_return'] = self.sendLevelActionBuilder('Send Input to FX Return', self.CHOICES_INPUT_CHANNEL, self.CHOICES_FX_RETURN);
        actions['send_input_to_mono_fx_return'] = self.sendLevelActionBuilder('Send Input to Mono FX Return', self.CHOICES_INPUT_CHANNEL, self.CHOICES_MONO_FX_SEND);
        actions['send_input_to_stereo_fx_return'] = self.sendLevelActionBuilder('Send Input to Stereo FX Return', self.CHOICES_INPUT_CHANNEL, self.CHOICES_STEREO_FX_SEND);
        actions['send_input_to_mono_matrix'] = self.sendLevelActionBuilder('Send Input to Mono Matrix', self.CHOICES_INPUT_CHANNEL, self.CHOICES_MONO_MATRIX);
        actions['send_input_to_stereo_matrix'] = self.sendLevelActionBuilder('Send Input to Stereo Matrix', self.CHOICES_INPUT_CHANNEL, self.CHOICES_STEREO_MATRIX);
        actions['send_input_to'] = {
            name: 'Send Input to',
            options: [
                {
                    type: 'dropdown',
                    label: self.CHOICES_INPUT_CHANNEL.name,
                    id: 'srcChannel',
                    default: 1 + self.CHOICES_INPUT_CHANNEL.offset,
                    choices: self.CHOICES_INPUT_CHANNEL.values,
                    minChoicesForSearch: 0,
                },
                {
                    type: 'dropdown',
                    label: self.CHOICES_MAIN_MIX.name,
                    id: 'destChannel',
                    default: 1 + self.CHOICES_MAIN_MIX.offset,
                    choices: self.CHOICES_MAIN_MIX.values,
                    minChoicesForSearch: 0,
                },
                {
                    type: 'dropdown',
                    label: self.CHOICES_FADER.name,
                    id: 'level',
                    default: 1 + self.CHOICES_FADER.offset,
                    choices: self.CHOICES_FADER.values,
                    minChoicesForSearch: 0,
                },
            ],
            callback: (action, context) => {
                self.action({
                    action: action.actionId,
                    options: action.options,
                });
            },
        };
        self.log('debug', Object.keys(actions));
        return actions;
    };
    self.setActionDefinitions(self.getActions());
}
//# sourceMappingURL=actions.js.map