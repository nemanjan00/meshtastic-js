const SerialPort = require("serialport").SerialPort;
const protobuf = require("protobufjs");
const path = require("path");

const modelsRoot = new protobuf.Root();

modelsRoot.resolvePath = function (_origin, target) {
	return path.resolve(__dirname, "../protobufs", target);
};

const models = modelsRoot.loadSync("meshtastic/mesh.proto")

const ToRadio = models.lookupType("meshtastic.ToRadio");

//console.log(ToRadio);

const port = new SerialPort({ path: '/dev/ttyUSB0', baudRate: 115200 });

const START1 = 0x94;
const START2 = 0xc3;

const packet = ToRadio.create({
	wantConfigId: 42
});

console.log(packet);
const data = ToRadio.encode(packet).finish();

const preamble = Buffer.concat([Buffer.from([START1, START2, 0, 2]), data]);

setInterval(() => {
	port.write(preamble);
}, 100);

port.on("data", data => {
	console.log(data);
});
