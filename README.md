# Dietas para Equinos

Aplicación web para generar recomendaciones de dietas para caballos basadas en
el **NRC (*Nutrient Requirements of Horses*, 6.ª ed.)**.

**Universidad de Cundinamarca · Ingeniería de Sistemas**
Metodología **XP** · Arquitectura **monolítica modular**
Stack: **Node.js + Express** (backend) · **PostgreSQL** (persistencia) · **HTML/CSS/JS vanilla** (frontend)

🌐 **En producción:** https://pagina-web-dietas-equinos.vercel.app (Vercel + base de datos en Neon)

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
- Una base de datos **PostgreSQL**, en cualquiera de estas dos opciones:
  - **Local:** PostgreSQL instalado y corriendo (con `psql`/`createdb` en el
    PATH, o pgAdmin).
  - **En la nube:** un proyecto de [Neon](https://neon.tech) (es la base que
    usa el despliegue en Vercel).

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

> Si usas **Neon**, omite este paso: la base `neondb` ya existe.

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

**Opción A — PostgreSQL local** (ajusta `PGUSER` / `PGPASSWORD`):

```
PGHOST=localhost
PGPORT=5432
PGDATABASE=dietas_equinos
PGUSER=postgres
PGPASSWORD=tu_contraseña
PORT=3000
```

**Opción B — Neon:** copia los valores desde el panel de Neon (botón
*Connect*) o desde Vercel → *Storage*:

```
PGHOST=ep-xxxx-pooler.region.aws.neon.tech
PGDATABASE=neondb
PGUSER=neondb_owner
PGPASSWORD=tu_contraseña
PORT=3000
```

Con un host que no sea `localhost`/`127.0.0.1`, la conexión usa **SSL
automáticamente** (lo exige Neon) y **valida el certificado TLS del servidor**
(`rejectUnauthorized: true`), lo que protege contra ataques de intermediario.
No hace falta ninguna variable extra.

> ⚠️ `backend/.env` contiene credenciales reales y **nunca** debe subirse a
> git (ya está en `.gitignore`). `.env.example` solo lleva valores de ejemplo.

### 4. Cargar los datos (seed)

```bash
node src/db/seed.js
```

Este script crea las tablas (si no existen), carga el archivo maestro y muestra
un resumen (5 categorías, 6 estados, 30 dietas, 430 ítems, 44 perfiles NRC).
Es **idempotente**: puedes volver a ejecutarlo sin duplicar datos.

Si solo quieres crear las tablas, sin cargar datos y sin necesitar `psql`:

```bash
node src/db/run-schema.js
```

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
| GET | `/api/health` | Healthcheck: comprueba la conexión a PostgreSQL (200 `conectada` / 503 `sin conexión`) |

### Recálculo por peso

Si se incluye `?peso=NNN`, el `plan_racion_estimado` se **recalcula** usando los
porcentajes de materia seca por estado de salud (ver `FACTORES_RACION` en
`src/modules/dietas/dietas.service.js`). Sin `peso`, se devuelve el plan estimado
del archivo maestro.

---

## Estructura del proyecto

```
dietas-equinos/
├── api/
│   └── index.js              ← función serverless de Vercel (reutiliza la app Express)
├── backend/
│   ├── src/
│   │   ├── config/db.js
│   │   ├── db/{schema.sql, seed.js, run-schema.js}
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
├── .gitignore
├── vercel.json               ← configuración del despliegue en Vercel
├── CLAUDE.md
└── README.md
```

---

## Despliegue en Vercel

La aplicación está desplegada en **https://pagina-web-dietas-equinos.vercel.app**.
Cada `git push` a la rama `main` genera un nuevo despliegue automáticamente.

### Cómo está configurado

- **`api/index.js`** exporta la misma app Express de `backend/src/app.js`, y
  Vercel la ejecuta como función serverless. En local y en producción corre el
  mismo código.
- **`vercel.json`** indica a Vercel que:
  - instale las dependencias de `backend/` (`npm install --prefix backend`);
  - publique `frontend/` como sitio estático (`outputDirectory`);
  - redirija todas las rutas `/api/*` a la función (`rewrites`).
- **Base de datos:** la integración de Neon en Vercel crea las variables
  `PGHOST`, `PGUSER`, `PGDATABASE` y `PGPASSWORD`, que `db.js` lee tal cual. En
  producción no se usa archivo `.env`.

### Ajustes en el panel de Vercel

- **Framework Preset:** *Other*.
- **Root Directory:** la raíz del repositorio (`./`). **No** lo cambies a
  `backend/`, porque entonces Vercel no encuentra `vercel.json`, `api/` ni
  `frontend/`.
- **Build & Output Settings:** no hace falta tocarlos, porque `vercel.json` los
  sobrescribe.

### Actualizar los datos de producción

Con `backend/.env` apuntando a Neon, ejecuta desde `backend/`:

```bash
node src/db/seed.js
```

### Verificar un despliegue

```
https://pagina-web-dietas-equinos.vercel.app/api/health
→ {"estado":"ok", ..., "base_datos":"conectada"}
```

### Solución de problemas

- **`getaddrinfo ENOTFOUND ep-...neon.tech`** al correr el seed o el servidor
  en local: es un fallo intermitente del DNS del sistema operativo, no del
  proyecto. `db.js` ya lo maneja: si el DNS del sistema falla, resuelve el host
  con DNS públicos (`1.1.1.1` / `8.8.8.8`) y muestra un aviso en consola. Si
  aun así ves el error, revisa tu conexión a internet o cambia el DNS del
  adaptador de red a `1.1.1.1` o `8.8.8.8`.
- **`/api/health` devuelve 503:** revisa las variables `PG*` en
  *Settings → Environment Variables* de Vercel (o en tu `.env` local).

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

1. **Servido del frontend y *fallback* SPA:** en local, Express sirve
   `frontend/` con `express.static` y cualquier ruta que no empiece por `/api`
   devuelve `index.html`. Así el frontend nunca se abre como archivo local. En
   producción, los estáticos los sirve directamente la CDN de Vercel.
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
