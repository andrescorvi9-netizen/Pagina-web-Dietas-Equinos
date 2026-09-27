// Configuración de la conexión a PostgreSQL.
// Crea un único Pool de conexiones (patrón recomendado por el driver pg)
// y expone una función query() reutilizable en toda la aplicación.

const { Pool } = require('pg');
require('dotenv').config();

// El Pool lee automáticamente las variables PG* del entorno, pero las
// declaramos de forma explícita para mayor claridad y para poder documentarlas.
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'dietas_equinos',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
});

// Aviso temprano si la conexión falla de forma inesperada.
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

/**
 * Ejecuta una consulta SQL parametrizada.
 * @param {string} text - Sentencia SQL con marcadores $1, $2, ...
 * @param {Array} [params] - Valores para los marcadores.
 * @returns {Promise<import('pg').QueryResult>}
 */
function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
