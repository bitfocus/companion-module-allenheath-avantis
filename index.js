/**
 *
 * Companion instance class for the A&H Avantis Mixer.
 * @version 1.0.0
 *
 */

let tcp = require('../../tcp')
let instance_skel = require('../../instance_skel')
let actions = require('./actions')
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
	}
}

exports = module.exports = instance
