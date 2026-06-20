// ════════════════════════════════════════════════════════
// AGROMOTOR — huella-carbono.js  v1.0
// Calculadora de Huella de Carbono de la campaña
//
// Factores de emisión (kg CO₂-eq) basados en:
//   · IPCC 2006 Guidelines (N₂O from N application: EF = 0.01 kg N₂O-N/kg N, GWP N₂O = 298)
//   · Ecoinvent 3.x (fabricación de insumos agrícolas)
//   · INTA EEA Rafaela / SAyDS Argentina (factores locales)
//
// Fuentes de emisión consideradas:
//   1. Fertilizantes N (síntesis + emisión directa N₂O)
//   2. Fertilizantes P, S
//   3. Combustible (labranza + siembra + cosecha)
//   4. Agroquímicos
//   5. Semilla
// ════════════════════════════════════════════════════════

(function () {
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// FACTORES DE EMISIÓN
// ─────────────────────────────────────────────────────────────────────────────

// kg CO₂-eq por kg de N puro aplicado
//   - Fabricación urea: 6.7 kg CO₂-eq/kg N
//   - N₂O directo: 0.01 kg N₂O-N/kg N → 0.01 × 44/28 × 298 = 4.70 kg CO₂-eq/kg N
//   - N₂O indirecto (lixiviación/volatilización): ~1.5 kg CO₂-eq/kg N
var FE_N_KG_CO2EQ = 6.7 + 4.70 + 1.5;   // = 12.9 kg CO₂-eq / kg N

// kg CO₂-eq por kg de P₂O₅ (MAP/TSP fabricación): ~2.4
var FE_P_KG_CO2EQ = 2.4;

// kg CO₂-eq por kg de S (SuMag fabricación): ~0.7
var FE_S_KG_CO2EQ = 0.7;

// kg CO₂-eq por litro de gasoil (combustión): 2.67 kg CO₂-eq/L
var FE_GASOIL      = 2.67;

// kg CO₂-eq por kg de ingrediente activo agroquímico (media agroquímicos):
//   - Herbicida sistémico (glifosato): ~18 kg CO₂-eq/kg IA
//   - Fungicida/insecticida: ~30 kg CO₂-eq/kg IA
//   - Media práctica: ~22 kg CO₂-eq/kg IA
var FE_AGROQUIMICO = 22.0;

// kg CO₂-eq por kg de semilla (soja, maíz, etc.): ~0.4-0.6 (producción + secado)
var FE_SEMILLA     = 0.50;

// ─────────────────────────────────────────────────────────────────────────────
// DATOS POR DEFECTO SEGÚN CULTIVO (dosis típicas zona pampeana)
// ─────────────────────────────────────────────────────────────────────────────

var DEFAULTS = {
  soja:    { n_kg:  10, p_kg:  30, s_kg: 10, diesel_l: 40, agrq_kg: 2.5, semilla_kg: 70,  rend_t: 3.3 },
  maiz:    { n_kg: 120, p_kg:  50, s_kg: 15, diesel_l: 60, agrq_kg: 2.0, semilla_kg: 25,  rend_t: 8.5 },
  trigo:   { n_kg:  80, p_kg:  40, s_kg: 12, diesel_l: 55, agrq_kg: 1.8, semilla_kg: 160, rend_t: 3.5 },
  cebada:  { n_kg:  75, p_kg:  35, s_kg: 12, diesel_l: 50, agrq_kg: 1.5, semilla_kg: 150, rend_t: 3.7 },
  girasol: { n_kg:  50, p_kg:  30, s_kg: 10, diesel_l: 45, agrq_kg: 1.5, semilla_kg:  8,  rend_t: 2.4 },
  sorgo:   { n_kg:  80, p_kg:  40, s_kg: 10, diesel_l: 50, agrq_kg: 1.2, semilla_kg: 10,  rend_t: 6.0 },
};

// Benchmarks CO₂-eq/t de grano (kg)
var BENCHMARK = {
  soja:    { min: 300, max: 700, label: 'Soja pampeana' },
  maiz:    { min: 150, max: 450, label: 'Maíz pampeano' },
  trigo:   { min: 250, max: 600, label: 'Trigo pampeano' },
  cebada:  { min: 240, max: 580, label: 'Cebada pampeana' },
  girasol: { min: 200, max: 500, label: 'Girasol pampeano' },
  sorgo:   { min: 130, max: 380, label: 'Sorgo pampeano' },
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

function gi(id) { return document.getElementById(id); }
function gv(id) { return parseFloat((gi(id) || {}).value) || 0; }
function _ls(k) { try { return localStorage.getItem(k) || ''; } catch(_) { return ''; } }

function _loteActivo() {
  try {
    return (typeof window.amGetLoteActivo === 'function') ? window.amGetLoteActivo() : null;
  } catch(_) {
    return null;
  }
}

function _loteVal(data, keys) {
  data = data || {};
  for (var i = 0; i < keys.length; i++) {
    var v = data[keys[i]];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

function _normCultivo(c) {
  var s = (c || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (s.includes('maiz') || s.includes('maíz')) return 'maiz';
  if (s.includes('trigo'))   return 'trigo';
  if (s.includes('cebada'))  return 'cebada';
  if (s.includes('girasol')) return 'girasol';
  if (s.includes('sorgo'))   return 'sorgo';
  if (s.includes('soja'))    return 'soja';
  return null;
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULO
// ─────────────────────────────────────────────────────────────────────────────

function calcular() {
  var n       = gv('hc-n');
  var p       = gv('hc-p');
  var s       = gv('hc-s');
  var diesel  = gv('hc-diesel');
  var agrq    = gv('hc-agrq');
  var semilla = gv('hc-semilla');
  var rend    = gv('hc-rend') || 1;

  var emN       = n       * FE_N_KG_CO2EQ;
  var emP       = p       * FE_P_KG_CO2EQ;
  var emS       = s       * FE_S_KG_CO2EQ;
  var emDiesel  = diesel  * FE_GASOIL;
  var emAgrq    = agrq    * FE_AGROQUIMICO;
  var emSemilla = semilla * FE_SEMILLA;

  var total = emN + emP + emS + emDiesel + emAgrq + emSemilla;
  var porT  = rend > 0 ? total / rend : 0;
  var porQq = porT / 10;  // 1 t = 10 qq

  return {
    emN, emP, emS, emDiesel, emAgrq, emSemilla, total, porT, porQq,
    rend, n, p, s, diesel, agrq, semilla,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────────

function renderModulo() {
  var el = gi('mod-huella-carbono');
  if (!el) return;

  var loteObj = _loteActivo();
  var data    = (loteObj && loteObj.data) || {};
  var cultivo = _loteVal(data, ['cultivo','cultivoActual']) || _ls('am_siembra_cultivo') || (gi('s-cultivo') ? gi('s-cultivo').value : '') || 'Soja';
  var cultKey = _normCultivo(cultivo) || 'soja';
  var def     = DEFAULTS[cultKey] || DEFAULTS.soja;
  var lote    = (loteObj && loteObj.nombre) || _ls('am_lote_nombre') || 'Lote Principal';
  var rendLote = _loteVal(data, ['rendimientoProyectado','rendimientoObjetivo','rendimientoEsperado']);
  var rend    = parseFloat(_ls('hc_rend_guardado')) || parseFloat(rendLote) || def.rend_t;

  // Pre-fill con datos del módulo nutrición si están disponibles
  var ncN = parseFloat((gi('nc-rend-obj') || {}).value) || 0;

  el.innerHTML = '<div class="hc-wrap" style="max-width:700px">' +
    _htmlHeader(cultivo, lote) +
    _htmlForm(def, rend, cultKey) +
    '<div id="hc-resultado"></div>' +
  '</div>';

  _initForm();
  // Auto-calcular al cargar
  hcCalcular();
}

function _htmlHeader(cultivo, lote) {
  return '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:1.1rem">' +
    '<div><div class="module-title" style="margin-bottom:.15rem">🌍 Huella de Carbono</div>' +
    '<div class="module-subtitle">Emisiones CO₂-eq de la campaña · Benchmarks INTA · Factores IPCC</div></div>' +
    '<div style="display:flex;gap:.4rem;align-items:center">' +
      (cultivo ? '<span style="font-size:.72rem;background:rgba(42,122,74,.1);color:#2A7A4A;border:1px solid rgba(42,122,74,.25);padding:2px 8px;border-radius:5px;font-weight:700">🌾 ' + _esc(cultivo) + '</span>' : '') +
      '<span style="font-size:.68rem;color:#6b7280">📂 ' + _esc(lote) + '</span>' +
    '</div>' +
  '</div>';
}

function _htmlForm(def, rend, cultKey) {
  return '<div class="card" style="border:1.5px solid rgba(42,122,74,.2);background:#f8fdfb;margin-bottom:1rem">' +
    '<div class="card-title" style="color:#2A7A4A;margin-bottom:.8rem">📥 Insumos de la campaña <span style="font-size:.68rem;font-weight:400;color:#6b7280">— valores por hectárea</span></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
      _inputRow('hc-n',       'N aplicado (kg N/ha)',          def.n_kg,      'Incluir todo el N: urea, UAN, etc.') +
      _inputRow('hc-p',       'P₂O₅ aplicado (kg/ha)',         def.p_kg,      'MAP, TSP, fosfato diamónico') +
      _inputRow('hc-s',       'S aplicado (kg S/ha)',          def.s_kg,      'SuMag, azufre elemental, yeso') +
      _inputRow('hc-diesel',  'Gasoil (L/ha)',                 def.diesel_l,  'Todas las labores: labranza, siembra, cosecha') +
      _inputRow('hc-agrq',    'Agroquímicos (kg IA/ha)',        def.agrq_kg,   'Kilogramos de ingrediente activo total') +
      _inputRow('hc-semilla', 'Semilla (kg/ha)',                def.semilla_kg,'Peso de semilla usado en siembra') +
      _inputRow('hc-rend',    'Rendimiento esperado (t/ha)',    rend,          'Para calcular kg CO₂-eq por tonelada') +
    '</div>' +
    '<button onclick="hcCalcular()" style="margin-top:.85rem;background:#2A7A4A;color:#fff;border:none;border-radius:10px;padding:.6rem 1.4rem;font-size:.87rem;font-weight:700;cursor:pointer;font-family:inherit">🧮 Calcular huella</button>' +
  '</div>';
}

function _inputRow(id, label, def, help) {
  return '<div class="fg">' +
    '<label style="font-size:.68rem">' + label + ' <span style="color:#9ca3af" title="' + _esc(help) + '">?</span></label>' +
    '<input type="number" id="' + id + '" value="' + def + '" min="0" step="0.1" style="font-family:inherit" oninput="hcCalcular()">' +
  '</div>';
}

function _initForm() {
  // Pre-fill desde módulo nutrición si disponible
  var ncN = parseFloat((_ls('nc_n_kg') || '0')) || 0;
  if (ncN > 0 && gi('hc-n')) gi('hc-n').value = ncN;
}

function renderResultado(r, cultKey) {
  var el = gi('hc-resultado');
  if (!el) return;

  var comp = [
    { label: 'Fertilización N',   val: r.emN,       color: '#D4522A', pct: r.total > 0 ? r.emN/r.total*100 : 0 },
    { label: 'Fertilización P/S', val: r.emP+r.emS,  color: '#B87A20', pct: r.total > 0 ? (r.emP+r.emS)/r.total*100 : 0 },
    { label: 'Combustible',       val: r.emDiesel,   color: '#2A5A8C', pct: r.total > 0 ? r.emDiesel/r.total*100 : 0 },
    { label: 'Agroquímicos',      val: r.emAgrq,     color: '#6B5B95', pct: r.total > 0 ? r.emAgrq/r.total*100 : 0 },
    { label: 'Semilla',           val: r.emSemilla,  color: '#3A7A4A', pct: r.total > 0 ? r.emSemilla/r.total*100 : 0 },
  ];

  // Benchmark
  var bench = BENCHMARK[cultKey] || BENCHMARK.soja;
  var benchMid = (bench.min + bench.max) / 2;
  var vsB = r.porT > 0 ? (r.porT - benchMid) / benchMid * 100 : 0;
  var bColor = vsB < -10 ? '#2A7A4A' : vsB < 10 ? '#C8A255' : '#D4522A';
  var bLabel = vsB < -10 ? 'Por debajo del promedio ✅' : vsB < 10 ? 'En la media 🟡' : 'Por encima del promedio ⚠️';

  var html = '<div class="card" style="border:1.5px solid rgba(42,90,140,.2);background:#f8fafb">' +
    '<div class="card-title" style="color:#2A5A8C;margin-bottom:.8rem">📊 Resultados</div>';

  // KPIs principales
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem;margin-bottom:1rem">';
  html += _kpiCard('Total por ha', Math.round(r.total) + ' kg CO₂-eq', '#374151', '#f1f5f9');
  html += _kpiCard('Por tonelada de grano', Math.round(r.porT) + ' kg CO₂-eq/t', '#2A5A8C', '#f0f7fd');
  html += _kpiCard('Por quintal', Math.round(r.porQq * 10) / 10 + ' kg CO₂-eq/qq', '#3A7A4A', '#f0fdf4');
  html += '</div>';

  // Benchmark
  html += '<div style="background:' + bColor + '12;border:1px solid ' + bColor + '44;border-radius:8px;padding:.6rem .9rem;margin-bottom:.85rem">' +
    '<div style="font-size:.68rem;font-weight:700;color:' + bColor + ';text-transform:uppercase;letter-spacing:.04em;margin-bottom:.2rem">📊 Benchmark: ' + _esc(bench.label) + ' (' + bench.min + '–' + bench.max + ' kg CO₂-eq/t)</div>' +
    '<div style="font-size:.78rem;color:#374151">' + bLabel + ' · ' + (vsB >= 0 ? '+' : '') + Math.round(vsB) + '% vs media (' + Math.round(benchMid) + ' kg CO₂-eq/t)</div>' +
  '</div>';

  // Gráfico de barras horizontal (desglose)
  html += '<div style="margin-bottom:.65rem">';
  html += '<div style="font-size:.65rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.45rem">Desglose de emisiones</div>';
  comp.forEach(function(c) {
    html += '<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.35rem">' +
      '<div style="font-size:.68rem;color:#374151;min-width:130px;white-space:nowrap">' + c.label + '</div>' +
      '<div style="flex:1;height:14px;background:#f1f5f9;border-radius:4px;overflow:hidden">' +
        '<div style="height:100%;width:' + Math.round(c.pct) + '%;background:' + c.color + ';border-radius:4px;transition:width .4s"></div>' +
      '</div>' +
      '<div style="font-size:.68rem;color:#374151;min-width:90px;text-align:right">' + Math.round(c.val) + ' kg (' + Math.round(c.pct) + '%)</div>' +
    '</div>';
  });
  html += '</div>';

  // Oportunidades de reducción
  html += '<div style="border-top:1px solid #e5e7eb;padding-top:.65rem">';
  html += '<div style="font-size:.68rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.4rem">🌱 Oportunidades de reducción</div>';
  var ops = [];
  if (r.n > 60)  ops.push('🧪 N: ajustar dosis con análisis de suelo puede reducir hasta 15-25% de la huella total');
  if (r.diesel > 60) ops.push('⛽ Combustible: adoptar siembra directa o reducir labores puede bajar 10-20 L/ha');
  if (r.agrq > 2.5)  ops.push('💊 Agroquímicos: manejo integrado de plagas y malezas reduce IA/ha');
  if (ops.length === 0) ops.push('✅ Perfil de emisiones eficiente para el cultivo. Mantener prácticas actuales.');
  ops.forEach(function(o) {
    html += '<div style="font-size:.72rem;color:#374151;background:#f9fafb;border-radius:5px;padding:.3rem .55rem;margin-bottom:.25rem;border-left:3px solid #3A7A4A">' + _esc(o) + '</div>';
  });
  html += '</div>';

  html += '<div style="font-size:.6rem;color:#9ca3af;margin-top:.55rem;border-top:1px solid #e5e7eb;padding-top:.4rem">' +
    '📚 Factores IPCC 2006 + Ecoinvent 3 + INTA EEA Rafaela · GWP CH₄=25, N₂O=298 (AR4) · No incluye secuestro de carbono en suelo.' +
  '</div></div>';

  el.innerHTML = html;
}

function _kpiCard(label, val, color, bg) {
  return '<div style="background:' + bg + ';border-radius:9px;padding:.7rem;text-align:center">' +
    '<div style="font-size:.95rem;font-weight:800;color:' + color + '">' + val + '</div>' +
    '<div style="font-size:.62rem;color:#6b7280;margin-top:.15rem">' + label + '</div>' +
  '</div>';
}

window.hcCalcular = function() {
  var cultivo = _ls('am_siembra_cultivo') || (gi('s-cultivo') ? gi('s-cultivo').value : '') || 'Soja';
  var cultKey = _normCultivo(cultivo) || 'soja';
  var r = calcular();
  renderResultado(r, cultKey);
  // Guardar rendimiento para persistencia
  try { localStorage.setItem('hc_rend_guardado', gv('hc-rend').toString()); } catch(_) {}
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

window.huellaCarbonoRender = renderModulo;

})(); // fin huella-carbono.js
