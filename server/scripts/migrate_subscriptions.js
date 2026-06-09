import { query } from '../src/config/database.js';

async function migrate() {
  console.log('🚀 Starting migration for subscription plans...');

  try {
    // Update restaurantes table
    console.log('Updating restaurantes table...');
    await query(`
      ALTER TABLE restaurantes
      ADD COLUMN plan VARCHAR(20) DEFAULT 'basico',
      ADD COLUMN banner_url TEXT NULL,
      ADD COLUMN custom_config JSON NULL
    `);
    console.log('✅ Restaurantes table updated');

    // Update productos table
    console.log('Updating productos table...');
    await query(`
      ALTER TABLE productos
      ADD COLUMN destacado BOOLEAN DEFAULT 0
    `);
    console.log('✅ Productos table updated');

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
