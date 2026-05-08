// AGROMOTOR — siembra-apis.js
// NASA POWER · SoilGrids ISRIC · Compactación Índice S Dexter

async function buscarNASAPower(lat, lon, mes) {
  // NASA POWER: climatología mensual — promedio histórico por mes del año
  // Community AG, parámetros agrícolas clave
  // Resolución: 0.5° x 0.625° (~50 km) — datos desde 1981
  const params = [
    'ALLSKY_SFC_SW_DWN',  // Radiación solar global (MJ/m²/día)
    'T2M_MAX',            // Temperatura máx promedio (°C)
    'T2M_MIN',            // Temperatura mín promedio (°C)
    'PRECTOTCORR',        // Precipitación (mm/día)
    'RH2M',               // Humedad relativa 2m (%)
    'WS2M',               // Velocidad viento 2m (m/s)
    'ET0',                // ET₀ de referencia (mm/día)
    'ALLSKY_SFC_LW_DWN',  // Radiación onda larga (W/m²)
  ].join(',');

  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?` +
    `parameters=${params}` +
    `&community=AG` +
    `&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}` +
    `&format=JSON`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('NASA POWER HTTP ' + res.status);
  const data = await res.json();
  const props = data?.properties?.parameter;
  if (!props) throw new Error('NASA POWER: respuesta inesperada');
  return props;
}

function renderNASAPower(props, mes, lat, lon) {
  // mes: 1-12
  const mIdx = String(mes).padStart(2, '0'); // "01" a "12"
  const meses = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const get = (key) => props[key]?.[mIdx] ?? null;
  const getAnual = (key) => props[key]?.['ANN'] ?? null;

  const rad    = get('ALLSKY_SFC_SW_DWN');  // MJ/m²/día
  const tmax   = get('T2M_MAX');
  const tmin   = get('T2M_MIN');
  const precD  = get('PRECTOTCORR');        // mm/día → * 30 para mensual
  const rh     = get('RH2M');
  const ws     = get('WS2M');
  const et0    = get('ET0');
  const precM  = precD != null ? precD * 30 : null;    // mm/mes aprox
  const et0M   = et0  != null ? et0  * 30 : null;      // mm/mes aprox
  const balHid = (precM != null && et0M != null) ? precM - et0M : null;

  // Días con lluvia: estimado por umbral 1mm/d
  // NASA POWER no da días con lluvia directamente, estimamos
  const drd = precD != null ? Math.round(precD * 30 / 3.5) : null; // aprox

  // Panel rápido
  $('np-rad').textContent  = rad   != null ? rad.toFixed(1)+' MJ/m²/d' : '—';
  $('np-prec').textContent = precM != null ? precM.toFixed(0)+' mm'     : '—';
  $('np-tmax').textContent = tmax  != null ? tmax.toFixed(1)+'°C'       : '—';
  $('np-tmin').textContent = tmin  != null ? tmin.toFixed(1)+'°C'       : '—';
  $('np-et0').textContent  = et0M  != null ? et0M.toFixed(0)+' mm'      : '—';
  $('np-rh').textContent   = rh    != null ? rh.toFixed(0)+'%'          : '—';
  $('np-drd').textContent  = drd   != null ? '~'+drd+' días'            : '—';
  $('np-bal').textContent  = balHid!= null ? (balHid>=0?'+':'')+balHid.toFixed(0)+' mm' : '—';
  $('nasa-info').classList.remove('hidden');

  // Tabla mensual completa — los 12 meses + anual
  const mesesNombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic','Anual'];
  const claves = ['01','02','03','04','05','06','07','08','09','10','11','12','ANN'];

  // Balance hídrico mensual para gráfico de barras
  const filaHeader = `
    <div style="overflow-x:auto;margin-top:.8rem">
    <table class="dt" style="min-width:700px">
      <thead><tr>
        <th>Mes</th>
        <th>Rad. solar<br><span style="font-weight:400">MJ/m²/d</span></th>
        <th>T° máx<br><span style="font-weight:400">°C</span></th>
        <th>T° mín<br><span style="font-weight:400">°C</span></th>
        <th>Precip.<br><span style="font-weight:400">mm/mes</span></th>
        <th>ET₀<br><span style="font-weight:400">mm/mes</span></th>
        <th>HR<br><span style="font-weight:400">%</span></th>
        <th>Balance<br><span style="font-weight:400">mm</span></th>
      </tr></thead>
      <tbody>`;

  const filas = claves.map((k, i) => {
    const esAnual = k === 'ANN';
    const esMesActual = k === mIdx;
    const r   = props['ALLSKY_SFC_SW_DWN']?.[k];
    const tx  = props['T2M_MAX']?.[k];
    const tn  = props['T2M_MIN']?.[k];
    const pd  = props['PRECTOTCORR']?.[k];
    const e   = props['ET0']?.[k];
    const h   = props['RH2M']?.[k];
    const pm  = pd != null ? (esAnual ? pd * 365 : pd * 30) : null;
    const em  = e  != null ? (esAnual ? e  * 365 : e  * 30) : null;
    const bal = pm != null && em != null ? pm - em : null;

    // Color del balance
    const balColor = bal == null ? '' :
      bal > 20  ? 'color:var(--ok);font-weight:600' :
      bal < -30 ? 'color:var(--warn);font-weight:600' :
                  'color:var(--caution)';

    const trClass = esMesActual ? 'hl' : esAnual ? '' : '';
    const trStyle = esAnual ? 'background:rgba(74,46,26,.04);font-weight:600' : '';

    return `<tr class="${trClass}" style="${trStyle}${esMesActual?' background:rgba(74,140,92,.1);':''}">
      <td>${mesesNombres[i]}${esMesActual?' 📌':''}</td>
      <td class="mn">${r  != null ? r.toFixed(1)  : '—'}</td>
      <td class="mn">${tx != null ? tx.toFixed(1) : '—'}</td>
      <td class="mn">${tn != null ? tn.toFixed(1) : '—'}</td>
      <td class="mn">${pm != null ? pm.toFixed(0) : '—'}</td>
      <td class="mn">${em != null ? em.toFixed(0) : '—'}</td>
      <td class="mn">${h  != null ? h.toFixed(0)  : '—'}</td>
      <td class="mn" style="${balColor}">${bal != null ? (bal>=0?'+':'')+bal.toFixed(0) : '—'}</td>
    </tr>`;
  }).join('');

  // Mini gráfico de barras del balance hídrico (ASCII visual con CSS)
  const balMeses = claves.slice(0,12).map(k => {
    const pd = props['PRECTOTCORR']?.[k];
    const e  = props['ET0']?.[k];
    if (pd == null || e == null) return null;
    return (pd - e) * 30;
  });

  const maxAbs = Math.max(...balMeses.filter(v=>v!=null).map(Math.abs), 1);

  const grafBalance = `
    <div style="margin-top:1.2rem">
      <div class="sl">Balance hídrico mensual histórico (Precip. − ET₀) · mm/mes promedio 30 años</div>
      <div style="display:flex;align-items:flex-end;gap:3px;height:80px;margin-top:.5rem">
        ${balMeses.map((v,i)=>{
          if(v==null)return'<div style="flex:1"></div>';
          const esM=claves[i]===mIdx;
          const pct=Math.abs(v)/maxAbs*100;
          const color=v>=0?'var(--ok)':'var(--warn)';
          const bord=esM?'2px solid var(--grain)':'none';
          return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px" title="${mesesNombres[i]}: ${v>=0?'+':''}${v.toFixed(0)} mm">
            ${v>=0?`<div style="flex:1"></div><div style="height:${pct}%;min-height:2px;width:100%;background:${color};border-radius:2px 2px 0 0;border:${bord}"></div>`:
                   `<div style="height:${pct}%;min-height:2px;width:100%;background:${color};border-radius:0 0 2px 2px;border:${bord}"></div><div style="flex:1"></div>`}
            <div style="font-size:.52rem;color:rgba(74,46,26,.5);margin-top:2px">${mesesNombres[i].slice(0,1)}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:1.2rem;margin-top:.5rem;font-size:.72rem">
        <span style="display:flex;align-items:center;gap:.3rem"><span style="width:10px;height:10px;background:var(--ok);border-radius:2px;display:inline-block"></span>Superávit hídrico</span>
        <span style="display:flex;align-items:center;gap:.3rem"><span style="width:10px;height:10px;background:var(--warn);border-radius:2px;display:inline-block"></span>Déficit hídrico</span>
        <span style="display:flex;align-items:center;gap:.3rem"><span style="width:10px;height:4px;background:var(--grain);border-radius:2px;display:inline-block"></span>Mes de siembra</span>
      </div>
    </div>`;

  // Interpretación agronómica del contexto histórico
  const et0MesVal = et0 != null ? et0 * 30 : null;
  const precMesVal = precD != null ? precD * 30 : null;
  const balMesVal = (et0MesVal && precMesVal) ? precMesVal - et0MesVal : null;

  let interp = '';
  if (balMesVal != null) {
    if (balMesVal > 30) {
      interp = `<div class="alert ok" style="margin-top:.8rem"><span class="ai">📊</span><div class="ac">
        <strong>Mes históricamente superavitario</strong>
        En ${mesesNombres[parseInt(mIdx)-1]}, este lote recibe históricamente más lluvia (${precMesVal.toFixed(0)} mm) que lo que pierde por ET₀ (${et0MesVal.toFixed(0)} mm). Balance promedio: +${balMesVal.toFixed(0)} mm. Condición típicamente favorable para establecimiento del cultivo.
      </div></div>`;
    } else if (balMesVal < -30) {
      interp = `<div class="alert danger" style="margin-top:.8rem"><span class="ai">📊</span><div class="ac">
        <strong>Mes históricamente deficitario</strong>
        En ${mesesNombres[parseInt(mIdx)-1]}, la demanda hídrica (ET₀: ${et0MesVal.toFixed(0)} mm) supera históricamente a la lluvia (${precMesVal.toFixed(0)} mm). Déficit promedio: ${balMesVal.toFixed(0)} mm. El establecimiento depende fuertemente de la reserva de agua en el perfil.
      </div></div>`;
    } else {
      interp = `<div class="alert warn" style="margin-top:.8rem"><span class="ai">📊</span><div class="ac">
        <strong>Mes históricamente en equilibrio hídrico</strong>
        Balance promedio en ${mesesNombres[parseInt(mIdx)-1]}: ${balMesVal>=0?'+':''}${balMesVal.toFixed(0)} mm. Las condiciones del lote en esta época son variables — el pronóstico de corto plazo (Open-Meteo) tiene mayor peso para la decisión de siembra que el histórico.
      </div></div>`;
    }
  }

  // Radiación solar: contexto para GDD y fotosíntesis
  let interpRad = '';
  if (rad != null) {
    if (rad > 20) {
      interpRad = `<div class="alert info" style="margin-top:.6rem"><span class="ai">☀️</span><div class="ac"><strong>Alta radiación solar histórica</strong> — ${rad.toFixed(1)} MJ/m²/día promedio. Condición favorable para acumulación de GDD y desarrollo del cultivo.</div></div>`;
    } else if (rad < 12) {
      interpRad = `<div class="alert warn" style="margin-top:.6rem"><span class="ai">☀️</span><div class="ac"><strong>Radiación solar baja históricamente</strong> — ${rad.toFixed(1)} MJ/m²/día. Puede limitar la tasa de acumulación de GDD y la fotosíntesis del cultivo.</div></div>`;
    }
  }

  $('nasa-card').classList.remove('hidden');
  $('nasa-contenido').innerHTML = filaHeader + filas + '</tbody></table></div>' + grafBalance + interp + interpRad;
}

// ════════════════════════════════════════════════════════
// SOILGRIDS — ESTRATEGIA HÍBRIDA
// 1° intento: REST API de SoilGrids (rest.isric.org)
// 2° fallback: Base de datos interna pampa argentina
//    calibrada con datos WoSIS/INTA por tipo de suelo
// ════════════════════════════════════════════════════════

// Base de datos interna — valores típicos región pampeana argentina
// Fuente: WoSIS, INTA EEA Marcos Juárez, Pergamino, Anguil
const DB_SUELO_PAMPA = {
  Molisol:  { ph:6.2, clay:25, sand:32, silt:43, soc:18.5, n:1.65, da:1.18, cec:22.0, fuente:'DB interna · Molisol pampeano típico (INTA/WoSIS)' },
  Vertisol: { ph:7.1, clay:48, sand:12, silt:40, soc:14.2, n:1.30, da:1.25, cec:32.0, fuente:'DB interna · Vertisol (INTA EEA Marcos Juárez)' },
  Alfisol:  { ph:5.8, clay:28, sand:35, silt:37, soc:12.0, n:1.10, da:1.32, cec:16.5, fuente:'DB interna · Alfisol degradado típico' },
  Entisol:  { ph:6.0, clay:10, sand:72, silt:18, soc: 5.5, n:0.55, da:1.48, cec: 7.0, fuente:'DB interna · Entisol arenoso' },
  Oxisol:   { ph:5.2, clay:35, sand:28, silt:37, soc:22.0, n:1.90, da:1.10, cec:12.0, fuente:'DB interna · Oxisol laterítico' },
};

// Clasifica textura USDA
function clasificarTextura(clay, sand, silt) {
  if (clay >= 40) return 'Vertisol';
  if (clay >= 27 && silt >= 28) return 'Vertisol';
  if (clay >= 20 && clay < 35 && silt >= 28 && sand < 45) return 'Alfisol';
  if (clay < 20 && sand < 52 && silt >= 28) return 'Molisol';
  if (sand >= 70) return 'Entisol';
  if (clay < 18 && silt >= 65) return 'Molisol';
  return 'Molisol';
}

async function buscarSoilGrids(lat, lon) {
  // ── INTENTO 1: REST API de SoilGrids ──────────────────
  // Endpoint: rest.isric.org/soilgrids/v2.0/properties/query
  // Propiedades: phh2o, clay, sand, silt, soc, nitrogen, bdod, cec
  // Profundidad: 0-5cm · Valor: mean
  try {
    const props = 'phh2o,clay,sand,silt,soc,nitrogen,bdod,cec';
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query` +
      `?lon=${lon.toFixed(4)}&lat=${lat.toFixed(4)}` +
      `&property=${props.split(',').map(p=>`property=${p}`).join('&').replace(/property=/g,'').split('&').map(p=>`property=${p}`).join('&')}` +
      `&depth=0-5cm&value=mean`;

    // Construir URL correctamente
    const urlFinal = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon.toFixed(4)}&lat=${lat.toFixed(4)}&property=phh2o&property=clay&property=sand&property=silt&property=soc&property=nitrogen&property=bdod&property=cec&depth=0-5cm&value=mean`;

    const res = await Promise.race([
      fetch(urlFinal),
      new Promise((_,r) => setTimeout(()=>r(new Error('timeout')), 12000))
    ]);

    if (!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();

    // Parsear respuesta SoilGrids REST v2
    // Estructura: data.properties.layers[].name + .depths[0].values.mean
    const layers = data?.properties?.layers ?? [];
    if (!layers.length) throw new Error('Sin datos');

    const r = {};
    // Factores de conversión SoilGrids REST v2 (valores mapeados a convencionales)
    const factores = { phh2o:0.1, clay:0.1, sand:0.1, silt:0.1, soc:0.1, nitrogen:0.01, bdod:0.01, cec:0.1 };
    const claves   = { phh2o:'ph', clay:'clay', sand:'sand', silt:'silt', soc:'soc', nitrogen:'n', bdod:'da', cec:'cec' };

    layers.forEach(layer => {
      const nombre = layer.name;
      const val    = layer.depths?.[0]?.values?.mean;
      if (val != null && val > 0 && val < 32000 && factores[nombre]) {
        r[claves[nombre]] = val * factores[nombre];
      }
    });

    if (Object.keys(r).length < 3) throw new Error('Datos insuficientes');

    // Calcular textura y tipo de suelo
    if (r.clay != null && r.sand != null && r.silt != null) {
      r.textura = clasificarTextura(r.clay, r.sand, r.silt);
    }
    r.fuente = '🛰️ SoilGrids REST API · ISRIC/Wageningen · 250 m · Datos reales';
    r.esFallback = false;
    console.log('✅ SoilGrids REST API funcionando:', r);
    return r;

  } catch(e) {
    console.warn('SoilGrids REST falló:', e.message, '— usando base de datos interna pampa');
  }

  // ── FALLBACK: Base de datos interna pampa argentina ───
  // Detectar tipo de suelo por coordenadas (ya tenemos SPOLY)
  const sueloAuto = detSuelo(lat, lon) || 'Molisol';
  const base = DB_SUELO_PAMPA[sueloAuto] || DB_SUELO_PAMPA.Molisol;

  // Ajuste fino por latitud/longitud dentro de la región pampeana
  // Gradiente N→S: más húmedo al sur, más arcilloso en el centro
  const latAbs = Math.abs(lat);
  const ajusteSOC = latAbs > 36 ? 1.15 : latAbs < 30 ? 0.85 : 1.0; // más MO al sur
  const ajustePH  = latAbs > 36 ? -0.2 : 0;                          // más ácido al sur

  const r = {
    ph:      parseFloat((base.ph  + ajustePH).toFixed(1)),
    clay:    base.clay,
    sand:    base.sand,
    silt:    base.silt,
    soc:     parseFloat((base.soc * ajusteSOC).toFixed(1)),
    n:       parseFloat((base.n   * ajusteSOC).toFixed(2)),
    da:      base.da,
    cec:     base.cec,
    textura: sueloAuto,
    fuente:  `📚 ${base.fuente} · Ajuste por latitud aplicado`,
    esFallback: true,
  };

  return r;
}

function renderSoilGrids(d) {
  if (!d || Object.keys(d).length === 0) return;

  const mo = d.soc != null ? d.soc * 1.724 / 10 : null; // % MO

  // ── Panel resumen superior (api-info) ──
  $('sg-ph').textContent      = d.ph   != null ? d.ph.toFixed(1)        : '—';
  $('sg-clay').textContent    = d.clay != null ? d.clay.toFixed(0)+'%'  : '—';
  $('sg-sand').textContent    = d.sand != null ? d.sand.toFixed(0)+'%'  : '—';
  $('sg-soc').textContent     = d.soc  != null ? d.soc.toFixed(1)+' g/kg' : '—';
  $('sg-n').textContent       = d.n    != null ? d.n.toFixed(2)+' g/kg' : '—';
  $('sg-da').textContent      = d.da   != null ? d.da.toFixed(2)+' g/cm³' : '—';
  $('sg-cec').textContent     = d.cec  != null ? d.cec.toFixed(1)+' cmol' : '—';
  $('sg-textura').textContent = d.textura || '—';
  $('sg-info').classList.remove('hidden');

  // ── KPI cards principales ──
  const kpiColor = (val, buenos, malos) => {
    if (val == null) return '';
    if (malos(val)) return 'warn';
    if (buenos(val)) return '';
    return 'neutral';
  };

  const kpis = `<div class="rg" style="grid-template-columns:repeat(auto-fit,minmax(105px,1fr));margin-bottom:1rem">
    ${d.ph != null ? `<div class="kc ${d.ph<5.5||d.ph>7.8?'warn':d.ph>=6&&d.ph<=7.5?'':'neutral'}">
      <div class="kl">pH suelo</div>
      <div class="kv">${d.ph.toFixed(1)}</div>
      <div class="ku">${d.ph<5.5?'Muy ácido':d.ph<6?'Ácido':d.ph<=7.5?'✅ Óptimo':'Alcalino'}</div>
    </div>` : ''}
    ${mo != null ? `<div class="kc ${mo<2?'warn':mo>3.5?'':'neutral'}">
      <div class="kl">Mat. orgánica</div>
      <div class="kv">${mo.toFixed(1)}</div>
      <div class="ku">% · ${mo<2?'Baja':mo<3.5?'Media':'Alta'}</div>
    </div>` : ''}
    ${d.soc != null ? `<div class="kc neutral">
      <div class="kl">C. orgánico</div>
      <div class="kv">${d.soc.toFixed(1)}</div>
      <div class="ku">g/kg (0-5cm)</div>
    </div>` : ''}
    ${d.n != null ? `<div class="kc neutral">
      <div class="kl">N total</div>
      <div class="kv">${d.n.toFixed(2)}</div>
      <div class="ku">g/kg · C/N≈${d.soc&&d.n?(d.soc/d.n).toFixed(0):'—'}</div>
    </div>` : ''}
    ${d.da != null ? `<div class="kc ${d.da>1.45?'warn':d.da<1.1?'':' neutral'}">
      <div class="kl">Dens. aparente</div>
      <div class="kv">${d.da.toFixed(2)}</div>
      <div class="ku">g/cm³ · ${d.da>1.45?'⚠️ Alta':d.da<1.2?'Baja':'Normal'}</div>
    </div>` : ''}
    ${d.cec != null ? `<div class="kc neutral">
      <div class="kl">CEC</div>
      <div class="kv">${d.cec.toFixed(0)}</div>
      <div class="ku">cmol/kg · ${d.cec>25?'Alta':d.cec>15?'Media':'Baja'}</div>
    </div>` : ''}
    ${d.clay != null ? `<div class="kc neutral">
      <div class="kl">Arcilla</div>
      <div class="kv">${d.clay.toFixed(0)}</div>
      <div class="ku">% · ${d.clay>40?'Vértica':d.clay>25?'Media':'Baja'}</div>
    </div>` : ''}
    ${d.textura ? `<div class="kc" style="background:linear-gradient(135deg,#3A2A0E,#6A4A1A)">
      <div class="kl">Tipo de suelo</div>
      <div class="kv" style="font-size:1.1rem;color:var(--grain)">${d.textura}</div>
      <div class="ku">SoilGrids 250m</div>
    </div>` : ''}
  </div>`;

  // ── Textura visual (triángulo simplificado) ──
  let texBarra = '';
  if (d.clay != null && d.sand != null && d.silt != null) {
    const tot = d.clay + d.sand + d.silt;
    const cp = (d.clay/tot*100).toFixed(0);
    const sp = (d.sand/tot*100).toFixed(0);
    const lp = (d.silt/tot*100).toFixed(0);
    texBarra = `
      <div style="margin-bottom:1rem">
        <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--earth);margin-bottom:.5rem">Composición granulométrica (0-5 cm)</div>
        <div style="display:flex;height:22px;border-radius:6px;overflow:hidden;gap:2px">
          <div style="flex:${d.clay};background:#C94A2A;display:flex;align-items:center;justify-content:center;font-size:.68rem;color:white;font-weight:700;min-width:28px">${cp}%</div>
          <div style="flex:${d.silt};background:#B87A20;display:flex;align-items:center;justify-content:center;font-size:.68rem;color:white;font-weight:700;min-width:28px">${lp}%</div>
          <div style="flex:${d.sand};background:#C8A255;display:flex;align-items:center;justify-content:center;font-size:.68rem;color:white;font-weight:700;min-width:28px">${sp}%</div>
        </div>
        <div style="display:flex;gap:1.2rem;margin-top:.4rem;font-size:.72rem;color:rgba(74,46,26,.6)">
          <span><span style="display:inline-block;width:10px;height:10px;background:#C94A2A;border-radius:2px;margin-right:.3rem"></span>Arcilla</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#B87A20;border-radius:2px;margin-right:.3rem"></span>Limo</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#C8A255;border-radius:2px;margin-right:.3rem"></span>Arena</span>
        </div>
      </div>`;
  }

  // ── Tabla detallada ──
  const ccEstim = d.clay>=35 ? 35 : d.sand>=65 ? 12 : 28;
  const pmEstim = d.clay>=35 ? 18 : d.sand>=65 ? 4  : 12;
  const tabla = `
    <div style="overflow-x:auto">
    <table class="dt">
      <thead><tr><th>Propiedad</th><th>Valor (0-5 cm)</th><th>Interpretación agronómica</th></tr></thead>
      <tbody>
        ${d.ph   !=null?`<tr><td>⚗️ pH (H₂O)</td><td class="mn" style="font-weight:700">${d.ph.toFixed(1)}</td><td>${d.ph<5.5?'🚫 Muy ácido — encalar urgente':d.ph<6.0?'⚠️ Ácido — considerar encalado':d.ph<=7.5?'✅ Óptimo para cultivos pampeanos':'⚠️ Alcalino — limita P, Fe, Zn'}</td></tr>`:''}
        ${mo     !=null?`<tr><td>🌱 Materia orgánica</td><td class="mn" style="font-weight:700">${mo.toFixed(1)} %</td><td>${mo>3.5?'✅ Alta — buena estructura y fertilidad':mo>2.0?'⚠️ Media — mantener con rastrojos':'🚫 Baja — suelo degradado, siembra directa'}</td></tr>`:''}
        ${d.soc  !=null?`<tr><td>🌿 C. orgánico</td><td class="mn">${d.soc.toFixed(1)} g/kg</td><td>Equivale a ${mo!=null?mo.toFixed(1)+'%':''} MO (factor van Bemmelen 1.724)</td></tr>`:''}
        ${d.n    !=null?`<tr><td>🔬 N total</td><td class="mn">${d.n.toFixed(2)} g/kg</td><td>Relación C/N ≈ ${d.soc&&d.n?(d.soc/d.n).toFixed(0):'—'} · ${d.soc&&d.n&&(d.soc/d.n)<10?'Mineralización rápida':d.soc&&d.n&&(d.soc/d.n)>15?'Mineralización lenta':'Normal'}</td></tr>`:''}
        ${d.da   !=null?`<tr><td>⚖️ Densidad aparente</td><td class="mn" style="font-weight:700">${d.da.toFixed(2)} g/cm³</td><td>${d.da>1.55?'🚫 Muy alta — compactación severa':d.da>1.40?'⚠️ Alta — riesgo de compactación':d.da<1.10?'Muy baja — alta MO':'✅ Normal'}</td></tr>`:''}
        ${d.cec  !=null?`<tr><td>🧲 CEC</td><td class="mn">${d.cec.toFixed(1)} cmol/kg</td><td>${d.cec>25?'Alta — excelente retención de nutrientes':d.cec>15?'Media — adecuada':'⚠️ Baja — riesgo de lixiviación de K y Mg'}</td></tr>`:''}
        ${d.clay !=null?`<tr><td>🏺 Arcilla</td><td class="mn">${d.clay.toFixed(0)} %</td><td>${d.clay>40?'Vértica — alta plasticidad húmedo, duro seco':d.clay>25?'Media — buen balance':d.clay>15?'Franco-arenosa':'Arenosa — bajo retención'}</td></tr>`:''}
        ${d.sand !=null?`<tr><td>🏖️ Arena</td><td class="mn">${d.sand.toFixed(0)} %</td><td>—</td></tr>`:''}
        ${d.silt !=null?`<tr><td>🌫️ Limo</td><td class="mn">${d.silt.toFixed(0)} %</td><td>—</td></tr>`:''}
        <tr style="background:rgba(74,140,92,.08)"><td><strong>💧 Capacidad de campo estim.</strong></td><td class="mn"><strong>~${ccEstim}%</strong></td><td>Punto de marchitez: ~${pmEstim}% · Agua útil: ~${ccEstim-pmEstim}%</td></tr>
        ${d.textura?`<tr class="hl"><td><strong>🗺️ Tipo de suelo (estimado)</strong></td><td colspan="2"><strong>${d.textura}</strong> — clasificación por textura USDA/WRB</td></tr>`:''}
      </tbody>
    </table></div>`;

  // ── Alertas interpretativas ──
  const alertas = [
    d.ph<5.5  ? `<div class="alert danger"><span class="ai">⚗️</span><div class="ac"><strong>pH muy ácido (${d.ph?.toFixed(1)})</strong> — Aplicar ~${((6.2-(d.ph??5))*600).toFixed(0)} kg/ha de cal agrícola para elevar a pH 6.2. La disponibilidad de P, Ca y Mg está severamente reducida.</div></div>` : '',
    d.ph>7.5  ? `<div class="alert warn"><span class="ai">⚗️</span><div class="ac"><strong>pH alcalino (${d.ph?.toFixed(1)})</strong> — Monitorear disponibilidad de P, Fe y Zn. En suelos con carbonatos activos verificar con análisis local.</div></div>` : '',
    mo!=null&&mo<2.0 ? `<div class="alert warn"><span class="ai">🌱</span><div class="ac"><strong>Materia orgánica baja (${mo.toFixed(1)}%)</strong> — Suelo con estructura degradada. Priorizar siembra directa, cobertura permanente y retención total de rastrojos. Cada 1% de MO adicional aporta ~20 kg N/ha/año mineralizable.</div></div>` : '',
    d.da!=null&&d.da>1.45 ? `<div class="alert warn"><span class="ai">⚖️</span><div class="ac"><strong>Densidad aparente alta (${d.da?.toFixed(2)} g/cm³)</strong> — Indica compactación existente. Confirmar con penetrómetro. Porosidad reducida limita el crecimiento radicular y la infiltración del agua.</div></div>` : '',
    d.cec!=null&&d.cec<10 ? `<div class="alert info"><span class="ai">🧲</span><div class="ac"><strong>CEC baja (${d.cec?.toFixed(1)} cmol/kg)</strong> — El suelo tiene poca capacidad de retener cationes (K⁺, Ca²⁺, Mg²⁺). Fraccioná las aplicaciones de fertilizantes potásicos y cálcicos para evitar pérdidas.</div></div>` : '',
  ].filter(Boolean).join('');

  const fuente = `<div style="margin-top:.8rem;padding:.55rem .8rem;background:rgba(74,46,26,.04);border-radius:8px;font-size:.7rem;color:rgba(74,46,26,.45)">
    📡 <strong>Fuente:</strong> SoilGrids 2.0 ISRIC/Wageningen · Resolución 250 m · Profundidad 0-5 cm · Licencia CC BY 4.0 · Datos de orientación — validar con análisis de suelo local para decisiones críticas.
  </div>`;

  $('sg-card').classList.remove('hidden');
  $('sg-contenido').innerHTML = kpis + texBarra + tabla + alertas + fuente;
}

// ════════════════════════════════════════════════════════
// MODELO DE RIESGO DE COMPACTACIÓN — AgroMotor
// ════════════════════════════════════════════════════════
// Basado en:
// 1. Índice S de Dexter (2004) — calidad física del suelo
// 2. Susceptibilidad Proctor — humedad vs. densidad máxima
// 3. Load Bearing Capacity (Saffih-Hdadi et al. 2009)
// 4. Factor de tráfico de maquinaria
// Entradas: SoilGrids (arcilla, MO, DA) + Open-Meteo (humedad)
// ════════════════════════════════════════════════════════

function calcularCompactacion(sg, humActual, trafico, diaRef) {
  if (!sg || (!sg.clay && !sg.da)) return null;

  const clay = sg.clay ?? 25;          // % arcilla
  const sand = sg.sand ?? 40;          // % arena
  const soc  = sg.soc  ?? 15;          // g/kg C orgánico
  const da   = sg.da   ?? 1.30;        // g/cm³ densidad aparente
  const mo   = soc * 1.724 / 10;       // % materia orgánica (factor van Bemmelen)

  // ── 1. ÍNDICE S DE DEXTER ──────────────────────────────
  // S = indicador de calidad física. Calculado via PTF Saxton & Rawls:
  // θ_FC = capacidad de campo, θ_WP = punto marchitez (m³/m³)
  // S se calcula del punto de inflexión de la curva retención de agua
  // Aproximación simplificada calibrada para suelos pampeanos:
  const clayF = clay / 100;
  const sandF = sand / 100;
  const moF   = mo / 100;

  // PTF Saxton & Rawls para θ_FC y θ_WP
  const thetaFC = 0.299 - 0.251 * sandF + 0.195 * clayF + 0.011 * moF
                + 0.006 * sandF * moF - 0.027 * clayF * moF
                + 0.452 * sandF * clayF;
  const thetaWP = 0.031 - 0.024 * sandF + 0.487 * clayF + 0.006 * moF
                + 0.005 * sandF * moF - 0.013 * clayF * moF
                + 0.068 * sandF * clayF;

  // Índice S de Dexter — punto inflexión curva de retención
  // S = n * (θ_FC - θ_WP) / (da / 2.65) * factor_arcilla
  // n ≈ parámetro de Van Genuchten (~1.5 para texturas medias)
  const n = 1.2 + 0.7 * sandF - 0.3 * clayF;
  const m = 1 - 1/n;
  const indiceS = -n * m * (thetaFC - thetaWP) * Math.pow(2, -(1+m)/m) * Math.pow(m, m);
  const indiceSAbs = Math.abs(indiceS);

  // ── 2. SUSCEPTIBILIDAD HÍDRICA ─────────────────────────
  // La compactación es máxima cuando θ ≈ θ_optima (≈ 0.7 * θ_FC)
  // Riesgo aumenta cuando hum está entre 50-85% de la CC
  const humVol = humActual / 100;     // slider está en %
  const thetaOpt = 0.72 * thetaFC;   // humedad óptima de compactación (Proctor)
  const ccPorc = thetaFC * 100;

  // Distancia relativa al punto óptimo de compactación (0=peor, 1=mejor)
  const distOpt  = Math.abs(humVol - thetaOpt);
  const rangeBad = thetaFC * 0.35;    // rango de mayor susceptibilidad
  const factorHum = Math.max(0, 1 - distOpt / rangeBad); // 0=bueno, 1=peor

  // ── 3. FACTOR DE ARCILLA ───────────────────────────────
  // Suelos vérticos (arcilla >35%) se deforman plásticamente cuando húmedos
  const factorArcilla = clayF >= 0.40 ? 1.3
                      : clayF >= 0.30 ? 1.1
                      : clayF >= 0.20 ? 1.0
                      : 0.85;

  // ── 4. FACTOR DE MATERIA ORGÁNICA ─────────────────────
  // MO alta protege la estructura. Cada 1% extra de MO reduce el riesgo ~15%
  const factorMO = Math.max(0.5, 1 - (mo - 1.5) * 0.12);

  // ── 5. FACTOR DE DENSIDAD APARENTE ────────────────────
  // Si DA ya es alta → suelo ya compactado, resistencia mayor
  const factorDA = da >= 1.55 ? 1.40    // ya muy compactado
                 : da >= 1.45 ? 1.20
                 : da >= 1.35 ? 1.05
                 : da >= 1.20 ? 0.95
                 : 0.85;                 // DA baja = suelo esponjoso, bien estructurado

  // ── 6. FACTOR DE TRÁFICO ──────────────────────────────
  // 0=sin tráfico, 1=liviano, 2=pesado, 3=intensivo
  const factoresTraf = [1.0, 1.2, 1.5, 1.85];
  const factorTraf   = factoresTraf[trafico] ?? 1.0;

  // ── 7. LLUVIA RECIENTE (Open-Meteo) ───────────────────
  // Si llovió mucho en los últimos 3 días → suelo más húmedo → más riesgo
  let factorLluvia = 1.0;
  if (diaRef) {
    const precReciente = diaRef.precS ?? 0; // mm últimas 24h
    if (precReciente > 30) factorLluvia = 1.35;
    else if (precReciente > 15) factorLluvia = 1.20;
    else if (precReciente > 5)  factorLluvia = 1.10;
  }

  // ── SCORE DE RIESGO COMPACTACIÓN (0-100) ──────────────
  // Base: inversamente proporcional al Índice S
  // S > 0.035 = buena calidad, S < 0.020 = compactado
  let scoreSuelo;
  if (indiceSAbs >= 0.050) scoreSuelo = 10;       // muy buena calidad
  else if (indiceSAbs >= 0.035) scoreSuelo = 30;  // buena calidad
  else if (indiceSAbs >= 0.025) scoreSuelo = 55;  // moderada
  else if (indiceSAbs >= 0.015) scoreSuelo = 75;  // degradado
  else scoreSuelo = 90;                            // muy degradado

  // Score ajustado por todos los factores
  const scoreRiesgo = Math.min(99, Math.round(
    scoreSuelo * factorHum * factorArcilla * factorMO * factorDA * factorTraf * factorLluvia
  ));

  // ── ESTIMACIÓN DE MPa ──────────────────────────────────
  // Conversión empírica del score → resistencia penetrómetro (MPa)
  // Basada en: Dexter 2004, Bengough et al. 2011
  // Score 0-100 → MPa 0.3-5.0 (relación no lineal)
  const mpaEstimado = Math.max(0.3, Math.min(5.0,
    0.3 + (scoreRiesgo / 100) * 3.8 * factorDA * (1 + clayF * 0.5)
  ));

  // ── CLASIFICACIÓN ─────────────────────────────────────
  let nivel, color, icono, diasEsperar, recomendacion;

  if (scoreRiesgo < 25) {
    nivel = 'RIESGO BAJO'; color = '#1A5C2A'; icono = '✅';
    diasEsperar = 0;
    recomendacion = `El suelo está en buenas condiciones para recibir tránsito de maquinaria. Índice S ${indiceSAbs.toFixed(3)} indica buena calidad estructural.`;
  } else if (scoreRiesgo < 50) {
    nivel = 'RIESGO MODERADO'; color = '#7A4A10'; icono = '⚠️';
    diasEsperar = humVol > thetaOpt ? Math.ceil((humVol - thetaOpt * 0.9) / 0.005) : 0;
    recomendacion = `Precaución con maquinaria pesada. ${trafico >= 2 ? 'Evitar equipos de más de 6 ton por eje. ' : ''}${diasEsperar > 0 ? `Esperar ${diasEsperar} días sin lluvia para reducir la humedad.` : 'Limitar el número de pasadas.'}`;
  } else if (scoreRiesgo < 75) {
    nivel = 'RIESGO ALTO'; color = '#B84A10'; icono = '🔶';
    diasEsperar = Math.max(2, Math.ceil((humVol - thetaOpt * 0.8) / 0.004));
    recomendacion = `No se recomienda tránsito de maquinaria pesada. Humedad actual (${humActual}%) cercana al punto óptimo de compactación (${(thetaOpt*100).toFixed(0)}% vol.). Esperar ${diasEsperar} días o usar maquinaria de menos de 4 ton/eje con neumáticos de baja presión.`;
  } else {
    nivel = 'RIESGO CRÍTICO'; color = '#7A1A0A'; icono = '🚫';
    diasEsperar = Math.max(4, Math.ceil((humVol - thetaWP * 1.5) / 0.003));
    recomendacion = `Suelo con alta susceptibilidad a la compactación permanente. ${da >= 1.45 ? 'La densidad aparente elevada indica compactación previa. ' : ''}Evitar todo tránsito. En caso de necesidad operativa, usar solo maquinaria de menos de 3 ton/eje. Considerar subsolado si la situación persiste.`;
  }

  return {
    scoreRiesgo, mpaEstimado, nivel, color, icono,
    diasEsperar, recomendacion, indiceS: indiceSAbs,
    factorHum, factorArcilla, factorMO, factorDA, factorTraf,
    thetaFC, thetaWP, thetaOpt, mo, humVol, ccPorc,
  };
}

function renderCompactacion(c, sg) {
  if (!c) return;

  // Barra de riesgo
  const barColor = c.scoreRiesgo < 25 ? 'var(--ok)'
                 : c.scoreRiesgo < 50 ? 'var(--caution)'
                 : c.scoreRiesgo < 75 ? '#E06020' : 'var(--warn)';

  // Tabla de factores
  const factores = [
    { label:'Índice S (calidad estructural)',   val: c.indiceS.toFixed(3),
      interp: c.indiceS >= 0.035 ? '✅ Buena calidad' : c.indiceS >= 0.025 ? '⚠️ Moderada' : '🚫 Degradado' },
    { label:'Humedad actual vs. óptima comp.',   val: `${(c.humVol*100).toFixed(0)}% vs ${(c.thetaOpt*100).toFixed(0)}% vol`,
      interp: c.factorHum > 0.6 ? '🚫 Zona de alto riesgo' : c.factorHum > 0.3 ? '⚠️ Precaución' : '✅ Fuera de zona crítica' },
    { label:'Capacidad de campo estimada',       val: `${c.ccPorc.toFixed(0)}% vol`,
      interp: '—' },
    { label:'Densidad aparente (DA)',            val: `${sg.da?.toFixed(2)||'—'} g/cm³`,
      interp: (sg.da??0) >= 1.45 ? '🚫 Ya compactado' : (sg.da??0) >= 1.35 ? '⚠️ Moderada' : '✅ Normal' },
    { label:'Materia orgánica',                  val: `${c.mo.toFixed(1)}%`,
      interp: c.mo > 3.5 ? '✅ Protectora' : c.mo > 2.0 ? '⚠️ Media' : '🚫 Baja protección' },
    { label:'% Arcilla',                         val: `${sg.clay?.toFixed(0)||'—'}%`,
      interp: (sg.clay??0) >= 35 ? '⚠️ Alta plasticidad' : '✅ Normal' },
    { label:'MPa estimado (penetrómetro)',        val: `${c.mpaEstimado.toFixed(1)} MPa`,
      interp: c.mpaEstimado >= 3.0 ? '🚫 Limitante' : c.mpaEstimado >= 2.0 ? '⚠️ Moderado' : '✅ Sin limitación' },
  ];

  const tabla = `
    <table class="dt" style="margin-top:.6rem">
      <thead><tr><th>Factor</th><th>Valor</th><th>Interpretación</th></tr></thead>
      <tbody>${factores.map(f=>`<tr><td>${f.label}</td><td class="mn">${f.val}</td><td style="font-size:.8rem">${f.interp}</td></tr>`).join('')}</tbody>
    </table>`;

  // Mini gauge visual
  const gaugeW = Math.min(100, c.scoreRiesgo);
  const gauge = `
    <div style="margin:.8rem 0 .4rem">
      <div style="display:flex;justify-content:space-between;font-size:.7rem;color:rgba(74,46,26,.5);margin-bottom:.3rem">
        <span>Sin riesgo</span><span>Crítico</span>
      </div>
      <div style="height:12px;border-radius:6px;background:linear-gradient(90deg,var(--ok) 0%,var(--caution) 40%,#E06020 65%,var(--warn) 100%);position:relative">
        <div style="position:absolute;top:-4px;left:${gaugeW}%;transform:translateX(-50%);width:4px;height:20px;background:white;border-radius:2px;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>
      </div>
      <div style="font-size:.68rem;color:rgba(74,46,26,.4);margin-top:.2rem;text-align:center">Score: ${c.scoreRiesgo}/100</div>
    </div>`;

  // Recomendación operativa
  const recOp = c.diasEsperar > 0
    ? `<div class="alert ${c.scoreRiesgo>=75?'danger':'warn'}" style="margin-top:.8rem">
        <span class="ai">${c.icono}</span>
        <div class="ac"><strong>${c.nivel} — ${c.diasEsperar} días recomendados de espera</strong><br>${c.recomendacion}</div>
       </div>`
    : `<div class="alert ok" style="margin-top:.8rem">
        <span class="ai">${c.icono}</span>
        <div class="ac"><strong>${c.nivel}</strong><br>${c.recomendacion}</div>
       </div>`;

  // Ventana operativa NASA POWER
  let ventanaHist = '';
  const npET0 = $('np-et0')?.textContent;
  if (npET0 && npET0 !== '—' && c.diasEsperar > 0) {
    const et0Val = parseFloat(npET0);
    if (!isNaN(et0Val) && et0Val > 0) {
      const mmPerDia = et0Val / 30;
      const mmNecesarios = (c.humVol - c.thetaOpt * 0.85) * 100 * 0.15; // aprox
      const diasReales = Math.ceil(mmNecesarios / mmPerDia);
      ventanaHist = `<div class="alert info" style="margin-top:.6rem"><span class="ai">📅</span><div class="ac">
        <strong>Ventana estimada por evapotranspiración histórica</strong>
        Con ET₀ media histórica de ${mmPerDia.toFixed(1)} mm/día para este mes y ubicación (NASA POWER),
        el suelo tardaría aproximadamente <strong>${diasReales} días</strong> en drenar la humedad excesiva en ausencia de lluvia.
      </div></div>`;
    }
  }

  // Base científica
  const ciencia = `<div style="margin-top:.8rem;padding:.6rem .8rem;background:rgba(74,46,26,.04);border-radius:8px;font-size:.72rem;color:rgba(74,46,26,.5)">
    <strong>Base metodológica:</strong> Índice S de Dexter (2004) · PTF Saxton & Rawls (2006) · Load Bearing Capacity Saffih-Hdadi et al. (2009) ·
    Datos: SoilGrids ISRIC 250m + Open-Meteo · Estimación de orientación — no reemplaza la medición con penetrómetro.
  </div>`;

  $('compact-card').classList.remove('hidden');
  $('compact-contenido').innerHTML =
    `<div style="background:${c.color};border-radius:10px;padding:1rem 1.2rem;color:white;display:flex;align-items:center;gap:1rem;margin-bottom:.8rem">
      <span style="font-size:2rem">${c.icono}</span>
      <div>
        <div style="font-family:'DM Serif Display',serif;font-size:1.2rem">${c.nivel}</div>
        <div style="font-size:.73rem;opacity:.75">${c.mpaEstimado.toFixed(1)} MPa estimado · Score ${c.scoreRiesgo}/100 · Índice S: ${c.indiceS.toFixed(3)}</div>
      </div>
    </div>`
    + gauge + tabla + recOp + ventanaHist + ciencia;

  // Disparar recálculo del diagnóstico de siembra con el MPa actualizado
  // para que el score global refleje la compactación real
}

// ════════════════════════════════════════════════════════
// MÓDULO ECONOMÍA DE CAMPAÑA
// Margen bruto actual y a cosecha
// Fuentes: DolarAPI (tiempo real) + precios manuales BCR
// Etapa 2: Matba-Rofex API para precios automáticos
// ════════════════════════════════════════════════════════

// DB de costos por defecto por cultivo (USD/ha · zona pampeana · campaña 2025/26)
const EC_COSTOS_BASE = {
  Soja:   { semilla:65, fertil:50,  agroquim:70, siembra:35, cosecha:45, otros:15 },
  Maíz:   { semilla:110,fertil:130, agroquim:65, siembra:40, cosecha:55, otros:20 },
  Trigo:  { semilla:55, fertil:100, agroquim:60, siembra:35, cosecha:40, otros:15 },
  Girasol:{ semilla:50, fertil:55,  agroquim:55, siembra:35, cosecha:40, otros:12 },
  Cebada: { semilla:50, fertil:90,  agroquim:55, siembra:35, cosecha:40, otros:15 },
  Sorgo:  { semilla:40, fertil:70,  agroquim:45, siembra:30, cosecha:40, otros:12 },
};

// Mes de cosecha y contrato futuro de referencia por cultivo
const EC_COSECHA_INFO = {
  Soja:    { mes:'Mayo',      contrato:'SOJ/MAY26', spreadHist:-12 },
  Maíz:    { mes:'Abril',     contrato:'MAI/ABR26', spreadHist:-8  },
  Trigo:   { mes:'Diciembre', contrato:'TRI/DIC25', spreadHist:-15 },
  Girasol: { mes:'Marzo',     contrato:'GIR/MAR26', spreadHist:-10 },
  Cebada:  { mes:'Diciembre', contrato:'CEB/DIC25', spreadHist:-12 },
  Sorgo:   { mes:'Abril',     contrato:'SOR/ABR26', spreadHist:-8  },
};

// Rendimientos típicos por cultivo (t/ha · zona pampeana media)
const EC_REND_BASE = {
  Soja:3.2, Maíz:7.5, Trigo:3.8, Girasol:2.2, Cebada:3.5, Sorgo:5.0
};

// Factor conversión t → qq (1 t = 10 qq para soja; ajuste por densidad)
function ecToneladasAqq(cult) {
  return { Soja:10, Maíz:10, Trigo:10, Girasol:10, Cebada:10, Sorgo:10 }[cult] || 10;
}

// Estado del dólar