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

/**
 * @extends instance_skel
 * @since 1.2.0
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
	 * @since 1.2.0
	 */
	actions(system) {
		this.setActions(this.getActions());
	}

	/**
	 * Executes the provided action.
	 *
	 * @param {Object} action - the action to be executed
	 * @access public
	 * @since 1.2.0
	 */
	action(action) {
		let result = {};
		var opt = action.options;
		let bufferCommands = [];

		result.options = opt;
		
		switch (
			action.action // Note that only available actions for the type (TCP or MIDI) will be processed
		) {
			case 'mute_input':
				bufferCommands = this.buildMuteCommand(opt, 0);
				break;

			case 'fader_input':
				bufferCommands = this.buildFaderCommand(opt, 0);
				break;

			case 'mute_mono_group':
			case 'mute_stereo_group':
				bufferCommands = this.buildMuteCommand(opt, 1);
				break;

			case 'fader_mono_group':
			case 'fader_stereo_group':
				bufferCommands = this.buildFaderCommand(opt, 1);
				break;

			case 'mute_mono_aux':
			case 'mute_stereo_aux':
				bufferCommands = this.buildMuteCommand(opt, 2);
				break;

			case 'fader_mono_aux':
			case 'fader_stereo_aux':
				bufferCommands = this.buildFaderCommand(opt, 2);
				break;

			case 'mute_mono_matrix':
			case 'mute_stereo_matrix':
				bufferCommands = this.buildMuteCommand(opt, 3);
				break;

			case 'fader_mono_matrix':
			case 'fader_stereo_matrix':
				bufferCommands = this.buildFaderCommand(opt, 3);
				break;

			case 'mute_mono_fx_send':
			case 'mute_stereo_fx_send':
			case 'mute_fx_return':
			case 'mute_dca':
			case 'mute_master':
				bufferCommands = this.buildMuteCommand(opt, 4);
				break;

			case 'fader_DCA':
			case 'fader_mono_fx_send':
			case 'fader_stereo_fx_send':
			case 'fader_fx_return':
				bufferCommands = this.buildFaderCommand(opt, 4);
				break;

			case 'dca_assign':
				// BN, 63, CH, BN, 62, 40, BN, 06, DB(DA)
				bufferCommands = this.buildAssignCommands(opt, 4, true);
				break

			case 'mute_assign':
				bufferCommands = this.buildAssignCommands(opt, 4, false);
				break
				
			case 'fader_fx_return':
				bufferCommands = this.buildFaderCommand(opt, 4);
				break;

			case 'scene_recall':
				bufferCommands = this.buildSceneCommand(opt, 0);
				break
		}

		for (let i = 0; i < bufferCommands.length; i++) {
			if (this.tcpSocket !== undefined) {
				
				result.Buffer = this.convertBuffer(bufferCommands);
				console.log(`------  ${JSON.stringify(result, null, 2)}`);

				this.log('debug', `sending '${bufferCommands[i].toString('hex')}' ${i}/${bufferCommands.length} via TCP @${this.config.host}`);
				// this.tcpSocket.write(bufferCommands[i]);
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

		if (isDca && !opt.assign) { // DCA and Assign OFF
			offset = 0x40;
		} else if (!isDca) { 		// Group Mute
			if (opt.assign) { 		// Assign ON
				offset = 0x10;
			} else {				// Assign OFF
				offset = 0x50;
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

	// Remove This Method
	convertBuffer(buffers) {
		let result = [];
		for (let x = 0; x < buffers.length; x++) {

			let val = 0;
			let bufferValue = '';
			const buffer = buffers[x].toString('hex');

			for (let i = 0; i < buffer.length; i++) {
				if (val == 2) {
					bufferValue += ' ';
					val = 0;
				}
				const element = buffer[i];
				bufferValue += element;
				val++;
			}
			result.push(bufferValue);
		}
		
		return result;
	}

	/**
	 * Creates the configuration fields for web config.
	 *
	 * @returns {Array} the config fields
	 * @access public
	 * @since 1.2.0
	 */
	config_fields() {
		return [
			{
				type: 'text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'This module is for the Allen & Heath Avantis mixers',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 6,
				default: '192.168.1.70',
				regex: this.REGEX_IP,
			}
		];
	}

	/**
	 * Clean up the instance before it is destroyed.
	 *
	 * @access public
	 * @since 1.2.0
	 */
	destroy() {
		if (this.tcpSocket !== undefined) {
			this.tcpSocket.destroy();
		}

		this.log('debug', `destroyed ${this.id}`);
	}

	/**
	 * Main initialization function called once the module
	 * is OK to start doing things.
	 *
	 * @access public
	 * @since 1.2.0
	 */
	init() {
		this.updateConfig(this.config);
	}

	/**
	 * INTERNAL: use setup data to initalize the tcp tcpSocket object.
	 *
	 * @access protected
	 * @since 1.2.0
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

	setupSceneSelection() {
		this.scenes = [];

		for (let i = 1; i <= avantisConfig.config.sceneCount; i++) {
			this.scenes.push({
				sceneNumber: i, 
				block: this.getSceneBank(i), 
				ss: this.getSceneSSNumber(i)
			});
		}
	}
	
	getSceneBank(sceneNumber) {
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
	}
	
	getSceneSSNumber(sceneNumber) {
		if (sceneNumber > 128) {
			do {
				sceneNumber -= 128;
			
			} while (sceneNumber > 128);
		}
		return sceneNumber - 1;
	}

	/**
	 * Process an updated configuration array.
	 *
	 * @param {Object} config - the new configuration
	 * @access public
	 * @since 1.2.0
	 */
	updateConfig(config) {
		this.config = config;

		this.actions();
		this.init_tcp();
		this.setupSceneSelection();
	}
}

exports = module.exports = instance
