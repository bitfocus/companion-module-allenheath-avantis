/**
 *
 * Companion instance class for the A&H Avantis Mixer.
 * @version 1.0.0
 *
 */

let tcp = require('../../tcp')
let instance_skel = require('../../instance_skel')
let actions = require('./actions')

const avantisConfig = require('./avantisconfig.json')
const PORT = 51325
const SysExHeader = [0xF0, 0x00, 0x00, 0x1A, 0x50, 0x10, 0x01, 0x00]

/**
 * @extends instance_skel
 * @since 1.0.0
 * @author Shaun Brown
 */

class instance extends instance_skel {
	/**
	 * Create an instance.
	 *
	 * @param {EventEmitter} system - the brains of the operation
	 * @param {string} id - the instance ID
	 * @param {Object} config - saved user configuration parameters
	 * @since 1.2.0
	 */
	constructor(system, id, config) {
		super(system, id, config);
		
		Object.assign(this, {
			...actions
		});
	}

	/**
	 * Setup the actions.
	 *
	 * @param {EventEmitter} system - the brains of the operation
	 * @access public
	 * @since 1.0.0
	 */
	actions(system) {
		this.setActions(this.getActions());
	}

	/**
	 * Process an updated configuration array.
	 *
	 * @param {Object} config - the new configuration
	 * @access public
	 * @since 1.0.0
	 */
	updateConfig(config) {
		this.config = config;

		this.actions();
		this.init_tcp();
	}

	/**
	 * Main initialization function called once the module
	 * is OK to start doing things.
	 *
	 * @access public
	 * @since 1.0.0
	 */
	init() {
		this.updateConfig(this.config);
		this.setupSceneSelection();
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
				regex: this.REGEX_IP,
			},
			{
				type: 'number',
				label: 'MIDI Base Channel',
				id: 'midiBase',
				tooltip: 'The base channel selected in Utility / Control / MIDI and cannot exceed 12',
				min: 0,
				max: 12,
				default: 0,
				step: 1,
				required: true,
				range: false
			  }
		];
	}

	/**
	 * INTERNAL: use setup data to initalize the tcp tcpSocket object.
	 *
	 * @access protected
	 * @since 1.0.0
	 */
	 init_tcp() {
		if (this.tcpSocket !== undefined) {
			this.tcpSocket.destroy();
			delete this.tcpSocket;
		}

		if (this.config.host) {
			this.tcpSocket = new tcp(this.config.host, PORT);

			this.tcpSocket.on('status_change', (status, message) => {
				this.status(status, message);
			});

			this.tcpSocket.on('error', (err) => {
				this.log('error', 'TCP error: ' + err.message);
			});

			this.tcpSocket.on('connect', () => {
				this.log('debug', `TCP Connected to ${this.config.host}`);
			});
		}
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

		for (let i = 1; i <= avantisConfig.config.sceneCount; i++) {
			this.scenes.push({
				sceneNumber: i, 
				block: getSceneBank(i), 
				ss: getSceneSSNumber(i)
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
	action(action) {
		var opt = action.options;
		let bufferCommands = [];
		let midiBase = this.config.midiBase;
		
		switch (
			action.action // Note that only available actions for the type (TCP or MIDI) will be processed
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
				bufferCommands = this.buildSceneCommand(opt, midiBase + 0);
				break;

			case 'channel_main_assign':
				bufferCommands = this.buildChannelAssignCommand(opt, midiBase + 0);
				break;

			case 'channel_name':
				bufferCommands = this.buildChannelNameCommand(opt, midiBase + 0);
				break;

			case 'channel_color':
				bufferCommands = this.buildChannelColorCommand(opt, midiBase + 0);
				break;
			
			case 'send_input_to_mono_aux':
				bufferCommands = this.buildSendLevelCommand(opt, midiBase, 0, 2);
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

			// MIDI Transport
			// MIDI Strips
			// SoftKeys
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
		// 9N, CH, 7F(3F), 9N, CH, 00
		return [
			Buffer.from([
				0x90 + midiOffset, 
				opt.channel, 
				opt.mute ? 0x7f : 0x3f, 
				0x90 + midiOffset, 
				opt.channel, 
				0x00
			])
		];
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
				faderLevel
			])
		];
	}

	buildAssignCommands(opt, midiOffset, isDca) {
		let routingCmds = [];
		let groups = isDca ? opt.dcaGroup : opt.muteGroup;
		let offset = 0;

		if (isDca) { 				// DCA
			if (opt.assign) { 		// Assign ON
				offset = 0x40;
			}
		} else { 					// Group Mute
			if (opt.assign) { 		// Assign ON
				offset = 0x50;
			} else {				// Assign OFF
				offset = 0x10;
			}
		}

		for (let i = 0; i < groups.length; i++) {
			let grpCode = groups[i];

			// BN, 63, CH, BN, 62, 40, BN, 06, DB(DA)
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
					grpCode + offset
				])
			);
		}

		return routingCmds;
	}

	buildSceneCommand(opt, midiOffset) {
		let scene = this.scenes[parseInt(opt.sceneNumber)];
		
		// BN, 00, Bank, CN, SS
		return [
			Buffer.from([
				0xb0 + midiOffset, 
				0x00, 
				scene.block, 
				0xc0 + midiOffset, 
				scene.ss
			])
		];
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
				opt.assign ? 0x7F : 0x3F
			])
		];
	}

	buildChannelNameCommand(opt, midiOffset) {
		// SysEx Header, 0N, 03, CH, Name, F7
		const commandArray = [
			...SysExHeader, 
			0x00 + midiOffset,
			0x03,
			parseInt(opt.channel)
		];

		// Add Name from opt.channelName
		for (let i = 0; i < opt.channelName.length; i++) {
			const char = opt.channelName[i];
			const value = avantisConfig.nameChar[char];
			if (value) {
				commandArray.push(parseInt(value, 16));
			}
		}

		commandArray.push(0xF7);
		return [Buffer.from(commandArray)];
	}

	buildChannelColorCommand(opt, midiOffset) {
		// SysEx Header, 0N, 06, CH, Col, F7
		return [Buffer.from([
			...SysExHeader, 
			0x00 + midiOffset,
			0x06,
			parseInt(opt.channel),
			parseInt(opt.color),
			0xF7
		])];
	}

	buildSendLevelCommand(opt, baseMidi, srcMidiChnl, destMidiChnl) {
		// SysEx Header, 0N, 0D, CH, SndN, SndCH, LV, F7
		return [Buffer.from([
			...SysExHeader, 
			0x00 + baseMidi + srcMidiChnl,
			0x0D,
			parseInt(opt.srcChannel),
			baseMidi + destMidiChnl,
			opt.destChannel,
			parseInt(opt.level),
			0xF7
		])];
	}

	dumpData(opt, midiBase, bufferCommands) {
		const result = {};
		result.options = opt;
		result.midiBase = midiBase;

		result.Buffer = [];

		for (let x = 0; x < bufferCommands.length; x++) {

			let val = 0;
			let bufferValue = '';
			const buffer = bufferCommands[x].toString('hex');

			for (let i = 0; i < buffer.length; i++) {
				if (val == 2) {
					bufferValue += ' ';
					val = 0;
				}
				const element = buffer[i];
				bufferValue += element;
				val++;
			}
			result.Buffer.push(bufferValue);
		}

		console.log(`Result:  ${JSON.stringify(result, null, 2)}`);
	}

	/**
	 * Clean up the instance before it is destroyed.
	 *
	 * @access public
	 * @since 1.0.0
	 */
	 destroy() {
		if (this.tcpSocket !== undefined) {
			this.tcpSocket.destroy();
		}

		this.log('debug', `destroyed ${this.id}`);
	}
}

exports = module.exports = instance
