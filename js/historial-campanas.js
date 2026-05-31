// ════════════════════════════════════════════════════════
// AGROMOTOR — historial-campanas.js  v1.0
// Comparador de campañas históricas año a año
//
// Guarda un snapshot de la campaña activa y permite
// comparar métricas clave con campañas anteriores del mismo
// lote u otros lotes, para tomar decisiones con perspectiva.
//
// Storage: am_campanas_hist · JSON array · máx 10 entradas
//
// Datos capturados por snapshot:
//   · Lote, cultivo, fecha de siembra, ENSO
//   · % avance ciclo + etapa fenológica
//   · Días de estrés hídrico + agua en perfil %
//   · Rendimiento predicho P50 (qq/ha) del predictor
//   · Huella CO₂ por tonelada (del módulo Huella)
//   · N aplicado (kg N/ha) desde módulo Nutrición
//   · Cantidad de alertas activas al momento del guardado
// ════════════════════════════════════════════════════════

(function () {
'use strict';

var LS_KEY   = 'am_campanas_hist';
var MAX_CAMP = 10;

// ─────────────────────────────────────────────────────────────────────────────
// LECTURA DE ESTADO ACTUAL
// ─────────────────────────────────────────────────────────────────────────────

function _ls(k)  { try { return localStorage.getItem(k) || ''; } catch(_) { return ''; } }
function _lsN(k) { return parseFloat(_ls(k)) || 0; }
function _lsI(k) { return parseInt(_ls(k))   || 0; }
function _lsJ(k) { try { return JSON.parse(_ls(k) || 'null'); } catch(_) { return null; } }
function _gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }

function capturar() {
  var cultivo    = _ls('am_siembra_cultivo') || _gv('s-cultivo') || '';
  var fechaSiem  = _ls('am_siembra_fecha')   || _gv('s-fecha')   || '';
  var lote       = _ls('am_lote_nombre')     || 'Lote principal';
  var enso       = _ls('am_enso_fase')       || 'neutro';
  var etapa      = _ls('am_fen_etapa_hoy')   || '';
  var pctCiclo   = _lsN('am_fen_pct_ciclo');

  // Hídrico
  var diasEstres = _lsI('am_hidrico_dias_estres');
  var aguaMm     = _lsN('am_hidrico_agua_actual_mm');
  var capMax     = _lsN('am_hidrico_cap_max_mm');
  var aguaPct    = capMax > 0 ? Math.round(aguaMm / capMax * 100) : 0;

  // Rendimiento P50 (qq/ha) — persistido por rendimiento-predictor.js
  var rendP50 = _lsN('am_rend_pred_p50');

  // Huella CO₂ — persistido por huella-carbono.js al calcular
  var co2PorTon = _lsN('am_hc_ultimo_por_ton');

  // N aplicado (módulo Nutrición guarda en nc_n_kg)
  var nKgHa = _lsN('nc_n_kg');

  // Alertas activas
  var alertas    = _lsJ('am_alertas_activas');
  var numAlertas = Array.isArray(alertas) ? alertas.length : 0;

  return {
    id:         Date.now(),
    lote:       lote,
    cultivo:    cultivo,
    fechaSiem:  fechaSiem,
    enso:       enso,
    etapa:      etapa,
    pctCiclo:   pctCiclo,
    diasEstres: diasEstres,
    aguaPct:    aguaPct,
    rendP50:    rendP50,
    co2PorTon:  co2PorTon,
    nKgHa:      nKgHa,
    numAlertas: numAlertas,
    ts:         Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────

function cargar() {
  try { return JSON.parse(_ls(LS_KEY) || '[]'); } catch(_) { return []; }
}
function persistir(arr) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch(_) {}
}

function guardarSnapshot() {
  var c    = capturar();
  var hist = cargar();
  // Un snapshot por lote+cultivo+fechaSiem: reemplazar si ya existe
  hist = hist.filter(function(h) {
    return !(h.lote === c.lote && h.cultivo === c.cultivo && h.fechaSiem === c.fechaSiem);
  });
  hist.unshift(c);
  if (hist.length > MAX_CAMP) hist = hist.slice(0, MAX_CAMP);
  persistir(hist);
  return c;
}

function eliminar(id) {
  persistir(cargar().filter(function(c) { return c.id !== id; }));
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE FORMATO
// ─────────────────────────────────────────────────────────────────────────────

var ENSO_LABEL = {
  nina:    'Niña ❄️',
  niña:    'Niña ❄️',
  nino:    'Niño 🌡️',
  niño:    'Niño 🌡️',
  neutro:  'Neutro ➖',
  neutral: 'Neutro ➖',
};

function _normEnso(e) {
  return (e || 'neutro').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
}

function fmtDate(s) {
  if (!s) return '—';
  var d = new Date(s + (s.length === 10 ? 'T12:00:00' : ''));
  if (isNaN(d)) return s;
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtTs(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'2-digit' });
}
function dash() { return '<span style="opacity:.3">—</span>'; }

// ─────────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────────

function render() {
  var el = document.getElementById('mod-hist-campanas');
  if (!el) return;

  var actual = capturar();
  var hist   = cargar();

  // Columnas: campaña actual (col 0) + hasta 4 guardadas
  var cols = [{ tipo: 'actual', data: actual }].concat(
    hist.slice(0, 4).map(function(h) { return { tipo: 'guardada', data: h }; })
  );

  // ── Cabecera de columnas ──────────────────────────────────
  var thActual = '<th style="padding:.65rem .9rem;font-size:.72rem;font-weight:700;'
    + 'color:#7FC99E;background:rgba(42,122,74,.1);border-bottom:2px solid rgba(42,122,74,.3);'
    + 'white-space:nowrap;text-align:left">▶ Campaña actual</th>';

  var thHist = hist.slice(0, 4).map(function(h) {
    var lbl = (h.cultivo || 'Lote') + ' · ' + fmtTs(h.ts);
    return '<th style="padding:.65rem .9rem;font-size:.72rem;font-weight:600;opacity:.6;'
      + 'border-bottom:1px solid rgba(237,224,196,.12);white-space:nowrap;text-align:left">'
      + lbl
      + '<button onclick="window.histCampEliminar(' + h.id + ')" title="Eliminar campaña" '
      + 'style="margin-left:.5rem;background:none;border:none;cursor:pointer;'
      + 'opacity:.35;font-size:.65rem;color:inherit;padding:0;vertical-align:middle">✕</button>'
      + '</th>';
  }).join('');

  // ── Definición de filas ───────────────────────────────────
  function rowCells(fn) {
    return cols.map(function(col, i) {
      var bg = i === 0 ? 'background:rgba(42,122,74,.05);' : '';
      return '<td style="' + bg + 'padding:.55rem .9rem;font-size:.82rem;'
        + 'border-bottom:1px solid rgba(237,224,196,.07)">' + fn(col.data) + '</td>';
    }).join('');
  }

  var ENSO_COLOR = { nina:'#7BAFD4', nino:'#D4522A', neutro:'rgba(237,224,196,.5)', neutral:'rgba(237,224,196,.5)' };

  var FILAS = [
    {
      label: 'Cultivo',
      cells: rowCells(function(d) { return d.cultivo || dash(); })
    },
    {
      label: 'Siembra',
      cells: rowCells(function(d) { return fmtDate(d.fechaSiem); })
    },
    {
      label: 'Avance ciclo',
      cells: rowCells(function(d) {
        if (!d.pctCiclo) return dash();
        var c = d.pctCiclo >= 80 ? '#2A7A4A' : d.pctCiclo >= 40 ? '#C8A255' : '#6b7280';
        var etq = d.etapa ? ' <span style="font-size:.68rem;opacity:.55">· ' + d.etapa + '</span>' : '';
        return '<span style="font-weight:700;color:' + c + '">' + d.pctCiclo + '%</span>' + etq;
      })
    },
    {
      label: 'Rend. P50',
      cells: rowCells(function(d) {
        if (!d.rendP50) return dash();
        return '<strong>' + d.rendP50 + '</strong> <span style="opacity:.6;font-size:.75rem">qq/ha</span>';
      })
    },
    {
      label: 'Días estrés híd.',
      cells: rowCells(function(d) {
        if (!d.diasEstres) return '<span style="color:#2A7A4A;font-size:.78rem">✅ Sin estrés</span>';
        var c = d.diasEstres >= 15 ? '#D4522A' : d.diasEstres >= 7 ? '#C8800A' : '#C8A255';
        return '<span style="color:' + c + ';font-weight:700">' + d.diasEstres + 'd</span>';
      })
    },
    {
      label: 'Agua perfil',
      cells: rowCells(function(d) {
        if (!d.aguaPct) return dash();
        var c = d.aguaPct >= 60 ? '#2A7A4A' : d.aguaPct >= 35 ? '#C8800A' : '#D4522A';
        return '<span style="color:' + c + ';font-weight:600">' + d.aguaPct + '%</span>';
      })
    },
    {
      label: 'ENSO',
      cells: rowCells(function(d) {
        var k = _normEnso(d.enso);
        var c = ENSO_COLOR[k] || 'rgba(237,224,196,.5)';
        return '<span style="color:' + c + '">' + (ENSO_LABEL[k] || d.enso || '—') + '</span>';
      })
    },
    {
      label: 'N aplicado',
      cells: rowCells(function(d) {
        if (!d.nKgHa) return dash();
        return d.nKgHa + ' <span style="opacity:.6;font-size:.75rem">kg N/ha</span>';
      })
    },
    {
      label: 'Huella CO₂',
      cells: rowCells(function(d) {
        if (!d.co2PorTon) return dash();
        return d.co2PorTon + ' <span style="opacity:.6;font-size:.75rem">kg CO₂-eq/t</span>';
      })
    },
    {
      label: 'Alertas',
      cells: rowCells(function(d) {
        if (!d.numAlertas) return '<span style="color:#2A7A4A;font-size:.78rem">✅ Sin alertas</span>';
        return '<span style="color:#D4522A;font-weight:700">🚨 ' + d.numAlertas + '</span>';
      })
    },
  ];

  // ── Tabla o placeholder ───────────────────────────────────
  var tablaHTML;
  if (hist.length === 0) {
    tablaHTML = '<div style="padding:2.5rem 1rem;text-align:center;opacity:.4;font-size:.88rem;line-height:1.5">'
      + 'Guardá la campaña actual para empezar a comparar.<br>'
      + '<span style="font-size:.78rem">El próximo año vas a ver esta campaña vs la nueva.</span>'
      + '</div>';
  } else {
    var filasTR = FILAS.map(function(f) {
      return '<tr>'
        + '<td style="padding:.5rem .9rem;font-size:.68rem;font-weight:700;opacity:.5;'
        + 'white-space:nowrap;border-bottom:1px solid rgba(237,224,196,.07);'
        + 'letter-spacing:.04em;text-transform:uppercase">' + f.label + '</td>'
        + f.cells
        + '</tr>';
    }).join('');

    tablaHTML = '<div style="overflow-x:auto;margin-top:.6rem">'
      + '<table style="width:100%;border-collapse:collapse;min-width:480px">'
      + '<thead><tr>'
      + '<th style="padding:.65rem .9rem;font-size:.68rem;text-align:left;'
      + 'border-bottom:1px solid rgba(237,224,196,.12);opacity:.45">Métrica</th>'
      + thActual + thHist
      + '</tr></thead>'
      + '<tbody>' + filasTR + '</tbody>'
      + '</table></div>';
  }

  // ── Badge contador guardadas ──────────────────────────────
  var badge = hist.length > 0
    ? '<span style="font-size:.73rem;opacity:.4;margin-left:.8rem">'
      + hist.length + ' campaña' + (hist.length !== 1 ? 's' : '') + ' guardada' + (hist.length !== 1 ? 's' : '')
      + '</span>'
    : '';

  el.innerHTML = ''
    + '<div style="padding:1.4rem 1.4rem 0">'
    + '<div class="module-title" style="margin-bottom:.25rem">'
    + '📊 <em>Historial de Campañas</em>'
    + '<span style="font-size:.68rem;background:rgba(42,90,140,.15);color:#7BAFD4;'
    + 'border-radius:10px;padding:.15rem .55rem;margin-left:.6rem;font-weight:500">año a año</span>'
    + '</div>'
    + '<div class="module-subtitle" style="margin-bottom:1rem">'
    + 'Snapshot de la campaña activa para comparar rendimiento, estrés hídrico y emisiones con campañas anteriores.'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">'
    + '<button id="hc-btn-guardar" onclick="window.histCampGuardar()" '
    + 'style="background:rgba(42,122,74,.18);color:#7FC99E;border:1px solid rgba(42,122,74,.3);'
    + 'border-radius:8px;padding:.45rem 1.2rem;font-size:.82rem;cursor:pointer;'
    + 'font-family:inherit;font-weight:600">💾 Guardar campaña actual</button>'
    + badge
    + '</div>'
    + '</div>'
    + '<div style="padding:.6rem 1.4rem 1.6rem">' + tablaHTML + '</div>';
}

// ─────────────────────────────────────────────────────────────────────────────
// TAMBIÉN ACTUALIZAR EL MINI-CARD DEL DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

function renderDashCard() {
  var el = document.getElementById('dash-hist-campanas-card');
  if (!el) return;
  var hist = cargar();
  var n    = hist.length;
  var txt  = n === 0
    ? 'Sin campañas guardadas aún'
    : n + ' campaña' + (n !== 1 ? 's' : '') + ' · última: ' + fmtTs((hist[0] || {}).ts);

  el.innerHTML = '<div style="font-size:.72rem;opacity:.55;margin-top:.2rem">' + txt + '</div>';
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

window.histCampGuardar = function() {
  guardarSnapshot();
  render();
  renderDashCard();
  var btn = document.getElementById('hc-btn-guardar');
  if (btn) {
    var orig = btn.innerHTML;
    btn.innerHTML = '✅ Guardado';
    btn.disabled = true;
    setTimeout(function() { btn.innerHTML = orig; btn.disabled = false; }, 1800);
  }
};

window.histCampEliminar = function(id) {
  eliminar(id);
  render();
  renderDashCard();
};

window.histCampanasRender = function() {
  render();
  renderDashCard();
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(renderDashCard, 600);
});

})(); // fin historial-campanas.js
