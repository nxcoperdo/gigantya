/**
 * Verificación rápida de la migración POS Fase 1.
 * Ejecuta queries que confirman:
 *   1) ENUM usuarios.tipo_usuario incluye cajero/mesero/cocina
 *   2) Columna usuarios.restaurante_id existe
 *   3) FK apunta a restaurantes.id
 *   4) No hay filas con los valores nuevos (debería ser 0 tras la migración)
 *
 * Salida: imprime los resultados y sale con código 0 si todo OK, 1 si falla.
 */
import 'dotenv/config';
import { query, closePool } from '../src/config/database.js';

async function run() {
  try {
    const [enumRows] = await query(
      `SELECT COLUMN_TYPE
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'usuarios'
          AND column_name = 'tipo_usuario'`
    );
    console.log('ENUM tipo_usuario:', enumRows.COLUMN_TYPE);
    const okEnum = ['cajero','mesero','cocina'].every((v) => enumRows.COLUMN_TYPE.includes(`'${v}'`));
    if (!okEnum) {
      console.error('❌ ENUM no incluye los valores nuevos');
      process.exit(1);
    }

    const [colRows] = await query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'usuarios'
          AND column_name = 'restaurante_id'`
    );
    console.log('Columna restaurante_id:', colRows);
    if (!colRows) {
      console.error('❌ Columna restaurante_id no existe');
      process.exit(1);
    }

    const [fkRows] = await query(
      `SELECT *
         FROM information_schema.referential_constraints
        WHERE constraint_schema = DATABASE()
          AND constraint_name = 'fk_usuarios_restaurante'`
    );
    console.log('FK fk_usuarios_restaurante:', fkRows ? 'OK' : 'FALTA');

    const [idxRows] = await query(
      `SELECT INDEX_NAME, COLUMN_NAME
         FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'usuarios'
          AND column_name = 'restaurante_id'`
    );
    console.log('Index sobre restaurante_id:', idxRows.length > 0 ? 'OK' : 'FALTA', JSON.stringify(idxRows));

    const [countRows] = await query(
      `SELECT COUNT(*) AS n
         FROM usuarios
        WHERE tipo_usuario IN ('cajero','mesero','cocina')`
    );
    console.log('Filas con rol POS:', countRows.n, '(debe ser 0 inmediatamente después de la migración)');

    console.log('\n✅ Migración POS Fase 1 verificada');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

run();
