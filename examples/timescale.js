const pg = require("pg");
const mqtt = require("mqtt");
const fs = require("fs");
const msgpack = require("msgpack-lite");

const crypto = require("../src/crypto");
const models = require("../src/models");

pg.types.setTypeParser(pg.types.builtins.INT8, parseInt);
pg.types.setTypeParser(pg.types.builtins.FLOAT8, parseFloat);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, parseFloat);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (date) => new Date(date));

const client = mqtt.connect(process.env.MQTT_UPSTREAM);

const readDB = () => {
	if(!fs.existsSync("./data")) {
		fs.mkdirSync("./data");
	}

	if(!fs.existsSync("./data/db.msg")) {
		return {};
	}

	const data = fs.readFileSync("./data/db.msg");

	return msgpack.decode(data);
};

let nodeDB = readDB();

setInterval(() => {
	try {
		nodeDB = readDB();
	} catch(e) {}
}, 1000);

const db = require("knex")({
	client: "pg",
	connection: process.env.POSTGRES_URL,
	pool: { min: 0, max: 200 }
});

const handledPackage = {};

client.on("connect", () => {
	client.subscribe("msh/EU_868/2/e/MediumFast/#", (err) => {
		if(err) {
			console.error(err);
		}
	});

	client.on("message", (_topic, packetData) => {
		const packetContainer = models.ServiceEnvelope.decode(packetData);

		const packet = packetContainer.packet;

		if(handledPackage[packet.id]) {
			return;
		}

		handledPackage[packet.id] = true;

		const handleData = (decrypted) => {
			const data = models.Data.decode(decrypted);

			const dataDecoded = models.Data.toObject(data, {
				enums: String
			});

			let longName = "UNKNOWN";

			if(nodeDB[packetContainer.packet.from]) {
				longName = nodeDB[packetContainer.packet.from].user.longName;
			}

			console.log(dataDecoded.portnum);

			if(dataDecoded.portnum == "POSITION_APP") {
				const position = models.Position.decode(dataDecoded.payload);

				console.log(position);

				db("place").insert({
					rx_time: new Date(position.time * 1000),
					from: packetContainer.packet.from,

					latitude: position.latitudeI,
					longitude: position.longitudeI,
					altitude: position.altitude,
					precision_bits: position.precisionBits,

					channel_id: packetContainer.channelId,

					gateway_id: parseInt(packetContainer.gatewayId.slice(1), 16),

					node_name: longName
				}).then(() => {});
			}

			if(dataDecoded.portnum == "TELEMETRY_APP") {
				const telemetry = models.Telemetry.decode(dataDecoded.payload);

				Object.keys(telemetry).forEach(key => {
					if(telemetry[key] instanceof Object) {
						Object.keys(telemetry[key]).forEach(property => {
							const name = `${key}.${property}`;
							const value = telemetry[key][property];

							db("telemetry").insert({
								rx_time: new Date(telemetry.time * 1000),
								from: packetContainer.packet.from,

								name,

								value,

								channel_id: packetContainer.channelId,

								gateway_id: parseInt(packetContainer.gatewayId.slice(1), 16),

								node_name: longName
							}).then(() => {});
						});
					}
				});
			}

			db("packets").insert({
				rx_time: new Date(packetContainer.packet.rxTime * 1000),

				from: packetContainer.packet.from,
				to: packetContainer.packet.to,

				channel: packetContainer.packet.channel,

				payload: dataDecoded.payload || Buffer.from(""),
				portnum: dataDecoded.portnum,

				id: packetContainer.packet.id,

				rx_snr: packetContainer.packet.rxSnr,
				rx_rssi: packetContainer.packet.rxRssi,

				hop_limit: packetContainer.packet.hopLimit,
				hop_start: packetContainer.packet.hopStart,

				channel_id: packetContainer.channelId,

				gateway_id: parseInt(packetContainer.gatewayId.slice(1), 16),

				node_name: longName
			}).then(() => {});
		};

		const keyB64 = "AQ==";

		if(packet.encrypted) {
			crypto.decrypt(keyB64, packet).then(decrypted => {
				handleData(decrypted);
			}).catch(console.error);
		}

		if(packet.decoded) {
			handleData(packet.decoded);
		}
	});
});
