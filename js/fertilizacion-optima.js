// ════════════════════════════════════════════════════════
// AGROMOTOR — fertilizacion-optima.js
// Dosis económicamente óptima · Curva respuesta cuadrática
// Modelo INTA adaptado zona pampeana (N, P, S por cultivo)
// ════════════════════════════════════════════════════════

(function() {
  window.AM = window.AM || {};
  window.AM.fertilizacionOptima = {};

// Parámetros curva respuesta Y = Yb + b*X + c*X² (Y en kg/ha, X en kg/ha nutriente)
// Donde la dosis óptima es X* = (b - Pf/Pg/EFF) / (-2c)
// Fuente: INTA Marcos Juárez / Balcarce / Oliveros · series históricas

const FO_CURVAS = {
  Maiz: {
    N: { Yb: 6500, b: 35.0, c: -0.115, EFF: 0.65, rango: [0, 200], unidad: 'kg N/ha' },
    P: { Yb: 6500, b: 18.0, c: -0.080, EFF: 0.30, rango: [0, 80],  unidad: 'kg P₂O₅/ha' },
    S: { Yb: 6500, b:  6.0, c: -0.030, EFF: 0.50, rango: [0, 40],  unidad: 'kg S/ha' },
  },
  Soja: {
    N: { Yb: 3200, b:  4.0, c: -0.025, EFF: 0.50, rango: [0, 50],  unidad: 'kg N/ha' }, // FBN + pequeña respuesta a N arranque
    P: { Yb: 3200, b: 14.0, c: -0.070, EFF: 0.30, rango: [0, 80],  unidad: 'kg P₂O₅/ha' },
    S: { Yb: 3200, b:  8.0, c: -0.045, EFF: 0.50, rango: [0, 30],  unidad: 'kg S/ha' },
  },
  Trigo: {
    N: { Yb: 3500, b: 22.0, c: -0.080, EFF: 0.60, rango: [0, 160], unidad: 'kg N/ha' },
    P: { Yb: 3500, b: 10.0, c: -0.055, EFF: 0.28, rango: [0, 60],  unidad: 'kg P₂O₅/ha' },
    S: { Yb: 3500, b:  5.5, c: -0.030, EFF: 0.50, rango: [0, 30],  unidad: 'kg S/ha' },
  },
  Girasol: {
    N: { Yb: 2200, b: 14.0, c: -0.055, EFF: 0.55, rango: [0, 120], unidad: 'kg N/ha' },
    P: { Yb: 2200, b:  8.0, c: -0.040, EFF: 0.28, rango: [0, 60],  unidad: 'kg P₂O₅/ha' },
    S: { Yb: 2200, b:  6.0, c: -0.035, EFF: 0.50, rango: [0, 30],  unidad: 'kg S/ha' },
  },
  Sorgo: {
    N: { Yb: 5000, b: 25.0, c: -0.090, EFF: 0.60, rango: [0, 160], unidad: 'kg N/ha' },
    P: { Yb: 5000, b: 12.0, c: -0.060, EFF: 0.28, rango: [0, 60],  unidad: 'kg P₂O₅/ha' },
    S: { Yb: 5000, b:  5.0, c: -0.025, EFF: 0.50, rango: [0, 30],  unidad: 'kg S/ha' },
  },
};

// Contenido de nutriente en fertilizante (fracción)
const FO_FERT = {
  N: { nombre: 'Urea 46%', fraccion: 0.46, idPrecio: 'fo-precio-n' },
  P: { nombre: 'MAP 11-52', fraccion: 0.52, idPrecio: 'fo-precio-p' },
  S: { nombre: 'SuMag / Azufre', fraccion: 0.22, idPrecio: 'fo-precio-s' },
};

function foGv(id) {
  const el = document.getElementById(id);
  return el ? (parseFloat(el.value) || 0) : 0;
}

function foCalcOptimo(curva, precioGrano_kgUSD, precioFert_kgUSD) {
  // Rendimiento en kg/ha → precio en USD/kg
  const { Yb, b, c, EFF, rango } = curva;
  // dY/dX = b + 2c*X = precioFert / (precioGrano * EFF)
  const ratio = precioFert_kgUSD / (precioGrano_kgUSD * EFF);
  let Xopt = (b - ratio) / (-2 * c);
  Xopt = Math.max(rango[0], Math.min(rango[1], Xopt));

  const Yopt = Yb + b * Xopt + c * Xopt * Xopt;
  const Ybase = Yb;
  const deltaY = Math.max(0, Yopt - Ybase);
  const beneficioBruto = deltaY * precioGrano_kgUSD;  // USD/ha
  const costFert = Xopt * precioFert_kgUSD;            // USD/ha
  const margen = beneficioBruto - costFert;
  const relBenCost = costFert > 0 ? beneficioBruto / costFert : 0;

  return { Xopt, Yopt, Ybase, deltaY, beneficioBruto, costFert, margen, relBenCost };
}

window.foAnalizar = function() {
  const resEl = document.getElementById('fo-resultado');
  if (!resEl) return;

  const cultivo    = document.getElementById('fo-cultivo')?.value || 'Maiz';
  const rendObj    = foGv('fo-rend-obj') || parseFloat(document.getElementById('bh-rend-obj')?.value) || 4.0;
  const precioGrano= foGv('fo-precio-grano') || parseFloat(document.getElementById('ec-precio-disp')?.value) || 300;
  const precioN_t  = foGv('fo-precio-n') || 380;
  const precioP_t  = foGv('fo-precio-p') || 620;
  const precioS_t  = foGv('fo-precio-s') || 280;

  // Precio por kg de nutriente puro (USD)
  const cultKey = Object.keys(FO_CURVAS).find(k => k.toLowerCase() === cultivo.toLowerCase()) || 'Maiz';
  const curvas  = FO_CURVAS[cultKey];
  const Pg_kg   = precioGrano / 1000;  // USD/kg de grano

  const nutrientes = ['N', 'P', 'S'];
  const precios_t  = { N: precioN_t, P: precioP_t, S: precioS_t };
  const resultados = {};
  let totalCosto = 0, totalMargen = 0;

  nutrientes.forEach(nut => {
    const frac     = FO_FERT[nut].fraccion;
    const Pf_kg    = precios_t[nut] / 1000 / frac;  // USD/kg nutriente puro
    const res      = foCalcOptimo(curvas[nut], Pg_kg, Pf_kg);
    const kgFert   = res.Xopt / frac;
    res.kgFert     = kgFert;
    res.precioFert_t = precios_t[nut];
    resultados[nut] = res;
    totalCosto  += res.costFert;
    totalMargen += res.margen;
  });

  const kpiColor = (v) => v >= 2 ? '#1b5e35' : v >= 1.2 ? '#C8A255' : '#C0392B';

  const cardNut = (nut) => {
    const r = resultados[nut];
    const info = FO_FERT[nut];
    const rentable = r.relBenCost >= 1.2;
    return `
      <div style="background:#fff;border-radius:10px;padding:.9rem;border:1.5px solid ${rentable ? 'rgba(74,140,92,.25)' : 'rgba(212,82,42,.2)'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
          <div style="font-weight:700;font-size:.88rem;color:#1b5e35">${nut} — ${info.nombre}</div>
          <div style="font-size:.7rem;font-weight:700;padding:.2rem .55rem;border-radius:20px;
            background:${rentable ? 'rgba(74,140,92,.1)' : 'rgba(212,82,42,.1)'};
            color:${rentable ? '#1b5e35' : '#C0392B'}">
            ${rentable ? '✅ Rentable' : '⚠️ Sin margen'}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.5rem">
          <div style="text-align:center">
            <div style="font-size:1.1rem;font-weight:700;color:#1b5e35">${r.Xopt.toFixed(0)} kg/ha</div>
            <div style="font-size:.6rem;color:#6b7280;text-transform:uppercase">${curvas[nut].unidad.split(' ')[1] || 'Nutriente'}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:1.1rem;font-weight:700;color:#1b5e35">${r.kgFert.toFixed(0)} kg/ha</div>
            <div style="font-size:.6rem;color:#6b7280;text-transform:uppercase">Producto</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:1.1rem;font-weight:700;color:${kpiColor(r.relBenCost)}">${r.relBenCost.toFixed(1)}:1</div>
            <div style="font-size:.6rem;color:#6b7280;text-transform:uppercase">Relación B/C</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.75rem;color:rgba(74,46,26,.55);border-top:1px solid rgba(74,46,26,.08);padding-top:.45rem">
          <span>Costo: <strong>USD ${r.costFert.toFixed(0)}/ha</strong></span>
          <span>Beneficio: <strong>USD ${r.beneficioBruto.toFixed(0)}/ha</strong></span>
          <span>Margen: <strong style="color:${r.margen>0?'#1b5e35':'#C0392B'}">USD ${r.margen.toFixed(0)}/ha</strong></span>
        </div>
      </div>`;
  };

  const html = `
    <div style="margin-bottom:.8rem;padding:.8rem 1rem;background:#fff;border-radius:11px;border:1.5px solid rgba(74,140,92,.35);box-shadow:0 2px 8px rgba(0,0,0,.15)">
      <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#1b5e35;margin-bottom:.5rem">
        ${cultivo.toUpperCase()} · Precio grano USD ${precioGrano}/t · Rendimiento objetivo ${rendObj} t/ha
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
        <div style="text-align:center;background:#f4faf6;padding:.55rem;border-radius:9px">
          <div style="font-size:1.25rem;font-weight:700;color:#1b5e35">USD ${totalCosto.toFixed(0)}/ha</div>
          <div style="font-size:.64rem;color:#374151;text-transform:uppercase;font-weight:600">Costo total fertilización</div>
        </div>
        <div style="text-align:center;background:${totalMargen>=0?'#f4faf6':'#fce6dc'};padding:.55rem;border-radius:9px">
          <div style="font-size:1.25rem;font-weight:700;color:${totalMargen>=0?'#1b5e35':'#C0392B'}">USD ${totalMargen.toFixed(0)}/ha</div>
          <div style="font-size:.64rem;color:#374151;text-transform:uppercase;font-weight:600">Margen neto total</div>
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:.65rem">
      ${cardNut('N')}
      ${cardNut('P')}
      ${cardNut('S')}
    </div>
    <div style="margin-top:.8rem;font-size:.7rem;color:#6b5b45;line-height:1.6;padding:.6rem .8rem;background:#fbf8f1;border:1px solid rgba(74,46,26,.15);border-radius:8px">
      Modelo curva respuesta cuadrática · Parámetros INTA Marcos Juárez / Balcarce · Calibrar con análisis de suelo local.
      Dosis óptima económica = punto donde el valor del grano extra cubre el costo del fertilizante.
    </div>`;

  resEl.innerHTML = html;
  resEl.classList.remove('hidden');
  const ph = document.getElementById('fo-placeholder');
  if (ph) ph.style.display = 'none';
  resEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// Autocompletar precio grano y rendimiento desde módulos ya cargados
document.addEventListener('DOMContentLoaded', function() {
  var foRendEl = document.getElementById('fo-rend-obj');
  var foPrecioEl = document.getElementById('fo-precio-grano');
  if (foRendEl) {
    var bhRend = document.getElementById('bh-rend-obj');
    if (bhRend && bhRend.value) foRendEl.value = bhRend.value;
  }
  if (foPrecioEl) {
    var ecPrecio = document.getElementById('ec-precio-disp');
    if (ecPrecio && ecPrecio.value) foPrecioEl.value = ecPrecio.value;
  }
});

})();

// ════════════════════════════════════════════════════════
// TIMING ÓPTIMO DE FERTILIZACIÓN (incluido en fertilizacion-optima.js)
// Indica automáticamente si la ventana actual es óptima para cada nutriente.
// Cero inputs: lee cultivo, etapa fenológica, AWC% y VPD del estado activo.
// ════════════════════════════════════════════════════════

(function () {
'use strict';

// Ventanas críticas de fertilización por cultivo y nutriente
// pctDesde / pctHasta: % del ciclo total (0-100) donde la ventana es óptima
// La urgencia: 'optimo' | 'aceptable' | 'fuera'
var VENTANAS = {
  soja: [
    { nut:'N', label:'N arranque',   pctDesde:0,  pctHasta:8,  desc:'Inoculante + N arranque en siembra o V1' },
    { nut:'P', label:'P siembra',    pctDesde:0,  pctHasta:5,  desc:'Fosfato al voleo o incorporado en siembra' },
    { nut:'S', label:'S cobertura',  pctDesde:10, pctHasta:30, desc:'Sulfato en V4-R1 para máxima absorción' },
    { nut:'K', label:'K follaje',    pctDesde:18, pctHasta:45, desc:'K en V5-R3 si el análisis lo indica' },
  ],
  maiz: [
    { nut:'N', label:'N arranque',    pctDesde:0,  pctHasta:15, desc:'N en siembra o V1-V2 con inhibidor' },
    { nut:'N', label:'N macollaje',   pctDesde:15, pctHasta:35, desc:'N cobertura V6-V10: mayor absorción' },
    { nut:'P', label:'P siembra',     pctDesde:0,  pctHasta:5,  desc:'Fosfato incorporado en la línea de siembra' },
    { nut:'S', label:'S V4-VT',       pctDesde:15, pctHasta:40, desc:'Azufre en cobertura antes de VT/floración' },
    { nut:'K', label:'K cobertura',   pctDesde:10, pctHasta:30, desc:'K al voleo en V4-V6 si Bray-K bajo' },
  ],
  trigo: [
    { nut:'N', label:'N macollaje',   pctDesde:12, pctHasta:28, desc:'N cobertura en macollaje Z21-Z31' },
    { nut:'N', label:'N encañado',    pctDesde:28, pctHasta:45, desc:'2da dosis de N en encañado Z32-Z37' },
    { nut:'P', label:'P siembra',     pctDesde:0,  pctHasta:5,  desc:'MAP incorporado en siembra' },
    { nut:'S', label:'S macollaje',   pctDesde:12, pctHasta:35, desc:'Azufre junto con N de macollaje' },
  ],
  cebada: [
    { nut:'N', label:'N macollaje',   pctDesde:10, pctHasta:28, desc:'N cobertura temprana en macollaje' },
    { nut:'N', label:'N encañado',    pctDesde:28, pctHasta:42, desc:'2da dosis N en encañado' },
    { nut:'P', label:'P siembra',     pctDesde:0,  pctHasta:5,  desc:'Fosfato en siembra' },
    { nut:'S', label:'S macollaje',   pctDesde:10, pctHasta:30, desc:'Azufre en macollaje' },
  ],
  girasol: [
    { nut:'N', label:'N siembra-V4',  pctDesde:0,  pctHasta:20, desc:'N incorporado antes de V4' },
    { nut:'P', label:'P siembra',     pctDesde:0,  pctHasta:5,  desc:'Fosfato en siembra' },
    { nut:'S', label:'S V4-BF',       pctDesde:20, pctHasta:45, desc:'Azufre en V4 antes del botón floral' },
    { nut:'B', label:'Boro botón',    pctDesde:38, pctHasta:52, desc:'Boro foliar en botón floral para fecundación' },
  ],
  sorgo: [
    { nut:'N', label:'N arranque',    pctDesde:0,  pctHasta:15, desc:'N en siembra o V1 con arrancador' },
    { nut:'N', label:'N cobertura',   pctDesde:18, pctHasta:38, desc:'N cobertura V6-encañado' },
    { nut:'P', label:'P siembra',     pctDesde:0,  pctHasta:5,  desc:'Fosfato incorporado' },
    { nut:'S', label:'S encañado',    pctDesde:15, pctHasta:40, desc:'Azufre antes de encañado' },
  ],
};

var NUT_COLOR = { N:'#2A5A8C', P:'#C8800A', S:'#8B5CF6', K:'#2A7A4A', B:'#C94A2A' };

function _ls(k) { try { return localStorage.getItem(k) || ''; } catch(_) { return ''; } }

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

function _diasDesde(fechaISO) {
  if (!fechaISO) return null;
  try {
    var d = new Date(fechaISO + 'T12:00:00');
    var h = new Date(); h.setHours(12,0,0,0);
    return Math.round((h - d) / 86400000);
  } catch(_) { return null; }
}

function render() {
  var el = document.getElementById('nc-timing-panel');
  if (!el) return;

  var cultivo   = _ls('am_siembra_cultivo') || (document.getElementById('s-cultivo') ? document.getElementById('s-cultivo').value : '') || (document.getElementById('nc-bn-cultivo') ? document.getElementById('nc-bn-cultivo').value : '');
  var cultKey   = _normCultivo(cultivo);
  var ventanas  = cultKey ? VENTANAS[cultKey] : null;

  if (!ventanas) { el.innerHTML = ''; return; }

  var fecha     = _ls('am_siembra_fecha') || (document.getElementById('s-fecha') ? document.getElementById('s-fecha').value : '');
  var ciclo     = parseInt(_ls('am_fen_duracion_ciclo')) || 150;
  var etapa     = _ls('am_fen_etapa_hoy') || '';
  var dias      = _diasDesde(fecha);
  var pctHoy    = (dias !== null && ciclo > 0) ? Math.min(100, Math.max(0, dias / ciclo * 100)) : null;

  var aguaMm    = parseFloat(_ls('am_hidrico_agua_actual_mm')) || 0;
  var capMax    = parseFloat(_ls('am_hidrico_cap_max_mm'))     || 0;
  var awcPct    = capMax > 0 ? Math.min(100, Math.round(aguaMm / capMax * 100)) : null;

  // VPD del lote activo (sv-vpd o i-vpd)
  var elVpd = document.getElementById('sv-vpd') || document.getElementById('i-vpd');
  var vpdStr = elVpd ? (elVpd.textContent || '').replace(/[^0-9.]/g, '') : '';
  var vpd    = parseFloat(vpdStr) || 0;

  var html = '<div style="background:linear-gradient(135deg,rgba(109,191,130,.06),rgba(109,191,130,.03));border:1.5px solid rgba(109,191,130,.25);border-radius:12px;padding:.85rem 1rem;margin-bottom:0">';
  html += '<div style="font-size:.72rem;font-weight:700;color:#6DBF82;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.6rem">⏱️ Timing óptimo de fertilización · ' + (etapa || _escapeHtml(cultivo)) + (pctHoy !== null ? ' · Día ' + (dias || 0) + ' (' + Math.round(pctHoy) + '% ciclo)' : '') + '</div>';

  // Condiciones del momento
  html += '<div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.6rem">';
  if (awcPct !== null) {
    var hC = awcPct >= 50 ? '#2A7A4A' : awcPct >= 30 ? '#C8A255' : '#D4522A';
    var hTxt = awcPct >= 50 ? '✅ Suelo apto' : awcPct >= 30 ? '⚠️ Suelo seco · riesgo quemado' : '🔴 No aplicar · suelo sin agua';
    html += '<span style="font-size:.65rem;color:' + hC + ';background:' + hC + '15;border:1px solid ' + hC + '44;padding:2px 7px;border-radius:4px;font-weight:700">💧 ' + awcPct + '% — ' + hTxt + '</span>';
  }
  if (vpd > 0) {
    var vC = vpd < 1.5 ? '#2A7A4A' : vpd < 2.5 ? '#C8A255' : '#D4522A';
    var vTxt = vpd < 1.5 ? '✅ VPD óptimo' : vpd < 2.5 ? '⚠️ VPD moderado' : '🔴 VPD alto · no foliar';
    html += '<span style="font-size:.65rem;color:' + vC + ';background:' + vC + '15;border:1px solid ' + vC + '44;padding:2px 7px;border-radius:4px;font-weight:700">🌬️ VPD ' + vpd.toFixed(1) + ' kPa — ' + vTxt + '</span>';
  }
  html += '</div>';

  // Una fila por ventana de fertilización
  html += '<div style="display:flex;flex-direction:column;gap:.35rem">';
  ventanas.forEach(function(v) {
    var estado, estColor, estBg, estIco;
    if (pctHoy === null) {
      estado = 'Sin fecha de siembra'; estColor = '#6b7280'; estBg = '#f3f4f6'; estIco = '❓';
    } else if (pctHoy >= v.pctDesde && pctHoy <= v.pctHasta) {
      estado = 'VENTANA ACTIVA — aplicar ahora'; estColor = '#2A7A4A'; estBg = 'rgba(42,122,74,.08)'; estIco = '🟢';
    } else if (pctHoy < v.pctDesde) {
      var diasFalta = Math.round((v.pctDesde / 100 - pctHoy / 100) * ciclo);
      estado = 'Próxima ventana en ~' + diasFalta + ' días'; estColor = '#C8A255'; estBg = 'rgba(200,160,85,.08)'; estIco = '⏳';
    } else {
      estado = 'Ventana pasada (' + v.pctDesde + '-' + v.pctHasta + '% ciclo)'; estColor = '#9ca3af'; estBg = '#f9fafb'; estIco = '⬜';
    }

    var nutCol = NUT_COLOR[v.nut] || '#374151';
    html += '<div style="display:flex;align-items:center;gap:.6rem;background:' + estBg + ';border-radius:7px;padding:.35rem .6rem;border:1px solid ' + estColor + '22">';
    html += '<span style="font-size:.7rem;font-weight:800;color:' + nutCol + ';min-width:1.8rem">' + v.nut + '</span>';
    html += '<span style="font-size:.65rem;color:#374151;font-weight:600;flex:1">' + _escapeHtml(v.label) + ' <span style="color:#6b7280;font-weight:400">— ' + _escapeHtml(v.desc) + '</span></span>';
    html += '<span style="font-size:.62rem;font-weight:700;color:' + estColor + ';white-space:nowrap">' + estIco + ' ' + _escapeHtml(estado) + '</span>';
    html += '</div>';
  });
  html += '</div>';

  html += '</div>';
  el.innerHTML = html;
}

function _escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

window.ncTimingRender = render;

// Activar cuando Nutrición se abre
window.addEventListener('am:nutricion-activado', render);

// También exponer para llamada directa desde ncActualizar
var _origNcActualizar = window.ncActualizar;
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    // Envolver ncActualizar para que siempre actualice el timing
    if (typeof window.ncActualizar === 'function' && !window._ncTimingWrapped) {
      var orig = window.ncActualizar;
      window.ncActualizar = function() {
        orig.apply(this, arguments);
        render();
      };
      window._ncTimingWrapped = true;
    }
    render();
  }, 1000);
});

})(); // fin timing-fertilizacion
