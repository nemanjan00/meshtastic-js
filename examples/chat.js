const mqtt = require("mqtt");
const readline = require("readline");

const crypto = require("../src/crypto");
const models = require("../src/models");

const client = mqtt.connect(process.env.MQTT_UPSTREAM);

const packetData = Buffer.from("0a2b0d59b96a3315ffffffff181f2a0faf99b9790d6e5607e8f1771d5e40d035a4d046573dd67d886648037803120a4d656469756d466173741a09213333366162393539", "hex");

const rl = readline.createInterface({ input: process.stdin});

client.on("connect", () => {
	client.subscribe("msh/EU_868/2/e/MediumFast/#", (err) => {
		if(err) {
			console.error(err);
		}
	});

	const sendMessage = (text) => {
		const packetContainer = models.ServiceEnvelope.decode(packetData);

		const packet = packetContainer.packet;

		const keyB64 = "AQ==";

		crypto.decrypt(keyB64, packet).then(decrypted => {
			const data = models.Data.decode(decrypted);

			if(data.portnum == 1) {
				data.payload = Buffer.from(text);

				packet.id = Math.round(Math.random() * 100000);
				packet.from = 862632281;
				packet.rxTime = Math.round(Date.now() / 1000);

				packet.encrypted = crypto.encrypt(keyB64, packet, models.Data.encode(data).finish());

				const encoded = models.ServiceEnvelope.encode(packetContainer).finish();

				 client.publish("msh/EU_868/2/e/MediumFast/!336ab919", encoded);
			}
		});
	};

	rl.on("line", (input) => {
		console.log(`Me: ${input}`);

		sendMessage(input);
	});

	client.on("message", (topic, packetData) => {
		const packetContainer = models.ServiceEnvelope.decode(packetData);

		const packet = packetContainer.packet;

		const keyB64 = "AQ==";

		crypto.decrypt(keyB64, packet).then(decrypted => {
			const data = models.Data.decode(decrypted);

			if(data.portnum == 1) {
				console.log(packet.from, data.payload.toString("utf8"));
			}
		});
	});
});
