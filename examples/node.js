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

//console.log(ToRadio);

const port = new SerialPort({ path: '/dev/ttyUSB0', baudRate: 115200 });

const START1 = 0x94;
const START2 = 0xc3;

const preamble = Buffer.from([START1, START2]);

sendPacket = () => {
	const packet = ToRadio.create({
		wantConfigId: 42
	});

	const data = ToRadio.encode(packet).finish();

	const len = new Buffer(2);
	len.writeInt16BE(data.length);

	port.write(Buffer.concat([preamble, len, data]));
};

const handlePacket = (data) => {
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
		handlePacket(data.slice(4 + packet.length));
	}
};

port.on("data", data => {
	handlePacket(data);
});

sendPacket();
