const mqtt = require("mqtt");
const fs = require("fs");
const msgpack = require("msgpack-lite");

const crypto = require("../src/crypto");
const models = require("../src/models");

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
			sendDB();

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
