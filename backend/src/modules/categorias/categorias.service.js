// Servicio de categorías: acceso a datos de la tabla "categorias".

const { query } = require('../../config/db');

/**
 * Devuelve todas las categorías ordenadas por id (orden de inserción).
 * @returns {Promise<Array>}
 */
async function listarCategorias() {
  const { rows } = await query(
    `SELECT id, clave, nombre, descripcion, notas_nrc
     FROM categorias
     ORDER BY id ASC`
  );
  return rows;
}

module.exports = { listarCategorias };
