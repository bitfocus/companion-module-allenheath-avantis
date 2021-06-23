const fader = require('./fader.json')
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

		this.buildChoices = (name, key, qty, ofs) => {
			const choice = {
				name: name,
				offset: ofs,
				values: []
			};
			for (let i = 1; i <= qty; i++) {
				choice.values.push({ label: `${key} ${i}`, id: i + ofs, offset: ofs })
			}
			return choice;
		}

		// -----------------------
		// CHOICES
		// -----------------------

		this.CHOICES_INPUT_CHANNEL = this.buildChoices(`Input Channel`, `CH`, avantis.inputCount, -1);
		this.CHOICES_SCENES = this.buildChoices(`Scene`, `SCENE`, avantis.sceneCount, -1);
		this.CHOICES_DCA = this.buildChoices(`DCA`, `DCA`, avantis.dcaCount, 0x35);
		this.CHOICES_MUTE_GROUP = this.buildChoices(`Mute Group`, `MUTE`, avantis.muteGroupCount, 0x45);
		this.CHOICES_MAIN_MIX = this.buildChoices(`Main Mix`, `MAIN`, avantis.mainsCount, 0x2F);
		this.CHOICES_MONO_GROUP = this.buildChoices(`Mono Group`, `Mono Group`, avantis.mono.groupCount, -1);
		this.CHOICES_STEREO_GROUP = this.buildChoices(`Stereo Group`, `Stereo Group`, avantis.stereo.groupCount, 0x3f);
		this.CHOICES_MONO_AUX = this.buildChoices(`Mono Aux`, `Mono Aux`, avantis.mono.auxCount, -1);
		this.CHOICES_STEREO_AUX = this.buildChoices(`Stereo Aux`, `Stereo Aux`, avantis.stereo.auxCount, 0x3f);
		this.CHOICES_MONO_MATRIX = this.buildChoices(`Mono Matrix`, `Mono Matrix`, avantis.mono.matrixCount, -1);
		this.CHOICES_STEREO_MATRIX = this.buildChoices(`Stereo Matrix`, `Stereo Matrix`, avantis.stereo.matrixCount, 0x3f);
		this.CHOICES_MONO_FX_SEND = this.buildChoices(`Mono FX Send`, `Mono FX Send`, avantis.stereo.fxSendCount, -1);
		this.CHOICES_STEREO_FX_SEND = this.buildChoices(`Stereo FX Send`, `Stereo FX Send`, avantis.stereo.fxSendCount, 0x0f);
		this.CHOICES_FX_RETURN = this.buildChoices(`FX Return`, `FX Return`, avantis.fxReturnCount, 0x1f);

		this.CHOICES_FADER = {
			name: `Fader Level`,
			offset: -1,
			values: []
		};
		for (let i = 0; i < fader.level.length; i++) {
			let dbStr = fader.level[i][0];
			// TODO: Check if the Offset fixes the fader changed value
			this.CHOICES_FADER.values.push({ label: `${dbStr} dB`, id: parseInt(fader.level[i][1], 16) });
		}

		this.CHOICES_COLOR = {
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
				{ label: `White`, id: 7 }
			]
		};

		// -----------------------
		// OPTIONS
		// -----------------------

		this.muteActionBuilder = (label, choice) => {
			return {
				label: label,
				options: [
					{
						type: 'dropdown',
						label: choice.name,
						id: 'channel',
						default: 1 + choice.offset,
						choices: choice.values,
						minChoicesForSearch: 0
					},
					{
						type: 'checkbox',
						label: 'Mute',
						id: 'mute',
						default: true
					},
				]
			};
		}

		this.faderActionBuilder = (label, choice) => {
			return {
				label: label,
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
						label: this.CHOICES_FADER.name,
						id: 'level',
						default: 1 + this.CHOICES_FADER.offset,
						choices: this.CHOICES_FADER.values,
						minChoicesForSearch: 0,
					}
				]
			};
		}

		this.sendLevelActionBuilder = (label, srcChoice, destChoice) => {
			return {
				label: label,
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
						type: 'dropdown',
						label: this.CHOICES_FADER.name,
						id: 'level',
						default: 1 + this.CHOICES_FADER.offset,
						choices: this.CHOICES_FADER.values,
						minChoicesForSearch: 0,
					}
				]
			};
		}

		this.assignActionBuilder = (label, srcChoice, destId, destChoice) => {
			return {
				label: label,
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
						default: true
					}
				]
			};
		}

		// -----------------------
		// ACTIONS
		// -----------------------

		actions['mute_input'] = this.muteActionBuilder('Mute Input', this.CHOICES_INPUT_CHANNEL);
		actions['mute_master'] = this.muteActionBuilder('Mute Main', this.CHOICES_MAIN_MIX);

		actions['mute_mono_group'] = this.muteActionBuilder('Mute Mono Group', this.CHOICES_MONO_GROUP);
		actions['mute_stereo_group'] = this.muteActionBuilder('Mute Stereo Group', this.CHOICES_STEREO_GROUP);

		actions['mute_mono_aux'] = this.muteActionBuilder('Mute Mono Aux', this.CHOICES_MONO_AUX);
		actions['mute_stereo_aux'] = this.muteActionBuilder('Mute Stereo Aux', this.CHOICES_STEREO_AUX);
		
		actions['mute_mono_matrix'] = this.muteActionBuilder('Mute Mono Matrix', this.CHOICES_MONO_MATRIX);
		actions['mute_stereo_matrix'] = this.muteActionBuilder('Mute Stereo Matrix', this.CHOICES_STEREO_MATRIX);
		
		actions['mute_mono_fx_send'] = this.muteActionBuilder('Mute Mono FX Send', this.CHOICES_MONO_FX_SEND);
		actions['mute_stereo_fx_send'] = this.muteActionBuilder('Mute Stereo FX Send', this.CHOICES_STEREO_FX_SEND);
		actions['mute_fx_return'] = this.muteActionBuilder('Mute FX Return', this.CHOICES_FX_RETURN);

		actions['mute_group'] = this.muteActionBuilder('Mute Group', this.CHOICES_MUTE_GROUP);
		actions['mute_dca'] = this.muteActionBuilder('Mute DCA', this.CHOICES_DCA);

		actions['fader_input'] = this.faderActionBuilder('Set Input Fader to Level', this.CHOICES_INPUT_CHANNEL);
		actions['fader_mono_group'] = this.faderActionBuilder('Set Mono Group Master Fader to Level', this.CHOICES_MONO_GROUP);
		actions['fader_stereo_group'] = this.faderActionBuilder('Set Stereo Group Master Fader to Level', this.CHOICES_STEREO_GROUP);
		actions['fader_mono_aux'] = this.faderActionBuilder('Set Mono Aux Master Fader to Level', this.CHOICES_MONO_AUX);
		actions['fader_stereo_aux'] = this.faderActionBuilder('Set Stereo Aux Master Fader to Level', this.CHOICES_STEREO_AUX);
		actions['fader_mono_matrix'] = this.faderActionBuilder('Set Mono Matrix Master Fader to Level', this.CHOICES_MONO_MATRIX);
		actions['fader_stereo_matrix'] = this.faderActionBuilder('Set Stereo Matrix Master Fader to Level', this.CHOICES_STEREO_MATRIX);
		actions['fader_mono_fx_send'] = this.faderActionBuilder('Set Mono FX Send Master Fader to Level', this.CHOICES_MONO_FX_SEND);
		actions['fader_stereo_fx_send'] = this.faderActionBuilder('Set Stereo FX Send Master Fader to Level', this.CHOICES_STEREO_FX_SEND);
		actions['fader_master'] = this.faderActionBuilder('Set Main Master Fader to Level', this.CHOICES_MAIN_MIX);
		actions['fader_fx_return'] = this.faderActionBuilder('Set FX Return Fader to Level', this.CHOICES_FX_RETURN);
		actions['fader_DCA'] = this.faderActionBuilder('Set DCA Fader to Level', this.CHOICES_DCA);
		
		actions['dca_assign'] = this.assignActionBuilder(
			'Assign DCA Groups for channel',
			this.CHOICES_INPUT_CHANNEL,
			'dcaGroup',
			this.CHOICES_DCA
		);
		actions['mute_group_assign'] = this.assignActionBuilder(
			'Assign Mute Groups for channel',
			this.CHOICES_INPUT_CHANNEL,
			'muteGroup',
			this.CHOICES_MUTE_GROUP
		);
		actions['channel_main_assign'] = this.assignActionBuilder(
			'Assign Channel to Main Mix',
			this.CHOICES_INPUT_CHANNEL,
			'mainMix',
			this.CHOICES_MAIN_MIX
		);

		actions['channel_name'] = {
			label: 'Set Channel Name',
			options: [
				{
					type: 'dropdown',
					label: this.CHOICES_INPUT_CHANNEL.name,
					id: 'channel',
					default: 1 + this.CHOICES_INPUT_CHANNEL.offset,
					choices: this.CHOICES_INPUT_CHANNEL.values,
					minChoicesForSearch: 0,
				},
				{
					type: 'textinput',
					label: 'Name of the Channel',
					id: 'channelName',
					tooltip: 'In this option you can enter whatever you want as long as it is the number one'
				}
			],
		}

		actions['channel_color'] = {
			label: 'Set Channel Color',
			options: [
				{
					type: 'dropdown',
					label: this.CHOICES_INPUT_CHANNEL.name,
					id: 'channel',
					default: 1 + this.CHOICES_INPUT_CHANNEL.offset,
					choices: this.CHOICES_INPUT_CHANNEL.values,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: this.CHOICES_COLOR.name,
					id: 'color',
					default: 1 + this.CHOICES_COLOR.offset,
					choices: this.CHOICES_COLOR.values,
					minChoicesForSearch: 0,
				}
			],
		}

		actions['scene_recall'] = {
			label: 'Scene recall',
			options: [
				{
					type: 'dropdown',
					label: this.CHOICES_SCENES.name,
					id: 'sceneNumber',
					default: 1 + this.CHOICES_SCENES.offset,
					choices: this.CHOICES_SCENES.values,
					minChoicesForSearch: 0,
				},
			],
		}

		actions['send_input_to_mono_aux'] = this.sendLevelActionBuilder(
			'Send Input to Mono Aux',
			this.CHOICES_INPUT_CHANNEL,
			this.CHOICES_MONO_AUX
		);

		actions['send_input_to_stereo_aux'] = this.sendLevelActionBuilder(
			'Send Input to Stereo Aux',
			this.CHOICES_INPUT_CHANNEL,
			this.CHOICES_STEREO_AUX
		);

		actions['send_input_to_fx_return'] = this.sendLevelActionBuilder(
			'Send Input to FX Return',
			this.CHOICES_INPUT_CHANNEL,
			this.CHOICES_FX_RETURN
		);

		actions['send_input_to_mono_fx_return'] = this.sendLevelActionBuilder(
			'Send Input to Mono FX Return',
			this.CHOICES_INPUT_CHANNEL,
			this.CHOICES_MONO_FX_SEND
		);

		actions['send_input_to_stereo_fx_return'] = this.sendLevelActionBuilder(
			'Send Input to Stereo FX Return',
			this.CHOICES_INPUT_CHANNEL,
			this.CHOICES_STEREO_FX_SEND
		);

		actions['send_input_to_mono_matrix'] = this.sendLevelActionBuilder(
			'Send Input to Mono Matrix',
			this.CHOICES_INPUT_CHANNEL,
			this.CHOICES_MONO_MATRIX
		);

		actions['send_input_to_stereo_matrix'] = this.sendLevelActionBuilder(
			'Send Input to Stereo Matrix',
			this.CHOICES_INPUT_CHANNEL,
			this.CHOICES_STEREO_MATRIX
		);

		actions['send_input_to'] = {
			label: 'Send Input to',
			options:  [
				{
					type: 'dropdown',
					label: this.CHOICES_INPUT_CHANNEL.name,
					id: 'srcChannel',
					default: 1 + this.CHOICES_INPUT_CHANNEL.offset,
					choices: this.CHOICES_INPUT_CHANNEL.values,
					minChoicesForSearch: 0
				},
				{
					type: 'dropdown',
					label: this.CHOICES_MAIN_MIX.name,
					id: 'destChannel',
					default: 1 + this.CHOICES_MAIN_MIX.offset,
					choices: this.CHOICES_MAIN_MIX.values,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: this.CHOICES_FADER.name,
					id: 'level',
					default: 1 + this.CHOICES_FADER.offset,
					choices: this.CHOICES_FADER.values,
					minChoicesForSearch: 0,
				},
			],
		}

		return actions;
	},
}
