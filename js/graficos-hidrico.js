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
  var WILTING_F  = 0.35;  // Punto de marchitamiento como fracción de CC

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

    return { etapas, capMax, wiltingMm, cultNombre };
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

    var labels   = etapas.map(function(e) { return e.label; });
    var precData = etapas.map(function(e) { return e.precEfec; });
    var etcData  = etapas.map(function(e) { return e.etcMm;   });
    var aguaData = etapas.map(function(e) { return e.aguaInicio; });
    var ccLine   = labels.map(function() { return capMax; });
    var wiltLine = labels.map(function() { return wilt; });

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
            label:           'Punto de marchitamiento',
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
    a.download 