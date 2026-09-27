-- =====================================================================
-- Esquema de base de datos: Proyecto "Dietas para Equinos"
-- Universidad de Cundinamarca - Ingeniería de Sistemas
-- Motor: PostgreSQL
--
-- Se usa "CREATE TABLE IF NOT EXISTS" para que el script sea idempotente:
-- puede ejecutarse varias veces sin error si las tablas ya existen.
-- =====================================================================

-- Categorías de caballo (potrillo, joven, adulto, yegua_gestante, caballo_tiro)
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  clave VARCHAR(50) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  notas_nrc TEXT
);

-- Estados de salud (sin_complicaciones, deshidratacion, desnutricion,
-- laminitis, colicos, influenza)
CREATE TABLE IF NOT EXISTS estados_salud (
  id SERIAL PRIMARY KEY,
  clave VARCHAR(50) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  fuente VARCHAR(20) NOT NULL CHECK (fuente IN ('documentado', 'inferido')),
  criterio_nutricional TEXT
);

-- Dieta concreta para una combinación categoría + estado de salud.
CREATE TABLE IF NOT EXISTS dietas (
  id SERIAL PRIMARY KEY,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  estado_salud_id INTEGER NOT NULL REFERENCES estados_salud(id) ON DELETE CASCADE,
  peso_actual_kg_ejemplo NUMERIC(6,1),
  ed_mcal_dia NUMERIC(6,2),
  pc_g_dia NUMERIC(7,2),
  ca_g_dia NUMERIC(6,2),
  p_g_dia NUMERIC(6,2),
  materia_seca_total_kg_dia NUMERIC(5,2),
  forraje_kg_ms_dia NUMERIC(5,2),
  concentrado_kg_ms_dia NUMERIC(5,2),
  criterio_racion TEXT,
  manejo_agua TEXT,
  UNIQUE (categoria_id, estado_salud_id)
);

-- Ítems de cada dieta (listas: forrajes, concentrados, suplementos, reglas,
-- advertencias). Cada fila es un elemento de una de esas listas.
CREATE TABLE IF NOT EXISTS dieta_items (
  id SERIAL PRIMARY KEY,
  dieta_id INTEGER NOT NULL REFERENCES dietas(id) ON DELETE CASCADE,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
    'forraje_base', 'forraje_evitar',
    'concentrado_recomendado', 'concentrado_evitar',
    'suplementos', 'reglas_alimentacion', 'advertencias'
  )),
  contenido TEXT NOT NULL,
  orden SMALLINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_dieta_items_dieta_id ON dieta_items(dieta_id);
CREATE INDEX IF NOT EXISTS idx_dieta_items_tipo ON dieta_items(tipo);

-- Perfiles de requerimientos NRC detallados por categoría, grupo de peso
-- maduro y subtipo (edad, nivel de trabajo, etapa de gestación, etc.).
CREATE TABLE IF NOT EXISTS perfiles_nrc (
  id SERIAL PRIMARY KEY,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  peso_maduro_grupo VARCHAR(50) NOT NULL,
  subtipo VARCHAR(50) NOT NULL,
  peso_actual_kg NUMERIC(6,1),
  ed_mcal_dia NUMERIC(6,2),
  pc_g_dia NUMERIC(7,2),
  lisina_g_dia NUMERIC(6,2),
  ca_g_dia NUMERIC(6,2),
  p_g_dia NUMERIC(6,2),
  mg_g_dia NUMERIC(6,2),
  k_g_dia NUMERIC(6,2),
  na_g_dia NUMERIC(6,2),
  zn_mg_dia NUMERIC(7,2),
  cu_mg_dia NUMERIC(7,2),
  se_mg_dia NUMERIC(6,3),
  vita_kui_dia NUMERIC(8,2),
  vite_ui_dia NUMERIC(7,2)
);

-- Evita perfiles duplicados al re-ejecutar el seed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_perfiles_nrc_unico
  ON perfiles_nrc(categoria_id, peso_maduro_grupo, subtipo);
