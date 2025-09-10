const crypto = require("../src/crypto");
const models = require("../src/models");
const readline = require("readline");

const data = Buffer.from("6D E3 CE 51 DA CA C8 AD E7 1F 00 6D 2B 90 94 26 4C A3 AA 1A E6 84".split(" ").join(""), "hex");

const print = data => {
	const packet = {
		from: data.readUint32LE(),
		id: data.readUint32LE(4),
		to: data.readUint32LE(8),
		encrypted: data.slice(12)
	};

	const keyB64 = "AQ==";

	crypto.decrypt(keyB64, packet).then(data => {
		const decoded = models.Data.decode(data);

		const dataDecoded = models.Data.toObject(decoded, {
			enums: String
		});

		console.log(packet, dataDecoded);
	});
};

//print(data);

const input = readline.createInterface(process.stdin);

input.on("line", line => {
	console.log(line);
	const data = Buffer.from(line, "hex");

	print(data);
});
