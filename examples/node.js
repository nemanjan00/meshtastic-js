const SerialPort = require("serialport").SerialPort;
const protobuf = require("protobufjs");
const path = require("path");

const modelsRoot = new protobuf.Root();

modelsRoot.resolvePath = function (_origin, target) {
	return path.resolve(__dirname, "../protobufs", target);
};

const models = modelsRoot.loadSync("meshtastic/mesh.proto")

const ToRadio = models.lookupType("meshtastic.ToRadio");
const FromRadio = models.lookupType("meshtastic.FromRadio");

const START1 = 0x94;
const START2 = 0xc3;

const preamble = Buffer.from([START1, START2]);

const interfacrFactory = (devPath) => {
	const port = new SerialPort({ path: devPath, baudRate: 115200 });

	const interface = {
		sendPacket: (packet) => {
			const data = ToRadio.encode(packet).finish();

			const len = new Buffer(2);
			len.writeInt16BE(data.length);

			port.write(Buffer.concat([preamble, len, data]));
		},

		getNodeDB: () => {
			const packet = ToRadio.create({
				wantConfigId: 42
			});

			interface.sendPacket(packet);
		},

		_handlePacket: (data) => {
			const len = data.readInt16BE(2);
			const packet = data.slice(4, 4 + len);

			console.log(data.length - packet.length)

			try {
				const decoded = FromRadio.decode(packet);

				console.log(decoded);
			} catch (e) {
				console.log(e.message);
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

interface.getNodeDB();
