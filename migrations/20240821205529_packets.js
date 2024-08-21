exports.up = function(knex) {
	return knex.schema.createTable("packets", function(table) {
		table.timestamp("rx_time").defaultTo(knex.fn.now()).notNullable();

		table.integer("from").notNullable();
		table.integer("to").notNullable();

		table.integer("channel").notNullable();

		table.binary("payload", 256).notNullable();
		table.string("portnum", 50).notNullable();

		table.integer("id").notNullable();

		table.integer("rx_snr").notNullable();
		table.integer("rx_rssi").notNullable();

		table.integer("hop_limit").notNullable();
		table.integer("hop_start").notNullable();

		table.string("channel_id").notNullable();

		table.integer("gateway_id").notNullable();
	}).then(() => {
		return knex.raw("SELECT create_hypertable('packets', 'rx_time');");
	});
};

exports.down = function(knex) {
	return knex.schema
		.dropTableIfExists("packets");
};
