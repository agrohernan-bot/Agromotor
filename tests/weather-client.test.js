const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
global.AM_CONFIG = { weatherProxy: '/api/weather', weatherDirectFallback: true };
const weatherClient = require(path.join(ROOT, 'js/weather-client.js'));

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

test('cliente meteorologico conserva parametros y determina la fuente', () => {
  const direct = 'https://api.open-meteo.com/v1/forecast?latitude=-31.4000&longitude=-58.1000' +
    '&daily=precipitation_sum&daily=precipitation_probability_max&timezone=auto';
  const proxy = new URL(weatherClient.buildProxyUrl(direct), 'https://agromotor.app');

  assert.equal(proxy.pathname, '/api/weather');
  assert.equal(proxy.searchParams.get('endpoint'), 'forecast');
  assert.equal(proxy.searchParams.get('latitude'), '-31.4000');
  assert.deepEqual(proxy.searchParams.getAll('daily'), [
    'precipitation_sum',
    'precipitation_probability_max',
  ]);
  assert.equal(weatherClient.endpointForUrl('https://archive-api.open-meteo.com/v1/era5?latitude=-31&longitude=-58'), 'era5');
  assert.throws(
    () => weatherClient.buildProxyUrl('https://example.com/v1/forecast?latitude=-31&longitude=-58', 'forecast'),
    /Origen Open-Meteo no permitido/
  );
});

test('cliente usa proxy como ruta primaria', async () => {
  const calls = [];
  const data = await weatherClient.fetchJson(
    'https://api.open-meteo.com/v1/forecast?latitude=-31&longitude=-58&forecast_days=1',
    { fetchImpl: async (url) => { calls.push(url); return response(200, { source:'proxy' }); } }
  );

  assert.equal(data.source, 'proxy');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^\/api\/weather\?/);
});

test('fallback directo solo se habilita ante falla transitoria del proxy', async () => {
  const direct = 'https://api.open-meteo.com/v1/forecast?latitude=-31&longitude=-58&forecast_days=1';
  const transientCalls = [];
  const recovered = await weatherClient.fetchJson(direct, {
    fetchImpl: async (url) => {
      transientCalls.push(url);
      return transientCalls.length === 1 ? response(503, {}) : response(200, { source:'direct' });
    },
  });
  assert.equal(recovered.source, 'direct');
  assert.deepEqual(transientCalls, [weatherClient.buildProxyUrl(direct), direct]);

  const permanentCalls = [];
  await assert.rejects(
    weatherClient.fetchJson(direct, {
      fetchImpl: async (url) => { permanentCalls.push(url); return response(400, {}); },
    }),
    /weather proxy HTTP 400/
  );
  assert.equal(permanentCalls.length, 1);
});

test('fallback funcional de Siembra tambien pasa por el proxy', async () => {
  const primary = 'https://api.open-meteo.com/v1/forecast?latitude=-31&longitude=-58&start_date=2026-09-20';
  const fallback = 'https://api.open-meteo.com/v1/forecast?latitude=-31&longitude=-58&forecast_days=16';
  const calls = [];
  const data = await weatherClient.fetchJson(primary, {
    fallbackUrl: fallback,
    fetchImpl: async (url) => {
      calls.push(url);
      return calls.length === 1 ? response(400, {}) : response(200, { source:'proxy-fallback' });
    },
  });

  assert.equal(data.source, 'proxy-fallback');
  assert.deepEqual(calls, [weatherClient.buildProxyUrl(primary), weatherClient.buildProxyUrl(fallback)]);
});

test('Siembra, Fenologia, Balance hidrico y contexto meteorologico usan el cliente unico', () => {
  const files = ['js/siembra.js', 'js/fenologia.js', 'js/graficos-hidrico.js', 'js/dashboard-lotes.js'];
  files.forEach((relative) => {
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    assert.match(source, /amOpenMeteo\.fetchJson/, relative + ' debe usar el cliente compartido');
    assert.doesNotMatch(
      source,
      /fetch\s*\(\s*(?:`|'|")https:\/\/(?:api|archive-api)\.open-meteo\.com/,
      relative + ' no debe llamar Open-Meteo directamente'
    );
  });

  const app = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  assert.ok(app.indexOf('js/config.js') < app.indexOf('js/weather-client.js'));
  assert.ok(app.indexOf('js/weather-client.js') < app.indexOf('js/fenologia.js'));
});

test('Mapa satelital conserva el proxy NDVI y no agrega Open-Meteo directo', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/mapa-ndvi.js'), 'utf8');
  assert.match(source, /fetch\('\/api\/ndvi'/);
  assert.doesNotMatch(source, /https:\/\/(?:api|archive-api)\.open-meteo\.com/);
});
