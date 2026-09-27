// =====================================================================
// Script de carga (seed) de la base de datos "Dietas para Equinos".
//
// Pasos que ejecuta:
//   1. Lee backend/data/dietas_equinos_maestro.json
//   2. Ejecuta schema.sql (crea tablas si no existen)
//   3. Inserta categorías, estados de salud, dietas y dieta_items
//      de forma idempotente (ON CONFLICT)
//   4. Inserta los perfiles NRC
//   5. Imprime un resumen y advierte sobre estados 'inferido'
//   6. Reporta combinaciones faltantes (categoría sin los 6 estados)
//
// Uso:  node src/db/seed.js   (desde la carpeta backend/)
// =====================================================================

const fs = require('fs');
const path = require('path');
const { pool, query } = require('../config/db');

// Los 6 estados de salud esperados para cada categoría.
const ESTADOS_ESPERADOS = [
  'sin_complicaciones',
  'deshidratacion',
  'desnutricion',
  'laminitis',
  'colicos',
  'influenza',
];

// Tipos de lista que se convierten en filas de dieta_items.
const TIPOS_ITEMS = [
  'forraje_base',
  'forraje_evitar',
  'concentrado_recomendado',
  'concentrado_evitar',
  'suplementos',
  'reglas_alimentacion',
  'advertencias',
];

// Convierte undefined/null a null explícito para los parámetros SQL.
function val(v) {
  return v === undefined ? null : v;
}

async function main() {
  console.log('=== Seed: Dietas para Equinos ===\n');

  // ---- 1. Leer el archivo maestro ----
  const rutaMaestro = path.join(__dirname, '..', '..', 'data', 'dietas_equinos_maestro.json');
  if (!fs.existsSync(rutaMaestro)) {
    console.error(`No se encontró el archivo maestro en: ${rutaMaestro}`);
    process.exit(1);
  }
  const maestro = JSON.parse(fs.readFileSync(rutaMaestro, 'utf8'));
  const categorias = maestro.categorias || {};
  console.log(`Archivo maestro leído. Categorías encontradas: ${Object.keys(categorias).length}\n`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ---- 2. Ejecutar schema.sql ----
    const rutaSchema = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(rutaSchema, 'utf8');
    await client.query(schemaSql);
    console.log('Esquema verificado/creado (schema.sql ejecutado).\n');

    // Contadores para el resumen final.
    const resumen = {
      categorias: 0,
      estados: 0,
      dietas: 0,
      items: 0,
      perfiles: 0,
    };
    const estadosInferidos = new Set();
    const combinacionesFaltantes = [];

    // ---- 3a. Insertar estados de salud ----
    // El nombre, fuente y criterio de cada estado son idénticos entre
    // categorías; tomamos la primera ocurrencia de cada estado.
    const estadoIdPorClave = {};
    const estadosVistos = {};
    for (const cat of Object.values(categorias)) {
      const dietasEstado = cat.dietas_por_estado_salud || {};
      for (const [claveEstado, dieta] of Object.entries(dietasEstado)) {
        if (!estadosVistos[claveEstado]) {
          estadosVistos[claveEstado] = {
            nombre: dieta.nombre_estado,
            fuente: dieta.fuente,
            criterio: dieta.criterio_nutricional,
          };
        }
      }
    }
    for (const [clave, info] of Object.entries(estadosVistos)) {
      const res = await client.query(
        `INSERT INTO estados_salud (clave, nombre, fuente, criterio_nutricional)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (clave) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           fuente = EXCLUDED.fuente,
           criterio_nutricional = EXCLUDED.criterio_nutricional
         RETURNING id`,
        [clave, info.nombre, info.fuente, info.criterio]
      );
      estadoIdPorClave[clave] = res.rows[0].id;
      resumen.estados++;
      if (info.fuente === 'inferido') estadosInferidos.add(clave);
    }

    // ---- 3b. Insertar categorías, dietas, dieta_items y perfiles ----
    for (const [claveCat, cat] of Object.entries(categorias)) {
      const resCat = await client.query(
        `INSERT INTO categorias (clave, nombre, descripcion, notas_nrc)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (clave) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           descripcion = EXCLUDED.descripcion,
           notas_nrc = EXCLUDED.notas_nrc
         RETURNING id`,
        [claveCat, cat.nombre, cat.descripcion, cat.notas_nrc]
      );
      const categoriaId = resCat.rows[0].id;
      resumen.categorias++;

      // Verificar combinaciones faltantes para esta categoría.
      const dietasEstado = cat.dietas_por_estado_salud || {};
      const presentes = Object.keys(dietasEstado);
      const faltan = ESTADOS_ESPERADOS.filter((e) => !presentes.includes(e));
      if (faltan.length > 0) {
        combinacionesFaltantes.push({ categoria: claveCat, faltan });
      }

      // Dietas + items.
      for (const [claveEstado, dieta] of Object.entries(dietasEstado)) {
        const estadoId = estadoIdPorClave[claveEstado];
        const req = dieta.requerimiento_nrc_referencia || {};
        const plan = dieta.plan_racion_estimado || {};

        const resDieta = await client.query(
          `INSERT INTO dietas (
             categoria_id, estado_salud_id, peso_actual_kg_ejemplo,
             ed_mcal_dia, pc_g_dia, ca_g_dia, p_g_dia,
             materia_seca_total_kg_dia, forraje_kg_ms_dia, concentrado_kg_ms_dia,
             criterio_racion, manejo_agua
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (categoria_id, estado_salud_id) DO UPDATE SET
             peso_actual_kg_ejemplo = EXCLUDED.peso_actual_kg_ejemplo,
             ed_mcal_dia = EXCLUDED.ed_mcal_dia,
             pc_g_dia = EXCLUDED.pc_g_dia,
             ca_g_dia = EXCLUDED.ca_g_dia,
             p_g_dia = EXCLUDED.p_g_dia,
             materia_seca_total_kg_dia = EXCLUDED.materia_seca_total_kg_dia,
             forraje_kg_ms_dia = EXCLUDED.forraje_kg_ms_dia,
             concentrado_kg_ms_dia = EXCLUDED.concentrado_kg_ms_dia,
             criterio_racion = EXCLUDED.criterio_racion,
             manejo_agua = EXCLUDED.manejo_agua
           RETURNING id`,
          [
            categoriaId,
            estadoId,
            val(req.peso_actual_kg_ejemplo),
            val(req.ED_Mcal_dia),
            val(req.PC_g_dia),
            val(req.Ca_g_dia),
            val(req.P_g_dia),
            val(plan.materia_seca_total_kg_dia),
            val(plan.forraje_kg_ms_dia),
            val(plan.concentrado_kg_ms_dia),
            val(plan.criterio),
            val(dieta.manejo_agua),
          ]
        );
        const dietaId = resDieta.rows[0].id;
        resumen.dietas++;

        // Reescribir los items de esta dieta para mantener idempotencia.
        await client.query('DELETE FROM dieta_items WHERE dieta_id = $1', [dietaId]);
        for (const tipo of TIPOS_ITEMS) {
          const lista = dieta[tipo] || [];
          for (let i = 0; i < lista.length; i++) {
            await client.query(
              `INSERT INTO dieta_items (dieta_id, tipo, contenido, orden)
               VALUES ($1, $2, $3, $4)`,
              [dietaId, tipo, lista[i], i]
            );
            resumen.items++;
          }
        }
      }

      // Perfiles NRC de la categoría.
      const perfiles = cat.perfiles_nrc_disponibles || {};
      for (const [grupoPeso, subtipos] of Object.entries(perfiles)) {
        for (const [subtipo, p] of Object.entries(subtipos)) {
          await client.query(
            `INSERT INTO perfiles_nrc (
               categoria_id, peso_maduro_grupo, subtipo, peso_actual_kg,
               ed_mcal_dia, pc_g_dia, lisina_g_dia, ca_g_dia, p_g_dia,
               mg_g_dia, k_g_dia, na_g_dia, zn_mg_dia, cu_mg_dia, se_mg_dia,
               vita_kui_dia, vite_ui_dia
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
             ON CONFLICT (categoria_id, peso_maduro_grupo, subtipo) DO UPDATE SET
               peso_actual_kg = EXCLUDED.peso_actual_kg,
               ed_mcal_dia = EXCLUDED.ed_mcal_dia,
               pc_g_dia = EXCLUDED.pc_g_dia,
               lisina_g_dia = EXCLUDED.lisina_g_dia,
               ca_g_dia = EXCLUDED.ca_g_dia,
               p_g_dia = EXCLUDED.p_g_dia,
               mg_g_dia = EXCLUDED.mg_g_dia,
               k_g_dia = EXCLUDED.k_g_dia,
               na_g_dia = EXCLUDED.na_g_dia,
               zn_mg_dia = EXCLUDED.zn_mg_dia,
               cu_mg_dia = EXCLUDED.cu_mg_dia,
               se_mg_dia = EXCLUDED.se_mg_dia,
               vita_kui_dia = EXCLUDED.vita_kui_dia,
               vite_ui_dia = EXCLUDED.vite_ui_dia`,
            [
              categoriaId, grupoPeso, subtipo, val(p.peso_actual_kg),
              val(p.ED_Mcal_dia), val(p.PC_g_dia), val(p.Lisina_g_dia),
              val(p.Ca_g_dia), val(p.P_g_dia), val(p.Mg_g_dia), val(p.K_g_dia),
              val(p.Na_g_dia), val(p.Zn_mg_dia), val(p.Cu_mg_dia), val(p.Se_mg_dia),
              val(p.VitA_kUI_dia), val(p.VitE_UI_dia),
            ]
          );
          resumen.perfiles++;
        }
      }
    }

    await client.query('COMMIT');

    // ---- 4. Resumen ----
    console.log('--- Resumen de carga ---');
    console.log(`  Categorías insertadas/actualizadas: ${resumen.categorias}`);
    console.log(`  Estados de salud:                   ${resumen.estados}`);
    console.log(`  Dietas:                             ${resumen.dietas}`);
    console.log(`  Ítems de dieta:                     ${resumen.items}`);
    console.log(`  Perfiles NRC:                       ${resumen.perfiles}\n`);

    // ---- 5. Advertencia sobre estados inferidos ----
    if (estadosInferidos.size > 0) {
      console.log('ADVERTENCIA: los siguientes estados de salud tienen fuente = "inferido".');
      console.log('Son guías de apoyo nutricional, NO sustituyen criterio veterinario:');
      for (const e of estadosInferidos) console.log(`   - ${e}`);
      console.log('');
    }

    // ---- 6. Combinaciones faltantes ----
    if (combinacionesFaltantes.length > 0) {
      console.log('ATENCIÓN: combinaciones categoría/estado faltantes:');
      for (const c of combinacionesFaltantes) {
        console.log(`   - ${c.categoria}: faltan [${c.faltan.join(', ')}]`);
      }
      console.log('');
    } else {
      console.log('Todas las categorías tienen los 6 estados de salud esperados.\n');
    }

    console.log('Seed completado correctamente.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nError durante el seed (se revirtió la transacción):');
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
