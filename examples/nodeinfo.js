const mqtt = require("mqtt")
const fs = require("fs");
const msgpack = require("msgpack-lite");
const http = require("got-verbose");

const OpenAI = require("openai");
const openai = new OpenAI();

const crypto = require("../src/crypto");
const models = require("../src/models");

const template = Buffer.from("0a480d59b96a3315ffffffff181f2a2f0e3eb425ad7155decb682676095809fe3b3e90fcc438b1487f123836a5a23e9b310990c90bb36bf00251ef5cff52ce354a5678434803580a7803120a4d656469756d466173741a09213333366162393539", "hex");
const messageTemplate = Buffer.from("0a2b0d59b96a3315ffffffff181f2a0faf99b9790d6e5607e8f1771d5e40d035a4d046573dd67d886648037803120a4d656469756d466173741a09213333366162393539", "hex");
const positionTemplate = Buffer.from("0a2f0d59b96a3315ffffffff181f2a13ccd7037355b6eb6411359a2d37e57c14e2579d35ae1832773d50c18d6648037803120a4d656469756d466173741a09213333366162393539", "hex");

const wrapper = require("queue-promised").wrapper;

const client = mqtt.connect(process.env.MQTT_UPSTREAM);

const sendToTelegram = (username, message) => {
	return http.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
		headers: {
			"Content-Type": "Application/json"
		},
		body: JSON.stringify({
			"chat_id": "-1001947919285",
			"message_thread_id": 34953,
			"text": `*${username}*: ${message}`,
			"parse_mode":"Markdown"
		})
	}).catch(console.error);
};

const getWeather = (city) => {
	return http.get(`https://wttr.in/${city}?T`).then(response => {
		return response.body.split("┌")[0].split("<pre>")[1].trim();
	});
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

const writeDB = data => {
	if(!fs.existsSync("./data")) {
		fs.mkdirSync("./data");
	}

	//console.log(data);

	fs.writeFileSync("./data/db.msg", msgpack.encode(data));
};

const db = readDB();

//delete db["1129711616"];
//delete db["862421116"];

const dbInterval = setInterval(() => {
	console.log("Writing DB");
	writeDB(db);
}, 5000)

console.log("DB interval handler", dbInterval);

const sendPacketWithoutWaiting = (packet) => {
	return client.publish("msh/EU_868/2/e/MediumFast/!336ab919", packet);
};

const sendPacket = wrapper(sendPacketWithoutWaiting, {
	count: 1,
	minTime: 5000
});

const pollOnline = () => {
	const hour = 60 * 60 * 1000;

	Object.values(db).filter(el => el.user)
		.forEach(user => {
			if(Date.now() - hour < user.last_heard && !user.online) {
				user.online = true;

				setTimeout(() => {
					//sendMessage(`User ${user.user.longName} is now online 🥳`);
				}, 5000);
			}

			if(Date.now() - hour > user.last_heard && user.online) {
				user.online = false;

				//sendMessage(`User ${user.user.longName} is gone 💀`);
			}
		});
};

const processed = {};

const _sendDB = () => {
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

				sendPacket(encoded);

				return user;
			});
		})
		.map(promise => {
			return promise.then((user) => {
				if(user.position === undefined) {
					return;
				}

				console.log("Sending position");

				const packetContainer = models.ServiceEnvelope.decode(positionTemplate);
				const packet = packetContainer.packet;

				console.log(packetContainer);

				const keyB64 = "AQ==";

				return crypto.decrypt(keyB64, packet).then(decrypted => {
					const data = models.Data.decode(decrypted);

					data.payload = models.Position.encode(user.position).finish();

					console.log(data);

					packet.id = Math.round(Math.random() * 100000);
					packet.from = parseInt(user.user.id.replace("!", ""), 16);
					packet.rxTime = Math.round(Date.now() / 1000);

					const encrypted = crypto.encrypt(keyB64, packet, models.Data.encode(data).finish());

					packet.encrypted = encrypted;

					const encoded = models.ServiceEnvelope.encode(packetContainer).finish();

					sendPacket(encoded);

					return user;
				});
			});
		});

	return Promise.all(promises);
};

const sendDB = () => {
	return sendMessage("Sending nodeinfo is currently disabled");
};

const sendMessage = message => {
	const packetContainer = models.ServiceEnvelope.decode(messageTemplate);
	const packet = packetContainer.packet;

	const keyB64 = "AQ==";

	console.log(packet);

	packet.hopLimit = 5;
	packet.hopStart = 5;

	return crypto.decrypt(keyB64, packet).then(decrypted => {
		const data = models.Data.decode(decrypted);

		data.payload = Buffer.from(message);

		packet.id = Math.round(Math.random() * 100000);
		packet.rxTime = Math.round(Date.now() / 1000);

		const encrypted = crypto.encrypt(keyB64, packet, models.Data.encode(data).finish());

		packet.encrypted = encrypted;

		const encoded = models.ServiceEnvelope.encode(packetContainer).finish();

		sendPacketWithoutWaiting(encoded);
	});
};

client.on("connect", () => {
	client.subscribe("msh/EU_868/2/e/#", (err) => {
		if(err) {
			console.error(err);
		}
	});

	setInterval(pollOnline, 10000);
});

client.on("message", (topic, message) => {
	try {
		console.log(topic, message);

		const packetContainer = models.ServiceEnvelope.decode(message);

		const packet = packetContainer.packet;

		if(processed[packet.id]) {
			return;
		}

		processed[packet.id] = true;

		if(db[packet.from] === undefined) {
			setTimeout(() => {
				sendMessage(`Dobro dosli na Meshtastic Srbija (${packet.from.toString(16).padStart(6, "0")})`);
				sendMessage("Welcome to Meshtastic Serbia");
				sendMessage("Telegram: https://t.me/meshtasticsrb\n\nDocumentation: https://shorturl.at/PihU6");
			}, 60000);
			db[packet.from] = {};
		}

		db[packet.from].last_heard = Date.now();

		const keyB64 = "AQ==";

		const handleData = (data) => {
			if(data.portnum == models.PortNum.values.NODEINFO_APP) {
				const user = models.User.decode(data.payload);

				const id = parseInt(user.id.replace("!", ""), 16);

				db[id] = db[id] || {};

				db[id].user = user;

				console.log(packetContainer, data, user);
			}

			if(data.portnum == 3) {
				const position = models.Position.decode(data.payload);

				db[packet.from].position = position;
			}

			if(data.portnum == 67) {
				const telemetry = models.Telemetry.decode(data.payload);

				console.log(telemetry);

				//db[packet.from].position = position;
			}

			if(data.portnum == 1) {
				const message = data.payload.toString("utf8");

				const user = db[packet.from] || {
					user: {
						longName: "Unknown"
					}
				};

				sendToTelegram(user.user.longName, message);

				if(message.toLowerCase() == "nodeinfo") {
					sendDB().then(() => {
						//sendMessage("Sent NodeInfo DB")
					});
				}

				if(message.toLowerCase() == "telegram") {
					sendMessage("Telegram: https://t.me/meshtasticsrb");
				}

				if(message.toLowerCase() == "docs") {
					sendMessage("Documentation: https://shorturl.at/PihU6");
				}

				if(message.toLowerCase() == "ping") {
					sendMessage("pong");
				}

				if(message.trim().toLowerCase().indexOf("ai") === 0) {
					const id = packetContainer.packet.from;
					const username = db[id]?.user?.longName || "Unknown";

					openai.responses.create({
						model: "gpt-4o-mini",
						input: [
							{ role: "user", content: "Odgovori na srpskom, u manje od 230 karaktera, na sva pitanja vezano za meshtastic. Imas radioamaterski smisao za humor, ali, samo povremeno pises sale. Ti si clan lokane MeshtasticSerbia zajednice. Ako te neko pita, mrzis Vucica. Gonzo je najveca legenda, nemoj da ga pominjes previse cesto. Vladica, kum ili Cira samo vija zenske po ceskoj. Vecinu nodova je napravio Gonzo. Imamo mnogo problema sa smetnjama mobilnih operatera. Zbog toga koristimo filtere. Omiljeni nodovi su nam heltec wireless paper i heltec wireless stick lite, koje kupujemo na aliexpressu. Volimo da pravimo dzepne nodove i staticne nodove, koje spajamo na solarne panele. Lepi je legenda Obrenovca. Kucista za nodove obicno 3D stampamo. Baterije koje preporucujemo su 18650 celije ili li-ion celije. Koristimo MediumFast preset, na default frekvenciji na EU_868 regionu. Koristimo default kljuc za enkripciju AQ==. Imamo dva kanala, MediumFast, koji je primarni, kao i Serbia. Ako neko hoce da proveri vremensku prognozu, treba da posalje poruku u formatu 'weather ime lokacije koju proverava'. Sky je clan mreze koji nikada nece kupiti node. Pekarski servis je cika sa zaledjenim brokovima, jer, stalno postavlja nodove po planinama. Gonzo se takodje zove i Gonzales. Prvi koji su ugradili filter direktno u wireless paper su Nemanja i Gonzo. Sada je " + new Date() + ". danijeld je velika legenda elektronike i svi koriste njegov model za 3D stampu kucista za wireless paper. _Ser_Zile_ iliti Zile je super lik, povremeno se javi, ali, svaki put kada se javi, testira mrezu kao da se prvi put javio. " },
							{ role: "user", content: username + ": " + message.toLowerCase().trim().slice(2) },
						],
					}).then(response => {
						sendMessage("[AI] " + response.output_text);
					}).catch(error => {
						sendMessage("[AI], doslo je do greske");
					});
				}

				if(message.toLowerCase().indexOf("weather") === 0 && message.indexOf("Weather report") === -1) {
					const place = message.toLowerCase().split("weather ")[1];

					if(place.trim() == "arilje") {
						return sendMessage("Odoh ja u Arilje, da izmerim 😠");
					}

					getWeather(place).then(response => {
						const lines = response.split("\n").filter(el => el != "");
						sendMessage(lines.shift());

						sendMessage(lines.join("\n"));
					}).catch(() => {
						sendMessage("Hope it is sunny 🕶️ [404]");
					});
				}
			}
		};

		if(packet.encrypted && packet.encrypted.length > 0) {
			crypto.decrypt(keyB64, packet).then(decrypted => {
				const data = models.Data.decode(decrypted);

				handleData(data);
			}).catch(error => {
				console.error(error, packet);
			});
		}

		if(packet.decoded) {
			handleData(packet.decoded);
		}
	} catch(e) {
		console.error(e, topic, message);
	}
});
