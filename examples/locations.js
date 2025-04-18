const mqtt = require("mqtt");

const models = require("../src/models");
const crypto = require("../src/crypto");

const fs = require("fs");
const msgpack = require("msgpack-lite");

const mapTopic = "msh/EU_868/2/map/";
const mapTemplate = Buffer.from("0a4b0d3c9e5c3315ffffffff223f0849123b0a0b4e424720426c6f6b20323112044e423231202b2a0e322e332e31332e383366356261303003380440014dd4c9b51a5588a72d0c582060206827120a4d656469756d466173741a09213333356339653363", "hex");

const positionTopic = "msh/EU_868/2/e/MediumFast/!da8bf7bc";
const positionTemplate = Buffer.from("0a430dbcf78bda15ffffffff181f2a2180a92ff3932fb65afcb15fa39f48853319e7dd4019fdca2624133abd358c0d745d3541b02e293dc3c702684807580a78079801bc01120a4d656469756d466173741a09216461386266376263", "hex");

const fixedNodes = {
	"433b92a0": { // Borca
		latitudeI: 44.876212 * 10000000,
		longitudeI: 20.449736 * 10000000
	},

	"433b8e88": { // Mirjevo
		latitudeI: 44.791897 * 10000000,
		longitudeI: 20.531957 * 10000000
	},

	"4359c64c": { // Slankamen
		latitudeI: 45.16024 * 10000000,
		longitudeI: 20.19808 * 10000000
	},

	"43561a78": { // Vrsacki Breg
		latitudeI: 45.12354 * 10000000,
		longitudeI: 21.34409 * 10000000
	},

	"da56f678": { // Radio Klub
		latitudeI: 44.86879 * 10000000,
		longitudeI: 20.64018 * 10000000
	}
};

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

const update = () => {
	try {
		nodeDB = readDB();

		Object.keys(fixedNodes).forEach(key => {
			const node = nodeDB[parseInt(key, 16)];

			node.position = node.position || {
				latitudeI: 445550157,
				longitudeI: 205459459,
				altitude: 32,
				time: 1257174955,
				locationSource: 3,
				groundSpeed: 0,
				groundTrack: 0,
				precisionBits: 16
			};

			node.magic = true;

			Object.keys(fixedNodes[key]).forEach(attribute => {
				node.position[attribute] = fixedNodes[key][attribute];
			});
		});
	} catch(e) {}
}

let nodeDB = readDB();

update();

setInterval(() => {
	update();
}, 1000);

const clients = [
	mqtt.connect(process.env.MQTT_UPSTREAM),
	mqtt.connect("mqtt://meshdev:large4cats@mqtt.meshtastic.org"),
	mqtt.connect("mqtt://uplink:uplik@mqtt.meshtastic.liamcotlete.net"),
];

let node = 0;

const sendPosition = () => {
	const hour = 60 * 60 * 1000;

	const nodes = Object.values(nodeDB).filter(el => Date.now() - hour < el.last_heard)
		.filter(el => el.user)
		.filter(el => el.position)
		.filter(el => el.magic);

	const nextNodeId = ++node % nodes.length;

	const nextNode = nodes[nextNodeId];

	const sendPosition = (node) => {
		console.log(node.user.longName);
		const packetContainer = models.ServiceEnvelope.decode(positionTemplate);

		const id = parseInt(node.user.id.slice(1), 16);

		const keyB64 = "AQ==";

		crypto.decrypt(keyB64, packetContainer.packet).then(decrypted => {
			const data = models.Data.decode(decrypted);

			const packet = packetContainer.packet;

			packet.from = id;
			packet.id = Math.round(Math.random() * 100000);
			packet.rxTime = Math.round(Date.now() / 1000);

			const payload = models.Position.decode(data.payload);

			payload.latitudeI = node.position.latitudeI || payload.latitudeI;
			payload.longitudeI = node.position.longitudeI || payload.longitudeI;
			payload.altitude = node.position.altitude || payload.altitude;
			payload.time = Date.now();
			payload.precisionBits = node.position.precisionBits || payload.precisionBits;

			data.payload = models.Position.encode(payload).finish();

			console.log(payload);

			const encrypted = crypto.encrypt(keyB64, packetContainer.packet, models.Data.encode(data).finish());

			packetContainer.packet.encrypted = encrypted;

			clients.forEach(client => {
				client.publish(positionTopic, models.ServiceEnvelope.encode(packetContainer).finish());
			});
		});
	}

	sendPosition(nextNode);
};

const sendMap = () => {
	const hour = 60 * 60 * 1000;

	const nodes = Object.values(nodeDB).filter(el => Date.now() - hour < el.last_heard)
		.filter(el => el.user)
		.filter(el => el.position);

	const nextNodeId = ++node % nodes.length;

	const nextNode = nodes[nextNodeId];

	const sendMap = (node) => {
		const packetContainer = models.ServiceEnvelope.decode(mapTemplate);

		const id = parseInt(node.user.id.slice(1), 16);

		packetContainer.packet.from = id;

		const payload = models.MapReport.decode(packetContainer.packet.decoded.payload);

		payload.hwModel = node.user.hwModel;
		payload.longName = node.user.longName;
		payload.shortName = node.user.shortName;

		payload.latitudeI = node.position.latitudeI;
		payload.longitudeI = node.position.longitudeI;

		packetContainer.packet.decoded.payload = models.MapReport.encode(payload).finish();

		clients.forEach(client => {
			client.publish(mapTopic, models.ServiceEnvelope.encode(packetContainer).finish());
		});
	};

	sendMap(nextNode);
};

setInterval(sendPosition, 60 * 1000);
setInterval(sendMap, 5 * 1000);

sendPosition();
sendMap();
