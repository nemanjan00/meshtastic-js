const interfaceFactory = require("../src/interface");
const commandsFactory = require("../src/commands");

const interface = interfaceFactory("/dev/ttyACM0");

const commands = commandsFactory(interface);

commands.getNodeDB().then(data => {
	console.log(data.nodes);
	process.exit(0);
});
