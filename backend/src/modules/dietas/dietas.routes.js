// Rutas del módulo de dietas.

const express = require('express');
const { getDietaPorClaves, getDietaPorId } = require('./dietas.controller');

const router = express.Router();

// GET /api/dietas?categoria=:clave&estado=:clave[&peso=NNN]
router.get('/', getDietaPorClaves);

// GET /api/dietas/:id  (id numérico)
router.get('/:id(\\d+)', getDietaPorId);

module.exports = router;
