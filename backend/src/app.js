// Configuración de la aplicación Express (sin levantar el servidor todavía).
// Define middlewares, rutas de la API y el servido del frontend estático.

const path = require('path');
const express = require('express');
const cors = require('cors');

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

// Healthcheck.
app.get('/api/health', (req, res) => {
  res.json({ estado: 'ok', servicio: 'dietas-equinos-api', hora: new Date().toISOString() });
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
