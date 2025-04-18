const mqtt = require("mqtt");

const crypto = require("../src/crypto");
const models = require("../src/models");

const client = mqtt.connect(process.env.MQTT_UPSTREAM);
const clientUpstream = mqtt.connect("mqtt://meshdev:large4cats@mqtt.meshtastic.org");
const client1Upstream = mqtt.connect("mqtt://uplink:uplik@mqtt.meshtastic.liamcotlete.net");

// meshtastic bitfield flags
const BITFIELD_OK_TO_MQTT_SHIFT = 0;
const BITFIELD_OK_TO_MQTT_MASK = (1 << BITFIELD_OK_TO_MQTT_SHIFT);

const BITFIELD_WANT_RESPONSE_SHIFT = 1;
const BITFIELD_WANT_RESPONSE_MASK = (1 << BITFIELD_WANT_RESPONSE_SHIFT)

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

		const handlePacket = () => {
			const packetContainer = models.ServiceEnvelope.decode(message);

			const packet = packetContainer.packet;

			const keyB64 = "AQ==";

			const handleData = (data) => {
				if(data.portnum == models.PortNum.values.NEIGHBORINFO_APP || data.portnum == models.PortNum.values.MAP_REPORT_APP || data.portnum == models.PortNum.values.NODEINFO_APP || data.portnum == models.PortNum.values.POSITION_APP) {
					console.log("POSITION_APP", data.portnum == models.PortNum.values.POSITION_APP);
					//client1Upstream.publish(topic, models.ServiceEnvelope.encode(packetContainer).finish());

					data.bitfield = (data.bitfield || 0) | BITFIELD_OK_TO_MQTT_MASK | BITFIELD_WANT_RESPONSE_MASK;

					if(packet.encrypted && packet.encrypted.length > 0) {
						packet.decoded = data;

						delete packet.encrypted;
					}

					console.log(packet);
					console.log(data);
					console.log(models.ServiceEnvelope.decode(models.ServiceEnvelope.encode(packetContainer).finish()));

					clientUpstream.publish(topic, models.ServiceEnvelope.encode(packetContainer).finish());
					client1Upstream.publish(topic, models.ServiceEnvelope.encode(packetContainer).finish());
				}
			};

			if(packet.encrypted && packet.encrypted.length > 0) {
				crypto.decrypt(keyB64, packet).then(decrypted => {
					const data = models.Data.decode(decrypted);

					handleData(data);
				}).catch(console.error);
			}

			if(packet.decoded) {
				handleData(packet.decoded);
			}
		}

		const handleMap = () => {
			client1Upstream.publish(topic, message);
			clientUpstream.publish(topic, message);

			const packetContainer = models.ServiceEnvelope.decode(message);

			const packet = models.MapReport.decode(packetContainer.packet.decoded.payload);

			console.log(packet);
		}

		if(topic.indexOf("/e/") !== -1) {
			handlePacket();
		}

		if(topic.indexOf("/map/") !== -1) {
			handleMap();
		}

		if(topic.indexOf("/stat/") !== -1) {
			client1Upstream.publish(topic, message);
			clientUpstream.publish(topic, message);
		}
	} catch(e) {
		console.error(e, topic, message);
	}
});
