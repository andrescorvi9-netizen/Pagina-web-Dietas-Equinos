// pdf.js — Genera el PDF de la dieta 100% en el navegador con jsPDF.
// NO se llama al backend: el PDF se arma con los datos ya mostrados.

/**
 * Genera y descarga el PDF de la dieta.
 * @param {object} dieta - respuesta del backend (la dieta actual).
 * @param {object} datosCaballo - { nombre, codigo, peso }.
 */
function generarPDF(dieta, datosCaballo) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // --- Constantes de maquetación ---
  const margenIzq = 15;
  const margenDer = 15;
  const anchoUtil = doc.internal.pageSize.getWidth() - margenIzq - margenDer;
  const altoPagina = doc.internal.pageSize.getHeight();
  const margenInf = 18;

  // Paleta (RGB) coherente con la interfaz.
  const verde = [56, 82, 43];
  const tierra = [122, 82, 48];
  const gris = [107, 99, 87];

  let y = 18;

  // Salta de página si no cabe el alto indicado.
  function asegurarEspacio(alto) {
    if (y + alto > altoPagina - margenInf) {
      doc.addPage();
      y = 18;
    }
  }

  // Escribe un párrafo con ajuste de línea.
  function parrafo(texto, opts = {}) {
    const tam = opts.size || 10;
    const color = opts.color || [47, 42, 34];
    const estilo = opts.style || 'normal';
    const sangria = opts.sangria || 0;
    doc.setFont('helvetica', estilo);
    doc.setFontSize(tam);
    doc.setTextColor(color[0], color[1], color[2]);
    const lineas = doc.splitTextToSize(texto, anchoUtil - sangria);
    const altoLinea = tam * 0.42 + 1.2;
    for (const linea of lineas) {
      asegurarEspacio(altoLinea);
      doc.text(linea, margenIzq + sangria, y);
      y += altoLinea;
    }
  }

  // Título de sección con barra de color.
  function tituloSeccion(texto) {
    asegurarEspacio(12);
    y += 2;
    doc.setFillColor(tierra[0], tierra[1], tierra[2]);
    doc.rect(margenIzq, y - 3.6, 2.2, 4.6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(verde[0], verde[1], verde[2]);
    doc.text(texto, margenIzq + 4, y);
    y += 5;
  }

  // Lista con viñetas.
  function listaPDF(items, vacioTexto) {
    if (!items || items.length === 0) {
      parrafo('• ' + vacioTexto, { size: 9.5, color: gris, style: 'italic', sangria: 2 });
      return;
    }
    for (const it of items) {
      parrafo('• ' + it, { size: 9.5, sangria: 2 });
    }
  }

  // ---------------- Encabezado ----------------
  doc.setFillColor(verde[0], verde[1], verde[2]);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 26, 'F');
  doc.setTextColor(246, 241, 231);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Dietas para Equinos', margenIzq, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Universidad de Cundinamarca · Basado en NRC (6.ª ed.)', margenIzq, 19);
  const fecha = new Date().toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  doc.text('Fecha: ' + fecha, doc.internal.pageSize.getWidth() - margenDer, 19, { align: 'right' });
  y = 34;

  // ---------------- Datos del caballo ----------------
  tituloSeccion('Datos del caballo');
  parrafo('Nombre: ' + (datosCaballo.nombre || 'No especificado'), { size: 10 });
  parrafo('Código de identificación: ' + (datosCaballo.codigo || 'No especificado'), { size: 10 });
  parrafo('Categoría: ' + dieta.categoria.nombre, { size: 10 });
  parrafo('Estado de salud: ' + dieta.estado_salud.nombre +
    ' (fuente: ' + dieta.estado_salud.fuente + ')', { size: 10 });
  const pesoTexto = datosCaballo.peso
    ? datosCaballo.peso + ' kg (peso indicado por el usuario)'
    : (dieta.requerimiento_nrc_referencia.peso_actual_kg_ejemplo
        ? dieta.requerimiento_nrc_referencia.peso_actual_kg_ejemplo + ' kg (peso de referencia NRC)'
        : 'No especificado');
  parrafo('Peso: ' + pesoTexto, { size: 10 });

  // ---------------- Criterio nutricional ----------------
  tituloSeccion('Criterio nutricional');
  parrafo(dieta.criterio_nutricional, { size: 9.5 });

  // ---------------- Ración estimada ----------------
  const plan = dieta.plan_racion_estimado || {};
  tituloSeccion('Ración estimada (materia seca/día)');
  parrafo('Materia seca total: ' + fmtN(plan.materia_seca_total_kg_dia) + ' kg MS/día', { size: 10 });
  parrafo('Forraje: ' + fmtN(plan.forraje_kg_ms_dia) + ' kg MS/día', { size: 10 });
  parrafo('Concentrado: ' + fmtN(plan.concentrado_kg_ms_dia) + ' kg MS/día', { size: 10 });
  parrafo('Criterio: ' + (plan.criterio || ''), { size: 9, color: gris, style: 'italic' });

  // ---------------- Requerimientos NRC ----------------
  const req = dieta.requerimiento_nrc_referencia || {};
  tituloSeccion('Requerimientos NRC de referencia');
  parrafo('Energía digestible (ED): ' + fmtN(req.ED_Mcal_dia) + ' Mcal/día', { size: 10 });
  parrafo('Proteína cruda (PC): ' + fmtN(req.PC_g_dia) + ' g/día', { size: 10 });
  parrafo('Calcio (Ca): ' + fmtN(req.Ca_g_dia) + ' g/día', { size: 10 });
  parrafo('Fósforo (P): ' + fmtN(req.P_g_dia) + ' g/día', { size: 10 });

  // ---------------- Forraje ----------------
  tituloSeccion('Forraje a priorizar');
  listaPDF(dieta.forraje_base, 'Sin forrajes destacados.');
  tituloSeccion('Forraje a evitar');
  listaPDF(dieta.forraje_evitar, 'Sin restricciones específicas.');

  // ---------------- Concentrado ----------------
  tituloSeccion('Concentrado recomendado');
  listaPDF(dieta.concentrado_recomendado, 'Sin concentrado recomendado.');
  tituloSeccion('Concentrado a evitar');
  listaPDF(dieta.concentrado_evitar, 'Sin restricciones específicas.');

  // ---------------- Suplementos ----------------
  tituloSeccion('Suplementos');
  listaPDF(dieta.suplementos, 'Sin suplementos específicos.');

  // ---------------- Reglas ----------------
  tituloSeccion('Reglas de alimentación');
  listaPDF(dieta.reglas_alimentacion, 'Sin reglas específicas.');

  // ---------------- Manejo del agua ----------------
  tituloSeccion('Manejo del agua');
  parrafo(dieta.manejo_agua, { size: 9.5 });

  // ---------------- Advertencias ----------------
  if (dieta.advertencias && dieta.advertencias.length) {
    tituloSeccion('Advertencias');
    listaPDF(dieta.advertencias, '');
  }

  // ---------------- Pie en todas las páginas ----------------
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(gris[0], gris[1], gris[2]);
    doc.text(
      'Documento orientativo. No sustituye la valoración de un médico veterinario zootecnista.',
      margenIzq, altoPagina - 10
    );
    doc.text('Página ' + p + ' de ' + totalPaginas,
      doc.internal.pageSize.getWidth() - margenDer, altoPagina - 10, { align: 'right' });
  }

  // ---------------- Nombre del archivo y descarga ----------------
  const idArchivo = (datosCaballo.codigo || datosCaballo.nombre || 'caballo')
    .toString().replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`dieta_${idArchivo}_${dieta.estado_salud.clave}.pdf`);
}

// Formatea número o '—'.
function fmtN(v) {
  return v === null || v === undefined ? '—' : v;
}

window.PDF = { generarPDF };
