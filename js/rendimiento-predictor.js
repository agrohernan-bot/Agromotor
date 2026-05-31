// ════════════════════════════════════════════════════════
// AGROMOTOR — rendimiento-predictor.js  v1.0
// Predictor automático de rendimiento · 3 escenarios P20/P50/P80
//
// Metodología:
//   1. Rendimiento base regional por cultivo (Argentina pampeana)
//   2. Corrección por ENSO (La Niña / Neutro / El Niño)
//   3. Corrección por estado hídrico actual (% AWC)
//   4. Corrección por días de estrés acumulados
//   5. Corrección por avance del ciclo (si ya pasó el llenado, menor incertidumbre)
//
// Render en: #dash-rend-panel (card en el Dashboard)
// Cero inputs — lee estado actual de localStorage.
// ════════════════════════════════════════════════════════

(function () {
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// BASE DE RENDIMIENTOS (qq/ha, pampa húmeda Argentina)
// P20 = año seco/adverso · P50 = año normal · P80 = año favorable
// ─────────────────────────────────────────────────────────────────────────────

var REND_BASE = {
  soja:    { p20: 22, p50: 33, p80: 43, unidad: 'qq/ha' },
  maiz:    { p20: 60, p50: 88, p80: 115, unidad: 'qq/ha' },
  trigo:   { p20: 24, p50: 35, p80: 48, unidad: 'qq/ha' },
  cebada:  { p20: 26, p50: 37, p80: 50, unidad: 'qq/ha' },
  girasol: { p20: 18, p50: 24, p80: 30, unidad: 'qq/ha' },
  sorgo:   { p20: 42, p50: 62, p80: 80, unidad: 'qq/ha' },
};

// ─────────────────────────────────────────────────────────────────────────────
// FACTORES DE CORRECCIÓN
// ─────────────────────────────────────────────────────────────────────────────

// ENSO → factor multiplicador sobre p20/p50/p80
var ENSO_FACTOR = {
  nina: { p20: -0.10, p50: -0.07, p80: -0.04 },  // La Niña: seca
  nino: { p20:  0.04, p50:  0.04, p80:  0.06 },  // El Niño: lluvioso (OA)
  // neutral / default: 0
};

function _ls(k) { try { return localStorage.getItem(k) || ''; } catch(_) { return ''; } }

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

function _normEnso(fase) {
  var f = (fase || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (f.includes('nina') || f.includes('niña')) return 'nina';
  if (f.includes('nino') || f.includes('niño')) return 'nino';
  return 'neutral';
}

function _diasDesde(fechaISO) {
  if (!fechaISO) return null;
  try {
    var d = new Date(fechaISO + 'T12:00:00');
    var h = new Date(); h.setHours(12,0,0,0);
    return Math.round((h - d) / 86400000);
  } catch(_) { return null; }
}

function calcular() {
  var cultivo    = _ls('am_siembra_cultivo') || (document.getElementById('s-cultivo') ? document.getElementById('s-cultivo').value : '');
  var cultKey    = _normCultivo(cultivo);
  if (!cultKey || !REND_BASE[cultKey]) return null;

  var base       = REND_BASE[cultKey];
  var ensoFase   = _normEnso(_ls('am_enso_fase'));
  var aguaMm     = parseFloat(_ls('am_hidrico_agua_actual_mm')) || 0;
  var capMax     = parseFloat(_ls('am_hidrico_cap_max_mm'))     || 0;
  var diasEstres = parseInt(_ls('am_hidrico_dias_estres'))      || 0;
  var ciclo      = parseInt(_ls('am_fen_duracion_ciclo'))       || 150;
  var fechaSiem  = _ls('am_siembra_fecha') || (document.getElementById('s-fecha') ? document.getElementById('s-fecha').value : '');
  var diasTrans  = _diasDesde(fechaSiem);
  var avancePct  = (diasTrans !== null && ciclo > 0) ? Math.min(1, diasTrans / ciclo) : 0;

  // Factor ENSO
  var ensoCorr = ENSO_FACTOR[ensoFase] || { p20: 0, p50: 0, p80: 0 };

  // Factor hídrico: basado en AWC% actual
  var awcPct = capMax > 0 ? Math.min(1, aguaMm / capMax) : null;
  var hidroCorr = { p20: 0, p50: 0, p80: 0 };
  if (awcPct !== null) {
    if (awcPct >= 0.70) {
      hidroCorr = { p20: 0.02, p50: 0.03, p80: 0.04 };
    } else if (awcPct >= 0.50) {
      hidroCorr = { p20: 0, p50: 0, p80: 0.01 };
    } else if (awcPct >= 0.30) {
      hidroCorr = { p20: -0.05, p50: -0.03, p80: 0 };
    } else {
      hidroCorr = { p20: -0.15, p50: -0.10, p80: -0.05 };
    }
  }

  // Factor días de estrés
  var estresCorr = { p20: 0, p50: 0, p80: 0 };
  if (diasEstres >= 20) {
    estresCorr = { p20: -0.18, p50: -0.14, p80: -0.08 };
  } else if (diasEstres >= 10) {
    estresCorr = { p20: -0.10, p50: -0.07, p80: -0.03 };
  } else if (diasEstres >= 5) {
    estresCorr = { p20: -0.05, p50: -0.03, p80: -0.01 };
  } else if (diasEstres >= 1) {
    estresCorr = { p20: -0.02, p50: -0.01, p80: 0 };
  }

  // A medida que avanza el ciclo, reducir incertidumbre (convergencia hacia P50)
  // En el 80% del ciclo, P20 y P80 convergen un 30% hacia P50
  var conv = Math.min(1, avancePct / 0.80);
  var convFactor = conv * 0.30;

  function calcP(pct, ensoC, hidroC, estresC) {
    var total = pct * (1 + ensoC + hidroC + estresC);
    return Math.max(1, Math.round(total * 10) / 10);
  }

  var p20 = calcP(base.p20, ensoCorr.p20, hidroCorr.p20, estresCorr.p20);
  var p50 = calcP(base.p50, ensoCorr.p50, hidroCorr.p50, estresCorr.p50);
  var p80 = calcP(base.p80, ensoCorr.p80, hidroCorr.p80, estresCorr.p80);

  // Convergencia hacia P50 según avance del ciclo
  p20 = Math.round((p20 * (1 - convFactor) + p50 * convFactor) * 10) / 10;
  p80 = Math.round((p80 * (1 - convFactor) + p50 * convFactor) * 10) / 10;

  // Precio por quintal para mostrar $/ha
  var precioStr = _ls('am_precio_quintal') || '';
  if (!precioStr) {
    var ecPrecio = document.getElementById('ec-precio-disp');
    if (ecPrecio && ecPrecio.value) precioStr = ecPrecio.value;
  }
  var precio = parseFloat(precioStr) || 0;

  return {
    cultivo: cultivo,
    cultKey: cultKey,
    p20: p20, p50: p50, p80: p80,
    unidad: base.unidad,
    precio: precio,
    ensoFase: ensoFase,
    awcPct: awcPct !== null ? Math.round(awcPct * 100) : null,
    diasEstres: diasEstres,
    avancePct: Math.round(avancePct * 100),
    ciclo: ciclo,
    diasTrans: diasTrans,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────────

function render() {
  var el = document.getElementById('dash-rend-panel');
  if (!el) return;

  var datos = calcular();
  if (!datos) { el.innerHTML = ''; return; }

  var esc = function(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };

  // Descripción del escenario por ENSO
  var ensoTexto = datos.ensoFase === 'nina' ? 'La Niña · tendencia seca' :
                  datos.ensoFase === 'nino' ? 'El Niño · tendencia húmeda' : 'Neutro';

  // Formato precio
  function fmtHa(qq, p) {
    if (p <= 0 || !p) return '';
    var usd = Math.round(qq * p);
    return ' <span style="color:#6b7280">≈ U$D ' + usd.toLocaleString('es-AR') + '/ha</span>';
  }

  var html = '<div class="card drd-wrap" style="border:1.5px solid rgba(42,90,140,.18);background:#f8fafb;margin-bottom:.75rem">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.3rem;margin-bottom:.75rem">';
  html += '<div style="font-size:.72rem;font-weight:700;color:#374151;letter-spacing:.06em;text-transform:uppercase">🎯 Proyección de rendimiento · ' + esc(datos.cultivo) + '</div>';
  html += '<div style="display:flex;gap:.4rem;flex-wrap:wrap">';
  if (datos.awcPct !== null) {
    var hC = datos.awcPct >= 60 ? '#2A7A4A' : datos.awcPct >= 35 ? '#C8A255' : '#D4522A';
    html += '<span style="font-size:.63rem;background:' + hC + '18;color:' + hC + ';border:1px solid ' + hC + '44;border-radius:4px;padding:1px 6px;font-weight:700">💧 ' + datos.awcPct + '% perfil</span>';
  }
  if (datos.diasEstres > 0) {
    html += '<span style="font-size:.63rem;background:#fef3c718;color:#92400e;border:1px solid #c8a25544;border-radius:4px;padding:1px 6px;font-weight:700">⚠️ ' + datos.diasEstres + 'd estrés</span>';
  }
  html += '<span style="font-size:.63rem;color:#6b7280;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:1px 6px">🌊 ' + esc(ensoTexto) + '</span>';
  if (datos.avancePct > 0) {
    html += '<span style="font-size:.63rem;color:#6b7280;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:1px 6px">📅 ' + datos.avancePct + '% del ciclo</span>';
  }
  html += '</div></div>';

  // Tres escenarios
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem">';

  var escenarios = [
    { key: 'p20', label: 'P20 · Adverso',  val: datos.p20, color: '#D4522A', bg: '#fdf4f0', desc: 'Año seco / estrés' },
    { key: 'p50', label: 'P50 · Normal',   val: datos.p50, color: '#C8A255', bg: '#fdfaf0', desc: 'Condiciones medias' },
    { key: 'p80', label: 'P80 · Favorable',val: datos.p80, color: '#2A7A4A', bg: '#f0fdf4', desc: 'Año lluvioso / óptimo' },
  ];

  escenarios.forEach(function(e) {
    html += '<div style="background:' + e.bg + ';border:1.5px solid ' + e.color + '33;border-radius:10px;padding:.7rem .75rem;text-align:center">';
    html += '<div style="font-size:.62rem;font-weight:700;color:' + e.color + ';text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem">' + esc(e.label) + '</div>';
    html += '<div style="font-size:1.55rem;font-weight:800;color:' + e.color + ';line-height:1">' + e.val + '</div>';
    html += '<div style="font-size:.65rem;color:#6b7280;margin-bottom:.2rem">' + esc(datos.unidad) + '</div>';
    if (datos.precio > 0) {
      html += '<div style="font-size:.68rem;color:#374151;font-weight:600">≈ U$D ' + Math.round(e.val * datos.precio).toLocaleString('es-AR') + '/ha</div>';
    }
    html += '<div style="font-size:.6rem;color:#9ca3af;margin-top:.25rem">' + esc(e.desc) + '</div>';
    html += '</div>';
  });

  html += '</div>';

  // Nota metodológica
  html += '<div style="font-size:.6rem;color:#9ca3af;margin-top:.55rem;border-top:1px solid #e5e7eb;padding-top:.4rem">';
  html += '📊 Base regional pampeana · correcciones ENSO, hídrico y estrés. ';
  if (datos.avancePct >= 60) html += 'Con ' + datos.avancePct + '% del ciclo transcurrido, la incertidumbre se redujo.';
  html += '</div>';

  html += '</div>';

  el.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(render, 800); // esperar que cache cargue localStorage

  var watched = ['am_siembra_cultivo','am_siembra_fecha','am_hidrico_agua_actual_mm',
                 'am_hidrico_dias_estres','am_hidrico_cap_max_mm','am_enso_fase',
                 'am_fen_duracion_ciclo'];
  window.addEventListener('storage', function(e) {
    if (watched.indexOf(e.key) !== -1) render();
  });
  document.addEventListener('am:dashboard-activado', render);

  var elCultivo = document.getElementById('s-cultivo');
  if (elCultivo) elCultivo.addEventListener('change', function() { setTimeout(render, 300); });
});

window.dashRendimientoRefresh = render;

})(); // fin rendimiento-predictor.js
