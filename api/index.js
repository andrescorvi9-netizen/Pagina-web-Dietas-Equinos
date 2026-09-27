// Punto de entrada serverless para Vercel.
// Vercel convierte cada archivo de /api en una función; esta reutiliza la
// misma aplicación Express del backend (sin app.listen), de modo que en
// local (node src/server.js) y en producción se ejecuta exactamente el
// mismo código. Las rutas /api/* llegan aquí por el rewrite de vercel.json
// y el frontend estático lo sirve directamente la CDN de Vercel.

const app = require('../backend/src/app');

module.exports = app;
