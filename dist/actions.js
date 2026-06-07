import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fader = require('./fader.json');
const avantisConfig = require('./avantisconfig.json');
function buildChoices(name, key, quantity, offset) {
    const values = [];
    for (let i = 1; i <= quantity; i++) {
        values.push({ label: `${key} ${i}`, id: i + offset });
    }
    return {
        name,
        offset,
        values,
    };
}
function dispatchAction(self, action) {
    self.action({
        action: action.actionId,
        options: action.options,
    });
}
export function UpdateActions(self) {
    self.log('debug', 'UpdateActions');
    const actions = {};
    const avantis = avantisConfig.config;
    const inputChannels = buildChoices('Input Channel', 'CH', avantis.inputCount, -1);
    const scenes = buildChoices('Scene', 'SCENE', avantis.sceneCount, -1);
    const dca = buildChoices('DCA', 'DCA', avantis.dcaCount, 0x35);
    const muteGroups = buildChoices('Mute Group', 'MUTE', avantis.muteGroupCount, 0x45);
    const mainMix = buildChoices('Main Mix', 'MAIN', avantis.mainsCount, 0x2f);
    const monoGroups = buildChoices('Mono Group', 'Mono Group', avantis.mono.groupCount, -1);
    const stereoGroups = buildChoices('Stereo Group', 'Stereo Group', avantis.stereo.groupCount, 0x3f);
    const monoAuxes = buildChoices('Mono Aux', 'Mono Aux', avantis.mono.auxCount, -1);
    const stereoAuxes = buildChoices('Stereo Aux', 'Stereo Aux', avantis.stereo.auxCount, 0x3f);
    const monoMatrices = buildChoices('Mono Matrix', 'Mono Matrix', avantis.mono.matrixCount, -1);
    const stereoMatrices = buildChoices('Stereo Matrix', 'Stereo Matrix', avantis.stereo.matrixCount, 0x3f);
    const monoFxSends = buildChoices('Mono FX Send', 'Mono FX Send', avantis.mono.fxSendCount, -1);
    const stereoFxSends = buildChoices('Stereo FX Send', 'Stereo FX Send', avantis.stereo.fxSendCount, 0x0f);
    const fxReturns = buildChoices('FX Return', 'FX Return', avantis.fxReturnCount, 0x1f);
    const faderChoices = {
        name: 'Fader Level',
        offset: -1,
        values: fader.level.map(([dbValue, hexValue]) => ({
            label: `${dbValue} dB`,
            id: parseInt(hexValue, 16),
        })),
    };
    const colorChoices = {
        name: 'Color',
        offset: -1,
        values: [
            { label: 'Off', id: 0 },
            { label: 'Red', id: 1 },
            { label: 'Green', id: 2 },
            { label: 'Yellow', id: 3 },
            { label: 'Blue', id: 4 },
            { label: 'Purple', id: 5 },
            { label: 'Lt Blue', id: 6 },
            { label: 'White', id: 7 },
        ],
    };
    const muteActionBuilder = (label, choice) => ({
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
        callback: (action) => dispatchAction(self, action),
    });
    const faderActionBuilder = (label, choice) => ({
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
                label: faderChoices.name,
                id: 'level',
                default: 1 + faderChoices.offset,
                choices: faderChoices.values,
                minChoicesForSearch: 0,
            },
        ],
        callback: (action) => dispatchAction(self, action),
    });
    const sendLevelActionBuilder = (label, srcChoice, destChoice) => ({
        name: label,
        options: [
            {
                type: 'multidropdown',
                label: srcChoice.name,
                id: 'srcChannel',
                default: [],
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
                label: faderChoices.name,
                id: 'level',
                default: 1 + faderChoices.offset,
                choices: faderChoices.values,
                minChoicesForSearch: 0,
            },
        ],
        callback: (action) => dispatchAction(self, action),
    });
    const sendLevelActionNumberBuilder = (label, srcChoice, destChoice) => ({
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
                default: 0,
                min: 0,
                max: 19,
                step: 1,
            },
        ],
        callback: (action) => dispatchAction(self, action),
    });
    const assignActionBuilder = (label, srcChoice, destId, destChoice) => ({
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
                type: 'multidropdown',
                label: destChoice.name,
                id: destId,
                default: [],
                choices: destChoice.values,
            },
            {
                type: 'checkbox',
                label: 'Assign',
                id: 'assign',
                default: true,
            },
        ],
        callback: (action) => dispatchAction(self, action),
    });
    actions['mute_input'] = muteActionBuilder('Mute Input', inputChannels);
    actions['mute_master'] = muteActionBuilder('Mute Main Mix', mainMix);
    actions['mute_mono_group'] = muteActionBuilder('Mute Mono Group', monoGroups);
    actions['mute_stereo_group'] = muteActionBuilder('Mute Stereo Group', stereoGroups);
    actions['mute_mono_aux'] = muteActionBuilder('Mute Mono Aux', monoAuxes);
    actions['mute_stereo_aux'] = muteActionBuilder('Mute Stereo Aux', stereoAuxes);
    actions['mute_mono_matrix'] = muteActionBuilder('Mute Mono Matrix', monoMatrices);
    actions['mute_stereo_matrix'] = muteActionBuilder('Mute Stereo Matrix', stereoMatrices);
    actions['mute_mono_fx_send'] = muteActionBuilder('Mute Mono FX Send', monoFxSends);
    actions['mute_stereo_fx_send'] = muteActionBuilder('Mute Stereo FX Send', stereoFxSends);
    actions['mute_fx_return'] = muteActionBuilder('Mute FX Return', fxReturns);
    actions['mute_group'] = muteActionBuilder('Mute Group', muteGroups);
    actions['mute_dca'] = muteActionBuilder('Mute DCA', dca);
    actions['fader_input'] = faderActionBuilder('Set Input Fader to Level', inputChannels);
    actions['fader_mono_group'] = faderActionBuilder('Set Mono Group Master Fader to Level', monoGroups);
    actions['fader_stereo_group'] = faderActionBuilder('Set Stereo Group Master Fader to Level', stereoGroups);
    actions['fader_mono_aux'] = faderActionBuilder('Set Mono Aux Master Fader to Level', monoAuxes);
    actions['fader_stereo_aux'] = faderActionBuilder('Set Stereo Aux Master Fader to Level', stereoAuxes);
    actions['fader_mono_matrix'] = faderActionBuilder('Set Mono Matrix Master Fader to Level', monoMatrices);
    actions['fader_stereo_matrix'] = faderActionBuilder('Set Stereo Matrix Master Fader to Level', stereoMatrices);
    actions['fader_mono_fx_send'] = faderActionBuilder('Set Mono FX Send Master Fader to Level', monoFxSends);
    actions['fader_stereo_fx_send'] = faderActionBuilder('Set Stereo FX Send Master Fader to Level', stereoFxSends);
    actions['fader_master'] = faderActionBuilder('Set Main Mix Master Fader to Level', mainMix);
    actions['fader_fx_return'] = faderActionBuilder('Set FX Return Fader to Level', fxReturns);
    actions['fader_DCA'] = faderActionBuilder('Set DCA Fader to Level', dca);
    actions['dca_assign'] = assignActionBuilder('Assign DCA Groups for Channel', inputChannels, 'dcaGroup', dca);
    actions['mute_group_assign'] = assignActionBuilder('Assign Mute Groups for Channel', inputChannels, 'muteGroup', muteGroups);
    actions['channel_main_assign'] = assignActionBuilder('Assign Channel to Main Mix', inputChannels, 'mainMix', mainMix);
    actions['channel_name'] = {
        name: 'Set Channel Name',
        options: [
            {
                type: 'dropdown',
                label: inputChannels.name,
                id: 'channel',
                default: 1 + inputChannels.offset,
                choices: inputChannels.values,
                minChoicesForSearch: 0,
            },
            {
                type: 'textinput',
                label: 'Name of the Channel',
                id: 'channelName',
                tooltip: 'In this option you can enter whatever you want as long as it is the number one',
            },
        ],
        callback: (action) => dispatchAction(self, action),
    };
    actions['channel_color'] = {
        name: 'Set Channel Color',
        options: [
            {
                type: 'dropdown',
                label: inputChannels.name,
                id: 'channel',
                default: 1 + inputChannels.offset,
                choices: inputChannels.values,
                minChoicesForSearch: 0,
            },
            {
                type: 'dropdown',
                label: colorChoices.name,
                id: 'color',
                default: 1 + colorChoices.offset,
                choices: colorChoices.values,
                minChoicesForSearch: 0,
            },
        ],
        callback: (action) => dispatchAction(self, action),
    };
    actions['scene_recall'] = {
        name: 'Scene Recall',
        options: [
            {
                type: 'dropdown',
                label: scenes.name,
                id: 'sceneNumber',
                default: 1 + scenes.offset,
                choices: scenes.values,
                minChoicesForSearch: 0,
            },
        ],
        callback: (action) => dispatchAction(self, action),
    };
    actions['send_input_to_mono_aux'] = sendLevelActionBuilder('Send Input to Mono Aux', inputChannels, monoAuxes);
    actions['send_input_to_mono_aux_number'] = sendLevelActionNumberBuilder('Send Input to Mono Aux (Number)', inputChannels, monoAuxes);
    actions['send_input_to_stereo_aux'] = sendLevelActionBuilder('Send Input to Stereo Aux', inputChannels, stereoAuxes);
    actions['send_input_to_fx_return'] = sendLevelActionBuilder('Send Input to FX Return', inputChannels, fxReturns);
    actions['send_input_to_mono_fx_return'] = sendLevelActionBuilder('Send Input to Mono FX Return', inputChannels, monoFxSends);
    actions['send_input_to_stereo_fx_return'] = sendLevelActionBuilder('Send Input to Stereo FX Return', inputChannels, stereoFxSends);
    actions['send_input_to_mono_matrix'] = sendLevelActionBuilder('Send Input to Mono Matrix', inputChannels, monoMatrices);
    actions['send_input_to_stereo_matrix'] = sendLevelActionBuilder('Send Input to Stereo Matrix', inputChannels, stereoMatrices);
    actions['send_input_to'] = {
        name: 'Send Input to',
        options: [
            {
                type: 'dropdown',
                label: inputChannels.name,
                id: 'srcChannel',
                default: 1 + inputChannels.offset,
                choices: inputChannels.values,
                minChoicesForSearch: 0,
            },
            {
                type: 'dropdown',
                label: mainMix.name,
                id: 'destChannel',
                default: 1 + mainMix.offset,
                choices: mainMix.values,
                minChoicesForSearch: 0,
            },
            {
                type: 'dropdown',
                label: faderChoices.name,
                id: 'level',
                default: 1 + faderChoices.offset,
                choices: faderChoices.values,
                minChoicesForSearch: 0,
            },
        ],
        callback: (action) => dispatchAction(self, action),
    };
    self.log('debug', Object.keys(actions).join(', '));
    self.setActionDefinitions(actions);
}
export default UpdateActions;
//# sourceMappingURL=actions.js.map