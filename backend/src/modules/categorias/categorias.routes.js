// Rutas del módulo de categorías.

const express = require('express');
const { listarCategorias } = require('./categorias.service');

const router = express.Router();

// GET /api/categorias -> lista todas las categorías de caballo.
router.get('/', async (req, res) => {
  try {
    const categorias = await listarCategorias();
    res.json(categorias);
  } catch (err) {
    console.error('Error al listar categorías:', err.message);
    res.status(500).json({ error: 'No se pudieron obtener las categorías.' });
  }
});

module.exports = router;
