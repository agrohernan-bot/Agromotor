// ════════════════════════════════════════════════════════
// AGROMOTOR — cache.js & Global Lot Manager
// Persistencia localStorage · Múltiples Lotes
// ════════════════════════════════════════════════════════

(function() {
  window.AM = window.AM || {};
  window.AM.cache = {};

  const LOTES_LEGACY_KEY = 'am_global_lotes_v2'; // clave pre-fix (compartida por todos)
  let _amLotesRemoteTimer = null;
  let _amLotesRemoteLoading = false;
  let _amLotesRemoteLoadUid = null;

  function getLotesKey() {
    var uid = (typeof AM_SESION !== 'undefined' && AM_SESION && AM_SESION.id) ? AM_SESION.id : null;
    return uid ? ('am_lotes_v2_' + uid) : LOTES_LEGACY_KEY;
  }
  function amLotesRemoteDisponible() {
    return !!(window.AM_SB && typeof AM_SESION !== 'undefined' && AM_SESION && AM_SESION.id);
  }
  function amLotesDataJson(data) {
    try { return JSON.parse(JSON.stringify(data || {})); }
    catch (_) { return {}; }
  }
  function amLotesTieneDatosReales(lote) {
    if (!lote || !lote.data) return false;
    const d = lote.data;
    return !!(d.coord || d.cultivo || d.superficie || d.polygon || d.geojson || d.fecha || d.fechaSiembraPlan);
  }
  window.AM_LOTES = [];
  window.AM_LOTE_ACTIVO = 'default';

function amNormalizarEstadoLotes() {
  if (!Array.isArray(window.AM_LOTES)) window.AM_LOTES = [];
  window.AM_LOTES = window.AM_LOTES.filter(function(l) {
    return l && l.id != null;
  });

  if (!window.AM_LOTES.length) {
    window.AM_LOTES = [{ id: 'default', nombre: 'Lote Principal', data: { faseGrupos: { verano: 'planificacion', invierno: 'planificacion' } } }];
    window.AM_LOTE_ACTIVO = 'default';
    return window.AM_LOTES[0];
  }

  window.AM_LOTES.forEach(function(l) {
    l.data = l.data || {};
    l.data.faseGrupos = l.data.faseGrupos || {};
    if (!l.data.faseGrupos.verano) l.data.faseGrupos.verano = 'planificacion';
    if (!l.data.faseGrupos.invierno) l.data.faseGrupos.invierno = 'planificacion';
  });

  var activo = window.AM_LOTES.find(function(l) {
    return String(l.id) === String(window.AM_LOTE_ACTIVO);
  });
  if (!activo) {
    window.AM_LOTE_ACTIVO = window.AM_LOTES[0].id;
    activo = window.AM_LOTES[0];
  }
  return activo;
}

function amGetLoteActivo() {
  if (!Array.isArray(window.AM_LOTES) || !window.AM_LOTES.length) return null;
  return window.AM_LOTES.find(function(l) {
    return String(l.id) === String(window.AM_LOTE_ACTIVO);
  }) || null;
}

function amGrupoPorCultivo(cultivo) {
  var c = String(cultivo || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['trigo', 'cebada', 'colza'].indexOf(c) >= 0) return 'invierno';
  if (['soja', 'maiz', 'girasol', 'sorgo'].indexOf(c) >= 0) return 'verano';
  return '';
}

function amGetPlanGrupo(lote, grupo) {
  var d = (lote && lote.data) || {};
  return (d.planificacionSiembra && d.planificacionSiembra[grupo]) || {};
}

function amGetSiembraRealizadaGrupo(lote, grupo) {
  var d = (lote && lote.data) || {};
  return (d.siembraRealizada && d.siembraRealizada[grupo]) || {};
}

function amGetFaseGrupo(lote, grupo) {
  var d = (lote && lote.data) || {};
  var raw = (d.faseGrupos || {})[grupo];
  if (raw && typeof raw === 'object') return raw.fase || 'planificacion';
  return raw || 'planificacion';
}

function amFechaISO(fecha) {
  if (!fecha) return '';
  var s = String(fecha).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    var dd = String(m[1]).padStart(2, '0');
    var mm = String(m[2]).padStart(2, '0');
    return m[3] + '-' + mm + '-' + dd;
  }
  return s;
}

function amSetFaseGrupo(lote, grupo, fase) {
  if (!lote) return;
  lote.data = lote.data || {};
  lote.data.faseGrupos = lote.data.faseGrupos || {};
  lote.data.faseGrupos[grupo] = fase || 'planificacion';
}

function amGetFechaSiembraGrupo(lote, grupo) {
  var real = amGetSiembraRealizadaGrupo(lote, grupo);
  if (real.fecha) return amFechaISO(real.fecha);
  var plan = amGetPlanGrupo(lote, grupo);
  var d = (lote && lote.data) || {};
  return amFechaISO(plan.fechaSiembraConf || plan.fechaSiembraPlan
    || d.fechaSiembraConf || d.fechaSiembraPlan || d.fechaSiembra || d.fecha || '');
}

function amPersistirLotesLocal() {
  localStorage.setItem(getLotesKey(), JSON.stringify({ lotes: AM_LOTES, activo: AM_LOTE_ACTIVO }));
}

function amCargarLotesGlobales() {
  var _uid = (typeof AM_SESION !== 'undefined' && AM_SESION && AM_SESION.id) ? AM_SESION.id : null;
  if (!_uid) _amLotesRemoteLoadUid = null;
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

  amNormalizarEstadoLotes();
  try { amPersistirLotesLocal(); } catch (_) {}
  
  amRenderSelectLotes();
  if (_uid) amCargarLotesRemotos();
}

function amGetLoteLimit() {
  if (typeof AM_SESION === 'undefined' || !AM_SESION) return 1;
  // Promo hasta 01-ago-2026: 20 lotes con login
  if (new Date() < new Date('2026-08-02')) return 20;
  // Post-promo: 20 base + lotes extra contratados
  var base = 20;
  var extra = AM_SESION.lotesExtra || 0;
  return base + extra;
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

  // Poblar selects (sin agrupación)
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
  });

  // Tarjetas agrupadas por cliente
  if(listCont) {
    // Agrupar lotes por clienteNombre
    const grupos = {};
    AM_LOTES.forEach(L => {
      const key = (L.data?.clienteNombre || '').trim();
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(L);
    });
    const clientes = Object.keys(grupos).sort((a, b) => {
      if (!a) return 1; if (!b) return -1;
      return a.localeCompare(b, 'es');
    });
    const mostrarGrupos = clientes.length > 1 || (clientes.length === 1 && clientes[0] !== '');

    clientes.forEach(cliente => {
      // Encabezado de grupo
      if (mostrarGrupos) {
        const header = document.createElement('div');
        header.style.cssText = 'font-size:.7rem;font-weight:700;color:#3A7A4A;letter-spacing:.04em;text-transform:uppercase;padding:.5rem .2rem .25rem;margin-top:.5rem;border-bottom:1px solid rgba(58,122,74,.2);display:flex;align-items:center;gap:.4rem';
        header.innerHTML = `<span style="font-size:.9rem">👤</span>${cliente || '<span style="color:#9ca3af;font-weight:500;text-transform:none">Sin cliente asignado</span>'}<span style="margin-left:auto;font-size:.65rem;color:#6b7280;font-weight:500;text-transform:none">${grupos[cliente].length} lote${grupos[cliente].length!==1?'s':''}</span>`;
        listCont.appendChild(header);
      }

      grupos[cliente].forEach(L => {
        const coord   = L.data?.coord   || null;
        const cultivo = L.data?.cultivo  || null;
        const isActive = L.id === AM_LOTE_ACTIVO;

        const ck = L.data?.calcKeys || {};
        const aguaMm  = parseFloat(ck['am_hidrico_agua_actual_mm']) || 0;
        const capMax  = parseFloat(ck['am_hidrico_cap_max_mm'])     || 0;
        const etapa   = ck['am_fen_etapa_hoy']  || '';
        const diasEstres = parseInt(ck['am_hidrico_dias_estres'])   || 0;
        let alertCount = 0;
        try { alertCount = JSON.parse(ck['am_alertas_activas'] || '[]').length; } catch(_) {}

        let hidDot = '#cbd5e1'; let hidPct = '—'; let hidLabel = 'Sin datos';
        if (capMax > 0) {
          const pct = Math.min(100, Math.round(aguaMm / capMax * 100));
          hidPct = pct + '%';
          if (pct >= 60)      { hidDot = '#2A7A4A'; hidLabel = 'Óptimo';   }
          else if (pct >= 35) { hidDot = '#C8A255'; hidLabel = 'Moderado'; }
          else                { hidDot = '#D4522A'; hidLabel = 'Estrés';   }
        }

        const etapaCorta = etapa ? (etapa.length > 14 ? etapa.slice(0,13)+'…' : etapa) : '';
        const estresBadge = diasEstres > 3
          ? `<span style="font-size:.6rem;background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 5px;font-weight:700">${diasEstres}d estrés</span>`
          : '';
        const alertBadge = alertCount > 0
          ? `<span style="font-size:.6rem;background:#fee2e2;color:#991b1b;border-radius:4px;padding:1px 5px;font-weight:700">🚨 ${alertCount}</span>`
          : '';

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
          <div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;margin-top:.1rem">
            <span style="display:inline-flex;align-items:center;gap:.25rem;font-size:.65rem;font-weight:700;color:${hidDot};background:${hidDot}18;padding:2px 6px;border-radius:5px;border:1px solid ${hidDot}44" title="Balance hídrico: ${hidLabel}">
              <span style="width:7px;height:7px;border-radius:50%;background:${hidDot};display:inline-block"></span>💧 ${hidPct}
            </span>
            ${etapaCorta ? `<span style="font-size:.65rem;color:#374151;background:#f1f5f9;padding:2px 6px;border-radius:5px;border:1px solid #e2e8f0" title="Etapa fenológica: ${etapa}">🌱 ${etapaCorta}</span>` : ''}
            ${estresBadge}${alertBadge}
          </div>
        `;
        listCont.appendChild(card);
      });
    });
  }
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
  const dashEnsoInfo = document.getElementById('dash-enso-info');
  if(apiInfo) apiInfo.classList.add('hidden');
  if(nasaInfo) nasaInfo.classList.add('hidden');
  if(dashEnsoInfo) dashEnsoInfo.classList.add('hidden');
  if(apiPh) apiPh.classList.remove('hidden');
}

window.amCrearLoteGlobal = function() {
  const limite = amGetLoteLimit();
  if (AM_LOTES.length >= limite) {
    const msg = limite === 1
      ? 'Iniciá sesión para acceder a tus 20 lotes incluidos.'
      : `Alcanzaste el límite de ${limite} lotes. Podés agregar lotes extra por USD 1/mes c/u — escribinos.`;
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

  amInputModal('Nombre del nuevo lote', 'Ej: Lote Sur — Soja', function(nombre) {
    if (!nombre) return;
    const id = 'lote_' + Date.now();

    // ── Si la coord nueva era para el lote nuevo, restaurar la del previo antes de guardarlo ──
    if (coordEsParaNuevoLote) {
      const sCoord = document.getElementById('s-coord');
      if (sCoord) sCoord.value = coordPrev;
    }
    cacheGuardar();

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
    if (coordEsParaNuevoLote && typeof buscarAPI === 'function') setTimeout(buscarAPI, 500);
  });
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
  if (typeof window.amEnsoUpdateMacroCard === 'function') {
    window.amEnsoUpdateMacroCard();
  }
  if (typeof window.amEnsoRenderDetailedPanel === 'function') {
    window.amEnsoRenderDetailedPanel();
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
  amNormalizarEstadoLotes();
  amPersistirLotesLocal();
  amProgramarGuardarLotesRemotos();
}

function cacheTieneDatos(obj) {
  if (!obj) return false;
  return Object.keys(obj).some(function(k) { return k !== 'esFallback' && obj[k] != null; });
}

function cacheLeerSgFull(loteId) {
  try {
    if (!loteId || !window.localStorage) return null;
    const raw = localStorage.getItem('sg_full_' + loteId);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    const datos = cache && (cache.datos || cache.data);
    return cacheTieneDatos(datos) ? datos : null;
  } catch(_) {
    return null;
  }
}

function cacheNum(v) {
  if (v == null || v === '') return null;
  const m = String(v).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return isFinite(n) ? n : null;
}

function cacheSgDesdeLegacy(datos) {
  datos = datos || {};
  const sg = {
    ph:      cacheNum(datos['sg-ph']),
    clay:    cacheNum(datos['sg-clay']),
    sand:    cacheNum(datos['sg-sand']),
    soc:     cacheNum(datos['sg-soc']),
    n:       cacheNum(datos['sg-n']),
    da:      cacheNum(datos['sg-da']),
    cec:     cacheNum(datos['sg-cec']),
    textura: datos['sg-textura'] || datos.suelo || null,
    lat:     cacheNum(datos['sg-lat']),
    lon:     cacheNum(datos['sg-lon']),
  };
  Object.keys(sg).forEach(k => {
    if (sg[k] == null || sg[k] === '') delete sg[k];
  });
  return cacheTieneDatos(sg) ? sg : null;
}

function amProgramarGuardarLotesRemotos() {
  if (!amLotesRemoteDisponible() || _amLotesRemoteLoading) return;
  clearTimeout(_amLotesRemoteTimer);
  _amLotesRemoteTimer = setTimeout(amGuardarLotesRemotos, 700);
}

async function amGuardarLotesRemotos(force) {
  if (!amLotesRemoteDisponible() || (_amLotesRemoteLoading && !force)) return;
  amNormalizarEstadoLotes();
  const uid = AM_SESION.id;
  const lotes = Array.isArray(AM_LOTES) ? AM_LOTES : [];
  if (!lotes.length) return;

  const rows = lotes.map(l => ({
    user_id: uid,
    lote_id: String(l.id || ('lote_' + Date.now())),
    nombre: String(l.nombre || 'Lote'),
    data: amLotesDataJson(l.data),
    activo: String(l.id) === String(AM_LOTE_ACTIVO)
  }));

  const up = await AM_SB
    .from('lotes')
    .upsert(rows, { onConflict: 'user_id,lote_id' });

  if (up.error) {
    console.warn('Lotes remote save skipped:', up.error.message);
    return;
  }

  const rem = await AM_SB
    .from('lotes')
    .select('lote_id')
    .eq('user_id', uid);

  if (rem.error || !Array.isArray(rem.data)) return;
  const actuales = new Set(rows.map(r => r.lote_id));
  const stale = rem.data.map(r => r.lote_id).filter(id => !actuales.has(id));
  if (stale.length) {
    const del = await AM_SB
      .from('lotes')
      .delete()
      .eq('user_id', uid)
      .in('lote_id', stale);
    if (del.error) console.warn('Lotes remote delete skipped:', del.error.message);
  }
}

async function amCargarLotesRemotos(force) {
  if (!amLotesRemoteDisponible()) return false;
  const uid = AM_SESION.id;
  if (_amLotesRemoteLoading || (!force && _amLotesRemoteLoadUid === uid)) return false;
  _amLotesRemoteLoading = true;
  _amLotesRemoteLoadUid = uid;
  try {
    const res = await AM_SB
      .from('lotes')
      .select('lote_id,nombre,data,activo,updated_at')
      .eq('user_id', uid)
      .order('updated_at', { ascending: true });

    if (res.error) {
      console.warn('Lotes remote load skipped:', res.error.message);
      _amLotesRemoteLoadUid = null;
      return false;
    }

    const remotos = Array.isArray(res.data) ? res.data : [];
    if (remotos.length) {
      AM_LOTES = remotos.map(r => ({
        id: r.lote_id,
        nombre: r.nombre || 'Lote',
        data: r.data || {}
      }));
      const activo = remotos.find(r => r.activo) || remotos[0];
      AM_LOTE_ACTIVO = activo.lote_id;
      amNormalizarEstadoLotes();

      amPersistirLotesLocal();
      amRenderSelectLotes();
      if (typeof cacheCargar === 'function') cacheCargar();
      if (typeof amActualizarBadgesLote === 'function') amActualizarBadgesLote();
      if (typeof window.dlRefrescar === 'function') window.dlRefrescar();
      return true;
    }

    const localesConDatos = (AM_LOTES || []).some(amLotesTieneDatosReales);
    if (localesConDatos || (AM_LOTES || []).length > 1) {
      await amGuardarLotesRemotos(true);
    }
    return false;
  } catch (e) {
    console.warn('Lotes remote load error:', e.message);
    _amLotesRemoteLoadUid = null;
    return false;
  } finally {
    _amLotesRemoteLoading = false;
  }
}

window.amGuardarLotesRemotos = amGuardarLotesRemotos;
window.amCargarLotesRemotos = amCargarLotesRemotos;

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
    const geometry = {
      superficie: lote.data?.superficie || '',
      polygon: lote.data?.polygon || null,
      geojson: lote.data?.geojson || null
    };
    const workflowData = {
      fechaSiembraPlan: lote.data?.fechaSiembraPlan || '',
      fechaSiembraConf: lote.data?.fechaSiembraConf || '',
      sembConfig: lote.data?.sembConfig || null,
      antecesor: lote.data?.antecesor || '',
      'hub-enso-fase': lote.data?.['hub-enso-fase'] || '',
      planificacionSiembra: lote.data?.planificacionSiembra || null,
      rendimientoObjetivo: lote.data?.rendimientoObjetivo || '',
      faseGrupos: lote.data?.faseGrupos || null,
      siembraRealizada: lote.data?.siembraRealizada || null,
      maquinaria: lote.data?.maquinaria || null,
    };
    
    lote.data = {
      ts: Date.now(),
      coord:   document.getElementById('s-coord')?.value,
      cultivo: document.getElementById('s-cultivo')?.value,
      fecha:   document.getElementById('s-fecha')?.value,
      suelo:   document.getElementById('s-suelo')?.value,
      superficie: geometry.superficie,
      polygon: geometry.polygon,
      geojson: geometry.geojson,
      fechaSiembraPlan: workflowData.fechaSiembraPlan,
      fechaSiembraConf: workflowData.fechaSiembraConf,
      sembConfig: workflowData.sembConfig,
      antecesor: workflowData.antecesor,
      'hub-enso-fase': workflowData['hub-enso-fase'],
      planificacionSiembra: workflowData.planificacionSiembra,
      rendimientoObjetivo: workflowData.rendimientoObjetivo,
      faseGrupos: workflowData.faseGrupos,
      siembraRealizada: workflowData.siembraRealizada,
      maquinaria: workflowData.maquinaria,
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
    amRenderSelectLotes(); // Refrescar semáforo en "Mis Lotes" con nuevos calcKeys
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
    // Priorizar fecha confirmada o planeada del widget de siembra antes que la del form clásico
    var planes = datos.planificacionSiembra || {};
    var cultivoFecha = String(datos.cultivo || '').toLowerCase();
    try { cultivoFecha = cultivoFecha.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch(e) {}
    if (/ma.z/.test(cultivoFecha)) cultivoFecha = 'maiz';
    var grupoFecha = ['trigo','cebada','colza'].indexOf(cultivoFecha) >= 0 ? 'invierno'
      : (['soja','maiz','girasol','sorgo'].indexOf(cultivoFecha) >= 0 ? 'verano' : '');
    var planFecha = grupoFecha ? (planes[grupoFecha] || {}) : {};
    var fechaEfectiva = planFecha.fechaSiembraConf || planFecha.fechaSiembraPlan
      || datos.fechaSiembraConf || datos.fechaSiembraPlan || datos.fechaSiembra || datos.fecha || ''
      || (planes.invierno && (planes.invierno.fechaSiembraConf || planes.invierno.fechaSiembraPlan)) || ''
      || (planes.verano && (planes.verano.fechaSiembraConf || planes.verano.fechaSiembraPlan)) || '';
    fechaEfectiva = amFechaISO(fechaEfectiva);
    if (fechaEfectiva && document.getElementById('s-fecha')) document.getElementById('s-fecha').value = fechaEfectiva;
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
      if (datos.cultivo)    storeUpd.cultivo    = datos.cultivo;
      if (fechaEfectiva)    storeUpd.fecha      = fechaEfectiva;
      if (datos.coord)      storeUpd.coordenadas = datos.coord;
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

    const sgRestaurado = cacheTieneDatos(datos.sgDatos) ? datos.sgDatos : (cacheLeerSgFull(lote.id) || cacheSgDesdeLegacy(datos));
    if (sgRestaurado) {
      window._sgDatos = sgRestaurado;
      if (!cacheTieneDatos(datos.sgDatos)) {
        datos.sgDatos = sgRestaurado;
        amGuardarLotesEstado();
      }
    } else {
      window._sgDatos = null;
    }
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
  // Inicializar nueva UX de lotes
  if (typeof window.dlInit === 'function') window.dlInit();
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

  window.amGrupoPorCultivo = amGrupoPorCultivo;
  window.amGetPlanGrupo = amGetPlanGrupo;
  window.amGetSiembraRealizadaGrupo = amGetSiembraRealizadaGrupo;
  window.amGetFaseGrupo = amGetFaseGrupo;
  window.amSetFaseGrupo = amSetFaseGrupo;
  window.amGetFechaSiembraGrupo = amGetFechaSiembraGrupo;
  window.amFechaISO = amFechaISO;

  // Exposición global
  window.cacheGuardar = cacheGuardar;
  window.cacheCargar = cacheCargar;
  window.amCargarLotesGlobales = amCargarLotesGlobales;
  window.amRenderSelectLotes = amRenderSelectLotes;
  window.amGuardarLotesEstado = amGuardarLotesEstado;
  window.amNormalizarEstadoLotes = amNormalizarEstadoLotes;
  window.amGetLoteActivo = amGetLoteActivo;
  window.amGetLoteLimit = amGetLoteLimit;

})();

// ── MODAL DE INPUT GENÉRICO (reemplaza window.prompt) ────────────────────────
// amInputModal('Título', 'placeholder', callback(valor|null))
window.amInputModal = function(titulo, placeholder, callback) {
  function modalFechaISO(v) {
    if (typeof window.amFechaISO === 'function') return window.amFechaISO(v);
    if (!v) return '';
    var s = String(v).trim();
    var m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    return s;
  }
  var esFecha = /fecha/i.test(String(titulo || '')) || /^\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}$/.test(String(placeholder || '').trim());
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(28,18,8,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px)';

  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;border-radius:16px;padding:1.5rem;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(28,18,8,.25);font-family:"DM Sans",sans-serif';

  var h = document.createElement('div');
  h.style.cssText = 'font-weight:700;font-size:1rem;color:#1c1208;margin-bottom:1rem';
  h.textContent = titulo;

  var input = document.createElement('input');
  input.type = esFecha ? 'date' : 'text';
  if (esFecha) input.value = modalFechaISO(placeholder);
  else input.placeholder = placeholder || '';
  input.style.cssText = 'width:100%;box-sizing:border-box;border:1.5px solid #d4c9b8;border-radius:10px;padding:.65rem .9rem;font-size:.9rem;font-family:inherit;color:#1c1208;outline:none;margin-bottom:1rem';
  input.addEventListener('focus', function(){
    input.style.borderColor='#3A7A4A';
    if (esFecha && typeof input.showPicker === 'function') {
      try { input.showPicker(); } catch(_) {}
    }
  });
  if (esFecha) {
    input.addEventListener('click', function(){
      if (typeof input.showPicker === 'function') {
        try { input.showPicker(); } catch(_) {}
      }
    });
  }
  input.addEventListener('blur', function(){ input.style.borderColor='#d4c9b8'; });

  var btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:.6rem;justify-content:flex-end';

  var btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancelar';
  btnCancel.style.cssText = 'border:1.5px solid #d4c9b8;background:#fff;color:#5a4a32;border-radius:8px;padding:.5rem 1rem;font-size:.85rem;cursor:pointer;font-family:inherit';

  var btnOk = document.createElement('button');
  btnOk.textContent = esFecha ? 'Confirmar' : 'Crear';
  btnOk.style.cssText = 'border:none;background:#3A7A4A;color:#fff;border-radius:8px;padding:.5rem 1.1rem;font-size:.85rem;font-weight:600;cursor:pointer;font-family:inherit';

  function cerrar(val) {
    document.body.removeChild(overlay);
    callback(val || null);
  }

  btnCancel.addEventListener('click', function(){ cerrar(null); });
  btnOk.addEventListener('click', function(){ cerrar(esFecha ? modalFechaISO(input.value) : input.value.trim()); });
  overlay.addEventListener('click', function(e){ if(e.target===overlay) cerrar(null); });
  input.addEventListener('keydown', function(e){
    if(e.key==='Enter') cerrar(esFecha ? modalFechaISO(input.value) : input.value.trim());
    if(e.key==='Escape') cerrar(null);
  });

  btns.appendChild(btnCancel);
  btns.appendChild(btnOk);
  card.appendChild(h);
  card.appendChild(input);
  card.appendChild(btns);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  setTimeout(function(){ input.focus(); }, 50);
};
