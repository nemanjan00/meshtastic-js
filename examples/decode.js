const crypto = require("../src/crypto");
const models = require("../src/models");
const readline = require("readline");

const data = Buffer.from("FFFFFFFF6DE3CE51EDCAC8AD631F006D24566D2A6F94A1D91DAD".split(" ").join(""), "hex");

let counter = 0;

const print = data => {
	try {
		const packet = {
			to: data.readUint32LE(0),
			from: data.readUint32LE(4),
			id: data.readUint32LE(8),
			flagsByte: data.readUint8(12),
			channel: data.readUint8(13),
			nextHop: data.readUint8(14),
			relayNode: data.readUint8(15),
			encrypted: data.slice(16)
		};

		packet.fromHex = packet.from.toString(16);

		packet.flags = {};

		packet.flags.hopLimit = packet.flagsByte & 0x07;
		packet.flags.wantAck = (packet.flagsByte & 0x08) >> 3;
		packet.flags.viaMqtt = (packet.flagsByte & 0x10) >> 4;
		packet.flags.hopStart = (packet.flagsByte & 0xE0) >> 5;

		const keyB64 = "AQ==";

		counter++;

		crypto.decrypt(keyB64, packet).then(data => {
			const decoded = models.Data.decode(data);

			const dataDecoded = models.Data.toObject(decoded, {
				enums: String
			});

			console.log(packet, dataDecoded);
		}).catch(() => {
			console.log(packet, "Not decrypted");
		});
	} catch (error) {
		console.error(`Failed to decode ${data.toString("hex")}`, error);
	}
};

print(data);

const input = readline.createInterface(process.stdin);

input.on("line", line => {
	console.log(line);
	const data = Buffer.from(line, "hex");

	print(data);
});

setInterval(() => {
	console.log(`Packets counter: ${counter}`);

	counter = 0;
}, 60 * 1000);
