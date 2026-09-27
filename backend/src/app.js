// Configuración de la aplicación Express (sin levantar el servidor todavía).
// Define middlewares, rutas de la API y el servido del frontend estático.

const path = require('path');
const express = require('express');
const cors = require('cors');

const { query } = require('./config/db');

const categoriasRoutes = require('./modules/categorias/categorias.routes');
const estadosRoutes = require('./modules/estados-salud/estados.routes');
const dietasRoutes = require('./modules/dietas/dietas.routes');

const app = express();

// --- Middlewares globales ---
app.use(cors());
app.use(express.json());

// --- Rutas de la API (prefijo /api) ---
app.use('/api/categorias', categoriasRoutes);
app.use('/api/estados-salud', estadosRoutes);
app.use('/api/dietas', dietasRoutes);

// Healthcheck: verifica también la conexión a PostgreSQL.
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ estado: 'ok', servicio: 'dietas-equinos-api', base_datos: 'conectada', hora: new Date().toISOString() });
  } catch (err) {
    console.error('Healthcheck: fallo de conexión a PostgreSQL:', err.message);
    res.status(503).json({ estado: 'error', servicio: 'dietas-equinos-api', base_datos: 'sin conexión' });
  }
});

// --- Frontend estático ---
// El frontend se sirve desde Express (no se abre el HTML directamente).
const rutaFrontend = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(rutaFrontend));

// Para cualquier ruta no-API, devolver el index.html del frontend.
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(rutaFrontend, 'index.html'));
});

// --- Manejo de rutas de API no encontradas ---
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Recurso de API no encontrado.' });
});

module.exports = app;
