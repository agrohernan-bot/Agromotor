// ════════════════════════════════════════════════════════
// AGROMOTOR — ndvi-monitor.js  v1.0
// Monitor NDVI proxy automático con detección de anomalías
//
// Fuente: ERA5 precipitation_sum + et0_fao_evapotranspiration (Open-Meteo)
// ya disponibles en la caché de graficos-hidrico.js.
//
// Algoritmo NDVI proxy:
//   NDVI[d] = clamp(0.05, 0.90, 0.30 + (precip_7d / max(et0_7d, 0.5)) × 0.42)
//   Suavizado con media móvil 7 días para reducir ruido.
//
// Detección de anomalía:
//   μ y σ calculados sobre los días 30-90 (ventana histórica reciente)
//   Alerta si NDVI_7d_reciente < μ - 1.5σ  Y  diferencia > 0.08
//
// Render: #dash-ndvi-panel (card en el Dashboard, solo si hay datos ERA5)
// ════════════════════════════════════════════════════════

(function () {
'use strict';

var LS_CACHE_PREFIX = 'am_ghd_cache_';  // mismo prefijo que graficos-hidrico.js
var LS_NDVI_ALERTA  = 'am_ndvi_alerta';

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

function _ls(k) { try { return localStorage.getItem(k) || ''; } catch(_) { return ''; } }

function _lsJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(_) { return null; } }

function _cacheKey() {
  var lat = _ls('am_siembra_lat');
  var lon = _ls('am_siembra_lon');
  var f   = _ls('am_siembra_fecha');
  if (!lat || !lon || !f) return null;
  return LS_CACHE_PREFIX + lat.slice(0,8) + '_' + lon.slice(0,9) + '_' + f;
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULO DE NDVI PROXY
// ─────────────────────────────────────────────────────────────────────────────

function computeNDVI(datos) {
  // datos: array de { fecha, precip, et0, esPronos, probLluvia }
  if (!datos || datos.length < 7) return null;

  // Solo usar datos históricos (no pronóstico) para el análisis
  var historico = datos.filter(function(d) { return !d.esPronos; });
  if (historico.length < 14) return null;

  // Media móvil 7 días: para cada día d, NDVI_proxy del tramo d-6..d
  var ndvSeries = [];
  for (var i = 6; i < historico.length; i++) {
    var ventana = historico.slice(i - 6, i + 1);
    var sumP = 0, sumE = 0;
    ventana.forEach(function(d) { sumP += (d.precip || 0); sumE += (d.et0 || 0); });
    var ratio = sumE > 0.5 ? sumP / sumE : 0;
    var ndvi  = Math.max(0.05, Math.min(0.90, 0.30 + ratio * 0.42));
    ndvSeries.push({ fecha: historico[i].fecha, ndvi: +ndvi.toFixed(3) });
  }

  if (ndvSeries.length === 0) return null;

  // Última lectura (promedio de últimos 7 días de la serie)
  var reciente = ndvSeries.slice(-7);
  var ndviActual = reciente.reduce(function(s, d) { return s + d.ndvi; }, 0) / reciente.length;
  ndviActual = +ndviActual.toFixed(3);

  // Ventana histórica: días 14-60 desde el inicio de la serie (para baseline)
  var ventanaHist = ndvSeries.slice(Math.max(0, ndvSeries.length - 60), ndvSeries.length - 7);
  var mu = 0, sigma = 0;
  if (ventanaHist.length >= 7) {
    mu = ventanaHist.reduce(function(s, d) { return s + d.ndvi; }, 0) / ventanaHist.length;
    var varSum = ventanaHist.reduce(function(s, d) { return s + Math.pow(d.ndvi - mu, 2); }, 0);
    sigma = Math.sqrt(varSum / ventanaHist.length);
  }

  // Detección de anomalía
  var umbral  = mu - 1.5 * sigma;
  var anomalia = ventanaHist.length >= 7 && ndviActual < umbral && (mu - ndviActual) > 0.08;

  // Tendencia: comparar última semana vs semana anterior
  var prevSemana = ndvSeries.slice(-14, -7);
  var ndviPrev   = prevSemana.length > 0
    ? prevSemana.reduce(function(s, d) { return s + d.ndvi; }, 0) / prevSemana.length
    : null;
  var delta = ndviPrev !== null ? +(ndviActual - ndviPrev).toFixed(3) : null;

  // Guardar estado de alerta en localStorage
  try {
    localStorage.setItem(LS_NDVI_ALERTA, JSON.stringify({
      anomalia: anomalia,
      ndviActual: ndviActual,
      mu: +mu.toFixed(3),
      delta: delta,
      ts: Date.now(),
    }));
  } catch(_) {}

  return {
    series:     ndvSeries,
    ndviActual: ndviActual,
    mu:         +mu.toFixed(3),
    sigma:      +sigma.toFixed(3),
    umbral:     +umbral.toFixed(3),
    anomalia:   anomalia,
    delta:      delta,
    nDias:      historico.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────────

function render() {
  var el = document.getElementById('dash-ndvi-panel');
  if (!el) return;

  var key  = _cacheKey();
  var raw  = key ? _lsJSON(key) : null;
  if (!raw || !Array.isArray(raw.datos) || raw.datos.length < 14) {
    el.innerHTML = '';
    return;
  }

  var res = computeNDVI(raw.datos);
  if (!res) { el.innerHTML = ''; return; }

  var ndvi   = res.ndviActual;
  var cultivo = _ls('am_siembra_cultivo') || '';

  // Color semáforo
  var color = ndvi >= 0.60 ? '#2A7A4A' : ndvi >= 0.40 ? '#C8A255' : '#D4522A';
  var ico   = ndvi >= 0.60 ? '🟢' : ndvi >= 0.40 ? '🟡' : '🔴';
  var label = ndvi >= 0.60 ? 'Vigorosa' : ndvi >= 0.40 ? 'Moderada' : 'Baja / Estrés';

  // Tendencia
  var tendencia = '';
  if (res.delta !== null) {
    if (res.delta > 0.02)       tendencia = '<span style="color:#2A7A4A;font-size:.62rem">▲ +' + res.delta.toFixed(2) + ' vs semana ant.</span>';
    else if (res.delta < -0.02) tendencia = '<span style="color:#D4522A;font-size:.62rem">▼ ' + res.delta.toFixed(2) + ' vs semana ant.</span>';
    else                        tendencia = '<span style="color:#6b7280;font-size:.62rem">→ estable</span>';
  }

  // Mini chart: últimos 30 días
  var chartDias = res.series.slice(-30);
  var barWidth  = Math.floor(100 / chartDias.length);
  var barsHtml  = chartDias.map(function(d) {
    var h = Math.round((d.ndvi / 0.90) * 100);
    var c = d.ndvi >= 0.60 ? '#6DBF82' : d.ndvi >= 0.40 ? '#C8A255' : '#D4522A';
    var isAnomaly = res.anomalia && d === chartDias[chartDias.length - 1];
    return '<div title="' + d.fecha + ' · NDVI ' + d.ndvi.toFixed(2) + '" style="' +
      'flex:1;max-width:' + barWidth + '%;' +
      'height:' + h + '%;' +
      'background:' + (isAnomaly ? '#D4522A' : c) + ';' +
      'border-radius:2px 2px 0 0;' +
      'align-self:flex-end;' +
      (isAnomaly ? 'box-shadow:0 0 0 1.5px #D4522A;' : '') +
      '"></div>';
  }).join('');

  // Anomaly banner
  var anomalyHtml = '';
  if (res.anomalia) {
    anomalyHtml = '<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:8px;padding:.45rem .7rem;font-size:.72rem;color:#991b1b;font-weight:700;margin-bottom:.5rem">' +
      '🚨 ANOMALÍA DETECTADA: NDVI ' + ndvi.toFixed(2) + ' por debajo del umbral histórico (' + res.mu.toFixed(2) + ' ± ' + res.sigma.toFixed(2) + '). Hacer scouting.' +
      '</div>';
  }

  // Baseline line position
  var baselinePct = res.mu > 0 ? Math.round((res.mu / 0.90) * 100) : 0;

  var html = '<div class="card" style="margin-bottom:.75rem;border:1.5px solid ' + (res.anomalia ? '#fca5a5' : 'rgba(42,90,140,.18)') + ';background:' + (res.anomalia ? '#fef9f9' : '#f8fafb') + '">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.3rem;margin-bottom:.55rem">';
  html += '<div style="font-size:.72rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.06em">🛰️ NDVI proxy · ' + (cultivo || 'Lote activo') + '</div>';
  html += '<div style="display:flex;align-items:center;gap:.4rem">';
  html += '<span style="font-size:1.3rem;font-weight:800;color:' + color + '">' + ndvi.toFixed(2) + '</span>';
  html += '<span style="font-size:.72rem;color:' + color + ';font-weight:600">' + ico + ' ' + label + '</span>';
  html += tendencia;
  html += '</div></div>';

  html += anomalyHtml;

  // Mini chart
  html += '<div style="position:relative;height:52px;display:flex;align-items:flex-end;gap:1px;margin-bottom:.3rem;padding:0 1px">';
  html += barsHtml;
  // Baseline μ line
  if (baselinePct > 0) {
    html += '<div title="Media histórica: ' + res.mu.toFixed(2) + '" style="position:absolute;left:0;right:0;bottom:' + baselinePct + '%;height:1.5px;background:rgba(42,90,140,.4);pointer-events:none"></div>';
  }
  html += '</div>';
  html += '<div style="font-size:.6rem;color:#9ca3af;margin-top:.2rem">📊 Últimos 30 días · ERA5 proxy precip/ET₀ · Línea azul = media histórica (' + res.mu.toFixed(2) + ') · ' + res.nDias + ' días disponibles</div>';
  html += '</div>';

  el.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(render, 1200); // esperar que graficos-hidrico.js cargue su caché

  document.addEventListener('am:dashboard-activado', render);

  // Refrescar cuando la caché hidrica se actualice (ghDiarioRender la escribe)
  var _origGhd = window.ghDiarioRender;
  if (typeof _origGhd === 'function') {
    window.ghDiarioRender = function() {
      var r = _origGhd.apply(this, arguments);
      setTimeout(render, 500);
      return r;
    };
  }
  // Fallback: escuchar storage
  window.addEventListener('storage', function(e) {
    if (e.key && e.key.startsWith(LS_CACHE_PREFIX)) render();
  });
});

window.ndviMonitorRefresh = render;

})(); // fin ndvi-monitor.js
