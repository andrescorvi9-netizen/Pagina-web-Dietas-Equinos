// Servicio de estados de salud: acceso a datos de la tabla "estados_salud".

const { query } = require('../../config/db');

/**
 * Devuelve todos los estados de salud ordenados por id (orden de inserción).
 * @returns {Promise<Array>}
 */
async function listarEstados() {
  const { rows } = await query(
    `SELECT id, clave, nombre, fuente, criterio_nutricional
     FROM estados_salud
     ORDER BY id ASC`
  );
  return rows;
}

module.exports = { listarEstados };
