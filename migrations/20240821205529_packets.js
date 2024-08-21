exports.up = function(knex) {
	return knex.schema.createTable("packets", function(table) {
		table.timestamp("rx_time").defaultTo(knex.fn.now()).notNullable();

		table.bigint("from").notNullable();
		table.bigint("to").notNullable();

		table.bigint("channel").notNullable();

		table.binary("payload", 256).notNullable();
		table.string("portnum", 50).notNullable();

		table.bigint("id").notNullable();

		table.float("rx_snr").notNullable();
		table.float("rx_rssi").notNullable();

		table.integer("hop_limit").notNullable();
		table.integer("hop_start").notNullable();

		table.string("channel_id").notNullable();

		table.bigint("gateway_id").notNullable();
	}).then(() => {
		return knex.raw("SELECT create_hypertable('packets', 'rx_time');");
	});
};

exports.down = function(knex) {
	return knex.schema
		.dropTableIfExists("packets");
};
