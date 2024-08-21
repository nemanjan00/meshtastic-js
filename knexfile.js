const knexConfig = {
	client: "pg",
	connection: process.env.POSTGRES_URL,
	migrations: {
		directory: "./migrations"
	}
};

module.exports = {
	production: knexConfig,
	staging: knexConfig,
	development: knexConfig
};
