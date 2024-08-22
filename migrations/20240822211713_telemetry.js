exports.up = function(knex) {
	return knex.schema.createTable("telemetry", function(table) {
		table.timestamp("rx_time").defaultTo(knex.fn.now()).notNullable();

		table.bigint("from").notNullable();

		table.string("name", 50).notNullable();

		table.float("value").notNullable();

		table.string("channel_id", 50).notNullable();

		table.bigint("gateway_id").notNullable();

		table.string("node_name", 50).notNullable();
	}).then(() => {
		return knex.raw("SELECT create_hypertable('telemetry', 'rx_time');");
	});
};

exports.down = function(knex) {
	return knex.schema
		.dropTableIfExists("telemetry");
};
