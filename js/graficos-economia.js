// ════════════════════════════════════════════════════════
// AGROMOTOR — graficos-economia.js  v1.0
// Visualizaciones económicas interactivas con Chart.js
//   1. Curva margen vs precio (con break-even)
//   2. Tabla de sensibilidad rendimiento × precio
//   3. Waterfall de costos
// ════════════════════════════════════════════════════════
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function gi(id) { return parseFloat($('ec-' + id)?.value) || 0; }
  function giRaw(id) { return parseFloat($(id)?.value) || 0; }
  function gv(id) { return $(id)?.value || ''; }

  let chartMargen = null;
  let chartWaterfall = null;
  let debounceTimer = null;

  // ─── Leer todos los inputs del módulo economía ───────────────────────────
  function leerInputs() {
    const pDisp   = gi('precio-disp');    // USD/t disponible
    const pFut    = gi('precio-fut');     // USD/t futuro
    const rendDisp = gi('rend');          // t/ha disponible
    const rendFut  = gi('rend-fut');      // t/ha futuro
    const sup      = gi('sup');           // ha

    const semilla   = gi('semilla');
    const fertil    = gi('fertil');
    const agroquim  = gi('agroquim');
    const siembra   = gi('siembra');
    const cosecha   = gi('cosecha');
    const otros     = gi('otros');

    const km      = gi('km');
    const flTar   = gi('flete-tar');
    const comision = gi('comision') / 100;
    const secado   = gi('secado');
    const arrQQ    = gi('arriendo-qq');
    const tenencia = gv('ec-tenencia');

    // Precio en qq (1 t = 1000 kg → qq = t * 10)
    const pDispQQ = pDisp / 10;

    const costoDir = semilla + fertil + agroquim + siembra + cosecha + otros;

    const fleteDisp    = rendDisp * (flTar * km / 100);
    const ingBrutDisp  = rendDisp * pDisp;
    const gasComDisp   = ingBrutDisp * comision + fleteDisp + secado;
    const arrUSD       = tenencia === 'arriendo' ? arrQQ * pDispQQ : 0;
    const costoTotalDisp = costoDir + gasComDisp + arrUSD;
    const margenDisp   = ingBrutDisp - costoTotalDisp;
    const peDisp       = pDisp > 0 ? costoTotalDisp / pDisp : 0;

    // Futuro
    const pFutQQ     = pFut / 10;
    const fleteFut   = rendFut * (flTar * km / 100);
    const ingBrutFut = rendFut * pFut;
    const gasComFut  = ingBrutFut * comision + fleteFut + secado;
    const arrFut     = tenencia === 'arriendo' ? arrQQ * pFutQQ : 0;
    const costoTotalFut = costoDir + gasComFut + arrFut;
    const margenFut  = ingBrutFut - costoTotalFut;

    return {
      pDisp, pFut, rendDisp, rendFut, sup,
      semilla, fertil, agroquim, siembra, cosecha, otros,
      km, flTar, comision, secado, arrQQ, tenencia,
      costoDir, fleteDisp, gasComDisp, arrUSD,
      costoTotalDisp, margenDisp, peDisp,
      costoTotalFut, margenFut,
      ingBrutDisp, ingBrutFut,
    };
  }

  // ─── Calcular margen a precio arbitrario ─────────────────────────────────
  function calcMargenAPrecio(precio, d) {
    if (precio <= 0) return null;
    const pQQ       = precio / 10;
    const flete     = d.rendDisp * (d.flTar * d.km / 100);
    const ingBrut   = d.rendDisp * precio;
    const gasCom    = ingBrut * d.comision + flete + d.secado;
    const arr       = d.tenencia === 'arriendo' ? d.arrQQ * pQQ : 0;
    const costoTot  = d.costoDir + gasCom + arr;
    return ingBrut - costoTot;
  }

  // ─── 1. Curva margen vs precio ────────────────────────────────────────────
  function renderCurvaMargen(d) {
    const canvas = $('ge-curva-canvas');
    if (!canvas) return;

    const base   = d.pDisp || 200;
    const step   = base * 0.05;
    const precios = [];
    const margenes = [];

    for (let p = base * 0.4; p <= base * 1.8; p += step) {
      precios.push(Math.round(p));
      margenes.push(calcMargenAPrecio(p, d));
    }

    // Break-even como línea punteada
    const beData = precios.map(() => 0);

    if (chartMargen) { chartMargen.destroy(); chartMargen = null; }

    chartMargen = new Chart(canvas, {
      type: 'line',
      data: {
        labels: precios,
        datasets: [
          {
            label: 'Margen neto (USD/ha)',
            data: margenes,
            borderColor: '#2e7d32',
            backgroundColor: 'rgba(46,125,50,0.08)',
            borderWidth: 2.5,
            pointRadius: 3,
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Break-even',
            data: beData,
            borderColor: '#c62828',
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 14, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y;
                return ` ${ctx.dataset.label}: USD ${v >= 0 ? '+' : ''}${v.toFixed(0)}/ha`;
              },
            },
          },
          annotation: {
            annotations: {
              precioActual: {
                type: 'line',
                xMin: d.pDisp,
                xMax: d.pDisp,
                borderColor: '#1565c0',
                borderWidth: 2,
                borderDash: [4, 3],
                label: {
                  content: `Precio actual $${d.pDisp}`,
                  enabled: true,
                  position: 'start',
                  font: { size: 10 },
                  color: '#1565c0',
                  backgroundColor: 'rgba(21,101,192,0.08)',
                },
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Precio (USD/t)', font: { size: 11 } },
            ticks: { font: { size: 10 } },
          },
          y: {
            title: { display: true, text: 'Margen (USD/ha)', font: { size: 11 } },
            ticks: {
              font: { size: 10 },
              callback: v => (v >= 0 ? '+' : '') + v.toFixed(0),
            },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
        },
      },
    });

    // Break-even info
    const beEl = $('ge-be-info');
    if (beEl) {
      const pe = d.peDisp;
      const margenPct = d.ingBrutDisp > 0 ? ((d.margenDisp / d.ingBrutDisp) * 100).toFixed(1) : '—';
      beEl.innerHTML =
        `Break-even: <strong>${pe.toFixed(2)} t/ha</strong> &nbsp;|&nbsp; ` +
        `Margen actual: <strong class="${d.margenDisp >= 0 ? 'text-success' : 'text-danger'}">${d.margenDisp >= 0 ? '+' : ''}${d.margenDisp.toFixed(0)} USD/ha</strong> ` +
        `(${margenPct}% del ingreso)`;
    }
  }

  // ─── 2. Tabla de sensibilidad rendimiento × precio ────────────────────────
  function renderTabSensibilidad(d) {
    const cont = $('ge-sens-table');
    if (!cont) return;

    const rBase = d.rendDisp || 3;
    const pBase = d.pDisp    || 200;

    // Filas: rendimientos ±40%
    const rends  = [-0.30, -0.20, -0.10, 0, 0.10, 0.20, 0.30]
      .map(f => parseFloat((rBase * (1 + f)).toFixed(2)));

    // Columnas: precios ±40%
    const precios = [-0.30, -0.20, -0.10, 0, 0.10, 0.20, 0.30]
      .map(f => Math.round(pBase * (1 + f)));

    // Calcular todos los márgenes para escalar colores
    let allVals = [];
    rends.forEach(r => {
      precios.forEach(p => {
        const m = calcMargenAPrecio(p, { ...d, rendDisp: r });
        allVals.push(m);
      });
    });
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);

    function cellColor(v) {
      if (v >= 0) {
        const t = maxV > 0 ? Math.min(v / maxV, 1) : 0;
        const g = Math.round(180 + t * 75);
        return `rgb(${Math.round(255 - t * 80)},${g},${Math.round(255 - t * 80)})`;
      } else {
        const t = minV < 0 ? Math.min(Math.abs(v) / Math.abs(minV), 1) : 0;
        return `rgb(255,${Math.round(180 - t * 100)},${Math.round(180 - t * 100)})`;
      }
    }

    let html = '<table class="ge-sens-tbl"><thead><tr><th>Rend \\ Precio</th>';
    precios.forEach(p => { html += `<th>$${p}</th>`; });
    html += '</tr></thead><tbody>';

    rends.forEach(r => {
      const isBase = Math.abs(r - rBase) < 0.01;
      html += `<tr${isBase ? ' class="ge-base-row"' : ''}><td><strong>${r.toFixed(2)} t/ha</strong></td>`;
      precios.forEach((p, pi) => {
        const m = calcMargenAPrecio(p, { ...d, rendDisp: r });
        const isBaseCol = pi === 3;
        const bg = cellColor(m);
        const textColor = Math.abs(m) > (maxV - minV) * 0.6 ? '#fff' : '#333';
        html += `<td style="background:${bg};color:${textColor};${isBase && isBaseCol ? 'font-weight:700;outline:2px solid #1565c0;' : ''}">${m >= 0 ? '+' : ''}${m.toFixed(0)}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';

    const leyenda = $('ge-sens-leyenda');
    if (leyenda) {
      leyenda.innerHTML = 'Valores en <strong>USD/ha</strong>. Fila y columna resaltadas = escenario actual. Verde = margen positivo · Rojo = pérdida.';
    }

    cont.innerHTML = html;
  }

  // ─── 3. Waterfall de costos ───────────────────────────────────────────────
  function renderWaterfall(d) {
    const canvas = $('ge-waterfall-canvas');
    if (!canvas) return;

    // Componentes del waterfall (orden: ingreso → costos → margen)
    const ingreso     = d.ingBrutDisp;
    const costoDir    = d.costoDir;
    const gasto_com   = d.gasComDisp;
    const arriendo    = d.arrUSD;
    const margen      = d.margenDisp;

    // Para waterfall: base flotante + valor real
    // Chart: categorías como barras apiladas (base invisible + valor)
    const labels = ['Ingreso bruto', 'Costo directo', 'Gastos comerc.'];
    const bases  = [0, ingreso - costoDir, ingreso - costoDir - gasto_com];
    const vals   = [ingreso, -costoDir, -gasto_com];

    if (arriendo > 0) {
      labels.push('Arriendo');
      bases.push(ingreso - costoDir - gasto_com - arriendo);
      vals.push(-arriendo);
    }
    labels.push('Margen neto');
    bases.push(0);
    vals.push(margen);

    const colors = vals.map((v, i) => {
      if (i === 0) return 'rgba(21,101,192,0.85)';           // ingreso: azul
      if (i === labels.length - 1)
        return v >= 0 ? 'rgba(46,125,50,0.85)' : 'rgba(198,40,40,0.85)'; // margen
      return 'rgba(198,40,40,0.7)';                           // costos: rojo
    });

    if (chartWaterfall) { chartWaterfall.destroy(); chartWaterfall = null; }

    chartWaterfall = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '_base',
            data: bases,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            stack: 'wf',
          },
          {
            label: 'USD/ha',
            data: vals.map(v => Math.abs(v)),
            backgroundColor: colors,
            borderRadius: 3,
            stack: 'wf',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (ctx.datasetIndex === 0) return null;
                const v = vals[ctx.dataIndex];
                return ` ${ctx.label}: ${v >= 0 ? '+' : ''}${v.toFixed(0)} USD/ha`;
              },
              filter: item => item.datasetIndex !== 0,
            },
          },
        },
        scales: {
          x: { stacked: true, ticks: { font: { size: 10 } } },
          y: {
            stacked: true,
            title: { display: true, text: 'USD/ha', font: { size: 11 } },
            ticks: { font: { size: 10 }, callback: v => v.toFixed(0) },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
        },
      },
    });

    // Resumen debajo del waterfall
    const resEl = $('ge-wf-resumen');
    if (resEl) {
      const pctDir  = ingreso > 0 ? ((costoDir / ingreso) * 100).toFixed(1) : '—';
      const pctCom  = ingreso > 0 ? ((gasto_com / ingreso) * 100).toFixed(1) : '—';
      const pctArr  = ingreso > 0 ? ((arriendo / ingreso) * 100).toFixed(1) : '—';
      resEl.innerHTML =
        `<span>Ingreso bruto: <strong>$${ingreso.toFixed(0)}</strong></span>` +
        `<span>Costo directo: <strong>$${costoDir.toFixed(0)}</strong> (${pctDir}%)</span>` +
        `<span>Gastos comerc.: <strong>$${gasto_com.toFixed(0)}</strong> (${pctCom}%)</span>` +
        (arriendo > 0 ? `<span>Arriendo: <strong>$${arriendo.toFixed(0)}</strong> (${pctArr}%)</span>` : '') +
        `<span class="${margen >= 0 ? 'wf-pos' : 'wf-neg'}">Margen neto: <strong>${margen >= 0 ? '+' : ''}$${margen.toFixed(0)}</strong>/ha</span>`;
    }
  }

  // ─── Actualizar todo ──────────────────────────────────────────────────────
  function geActualizar() {
    const panel = $('ge-panel');
    if (!panel || panel.style.display === 'none') return;
    try {
      const d = leerInputs();
      renderCurvaMargen(d);
      renderTabSensibilidad(d);
      renderWaterfall(d);
    } catch (e) {
      console.warn('graficos-economia error:', e);
    }
  }

  // ─── Toggle panel ─────────────────────────────────────────────────────────
  window.geTogglePanel = function () {
    const panel = $('ge-panel');
    const btn   = $('ge-toggle-btn');
    if (!panel) return;
    const visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : 'block';
    if (btn) btn.textContent = visible ? '📊 Ver gráficos económicos' : '✖ Ocultar gráficos';
    if (!visible) {
      // Pequeño delay para que el canvas tenga dimensiones
      setTimeout(geActualizar, 80);
    }
  };

  // ─── Instalar observadores de cambio en inputs ────────────────────────────
  function instalarObservadores() {
    const ids = [
      'ec-precio-disp', 'ec-precio-fut', 'ec-rend', 'ec-rend-fut', 'ec-sup',
      'ec-semilla', 'ec-fertil', 'ec-agroquim', 'ec-siembra', 'ec-cosecha', 'ec-otros',
      'ec-km', 'ec-flete-tar', 'ec-comision', 'ec-secado', 'ec-arriendo-qq', 'ec-tenencia',
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(geActualizar, 350);
      });
      el.addEventListener('change', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(geActualizar, 350);
      });
    });

    // También escuchar cuando economia.js emite cambios de cultivo/dólar
    document.addEventListener('ecActualizado', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(geActualizar, 400);
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    instalarObservadores();
    // No render inicial — esperar a que el usuario abra el panel
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
