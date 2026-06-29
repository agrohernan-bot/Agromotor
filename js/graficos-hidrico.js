// ════════════════════════════════════════════════════════
// AGROMOTOR — graficos-hidrico.js  v1.0
// Gráfico de Balance Hídrico por Etapa Fenológica
//
// Renderiza un gráfico Chart.js mixto (barras + líneas):
//   · Precipitación efectiva por etapa   (barras azules)
//   · ETc del cultivo por etapa          (barras ámbar)
//   · Agua en perfil al inicio de etapa  (línea azul rellena)
//   · Capacidad de campo (CC)            (línea verde punteada)
//   · Punto de marchitamiento            (línea roja punteada)
//
// Datos: recalcula desde localStorage usando los mismos
//         coeficientes que hidrico.js (sin importarlo).
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── TABLAS SIMPLIFICADAS (espejo de hidrico.js) ───────
  var CULTIVOS = {
    Soja:    { kc:[0.40,0.75,1.15,0.75,0.50],
               periodos:['Vegetativo','Floración','Llenado','Madurez'],
               dias:[35,25,45,30] },
    Maíz:    { kc:[0.30,0.70,1.20,1.00,0.60],
               periodos:['Vegetativo','Pre-floración','Floración','Llenado','Madurez'],
               dias:[35,20,20,35,20] },
    Trigo:   { kc:[0.70,0.90,1.15,0.90,0.30],
               periodos:['Implantación','Macollaje','Encañazón','Grano lechoso','Madurez'],
               dias:[20,30,35,25,20] },
    Girasol: { kc:[0.35,0.70,1.15,0.85,0.50],
               periodos:['Vegetativo','Pre-floración','Floración','Llenado','Madurez'],
               dias:[25,25,30,30,20] },
    Sorgo:   { kc:[0.35,0.70,1.10,0.90,0.55],
               periodos:['Vegetativo','Pre-floración','Floración','Llenado','Madurez'],
               dias:[30,20,20,35,20] },
  };

  // Precipitación base mensual pampeana núcleo (mm/mes · ene-dic)
  var PRECIP_MES = [55,65,75,60,40,20,15,25,40,55,65,60];

  // Factor ajuste ENSO (porcentual sobre precipitación)
  var ENSO_ADJ = { nino:1.18, neutro:1.00, nina:0.82 };

  var ET0_DIA    = 4.5;   // ET₀ media histórica pampeana (mm/día)
  // capMax y aguaHoy son agua útil (por encima de PMP): PMP = 0 mm útiles.
  // El 50% marca el umbral genérico de estrés reversible (FAO-56, p=0,5).
  var WILTING_F  = 0;
  var CRITICAL_F = 0.50;

  function fraccionCritica(cultivo, et0, kc) {
    if (typeof window.amSoilWaterDepletion !== 'function') return CRITICAL_F;
    var sg = Object.assign({}, window._sgDatos || {});
    var lab = window._labDatos || {};
    if (lab.da != null) sg.da = lab.da;
    var dep = window.amSoilWaterDepletion(cultivo, et0, kc, sg);
    return 1 - dep.p;
  }

  // ── ESTADO ────────────────────────────────────────────
  var _chart = null;

  // ── UTILIDADES ───────────────────────────────────────
  function ls(k) {
    try { return localStorage.getItem(k) || ''; } catch(e) { return ''; }
  }

  function normalizaCultivo(nombre) {
    var n = (nombre || '').trim();
    var keys = Object.keys(CULTIVOS);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === n.toLowerCase()) return CULTIVOS[keys[i]];
    }
    // Fallback: busca coincidencia parcial
    for (var j = 0; j < keys.length; j++) {
      if (n.toLowerCase().indexOf(keys[j].toLowerCase()) !== -1) return CULTIVOS[keys[j]];
    }
    return CULTIVOS.Soja;
  }

  // ── CÁLCULO POR ETAPAS ────────────────────────────────
  function calcularEtapas() {
    var cultNombre  = ls('am_siembra_cultivo') || ls('s-cultivo-val') || 'Soja';
    var cult        = normalizaCultivo(cultNombre);

    // Capacidad de campo y agua inicial
    var capMax   = parseFloat(ls('am_hidrico_cap_max_mm'))  || 180;
    // Preferimos el dato post-cálculo; si no hay, leemos el input
    var aguaIni  = parseFloat(ls('am_hidrico_agua_actual_mm'));
    if (!aguaIni || aguaIni <= 0) {
      aguaIni = parseFloat(ls('bh-agua-perfil') || '0') || 120;
    }

    var ensoFase = ls('am_enso_fase') || 'neutro';
    var ensoAdj  = ENSO_ADJ[ensoFase] || 1.0;

    var wiltingMm = Math.round(capMax * WILTING_F);
    var criticalMm = Math.round(capMax * fraccionCritica(cultNombre, 5, 1));

    // Mes de inicio de siembra (0=ene … 11=dic)
    var fechaSiembra = ls('am_siembra_fecha');
    var mesInicio = 9; // octubre por defecto (campaña de verano)
    if (fechaSiembra) {
      var dt = new Date(fechaSiembra + 'T12:00:00');
      if (!isNaN(dt)) mesInicio = dt.getMonth();
    }

    var etapas   = [];
    var aguaHoy  = aguaIni;
    var diaAcum  = 0;
    var nEtapas  = Math.min(cult.periodos.length, cult.dias.length, cult.kc.length);

    for (var i = 0; i < nEtapas; i++) {
      var dias = cult.dias[i];
      var kc   = cult.kc[i];

      // ETc de la etapa
      var etcMm = Math.round(kc * ET0_DIA * dias);

      // Precipitación efectiva de la etapa (75 % de la lluvia cae al perfil)
      var precBruta = 0;
      for (var d = 0; d < dias; d++) {
        var mes = (mesInicio + Math.floor((diaAcum + d) / 30)) % 12;
        precBruta += PRECIP_MES[mes] / 30;
      }
      var precEfec = Math.round(precBruta * ensoAdj * 0.75);

      var aguaInicio = Math.round(aguaHoy);
      aguaHoy = Math.max(0, Math.min(capMax, aguaHoy + precEfec - etcMm));
      diaAcum += dias;

      etapas.push({
        label:      cult.periodos[i],
        dias:       dias,
        precEfec:   precEfec,
        etcMm:      etcMm,
        aguaInicio: aguaInicio,
        aguaFin:    Math.round(aguaHoy),
      });
    }

    return { etapas, capMax, wiltingMm, criticalMm, cultNombre };
  }

  // ── RENDER DEL GRÁFICO ────────────────────────────────
  window.ghGraficoRender = window.bhGraficoRender = function () {
    var canvas = document.getElementById('gh-hidrico-chart');
    if (!canvas) return;
    // Ocultar mensaje "sin datos"
    var noData = document.getElementById('gh-no-data');
    if (noData) noData.style.display = 'none';
    canvas.style.display = '';
    if (typeof Chart === 'undefined') {
      console.warn('graficos-hidrico: Chart.js no disponible');
      return;
    }

    var calc    = calcularEtapas();
    var etapas  = calc.etapas;
    var capMax  = calc.capMax;
    var wilt    = calc.wiltingMm;
    var critical = calc.criticalMm;

    var labels   = etapas.map(function(e) { return e.label; });
    var precData = etapas.map(function(e) { return e.precEfec; });
    var etcData  = etapas.map(function(e) { return e.etcMm;   });
    var aguaData = etapas.map(function(e) { return e.aguaInicio; });
    var ccLine   = labels.map(function() { return capMax; });
    var wiltLine = labels.map(function() { return wilt; });
    var criticalLine = labels.map(function() { return critical; });

    // Destruir gráfico previo si existe
    if (_chart) { _chart.destroy(); _chart = null; }

    var ctx = canvas.getContext('2d');
    _chart = new Chart(ctx, {
      data: {
        labels: labels,
        datasets: [
          // Barras detrás
          {
            type:            'bar',
            label:           'Precipitación efectiva (mm)',
            data:            precData,
            backgroundColor: 'rgba(74,138,196,.30)',
            borderColor:     'rgba(74,138,196,.65)',
            borderWidth:     1,
            borderRadius:    4,
            order:           4,
          },
          {
            type:            'bar',
            label:           'ETc cultivo (mm)',
            data:            etcData,
            backgroundColor: 'rgba(184,122,32,.22)',
            borderColor:     'rgba(184,122,32,.60)',
            borderWidth:     1,
            borderRadius:    4,
            order:           5,
          },
          // Líneas encima
          {
            type:            'line',
            label:           'Agua en perfil (mm)',
            data:            aguaData,
            borderColor:     '#2A5A8C',
            backgroundColor: 'rgba(42,90,140,.09)',
            borderWidth:     2.5,
            pointRadius:     5,
            pointHoverRadius:7,
            pointBackgroundColor: '#2A5A8C',
            fill:            true,
            tension:         0.35,
            order:           1,
          },
          {
            type:            'line',
            label:           'Capacidad de campo (CC)',
            data:            ccLine,
            borderColor:     'rgba(42,122,74,.75)',
            backgroundColor: 'transparent',
            borderWidth:     1.8,
            borderDash:      [7,4],
            pointRadius:     0,
            fill:            false,
            tension:         0,
            order:           2,
          },
          {
            type:            'line',
            label:           'Umbral estrés reversible',
            data:            criticalLine,
            borderColor:     'rgba(184,122,32,.70)',
            backgroundColor: 'transparent',
            borderWidth:     1.8,
            borderDash:      [4,3],
            pointRadius:     0,
            fill:            false,
            tension:         0,
            order:           3,
          },
          {
            type:            'line',
            label:           'Punto de marchitez permanente (PMP)',
            data:            wiltLine,
            borderColor:     'rgba(212,82,42,.65)',
            backgroundColor: 'transparent',
            borderWidth:     1.8,
            borderDash:      [4,3],
            pointRadius:     0,
            fill:            false,
            tension:         0,
            order:           3,
          },
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        interaction: { mode:'index', intersect:false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font:           { family:"'DM Sans',sans-serif", size:11 },
              padding:        14,
              usePointStyle:  true,
              pointStyleWidth:10,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(252,249,242,.97)',
            borderColor:     'rgba(60,34,16,.12)',
            borderWidth:     1,
            titleColor:      'rgba(28,18,8,.8)',
            bodyColor:       'rgba(28,18,8,.65)',
            titleFont:       { family:"'DM Serif Display',serif", size:12 },
            bodyFont:        { family:"'DM Sans',sans-serif", size:11 },
            padding:         10,
            callbacks: {
              label: function(ctx) {
                return ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + ' mm';
              },
            },
          },
        },
        scales: {
          x: {
            grid:  { color:'rgba(60,34,16,.05)' },
            ticks: { font:{ family:"'DM Sans',sans-serif", size:11 }, color:'rgba(28,18,8,.55)' },
          },
          y: {
            beginAtZero: true,
            suggestedMax: capMax * 1.15,
            grid:  { color:'rgba(60,34,16,.06)' },
            ticks: {
              font:     { family:"'DM Sans',sans-serif", size:11 },
              color:    'rgba(28,18,8,.55)',
              callback: function(v) { return v + ' mm'; },
            },
            title: {
              display:true,
              text:   'Agua (mm)',
              font:   { family:"'DM Sans',sans-serif", size:10 },
              color:  'rgba(28,18,8,.4)',
            },
          },
        },
      },
    });
  };

  // ── TOGGLE PANEL ─────────────────────────────────────
  window.ghTogglePanel = function () {
    var panel = document.getElementById('gh-hidrico-panel');
    var btn   = document.getElementById('gh-toggle-btn');
    if (!panel) return;
    var visible = panel.style.display !== 'none';
    if (visible) {
      panel.style.display = 'none';
      if (btn) btn.textContent = 'Mostrar gráfico';
    } else {
      panel.style.display = 'block';
      if (btn) btn.textContent = 'Ocultar gráfico';
      setTimeout(window.ghGraficoRender, 60);
    }
  };

  // ── EXPORTAR PNG ──────────────────────────────────────
  window.ghExportar = function () {
    var canvas = document.getElementById('gh-hidrico-chart');
    if (!canvas) return;
    var tmp = document.createElement('canvas');
    tmp.width  = canvas.width;
    tmp.height = canvas.height;
    var ctx = tmp.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(canvas, 0, 0);
    var a = document.createElement('a');
    a.download = 'balance-hidrico.png';
    a.href = tmp.toDataURL('image/png');
    a.click();
  };

  // ── LEGADO (compat) ───────────────────────────────────
  window.bhGraficoMostrar = function () {
    var panel = document.getElementById('gh-hidrico-panel');
    if (panel) { panel.style.display = 'block'; setTimeout(window.ghGraficoRender, 60); }
  };
  window.bhGraficoOcultar = function () {
    var panel = document.getElementById('gh-hidrico-panel');
    if (panel) panel.style.display = 'none';
  };

  // Reactualizar si el balance hídrico se recalculó
  window.addEventListener('storage', function (e) {
    if (e.key !== 'am_hidrico_ultimo') return;
    var panel = document.getElementById('gh-hidrico-panel');
    if (panel && panel.style.display !== 'none') {
      setTimeout(window.ghGraficoRender, 120);
    }
    // Invalida caché diaria y recarga
    _ghdCacheInvalidar();
    setTimeout(window.ghDiarioRender, 300);
  });

  document.addEventListener('am:hidrico-actualizado', function () {
    var panel = document.getElementById('gh-hidrico-panel');
    if (panel && panel.style.display !== 'none') {
      setTimeout(window.ghGraficoRender, 120);
    }
    setTimeout(window.ghDiarioRender, 300);
  });

  // Auto-render cuando el módulo hídrico se activa
  // Botón refrescar del gráfico diario
  window._ghdRefrescar = function() {
    _ghdCacheInvalidar();
    window.ghDiarioRender();
  };

  document.addEventListener('am:modulo-activado', function (e) {
    if (e.detail && e.detail.mod === 'hidrico') {
      setTimeout(window.ghDiarioRender, 400);
    }
  });

  // ══════════════════════════════════════════════════════
  // GRÁFICO 2 — EVOLUCIÓN DIARIA DEL AGUA EN PERFIL
  // ERA5 (histórico real) + Pronóstico Open-Meteo (7 días)
  // 100% automático — sin inputs adicionales
  // ══════════════════════════════════════════════════════

  var _chartDiario  = null;
  var _ghdCargando  = false;

  // Kc para un día dado desde la fecha de siembra
  function _ghdKc(cult, diaDesde) {
    var acum = 0;
    for (var i = 0; i < cult.dias.length; i++) {
      acum += cult.dias[i];
      if (diaDesde < acum) return cult.kc[i];
    }
    return cult.kc[cult.kc.length - 1];
  }

  // Etapa fenológica para un día desde siembra
  function _ghdEtapa(cult, diaDesde) {
    var acum = 0;
    for (var i = 0; i < cult.dias.length; i++) {
      acum += cult.dias[i];
      if (diaDesde < acum) return cult.periodos[i];
    }
    return cult.periodos[cult.periodos.length - 1];
  }

  function _ghdFmt(date) {
    return date.toISOString().split('T')[0];
  }

  function _ghdCacheKey() {
    var lat = ls('am_siembra_lat');
    var lon = ls('am_siembra_lon');
    var f   = ls('am_siembra_fecha');
    return 'ghd_v2_' + parseFloat(lat).toFixed(2) + '_' + parseFloat(lon).toFixed(2) + '_' + f;
  }

  function _ghdCacheInvalidar() {
    try { localStorage.removeItem(_ghdCacheKey()); } catch(e) {}
  }

  async function _ghdFetchDatos() {
    var lat  = parseFloat(ls('am_siembra_lat'));
    var lon  = parseFloat(ls('am_siembra_lon'));
    var fecha = ls('am_siembra_fecha');
    if (!lat || !lon || !fecha) return null;

    // Caché 3h
    var cKey = _ghdCacheKey();
    try {
      var cached = JSON.parse(localStorage.getItem(cKey) || 'null');
      if (cached && (Date.now() - cached.ts) < 3 * 3600 * 1000) return cached.data;
    } catch(e) {}

    var siembra = new Date(fecha + 'T12:00:00');
    var hoy     = new Date();
    if (siembra > hoy) return null;

    var ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);

    var params = 'daily=precipitation_sum,et0_fao_evapotranspiration&timezone=America%2FArgentina%2FBuenos_Aires';
    var base   = '&latitude=' + lat + '&longitude=' + lon;

    var urlArch = 'https://archive-api.open-meteo.com/v1/archive?' + params + base
                + '&start_date=' + _ghdFmt(siembra) + '&end_date=' + _ghdFmt(ayer);
    var urlFore = 'https://api.open-meteo.com/v1/forecast?' + params + base
                + '&daily=precipitation_probability_max&forecast_days=10';

    var ctrl  = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, 18000);

    try {
      var results = await Promise.all([
        fetch(urlArch, { signal: ctrl.signal }).then(function(r) { return r.json(); }),
        fetch(urlFore, { signal: ctrl.signal }).then(function(r) { return r.json(); }),
      ]);
      clearTimeout(timer);
      var arch = results[0], fore = results[1];

      var dias = [];
      var archDates = (arch.daily && arch.daily.time)  || [];
      var archPrec  = (arch.daily && arch.daily.precipitation_sum)           || [];
      var archEt0   = (arch.daily && arch.daily.et0_fao_evapotranspiration)  || [];

      for (var i = 0; i < archDates.length; i++) {
        dias.push({ fecha: archDates[i], precip: archPrec[i] || 0, et0: archEt0[i] || 3.5, esPronos: false, probLluvia: null });
      }

      var existentes  = new Set(archDates);
      var foreDates   = (fore.daily && fore.daily.time)  || [];
      var forePrec    = (fore.daily && fore.daily.precipitation_sum)           || [];
      var foreEt0     = (fore.daily && fore.daily.et0_fao_evapotranspiration)  || [];
      var foreProb    = (fore.daily && fore.daily.precipitation_probability_max) || [];

      for (var j = 0; j < foreDates.length; j++) {
        if (!existentes.has(foreDates[j])) {
          dias.push({ fecha: foreDates[j], precip: forePrec[j] || 0, et0: foreEt0[j] || 3.5, esPronos: true, probLluvia: foreProb[j] || 0 });
        }
      }
      dias.sort(function(a, b) { return a.fecha.localeCompare(b.fecha); });

      try { localStorage.setItem(cKey, JSON.stringify({ ts: Date.now(), data: dias })); } catch(e) {}
      return dias;
    } catch(e) {
      clearTimeout(timer);
      throw e;
    }
  }

  window.ghDiarioRender = async function() {
    var loadEl  = document.getElementById('ghd-loading');
    var errEl   = document.getElementById('ghd-error');
    var canvas  = document.getElementById('ghd-chart');
    var statsEl = document.getElementById('ghd-stats');
    if (!canvas) return;
    if (_ghdCargando) return;
    _ghdCargando = true;

    if (loadEl)  { loadEl.style.display = 'flex'; loadEl.textContent = '⟳ Cargando datos ERA5…'; }
    if (errEl)   errEl.style.display = 'none';
    canvas.style.display = 'none';
    if (statsEl) statsEl.innerHTML = '';

    try {
      var cultNombre  = ls('am_siembra_cultivo') || ls('s-cultivo-val') || 'Soja';
      var cult        = normalizaCultivo(cultNombre);
      var capMax      = parseFloat(ls('am_hidrico_cap_max_mm')) || 180;
      // Agua inicial al sembrar: barbecho > input > default
      var aguaIni     = parseFloat(ls('am_fen_agua_perfil'))
                     || parseFloat(ls('am_hidrico_agua_actual_mm'))
                     || 120;
      var wiltMm      = 0;
      var criticalMm  = Math.round(capMax * fraccionCritica(cultNombre, 5, 1));
      var fechaSiembra = ls('am_siembra_fecha');

      if (!ls('am_siembra_lat') || !fechaSiembra) {
        if (loadEl) { loadEl.textContent = 'Consultá el módulo Siembra primero para ver la evolución diaria.'; }
        _ghdCargando = false; return;
      }

      var dias = await _ghdFetchDatos();
      if (!dias || dias.length === 0) {
        if (loadEl) loadEl.textContent = 'Sin datos disponibles para este período.';
        _ghdCargando = false; return;
      }

      if (loadEl) loadEl.style.display = 'none';
      canvas.style.display = 'block';

      var siembraDate = new Date(fechaSiembra + 'T12:00:00');
      var labels = [], awcReal = [], awcPronos = [], precData = [], probData = [], criticalData = [];
      var awc = aguaIni, stressDias = 0, totalPrecip = 0, diasReal = 0;

      for (var i = 0; i < dias.length; i++) {
        var d        = dias[i];
        var diaN     = Math.round((new Date(d.fecha + 'T12:00:00') - siembraDate) / 86400000);
        var kc       = _ghdKc(cult, diaN);
        var etc      = (d.et0 || 3.5) * kc;
        var pEfec    = (d.precip || 0) * 0.75;
        var criticalDia = Math.round(capMax * fraccionCritica(cultNombre, d.et0 || 3.5, kc) * 10) / 10;
        awc = Math.min(capMax, Math.max(0, awc + pEfec - etc));

        var val = Math.round(awc * 10) / 10;
        labels.push(d.fecha.slice(5).replace('-', '/'));  // MM/DD
        awcReal.push(d.esPronos   ? null : val);
        awcPronos.push(d.esPronos ? val  : null);
        precData.push(Math.round((d.precip || 0) * 10) / 10);
        probData.push(d.esPronos ? (d.probLluvia || 0) : null);
        criticalData.push(criticalDia);

        if (!d.esPronos) {
          diasReal++;
          totalPrecip += (d.precip || 0);
          if (awc < criticalDia) stressDias++;
        }
      }

      // ── Stats strip ──────────────────────────────────────
      var stressPct  = diasReal > 0 ? Math.round(stressDias / diasReal * 100) : 0;
      var stressColor = stressPct > 25 ? '#C94A2A' : stressPct > 10 ? '#B87A20' : '#2A7A4A';
      if (statsEl) {
        statsEl.innerHTML =
          '<div style="display:flex;gap:.8rem;flex-wrap:wrap;font-size:.71rem;color:rgba(74,46,26,.6);margin:.5rem 0 .2rem">'
          + '<span>🌧️ Lluvia real acumulada: <strong>' + Math.round(totalPrecip) + ' mm</strong></span>'
          + '<span>📅 Días desde siembra: <strong>' + diasReal + '</strong></span>'
          + '<span style="color:' + stressColor + '">⚠️ Días con estrés: <strong>' + stressDias + ' (' + stressPct + '%)</strong></span>'
          + '</div>';
      }

      // ── Chart ─────────────────────────────────────────────
      if (_chartDiario) { _chartDiario.destroy(); _chartDiario = null; }
      var ctx = canvas.getContext('2d');
      _chartDiario = new Chart(ctx, {
        data: {
          labels: labels,
          datasets: [
            {
              type: 'bar', label: 'Precipitación (mm)',
              data: precData,
              backgroundColor: 'rgba(74,138,196,.25)', borderColor: 'rgba(74,138,196,.45)',
              borderWidth: 1, borderRadius: 2, yAxisID: 'yP', order: 6,
            },
            {
              type: 'line', label: 'Agua en perfil (mm)',
              data: awcReal,
              borderColor: '#2A5A8C', backgroundColor: 'rgba(42,90,140,.09)',
              borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4,
              fill: true, tension: 0.3, spanGaps: false, order: 1,
            },
            {
              type: 'line', label: 'Pronóstico (mm)',
              data: awcPronos,
              borderColor: '#2A5A8C', backgroundColor: 'rgba(42,90,140,.04)',
              borderWidth: 2, borderDash: [6, 4], pointRadius: 0,
              fill: true, tension: 0.3, spanGaps: false, order: 2,
            },
            {
              type: 'line', label: 'Capacidad de campo',
              data: labels.map(function() { return capMax; }),
              borderColor: 'rgba(42,122,74,.6)', borderWidth: 1.5,
              borderDash: [8, 4], pointRadius: 0, fill: false, order: 3,
            },
            {
              type: 'line', label: 'Umbral estrés reversible',
              data: criticalData,
              borderColor: 'rgba(184,122,32,.6)', borderWidth: 1.5,
              borderDash: [4, 3], pointRadius: 0, fill: false, order: 4,
            },
            {
              type: 'line', label: 'Punto de marchitez permanente (PMP)',
              data: labels.map(function() { return wiltMm; }),
              borderColor: 'rgba(201,74,42,.5)', borderWidth: 1.5,
              borderDash: [2, 2], pointRadius: 0, fill: false, order: 5,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                font: { family: "'DM Sans',sans-serif", size: 10 }, padding: 10,
                usePointStyle: true, pointStyleWidth: 8,
                filter: function(item) {
                  return item.text !== 'Capacidad de campo' &&
                    item.text !== 'Umbral estrés reversible' &&
                    item.text !== 'Punto de marchitez permanente (PMP)';
                },
              },
            },
            tooltip: {
              backgroundColor: 'rgba(252,249,242,.97)',
              borderColor: 'rgba(60,34,16,.12)', borderWidth: 1,
              titleColor: 'rgba(28,18,8,.8)', bodyColor: 'rgba(28,18,8,.65)',
              titleFont: { family: "'DM Serif Display',serif", size: 11 },
              bodyFont:  { family: "'DM Sans',sans-serif", size: 11 },
              padding: 9,
              callbacks: {
                title: function(items) {
                  if (!items.length) return '';
                  var idx    = items[0].dataIndex;
                  var d      = dias[idx];
                  if (!d) return items[0].label;
                  var diaN   = Math.round((new Date(d.fecha + 'T12:00:00') - siembraDate) / 86400000);
                  var etapa  = _ghdEtapa(cult, diaN);
                  return d.fecha + (d.esPronos ? ' · pronóstico' : '') + ' · ' + etapa;
                },
                label: function(ctx) {
                  var v = ctx.parsed.y;
                  if (v === null || v === undefined) return null;
                  if (ctx.dataset.label.includes('Precipitación')) return ' 🌧 Precip.: ' + v + ' mm';
                  if (ctx.dataset.label.includes('Agua') || ctx.dataset.label.includes('Pronóstico'))
                    return ' 💧 Agua útil: ' + v + ' mm  (CC ' + capMax +
                      ' · estrés ' + Math.round(criticalData[ctx.dataIndex]) + ' · PMP ' + wiltMm + ')';
                  return null;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(60,34,16,.04)' },
              ticks: {
                font: { family: "'DM Sans',sans-serif", size: 9 },
                color: 'rgba(28,18,8,.4)', maxTicksLimit: 16, maxRotation: 0,
              },
            },
            y: {
              position: 'left', beginAtZero: true, suggestedMax: capMax * 1.12,
              grid: { color: 'rgba(60,34,16,.05)' },
              ticks: {
                font: { family: "'DM Sans',sans-serif", size: 10 },
                color: 'rgba(28,18,8,.5)',
                callback: function(v) { return v + ' mm'; },
              },
            },
            yP: {
              position: 'right', beginAtZero: true, grid: { display: false },
              ticks: {
                font: { family: "'DM Sans',sans-serif", size: 9 },
                color: 'rgba(74,138,196,.55)',
                callback: function(v) { return v + ' mm'; },
              },
            },
          },
        },
      });

    } catch(e) {
      if (loadEl) loadEl.style.display = 'none';
      if (errEl)  { errEl.style.display = 'block'; errEl.textContent = 'No se pudieron cargar datos: ' + e.message; }
    }
    _ghdCargando = false;
  };

  // Reactualizar si el balance hídrico se recalculó
  window.addEventListener('storage', function (e) {
    if (e.key !== 'am_hidrico_ultimo') return;
    var panel = document.getElementById('gh-hidrico-panel');
    if (panel && panel.style.display !== 'none') {
      setTimeout(window.ghGraficoRender, 120);
    }
    _ghdCacheInvalidar();
    setTimeout(window.ghDiarioRender, 300);
  });

  document.addEventListener('am:hidrico-actualizado', function () {
    var panel = document.getElementById('gh-hidrico-panel');
    if (panel && panel.style.display !== 'none') {
      setTimeout(window.ghGraficoRender, 120);
    }
    setTimeout(window.ghDiarioRender, 300);
  });

  document.addEventListener('am:modulo-activado', function (e) {
    if (e.detail && e.detail.mod === 'hidrico') {
      setTimeout(window.ghDiarioRender, 400);
    }
  });

})();
