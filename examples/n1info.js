const WebSocketClient = require('websocket').client;

const mqtt = require("mqtt");

const models = require("../src/models");
const crypto = require("../src/crypto");

const client = new WebSocketClient();

const mqttClient = mqtt.connect(process.env.MQTT_UPSTREAM);

const messageTemplate = Buffer.from("0a2b0d59b96a3315ffffffff181f2a0faf99b9790d6e5607e8f1771d5e40d035a4d046573dd67d886648037803120a4d656469756d466173741a09213333366162393539", "hex");

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

		return mqttClient.publish("msh/EU_868/2/e/MediumFast/!336ab919", encoded);
	});
};

client.on("connect", connection => {
	connection.on('error', function(error) {
		console.log("Connection Error: " + error.toString());
		process.exit(1);
	});

	connection.on('close', function() {
		process.exit(1);
	});

	connection.send("40");

	connection.on('message', function(message) {
		const type = parseInt(message.utf8Data);

		if (message.type === 'utf8') {
			console.log("Received: '" + message.utf8Data + "'");
		} else {
			return;
		}

		if(type === 2) {
			connection.send("3");
		}

		if(type === 42) {
			const data = JSON.parse(message.utf8Data.substring(2));

			const post = JSON.parse(data[1]);

			const title = post.title;

			sendMessage(`N1: ${title}`);
		}
	});
});

client.connect('wss://websocket-rs.n1info.com/socket.io/?EIO=4&transport=websocket');

//curl 'wss://websocket-rs.n1info.com/socket.io/?EIO=4&transport=websocket' -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0' -H 'Accept: */*' -H 'Accept-Language: en-US,en;q=0.5' -H 'Accept-Encoding: gzip, deflate, br, zstd' -H 'Sec-WebSocket-Version: 13' -H 'Origin: https://n1info.rs' -H 'Sec-WebSocket-Extensions: permessage-deflate' -H 'Sec-WebSocket-Key: sJhxFSuYBDFFhEFzwT5e6Q==' -H 'Connection: keep-alive, Upgrade' -H 'Cookie: INGRESSCOOKIE=1741181568.253.9796.726627|ab59c8764375598256ae8303024eca43' -H 'Sec-Fetch-Dest: empty' -H 'Sec-Fetch-Mode: websocket' -H 'Sec-Fetch-Site: cross-site' -H 'Pragma: no-cache' -H 'Cache-Control: no-cache' -H 'Upgrade: websocket'
