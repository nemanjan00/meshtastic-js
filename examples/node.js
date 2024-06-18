const interfaceFactory = require("../src/interface");
const commandsFactory = require("../src/commands");

const interface = interfaceFactory("/dev/ttyUSB0");

const commands = commandsFactory(interface);

commands.getNodeDB().then(data => {
	console.log(data);
});
