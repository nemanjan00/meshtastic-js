const crypto = require("../src/crypto");

const calculate = (nameString, keyB64) => {
	console.log(nameString, keyB64);

	const key = new Uint8Array(crypto.generateKey(keyB64));
	const name= new Uint8Array(Buffer.from(nameString));

	const xor = buffer => {
		return buffer.reduce((a, b) => a ^ b, 0);
	};

	return xor(name) ^ xor(key);
};

console.log(calculate("MediumFast", "AQ=="));
console.log(calculate("MeshSerbia", "AQ=="));
