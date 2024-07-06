const crypto = require("crypto");

const defaultKeyPrefix = () => Buffer.from("d4f1bb3a20290759f0bcffabcf4e6901", "hex");

const meshCrypto = {
	generateKey: (b64) => {
		const key = Buffer.from(b64, "base64");

		if(key.length != 1 || (key.length == 1 && key[0] == 0)) {
			throw new Error("Not implemented");
		}

		const prefix = defaultKeyPrefix();

		prefix[prefix.length - 1] = key[0];

		return prefix;
	},

	generateIV: (packet) => {
		const nonce = Buffer.alloc(16);

		nonce.writeBigUint64LE(BigInt(packet.id));
		nonce.writeUint32LE(packet.from, 8);

		return nonce;
	},

	decrypt: (keyB64, packet) => {
		return new Promise((resolve, reject) => {
			const key = meshCrypto.generateKey(keyB64);
			const iv = meshCrypto.generateIV(packet);

			const decipher = crypto.createDecipheriv("aes-128-ctr", key, iv);

			let decrypted = Buffer.alloc(0);

			decipher.on("readable", () => {
				let chunk;

				while (null !== (chunk = decipher.read())) {
					decrypted = Buffer.concat([decrypted, chunk]);
				}
			});

			decipher.on("end", () => {
				resolve(decrypted);
			});

			decipher.on("error", reject);

			decipher.write(packet.encrypted);
			decipher.end();
		});
	},

	encrypt: (keyB64, meta, packet) => {
		const key = meshCrypto.generateKey(keyB64);
		const iv = meshCrypto.generateIV(meta);

		const cipher = crypto.createDecipheriv("aes-128-ctr", key, iv);

		const encrypted = cipher.update(packet);

		cipher.final();

		return encrypted;
	}
};

module.exports = meshCrypto;
