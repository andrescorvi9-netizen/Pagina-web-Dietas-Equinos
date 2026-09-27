// render.js — Pinta la dieta recibida del backend dentro de #resultado.

// Escapa texto para evitar inyección de HTML al insertar contenido dinámico.
function esc(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Genera una lista <ul>; si está vacía muestra un texto placeholder.
function listaHTML(items, vacioTexto) {
  if (!items || items.length === 0) {
    return `<ul class="lista lista--vacia"><li>${esc(vacioTexto)}</li></ul>`;
  }
  const lis = items.map((i) => `<li>${esc(i)}</li>`).join('');
  return `<ul class="lista">${lis}</ul>`;
}

// Formatea un número con unidad, o '—' si no hay valor.
function fmt(valor, unidad) {
  if (valor === null || valor === undefined) return '—';
  return `${valor}${unidad ? ' ' + unidad : ''}`;
}

/**
 * Renderiza la ficha de la dieta.
 * @param {object} dieta - respuesta del backend.
 * @param {object} datosCaballo - { nombre, codigo, peso }.
 */
function renderDieta(dieta, datosCaballo) {
  const contenedor = document.getElementById('resultado');

  const fuente = dieta.estado_salud.fuente;
  const tagClase = fuente === 'documentado' ? 'tag--documentado' : 'tag--inferido';

  const req = dieta.requerimiento_nrc_referencia || {};
  const plan = dieta.plan_racion_estimado || {};

  // Datos del caballo (solo los que el usuario haya ingresado).
  const partesCaballo = [];
  if (datosCaballo.nombre) partesCaballo.push(`<span><strong>Nombre:</strong> ${esc(datosCaballo.nombre)}</span>`);
  if (datosCaballo.codigo) partesCaballo.push(`<span><strong>Código:</strong> ${esc(datosCaballo.codigo)}</span>`);
  if (datosCaballo.peso) partesCaballo.push(`<span><strong>Peso:</strong> ${esc(datosCaballo.peso)} kg</span>`);
  const datosCaballoHTML = partesCaballo.length
    ? `<div class="datos-caballo">${partesCaballo.join('')}</div>`
    : '';

  contenedor.innerHTML = `
    <article class="tarjeta ficha">
      <div class="ficha__encabezado">
        <div>
          <h2 class="ficha__titulo">${esc(dieta.categoria.nombre)}</h2>
          <p class="ficha__sub">Estado de salud: <strong>${esc(dieta.estado_salud.nombre)}</strong></p>
        </div>
        <span class="tag ${tagClase}">${esc(fuente)}</span>
      </div>

      ${datosCaballoHTML}

      <div class="bloque">
        <h3 class="bloque__titulo">Criterio nutricional</h3>
        <p class="criterio">${esc(dieta.criterio_nutricional)}</p>
      </div>

      <div class="bloque">
        <h3 class="bloque__titulo">Ración estimada (materia seca/día)</h3>
        <div class="racion">
          <div class="racion__item">
            <span class="racion__valor">${fmt(plan.materia_seca_total_kg_dia)}</span>
            <span class="racion__etq">kg MS total/día</span>
          </div>
          <div class="racion__item">
            <span class="racion__valor">${fmt(plan.forraje_kg_ms_dia)}</span>
            <span class="racion__etq">kg MS forraje/día</span>
          </div>
          <div class="racion__item">
            <span class="racion__valor">${fmt(plan.concentrado_kg_ms_dia)}</span>
            <span class="racion__etq">kg MS concentrado/día</span>
          </div>
        </div>
        <p class="racion__criterio">${esc(plan.criterio)}</p>
      </div>

      <div class="bloque">
        <h3 class="bloque__titulo">Requerimientos NRC de referencia</h3>
        <div class="nrc">
          <div class="nrc__item"><span class="nrc__valor">${fmt(req.peso_actual_kg_ejemplo)}</span><span class="nrc__etq">Peso ejemplo (kg)</span></div>
          <div class="nrc__item"><span class="nrc__valor">${fmt(req.ED_Mcal_dia)}</span><span class="nrc__etq">ED (Mcal/día)</span></div>
          <div class="nrc__item"><span class="nrc__valor">${fmt(req.PC_g_dia)}</span><span class="nrc__etq">PC (g/día)</span></div>
          <div class="nrc__item"><span class="nrc__valor">${fmt(req.Ca_g_dia)}</span><span class="nrc__etq">Ca (g/día)</span></div>
          <div class="nrc__item"><span class="nrc__valor">${fmt(req.P_g_dia)}</span><span class="nrc__etq">P (g/día)</span></div>
        </div>
      </div>

      <div class="bloque">
        <h3 class="bloque__titulo">Forraje</h3>
        <div class="columnas">
          <div class="columna columna--priorizar">
            <p class="columna__titulo">Priorizar</p>
            ${listaHTML(dieta.forraje_base, 'Sin forrajes destacados.')}
          </div>
          <div class="columna columna--evitar">
            <p class="columna__titulo">Evitar</p>
            ${listaHTML(dieta.forraje_evitar, 'Sin restricciones específicas.')}
          </div>
        </div>
      </div>

      <div class="bloque">
        <h3 class="bloque__titulo">Concentrado</h3>
        <div class="columnas">
          <div class="columna columna--priorizar">
            <p class="columna__titulo">Recomendado</p>
            ${listaHTML(dieta.concentrado_recomendado, 'Sin concentrado recomendado.')}
          </div>
          <div class="columna columna--evitar">
            <p class="columna__titulo">Evitar</p>
            ${listaHTML(dieta.concentrado_evitar, 'Sin restricciones específicas.')}
          </div>
        </div>
      </div>

      <div class="bloque">
        <h3 class="bloque__titulo">Suplementos</h3>
        ${listaHTML(dieta.suplementos, 'Sin suplementos específicos.')}
      </div>

      <div class="bloque">
        <h3 class="bloque__titulo">Reglas de alimentación</h3>
        ${listaHTML(dieta.reglas_alimentacion, 'Sin reglas específicas.')}
      </div>

      <div class="bloque">
        <h3 class="bloque__titulo">Manejo del agua</h3>
        <p class="agua">${esc(dieta.manejo_agua)}</p>
      </div>

      ${dieta.advertencias && dieta.advertencias.length ? `
      <div class="bloque advertencias">
        <h3 class="bloque__titulo">Advertencias</h3>
        ${listaHTML(dieta.advertencias, '')}
      </div>` : ''}
    </article>
  `;
}

// Limpia el resultado.
function limpiarResultado() {
  document.getElementById('resultado').innerHTML = '';
}

window.RENDER = { renderDieta, limpiarResultado };
