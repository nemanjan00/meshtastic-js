const mqtt = require("mqtt");

const crypto = require("../src/crypto");
const models = require("../src/models");

const client = mqtt.connect(process.env.MQTT_UPSTREAM);

const samplePackets = [
	Buffer.from("0a350d2c8e584315ffffffff181f2a0981f1d55538f93f950c355ac05cd63d6d7888664500001c41480460ecffffffffffffffff017804120a4d656469756d466173741a09213333366162393539", "hex"),
	Buffer.from("0a350d2c8e584315ffffffff181f2a0981f1d55538f93f950c355ac05cd63d6c7888664500002841480460f7ffffffffffffffff017804120a4d656469756d466173741a09213433353838353134", "hex"),
	Buffer.from("0a2f0d59b96a3315ffffffff181f2a13ea1b8edc38fb06afa7b7d1e976982ce5a6a42635a3d046573dd67d886648037803120a4d656469756d466173741a09213333366162393539", "hex"),
	Buffer.from("0a2b0d59b96a3315ffffffff181f2a0faf99b9790d6e5607e8f1771d5e40d035a4d046573dd67d886648037803120a4d656469756d466173741a09213333366162393539", "hex")
];

client.on("connect", () => {
	client.subscribe("msh/EU_868/2/e/#", (err) => {
		if(err) {
			console.error(err);
		}
	});

	samplePackets.forEach(packetData => {
		const packetContainer = models.ServiceEnvelope.decode(packetData);

		const packet = packetContainer.packet;

		const keyB64 = "AQ==";

		crypto.decrypt(keyB64, packet).then(decrypted => {
			const data = models.Data.decode(decrypted);

			packet.id = Math.round(Math.random() * 100000);
			packet.from = 1129716344;
			packet.rxTime = Math.round(Date.now() / 1000);

			if(data.portnum == 1) {
				data.payload = Buffer.from("Ja sam Gonzo i velika sam legenda");
				packet.encrypted = crypto.encrypt(keyB64, packet, models.Data.encode(data).finish());

				packet.payload = Buffer.from("Ja sam Gonzo i velika sam legenda");

				console.log(packet);

				const encoded = models.ServiceEnvelope.encode(packetContainer).finish();

				client.publish("msh/EU_868/2/e/MediumFast/!336ab919", encoded);
			}
		});
	});
});

client.on("message", (topic, message) => {
});
