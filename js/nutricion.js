// ════════════════════════════════════════════════════════
// AGROMOTOR — nutricion.js
// Módulo: Nutrición de Cultivo
// Fusiona: Plan de Fertilización + Dosis Óptima + Balance
// Única fuente de verdad para datos agronómicos de cultivos
// ════════════════════════════════════════════════════════

(function() {
  window.AM = window.AM || {};
  window.AM.nutricion = {};

// ════════════════════════════════════════════════════════
// CULTIVO_DB — datos unificados por cultivo
// Integra: DB.npk + FO_CURVAS + BN_EXTRACCION (3 fuentes → 1)
// ════════════════════════════════════════════════════════
var CULTIVO_DB = {
  Maiz: {
    nombre: 'Maíz', rendR: [4, 15], esFBN: false,
    req:  { N: 25, P: 4, K: 3 },           // kg nutriente / t grano (requerimiento)
    ext:  {                                  // extracción real (kg / t grano)
      N:    { grano: 120, rastrojo: 30 },
      P2O5: { grano: 22,  rastrojo: 8  },
      K2O:  { grano: 15,  rastrojo: 65 },
      S:    { grano: 8,   rastrojo: 4  },
    },
    curvas: {                                // Y = Yb + b·X + c·X²  (INTA Marcos Juárez)
      N: { Yb: 6500, b: 35.0, c: -0.115, EFF: 0.65, rango: [0, 200] },
      P: { Yb: 6500, b: 18.0, c: -0.080, EFF: 0.30, rango: [0, 80]  },
      S: { Yb: 6500, b:  6.0, c: -0.030, EFF: 0.50, rango: [0, 40]  },
    },
  },
  Soja: {
    nombre: 'Soja', rendR: [1.5, 5], esFBN: true,
    req:  { N: 0, P: 2, K: 1.5 },
    ext:  {
      N:    { grano: 75, rastrojo: 12 },
      P2O5: { grano: 18, rastrojo: 4  },
      K2O:  { grano: 20, rastrojo: 30 },
      S:    { grano: 5,  rastrojo: 2  },
    },
    curvas: {
      N: { Yb: 3200, b:  4.0, c: -0.025, EFF: 0.50, rango: [0, 50] },
      P: { Yb: 3200, b: 14.0, c: -0.070, EFF: 0.30, rango: [0, 80] },
      S: { Yb: 3200, b:  8.0, c: -0.045, EFF: 0.50, rango: [0, 30] },
    },
  },
  Trigo: {
    nombre: 'Trigo', rendR: [2, 8], esFBN: false,
    req:  { N: 28, P: 5, K: 4 },
    ext:  {
      N:    { grano: 30, rastrojo: 12 },
      P2O5: { grano: 10, rastrojo: 4  },
      K2O:  { grano: 7,  rastrojo: 18 },
      S:    { grano: 4,  rastrojo: 2  },
    },
    curvas: {
      N: { Yb: 3500, b: 22.0, c: -0.080, EFF: 0.60, rango: [0, 160] },
      P: { Yb: 3500, b: 10.0, c: -0.055, EFF: 0.28, rango: [0, 60]  },
      S: { Yb: 3500, b:  5.5, c: -0.030, EFF: 0.50, rango: [0, 30]  },
    },
  },
  Girasol: {
    nombre: 'Girasol', rendR: [1.5, 4], esFBN: false,
    req:  { N: 18, P: 3, K: 2.5 },
    ext:  {
      N:    { grano: 50,  rastrojo: 20  },
      P2O5: { grano: 20,  rastrojo: 8   },
      K2O:  { grano: 15,  rastrojo: 105 },
      S:    { grano: 6,   rastrojo: 3   },
    },
    curvas: {
      N: { Yb: 2200, b: 14.0, c: -0.055, EFF: 0.55, rango: [0, 120] },
      P: { Yb: 2200, b:  8.0, c: -0.040, EFF: 0.28, rango: [0, 60]  },
      S: { Yb: 2200, b:  6.0, c: -0.035, EFF: 0.50, rango: [0, 30]  },
    },
  },
  Sorgo: {
    nombre: 'Sorgo', rendR: [3, 10], esFBN: false,
    req:  { N: 22, P: 4, K: 3 },
    ext:  {
      N:    { grano: 55, rastrojo: 20 },
      P2O5: { grano: 15, rastrojo: 6  },
      K2O:  { grano: 15, rastrojo: 50 },
      S:    { grano: 4,  rastrojo: 2  },
    },
    curvas: {
      N: { Yb: 5000, b: 25.0, c: -0.090, EFF: 0.60, rango: [0, 160] },
      P: { Yb: 5000, b: 12.0, c: -0.060, EFF: 0.28, rango: [0, 60]  },
      S: { Yb: 5000, b:  5.0, c: -0.025, EFF: 0.50, rango: [0, 30]  },
    },
  },
  Cebada: {
    nombre: 'Cebada', rendR: [2, 7], esFBN: false,
    req:  { N: 23, P: 4, K: 3.5 },
    ext:  {
      N:    { grano: 28, rastrojo: 10 },
      P2O5: { grano: 10, rastrojo: 4  },
      K2O:  { grano: 6,  rastrojo: 16 },
      S:    { grano: 3,  rastrojo: 2  },
    },
    curvas: {
      N: { Yb: 3000, b: 20.0, c: -0.075, EFF: 0.60, rango: [0, 140] },
      P: { Yb: 3000, b:  9.0, c: -0.050, EFF: 0.28, rango: [0, 60]  },
      S: { Yb: 3000, b:  5.0, c: -0.028, EFF: 0.50, rango: [0, 30]  },
    },
  },
  Colza: {
    nombre: 'Colza', rendR: [1.5, 4.5], esFBN: false,
    req:  { N: 35, P: 7, K: 6 },
    ext:  {
      N:    { grano: 40, rastrojo: 18 },
      P2O5: { grano: 20, rastrojo: 8  },
      K2O:  { grano: 15, rastrojo: 60 },
      S:    { grano: 10, rastrojo: 5  },
    },
    curvas: {
      N: { Yb: 2000, b: 18.0, c: -0.065, EFF: 0.55, rango: [0, 160] },
      P: { Yb: 2000, b:  8.0, c: -0.042, EFF: 0.28, rango: [0, 60]  },
      S: { Yb: 2000, b:  8.0, c: -0.045, EFF: 0.50, rango: [0, 40]  },
    },
  },
};

// Fertilizantes de referencia (única definición compartida)
var NC_FERTS = {
  N: { nombre: 'Urea (46-0-0)',   fraccion: 0.46, idPrecio: 'nc-precio-n', precioRef: 380 },
  P: { nombre: 'MAP (11-52-0)',   fraccion: 0.52, idPrecio: 'nc-precio-p', precioRef: 620 },
  S: { nombre: 'SuMag (22% S)',   fraccion: 0.22, idPrecio: 'nc-precio-s', precioRef: 280 },
  K: { nombre: 'KCl (60% K₂O)',  fraccion: 0.60, idPrecio: 'nc-precio-k', precioRef: 480 },
};

// Eficiencias de absorción (fracción del nutriente fertilizante aprovechada por el cultivo)
var NC_EFIC = { N: 0.65, P: 0.25, K: 0.40, S: 0.50 };

// Niveles objetivo en suelo (kg/ha) para estrategia regenerativa
var NC_NIVEL_OBJ = { N: 80, P: 40, K: 200, S: 20 };

// ── ESTRATEGIAS ──────────────────────────────────────────
window._ncEstrategia = 'productiva';

var _NC_ESTR_DESC = {
  productiva:   'Aprovecha el stock del suelo y fertiliza solo el déficit real. Mínimo insumo para alcanzar el rendimiento objetivo.',
  equilibrada:  'Repone exactamente lo que el grano exporta. Mantiene el nivel de nutrientes del suelo estable campaña a campaña.',
  regenerativa: 'Aporta un excedente calculado para recuperar el suelo gradualmente. Indica en cuántas campañas se alcanza el nivel objetivo.'
};

window.ncSetEstrategia = function(s) {
  window._ncEstrategia = s;
  var colores = {
    productiva:   { bg: 'rgba(200,162,85,.13)',    txt: '#7A5A10', bdr: 'rgba(200,162,85,.45)'  },
    equilibrada:  { bg: 'rgba(42,90,140,.12)',     txt: '#2A5A8C', bdr: 'rgba(42,90,140,.35)'  },
    regenerativa: { bg: 'rgba(74,140,92,.13)',     txt: '#1b5e35', bdr: 'rgba(74,140,92,.4)'   },
  };
  ['productiva', 'equilibrada', 'regenerativa'].forEach(function(k) {
    var btn = document.getElementById('nc-chip-estr-' + k);
    if (!btn) return;
    var activo = k === s;
    var c = colores[k];
    btn.style.background  = activo ? c.bg   : 'rgba(74,46,26,.04)';
    btn.style.color       = activo ? c.txt  : 'rgba(74,46,26,.45)';
    btn.style.border      = activo ? '1.5px solid ' + c.bdr : '1.5px solid rgba(74,46,26,.12)';
    btn.style.fontWeight  = activo ? '700'  : '500';
  });
  var desc = document.getElementById('nc-estrategia-desc');
  if (desc) desc.textContent = _NC_ESTR_DESC[s] || '';
};

// ── HELPERS ──────────────────────────────────────────────
function ncGv(id) { var e = document.getElementById(id); return e ? (e.value || '') : ''; }
function ncGf(id) { return parseFloat(document.getElementById(id) && document.getElementById(id).value) || 0; }
function ncCultStr() {
  // 1. Buscar en planificacionSiembra el grupo que coincide con el rendimientoObjetivo activo
  try {
    var _lt = typeof amGetLoteActivo === 'function' ? amGetLoteActivo() : null;
    if (_lt && _lt.data) {
      var d = _lt.data;
      var rend = parseFloat(d.rendimientoObjetivo);
      var ps = d.planificacionSiembra || {};
      var gs = Object.keys(ps);
      for (var i = 0; i < gs.length; i++) {
        var g = ps[gs[i]];
        if (g && g.cultivo && g.rendimientoObjetivo && Math.abs(parseFloat(g.rendimientoObjetivo) - rend) < 0.01) {
          return g.cultivo;
        }
      }
      if (d.cultivoPlanificacion) return d.cultivoPlanificacion;
      if (d.cultivo) return d.cultivo;
    }
  } catch(_) {}
  // 2. Fallback al select del módulo Siembra
  return document.getElementById('s-cultivo') ? document.getElementById('s-cultivo').value : 'Soja';
}
function ncCultivoKey(c) {
  var raw = (c == null ? '' : String(c)).trim();
  var map = { 'Maíz':'Maiz', 'Maiz':'Maiz', 'maíz':'Maiz', 'maiz':'Maiz',
              'Soja':'Soja', 'soja':'Soja',
              'Trigo':'Trigo', 'trigo':'Trigo',
              'Girasol':'Girasol', 'girasol':'Girasol',
              'Sorgo':'Sorgo', 'sorgo':'Sorgo',
              'Cebada':'Cebada', 'cebada':'Cebada',
              'Colza':'Colza', 'colza':'Colza' };
  if (map[raw]) return map[raw];
  var norm = raw.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[_-]/g, ' ');
  if (norm.indexOf('maiz') >= 0) return 'Maiz';
  if (norm.indexOf('soja') >= 0) return 'Soja';
  if (norm.indexOf('trigo') >= 0) return 'Trigo';
  if (norm.indexOf('girasol') >= 0) return 'Girasol';
  if (norm.indexOf('sorgo') >= 0) return 'Sorgo';
  if (norm.indexOf('cebada') >= 0) return 'Cebada';
  if (norm.indexOf('colza') >= 0) return 'Colza';
  return raw;
}

function ncTieneDatos(obj) {
  if (!obj) return false;
  return Object.keys(obj).some(function(k) { return k !== 'esFallback' && obj[k] != null; });
}

// Convierte _sueloDatos a kg/ha para el plan de fertilización
function ncNum(v) {
  if (v == null || v === '') return null;
  var m = String(v).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  var n = parseFloat(m[0]);
  return isFinite(n) ? n : null;
}

function ncSgDesdeLegacy(lote) {
  var d = lote && lote.data ? lote.data : {};
  var sg = {
    ph:      ncNum(d['sg-ph']),
    clay:    ncNum(d['sg-clay']),
    sand:    ncNum(d['sg-sand']),
    soc:     ncNum(d['sg-soc']),
    n:       ncNum(d['sg-n']),
    da:      ncNum(d['sg-da']),
    cec:     ncNum(d['sg-cec']),
    textura: d['sg-textura'] || d.suelo || null,
    lat:     ncNum(d['sg-lat']),
    lon:     ncNum(d['sg-lon']),
  };
  Object.keys(sg).forEach(function(k) {
    if (sg[k] == null || sg[k] === '') delete sg[k];
  });
  return ncTieneDatos(sg) ? sg : null;
}

function ncCoordDesdeLote(lote, sg) {
  if (sg && sg.lat != null && sg.lon != null) return { lat: sg.lat, lon: sg.lon };
  var d = lote && lote.data ? lote.data : {};
  var parts = String(d.coord || '').split(',');
  if (parts.length === 2) {
    var lat = ncNum(parts[0]);
    var lon = ncNum(parts[1]);
    if (lat != null && lon != null) return { lat: lat, lon: lon };
  }
  return null;
}

function ncPersistirSg(lote, sg) {
  if (!lote || !sg) return;
  lote.data = lote.data || {};
  lote.data.sgDatos = sg;
  try {
    localStorage.setItem('sg_full_' + lote.id, JSON.stringify({
      ts: Date.now(), lat: sg.lat, lon: sg.lon, datos: sg
    }));
  } catch(_) {}
  if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
}

function ncRestaurarSgDatos() {
  var sg = window._sgDatos || null;
  if (ncTieneDatos(sg)) return sg;

  var lote = ncLoteActivo();
  if (lote && lote.data && ncTieneDatos(lote.data.sgDatos)) {
    window._sgDatos = lote.data.sgDatos;
    return window._sgDatos;
  }

  try {
    if (lote && lote.id) {
      var raw = localStorage.getItem('sg_full_' + lote.id);
      if (raw) {
        var parsed = JSON.parse(raw);
        var datos = parsed && (parsed.datos || parsed.data);
        if (ncTieneDatos(datos)) {
          window._sgDatos = datos;
          return datos;
        }
      }
    }
  } catch(_) {}

  sg = ncSgDesdeLegacy(lote);
  if (ncTieneDatos(sg)) {
    window._sgDatos = sg;
    return sg;
  }
  return null;
}

var _ncPkzPromise = null;
async function ncHidratarPKZ() {
  var lote = ncLoteActivo();
  var sg = ncRestaurarSgDatos();
  if (!ncTieneDatos(sg)) return null;
  if (sg.p != null && sg.k != null) return sg;
  if (typeof buscarPKZ !== 'function') return sg;

  var coord = ncCoordDesdeLote(lote, sg);
  if (!coord) return sg;
  if (_ncPkzPromise) return _ncPkzPromise;

  _ncPkzPromise = buscarPKZ(coord.lat, coord.lon, sg.textura || 'Molisol')
    .then(function(pkz) {
      if (pkz) {
        if (pkz.p  != null) sg.p  = pkz.p;
        if (pkz.k  != null) sg.k  = pkz.k;
        if (pkz.zn != null) sg.zn = pkz.zn;
        sg.fuente_pkz     = pkz.fuente_pkz;
        sg.fuente_pkz_id  = pkz.fuente_pkz_id;
        sg.fuente_pkz_det = pkz.fuente_pkz_det;
      }
      sg.lat = coord.lat;
      sg.lon = coord.lon;
      window._sgDatos = sg;
      ncPersistirSg(lote, sg);
      if (typeof sueloFusionar === 'function') sueloFusionar();
      return sg;
    })
    .catch(function() { return sg; })
    .finally(function() { _ncPkzPromise = null; });

  return _ncPkzPromise;
}

function ncSueloAkg(sd) {
  // Si _sueloDatos está vacío, leer _sgDatos; si también está vacío leer localStorage
  // 'sg_full_<loteId>' (guardado por siembra-apis.js sin pasar por cacheGuardar)
  if (!ncTieneDatos(sd)) {
    var sg = ncRestaurarSgDatos() || {};
    if (!ncTieneDatos(sg)) {
      try {
        var _lt = typeof ncLoteActivo === 'function' ? ncLoteActivo() : null;
        if (_lt && _lt.id) {
          var _raw = localStorage.getItem('sg_full_' + _lt.id);
          if (_raw) {
            var _p = JSON.parse(_raw);
            var _datos = _p && (_p.datos || _p.data);
            if (ncTieneDatos(_datos)) { sg = _datos; window._sgDatos = sg; }
          }
        }
      } catch(_) {}
    }
    if (!ncTieneDatos(sg)) return {};
    var sgDa = sg.da || 1.25;
    var sgMo = sg.soc != null ? sg.soc * 1.724 / 10 : null; // SOC g/kg → MO%
    var rsg = {};
    if (sgMo != null) {
      rsg.N = { valor: Math.round(sgMo * 20), fuente: 'estimado' };
    } else if (sg.n != null) {
      rsg.N = { valor: Math.round(sg.n * sgDa * 45), fuente: 'soilgrids' };
    }
    if (sg.p  != null) rsg.P = { valor: Math.round(sg.p  * sgDa * 2), fuente: sg.fuente_pkz_id || 'estimado' };
    if (sg.k  != null) rsg.K = { valor: Math.round(sg.k  * sgDa * 2), fuente: sg.fuente_pkz_id || 'estimado' };
    rsg.S = { valor: Math.round(8 + (sgMo != null ? sgMo * 1.5 : 0)), fuente: 'estimado' };
    return rsg;
  }
  var da  = (sd.da && sd.da.valor) ? sd.da.valor : 1.25;   // g/cm³
  var res = {};

  // N mineralizable (prioridad: lab N > MO método INTA > N total SoilGrids con tasa mineralización)
  if (sd.n && sd.n.fuente === 'laboratorio') {
    // N total de laboratorio (g/kg) → mineralizable (N × DA × 3000 kg/ha × 1.5%/año)
    res.N = { valor: Math.round(sd.n.valor * da * 45), fuente: 'laboratorio' };
  } else if (sd.mo && sd.mo.valor != null) {
    // MO (%) → N mineralizable ≈ 20 kg N/% MO/año (metodología INTA para Pampa)
    var fuenteMO = sd.mo.fuente === 'laboratorio' ? 'lab·MO' : 'estimado';
    res.N = { valor: Math.round(sd.mo.valor * 20), fuente: fuenteMO };
  } else if (sd.n && sd.n.valor != null) {
    // N total SoilGrids (g/kg) → mineralizable: N × DA × 3000 kg/ha × 1.5%/año = N × DA × 45
    res.N = { valor: Math.round(sd.n.valor * da * 45), fuente: sd.n.fuente };
  }

  // P disponible (ppm Bray) → kg/ha en 0-20cm: P_ppm × DA × 0.20m × 0.1 × 10 = P × DA × 2
  if (sd.p && sd.p.valor != null)
    res.P = { valor: Math.round(sd.p.valor * da * 2), fuente: sd.p.fuente };
  // K intercambiable (ppm) → kg/ha 0-20cm
  if (sd.k && sd.k.valor != null)
    res.K = { valor: Math.round(sd.k.valor * da * 2), fuente: sd.k.fuente };
  // S estimado (mineralización + MO)
  var moVal = (sd.mo && sd.mo.valor != null) ? sd.mo.valor : null;
  res.S = { valor: Math.round(8 + (moVal ? moVal * 1.5 : 0)), fuente: 'estimado' };
  return res;
}

// Dosis óptima económica: punto donde costo kg fert = valor kg grano extra
function ncCalcOptima(curva, Pg_kg, Pf_kg) {
  var ratio = Pf_kg / (Pg_kg * curva.EFF);
  var Xopt  = (curva.b - ratio) / (-2 * curva.c);
  Xopt = Math.max(curva.rango[0], Math.min(curva.rango[1], Xopt));
  var deltaY   = Math.max(0, (curva.Yb + curva.b * Xopt + curva.c * Xopt * Xopt) - curva.Yb);
  var beneficio = deltaY * Pg_kg;
  var costo     = Xopt * Pf_kg;
  return { Xopt: Xopt, beneficio: beneficio, costo: costo, bc: costo > 0 ? beneficio / costo : 0 };
}

// ── RENDIMIENTO SUGERIDO ─────────────────────────────────
// Calcula máximo regional y recomendado según calidad del suelo
function ncSugerirRendimiento(cultKey, sd) {
  var db = CULTIVO_DB[cultKey];
  if (!db) return null;
  var rMax = db.rendR[1];
  var factor = 1.0;
  var notas = [];
  var tieneDatos = sd && Object.keys(sd).length > 0;
  if (tieneDatos) {
    if (sd.mo && sd.mo.valor != null) {
      var mo = sd.mo.valor;
      if      (mo >= 3.5) factor *= 1.00;
      else if (mo >= 2.5) { factor *= 0.90; notas.push('MO ' + mo.toFixed(1) + '%'); }
      else if (mo >= 1.5) { factor *= 0.78; notas.push('MO baja ' + mo.toFixed(1) + '%'); }
      else                { factor *= 0.62; notas.push('MO muy baja ' + mo.toFixed(1) + '%'); }
    } else {
      factor *= 0.90;
    }
    if (sd.ph && sd.ph.valor != null) {
      var ph = sd.ph.valor;
      if      (ph >= 6.0 && ph <= 7.2) factor *= 1.00;
      else if (ph >= 5.5 && ph < 6.0)  { factor *= 0.93; notas.push('pH ' + ph.toFixed(1)); }
      else if (ph < 5.5)               { factor *= 0.80; notas.push('pH ácido ' + ph.toFixed(1)); }
      else if (ph > 7.5)               { factor *= 0.88; notas.push('pH alcalino ' + ph.toFixed(1)); }
    }
    if (sd.p && sd.p.valor != null && sd.p.fuente === 'laboratorio') {
      var p = sd.p.valor;
      if      (p >= 25) factor *= 1.00;
      else if (p >= 15) factor *= 0.96;
      else if (p >= 8)  { factor *= 0.88; notas.push('P bajo ' + Math.round(p) + ' ppm'); }
      else              { factor *= 0.75; notas.push('P muy bajo ' + Math.round(p) + ' ppm'); }
    }
  }
  var rendMax = Math.round(rMax * 10) / 10;
  var rendRec = Math.round(rMax * factor * 0.80 * 10) / 10;
  rendRec = Math.max(db.rendR[0], rendRec);
  return { max: rendMax, rec: rendRec, factorSuelo: Math.round(factor * 100), notas: notas, tieneDatos: tieneDatos };
}

window.ncValidarRendimiento = function(input) {
  input._touched = true;
  var alertEl = document.getElementById('nc-rend-alerta');
  if (!alertEl) return;
  var val = parseFloat(input.value);
  if (!val) { alertEl.style.display = 'none'; return; }
  var cultKey = ncCultivoKey(ncCultStr());
  var db = CULTIVO_DB[cultKey];
  if (!db) { alertEl.style.display = 'none'; return; }
  var sug = ncSugerirRendimiento(cultKey, window._sueloDatos || {});
  var rendMax = sug ? sug.max : db.rendR[1];
  if (val > rendMax * 1.12) {
    alertEl.style.cssText = 'display:block;font-size:.68rem;margin-top:.25rem;padding:.25rem .5rem;border-radius:5px;background:rgba(201,74,42,.08);color:#C0392B;border:1px solid rgba(201,74,42,.2)';
    alertEl.textContent = '⚠️ Por encima del máximo estimado para este suelo (' + rendMax + ' t/ha). Verificá el dato antes de calcular.';
  } else if (val > db.rendR[1]) {
    alertEl.style.cssText = 'display:block;font-size:.68rem;margin-top:.25rem;padding:.25rem .5rem;border-radius:5px;background:rgba(184,122,32,.08);color:#7A5A10;border:1px solid rgba(184,122,32,.2)';
    alertEl.textContent = '💡 Valor optimista para ' + db.nombre + ' en la región (rango usual: ' + db.rendR[0] + '–' + db.rendR[1] + ' t/ha). Revisá con históricos de zona.';
  } else if (val < db.rendR[0] * 0.7) {
    alertEl.style.cssText = 'display:block;font-size:.68rem;margin-top:.25rem;padding:.25rem .5rem;border-radius:5px;background:rgba(42,90,140,.08);color:#2A5A8C;border:1px solid rgba(42,90,140,.2)';
    alertEl.textContent = '💡 Rendimiento muy bajo para ' + db.nombre + '. El plan se ajustará a este objetivo.';
  } else {
    alertEl.style.display = 'none';
  }
};

// ── TABS (eliminados: panel unificado) ───────────────────
window.ncSwitchTab = function() {};

// ── CONTEXTO LOTE Y PANEL SUELO ───────────────────────────
function ncLoteActivo() {
  if (typeof window.amGetLoteActivo === 'function') return window.amGetLoteActivo();
  return (typeof AM_LOTES !== 'undefined' && typeof AM_LOTE_ACTIVO !== 'undefined')
    ? AM_LOTES.find(function(l) { return l.id === AM_LOTE_ACTIVO; }) : null;
}

function ncEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch) {
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
  });
}

function ncPlanVigente() {
  var lote = ncLoteActivo();
  if (window._ncPlanResultados) {
    return {
      resultados: window._ncPlanResultados,
      cultivo: ncCultStr(),
      rendimiento: parseFloat(ncGv('nc-rend-obj')) || null,
      superficie: parseFloat(ncGv('nc-sup')) || null,
      costoTotal: null
    };
  }
  if (lote && lote.data && lote.data.nutricionPlan) return lote.data.nutricionPlan;
  return null;
}

function ncResumenPlan(plan) {
  var res = (plan && plan.resultados) || {};
  var keys = ['N', 'P', 'S', 'K'].filter(function(k) { return res[k]; });
  var deficit = keys.filter(function(k) { return (res[k].dosisRec || 0) > 0; });
  var costo = plan && plan.costoTotal != null ? 'USD ' + Math.round(plan.costoTotal) + '/ha' : '';
  return {
    keys: keys,
    deficit: deficit,
    texto: deficit.length ? deficit.join(', ') + ' con recomendacion activa' : 'Sin deficit operativo relevante',
    costo: costo
  };
}

function ncGuardarBitacora(entrada) {
  try {
    var raw = localStorage.getItem('am_bitacora_v2');
    var lista = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(lista)) lista = [];
    lista.push(entrada);
    localStorage.setItem('am_bitacora_v2', JSON.stringify(lista.slice(-200)));
  } catch(_) {}
  var lote = ncLoteActivo();
  if (lote) {
    lote.data = lote.data || {};
    var lb = Array.isArray(lote.data.bitacora) ? lote.data.bitacora.slice() : [];
    lb.push(entrada);
    lote.data.bitacora = lb.slice(-200);
    lote.data.ultimaResolucionNutricion = entrada;
    if (typeof window.amGuardarLotesEstado === 'function') window.amGuardarLotesEstado();
  }
}

function ncRenderResolucionNutricion() {
  var box = document.getElementById('nc-resolucion-panel');
  if (!box) return;
  var plan = ncPlanVigente();
  var lote = ncLoteActivo();
  var ultima = lote && lote.data ? lote.data.ultimaResolucionNutricion : null;
  if (!plan) {
    box.innerHTML = '<div class="card" style="margin-bottom:1rem;border:1px solid rgba(200,162,85,.24);background:rgba(200,162,85,.07)">'
      + '<div style="font-size:.72rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7A5A10;margin-bottom:.25rem">Decision nutricional pendiente</div>'
      + '<div style="font-size:.86rem;color:rgba(237,224,196,.78);line-height:1.45">Calcula el plan para registrar si se aplica, posterga, ajusta dosis o se pide analisis.</div>'
      + '</div>';
    return;
  }
  var resumen = ncResumenPlan(plan);
  var ultTxt = ultima && ultima.resolucionNutricion
    ? 'Ultima resolucion: ' + ultima.resolucionNutricion.label + (ultima.fecha ? ' - ' + ultima.fecha : '')
    : 'Sin resolucion registrada para este plan.';
  box.innerHTML = '<div class="card" style="margin-bottom:1rem;border:1.5px solid rgba(109,191,130,.22);background:rgba(109,191,130,.08)">'
    + '<div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap">'
    + '<div><div style="font-size:.72rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#6DBF82;margin-bottom:.2rem">Cierre operativo de nutricion</div>'
    + '<div style="font-size:1rem;font-weight:800;color:rgba(237,224,196,.92)">' + ncEsc(resumen.texto) + '</div>'
    + '<div style="font-size:.74rem;color:rgba(237,224,196,.58);margin-top:.25rem">' + ncEsc(ultTxt) + (resumen.costo ? ' · ' + ncEsc(resumen.costo) : '') + '</div></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:.5rem;margin-top:.9rem">'
    + '<button type="button" class="btn" style="padding:.55rem .7rem" onclick="window.ncRegistrarResolucion&&window.ncRegistrarResolucion(\'aplicar\')">Aplicar plan</button>'
    + '<button type="button" class="btn" style="padding:.55rem .7rem" onclick="window.ncRegistrarResolucion&&window.ncRegistrarResolucion(\'postergar\')">Postergar</button>'
    + '<button type="button" class="btn" style="padding:.55rem .7rem" onclick="window.ncRegistrarResolucion&&window.ncRegistrarResolucion(\'ajustar\')">Ajustar dosis</button>'
    + '<button type="button" class="btn" style="padding:.55rem .7rem" onclick="window.ncRegistrarResolucion&&window.ncRegistrarResolucion(\'analisis\')">Pedir analisis</button>'
    + '</div></div>';
}

window.ncRegistrarResolucion = function(decision) {
  var lote = ncLoteActivo();
  var plan = ncPlanVigente();
  var labels = {
    aplicar: 'Aplicar plan nutricional',
    postergar: 'Postergar decision nutricional',
    ajustar: 'Ajustar dosis del plan',
    analisis: 'Pedir analisis de suelo/foliar'
  };
  var ahora = new Date();
  var fecha = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0');
  var resumen = ncResumenPlan(plan);
  var entrada = {
    id: 'nc-res-' + ahora.getTime(),
    fecha: fecha,
    hora: ahora.toTimeString().slice(0,5),
    tipo: decision === 'aplicar' ? 'fertilizacion' : 'otro',
    loteId: lote ? lote.id : '',
    loteNombre: lote ? lote.nombre : 'Lote',
    cultivo: (plan && plan.cultivo) || ncCultStr(),
    etapa: localStorage.getItem('am_fen_etapa_hoy') || '',
    nota: 'Resolucion nutricional: ' + (labels[decision] || decision) + '. ' + resumen.texto,
    resolucionNutricion: {
      decision: decision,
      label: labels[decision] || decision,
      nutrientes: resumen.deficit,
      planTs: plan && plan.ts ? plan.ts : null
    }
  };
  ncGuardarBitacora(entrada);
  if (decision === 'ajustar') {
    var rend = document.getElementById('nc-rend-obj');
    if (rend) {
      rend.focus();
      if (typeof rend.select === 'function') rend.select();
    }
  }
  if (typeof window.bitacoraRender === 'function') window.bitacoraRender();
  if (typeof window.dashOperativoRefresh === 'function') window.dashOperativoRefresh();
  ncRenderResolucionNutricion();
  if (typeof window.amToast === 'function') window.amToast('Resolucion nutricional guardada en Bitacora', 'ok');
  else alert('Resolucion nutricional guardada en Bitacora');
};

window.ncActualizar = function() {
  ncRestaurarSgDatos();
  // Si _sueloDatos está vacío pero _sgDatos tiene datos (restaurado del caché), re-fusionar
  var _sd0 = window._sueloDatos || {};
  if (!ncTieneDatos(_sd0) && ncTieneDatos(window._sgDatos)) {
    if (typeof window.sueloFusionar === 'function') window.sueloFusionar();
  }
  ncHidratarPKZ().then(function() {
    if (typeof sueloFusionar === 'function') sueloFusionar();
    ncRenderSueloPanel();
  });

  var cultivo = ncCultStr();
  var lote = ncLoteActivo();
  var sd = window._sueloDatos || {};
  var tieneLab = Object.values(sd).some(function(v) { return v && v.fuente === 'laboratorio'; });
  var tieneSG  = Object.values(sd).some(function(v) { return v && v.fuente === 'soilgrids'; });

  var lblCult   = document.getElementById('nc-lbl-cultivo');
  var lblLote   = document.getElementById('nc-lbl-lote');
  var lblFuente = document.getElementById('nc-lbl-fuente-badge');
  if (lblCult)   lblCult.textContent = cultivo;
  if (lblLote)   lblLote.textContent = lote ? lote.nombre : 'Sin lote activo';
  if (lblFuente) {
    var sg2 = window._sgDatos || {};
    var pkzId2 = sg2.fuente_pkz_id || '';
    var pkzSfx = pkzId2 === 'openlandmap' ? ' + 🌍 OLM' : pkzId2.includes('idecor') ? ' + 📍 IDECOR' : pkzId2 === 'db-prov' ? ' + 📍 Prov.' : pkzId2 === 'db' ? ' + 📚 DB' : '';
    var fTxt, fSty;
    if      (tieneLab && tieneSG) { fTxt = '🔬 Lab + 🛰️ SoilGrids' + pkzSfx; fSty = 'background:rgba(74,140,92,.12);color:#1b5e35;border:1px solid rgba(74,140,92,.25)'; }
    else if (tieneLab)            { fTxt = '🔬 Lab activo' + pkzSfx;            fSty = 'background:rgba(74,140,92,.12);color:#1b5e35;border:1px solid rgba(74,140,92,.25)'; }
    else if (tieneSG)             { fTxt = '🛰️ SoilGrids' + pkzSfx;             fSty = 'background:rgba(122,174,245,.1);color:#2A5A8C;border:1px solid rgba(42,90,140,.25)'; }
    else                          { fTxt = 'Sin datos de suelo';                  fSty = 'background:rgba(74,46,26,.07);color:rgba(74,46,26,.4);border:1px solid rgba(74,46,26,.12)'; }
    lblFuente.textContent = fTxt;
    lblFuente.style.cssText = 'font-size:.68rem;padding:.12rem .6rem;border-radius:6px;font-weight:700;' + fSty;
  }

  ncRenderSueloPanel();
  ncRenderResolucionNutricion();

  // Auto-completar desde módulos ya cargados (primera vez)
  var ncRend    = document.getElementById('nc-rend-obj');
  var ncPrecio  = document.getElementById('nc-precio-grano');
  var ncSup     = document.getElementById('nc-sup');
  var bhRend    = document.getElementById('bh-rend-obj');
  var ecPrecio  = document.getElementById('ec-precio-disp');

  // Superficie desde el lote activo
  if (lote && lote.data) {
    var supLote = parseFloat(lote.data.superficie) || 0;
    if (supLote > 0) {
      if (ncSup && !ncSup._touched) {
        ncSup.value = supLote;
        var supBadge = document.getElementById('nc-sup-badge');
        if (supBadge) { supBadge.textContent = '← lote'; supBadge.style.display = 'inline'; }
      }
    }
  }

  if (bhRend && bhRend.value && ncRend && !ncRend._touched) ncRend.value = bhRend.value;
  if (ecPrecio && ecPrecio.value && ncPrecio && !ncPrecio._touched) ncPrecio.value = ecPrecio.value;

  // Rendimiento objetivo desde panel de planificación — prioridad máxima, ejecuta último
  if (lote && lote.data && lote.data.rendimientoObjetivo && ncRend && !ncRend._touched) {
    ncRend.value = lote.data.rendimientoObjetivo;
  }
};

function ncRenderSueloPanel() {
  var panel = document.getElementById('nc-suelo-panel');
  if (!panel) return;
  var sd    = window._sueloDatos || {};
  var hasDatos = ncTieneDatos(sd);

  if (!hasDatos) {
    panel.innerHTML = '<div style="text-align:center;padding:2.2rem 1rem;color:rgba(74,46,26,.35)">'
      + '<div style="font-size:2.8rem;margin-bottom:.6rem">🌱</div>'
      + '<div style="font-size:.8rem">Sin datos de suelo<br>Analizá el lote en el módulo Suelo o cargá un análisis de laboratorio</div></div>';
    var aviso = document.getElementById('nc-suelo-aviso-p');
    if (aviso) aviso.style.display = 'none';
    return;
  }

  var labels = { ph:'pH', mo:'MO (%)', soc:'SOC g/kg', n:'N total g/kg', da:'DA g/cm³',
                 cec:'CEC cmol/kg', clay:'Arcilla %', textura:'Textura',
                 p:'P disp. ppm', k:'K int. ppm', zn:'Zn disp. ppm' };
  var mostrar = ['ph', 'mo', 'n', 'cec', 'da', 'p', 'k', 'zn', 'textura'];
  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:.32rem">';
  var tienePLab = sd.p && sd.p.valor != null;
  var tieneKLab = sd.k && sd.k.valor != null;

  mostrar.forEach(function(k) {
    var v = sd[k];
    if (!v) return;
    var esLab  = v.fuente === 'laboratorio';
    var esOLM  = v.fuente === 'openlandmap' || v.fuente === 'idecor+olm';
    var esIDEC = v.fuente === 'idecor';
    var esDBP  = v.fuente === 'db-prov';
    var esDB   = v.fuente === 'db';
    var srcIco = esLab ? ' 🔬' : esOLM ? ' 🌍' : esIDEC ? ' 📍' : esDBP ? ' 📍' : esDB ? ' 📚' : '';
    var color = esLab ? '#1b5e35' : esOLM ? '#2A6E3A' : esIDEC ? '#1A5A8C' : esDBP ? '#5A7A3A' : esDB ? '#7a5c3a' : '#2A5A8C';
    var bg    = esLab ? 'rgba(74,140,92,.07)' : esOLM ? 'rgba(42,110,58,.05)' : esIDEC ? 'rgba(26,90,140,.05)' : esDB ? 'rgba(122,92,58,.05)' : 'rgba(42,90,140,.04)';
    var bdr   = esLab ? 'rgba(74,140,92,.22)' : esOLM ? 'rgba(42,110,58,.18)' : esIDEC ? 'rgba(26,90,140,.18)' : esDB ? 'rgba(122,92,58,.14)' : 'rgba(42,90,140,.12)';
    var val   = typeof v.valor === 'number'
      ? (v.valor < 10 ? v.valor.toFixed(2) : v.valor.toFixed(1)) : v.valor;
    html += '<div style="background:' + bg + ';border:1px solid ' + bdr + ';border-radius:8px;padding:.45rem .6rem">'
          + '<div style="font-size:.63rem;color:' + color + ';font-weight:700;white-space:nowrap;overflow:hidden;margin-bottom:.1rem">' + (labels[k] || k) + srcIco + '</div>'
          + '<div style="font-size:.9rem;font-weight:700;color:#1A2A1A;font-family:\'DM Mono\',monospace">' + val + '</div>'
          + '</div>';
  });
  html += '</div>';
  panel.innerHTML = html;

  // Mostrar aviso solo cuando P y K no provienen de laboratorio
  var tienePReal = sd.p && sd.p.valor != null && sd.p.fuente === 'laboratorio';
  var tieneKReal = sd.k && sd.k.valor != null && sd.k.fuente === 'laboratorio';
  var aviso = document.getElementById('nc-suelo-aviso-p');
  if (aviso) aviso.style.display = (!tienePReal || !tieneKReal) ? '' : 'none';
}

// ════════════════════════════════════════════════════════
// TAB A — PLAN DE FERTILIZACIÓN INTEGRADO
// ════════════════════════════════════════════════════════
window.ncPlanCalcular = async function() {
  var cultStr = ncCultStr();
  var cultKey = ncCultivoKey(cultStr);

  // Si el cultivo cambió respecto al plan anterior, limpiar antes de recalcular
  if (window._ncPlanResultados && window._ncPlanResultados.__cultivo &&
      window._ncPlanResultados.__cultivo !== cultKey) {
    window._ncPlanResultados = null;
    var _ncRend = document.getElementById('nc-rend-obj');
    if (_ncRend) _ncRend._touched = false;
  }

  var db      = CULTIVO_DB[cultKey];
  if (!db) { alert('Cultivo no encontrado: ' + cultStr + '\nVerificá el cultivo seleccionado en el Dashboard.'); return; }

  var rendObj   = ncGf('nc-rend-obj') || ((db.rendR[0] + db.rendR[1]) / 2);
  var precioG   = ncGf('nc-precio-grano') || 300;
  var sup       = ncGf('nc-sup') || 100;
  var Pg_kg     = precioG / 1000;

  var precios = {};
  Object.keys(NC_FERTS).forEach(function(n) {
    precios[n] = ncGf(NC_FERTS[n].idPrecio) || NC_FERTS[n].precioRef;
  });

  ncRestaurarSgDatos();
  await ncHidratarPKZ();
  if (!ncTieneDatos(window._sueloDatos) && ncTieneDatos(window._sgDatos) && typeof sueloFusionar === 'function') sueloFusionar();
  var sd        = window._sueloDatos || {};
  var sueloKg   = ncSueloAkg(sd);
  var mo        = sd.mo && sd.mo.valor != null ? sd.mo.valor : null;
  var tienePLab = !!(sueloKg.P && sueloKg.P.valor != null);
  var tieneKLab = !!(sueloKg.K && sueloKg.K.valor != null);
  var fuenteP   = sueloKg.P ? (sueloKg.P.fuente || null) : (sd.p ? (sd.p.fuente || null) : null);
  var estrategia = window._ncEstrategia || 'productiva';

  var nutList = ['N', 'P', 'S'];
  if (sueloKg.K) nutList.push('K');

  var resultados = {};
  var costoTotal = 0;

  nutList.forEach(function(nut) {
    var fert = NC_FERTS[nut];
    if (!fert) return;

    var disponible = sueloKg[nut] ? sueloKg[nut].valor : null;
    var fuenteDisp = sueloKg[nut] ? sueloKg[nut].fuente : null;
    var efic = NC_EFIC[nut];

    // Extracción real con el grano (kg nutriente/ha)
    var extGrano = 0;
    if      (nut === 'N') extGrano = db.ext.N    ? db.ext.N.grano    * rendObj : 0;
    else if (nut === 'P') extGrano = db.ext.P2O5 ? db.ext.P2O5.grano * rendObj : 0;
    else if (nut === 'K') extGrano = db.ext.K2O  ? db.ext.K2O.grano  * rendObj : 0;
    else if (nut === 'S') extGrano = db.ext.S    ? db.ext.S.grano    * rendObj : 0;

    // Aportes naturales (mineralización / deposición)
    var aporteNat = 0;
    if (nut === 'N') aporteNat = mo ? mo * 20 : 40;
    if (nut === 'S') aporteNat = 8;

    // Requerimiento del cultivo (kg nutriente/ha)
    var reqBase;
    if      (nut === 'N') reqBase = (db.req.N || 0) * rendObj;
    else if (nut === 'P') reqBase = (db.req.P || 0) * rendObj;
    else if (nut === 'K') reqBase = (db.req.K || 0) * rendObj;
    else if (nut === 'S') reqBase = extGrano;

    var deficit = disponible != null ? Math.max(0, reqBase - disponible) : reqBase;

    // Dosis óptima económica INTA (curvas cuadráticas)
    var dosisCurva = null, bcOpt = null;
    if (nut !== 'K' && db.curvas && db.curvas[nut]) {
      var Pf_kg = precios[nut] / 1000 / fert.fraccion;
      var opt   = ncCalcOptima(db.curvas[nut], Pg_kg, Pf_kg);
      dosisCurva = Math.round(opt.Xopt);
      bcOpt      = opt.bc;
    }

    // ── Cálculo de dosis según estrategia ───────────────
    var dosisRec, suploExtra = null, campRecupera = null;

    if (estrategia === 'productiva') {
      // Mínimo insumo: blend déficit + curva INTA
      if (nut === 'K') {
        dosisRec = deficit;
      } else if (dosisCurva !== null) {
        if (db.esFBN && nut === 'N') {
          dosisRec = Math.min(deficit * 0.6, dosisCurva * 0.5, 40);
        } else if (!tienePLab && nut === 'P') {
          dosisRec = dosisCurva;
        } else {
          var pond = disponible != null ? 0.55 : 0.35;
          dosisRec = pond * deficit + (1 - pond) * dosisCurva;
          dosisRec = Math.max(deficit * 0.8, Math.min(dosisCurva * 1.2, dosisRec));
        }
      } else {
        dosisRec = deficit;
      }

    } else if (estrategia === 'equilibrada') {
      // Reponer lo que el grano exporta: balance neto ≈ 0
      if (db.esFBN && nut === 'N') {
        dosisRec = Math.min(25, deficit * 0.4);
      } else if (nut === 'P') {
        // P no se pierde del sistema: reponer kg a kg lo exportado en grano
        dosisRec = tienePLab ? Math.max(deficit, extGrano) : (dosisCurva || extGrano);
      } else if (nut === 'K') {
        dosisRec = Math.max(deficit, extGrano);
      } else {
        // N (no FBN) y S: considerar aportes naturales y eficiencia de aprovechamiento
        var neceso = Math.max(0, extGrano - aporteNat);
        dosisRec = neceso / efic;
        if (disponible != null) dosisRec = Math.max(dosisRec, deficit);
      }

    } else if (estrategia === 'regenerativa') {
      // Excedente sobre equilibrio para recuperar el suelo gradualmente
      var factorRegen = 1.3;
      if (mo != null) {
        if      (mo < 1.5) factorRegen = 1.55;
        else if (mo < 2.5) factorRegen = 1.35;
        else if (mo < 3.5) factorRegen = 1.20;
        else               factorRegen = 1.10;
      }

      // Base = equilibrada
      var baseEquil;
      if (db.esFBN && nut === 'N') {
        baseEquil = Math.min(25, deficit * 0.4);
      } else if (nut === 'P') {
        baseEquil = tienePLab ? Math.max(deficit, extGrano) : (dosisCurva || extGrano);
      } else if (nut === 'K') {
        baseEquil = Math.max(deficit, extGrano);
      } else {
        var neces2 = Math.max(0, extGrano - aporteNat);
        baseEquil = neces2 / efic;
        if (disponible != null) baseEquil = Math.max(baseEquil, deficit);
      }

      suploExtra = Math.round(baseEquil * (factorRegen - 1));
      dosisRec   = baseEquil + suploExtra;

      // Estimar campañas para alcanzar nivel objetivo
      if (disponible != null && NC_NIVEL_OBJ[nut]) {
        var sueloDef = Math.max(0, NC_NIVEL_OBJ[nut] - disponible);
        if (sueloDef > 0 && suploExtra > 0) {
          // N/S: parte del excedente se pierde; P/K: queda todo en suelo
          var deposAnual = (nut === 'P' || nut === 'K') ? suploExtra : Math.round(suploExtra * (1 - efic));
          if (deposAnual > 0) {
            campRecupera = Math.ceil(sueloDef / deposAnual);
            if (campRecupera > 25) campRecupera = null; // plazo demasiado largo
          }
        }
      }
    }

    dosisRec = Math.max(0, Math.round(dosisRec || 0));
    var kgFert = Math.round(dosisRec / fert.fraccion);
    var costo  = (kgFert / 1000) * precios[nut];
    costoTotal += costo;

    resultados[nut] = {
      disponible: disponible, fuenteDisp: fuenteDisp,
      reqBase: Math.round(reqBase),
      extGrano: Math.round(extGrano),
      aporteNat: Math.round(aporteNat),
      deficit: Math.round(deficit),
      dosisCurva: dosisCurva, bcOpt: bcOpt,
      dosisRec: dosisRec, kgFert: kgFert, costo: costo,
      fertNombre: fert.nombre,
      suploExtra: suploExtra, campRecupera: campRecupera,
    };
  });

  window._ncPlanResultados = resultados;
  window._ncPlanResultados.__cultivo = ncCultivoKey(cultStr);
  ncRenderPlan(resultados, { cultStr, rendObj, precioG, sup, costoTotal, esFBN: db.esFBN, tienePLab, tieneKLab, fuenteP, estrategia });
};

// ── RENDER PLAN ──────────────────────────────────────────
function ncRenderPlan(res, ctx) {
  try {
    var lotePlan = ncLoteActivo();
    if (lotePlan) {
      lotePlan.data = lotePlan.data || {};
      lotePlan.data.nutricionPlan = {
        ts: Date.now(),
        cultivo: ctx.cultStr,
        rendimiento: ctx.rendObj,
        superficie: ctx.sup,
        costoTotal: ctx.costoTotal,
        resultados: res
      };
      if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
    }
  } catch(_) {}
  var ph  = document.getElementById('nc-plan-placeholder');
  var out = document.getElementById('nc-plan-resultado');
  if (!out) return;
  if (ph) ph.style.display = 'none';
  out.style.display = '';

  var nutColor = { N:'#3A7A4A', P:'#C8A255', S:'#8b6f47', K:'#2A5A8C' };
  var nutEmoji = { N:'🌿', P:'⚗️', S:'🟡', K:'🧲' };

  // Encabezado
  var estrInfo = {
    productiva:   { ico: '🎯', lbl: 'PRODUCTIVA',   color: '#E8B84B' },
    equilibrada:  { ico: '⚖️', lbl: 'EQUILIBRADA',  color: '#7ABAEE' },
    regenerativa: { ico: '🌱', lbl: 'REGENERATIVA', color: '#6DBF82' },
  };
  var ei = estrInfo[ctx.estrategia] || estrInfo.productiva;

  var html = '<div style="background:linear-gradient(135deg,#0E2016,#1A3A25);border-radius:14px;padding:1.1rem 1.4rem;margin-bottom:1.1rem;border:1px solid rgba(109,191,130,.2)">';
  html += '<div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.7rem">';
  html += '<div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(237,224,196,.75)">';
  html += '📋 PLAN · ' + ctx.cultStr.toUpperCase() + ' · ' + ctx.rendObj + ' t/ha · USD ' + Math.round(ctx.precioG) + '/t grano</div>';
  html += '<span style="font-size:.64rem;font-weight:700;padding:.15rem .55rem;border-radius:20px;background:rgba(255,255,255,.1);color:' + ei.color + ';letter-spacing:.06em">' + ei.ico + ' ' + ei.lbl + '</span>';
  html += '</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.6rem">';
  html += '<div style="text-align:center;background:rgba(255,255,255,.09);padding:.7rem;border-radius:9px"><div style="font-size:1.3rem;font-weight:700;color:#6DBF82">USD ' + Math.round(ctx.costoTotal) + '/ha</div><div style="font-size:.62rem;color:rgba(237,224,196,.65);text-transform:uppercase;margin-top:.15rem">Costo total fertilización</div></div>';
  html += '<div style="text-align:center;background:rgba(255,255,255,.09);padding:.7rem;border-radius:9px"><div style="font-size:1.3rem;font-weight:700;color:#E8B84B">USD ' + Math.round(ctx.costoTotal * ctx.sup / 1000) + 'k</div><div style="font-size:.62rem;color:rgba(237,224,196,.65);text-transform:uppercase;margin-top:.15rem">Campaña total (' + ctx.sup + ' ha)</div></div>';
  html += '</div></div>';

  if (ctx.esFBN) {
    html += '<div class="alert info" style="margin-bottom:.9rem"><span class="ai">💡</span><div class="ac"><strong>Soja — Fijación Biológica de N (FBN):</strong> Con inoculación de <em>Bradyrhizobium</em>, la soja cubre hasta el 80% de sus necesidades de N. La dosis de N indicada es para arranque o ambientes de alto potencial.</div></div>';
  }

  // Tarjetas por nutriente
  html += '<div style="display:flex;flex-direction:column;gap:.65rem">';
  ['N', 'P', 'S', 'K'].forEach(function(nut) {
    if (!res[nut]) return;
    var r       = res[nut];
    var color   = nutColor[nut] || '#C8A255';
    var emoji   = nutEmoji[nut] || '🔹';
    var rentable = r.bcOpt != null && r.bcOpt >= 1.2;
    var bc       = r.bcOpt != null ? r.bcOpt.toFixed(1) + ':1' : '—';

    // Badge de fuente (lab, OpenLandMap, IDECOR, DB, SoilGrids)
    var fuenteBadge = '';
    var fd = r.fuenteDisp;
    if (fd === 'laboratorio') {
      fuenteBadge = '<span style="font-size:.58rem;font-weight:700;background:rgba(74,140,92,.15);color:#1b5e35;padding:.04rem .28rem;border-radius:3px;margin-left:.25rem">🔬</span>';
    } else if (fd === 'openlandmap' || fd === 'idecor+olm') {
      fuenteBadge = '<span style="font-size:.58rem;font-weight:700;background:rgba(42,110,58,.12);color:#2A6E3A;padding:.04rem .28rem;border-radius:3px;margin-left:.25rem">🌍 OLM</span>';
    } else if (fd === 'idecor') {
      fuenteBadge = '<span style="font-size:.58rem;font-weight:700;background:rgba(26,90,140,.1);color:#1A5A8C;padding:.04rem .28rem;border-radius:3px;margin-left:.25rem">📍 IDECOR</span>';
    } else if (fd === 'db-prov') {
      fuenteBadge = '<span style="font-size:.58rem;font-weight:700;background:rgba(90,122,58,.1);color:#5A7A3A;padding:.04rem .28rem;border-radius:3px;margin-left:.25rem">📍 Prov.</span>';
    } else if (fd === 'db') {
      fuenteBadge = '<span style="font-size:.58rem;font-weight:700;background:rgba(122,92,58,.1);color:#7a5c3a;padding:.04rem .28rem;border-radius:3px;margin-left:.25rem">📚 DB</span>';
    } else if (fd && fd !== 'estimado') {
      fuenteBadge = '<span style="font-size:.58rem;font-weight:700;background:rgba(42,90,140,.1);color:#2A5A8C;padding:.04rem .28rem;border-radius:3px;margin-left:.25rem">🛰️</span>';
    } else if (r.disponible != null) {
      fuenteBadge = '<span style="font-size:.58rem;color:rgba(74,46,26,.35);margin-left:.25rem">~</span>';
    }

    var bdrColor = r.dosisRec === 0 ? 'rgba(74,140,92,.3)' : (rentable ? 'rgba(74,140,92,.18)' : 'rgba(200,162,85,.3)');
    html += '<div style="background:#fff;border-radius:12px;padding:.9rem 1rem;border:1.5px solid ' + bdrColor + '">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem">';
    html += '<div style="font-weight:700;font-size:.9rem;color:' + color + '">' + emoji + ' ' + nut + ' — ' + r.fertNombre + '</div>';
    if (r.dosisRec === 0) {
      html += '<span style="font-size:.7rem;font-weight:700;background:rgba(74,140,92,.1);color:#1b5e35;padding:.18rem .55rem;border-radius:20px">✅ Sin déficit</span>';
    } else if (r.bcOpt != null) {
      html += '<span style="font-size:.7rem;font-weight:700;background:' + (rentable ? 'rgba(74,140,92,.1)' : 'rgba(212,82,42,.1)') + ';color:' + (rentable ? '#1b5e35' : '#C0392B') + ';padding:.18rem .55rem;border-radius:20px">' + (rentable ? '✅ Rentable' : '⚠️ Sin margen') + '</span>';
    }
    html += '</div>';

    // KPIs — varían según estrategia
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:.42rem;margin-bottom:.5rem">';
    var kpis;
    if (ctx.estrategia === 'equilibrada') {
      kpis = [
        { lbl:'Disponible suelo',  val: r.disponible != null ? r.disponible + ' kg/ha' : '—', xtra: fuenteBadge },
        { lbl:'Extracción grano',  val: r.extGrano + ' kg/ha',   clr: '#C0392B' },
        { lbl:'Aporte natural',    val: r.aporteNat > 0 ? '+' + r.aporteNat + ' kg/ha' : '—', clr: '#1b5e35' },
        { lbl:'Déficit actual',    val: r.deficit + ' kg/ha',    clr: r.deficit > 0 ? '#C0392B' : '#1b5e35' },
        { lbl:'Dosis equilibrio',  val: r.dosisRec + ' kg/ha',   clr: color, bold: true },
        { lbl:'Producto',          val: r.kgFert + ' kg/ha' },
        { lbl:'Relación B/C',      val: bc,                      clr: r.bcOpt != null && r.bcOpt >= 1.2 ? '#1b5e35' : r.bcOpt != null && r.bcOpt < 1 ? '#C0392B' : '#C8A255' },
        { lbl:'Costo',             val: 'USD ' + r.costo.toFixed(0) + '/ha' },
      ];
    } else if (ctx.estrategia === 'regenerativa') {
      kpis = [
        { lbl:'Disponible suelo',  val: r.disponible != null ? r.disponible + ' kg/ha' : '—', xtra: fuenteBadge },
        { lbl:'Extracción grano',  val: r.extGrano + ' kg/ha',   clr: '#C0392B' },
        { lbl:'Déficit actual',    val: r.deficit + ' kg/ha',    clr: r.deficit > 0 ? '#C0392B' : '#1b5e35' },
        { lbl:'Base equilibrio',   val: (r.dosisRec - (r.suploExtra || 0)) + ' kg/ha' },
        { lbl:'Extra recuperación',val: r.suploExtra != null ? '+' + r.suploExtra + ' kg/ha' : '—', clr: '#2A6E3A' },
        { lbl:'Dosis total',       val: r.dosisRec + ' kg/ha',   clr: color, bold: true },
        { lbl:'Producto',          val: r.kgFert + ' kg/ha' },
        { lbl:'Costo',             val: 'USD ' + r.costo.toFixed(0) + '/ha' },
      ];
    } else {
      kpis = [
        { lbl:'Disponible suelo',  val: r.disponible != null ? r.disponible + ' kg/ha' : '—', xtra: fuenteBadge },
        { lbl:'Requerimiento',     val: r.reqBase + ' kg/ha' },
        { lbl:'Déficit real',      val: r.deficit + ' kg/ha',    clr: r.deficit > 0 ? '#C0392B' : '#1b5e35' },
        { lbl:'Dosis óptima INTA', val: r.dosisCurva != null ? r.dosisCurva + ' kg/ha' : '—' },
        { lbl:'Recomendación',     val: r.dosisRec + ' kg/ha',   clr: color, bold: true },
        { lbl:'Producto',          val: r.kgFert + ' kg/ha' },
        { lbl:'Relación B/C',      val: bc,                      clr: r.bcOpt != null && r.bcOpt >= 1.2 ? '#1b5e35' : r.bcOpt != null && r.bcOpt < 1 ? '#C0392B' : '#C8A255' },
        { lbl:'Costo',             val: 'USD ' + r.costo.toFixed(0) + '/ha' },
      ];
    }
    kpis.forEach(function(kpi) {
      html += '<div style="background:#f9f7f2;border-radius:7px;padding:.42rem .6rem;border:1px solid rgba(74,46,26,.09)">';
      html += '<div style="font-size:.63rem;text-transform:uppercase;letter-spacing:.04em;color:rgba(74,46,26,.52);margin-bottom:.12rem">' + kpi.lbl + (kpi.xtra || '') + '</div>';
      html += '<div style="font-size:.86rem;font-weight:' + (kpi.bold ? '700' : '600') + ';color:' + (kpi.clr || '#1A2A1A') + ';font-family:\'DM Mono\',monospace">' + kpi.val + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Recuperación de suelo (solo regenerativa, si hay dato)
    if (ctx.estrategia === 'regenerativa' && r.suploExtra != null) {
      var recupTxt = r.campRecupera
        ? 'Con este excedente el suelo alcanza el nivel objetivo en ≈ <strong>' + r.campRecupera + ' campañas</strong>'
        : (r.disponible != null ? 'El suelo ya está cerca del nivel objetivo' : 'Cargá análisis de suelo para estimar el plazo de recuperación');
      html += '<div style="font-size:.7rem;color:#1b5e35;padding:.38rem .65rem;background:rgba(74,140,92,.06);border:1px solid rgba(74,140,92,.2);border-radius:7px;margin-bottom:.4rem">🌱 ' + recupTxt + '</div>';
    }

    if (r.dosisRec > 0 && ctx.sup > 0) {
      html += '<div style="font-size:.71rem;color:rgba(74,46,26,.38);border-top:1px solid rgba(74,46,26,.07);padding-top:.38rem">';
      html += 'Campaña (' + Math.round(ctx.sup) + ' ha): ' + Math.round(r.kgFert * ctx.sup / 1000) + ' t ' + r.fertNombre.split(' ')[0] + ' · USD ' + Math.round(r.costo * ctx.sup).toLocaleString('es-AR');
      html += '</div>';
    }
    html += '</div>'; // cierra tarjeta nutriente
  });
  html += '</div>'; // cierra columna tarjetas

  var fp = ctx.fuenteP;
  if (!fp) {
    html += '<div class="alert info" style="margin-top:.9rem"><span class="ai">💡</span><div class="ac"><strong>P sin datos de suelo:</strong> La recomendación de P se basó en la curva óptima económica (INTA). Ingresá el P disponible (ppm Bray I) en el módulo Suelo → Análisis de laboratorio para mayor precisión.</div></div>';
  } else if (fp !== 'laboratorio') {
    var nomFP = fp === 'openlandmap' ? 'OpenLandMap 250m' : fp === 'idecor' ? 'IDECOR Córdoba 90m' : fp === 'idecor+olm' ? 'IDECOR 90m + OLM 250m' : fp === 'db' ? 'DB regional (Fertilizar/INTA)' : fp;
    html += '<div class="alert info" style="margin-top:.9rem"><span class="ai">🌍</span><div class="ac"><strong>P estimado — ' + nomFP + ':</strong> Precisión orientativa (±30-40% vs Bray local). Se usó el dato disponible de mayor resolución. Para fertilización de precisión, ingresá el P Bray I real en el panel de laboratorio.</div></div>';
  }

  var metodos = {
    productiva:   'Déficit = requerimiento cultivo − disponible en suelo. Dosis óptima = curva respuesta cuadrática INTA. Recomendación pondera ambos enfoques. Calibrar con análisis local.',
    equilibrada:  'Dosis equilibrio = extracción en grano − aportes naturales (mineralización/deposición). El exceso de P/K no se pierde del sistema: queda en suelo. Objetivo: balance neto ≈ 0 campaña a campaña.',
    regenerativa: 'Base = dosis equilibrio. Excedente calculado según calidad del suelo (MO) para recuperar reservas en forma gradual. Plazo de recuperación estimado por acumulación anual neta en suelo.',
  };
  html += '<div style="margin-top:.9rem;font-size:.7rem;color:#6b5b45;padding:.6rem .9rem;background:#fbf8f1;border:1px solid rgba(74,46,26,.12);border-radius:8px;line-height:1.5">';
  html += '📊 <strong>Metodología ' + (ctx.estrategia || 'productiva') + ':</strong> ' + (metodos[ctx.estrategia] || metodos.productiva);
  html += '</div>';

  out.innerHTML = html;
  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  ncRenderResolucionNutricion();

  // Auto-actualizar el balance con los datos del plan recién calculado
  if (typeof window.ncBalanceCalcular === 'function') window.ncBalanceCalcular();
}

// ════════════════════════════════════════════════════════
// BALANCE POST-COSECHA (integrado en panel único)
// ════════════════════════════════════════════════════════
window.ncBalanceCalcular = function() {
  var cultStr  = ncCultStr();
  var cultKey  = ncCultivoKey(cultStr);
  var db       = CULTIVO_DB[cultKey];
  if (!db) return;

  // Tomar rendimiento y fertilización del plan calculado
  var rend     = parseFloat(ncGv('nc-rend-obj')) || 4.5;
  var sup      = parseFloat(ncGv('nc-sup'))       || 100;
  var rastrojo = ncGv('nc-bn-rastrojo') || 'campo';

  var pr   = window._ncPlanResultados || {};
  var fertN = pr.N ? (pr.N.kgFert || 0) : 0;
  var fertP = pr.P ? (pr.P.kgFert || 0) : 0;
  var fertS = pr.S ? (pr.S.kgFert || 0) : 0;

  // Actualizar chip informativo con datos heredados del plan
  var infoEl = document.getElementById('nc-balance-plan-info');
  if (infoEl) {
    var partes = ['📐 Rend. objetivo: <strong>' + rend + ' t/ha</strong>'];
    if (fertN > 0) partes.push('🌿 Urea: <strong>' + Math.round(fertN) + ' kg/ha</strong>');
    if (fertP > 0) partes.push('⚗️ MAP: <strong>' + Math.round(fertP) + ' kg/ha</strong>');
    if (fertS > 0) partes.push('🟡 SuMag: <strong>' + Math.round(fertS) + ' kg/ha</strong>');
    infoEl.innerHTML = 'Datos del plan: ' + partes.join(' · ');
    infoEl.style.display = partes.length ? '' : 'none';
  }

  // MO del suelo (para N mineralizable)
  var sd = window._sueloDatos || {};
  var mo = null;
  if      (sd.mo && sd.mo.valor != null) mo = sd.mo.valor;
  else if (window._sgDatos && window._sgDatos.soc) mo = window._sgDatos.soc * 1.724 / 10;

  var rastrojoQueda = rastrojo === 'campo';
  var ext = db.ext;
  var balance = {};
  var nutList = ['N', 'P2O5', 'K2O', 'S'];

  nutList.forEach(function(nut) {
    var datos = ext[nut];
    if (!datos) return;
    var extrGrano     = datos.grano    * rend;
    var extrRastrojo  = rastrojoQueda ? 0 : datos.rastrojo * rend;
    var extrTotal     = extrGrano + extrRastrojo;
    var efic          = nut === 'N' ? 0.65 : nut === 'P2O5' ? 0.25 : nut === 'K2O' ? 0.40 : 0.50;
    var aporteFert    = 0;
    if (nut === 'N')    aporteFert = fertN * NC_FERTS.N.fraccion * efic;
    if (nut === 'P2O5') aporteFert = fertP * NC_FERTS.P.fraccion * efic;
    if (nut === 'S')    aporteFert = fertS * NC_FERTS.S.fraccion * efic;
    var aporteNat     = 0;
    if (nut === 'N') aporteNat = mo ? mo * 20 : 40;
    if (nut === 'S') aporteNat = 8;
    var balNeto = aporteFert + aporteNat - extrTotal;

    balance[nut] = {
      extrGrano:    Math.round(extrGrano),
      extrRastrojo: Math.round(extrRastrojo),
      extrTotal:    Math.round(extrTotal),
      aporteFert:   Math.round(aporteFert),
      aporteNat:    Math.round(aporteNat),
      balNeto:      Math.round(balNeto),
      balLote:      Math.round(balNeto * sup),
    };
  });

  // Recomendaciones
  var recs = [];
  var BN_F = {
    N:    { nombre:'Urea (46-0-0)', riq:0.46, precioRef:380 },
    P2O5: { nombre:'MAP (11-52-0)',  riq:0.52, precioRef:620 },
    K2O:  { nombre:'KCl (60%)',      riq:0.60, precioRef:480 },
    S:    { nombre:'SuMag (22% S)', riq:0.22, precioRef:280 },
  };
  function pushRec(nut, urgencia, titulo, texto, defVal, fert) {
    var rec = { nut:nut, urgencia:urgencia, titulo:titulo, texto:texto, dosis:Math.round(defVal || 0) };
    if (fert && defVal > 0) {
      rec.cant    = Math.round(defVal / fert.riq);
      rec.costo   = Math.round(rec.cant * fert.precioRef / 1000);
      rec.fertNom = fert.nombre;
    }
    recs.push(rec);
  }

  var defN = balance.N ? -balance.N.balNeto : 0;
  if      (defN > 60)                         pushRec('N','alta', 'Déficit de Nitrógeno significativo', 'Extracción: ' + (balance.N ? balance.N.extrTotal : '?') + ' kg N/ha. Para la próxima campaña: ' + Math.round(defN * 0.8) + '–' + Math.round(defN * 1.2) + ' kg N/ha.', defN, BN_F.N);
  else if (defN > 20)                         pushRec('N','media','Nitrógeno levemente negativo',        'Déficit moderado de ' + Math.round(defN) + ' kg N/ha. Monitorear MO a mediano plazo.', defN, BN_F.N);
  else if (balance.N && balance.N.balNeto > 0) pushRec('N','ok',   'Balance N positivo',                 'Superávit de ' + balance.N.balNeto + ' kg N/ha. Disponible para la próxima campaña.', 0, null);

  var defP = balance.P2O5 ? -balance.P2O5.balNeto : 0;
  if      (defP > 15)                                  pushRec('P','alta','Déficit de Fósforo — reposición necesaria','Extracción: ' + (balance.P2O5 ? balance.P2O5.extrTotal : '?') + ' kg P₂O₅/ha. Para la próxima: ' + Math.round(defP * 0.9) + '–' + Math.round(defP * 1.1) + ' kg P₂O₅/ha.', defP, BN_F.P2O5);
  else if (balance.P2O5 && balance.P2O5.balNeto >= 0)  pushRec('P','ok', 'Fósforo repuesto correctamente',           'La fertilización compensó la extracción. Continuar con plan de mantenimiento.', 0, null);

  var defS = balance.S ? -balance.S.balNeto : 0;
  if (defS > 5) pushRec('S','media','Déficit de Azufre','Para la próxima campaña: 15–25 kg S/ha según análisis.', defS, BN_F.S);

  if (cultStr === 'Girasol' && balance.K2O && -balance.K2O.balNeto > 50) {
    pushRec('K','alta','Girasol: alta extracción de Potasio','Extracción total: ' + balance.K2O.extrTotal + ' kg K₂O/ha. En suelos con K < 150 ppm, considerar reposición.', -balance.K2O.balNeto, BN_F.K2O);
  }
  if (mo !== null && mo < 2.5 && balance.N && balance.N.balNeto < 0) {
    pushRec('MO','media','MO baja + déficit N: ciclo negativo','MO ' + mo.toFixed(1) + '% y balance N negativo. Priorizar retención de rastrojo y cultivos de cobertura.', 0, null);
  }

  ncRenderBalance(balance, recs, { cultStr, rend, sup, rastrojoQueda, mo });
};

// ── RENDER BALANCE ───────────────────────────────────────
function ncRenderBalance(balance, recs, ctx) {
  var ph  = document.getElementById('nc-balance-placeholder');
  var out = document.getElementById('nc-balance-resultado');
  if (!out) return;
  if (ph) { ph.classList.add('hidden'); }
  out.classList.remove('hidden');

  var nutLabels = { N:'Nitrógeno (N)', P2O5:'Fósforo (P₂O₅)', K2O:'Potasio (K₂O)', S:'Azufre (S)' };
  var nutColors = { N:'#6DBF82', P2O5:'#E8B84B', K2O:'#7ABAEE', S:'#C8A255' };

  var html = '<div style="background:linear-gradient(135deg,#0E2016,#1A3A25);border-radius:16px;padding:1.2rem 1.4rem;margin-bottom:1.2rem;border:1px solid rgba(109,191,130,.2)">';
  html += '<div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(237,224,196,.8);margin-bottom:.8rem">⚖️ BALANCE POST-COSECHA — ' + ctx.cultStr.toUpperCase() + ' · ' + ctx.rend + ' t/ha · ' + ctx.sup + ' ha · Rastrojo: ' + (ctx.rastrojoQueda ? 'en campo' : 'extraído') + '</div>';
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">';
  html += '<thead><tr>';
  ['Nutriente','Extr. grano','Extr. rastrojo','Aporte ferti.','Aporte natural','Balance neto','Balance lote'].forEach(function(th) {
    html += '<th style="padding:.45rem .6rem;font-size:.62rem;text-transform:uppercase;letter-spacing:.06em;color:rgba(237,224,196,.65);text-align:center;white-space:nowrap">' + th + '</th>';
  });
  html += '</tr></thead><tbody>';

  Object.keys(balance).forEach(function(nut) {
    var b    = balance[nut];
    var clr  = nutColors[nut] || '#fff';
    var bClr = b.balNeto >= 0 ? '#6DBF82' : b.balNeto > -30 ? '#E8B84B' : '#D4522A';
    var td   = function(v, c, fam) {
      return '<td style="padding:.52rem .6rem;text-align:center;font-family:' + (fam || '\'DM Mono\',monospace') + ';font-size:.82rem;color:' + (c || 'rgba(237,224,196,.88)') + '">' + v + '</td>';
    };
    html += '<tr style="border-bottom:1px solid rgba(237,224,196,.06)">';
    html += '<td style="padding:.52rem .7rem;font-weight:600;color:' + clr + ';white-space:nowrap;font-size:.8rem">' + (nutLabels[nut]||nut) + '</td>';
    html += td('-' + b.extrGrano + ' kg/ha');
    html += td('-' + b.extrRastrojo + ' kg/ha', 'rgba(237,224,196,.62)');
    html += td('+' + b.aporteFert + ' kg/ha', '#6DBF82');
    html += td('+' + b.aporteNat + ' kg/ha', 'rgba(237,224,196,.62)');
    html += td((b.balNeto >= 0 ? '+' : '') + b.balNeto + ' kg/ha', bClr);
    html += td((b.balLote >= 0 ? '+' : '') + b.balLote + ' kg', 'rgba(237,224,196,.58)');
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  html += '<div style="font-size:.67rem;color:rgba(237,224,196,.55);margin-top:.5rem">Rastrojo ' + (ctx.rastrojoQueda ? 'retenido — nutrientes reciclados gradualmente' : 'extraído — extracción total incluida') + '</div>';
  html += '</div>';

  html += '<div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C8A255;margin-bottom:.6rem">💊 Recomendaciones próxima campaña</div>';
  if (recs.length === 0) {
    html += '<div class="alert ok"><span class="ai">✅</span><div class="ac"><strong>Balance equilibrado</strong> — La fertilización repuso adecuadamente los nutrientes. El suelo quedó en buenas condiciones.</div></div>';
  } else {
    recs.forEach(function(r) {
      var cls = { alta:'danger', media:'warn', ok:'ok' }[r.urgencia] || 'info';
      var ico = r.urgencia === 'alta' ? '🔴' : r.urgencia === 'media' ? '🟡' : '✅';
      html += '<div class="alert ' + cls + '" style="margin-bottom:.6rem"><span class="ai">' + ico + '</span><div class="ac"><strong>' + r.titulo + '</strong><br>' + r.texto;
      if (r.cant > 0 && r.fertNom) {
        html += '<div style="margin-top:.5rem;padding:.45rem .65rem;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:7px;font-size:.76rem">';
        html += '📦 ' + r.fertNom + ' · <strong>' + r.cant + ' kg/ha</strong> · USD ' + r.costo + '/ha estimado';
        html += '</div>';
      }
      html += '</div></div>';
    });
  }

  // Estado del suelo
  var sg = window._sgDatos;
  if (sg && sg.ph) {
    var mo_val = ctx.mo != null ? ctx.mo.toFixed(1) + '%' : '—';
    var nTotal = sg.n ? (sg.n * 1000).toFixed(0) + ' kg/ha' : '—';
    html += '<div class="card gap-top"><div class="card-title">🌍 Estado estimado del suelo post-cosecha</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.6rem;margin-top:.5rem">';
    [
      { label:'pH actual',     valor: sg.ph.toFixed(1), nota:'No cambia por cosecha' },
      { label:'MO estimada',   valor: mo_val,            nota: balance.N && balance.N.balNeto < -50 ? '⚠ en descenso' : 'estable' },
      { label:'N total suelo', valor: nTotal,            nota: balance.N ? (balance.N.balNeto >= 0 ? 'repuesto' : 'déficit ' + Math.abs(balance.N.balNeto) + ' kg/ha') : '—' },
    ].forEach(function(item) {
      html += '<div style="background:#fbf6ec;border-radius:10px;padding:.7rem;border:1px solid var(--border)">';
      html += '<div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(74,46,26,.4);margin-bottom:.2rem">' + item.label + '</div>';
      html += '<div style="font-size:1.1rem;font-weight:600;color:var(--earth)">' + item.valor + '</div>';
      html += '<div style="font-size:.67rem;color:rgba(74,46,26,.38);margin-top:.15rem">' + item.nota + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  html += '<div style="margin-top:.8rem;font-size:.7rem;color:#6b5b45;padding:.6rem .9rem;background:#fbf8f1;border:1px solid rgba(74,46,26,.12);border-radius:8px;line-height:1.5">📊 Tablas extracción: INTA Balcarce · Echeverría & García · FAO (2006) · Eficiencias N=65%, P=25%, K=40%, S=50%</div>';

  out.innerHTML = html;
  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

  // Exposición global
  window.CULTIVO_DB         = CULTIVO_DB;
  window.NC_FERTS           = NC_FERTS;
  window.ncActualizar       = ncActualizar;
  window.ncRenderSueloPanel = ncRenderSueloPanel;
  window.ncHidratarPKZ      = ncHidratarPKZ;

})();
