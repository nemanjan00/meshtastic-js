const events = require("events");
const SerialPort = require("serialport").SerialPort;

const models = require("../models");

const START1 = 0x94;
const START2 = 0xc3;

const preamble = Buffer.from([START1, START2]);

const interfaceFactory = (devPath) => {
	const port = new SerialPort({ path: devPath, baudRate: 115200 });
	const pipeline = new events.EventEmitter();

	const interface = {
		pipeline,
		sendPacket: (packet) => {
			const data = models.ToRadio.encode(packet).finish();

			const len = Buffer.alloc(2);
			len.writeInt16BE(data.length);

			port.write(Buffer.concat([preamble, len, data]));
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

module.exports = interfaceFactory;
