// AGROMOTOR — siembra-apis.js
// NASA POWER · SoilGrids ISRIC · Compactación Índice S Dexter

(function() {
  window.AM = window.AM || {};
  window.AM.siembraApis = {};
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
    'ALLSKY_SFC_LW_DWN',  // Radiación onda larga (W/m²)
  ].join(',');

  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?` +
    `parameters=${params}` +
    `&community=AG` +
    `&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}` +
    `&format=JSON`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
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

// Valores típicos P/K/Zn por tipo de suelo pampeano
// Fuente: Fertilizar — Mapas de Disponibilidad de Nutrientes Región Pampeana (2018, 2024)
//         + WoSIS ISRIC + INTA EEA Balcarce/Marcos Juárez
const DB_PKZ_PAMPA = {
  Molisol:  { p: 18, k: 195, zn: 1.0 },
  Vertisol: { p: 14, k: 340, zn: 0.8 },
  Alfisol:  { p: 11, k: 175, zn: 0.6 },
  Entisol:  { p:  8, k: 100, zn: 0.5 },
  Oxisol:   { p:  4, k:  80, zn: 0.7 },
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

// ══════════════════════════════════════════════════════════════
// P · K · Zn — FUENTES ARGENTINAS + OPENLANDMAP
// SoilGrids 2.0 no incluye P, K ni Zn. Esta cascada cubre
// el gap más crítico para el plan de fertilización:
// 1° OpenLandMap (OLM) 250m — P+K+Zn, Argentina completa
// 2° IDECOR WFS — P a 90m, solo provincia de Córdoba
// 3° DB interna por tipo de suelo (Fertilizar/INTA)
// ══════════════════════════════════════════════════════════════

function estaEnCordoba(lat, lon) {
  return lat >= -38.8 && lat <= -29.2 && lon >= -65.8 && lon <= -61.9;
}

async function buscarOpenLandMap(lat, lon) {
  // OpenLandMap/OpenGeoHub predicted250m point query
  // P: mg/kg (≈ ppm Mehlich/Bray)  |  K: cmol(+)/kg × 391 → ppm  |  Zn: mg/kg
  try {
    const url = 'https://api.openlandmap.org/query/point' +
      '?lat=' + lat.toFixed(4) + '&lon=' + lon.toFixed(4) +
      '&coll=predicted250m' +
      '&regex=sol_(phosphorus.extractable|potassium.exchangeable|zinc.extractable)' +
      '&format=json';

    const res = await Promise.race([
      fetch(url, { headers: { 'Accept': 'application/json' } }),
      new Promise(function(_, r) { setTimeout(function() { r(new Error('timeout')); }, 10000); })
    ]);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    var props = {};
    if (data && data.properties) {
      props = data.properties;
    } else if (data && Array.isArray(data.features) && data.features.length > 0) {
      props = data.features[0].properties || {};
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      props = data;
    }

    var resultado = {};

    var pKey = Object.keys(props).find(function(k) { return k.toLowerCase().includes('phosphorus'); });
    if (pKey != null && props[pKey] != null && props[pKey] > 0 && props[pKey] < 300) {
      resultado.p = parseFloat(props[pKey].toFixed(1));
    }

    var kKey = Object.keys(props).find(function(k) { return k.toLowerCase().includes('potassium'); });
    if (kKey != null && props[kKey] != null && props[kKey] > 0 && props[kKey] < 20) {
      resultado.k = Math.round(props[kKey] * 391);
    }

    var znKey = Object.keys(props).find(function(k) { return k.toLowerCase().includes('zinc'); });
    if (znKey != null && props[znKey] != null && props[znKey] > 0 && props[znKey] < 30) {
      resultado.zn = parseFloat(props[znKey].toFixed(2));
    }

    if (Object.keys(resultado).length === 0) throw new Error('Sin datos P/K/Zn en respuesta OLM');

    resultado.fuente_pkz     = '🌍 OpenLandMap · 250 m';
    resultado.fuente_pkz_id  = 'openlandmap';
    resultado.fuente_pkz_det = 'OpenGeoHub · predicted250m · P+K+Zn 0-5 cm · Estimación a 250m — validar con análisis Bray local';
    return resultado;

  } catch(e) {
    console.warn('[OLM] falló:', e.message, '→ continuando cascada');
    return null;
  }
}

async function buscarIDECOR(lat, lon) {
  // IDECOR WFS — Mapa de Fósforo 2024 · 90m · Solo Córdoba
  if (!estaEnCordoba(lat, lon)) return null;
  var capas = [
    'idecor:suelos_fosforo_2024',
    'idecor:suelos_fosforo',
    'idecor:propiedades_suelos_fosforo',
  ];
  var delta = 0.0045;
  var bbox  = (lon - delta) + ',' + (lat - delta) + ',' + (lon + delta) + ',' + (lat + delta) + ',EPSG:4326';

  for (var ci = 0; ci < capas.length; ci++) {
    try {
      var url = 'https://idecor-ws.mapascordoba.gob.ar/geoserver/idecor/wfs' +
        '?service=WFS&version=2.0.0&request=GetFeature&typeName=' + capas[ci] +
        '&bbox=' + bbox + '&outputFormat=application/json';
      var res = await Promise.race([
        fetch(url),
        new Promise(function(_, r) { setTimeout(function() { r(new Error('timeout')); }, 8000); })
      ]);
      if (!res.ok) continue;
      var gj = await res.json();
      if (!gj.features || gj.features.length === 0) continue;
      var feat = gj.features[0].properties || {};
      var pCampos = ['fosforo_ppm', 'fosforo', 'p_ppm', 'P', 'phosphorus', 'p'];
      for (var pi = 0; pi < pCampos.length; pi++) {
        var pv = feat[pCampos[pi]];
        if (pv != null && !isNaN(parseFloat(pv)) && parseFloat(pv) > 0 && parseFloat(pv) < 300) {
          return {
            p:              parseFloat(parseFloat(pv).toFixed(1)),
            fuente_pkz:     '📍 IDECOR Córdoba · 90 m · P 2024',
            fuente_pkz_id:  'idecor',
            fuente_pkz_det: 'IDECOR / Gobierno de Córdoba · Mapa de Fósforo 2024 · 90 m · Solo provincia de Córdoba',
          };
        }
      }
    } catch(e) { continue; }
  }
  console.warn('[IDECOR] capa de fósforo no encontrada → fallback');
  return null;
}

async function buscarPKZ(lat, lon, textura) {
  // 1° OpenLandMap — P+K+Zn, 250m, Argentina completa
  var olm = await buscarOpenLandMap(lat, lon);
  if (olm && (olm.p != null || olm.k != null || olm.zn != null)) {
    // En Córdoba: reemplazar P con IDECOR 90m si disponible (mayor resolución)
    if (estaEnCordoba(lat, lon)) {
      var idecor = await buscarIDECOR(lat, lon);
      if (idecor && idecor.p != null) {
        olm.p = idecor.p;
        olm.fuente_pkz     = '📍 IDECOR 90m (P) + 🌍 OLM 250m (K/Zn)';
        olm.fuente_pkz_id  = 'idecor+olm';
        olm.fuente_pkz_det = 'P: IDECOR Córdoba 2024 90m · K+Zn: OpenLandMap predicted250m';
      }
    }
    return olm;
  }

  // 2° Solo IDECOR (si OLM falló y estamos en Córdoba)
  var idecorSolo = await buscarIDECOR(lat, lon);
  if (idecorSolo) return idecorSolo;

  // 3° DB interna por tipo de suelo
  var tipo = (textura && DB_PKZ_PAMPA[textura]) ? textura : 'Molisol';
  var db   = DB_PKZ_PAMPA[tipo];
  return {
    p:              db.p,
    k:              db.k,
    zn:             db.zn,
    fuente_pkz:     '📚 DB regional · P/K/Zn típicos',
    fuente_pkz_id:  'db',
    fuente_pkz_det: 'DB interna · valores típicos ' + tipo + ' pampeano (Fertilizar/INTA) · Alta incertidumbre — requiere análisis de laboratorio',
  };
}

function renderSoilGrids(d) {
  if (!d || Object.keys(d).length === 0) return;

  const mo = d.soc != null ? d.soc * 1.724 / 10 : null; // % MO

  // Badge de fuente para P/K/Zn
  const pkzId  = d.fuente_pkz_id || '';
  const pkzBadge = pkzId === 'openlandmap' ? '🌍 OLM 250m'
                 : pkzId === 'idecor'      ? '📍 IDECOR 90m'
                 : pkzId === 'idecor+olm'  ? '📍+🌍 90m/250m'
                 : pkzId === 'db'          ? '📚 DB regional'
                 : '—';

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
    ${d.p != null ? `<div class="kc ${d.p<12?'warn':d.p<25?'neutral':''}">
      <div class="kl">P disponible</div>
      <div class="kv">${d.p.toFixed(0)}</div>
      <div class="ku">ppm · ${d.p<12?'⚠️ Bajo':d.p<25?'Medio':'Alto'} · ${pkzBadge}</div>
    </div>` : ''}
    ${d.k != null ? `<div class="kc ${d.k<100?'warn':d.k<200?'neutral':''}">
      <div class="kl">K intercambiable</div>
      <div class="kv">${d.k.toFixed(0)}</div>
      <div class="ku">ppm · ${d.k<100?'⚠️ Bajo':d.k<200?'Medio':'Alto'} · ${pkzBadge}</div>
    </div>` : ''}
    ${d.zn != null ? `<div class="kc ${d.zn<0.7?'warn':d.zn<1.5?'neutral':''}">
      <div class="kl">Zinc disponible</div>
      <div class="kv">${d.zn.toFixed(1)}</div>
      <div class="ku">ppm · ${d.zn<0.7?'⚠️ Deficiente':d.zn<1.5?'Adecuado':'Alto'} · ${pkzBadge}</div>
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
  const pkzFuente = d.fuente_pkz ? ` <span style="font-size:.65em;opacity:.6">(${d.fuente_pkz})</span>` : '';
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
        ${d.p    !=null?`<tr style="background:rgba(200,162,85,.06)"><td>⚗️ P disponible${pkzFuente}</td><td class="mn" style="font-weight:700">${d.p.toFixed(0)} ppm</td><td>${d.p<8?'🚫 Muy bajo — deficiencia severa probable':d.p<12?'⚠️ Bajo — respuesta a P esperable':d.p<25?'Medio — fertilización de reposición':d.p<40?'✅ Bueno':'Alto — sin respuesta a P esperada'}</td></tr>`:''}
        ${d.k    !=null?`<tr style="background:rgba(200,162,85,.06)"><td>🧲 K intercambiable${pkzFuente}</td><td class="mn" style="font-weight:700">${d.k.toFixed(0)} ppm</td><td>${d.k<80?'🚫 Muy bajo — deficiencia probable':d.k<120?'⚠️ Bajo — considerar fertilización K':d.k<200?'Medio — adecuado para la mayoría de cultivos':'✅ Alto — sin limitación de K'}</td></tr>`:''}
        ${d.zn   !=null?`<tr style="background:rgba(200,162,85,.06)"><td>⚡ Zinc disponible${pkzFuente}</td><td class="mn" style="font-weight:700">${d.zn.toFixed(2)} ppm</td><td>${d.zn<0.5?'🚫 Deficiente — aplicar ZnSO₄ o EDTA-Zn':d.zn<0.7?'⚠️ Bajo — monitorear, especialmente en maíz':d.zn<1.5?'✅ Adecuado':'Alto — sin limitación de Zn'}</td></tr>`:''}
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
    d.p!=null&&d.p<12 ? `<div class="alert warn"><span class="ai">⚗️</span><div class="ac"><strong>Fósforo bajo (${d.p?.toFixed(0)} ppm)</strong> — Nivel por debajo del umbral crítico para cultivos pampeanos (~12-15 ppm Bray I). Se espera respuesta económica a la fertilización fosfatada. ${pkzId==='db'?'Valor estimado — confirmar con análisis de laboratorio.':''}</div></div>` : '',
    d.zn!=null&&d.zn<0.7 ? `<div class="alert warn"><span class="ai">⚡</span><div class="ac"><strong>Zinc deficiente (${d.zn?.toFixed(2)} ppm)</strong> — Nivel inferior al umbral crítico (0.7 ppm DTPA). El maíz es especialmente sensible a la deficiencia de Zn. Considerar 2-4 kg/ha de ZnSO₄ o aplicación foliar. ${pkzId==='db'?'Valor estimado — confirmar con análisis.':''}</div></div>` : '',
    (d.p!=null||d.k!=null||d.zn!=null)&&pkzId==='db' ? `<div class="alert info"><span class="ai">📚</span><div class="ac"><strong>P/K/Zn estimados por tipo de suelo</strong> — Los valores de fósforo, potasio y zinc corresponden a valores típicos de ${d.textura||'Molisol'} pampeano (Fertilizar/INTA). La precisión es orientativa — para decisiones de fertilización se recomienda análisis de laboratorio (Bray I, NH₄Ac, DTPA).</div></div>` : '',
  ].filter(Boolean).join('');

  // Nota de fuentes múltiples
  const pkzFuenteTexto = d.fuente_pkz_det ? ` · ${d.fuente_pkz_det}` : '';
  const fuente = `<div style="margin-top:.8rem;padding:.55rem .8rem;background:rgba(74,46,26,.04);border-radius:8px;font-size:.7rem;color:rgba(74,46,26,.45)">
    📡 <strong>pH/MO/N/Textura:</strong> SoilGrids 2.0 ISRIC/Wageningen · 250 m · CC BY 4.0${d.fuente_pkz ? ` · <strong>P/K/Zn:</strong> ${d.fuente_pkz}${pkzFuenteTexto}` : ''} · Datos de orientación — validar con análisis de suelo local para decisiones críticas.
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

// ════════════════════════════════════════════════════════
// DATOS UNIFICADOS DEL SUELO
// _sueloDatos  = objeto fusionado {campo: {valor, fuente}}
// _labDatos    = datos ingresados por el usuario (lab)
// _sgDatos     = datos crudos de APIs (SoilGrids + PKZ de OLM/IDECOR/DB)
// Prioridad: laboratorio > OpenLandMap/IDECOR/DB (P/K/Zn) > SoilGrids (resto)
// ════════════════════════════════════════════════════════
window._sueloDatos = {};
window._labDatos   = {};

// Fusiona _sgDatos + _labDatos → _sueloDatos
function sueloFusionar() {
  const sg  = window._sgDatos  || {};
  const lab = window._labDatos || {};
  const sd  = {};

  // Cargar base desde SoilGrids (textura, pH, MO, N, DA, CEC)
  const sgCampos = {
    ph:      sg.ph,
    soc:     sg.soc,
    n:       sg.n,
    da:      sg.da,
    cec:     sg.cec,
    clay:    sg.clay,
    sand:    sg.sand,
    silt:    sg.silt,
    textura: sg.textura,
    mo:      sg.soc != null ? sg.soc * 1.724 / 10 : null,
  };
  Object.keys(sgCampos).forEach(function(k) {
    if (sgCampos[k] != null) sd[k] = { valor: sgCampos[k], fuente: 'soilgrids' };
  });

  // P, K, Zn desde OpenLandMap / IDECOR / DB (SoilGrids no los incluye)
  const pkzId = sg.fuente_pkz_id || null;
  if (sg.p  != null) sd.p  = { valor: sg.p,  fuente: pkzId || 'soilgrids' };
  if (sg.k  != null) sd.k  = { valor: sg.k,  fuente: pkzId || 'soilgrids' };
  if (sg.zn != null) sd.zn = { valor: sg.zn, fuente: pkzId || 'soilgrids' };

  // Override campo a campo con datos de laboratorio (máxima prioridad)
  const labCampos = { ph: lab.ph, mo: lab.mo, n: lab.n, p: lab.p, k: lab.k, cec: lab.cec, da: lab.da, zn: lab.zn, ce: lab.ce };
  Object.keys(labCampos).forEach(function(k) {
    const v = labCampos[k];
    if (v != null && v !== '' && !isNaN(parseFloat(v))) {
      sd[k] = { valor: parseFloat(v), fuente: 'laboratorio' };
    }
  });

  sd.esFallback = sg.esFallback || false;
  window._sueloDatos = sd;
  return sd;
}

// Actualiza el resumen visual de datos efectivos en el panel lab
function sueloRenderResumenLab() {
  const sd      = window._sueloDatos || {};
  const badge   = document.getElementById('lab-status-badge');
  const resumen = document.getElementById('lab-resumen');
  const content = document.getElementById('lab-resumen-content');
  if (!content) return;

  const tieneLab = Object.values(sd).some(function(v) { return v && v.fuente === 'laboratorio'; });
  if (badge) badge.style.display = tieneLab ? '' : 'none';
  if (!resumen) return;
  if (!tieneLab && !window._sgDatos) { resumen.style.display = 'none'; return; }

  const labels = {
    ph:'pH', mo:'MO (%)', soc:'SOC g/kg', n:'N total g/kg',
    da:'DA g/cm³', cec:'CEC cmol/kg', clay:'Arcilla %',
    p:'P disp. ppm', k:'K int. ppm', textura:'Textura',
  };
  // Lab primero, luego SoilGrids (máx 10 ítems)
  const labItems = Object.entries(sd).filter(function(e) { return e[1] && e[1].fuente === 'laboratorio'; });
  const sgItems  = Object.entries(sd).filter(function(e) { return e[1] && e[1].fuente === 'soilgrids' && labels[e[0]]; });
  const todos = labItems.concat(sgItems).slice(0, 10);

  let html = '';
  todos.forEach(function(entry) {
    const k = entry[0], v = entry[1];
    const lbl   = labels[k] || k;
    const esLab = v.fuente === 'laboratorio';
    const ico   = v.fuente === 'laboratorio' ? '🔬'
                : (v.fuente === 'openlandmap' || v.fuente === 'idecor+olm') ? '🌍'
                : v.fuente === 'idecor' ? '📍'
                : v.fuente === 'db' ? '📚'
                : '🛰️';
    const color = esLab ? '#1b5e35' : '#6b7280';
    const val   = typeof v.valor === 'number'
      ? (v.valor < 10 ? v.valor.toFixed(2) : v.valor.toFixed(1))
      : v.valor;
    html += '<div style="background:#fff;border-radius:7px;padding:.38rem .6rem;border:1px solid ' + (esLab ? 'rgba(74,140,92,.25)' : 'rgba(74,46,26,.08)') + '">'
          + '<div style="font-size:.61rem;color:' + color + ';font-weight:700">' + ico + ' ' + lbl + '</div>'
          + '<div style="font-size:.82rem;font-weight:600;color:#1A2A1A;font-family:\'DM Mono\',monospace">' + val + '</div>'
          + '</div>';
  });
  content.innerHTML = html;
  resumen.style.display = '';
}

// Rellena los inputs del panel lab con _labDatos guardados
function sueloRestaurarLabInputs() {
  const lab = window._labDatos || {};
  const map = { ph:'lab-ph', mo:'lab-mo', n:'lab-n', p:'lab-p', k:'lab-k', cec:'lab-cec', da:'lab-da', zn:'lab-zn', ce:'lab-ce' };
  Object.keys(map).forEach(function(k) {
    const el = document.getElementById(map[k]);
    if (el && lab[k] != null) el.value = lab[k];
  });
  // Si hay datos, mostrar badge y resumen
  const tieneLab = Object.keys(lab).length > 0;
  if (tieneLab) {
    sueloFusionar();
    sueloRenderResumenLab();
  }
}

// Toggle del panel colapsable
window.sueloToggleLab = function() {
  const panel = document.getElementById('lab-panel');
  const icon  = document.getElementById('lab-toggle-icon');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : '';
  if (icon) icon.textContent = open ? '▸' : '▾';
};

// Auto-guardar debounced al tipear (sin rerender completo)
var _labAutoguardarTimer = null;
window.sueloLabAutoguardar = function() {
  clearTimeout(_labAutoguardarTimer);
  _labAutoguardarTimer = setTimeout(function() {
    if (typeof sueloAplicarLab === 'function') sueloAplicarLab(true);
  }, 800);
};

// Aplica el análisis de laboratorio
window.sueloAplicarLab = function(silencioso) {
  const map = { ph:'lab-ph', mo:'lab-mo', n:'lab-n', p:'lab-p', k:'lab-k', cec:'lab-cec', da:'lab-da', zn:'lab-zn', ce:'lab-ce' };
  const labData = {};
  Object.keys(map).forEach(function(k) {
    const el = document.getElementById(map[k]);
    if (el && el.value.trim() !== '') {
      const v = parseFloat(el.value);
      if (!isNaN(v)) labData[k] = v;
    }
  });

  if (Object.keys(labData).length === 0 && !silencioso) {
    alert('Completá al menos un campo del análisis de laboratorio.');
    return;
  }

  window._labDatos = labData;
  sueloFusionar();
  sueloRenderResumenLab();
  if (typeof cacheGuardar === 'function') cacheGuardar();

  if (!silencioso) {
    const msg = document.getElementById('lab-aplicado-msg');
    if (msg) { msg.style.display = ''; setTimeout(function() { msg.style.display = 'none'; }, 3000); }
  }
};

// Limpia el análisis de laboratorio
window.sueloLimpiarLab = function() {
  window._labDatos = {};
  sueloFusionar();
  ['lab-ph','lab-mo','lab-n','lab-p','lab-k','lab-cec','lab-da','lab-zn','lab-ce'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const badge   = document.getElementById('lab-status-badge');
  const resumen = document.getElementById('lab-resumen');
  if (badge)   badge.style.display = 'none';
  if (resumen) { resumen.style.display = 'none'; document.getElementById('lab-resumen-content').innerHTML = ''; }
  if (typeof cacheGuardar === 'function') cacheGuardar();
};

// ── ANÁLISIS POR PDF / FOTO ──────────────────────────────

// Tab switcher del panel lab
window.sueloLabTab = function(tab) {
  ['manual','pdf','foto'].forEach(function(t) {
    var btn  = document.getElementById('lab-tab-' + t);
    var sect = document.getElementById('lab-sect-' + t);
    var activo = t === tab;
    if (btn) {
      btn.style.background  = activo ? '#2D5A30' : 'transparent';
      btn.style.color       = activo ? '#fff' : 'rgba(74,46,26,.65)';
      btn.style.fontWeight  = activo ? '700' : '500';
    }
    if (sect) sect.style.display = activo ? '' : 'none';
  });
};

// Muestra el nombre del archivo seleccionado
window.sueloLabArchivoSeleccionado = function(tipo) {
  var input  = document.getElementById('lab-' + tipo + '-input');
  var label  = document.getElementById('lab-' + tipo + '-nombre');
  var status = document.getElementById('lab-' + tipo + '-status');
  if (!input || !input.files[0]) return;
  if (label)  label.textContent = input.files[0].name;
  if (status) status.style.display = 'none';
};

// Convierte un File a base64 puro (sin prefijo data:)
function sueloLabArchivoABase64(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload  = function(e) { resolve(e.target.result.split(',')[1]); };
    reader.onerror = function()  { reject(new Error('Error leyendo el archivo')); };
    reader.readAsDataURL(file);
  });
}

// Llamada compartida al proxy de Claude
async function sueloLabLlamarIA(blocks) {
  var sesionData = await AM_SB.auth.getSession();
  var session    = sesionData.data && sesionData.data.session;
  if (!session) throw new Error('Sesión no activa. Iniciá sesión primero.');

  var prompt = 'Analizá este análisis de suelo agrícola y extraé los valores nutricionales. '
    + 'Respondé ÚNICAMENTE con un objeto JSON sin texto adicional ni backticks:\n'
    + '{"ph":<número o null>,"mo":<MO % o null>,"n":<N total g/kg o null>,'
    + '"p":<P disponible ppm Bray/Olsen o null>,"k":<K intercambiable ppm o null>,'
    + '"cec":<CEC cmol/kg o null>,"da":<densidad aparente g/cm³ o null>,'
    + '"zn":<Zn disponible DTPA ppm o null>,"ce":<conductividad eléctrica dS/m o null>}\n'
    + 'Si K viene en meq/100g, multiplicar por 391 para convertir a ppm. '
    + 'Si algún valor no está presente o no es claro, poner null.';

  var resp = await fetch(AM_CONFIG.claudeProxy, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + session.access_token
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: blocks.concat([{ type:'text', text: prompt }]) }]
    })
  });

  if (resp.status === 401 || resp.status === 403) {
    var err = await resp.json().catch(function() { return {}; });
    throw new Error(err.error || 'Sin acceso — verificá tu plan.');
  }
  if (resp.status === 429) {
    var err2 = await resp.json().catch(function() { return {}; });
    throw new Error(err2.error || 'Límite de uso alcanzado. Intentá más tarde.');
  }
  if (!resp.ok) throw new Error('Error ' + resp.status + ' del servidor.');

  var data   = await resp.json();
  var texto  = (data.content && data.content[0] && data.content[0].text) || '';
  var clean  = texto.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// Rellena los inputs del form manual y aplica
function sueloLabRellenarCampos(extraido) {
  var map = { ph:'lab-ph', mo:'lab-mo', n:'lab-n', p:'lab-p', k:'lab-k',
              cec:'lab-cec', da:'lab-da', zn:'lab-zn', ce:'lab-ce' };
  var detectados = [], noDetect = [];
  Object.keys(map).forEach(function(k) {
    var el = document.getElementById(map[k]);
    if (!el) return;
    if (extraido[k] != null) { el.value = extraido[k]; detectados.push(k); }
    else noDetect.push(k);
  });
  sueloAplicarLab(true);
  return { detectados: detectados, noDetect: noDetect };
}

// Construye el mensaje de resultado de la extracción
function sueloLabMsgResultado(detectados, noDetect) {
  var msg = '✅ ' + detectados.length + ' valor' + (detectados.length !== 1 ? 'es' : '') + ' extraído' + (detectados.length !== 1 ? 's' : '');
  if (detectados.length > 0) msg += ' (' + detectados.join(', ') + ')';
  if (noDetect.filter(function(k) { return ['p','k','ph','mo'].indexOf(k) >= 0; }).length > 0) {
    msg += '. No detectados: ' + noDetect.filter(function(k) { return ['p','k','ph','mo','n','cec','zn','ce'].indexOf(k) >= 0; }).join(', ');
  }
  msg += '. Revisá y editá los campos antes de confirmar.';
  return msg;
}

// Procesar PDF
window.sueloLabProcesarPDF = async function() {
  var input  = document.getElementById('lab-pdf-input');
  var file   = input && input.files[0];
  if (!file) { alert('Seleccioná un archivo PDF primero.'); return; }

  var btn    = document.getElementById('lab-pdf-btn');
  var status = document.getElementById('lab-pdf-status');
  if (btn)    { btn.disabled = true; btn.textContent = '⏳ Procesando...'; }
  if (status) { status.style.color = 'rgba(74,46,26,.6)'; status.textContent = '🤖 Claude analizando el PDF...'; status.style.display = ''; }

  try {
    var b64    = await sueloLabArchivoABase64(file);
    var blocks = [{ type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } }];
    var extraido = await sueloLabLlamarIA(blocks);
    var resultado = sueloLabRellenarCampos(extraido);
    sueloLabTab('manual');
    if (status) {
      status.style.color = '#1b5e35';
      status.textContent = sueloLabMsgResultado(resultado.detectados, resultado.noDetect);
    }
  } catch(err) {
    if (status) { status.style.color = '#C0392B'; status.textContent = '❌ ' + err.message; }
  }
  if (btn) { btn.disabled = false; btn.textContent = '🔍 Procesar PDF'; }
};

// Procesar foto
window.sueloLabProcesarFoto = async function() {
  var input  = document.getElementById('lab-foto-input');
  var file   = input && input.files[0];
  if (!file) { alert('Seleccioná o tomá una foto primero.'); return; }

  var btn    = document.getElementById('lab-foto-btn');
  var status = document.getElementById('lab-foto-status');
  if (btn)    { btn.disabled = true; btn.textContent = '⏳ Procesando...'; }
  if (status) { status.style.color = 'rgba(74,46,26,.6)'; status.textContent = '🤖 Claude analizando la imagen...'; status.style.display = ''; }

  try {
    var b64    = await sueloLabArchivoABase64(file);
    var mime   = file.type || 'image/jpeg';
    var blocks = [{ type:'image', source:{ type:'base64', media_type:mime, data:b64 } }];
    var extraido = await sueloLabLlamarIA(blocks);
    var resultado = sueloLabRellenarCampos(extraido);
    sueloLabTab('manual');
    if (status) {
      status.style.color = '#1b5e35';
      status.textContent = sueloLabMsgResultado(resultado.detectados, resultado.noDetect);
    }
  } catch(err) {
    if (status) { status.style.color = '#C0392B'; status.textContent = '❌ ' + err.message; }
  }
  if (btn) { btn.disabled = false; btn.textContent = '📷 Procesar imagen'; }
};

// Exposición interna
window.sueloFusionar = sueloFusionar;
window.sueloRenderResumenLab = sueloRenderResumenLab;
window.sueloRestaurarLabInputs = sueloRestaurarLabInputs;

// ── CONSULTAR SUELO (botón del módulo Suelo) ─────────────
async function consultarSuelo() {
  const lblCoord = document.getElementById('suelo-lbl-coord');
  const btnEl   = document.getElementById('btn-suelo');
  const stEl    = document.getElementById('suelo-st');
  const spEl    = document.getElementById('suelo-sp');
  const msgEl   = document.getElementById('suelo-msg');

  // Usar coordenadas globales del Dashboard/Siembra
  const coordRaw = document.getElementById('s-coord')?.value?.trim() || '';
  if (lblCoord) lblCoord.textContent = coordRaw || 'Sin coordenadas';

  const [lat, lon] = typeof parsCoord === 'function' ? parsCoord(coordRaw) : [null, null];
  if (lat === null) {
    alert('Formato no reconocido.\nEjemplo: -33.395, -60.192');
    return;
  }

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⟳ Consultando...'; }
  if (stEl)  stEl.classList.remove('hidden');
  if (spEl)  spEl.style.animation = 'spin 1s linear infinite';
  if (msgEl) msgEl.textContent = 'Consultando SoilGrids ISRIC...';

  try {
    // Paso 1: SoilGrids (textura, pH, MO, N, DA, CEC)
    const datos = await buscarSoilGrids(lat, lon);

    // Paso 2: P, K, Zn — cascada OpenLandMap → IDECOR → DB
    if (msgEl) msgEl.textContent = datos.esFallback
      ? 'Estimando suelo regional · Consultando P/K/Zn...'
      : 'SoilGrids OK · Consultando P/K/Zn (OLM)...';

    const pkz = await buscarPKZ(lat, lon, datos.textura || 'Molisol');
    if (pkz) {
      if (pkz.p  != null) datos.p  = pkz.p;
      if (pkz.k  != null) datos.k  = pkz.k;
      if (pkz.zn != null) datos.zn = pkz.zn;
      datos.fuente_pkz     = pkz.fuente_pkz;
      datos.fuente_pkz_id  = pkz.fuente_pkz_id;
      datos.fuente_pkz_det = pkz.fuente_pkz_det;
    }

    window._sgDatos = datos;

    // Fusionar con datos de lab y actualizar _sueloDatos
    sueloFusionar();
    sueloRenderResumenLab();

    // Renderizar en el módulo Suelo
    if (typeof renderSoilGrids === 'function') renderSoilGrids(datos);
    // Renderizar badges resumen (sidebar / dashboard)
    if (typeof renderSueloModulo === 'function') renderSueloModulo(datos);

    // Sincronizar textura al Dashboard si está vacío
    if (datos.textura) {
      const ss = document.getElementById('s-suelo');
      if (ss && !ss.value) ss.value = datos.textura;
    }

    const pkzLabel = datos.fuente_pkz_id === 'openlandmap'   ? ' · P+K+Zn 🌍 OLM'
                   : (datos.fuente_pkz_id || '').includes('idecor') ? ' · P+K/Zn 📍 IDECOR'
                   : datos.fuente_pkz_id === 'db'            ? ' · P/K/Zn 📚 DB'
                   : '';
    const labLabel = Object.keys(window._labDatos || {}).length > 0 ? ' · Lab 🔬' : '';
    if (msgEl) msgEl.textContent = datos.esFallback
      ? 'Base regional pampeana (SoilGrids no disponible)' + pkzLabel + labLabel
      : 'SoilGrids cargado' + pkzLabel + labLabel;
    if (spEl) spEl.style.animation = 'none';
  } catch(e) {
    if (msgEl) msgEl.textContent = 'Error al consultar: ' + e.message;
    if (spEl)  spEl.style.animation = 'none';
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = '🔄 Actualizar'; }
  }
}
window.consultarSuelo = consultarSuelo;

  // Exposición a global
  window.buscarNASAPower    = buscarNASAPower;
  window.renderNASAPower    = renderNASAPower;
  window.buscarSoilGrids    = buscarSoilGrids;
  window.renderSoilGrids    = renderSoilGrids;
  window.buscarOpenLandMap  = buscarOpenLandMap;
  window.buscarIDECOR       = buscarIDECOR;
  window.buscarPKZ          = buscarPKZ;
  window.calcularCompactacion = calcularCompactacion;
  window.renderCompactacion = renderCompactacion;
  window.ecToneladasAqq     = ecToneladasAqq;
  window.EC_COSTOS_BASE     = EC_COSTOS_BASE;
  window.EC_COSECHA_INFO    = EC_COSECHA_INFO;
  window.EC_REND_BASE       = EC_REND_BASE;

// Estado del dólar
})();