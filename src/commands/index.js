const models = require("../models");
const lockFactory = require("../lock");

module.exports = (interface) => {
	const locker = lockFactory();

	const commands = {
		getNodeDB: () => {
			const id = Math.round(Math.random() * 1024);

			const packet = models.ToRadio.create({
				wantConfigId: id
			});

			const data = {
				nodes: [],
				channels: [],
				moduleConfig: {},
				config: {}
			};

			return locker.getLock().then(release => {
				return new Promise(resolve => {
					const handler = (message) => {
						if(message.nodeInfo) {
							data.nodes.push(message.nodeInfo);

							return;
						}

						if(message.channel) {
							data.channels.push(message.channel);

							return;
						}

						if(message.moduleConfig) {
							data.moduleConfig = {
								...message.moduleConfig,
								...data.moduleConfig
							};

							return;
						}

						if(message.config) {
							data.config = {
								...message.config,
								...data.config
							};

							return;
						}

						if(message.myInfo) {
							data.myInfo = message.myInfo;

							return;
						}

						if(message.metadata) {
							data.metadata = message.metadata;

							return;
						}

						if(message.configCompleteId === id) {
							interface.pipeline.off("message", handler);
							release();

							resolve(JSON.parse(JSON.stringify(data)));
						}

						console.log(message);
					};

					interface.pipeline.on("message", handler);

					interface.sendPacket(packet);
				});
			});
		},
	};

	return commands;
};

