// ════════════════════════════════════════════════════════
// AGROMOTOR — rotacion.js  v1.0
// Planificador de rotación de cultivos
//
// · Secuencia editable de hasta 5 años
// · Matriz de compatibilidad entre cultivos
// · Balance de nitrógeno acumulado
// · Score de rotación con semáforo
// · Gráfico de N balance + Riesgo sanitario
// · Recomendaciones automáticas
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── DATOS DE CULTIVOS ─────────────────────────────────
  var CULTIVOS = {
    'Soja':     { color:'#d4a017', emoji:'🟡', grupo:'leguminosa',
                  nFij:80, nExt:220, nRes:10,  diasCiclo:140,
                  enfermedadesKey:'soja', mala_hierba:'latifoliadas' },
    'Maíz':     { color:'#e07020', emoji:'🟠', grupo:'cereal_verano',
                  nFij:0,  nExt:180, nRes:30,  diasCiclo:145,
                  enfermedadesKey:'maiz', mala_hierba:'gramineas' },
    'Trigo':    { color:'#9e7b3a', emoji:'🟤', grupo:'cereal_invierno',
                  nFij:0,  nExt:120, nRes:25,  diasCiclo:130,
                  enfermedadesKey:'cereal', mala_hierba:'gramineas' },
    'Girasol':  { color:'#ffd600', emoji:'🌻', grupo:'oleaginosa',
                  nFij:0,  nExt:110, nRes:5,   diasCiclo:130,
                  enfermedadesKey:'girasol', mala_hierba:'latifoliadas' },
    'Sorgo':    { color:'#c62828', emoji:'🔴', grupo:'cereal_verano',
                  nFij:0,  nExt:90,  nRes:35,  diasCiclo:130,
                  enfermedadesKey:'cereal', mala_hierba:'gramineas' },
    'Barbecho': { color:'#78909c', emoji:'🌿', grupo:'barbecho',
                  nFij:0,  nExt:0,   nRes:0,   diasCiclo:180,
                  enfermedadesKey:'barbecho', mala_hierba:'ambas' },
  };

  // Compatibilidad: score 1-5 para (predecesor → sucesor)
  // Fuente: criterios INTA/AACREA rotación pampeana
  var COMPAT = {
    'Soja→Soja':        { score:1, riesgo:'alto',   nota:'Máximo 2 años seguidos. Riesgo SCN, Phytophthora, aphanomyces.' },
    'Soja→Maíz':        { score:5, riesgo:'bajo',   nota:'Excelente. Maíz aprovecha N residual de soja + rompe ciclo de enfermedades.' },
    'Soja→Trigo':        { score:4, riesgo:'bajo',   nota:'Muy buena. Trigo/soja doble cultivo, eficiente en N.' },
    'Soja→Girasol':      { score:3, riesgo:'medio',  nota:'Aceptable. Ambos son dicotiledóneas, revisar latifoliadas.' },
    'Soja→Sorgo':        { score:4, riesgo:'bajo',   nota:'Buena. Rompe ciclos de plagas y enfermedades de soja.' },
    'Soja→Barbecho':     { score:4, riesgo:'bajo',   nota:'Buena práctica. Permite recarga hídrica y control de malezas.' },
    'Maíz→Soja':         { score:5, riesgo:'bajo',   nota:'Excelente. Secuencia clásica pampeana. Alta productividad y sanidad.' },
    'Maíz→Maíz':         { score:2, riesgo:'alto',   nota:'Riesgo de RYLV (Spiroplasma), cornezuelo y acumulación de rastrojo.' },
    'Maíz→Trigo':        { score:3, riesgo:'medio',  nota:'Aceptable. Exceso de rastrojo puede dificultar implantación de trigo.' },
    'Maíz→Girasol':      { score:4, riesgo:'bajo',   nota:'Buena. Diversifica entre monocots y dicots.' },
    'Maíz→Sorgo':        { score:2, riesgo:'alto',   nota:'Dos cereales de verano consecutivos. Riesgo alto de malezas gramíneas.' },
    'Maíz→Barbecho':     { score:3, riesgo:'medio',  nota:'Útil para control de malezas y recarga hídrica.' },
    'Trigo→Soja':        { score:5, riesgo:'bajo',   nota:'Excelente. Doble cultivo clásico. Alta eficiencia del sistema.' },
    'Trigo→Maíz':        { score:4, riesgo:'bajo',   nota:'Muy buena. Cereal invierno + cereal verano, diversificación de epocas.' },
    'Trigo→Trigo':       { score:1, riesgo:'alto',   nota:'Muy alto riesgo de Fusarium, roya y manchas foliares. Evitar.' },
    'Trigo→Girasol':     { score:4, riesgo:'bajo',   nota:'Buena. Diversifica entre graminea y dicotiledonea.' },
    'Trigo→Sorgo':       { score:3, riesgo:'medio',  nota:'Aceptable. Ambos son gramíneas, revisar malezas.' },
    'Trigo→Barbecho':    { score:4, riesgo:'bajo',   nota:'Válido. Permite recuperar estructura y controlar malezas.' },
    'Girasol→Soja':      { score:3, riesgo:'medio',  nota:'Aceptable. Riesgo de Sclerotinia cruzada (ambas dicotiledóneas).' },
    'Girasol→Maíz':      { score:5, riesgo:'bajo',   nota:'Excelente. Combinación ideal. Diversifica grupos y épocas.' },
    'Girasol→Trigo':     { score:4, riesgo:'bajo',   nota:'Buena. Trigo rompe ciclo de Sclerotinia.' },
    'Girasol→Girasol':   { score:1, riesgo:'alto',   nota:'Prohibir. Acumulación de Sclerotinia y Phoma. Mínimo 3-4 años de intervalo.' },
    'Girasol→Sorgo':     { score:4, riesgo:'bajo',   nota:'Buena. Gramínea diversifica.' },
    'Girasol→Barbecho':  { score:3, riesgo:'medio',  nota:'Útil. Reduce inóculo de Sclerotinia antes del próximo ciclo.' },
    'Sorgo→Soja':        { score:4, riesgo:'bajo',   nota:'Buena. Soja rompe ciclo de MDRV y otras enfermedades del sorgo.' },
    'Sorgo→Maíz':        { score:3, riesgo:'medio',  nota:'Moderada. Ambos son cereales de verano. Vigilar malezas gramíneas.' },
    'Sorgo→Trigo':       { score:4, riesgo:'bajo',   nota:'Buena. Cereal invierno después de cereal verano.' },
    'Sorgo→Girasol':     { score:4, riesgo:'bajo',   nota:'Buena. Diversifica. Sorgo acondiciona suelo para girasol.' },
    'Sorgo→Sorgo':       { score:2, riesgo:'alto',   nota:'Riesgo de MDRV y acumulación de rastrojo. Evitar más de 2 años.' },
    'Sorgo→Barbecho':    { score:3, riesgo:'medio',  nota:'Válido para manejar rastrojo y malezas.' },
    'Barbecho→Soja':     { score:4, riesgo:'bajo',   nota:'Buena. Barbecho recarga agua útil para soja de primera.' },
    'Barbecho→Maíz':     { score:4, riesgo:'bajo',   nota:'Buena. Maíz aprovecha la recarga hídrica del barbecho.' },
    'Barbecho→Trigo':    { score:3, riesgo:'medio',  nota:'Aceptable. Precaución con implantación.' },
    'Barbecho→Girasol':  { score:4, riesgo:'bajo',   nota:'Buena. Permite elegir con flexibilidad el siguiente cultivo.' },
    'Barbecho→Sorgo':    { score:4, riesgo:'bajo',   nota:'Buena. Sorgo tolera condiciones variables de inicio.' },
    'Barbecho→Barbecho': { score:2, riesgo:'alto',   nota:'Dos barbechos consecutivos: pérdida económica y riesgo de erosión.' },
  };

  // ── ESTADO ────────────────────────────────────────────
  var _chart = null;
  var _secuencia = [];  // array de nombres de cultivo, hasta 5

  // ── HELPERS ───────────────────────────────────────────
  function gi(id)  { return document.getElementById(id); }
  function gv(id)  { var e = gi(id); return e ? (e.value || '').trim() : ''; }

  function ls(k) {
    try { return localStorage.getItem(k) || ''; } catch(e) { return ''; }
  }

  function cultOpts(selId, selected) {
    var opts = Object.keys(CULTIVOS).map(function(c) {
      var d = CULTIVOS[c];
      return '<option value="' + c + '"' + (c === selected ? ' selected' : '') + '>' +
             d.emoji + ' ' + c + '</option>';
    }).join('');
    var el = gi(selId);
    if (el) el.innerHTML = opts;
  }

  // ── INICIALIZAR SECUENCIA DESDE LOTE ACTIVO ───────────
  function inicializar() {
    var cultActivo = ls('am_cultivo') || ls('s-cultivo-val') || 'Soja';
    // Normalizar nombre
    var nombre = Object.keys(CULTIVOS).find(function(c) {
      return c.toLowerCase() === cultActivo.toLowerCase();
    }) || 'Soja';

    _secuencia = [nombre, 'Maíz', 'Trigo', 'Soja', 'Maíz'];

    // Rellenar los selects
    for (var i = 0; i < 5; i++) {
      cultOpts('rot-cult-' + i, _secuencia[i]);
    }

    // Marcar año 0 como "este año" visualmente
    actualizarEtiquetas();
  }

  function actualizarEtiquetas() {
    var anioBase = new Date().getFullYear();
    for (var i = 0; i < 5; i++) {
      var lbl = gi('rot-anio-lbl-' + i);
      if (lbl) lbl.textContent = anioBase + i;
    }
  }

  // ── CALCULAR BALANCE N ────────────────────────────────
  function calcularN(secuencia) {
    var nAcum = 0;
    var result = [];
    secuencia.forEach(function(nombre) {
      var d = CULTIVOS[nombre] || CULTIVOS['Soja'];
      // N disponibilizado = fijación + aporte residuos - extracción por cosecha
      var nBalance = d.nFij + d.nRes - d.nExt;
      nAcum += nBalance;
      result.push({ nombre: nombre, nBalance: nBalance, nAcum: nAcum });
    });
    return result;
  }

  // ── CALCULAR COMPATIBILIDADES ─────────────────────────
  function calcularCompat(secuencia) {
    var result = [];
    for (var i = 0; i < secuencia.length; i++) {
      var actual = secuencia[i];
      var anterior = i > 0 ? secuencia[i-1] : null;
      var key = anterior ? (anterior + '→' + actual) : null;
      var compat = key ? (COMPAT[key] || { score:3, riesgo:'medio', nota:'Sin datos específicos.' }) : null;
      result.push({ cultivo: actual, anterior: anterior, compat: compat });
    }
    return result;
  }

  // ── CALCULAR SCORE GLOBAL ─────────────────────────────
  function calcularScore(secuencia) {
    if (secuencia.length < 2) return 100;
    var suma = 0;
    var n = 0;
    for (var i = 1; i < secuencia.length; i++) {
      var key = secuencia[i-1] + '→' + secuencia[i];
      var c = COMPAT[key];
      if (c) { suma += c.score; n++; }
    }
    return n > 0 ? Math.round((suma / n) * 20) : 60;  // 1-5 → 0-100
  }

  // Conteo de cultivos para diversidad
  function calcularDiversidad(secuencia) {
    var uniq = {};
    secuencia.forEach(function(c) { uniq[c] = true; });
    return Object.keys(uniq).length;
  }

  // ── RENDER TABLA ──────────────────────────────────────
  function renderTabla(secuencia, nData, compatData) {
    var cont = gi('rot-tabla');
    if (!cont) return;

    var riesgoColor = { 'bajo':'#2e7d32', 'medio':'#e65100', 'alto':'#c62828' };
    var scoreColor  = function(s) { return s >= 4 ? '#2e7d32' : s === 3 ? '#e65100' : '#c62828'; };

    var html = '<table class="rot-tbl">' +
      '<thead><tr>' +
      '<th>Año</th><th>Cultivo</th><th>Antecesor</th>' +
      '<th>Compat.</th><th>Riesgo sanitario</th>' +
      '<th>Balance N (kg/ha)</th><th>N acum. (kg/ha)</th>' +
      '</tr></thead><tbody>';

    var anioBase = new Date().getFullYear();

    secuencia.forEach(function(nombre, i) {
      var nd = nData[i];
      var cd = compatData[i];
      var scoreVal = cd.compat ? cd.compat.score : '—';
      var riesgoVal = cd.compat ? cd.compat.riesgo : '—';
      var d = CULTIVOS[nombre] || {};

      html += '<tr>' +
        '<td style="font-weight:600;color:#5A3A10">' + (anioBase+i) + '</td>' +
        '<td>' +
          '<span style="display:inline-flex;align-items:center;gap:.35rem">' +
          '<span style="width:10px;height:10px;border-radius:50%;background:' + (d.color||'#888') + ';flex-shrink:0"></span>' +
          nombre + '</span></td>' +
        '<td style="color:rgba(74,46,26,.6);font-size:.75rem">' + (cd.anterior || '—') + '</td>' +
        '<td style="font-weight:700;color:' + (cd.compat ? scoreColor(scoreVal) : '#888') + ';text-align:center">' +
          (cd.compat ? '★'.repeat(scoreVal) + '☆'.repeat(5-scoreVal) : '—') + '</td>' +
        '<td style="font-weight:600;color:' + (riesgoColor[riesgoVal]||'#888') + ';text-align:center">' +
          (riesgoVal.charAt(0).toUpperCase()+riesgoVal.slice(1)) + '</td>' +
        '<td style="text-align:right;font-weight:600;color:' + (nd.nBalance >= 0 ? '#2e7d32' : '#c62828') + '">' +
          (nd.nBalance >= 0 ? '+' : '') + nd.nBalance + '</td>' +
        '<td style="text-align:right;font-weight:700;color:' + (nd.nAcum >= 0 ? '#2e7d32' : '#c62828') + '">' +
          (nd.nAcum >= 0 ? '+' : '') + nd.nAcum + '</td>' +
      '</tr>';
    });

    html += '</tbody></table>';
    cont.innerHTML = html;
  }

  // ── RENDER OBSERVACIONES ──────────────────────────────
  function renderObservaciones(secuencia, compatData, score, diversidad) {
    var cont = gi('rot-obs');
    if (!cont) return;

    var obs = [];

    // Score global
    if (score >= 80) {
      obs.push({ nivel:'ok',   texto:'Rotación <strong>excelente</strong> — alta diversificación y bajo riesgo sanitario.' });
    } else if (score >= 60) {
      obs.push({ nivel:'warn', texto:'Rotación <strong>aceptable</strong> — hay margen de mejora en secuencias de bajo puntaje.' });
    } else {
      obs.push({ nivel:'err',  texto:'Rotación <strong>deficiente</strong> — alto riesgo sanitario y/o baja diversificación.' });
    }

    // Diversidad
    if (diversidad < 3) {
      obs.push({ nivel:'warn', texto:'Baja diversidad: solo ' + diversidad + ' cultivo(s) distintos. Considerá incorporar más especies para reducir riesgos.' });
    }

    // Detectar repeticiones
    for (var i = 1; i < secuencia.length; i++) {
      if (secuencia[i] === secuencia[i-1]) {
        var key = secuencia[i-1] + '→' + secuencia[i];
        var c = COMPAT[key];
        obs.push({ nivel: c && c.score <= 2 ? 'err' : 'warn',
          texto: '<strong>' + secuencia[i] + '</strong> dos años seguidos — ' +
                 (c ? c.nota : 'revisar riesgo sanitario.') });
      }
    }

    // Advertencia Soja-Soja extendida (3+ años)
    var sojaConsec = 0;
    secuencia.forEach(function(c) {
      if (c === 'Soja') sojaConsec++;
      else sojaConsec = 0;
      if (sojaConsec >= 3) {
        obs.push({ nivel:'err', texto:'<strong>3 o más años de soja consecutivos</strong> — riesgo muy alto de SCN (nematodo del quiste de soja) y enfermedades de suelo.' });
        sojaConsec = 0;
      }
    });

    // Falta de cereal
    var tieneCereal = secuencia.some(function(c) {
      return CULTIVOS[c] && CULTIVOS[c].grupo.includes('cereal');
    });
    if (!tieneCereal) {
      obs.push({ nivel:'warn', texto:'Rotación sin cereales — considerá incorporar Trigo, Maíz o Sorgo para diversificar y controlar malezas de hoja ancha.' });
    }

    // Recomendaciones de mejora
    compatData.forEach(function(cd, i) {
      if (cd.compat && cd.compat.score <= 2) {
        obs.push({ nivel:'err',
          texto:'Año ' + (new Date().getFullYear()+i) + ': <strong>' + (cd.anterior||'—') + ' → ' + cd.cultivo + '</strong> — ' + cd.compat.nota });
      }
    });

    var nivColor = { ok:'#e8f5e9', warn:'#fff8e1', err:'#ffebee' };
    var nivBorder = { ok:'#a5d6a7', warn:'#ffe082', err:'#ef9a9a' };
    var nivIcon = { ok:'✅', warn:'⚠️', err:'❌' };

    cont.innerHTML = obs.map(function(o) {
      return '<div style="display:flex;gap:.5rem;align-items:flex-start;padding:.45rem .65rem;' +
        'border-radius:6px;margin-bottom:.35rem;font-size:.77rem;line-height:1.4;' +
        'background:' + nivColor[o.nivel] + ';border:1px solid ' + nivBorder[o.nivel] + '">' +
        '<span>' + nivIcon[o.nivel] + '</span>' +
        '<span>' + o.texto + '</span></div>';
    }).join('');
  }

  // ── RENDER SCORE ──────────────────────────────────────
  function renderScore(score) {
    var el = gi('rot-score-val');
    var bar = gi('rot-score-bar');
    var lbl = gi('rot-score-lbl');
    if (!el) return;

    el.textContent = score + '/100';
    var col = score >= 80 ? '#2e7d32' : score >= 60 ? '#e65100' : '#c62828';
    el.style.color = col;

    if (bar) {
      bar.style.width = score + '%';
      bar.style.background = col;
    }
    if (lbl) {
      lbl.textContent = score >= 80 ? 'Excelente' : score >= 60 ? 'Aceptable' : 'Mejorar';
      lbl.style.color = col;
    }
  }

  // ── RENDER GRÁFICO ────────────────────────────────────
  function renderGrafico(secuencia, nData) {
    var canvas = gi('rot-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (_chart) { _chart.destroy(); _chart = null; }

    var anioBase = new Date().getFullYear();
    var labels   = secuencia.map(function(c, i) { return (anioBase+i) + '\n' + c; });
    var nBalData = nData.map(function(d) { return d.nBalance; });
    var nAcumData = nData.map(function(d) { return d.nAcum; });

    var mobile = window.innerWidth < 480;
    canvas.parentElement.style.height = (mobile ? 180 : 220) + 'px';

    _chart = new Chart(canvas.getContext('2d'), {
      data: {
        labels: labels,
        datasets: [
          {
            type: 'bar',
            label: 'Balance N por año (kg/ha)',
            data: nBalData,
            backgroundColor: nBalData.map(function(v) {
              return v >= 0 ? 'rgba(46,125,50,.55)' : 'rgba(198,40,40,.45)';
            }),
            borderColor: nBalData.map(function(v) {
              return v >= 0 ? 'rgba(46,125,50,.9)' : 'rgba(198,40,40,.8)';
            }),
            borderWidth: 1.5,
            borderRadius: 4,
            order: 2,
          },
          {
            type: 'line',
            label: 'N acumulado (kg/ha)',
            data: nAcumData,
            borderColor: '#2A5A8C',
            backgroundColor: 'rgba(42,90,140,.08)',
            borderWidth: 2.5,
            pointRadius: 5,
            pointBackgroundColor: '#2A5A8C',
            fill: true,
            tension: 0.3,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode:'index', intersect:false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font:{family:"'DM Sans',sans-serif",size:11}, padding:12, usePointStyle:true },
          },
          tooltip: {
            backgroundColor: 'rgba(252,249,242,.97)',
            borderColor: 'rgba(60,34,16,.12)',
            borderWidth: 1,
            titleColor: 'rgba(28,18,8,.8)',
            bodyColor: 'rgba(28,18,8,.65)',
            callbacks: {
              label: function(ctx) {
                return ' ' + ctx.dataset.label + ': ' + (ctx.parsed.y >= 0 ? '+' : '') + ctx.parsed.y + ' kg N/ha';
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color:'rgba(60,34,16,.05)' },
            ticks: { font:{family:"'DM Sans',sans-serif",size:10}, color:'rgba(28,18,8,.55)' },
          },
          y: {
            grid: { color:'rgba(60,34,16,.06)' },
            ticks: {
              font:{family:"'DM Sans',sans-serif",size:10},
              color:'rgba(28,18,8,.55)',
              callback: function(v) { return (v >= 0 ? '+' : '') + v + ' N'; },
            },
          },
        },
      },
    });
  }

  // ── ACTUALIZAR (llamado en cada cambio) ───────────────
  window.rotActualizar = function () {
    // Leer secuencia de los selects
    _secuencia = [];
    for (var i = 0; i < 5; i++) {
      _secuencia.push(gv('rot-cult-' + i) || 'Soja');
    }

    var nData      = calcularN(_secuencia);
    var compatData = calcularCompat(_secuencia);
    var score      = calcularScore(_secuencia);
    var diversidad = calcularDiversidad(_secuencia);

    renderScore(score);
    renderTabla(_secuencia, nData, compatData);
    renderObservaciones(_secuencia, compatData, score, diversidad);
    setTimeout(function() { renderGrafico(_secuencia, nData); }, 60);
  };

  // ── EXPORTAR PNG ──────────────────────────────────────
  window.rotExportar = function () {
    var canvas = gi('rot-chart');
    if (!canvas) return;
    var tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    var ctx = tmp.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(canvas, 0, 0);
    var a = document.createElement('a');
    a.download = 'rotacion-cultivos.png';
    a.href = tmp.toDataURL('image/png');
    a.click();
  };

  // ── INIT ─────────────────────────────────────────────
  function init() {
    // Esperar un tick para que el panel esté en DOM
    setTimeout(function() {
      inicializar();
      rotActualizar();
    }, 120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
