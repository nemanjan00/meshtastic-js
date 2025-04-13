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
		_buffer: Buffer.from([]),

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

		_handlePacket: () => {
			const start1 = interface._buffer.indexOf(START1);

			if(start1 === -1) {
				return;
			}

			const start2 = interface._buffer.indexOf(START2);

			if(start2 === -1) {
				return;
			}

			if(interface._buffer.length < start2 + 3) {
				return;
			}

			const len = interface._buffer.readInt16BE(start2 + 1);

			const packet = interface._buffer.slice(start1 + 4, start1 + 4 + len);

			if(packet.length < len) {
				return;
			}

			try {
				const decoded = models.FromRadio.decode(packet);

				interface._handleMessage(decoded);
			} catch (error) {
				console.error(error);
			}

			interface._buffer = interface._buffer.slice(start1 + 4 + len)

			interface._handlePacket();
		},

		_handleData: (data) => {
			interface._buffer = Buffer.concat([interface._buffer, data]);

			interface._handlePacket(data);
		}
	};

	port.on("data", data => {
		interface._handleData(data);
	});

	return interface;
};

module.exports = interfaceFactory;
