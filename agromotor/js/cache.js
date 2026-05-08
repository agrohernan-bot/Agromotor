// ════════════════════════════════════════════════════════
// AGROMOTOR — cache.js
// Persistencia localStorage 24hs · Datos del lote
// Restauración automática sin señal
// ════════════════════════════════════════════════════════

const CACHE_KEY = 'agromotor_lote_v1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

function cacheGuardar() {
  try {
    const datos = {
      ts: Date.now(),
      coord:   $('s-coord')?.value,
      cultivo: $('s-cultivo')?.value,
      fecha:   $('s-fecha')?.value,
      suelo:   $('s-suelo')?.value,
      // Valores calculados Open-Meteo
      t6:     $('sv-t6')?.textContent,
      t18:    $('sv-t18')?.textContent,
      h1:     $('sv-h1')?.textContent,
      h2:     $('sv-h2')?.textContent,
      h3:     $('sv-h3')?.textContent,
      et0:    $('sv-et0')?.textContent,
      vpd:    $('sv-vpd')?.textContent,
      viento: $('sv-viento')?.textContent,
      gdd:    $('i-gdd')?.textContent,
      // Economía
      precioDisp: $('ec-precio-disp')?.value,
      precioFut:  $('ec-precio-fut')?.value,
      rendEc:     $('ec-rend')?.value,
      supEc:      $('ec-sup')?.value,
      // SoilGrids
      sgDatos: window._sgDatos || null,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(datos));
  } catch(e) { console.warn('Cache write error:', e.message); }
}

function cacheCargar() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const datos = JSON.parse(raw);
    if (Date.now() - datos.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return false;
    }

    // Restaurar campos
    if (datos.coord   && $('s-coord'))   $('s-coord').value   = datos.coord;
    if (datos.cultivo && $('s-cultivo')) $('s-cultivo').value = datos.cultivo;
    if (datos.fecha   && $('s-fecha'))   $('s-fecha').value   = datos.fecha;
    if (datos.suelo   && $('s-suelo'))   $('s-suelo').value   = datos.suelo;
    if (datos.precioDisp && $('ec-precio-disp')) $('ec-precio-disp').value = datos.precioDisp;
    if (datos.precioFut  && $('ec-precio-fut'))  $('ec-precio-fut').value  = datos.precioFut;
    if (datos.rendEc     && $('ec-rend'))        $('ec-rend').value         = datos.rendEc;
    if (datos.supEc      && $('ec-sup'))         $('ec-sup').value          = datos.supEc;

    // Restaurar datos de SoilGrids si los hay
    if (datos.sgDatos) {
      window._sgDatos = datos.sgDatos;
    }

    // Restaurar valores en los badges de Open-Meteo
    const campos = ['t6','t18','h1','h2','h3','et0','vpd','viento','gdd'];
    const ids    = ['sv-t6','sv-t18','sv-h1','sv-h2','sv-h3','sv-et0','sv-vpd','sv-viento','i-gdd'];
    campos.forEach((c,i) => {
      if (datos[c] && datos[c] !== '—') {
        const el = $(ids[i]);
        if (el) el.textContent = datos[c];
      }
    });

    const edad = Math.round((Date.now() - datos.ts) / 60000);
    amToast(`📂 Datos del lote restaurados (hace ${edad} min)`, 'ok');
    return true;

  } catch(e) {
    console.warn('Cache read error:', e.message);
    return false;
  }
}

// Guardar cache automáticamente después de cada carga de datos
const _buscarAPIOriginal = buscarAPI;
window.buscarAPI = async function() {
  await _buscarAPIOriginal();
  setTimeout(cacheGuardar, 2000); // guardar 2s después de que todo esté renderizado
};

// ════════════════════════════════════════════════════════