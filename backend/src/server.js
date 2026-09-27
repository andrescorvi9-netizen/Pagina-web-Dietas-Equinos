// Punto de entrada del servidor: levanta la aplicación Express.

require('dotenv').config();
const app = require('./app');

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log('===========================================');
  console.log('  Servidor "Dietas para Equinos" iniciado');
  console.log(`  Frontend:  http://localhost:${PORT}/`);
  console.log(`  API:       http://localhost:${PORT}/api/health`);
  console.log('===========================================');
});
