const SOILGRIDS_URL = 'https://rest.isric.org/soilgrids/v2.0/properties/query';
const OLM_URL = 'https://api.openlandmap.org/query/point';

const DB_SUELO_PAMPA = {
  Molisol:  { ph: 6.2, clay: 25, sand: 32, silt: 43, soc: 18.5, n: 1.65, da: 1.18, cec: 22.0, fuente: 'DB interna - Molisol pampeano tipico (INTA/WoSIS)' },
  Vertisol: { ph: 7.1, clay: 48, sand: 12, silt: 40, soc: 14.2, n: 1.30, da: 1.25, cec: 32.0, fuente: 'DB interna - Vertisol (INTA EEA Marcos Juarez)' },
  Alfisol:  { ph: 5.8, clay: 28, sand: 35, silt: 37, soc: 12.0, n: 1.10, da: 1.32, cec: 16.5, fuente: 'DB interna - Alfisol degradado tipico' },
  Entisol:  { ph: 6.0, clay: 10, sand: 72, silt: 18, soc:  5.5, n: 0.55, da: 1.48, cec:  7.0, fuente: 'DB interna - Entisol arenoso' },
  Oxisol:   { ph: 5.2, clay: 35, sand: 28, silt: 37, soc: 22.0, n: 1.90, da: 1.10, cec: 12.0, fuente: 'DB interna - Oxisol lateritico' },
};

const DB_PKZ_PAMPA = {
  Molisol:  { p: 18, k: 195, zn: 1.0 },
  Vertisol: { p: 14, k: 340, zn: 0.8 },
  Alfisol:  { p: 11, k: 175, zn: 0.6 },
  Entisol:  { p:  8, k: 100, zn: 0.5 },
  Oxisol:   { p:  4, k:  80, zn: 0.7 },
};

const DB_PKZ_PROVINCIAL = {
  'buenos aires': { p: 13, k: 165, zn: 0.9 },
  'santa fe': { p: 17, k: 170, zn: 0.9 },
  'cordoba': { p: 18, k: 185, zn: 0.8 },
  'entre rios': { p: 12, k: 150, zn: 0.8 },
  'la pampa': { p: 10, k: 170, zn: 0.7 },
  'san luis': { p: 10, k: 175, zn: 0.7 },
  'mendoza': { p: 11, k: 200, zn: 0.6 },
  'san juan': { p: 9, k: 190, zn: 0.6 },
  'la rioja': { p: 8, k: 180, zn: 0.6 },
  'catamarca': { p: 9, k: 185, zn: 0.6 },
  'tucuman': { p: 14, k: 195, zn: 0.8 },
  'salta': { p: 12, k: 180, zn: 0.7 },
  'jujuy': { p: 10, k: 160, zn: 0.7 },
  'chaco': { p: 10, k: 210, zn: 0.7 },
  'formosa': { p: 9, k: 200, zn: 0.7 },
  'santiago del estero': { p: 11, k: 220, zn: 0.7 },
  'corrientes': { p: 8, k: 100, zn: 0.7 },
  'misiones': { p: 4, k: 80, zn: 0.8 },
  'rio negro': { p: 8, k: 155, zn: 0.6 },
  'neuquen': { p: 7, k: 145, zn: 0.6 },
  'chubut': { p: 6, k: 130, zn: 0.5 },
  'santa cruz': { p: 5, k: 120, zn: 0.5 },
};

function normProv(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/provincia\s+(de\s+|del\s+)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function detSuelo(lat, lon) {
  const latAbs = Math.abs(lat);
  const lonAbs = Math.abs(lon);
  if (lat > -28) return 'Oxisol';
  if (latAbs > 37 && lonAbs > 63) return 'Entisol';
  if (latAbs > 35 && lonAbs < 61) return 'Alfisol';
  if (latAbs < 32 && lonAbs < 60) return 'Vertisol';
  return 'Molisol';
}

function clasificarTextura(clay, sand, silt) {
  if (clay >= 40) return 'Vertisol';
  if (clay >= 27 && silt >= 28) return 'Vertisol';
  if (clay >= 20 && clay < 35 && silt >= 28 && sand < 45) return 'Alfisol';
  if (clay < 20 && sand < 52 && silt >= 28) return 'Molisol';
  if (sand >= 70) return 'Entisol';
  if (clay < 18 && silt >= 65) return 'Molisol';
  return 'Molisol';
}

function regionalSoil(lat, lon) {
  const sueloAuto = detSuelo(lat, lon) || 'Molisol';
  const base = DB_SUELO_PAMPA[sueloAuto] || DB_SUELO_PAMPA.Molisol;
  const latAbs = Math.abs(lat);
  const ajusteSOC = latAbs > 36 ? 1.15 : latAbs < 30 ? 0.85 : 1.0;
  const ajustePH = latAbs > 36 ? -0.2 : 0;
  return {
    ph: Number((base.ph + ajustePH).toFixed(1)),
    clay: base.clay,
    sand: base.sand,
    silt: base.silt,
    soc: Number((base.soc * ajusteSOC).toFixed(1)),
    n: Number((base.n * ajusteSOC).toFixed(2)),
    da: base.da,
    cec: base.cec,
    textura: sueloAuto,
    fuente: `${base.fuente} - Ajuste por latitud aplicado`,
    esFallback: true,
  };
}

async function fetchJson(url, ms, headers) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function soilgrids(lat, lon) {
  const url = `${SOILGRIDS_URL}?lon=${lon.toFixed(4)}&lat=${lat.toFixed(4)}&property=phh2o&property=clay&property=sand&property=silt&property=soc&property=nitrogen&property=bdod&property=cec&depth=0-5cm&value=mean`;
  const data = await fetchJson(url, 12000, { 'User-Agent': 'AgroMotor/1.0 soil proxy' });
  const layers = data?.properties?.layers || [];
  if (!layers.length) throw new Error('SoilGrids sin capas');

  const factores = { phh2o: 0.1, clay: 0.1, sand: 0.1, silt: 0.1, soc: 0.1, nitrogen: 0.01, bdod: 0.01, cec: 0.1 };
  const claves = { phh2o: 'ph', clay: 'clay', sand: 'sand', silt: 'silt', soc: 'soc', nitrogen: 'n', bdod: 'da', cec: 'cec' };
  const out = {};
  for (const layer of layers) {
    const nombre = layer.name;
    const val = layer.depths?.[0]?.values?.mean;
    if (val != null && val > 0 && val < 32000 && factores[nombre]) out[claves[nombre]] = val * factores[nombre];
  }
  if (Object.keys(out).length < 3) throw new Error('SoilGrids datos insuficientes');
  if (out.clay != null && out.sand != null && out.silt != null) out.textura = clasificarTextura(out.clay, out.sand, out.silt);
  out.fuente = 'SoilGrids REST API - ISRIC/Wageningen - 250 m - Datos reales via proxy';
  out.esFallback = false;
  return out;
}

async function openLandMap(lat, lon) {
  const url = `${OLM_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&coll=predicted250m&regex=sol_(phosphorus.extractable|potassium.exchangeable|zinc.extractable)&format=json`;
  const data = await fetchJson(url, 8000, { Accept: 'application/json', 'User-Agent': 'AgroMotor/1.0 soil proxy' });
  let props = {};
  if (data && data.properties) props = data.properties;
  else if (data && Array.isArray(data.features) && data.features.length > 0) props = data.features[0].properties || {};
  else if (data && typeof data === 'object' && !Array.isArray(data)) props = data;

  const out = {};
  const pKey = Object.keys(props).find((k) => k.toLowerCase().includes('phosphorus'));
  if (pKey != null && props[pKey] != null && props[pKey] > 0 && props[pKey] < 300) out.p = Number(props[pKey].toFixed(1));
  const kKey = Object.keys(props).find((k) => k.toLowerCase().includes('potassium'));
  if (kKey != null && props[kKey] != null && props[kKey] > 0 && props[kKey] < 20) out.k = Math.round(props[kKey] * 391);
  const znKey = Object.keys(props).find((k) => k.toLowerCase().includes('zinc'));
  if (znKey != null && props[znKey] != null && props[znKey] > 0 && props[znKey] < 30) out.zn = Number(props[znKey].toFixed(2));
  if (!Object.keys(out).length) throw new Error('OpenLandMap sin P/K/Zn');
  return {
    ...out,
    fuente_pkz: 'OpenLandMap - 250 m',
    fuente_pkz_id: 'openlandmap',
    fuente_pkz_det: 'OpenGeoHub predicted250m - P+K+Zn 0-5 cm via proxy - validar con analisis Bray local',
  };
}

function regionalPkz(textura, provincia) {
  const provKey = normProv(provincia);
  const provData = DB_PKZ_PROVINCIAL[provKey];
  if (provData) {
    return {
      ...provData,
      fuente_pkz: `DB provincial - ${provincia}`,
      fuente_pkz_id: 'db-prov',
      fuente_pkz_det: `Promedios provinciales Fertilizar/INTA - ${provincia} - calibrar con analisis local`,
    };
  }
  const tipo = textura && DB_PKZ_PAMPA[textura] ? textura : 'Molisol';
  return {
    ...DB_PKZ_PAMPA[tipo],
    fuente_pkz: 'DB regional - P/K/Zn tipicos',
    fuente_pkz_id: 'db',
    fuente_pkz_det: `DB interna - valores tipicos ${tipo} pampeano - requiere analisis de laboratorio`,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const provincia = String(req.query.provincia || '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'lat/lon invalidos' });
  }

  const warnings = [];
  let suelo;
  try {
    suelo = await soilgrids(lat, lon);
  } catch (e) {
    warnings.push(`soilgrids:${e instanceof Error ? e.message : String(e)}`);
    suelo = regionalSoil(lat, lon);
  }

  let pkz;
  try {
    pkz = await openLandMap(lat, lon);
  } catch (e) {
    warnings.push(`openlandmap:${e instanceof Error ? e.message : String(e)}`);
    pkz = regionalPkz(suelo.textura, provincia);
  }

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).json({
    fuente: 'agromotor_soil_proxy',
    ts: new Date().toISOString(),
    warnings,
    datos: { ...suelo, ...pkz },
  });
};
