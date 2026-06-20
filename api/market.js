const FOB_URL = 'https://monitorsiogranos.magyp.gob.ar/ws/ssma/precios_fob.php';
const DOLAR_URL = 'https://dolarapi.com/v1/dolares';
const BADLAR_URL = 'https://infra.datos.gob.ar/catalog/sspm/dataset/89/distribution/89.2/download/principales-tasas-interes-diarias.csv';
const PLAZO_FIJO_URL = 'https://infra.datos.gob.ar/catalog/sspm/dataset/89/distribution/89.1/download/principales-tasas-interes.csv';

async function fetchWithTimeout(url, ms, options = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      ...options,
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'AgroMotor/1.0 market proxy',
        ...(options.headers || {}),
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  } finally {
    clearTimeout(t);
  }
}

function fechaArg(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function getFob() {
  const hoy = new Date();
  const warnings = [];
  for (let i = 0; i < 7; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() - i);
    const f = fechaArg(fecha);
    try {
      const r = await fetchWithTimeout(`${FOB_URL}?Fecha=${encodeURIComponent(f)}`, 7000);
      const json = await r.json();
      if (Array.isArray(json) && json.length) {
        return { ok: true, fuente: 'magyp_fob_proxy', fecha: f, data: json, warnings };
      }
      warnings.push(`${f}:sin datos`);
    } catch (e) {
      warnings.push(`${f}:${e instanceof Error ? e.message : String(e)}`);
      if (String(e && e.name) === 'AbortError') break;
    }
  }
  return { ok: false, fuente: 'magyp_fob_proxy', error: 'FOB no disponible', warnings };
}

async function getUsd() {
  try {
    const r = await fetchWithTimeout(DOLAR_URL, 7000);
    const data = await r.json();
    if (!Array.isArray(data) || !data.length) throw new Error('respuesta vacia');
    return { ok: true, fuente: 'dolarapi_proxy', data };
  } catch (e) {
    return { ok: false, fuente: 'dolarapi_proxy', error: e instanceof Error ? e.message : String(e), data: [] };
  }
}

function parseBadlar(csv) {
  const lines = csv.trim().split('\n').filter((l) => l.trim());
  const header = lines[0].split(',');
  const badlarIdx = header.findIndex((h) => h.toLowerCase().includes('badlar'));
  const last = lines[lines.length - 1].split(',');
  const badlar = Number.parseFloat(last[badlarIdx]);
  if (!Number.isFinite(badlar)) throw new Error('BADLAR sin valor');
  return badlar;
}

function parsePlazoFijo(csv) {
  const lines = csv.trim().split('\n').filter((l) => l.trim());
  const header = lines[0].split(',');
  const pfIdx = header.findIndex((h) => h.toLowerCase().includes('plazo_fijo_30'));
  for (let i = lines.length - 1; i > 0; i--) {
    const cols = lines[i].split(',');
    const pfVal = Number.parseFloat(cols[pfIdx]);
    if (Number.isFinite(pfVal)) return { pfVal, pfFecha: cols[0] };
  }
  throw new Error('Plazo fijo sin valor');
}

async function getTasas() {
  const out = { ok: true, fuente: 'datos_gob_ar_proxy', warnings: [] };
  try {
    const r = await fetchWithTimeout(BADLAR_URL, 9000);
    out.badlar = parseBadlar(await r.text());
  } catch (e) {
    out.warnings.push(`badlar:${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const r = await fetchWithTimeout(PLAZO_FIJO_URL, 9000);
    Object.assign(out, parsePlazoFijo(await r.text()));
  } catch (e) {
    out.warnings.push(`plazo_fijo:${e instanceof Error ? e.message : String(e)}`);
  }
  if (out.badlar == null && out.pfVal == null) {
    out.ok = false;
    out.error = 'Tasas no disponibles';
  }
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
  }

  const type = String(req.query.type || '').toLowerCase();
  let payload;
  if (type === 'fob') payload = await getFob();
  else if (type === 'usd') payload = await getUsd();
  else if (type === 'tasas') payload = await getTasas();
  else return res.status(400).json({ ok: false, error: 'type invalido' });

  res.setHeader('Cache-Control', type === 'usd' ? 's-maxage=1800, stale-while-revalidate=7200' : 's-maxage=21600, stale-while-revalidate=86400');
  return res.status(200).json({ ...payload, ts: new Date().toISOString() });
};
