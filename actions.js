const level = require('./level.json')
const avantisConfig = require('./avantisconfig.json')

module.exports = {
	/**
	 * Get the available actions.
	 *
	 * @returns {Object[]} the available actions
	 * @access public
	 * @since 1.2.0
	 */

	getActions() {
		let actions = {};
		
		var avantis = avantisConfig['config'];

		this.buildChoices = (name, qty, ofs) => {
			const choices = [];
			for (let i = 1; i <= qty; i++) {
				choices.push({ label: `${name} ${i}`, id: i + ofs })
			}
			return choices;
		}

		// -----------------------
		// CHOICES
		// -----------------------

		this.CHOICES_INPUT_CHANNEL = this.buildChoices(`CH`, avantis.inputCount, -1);
		this.CHOICES_SCENES = this.buildChoices(`SCENE`, avantis.sceneCount, -1);
		this.CHOICES_DCA = this.buildChoices(`DCA`, avantis.dcaCount, -1);
		this.CHOICES_MUTE = this.buildChoices(`MUTE`, avantis.muteGroupCount, -1);

		this.CHOICES_FADER = []
		this.CHOICES_FADER.push({ label: `Step fader +1 dB`, id: 999 })
		this.CHOICES_FADER.push({ label: `Step fader -1 dB`, id: 998 })
		for (let i = 0; i < level.level.length; i++) {
			let dbStr = level.level[i][0];
			this.CHOICES_FADER.push({ label: `${dbStr} dB`, id: parseInt(level.level[i][1], 16) });
		}

		// -----------------------
		// OPTIONS
		// -----------------------

		this.muteOptions = (name, qty, ofs) => {
			const choices = this.buildChoices(name, qty, ofs);
			return [
				{
					type: 'dropdown',
					label: name,
					id: 'channel',
					default: 1 + ofs,
					choices: choices,
					minChoicesForSearch: 0
				},
				{
					type: 'checkbox',
					label: 'Mute',
					id: 'mute',
					default: true
				},
			]
		}

		this.faderOptions = (name, qty, ofs) => {
			const choices = this.buildChoices(name, qty, ofs);
			return [
				{
					type: 'dropdown',
					label: name,
					id: 'channel',
					default: 1 + ofs,
					choices: choices,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Level',
					id: 'level',
					default: 0,
					choices: this.CHOICES_FADER,
					minChoicesForSearch: 0,
				},
			]
		}

		// -----------------------
		// ACTIONS
		// -----------------------

		actions['mute_input'] = {
			label: 'Mute Input',
			options: this.muteOptions('Input Channel', avantis.inputCount, -1),
		}
		actions['mute_mono_group'] = {
			label: 'Mute Mono Group',
			options: this.muteOptions('Mono Group', avantis.mono.groupCount, -1),
		}
		actions['mute_stereo_group'] = {
			label: 'Mute Stereo Group',
			options: this.muteOptions('Stereo Group', avantis.stereo.groupCount, 0x3f),
		}
		actions['mute_mono_aux'] = {
			label: 'Mute Mono Aux',
			options: this.muteOptions('Mono Aux', avantis.mono.auxCount, -1),
		}
		actions['mute_stereo_aux'] = {
			label: 'Mute Stereo Aux',
			options: this.muteOptions('Stereo Aux', avantis.stereo.auxCount, 0x3f),
		}
		actions['mute_mono_matrix'] = {
			label: 'Mute Mono Matrix',
			options: this.muteOptions('Mono Matrix', avantis.mono.matrixCount, -1),
		}
		actions['mute_stereo_matrix'] = {
			label: 'Mute Stereo Matrix',
			options: this.muteOptions('Stereo Matrix', avantis.stereo.matrixCount, 0x3f),
		}
		actions['mute_mono_fx_send'] = {
			label: 'Mute Mono FX Send',
			options: this.muteOptions('Mono FX Send', avantis.mono.fxSendCount, -1),
		}
		actions['mute_stereo_fx_send'] = {
			label: 'Mute Stereo FX Send',
			options: this.muteOptions('Stereo FX Send', avantis.stereo.fxSendCount, 0x0f),
		}
		actions['mute_fx_return'] = {
			label: 'Mute FX Return',
			options: this.muteOptions('FX Return', avantis.fxReturnCount, 0x1f),
		}
		actions['mute_master'] = {
			label: 'Mute Group Master',
			options: this.muteOptions('Mute Group Master', avantis.muteGroupCount, 0x45),
		}
		actions['mute_dca'] = {
			label: 'Mute DCA',
			options: this.muteOptions('DCA', avantis.dcaCount, 0x35),
		}
		actions['fader_input'] = {
			label: 'Set Input Fader to Level',
			options: this.faderOptions('Channel', avantis.inputCount, -1),
		}
		actions['fader_mono_group'] = {
			label: 'Set Mono Group Master Fader to Level',
			options: this.faderOptions('Mono Group', avantis.mono.groupCount, -1),
		}
		actions['fader_stereo_group'] = {
			label: 'Set Stereo Group Master Fader to Level',
			options: this.faderOptions('Stereo Group', avantis.stereo.groupCount, 0x3f),
		}
		actions['fader_mono_aux'] = {
			label: 'Set Mono Aux Master Fader to Level',
			options: this.faderOptions('Mono Aux', avantis.mono.auxCount, -1),
		}
		actions['fader_stereo_aux'] = {
			label: 'Set Stereo Aux Master Fader to Level',
			options: this.faderOptions('Stereo Aux', avantis.stereo.auxCount, 0x3f),
		}
		actions['fader_mono_matrix'] = {
			label: 'Set Mono Matrix Master Fader to Level',
			options: this.faderOptions('Mono Matrix', avantis.mono.matrixCount, -1),
		}
		actions['fader_stereo_matrix'] = {
			label: 'Set Stereo Matrix Master Fader to Level',
			options: this.faderOptions('Stereo Matrix', avantis.stereo.matrixCount, 0x3f),
		}
		actions['fader_mono_fx_send'] = {
			label: 'Set Mono FX Send Master Fader to Level',
			options: this.faderOptions('Mono FX Send', avantis.mono.fxSendCount, -1),
		}
		actions['fader_stereo_fx_send'] = {
			label: 'Set Stereo FX Send Master Fader to Level',
			options: this.faderOptions('Stereo FX Send', avantis.stereo.fxSendCount, 0x0f),
		}
		actions['fader_fx_return'] = {
			label: 'Set FX Return Fader to Level',
			options: this.faderOptions('FX Return', avantis.fxReturnCount, 0x1f),
		}
		actions['fader_DCA'] = {
			label: 'Set DCA Fader to Level',
			options: this.faderOptions('DCA', avantis.dcaCount, 0x35),
		}
		
		actions['dca_assign'] = {
			label: 'Assign DCA Groups for channel',
			options: [
				{
					type: 'dropdown',
					label: 'Input Channel',
					id: 'inputChannel',
					default: '0',
					choices: this.CHOICES_INPUT_CHANNEL,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'DCA',
					id: 'dcaGroup',
					default: [],
					multiple: true,
					choices: this.CHOICES_DCA,
				},
			],
		}

		actions['mute_assign'] = {
			label: 'Assign Mute Groups for channel',
			options: [
				{
					type: 'dropdown',
					label: 'Input Channel',
					id: 'inputChannel',
					default: '0',
					choices: this.CHOICES_INPUT_CHANNEL,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'MUTE',
					id: 'muteGroup',
					default: [],
					multiple: true,
					choices: this.CHOICES_MUTE,
				},
			],
		}

		actions['scene_recall'] = {
			label: 'Scene recall',
			options: [
				{
					type: 'dropdown',
					label: 'Scene Number',
					id: 'sceneNumber',
					default: '0',
					choices: this.CHOICES_SCENES,
					minChoicesForSearch: 0,
				},
			],
		}

		return actions;
	},
}
