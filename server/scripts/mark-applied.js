import knexLib from 'knex';
import knexConfig from '../knexfile.js';

const knex = knexLib.default ? knexLib.default(knexConfig) : knexLib(knexConfig);

const aplicadas = [
  '20260607000001_initial_schema.js',
  '20260609000001_subscriptions_and_plans.js',
  '20260609000002_payment_proofs.js',
];

try {
  await knex.schema.createTableIfNotExists('knex_migrations', (t) => {
    t.increments('id').primary();
    t.string('name');
    t.integer('batch');
    t.timestamp('migration_time').defaultTo(knex.fn.now());
  });

  const existeBatch = await knex.schema.hasColumn('knex_migrations', 'batch');
  if (!existeBatch) {
    console.error('Tabla knex_migrations sin columna batch');
    process.exit(1);
  }

  for (const name of aplicadas) {
    const existe = await knex('knex_migrations').where({ name }).first();
    if (!existe) {
      await knex('knex_migrations').insert({ name, batch: 1 });
      console.log('Marcada como aplicada:', name);
    } else {
      console.log('Ya estaba marcada:', name);
    }
  }
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await knex.destroy();
}
