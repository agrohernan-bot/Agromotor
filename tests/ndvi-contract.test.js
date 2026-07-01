const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ndviApi = require(path.join(ROOT, 'api', 'ndvi.js'))._test;

const POLYGON = {
  type: 'Polygon',
  coordinates: [[
    [-61.61, -32.76],
    [-61.60, -32.76],
    [-61.60, -32.75],
    [-61.61, -32.75],
    [-61.61, -32.76],
  ]],
};

test('NDVI API valida poligono y calcula bbox lon/lat', () => {
  const geometry = ndviApi.geometryFromBody({ geojson: { type: 'Feature', properties: {}, geometry: POLYGON } });
  assert.deepEqual(geometry, POLYGON);
  assert.deepEqual(ndviApi.bboxOf(geometry), [-61.61, -32.76, -61.60, -32.75]);
  assert.throws(
    () => ndviApi.geometryFromBody({ geometry: { type: 'Point', coordinates: [-61, -32] } }),
    /poligono GeoJSON/i,
  );
});

test('Agromonitoring conserva metadatos de escena y estadisticas reales', () => {
  const item = ndviApi.normalizeAgroRecord({
    dt: 1782864000,
    source: 's2',
    cl: 2.5,
    dc: 96,
    data: { mean: 0.42, median: 0.40, std: 0.08, min: 0.1, max: 0.71, p25: 0.33, p75: 0.51, num: 900 },
  });
  assert.equal(item.satelite, 's2');
  assert.equal(item.mean, 0.42);
  assert.equal(item.nubesPct, 2.5);
  assert.equal(item.coberturaPct, 96);
  assert.equal(item.pixeles, 900);
});

test('Copernicus excluye intervalos sin cobertura util y preserva percentiles', () => {
  const parsed = ndviApi.parseCdseIntervals({
    data: [
      {
        interval: { from: '2026-06-20T00:00:00Z', to: '2026-06-25T00:00:00Z' },
        outputs: { ndvi: { bands: { B0: { stats: {
          mean: 0.51, min: 0.2, max: 0.8, stDev: 0.1,
          sampleCount: 100, noDataCount: 20,
          percentiles: { '25.0': 0.4, '50.0': 0.52, '75.0': 0.61 },
        } } } } },
      },
      {
        interval: { from: '2026-06-25T00:00:00Z', to: '2026-06-30T00:00:00Z' },
        outputs: { ndvi: { bands: { B0: { stats: {
          mean: 0.9, sampleCount: 100, noDataCount: 90,
        } } } } },
      },
    ],
  });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].coberturaPct, 80);
  assert.equal(parsed[0].median, 0.52);
});

test('calidad de escena responde a nubes y cobertura', () => {
  assert.equal(ndviApi.sceneQuality(2, 98), 'alta');
  assert.equal(ndviApi.sceneQuality(12, 82), 'media');
  assert.equal(ndviApi.sceneQuality(25, 95), 'insuficiente');
  assert.equal(ndviApi.sceneQuality(2, 60), 'insuficiente');
});

test('fallback Earth Search recorta pixeles al poligono y resume valores observados', () => {
  assert.equal(ndviApi.pointInPolygon([-61.605, -32.755], POLYGON.coordinates), true);
  assert.equal(ndviApi.pointInPolygon([-61.7, -32.755], POLYGON.coordinates), false);
  const stats = ndviApi.summarizeValues([0.2, 0.4, 0.6, 0.8]);
  assert.equal(stats.mean, 0.5);
  assert.equal(stats.pixeles, 4);
  assert.ok(stats.std > 0);
});

test('modulo visible no usa NDVI sintetico ni clave publica', () => {
  const visible = fs.readFileSync(path.join(ROOT, 'js', 'mapa-ndvi.js'), 'utf8');
  const legacy = fs.readFileSync(path.join(ROOT, 'js', 'mapa.js'), 'utf8');
  const config = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
  assert.doesNotMatch(visible, /satNoise|GenerarNDVI|proxy con fenologia|Math\.sin/);
  assert.doesNotMatch(legacy, /data\s*=\s*satGenerarNDVIModelado/);
  assert.doesNotMatch(config, /agromonitoringKey|[a-f0-9]{32}/i);
  assert.match(visible, /No se generó ningún valor estimado/);
  assert.match(visible, /ndviSeguimiento/);
  assert.match(fs.readFileSync(path.join(ROOT, 'api', 'ndvi.js'), 'utf8'), /Earth Search · AWS Open Data/);
});
