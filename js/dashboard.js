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

// Dashboard operativo: accion prioritaria del lote activo.
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch(_) { return ''; } }
  function lsJSON(k, fallback) {
    try {
      var raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : fallback;
    } catch(_) { return fallback; }
  }
  function loteActivo() {
    try { return (typeof window.amGetLoteActivo === 'function') ? window.amGetLoteActivo() : null; }
    catch(_) { return null; }
  }
  function val(data, keys) {
    data = data || {};
    for (var i = 0; i < keys.length; i++) {
      var v = data[keys[i]];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return '';
  }
  function planFecha(data) {
    var plan = data && data.planificacionSiembra;
    if (!plan || typeof plan !== 'object') return '';
    var prefer = ['invierno','verano'];
    for (var p = 0; p < prefer.length; p++) {
      var pp = plan[prefer[p]];
      if (pp && (pp.fechaSiembraConf || pp.fechaSiembraPlan || pp.fechaSiembra || pp.fecha)) {
        return pp.fechaSiembraConf || pp.fechaSiembraPlan || pp.fechaSiembra || pp.fecha;
      }
    }
    for (var k in plan) {
      if (!Object.prototype.hasOwnProperty.call(plan, k)) continue;
      var v = plan[k];
      if (v && typeof v === 'object') return v.fechaSiembraConf || v.fechaSiembraPlan || v.fechaSiembra || v.fecha || '';
      if (typeof v === 'string') return v;
    }
    return '';
  }
  function diasDesde(iso) {
    if (!iso) return null;
    var d = new Date(iso + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    var h = new Date(); h.setHours(12,0,0,0);
    return Math.round((h - d) / 86400000);
  }
  function fechaCorta(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : iso;
  }
  function num(v) {
    var n = parseFloat(v);
    return isNaN(n) ? null : n;
  }
  function diasCache(ts) {
    if (!ts) return null;
    var d;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(ts))) {
      var p = String(ts).split('-');
      d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 12, 0, 0, 0);
    } else {
      d = new Date(ts);
    }
    if (isNaN(d.getTime())) return null;
    var h = new Date(); h.setHours(12,0,0,0);
    d.setHours(12,0,0,0);
    return Math.max(0, Math.round((h - d) / 86400000));
  }
  function cacheApi(name) {
    try {
      var raw = localStorage.getItem('am_cosecha_api_cache_' + name);
      return raw ? JSON.parse(raw) : null;
    } catch(_) {
      return null;
    }
  }
  function cultivoKey(cultivo) {
    var c = String(cultivo || '').toLowerCase();
    if (c.indexOf('ma') === 0) return 'maiz';
    if (c.indexOf('trigo') >= 0) return 'trigo';
    if (c.indexOf('girasol') >= 0) return 'girasol';
    if (c.indexOf('sorgo') >= 0) return 'sorgo';
    return 'soja';
  }
  function bitacoraLote(lote) {
    var lista = lsJSON('am_bitacora_v2', []);
    var id = lote && lote.id;
    var global = Array.isArray(lista) ? lista : [];
    var delLote = lote && lote.data && Array.isArray(lote.data.bitacora) ? lote.data.bitacora : [];
    var map = {};
    global.concat(delLote).forEach(function(x) {
      if (!x) return;
      if (id && x.loteId && String(x.loteId) !== String(id)) return;
      map[x.id || (x.fecha + '_' + x.hora + '_' + x.tipo)] = x;
    });
    return Object.keys(map).map(function(k) { return map[k]; }).sort(function(a,b) {
      return String(a.fecha || '').localeCompare(String(b.fecha || '')) || String(a.hora || '').localeCompare(String(b.hora || ''));
    });
  }
  function entryTime(e) {
    if (!e) return 0;
    if (e.ts) {
      var nts = parseFloat(e.ts);
      if (isFinite(nts)) return nts;
      var dts = new Date(e.ts);
      if (!isNaN(dts.getTime())) return dts.getTime();
    }
    var fecha = e.fecha || '';
    var hora = e.hora || '12:00';
    var d = new Date(String(fecha) + 'T' + String(hora).slice(0,5) + ':00');
    if (!isNaN(d.getTime())) return d.getTime();
    var id = String(e.id || '').match(/(\d{10,})/);
    return id ? parseInt(id[1], 10) : 0;
  }
  function edadTextoFromTime(t, prefijo) {
    if (!t) return '';
    var d = new Date(t);
    if (isNaN(d.getTime())) return '';
    var h = new Date();
    h.setHours(12,0,0,0);
    d.setHours(12,0,0,0);
    var dias = Math.max(0, Math.round((h - d) / 86400000));
    if (dias === 0) return (prefijo || '') + 'hoy';
    if (dias === 1) return (prefijo || '') + 'ayer';
    return (prefijo || '') + 'hace ' + dias + ' dias';
  }
  function edadEntry(e, prefijo) {
    return edadTextoFromTime(entryTime(e), prefijo || '');
  }
  function edadPlan(plan, prefijo) {
    return plan && plan.ts ? edadTextoFromTime(parseFloat(plan.ts), prefijo || '') : '';
  }
  function ultimaRecorrida(bit) {
    for (var i = bit.length - 1; i >= 0; i--) {
      if (bit[i] && bit[i].quick) return bit[i];
    }
    return null;
  }
  function rendimiento(data) {
    var r = data && data.rendimientoProyectado;
    if (!r) return null;
    return { qq: num(r.rendProyectadoQq), t: num(r.rendProyectado), pct: num(r.pctLogro) };
  }
  function alertasActivas() {
    var a = lsJSON('am_alertas_activas', []);
    return Array.isArray(a) ? a : [];
  }
  function estadoAgua(ck) {
    var agua = num(ck.am_hidrico_agua_actual_mm || ls('am_hidrico_agua_actual_mm'));
    var cap = num(ck.am_hidrico_cap_max_mm || ls('am_hidrico_cap_max_mm')) || 180;
    var deficit = num(ck.am_hidrico_deficit_acum_mm || ls('am_hidrico_deficit_acum_mm')) || 0;
    var pct = agua != null && cap > 0 ? Math.max(0, Math.min(100, Math.round(agua / cap * 100))) : null;
    var nivel = pct == null ? 'sin-dato' : (pct < 35 || deficit > 45 ? 'alta' : pct < 60 || deficit > 20 ? 'media' : 'ok');
    return { agua: agua, cap: cap, deficit: deficit, pct: pct, nivel: nivel };
  }
  function etapaFen(data) {
    var etapa = ls('am_fen_etapa_hoy') || val(data, ['etapaFenologica','fenEtapaHoy']);
    var fecha = val(data, ['fechaSiembraReal','fechaSiembra']) || planFecha(data) || ls('am_siembra_fecha');
    return { etapa: etapa, fecha: fecha, dias: diasDesde(fecha) };
  }
  function ultPulv(data) {
    var p = data && data.pulverizacion;
    return p && p.ultimaAplicacion ? p.ultimaAplicacion : null;
  }
  function estadoMercado(cultivo) {
    var ck = cultivoKey(cultivo);
    var fob = cacheApi('fob_' + ck);
    var usd = cacheApi('usd_oficial');
    var pf  = cacheApi('plazo_fijo');
    return {
      cultivoKey: ck,
      fob: fob,
      usd: usd,
      pf: pf,
      fobDias: diasCache(fob && fob.ts),
      usdDias: diasCache(usd && usd.ts),
      pfDias: diasCache(pf && pf.ts)
    };
  }
  function alerta(p, mod, title, desc, btn) {
    return { p: p, mod: mod, title: title, desc: desc, btn: btn || 'Abrir' };
  }
  function lecturaCampo(bit) {
    var q = bit && bit.quick;
    if (!q) return null;
    var sanidadAlta = q.sanidad === 'Intervenir/consultar';
    var sanidadMedia = q.sanidad === 'Monitorear';
    var aguaAlta = q.agua === 'Deficit visible';
    var aguaMedia = q.agua === 'Justa';
    var standProblema = q.stand === 'Bajo' || q.stand === 'Manchoneado';
    var malezasMedia = q.malezas === 'Presencia media/alta';
    var prioAlta = q.prioridad === 'Alta';
    var prioMedia = q.prioridad === 'Atencion';
    var nivel = (sanidadAlta || aguaAlta || prioAlta || q.estado === 'Comprometido' || q.stand === 'Bajo') ? 'alta'
      : (sanidadMedia || aguaMedia || standProblema || malezasMedia || prioMedia || q.estado === 'Regular') ? 'media'
      : 'ok';
    var partes = [];
    if (q.estado) partes.push(q.estado);
    if (q.stand) partes.push('stand ' + q.stand.toLowerCase());
    if (q.sanidad) partes.push('sanidad ' + q.sanidad.toLowerCase());
    if (q.agua) partes.push('agua ' + q.agua.toLowerCase());
    return {
      quick: q,
      nivel: nivel,
      resumen: partes.join(' - '),
      sanidadAlta: sanidadAlta,
      sanidadMedia: sanidadMedia,
      aguaAlta: aguaAlta,
      aguaMedia: aguaMedia,
      standProblema: standProblema,
      malezasMedia: malezasMedia
    };
  }
  function resoluciones(data) {
    data = data || {};
    return {
      sanitaria: data.ultimaResolucionSanitaria || null,
      hidrica: data.ultimaResolucionHidrica || null,
      nutricion: data.ultimaResolucionNutricion || null
    };
  }
  function resolucionVigente(res, refEntry) {
    if (!res) return false;
    if (!refEntry) return true;
    return entryTime(res) >= entryTime(refEntry);
  }
  function nutricionVigente(res, plan) {
    if (!res) return false;
    if (!plan || !plan.ts) return true;
    var r = res.resolucionNutricion || {};
    if (r.planTs && String(r.planTs) === String(plan.ts)) return true;
    return entryTime(res) >= parseFloat(plan.ts || 0);
  }
  function labelResolucion(e, key) {
    if (!e) return '';
    var r = e[key] || e.resolucion || {};
    return r.label || e.nota || '';
  }
  function ultimaResolucion(m) {
    var list = [];
    if (m.res.sanitaria) list.push({ tipo:'Sanidad', item:m.res.sanitaria, key:'resolucionSanitaria' });
    if (m.res.hidrica) list.push({ tipo:'Agua', item:m.res.hidrica, key:'resolucionHidrica' });
    if (m.res.nutricion) list.push({ tipo:'Nutricion', item:m.res.nutricion, key:'resolucionNutricion' });
    if (!list.length) return null;
    list.sort(function(a,b) { return entryTime(b.item) - entryTime(a.item); });
    return {
      tipo: list[0].tipo,
      label: labelResolucion(list[0].item, list[0].key),
      edad: edadEntry(list[0].item, '')
    };
  }
  function estadoGeneral(m) {
    var alta = 0, media = 0;
    (m.pendientes || []).forEach(function(x) {
      if (x.state === 'alta') alta++;
      else if (x.state === 'media') media++;
    });
    if (alta) return { state:'alta', label:'Atencion inmediata', desc:alta + ' punto(s) critico(s) abierto(s)' };
    if (media) return { state:'media', label:'Seguimiento activo', desc:media + ' punto(s) para cerrar' };
    return { state:'ok', label:'Lote ordenado', desc:'Sin pendientes criticos abiertos' };
  }
  function buildPendientes(m) {
    var items = [];
    var res = m.res || {};
    if (!m.lote) {
      items.push({ state:'alta', title:'Lote activo', desc:'Seleccionar o crear lote para ordenar decisiones.', age:'sin lote activo', mod:'lotes', action:'lotes', btn:'Mis Lotes' });
      return items;
    }
    if (m.campo && (m.campo.sanidadAlta || m.campo.sanidadMedia) && !m.resVigente.sanitaria) {
      items.push({ state:m.campo.sanidadAlta ? 'alta' : 'media', title:'Sanidad pendiente', desc:'Nueva recorrida: ' + m.campo.quick.sanidad, age:edadEntry(m.ultimaRec, 'recorrida '), mod:'alerta-sanitaria', action:'resolver-sanidad', btn:'Resolver' });
    }
    if (m.campo && (m.campo.aguaAlta || m.campo.aguaMedia) && !m.resVigente.hidrica) {
      items.push({ state:m.campo.aguaAlta ? 'alta' : 'media', title:'Agua pendiente', desc:'Nueva recorrida: ' + m.campo.quick.agua, age:edadEntry(m.ultimaRec, 'recorrida '), mod:'hidrico', action:'resolver-agua', btn:'Resolver' });
    }
    if (m.nutricionPlan && !m.resVigente.nutricion) {
      items.push({ state:'media', title:'Nutricion pendiente', desc:'Plan calculado sin decision registrada.', age:edadPlan(m.nutricionPlan, 'plan '), mod:'nutricion', action:'cerrar-nutricion', btn:'Cerrar' });
    }
    if (!m.nutricionPlan) {
      items.push({ state:'baja', title:'Plan nutricional', desc:'Sin plan calculado para el lote.', age:'sin fecha de plan', mod:'nutricion', action:'calcular-nutricion', btn:'Calcular' });
    }
    if (!m.bit.length) {
      items.push({ state:'media', title:'Recorrida inicial', desc:'Falta una lectura rapida de campo.', age:'sin registros', mod:'bitacora', action:'registrar-recorrida', btn:'Registrar' });
    }
    if (m.resVigente.sanitaria) {
      items.push({ state:'ok', title:'Sanidad resuelta', desc:labelResolucion(res.sanitaria, 'resolucionSanitaria'), age:edadEntry(res.sanitaria, 'resuelta '), mod:'alerta-sanitaria', action:'ver-sanidad', btn:'Ver' });
    }
    if (m.resVigente.hidrica) {
      items.push({ state:'ok', title:'Agua resuelta', desc:labelResolucion(res.hidrica, 'resolucionHidrica'), age:edadEntry(res.hidrica, 'resuelta '), mod:'hidrico', action:'ver-agua', btn:'Ver' });
    }
    if (m.resVigente.nutricion) {
      items.push({ state:'ok', title:'Nutricion resuelta', desc:labelResolucion(res.nutricion, 'resolucionNutricion'), age:edadEntry(res.nutricion, 'resuelta '), mod:'nutricion', action:'ver-nutricion', btn:'Ver' });
    }
    var order = { alta: 0, media: 1, baja: 2, ok: 3 };
    items.sort(function(a,b) { return order[a.state] - order[b.state]; });
    return items.slice(0, 6);
  }
  function buildAlertasOperativas(m) {
    var list = [];
    var mercado = m.mercado || {};
    var campo = m.campo || null;
    var res = m.res || {};

    if (!m.lote) {
      list.push(alerta('alta', 'lotes', 'Lote activo pendiente', 'Seleccionar o crear un lote para que las alertas hereden cultivo, fecha y coordenadas.', 'Mis Lotes'));
      return list;
    }
    if (!m.fen.fecha) {
      list.push(alerta('alta', 'fen-plan', 'Fecha de siembra pendiente', 'Sin fecha no hay fenologia confiable, balance hidrico ordenado ni ventanas criticas.', 'Completar'));
    }
    if (m.agua.nivel === 'alta') {
      list.push(alerta('alta', 'hidrico', 'Agua en zona critica', 'Perfil bajo o deficit acumulado relevante. Actualizar balance antes de decidir fertilizacion o aplicacion.', 'Ver agua'));
    } else if (m.agua.nivel === 'media') {
      list.push(alerta('media', 'hidrico', 'Agua en seguimiento', 'El perfil esta intermedio. Conviene revisar reposicion y demanda de la etapa actual.', 'Revisar'));
    } else if (m.agua.nivel === 'sin-dato') {
      list.push(alerta('media', 'hidrico', 'Balance hidrico sin dato', 'Cargar o recalcular agua disponible para que el Dashboard priorice mejor.', 'Calcular'));
    }
    if (m.alerts.length > 0) {
      list.push(alerta('alta', 'alerta-sanitaria', 'Alertas sanitarias activas', 'Hay ' + m.alerts.length + ' alerta(s) guardadas para revisar con monitoreo a campo.', 'Ver alertas'));
    }
    if (campo && (campo.sanidadAlta || campo.sanidadMedia) && !m.resVigente.sanitaria) {
      list.push(alerta(campo.sanidadAlta ? 'alta' : 'media', 'alerta-sanitaria', 'Sanidad marcada en recorrida', 'Ultima recorrida: ' + campo.quick.sanidad + '. Contrastar con alertas y umbrales antes de aplicar.', 'Sanidad'));
    }
    if (campo && (campo.aguaAlta || campo.aguaMedia) && !m.resVigente.hidrica) {
      list.push(alerta(campo.aguaAlta ? 'alta' : 'media', 'hidrico', 'Agua visual condicionante', 'La recorrida marco "' + campo.quick.agua + '". Recalcular balance hidrico con dato actualizado.', 'Agua'));
    }
    if (m.nutricionPlan && !m.resVigente.nutricion) {
      list.push(alerta('media', 'nutricion', 'Plan nutricional sin cierre', 'Registrar si se aplica, posterga, ajusta dosis o se pide analisis.', 'Cerrar'));
    } else if (!m.nutricionPlan) {
      list.push(alerta('baja', 'nutricion', 'Plan nutricional pendiente', 'Calcular el plan para completar el resumen ejecutivo del lote.', 'Nutricion'));
    }
    if (campo && campo.standProblema) {
      list.push(alerta(campo.quick.stand === 'Bajo' ? 'alta' : 'media', 'fen-seg', 'Stand a validar', 'Ultima recorrida: stand ' + campo.quick.stand + '. Revisar impacto sobre rendimiento y ambiente.', 'Seguimiento'));
    }
    if (campo && campo.malezasMedia) {
      list.push(alerta('media', 'pulverizacion', 'Malezas en recorrida', 'Presencia media/alta registrada. Validar ventana de aplicacion y condiciones.', 'Pulverizar'));
    }
    if (m.rend && m.rend.pct != null && m.rend.pct < 80) {
      list.push(alerta('media', 'fen-seg', 'Rendimiento proyectado bajo objetivo', 'La proyeccion queda en ' + Math.round(m.rend.pct) + '% del objetivo. Revisar agua, sanidad y nutricion.', 'Analizar'));
    } else if (!m.rend) {
      list.push(alerta('baja', 'fen-seg', 'Rendimiento sin proyeccion', 'Generar seguimiento fenologico para alimentar el Dashboard con estimacion de rendimiento.', 'Proyectar'));
    }
    if (!mercado.fob) {
      list.push(alerta('media', 'cosecha', 'FOB sin dato guardado', 'Cargar precio disponible o reintentar API en Cosecha para evaluar decisiones comerciales.', 'Cosecha'));
    } else if (mercado.fobDias != null && mercado.fobDias > 7) {
      list.push(alerta('media', 'cosecha', 'FOB guardado desactualizado', 'El ultimo FOB del cultivo tiene ' + mercado.fobDias + ' dias. Revalidar antes de cerrar numeros.', 'Actualizar'));
    }
    if (!mercado.usd) {
      list.push(alerta('media', 'economia', 'Dolar sin dato guardado', 'Actualizar dolar desde Economia o Cosecha para evitar calculos con referencia.', 'Actualizar'));
    } else if (mercado.usdDias != null && mercado.usdDias > 2) {
      list.push(alerta('media', 'economia', 'Dolar guardado antiguo', 'El ultimo USD oficial guardado tiene ' + mercado.usdDias + ' dias.', 'Revalidar'));
    }
    if (!m.bit.length) {
      list.push(alerta('baja', 'bitacora', 'Primera recorrida pendiente', 'Registrar stand, malezas, sanidad y observaciones deja trazabilidad para decisiones futuras.', 'Registrar'));
    }
    if (!list.length) {
      list.push(alerta('baja', 'fen-seg', 'Seguimiento al dia', 'Mantener actualizacion semanal de fenologia, agua, mercado y bitacora.', 'Ver seguimiento'));
    }
    var order = { alta: 0, media: 1, baja: 2 };
    list.sort(function(a,b) { return order[a.p] - order[b.p]; });
    return list.slice(0, 5);
  }
  function buildModel() {
    var lote = loteActivo();
    var data = (lote && lote.data) || {};
    var ck = data.calcKeys || {};
    var cultivo = val(data, ['cultivo','cultivoActual']) || ls('am_siembra_cultivo') || 'Cultivo';
    var fen = etapaFen(data);
    var agua = estadoAgua(ck);
    var rend = rendimiento(data);
    var alerts = alertasActivas();
    var bit = bitacoraLote(lote);
    var ultimaBit = bit.length ? bit[bit.length - 1] : null;
    var ultimaRec = ultimaRecorrida(bit);
    var campo = lecturaCampo(ultimaRec);
    var pulv = ultPulv(data);
    var mercado = estadoMercado(cultivo);
    var res = resoluciones(data);
    var nutricionPlan = data.nutricionPlan || data.planNutricion || null;
    var resVigente = {
      sanitaria: resolucionVigente(res.sanitaria, campo && (campo.sanidadAlta || campo.sanidadMedia) ? ultimaRec : null),
      hidrica: resolucionVigente(res.hidrica, campo && (campo.aguaAlta || campo.aguaMedia) ? ultimaRec : null),
      nutricion: nutricionVigente(res.nutricion, nutricionPlan)
    };
    var actions = [];

    if (!lote) actions.push({ p:'alta', mod:'lotes', title:'Seleccionar o crear un lote', desc:'El tablero operativo necesita un lote activo.', btn:'Ir a Mis Lotes' });
    if (!fen.fecha) actions.push({ p:'alta', mod:'fen-plan', title:'Completar fecha de siembra', desc:'Sin fecha no se puede ordenar fenologia, agua ni riesgos.', btn:'Abrir fenologia' });
    if (agua.nivel === 'alta') actions.push({ p:'alta', mod:'hidrico', title:'Actualizar balance hidrico', desc:'El perfil esta bajo o el deficit acumulado es relevante.', btn:'Abrir Hidrico' });
    else if (agua.nivel === 'media') actions.push({ p:'media', mod:'hidrico', title:'Revisar agua disponible', desc:'El perfil esta en zona intermedia; conviene seguirlo de cerca.', btn:'Ver agua' });
    if (alerts.length > 0) actions.push({ p:'alta', mod:'alerta-sanitaria', title:'Revisar alertas sanitarias', desc:'Hay ' + alerts.length + ' alerta(s) activas para el lote.', btn:'Ver enfermedades' });
    if (campo && campo.sanidadAlta && !resVigente.sanitaria) actions.push({ p:'alta', mod:'alerta-sanitaria', title:'Validar sanidad de la recorrida', desc:'Hay una recorrida posterior al ultimo cierre sanitario. Revisar enfermedad, umbral y clima.', btn:'Ver Sanidad' });
    if (campo && campo.aguaAlta && !resVigente.hidrica) actions.push({ p:'alta', mod:'hidrico', title:'Recalcular agua por deficit visual', desc:'Hay una recorrida posterior al ultimo cierre hidrico. Recalcular balance con dato actualizado.', btn:'Abrir Hidrico' });
    if (campo && campo.standProblema && campo.quick.stand === 'Bajo') actions.push({ p:'alta', mod:'fen-seg', title:'Revisar stand bajo', desc:'Ajustar lectura de rendimiento y causa probable desde seguimiento.', btn:'Ver seguimiento' });
    if (!bit.length) actions.push({ p:'media', mod:'bitacora', title:'Registrar recorrida inicial', desc:'Deja trazabilidad de stand, malezas, sanidad y observaciones.', btn:'Abrir Bitacora' });
    if (rend && rend.pct != null && rend.pct < 80) actions.push({ p:'media', mod:'nutricion', title:'Revisar objetivo y nutricion', desc:'El rendimiento proyectado queda por debajo del objetivo cargado.', btn:'Abrir Nutricion' });
    if (nutricionPlan && !resVigente.nutricion) actions.push({ p:'media', mod:'nutricion', title:'Cerrar decision nutricional', desc:'Hay plan calculado o recalculado sin decision vigente.', btn:'Cerrar Nutricion' });
    if (!nutricionPlan) actions.push({ p:'baja', mod:'nutricion', title:'Calcular plan nutricional', desc:'Completa el resumen ejecutivo y agenda de fertilizacion.', btn:'Abrir Nutricion' });
    if (!pulv && fen.dias != null && fen.dias >= 20) actions.push({ p:'baja', mod:'pulverizacion', title:'Preparar ventana de aplicacion', desc:'Validar clima, viento y calidad de agua antes de una intervencion.', btn:'Ver Pulverizacion' });
    if (!actions.length) actions.push({ p:'baja', mod:'fen-seg', title:'Mantener seguimiento semanal', desc:'Actualizar fenologia, agua y bitacora para sostener el diagnostico.', btn:'Ver seguimiento' });

    var order = { alta: 0, media: 1, baja: 2 };
    actions.sort(function(a,b) { return order[a.p] - order[b.p]; });
    var model = { lote: lote, cultivo: cultivo, fen: fen, agua: agua, rend: rend, alerts: alerts, bit: bit, ultimaBit: ultimaBit, ultimaRec: ultimaRec, campo: campo, pulv: pulv, mercado: mercado, res: res, resVigente: resVigente, nutricionPlan: nutricionPlan, actions: actions };
    model.alertasOperativas = buildAlertasOperativas(model);
    model.pendientes = buildPendientes(model);
    return model;
  }
  function prioLabel(p) {
    if (p === 'alta') return { cls:'alta', txt:'Prioridad alta' };
    if (p === 'media') return { cls:'media', txt:'Atencion' };
    return { cls:'baja', txt:'Seguimiento' };
  }
  function signal(label, value, state, sub) {
    return '<div class="dop-signal dop-' + state + '"><div class="dop-signal-label">' + esc(label) + '</div><div class="dop-signal-value">' + esc(value) + '</div>' + (sub ? '<div class="dop-signal-sub">' + esc(sub) + '</div>' : '') + '</div>';
  }
  function renderAlertas(list) {
    var html = '<div class="dop-alerts"><div class="dop-alerts-head"><span>Alertas operativas</span><span>' + list.length + '</span></div>';
    list.forEach(function(x) {
      var pr = prioLabel(x.p);
      html += '<div class="dop-alert dop-alert-' + pr.cls + '">';
      html += '<div class="dop-alert-body"><div class="dop-alert-title">' + esc(x.title) + '</div><div class="dop-alert-desc">' + esc(x.desc) + '</div></div>';
      html += '<button type="button" class="dop-alert-btn" onclick="window.dopAbrirModulo&&window.dopAbrirModulo(\'' + esc(x.mod) + '\',\'' + esc(x.action || x.mod) + '\')">' + esc(x.btn) + '</button>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }
  function renderPendientes(list) {
    if (!list || !list.length) return '';
    var html = '<div class="dop-alerts" style="margin-top:.75rem"><div class="dop-alerts-head"><span>Pendientes y cierres</span><span>' + list.length + '</span></div>';
    list.forEach(function(x) {
      var pr = x.state === 'ok' ? { cls:'baja', txt:'Resuelto' } : prioLabel(x.state);
      var cls = x.state === 'ok' ? 'dop-alert-baja' : 'dop-alert-' + pr.cls;
      html += '<div class="dop-alert ' + cls + '" style="' + (x.state === 'ok' ? 'border-color:rgba(74,140,92,.25);background:rgba(74,140,92,.08)' : '') + '">';
      html += '<div class="dop-alert-body"><div class="dop-alert-title">' + esc(x.title) + '</div><div class="dop-alert-desc">' + esc(x.desc || '') + '</div>' + (x.age ? '<div class="dop-alert-desc" style="margin-top:.18rem;opacity:.72">' + esc(x.age) + '</div>' : '') + '</div>';
      html += '<button type="button" class="dop-alert-btn" onclick="window.dopAbrirModulo&&window.dopAbrirModulo(\'' + esc(x.mod) + '\',\'' + esc(x.action || x.mod) + '\')">' + esc(x.btn || 'Abrir') + '</button>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }
  function renderResumenEjecutivo(m, a) {
    var estado = estadoGeneral(m);
    var ult = ultimaResolucion(m);
    var recTxt = m.ultimaRec ? (edadEntry(m.ultimaRec, '') || 'con fecha registrada') : 'sin recorridas';
    var cierreTxt = ult ? (ult.tipo + ': ' + ult.label + (ult.edad ? ' · ' + ult.edad : '')) : 'sin cierres registrados';
    var aguaTxt = m.resVigente.hidrica ? 'resuelta' : (m.campo && (m.campo.aguaAlta || m.campo.aguaMedia) ? 'pendiente' : (m.agua.nivel === 'sin-dato' ? 'sin dato' : m.agua.nivel));
    var sanTxt = m.resVigente.sanitaria ? 'resuelta' : (m.campo && (m.campo.sanidadAlta || m.campo.sanidadMedia) ? 'pendiente' : (m.alerts.length ? 'alertas' : 'sin alertas'));
    var nutTxt = m.nutricionPlan ? (m.resVigente.nutricion ? 'cerrada' : 'plan abierto') : 'sin plan';
    var badge = function(lbl, val, state) {
      return '<div class="dop-signal dop-' + state + '" style="min-height:auto;padding:.55rem .65rem"><div class="dop-signal-label">' + esc(lbl) + '</div><div class="dop-signal-value" style="font-size:.88rem">' + esc(val) + '</div></div>';
    };
    var html = '<div class="dop-alerts" style="margin-bottom:.75rem;border-color:rgba(109,191,130,.18)">';
    html += '<div class="dop-alerts-head"><span>Resumen ejecutivo del lote</span><span>' + esc(estado.label) + '</span></div>';
    html += '<div style="display:grid;grid-template-columns:1.25fr .85fr;gap:.7rem;align-items:stretch">';
    html += '<div class="dop-alert dop-alert-' + (estado.state === 'alta' ? 'alta' : estado.state === 'media' ? 'media' : 'baja') + '" style="margin:0">';
    html += '<div class="dop-alert-body"><div class="dop-alert-title">' + esc(a.title) + '</div><div class="dop-alert-desc">' + esc(a.desc) + '</div><div class="dop-alert-desc" style="margin-top:.18rem;opacity:.75">' + esc(estado.desc) + '</div></div>';
    html += '<button type="button" class="dop-alert-btn" onclick="window.dopAbrirModulo&&window.dopAbrirModulo(\'' + esc(a.mod) + '\',\'' + esc(a.action || a.mod) + '\')">' + esc(a.btn) + '</button>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr;gap:.42rem">';
    html += badge('Ultima recorrida', recTxt, m.ultimaRec ? 'ok' : 'media');
    html += badge('Ultimo cierre', cierreTxt, ult ? 'ok' : 'media');
    html += '</div></div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.45rem;margin-top:.65rem">';
    html += badge('Agua', aguaTxt, aguaTxt === 'pendiente' || aguaTxt === 'alta' ? 'alta' : aguaTxt === 'sin dato' || aguaTxt === 'media' ? 'media' : 'ok');
    html += badge('Sanidad', sanTxt, sanTxt === 'pendiente' || sanTxt === 'alertas' ? 'media' : 'ok');
    html += badge('Nutricion', nutTxt, nutTxt === 'cerrada' ? 'ok' : 'media');
    html += badge('Bitacora', m.bit.length ? m.bit.length + ' registro(s)' : 'sin registros', m.bit.length ? 'ok' : 'media');
    html += '</div></div>';
    return html;
  }
  function render() {
    var el = $('dash-operativo-panel');
    if (!el) return;
    var m = buildModel();
    var a = m.actions[0];
    var pr = prioLabel(a.p);
    var aguaVal = m.agua.pct == null ? 'Sin dato' : m.agua.pct + '%';
    var aguaSub = m.agua.agua == null ? 'Abrir Hidrico' : Math.round(m.agua.agua) + ' mm en perfil';
    var fenVal = m.fen.etapa || (m.fen.fecha ? 'En seguimiento' : 'Sin fecha');
    var fenSub = m.fen.dias != null && m.fen.dias >= 0 ? 'Dia ' + m.fen.dias + ' desde siembra' : (m.fen.fecha ? 'Siembra ' + fechaCorta(m.fen.fecha) : 'Completar plan');
    var rendVal = m.rend && m.rend.qq != null ? m.rend.qq.toFixed(0) + ' qq/ha' : 'Sin proyeccion';
    var rendSub = m.rend && m.rend.pct != null ? Math.round(m.rend.pct) + '% del objetivo' : 'Abrir Fen. Seguimiento';
    var sanVal = m.alerts.length ? m.alerts.length + ' alerta(s)' : 'Sin alertas';
    var bitDias = m.ultimaRec ? diasCache(m.ultimaRec.fecha) : null;
    var bitVal = m.bit.length ? m.bit.length + ' registro(s)' : 'Sin recorridas';
    var bitSub = m.ultimaRec
      ? (bitDias === 0 ? 'Ultima recorrida hoy' : 'Ultima recorrida hace ' + bitDias + ' d')
      : 'Registrar primer scouting';
    if (m.campo && m.campo.resumen) bitSub = m.campo.resumen;
    var mercadoVal = !m.mercado.fob ? 'Sin FOB' : (m.mercado.fobDias != null && m.mercado.fobDias > 7 ? 'FOB antiguo' : 'FOB OK');
    var mercadoSub = m.mercado.usd ? 'USD guardado' + (m.mercado.usdDias != null ? ' hace ' + m.mercado.usdDias + ' d' : '') : 'Sin USD guardado';
    var mercadoState = (!m.mercado.fob || !m.mercado.usd) ? 'media' : ((m.mercado.fobDias != null && m.mercado.fobDias > 7) || (m.mercado.usdDias != null && m.mercado.usdDias > 2) ? 'media' : 'ok');
    var nutVal = m.nutricionPlan ? (m.resVigente.nutricion ? 'Cerrada' : 'Plan abierto') : 'Sin plan';
    var nutSub = m.resVigente.nutricion ? labelResolucion(m.res.nutricion, 'resolucionNutricion') : (m.nutricionPlan ? 'Registrar decision vigente' : 'Calcular plan');
    var nutState = m.resVigente.nutricion ? 'ok' : 'media';

    var html = '<div class="dop-card dop-prio-' + pr.cls + '">';
    html += '<div class="dop-main"><div class="dop-kicker">Que hago hoy</div><div class="dop-title">' + esc(a.title) + '</div><div class="dop-desc">' + esc(a.desc) + '</div>';
    html += '<div class="dop-meta"><span class="dop-pill dop-pill-' + pr.cls + '">' + pr.txt + '</span><span class="dop-pill">' + esc((m.lote && m.lote.nombre) || 'Sin lote') + '</span><span class="dop-pill">' + esc(m.cultivo) + '</span></div>';
    html += '<button type="button" class="dop-action" onclick="window.dopAbrirModulo&&window.dopAbrirModulo(\'' + esc(a.mod) + '\',\'' + esc(a.action || a.mod) + '\')">' + esc(a.btn) + '</button></div>';
    html += '<div class="dop-right">' + renderResumenEjecutivo(m, a) + '<div class="dop-grid">';
    html += signal('Fenologia', fenVal, m.fen.fecha ? 'ok' : 'media', fenSub);
    html += signal('Agua', aguaVal, m.agua.nivel, aguaSub);
    html += signal('Sanidad', sanVal, (m.alerts.length || (m.campo && (m.campo.sanidadAlta || m.campo.sanidadMedia))) ? (m.campo && m.campo.sanidadAlta ? 'alta' : 'media') : 'ok', m.campo && (m.campo.sanidadAlta || m.campo.sanidadMedia) ? 'Recorrida: ' + m.campo.quick.sanidad : (m.alerts.length ? 'Revisar detalle' : 'Sin alarmas guardadas'));
    html += signal('Nutricion', nutVal, nutState, nutSub);
    html += signal('Rendimiento', rendVal, m.rend && m.rend.pct != null && m.rend.pct < 80 ? 'media' : 'ok', rendSub);
    html += signal('Mercado', mercadoVal, mercadoState, mercadoSub);
    html += signal('Bitacora', bitVal, m.bit.length ? 'ok' : 'media', bitSub);
    html += '</div>' + renderAlertas(m.alertasOperativas) + renderPendientes(m.pendientes) + '</div></div>';
    el.innerHTML = html;
  }
  function init() {
    if (!document.getElementById('dop-focus-style')) {
      var st = document.createElement('style');
      st.id = 'dop-focus-style';
      st.textContent = '.dop-focus-ring{outline:3px solid rgba(109,191,130,.75)!important;box-shadow:0 0 0 6px rgba(109,191,130,.18)!important;transition:outline .2s,box-shadow .2s}';
      document.head.appendChild(st);
    }
    render();
    document.addEventListener('am:dashboard-activado', render);
    window.addEventListener('storage', render);
    if (window._dashOperativoInterval) clearInterval(window._dashOperativoInterval);
    window._dashOperativoInterval = setInterval(render, 30000);
  }
  document.addEventListener('DOMContentLoaded', init);
  function focoOperativo(action) {
    var selectors = {
      'resolver-agua': '#bh-contexto-recorrida',
      'ver-agua': '#bh-contexto-recorrida',
      'resolver-sanidad': '.as-field-context',
      'ver-sanidad': '.as-field-context',
      'cerrar-nutricion': '#nc-resolucion-panel',
      'ver-nutricion': '#nc-resolucion-panel',
      'calcular-nutricion': '#nc-plan-placeholder',
      'registrar-recorrida': '#bt-quick-card'
    };
    var sel = selectors[action];
    if (!sel) return;
    var attempts = 0;
    function tryFocus() {
      attempts++;
      if (action === 'resolver-agua' || action === 'ver-agua') {
        if (typeof window.bhRenderContextoRecorrida === 'function') window.bhRenderContextoRecorrida();
      }
      if (action === 'resolver-sanidad' || action === 'ver-sanidad') {
        if (typeof window.asPrepararAutoLote === 'function') window.asPrepararAutoLote();
      }
      if (action === 'cerrar-nutricion' || action === 'ver-nutricion' || action === 'calcular-nutricion') {
        if (typeof window.ncActualizar === 'function') window.ncActualizar();
      }
      var el = document.querySelector(sel);
      if (el) {
        el.scrollIntoView({ behavior:'smooth', block:'start' });
        if (el.classList) {
          el.classList.add('dop-focus-ring');
          setTimeout(function() { el.classList.remove('dop-focus-ring'); }, 2200);
        }
        return;
      }
      if (attempts < 12) setTimeout(tryFocus, 250);
    }
    setTimeout(tryFocus, 350);
  }
  window.dopAbrirModulo = function(mod, action) {
    var lote = loteActivo();
    if (mod === 'bitacora' || action === 'registrar-recorrida') window.BT_QUICK_MODE = true;
    if (typeof window.dlAbrirModulo === 'function' && lote && lote.id && mod !== 'lotes') {
      window.dlAbrirModulo(mod, lote.id);
      focoOperativo(action || mod);
      return;
    }
    if (mod === 'lotes' && typeof window.dlVolverNueva === 'function') {
      window.dlVolverNueva();
      return;
    }
    if (typeof window.switchMod === 'function') window.switchMod(mod);
    focoOperativo(action || mod);
  };
  window.dashOperativoRefresh = render;
})();
