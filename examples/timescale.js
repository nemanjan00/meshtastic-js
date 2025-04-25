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

	client.on("message", (topic, packetData) => {
		try {
			const packetContainer = models.ServiceEnvelope.decode(packetData);

			const packet = packetContainer.packet;

			if(handledPackage[packet.id]) {
				return;
			}

			handledPackage[packet.id] = true;

			const handleData = (data) => {
				const dataDecoded = models.Data.toObject(data, {
					enums: String
				});

				let longName = "UNKNOWN " + parseInt(packetContainer.gatewayId.slice(1), 16);

				if(nodeDB[packetContainer.packet.from]) {
					longName = nodeDB[packetContainer.packet.from].user.longName;
				}

				console.log(dataDecoded.portnum);

				if(dataDecoded.portnum == "POSITION_APP") {
					const position = models.Position.decode(dataDecoded.payload);

					console.log(position, longName);

					db("place").insert({
						rx_time: new Date(),
						from: packetContainer.packet.from,

						latitude: position.latitudeI / 10000000,
						longitude: position.longitudeI / 10000000,
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
									rx_time: new Date(),
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
					rx_time: new Date(),

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

			if(packet.encrypted && packet.encrypted.length > 0) {
				crypto.decrypt(keyB64, packet).then(decrypted => {
					const data = models.Data.decode(decrypted);

					handleData(data);
				}).catch(console.error);
			}

			if(packet.decoded) {
				handleData(packet.decoded);
			}
		} catch (e) {
			console.error(e, topic, packetData);
		}
	});
});
