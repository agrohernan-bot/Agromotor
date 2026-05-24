// ════════════════════════════════════════════════════════
// AGROMOTOR — fenologia.js
// Curva de lluvias × estadios fenológicos + balance hídrico
// NASA POWER climatology · ENSO adjustment · Chart.js 4
// ════════════════════════════════════════════════════════

(function () {
  window.AM = window.AM || {};
  window.AM.fenologia = {};

  // ── Estado interno ────────────────────────────────────
  var nasaCache = {};   // { 'lat,lon': props }
  var fenChart  = null;
  var _fenInitDone = false;

  // ── Tabla fenológica ──────────────────────────────────
  // { cultivo: { ciclo: [ {nombre, dias, kc, stress, isCritico, color} ] } }
  // "dias" = duración del estadio en días desde siembra
  // "stress" = sensibilidad 0-1 (usada para clasificar riesgo hídrico)
  var FENOLOGIA = {
    soja: {
      corto: [
        { nombre: 'Emergencia–V3',    dias: 18,  kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V3–V6',            dias: 20,  kc: 0.70, stress: 0.5, isCritico: false, color: '#3DAB7A' },
        { nombre: 'V6–R1 (Floración)',dias: 22,  kc: 1.00, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'R1–R3 (Llenado)',  dias: 20,  kc: 1.15, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'R3–R5',            dias: 18,  kc: 1.10, stress: 0.9, isCritico: true,  color: '#C94A2A' },
        { nombre: 'R5–R7 (Madurez)', dias: 20,  kc: 0.70, stress: 0.4, isCritico: false, color: '#8B6F47' },
      ],
      largo: [
        { nombre: 'Emergencia–V3',    dias: 20,  kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V3–V6',            dias: 25,  kc: 0.70, stress: 0.5, isCritico: false, color: '#3DAB7A' },
        { nombre: 'V6–R1 (Floración)',dias: 28,  kc: 1.00, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'R1–R3 (Llenado)',  dias: 25,  kc: 1.15, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'R3–R5',            dias: 22,  kc: 1.10, stress: 0.9, isCritico: true,  color: '#C94A2A' },
        { nombre: 'R5–R7 (Madurez)', dias: 25,  kc: 0.70, stress: 0.4, isCritico: false, color: '#8B6F47' },
      ],
    },
    maiz: {
      corto: [
        { nombre: 'Emergencia–V3',    dias: 15,  kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V3–V8',            dias: 25,  kc: 0.80, stress: 0.5, isCritico: false, color: '#3DAB7A' },
        { nombre: 'V8–VT (Preflorac)',dias: 20,  kc: 1.15, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'VT–R2 (Espigado)', dias: 12,  kc: 1.20, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'R2–R4 (Llenado)',  dias: 30,  kc: 1.10, stress: 0.9, isCritico: true,  color: '#C94A2A' },
        { nombre: 'R4–R6 (Madurez)', dias: 28,  kc: 0.60, stress: 0.3, isCritico: false, color: '#8B6F47' },
      ],
      largo: [
        { nombre: 'Emergencia–V3',    dias: 18,  kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V3–V8',            dias: 30,  kc: 0.80, stress: 0.5, isCritico: false, color: '#3DAB7A' },
        { nombre: 'V8–VT (Preflorac)',dias: 25,  kc: 1.15, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'VT–R2 (Espigado)', dias: 15,  kc: 1.20, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'R2–R4 (Llenado)',  dias: 35,  kc: 1.10, stress: 0.9, isCritico: true,  color: '#C94A2A' },
        { nombre: 'R4–R6 (Madurez)', dias: 32,  kc: 0.60, stress: 0.3, isCritico: false, color: '#8B6F47' },
      ],
    },
    trigo: {
      corto: [
        { nombre: 'Siembra–Macollaje', dias: 30,  kc: 0.40, stress: 0.4, isCritico: false, color: '#2A5A8C' },
        { nombre: 'Macollaje–Encañ.',  dias: 35,  kc: 0.80, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'Encañ.–Espigado',  dias: 20,  kc: 1.10, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'Floración–Llenado',dias: 20,  kc: 1.15, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'Llenado–Madurez',  dias: 30,  kc: 0.65, stress: 0.5, isCritico: false, color: '#C94A2A' },
      ],
      largo: [
        { nombre: 'Siembra–Macollaje', dias: 40,  kc: 0.40, stress: 0.4, isCritico: false, color: '#2A5A8C' },
        { nombre: 'Macollaje–Encañ.',  dias: 45,  kc: 0.80, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'Encañ.–Espigado',  dias: 25,  kc: 1.10, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'Floración–Llenado',dias: 25,  kc: 1.15, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'Llenado–Madurez',  dias: 35,  kc: 0.65, stress: 0.5, isCritico: false, color: '#C94A2A' },
      ],
    },
    girasol: {
      corto: [
        { nombre: 'Emergencia–V4',    dias: 20,  kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V4–R1 (Botón)',    dias: 30,  kc: 0.85, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'R1–R3 (Floración)',dias: 20,  kc: 1.10, stress: 1.0, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'R3–R6 (Llenado)', dias: 30,  kc: 1.05, stress: 0.9, isCritico: true,  color: '#C8A255' },
        { nombre: 'R6–R9 (Madurez)', dias: 25,  kc: 0.60, stress: 0.3, isCritico: false, color: '#C94A2A' },
      ],
      largo: [
        { nombre: 'Emergencia–V4',    dias: 25,  kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V4–R1 (Botón)',    dias: 35,  kc: 0.85, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'R1–R3 (Floración)',dias: 25,  kc: 1.10, stress: 1.0, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'R3–R6 (Llenado)', dias: 35,  kc: 1.05, stress: 0.9, isCritico: true,  color: '#C8A255' },
        { nombre: 'R6–R9 (Madurez)', dias: 30,  kc: 0.60, stress: 0.3, isCritico: false, color: '#C94A2A' },
      ],
    },
    sorgo: {
      corto: [
        { nombre: 'Emergencia–V3',    dias: 15,  kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V3–Panícola',      dias: 35,  kc: 0.90, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'Floración',        dias: 20,  kc: 1.10, stress: 1.0, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'Llenado de grano', dias: 30,  kc: 1.00, stress: 0.9, isCritico: true,  color: '#C8A255' },
        { nombre: 'Madurez',          dias: 25,  kc: 0.55, stress: 0.3, isCritico: false, color: '#C94A2A' },
      ],
      largo: [
        { nombre: 'Emergencia–V3',    dias: 18,  kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V3–Panícola',      dias: 42,  kc: 0.90, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'Floración',        dias: 25,  kc: 1.10, stress: 1.0, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'Llenado de grano', dias: 35,  kc: 1.00, stress: 0.9, isCritico: true,  color: '#C8A255' },
        { nombre: 'Madurez',          dias: 30,  kc: 0.55, stress: 0.3, isCritico: false, color: '#C94A2A' },
      ],
    },
  };

  // ── NASA POWER months ─────────────────────────────────
  var NASA_MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  // ── ET₀ Hargreaves-Samani (replicado de siembra-apis.js) ──
  function calcET0(rs, tx, tn) {
    if (rs == null || tx == null || tn == null) return null;
    var ra = rs * 3.6;
    var tm = (tx + tn) / 2;
    var td = tx - tn;
    if (td <= 0) return null;
    return 0.0023 * ra * (tm + 17.8) * Math.sqrt(td);
  }

  // ── Día del año → mes (0-indexed) ─────────────────────
  function dayToMonth(dayOfYear) {
    var days = [31,28,31,30,31,30,31,31,30,31,30,31];
    var m = 0, acc = 0;
    while (m < 12 && acc + days[m] <= dayOfYear) { acc += days[m]; m++; }
    return m; // 0-indexed
  }

  // ── Construir estadios con fechas absolutas ───────────
  function computeStages(cultivo, ciclo, fechaSiembra) {
    var key = cultivo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    var cultData = FENOLOGIA[key];
    if (!cultData) key = 'soja', cultData = FENOLOGIA.soja;
    var estadios = cultData[ciclo] || cultData.corto;
    var base = new Date(fechaSiembra + 'T00:00:00');
    var cursor = 0;
    return estadios.map(function(e, i) {
      var desde = cursor;
      cursor += e.dias;
      var hasta = cursor;
      var dStart = new Date(base); dStart.setDate(dStart.getDate() + desde);
      var dEnd   = new Date(base); dEnd.setDate(dEnd.getDate() + hasta);
      return {
        nombre:    e.nombre,
        desde:     desde,
        hasta:     hasta,
        dias:      e.dias,
        kc:        e.kc,
        stress:    e.stress,
        isCritico: e.isCritico,
        color:     e.color,
        dStart:    dStart,
        dEnd:      dEnd,
        idx:       i,
      };
    });
  }

  // ── Precipitación acumulada en un estadio ─────────────
  function precipPerStage(dStart, dEnd, props, ensoFactor) {
    var total = 0;
    var d = new Date(dStart);
    while (d < dEnd) {
      var doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
      var m   = dayToMonth(doy - 1);
      var rain = (props['PRECTOTCORR'] || {})[NASA_MONTHS[m]] || 0;
      total += (rain * 30.4) * ensoFactor / 30; // mm/day × días promedio del mes
      d.setDate(d.getDate() + 1);
    }
    return Math.round(total);
  }

  // ── ETc acumulada en un estadio ───────────────────────
  function etcPerStage(dStart, dEnd, kc, props) {
    var total = 0;
    var d = new Date(dStart);
    while (d < dEnd) {
      var doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
      var m   = dayToMonth(doy - 1);
      var rs  = (props['ALLSKY_SFC_SW_DWN'] || {})[NASA_MONTHS[m]] || 15;
      var tx  = (props['T2M_MAX'] || {})[NASA_MONTHS[m]] || 28;
      var tn  = (props['T2M_MIN'] || {})[NASA_MONTHS[m]] || 14;
      var et0 = calcET0(rs, tx, tn);
      if (et0 !== null) total += et0 * kc;
      d.setDate(d.getDate() + 1);
    }
    return Math.round(total);
  }

  // ── Clasificar riesgo hídrico ─────────────────────────
  function clasificarRiesgo(precip, etc, stress) {
    var ratio = etc > 0 ? precip / etc : 1;
    var deficit = etc - precip;
    if (ratio >= 0.90)               return { label: 'Óptimo',   css: 'fen-ok',   icon: '✅' };
    if (ratio >= 0.70 && stress < 0.8) return { label: 'Aceptable',css: 'fen-warn', icon: '⚠️' };
    if (ratio >= 0.70)               return { label: 'Moderado', css: 'fen-warn',  icon: '⚠️' };
    if (deficit > 80 && stress >= 0.9) return { label: 'Crítico', css: 'fen-crit', icon: '🔴' };
    return { label: 'Deficiente', css: 'fen-crit', icon: '🔴' };
  }

  // ── Factor ENSO ───────────────────────────────────────
  function ensoFactor() {
    var fase = (window.ENSO_DATA && window.ENSO_DATA.fase) ? window.ENSO_DATA.fase : 'neutro';
    if (fase === 'nino') return 1.15;
    if (fase === 'nina') return 0.85;
    return 1.0;
  }

  // ── Certeza estimada (CV climatológico aproximado) ────
  function certezaLabel(ensoFase) {
    if (ensoFase === 'nino' || ensoFase === 'nina') return '~65 %';
    return '~75 %';
  }

  // ── Gráfico Chart.js ──────────────────────────────────
  function buildChart(stages, ef) {
    var canvas = document.getElementById('fen-chart');
    if (!canvas) return;

    if (fenChart) { fenChart.destroy(); fenChart = null; }

    var labels  = stages.map(function(s) { return s.nombre; });
    var precips = stages.map(function(s) { return s.precip; });
    var etcs    = stages.map(function(s) { return s.etc; });
    var ninoP   = stages.map(function(s) { return Math.round(s.precip * 1.15 / (ef || 1)); });
    var ninaP   = stages.map(function(s) { return Math.round(s.precip * 0.85 / (ef || 1)); });

    fenChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Niño (+15%)',
            data: ninoP,
            type: 'line',
            borderColor: 'rgba(200,162,85,0.55)',
            backgroundColor: 'rgba(200,162,85,0.12)',
            borderDash: [4,3],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: '+1',
            tension: 0.3,
            order: 0,
          },
          {
            label: 'Niña (-15%)',
            data: ninaP,
            type: 'line',
            borderColor: 'rgba(42,90,140,0.55)',
            backgroundColor: 'rgba(42,90,140,0.0)',
            borderDash: [4,3],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            tension: 0.3,
            order: 0,
          },
          {
            label: 'Precipitación climatológica (mm)',
            data: precips,
            backgroundColor: stages.map(function(s) {
              return s.isCritico ? 'rgba(109,191,130,0.85)' : 'rgba(109,191,130,0.45)';
            }),
            borderColor: 'rgba(109,191,130,0.9)',
            borderWidth: 1,
            borderRadius: 4,
            order: 1,
          },
          {
            label: 'ETc requerida (mm)',
            data: etcs,
            type: 'line',
            borderColor: '#D4522A',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointBackgroundColor: '#D4522A',
            pointRadius: 5,
            tension: 0.3,
            order: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: 'rgba(237,224,196,.75)', font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + ' mm';
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: 'rgba(237,224,196,.65)', font: { size: 10 }, maxRotation: 30 },
            grid:  { color: 'rgba(237,224,196,.07)' },
          },
          y: {
            ticks: { color: 'rgba(237,224,196,.65)', font: { size: 11 } },
            grid:  { color: 'rgba(237,224,196,.07)' },
            title: { display: true, text: 'mm', color: 'rgba(237,224,196,.5)', font: { size: 11 } },
          },
        },
      },
    });
  }

  // ── Tabla resumen ─────────────────────────────────────
  function buildTable(stages) {
    var rows = stages.map(function(s) {
      var riesgo = s.riesgo;
      return '<tr class="' + (s.isCritico ? 'fen-row-crit' : '') + '">' +
        '<td><span class="fen-dot-color" style="background:' + s.color + '"></span>' + s.nombre + '</td>' +
        '<td>' + s.dias + ' d</td>' +
        '<td>' + s.precip + ' mm</td>' +
        '<td>' + s.etc + ' mm</td>' +
        '<td><span class="fen-badge ' + riesgo.css + '">' + riesgo.icon + ' ' + riesgo.label + '</span></td>' +
      '</tr>';
    }).join('');

    return '<table class="fen-table">' +
      '<thead><tr>' +
      '<th>Estadio</th><th>Duración</th><th>Precip.</th><th>ETc</th><th>Riesgo</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  // ── Render principal ──────────────────────────────────
  function renderResultado(stages, ef, ensoFase, lat, lon) {
    var critCount = stages.filter(function(s) { return s.riesgo.css === 'fen-crit'; }).length;
    var alertBanner = '';
    if (critCount > 0) {
      alertBanner = '<div class="fen-alert-banner">⚠️ ' + critCount +
        ' estadio' + (critCount > 1 ? 's' : '') +
        ' con déficit hídrico crítico — considerá riego suplementario o ajuste de fecha de siembra</div>';
    }

    var ensoLabel = ensoFase === 'nino' ? '🌊 El Niño (+15% lluvia)' :
                    ensoFase === 'nina' ? '❄️ La Niña (−15% lluvia)' : '🌐 Fase Neutra';

    var certeza = certezaLabel(ensoFase);
    var totalPrec = stages.reduce(function(a, s) { return a + s.precip; }, 0);
    var totalEtc  = stages.reduce(function(a, s) { return a + s.etc;    }, 0);
    var balance   = totalPrec - totalEtc;

    var balClass = balance >= 0 ? 'fen-ok' : (balance > -80 ? 'fen-warn' : 'fen-crit');
    var durTotal  = stages.reduce(function(a, s) { return a + s.dias; }, 0);

    var html = '<div class="fen-result">' +
      '<div class="fen-result-header">' +
        '<div class="fen-kpi-grid">' +
          '<div class="fen-kpi"><span class="fen-kpi-val">' + totalPrec + ' mm</span><span class="fen-kpi-lbl">Lluvia total campaña</span></div>' +
          '<div class="fen-kpi"><span class="fen-kpi-val">' + totalEtc  + ' mm</span><span class="fen-kpi-lbl">ETc total campaña</span></div>' +
          '<div class="fen-kpi"><span class="fen-kpi-val ' + balClass + '">' + (balance >= 0 ? '+' : '') + balance + ' mm</span><span class="fen-kpi-lbl">Balance hídrico</span></div>' +
          '<div class="fen-kpi"><span class="fen-kpi-val">' + durTotal + ' d</span><span class="fen-kpi-lbl">Duración campaña</span></div>' +
          '<div class="fen-kpi"><span class="fen-kpi-val fen-enso">' + ensoLabel + '</span><span class="fen-kpi-lbl">Certeza ~' + certeza + '</span></div>' +
        '</div>' +
      '</div>' +
      alertBanner +
      '<div class="fen-chart-wrap"><canvas id="fen-chart"></canvas></div>' +
      buildTable(stages) +
      '<div class="fen-nota">Datos climatológicos NASA POWER (1984–presente) · ET₀ Hargreaves-Samani · Kc FAO-56 · ENSO NOAA · Lat ' + lat + ' Lon ' + lon + '</div>' +
    '</div>';

    document.getElementById('fen-output').innerHTML = html;
    buildChart(stages, ef);
  }

  // ── Función principal de análisis ─────────────────────
  function fenAnalizar() {
    var lat  = parseFloat((document.getElementById('fen-lat')  || {}).value);
    var lon  = parseFloat((document.getElementById('fen-lon')  || {}).value);
    var cult = (document.getElementById('fen-cultivo') || {}).value || 'soja';
    var ciclo= (document.getElementById('fen-ciclo')   || {}).value || 'corto';
    var fecha= (document.getElementById('fen-fecha')   || {}).value || '';

    if (!lat || !lon || !fecha) {
      document.getElementById('fen-output').innerHTML =
        '<div class="fen-placeholder"><div class="fen-ph-icon">📅</div>' +
        '<div class="fen-ph-text">Completá latitud, longitud y fecha de siembra para analizar.</div></div>';
      return;
    }

    document.getElementById('fen-btn').disabled = true;
    document.getElementById('fen-output').innerHTML =
      '<div class="fen-loading"><div class="fen-spinner">⟳</div><div>Consultando NASA POWER...</div></div>';

    var cacheKey = lat.toFixed(3) + ',' + lon.toFixed(3);

    function _run(props) {
      var ef     = ensoFactor();
      var ensoFase = (window.ENSO_DATA && window.ENSO_DATA.fase) ? window.ENSO_DATA.fase : 'neutro';
      var stages = computeStages(cult, ciclo, fecha);

      stages.forEach(function(s) {
        s.precip = precipPerStage(s.dStart, s.dEnd, props, ef);
        s.etc    = etcPerStage(s.dStart, s.dEnd, s.kc, props);
        s.riesgo = clasificarRiesgo(s.precip, s.etc, s.stress);
      });

      renderResultado(stages, ef, ensoFase, lat.toFixed(3), lon.toFixed(3));
      document.getElementById('fen-btn').disabled = false;
    }

    if (nasaCache[cacheKey]) {
      _run(nasaCache[cacheKey]);
      return;
    }

    if (typeof window.buscarNASAPower !== 'function') {
      document.getElementById('fen-output').innerHTML =
        '<div class="fen-placeholder"><div class="fen-ph-icon">⚠️</div>' +
        '<div class="fen-ph-text">Error: siembra-apis.js no cargado correctamente.</div></div>';
      document.getElementById('fen-btn').disabled = false;
      return;
    }

    window.buscarNASAPower(lat, lon).then(function(props) {
      nasaCache[cacheKey] = props;
      _run(props);
    }).catch(function(err) {
      document.getElementById('fen-output').innerHTML =
        '<div class="fen-placeholder"><div class="fen-ph-icon">⚠️</div>' +
        '<div class="fen-ph-text">No se pudo obtener datos climáticos de NASA POWER. Verificá tu conexión e intentá nuevamente.</div></div>';
      document.getElementById('fen-btn').disabled = false;
    });
  }

  // ── Construir UI ──────────────────────────────────────
  function buildUI() {
    var body = document.getElementById('fenologia-body');
    if (!body) return;

    var coordVal = '';
    var latVal = '', lonVal = '';
    var coord = document.getElementById('s-coord');
    if (coord && coord.value) {
      var parts = coord.value.split(',');
      if (parts.length === 2) {
        latVal = parts[0].trim();
        lonVal = parts[1].trim();
        coordVal = coord.value.trim();
      }
    }

    body.innerHTML =
      '<div class="module-title">Fenología <em>e Hídrico</em></div>' +
      '<div class="module-subtitle">Distribución de lluvias × estadios fenológicos · Balance hídrico por etapa · Ajuste ENSO · NASA POWER</div>' +

      '<div class="fen-input-bar">' +
        '<div class="fen-fg">' +
          '<label>Latitud</label>' +
          '<input type="number" id="fen-lat" placeholder="-33.0000" step="0.0001" value="' + latVal + '">' +
        '</div>' +
        '<div class="fen-fg">' +
          '<label>Longitud</label>' +
          '<input type="number" id="fen-lon" placeholder="-63.0000" step="0.0001" value="' + lonVal + '">' +
        '</div>' +
        '<div class="fen-fg">' +
          '<label>Cultivo</label>' +
          '<select id="fen-cultivo">' +
            '<option value="soja">Soja</option>' +
            '<option value="maiz">Maíz</option>' +
            '<option value="trigo">Trigo</option>' +
            '<option value="girasol">Girasol</option>' +
            '<option value="sorgo">Sorgo</option>' +
          '</select>' +
        '</div>' +
        '<div class="fen-fg">' +
          '<label>Ciclo</label>' +
          '<select id="fen-ciclo">' +
            '<option value="corto">Corto</option>' +
            '<option value="largo">Largo</option>' +
          '</select>' +
        '</div>' +
        '<div class="fen-fg">' +
          '<label>Fecha de siembra</label>' +
          '<input type="date" id="fen-fecha">' +
        '</div>' +
        '<button class="fen-btn-analizar" id="fen-btn" onclick="fenAnalizar()">📅 Analizar</button>' +
      '</div>' +

      '<div id="fen-output">' +
        '<div class="fen-placeholder">' +
          '<div class="fen-ph-icon">📅</div>' +
          '<div class="fen-ph-text">Los campos se completan automáticamente desde el módulo de Siembra.<br>' +
          'Revisá los datos y hacé clic en <strong>Analizar</strong> para ver la distribución hídrica por estadio.</div>' +
        '</div>' +
      '</div>';

    // Sincronizar cultivo y fecha desde módulo siembra
    var selCult = document.getElementById('fen-cultivo');
    var selFecha = document.getElementById('fen-fecha');
    var sCult = document.getElementById('s-cultivo');
    var sFecha = document.getElementById('s-fecha');

    if (selCult && sCult && sCult.value) {
      var cNorm = sCult.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      selCult.value = cNorm;
    }
    if (selFecha && sFecha && sFecha.value) {
      selFecha.value = sFecha.value;
    }
  }

  // ── Init (llamado por nav.js al activar el módulo) ────
  var _fenInitDone = false;
  function fenInit() {
    if (_fenInitDone) return;
    _fenInitDone = true;
    buildUI();
  }

  // Exportar
  window.fenInit     = fenInit;
  window.fenAnalizar = fenAnalizar;

})();
