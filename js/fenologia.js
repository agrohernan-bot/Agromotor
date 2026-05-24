// ════════════════════════════════════════════════════════
// AGROMOTOR — fenologia.js
// Curva de lluvias × estadios fenológicos + balance hídrico
// NASA POWER climatology · ENSO adjustment · Chart.js 4
// Lee lote/coord/cultivo desde los campos master del módulo siembra
// ════════════════════════════════════════════════════════

(function () {
  window.AM = window.AM || {};
  window.AM.fenologia = {};

  // ── Estado interno ────────────────────────────────────
  var nasaCache = {};   // { 'lat,lon': props }
  var fenChart  = null;
  var _fenBuilt = false;

  // ── Tabla fenológica ──────────────────────────────────
  // { cultivo: { ciclo: [ {nombre, dias, kc, stress, isCritico, color} ] } }
  var FENOLOGIA = {
    soja: {
      corto: [
        { nombre: 'Emergencia–V3',     dias: 18, kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V3–V6',             dias: 20, kc: 0.70, stress: 0.5, isCritico: false, color: '#3DAB7A' },
        { nombre: 'V6–R1 (Floración)', dias: 22, kc: 1.00, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'R1–R3 (Llenado)',   dias: 20, kc: 1.15, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'R3–R5',             dias: 18, kc: 1.10, stress: 0.9, isCritico: true,  color: '#C94A2A' },
        { nombre: 'R5–R7 (Madurez)',   dias: 20, kc: 0.70, stress: 0.4, isCritico: false, color: '#8B6F47' },
      ],
      largo: [
        { nombre: 'Emergencia–V3',     dias: 20, kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V3–V6',             dias: 25, kc: 0.70, stress: 0.5, isCritico: false, color: '#3DAB7A' },
        { nombre: 'V6–R1 (Floración)', dias: 28, kc: 1.00, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'R1–R3 (Llenado)',   dias: 25, kc: 1.15, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'R3–R5',             dias: 22, kc: 1.10, stress: 0.9, isCritico: true,  color: '#C94A2A' },
        { nombre: 'R5–R7 (Madurez)',   dias: 25, kc: 0.70, stress: 0.4, isCritico: false, color: '#8B6F47' },
      ],
    },
    maiz: {
      corto: [
        { nombre: 'Emergencia–V3',     dias: 15, kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V3–V8',             dias: 25, kc: 0.80, stress: 0.5, isCritico: false, color: '#3DAB7A' },
        { nombre: 'V8–VT (Preflorac)', dias: 20, kc: 1.15, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'VT–R2 (Espigado)',  dias: 12, kc: 1.20, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'R2–R4 (Llenado)',   dias: 30, kc: 1.10, stress: 0.9, isCritico: true,  color: '#C94A2A' },
        { nombre: 'R4–R6 (Madurez)',   dias: 28, kc: 0.60, stress: 0.3, isCritico: false, color: '#8B6F47' },
      ],
      largo: [
        { nombre: 'Emergencia–V3',     dias: 18, kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V3–V8',             dias: 30, kc: 0.80, stress: 0.5, isCritico: false, color: '#3DAB7A' },
        { nombre: 'V8–VT (Preflorac)', dias: 25, kc: 1.15, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'VT–R2 (Espigado)',  dias: 15, kc: 1.20, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'R2–R4 (Llenado)',   dias: 35, kc: 1.10, stress: 0.9, isCritico: true,  color: '#C94A2A' },
        { nombre: 'R4–R6 (Madurez)',   dias: 32, kc: 0.60, stress: 0.3, isCritico: false, color: '#8B6F47' },
      ],
    },
    trigo: {
      corto: [
        { nombre: 'Siembra–Macollaje', dias: 30, kc: 0.40, stress: 0.4, isCritico: false, color: '#2A5A8C' },
        { nombre: 'Macollaje–Encañ.',  dias: 35, kc: 0.80, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'Encañ.–Espigado',   dias: 20, kc: 1.10, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'Floración–Llenado', dias: 20, kc: 1.15, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'Llenado–Madurez',   dias: 30, kc: 0.65, stress: 0.5, isCritico: false, color: '#C94A2A' },
      ],
      largo: [
        { nombre: 'Siembra–Macollaje', dias: 40, kc: 0.40, stress: 0.4, isCritico: false, color: '#2A5A8C' },
        { nombre: 'Macollaje–Encañ.',  dias: 45, kc: 0.80, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'Encañ.–Espigado',   dias: 25, kc: 1.10, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'Floración–Llenado', dias: 25, kc: 1.15, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'Llenado–Madurez',   dias: 35, kc: 0.65, stress: 0.5, isCritico: false, color: '#C94A2A' },
      ],
    },
    girasol: {
      corto: [
        { nombre: 'Emergencia–V4',     dias: 20, kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V4–R1 (Botón)',     dias: 30, kc: 0.85, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'R1–R3 (Floración)', dias: 20, kc: 1.10, stress: 1.0, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'R3–R6 (Llenado)',   dias: 30, kc: 1.05, stress: 0.9, isCritico: true,  color: '#C8A255' },
        { nombre: 'R6–R9 (Madurez)',   dias: 25, kc: 0.60, stress: 0.3, isCritico: false, color: '#C94A2A' },
      ],
      largo: [
        { nombre: 'Emergencia–V4',     dias: 25, kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V4–R1 (Botón)',     dias: 35, kc: 0.85, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'R1–R3 (Floración)', dias: 25, kc: 1.10, stress: 1.0, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'R3–R6 (Llenado)',   dias: 35, kc: 1.05, stress: 0.9, isCritico: true,  color: '#C8A255' },
        { nombre: 'R6–R9 (Madurez)',   dias: 30, kc: 0.60, stress: 0.3, isCritico: false, color: '#C94A2A' },
      ],
    },
    sorgo: {
      corto: [
        { nombre: 'Emergencia–V3',     dias: 15, kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V3–Panícola',       dias: 35, kc: 0.90, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'Floración',         dias: 20, kc: 1.10, stress: 1.0, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'Llenado de grano',  dias: 30, kc: 1.00, stress: 0.9, isCritico: true,  color: '#C8A255' },
        { nombre: 'Madurez',           dias: 25, kc: 0.55, stress: 0.3, isCritico: false, color: '#C94A2A' },
      ],
      largo: [
        { nombre: 'Emergencia–V3',     dias: 18, kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'V3–Panícola',       dias: 42, kc: 0.90, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'Floración',         dias: 25, kc: 1.10, stress: 1.0, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'Llenado de grano',  dias: 35, kc: 1.00, stress: 0.9, isCritico: true,  color: '#C8A255' },
        { nombre: 'Madurez',           dias: 30, kc: 0.55, stress: 0.3, isCritico: false, color: '#C94A2A' },
      ],
    },
    cebada: {
      corto: [
        { nombre: 'Siembra–Macollaje', dias: 30, kc: 0.40, stress: 0.4, isCritico: false, color: '#2A5A8C' },
        { nombre: 'Macollaje–Encañ.',  dias: 30, kc: 0.75, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'Encañ.–Espigado',   dias: 18, kc: 1.05, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'Floración–Llenado', dias: 18, kc: 1.10, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'Llenado–Madurez',   dias: 28, kc: 0.60, stress: 0.4, isCritico: false, color: '#C94A2A' },
      ],
      largo: [
        { nombre: 'Siembra–Macollaje', dias: 38, kc: 0.40, stress: 0.4, isCritico: false, color: '#2A5A8C' },
        { nombre: 'Macollaje–Encañ.',  dias: 40, kc: 0.75, stress: 0.6, isCritico: false, color: '#3DAB7A' },
        { nombre: 'Encañ.–Espigado',   dias: 22, kc: 1.05, stress: 0.9, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'Floración–Llenado', dias: 22, kc: 1.10, stress: 1.0, isCritico: true,  color: '#C8A255' },
        { nombre: 'Llenado–Madurez',   dias: 32, kc: 0.60, stress: 0.4, isCritico: false, color: '#C94A2A' },
      ],
    },
    colza: {
      corto: [
        { nombre: 'Siembra–Roseta',    dias: 35, kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'Roseta–Tallo',      dias: 30, kc: 0.70, stress: 0.5, isCritico: false, color: '#3DAB7A' },
        { nombre: 'Floración',         dias: 25, kc: 1.10, stress: 1.0, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'Llenado–Madurez',   dias: 40, kc: 0.80, stress: 0.6, isCritico: true,  color: '#C8A255' },
      ],
      largo: [
        { nombre: 'Siembra–Roseta',    dias: 45, kc: 0.40, stress: 0.3, isCritico: false, color: '#2A5A8C' },
        { nombre: 'Roseta–Tallo',      dias: 38, kc: 0.70, stress: 0.5, isCritico: false, color: '#3DAB7A' },
        { nombre: 'Floración',         dias: 30, kc: 1.10, stress: 1.0, isCritico: true,  color: '#1E4D2B' },
        { nombre: 'Llenado–Madurez',   dias: 50, kc: 0.80, stress: 0.6, isCritico: true,  color: '#C8A255' },
      ],
    },
  };

  // ── NASA POWER months ─────────────────────────────────
  var NASA_MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  // ── ET₀ Hargreaves-Samani ────────────────────────────────
  function calcET0(rs, tx, tn) {
    if (rs == null || tx == null || tn == null) return null;
    var tm = (tx + tn) / 2;
    var td = tx - tn;
    if (td <= 0) return null;
    // rs en MJ/m²/día (NASA POWER ALLSKY_SFC_SW_DWN ya viene en MJ, NO kWh)
    // Factor 0.60: calibración regional para Argentina semiárida (Hargreaves-Samani sobreestima vs Penman-Monteith)
    var et0 = 0.0023 * rs * (tm + 17.8) * Math.sqrt(td);
    return et0 * 0.60;
  }

  // ── Día del año → mes (0-indexed) ─────────────────────
  function dayToMonth(dayOfYear) {
    var days = [31,28,31,30,31,30,31,31,30,31,30,31];
    var m = 0, acc = 0;
    while (m < 12 && acc + days[m] <= dayOfYear) { acc += days[m]; m++; }
    return m;
  }

  // ── Construir estadios con fechas absolutas ───────────
  function computeStages(cultivo, ciclo, fechaSiembra) {
    var key = cultivo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (key === 'maiz') key = 'maiz';
    var cultData = FENOLOGIA[key] || FENOLOGIA.soja;
    var estadios = cultData[ciclo] || cultData.corto;
    var base = new Date(fechaSiembra + 'T00:00:00');
    var cursor = 0;
    return estadios.map(function(e) {
      var desde = cursor;
      cursor += e.dias;
      var dStart = new Date(base); dStart.setDate(dStart.getDate() + desde);
      var dEnd   = new Date(base); dEnd.setDate(dEnd.getDate() + cursor);
      return {
        nombre:    e.nombre,
        desde:     desde,
        hasta:     cursor,
        dias:      e.dias,
        kc:        e.kc,
        stress:    e.stress,
        isCritico: e.isCritico,
        color:     e.color,
        dStart:    dStart,
        dEnd:      dEnd,
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
      total += (rain * 30.4) * ensoFactor / 30;
      d.setDate(d.getDate() + 1);
    }
    return Math.round(total);
  }

  // ── ETc + evaporación de suelo por estadio ───────────
  // Devuelve { etc, evap, et0total }
  // Ke = max(0, 0.5 - Kc) → simplificación FAO-56 para estadios con
  //   cobertura baja (germinación, madurez); en estadios con Kc ≥ 0.5
  //   se asume que el canopeo suprime la evaporación directa.
  function etcAndEvapPerStage(dStart, dEnd, kc, props) {
    console.log('[ETc debug] dStart:', dStart, 'dEnd:', dEnd, 'kc:', kc);
    var totalEtc = 0, totalEt0 = 0;
    var d = new Date(dStart);
    while (d < dEnd) {
      var doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
      var m   = dayToMonth(doy - 1);
      var rs  = (props['ALLSKY_SFC_SW_DWN'] || {})[NASA_MONTHS[m]] || 5;   // MJ/m²/d
      var tx  = (props['T2M_MAX'] || {})[NASA_MONTHS[m]] || 28;
      var tn  = (props['T2M_MIN'] || {})[NASA_MONTHS[m]] || 14;
      var et0 = calcET0(rs, tx, tn);
      if (d.getDate() === 1) {
        var _tm = (tx + tn) / 2, _td = tx - tn;
        var _et0bruto = (_td > 0) ? 0.0023 * rs * (_tm + 17.8) * Math.sqrt(_td) : null;
        console.log('[ETc día1] mes:', NASA_MONTHS[m],
          'rs:', rs, 'Tmax:', tx, 'Tmin:', tn,
          'ET0_bruto:', _et0bruto != null ? _et0bruto.toFixed(3) : null,
          'ET0_cal(×0.60):', et0 != null ? et0.toFixed(3) : null,
          'ETc_día:', et0 != null ? (et0 * kc).toFixed(3) : null);
      }
      if (et0 !== null) { totalEtc += et0 * kc; totalEt0 += et0; }
      d.setDate(d.getDate() + 1);
    }
    var ke   = Math.max(0, 0.5 - kc);
    return {
      etc:     Math.round(totalEtc),
      evap:    Math.round(ke * totalEt0),
      et0total: Math.round(totalEt0),
    };
  }

  // ── Clasificar riesgo hídrico ─────────────────────────
  function clasificarRiesgo(precip, etc, stress) {
    var ratio = etc > 0 ? precip / etc : 1;
    var deficit = etc - precip;
    if (ratio >= 0.90)                       return { label: 'Óptimo',    css: 'fen-ok',   icon: '✅' };
    if (ratio >= 0.70 && stress < 0.8)       return { label: 'Aceptable', css: 'fen-warn', icon: '⚠️' };
    if (ratio >= 0.70)                       return { label: 'Moderado',  css: 'fen-warn', icon: '⚠️' };
    if (deficit > 80 && stress >= 0.9)       return { label: 'Crítico',   css: 'fen-crit', icon: '🔴' };
    return { label: 'Deficiente', css: 'fen-crit', icon: '🔴' };
  }

  // ── Factor y fase ENSO ────────────────────────────────
  function getENSO() {
    var fase = (window.ENSO_DATA && window.ENSO_DATA.fase) ? window.ENSO_DATA.fase : 'neutro';
    var factor = fase === 'nino' ? 1.15 : fase === 'nina' ? 0.85 : 1.0;
    return { fase: fase, factor: factor };
  }

  // ── Certeza estimada ──────────────────────────────────
  function certezaLabel(ensoFase) {
    return (ensoFase === 'nino' || ensoFase === 'nina') ? '~65%' : '~75%';
  }

  // ── Gráfico Chart.js 4 ────────────────────────────────
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
            label: 'Niña (−15%)',
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
      var r   = s.riesgo;
      var bal = s.balance;
      var balCss = bal >= 0 ? 'fen-bal-ok' : (bal > -40 ? 'fen-bal-warn' : 'fen-bal-crit');
      return '<tr class="' + (s.isCritico ? 'fen-row-crit' : '') + '">' +
        '<td><span class="fen-dot-color" style="background:' + s.color + '"></span>' + s.nombre + '</td>' +
        '<td class="fen-num">' + s.dias + ' d</td>' +
        '<td class="fen-num">' + s.precip + '</td>' +
        '<td class="fen-num">' + s.etc   + '</td>' +
        '<td class="fen-num">' + (s.evap > 0 ? s.evap : '—') + '</td>' +
        '<td class="fen-num ' + balCss + '">' + (bal >= 0 ? '+' : '') + bal + '</td>' +
        '<td><span class="fen-badge ' + r.css + '">' + r.icon + ' ' + r.label + '</span></td>' +
      '</tr>';
    }).join('');
    return '<table class="fen-table">' +
      '<thead><tr>' +
        '<th>Estadio</th><th>Días</th><th>Precip. mm</th>' +
        '<th>ETc mm</th><th>Evap. suelo</th><th>Balance mm</th><th>Riesgo</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }

  // ── Render principal ──────────────────────────────────
  function renderResultado(stages, ef, ensoFase, lat, lon, cultRaw, aguaPerfil) {
    var critCount = stages.filter(function(s) { return s.riesgo.css === 'fen-crit'; }).length;
    var alertBanner = critCount > 0
      ? '<div class="fen-alert-banner">⚠️ ' + critCount + ' estadio' + (critCount > 1 ? 's' : '') +
        ' con déficit hídrico crítico — considerá riego suplementario o ajuste de fecha de siembra</div>'
      : '';

    var ensoLabel = ensoFase === 'nino' ? '🌊 El Niño (+15%)' :
                    ensoFase === 'nina' ? '❄️ La Niña (−15%)' : '🌐 Fase Neutra';

    var totalPrec = stages.reduce(function(a, s) { return a + s.precip; }, 0);
    var totalEtc  = stages.reduce(function(a, s) { return a + s.etc;   }, 0);
    var totalEvap = stages.reduce(function(a, s) { return a + s.evap;  }, 0);
    var balance   = totalPrec + aguaPerfil - totalEtc - totalEvap;
    var durTotal  = stages.reduce(function(a, s) { return a + s.dias;  }, 0);
    var balClass  = balance >= 0 ? 'fen-ok' : (balance > -80 ? 'fen-warn' : 'fen-crit');

    document.getElementById('fen-output').innerHTML =
      '<div class="fen-result">' +
        '<div class="fen-result-header">' +
          '<div class="fen-kpi-grid">' +
            '<div class="fen-kpi"><span class="fen-kpi-val">' + totalPrec + ' mm</span><span class="fen-kpi-lbl">Lluvia campaña</span></div>' +
            '<div class="fen-kpi"><span class="fen-kpi-val">' + aguaPerfil + ' mm</span><span class="fen-kpi-lbl">Agua perfil inicial</span></div>' +
            '<div class="fen-kpi"><span class="fen-kpi-val">' + totalEtc  + ' mm</span><span class="fen-kpi-lbl">ETc total</span></div>' +
            '<div class="fen-kpi"><span class="fen-kpi-val">' + totalEvap + ' mm</span><span class="fen-kpi-lbl">Evap. suelo</span></div>' +
            '<div class="fen-kpi"><span class="fen-kpi-val ' + balClass + '">' + (balance >= 0 ? '+' : '') + balance + ' mm</span><span class="fen-kpi-lbl">Balance hídrico</span></div>' +
            '<div class="fen-kpi"><span class="fen-kpi-val fen-enso">' + ensoLabel + '</span><span class="fen-kpi-lbl">ENSO · certeza ' + certezaLabel(ensoFase) + '</span></div>' +
          '</div>' +
        '</div>' +
        alertBanner +
        '<div class="fen-chart-wrap"><canvas id="fen-chart"></canvas></div>' +
        buildTable(stages) +
        '<div class="fen-nota">NASA POWER 1984–presente · ET₀ Hargreaves-Samani (MJ/m²·día, cal.0.60) · Kc FAO-56 · Ke FAO-56 · ENSO NOAA · ' + cultRaw + ' · ' + lat + ', ' + lon + '</div>' +
      '</div>';

    buildChart(stages, ef);
  }

  // ── Función principal de análisis ─────────────────────
  function fenAnalizar() {
    // Leer lote/coordenadas desde el campo master del módulo siembra
    var coordStr = (document.getElementById('s-coord') || {}).value || '';
    var parts    = coordStr.split(',');
    var lat      = parseFloat(parts[0]);
    var lon      = parseFloat(parts[1]);

    // Leer cultivo desde el selector master del módulo siembra
    var cultRaw  = (document.getElementById('s-cultivo') || {}).value || 'Soja';
    var cult     = cultRaw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    // Actualizar etiqueta de cultivo visible
    var lbl = document.getElementById('fen-cultivo-label');
    if (lbl) lbl.textContent = cultRaw;

    var ciclo      = (document.getElementById('fen-ciclo')   || {}).value || 'corto';
    var fecha      = (document.getElementById('fen-fecha')   || {}).value || '';
    var aguaPerfil = parseInt((document.getElementById('fen-agua-perfil') || {}).value, 10) || 80;

    var out = document.getElementById('fen-output');

    if (!coordStr || isNaN(lat) || isNaN(lon)) {
      out.innerHTML = '<div class="fen-placeholder"><div class="fen-ph-icon">📍</div>' +
        '<div class="fen-ph-text">Primero ingresá las coordenadas del lote en el módulo <strong>Siembra</strong> y hacé clic en <strong>Obtener datos</strong>.</div></div>';
      return;
    }
    if (!fecha) {
      out.innerHTML = '<div class="fen-placeholder"><div class="fen-ph-icon">📅</div>' +
        '<div class="fen-ph-text">Seleccioná una fecha de siembra para analizar.</div></div>';
      return;
    }

    var btn = document.getElementById('fen-btn');
    if (btn) btn.disabled = true;
    out.innerHTML = '<div class="fen-loading"><div class="fen-spinner">⟳</div><div>Consultando NASA POWER...</div></div>';

    var cacheKey = lat.toFixed(3) + ',' + lon.toFixed(3);

    function _run(props) {
      var enso    = getENSO();
      var stages  = computeStages(cult, ciclo, fecha);
      var durTotal = stages.reduce(function(a, s) { return a + s.dias; }, 0);
      stages.forEach(function(s) {
        var etcEvap = etcAndEvapPerStage(s.dStart, s.dEnd, s.kc, props);
        s.precip    = precipPerStage(s.dStart, s.dEnd, props, enso.factor);
        s.etc       = etcEvap.etc;
        s.evap      = etcEvap.evap;
        var aporteP = Math.round(aguaPerfil * s.dias / durTotal);
        s.balance   = s.precip + aporteP - s.etc - s.evap;
        s.riesgo    = clasificarRiesgo(s.precip, s.etc, s.stress);
      });
      renderResultado(stages, enso.factor, enso.fase, lat.toFixed(3), lon.toFixed(3), cultRaw, aguaPerfil);
      if (btn) btn.disabled = false;
    }

    if (nasaCache[cacheKey]) { _run(nasaCache[cacheKey]); return; }

    if (typeof window.buscarNASAPower !== 'function') {
      out.innerHTML = '<div class="fen-placeholder"><div class="fen-ph-icon">⚠️</div>' +
        '<div class="fen-ph-text">Error interno: siembra-apis.js no disponible.</div></div>';
      if (btn) btn.disabled = false;
      return;
    }

    window.buscarNASAPower(lat, lon).then(function(props) {
      nasaCache[cacheKey] = props;
      _run(props);
    }).catch(function() {
      out.innerHTML = '<div class="fen-placeholder"><div class="fen-ph-icon">⚠️</div>' +
        '<div class="fen-ph-text">No se pudo obtener datos de NASA POWER. Verificá tu conexión e intentá nuevamente.</div></div>';
      if (btn) btn.disabled = false;
    });
  }

  // ── Construir UI del form (título/subtitle ya son estáticos en app.html) ──
  function buildUI() {
    var body = document.getElementById('fenologia-body');
    if (!body) return;

    // Leer cultivo y fecha actuales para mostrarlos como referencia
    var cultRaw  = (document.getElementById('s-cultivo') || {}).value || 'Soja';
    var fechaVal = (document.getElementById('s-fecha')   || {}).value || '';

    body.innerHTML =
      '<div class="fen-input-bar">' +
        '<div class="fen-fg fen-fg-cultivo">' +
          '<label>Cultivo (desde Siembra)</label>' +
          '<div class="fen-cultivo-badge" id="fen-cultivo-label">' + cultRaw + '</div>' +
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
          '<input type="date" id="fen-fecha"' + (fechaVal ? ' value="' + fechaVal + '"' : '') + '>' +
        '</div>' +
        '<div class="fen-fg">' +
          '<label title="Agua disponible estimada en el perfil al momento de la siembra">Agua perfil inicial (mm) ⓘ</label>' +
          '<input type="number" id="fen-agua-perfil" min="0" max="200" value="80" step="5">' +
        '</div>' +
        '<button class="fen-btn-analizar" id="fen-btn" onclick="fenAnalizar()">📅 Analizar</button>' +
      '</div>' +
      '<div id="fen-output">' +
        '<div class="fen-placeholder">' +
          '<div class="fen-ph-icon">📅</div>' +
          '<div class="fen-ph-text">' +
            'Los datos del lote (coordenadas y cultivo) se leen automáticamente desde el módulo de <strong>Siembra</strong>.<br>' +
            'Verificá el ciclo y la fecha, luego hacé clic en <strong>Analizar</strong>.' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ── Refresh al re-activar el módulo (cultivo puede haber cambiado) ────────
  function _fenRefresh() {
    var cultRaw = (document.getElementById('s-cultivo') || {}).value || 'Soja';
    var lbl = document.getElementById('fen-cultivo-label');
    if (lbl) lbl.textContent = cultRaw;

    // Sync fecha solo si el campo está vacío
    var fenFecha = document.getElementById('fen-fecha');
    var sFecha   = document.getElementById('s-fecha');
    if (fenFecha && sFecha && sFecha.value && !fenFecha.value) {
      fenFecha.value = sFecha.value;
    }
  }

  // ── Init (llamado por nav.js al activar el módulo) ────
  function fenInit() {
    if (!_fenBuilt) {
      buildUI();
      _fenBuilt = true;
    } else {
      _fenRefresh();
    }
  }

  window.fenInit     = fenInit;
  window.fenAnalizar = fenAnalizar;

})();
