const mqtt = require("mqtt");

const crypto = require("../src/crypto");
const models = require("../src/models");

const client = mqtt.connect(process.env.MQTT_UPSTREAM);
const clientUpstream = mqtt.connect("mqtt://meshdev:large4cats@mqtt.meshtastic.org");

client.on("connect", () => {
	client.subscribe("msh/EU_868/2/#", (err) => {
		if(err) {
			console.error(err);
		}
	});
});

client.on("message", (topic, message) => {
	try {
		console.log(topic, message);

		if(topic.indexOf("map") === -1 && topic.indexOf("/e/") === -1) {
			return;
		}

		const packetContainer = models.ServiceEnvelope.decode(message);

		const packet = packetContainer.packet;

		const keyB64 = "AQ==";

		const handleData = (decrypted) => {
			const data = models.Data.decode(decrypted);

			if(data.portnum == 1) {
				console.log(data.payload.toString("utf8"));
			}

			if(data.portnum == 71 || data.portnum == 73) {
				packet.decoded = decrypted;

				delete packet.encrypted;

				console.log(packet);
				console.log(data);

				clientUpstream.publish(topic, models.ServiceEnvelope.encode(packetContainer).finish());
			}
		};

		if(packet.encrypted) {
			crypto.decrypt(keyB64, packet).then(decrypted => {
				handleData(decrypted);
			}).catch(console.error);
		}

		if(packet.decoded) {
			handleData(packet.decoded);
		}
	} catch(e) {
		console.error(e, topic, message);
	}
});
