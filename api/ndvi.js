const crypto = require('node:crypto');

const AGRO_BASE = 'https://api.agromonitoring.com/agro/1.0';
const CDSE_TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const CDSE_STATS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';
const CDSE_PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process';
const EARTH_SEARCH_URL = 'https://earth-search.aws.element84.com/v1/search';
const MAX_COORDS = 5000;
const LOOKBACK_DAYS = 120;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function geometryFromBody(body) {
  const raw = body && (body.geojson || body.geometry);
  const geometry = raw && raw.type === 'Feature' ? raw.geometry : raw;
  if (!geometry || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates)) {
    throw httpError(400, 'Se requiere un poligono GeoJSON valido');
  }
  const rings = geometry.coordinates;
  if (!rings.length || !Array.isArray(rings[0]) || rings[0].length < 4) {
    throw httpError(400, 'El poligono debe tener al menos tres vertices y estar cerrado');
  }
  let count = 0;
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) throw httpError(400, 'Anillo GeoJSON invalido');
    for (const point of ring) {
      count += 1;
      if (count > MAX_COORDS) throw httpError(413, 'El poligono tiene demasiados vertices');
      if (!Array.isArray(point) || point.length < 2) throw httpError(400, 'Coordenada GeoJSON invalida');
      const lon = Number(point[0]);
      const lat = Number(point[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
        throw httpError(400, 'Coordenada fuera de rango');
      }
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (Number(first[0]) !== Number(last[0]) || Number(first[1]) !== Number(last[1])) {
      throw httpError(400, 'El poligono GeoJSON debe estar cerrado');
    }
  }
  return { type: 'Polygon', coordinates: rings };
}

function bboxOf(geometry) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const ring of geometry.coordinates) {
    for (const point of ring) {
      west = Math.min(west, Number(point[0]));
      south = Math.min(south, Number(point[1]));
      east = Math.max(east, Number(point[0]));
      north = Math.max(north, Number(point[1]));
    }
  }
  return [west, south, east, north];
}

function dateRange(days = LOOKBACK_DAYS) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  return {
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sceneQuality(clouds, coverage) {
  if (coverage != null && coverage < 70) return 'insuficiente';
  if (clouds != null && clouds > 20) return 'insuficiente';
  if ((clouds == null || clouds <= 5) && (coverage == null || coverage >= 90)) return 'alta';
  return 'media';
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = ((yi > point[1]) !== (yj > point[1]))
      && (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, rings) {
  if (!rings.length || !pointInRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i += 1) {
    if (pointInRing(point, rings[i])) return false;
  }
  return true;
}

function dataUri(buffer, contentType) {
  if (!buffer || buffer.length > 2_500_000) return null;
  return `data:${contentType || 'image/png'};base64,${buffer.toString('base64')}`;
}

function normalizeAgroRecord(record) {
  const stats = record && record.data ? record.data : {};
  return {
    timestamp: Number(record.dt),
    fecha: new Date(Number(record.dt) * 1000).toISOString(),
    satelite: record.source || record.type || 'Satelite',
    nubesPct: finiteNumber(record.cl),
    coberturaPct: finiteNumber(record.dc),
    mean: finiteNumber(stats.mean),
    median: finiteNumber(stats.median),
    std: finiteNumber(stats.std),
    min: finiteNumber(stats.min),
    max: finiteNumber(stats.max),
    p25: finiteNumber(stats.p25),
    p75: finiteNumber(stats.p75),
    pixeles: finiteNumber(stats.num),
  };
}

async function ensureAgroPolygon(apiKey, geometry) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(geometry)).digest('hex').slice(0, 20);
  const name = `agromotor_${hash}`;
  const listResponse = await fetchWithTimeout(`${AGRO_BASE}/polygons?appid=${encodeURIComponent(apiKey)}`);
  const polygons = await listResponse.json();
  const existing = Array.isArray(polygons) ? polygons.find((polygon) => polygon && polygon.name === name) : null;
  if (existing && existing.id) return existing.id;

  const createResponse = await fetchWithTimeout(`${AGRO_BASE}/polygons?appid=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      geo_json: { type: 'Feature', properties: {}, geometry },
    }),
  });
  const created = await createResponse.json();
  if (!created || !created.id) throw new Error('Agromonitoring no devolvio ID de poligono');
  return created.id;
}

async function fetchAgroImage(apiKey, polygonId, sceneTimestamp) {
  const start = sceneTimestamp - 43200;
  const end = sceneTimestamp + 129600;
  const searchUrl = `${AGRO_BASE}/image/search?polyid=${encodeURIComponent(polygonId)}&start=${start}&end=${end}&appid=${encodeURIComponent(apiKey)}`;
  const response = await fetchWithTimeout(searchUrl);
  const scenes = await response.json();
  if (!Array.isArray(scenes) || !scenes.length) return null;
  scenes.sort((a, b) => Math.abs(Number(a.dt) - sceneTimestamp) - Math.abs(Number(b.dt) - sceneTimestamp));
  const url = scenes[0] && scenes[0].image && scenes[0].image.ndvi;
  if (!url) return null;
  const imageResponse = await fetchWithTimeout(String(url).replace(/^http:/, 'https:'), {}, 22000);
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  return dataUri(buffer, imageResponse.headers.get('content-type') || 'image/png');
}

async function analyzeAgromonitoring(geometry) {
  const apiKey = process.env.AGROMONITORING_API_KEY;
  if (!apiKey) throw new Error('AGROMONITORING_API_KEY no configurada');
  const polygonId = await ensureAgroPolygon(apiKey, geometry);
  const range = dateRange();
  const params = new URLSearchParams({
    polyid: polygonId,
    start: String(range.startUnix),
    end: String(range.endUnix),
    clouds_max: '20',
    coverage_min: '70',
    appid: apiKey,
  });
  const response = await fetchWithTimeout(`${AGRO_BASE}/ndvi/history?${params.toString()}`);
  const raw = await response.json();
  const history = (Array.isArray(raw) ? raw : [])
    .map(normalizeAgroRecord)
    .filter((item) => item.timestamp > 0 && item.mean != null && item.mean >= -1 && item.mean <= 1)
    .filter((item) => (item.nubesPct == null || item.nubesPct <= 20) && (item.coberturaPct == null || item.coberturaPct >= 70))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!history.length) throw new Error('Agromonitoring no encontro escenas con calidad suficiente');

  const latest = history[history.length - 1];
  const previous = history.length > 1 ? history[history.length - 2] : null;
  const overlay = await fetchAgroImage(apiKey, polygonId, latest.timestamp).catch(() => null);
  return {
    ok: true,
    proveedor: 'Agromonitoring',
    producto: 'NDVI observado',
    escena: {
      fecha: latest.fecha,
      satelite: latest.satelite,
      nubesPct: latest.nubesPct,
      coberturaPct: latest.coberturaPct,
      calidad: sceneQuality(latest.nubesPct, latest.coberturaPct),
    },
    estadisticas: {
      mean: latest.mean,
      median: latest.median,
      std: latest.std,
      min: latest.min,
      max: latest.max,
      p25: latest.p25,
      p75: latest.p75,
      pixeles: latest.pixeles,
      cvPct: latest.mean && latest.std != null ? Math.abs(latest.std / latest.mean) * 100 : null,
      delta: previous ? latest.mean - previous.mean : null,
    },
    historial: history.slice(-18).map((item) => ({
      fecha: item.fecha,
      mean: item.mean,
      nubesPct: item.nubesPct,
      coberturaPct: item.coberturaPct,
      satelite: item.satelite,
    })),
    imagenNdvi: overlay,
    bbox: bboxOf(geometry),
  };
}

async function copernicusToken() {
  const clientId = process.env.CDSE_CLIENT_ID;
  const clientSecret = process.env.CDSE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Credenciales Copernicus no configuradas');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetchWithTimeout(CDSE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await response.json();
  if (!json.access_token) throw new Error('Copernicus no devolvio token');
  return json.access_token;
}

const CDSE_STATS_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function isValid(s) {
  return s.dataMask === 1 && ![0, 1, 3, 7, 8, 9, 10, 11].includes(s.SCL);
}
function evaluatePixel(s) {
  var valid = isValid(s);
  var denom = s.B08 + s.B04;
  return { ndvi: [valid && denom !== 0 ? (s.B08 - s.B04) / denom : 0], dataMask: [valid ? 1 : 0] };
}`;

const CDSE_IMAGE_EVALSCRIPT = `//VERSION=3
function setup() {
  return { input: ["B04", "B08", "SCL", "dataMask"], output: { bands: 4, sampleType: "AUTO" } };
}
function evaluatePixel(s) {
  var valid = s.dataMask === 1 && ![0, 1, 3, 7, 8, 9, 10, 11].includes(s.SCL);
  if (!valid || (s.B08 + s.B04) === 0) return [0, 0, 0, 0];
  var v = (s.B08 - s.B04) / (s.B08 + s.B04);
  var c = v > 0.75 ? [0.10,0.59,0.25] : v > 0.65 ? [0.40,0.74,0.39] : v > 0.55 ? [0.85,0.94,0.55] : v > 0.45 ? [1.00,0.88,0.55] : v > 0.30 ? [0.96,0.43,0.26] : [0.84,0.19,0.15];
  return [c[0], c[1], c[2], 0.78];
}`;

function cdseStatsRequest(geometry, range) {
  return {
    input: {
      bounds: {
        geometry,
        properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' },
      },
      data: [{
        type: 'sentinel-2-l2a',
        dataFilter: { maxCloudCoverage: 30, mosaickingOrder: 'leastCC' },
      }],
    },
    aggregation: {
      timeRange: { from: range.startIso, to: range.endIso },
      aggregationInterval: { of: 'P5D' },
      resx: 10,
      resy: 10,
      evalscript: CDSE_STATS_EVALSCRIPT,
    },
    calculations: {
      ndvi: {
        statistics: {
          default: { percentiles: { k: [25, 50, 75] } },
        },
      },
    },
  };
}

function parseCdseIntervals(payload) {
  const rows = Array.isArray(payload && payload.data) ? payload.data : [];
  return rows.map((row) => {
    const band = row && row.outputs && row.outputs.ndvi && row.outputs.ndvi.bands
      ? (row.outputs.ndvi.bands.B0 || row.outputs.ndvi.bands.ndvi || Object.values(row.outputs.ndvi.bands)[0])
      : null;
    const stats = band && band.stats ? band.stats : null;
    if (!stats) return null;
    const sampleCount = finiteNumber(stats.sampleCount);
    const noDataCount = finiteNumber(stats.noDataCount);
    const validPct = sampleCount && noDataCount != null ? Math.max(0, (sampleCount - noDataCount) / sampleCount * 100) : null;
    return {
      fecha: row.interval && row.interval.from,
      hasta: row.interval && row.interval.to,
      mean: finiteNumber(stats.mean),
      min: finiteNumber(stats.min),
      max: finiteNumber(stats.max),
      std: finiteNumber(stats.stDev),
      p25: finiteNumber(stats.percentiles && (stats.percentiles['25.0'] ?? stats.percentiles['25'])),
      median: finiteNumber(stats.percentiles && (stats.percentiles['50.0'] ?? stats.percentiles['50'])),
      p75: finiteNumber(stats.percentiles && (stats.percentiles['75.0'] ?? stats.percentiles['75'])),
      coberturaPct: validPct,
      sampleCount,
    };
  }).filter((row) => row && row.fecha && row.mean != null && row.mean >= -1 && row.mean <= 1 && (row.coberturaPct == null || row.coberturaPct >= 55));
}

async function fetchCopernicusImage(token, geometry, from, to) {
  const response = await fetchWithTimeout(CDSE_PROCESS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'image/png' },
    body: JSON.stringify({
      input: {
        bounds: {
          geometry,
          properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' },
        },
        data: [{
          type: 'sentinel-2-l2a',
          dataFilter: {
            timeRange: { from, to },
            maxCloudCoverage: 30,
            mosaickingOrder: 'leastCC',
          },
        }],
      },
      output: {
        width: 512,
        height: 512,
        responses: [{ identifier: 'default', format: { type: 'image/png' } }],
      },
      evalscript: CDSE_IMAGE_EVALSCRIPT,
    }),
  }, 25000);
  return dataUri(Buffer.from(await response.arrayBuffer()), 'image/png');
}

async function analyzeCopernicus(geometry) {
  const token = await copernicusToken();
  const range = dateRange();
  const statsResponse = await fetchWithTimeout(CDSE_STATS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cdseStatsRequest(geometry, range)),
  }, 25000);
  const intervals = parseCdseIntervals(await statsResponse.json()).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  if (!intervals.length) throw new Error('Copernicus no encontro escenas con pixeles validos');
  const latest = intervals[intervals.length - 1];
  const previous = intervals.length > 1 ? intervals[intervals.length - 2] : null;
  const overlay = await fetchCopernicusImage(token, geometry, latest.fecha, latest.hasta).catch(() => null);
  return {
    ok: true,
    proveedor: 'Copernicus Data Space',
    producto: 'Sentinel-2 L2A · NDVI observado',
    escena: {
      fecha: latest.fecha,
      fechaHasta: latest.hasta,
      satelite: 'Sentinel-2 L2A',
      nubesPct: null,
      coberturaPct: latest.coberturaPct,
      calidad: sceneQuality(null, latest.coberturaPct),
    },
    estadisticas: {
      mean: latest.mean,
      median: latest.median,
      std: latest.std,
      min: latest.min,
      max: latest.max,
      p25: latest.p25,
      p75: latest.p75,
      pixeles: latest.sampleCount,
      cvPct: latest.mean && latest.std != null ? Math.abs(latest.std / latest.mean) * 100 : null,
      delta: previous ? latest.mean - previous.mean : null,
    },
    historial: intervals.slice(-18).map((item) => ({
      fecha: item.fecha,
      mean: item.mean,
      nubesPct: null,
      coberturaPct: item.coberturaPct,
      satelite: 'Sentinel-2 L2A',
    })),
    imagenNdvi: overlay,
    bbox: bboxOf(geometry),
  };
}

function earthSearchBody(geometry) {
  const range = dateRange();
  return {
    collections: ['sentinel-2-c1-l2a'],
    intersects: geometry,
    datetime: `${range.startIso}/${range.endIso}`,
    limit: 12,
    sortby: [{ field: 'properties.datetime', direction: 'desc' }],
    query: { 'eo:cloud_cover': { lte: 30 } },
  };
}

function epsgFromItem(item) {
  const raw = item && item.properties && (item.properties['proj:epsg'] || item.properties['proj:code']);
  const match = String(raw || '').match(/(\d{5})$/);
  return match ? Number(match[1]) : null;
}

function utmDefinition(epsg) {
  if (epsg >= 32601 && epsg <= 32660) return `+proj=utm +zone=${epsg - 32600} +datum=WGS84 +units=m +no_defs`;
  if (epsg >= 32701 && epsg <= 32760) return `+proj=utm +zone=${epsg - 32700} +south +datum=WGS84 +units=m +no_defs`;
  throw new Error(`Proyeccion Sentinel no soportada: EPSG:${epsg || '?'}`);
}

function assetTransform(asset) {
  const transform = asset && asset['proj:transform'];
  if (!Array.isArray(transform) || transform.length < 6) throw new Error('Asset Sentinel sin transformacion espacial');
  return {
    pixelX: Number(transform[0]),
    pixelY: Number(transform[4]),
    originX: Number(transform[2]),
    originY: Number(transform[5]),
  };
}

function projectedRings(geometry, project) {
  return geometry.coordinates.map((ring) => ring.map((point) => project.forward([Number(point[0]), Number(point[1])])));
}

function pixelWindow(rings, transform, width, height) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const point of ring) {
      const px = (point[0] - transform.originX) / transform.pixelX;
      const py = (point[1] - transform.originY) / transform.pixelY;
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }
  const x0 = Math.max(0, Math.floor(minX) - 1);
  const y0 = Math.max(0, Math.floor(minY) - 1);
  const x1 = Math.min(width, Math.ceil(maxX) + 1);
  const y1 = Math.min(height, Math.ceil(maxY) + 1);
  if (x1 <= x0 || y1 <= y0) throw new Error('El lote queda fuera de la escena Sentinel');
  if ((x1 - x0) * (y1 - y0) > 1_500_000) throw new Error('El lote excede el tamaño máximo de procesamiento NDVI');
  return [x0, y0, x1, y1];
}

function reflectance(raw, asset) {
  const raster = asset && Array.isArray(asset['raster:bands']) ? asset['raster:bands'][0] : null;
  const scale = raster && Number.isFinite(Number(raster.scale)) ? Number(raster.scale) : 0.0001;
  const offset = raster && Number.isFinite(Number(raster.offset)) ? Number(raster.offset) : 0;
  return Number(raw) * scale + offset;
}

function ndviRgb(value) {
  if (value > 0.75) return [26, 150, 65];
  if (value > 0.65) return [102, 189, 99];
  if (value > 0.55) return [217, 239, 139];
  if (value > 0.45) return [254, 224, 139];
  if (value > 0.30) return [244, 109, 67];
  return [215, 48, 39];
}

function summarizeValues(values) {
  if (!values.length) throw new Error('La escena no contiene pixeles NDVI validos dentro del lote');
  values.sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  const mean = sum / values.length;
  const variance = values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length;
  const percentile = (fraction) => values[Math.min(values.length - 1, Math.max(0, Math.round((values.length - 1) * fraction)))];
  return {
    mean,
    median: percentile(0.5),
    std: Math.sqrt(variance),
    min: values[0],
    max: values[values.length - 1],
    p25: percentile(0.25),
    p75: percentile(0.75),
    pixeles: values.length,
    cvPct: mean ? Math.abs(Math.sqrt(variance) / mean) * 100 : null,
  };
}

async function readEarthSearchScene(item, geometry, includeImage) {
  const [{ fromUrl }, proj4Module, pngModule] = await Promise.all([
    import('geotiff'),
    import('proj4'),
    includeImage ? import('pngjs') : Promise.resolve(null),
  ]);
  const proj4 = proj4Module.default || proj4Module;
  const PNG = pngModule ? (pngModule.PNG || (pngModule.default && pngModule.default.PNG)) : null;
  const redAsset = item.assets && item.assets.red;
  const nirAsset = item.assets && item.assets.nir;
  const sclAsset = item.assets && item.assets.scl;
  if (!redAsset || !nirAsset || !sclAsset) throw new Error('Escena Sentinel sin bandas red/nir/SCL');
  const epsg = epsgFromItem(item);
  const project = proj4('EPSG:4326', utmDefinition(epsg));
  const rings = projectedRings(geometry, project);

  const [redTiff, nirTiff, sclTiff] = await Promise.all([
    fromUrl(redAsset.href),
    fromUrl(nirAsset.href),
    fromUrl(sclAsset.href),
  ]);
  const [redImage, nirImage, sclImage] = await Promise.all([
    redTiff.getImage(),
    nirTiff.getImage(),
    sclTiff.getImage(),
  ]);
  const redTransform = assetTransform(redAsset);
  const sclTransform = assetTransform(sclAsset);
  const redWindow = pixelWindow(rings, redTransform, redImage.getWidth(), redImage.getHeight());
  const sclWindow = pixelWindow(rings, sclTransform, sclImage.getWidth(), sclImage.getHeight());
  const [redRaster, nirRaster, sclRaster] = await Promise.all([
    redImage.readRasters({ window: redWindow, interleave: true }),
    nirImage.readRasters({ window: redWindow, interleave: true }),
    sclImage.readRasters({ window: sclWindow, interleave: true }),
  ]);

  const width = redWindow[2] - redWindow[0];
  const height = redWindow[3] - redWindow[1];
  const sclWidth = sclWindow[2] - sclWindow[0];
  const values = [];
  const samples = [];
  let insideCount = 0;
  let cloudCount = 0;
  const png = includeImage && PNG ? new PNG({ width, height, colorType: 6 }) : null;
  const sampleStride = Math.max(1, Math.ceil(Math.sqrt((width * height) / 1400)));
  const invalidScl = new Set([0, 1, 3, 7, 8, 9, 10, 11]);
  const cloudScl = new Set([3, 8, 9, 10]);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const projected = [
        redTransform.originX + (redWindow[0] + x + 0.5) * redTransform.pixelX,
        redTransform.originY + (redWindow[1] + y + 0.5) * redTransform.pixelY,
      ];
      if (!pointInPolygon(projected, rings)) continue;
      insideCount += 1;
      const sclXGlobal = Math.floor((projected[0] - sclTransform.originX) / sclTransform.pixelX);
      const sclYGlobal = Math.floor((projected[1] - sclTransform.originY) / sclTransform.pixelY);
      const sclX = sclXGlobal - sclWindow[0];
      const sclY = sclYGlobal - sclWindow[1];
      if (sclX < 0 || sclY < 0 || sclX >= sclWidth || sclY >= (sclWindow[3] - sclWindow[1])) continue;
      const scl = Number(sclRaster[sclY * sclWidth + sclX]);
      if (cloudScl.has(scl)) cloudCount += 1;
      const pixelIndex = y * width + x;
      if (invalidScl.has(scl) || !redRaster[pixelIndex] || !nirRaster[pixelIndex]) continue;
      const red = reflectance(redRaster[pixelIndex], redAsset);
      const nir = reflectance(nirRaster[pixelIndex], nirAsset);
      const denominator = nir + red;
      if (!Number.isFinite(denominator) || denominator <= 0) continue;
      const value = (nir - red) / denominator;
      if (!Number.isFinite(value) || value < -1 || value > 1) continue;
      values.push(value);
      if (x % sampleStride === 0 && y % sampleStride === 0) {
        const lonLat = project.inverse(projected);
        samples.push({
          lon: Number(lonLat[0].toFixed(7)),
          lat: Number(lonLat[1].toFixed(7)),
          ndvi: Number(value.toFixed(5)),
        });
      }
      if (png) {
        const color = ndviRgb(value);
        const offset = pixelIndex * 4;
        png.data[offset] = color[0];
        png.data[offset + 1] = color[1];
        png.data[offset + 2] = color[2];
        png.data[offset + 3] = 205;
      }
    }
  }

  const stats = summarizeValues(values);
  const coverage = insideCount ? values.length / insideCount * 100 : 0;
  const clouds = insideCount ? cloudCount / insideCount * 100 : null;
  const image = png ? dataUri(PNG.sync.write(png), 'image/png') : null;
  return {
    stats,
    coverage,
    clouds,
    image,
    samples,
    fecha: item.properties.datetime,
    satelite: item.properties.platform || item.properties.constellation || 'Sentinel-2',
  };
}

async function searchEarthScenes(geometry) {
  const response = await fetchWithTimeout(EARTH_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'AgroMotor/1.0 NDVI' },
    body: JSON.stringify(earthSearchBody(geometry)),
  });
  const payload = await response.json();
  const features = Array.isArray(payload.features) ? payload.features : [];
  return features.filter((item) => item && item.assets && item.assets.red && item.assets.nir && item.assets.scl);
}

async function analyzeEarthSearch(geometry) {
  const items = await searchEarthScenes(geometry);
  if (!items.length) throw new Error('Earth Search no encontro escenas Sentinel-2 recientes');
  const readings = [];
  for (let i = 0; i < Math.min(items.length, 5) && readings.length < 2; i += 1) {
    try {
      const reading = await readEarthSearchScene(items[i], geometry, readings.length === 0);
      if (reading.coverage >= 55) readings.push(reading);
    } catch (_) {
      // Probar la siguiente escena cuando una tesela no cubre el lote o no tiene pixeles utiles.
    }
  }
  if (!readings.length) throw new Error('Earth Search no encontro una escena con cobertura util');
  const latest = readings[0];
  const previous = readings.length > 1 ? readings[1] : null;
  return {
    ok: true,
    proveedor: 'Earth Search · AWS Open Data',
    producto: 'Sentinel-2 L2A · NDVI observado',
    escena: {
      fecha: latest.fecha,
      satelite: latest.satelite,
      nubesPct: latest.clouds,
      coberturaPct: latest.coverage,
      calidad: sceneQuality(latest.clouds, latest.coverage),
    },
    estadisticas: {
      ...latest.stats,
      delta: previous ? latest.stats.mean - previous.stats.mean : null,
    },
    historial: readings.slice().reverse().map((reading) => ({
      fecha: reading.fecha,
      mean: reading.stats.mean,
      nubesPct: reading.clouds,
      coberturaPct: reading.coverage,
      satelite: reading.satelite,
    })),
    imagenNdvi: latest.image,
    muestras: latest.samples,
    resolucionMetros: 10,
    bbox: bboxOf(geometry),
  };
}

async function analyzeNdvi(geometry, options = {}) {
  const attempts = [];
  // Las prescripciones requieren valores espaciales numéricos, no una imagen
  // coloreada ni un promedio de lote. Earth Search permite leer las bandas
  // Sentinel-2 L2A y devolver muestras NDVI observadas dentro del polígono.
  if (options.includeSpatial) {
    try {
      const result = await analyzeEarthSearch(geometry);
      if (!Array.isArray(result.muestras) || result.muestras.length < 12) {
        throw new Error('La escena no contiene suficientes muestras espaciales');
      }
      result.intentos = attempts;
      return result;
    } catch (error) {
      attempts.push({ proveedor: 'Earth Search · AWS Open Data', error: error instanceof Error ? error.message : String(error) });
      throw Object.assign(new Error('No hay una escena espacial real apta para prescripción'), { attempts });
    }
  }
  try {
    const result = await analyzeAgromonitoring(geometry);
    result.intentos = attempts;
    return result;
  } catch (error) {
    attempts.push({ proveedor: 'Agromonitoring', error: error instanceof Error ? error.message : String(error) });
  }
  try {
    const result = await analyzeCopernicus(geometry);
    result.intentos = attempts;
    return result;
  } catch (error) {
    attempts.push({ proveedor: 'Copernicus Data Space', error: error instanceof Error ? error.message : String(error) });
  }
  try {
    const result = await analyzeEarthSearch(geometry);
    result.intentos = attempts;
    return result;
  } catch (error) {
    attempts.push({ proveedor: 'Earth Search · AWS Open Data', error: error instanceof Error ? error.message : String(error) });
  }
  return {
    ok: false,
    codigo: 'NDVI_NO_DISPONIBLE',
    mensaje: 'No hay una escena NDVI real con calidad suficiente disponible en este momento.',
    intentos: attempts,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
  }
  try {
    const body = req.body || {};
    const geometry = geometryFromBody(body);
    const result = await analyzeNdvi(geometry, { includeSpatial: body.includeSpatial === true });
    res.setHeader('Cache-Control', result.ok ? 's-maxage=1800, stale-while-revalidate=7200' : 'no-store');
    return res.status(result.ok ? 200 : 503).json(result);
  } catch (error) {
    const status = error && error.status ? error.status : 500;
    return res.status(status).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      intentos: error && Array.isArray(error.attempts) ? error.attempts : undefined,
    });
  }
};

module.exports._test = {
  geometryFromBody,
  bboxOf,
  normalizeAgroRecord,
  parseCdseIntervals,
  sceneQuality,
  pointInPolygon,
  summarizeValues,
};
