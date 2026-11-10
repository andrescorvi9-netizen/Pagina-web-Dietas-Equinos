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
├── .gitignore                         ← node_modules, .env, .vercel, logs...
├── vercel.json                        ← config de deploy (install, outputDirectory, rewrites)
│
├── api/
│   └── index.js                       ← función serverless de Vercel: reexporta backend/src/app.js
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
│       │   └── db.js                  ← Pool pg + query(); SSL automático si el host no es local
│       │
│       ├── db/
│       │   ├── schema.sql             ← DDL idempotente (CREATE TABLE IF NOT EXISTS)
│       │   ├── run-schema.js          ← aplica schema.sql sin necesitar psql
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

Todos los endpoints tienen prefijo `/api`. El frontend y la API comparten origen (Express en local, Vercel en producción), por eso `api.js` usa rutas relativas (`/api/...`).

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/categorias` | Lista las 5 categorías (`id`, `clave`, `nombre`, `descripcion`, `notas_nrc`) |
| `GET` | `/api/estados-salud` | Lista los 6 estados (`id`, `clave`, `nombre`, `fuente`) |
| `GET` | `/api/dietas?categoria=:clave&estado=:clave[&peso=NNN]` | Dieta completa con items agrupados. Si se pasa `peso`, recalcula la ración. |
| `GET` | `/api/dietas/:id` | Igual que el anterior pero por id numérico |
| `GET` | `/api/health` | Healthcheck: ejecuta `SELECT 1`. 200 con `base_datos: "conectada"` o 503 con `base_datos: "sin conexión"` |

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

Archivo: `backend/.env` (copiar de `.env.example`). Se usan los nombres estándar `PG*`, los mismos que genera la integración de Neon en Vercel:

```
PGHOST=...          # localhost, o ep-xxxx-pooler.region.aws.neon.tech para Neon
PGPORT=5432         # opcional, 5432 por defecto
PGDATABASE=...      # dietas_equinos (local) | neondb (Neon)
PGUSER=...          # postgres (local) | neondb_owner (Neon)
PGPASSWORD=...
PORT=3000
```

`db.js`:
- Carga `backend/.env` por **ruta absoluta** (`path.join(__dirname, '..', '..', '.env')`), así funciona sin importar desde qué carpeta se ejecute Node (incluida la función `api/index.js`).
- Activa **SSL automáticamente** (`{ rejectUnauthorized: true }`) cuando `PGHOST` no es `localhost`/`127.0.0.1`, como exige Neon. **Se valida el certificado TLS del servidor** (cadena de confianza y nombre de host) para evitar ataques de intermediario; con `localhost` el SSL queda desactivado (`ssl: false`).
- La validación del nombre usa el hostname de `PGHOST`, no la IP: `pg` envía `PGHOST` como SNI/`servername` aunque el socket propio (`crearSocket`) conecte por IP, incluso cuando la IP se obtuvo por el DNS público de respaldo. El certificado de Neon es comodín (`*.c-14.us-east-1.aws.neon.tech`, Let's Encrypt), así que no hace falta un `servername` explícito ni un CA propio.
- Llama a `dns.setDefaultResultOrder('ipv4first')` para priorizar IPv4.
- Si el DNS del sistema no resuelve el host remoto, usa DNS públicos como respaldo (ver "Incidencia conocida" más abajo).
- Exporta `pool` y `query(text, params)` para todos los servicios.

> `backend/.env` ya existe y **actualmente apunta a Neon** (credenciales reales pegadas desde el panel de Neon). No regenerar ni sobrescribir. Nunca se sube a git (lo cubre `backend/.gitignore` y el `.gitignore` raíz). `.env.example` debe contener **solo placeholders**.

---

## Comandos

```bash
# Desde backend/
npm install                   # instalar dependencias (ya hecho)
node src/db/run-schema.js     # solo aplicar schema.sql (sin psql)
node src/db/seed.js           # cargar datos en PostgreSQL (idempotente, también aplica el esquema)
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
3. **Frontend servido por Express** (`express.static`) en local y por la CDN de Vercel en producción. No abrir `index.html` como archivo local.
4. **Todo en español**: código, comentarios, mensajes de error, UI, commits.
5. El `seed.js` es idempotente: usa `ON CONFLICT DO NOTHING` en categorías y estados, y `ON CONFLICT DO UPDATE` en dietas antes de reinsertar sus items.
6. **Nunca subir credenciales**: antes de cada commit revisar `git status` y confirmar que `backend/.env` no aparece y que `.env.example` solo tiene placeholders.
7. **`app.js` no llama a `app.listen`**: lo hace `server.js` (local). Vercel importa `app` desde `api/index.js`. Cualquier ruta nueva se registra en `app.js` para que funcione en ambos entornos.

---

## Decisiones de diseño documentadas

- **`dieta_items` como tabla normalizada** en lugar de columnas `TEXT[]`: más legible en consultas SQL durante defensa académica, respeta 3FN y permite ordenar por `orden`.
- **`perfiles_nrc`** se carga en BD por trazabilidad académica pero no forma parte del flujo principal de la web (no hay endpoint dedicado).
- **`FACTORES_RACION` vive en el backend** (`dietas.service.js`), no en el frontend, para que nunca se desincronicen si se ajustan los porcentajes.
- **Frontend servido por el mismo proceso Express**: simplifica el arranque local (un solo `node src/server.js`), evita problemas de CORS y es correcto para este contexto universitario.
- **Deploy en Vercel sin reestructurar carpetas**: en vez de mover el backend a la raíz o duplicar dependencias, `api/index.js` reexporta la app Express existente y `vercel.json` instala las dependencias de `backend/`. Local y producción ejecutan exactamente el mismo código.

---

## Despliegue en producción (Vercel + Neon)

| Elemento | Valor |
|---|---|
| URL de producción | https://pagina-web-dietas-equinos.vercel.app |
| Repositorio | https://github.com/andrescorvi9-netizen/Pagina-web-Dietas-Equinos (rama `main`) |
| Proyecto Vercel | `pagina-web-dietas-equinos` (team "Dietas"), framework "Other" |
| Base de datos | Neon (integración de Vercel, sin prefijo de variables) — BD `neondb`, usuario `neondb_owner` |
| Deploy | Automático en cada push a `main` |

### Cómo funciona

```
Petición → Vercel
  ├── /api/*        → rewrite (vercel.json) → función api/index.js → app Express (backend/src/app.js)
  │                    └── req.url conserva la ruta original, así Express enruta igual que en local
  └── resto de rutas → archivos estáticos de frontend/ (outputDirectory)
```

`vercel.json` (raíz):
- `installCommand: "npm install --prefix backend"` → las dependencias viven solo en `backend/package.json`.
- `buildCommand` es un `echo` (no hay paso de build).
- `outputDirectory: "frontend"`.
- `rewrites: /api/(.*) → /api`.

### Reglas para no romper el deploy

- El **Root Directory** del proyecto en Vercel debe quedar en la raíz (`./`). Si se cambia a `backend/`, Vercel deja de leer `vercel.json` y de ver `frontend/` y `api/`.
- Las variables `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` las inyecta la integración de Neon en Vercel; no hace falta `.env` en producción. `PGPORT` es opcional (5432 por defecto).
- En producción `PGHOST` es el host **pooled** (`-pooler`), adecuado para funciones serverless.
- Para cargar o actualizar datos en Neon: con `backend/.env` apuntando a Neon, correr `node src/db/seed.js` desde `backend/`.
- Verificación rápida tras un deploy: `GET /api/health` debe devolver `base_datos: "conectada"`.

### Incidencia conocida: `ENOTFOUND` al conectar a Neon (2026-09-27)

`node src/db/seed.js` y el servidor local fallaron varias veces con `getaddrinfo ENOTFOUND ep-...-pooler...neon.tech`. **Causa:** el resolver DNS de Windows (`getaddrinfo`, el que usan Node y .NET) falla de forma intermitente en este equipo, aunque el router `192.168.80.1` y `1.1.1.1` responden bien consultados directamente. No es un problema del código ni de Neon.

**Solución aplicada en `db.js`:** el `Pool` recibe `stream: crearSocket`, un `net.Socket` cuya conexión usa `lookupConRespaldo`: primero intenta el DNS del sistema y, solo ante `ENOTFOUND`/`EAI_AGAIN`, resuelve con DNS públicos (`1.1.1.1`, `8.8.8.8`) y registra un aviso en consola. `pg` sigue enviando el hostname original como SNI en TLS, que Neon necesita para identificar el endpoint y contra el que se valida el certificado (`rejectUnauthorized: true`). Solo se activa con hosts no locales. Opcional a nivel de sistema: poner `1.1.1.1` / `8.8.8.8` como DNS del adaptador Wi-Fi.

---

## Estado del entorno local (actualizado 2026-09-27)

### Configuración verificada

| Componente | Estado | Detalle |
|---|---|---|
| Node.js | v24.16.0 | El `node` del PATH es `F:\msQL\node.exe` |
| PostgreSQL local | 18 — servicio `postgresql-x64-18` | Instalado en `C:\Program Files\PostgreSQL\18\`; BD `dietas_equinos` (propietario `postgres`) |
| Base de datos activa | **Neon** (`neondb`) | `backend/.env` apunta a Neon desde 2026-09-27 |
| Seed en Neon | 5 cat · 6 estados · 30 dietas · 430 ítems · 44 perfiles NRC | Sin combinaciones faltantes (2026-09-27) |
| Seed en local | Mismos conteos | Ejecutado 2026-06-27 |
| Puerto | 3000 | El servidor corre en `http://localhost:3000/` |

Para volver a trabajar contra el Postgres local, cambiar las variables `PG*` de `backend/.env` a los valores locales (el SSL se desactiva solo con `PGHOST=localhost`).

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
$env:PGPASSWORD = "<contraseña_local_de_postgres>"
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

## Pruebas contra Neon y producción (2026-09-27)

| Prueba | Entorno | Resultado |
|--------|---------|-----------|
| `GET /api/health`, `/api/categorias`, `/api/estados-salud`, `/api/dietas?categoria=adulto&estado=laminitis[&peso=520]` | Local (`localhost:3001`) contra Neon | 200; numéricos llegan como `number` |
| Origen de datos | Local | `current_database() = neondb`, `current_user = neondb_owner` |
| `api/index.js` cargado desde la raíz (simulación de Vercel) | Local | 200 en todos los endpoints; 404 JSON en ruta de API inválida |
| `/`, `/css/styles.css` | Producción | 200 (frontend estático) |
| `/api/health` | Producción | 200, `base_datos: "conectada"` |
| `/api/categorias`, `/api/dietas?categoria=adulto&estado=laminitis&peso=520` | Producción | 200 |
| `/api/no-existe` | Producción | 404 `{"error":"Recurso de API no encontrado."}` |
