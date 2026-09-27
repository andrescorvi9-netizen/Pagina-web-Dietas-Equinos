// main.js — Orquesta la aplicación: popula selects, escucha cambios,
// consulta la dieta, la renderiza y gestiona el botón de PDF.

document.addEventListener('DOMContentLoaded', () => {
  const selCategoria = document.getElementById('select-categoria');
  const selEstado = document.getElementById('select-estado');
  const inpPeso = document.getElementById('input-peso');
  const inpNombre = document.getElementById('nombre-caballo');
  const inpCodigo = document.getElementById('codigo-caballo');
  const mensaje = document.getElementById('mensaje-estado');
  const acciones = document.getElementById('acciones');
  const btnPdf = document.getElementById('btn-pdf');

  // Guarda la última dieta cargada (para el PDF).
  let dietaActual = null;

  function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto || '';
    mensaje.className = 'mensaje' + (tipo ? ` mensaje--${tipo}` : '');
  }

  function ocultarBotonPDF() {
    acciones.hidden = true;
    dietaActual = null;
  }

  // Lee los datos del caballo del formulario.
  function leerDatosCaballo() {
    const pesoVal = inpPeso.value ? Number(inpPeso.value) : null;
    return {
      nombre: inpNombre.value.trim(),
      codigo: inpCodigo.value.trim(),
      peso: pesoVal && pesoVal > 0 ? pesoVal : null,
    };
  }

  // ---- Poblar selects al cargar ----
  async function inicializar() {
    try {
      const [categorias, estados] = await Promise.all([
        window.API.obtenerCategorias(),
        window.API.obtenerEstados(),
      ]);

      for (const c of categorias) {
        const opt = document.createElement('option');
        opt.value = c.clave;
        opt.textContent = c.nombre;
        selCategoria.appendChild(opt);
      }
      for (const e of estados) {
        const opt = document.createElement('option');
        opt.value = e.clave;
        opt.textContent = e.nombre;
        selEstado.appendChild(opt);
      }
      mostrarMensaje('Selecciona categoría y estado de salud para ver la dieta.', 'info');
    } catch (err) {
      mostrarMensaje('Error al cargar los catálogos: ' + err.message, 'error');
    }
  }

  // ---- Consultar y renderizar la dieta ----
  async function actualizarDieta() {
    const categoria = selCategoria.value;
    const estado = selEstado.value;

    // Si falta categoría o estado, limpiamos el resultado.
    if (!categoria || !estado) {
      window.RENDER.limpiarResultado();
      ocultarBotonPDF();
      mostrarMensaje('Selecciona categoría y estado de salud para ver la dieta.', 'info');
      return;
    }

    const datos = leerDatosCaballo();
    mostrarMensaje('Cargando dieta…', 'info');

    try {
      const dieta = await window.API.obtenerDieta(categoria, estado, datos.peso);
      dietaActual = dieta;
      window.RENDER.renderDieta(dieta, datos);
      acciones.hidden = false;
      mostrarMensaje('', null);
    } catch (err) {
      window.RENDER.limpiarResultado();
      ocultarBotonPDF();
      mostrarMensaje('No se pudo obtener la dieta: ' + err.message, 'error');
    }
  }

  // ---- Eventos ----
  selCategoria.addEventListener('change', actualizarDieta);
  selEstado.addEventListener('change', actualizarDieta);

  // El peso solo afecta si ya hay categoría y estado elegidos.
  inpPeso.addEventListener('change', () => {
    if (selCategoria.value && selEstado.value) actualizarDieta();
  });

  // Si cambian nombre o código y ya hay dieta cargada, re-renderizar
  // para reflejar los nuevos datos del caballo (sin volver a consultar).
  function refrescarDatosCaballo() {
    if (dietaActual) {
      window.RENDER.renderDieta(dietaActual, leerDatosCaballo());
    }
  }
  inpNombre.addEventListener('input', refrescarDatosCaballo);
  inpCodigo.addEventListener('input', refrescarDatosCaballo);

  // Botón de PDF.
  btnPdf.addEventListener('click', () => {
    if (!dietaActual) return;
    try {
      window.PDF.generarPDF(dietaActual, leerDatosCaballo());
    } catch (err) {
      mostrarMensaje('Error al generar el PDF: ' + err.message, 'error');
    }
  });

  inicializar();
});
