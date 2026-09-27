// Ejecuta backend/src/db/schema.sql contra la base de datos que indiquen
// las variables de entorno actuales (útil para no depender de psql).
//
// Uso: colocar este archivo en backend/src/db/run-schema.js y correr:
//   node src/db/run-schema.js
// desde la carpeta backend/.

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function main() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Ejecutando schema.sql contra la base configurada en .env...');
  try {
    await pool.query(sql);
    console.log('Esquema aplicado correctamente (tablas creadas o ya existentes).');
  } catch (err) {
    console.error('Error al aplicar el esquema:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
