// Servicio de dietas: consulta y arma la dieta completa (con sus items
// agrupados) para una combinación categoría + estado de salud, o por id.

const { query } = require('../../config/db');

// ---------------------------------------------------------------------
// Constantes de recálculo de ración por estado de salud.
//
// Cuando el usuario indica el peso real del caballo (?peso=NNN), el plan
// de ración (kg de materia seca/día) se recalcula con estos porcentajes,
// derivados de los criterios documentados en el archivo maestro NRC:
//   - pct_ms: % del peso corporal consumido como materia seca/día
//   - pct_forraje / pct_concentrado: reparto de esa materia seca
// ---------------------------------------------------------------------
const FACTORES_RACION = {
  sin_complicaciones: { pct_ms: 0.020, pct_forraje: 0.70, pct_concentrado: 0.30 },
  deshidratacion:     { pct_ms: 0.018, pct_forraje: 0.80, pct_concentrado: 0.20 },
  desnutricion:       { pct_ms: 0.022, pct_forraje: 0.60, pct_concentrado: 0.40 },
  laminitis:          { pct_ms: 0.015, pct_forraje: 0.95, pct_concentrado: 0.05 },
  colicos:            { pct_ms: 0.018, pct_forraje: 0.85, pct_concentrado: 0.15 },
  influenza:          { pct_ms: 0.018, pct_forraje: 0.80, pct_concentrado: 0.20 },
};

// Tipos de listas que se devuelven agrupadas en la respuesta.
const TIPOS_ITEMS = [
  'forraje_base',
  'forraje_evitar',
  'concentrado_recomendado',
  'concentrado_evitar',
  'suplementos',
  'reglas_alimentacion',
  'advertencias',
];

// Convierte un string numérico de PostgreSQL (NUMERIC llega como string)
// a número, conservando null.
function num(v) {
  return v === null || v === undefined ? null : Number(v);
}

// Redondea a 2 decimales.
function redondear2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Recalcula el plan de ración a partir del peso real del caballo.
 * @param {string} claveEstado - clave del estado de salud.
 * @param {number} pesoKg - peso real del caballo en kg.
 * @returns {object|null} plan recalculado o null si no hay factores.
 */
function recalcularRacion(claveEstado, pesoKg) {
  const f = FACTORES_RACION[claveEstado];
  if (!f || !pesoKg || pesoKg <= 0) return null;
  const totalMs = pesoKg * f.pct_ms;
  return {
    materia_seca_total_kg_dia: redondear2(totalMs),
    forraje_kg_ms_dia: redondear2(totalMs * f.pct_forraje),
    concentrado_kg_ms_dia: redondear2(totalMs * f.pct_concentrado),
    criterio: `${(f.pct_ms * 100).toFixed(1)}% del peso corporal en MS/día ` +
      `(${Math.round(f.pct_forraje * 100)}% forraje / ${Math.round(f.pct_concentrado * 100)}% concentrado) ` +
      `recalculado para ${pesoKg} kg`,
  };
}

/**
 * Construye el objeto de respuesta a partir de la fila de dieta y sus items.
 * @param {object} dieta - fila de la consulta de dieta.
 * @param {Array} items - filas de dieta_items.
 * @param {number} [pesoOpcional] - peso real para recalcular ración.
 */
function armarRespuesta(dieta, items, pesoOpcional) {
  // Agrupar items por tipo.
  const grupos = {};
  for (const tipo of TIPOS_ITEMS) grupos[tipo] = [];
  for (const item of items) {
    if (grupos[item.tipo]) grupos[item.tipo].push(item.contenido);
  }

  // Plan de ración: usa el estimado de la BD, o lo recalcula si hay peso.
  let plan = {
    materia_seca_total_kg_dia: num(dieta.materia_seca_total_kg_dia),
    forraje_kg_ms_dia: num(dieta.forraje_kg_ms_dia),
    concentrado_kg_ms_dia: num(dieta.concentrado_kg_ms_dia),
    criterio: dieta.criterio_racion,
  };
  let pesoUsado = null;
  if (pesoOpcional) {
    const recalc = recalcularRacion(dieta.estado_clave, pesoOpcional);
    if (recalc) {
      plan = recalc;
      pesoUsado = pesoOpcional;
    }
  }

  return {
    id: dieta.id,
    categoria: {
      clave: dieta.categoria_clave,
      nombre: dieta.categoria_nombre,
      descripcion: dieta.categoria_descripcion,
    },
    estado_salud: {
      clave: dieta.estado_clave,
      nombre: dieta.estado_nombre,
      fuente: dieta.estado_fuente,
    },
    criterio_nutricional: dieta.estado_criterio,
    peso_usado_kg: pesoUsado,
    requerimiento_nrc_referencia: {
      peso_actual_kg_ejemplo: num(dieta.peso_actual_kg_ejemplo),
      ED_Mcal_dia: num(dieta.ed_mcal_dia),
      PC_g_dia: num(dieta.pc_g_dia),
      Ca_g_dia: num(dieta.ca_g_dia),
      P_g_dia: num(dieta.p_g_dia),
    },
    plan_racion_estimado: plan,
    manejo_agua: dieta.manejo_agua,
    forraje_base: grupos.forraje_base,
    forraje_evitar: grupos.forraje_evitar,
    concentrado_recomendado: grupos.concentrado_recomendado,
    concentrado_evitar: grupos.concentrado_evitar,
    suplementos: grupos.suplementos,
    reglas_alimentacion: grupos.reglas_alimentacion,
    advertencias: grupos.advertencias,
  };
}

// Consulta SQL base que une dieta + categoría + estado de salud.
const SELECT_DIETA = `
  SELECT
    d.id,
    d.peso_actual_kg_ejemplo, d.ed_mcal_dia, d.pc_g_dia, d.ca_g_dia, d.p_g_dia,
    d.materia_seca_total_kg_dia, d.forraje_kg_ms_dia, d.concentrado_kg_ms_dia,
    d.criterio_racion, d.manejo_agua,
    c.clave AS categoria_clave, c.nombre AS categoria_nombre,
    c.descripcion AS categoria_descripcion,
    e.clave AS estado_clave, e.nombre AS estado_nombre,
    e.fuente AS estado_fuente, e.criterio_nutricional AS estado_criterio
  FROM dietas d
  JOIN categorias c ON c.id = d.categoria_id
  JOIN estados_salud e ON e.id = d.estado_salud_id
`;

async function obtenerItems(dietaId) {
  const { rows } = await query(
    `SELECT tipo, contenido, orden
     FROM dieta_items
     WHERE dieta_id = $1
     ORDER BY tipo ASC, orden ASC`,
    [dietaId]
  );
  return rows;
}

/**
 * Obtiene la dieta por clave de categoría y clave de estado de salud.
 * @returns {Promise<object|null>}
 */
async function obtenerDietaPorClaves(categoriaClave, estadoClave, pesoOpcional) {
  const { rows } = await query(
    `${SELECT_DIETA} WHERE c.clave = $1 AND e.clave = $2 LIMIT 1`,
    [categoriaClave, estadoClave]
  );
  if (rows.length === 0) return null;
  const dieta = rows[0];
  const items = await obtenerItems(dieta.id);
  return armarRespuesta(dieta, items, pesoOpcional);
}

/**
 * Obtiene la dieta por su id numérico.
 * @returns {Promise<object|null>}
 */
async function obtenerDietaPorId(id, pesoOpcional) {
  const { rows } = await query(`${SELECT_DIETA} WHERE d.id = $1 LIMIT 1`, [id]);
  if (rows.length === 0) return null;
  const dieta = rows[0];
  const items = await obtenerItems(dieta.id);
  return armarRespuesta(dieta, items, pesoOpcional);
}

module.exports = {
  obtenerDietaPorClaves,
  obtenerDietaPorId,
  FACTORES_RACION,
};
