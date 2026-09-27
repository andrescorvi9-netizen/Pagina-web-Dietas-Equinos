// Rutas del módulo de estados de salud.

const express = require('express');
const { listarEstados } = require('./estados.service');

const router = express.Router();

// GET /api/estados-salud -> lista todos los estados de salud.
router.get('/', async (req, res) => {
  try {
    const estados = await listarEstados();
    res.json(estados);
  } catch (err) {
    console.error('Error al listar estados de salud:', err.message);
    res.status(500).json({ error: 'No se pudieron obtener los estados de salud.' });
  }
});

module.exports = router;
