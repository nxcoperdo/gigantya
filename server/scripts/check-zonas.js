import knexLib from 'knex';
import knexConfig from '../knexfile.js';

const knex = knexLib.default ? knexLib.default(knexConfig) : knexLib(knexConfig);

try {
  const sectores = await knex('sectores').select('*');
  const barrios = await knex('barrios').select('*');
  console.log('=== SECTORES ===');
  console.table(sectores);
  console.log('=== BARRIOS ===');
  console.table(barrios);
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await knex.destroy();
}