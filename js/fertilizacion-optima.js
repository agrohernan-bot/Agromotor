// ════════════════════════════════════════════════════════
// AGROMOTOR — fertilizacion-optima.js
// Dosis económicamente óptima · Curva respuesta cuadrática
// Modelo INTA adaptado zona pampeana (N, P, S por cultivo)
// ════════════════════════════════════════════════════════

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
    <div style="margin-bottom:.8rem;padding:.65rem 1rem;background:rgba(74,140,92,.06);border-radius:9px;border:1px solid rgba(74,140,92,.2)">
      <div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--canopy);margin-bottom:.35rem">
        ${cultivo.toUpperCase()} · Precio grano USD ${precioGrano}/t · Rendimiento objetivo ${rendObj} t/ha
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
        <div style="text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:#1b5e35">USD ${totalCosto.toFixed(0)}/ha</div>
          <div style="font-size:.62rem;color:#6b7280;text-transform:uppercase">Costo total fertilización</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${totalMargen>=0?'#1b5e35':'#C0392B'}">USD ${totalMargen.toFixed(0)}/ha</div>
          <div style="font-size:.62rem;color:#6b7280;text-transform:uppercase">Margen neto total</div>
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:.65rem">
      ${cardNut('N')}
      ${cardNut('P')}
      ${cardNut('S')}
    </div>
    <div style="margin-top:.8rem;font-size:.68rem;color:rgba(74,46,26,.38);line-height:1.6;padding:.5rem;background:rgba(74,46,26,.03);border-radius:6px">
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
