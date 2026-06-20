// ════════════════════════════════════════════════════════
// AGROMOTOR — dashboard.js  v1.0
// Panel de Campaña Activa del Dashboard
//
// Widgets:
//   · Cabecera de campaña (lote · cultivo · fecha siembra)
//   · Etapa fenológica actual (nombre · días transcurridos · % ciclo)
//   · Balance hídrico coloreado (agua actual vs CC · déficit · estrés)
//   · Alertas activas (máx. 3 + "ver todas")
//   · Días hasta la próxima etapa fenológica
//
// Actualización: setInterval 30 s + evento 'storage'
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── CLAVES LOCALSTORAGE ──────────────────────────────
  var LS = {
    loteNombre:      'am_lote_nombre',
    cultivo:         'am_siembra_cultivo',
    fechaSiembra:    'am_siembra_fecha',
    fenEtapaHoy:     'am_fen_etapa_hoy',
    fenFechaFinEtapa:'am_fen_fecha_etapa_fin',
    fenDurCiclo:     'am_fen_duracion_ciclo',
    hidroAguaMm:     'am_hidrico_agua_actual_mm',
    hidroDeficitAcum:'am_hidrico_deficit_acum_mm',
    hidroDiasEstres: 'am_hidrico_dias_estres',
    ensoFase:        'am_enso_fase',
    ensoFactor:      'am_enso_factor',
    campanaId:       'am_campana_id',
    alertasActivas:  'am_alertas_activas',
    hidroCapMax:     'am_hidrico_cap_max_mm',
  };

  // ── UTILIDADES ───────────────────────────────────────
  function ls(key) {
    try { return localStorage.getItem(key) || ''; }
    catch(e) { return ''; }
  }
  function lsJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch(e) { return null; }
  }
  function $(id) { return document.getElementById(id); }

  function loteActivo() {
    try {
      return (typeof window.amGetLoteActivo === 'function') ? window.amGetLoteActivo() : null;
    } catch(e) {
      return null;
    }
  }

  function valLote(data, keys) {
    data = data || {};
    for (var i = 0; i < keys.length; i++) {
      var v = data[keys[i]];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return '';
  }

  function fechaPlanificada(data) {
    var plan = data && data.planificacionSiembra;
    if (!plan || typeof plan !== 'object') return '';
    for (var k in plan) {
      if (!Object.prototype.hasOwnProperty.call(plan, k)) continue;
      var v = plan[k];
      if (typeof v === 'string' && v) return v;
      if (v && typeof v === 'object') {
        if (v.fechaSiembraConf) return v.fechaSiembraConf;
        if (v.fechaSiembra) return v.fechaSiembra;
        if (v.fecha) return v.fecha;
      }
    }
    return '';
  }

  function fechaDias(isoStr) {
    if (!isoStr) return null;
    var d = new Date(isoStr + 'T12:00:00');
    var hoy = new Date();
    hoy.setHours(12, 0, 0, 0);
    return Math.round((hoy - d) / 86400000);
  }

  function diasHasta(isoStr) {
    if (!isoStr) return null;
    var d = new Date(isoStr + 'T12:00:00');
    var hoy = new Date();
    hoy.setHours(12, 0, 0, 0);
    return Math.round((d - hoy) / 86400000);
  }

  function cultEmoji(c) {
    var map = { maiz:'🌽', maíz:'🌽', soja:'🟡', trigo:'🌾', girasol:'🌻', sorgo:'🔴', cebada:'🟤', colza:'🌼' };
    return map[(c||'').toLowerCase()] || '🌱';
  }

  function ensoLabel(fase) {
    var f = (fase||'').toLowerCase();
    if (f === 'nino' || f === 'niño') return { txt:'🌊 El Niño', col:'#2A5A8C' };
    if (f === 'nina' || f === 'niña') return { txt:'❄️ La Niña', col:'#7A1A0A' };
    return { txt:'⚖️ Neutro', col:'#3A7A4A' };
  }

  // ── ESTADO DEL BALANCE HÍDRICO ──────────────────────
  function hidroEstado(aguaMm, capMax) {
    var agua = parseFloat(aguaMm) || 0;
    var cap  = parseFloat(capMax) || 180;
    var pct  = cap > 0 ? Math.min(100, Math.round(agua / cap * 100)) : 0;

    if (pct >= 60) return { pct: pct, color: '#2A7A4A', label: 'Óptimo', emoji: '💧' };
    if (pct >= 35) return { pct: pct, color: '#B87A20', label: 'Moderado', emoji: '⚠️' };
    return { pct: pct, color: '#D4522A', label: 'Estrés', emoji: '🔴' };
  }

  // ── RENDER PRINCIPAL ─────────────────────────────────
  function render() {
    var wrap = $('dash-campana-panel');
    if (!wrap) return;

    // Leer datos: lote activo primero, claves legacy solo como fallback.
    var loteActivoObj = loteActivo();
    var loteData      = (loteActivoObj && loteActivoObj.data) || {};
    var loteNombre    = (loteActivoObj && loteActivoObj.nombre) || ls(LS.loteNombre);
    var cultivo       = valLote(loteData, ['cultivo','cultivoActual']) || ls(LS.cultivo) || ls('s-cultivo-val');
    var fechaSiembra  = valLote(loteData, ['fechaSiembraReal','fechaSiembra']) || fechaPlanificada(loteData) || ls(LS.fechaSiembra);
    var fenEtapa      = ls(LS.fenEtapaHoy);
    var fenFinEtapa   = ls(LS.fenFechaFinEtapa);
    var fenDurCiclo   = parseInt(ls(LS.fenDurCiclo)) || 0;
    var hidroAgua     = ls(LS.hidroAguaMm);
    var hidroDeficit  = ls(LS.hidroDeficitAcum);
    var hidroEstres   = ls(LS.hidroDiasEstres);
    var ensoFase      = ls(LS.ensoFase);
    var campanaId     = valLote(loteData, ['campanaId','campanaActivaId']) || ls(LS.campanaId);
    var capMax        = ls(LS.hidroCapMax);

    // Si no hay ningún dato relevante → panel colapsado
    var hasDatos = loteNombre || cultivo || fechaSiembra || hidroAgua;
    if (!hasDatos) {
      wrap.innerHTML = _renderEmpty();
      return;
    }

    // Dias sembrado
    var diasSembrado = fechaDias(fechaSiembra);

    // Fenología
    var pctCiclo = 0;
    if (fenDurCiclo > 0 && diasSembrado !== null) {
      pctCiclo = Math.min(100, Math.max(0, Math.round(diasSembrado / fenDurCiclo * 100)));
    }
    var diasHastaProx = diasHasta(fenFinEtapa);

    // Hídrico
    var hidro = hidroEstado(hidroAgua, capMax);

    // ENSO
    var enso = ensoLabel(ensoFase);

    // Alertas
    var alertas = lsJSON(LS.alertasActivas) || [];
    var alertasShow = alertas.slice(0, 3);

    // ── HTML ──────────────────────────────────────────
    var html = '<div class="dcp-inner">';

    // — CABECERA DE CAMPAÑA ——————————————————————————
    html += '<div class="dcp-header">';

    html += '<div class="dcp-lote">';
    if (loteNombre) {
      html += '<span class="dcp-lote-ico">📍</span>';
      html += '<span class="dcp-lote-nombre">' + _esc(loteNombre) + '</span>';
      if (campanaId) {
        html += '<span class="dcp-campana-badge">#' + _esc(campanaId.toString().slice(-4)) + '</span>';
      }
    } else {
      html += '<span style="color:rgba(28,18,8,.35);font-size:.82rem">Sin lote activo — configurá en el Dashboard</span>';
    }
    html += '</div>';

    if (cultivo || fechaSiembra) {
      html += '<div class="dcp-meta">';
      if (cultivo) {
        html += '<span class="dcp-chip dcp-chip-green">' + cultEmoji(cultivo) + ' ' + _esc(cultivo) + '</span>';
      }
      if (fechaSiembra) {
        var fmtFecha = _formatFecha(fechaSiembra);
        html += '<span class="dcp-chip dcp-chip-earth">📅 Siembra: ' + fmtFecha + '</span>';
        if (diasSembrado !== null && diasSembrado >= 0) {
          html += '<span class="dcp-chip dcp-chip-muted">Día ' + diasSembrado + ' de campaña</span>';
        }
      }
      if (ensoFase) {
        html += '<span class="dcp-chip" style="background:rgba(42,90,140,.1);color:' + enso.col + ';border-color:rgba(42,90,140,.2)">' + enso.txt + '</span>';
      }
      html += '</div>';
    }
    html += '</div>'; // /dcp-header

    // — GRID DE WIDGETS ——————————————————————————————
    html += '<div class="dcp-grid">';

    // Widget 1: Etapa Fenológica
    html += '<div class="dcp-widget dcp-widget-fen">';
    html += '<div class="dcp-widget-title">🌿 Etapa Fenológica</div>';
    if (fenEtapa) {
      html += '<div class="dcp-fen-etapa">' + _esc(fenEtapa) + '</div>';
      html += '<div class="dcp-progress-wrap">';
      html += '<div class="dcp-progress-bar" style="width:' + pctCiclo + '%;background:linear-gradient(90deg,var(--leaf),var(--sprout))"></div>';
      html += '</div>';
      html += '<div class="dcp-progress-meta"><span>' + pctCiclo + '% del ciclo</span>';
      if (diasHastaProx !== null && diasHastaProx >= 0) {
        html += '<span>📅 Próx. etapa en <strong>' + diasHastaProx + '</strong> días</span>';
      } else if (diasHastaProx !== null && diasHastaProx < 0) {
        html += '<span style="color:var(--warn)">Etapa finalizada</span>';
      }
      html += '</div>';
    } else {
      html += '<div class="dcp-widget-empty">Sin datos fenológicos<br><small>Abrí <strong>Fen. Planificación</strong></small></div>';
    }
    html += '</div>';

    // Widget 2: Balance Hídrico
    html += '<div class="dcp-widget dcp-widget-hidro">';
    html += '<div class="dcp-widget-title">💧 Balance Hídrico</div>';
    if (hidroAgua) {
      var agua = parseFloat(hidroAgua) || 0;
      var cap  = parseFloat(capMax) || 180;
      html += '<div class="dcp-hidro-row">';
      html += '<span class="dcp-hidro-val" style="color:' + hidro.color + '">' + hidro.emoji + ' ' + Math.round(agua) + ' mm</span>';
      html += '<span class="dcp-hidro-lbl">agua en perfil</span>';
      html += '</div>';
      // barra coloreada
      html += '<div class="dcp-progress-wrap">';
      html += '<div class="dcp-progress-bar" style="width:' + hidro.pct + '%;background:' + hidro.color + '"></div>';
      html += '</div>';
      html += '<div class="dcp-progress-meta">';
      html += '<span style="color:' + hidro.color + '">' + hidro.label + ' (' + hidro.pct + '%)</span>';
      if (cap > 0) html += '<span>Cap. máx: ' + Math.round(cap) + ' mm</span>';
      html += '</div>';
      if (hidroDeficit && parseFloat(hidroDeficit) > 0) {
        html += '<div class="dcp-hidro-deficit">⚠️ Déficit acum.: <strong>' + Math.round(parseFloat(hidroDeficit)) + ' mm</strong></div>';
      }
      if (hidroEstres && parseInt(hidroEstres) > 0) {
        html += '<div class="dcp-hidro-deficit" style="color:var(--warn)">🔴 Días en estrés: <strong>' + parseInt(hidroEstres) + '</strong></div>';
      }
    } else {
      html += '<div class="dcp-widget-empty">Sin datos hídricos<br><small>Abrí <strong>Balance Hídrico</strong></small></div>';
    }
    html += '</div>';

    // Widget 3: Alertas
    html += '<div class="dcp-widget dcp-widget-alertas">';
    html += '<div class="dcp-widget-title">🚨 Alertas activas';
    if (alertas.length > 0) {
      html += ' <span class="dcp-alerta-badge">' + alertas.length + '</span>';
    }
    html += '</div>';
    if (alertasShow.length === 0) {
      html += '<div class="dcp-widget-empty" style="color:var(--ok)">✅ Sin alertas activas</div>';
    } else {
      html += '<div class="dcp-alertas-list">';
      alertasShow.forEach(function(a) {
        var sv = a.severidad || 'info';
        var col = sv === 'critica' ? '#D4522A' : sv === 'advertencia' ? '#B87A20' : '#2A5A8C';
        var bg  = sv === 'critica' ? 'rgba(212,82,42,.08)' : sv === 'advertencia' ? 'rgba(184,122,32,.08)' : 'rgba(42,90,140,.08)';
        html += '<div class="dcp-alerta-item" style="border-left-color:' + col + ';background:' + bg + '">';
        html += '<div class="dcp-alerta-txt">' + _esc((a.mensaje || a.msg || '').slice(0, 80)) + '</div>';
        html += '</div>';
      });
      if (alertas.length > 3) {
        html += '<button class="dcp-ver-todas-btn" onclick="if(typeof switchMod===\'function\')switchMod(\'fen-seg\')">+ ' + (alertas.length - 3) + ' más → ver todas</button>';
      }
      html += '</div>';
    }
    html += '</div>';

    html += '</div>'; // /dcp-grid

    html += '</div>'; // /dcp-inner
    wrap.innerHTML = html;
    wrap.classList.remove('hidden');
  }

  function _renderEmpty() {
    return '<div class="dcp-empty-state">' +
      '<span style="font-size:2rem">🌱</span>' +
      '<div>Configurá tu lote en el Dashboard para ver el resumen de campaña</div>' +
      '</div>';
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _formatFecha(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
    return iso;
  }

  // ── INICIALIZACIÓN ───────────────────────────────────
  function init() {
    // Crear contenedor si no existe (se inserta en el HTML)
    var el = $('dash-campana-panel');
    if (!el) return; // el HTML ya lo define

    render();

    // Auto-refresh cada 30 s (guardar ID para poder cancelarlo si init() se llama de nuevo)
    if (window._dashCampanaInterval) clearInterval(window._dashCampanaInterval);
    window._dashCampanaInterval = setInterval(render, 30000);

    // Reaccionar a cambios de localStorage desde otras pestañas
    window.addEventListener('storage', function(e) {
      var watched = Object.values(LS);
      if (watched.indexOf(e.key) !== -1) render();
    });

    // Reaccionar cuando se vuelve al Dashboard (visibilitychange + switchMod hook)
    document.addEventListener('am:dashboard-activado', render);

    // Fallback: también monitorear el evento de cambio de inputs clave
    ['s-coord','s-cultivo','s-fecha'].forEach(function(id) {
      var el2 = document.getElementById(id);
      if (el2) el2.addEventListener('change', function() {
        setTimeout(render, 300);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  // API pública
  window.dashCampanaRefresh = render;

})();

// ════════════════════════════════════════════════════════
// AGROMOTOR — dashboard-gantt (incluido en dashboard.js)
// Timeline Gantt de la campaña — automático, cero inputs
// ════════════════════════════════════════════════════════

(function () {
'use strict';

// ── Estructura de etapas por cultivo (% del ciclo total) ─────────────────
var ETAPAS = {
  soja: [
    { label: 'Emergencia',       pct: 6,  color: '#B8E6B0' },
    { label: 'Vegetativo V1-V6', pct: 20, color: '#6DC26A' },
    { label: 'V→R1 Prefloración',pct: 10, color: '#FFDD66' },
    { label: 'R1-R3 Floración',  pct: 17, color: '#FFB800' },
    { label: 'R3-R5 Llenado',    pct: 22, color: '#E8860A' },
    { label: 'R5-R7 Maduración', pct: 15, color: '#C86020' },
    { label: 'Madurez',          pct: 10, color: '#8A4A18' },
  ],
  maiz: [
    { label: 'Emergencia',       pct: 5,  color: '#B8E6B0' },
    { label: 'Vegetativo V1-V6', pct: 20, color: '#6DC26A' },
    { label: 'V6-VT Avanzado',   pct: 15, color: '#FFDD66' },
    { label: 'VT-R1 Floración',  pct: 8,  color: '#FFB800' },
    { label: 'R1-R3 Grano lechoso',pct:18,'color': '#E8860A' },
    { label: 'R3-R5 Grano duro', pct: 22, color: '#C86020' },
    { label: 'Madurez R6',       pct: 12, color: '#8A4A18' },
  ],
  trigo: [
    { label: 'Germinación',      pct: 8,  color: '#B8E6B0' },
    { label: 'Macollaje',        pct: 18, color: '#6DC26A' },
    { label: 'Encañado',         pct: 18, color: '#FFDD66' },
    { label: 'Espigazón',        pct: 10, color: '#FFB800' },
    { label: 'Gr. lechoso',      pct: 15, color: '#E8860A' },
    { label: 'Gr. pastoso',      pct: 17, color: '#C86020' },
    { label: 'Madurez',          pct: 14, color: '#8A4A18' },
  ],
  cebada: [
    { label: 'Germinación',      pct: 7,  color: '#B8E6B0' },
    { label: 'Macollaje',        pct: 18, color: '#6DC26A' },
    { label: 'Encañado',         pct: 20, color: '#FFDD66' },
    { label: 'Espigazón',        pct: 10, color: '#FFB800' },
    { label: 'Gr. lechoso',      pct: 14, color: '#E8860A' },
    { label: 'Gr. pastoso',      pct: 17, color: '#C86020' },
    { label: 'Madurez',          pct: 14, color: '#8A4A18' },
  ],
  girasol: [
    { label: 'Emergencia',       pct: 8,  color: '#B8E6B0' },
    { label: 'Vegetativo',       pct: 28, color: '#6DC26A' },
    { label: 'Botón floral',     pct: 12, color: '#FFDD66' },
    { label: 'Floración',        pct: 15, color: '#FFB800' },
    { label: 'Llenado',          pct: 24, color: '#E8860A' },
    { label: 'Madurez',          pct: 13, color: '#8A4A18' },
  ],
  sorgo: [
    { label: 'Emergencia',       pct: 6,  color: '#B8E6B0' },
    { label: 'Vegetativo',       pct: 28, color: '#6DC26A' },
    { label: 'Encañado',         pct: 15, color: '#FFDD66' },
    { label: 'Floración',        pct: 10, color: '#FFB800' },
    { label: 'Gr. lechoso',      pct: 18, color: '#E8860A' },
    { label: 'Gr. pastoso-maduro',pct:23, color: '#8A4A18' },
  ],
};

// Duración total de ciclo por cultivo (días, fallback si no hay am_fen_duracion_ciclo)
var CICLO_DEFAULT = {
  soja: 150, maiz: 150, trigo: 190, cebada: 180, girasol: 130, sorgo: 140
};

function _ls(k) { try { return localStorage.getItem(k) || ''; } catch(_) { return ''; } }

function _loteActivoData() {
  try {
    var lote = (typeof window.amGetLoteActivo === 'function') ? window.amGetLoteActivo() : null;
    return (lote && lote.data) || {};
  } catch(_) {
    return {};
  }
}

function _valLote(data, keys) {
  data = data || {};
  for (var i = 0; i < keys.length; i++) {
    var v = data[keys[i]];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

function _fechaPlanificada(data) {
  var plan = data && data.planificacionSiembra;
  if (!plan || typeof plan !== 'object') return '';
  for (var k in plan) {
    if (!Object.prototype.hasOwnProperty.call(plan, k)) continue;
    var v = plan[k];
    if (typeof v === 'string' && v) return v;
    if (v && typeof v === 'object') {
      if (v.fechaSiembraConf) return v.fechaSiembraConf;
      if (v.fechaSiembra) return v.fechaSiembra;
      if (v.fecha) return v.fecha;
    }
  }
  return '';
}

function _normCultivo(c) {
  var s = (c || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (s.includes('maiz') || s.includes('maíz')) return 'maiz';
  if (s.includes('trigo'))   return 'trigo';
  if (s.includes('cebada'))  return 'cebada';
  if (s.includes('girasol')) return 'girasol';
  if (s.includes('sorgo'))   return 'sorgo';
  if (s.includes('soja'))    return 'soja';
  return null;
}

function _diasDesde(fechaISO) {
  if (!fechaISO) return null;
  try {
    var d = new Date(fechaISO + 'T12:00:00');
    var h = new Date(); h.setHours(12,0,0,0);
    return Math.round((h - d) / 86400000);
  } catch(_) { return null; }
}

function _addDias(fechaISO, dias) {
  try {
    var d = new Date(fechaISO + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0,10);
  } catch(_) { return ''; }
}

function _fmt(isoStr) {
  if (!isoStr) return '';
  var p = isoStr.split('-');
  if (p.length === 3) return p[2] + '/' + p[1];
  return isoStr;
}

function render() {
  var el = document.getElementById('dash-gantt-panel');
  if (!el) return;

  var loteData = _loteActivoData();
  var cultivo  = _valLote(loteData, ['cultivo','cultivoActual']) || _ls('am_siembra_cultivo') || (document.getElementById('s-cultivo') ? document.getElementById('s-cultivo').value : '');
  var fecha    = _valLote(loteData, ['fechaSiembraReal','fechaSiembra']) || _fechaPlanificada(loteData) || _ls('am_siembra_fecha') || (document.getElementById('s-fecha') ? document.getElementById('s-fecha').value : '');
  var cultKey  = _normCultivo(cultivo);
  var etapas   = cultKey ? ETAPAS[cultKey] : null;
  var ciclo    = parseInt(_ls('am_fen_duracion_ciclo')) || (cultKey ? CICLO_DEFAULT[cultKey] : 0);

  if (!etapas || !fecha || ciclo <= 0) {
    el.innerHTML = '';
    return;
  }

  var diasActuales = _diasDesde(fecha);
  if (diasActuales === null || diasActuales < 0) { el.innerHTML = ''; return; }

  var pctHoy = Math.min(100, Math.max(0, diasActuales / ciclo * 100));
  var fechaCosecha = _addDias(fecha, ciclo);
  var yaTermino    = diasActuales >= ciclo;

  // Acumular pct para encontrar en qué etapa estamos
  var acum = 0;
  var etapaActual = null;
  for (var i = 0; i < etapas.length; i++) {
    acum += etapas[i].pct;
    if (!etapaActual && pctHoy <= acum) etapaActual = i;
  }

  var html = '<div class="dg-wrap card" style="margin-bottom:.75rem;border:1.5px solid rgba(42,90,140,.18);background:#f8fafb;padding:.85rem 1rem">';
  html += '<div class="dg-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.65rem;flex-wrap:wrap;gap:.3rem">';
  html += '<div style="font-size:.72rem;font-weight:700;color:#374151;letter-spacing:.06em;text-transform:uppercase">📅 Línea de tiempo · ' + cultivo + '</div>';
  html += '<div style="font-size:.68rem;color:#6b7280">Siembra: <b>' + _fmt(fecha) + '</b> · Cosecha est.: <b>' + _fmt(fechaCosecha) + '</b> · Ciclo: <b>' + ciclo + ' d</b></div>';
  html += '</div>';

  // ── Barra del Gantt ──
  html += '<div class="dg-track" style="position:relative;height:36px;border-radius:8px;overflow:visible;display:flex;box-shadow:0 1px 3px rgba(0,0,0,.08)">';

  var pctAccum = 0;
  etapas.forEach(function(e, idx) {
    var isActive = (idx === etapaActual) && !yaTermino;
    var isCompleted = pctHoy > pctAccum + e.pct;
    var segPct = e.pct;
    var bg = isCompleted ? _darken(e.color, 0.15) : e.color;
    var opacity = isCompleted ? '1' : (isActive ? '1' : '0.55');
    var borderRight = idx < etapas.length - 1 ? '1px solid rgba(255,255,255,.5)' : 'none';
    var borderRadius = idx === 0 ? '8px 0 0 8px' : (idx === etapas.length - 1 ? '0 8px 8px 0' : '0');

    html += '<div title="' + e.label + '" style="' +
      'width:' + segPct + '%;' +
      'background:' + bg + ';' +
      'opacity:' + opacity + ';' +
      'border-right:' + borderRight + ';' +
      'border-radius:' + borderRadius + ';' +
      'position:relative;overflow:hidden;' +
      (isActive ? 'box-shadow:inset 0 0 0 2px rgba(255,255,255,.6),0 0 0 2px rgba(0,0,0,.18);z-index:2;opacity:1;' : '') +
      '">' +
      (segPct >= 10 ? '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:700;color:rgba(0,0,0,.55);white-space:nowrap;overflow:hidden;padding:0 3px">' + (segPct >= 8 ? e.label.split(' ')[0] : '') + '</span>' : '') +
      '</div>';
    pctAccum += segPct;
  });

  // Marcador de hoy
  if (!yaTermino && pctHoy > 0 && pctHoy < 100) {
    html += '<div style="position:absolute;top:-4px;bottom:-4px;left:' + pctHoy.toFixed(1) + '%;width:2.5px;background:#1f2937;border-radius:2px;z-index:10;transform:translateX(-50%)">' +
      '<div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);background:#1f2937;color:#fff;font-size:.58rem;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap">Hoy · Día ' + diasActuales + '</div>' +
      '</div>';
  }

  html += '</div>'; // /dg-track

  // ── Leyenda de etapas (compacta) ──
  html += '<div class="dg-legend" style="display:flex;flex-wrap:wrap;gap:.25rem .75rem;margin-top:.6rem">';
  etapas.forEach(function(e, idx) {
    var isActive = (idx === etapaActual) && !yaTermino;
    html += '<span style="font-size:.62rem;display:flex;align-items:center;gap:.25rem;' +
      (isActive ? 'font-weight:700;color:#1f2937' : 'color:#6b7280') + '">' +
      '<span style="width:8px;height:8px;border-radius:2px;background:' + e.color + ';display:inline-block' +
      (isActive ? ';box-shadow:0 0 0 1.5px #374151' : '') + '"></span>' +
      e.label + '</span>';
  });

  if (yaTermino) {
    html += '<span style="font-size:.62rem;font-weight:700;color:#3A7A4A;margin-left:auto">✅ Ciclo completado</span>';
  }

  html += '</div>'; // /dg-legend
  html += '</div>'; // /dg-wrap

  el.innerHTML = html;
}

function _darken(hex, amount) {
  try {
    var r = parseInt(hex.slice(1,3),16);
    var g = parseInt(hex.slice(3,5),16);
    var b = parseInt(hex.slice(5,7),16);
    r = Math.max(0, Math.round(r * (1 - amount)));
    g = Math.max(0, Math.round(g * (1 - amount)));
    b = Math.max(0, Math.round(b * (1 - amount)));
    return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
  } catch(_) { return hex; }
}

document.addEventListener('DOMContentLoaded', function() {
  render();

  // Refrescar con datos del lote
  window.addEventListener('storage', function(e) {
    var watched = ['am_siembra_cultivo','am_siembra_fecha','am_fen_duracion_ciclo'];
    if (watched.indexOf(e.key) !== -1) render();
  });
  document.addEventListener('am:dashboard-activado', render);

  var elCultivo = document.getElementById('s-cultivo');
  var elFecha   = document.getElementById('s-fecha');
  if (elCultivo) elCultivo.addEventListener('change', function() { setTimeout(render, 200); });
  if (elFecha)   elFecha.addEventListener('change',   function() { setTimeout(render, 200); });
});

window.dashGanttRefresh = render;

})();
