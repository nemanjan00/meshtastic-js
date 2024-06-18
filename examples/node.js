const SerialPort = require("serialport").SerialPort;

const events = require("events");

const models = require("../src/models");
const lockFactory = require("../src/lock");

const START1 = 0x94;
const START2 = 0xc3;

const preamble = Buffer.from([START1, START2]);

const interfacrFactory = (devPath) => {
	const port = new SerialPort({ path: devPath, baudRate: 115200 });
	const pipeline = new events.EventEmitter();
	const locker = lockFactory();

	const interface = {
		sendPacket: (packet) => {
			const data = models.ToRadio.encode(packet).finish();

			const len = new Buffer(2);
			len.writeInt16BE(data.length);

			port.write(Buffer.concat([preamble, len, data]));
		},

		getNodeDB: () => {
			const id = Math.round(Math.random() * 1024);

			const packet = models.ToRadio.create({
				wantConfigId: id
			});

			const data = {
				nodes: [],
				channels: [],
				moduleConfig: {},
				config: {}
			};

			return locker.getLock().then(release => {
				return new Promise(resolve => {
					const handler = (message) => {
						if(message.nodeInfo) {
							data.nodes.push(message.nodeInfo);

							return;
						}

						if(message.channel) {
							data.channels.push(message.channel);

							return;
						}

						if(message.moduleConfig) {
							data.moduleConfig = {
								...message.moduleConfig,
								...data.moduleConfig
							};

							return;
						}

						if(message.config) {
							data.config = {
								...message.config,
								...data.config
							};

							return;
						}

						if(message.myInfo) {
							data.myInfo = message.myInfo;

							return;
						}

						if(message.metadata) {
							data.metadata = message.metadata;

							return;
						}

						if(message.configCompleteId === id) {
							pipeline.off("message", handler);
							release();

							resolve(data);
						}

						console.log(message);
					};

					pipeline.on("message", handler);

					interface.sendPacket(packet);
				});
			});
		},

		_handleMessage: message => {
			pipeline.emit("message", message);
		},

		_handlePacket: (data) => {
			const len = data.readInt16BE(2);
			const packet = data.slice(4, 4 + len);

			try {
				const decoded = models.FromRadio.decode(packet);

				interface._handleMessage(decoded);
			} catch (error) {
				console.error(error);
			}

			if(data.length - packet.length > 4) {
				interface._handlePacket(data.slice(4 + packet.length));
			}
		},

		_handleData: (data) => {
			// TODO: Do real streaming
			interface._handlePacket(data);
		}
	};

	port.on("data", data => {
		interface._handleData(data);
	});

	return interface;
};

const interface = interfacrFactory("/dev/ttyUSB0");

interface.getNodeDB().then(data => {
	console.log(data);
});
