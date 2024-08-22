const protobuf = require("protobufjs");
const path = require("path");

const modelsRoot = new protobuf.Root();

modelsRoot.resolvePath = function (_origin, target) {
	return path.resolve(__dirname, "../../protobufs", target);
};

const models = modelsRoot.loadSync("meshtastic/mesh.proto")
const mqttModels = modelsRoot.loadSync("meshtastic/mqtt.proto")
const portnumModels = modelsRoot.loadSync("meshtastic/portnums.proto")
const telemetryModels = modelsRoot.loadSync("meshtastic/telemetry.proto")

module.exports = {
	ToRadio: models.lookupType("meshtastic.ToRadio"),
	FromRadio: models.lookupType("meshtastic.FromRadio"),
	MeshPacket: models.lookupType("meshtastic.MeshPacket"),
	Data: models.lookupType("meshtastic.Data"),
	User: models.lookupType("meshtastic.User"),
	Position: models.lookupType("meshtastic.Position"),
	ServiceEnvelope: mqttModels.lookupType("meshtastic.ServiceEnvelope"),
	MapReport: mqttModels.lookupType("meshtastic.MapReport"),
	PortNum: portnumModels.lookupEnum("meshtastic.PortNum"),
	Telemetry: telemetryModels.lookupType("meshtastic.Telemetry"),
	Position: models.lookupType("meshtastic.Position")
};
