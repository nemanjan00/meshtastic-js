const pg = require("pg");

pg.types.setTypeParser(pg.types.builtins.INT8, parseInt);
pg.types.setTypeParser(pg.types.builtins.FLOAT8, parseFloat);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, parseFloat);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (date) => new Date(date));

const db = require("knex")({
	client: "pg",
	connection: config.get("POSTGRES_URL"),
	pool: { min: 0, max: 200 }
});
