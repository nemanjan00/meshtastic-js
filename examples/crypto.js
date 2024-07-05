const models = require("../src/models");
const crypto = require("crypto");

const samplePackets = [
	Buffer.from("0a350d2c8e584315ffffffff181f2a0981f1d55538f93f950c355ac05cd63d6d7888664500001c41480460ecffffffffffffffff017804120a4d656469756d466173741a09213333366162393539", "hex"),
	Buffer.from("0a350d2c8e584315ffffffff181f2a0981f1d55538f93f950c355ac05cd63d6c7888664500002841480460f7ffffffffffffffff017804120a4d656469756d466173741a09213433353838353134", "hex"),
	Buffer.from("0a2f0d59b96a3315ffffffff181f2a13ea1b8edc38fb06afa7b7d1e976982ce5a6a42635a3d046573dd67d886648037803120a4d656469756d466173741a09213333366162393539", "hex"),
	Buffer.from("0a2b0d59b96a3315ffffffff181f2a0faf99b9790d6e5607e8f1771d5e40d035a4d046573dd67d886648037803120a4d656469756d466173741a09213333366162393539", "hex")
];

const defaultKeyPrefix = () => Buffer.from("d4f1bb3a20290759f0bcffabcf4e6901", "hex");

const generateKey = (b64) => {
	const key = Buffer.from(b64, "base64");

	if(key.length != 1 || (key.length == 1 && key[0] == 0)) {
		throw new Error("Not implemented");
	}

	const prefix = defaultKeyPrefix();

	prefix[prefix.length - 1] = key[0];

	return prefix;
};

const generateIV = (packet) => {
	const nonce = Buffer.alloc(16);

	nonce.writeBigUint64LE(BigInt(packet.id));
	nonce.writeUint32LE(packet.from, 8);

	return nonce;
};

const decrypt = (keyB64, packet) => {
	return new Promise((resolve, reject) => {
		const key = generateKey(keyB64);
		const iv = generateIV(packet);

		const decipher = crypto.createDecipheriv("aes-128-ctr", key, iv);

		let decrypted = Buffer.alloc(0);

		decipher.on("readable", () => {
			let chunk;

			while (null !== (chunk = decipher.read())) {
				decrypted = Buffer.concat([decrypted, chunk]);
			}
		});

		decipher.on("end", () => {
			resolve(models.Data.decode(decrypted));
		});

		decipher.on("error", reject);

		decipher.write(packet.encrypted);
		decipher.end();
	});
};

samplePackets.forEach(packetData => {
	const packetContainer = models.ServiceEnvelope.decode(packetData);

	const packet = packetContainer.packet;

	const keyB64 = "AQ==";

	decrypt(keyB64, packet).then(data => {
		console.log(packet);
		console.log(data);

		if(data.portnum == 1) {
			console.log(data.payload.toString("utf8"));
		}
	});
});
