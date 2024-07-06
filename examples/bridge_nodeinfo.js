const mqtt = require("mqtt");

const crypto = require("../src/crypto");
const models = require("../src/models");

const client = mqtt.connect(process.env.MQTT_UPSTREAM);
const clientUpstream = mqtt.connect("mqtt://meshdev:large4cats@mqtt.meshtastic.org");

client.on("connect", () => {
	client.subscribe("msh/EU_868/2/e/#", (err) => {
		if(err) {
			console.error(err);
		}
	});
});

client.on("message", (topic, message) => {
	console.log(topic, message);

	const packetContainer = models.ServiceEnvelope.decode(message);

	const packet = packetContainer.packet;

	const keyB64 = "AQ==";

	const handleData = (data) => {
		console.log(packet);
		console.log(data);

		if(data.portnum == 71 || data.portnum == 73) {
			clientUpstream.publish(topic, message);
		}
	};

	if(packet.encrypted) {
		crypto.decrypt(keyB64, packet).then(decrypted => {
			const data = models.Data.decode(decrypted);

			handleData(data);
		}).catch(console.error);
	}

	if(packet.decoded) {
		handleData(models.Data.decode(packet.decoded));
	}
});
