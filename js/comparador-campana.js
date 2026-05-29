// ════════════════════════════════════════════════════════
// AGROMOTOR — comparador-campana.js  v1.0
// Comparador de dos escenarios de campaña lado a lado
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  var _chart = null;

  // ── UTILIDADES ───────────────────────────────────────
  function gi(id)  { return document.getElementById(id); }
  function gv(id)  { return parseFloat((gi(id) || {}).value) || 0; }
  function gvs(id) { return ((gi(id) || {}).value || '').trim(); }
  function sv(id, val) { var el = gi(id); if (el) el.value = val; }
  function fmt(n, d) { return (isNaN(n) ? '—' : n.toFixed(d == null ? 0 : d)); }

  // ── COPIAR DESDE MÓDULO ECONOMÍA ─────────────────────
  window.ccCopiarEconomia = function (slot) {
    var s = slot === 'b' ? 'b' : 'a';
    sv('cc-cult-' + s,     gvs('ec-lbl-cult') || gvs('ec-cultivo') || 'Soja');
    sv('cc-precio-' + s,   gv('ec-precio-disp') || gv('ec-precio-fut') || 290);
    sv('cc-rend-' + s,     gv('ec-rend') || 3.2);
    // Costos directos: suma los 6 ítems
    var cd = gv('ec-semilla') + gv('ec-fertil') + gv('ec-agroquim') +
             gv('ec-siembra') + gv('ec-cosecha') + gv('ec-otros');
    sv('cc-costo-' + s, cd || 295);
    sv('cc-flete-' + s,    gv('ec-km') * gv('ec-flete-tar') / 100 * (gv('ec-rend') || 3.2) * 10 | 0);
    sv('cc-arriendo-' + s, gv('ec-arriendo-qq') || 0);
  };

  // ── CÁLCULO DE UN ESCENARIO ───────────────────────────
  function calcEscenario(s) {
    var precio    = gv('cc-precio-' + s);     // USD/t
    var rend      = gv('cc-rend-' + s);       // t/ha
    var costoDir  = gv('cc-costo-' + s);      // USD/ha (costos directos)
    var flete     = gv('cc-flete-' + s);      // USD/ha
    var arrQq     = gv('cc-arriendo-' + s);   // qq/ha → USD/ha
    var arrUsd    = arrQq * precio / 10;       // 1 qq = 0.1 t

    var ingreso   = precio * rend;
    var costoTot  = costoDir + flete + arrUsd;
    var margen    = ingreso - costoTot;
    var bePrecio  = rend > 0 ? costoTot / rend : 0;
    var beRend    = precio > 0 ? costoTot / precio : 0;
    var margenPct = ingreso > 0 ? (margen / ingreso) * 100 : 0;

    return {
      label:    gvs('cc-lbl-' + s) || ('Escenario ' + s.toUpperCase()),
      cult:     gvs('cc-cult-' + s) || '—',
      precio, rend, costoDir, flete, arrUsd, ingreso, costoTot, margen, bePrecio, beRend, margenPct
    };
  }

  // ── RENDERIZAR TABLA ──────────────────────────────────
  function renderTabla(a, b) {
    var cont = gi('cc-tabla-res');
    if (!cont) return;

    var rows = [
      ['Cultivo',            a.cult,                  b.cult,                  false],
      ['Precio (USD/t)',     fmt(a.precio),            fmt(b.precio),            false],
      ['Rendimiento (t/ha)', fmt(a.rend, 2),           fmt(b.rend, 2),           false],
      ['Ingreso bruto (USD/ha)', fmt(a.ingreso),       fmt(b.ingreso),           true],
      ['Costos directos (USD/ha)', fmt(a.costoDir),    fmt(b.costoDir),          true],
      ['Flete (USD/ha)',     fmt(a.flete),             fmt(b.flete),             true],
      ['Arrendamiento (USD/ha)', fmt(a.arrUsd),        fmt(b.arrUsd),            true],
      ['Costo total (USD/ha)', fmt(a.costoTot),        fmt(b.costoTot),          true],
      ['Margen bruto (USD/ha)', fmt(a.margen),         fmt(b.margen),            true],
      ['Margen / Ingreso (%)', fmt(a.margenPct, 1)+'%', fmt(b.margenPct, 1)+'%', false],
      ['B.E. precio (USD/t)', fmt(a.bePrecio),         fmt(b.bePrecio),          true],
      ['B.E. rend. (t/ha)',  fmt(a.beRend, 2),         fmt(b.beRend, 2),         false],
    ];

    var html = '<table class="cc-cmp-tbl">' +
      '<thead><tr><th></th><th>' + a.label + '</th><th>' + b.label + '</th><th>Δ A→B</th></tr></thead><tbody>';

    rows.forEach(function (r) {
      var label = r[0], va = r[1], vb = r[2], numeric = r[3];
      var delta = '';
      if (numeric) {
        var na = parseFloat(va), nb = parseFloat(vb);
        if (!isNaN(na) && !isNaN(nb)) {
          var d = nb - na;
          var cls = d > 0 ? 'cc-pos' : d < 0 ? 'cc-neg' : '';
          delta = '<span class="' + cls + '">' + (d >= 0 ? '+' : '') + fmt(d) + '</span>';
        }
      }
      html += '<tr><td class="cc-lbl">' + label + '</td>' +
              '<td>' + va + '</td>' +
              '<td>' + vb + '</td>' +
              '<td>' + delta + '</td></tr>';
    });

    html += '</tbody></table>';
    cont.innerHTML = html;
  }

  // ── RENDERIZAR GRÁFICO ────────────────────────────────
  function renderGrafico(a, b) {
    var canvas = gi('cc-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (_chart) { _chart.destroy(); _chart = null; }

    var mobile = window.innerWidth < 480;
    canvas.parentElement.style.height = (mobile ? '200' : '240') + 'px';

    var labels   = ['Ingreso bruto', 'Costo total', 'Margen bruto'];
    var dataA    = [a.ingreso, a.costoTot, a.margen];
    var dataB    = [b.ingreso, b.costoTot, b.margen];

    _chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: a.label,
            data: dataA,
            backgroundColor: ['rgba(74,138,196,.55)','rgba(184,122,32,.45)','rgba(42,122,74,.55)'],
            borderColor:     ['rgba(74,138,196,.9)','rgba(184,122,32,.8)','rgba(42,122,74,.8)'],
            borderWidth: 1.5,
            borderRadius: 4,
          },
          {
            label: b.label,
            data: dataB,
            backgroundColor: ['rgba(74,138,196,.25)','rgba(184,122,32,.20)','rgba(42,122,74,.25)'],
            borderColor:     ['rgba(74,138,196,.6)','rgba(184,122,32,.5)','rgba(42,122,74,.5)'],
            borderWidth: 1.5,
            borderDash: [4, 3],
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: "'DM Sans',sans-serif", size: 11 }, padding: 12, usePointStyle: true },
          },
          tooltip: {
            backgroundColor: 'rgba(252,249,242,.97)',
            borderColor: 'rgba(60,34,16,.12)',
            borderWidth: 1,
            titleColor: 'rgba(28,18,8,.8)',
            bodyColor: 'rgba(28,18,8,.65)',
            titleFont: { family: "'DM Serif Display',serif", size: 12 },
            bodyFont: { family: "'DM Sans',sans-serif", size: 11 },
            padding: 10,
            callbacks: {
              label: function (ctx) {
                return ' ' + ctx.dataset.label + ': USD ' + fmt(ctx.parsed.y) + '/ha';
              },
            },
          },
        },
        scales: {
          x: { grid: { color: 'rgba(60,34,16,.05)' }, ticks: { font: { family: "'DM Sans',sans-serif", size: 10 } } },
          y: {
            grid: { color: 'rgba(60,34,16,.06)' },
            ticks: {
              font: { family: "'DM Sans',sans-serif", size: 10 },
              callback: function (v) { return 'USD ' + v; },
            },
          },
        },
      },
    });
  }

  // ── TOGGLE PANEL ─────────────────────────────────────
  window.ccToggle = function () {
    var panel = gi('cc-panel');
    var btn   = gi('cc-toggle-btn');
    if (!panel) return;
    var open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    if (btn) btn.textContent = open ? 'Abrir comparador' : 'Cerrar comparador';
  };

  // ── COMPARAR ─────────────────────────────────────────
  window.ccComparar = function () {
    var panel = gi('cc-resultado');
    if (panel) panel.style.display = 'block';
    var a = calcEscenario('a');
    var b = calcEscenario('b');
    renderTabla(a, b);
    setTimeout(function () { renderGrafico(a, b); }, 60);
  };

  // ── EXPORTAR PNG ──────────────────────────────────────
  window.ccExportar = function () {
    var canvas = gi('cc-chart');
    if (!canvas) return;
    var tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    var ctx = tmp.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(canvas, 0, 0);
    var a = document.createElement('a');
    a.download = 'comparador-campana.png';
    a.href = tmp.toDataURL('image/png');
    a.click();
  };

})();
