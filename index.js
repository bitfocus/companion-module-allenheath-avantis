/**
 *
 * Companion instance class for the A&H Avantis Mixer.
 * @version 1.0.0
 *
 */

let tcp = require('../../tcp')
let instance_skel = require('../../instance_skel')
let actions = require('./actions')
const level = require('./level.json')
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
		let midiOffset = 0;
		let cmd = { 
			port: PORT, 
			buffers: []
		};

		result.options = opt;
		result.hex = {
			key: opt.channel,
			val: this.convertNumberToHex(opt.channel)
		}
		
		switch (
			action.action // Note that only available actions for the type (TCP or MIDI) will be processed
		) {
			case 'fader_input':
			case 'mute_input':
				midiOffset = 0;
				break;

			case 'mute_mono_group':
			case 'mute_stereo_group':
			case 'fader_mono_group':
			case 'fader_stereo_group':
				midiOffset = 1;
				break;

			case 'mute_mono_aux':
			case 'mute_stereo_aux':
			case 'fader_mono_aux':
			case 'fader_stereo_aux':
				midiOffset = 2;
				break;

			case 'mute_mono_matrix':
			case 'mute_stereo_matrix':
			case 'fader_mono_matrix':
			case 'fader_stereo_matrix':
				midiOffset = 3;
				break;

			case 'mute_mono_fx_send':
			case 'mute_stereo_fx_send':
			case 'mute_fx_return':
			case 'mute_dca':
			case 'mute_master':
			case 'fader_DCA':
			case 'fader_mono_fx_send':
			case 'fader_stereo_fx_send':
			case 'fader_fx_return':
				midiOffset = 4;
				break;

			case 'dca_assign':
				// BN, 63, CH, BN, 62, 40, BN, 06, DB(DA)
				cmd.buffers = this.setRouting(opt.channel, opt.dcaGroup, false);
				break

			case 'mute_assign':
				// BN, 63, CH, BN, 62, 40, BN, 06, DB(DA)
				cmd.buffers = this.setRouting(opt.channel, opt.muteGroup, true);
				break

			case 'scene_recall':
				// BN, 00, Bank, CN, SS
				let scene = this.scenes[parseInt(opt.sceneNumber)];
				result.scene = scene;
				cmd.buffers = [
					Buffer.from([
						0xb0 + midiOffset, 
						0x00, 
						scene.block, 
						0xc0 + midiOffset, 
						scene.ss
					])
				];
				break
		}

		if (cmd.buffers.length == 0) {

			// Mute or Fader Level actions
			switch (action.action.slice(0, 4)) {

				case 'mute':
					// 9N, CH, 7F(3F), 9N, CH, 00
					cmd.buffers = [
						Buffer.from([
							0x90 + midiOffset, 
							opt.channel, 
							opt.mute ? 0x7f : 0x3f, 
							0x90 + midiOffset, 
							opt.channel, 
							0x00
						])
					];
					break;

				case 'fader':
					// BN, 63, CH, BN, 62, 17, BN, 06, LV
					let faderLevel = parseInt(opt.level)
					cmd.buffers = [
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
					break;
			}
		}


		for (let i = 0; i < cmd.buffers.length; i++) {
			if (this.tcpSocket !== undefined) {
				
				result.BufferRaw = [...cmd.buffers[i]];
				result.Buffer = cmd.buffers[i].toString('hex');

				console.log(`------  ${JSON.stringify(result, null, 2)}`);

				this.log('debug', `sending ${cmd.buffers[i].toString('hex')} via TCP @${this.config.host}`);
				// this.tcpSocket.write(cmd.buffers[i]);
			}
		}
	}

	setRouting(ch, selArray, isMute) {
		let routingCmds = [];
		let start = isMute ? this.dcaCount : 0;
		let qty = isMute ? 8 : this.dcaCount;
		let chOfs = this.config.model == 'dLive' ? 0 : 0x20;
		for (let i = start; i < start + qty; i++) {
			let grpCode = i + (selArray.includes(`${i - start}`) ? 0x40 : 0);
			routingCmds.push(
				Buffer.from([
					0xb0, 
					0x63, 
					ch + chOfs, 
					0xb0, 
					0x62, 
					0x40, 
					0xb0, 
					0x06, 
					grpCode
				])
			);
		}

		return routingCmds;
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
			let scenePart = i;

			if (scenePart > 128) {
				do {
					scenePart -= 128;
				
				} while (scenePart > 128);
			}

			this.scenes.push({
				sceneNumber: i, 
				block: this.getSceneBank(i), 
				ss: this.convertNumberToHex(scenePart - 1)
			});
		}
	}

	convertNumberToHex(value, offset = 0) {
		let number = value - offset;
		let hexNum = number.toString(16).toUpperCase();
		if ((hexNum.length % 2) > 0) {
			hexNum = "0" + hexNum;
		}
		console.log(`Converted '${value}' to '${hexNum}'`);
		return hexNum;
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
