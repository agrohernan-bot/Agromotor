const ONI_URL = 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';
const PERIODOS_ONI = ['DJF', 'JFM', 'FMA', 'MAM', 'AMJ', 'MJJ', 'JJA', 'JAS', 'ASO', 'SON', 'OND', 'NDJ'];

function parsearONI(texto) {
  const datos = [];
  for (const linea of texto.split('\n')) {
    const partes = linea.trim().split(/\s+/);
    if (partes.length < 4) continue;

    const periodo = partes[0];
    const anio = parseInt(partes[1], 10);
    const anom = parseFloat(partes.length >= 5 ? partes[4] : partes[3]);

    if (!PERIODOS_ONI.includes(periodo) || Number.isNaN(anio) || Number.isNaN(anom)) continue;
    datos.push({ periodo, anio, anom });
  }
  return datos;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  try {
    const upstream = await fetch(ONI_URL, {
      headers: { 'User-Agent': 'AgroMotor/1.0 ENSO proxy' },
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: `NOAA CPC HTTP ${upstream.status}` });
    }

    const texto = await upstream.text();
    const datos = parsearONI(texto);
    if (!datos.length) {
      return res.status(502).json({ error: 'NOAA CPC sin registros ONI parseables' });
    }

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ fuente: 'noaa_cpc_proxy', datos, ts: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : String(e) });
  }
};
