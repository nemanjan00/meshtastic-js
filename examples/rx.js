const interfaceFactory = require("../src/interface");

const interface = interfaceFactory("/dev/ttyACM0");

interface.pipeline.on("message", console.log);
