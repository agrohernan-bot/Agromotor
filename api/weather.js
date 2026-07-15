const BASES = {
  forecast: 'https://api.open-meteo.com/v1/forecast',
  archive: 'https://archive-api.open-meteo.com/v1/archive',
  era5: 'https://archive-api.open-meteo.com/v1/era5',
};

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function buildUpstreamUrl(query) {
  const endpoint = String(firstValue(query.endpoint) || 'forecast').toLowerCase();
  const base = BASES[endpoint];
  if (!base) {
    const err = new Error('endpoint invalido');
    err.statusCode = 400;
    throw err;
  }

  const latitude = Number(firstValue(query.latitude || query.lat));
  const longitude = Number(firstValue(query.longitude || query.lon || query.lng));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    const err = new Error('lat/lon invalidos');
    err.statusCode = 400;
    throw err;
  }

  const params = new URLSearchParams();
  Object.keys(query || {}).sort().forEach((key) => {
    if (key === 'endpoint') return;
    const values = Array.isArray(query[key]) ? query[key] : [query[key]];
    values.forEach((value) => {
      if (value == null) return;
      params.append(key, String(value));
    });
  });

  const url = `${base}?${params.toString()}`;
  if (url.length > 7000) {
    const err = new Error('consulta demasiado larga');
    err.statusCode = 400;
    throw err;
  }
  return { url, endpoint };
}

function cacheHeader(endpoint) {
  if (endpoint === 'forecast') return 's-maxage=900, stale-while-revalidate=3600';
  return 's-maxage=86400, stale-while-revalidate=604800';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
  }

  let upstream;
  try {
    upstream = buildUpstreamUrl(req.query || {});
  } catch (e) {
    return res.status(e.statusCode || 400).json({ ok: false, error: e.message || String(e) });
  }

  try {
    const r = await fetch(upstream.url, {
      headers: { 'User-Agent': 'AgroMotor/1.0 weather proxy' },
    });
    const body = await r.text();
    const contentType = r.headers.get('content-type') || 'application/json; charset=utf-8';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', cacheHeader(upstream.endpoint));
    return res.status(r.status).send(body);
  } catch (e) {
    return res.status(502).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};

module.exports._buildUpstreamUrl = buildUpstreamUrl;
module.exports._cacheHeader = cacheHeader;
