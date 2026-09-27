# Dietas para Equinos

Aplicación web para generar recomendaciones de dietas para caballos basadas en
el **NRC (*Nutrient Requirements of Horses*, 6.ª ed.)**.

**Universidad de Cundinamarca · Ingeniería de Sistemas**
Metodología **XP** · Arquitectura **monolítica modular**
Stack: **Node.js + Express** (backend) · **PostgreSQL** (persistencia) · **HTML/CSS/JS vanilla** (frontend)

---

## ¿Qué hace?

1. Permite **caracterizar al caballo**: nombre y código de identificación.
2. Selección de **categoría** + **estado de salud** (+ **peso** opcional).
3. Muestra la **dieta resultante** (ración, forrajes, concentrados, suplementos,
   reglas de alimentación, manejo del agua y advertencias).
4. Descarga la dieta como **PDF generado en el navegador** (incluye todos los
   datos del caballo además de la dieta). El PDF se construye al vuelo en el
   cliente con jsPDF; no se pre-genera ni pasa por el backend.

---

## Requisitos previos

- **Node.js** 18 o superior.
- **PostgreSQL** instalado y corriendo localmente, con las herramientas de
  línea de comandos (`psql`, `createdb`) accesibles en el PATH.

---

## Instalación y ejecución (paso a paso)

> Todos los comandos del backend se ejecutan desde la carpeta `backend/`.

### 1. Instalar dependencias

```bash
cd backend
npm install
```

(Las dependencias `express`, `pg`, `dotenv` y `cors` ya están declaradas en
`package.json`.)

### 2. Crear la base de datos

Con la línea de comandos de PostgreSQL:

```bash
createdb dietas_equinos
```

o, desde dentro de `psql`:

```sql
CREATE DATABASE dietas_equinos;
```

### 3. Configurar las variables de entorno

Copia el archivo de ejemplo y ajusta las credenciales a tu instalación local:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

Contenido de `.env` (ajusta `PGUSER` / `PGPASSWORD` según tu PostgreSQL):

```
PGHOST=localhost
PGPORT=5432
PGDATABASE=dietas_equinos
PGUSER=postgres
PGPASSWORD=postgres
PORT=3000
```

### 4. Cargar los datos (seed)

```bash
node src/db/seed.js
```

Este script crea las tablas (si no existen), carga el archivo maestro y muestra
un resumen. Es **idempotente**: puedes volver a ejecutarlo sin duplicar datos.

### 5. Levantar el servidor

```bash
node src/server.js
```

### 6. Abrir la aplicación

El frontend lo sirve el propio Express:

```
http://localhost:3000/
```

---

## API REST

Prefijo: `/api`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/categorias` | Lista de categorías |
| GET | `/api/estados-salud` | Lista de estados de salud |
| GET | `/api/dietas?categoria=:clave&estado=:clave[&peso=NNN]` | Dieta completa con ítems agrupados |
| GET | `/api/dietas/:id` | Igual, por id numérico |
| GET | `/api/health` | Healthcheck |

### Recálculo por peso

Si se incluye `?peso=NNN`, el `plan_racion_estimado` se **recalcula** usando los
porcentajes de materia seca por estado de salud (ver `FACTORES_RACION` en
`src/modules/dietas/dietas.service.js`). Sin `peso`, se devuelve el plan estimado
del archivo maestro.

---

## Estructura del proyecto

```
dietas-equinos/
├── backend/
│   ├── src/
│   │   ├── config/db.js
│   │   ├── db/{schema.sql, seed.js}
│   │   ├── modules/{categorias, estados-salud, dietas}/
│   │   ├── app.js
│   │   └── server.js
│   ├── data/dietas_equinos_maestro.json
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── css/styles.css
│   └── js/{api.js, render.js, pdf.js, main.js}
├── CLAUDE.md
└── README.md
```

---

## Modelo de datos

- **categorias** (5): `potrillo`, `joven`, `adulto`, `yegua_gestante`, `caballo_tiro`.
- **estados_salud** (6): `sin_complicaciones`, `deshidratacion`, `desnutricion`,
  `laminitis`, `colicos`, `influenza`. Campo `fuente`: `documentado` | `inferido`.
- **dietas**: una fila por combinación categoría × estado (**30 combinaciones**).
- **dieta_items**: ítems de listas (forrajes, concentrados, suplementos, reglas,
  advertencias), agrupados por `tipo`.
- **perfiles_nrc**: requerimientos NRC detallados por grupo de peso maduro y subtipo.

---

## Cobertura de combinaciones

El archivo maestro contiene **las 30 combinaciones completas** (5 categorías × 6
estados de salud). **No se detectaron combinaciones faltantes.** El script
`seed.js` verifica esto en cada ejecución y reportaría cualquier combinación
ausente.

### Estados documentados vs. inferidos

Según la nota metodológica del archivo maestro:

- **Documentados** (basados directamente en las fuentes NRC / guía de
  enfermedades): `sin_complicaciones`, `laminitis`, `colicos`.
- **Inferidos** (construidos por analogía a partir de principios generales del
  NRC, porque las fuentes no traen una sección dedicada): `deshidratacion`,
  `desnutricion`, `influenza`.

Los estados **inferidos** se marcan visualmente con una etiqueta en la interfaz
y en el PDF. **Son guías de apoyo nutricional y no sustituyen la valoración de un
médico veterinario zootecnista.**

---

## Decisiones de diseño (no especificadas explícitamente)

1. **Servido del frontend y *fallback* SPA:** Express sirve `frontend/` con
   `express.static` y cualquier ruta que no empiece por `/api` devuelve
   `index.html`. Así el frontend nunca se abre como archivo local.
2. **`estados_salud.criterio_nutricional`:** el JSON define el criterio por
   combinación (categoría + estado), pero el texto es idéntico entre categorías
   para un mismo estado. Se almacena la primera ocurrencia en la tabla
   `estados_salud`; el criterio específico por dieta también queda accesible vía
   la combinación correspondiente.
3. **Idempotencia del seed:** se usa `ON CONFLICT ... DO UPDATE` para
   categorías, estados, dietas y perfiles, y un `DELETE` + reinserción de los
   `dieta_items` de cada dieta, de modo que re-ejecutar el seed deja la BD
   consistente sin duplicados.
4. **Recálculo de ración:** los porcentajes de materia seca por estado se
   extrajeron de los criterios textuales del archivo maestro y se centralizaron
   en una constante para mantener trazabilidad con la fuente.
5. **Re-render sin nueva consulta:** al cambiar nombre o código del caballo, la
   ficha se vuelve a pintar con los datos locales sin re-consultar la API
   (esos campos no afectan a la dieta). El peso sí dispara nueva consulta porque
   recalcula la ración.
6. **`NUMERIC` de PostgreSQL llega como *string*** por el driver `pg`; el
   servicio de dietas convierte esos valores a número antes de responder.
7. **Tipografías y paleta:** Fraunces (títulos), Source Sans 3 (texto) y
   JetBrains Mono (cifras), con paleta tierra/pradera, para una presentación
   universitaria limpia.

---

## Aviso

Las dietas generadas son **orientativas** y se basan en estimaciones de ración
por porcentaje de peso corporal. Deben ajustarse con el peso real y la condición
corporal del caballo, e idealmente validarse con un médico veterinario
zootecnista.
