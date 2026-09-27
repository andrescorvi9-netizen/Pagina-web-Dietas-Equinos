// Controlador de dietas: valida parámetros de entrada y delega en el servicio.

const { obtenerDietaPorClaves, obtenerDietaPorId } = require('./dietas.service');

/**
 * GET /api/dietas?categoria=:clave&estado=:clave[&peso=NNN]
 * Devuelve la dieta completa de una combinación categoría + estado de salud.
 */
async function getDietaPorClaves(req, res) {
  const { categoria, estado, peso } = req.query;

  if (!categoria || !estado) {
    return res.status(400).json({
      error: 'Faltan parámetros obligatorios: "categoria" y "estado".',
    });
  }

  // El peso es opcional; si viene, debe ser un número positivo válido.
  let pesoNum;
  if (peso !== undefined && peso !== '') {
    pesoNum = Number(peso);
    if (Number.isNaN(pesoNum) || pesoNum <= 0) {
      return res.status(400).json({
        error: 'El parámetro "peso" debe ser un número positivo (kg).',
      });
    }
  }

  try {
    const dieta = await obtenerDietaPorClaves(categoria, estado, pesoNum);
    if (!dieta) {
      return res.status(404).json({
        error: `No existe dieta para la categoría "${categoria}" y el estado "${estado}".`,
      });
    }
    res.json(dieta);
  } catch (err) {
    console.error('Error al obtener la dieta:', err.message);
    res.status(500).json({ error: 'Error interno al obtener la dieta.' });
  }
}

/**
 * GET /api/dietas/:id
 * Devuelve la dieta completa por su id numérico.
 */
async function getDietaPorId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'El id de dieta debe ser un entero positivo.' });
  }

  const { peso } = req.query;
  let pesoNum;
  if (peso !== undefined && peso !== '') {
    pesoNum = Number(peso);
    if (Number.isNaN(pesoNum) || pesoNum <= 0) {
      return res.status(400).json({
        error: 'El parámetro "peso" debe ser un número positivo (kg).',
      });
    }
  }

  try {
    const dieta = await obtenerDietaPorId(id, pesoNum);
    if (!dieta) {
      return res.status(404).json({ error: `No existe dieta con id ${id}.` });
    }
    res.json(dieta);
  } catch (err) {
    console.error('Error al obtener la dieta por id:', err.message);
    res.status(500).json({ error: 'Error interno al obtener la dieta.' });
  }
}

module.exports = { getDietaPorClaves, getDietaPorId };
