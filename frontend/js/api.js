// api.js — Capa de acceso a la API REST del backend.
// Todas las funciones devuelven promesas y lanzan Error con mensaje en
// español si la petición falla.

// Como el frontend lo sirve el mismo Express, usamos rutas relativas.
const API_BASE = '/api';

/**
 * Realiza una petición GET y devuelve el JSON. Lanza Error si falla.
 * @param {string} ruta
 */
async function pedirJSON(ruta) {
  let respuesta;
  try {
    respuesta = await fetch(ruta);
  } catch (e) {
    throw new Error('No se pudo conectar con el servidor. ¿Está encendido?');
  }
  if (!respuesta.ok) {
    let detalle = `Error ${respuesta.status}`;
    try {
      const cuerpo = await respuesta.json();
      if (cuerpo && cuerpo.error) detalle = cuerpo.error;
    } catch (_) { /* respuesta sin cuerpo JSON */ }
    throw new Error(detalle);
  }
  return respuesta.json();
}

/** Obtiene la lista de categorías. */
function obtenerCategorias() {
  return pedirJSON(`${API_BASE}/categorias`);
}

/** Obtiene la lista de estados de salud. */
function obtenerEstados() {
  return pedirJSON(`${API_BASE}/estados-salud`);
}

/**
 * Obtiene la dieta para una categoría y estado, con peso opcional.
 * @param {string} categoriaClave
 * @param {string} estadoClave
 * @param {number} [pesoOpcional]
 */
function obtenerDieta(categoriaClave, estadoClave, pesoOpcional) {
  const params = new URLSearchParams({
    categoria: categoriaClave,
    estado: estadoClave,
  });
  if (pesoOpcional) params.set('peso', String(pesoOpcional));
  return pedirJSON(`${API_BASE}/dietas?${params.toString()}`);
}

// Exponer en el ámbito global para los demás módulos.
window.API = { obtenerCategorias, obtenerEstados, obtenerDieta };
