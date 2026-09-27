# CLAUDE.md — Proyecto "Dietas para Equinos"

**Universidad de Cundinamarca · Ingeniería de Sistemas**
**Metodología:** XP | **Arquitectura:** Monolítica modular
**Stack:** Node.js + Express · PostgreSQL · HTML/CSS/JS vanilla

---

## Qué hace esta aplicación

El usuario caracteriza un caballo (nombre, código, categoría y estado de salud), opcionalmente indica su peso, y obtiene la dieta recomendada derivada del NRC (*Nutrient Requirements of Horses*, 6.ª ed.). La dieta se muestra en pantalla y puede descargarse como PDF generado en el navegador.

La fuente de verdad nutricional es un único archivo JSON maestro (`dietas_equinos_maestro.json`) que se cargó en PostgreSQL mediante un seed. El código nunca inventa ni modifica contenido nutricional.

---

## Estructura de archivos

```
dietas-equinos/
├── CLAUDE.md                          ← este archivo
├── README.md                          ← pasos para levantar el proyecto
│
├── backend/
│   ├── package.json                   ← dependencias: express, pg, dotenv, cors
│   ├── .env.example                   ← plantilla de variables de entorno
│   ├── .gitignore
│   │
│   ├── data/
│   │   └── dietas_equinos_maestro.json   ← FUENTE DE VERDAD (no modificar)
│   │
│   └── src/
│       ├── server.js                  ← punto de entrada: app.listen(PORT)
│       ├── app.js                     ← Express: middlewares, /api/*, express.static
│       │
│       ├── config/
│       │   └── db.js                  ← Pool pg + función query(text, params)
│       │
│       ├── db/
│       │   ├── schema.sql             ← DDL idempotente (CREATE TABLE IF NOT EXISTS)
│       │   └── seed.js                ← carga el JSON maestro en PostgreSQL
│       │
│       └── modules/
│           ├── categorias/
│           │   ├── categorias.routes.js    ← GET /api/categorias
│           │   └── categorias.service.js   ← listarCategorias()
│           │
│           ├── estados-salud/
│           │   ├── estados.routes.js       ← GET /api/estados-salud
│           │   └── estados.service.js      ← listarEstados()
│           │
│           └── dietas/
│               ├── dietas.routes.js        ← GET /api/dietas, GET /api/dietas/:id
│               ├── dietas.controller.js    ← parsea params, llama al service
│               └── dietas.service.js       ← JOIN SQL + agrupación de items + recálculo de ración
│
└── frontend/
    ├── index.html                     ← formulario + contenedor #resultado + botón PDF
    ├── css/
    │   └── styles.css                 ← paleta tierra/pradera, Fraunces + Source Sans + JetBrains Mono
    └── js/
        ├── api.js                     ← fetch al backend (window.API)
        ├── render.js                  ← pinta la dieta en el DOM (window.RENDER)
        ├── pdf.js                     ← genera el PDF con jsPDF CDN (window.PDF)
        └── main.js                    ← orquesta selects, eventos, botón PDF
```

---

## Modelo de datos PostgreSQL

### Tablas y relaciones

```
categorias (5 filas)
  id | clave           | nombre                          | descripcion | notas_nrc
  ---|-----------------|----------------------------------|-------------|----------
  PK | UNIQUE NOT NULL | potrillo, joven, adulto, ...    | texto       | texto

estados_salud (6 filas)
  id | clave                | nombre       | fuente ('documentado'|'inferido') | criterio_nutricional
  ---|----------------------|--------------|-----------------------------------|---------------------
  PK | UNIQUE NOT NULL      |              | CHECK constraint                  | texto

dietas (30 filas = 5 categorías × 6 estados)
  id | categoria_id (FK) | estado_salud_id (FK) | peso_actual_kg_ejemplo
     | ed_mcal_dia | pc_g_dia | ca_g_dia | p_g_dia
     | materia_seca_total_kg_dia | forraje_kg_ms_dia | concentrado_kg_ms_dia
     | criterio_racion | manejo_agua
  UNIQUE (categoria_id, estado_salud_id)

dieta_items (N filas por dieta)
  id | dieta_id (FK) | tipo (CHECK) | contenido | orden
  tipo puede ser: forraje_base | forraje_evitar | concentrado_recomendado
                  concentrado_evitar | suplementos | reglas_alimentacion | advertencias
  INDEX: dieta_id, tipo

perfiles_nrc (catálogo NRC crudo, no usado en el flujo principal)
  id | categoria_id (FK) | peso_maduro_grupo | subtipo
     | peso_actual_kg | ed_mcal_dia | pc_g_dia | lisina_g_dia
     | ca_g_dia | p_g_dia | mg_g_dia | k_g_dia | na_g_dia
     | zn_mg_dia | cu_mg_dia | se_mg_dia | vita_kui_dia | vite_ui_dia
  UNIQUE (categoria_id, peso_maduro_grupo, subtipo)
```

### Categorías (claves exactas en BD)

| clave           | nombre                             |
|-----------------|------------------------------------|
| potrillo        | Potrillo (0–12 meses)              |
| joven           | Joven (1–3 años)                   |
| adulto          | Adulto (mantenimiento / trabajo)   |
| yegua_gestante  | Yegua Gestante / Lactante          |
| caballo_tiro    | Caballo de Tiro / Alto Rendimiento |

### Estados de salud (claves exactas en BD)

| clave                | fuente       |
|----------------------|--------------|
| sin_complicaciones   | documentado  |
| deshidratacion       | inferido     |
| desnutricion         | inferido     |
| laminitis            | documentado  |
| colicos              | inferido     |
| influenza            | inferido     |

---

## API REST

Todos los endpoints tienen prefijo `/api`. El frontend lo sirve el mismo Express, por eso `api.js` usa rutas relativas (`/api/...`).

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/categorias` | Lista las 5 categorías (`id`, `clave`, `nombre`, `descripcion`, `notas_nrc`) |
| `GET` | `/api/estados-salud` | Lista los 6 estados (`id`, `clave`, `nombre`, `fuente`) |
| `GET` | `/api/dietas?categoria=:clave&estado=:clave[&peso=NNN]` | Dieta completa con items agrupados. Si se pasa `peso`, recalcula la ración. |
| `GET` | `/api/dietas/:id` | Igual que el anterior pero por id numérico |
| `GET` | `/api/health` | Healthcheck (verifica conexión a PostgreSQL) |

### Respuesta de `/api/dietas`

```json
{
  "id": 7,
  "categoria": { "clave": "adulto", "nombre": "...", "descripcion": "..." },
  "estado_salud": { "clave": "laminitis", "nombre": "...", "fuente": "documentado" },
  "criterio_nutricional": "...",
  "peso_usado_kg": 520,
  "requerimiento_nrc_referencia": {
    "peso_actual_kg_ejemplo": 500,
    "ED_Mcal_dia": 16.4,
    "PC_g_dia": 630,
    "Ca_g_dia": 20,
    "P_g_dia": 14
  },
  "plan_racion_estimado": {
    "materia_seca_total_kg_dia": 7.8,
    "forraje_kg_ms_dia": 7.41,
    "concentrado_kg_ms_dia": 0.39,
    "criterio": "..."
  },
  "manejo_agua": "...",
  "forraje_base": ["..."],
  "forraje_evitar": ["..."],
  "concentrado_recomendado": ["..."],
  "concentrado_evitar": ["..."],
  "suplementos": ["..."],
  "reglas_alimentacion": ["..."],
  "advertencias": ["..."]
}
```

---

## Recálculo de ración por peso

Cuando llega `?peso=NNN`, `dietas.service.js` usa la constante `FACTORES_RACION` (no el frontend) para recalcular `plan_racion_estimado`:

```js
// dietas.service.js — FACTORES_RACION
sin_complicaciones: { pct_ms: 0.020, pct_forraje: 0.70, pct_concentrado: 0.30 }
deshidratacion:     { pct_ms: 0.018, pct_forraje: 0.80, pct_concentrado: 0.20 }
desnutricion:       { pct_ms: 0.022, pct_forraje: 0.60, pct_concentrado: 0.40 }
laminitis:          { pct_ms: 0.015, pct_forraje: 0.95, pct_concentrado: 0.05 }
colicos:            { pct_ms: 0.018, pct_forraje: 0.85, pct_concentrado: 0.15 }
influenza:          { pct_ms: 0.018, pct_forraje: 0.80, pct_concentrado: 0.20 }
// total_ms = peso_kg × pct_ms
```

---

## Frontend — flujo de datos

```
DOMContentLoaded (main.js)
  → API.obtenerCategorias() + API.obtenerEstados()   ← fetch /api/categorias, /api/estados-salud
  → popula <select id="select-categoria"> y <select id="select-estado">

onChange (selects) / onChange (input-peso)
  → API.obtenerDieta(clave, clave, peso?)            ← fetch /api/dietas?categoria=&estado=[&peso=]
  → RENDER.renderDieta(dieta, { nombre, codigo, peso })
  → muestra <div id="acciones"> con botón PDF

onClick (btn-pdf)
  → PDF.generarPDF(dietaActual, { nombre, codigo, peso })
  → descarga nombre_caballo_dieta.pdf  (100% cliente, jsPDF CDN)
```

### Variables globales del frontend

| Variable | Definida en | Contenido |
|----------|-------------|-----------|
| `window.API` | `api.js` | `{ obtenerCategorias, obtenerEstados, obtenerDieta }` |
| `window.RENDER` | `render.js` | `{ renderDieta, limpiarResultado }` |
| `window.PDF` | `pdf.js` | `{ generarPDF }` |

---

## Variables de entorno

Archivo: `backend/.env` (copiar de `.env.example`)

```
PGHOST=localhost
PGPORT=5432
PGDATABASE=dietas_equinos
PGUSER=postgres
PGPASSWORD=123456
PORT=3000
```

`db.js` crea un `Pool` de `pg` leyendo estas variables con `dotenv` y exporta `query(text, params)` para todos los servicios.

> El archivo `backend/.env` ya existe con estas credenciales reales. No regenerar.

---

## Comandos

```bash
# Desde backend/
npm install                   # instalar dependencias (ya hecho)
node src/db/seed.js           # cargar datos en PostgreSQL (idempotente)
node src/server.js            # levantar servidor
# o:
npm start                     # equivale a node src/server.js
npm run seed                  # equivale a node src/db/seed.js
```

El servidor sirve el frontend en `http://localhost:3000/` y la API en `http://localhost:3000/api/`.

---

## Primer arranque (pasos manuales)

```sql
-- En psql o pgAdmin:
CREATE DATABASE dietas_equinos;
```

```bash
cd backend
Copy-Item .env.example .env   # PowerShell; ajustar PGUSER/PGPASSWORD
node src/db/seed.js           # verás resumen: 5 categorías, 6 estados, 30 dietas, N items
node src/server.js
# Abrir http://localhost:3000/
```

---

## Restricciones del proyecto

1. **No modificar** `backend/data/dietas_equinos_maestro.json`. Es la fuente de verdad; el seed es una carga fiel, no una reinterpretación.
2. **PDF 100% en cliente** con jsPDF (CDN). Nunca pre-generar ni almacenar PDFs en disco o BD.
3. **Frontend servido por Express** (`express.static`). No abrir `index.html` como archivo local.
4. **Todo en español**: código, comentarios, mensajes de error, UI.
5. El `seed.js` es idempotente: usa `ON CONFLICT DO NOTHING` en categorías y estados, y `ON CONFLICT DO UPDATE` en dietas antes de reinsertar sus items.

---

## Decisiones de diseño documentadas

- **`dieta_items` como tabla normalizada** en lugar de columnas `TEXT[]`: más legible en consultas SQL durante defensa académica, respeta 3FN y permite ordenar por `orden`.
- **`perfiles_nrc`** se carga en BD por trazabilidad académica pero no forma parte del flujo principal de la web (no hay endpoint dedicado).
- **`FACTORES_RACION` vive en el backend** (`dietas.service.js`), no en el frontend, para que nunca se desincronicen si se ajustan los porcentajes.
- **Frontend servido por el mismo proceso Express**: simplifica el arranque local (un solo `node src/server.js`), evita problemas de CORS y es correcto para este contexto universitario.

---

## Estado del entorno local (2026-06-27)

### Configuración verificada

| Componente | Estado | Detalle |
|---|---|---|
| Node.js | v24.16.0 | Instalado globalmente |
| PostgreSQL | 18 — servicio `postgresql-x64-18` | Instalado en `C:\Program Files\PostgreSQL\18\` |
| Base de datos | `dietas_equinos` creada | Propietario: `postgres` |
| Seed ejecutado | 5 cat · 6 estados · 30 dietas · 430 ítems · 44 perfiles NRC | Sin combinaciones faltantes |
| Puerto | 3000 | El servidor corre en `http://localhost:3000/` |

### Nota sobre el puerto 3000

En este equipo coexiste otro proceso Node en `F:\msQL` que también usa el puerto 3000. Para levantar nuestro servidor hay que asegurarse de que ese proceso esté detenido, o cambiarlo a `PORT=3001` en el `.env`.

El servicio de PostgreSQL **requiere permisos de administrador** para iniciarse si está detenido:
```powershell
# PowerShell como Administrador
net start "postgresql-x64-18"
```

### Psql disponible en

```
C:\Program Files\PostgreSQL\18\bin\psql.exe
```

Uso con contraseña por variable de entorno para evitar prompt interactivo:
```powershell
$env:PGPASSWORD = "123456"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d dietas_equinos -c "<consulta>"
```

---

## Pruebas de integración realizadas (2026-06-27)

Flujo completo verificado con Playwright + Microsoft Edge contra `http://localhost:3000/`:

| Paso | Verificado |
|------|-----------|
| Carga inicial — título y formulario visibles | PASS |
| Selects poblados desde la API (5 cat + 6 estados) | PASS |
| Dieta renderizada al seleccionar categoría + estado | PASS |
| Nombre y código del caballo aparecen en la ficha | PASS |
| Recálculo de ración al ingresar peso real (520 kg) | PASS |
| Botón PDF visible solo cuando hay dieta cargada | PASS |
| Descarga de PDF generada en cliente (`dieta_EQ-001_laminitis.pdf`) | PASS |
| Cambio de selects actualiza la dieta sin recargar la página | PASS |
| Ruta inválida devuelve HTTP 404 con mensaje descriptivo | PASS |

**Comportamiento observado del PDF:** el archivo se nombra automáticamente como `dieta_<codigo>_<estado>.pdf`.
