// ════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ════════════════════════════════════════════════════════
(function() {
  window.AM = window.AM || {};
  window.AM.cosecha = {};

const S = {
  cultivo: 'soja',
  superficie: 100, rendimiento: 35,
  humedadGrano: 14,
  precioUSD: 0, tipoCambio: 0,
  tarifaCosecha: 9, tarifaModo: 'pct',
  gcom: 3.5, retenciones: 33,
  fleteCorto: 8, fleteLargo: 22,
  mesesAlmacenar: 3,
  precioFuturo: 0, tasaRef: 3.5,
  sbCostoBolsa: 5.5, sbMO: 2.5, sbMerma: 0.10,
  scAmort: 1.2, scSeguro: 0.5, scMerma: 0.05,
  acTarifa: 2.0, acZar: 3.0,
  bcraToken: sessionStorage.getItem('bcra_token') || '',
  fobData: null, usdData: null, pfData: null, badlarData: null
};

// Datos por cultivo
const CULTIVOS = {
  soja:    { humedadBase: 13, retDef: 33, nombre: 'Soja', emoji: '🟡', unidad: 'USD/ton FOB' },
  maiz:    { humedadBase: 14, retDef: 12, nombre: 'Maíz', emoji: '🟠', unidad: 'USD/ton' },
  trigo:   { humedadBase: 14, retDef: 12, nombre: 'Trigo', emoji: '🟤', unidad: 'USD/ton' },
  girasol: { humedadBase: 11, retDef: 7,  nombre: 'Girasol', emoji: '🌻', unidad: 'USD/ton' },
  sorgo:   { humedadBase: 14, retDef: 12, nombre: 'Sorgo', emoji: '🔴', unidad: 'USD/ton' }
};

// ── HELPERS ──
const $  = id => document.getElementById(id);
const sv = (id, val) => { const el=$(id); if(el) el.textContent=val; };
const fmt = (n, dec=0) => isNaN(n)||!isFinite(n) ? '—' : n.toLocaleString('es-AR',{minimumFractionDigits:dec,maximumFractionDigits:dec});
const fmtUSD = n => isNaN(n)||!isFinite(n) ? '—' : 'USD '+fmt(n,0);

function tarModo() { return $('tarifa-modo').value; }

const COS_CACHE_PREFIX = 'am_cosecha_api_cache_';

function cacheSet(name, data) {
  try {
    localStorage.setItem(COS_CACHE_PREFIX + name, JSON.stringify({
      data,
      ts: new Date().toISOString()
    }));
  } catch (_) {}
}

function cacheGet(name) {
  try {
    const raw = localStorage.getItem(COS_CACHE_PREFIX + name);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data != null ? parsed : null;
  } catch (_) {
    return null;
  }
}

function cacheFecha(cache) {
  if (!cache || !cache.ts) return 'fecha guardada';
  return new Date(cache.ts).toLocaleDateString('es-AR');
}

function readState() {
  S.cultivo       = $('cultivo').value;
  S.superficie    = +$('superficie').value || 0;
  S.rendimiento   = +$('rendimiento').value || 0;
  S.humedadGrano  = +$('humedad-grano').value || 14;
  S.precioUSD     = +$('precio-usd').value || 0;
  S.tipoCambio    = +$('tipo-cambio').value || 0;
  S.tarifaCosecha = +$('tarifa-cosecha').value || 0;
  S.tarifaModo    = $('tarifa-modo').value;
  S.gcom          = +$('gcom').value || 0;
  S.retenciones   = +$('retenciones').value || 0;
  S.fleteCorto    = +$('flete-corto').value || 0;
  S.fleteLargo    = +$('flete-largo').value || 0;
  S.mesesAlmacenar= S._meses || 3;
  S.precioFuturo  = +$('precio-futuro').value || 0;
  S.tasaRef       = +$('tasa-ref').value || 3.5;
  S.sbCostoBolsa  = +$('sb-costo-bolsa').value || 0;
  S.sbMO          = +$('sb-mo').value || 0;
  S.sbMerma       = +$('sb-merma').value || 0;
  S.scAmort       = +$('sc-amort').value || 0;
  S.scSeguro      = +$('sc-seguro').value || 0;
  S.scMerma       = +$('sc-merma').value || 0;
  S.acTarifa      = +$('ac-tarifa').value || 0;
  S.acZar         = +$('ac-zar').value || 0;
}

// ── C�LCULOS CENTRALES ──
function calcProduccion() {
  const hb = CULTIVOS[S.cultivo].humedadBase;
  const hg = S.humedadGrano;
  // Factor de merma por humedad
  const mermaFactor = hg > hb ? (hg - hb) / (100 - hb) : 0;
  const toneladasBrutas = S.superficie * S.rendimiento / 10;
  const toneladasComerciales = toneladasBrutas * (1 - mermaFactor);
  const costSecado = hg > hb ? (hg - hb) * 2.2 : 0; // USD/ton por punto
  return { toneladasBrutas, toneladasComerciales, mermaFactor, costSecado };
}

function calcCostosCosecha(precioUSD, toneladasComerciales) {
  let costCosecha = 0;
  if (S.tarifaModo === 'pct')    costCosecha = precioUSD * S.tarifaCosecha / 100;
  else if (S.tarifaModo === 'usd-qq') costCosecha = S.tarifaCosecha * 10; // qq→ton
  else costCosecha = S.tarifaCosecha / (S.rendimiento / 10); // por ha → por ton
  const costGcom = precioUSD * S.gcom / 100;
  const costRet  = precioUSD * S.retenciones / 100;
  return { costCosecha, costGcom, costRet };
}

function calcNeto(precioUSD, destino) {
  // destino: 'acopio' | 'puerto' | 'sb' | 'sc'
  const { toneladasComerciales, mermaFactor, costSecado } = calcProduccion();
  const { costCosecha, costGcom, costRet } = calcCostosCosecha(precioUSD, toneladasComerciales);
  let flete = destino === 'puerto' ? S.fleteLargo : S.fleteCorto;
  const neto = precioUSD - costCosecha - flete - costGcom - costRet - costSecado;
  return { neto, costCosecha, flete, costGcom, costRet, costSecado };
}

function calcAlmacCosto(opcion) {
  const m = S.mesesAlmacenar;
  if (opcion === 'sb') {
    const costoFijo = S.sbCostoBolsa + S.sbMO;
    const mermaPct  = S.sbMerma * m;
    const costoMerma = (S.precioFuturo || S.precioUSD) * mermaPct / 100;
    return { costoFijo, costoMerma, total: costoFijo + costoMerma };
  }
  if (opcion === 'sc') {
    const costoFijo = (S.scAmort + S.scSeguro) * m;
    const mermaPct  = S.scMerma * m;
    const costoMerma = (S.precioFuturo || S.precioUSD) * mermaPct / 100;
    return { costoFijo, costoMerma, total: costoFijo + costoMerma };
  }
  if (opcion === 'ac') {
    const costoFijo = S.acTarifa * m + S.acZar;
    return { costoFijo, costoMerma: 0, total: costoFijo };
  }
  return { total: 0 };
}

// ── CALCULAR EN TIEMPO REAL ──
function calcLive() {
  readState();
  if (!S.precioUSD || !S.tipoCambio) return;

  const { toneladasBrutas, toneladasComerciales, mermaFactor, costSecado } = calcProduccion();
  const p = S.precioUSD;

  // KPIs lote
  const brutousd = toneladasComerciales * p;
  sv('kv-ton', fmt(toneladasComerciales, 1));
  sv('kv-qq', fmt(toneladasComerciales * 10, 0));
  sv('kv-bruto-usd', 'USD ' + fmt(brutousd, 0));
  sv('kv-bruto-ars', '$ ' + fmt(brutousd * S.tipoCambio, 0));

  const hb = CULTIVOS[S.cultivo].humedadBase;
  if (S.humedadGrano > hb) {
    $('secado-info').classList.remove('hidden');
    sv('kv-merma', fmt(mermaFactor * 100, 1));
    sv('kv-secado-costo', fmt(costSecado, 1));
  } else {
    $('secado-info').classList.add('hidden');
  }

  // Costos
  const { costCosecha, costGcom, costRet } = calcCostosCosecha(p, toneladasComerciales);
  const totalPuerto = costCosecha + S.fleteLargo + costGcom + costRet + costSecado;
  const totalAcopio = costCosecha + S.fleteCorto + costGcom + costRet + costSecado;

  const setCosto = (id1, id2, val) => {
    sv(id1, 'USD ' + fmt(val, 1));
    sv(id2, fmt(val / p * 100, 1) + '%');
  };
  setCosto('tc-cosecha','pc-cosecha', costCosecha);
  setCosto('tc-flete-a','pc-flete-a', S.fleteCorto);
  setCosto('tc-flete-p','pc-flete-p', S.fleteLargo);
  setCosto('tc-gcom',   'pc-gcom',    costGcom);
  setCosto('tc-ret',    'pc-ret',     costRet);
  setCosto('tc-secado', 'pc-secado',  costSecado);
  setCosto('tc-total',  'pc-total',   totalPuerto);

  const netoAcopio = p - totalAcopio;
  const netoPuerto = p - totalPuerto;
  sv('kv-neto-acopio', 'USD ' + fmt(netoAcopio, 1));
  sv('kv-neto-puerto', 'USD ' + fmt(netoPuerto, 1));

  // Almacenamiento resumen
  calcAlmacResumen(netoAcopio, netoPuerto);
}

function calcAlmacResumen(netoAcopio, netoPuerto) {
  const m = S.mesesAlmacenar;
  const opciones = [
    { id:'sb', label:'Silo bolsa', ...calcAlmacCosto('sb') },
    { id:'sc', label:'Silo chapa', ...calcAlmacCosto('sc') },
    { id:'ac', label:'Acopio local', ...calcAlmacCosto('ac') }
  ];
  let html = '';
  opciones.forEach(o => {
    const html2 = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.55rem 0;border-bottom:1px solid rgba(200,162,85,.12)">
        <div style="font-weight:600;color:var(--straw);font-size:.85rem">${{sb:'🟡 Silo bolsa',sc:'��� Silo chapa',ac:'�� Acopio'}[o.id]}</div>
        <div>
          <span style="font-family:'DM Mono',monospace;font-size:1rem;color:var(--amber)">USD ${fmt(o.total,1)}/ton</span>
          <span style="font-size:.7rem;color:rgba(237,224,196,.4);margin-left:.4rem">(${m} mes${m>1?'es':''})</span>
        </div>
      </div>`;
    html += html2;
  });
  $('almac-resumen').innerHTML = html + `<div style="font-size:.73rem;color:rgba(237,224,196,.4);margin-top:.7rem">Haga clic en "Ver Decisión" para el análisis comparativo completo</div>`;
}

function calcDecision() {
  readState();
  if (!S.precioUSD || !S.tipoCambio) {
    $('sem-container').innerHTML = `
      <div class="warn-box"><div>⚠�</div><div>Completá precio y tipo de cambio para activar el motor de decisión.</div></div>`;
    return;
  }

  const p = S.precioUSD;
  const pf = S.precioFuturo || p;
  const m  = S.mesesAlmacenar;

  // Neto vender hoy
  const netoHoyPuerto = calcNeto(p, 'puerto').neto;
  const netoHoyAcopio = calcNeto(p, 'acopio').neto;

  // Neto almacenar y vender en X meses
  const calcNetoFuturo = (opcion, destFuturo) => {
    const costos = calcAlmacCosto(opcion);
    const netoVenta = calcNeto(pf, destFuturo === 'puerto' ? 'puerto' : 'acopio').neto;
    return netoVenta - costos.total;
  };

  const opciones = [
    {
      id: 'hoy-puerto', label: 'Vender hoy a Puerto',
      icon: '🚢', neto: netoHoyPuerto,
      desglose: [{l:'Precio FOB',v:p},{l:'Costos totales',v:-(p-netoHoyPuerto)}]
    },
    {
      id: 'hoy-acopio', label: 'Vender hoy a Acopio',
      icon: '��', neto: netoHoyAcopio,
      desglose: [{l:'Precio disponible',v:p},{l:'Costos totales',v:-(p-netoHoyAcopio)}]
    },
    {
      id: 'sb-futuro', label: `Silo bolsa (${m} m.)`,
      icon: '🟡', neto: calcNetoFuturo('sb','acopio'),
      desglose: [{l:'Precio esperado',v:pf},{l:'Costo silo bolsa',v:-calcAlmacCosto('sb').total},{l:'Costos venta',v:-(pf-calcNeto(pf,'acopio').neto)}]
    },
    {
      id: 'sc-futuro', label: `Silo chapa (${m} m.)`,
      icon: '���', neto: calcNetoFuturo('sc','acopio'),
      desglose: [{l:'Precio esperado',v:pf},{l:'Costo silo chapa',v:-calcAlmacCosto('sc').total},{l:'Costos venta',v:-(pf-calcNeto(pf,'acopio').neto)}]
    },
    {
      id: 'ac-futuro', label: `Acopio (${m} m.)`,
      icon: '��', neto: calcNetoFuturo('ac','acopio'),
      desglose: [{l:'Precio esperado',v:pf},{l:'Costo acopio',v:-calcAlmacCosto('ac').total},{l:'Costos venta',v:-(pf-calcNeto(pf,'acopio').neto)}]
    }
  ];

  // Ordenar de mayor a menor neto
  opciones.sort((a,b) => b.neto - a.neto);

  const ganador = opciones[0];
  const esAlmacenamiento = ganador.id !== 'hoy-puerto' && ganador.id !== 'hoy-acopio';
  const ventajaUSD = ganador.neto - opciones[1].neto;

  // Semáforo
  let semClass, semEmoji, semTitulo, semSub;
  if (esAlmacenamiento && ventajaUSD > 5) {
    semClass = 'verde'; semEmoji = '🟢';
    semTitulo = 'ALMACENAR CONVIENE';
    semSub = `La opción <strong>${ganador.label}</strong> supera la venta inmediata por <strong>USD ${fmt(ventajaUSD,1)}/ton</strong>. El mercado futuro ofrece un retorno superior a la tasa de referencia financiera.`;
  } else if (!esAlmacenamiento && ventajaUSD < 3) {
    semClass = 'amarillo'; semEmoji = '🟡';
    semTitulo = 'DECISIÓN AJUSTADA';
    semSub = `La diferencia entre vender hoy y almacenar es pequeña (< USD ${fmt(ventajaUSD,1)}/ton). Evaluar riesgo-mercado y necesidad financiera.`;
  } else if (!esAlmacenamiento) {
    semClass = 'rojo'; semEmoji = '🔴';
    semTitulo = 'VENDER HOY CONVIENE M�S';
    semSub = `Con el diferencial de precio esperado, <strong>vender hoy a ${ganador.label.includes('Puerto') ? 'Puerto' : 'Acopio'}</strong> es la opción de mayor retorno neto. El costo del almacenamiento no es compensado por la suba proyectada.`;
  } else {
    semClass = 'amarillo'; semEmoji = '🟡';
    semTitulo = 'VENTAJA MARGINAL';
    semSub = `La opción <strong>${ganador.label}</strong> tiene una ventaja acotada de <strong>USD ${fmt(ventajaUSD,1)}/ton</strong>. Considera riesgos de precio y necesidades de liquidez.`;
  }

  $('sem-container').innerHTML = `
    <div class="sem-wrap ${semClass}">
      <span class="sem-emoji">${semEmoji}</span>
      <div class="sem-title">${semTitulo}</div>
      <div class="sem-sub">${semSub}</div>
      <div style="margin-top:1.2rem;font-family:'DM Mono',monospace;font-size:1.4rem;color:${semClass==='verde'?'var(--ok)':semClass==='rojo'?'var(--warn)':'var(--caution)'}">
        ${ganador.label} → USD ${fmt(ganador.neto,1)}/ton · ARS ${fmt(ganador.neto * S.tipoCambio, 0)}/ton
      </div>
    </div>`;

  // Tarjetas destinos
  let destHTML = '';
  opciones.forEach((op, i) => {
    const cls = i===0?'winner':i===opciones.length-1?'last':'mid';
    const badgeCls = i===0?'badge-winner':i===opciones.length-1?'badge-last':'badge-mid';
    const badgeTxt = i===0?'✓ MEJOR OPCIÓN':i===opciones.length-1?'↓ MENOR RETORNO':`#${i+1}`;
    const desgloseHTML = op.desglose.map(d =>
      `<div class="dest-row"><span class="dest-row-l">${d.l}</span><span class="dest-row-v ${d.v<0?'neg':'pos'}">USD ${fmt(d.v,1)}</span></div>`
    ).join('');
    destHTML += `
      <div class="dest-card ${cls}">
        <div class="dest-badge ${badgeCls}">${badgeTxt}</div>
        <div class="dest-icon">${op.icon}</div>
        <div class="dest-name">${op.label}</div>
        <div class="dest-price-usd">USD ${fmt(op.neto,1)}</div>
        <div class="dest-price-ars">ARS ${fmt(op.neto * S.tipoCambio, 0)}/ton</div>
        <div class="dest-rows">${desgloseHTML}</div>
      </div>`;
  });
  $('dest-grid').innerHTML = destHTML;

  // Break-even
  const bepNecesario = netoHoyAcopio + calcAlmacCosto('sb').total;
  const bepPct = p > 0 ? ((bepNecesario - p) / p * 100) : 0;
  let bepHTML = `
    <div style="margin-bottom:.8rem">
      <div style="font-size:.75rem;color:rgba(28,18,8,.5);margin-bottom:.4rem">Precio actual: <strong>USD ${fmt(p,1)}/ton</strong> → Para que silo bolsa sea igual a venta hoy:</div>
    </div>`;
  const opts2 = [
    { l:'Silo bolsa', bep: netoHoyAcopio + calcAlmacCosto('sb').total },
    { l:'Silo chapa', bep: netoHoyAcopio + calcAlmacCosto('sc').total },
    { l:'Acopio',     bep: netoHoyAcopio + calcAlmacCosto('ac').total }
  ];
  opts2.forEach(o => {
    const diff = o.bep - p;
    const pct  = p > 0 ? Math.max(0, Math.min(100, (diff / p) * 500 + 10)) : 10;
    const color = diff <= 0 ? 'var(--ok)' : diff < p*0.05 ? 'var(--caution)' : 'var(--warn)';
    bepHTML += `
      <div style="margin-bottom:.9rem">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:.3rem">
          <span style="font-weight:600">${o.l}</span>
          <span style="font-family:'DM Mono',monospace;color:${color}">USD ${fmt(o.bep,1)}/ton (${diff>=0?'+':''}${fmt(diff,1)})</span>
        </div>
        <div class="bep-bar-outer">
          <div class="bep-bar-fill" style="width:${pct}%;background:${color}">
            <span class="bep-bar-label">${diff>=0?'+'+ fmt(diff,0):'logrado'}</span>
          </div>
        </div>
      </div>`;
  });
  $('bep-wrap').innerHTML = bepHTML;

  // Tasas implícitas
  const tasaImplicitaSB = p > 0 && pf > p ? ((pf - netoHoyAcopio - calcAlmacCosto('sb').costoFijo) / p - 1) / m * 100 : null;
  const tasaAnual = tasaImplicitaSB ? tasaImplicitaSB * 12 : null;
  const tasaRefAnual = S.tasaRef * 12;
  const kpiHTML = `
    <div class="kc ${tasaAnual > tasaRefAnual ? 'ok-card' : 'warn-card'}">
      <div class="kl">Tasa implícita almacenaje (anual)</div>
      <div class="kv">${tasaAnual ? fmt(tasaAnual,1)+'%' : 'N/D'}</div>
      <div class="ku">vs plazo fijo</div>
    </div>
    <div class="kc">
      <div class="kl">Plazo fijo ref. (anual)</div>
      <div class="kv">${fmt(tasaRefAnual,1)}%</div>
      <div class="ku">TNA estimada</div>
    </div>
    <div class="kc gold-card">
      <div class="kl">Diferencial tasa</div>
      <div class="kv">${tasaAnual ? (tasaAnual - tasaRefAnual > 0 ? '+' : '') + fmt(tasaAnual - tasaRefAnual, 1)+'%' : '—'}</div>
      <div class="ku">anual</div>
    </div>`;
  $('kpi-tasas').innerHTML = kpiHTML;

  if (tasaAnual) {
    const diff = tasaAnual - tasaRefAnual;
    $('tasa-comment').innerHTML = diff > 0
      ? `✅ Almacenar genera una tasa implícita <strong>${fmt(diff,1)} p.p. superior</strong> al plazo fijo. Conveniente si se cumple el precio esperado.`
      : `⚠� El plazo fijo supera la tasa implícita del almacenamiento por <strong>${fmt(Math.abs(diff),1)} p.p.</strong>. Evaluar riesgo-beneficio.`;
  }

  $('dest-container').classList.remove('hidden');
}

// ── TABS ──
function showTab(id) {
  document.querySelectorAll('.mod-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  document.querySelectorAll('.mod-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + id));
}

// ── MESES PILLS ──
function buildMonthPills() {
  const wrap = $('month-pills');
  wrap.innerHTML = '';
  [1,2,3,4,5,6,8,10,12].forEach(m => {
    const el = document.createElement('div');
    el.className = 'month-pill' + (m === 3 ? ' sel' : '');
    el.textContent = m === 1 ? '1 mes' : m + ' meses';
    el.onclick = () => {
      document.querySelectorAll('.month-pill').forEach(p => p.classList.remove('sel'));
      el.classList.add('sel');
      S._meses = m;
      sv('sv-meses', m + (m===1?' mes':' meses'));
      calcLive();
    };
    wrap.appendChild(el);
  });
  S._meses = 3;
}

// ── CULTIVO CHANGE ──
function onCultivoChange() {
  const c = CULTIVOS[$('cultivo').value];
  $('lbl-mercado').textContent = c.nombre + ' — ' + c.unidad;
  // Ajustar retenciones por defecto
  const retEl = $('retenciones');
  retEl.value = c.retDef;
  sv('sv-ret', c.retDef + '%');
  fetchPrecioGrano();
  calcLive();
}

function onTarifaChange() {
  const modo = $('tarifa-modo').value;
  const lbl  = $('tarifa-lbl');
  const ref  = $('tarifa-referencia');
  const sl   = $('tarifa-cosecha');
  if (modo === 'pct') {
    lbl.textContent = 'Tarifa cosecha (%)';
    sl.max = 15; sl.step = 0.5; sl.value = 9;
    ref.textContent = 'Referencia CAFMA/FACMA: 8-11% para cereales/oleaginosas';
    sv('sv-tarifa', '9%');
  } else if (modo === 'usd-qq') {
    lbl.textContent = 'Tarifa cosecha (USD/qq)';
    sl.max = 5; sl.step = 0.1; sl.value = 2.5;
    ref.textContent = 'Referencia: USD 2-3/qq en zona pampeana';
    sv('sv-tarifa', '2.5 USD/qq');
  } else {
    lbl.textContent = 'Tarifa cosecha (USD/ha)';
    sl.max = 60; sl.step = 1; sl.value = 35;
    ref.textContent = 'Referencia: USD 30-45/ha contrato fijo';
    sv('sv-tarifa', '35 USD/ha');
  }
  calcLive();
}

function calcSecado() {
  const hb = CULTIVOS[$('cultivo').value].humedadBase;
  const hg = +$('humedad-grano').value;
  const info = $('humedad-info');
  if (hg > hb) {
    const pts = (hg - hb).toFixed(1);
    info.innerHTML = `⚠� <strong>${pts} puntos</strong> por encima de la humedad comercial (${hb}%). Descuento estimado: <strong>USD ${fmt(pts*2.2,1)}/ton</strong>`;
    info.style.color = 'var(--warn)';
  } else if (hg < hb - 1) {
    info.innerHTML = `✅ Humedad ideal. Sin descuento por humedad.`;
    info.style.color = 'var(--ok)';
  } else {
    info.innerHTML = `✅ Humedad en rango comercial (base ${hb}%).`;
    info.style.color = 'var(--ok)';
  }
}

// ── APIs ──
async function loadAllAPIs() {
  await Promise.allSettled([
    fetchPrecioGrano(),
    fetchTipoCambio(),
    fetchTasasBCRA()
  ]);
}

async function fetchPrecioGrano() {
  const cultivo = $('cultivo').value;
  setDot('dot-fob', 'loading'); sv('val-fob', 'buscando…');
  try {
    const hoy = new Date();
    let intentos = 0;
    let data = null;
    // Intentar últimos 5 días hábiles
    while (!data && intentos < 7) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() - intentos);
      const dd = String(fecha.getDate()).padStart(2,'0');
      const mm = String(fecha.getMonth()+1).padStart(2,'0');
      const aaaa = fecha.getFullYear();
      const url = `https://monitorsiogranos.magyp.gob.ar/ws/ssma/precios_fob.php?Fecha=${dd}/${mm}/${aaaa}`;
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 6000);
        const resp = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        const json = await resp.json();
        if (json && Array.isArray(json) && json.length > 0) {
          data = json;
          break;
        }
      } catch(e) { if (e.name === 'AbortError') break; } // timeout → no m�s reintentos
      intentos++;
    }
    if (!data) throw new Error('Sin datos');

    S.fobData = data;
    const mapa = { soja:'Soja', maiz:'Maíz', trigo:'Trigo', girasol:'Girasol', sorgo:'Sorgo' };
    const nombre = mapa[cultivo] || 'Soja';
    const item = data.find(d => d.producto && d.producto.toLowerCase().includes(nombre.toLowerCase()));
    if (item && item.precio_usd) {
      const precio = parseFloat(item.precio_usd);
      $('precio-usd').value = precio;
      $('precio-source').innerHTML = `✅ FOB oficial MAGYP — ${item.fecha || 'hoy'}`;
      setDot('dot-fob', 'ok');
      // Mostrar en ribbon
      sv('val-fob', `${nombre}: USD ${fmt(precio,0)}`);
      cacheSet('fob_' + cultivo, { precio, nombre, fecha: item.fecha || null });
      calcLive();
    } else {
      return aplicarPrecioGranoCache(cultivo, 'Datos FOB disponibles, pero no para este cultivo.');
      // Si no encontramos el cultivo, mostrar lo que llegó
      setDot('dot-fob', 'ok');
      sv('val-fob', 'OK (manual)');
      $('precio-source').innerHTML = `⚠� Datos FOB disponibles. Ingresá precio manualmente.`;
    }
  } catch(e) {
    return aplicarPrecioGranoCache(cultivo, 'API FOB no disponible.');
    setDot('dot-fob', 'error');
    sv('val-fob', 'manual');
    $('precio-source').innerHTML = `⚠� API FOB no disponible — ingresá precio manualmente`;
  }
}

// USD OFICIAL � DolarAPI (gratuito, sin token, CORS ok)
function aplicarPrecioGranoCache(cultivo, motivo) {
  const cache = cacheGet('fob_' + cultivo);
  if (cache && cache.data && cache.data.precio) {
    $('precio-usd').value = cache.data.precio;
    setDot('dot-fob', 'ok');
    sv('val-fob', `${cache.data.nombre || CULTIVOS[cultivo].nombre}: USD ${fmt(cache.data.precio,0)} guardado`);
    $('precio-source').innerHTML = `⚠️ ${motivo} Usando ultimo FOB guardado (${cacheFecha(cache)}).`;
    calcLive();
    return true;
  }
  setDot('dot-fob', 'error');
  sv('val-fob', 'manual');
  $('precio-source').innerHTML = `⚠️ ${motivo} Sin dato guardado; podes ajustar el precio manualmente.`;
  return false;
}

async function fetchTipoCambio() {
  setDot('dot-usd', 'loading');
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    const resp = await fetch('https://dolarapi.com/v1/dolares/oficial', { signal: ctrl.signal });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const d = await resp.json();
    const tc = d.venta ?? d.compra;
    if (!tc) throw new Error('sin valor');
    $('tipo-cambio').value = tc;
    if ($('tc-source')) $('tc-source').innerHTML = `✅ USD Oficial BNA � DolarAPI � ${d.fechaActualizacion ? new Date(d.fechaActualizacion).toLocaleDateString('es-AR') : 'hoy'}`;
    setDot('dot-usd', 'ok');
    sv('val-usd', '$ ' + fmt(tc, 0));
    S.usdData = tc;
    cacheSet('usd_oficial', { tc, fechaActualizacion: d.fechaActualizacion || null });
    calcLive();
  } catch(e) {
    const cache = cacheGet('usd_oficial');
    if (cache && cache.data && cache.data.tc) {
      $('tipo-cambio').value = cache.data.tc;
      S.usdData = cache.data.tc;
      setDot('dot-usd', 'ok');
      sv('val-usd', '$ ' + fmt(cache.data.tc, 0) + ' guardado');
      if ($('tc-source')) $('tc-source').innerHTML = `⚠️ DolarAPI no disponible. Usando ultimo USD guardado (${cacheFecha(cache)}).`;
      calcLive();
      return;
    }
    setDot('dot-usd', 'error');
    sv('val-usd', 'manual');
    if ($('tc-source')) $('tc-source').innerHTML = `⚠️ DolarAPI no disponible � ingres� TC manualmente`;
  }
}

// TASAS � datos.gob.ar/SSPM (gratuito, sin token, CORS ok)
async function fetchTasasBCRA() {
  // BADLAR � CSV diario: indice_tiempo, tasas_interes_call, tasas_interes_badlar, ...
  try {
    setDot('dot-badlar', 'loading');
    const cb = new AbortController(); setTimeout(() => cb.abort(), 15000);
    const rb = await fetch(
      'https://infra.datos.gob.ar/catalog/sspm/dataset/89/distribution/89.2/download/principales-tasas-interes-diarias.csv',
      { signal: cb.signal }
    );
    if (!rb.ok) throw new Error('HTTP ' + rb.status);
    const txt = await rb.text();
    const lines = txt.trim().split('\n').filter(l => l.trim());
    const header = lines[0].split(',');
    const badlarIdx = header.findIndex(h => h.toLowerCase().includes('badlar'));
    const last = lines[lines.length - 1].split(',');
    const badlar = parseFloat(last[badlarIdx]);
    if (isNaN(badlar)) throw new Error('sin valor');
    S.badlarData = badlar;
    cacheSet('badlar', { badlar });
    sv('val-badlar', fmt(badlar, 1) + '% TNA');
    setDot('dot-badlar', 'ok');
  } catch(e) {
    const cache = cacheGet('badlar');
    if (cache && cache.data && cache.data.badlar) {
      S.badlarData = cache.data.badlar;
      sv('val-badlar', fmt(cache.data.badlar, 1) + '% TNA guardado');
      setDot('dot-badlar', 'ok');
    } else {
      setDot('dot-badlar', 'error');
      sv('val-badlar', 'sin dato');
    }
  }

  // PLAZO FIJO 30d � CSV mensual: tasas_interes_plazo_fijo_30_59_dias
  try {
    setDot('dot-pf', 'loading');
    const cp = new AbortController(); setTimeout(() => cp.abort(), 15000);
    const rp = await fetch(
      'https://infra.datos.gob.ar/catalog/sspm/dataset/89/distribution/89.1/download/principales-tasas-interes.csv',
      { signal: cp.signal }
    );
    if (!rp.ok) throw new Error('HTTP ' + rp.status);
    const txt = await rp.text();
    const lines = txt.trim().split('\n').filter(l => l.trim());
    const header = lines[0].split(',');
    const pfIdx = header.findIndex(h => h.toLowerCase().includes('plazo_fijo_30'));
    let pfVal = NaN, pfFecha = '';
    for (let i = lines.length - 1; i > 0; i--) {
      const cols = lines[i].split(',');
      const v = parseFloat(cols[pfIdx]);
      if (!isNaN(v)) { pfVal = v; pfFecha = cols[0]; break; }
    }
    if (isNaN(pfVal)) throw new Error('sin valor');
    S.pfData = pfVal;
    cacheSet('plazo_fijo', { pfVal, pfFecha });
    sv('val-pf', fmt(pfVal, 1) + '% TNA');
    setDot('dot-pf', 'ok');
    if ($('tasa-ref')) $('tasa-ref').value = (pfVal / 12).toFixed(1);
    if ($('tasa-source')) $('tasa-source').innerHTML = `✅ Plazo fijo 30d � datos.gob.ar � ${pfFecha}`;
  } catch(e) {
    const cache = cacheGet('plazo_fijo');
    if (cache && cache.data && cache.data.pfVal) {
      S.pfData = cache.data.pfVal;
      sv('val-pf', fmt(cache.data.pfVal, 1) + '% TNA guardado');
      setDot('dot-pf', 'ok');
      if ($('tasa-ref')) $('tasa-ref').value = (cache.data.pfVal / 12).toFixed(1);
      if ($('tasa-source')) $('tasa-source').innerHTML = `⚠️ datos.gob.ar no disponible. Usando ultima tasa guardada (${cacheFecha(cache)}).`;
    } else {
      setDot('dot-pf', 'error');
      sv('val-pf', 'sin dato');
      if ($('tasa-source')) $('tasa-source').innerHTML = '⚠️ datos.gob.ar no disponible. Sin tasa guardada.';
    }
  }
}

function setDot(id, state) {
  const el = $(id);
  if (!el) return;
  el.className = 'api-dot ' + state;
}

function saveBcraToken() {
  const t = $('bcra-token').value.trim();
  if (t) {
    sessionStorage.setItem('bcra_token', t);
    S.bcraToken = t;
    fetchTasasBCRA();
    fetchTipoCambio();
    $('bcra-token').value = '';
    $('token-wrap').style.opacity = '.5';
    setTimeout(() => $('token-wrap').style.opacity = '1', 2000);
  }
}

function usarTasaBCRA() {
  if (S.pfData) {
    $('tasa-ref').value = (S.pfData / 12).toFixed(1);
    $('tasa-source').innerHTML = `✅ Tasa BCRA plazo fijo — ${fmt(S.pfData,1)}% TNA`;
    calcLive();
  } else {
    fetchTasasBCRA();
  }
}

// ── IA AN�LISIS ──
async function runIA() {
  readState();
  const iaBody = $('ia-body');
  iaBody.innerHTML = '<div class="ia-loading"><div class="ia-spinner"></div> Generando análisis…</div>';

  const cultNombre = CULTIVOS[S.cultivo].nombre;
  const { toneladasComerciales } = calcProduccion();
  const netoHoyPuerto = calcNeto(S.precioUSD, 'puerto').neto;
  const netoHoyAcopio = calcNeto(S.precioUSD, 'acopio').neto;
  const costoSB = calcAlmacCosto('sb').total;
  const costoSC = calcAlmacCosto('sc').total;
  const costoAC = calcAlmacCosto('ac').total;

  const prompt = `Sos un asesor agrícola experto en comercialización de granos en Argentina.

Situación del lote:
- Cultivo: ${cultNombre}
- Producción: ${fmt(toneladasComerciales,0)} toneladas (${S.superficie} ha × ${S.rendimiento} qq/ha)
- Precio FOB actual: USD ${fmt(S.precioUSD,0)}/ton
- Tipo de cambio oficial: $${fmt(S.tipoCambio,0)}/USD
- Retenciones: ${S.retenciones}%
- Humedad grano: ${S.humedadGrano}%

Resultado comercial neto (después de todos los costos):
- Vender HOY a Puerto: USD ${fmt(netoHoyPuerto,1)}/ton (ARS ${fmt(netoHoyPuerto*S.tipoCambio,0)}/ton)
- Vender HOY a Acopio: USD ${fmt(netoHoyAcopio,1)}/ton
- Precio esperado en ${S.mesesAlmacenar} meses: USD ${fmt(S.precioFuturo||S.precioUSD,0)}/ton

Costos de almacenamiento por ${S.mesesAlmacenar} mes/es:
- Silo bolsa: USD ${fmt(costoSB,1)}/ton
- Silo chapa: USD ${fmt(costoSC,1)}/ton
- Acopio local: USD ${fmt(costoAC,1)}/ton

Tasa de referencia: ${S.tasaRef}% mensual (plazo fijo)

Elaborá un análisis narrativo conciso (4-5 párrafos) que:
1. Explique la situación de mercado para ${cultNombre} en términos de conveniencia
2. Analice si el diferencial de precio justifica almacenar vs el costo financiero
3. Señale los principales riesgos de cada opción (precio, clima, tipo de cambio)
4. Dé una recomendación clara y práctica para el asesor técnico
Escribí en español rioplatense, tono profesional pero directo. Sin markdown, solo texto plano con párrafos.`;

  try {
    // Obtener token de sesión activa (mismo proxy seguro que el Asistente IA)
    const { data: { session } } = await AM_SB.auth.getSession();
    if (!session) {
      iaBody.innerHTML = '<span style="color:var(--warn)">Necesitás iniciar sesión para usar el análisis IA.</span>';
      return;
    }
    const response = await fetch(AM_CONFIG.claudeProxy, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    const texto = data.content?.map(b => b.text || '').join('') || 'Sin respuesta';
    // Formatear párrafos
    iaBody.innerHTML = texto.split('\n').filter(l=>l.trim()).map(l =>
      `<p style="margin-bottom:.7rem">${l}</p>`
    ).join('');
  } catch(e) {
    iaBody.innerHTML = '<span style="color:var(--warn)">Error al consultar el motor IA. Verificá la conexión.</span>';
  }
}

// ── EXPORT PDF ──
function exportPDF() {
  if (!window.jspdf) { alert('jsPDF no disponible'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const cultNombre = CULTIVOS[S.cultivo]?.nombre || S.cultivo;
  const { toneladasComerciales } = calcProduccion();
  const netoHoyPuerto = calcNeto(S.precioUSD, 'puerto').neto;
  const netoHoyAcopio = calcNeto(S.precioUSD, 'acopio').neto;

  let y = 18;
  doc.setFillColor(15, 31, 20);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(232, 184, 75);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('CosechaDecide — Informe de Decisión', 14, 12);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 180, 120);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-AR')} · AgroMotor Suite`, 14, 20);
  y = 38;

  doc.setTextColor(28, 18, 8);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('Datos del Lote', 14, y); y += 7;

  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  const lineas = [
    [`Cultivo: ${cultNombre}`, `Superficie: ${S.superficie} ha`],
    [`Rendimiento: ${S.rendimiento} qq/ha`, `Producción: ${fmt(toneladasComerciales,0)} ton comerciales`],
    [`Precio FOB: USD ${fmt(S.precioUSD,0)}/ton`, `Tipo de cambio: $${fmt(S.tipoCambio,0)}/USD`],
    [`Retenciones: ${S.retenciones}%`, `Humedad grano: ${S.humedadGrano}%`]
  ];
  lineas.forEach(([a, b]) => {
    doc.text(a, 14, y); doc.text(b, 110, y); y += 6;
  });

  y += 4;
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('Resultados Comerciales (USD/ton neto)', 14, y); y += 7;

  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  [
    ['Vender hoy → Puerto', `USD ${fmt(netoHoyPuerto,1)}/ton`, `ARS ${fmt(netoHoyPuerto*S.tipoCambio,0)}/ton`],
    ['Vender hoy → Acopio', `USD ${fmt(netoHoyAcopio,1)}/ton`, `ARS ${fmt(netoHoyAcopio*S.tipoCambio,0)}/ton`],
    [`Silo bolsa (${S.mesesAlmacenar} meses)`, `Costo: USD ${fmt(calcAlmacCosto('sb').total,1)}/ton`, ''],
    [`Acopio local (${S.mesesAlmacenar} meses)`, `Costo: USD ${fmt(calcAlmacCosto('ac').total,1)}/ton`, '']
  ].forEach(([a,b,c]) => {
    doc.text(a, 14, y); doc.text(b, 80, y); if(c) doc.text(c, 140, y); y += 6;
  });

  y += 4;
  const iaText = $('ia-body')?.textContent || '';
  if (iaText && iaText.length > 30 && !iaText.includes('Presioná')) {
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('Análisis IA', 14, y); y += 7;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(iaText.substring(0, 1500), 182);
    lines.forEach(l => { if (y > 270) { doc.addPage(); y = 20; } doc.text(l, 14, y); y += 5; });
  }

  doc.setFillColor(15, 31, 20);
  doc.rect(0, 282, 210, 15, 'F');
  doc.setTextColor(200, 162, 85); doc.setFontSize(7);
  doc.text('CosechaDecide · AgroMotor Suite · Datos: MAGYP, BCRA · Solo orientativo — verificar con operadores locales', 14, 288);

  doc.save(`CosechaDecide_${cultNombre}_${new Date().toLocaleDateString('es-AR').replace(/\//g,'-')}.pdf`);
}

// ��������������������������������������������������
// PANEL 5 — ESCENARIOS DE PRECIO
// ��������������������������������������������������

function buildEscenarioMesesPills() {
  const wrap = $('esc-meses-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  [1,2,3,4,6,8,12].forEach(m => {
    const el = document.createElement('div');
    el.className = 'month-pill' + ([2,4,6].includes(m) ? ' sel' : '');
    el.dataset.m = m;
    el.textContent = m + (m===1?' mes':' m.');
    el.onclick = () => { el.classList.toggle('sel'); };
    wrap.appendChild(el);
  });
}

function buildEscenarios() {
  readState();
  if (!S.precioUSD || !S.tipoCambio) {
    $('esc-table-wrap').innerHTML = `<div class="warn-box"><div>⚠�</div><div>Completá precio y tipo de cambio en el Panel 1 primero.</div></div>`;
    return;
  }

  const rangoMin   = +$('esc-rango-min').value || -20;
  const rangoMax   = +$('esc-rango-max').value || 30;
  const paso       = +$('esc-pasos').value || 10;
  const destino    = $('esc-destino').value;

  // Columnas de variación de precio
  const varPcts = [];
  for (let v = rangoMin; v <= rangoMax; v += paso) varPcts.push(Math.round(v));
  // Asegurar que 0% (precio hoy) esté siempre
  if (!varPcts.includes(0)) varPcts.push(0);
  varPcts.sort((a,b)=>a-b);

  // Filas de meses seleccionados
  const mesesSel = [...document.querySelectorAll('#esc-meses-wrap .month-pill.sel')]
    .map(el => +el.dataset.m).sort((a,b)=>a-b);
  if (!mesesSel.length) { alert('Seleccioná al menos un período.'); return; }

  const p = S.precioUSD;
  const netoHoy = calcNeto(p, 'acopio').neto; // referencia base

  // Calc neto para destino dado precio y meses
  const calcNetoEsc = (precio, meses, dest) => {
    const oldMeses = S._meses; S._meses = meses;
    readState();
    S._meses = meses;
    let neto;
    if (dest === 'hoy-puerto') {
      neto = calcNeto(precio, 'puerto').neto;
    } else {
      const costos = calcAlmacCosto(dest);
      neto = calcNeto(precio, 'acopio').neto - costos.total;
    }
    S._meses = oldMeses;
    return neto;
  };

  // Build table
  let html = `<div class="esc-wrap"><table class="esc-tbl">`;
  html += `<thead><tr><th class="col-mes">Período</th>`;
  varPcts.forEach(v => {
    const precioCol = p * (1 + v/100);
    html += `<th class="col-precio" style="${v===0?'background:rgba(200,162,85,.12);color:var(--grain)':''}">${v===0?'Hoy<br>':v>0?'+':''}${v}%<br><span style="font-weight:400;font-size:.6rem">USD ${fmt(precioCol,0)}</span></th>`;
  });
  html += `</tr></thead><tbody>`;

  // Fila de referencia: vender hoy (sin almacenamiento)
  html += `<tr class="esc-ref-row"><td class="td-mes">🚢 Vender HOY</td>`;
  varPcts.forEach(v => {
    const precioCol = p * (1 + v/100);
    const neto = calcNeto(precioCol, 'acopio').neto;
    const cls = v===0 ? 'esc-cell-hoy' : '';
    html += `<td class="${cls}">USD ${fmt(neto,1)}<br><span style="font-size:.65rem;opacity:.7">ARS ${fmt(neto*S.tipoCambio,0)}</span></td>`;
  });
  html += '</tr>';

  // Filas por mes
  mesesSel.forEach(m => {
    html += `<tr><td class="td-mes">📦 ${m} ${m===1?'mes':'meses'}</td>`;
    varPcts.forEach(v => {
      const precioCol = p * (1 + v/100);
      const netoAlmac = calcNetoEsc(precioCol, m, destino);
      const netoVentaHoy = calcNeto(p, 'acopio').neto;
      const diff = netoAlmac - netoVentaHoy;
      const umbral = netoVentaHoy * 0.03;
      let cls = '';
      if (diff > umbral) cls = 'esc-cell-win';
      else if (diff >= -umbral) cls = 'esc-cell-mid';
      else cls = 'esc-cell-lose';
      if (v === 0) cls = 'esc-cell-hoy';
      html += `<td class="${cls}">USD ${fmt(netoAlmac,1)}<br><span style="font-size:.65rem;opacity:.7">${diff>=0?'+':''}${fmt(diff,1)}</span></td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';

  const destNombre = {sb:'Silo bolsa',sc:'Silo chapa',ac:'Acopio','hoy-puerto':'Vender hoy a Puerto'}[destino];
  $('esc-table-wrap').innerHTML = `
    <div style="font-size:.73rem;color:rgba(28,18,8,.5);margin-bottom:.7rem">
      Precio actual: <strong>USD ${fmt(p,0)}/ton</strong> · Destino de almacenamiento: <strong>${destNombre}</strong>
      · Las celdas muestran precio neto USD/ton y diferencial vs. venta hoy
    </div>` + html;

  buildDevalTable();
}

function buildDevalTable() {
  const devalMensual = +($('deval-mensual')?.value || 2) / 100;
  const devalMeses   = +($('deval-meses')?.value || 4);
  if (!S.precioUSD || !S.tipoCambio) return;

  const p  = S.precioUSD;
  const tc = S.tipoCambio;
  const mesesRow = [1,2,3,4,6,8,12].filter(m => m <= devalMeses + 2).slice(0,6);

  let html = `<div class="esc-wrap"><table class="esc-tbl">`;
  html += `<thead><tr><th class="col-mes">Mes</th><th class="col-precio">TC estimado</th><th class="col-precio">Neto HOY (ARS)</th>`;
  [0, -5, -10, 5, 10, 15].forEach(v => {
    html += `<th class="col-precio" style="${v===0?'background:rgba(200,162,85,.1);color:var(--grain)':''}">${v===0?'Precio actual':v>0?'+'+v+'%':v+'%'}</th>`;
  });
  html += '</tr></thead><tbody>';

  const netoHoyUSD = calcNeto(p, 'acopio').neto;

  mesesRow.forEach(m => {
    const tcFuturo = tc * Math.pow(1 + devalMensual, m);
    const netoHoyARS = netoHoyUSD * tc;
    html += `<tr><td class="td-mes">${m} ${m===1?'mes':'meses'}</td>`;
    html += `<td style="font-family:'DM Mono',monospace;text-align:center;font-weight:600">$${fmt(tcFuturo,0)}</td>`;
    html += `<td style="font-family:'DM Mono',monospace;text-align:center;color:rgba(237,224,196,.5)">$${fmt(netoHoyARS,0)}</td>`;
    [0, -5, -10, 5, 10, 15].forEach(v => {
      const precioFut = p * (1 + v/100);
      const netoFutUSD = calcNeto(precioFut, 'acopio').neto - calcAlmacCosto('sb').total;
      const netoFutARS = netoFutUSD * tcFuturo;
      const diff = netoFutARS - netoHoyARS;
      const cls = diff > netoHoyARS * 0.03 ? 'esc-cell-win' : diff < -netoHoyARS*0.03 ? 'esc-cell-lose' : 'esc-cell-mid';
      html += `<td class="${v===0?'esc-cell-hoy':cls}">$${fmt(netoFutARS,0)}<br><span style="font-size:.62rem;opacity:.75">${diff>=0?'+':''}$${fmt(diff,0)}</span></td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  const wrap = $('deval-table-wrap');
  if (wrap) wrap.innerHTML = html;
}


// ��������������������������������������������������
// PANEL 6 — HISTORIAL DE LOTES
// ��������������������������������������������������

function cargarHistorial() {
  try { return JSON.parse(localStorage.getItem('cosecha_historial') || '[]'); }
  catch(e) { return []; }
}
function guardarHistorialLS(arr) {
  localStorage.setItem('cosecha_historial', JSON.stringify(arr));
}

function guardarLote() {
  readState();
  if (!S.precioUSD || !S.tipoCambio) {
    alert('Completá precio y tipo de cambio antes de guardar.');
    return;
  }
  // Modal para nombre del lote
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">💾 Guardar lote en historial</div>
      <div class="modal-sub">Ingresá un nombre para identificar este lote o productor en el historial de campaña.</div>
      <div class="fg">
        <label class="fl">Nombre del lote / productor</label>
        <input type="text" id="modal-nombre" placeholder="Ej: Don Tito — Lote Bajo" style="font-size:.95rem" autofocus>
      </div>
      <div class="modal-btns">
        <button class="btn btn-s" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
        <button class="btn btn-gold" onclick="confirmarGuardarLote(this)">💾 Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.querySelector('#modal-nombre').focus(), 100);
  overlay.querySelector('#modal-nombre').addEventListener('keydown', e => {
    if (e.key === 'Enter') overlay.querySelector('.btn-gold').click();
  });
}

function confirmarGuardarLote(btn) {
  const nombre = document.querySelector('#modal-nombre')?.value.trim() || 'Lote sin nombre';
  btn.closest('.modal-overlay').remove();

  readState();
  const { toneladasComerciales } = calcProduccion();
  const netoHoyPuerto = calcNeto(S.precioUSD, 'puerto').neto;
  const netoHoyAcopio = calcNeto(S.precioUSD, 'acopio').neto;

  // Determinar decisión
  const pf = S.precioFuturo || S.precioUSD;
  const costoSB = calcAlmacCosto('sb').total;
  const netoSB = calcNeto(pf, 'acopio').neto - costoSB;
  const mejor = Math.max(netoHoyPuerto, netoHoyAcopio, netoSB);
  let decision = 'amarillo', decisionLabel = 'Sin calcular';
  if (mejor === netoHoyPuerto) { decision='rojo'; decisionLabel='Vender hoy → Puerto'; }
  else if (mejor === netoHoyAcopio) { decision='rojo'; decisionLabel='Vender hoy → Acopio'; }
  else { decision='verde'; decisionLabel=`Almacenar ${S._meses} meses`; }

  const lote = {
    id: Date.now(),
    nombre,
    fecha: new Date().toLocaleDateString('es-AR'),
    cultivo: S.cultivo,
    cultivoNombre: CULTIVOS[S.cultivo].nombre,
    superficie: S.superficie,
    rendimiento: S.rendimiento,
    toneladas: toneladasComerciales,
    precioUSD: S.precioUSD,
    tipoCambio: S.tipoCambio,
    netoHoyPuerto, netoHoyAcopio,
    costoSB, netoSB,
    meses: S._meses,
    decision, decisionLabel
  };

  const historial = cargarHistorial();
  historial.unshift(lote);
  guardarHistorialLS(historial);
  renderHistorial();
  showTab('historial');
}

function renderHistorial() {
  const historial = cargarHistorial();
  const container = $('historial-container');
  const resumenCard = $('resumen-campaña-card');

  if (!historial.length) {
    container.innerHTML = `<div class="ph-state" style="padding:3rem 1rem"><span class="ph-icon">📋</span><p>Todavía no guardaste ningún lote.<br>Completá un análisis y presioná <strong>"💾 Guardar lote"</strong>.</p></div>`;
    resumenCard.style.display = 'none';
    return;
  }

  let html = '';
  historial.forEach(l => {
    const emoji = {soja:'🟡',maiz:'🟠',trigo:'🟤',girasol:'🌻',sorgo:'🔴'}[l.cultivo] || '🌾';
    html += `
      <div class="hist-lote">
        <button class="hist-delete" onclick="eliminarLote(${l.id})" title="Eliminar">✕</button>
        <div class="hist-lote-header">
          <div>
            <div class="hist-lote-nombre">${l.nombre}</div>
            <div class="hist-lote-fecha">${l.fecha}</div>
          </div>
          <div class="hist-decision-badge hist-${l.decision}">${l.decisionLabel}</div>
        </div>
        <div class="hist-lote-chips">
          <span class="chip chip-gold">${emoji} ${l.cultivoNombre}</span>
          <span class="chip chip-blue">${fmt(l.superficie,0)} ha</span>
          <span class="chip chip-ok">${fmt(l.rendimiento,1)} qq/ha</span>
        </div>
        <div class="hist-lote-datos">
          <div class="hist-dato"><div class="hist-dato-l">Toneladas</div><div class="hist-dato-v">${fmt(l.toneladas,0)} t</div></div>
          <div class="hist-dato"><div class="hist-dato-l">Precio FOB</div><div class="hist-dato-v">USD ${fmt(l.precioUSD,0)}</div></div>
          <div class="hist-dato"><div class="hist-dato-l">Neto → Puerto</div><div class="hist-dato-v">USD ${fmt(l.netoHoyPuerto,1)}</div></div>
          <div class="hist-dato"><div class="hist-dato-l">Neto → Acopio</div><div class="hist-dato-v">USD ${fmt(l.netoHoyAcopio,1)}</div></div>
          <div class="hist-dato"><div class="hist-dato-l">Neto s/bolsa</div><div class="hist-dato-v">USD ${fmt(l.netoSB,1)}</div></div>
          <div class="hist-dato"><div class="hist-dato-l">TC Oficial</div><div class="hist-dato-v">$${fmt(l.tipoCambio,0)}</div></div>
        </div>
      </div>`;
  });
  container.innerHTML = html;

  // Resumen campaña
  resumenCard.style.display = 'block';
  const totTon   = historial.reduce((s,l) => s + (l.toneladas||0), 0);
  const totHa    = historial.reduce((s,l) => s + (l.superficie||0), 0);
  const totUSD   = historial.reduce((s,l) => s + (l.netoHoyAcopio||0)*(l.toneladas||0), 0);
  const promNeto = totTon > 0 ? totUSD / totTon : 0;
  const nVerdes  = historial.filter(l=>l.decision==='verde').length;
  $('kpi-campaña').innerHTML = `
    <div class="kc gold-card"><div class="kl">Lotes analizados</div><div class="kv">${historial.length}</div><div class="ku">registros</div></div>
    <div class="kc gold-card"><div class="kl">Superficie total</div><div class="kv">${fmt(totHa,0)}</div><div class="ku">hectáreas</div></div>
    <div class="kc gold-card"><div class="kl">Producción total</div><div class="kv">${fmt(totTon,0)}</div><div class="ku">toneladas</div></div>
    <div class="kc ok-card"><div class="kl">USD total campaña</div><div class="kv">${fmt(totUSD/1000,0)}K</div><div class="ku">neto est. USD</div></div>
    <div class="kc ok-card"><div class="kl">Neto promedio</div><div class="kv">${fmt(promNeto,1)}</div><div class="ku">USD/ton prom.</div></div>
    <div class="kc ${nVerdes>0?'ok-card':'warn-card'}"><div class="kl">Almacenar conviene</div><div class="kv">${nVerdes}</div><div class="ku">de ${historial.length} lotes</div></div>`;
}

function eliminarLote(id) {
  if (!confirm('¿Eliminár este lote del historial?')) return;
  const historial = cargarHistorial().filter(l => l.id !== id);
  guardarHistorialLS(historial);
  renderHistorial();
}

function limpiarHistorial() {
  if (!confirm('¿Borrar todo el historial de lotes? Esta acción no se puede deshacer.')) return;
  localStorage.removeItem('cosecha_historial');
  renderHistorial();
}

function exportHistorialCSV() {
  const historial = cargarHistorial();
  if (!historial.length) { alert('No hay lotes guardados.'); return; }
  const cols = ['Nombre','Fecha','Cultivo','Superficie (ha)','Rendimiento (qq/ha)','Toneladas','Precio USD','TC Oficial','Neto Puerto (USD/ton)','Neto Acopio (USD/ton)','Neto Silo Bolsa (USD/ton)','Decisión'];
  const rows = historial.map(l => [
    l.nombre, l.fecha, l.cultivoNombre, l.superficie, l.rendimiento,
    fmt(l.toneladas,1), l.precioUSD, l.tipoCambio,
    fmt(l.netoHoyPuerto,1), fmt(l.netoHoyAcopio,1), fmt(l.netoSB,1), l.decisionLabel
  ].join(';'));
  const csv = '\uFEFF' + [cols.join(';'), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'CosechaDecide_Historial.csv';
  a.click(); URL.revokeObjectURL(url);
}


// ── INIT ──
function init() {
  const hoy = new Date();
  if ($('badge-date')) $('badge-date').textContent = '📅 ' + hoy.toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short', year:'numeric' });

  buildMonthPills();
  buildEscenarioMesesPills();

  const token = localStorage.getItem('bcra_token');
  if (token) { $('token-wrap').style.opacity = '.5'; S.bcraToken = token; }

  calcSecado();
  loadAllAPIs();
  renderHistorial();
  setTimeout(calcLive, 1200);
}

window.cosInit = function() {
  if (window._cosInitDone) return;
  window._cosInitDone = true;
  init();
};

  // Exposici�n a global por retrocompatibilidad HTML
  window.tarModo = tarModo;
  window.calcLive = calcLive;
  window.calcDecision = calcDecision;
  window.cosShowTab = showTab;
  window.onCultivoChange = onCultivoChange;
  window.onTarifaChange = onTarifaChange;
  window.calcSecado = calcSecado;
  window.usarTasaBCRA = usarTasaBCRA;
  window.saveBcraToken = saveBcraToken;
  window.runIA = runIA;
  window.cosExportPDF = exportPDF;
  window.buildEscenarios = buildEscenarios;
  window.guardarLote = guardarLote;
  window.eliminarLote = eliminarLote;
  window.cosLimpiarHistorial = limpiarHistorial;
  window.exportHistorialCSV = exportHistorialCSV;
  window.confirmarGuardarLote = confirmarGuardarLote;

})();
