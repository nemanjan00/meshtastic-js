const protobuf = require("protobufjs");
const path = require("path");

const modelsRoot = new protobuf.Root();

modelsRoot.resolvePath = function (_origin, target) {
	return path.resolve(__dirname, "../../protobufs", target);
};

const models = modelsRoot.loadSync("meshtastic/mesh.proto")

module.exports = {
	ToRadio: models.lookupType("meshtastic.ToRadio"),
	FromRadio: models.lookupType("meshtastic.FromRadio")
};
