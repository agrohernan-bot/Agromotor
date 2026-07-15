const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const weather = require(path.join(ROOT, 'api/weather.js'));

test('weather proxy arma forecast conservando parametros Open-Meteo', () => {
  const built = weather._buildUpstreamUrl({
    latitude: '-31.4000',
    longitude: '-58.1000',
    current: 'temperature_2m,soil_moisture_3_to_9cm',
    daily: 'precipitation_probability_max',
    forecast_days: '1',
    timezone: 'auto',
  });

  assert.equal(built.endpoint, 'forecast');
  assert.match(built.url, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
  assert.match(built.url, /latitude=-31\.4000/);
  assert.match(built.url, /longitude=-58\.1000/);
  assert.match(built.url, /forecast_days=1/);
  assert.match(built.url, /current=temperature_2m%2Csoil_moisture_3_to_9cm/);
});

test('weather proxy permite archive y rechaza endpoints no permitidos', () => {
  const built = weather._buildUpstreamUrl({
    endpoint: 'archive',
    latitude: '-31.4',
    longitude: '-58.1',
    start_date: '2026-07-01',
    end_date: '2026-07-10',
    daily: 'precipitation_sum',
  });

  assert.equal(built.endpoint, 'archive');
  assert.match(built.url, /^https:\/\/archive-api\.open-meteo\.com\/v1\/archive\?/);

  assert.throws(
    () => weather._buildUpstreamUrl({ endpoint: 'bad', latitude: '-31.4', longitude: '-58.1' }),
    /endpoint invalido/
  );
});

test('weather proxy valida coordenadas y cache segun endpoint', () => {
  assert.throws(
    () => weather._buildUpstreamUrl({ latitude: '-131.4', longitude: '-58.1' }),
    /lat\/lon invalidos/
  );
  assert.match(weather._cacheHeader('forecast'), /s-maxage=900/);
  assert.match(weather._cacheHeader('archive'), /s-maxage=86400/);
});
