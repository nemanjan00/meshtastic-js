exports.up = function(knex) {
	return knex.schema.createTable("place", function(table) {
		table.timestamp("rx_time").defaultTo(knex.fn.now()).notNullable();

		table.bigint("from").notNullable();

		table.float("latitude").notNullable();
		table.float("longitude").notNullable();
		table.float("altitude");
		table.integer("precision_bits");

		table.string("channel_id", 50).notNullable();

		table.bigint("gateway_id").notNullable();

		table.string("node_name", 50).notNullable();
	}).then(() => {
		return knex.raw("SELECT create_hypertable('place', 'rx_time');");
	});
};

exports.down = function(knex) {
	return knex.schema
		.dropTableIfExists("place");
};
