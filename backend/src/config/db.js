// Configuración de la conexión a PostgreSQL.
// Crea un único Pool de conexiones (patrón recomendado por el driver pg)
// y expone una función query() reutilizable en toda la aplicación.

const dns = require('dns');
const net = require('net');
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

// --- Respaldo de DNS ---
// En algunas redes el resolver del sistema operativo falla de forma
// intermitente (getaddrinfo ENOTFOUND) aunque el dominio exista. Si eso
// ocurre, se consulta a DNS públicos antes de rendirse. El nombre original
// del host se sigue enviando en TLS (SNI), que Neon usa para identificar
// la base de datos, así que conectar por IP no afecta la autenticación.
const resolverPublico = new dns.Resolver();
resolverPublico.setServers(['1.1.1.1', '8.8.8.8']);

function lookupConRespaldo(hostname, options, callback) {
  dns.lookup(hostname, options, (err, address, family) => {
    if (!err || (err.code !== 'ENOTFOUND' && err.code !== 'EAI_AGAIN')) {
      return callback(err, address, family);
    }
    resolverPublico.resolve4(hostname, (errRespaldo, direcciones) => {
      if (errRespaldo || !direcciones.length) return callback(err);
      console.warn(`DNS del sistema no resolvió ${hostname}; se usó DNS público.`);
      if (options.all) {
        return callback(null, direcciones.map((ip) => ({ address: ip, family: 4 })));
      }
      callback(null, direcciones[0], 4);
    });
  });
}

// pg permite entregar su propio socket: es un net.Socket normal cuya
// conexión usa lookupConRespaldo en lugar de la resolución por defecto.
function crearSocket() {
  const socket = new net.Socket();
  const conectar = socket.connect.bind(socket);
  socket.connect = (port, hostDestino) => conectar({ port, host: hostDestino, lookup: lookupConRespaldo });
  return socket;
}

const pool = new Pool({
  host,
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'dietas_equinos',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  ssl: isLocal ? false : { rejectUnauthorized: false },
  stream: isLocal ? undefined : crearSocket,
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
