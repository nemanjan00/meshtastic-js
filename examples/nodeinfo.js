const mqtt = require("mqtt");
const fs = require("fs");
const msgpack = require("msgpack-lite");

const crypto = require("../src/crypto");
const models = require("../src/models");

const template = Buffer.from("0a480d59b96a3315ffffffff181f2a2f0e3eb425ad7155decb682676095809fe3b3e90fcc438b1487f123836a5a23e9b310990c90bb36bf00251ef5cff52ce354a5678434803580a7803120a4d656469756d466173741a09213333366162393539", "hex");
const messageTemplate = Buffer.from("0a2b0d59b96a3315ffffffff181f2a0faf99b9790d6e5607e8f1771d5e40d035a4d046573dd67d886648037803120a4d656469756d466173741a09213333366162393539", "hex");

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

const writeDB = data => {
	if(!fs.existsSync("./data")) {
		fs.mkdirSync("./data");
	}

	console.log(data);

	fs.writeFileSync("./data/db.msg", msgpack.encode(data));
};

const db = readDB();

const dbInterval = setInterval(() => {
	console.log("Writing DB");
	writeDB(db);
}, 5000)

console.log("DB interval handler", dbInterval);

const sendDB = () => {
	console.log("Sending DB");

	const hour = 60 * 60 * 1000;

	const promises = Object.values(db).filter(el => Date.now() - hour < el.last_heard)
		.filter(el => el.user)
		.map(user => {
			const packetContainer = models.ServiceEnvelope.decode(template);
			const packet = packetContainer.packet;

			const keyB64 = "AQ==";

			return crypto.decrypt(keyB64, packet).then(decrypted => {
				const data = models.Data.decode(decrypted);

				data.payload = models.User.encode(user.user).finish();

				packet.id = Math.round(Math.random() * 100000);
				packet.from = parseInt(user.user.id.replace("!", ""), 16);
				packet.rxTime = Math.round(Date.now() / 1000);

				const encrypted = crypto.encrypt(keyB64, packet, models.Data.encode(data).finish());

				packet.encrypted = encrypted;

				const encoded = models.ServiceEnvelope.encode(packetContainer).finish();

				return client.publish("msh/EU_868/2/e/MediumFast/!336ab919", encoded);
			});
		});

	return Promise.all(promises);
};

const sendMessage = message => {
	const packetContainer = models.ServiceEnvelope.decode(messageTemplate);
	const packet = packetContainer.packet;

	const keyB64 = "AQ==";

	return crypto.decrypt(keyB64, packet).then(decrypted => {
		const data = models.Data.decode(decrypted);

		data.payload = Buffer.from(message);

		packet.id = Math.round(Math.random() * 100000);
		packet.rxTime = Math.round(Date.now() / 1000);

		const encrypted = crypto.encrypt(keyB64, packet, models.Data.encode(data).finish());

		packet.encrypted = encrypted;

		const encoded = models.ServiceEnvelope.encode(packetContainer).finish();

		return client.publish("msh/EU_868/2/e/MediumFast/!336ab919", encoded);
	});
};

client.on("connect", () => {
	client.subscribe("msh/EU_868/2/e/#", (err) => {
		if(err) {
			console.error(err);
		}
	});
});

client.on("message", (topic, message) => {
	try {
		console.log(topic, message);

		const packetContainer = models.ServiceEnvelope.decode(message);

		const packet = packetContainer.packet;

		if(db[packet.from] === undefined) {
			sendDB().then(() => {
				return sendMessage("Dobro dosli na Meshtastic Srbija. Poslali smo vam listu aktivnih nodeova (zadnjih 1h). \n\nWelcome to Meshtastic Serbia. We have sent you a list of active nodes (last 1h)\n\nTelegram: https://t.me/meshtasticsrb");
			});

			db[packet.from] = {};
		}

		db[packet.from].last_heard = Date.now();

		const keyB64 = "AQ==";

		const handleData = (decrypted) => {
			const data = models.Data.decode(decrypted);

			if(data.portnum == models.PortNum.values.NODEINFO_APP) {
				const user = models.User.decode(data.payload);

				const id = parseInt(user.id.replace("!", ""), 16);

				db[id] = db[id] || {};

				db[id].user = user;

				console.log(packetContainer, data, user);

				console.log(message.toString("hex"));
			}

			if(data.portnum == 1) {
				const message = data.payload.toString("utf8");

				if(message == "nodeinfo") {
					sendDB();
				}
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
