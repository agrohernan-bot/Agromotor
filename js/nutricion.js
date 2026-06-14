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

// ── HELPERS ──────────────────────────────────────────────
function ncGv(id) { var e = document.getElementById(id); return e ? (e.value || '') : ''; }
function ncGf(id) { return parseFloat(document.getElementById(id) && document.getElementById(id).value) || 0; }
function ncCultStr()  { return document.getElementById('s-cultivo') ? document.getElementById('s-cultivo').value : 'Soja'; }
function ncCultivoKey(c) {
  var map = { 'Maíz':'Maiz', 'Maiz':'Maiz', 'maíz':'Maiz', 'maiz':'Maiz',
              'Soja':'Soja', 'soja':'Soja',
              'Trigo':'Trigo', 'trigo':'Trigo',
              'Girasol':'Girasol', 'girasol':'Girasol',
              'Sorgo':'Sorgo', 'sorgo':'Sorgo',
              'Cebada':'Cebada', 'cebada':'Cebada',
              'Colza':'Colza', 'colza':'Colza' };
  return map[c] || c;
}

// Convierte _sueloDatos a kg/ha para el plan de fertilización
function ncSueloAkg(sd) {
  if (!sd || Object.keys(sd).length === 0) return {};
  var da  = (sd.da && sd.da.valor) ? sd.da.valor : 1.25;   // g/cm³
  var res = {};
  // N total (g/kg) → kg/ha en 0-30cm: N_g/kg × DA × 0.30m × 10 = N × DA × 3
  if (sd.n && sd.n.valor != null)
    res.N = { valor: Math.round(sd.n.valor * da * 3), fuente: sd.n.fuente };
  // Alternativa: MO (%) → N mineralizable ≈ 20 kg N/% MO/año
  else if (sd.mo && sd.mo.valor != null)
    res.N = { valor: Math.round(sd.mo.valor * 20), fuente: (sd.mo.fuente || '') + '·estimado' };
  // P disponible (ppm Bray) → kg/ha en 0-20cm: P_ppm × DA × 0.20m × 10 = P × DA × 2
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

function ncRenderRendSugerencias(sug) {
  var el = document.getElementById('nc-rend-sugerencias');
  if (!el) return;
  if (!sug) { el.innerHTML = ''; return; }
  var notaTxt = sug.notas.length > 0 ? sug.notas.join(', ') : '';
  var qualityNote = sug.tieneDatos && sug.factorSuelo < 90 ? ' (' + sug.factorSuelo + '% pot.)' : sug.tieneDatos ? '' : ' (sin datos suelo)';
  var html = '<div style="display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;padding:.2rem 0">';
  html += '<span style="font-size:.63rem;color:rgba(74,46,26,.4)">Referencia:</span>';
  html += '<button type="button" onclick="ncAplicarRend(' + sug.max + ')" title="Máximo regional' + (notaTxt ? ' · ' + notaTxt : '') + '" style="font-size:.67rem;padding:.14rem .45rem;border:1px solid rgba(200,100,42,.35);border-radius:4px;background:rgba(200,100,42,.07);color:#7A4A1A;cursor:pointer;font-family:inherit">📈 Máx ' + sug.max + ' t/ha</button>';
  html += '<button type="button" onclick="ncAplicarRend(' + sug.rec + ')" title="Recomendado según calidad de suelo" style="font-size:.67rem;padding:.14rem .45rem;border:1px solid rgba(74,140,92,.35);border-radius:4px;background:rgba(74,140,92,.07);color:#1b5e35;cursor:pointer;font-family:inherit">✅ Rec ' + sug.rec + ' t/ha' + qualityNote + '</button>';
  html += '</div>';
  el.innerHTML = html;
}

window.ncAplicarRend = function(val) {
  var el = document.getElementById('nc-rend-obj');
  if (el) { el.value = val; el._touched = true; ncValidarRendimiento(el); }
};

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

// ── TABS ─────────────────────────────────────────────────
window.ncSwitchTab = function(tab) {
  ['plan', 'balance'].forEach(function(t) {
    var btn   = document.getElementById('nc-tab-' + t);
    var panel = document.getElementById('nc-panel-' + t);
    var activo = t === tab;
    if (btn) {
      btn.style.color         = activo ? '#2D5A30'  : 'rgba(74,46,26,.55)';
      btn.style.borderBottom  = activo ? '3px solid #4A8C4E' : '3px solid transparent';
      btn.style.background    = activo ? 'rgba(74,140,92,.06)' : 'transparent';
      btn.style.fontWeight    = activo ? '700' : '600';
    }
    if (panel) panel.style.display = activo ? '' : 'none';
  });
  // Re-sincronizar cultivo al entrar en la pestaña balance
  if (tab === 'balance') {
    var cultivo = ncCultStr();
    var selBal  = document.getElementById('nc-bn-cultivo');
    if (selBal) selBal.value = ncCultivoKey(cultivo);
  }
};

// ── CONTEXTO LOTE Y PANEL SUELO ───────────────────────────
function ncLoteActivo() {
  if (typeof window.amGetLoteActivo === 'function') return window.amGetLoteActivo();
  return (typeof AM_LOTES !== 'undefined' && typeof AM_LOTE_ACTIVO !== 'undefined')
    ? AM_LOTES.find(function(l) { return l.id === AM_LOTE_ACTIVO; }) : null;
}

window.ncActualizar = function() {
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
    var pkzSfx = pkzId2 === 'openlandmap' ? ' + 🌍 OLM' : pkzId2.includes('idecor') ? ' + 📍 IDECOR' : pkzId2 === 'db' ? ' + 📚 DB' : '';
    var fTxt, fSty;
    if      (tieneLab && tieneSG) { fTxt = '🔬 Lab + 🛰️ SoilGrids' + pkzSfx; fSty = 'background:rgba(74,140,92,.12);color:#1b5e35;border:1px solid rgba(74,140,92,.25)'; }
    else if (tieneLab)            { fTxt = '🔬 Lab activo' + pkzSfx;            fSty = 'background:rgba(74,140,92,.12);color:#1b5e35;border:1px solid rgba(74,140,92,.25)'; }
    else if (tieneSG)             { fTxt = '🛰️ SoilGrids' + pkzSfx;             fSty = 'background:rgba(122,174,245,.1);color:#2A5A8C;border:1px solid rgba(42,90,140,.25)'; }
    else                          { fTxt = 'Sin datos de suelo';                  fSty = 'background:rgba(74,46,26,.07);color:rgba(74,46,26,.4);border:1px solid rgba(74,46,26,.12)'; }
    lblFuente.textContent = fTxt;
    lblFuente.style.cssText = 'font-size:.68rem;padding:.12rem .6rem;border-radius:6px;font-weight:700;' + fSty;
  }

  ncRenderSueloPanel();

  // Sincronizar select de balance con cultivo del lote
  var selBal = document.getElementById('nc-bn-cultivo');
  if (selBal) selBal.value = ncCultivoKey(cultivo);

  // Auto-completar desde módulos ya cargados (primera vez)
  var ncRend    = document.getElementById('nc-rend-obj');
  var ncPrecio  = document.getElementById('nc-precio-grano');
  var ncSup     = document.getElementById('nc-sup');
  var ncBnSup   = document.getElementById('nc-bn-sup');
  var bhRend    = document.getElementById('bh-rend-obj');
  var ecPrecio  = document.getElementById('ec-precio-disp');

  // Superficie desde el lote activo (tiene prioridad sobre el default)
  if (lote && lote.data) {
    var supLote = parseFloat(lote.data.superficie) || 0;
    if (supLote > 0) {
      if (ncSup && !ncSup._touched) {
        ncSup.value = supLote;
        var supBadge = document.getElementById('nc-sup-badge');
        if (supBadge) { supBadge.textContent = '← lote'; supBadge.style.display = 'inline'; }
      }
      if (ncBnSup && !ncBnSup._touched) ncBnSup.value = supLote;
    }
    // Rendimiento del plan guardado previamente (si balance hídrico no lo pisó)
    var planPrev = lote.data.nutricionPlan;
    if (ncRend && !ncRend._touched && planPrev && planPrev.rendimiento && !bhRend?.value) {
      ncRend.value = planPrev.rendimiento;
    }
  }

  if (bhRend && bhRend.value && ncRend && !ncRend._touched) ncRend.value = bhRend.value;
  if (ecPrecio && ecPrecio.value && ncPrecio && !ncPrecio._touched) ncPrecio.value = ecPrecio.value;
  if (ncSup && ncBnSup && ncSup.value && !ncBnSup._touched) ncBnSup.value = ncSup.value;

  // Chips de rendimiento sugerido según cultivo + calidad de suelo
  ncRenderRendSugerencias(ncSugerirRendimiento(ncCultivoKey(cultivo), sd));
};

function ncRenderSueloPanel() {
  var panel = document.getElementById('nc-suelo-panel');
  if (!panel) return;
  var sd    = window._sueloDatos || {};
  var hasDatos = Object.keys(sd).length > 0;

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
    var esDB   = v.fuente === 'db';
    var srcIco = esLab ? ' 🔬' : esOLM ? ' 🌍' : esIDEC ? ' 📍' : esDB ? ' 📚' : '';
    var color = esLab ? '#1b5e35' : esOLM ? '#2A6E3A' : esIDEC ? '#1A5A8C' : esDB ? '#7a5c3a' : '#2A5A8C';
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
window.ncPlanCalcular = function() {
  var cultStr = ncCultStr();
  var cultKey = ncCultivoKey(cultStr);
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

  var sd      = window._sueloDatos || {};
  var sueloKg = ncSueloAkg(sd);
  // tienePLab/tieneKLab: cualquier fuente (lab, OLM, IDECOR, DB) — habilita cálculo de déficit
  var tienePLab = sd.p && sd.p.valor != null;
  var tieneKLab = sd.k && sd.k.valor != null;
  var fuenteP   = sd.p ? (sd.p.fuente || null) : null;

  var nutList = ['N', 'P', 'S'];
  if (tieneKLab) nutList.push('K'); // incluye K si viene de cualquier fuente (OLM, DB, lab)

  var resultados = {};
  var costoTotal = 0;

  nutList.forEach(function(nut) {
    var fert = NC_FERTS[nut];
    if (!fert) return;

    var disponible = sueloKg[nut] ? sueloKg[nut].valor : null;
    var fuenteDisp = sueloKg[nut] ? sueloKg[nut].fuente : null;

    // Requerimiento del cultivo (kg nutriente/ha)
    var reqBase;
    if      (nut === 'N') reqBase = (db.req.N || 0) * rendObj;
    else if (nut === 'P') reqBase = (db.req.P || 0) * rendObj;
    else if (nut === 'K') reqBase = (db.req.K || 0) * rendObj;
    else if (nut === 'S') reqBase = db.ext.S ? db.ext.S.grano * rendObj : 0;

    // Déficit
    var deficit = disponible != null ? Math.max(0, reqBase - disponible) : reqBase;

    // Dosis óptima económica (N, P, S tienen curvas; K no)
    var dosisCurva = null, bcOpt = null;
    if (nut !== 'K' && db.curvas && db.curvas[nut]) {
      var Pf_kg = precios[nut] / 1000 / fert.fraccion;
      var opt   = ncCalcOptima(db.curvas[nut], Pg_kg, Pf_kg);
      dosisCurva = Math.round(opt.Xopt);
      bcOpt      = opt.bc;
    }

    // Recomendación integrada
    var dosisRec;
    if (nut === 'K') {
      dosisRec = deficit;
    } else if (dosisCurva !== null) {
      if (db.esFBN && nut === 'N') {
        // Soja FBN: dosis N muy conservadora (arranque)
        dosisRec = Math.min(deficit * 0.6, dosisCurva * 0.5, 40);
      } else if (!tienePLab && nut === 'P') {
        // Sin análisis de P de suelo: confiar en curva óptima
        dosisRec = dosisCurva;
      } else {
        // Ponderar déficit y curva óptima
        var pond = disponible != null ? 0.55 : 0.35;   // + peso déficit si hay dato real
        dosisRec = pond * deficit + (1 - pond) * dosisCurva;
        dosisRec = Math.max(deficit * 0.8, Math.min(dosisCurva * 1.2, dosisRec));
      }
    } else {
      dosisRec = deficit;
    }
    dosisRec = Math.max(0, Math.round(dosisRec));

    var kgFert = Math.round(dosisRec / fert.fraccion);
    var costo  = (kgFert / 1000) * precios[nut];
    costoTotal += costo;

    resultados[nut] = {
      disponible: disponible, fuenteDisp: fuenteDisp,
      reqBase: Math.round(reqBase),
      deficit: Math.round(deficit),
      dosisCurva: dosisCurva, bcOpt: bcOpt,
      dosisRec: dosisRec, kgFert: kgFert, costo: costo,
      fertNombre: fert.nombre,
    };
  });

  ncRenderPlan(resultados, { cultStr, rendObj, precioG, sup, costoTotal, esFBN: db.esFBN, tienePLab, tieneKLab, fuenteP });
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
  var html = '<div style="background:linear-gradient(135deg,#0E2016,#1A3A25);border-radius:14px;padding:1.1rem 1.4rem;margin-bottom:1.1rem;border:1px solid rgba(109,191,130,.2)">';
  html += '<div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(237,224,196,.75);margin-bottom:.7rem">';
  html += '📋 PLAN · ' + ctx.cultStr.toUpperCase() + ' · ' + ctx.rendObj + ' t/ha · USD ' + Math.round(ctx.precioG) + '/t grano</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.6rem">';
  html += '<div style="text-align:center;background:rgba(255,255,255,.09);padding:.7rem;border-radius:9px"><div style="font-size:1.3rem;font-weight:700;color:#6DBF82">USD ' + Math.round(ctx.costoTotal) + '/ha</div><div style="font-size:.62rem;color:rgba(237,224,196,.65);text-transform:uppercase;margin-top:.15rem">Costo total fertilización</div></div>';
  html += '<div style="text-align:center;background:rgba(255,255,255,.09);padding:.7rem;border-radius:9px"><div style="font-size:1.3rem;font-weight:700;color:#E8B84B">USD ' + Math.round(ctx.costoTotal * ctx.sup / 1000) + 'k</div><div style="font-size:.62rem;color:rgba(237,224,196,.65);text-transform:uppercase;margin-top:.15rem">Campaña total (' + ctx.sup + ' ha)</div></div>';
  html += '</div></div>';

  if (ctx.esFBN) {
    html += '<div class="alert info" style="margin-bottom:.9rem"><span class="ai">💡</span><div class="ac"><strong>Soja — Fijación Biológica de N (FBN):</strong> Con inoculación de <em>Bradyrhizobium</em>, la soja cubre hasta el 80% de sus necesidades de N. La dosis de N indicada es para arranque o ambientes de alto potencial.</div></div>';
  }

  // Tarjetas por nutriente
  html += '<div style="display:flex;flex-direction:column;gap:.65rem">';
  Object.keys(res).forEach(function(nut) {
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

    // KPIs
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:.42rem;margin-bottom:.5rem">';
    var kpis = [
      { lbl:'Disponible suelo',   val: r.disponible != null ? r.disponible + ' kg/ha' : '—', xtra: fuenteBadge },
      { lbl:'Requerimiento',      val: r.reqBase + ' kg/ha' },
      { lbl:'Déficit real',       val: r.deficit + ' kg/ha',    clr: r.deficit > 0 ? '#C0392B' : '#1b5e35' },
      { lbl:'Dosis óptima INTA',  val: r.dosisCurva != null ? r.dosisCurva + ' kg/ha' : '—' },
      { lbl:'Recomendación',      val: r.dosisRec + ' kg/ha',   clr: color, bold: true },
      { lbl:'Producto',           val: r.kgFert + ' kg/ha' },
      { lbl:'Relación B/C',       val: bc,                       clr: r.bcOpt != null && r.bcOpt >= 1.2 ? '#1b5e35' : r.bcOpt != null && r.bcOpt < 1 ? '#C0392B' : '#C8A255' },
      { lbl:'Costo',              val: 'USD ' + r.costo.toFixed(0) + '/ha' },
    ];
    kpis.forEach(function(kpi) {
      html += '<div style="background:#f9f7f2;border-radius:7px;padding:.42rem .6rem;border:1px solid rgba(74,46,26,.09)">';
      html += '<div style="font-size:.63rem;text-transform:uppercase;letter-spacing:.04em;color:rgba(74,46,26,.52);margin-bottom:.12rem">' + kpi.lbl + (kpi.xtra || '') + '</div>';
      html += '<div style="font-size:.86rem;font-weight:' + (kpi.bold ? '700' : '600') + ';color:' + (kpi.clr || '#1A2A1A') + ';font-family:\'DM Mono\',monospace">' + kpi.val + '</div>';
      html += '</div>';
    });
    html += '</div>';

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

  html += '<div style="margin-top:.9rem;font-size:.7rem;color:#6b5b45;padding:.6rem .9rem;background:#fbf8f1;border:1px solid rgba(74,46,26,.12);border-radius:8px;line-height:1.5">';
  html += '📊 <strong>Metodología:</strong> Déficit = requerimiento cultivo − disponible en suelo. ';
  html += 'Dosis óptima = curva respuesta cuadrática INTA Marcos Juárez / Balcarce / Oliveros. ';
  html += 'Recomendación pondera ambos enfoques según disponibilidad de datos. Calibrar con análisis local.';
  html += '</div>';

  out.innerHTML = html;
  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ════════════════════════════════════════════════════════
// TAB B — BALANCE POST-COSECHA
// ════════════════════════════════════════════════════════
window.ncBalanceCalcular = function() {
  var cultStr  = ncGv('nc-bn-cultivo') || 'Soja';
  var cultKey  = ncCultivoKey(cultStr);
  var db       = CULTIVO_DB[cultKey];
  if (!db) { alert('Cultivo no encontrado: ' + cultStr); return; }

  var rend     = parseFloat(ncGv('nc-bn-rend'))   || 3.5;
  var sup      = parseFloat(ncGv('nc-bn-sup'))    || 100;
  var rastrojo = ncGv('nc-bn-rastrojo') || 'campo';
  var fertN    = parseFloat(ncGv('nc-bn-fert-n')) || 0;
  var fertP    = parseFloat(ncGv('nc-bn-fert-p')) || 0;
  var fertS    = parseFloat(ncGv('nc-bn-fert-s')) || 0;

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
  window.CULTIVO_DB           = CULTIVO_DB;
  window.NC_FERTS             = NC_FERTS;
  window.ncActualizar         = ncActualizar;
  window.ncRenderSueloPanel   = ncRenderSueloPanel;
  window.ncSugerirRendimiento = ncSugerirRendimiento;

})();
