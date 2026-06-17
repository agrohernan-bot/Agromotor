// ════════════════════════════════════════════════════════
// js/densidad-retaa.js
// Núcleo compartido del módulo Densidad ReTAA.
// Consumido por siembra-variable.js y cultivares.js.
//
// Solo lectura del estado: hereda lat/lon, cultivo y fecha de siembra
// desde el lote activo (amGetLoteActivo) — NO vuelve a pedirlos.
// Expone window.AM_RETAA. Sin escritura sobre globals prohibidos.
// ════════════════════════════════════════════════════════
(function () {
  'use strict';

  // Fuente de datos: global en browser, require en node (test).
  var SRC = (typeof window !== 'undefined' && window.AM_RETAA_DB) ? window.AM_RETAA_DB
          : (typeof require !== 'undefined' ? require('./densidad-retaa-db.js') : null);
  if (!SRC) { return; }
  var SR = SRC.SR, DB = SRC.DB;

  // ── Detección de subregión: bounding box + centroide más cercano ──
  function getSubregion(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return null;
    var cands = SR.filter(function (s) {
      return lat >= s.lat[0] && lat <= s.lat[1] && lon >= s.lon[0] && lon <= s.lon[1];
    });
    var pool = cands.length ? cands : SR;
    var best = null, bd = Infinity;
    pool.forEach(function (s) {
      var cy = (s.lat[0] + s.lat[1]) / 2, cx = (s.lon[0] + s.lon[1]) / 2;
      var dist = Math.hypot(lat - cy, lon - cx);
      if (dist < bd) { bd = dist; best = s; }
    });
    return best;
  }

  // ── Etiqueta de calidad de dato ──────────────────────────
  var FUENTE_LABEL = {
    '◉': '◉ Dato real — relevado ReTAA',
    '◎': '◎ Estimado — interpolado por zona',
    '◈': '◈ Estimado — metodología ReTAA (sorgo)'
  };

  // ── Fecha de siembra (ISO) → código de fecha del cultivo ──
  // Heurística por mes; el usuario puede corregirla. Devuelve null si
  // el cultivo no distingue fecha (sorgo) o no hay dato.
  function derivarFecha(cultivo, fechaISO) {
    var d = DB[cultivo];
    if (!d || !d.fechas) return null;
    var mes = null;
    if (fechaISO) {
      var m = String(fechaISO).match(/^(\d{4})-(\d{2})/);
      if (m) mes = parseInt(m[2], 10);
    }
    if (!mes) return d.fechas[0];
    switch (cultivo) {
      case 'maiz':    return (mes >= 11 || mes <= 1) ? 'd' : 't';      // tardío Nov–Ene
      case 'soja':    return (mes >= 12 || mes <= 1) ? 's' : 'p';      // 2° Dic–Ene
      case 'trigo':   return (mes >= 7) ? 't' : 'o';                   // tardío Jul+
      case 'cebada':  return (mes >= 7) ? 't' : 'o';
      case 'girasol': return d.fechas[d.fechas.length - 1];            // campaña más reciente
      default:        return d.fechas[0];
    }
  }

  // ── Mapear ambiente AgroMotor → código a/m/b ─────────────
  // Acepta tanto 'a'|'m'|'b' como sinónimos descriptivos.
  function normAmbiente(amb) {
    if (amb === 'a' || amb === 'm' || amb === 'b') return amb;
    var s = String(amb || '').toLowerCase();
    if (/alto|elevad|\+/.test(s)) return 'a';
    if (/baj|marginal|−|-/.test(s)) return 'b';
    return 'm';
  }
  function normHidrico(h) {
    if (h === 'n' || h === 's' || h === 'h') return h;
    var s = String(h || '').toLowerCase();
    if (/seco|defic|sequ/.test(s)) return 's';
    if (/húmed|humed|riego/.test(s)) return 'h';
    return 'n';
  }

  // ── Cálculo principal ────────────────────────────────────
  // opts: { lat, lon, cultivo, fecha?, ambiente?, hidrico? }
  // Devuelve null si faltan datos esenciales o el cultivo no está.
  function calcular(opts) {
    opts = opts || {};
    var cultivo = opts.cultivo;
    var d = DB[cultivo];
    if (!d) return null;
    var sr = getSubregion(opts.lat, opts.lon);
    if (!sr) return null;

    var srD = d.sr[sr.id] || d.sr.nuc_n;
    var srFallback = !d.sr[sr.id];               // true si caímos al fallback nacional/núcleo
    var fa = (opts.fecha != null) ? opts.fecha : derivarFecha(cultivo, opts.fechaSiembra);
    var amb = normAmbiente(opts.ambiente);
    var hid = normHidrico(opts.hidrico);

    var densRef = d.rv(srD, fa);
    var densAdj = d.adj(densRef, amb, hid);
    var f1 = typeof d.f1 === 'function' ? d.f1(srD, fa) : null;
    var f2 = typeof d.f2 === 'function' ? d.f2(srD, fa) : null;
    var fuente = srD.camps[0].f;

    return {
      cultivo: cultivo,
      subregion: { id: sr.id, nombre: sr.nm, provincia: sr.prov, color: sr.color },
      fechaCodigo: fa,
      fechaLabel: (d.flab && fa) ? d.flab[d.fechas.indexOf(fa)] : null,
      unidad: d.unit,
      densidad: { valor: densRef, ajustada: densAdj, fuente: fuente, fuenteLabel: FUENTE_LABEL[fuente] || fuente },
      fertilN: f1, fertilP: f2,
      nt: srD.nt,
      campania: d.campActual, informe: d.infActual,
      nota: d.nota,
      esFallback: srFallback,
      filas: d.rows(srD, fa, densAdj),
      tendencia: buildTendencia(d, srD, fa)
    };
  }

  // ── Serie de tendencia (nacional vs subregión) ───────────
  function buildTendencia(d, srD, fa) {
    var tendSr = d.tendVal(srD, fa);
    var nacSerie = d.nac;
    var allCamps = [];
    var seen = {};
    nacSerie.concat(tendSr).forEach(function (x) { if (!seen[x.c]) { seen[x.c] = 1; allCamps.push(x.c); } });
    allCamps.sort();
    var nacMap = {}; nacSerie.forEach(function (x) { nacMap[x.c] = x.v; });
    var srMap = {}; tendSr.forEach(function (x) { srMap[x.c] = x.v; });
    return allCamps.map(function (c) {
      var nv = nacMap[c] != null ? nacMap[c] : null;
      var sv = srMap[c] != null ? srMap[c] : null;
      var f = (tendSr.find(function (x) { return x.c === c; }) || {}).f || '—';
      return { campania: c, nacional: nv, subregion: sv, fuente: f };
    });
  }

  // ── Helper: armar opts desde el lote activo ──────────────
  // Hereda lat/lon, cultivo y fecha de siembra del lote sin pedirlos.
  function prepararDesdeLote(overrides) {
    overrides = overrides || {};
    var lote = (typeof amGetLoteActivo === 'function') ? amGetLoteActivo() : null;
    if (!lote) return Object.keys(overrides).length ? overrides : null;
    var data = lote.data || {};
    var lat = null, lon = null;
    if (typeof data.coord === 'string' && data.coord.indexOf(',') >= 0) {
      var parts = data.coord.split(',');
      lat = parseFloat(parts[0]); lon = parseFloat(parts[1]);
    }
    var cultivo = (data.cultivo || 'soja').toLowerCase();
    var fechaSiembra = (data.planificacionSiembra && pickFechaPlan(data.planificacionSiembra)) || data.fechaSiembra || '';
    var base = {
      lat: lat, lon: lon,
      cultivo: cultivo,
      fechaSiembra: fechaSiembra,
      nombreLote: lote.nombre || data.nombre || 'Lote activo'
    };
    for (var k in overrides) { if (overrides.hasOwnProperty(k)) base[k] = overrides[k]; }
    return base;
  }

  function pickFechaPlan(plan) {
    // Toma la primera fechaSiembraConf disponible en la planificación.
    for (var camp in plan) {
      if (plan.hasOwnProperty(camp) && plan[camp] && plan[camp].fechaSiembraConf) {
        return plan[camp].fechaSiembraConf;
      }
    }
    return '';
  }

  // ── Render de tendencia con Chart.js (solo browser) ──────
  var _chartInst = null;
  function renderTendencia(canvasId, resultado) {
    if (typeof document === 'undefined' || typeof Chart === 'undefined' || !resultado) return null;
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    var tend = resultado.tendencia || [];
    var labels = tend.map(function (t) { return t.campania; });
    var nacData = tend.map(function (t) { return t.nacional; });
    var srData = tend.map(function (t) { return t.subregion; });
    var dashed = resultado.densidad.fuente !== '◉';
    if (_chartInst) { _chartInst.destroy(); _chartInst = null; }
    _chartInst = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Nacional', data: nacData, borderColor: '#c0762e', backgroundColor: 'rgba(192,118,46,.12)', borderWidth: 2, pointRadius: 3, tension: .3 },
          { label: resultado.subregion.nombre, data: srData, borderColor: '#1b5e35', backgroundColor: 'rgba(27,94,53,.12)', borderWidth: 2, pointRadius: 3, tension: .3, borderDash: dashed ? [5, 3] : [] }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 10 }, boxWidth: 14 } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + (c.raw != null ? c.raw : '—') + ' ' + resultado.unidad; } } } },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { size: 9 } } },
          y: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { size: 9 } }, title: { display: true, text: resultado.unidad, font: { size: 9 } } }
        }
      }
    });
    return _chartInst;
  }

  var API = {
    getSubregion: getSubregion,
    derivarFecha: derivarFecha,
    calcular: calcular,
    prepararDesdeLote: prepararDesdeLote,
    renderTendencia: renderTendencia,
    cultivos: function () { return Object.keys(DB); },
    meta: function (cultivo) { var d = DB[cultivo]; return d ? { emoji: d.emoji, label: d.label, unidad: d.unit, fechas: d.fechas, flab: d.flab } : null; },
    FUENTE_LABEL: FUENTE_LABEL
  };

  if (typeof window !== 'undefined') window.AM_RETAA = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
