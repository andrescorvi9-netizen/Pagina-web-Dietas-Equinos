// Configuración de la conexión a PostgreSQL.
// Crea un único Pool de conexiones (patrón recomendado por el driver pg)
// y expone una función query() reutilizable en toda la aplicación.

const dns = require('dns');
const path = require('path');
const { Pool } = require('pg');

// Se carga backend/.env por ruta absoluta para que funcione sin importar
// desde qué carpeta se ejecute Node (por ejemplo, la función de Vercel en
// /api). En Vercel no existe .env: las variables las inyecta la plataforma.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Algunas redes resuelven mal IPv6 y Node intenta esa dirección primero,
// lo que puede aparecer como ENOTFOUND o timeouts intermitentes al
// conectar a hosts con ambos tipos de registro (como los de Neon).
// Forzamos a que se priorice IPv4 en la resolución DNS.
dns.setDefaultResultOrder('ipv4first');

// El Pool lee automáticamente las variables PG* del entorno, pero las
// declaramos de forma explícita para mayor claridad y para poder documentarlas.
const host = process.env.PGHOST || 'localhost';

// Neon (y la mayoría de proveedores en la nube) exige SSL; Postgres local no.
// Se activa automáticamente según el host, sin necesidad de otra variable.
const isLocal = host === 'localhost' || host === '127.0.0.1';

const pool = new Pool({
  host,
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'dietas_equinos',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  ssl: isLocal ? false : { rejectUnauthorized: false },
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
