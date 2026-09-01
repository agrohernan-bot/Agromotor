// AGROMOTOR — Cliente Open-Meteo compartido
// Enruta las consultas por /api/weather y conserva un fallback directo controlado.

(function (root) {
  'use strict';

  var OPEN_METEO_ORIGINS = {
    'https://api.open-meteo.com': true,
    'https://archive-api.open-meteo.com': true,
  };

  function endpointForUrl(directUrl) {
    var parsed = new URL(directUrl);
    if (!OPEN_METEO_ORIGINS[parsed.origin]) throw new Error('Origen Open-Meteo no permitido');
    if (parsed.origin === 'https://api.open-meteo.com' && parsed.pathname === '/v1/forecast') return 'forecast';
    if (parsed.origin === 'https://archive-api.open-meteo.com' && parsed.pathname === '/v1/archive') return 'archive';
    if (parsed.origin === 'https://archive-api.open-meteo.com' && parsed.pathname === '/v1/era5') return 'era5';
    throw new Error('Endpoint Open-Meteo no permitido');
  }

  function buildProxyUrl(directUrl, endpoint, proxyBase) {
    var parsed = new URL(directUrl);
    var inferredEndpoint = endpointForUrl(directUrl);
    var resolvedEndpoint = endpoint || inferredEndpoint;
    if (resolvedEndpoint !== inferredEndpoint) throw new Error('Endpoint Open-Meteo inconsistente');
    var base = proxyBase || (root.AM_CONFIG && root.AM_CONFIG.weatherProxy);
    if (!base) return null;
    var params = new URLSearchParams(parsed.search);
    params.set('endpoint', resolvedEndpoint);
    return base + (String(base).indexOf('?') >= 0 ? '&' : '?') + params.toString();
  }

  function responseError(response, label) {
    var error = new Error(label + ' HTTP ' + response.status);
    error.status = response.status;
    return error;
  }

  function isTransientProxyFailure(error) {
    if (!error) return true;
    if (error.name === 'AbortError') return false;
    if (!Number.isFinite(error.status)) return true;
    return error.status === 404 || error.status === 408 || error.status === 425 ||
      error.status === 429 || error.status >= 500;
  }

  async function readJson(fetchImpl, url, requestOptions, label) {
    var response = await fetchImpl(url, requestOptions);
    if (!response.ok) throw responseError(response, label);
    return response.json();
  }

  async function fetchOne(directUrl, options) {
    options = options || {};
    var endpoint = options.endpoint || endpointForUrl(directUrl);
    var proxyUrl = buildProxyUrl(directUrl, endpoint, options.proxyBase);
    var fetchImpl = options.fetchImpl || (root.fetch && root.fetch.bind(root));
    if (!fetchImpl) throw new Error('Fetch no disponible');

    var requestOptions = {};
    if (options.signal) requestOptions.signal = options.signal;
    if (options.cache) requestOptions.cache = options.cache;
    if (options.headers) requestOptions.headers = options.headers;

    var configAllowsDirect = root.AM_CONFIG && root.AM_CONFIG.weatherDirectFallback === true;
    var allowDirect = options.allowDirectFallback === undefined
      ? configAllowsDirect
      : options.allowDirectFallback === true;

    if (!proxyUrl) {
      if (!allowDirect) throw new Error('Proxy meteorologico no configurado');
      return readJson(fetchImpl, directUrl, requestOptions, 'Open-Meteo');
    }

    try {
      return await readJson(fetchImpl, proxyUrl, requestOptions, 'AgroMotor weather proxy');
    } catch (error) {
      if (!allowDirect || !isTransientProxyFailure(error)) throw error;
      if (root.console && typeof root.console.warn === 'function') {
        root.console.warn('[AgroMotor clima] Proxy no disponible; usando fallback directo controlado.');
      }
      return readJson(fetchImpl, directUrl, requestOptions, 'Open-Meteo');
    }
  }

  async function fetchJson(directUrl, options) {
    options = options || {};
    try {
      return await fetchOne(directUrl, options);
    } catch (primaryError) {
      if (!options.fallbackUrl || primaryError.name === 'AbortError') throw primaryError;
      var fallbackOptions = Object.assign({}, options);
      delete fallbackOptions.fallbackUrl;
      try {
        return await fetchOne(options.fallbackUrl, fallbackOptions);
      } catch (fallbackError) {
        throw fallbackError || primaryError;
      }
    }
  }

  root.amOpenMeteo = {
    buildProxyUrl: buildProxyUrl,
    endpointForUrl: endpointForUrl,
    fetchJson: fetchJson,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.amOpenMeteo;
})(typeof window !== 'undefined' ? window : globalThis);
