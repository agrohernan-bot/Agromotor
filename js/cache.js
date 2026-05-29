// ════════════════════════════════════════════════════════
// AGROMOTOR — cache.js & Global Lot Manager
// Persistencia localStorage · Múltiples Lotes
// ════════════════════════════════════════════════════════

(function() {
  window.AM = window.AM || {};
  window.AM.cache = {};

  const LOTES_LEGACY_KEY = 'am_global_lotes_v2'; // clave pre-fix (compartida por todos)

  function getLotesKey() {
    var uid = (typeof AM_SESION !== 'undefined' && AM_SESION && AM_SESION.id) ? AM_SESION.id : null;
    return uid ? ('am_lotes_v2_' + uid) : LOTES_LEGACY_KEY;
  }
  window.AM_LOTES = [];
  window.AM_LOTE_ACTIVO = 'default';

function amCargarLotesGlobales() {
  var _uid = (typeof AM_SESION !== 'undefined' && AM_SESION && AM_SESION.id) ? AM_SESION.id : null;
  if (_uid) {
    var _newKey = 'am_lotes_v2_' + _uid;
    var _legacyData = localStorage.getItem(LOTES_LEGACY_KEY);
    if (_legacyData) {
      if (!localStorage.getItem(_newKey)) localStorage.setItem(_newKey, _legacyData);
      localStorage.removeItem(LOTES_LEGACY_KEY);
    }
  }
  try {
    const raw = localStorage.getItem(getLotesKey());
    if(raw) {
      const data = JSON.parse(raw);
      AM_LOTES = Array.isArray(data.lotes) ? data.lotes : [];
      AM_LOTE_ACTIVO = data.activo || 'default';
    }
  } catch(e) {
    console.warn("Error loading lotes:", e);
    AM_LOTES = [];
  }
  
  if(!Array.isArray(AM_LOTES) || AM_LOTES.length === 0) {
    AM_LOTES = [{ id: 'default', nombre: 'Lote Principal', data: {} }];
    AM_LOTE_ACTIVO = 'default';
  }
  
  amRenderSelectLotes();
}

function amGetLoteLimit() {
  if (localStorage.getItem('am_god') === 'true') return 999;
  if (typeof AM_CONFIG !== 'undefined' && AM_CONFIG.devMode) return 999;
  // Promoción lanzamiento: hasta el 01 Agosto 2026 → máx 6 lotes (con sesión activa)
  // Sin sesión → 1 lote (mismo que plan free)
  // TODO: restaurar el 1° de agosto de 2026
  if (new Date() < new Date('2026-08-02')) {
    return (typeof AM_SESION !== 'undefined' && AM_SESION) ? 6 : 1;
  }
  if (typeof AM_SESION !== 'undefined' && AM_SESION && typeof AM_PLANES !== 'undefined') {
    return AM_PLANES[AM_SESION.plan]?.lotes ?? 1;
  }
  return 1;
}

function amRenderSelectLotes() {
  const sel = document.getElementById('am-global-lotes');
  const selDash = document.getElementById('am-dash-lotes');
  const listCont = document.getElementById('am-lista-lotes');
  const counter = document.getElementById('dash-lotes-counter');

  if(sel) sel.innerHTML = '';
  if(selDash) selDash.innerHTML = '';
  if(listCont) listCont.innerHTML = '';

  const limite = amGetLoteLimit();
  const total = AM_LOTES.length;
  if (counter) {
    const pct = limite < 999 ? total / limite : 0;
    const color = pct >= 1 ? '#C94A2A' : pct >= 0.8 ? '#C8A255' : '#7AAEF5';
    counter.textContent = limite < 999 ? `${total} / ${limite} lotes` : `${total} lotes`;
    counter.style.color = color;
    counter.style.borderColor = color + '44';
  }

  AM_LOTES.forEach(L => {
    if(sel) {
      const opt = document.createElement('option');
      opt.value = L.id; opt.textContent = L.nombre; opt.style.background = '#1A2A20';
      if(L.id === AM_LOTE_ACTIVO) opt.selected = true;
      sel.appendChild(opt);
    }
    if(selDash) {
      const opt2 = document.createElement('option');
      opt2.value = L.id; opt2.textContent = L.nombre; opt2.style.background = '#1A2A20';
      if(L.id === AM_LOTE_ACTIVO) opt2.selected = true;
      selDash.appendChild(opt2);
    }

    if(listCont) {
      const coord   = L.data?.coord   || null;
      const cultivo = L.data?.cultivo  || null;
      const isActive = L.id === AM_LOTE_ACTIVO;

      const card = document.createElement('div');
      card.style.cssText = `
        border: 2px solid ${isActive ? 'rgba(122,174,245,.6)' : 'rgba(122,174,245,.15)'};
        border-radius: 10px;
        background: ${isActive ? 'rgba(122,174,245,.1)' : '#fff'};
        padding: .75rem .9rem;
        cursor: pointer;
        transition: all .18s;
        display: flex; flex-direction: column; gap: .4rem;
        box-shadow: ${isActive ? '0 2px 8px rgba(122,174,245,.2)' : '0 1px 3px rgba(0,0,0,.06)'};
      `;
      card.onclick = () => amCambiarLoteGlobalDesdeDash(L.id);
      card.onmouseover = () => { if(!isActive) { card.style.borderColor='rgba(122,174,245,.4)'; card.style.boxShadow='0 2px 8px rgba(122,174,245,.15)'; }};
      card.onmouseout  = () => { if(!isActive) { card.style.borderColor='rgba(122,174,245,.15)'; card.style.boxShadow='0 1px 3px rgba(0,0,0,.06)'; }};

      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:.45rem">
          <span style="font-size:1.1rem">${isActive ? '🗺️' : '📍'}</span>
          <div style="font-weight:700;color:#1A3A6C;font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${L.nombre}</div>
          ${isActive ? '<span style="margin-left:auto;font-size:.6rem;font-weight:700;background:#7AAEF5;color:#fff;padding:1px 6px;border-radius:6px">ACTIVO</span>' : ''}
        </div>
        ${cultivo ? `<div style="font-size:.72rem;color:#3A7A4A;font-weight:600">🌾 ${cultivo}</div>` : ''}
        ${coord ? `<div style="font-size:.68rem;color:#6b7280;font-family:'DM Mono',monospace;background:#f3f4f6;padding:.15rem .4rem;border-radius:4px">${coord.length > 28 ? coord.slice(0,28)+'…' : coord}</div>` : '<div style="font-size:.68rem;color:#9ca3af">Sin coordenadas</div>'}
      `;
      listCont.appendChild(card);
    }
  });
}

window.amCambiarLoteGlobalDesdeDash = function(val) {
  const sel = document.getElementById('am-global-lotes');
  if(sel) {
    sel.value = val;
    amCambiarLoteGlobal();
  }
};

function amLimpiarDOM() {
  const camposLimpiar = ['s-coord', 's-cultivo', 's-fecha', 's-suelo', 'ec-precio-disp', 'ec-precio-fut', 'ec-rend', 'ec-sup', 'ec-cultivo', 'ec-rend-fut', 'f-cult', 'f-sup', 'bn-cultivo', 'bn-rend', 'bn-sup', 'bh-cultivo', 'bh-fecha', 'bh-rend-obj'];
  camposLimpiar.forEach(i => {
    const el = document.getElementById(i);
    if(el) el.value = '';
  });
  const spanLimpiar = ['sv-t6','sv-t18','sv-h1','sv-h2','sv-h3','sv-et0','sv-vpd','sv-viento','i-gdd', 'i-ubi', 'i-suelo', 'i-temp', 'i-hum', 'i-et0', 'i-vpd', 'i-viento', 'i-gdd', 'np-rad', 'np-prec', 'np-tmax', 'np-tmin', 'np-et0', 'np-rh', 'np-drd', 'np-bal', 'sg-ph', 'sg-soc', 'sg-n', 'sg-da', 'sg-cec', 'sg-mo', 'sg-textura'];
  spanLimpiar.forEach(i => {
    const el = document.getElementById(i);
    if(el) el.textContent = '—';
  });
  window._sgDatos    = null;
  window._labDatos   = {};
  window._sueloDatos = {};
  const mapaMsg = document.getElementById('api-msg');
  if(mapaMsg) mapaMsg.textContent = '';
  const mapSp = document.getElementById('api-sp');
  if(mapSp) mapSp.style.animation = 'none';
  
  const apiInfo = document.getElementById('api-info');
  const apiPh = document.getElementById('api-info-placeholder');
  const nasaInfo = document.getElementById('nasa-info');
  if(apiInfo) apiInfo.classList.add('hidden');
  if(nasaInfo) nasaInfo.classList.add('hidden');
  if(apiPh) apiPh.classList.remove('hidden');
}

window.amCrearLoteGlobal = function() {
  const limite = amGetLoteLimit();
  if (AM_LOTES.length >= limite) {
    const msg = limite === 1
      ? 'El plan Free permite 1 lote. Actualizá a Asesor Pro para tener hasta 15 lotes.'
      : `Tu plan permite hasta ${limite} lotes y ya los usaste todos. Considerá actualizar tu plan.`;
    if(typeof amToast === 'function') amToast(msg, 'error');
    else alert(msg);
    return;
  }

  // ── Capturar estado actual del DOM ANTES de cualquier acción ──
  const coordEnPantalla   = document.getElementById('s-coord')?.value?.trim()   || '';
  const cultivoEnPantalla = document.getElementById('s-cultivo')?.value         || '';
  const fechaEnPantalla   = document.getElementById('s-fecha')?.value           || '';
  const sueloEnPantalla   = document.getElementById('s-suelo')?.value           || '';

  // ── Detectar si la coord en pantalla pertenece al lote previo o es una nueva ubicación ──
  const lotePrev   = AM_LOTES.find(l => l.id === AM_LOTE_ACTIVO);
  const coordPrev  = (lotePrev && lotePrev.data && lotePrev.data.coord) ? String(lotePrev.data.coord).trim() : '';
  // Si la coord visible difiere de la guardada del lote previo → el usuario clickeó una nueva ubicación
  // y la quiere asignar al nuevo lote, no al previo
  const coordEsParaNuevoLote = coordEnPantalla && coordEnPantalla !== coordPrev;

  const nombre = prompt('Nombre del nuevo lote (ej. Lote Sur - Soja):');
  if(!nombre) return;
  const id = 'lote_' + Date.now();

  // ── Si la coord nueva era para el lote nuevo, restaurar la del previo antes de guardarlo ──
  if (coordEsParaNuevoLote) {
    const sCoord = document.getElementById('s-coord');
    if (sCoord) sCoord.value = coordPrev; // restaurar coord original del lote previo
  }
  cacheGuardar(); // ahora cacheGuardar persiste el lote previo con SUS coordenadas, no la del clic

  // ── Crear nuevo lote, opcionalmente con las coords clickeadas ──
  const nuevoLote = {
    id, nombre,
    data: coordEsParaNuevoLote ? {
      ts: Date.now(),
      coord:   coordEnPantalla,
      cultivo: cultivoEnPantalla,
      fecha:   fechaEnPantalla,
      suelo:   sueloEnPantalla,
    } : {}
  };
  AM_LOTES.push(nuevoLote);
  AM_LOTE_ACTIVO = id;

  amLimpiarDOM();

  amGuardarLotesEstado();
  amRenderSelectLotes();

  if(typeof cacheCargar === 'function') cacheCargar();
  if(typeof amActualizarUI === 'function') amActualizarUI();
  if(typeof amToast === 'function') {
    amToast(coordEsParaNuevoLote
      ? `Lote "${nombre}" creado en la ubicación seleccionada`
      : `Lote "${nombre}" creado`, 'ok');
  }

  if(typeof amRefrescarMapaDashboard === 'function') amRefrescarMapaDashboard();

  // Si el nuevo lote tiene coords, disparar consulta automática de APIs
  if (coordEsParaNuevoLote && typeof buscarAPI === 'function') {
    setTimeout(buscarAPI, 500);
  }
};

window.amEliminarLoteGlobal = function() {
  if (AM_LOTES.length <= 1) {
    if(typeof amToast === 'function') amToast('Debe haber al menos un lote activo.', 'error');
    else alert('Debe haber al menos un lote activo.');
    return;
  }
  
  const lote = AM_LOTES.find(l => l.id === AM_LOTE_ACTIVO);
  if (!lote) return;
  
  if (!confirm(`¿Estás seguro de que deseás eliminar el lote "${lote.nombre}" y todos sus datos?`)) return;
  
  AM_LOTES = AM_LOTES.filter(l => l.id !== AM_LOTE_ACTIVO);
  AM_LOTE_ACTIVO = AM_LOTES[0].id;
  
  amGuardarLotesEstado();
  amLimpiarDOM();
  cacheCargar();
  amRenderSelectLotes();
  
  if(typeof amToast === 'function') amToast(`Lote "${lote.nombre}" eliminado`, 'ok');
  if(typeof amRefrescarMapaDashboard === 'function') amRefrescarMapaDashboard();
  
  const coordVal = document.getElementById('s-coord')?.value;
  if(coordVal && typeof buscarAPI === 'function') {
    setTimeout(buscarAPI, 300);
  }
};

window.amCambiarLoteGlobal = function() {
  const sel = document.getElementById('am-global-lotes');
  if(!sel) return;
  
  cacheGuardar(); // Guardar actual antes de cambiar
  
  AM_LOTE_ACTIVO = sel.value;
  amGuardarLotesEstado();
  
  amLimpiarDOM(); 
  
  const success = cacheCargar();
  if(success && typeof amToast === 'function') {
    const activeLote = AM_LOTES.find(l => l.id === AM_LOTE_ACTIVO);
    amToast('Cargado: ' + (activeLote ? activeLote.nombre : AM_LOTE_ACTIVO), 'ok');
  }

  // Refrescar el Dashboard e indicadores de la UI al instante
  if (typeof window.dashCampanaRefresh === 'function') {
    window.dashCampanaRefresh();
  }
  if (typeof window.dashRefreshCards === 'function') {
    window.dashRefreshCards();
  }

  // Integración de Arquitectura v2.0 al cambiar de lote
  if (window.ModoSwitch) {
    window.ModoSwitch.sincronizarModulosLegacy();
    window.ModoSwitch.renderizarBadge();
  }
  if (window.Campanas) {
    window.Campanas.campanaActual(AM_LOTE_ACTIVO).then(c => {
      if (c) {
        localStorage.setItem('am_campana_id', c.id);
        localStorage.setItem('am_campana_activa_id', c.id);
      } else {
        localStorage.removeItem('am_campana_id');
        localStorage.removeItem('am_campana_activa_id');
      }
      if (window.Alertas) {
        window.Alertas.evaluarAlertas({ incluirForecast: true }).then(() => {
          if (typeof window.dashCampanaRefresh === 'function') {
            window.dashCampanaRefresh();
          }
        });
      }
    });
  }
  
  // Refrescar módulo actual si es necesario
  if(typeof switchMod === 'function') {
    const actTab = document.querySelector('.nav-tab.active');
    // Si estamos en el dashboard, refrescar mapa e info
    if (actTab && actTab.textContent.includes('Dashboard')) {
      if(typeof amRefrescarMapaDashboard === 'function') amRefrescarMapaDashboard();
    }
  }
  
  // Auto-fetch data para el lote cargado SOLO si no tiene datos climáticos guardados en caché
  const coordVal = document.getElementById('s-coord')?.value;
  const hasCachedSuelo = window._sgDatos && Object.keys(window._sgDatos).length > 0;
  if(coordVal && !hasCachedSuelo && typeof buscarAPI === 'function') {
    setTimeout(buscarAPI, 300);
  }
  
  amRenderSelectLotes(); // Actualizar visualmente la lista
  amActualizarBadgesLote(); // Actualizar badges de lote en todos los módulos
};

function amGuardarLotesEstado() {
  localStorage.setItem(getLotesKey(), JSON.stringify({ lotes: AM_LOTES, activo: AM_LOTE_ACTIVO }));
}

const CALC_KEYS = [
  'am_siembra_fecha', 'am_siembra_cultivo', 'am_siembra_lat', 'am_siembra_lon', 'am_siembra_suelo',
  'am_lote_awc_mm', 'am_lote_nombre',
  'am_fen_kc_hoy', 'am_fen_etapa_hoy', 'am_fen_gdd_acum', 'am_fen_fecha_etapa_fin', 'am_fen_duracion_ciclo',
  'am_fen_agua_perfil', 'am_fen_precip_nasa', 'am_fen_agua_perfil_fuente',
  'am_hidrico_agua_actual_mm', 'am_hidrico_deficit_acum_mm', 'am_hidrico_dias_estres', 'am_hidrico_cap_max_mm',
  'am_enso_fase', 'am_enso_factor', 'am_alertas_activas', 'am_campana_id', 'am_campana_activa_id',
  'am_modo_global', 'am_modo_hidrico', 'am_modo_fenologia', 'am_cosecha_fecha', 'am_cultivo'
];

function cacheGuardar() {
  try {
    const lote = AM_LOTES.find(l => l.id === AM_LOTE_ACTIVO);
    if(!lote) return;
    
    lote.data = {
      ts: Date.now(),
      coord:   document.getElementById('s-coord')?.value,
      cultivo: document.getElementById('s-cultivo')?.value,
      fecha:   document.getElementById('s-fecha')?.value,
      suelo:   document.getElementById('s-suelo')?.value,
      t6:     document.getElementById('sv-t6')?.textContent,
      t18:    document.getElementById('sv-t18')?.textContent,
      h1:     document.getElementById('sv-h1')?.textContent,
      h2:     document.getElementById('sv-h2')?.textContent,
      h3:     document.getElementById('sv-h3')?.textContent,
      et0:    document.getElementById('sv-et0')?.textContent,
      vpd:    document.getElementById('sv-vpd')?.textContent,
      viento: document.getElementById('sv-viento')?.textContent,
      gdd:    document.getElementById('i-gdd')?.textContent,
      precioDisp:  document.getElementById('ec-precio-disp')?.value,
      precioFut:   document.getElementById('ec-precio-fut')?.value,
      rendEc:      document.getElementById('ec-rend')?.value,
      supEc:       document.getElementById('ec-sup')?.value,
      ecCultivo:   document.getElementById('ec-cultivo')?.value,
      ecRendFut:   document.getElementById('ec-rend-fut')?.value,
      fCult:       document.getElementById('f-cult')?.value,
      fSup:        document.getElementById('f-sup')?.value,
      bnCultivo:   document.getElementById('bn-cultivo')?.value,
      bnRend:      document.getElementById('bn-rend')?.value,
      bnSup:       document.getElementById('bn-sup')?.value,
      bhCultivo:   document.getElementById('bh-cultivo')?.value,
      bhFecha:     document.getElementById('bh-fecha')?.value,
      bhRendObj:   document.getElementById('bh-rend-obj')?.value,
      sgDatos:  window._sgDatos  || null,
      labDatos: window._labDatos || null,
      calcKeys: {}
    };
    
    // Guardar estados de cálculo en localStorage
    CALC_KEYS.forEach(k => {
      try {
        const val = localStorage.getItem(k);
        if (val !== null) lote.data.calcKeys[k] = val;
      } catch(_) {}
    });

    // Almacenar también la data de los info badges si queremos
    const badgeIds = ['i-ubi', 'i-suelo', 'i-temp', 'i-hum', 'i-et0', 'i-vpd', 'i-viento', 'np-rad', 'np-prec', 'np-tmax', 'np-tmin', 'np-et0', 'np-rh', 'np-drd', 'np-bal', 'sg-ph', 'sg-soc', 'sg-n', 'sg-da', 'sg-cec', 'sg-mo', 'sg-textura'];
    badgeIds.forEach(id => {
      const el = document.getElementById(id);
      if(el) lote.data[id] = el.textContent;
    });
    
    amGuardarLotesEstado();
  } catch(e) { console.warn('Cache write error:', e.message); }
}

function cacheCargar() {
  try {
    if(AM_LOTES.length === 0) amCargarLotesGlobales();
    const lote = AM_LOTES.find(l => l.id === AM_LOTE_ACTIVO);
    if (!lote || !lote.data) return false;
    const datos = lote.data;
    
    if(!datos.ts) return false;

    if (datos.coord   && document.getElementById('s-coord'))   document.getElementById('s-coord').value   = datos.coord;
    if (datos.cultivo && document.getElementById('s-cultivo')) document.getElementById('s-cultivo').value = datos.cultivo;
    if (datos.fecha   && document.getElementById('s-fecha'))   document.getElementById('s-fecha').value   = datos.fecha;
    if (datos.suelo   && document.getElementById('s-suelo'))   document.getElementById('s-suelo').value   = datos.suelo;

    // ── Restaurar o limpiar claves de localStorage correspondientes a este lote ──
    const calcKeys = datos.calcKeys || {};
    CALC_KEYS.forEach(k => {
      try {
        if (calcKeys[k] !== undefined && calcKeys[k] !== null) {
          localStorage.setItem(k, calcKeys[k]);
        } else {
          localStorage.removeItem(k); // Limpiar para evitar fuga de contexto
        }
      } catch(_) {}
    });

    // ── Sincronizar AM.store con el lote cargado ──────────
    // cacheCargar() asigna .value directamente (sin disparar el evento change),
    // por lo que el Store no se entera. Lo actualizamos aquí para que todos los
    // módulos que lean del Store (o _syncCultivo) reciban el valor correcto.
    if (typeof AM !== 'undefined' && AM.store) {
      var storeUpd = {};
      if (datos.cultivo)  storeUpd.cultivo      = datos.cultivo;
      if (datos.fecha)    storeUpd.fecha         = datos.fecha;
      if (datos.coord)    storeUpd.coordenadas   = datos.coord;
      if (Object.keys(storeUpd).length) AM.store.update(storeUpd);
    }
    // ── Cosecha usa id="cultivo" con valores en minúscula ─
    var cosSelect = document.getElementById('cultivo');
    if (cosSelect && datos.cultivo) {
      var cosVal = datos.cultivo.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
      cosSelect.value = cosVal;
    }
    if (datos.precioDisp && document.getElementById('ec-precio-disp')) document.getElementById('ec-precio-disp').value = datos.precioDisp;
    if (datos.precioFut  && document.getElementById('ec-precio-fut'))  document.getElementById('ec-precio-fut').value  = datos.precioFut;
    if (datos.rendEc     && document.getElementById('ec-rend'))        document.getElementById('ec-rend').value         = datos.rendEc;
    if (datos.supEc      && document.getElementById('ec-sup'))         document.getElementById('ec-sup').value          = datos.supEc;
    if (datos.ecCultivo  && document.getElementById('ec-cultivo'))     document.getElementById('ec-cultivo').value      = datos.ecCultivo;
    if (datos.ecRendFut  && document.getElementById('ec-rend-fut'))    document.getElementById('ec-rend-fut').value     = datos.ecRendFut;
    if (datos.fCult      && document.getElementById('f-cult'))         document.getElementById('f-cult').value          = datos.fCult;
    if (datos.fSup       && document.getElementById('f-sup'))          document.getElementById('f-sup').value           = datos.fSup;
    if (datos.bnCultivo  && document.getElementById('bn-cultivo'))     document.getElementById('bn-cultivo').value      = datos.bnCultivo;
    if (datos.bnRend     && document.getElementById('bn-rend'))        document.getElementById('bn-rend').value         = datos.bnRend;
    if (datos.bnSup      && document.getElementById('bn-sup'))         document.getElementById('bn-sup').value          = datos.bnSup;
    if (datos.bhCultivo  && document.getElementById('bh-cultivo'))     document.getElementById('bh-cultivo').value      = datos.bhCultivo;
    if (datos.bhFecha    && document.getElementById('bh-fecha'))       document.getElementById('bh-fecha').value        = datos.bhFecha;
    if (datos.bhRendObj  && document.getElementById('bh-rend-obj'))    document.getElementById('bh-rend-obj').value     = datos.bhRendObj;

    if (datos.sgDatos)  window._sgDatos  = datos.sgDatos;
    else                window._sgDatos  = null;
    if (datos.labDatos) window._labDatos = datos.labDatos;
    else                window._labDatos = {};
    // Fusionar y restaurar panel lab si hay datos
    if (typeof sueloFusionar === 'function') sueloFusionar();
    if (typeof sueloRestaurarLabInputs === 'function') setTimeout(sueloRestaurarLabInputs, 50);

    const campos = ['t6','t18','h1','h2','h3','et0','vpd','viento','gdd'];
    const ids    = ['sv-t6','sv-t18','sv-h1','sv-h2','sv-h3','sv-et0','sv-vpd','sv-viento','i-gdd'];
    campos.forEach((c,i) => {
      if (datos[c] && datos[c] !== '—') {
        const el = document.getElementById(ids[i]);
        if (el) el.textContent = datos[c];
      }
    });

    const badgeIds = ['i-ubi', 'i-suelo', 'i-temp', 'i-hum', 'i-et0', 'i-vpd', 'i-viento', 'np-rad', 'np-prec', 'np-tmax', 'np-tmin', 'np-et0', 'np-rh', 'np-drd', 'np-bal', 'sg-ph', 'sg-soc', 'sg-n', 'sg-da', 'sg-cec', 'sg-mo', 'sg-textura'];
    badgeIds.forEach(id => {
      if(datos[id] && datos[id] !== '—') {
        const el = document.getElementById(id);
        if(el) el.textContent = datos[id];
      }
    });

    return true;
  } catch(e) {
    console.warn('Cache read error:', e.message);
    return false;
  }
}


// ── BADGES DE LOTE ACTIVO EN TODOS LOS MÓDULOS ────────
// Muestra el nombre del lote activo en el encabezado de cada módulo.
// Se llama automáticamente al cambiar de lote.
window.amActualizarBadgesLote = function() {
  const lote = AM_LOTES.find(l => l.id === AM_LOTE_ACTIVO);
  const nombre = lote?.nombre || 'Sin lote';
  const coordStr = lote?.data?.coord || '';
  const tieneCoordenadas = coordStr.trim().length > 3;
  const tooltip = tieneCoordenadas ? `Coord: ${coordStr}` : 'Sin coordenadas cargadas';

  // Lista de badges en módulos: id del elemento → ícono
  const badges = [
    'mod-lote-badge-siembra',
    'mod-lote-badge-suelo',
    'mod-lote-badge-clima',
    'mod-lote-badge-cosecha',
    'mod-lote-badge-plagas',
    'mod-lote-badge-pulv',
    'mod-lote-badge-economia',
    'mod-lote-badge-hidrico',
    'mod-lote-badge-nutricion',
  ];
  badges.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '📂 ' + nombre;
    el.title = tooltip;
    el.style.display = '';
  });

  // También actualizar cultivares si está visible
  const cvBadge = document.getElementById('cv-lote-badge');
  if (cvBadge) {
    cvBadge.textContent = '📂 ' + nombre;
    cvBadge.title = tooltip;
    cvBadge.style.display = '';
  }

  // Re-ejecutar cvActualizar si el módulo cultivares está activo
  if (typeof cvActualizar === 'function') {
    const modCv = document.getElementById('mod-cultivares');
    if (modCv && !modCv.classList.contains('hidden') && modCv.style.display !== 'none') {
      cvActualizar();
    }
  }
};

// Inicializar global
document.addEventListener('DOMContentLoaded', () => {
  amCargarLotesGlobales();
  setTimeout(() => {
    cacheCargar();
    amActualizarBadgesLote();

    // Inicializar badge de modo y evaluar alertas al arrancar
    if (window.ModoSwitch) {
      window.ModoSwitch.inicializarBadge();
      window.ModoSwitch.sincronizarModulosLegacy();
    }
    if (window.Alertas) {
      window.Alertas.evaluarAlertas({ incluirForecast: true }).then(() => {
        if (typeof window.dashCampanaRefresh === 'function') {
          window.dashCampanaRefresh();
        }
      });
    }
  }, 500);
});

  // Exposición global
  window.cacheGuardar = cacheGuardar;
  window.cacheCargar = cacheCargar;
  window.amCargarLotesGlobales = amCargarLotesGlobales;
  window.amRenderSelectLotes = amRenderSelectLotes;
  window.amGuardarLotesEstado = amGuardarLotesEstado;

})();