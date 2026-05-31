(function() {
/**
 * fenologia.js — AGROMOTOR v2.0
 *
 * Calcula el calendario fenológico del cultivo y los coeficientes Kc (FAO-56)
 * para cada etapa de desarrollo.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  MODO PLANIFICACIÓN  → NASA POWER (histórico climático) │
 * │                         + ajuste ENSO de precipitación  │
 * │  MODO SEGUIMIENTO    → OpenMeteo ERA5 / forecast         │
 * └─────────────────────────────────────────────────────────┘
 *
 * Cultivos soportados: "soja", "maiz", "trigo", "girasol"
 *
 * Metodología:
 *   - Acumulación de GDD (Growing Degree Days) día a día desde siembra
 *   - Hitos fenológicos definidos por umbral de GDD × cultivo
 *   - Kc interpolado linealmente entre etapas (FAO-56, Tabla 12)
 *   - Temperatura base y techo por cultivo
 *   - Ajuste ENSO de precipitación solo en modo Planificación
 *
 * Uso típico:
 *   const cal = await calcularFenologia({
 *     cultivo: "soja",
 *     fechaSiembra: "2024-11-01",
 *     lat: -33.0, lon: -61.0,
 *     duracionDias: 140           // opcional; si no, hasta madurez GDD
 *   });
 *   // cal.etapas → array de etapas con { nombre, fechaInicio, Kc, gdd }
 *   // cal.kcPorDia → Float64Array, un Kc por día desde siembra
 *   // cal.lluviaPorDia → Float64Array ajustada ENSO (planificación)
 */

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCIAS (si están en el bundle, se usan; si no, se obtienen de window)
// ─────────────────────────────────────────────────────────────────────────────

function _getModoSwitch() {
  if (typeof require !== "undefined") {
    try { return require("./modo-switch.js"); } catch (_) {}
  }
  if (typeof window !== "undefined" && window.ModoSwitch) return window.ModoSwitch;
  return { esPlanificacion: () => true, esSeguimiento: () => false };
}

function _getEnso() {
  if (typeof require !== "undefined") {
    try { return require("./enso.js"); } catch (_) {}
  }
  if (typeof window !== "undefined" && window.ENSO) return window.ENSO;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const NASA_POWER_BASE = "https://power.larc.nasa.gov/api/temporal/daily/point";
const OPENMETEO_FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const OPENMETEO_ARCHIVE_BASE  = "https://archive-api.open-meteo.com/v1/era5";

/** Días hacia atrás desde hoy para considerar "histórico" en OpenMeteo */
const OPENMETEO_ARCHIVE_LAG_DIAS = 7;

// ─────────────────────────────────────────────────────────────────────────────
// DEFINICIÓN DE CULTIVOS
// ─────────────────────────────────────────────────────────────────────────────
//
// Cada cultivo define:
//   tBase    : temperatura base GDD (°C)
//   tCeiling : temperatura techo GDD (°C) — limita el efecto de calor excesivo
//   etapas   : array de hitos fenológicos ordenados por GDD acumulado
//              { id, nombre, gdd, kcIni, kcFin, esCritica }
//              - kcIni: Kc al inicio de la etapa
//              - kcFin: Kc al final de la etapa (interpola lineal)
//              - esCritica: true si el estrés hídrico aquí es especialmente dañino
//
// Fuentes: FAO-56 (Allen et al., 1998), INTA Marcos Juárez, CIMMYT
// ─────────────────────────────────────────────────────────────────────────────

const CULTIVOS = {

  // ── SOJA ──────────────────────────────────────────────────────────────────
  // GDD base 10°C, techo 30°C (FAO-56 tabla 12 + bibliografía INTA)
  soja: {
    tBase:    10,
    tCeiling: 30,
    etapas: [
      { id: "siembra",    nombre: "Siembra",               gdd:    0, kcIni: 0.20, kcFin: 0.20, esCritica: false },
      { id: "vE",         nombre: "Emergencia (VE)",        gdd:   80, kcIni: 0.30, kcFin: 0.40, esCritica: false },
      { id: "v1v4",       nombre: "Vegetativo V1-V4",       gdd:  200, kcIni: 0.40, kcFin: 0.75, esCritica: false },
      { id: "v5R1",       nombre: "Vegetativo V5-R1",       gdd:  550, kcIni: 0.75, kcFin: 1.05, esCritica: false },
      { id: "r1",         nombre: "Floración R1",           gdd:  750, kcIni: 1.05, kcFin: 1.15, esCritica: true  },
      { id: "r3r4",       nombre: "Formación vainas R3-R4", gdd:  950, kcIni: 1.15, kcFin: 1.15, esCritica: true  },
      { id: "r5",         nombre: "Llenado de granos R5",   gdd: 1200, kcIni: 1.15, kcFin: 0.95, esCritica: true  },
      { id: "r6",         nombre: "Madurez fisiológica R6", gdd: 1450, kcIni: 0.95, kcFin: 0.70, esCritica: false },
      { id: "r7r8",       nombre: "Madurez cosecha R7-R8",  gdd: 1650, kcIni: 0.70, kcFin: 0.25, esCritica: false },
      { id: "madurez",    nombre: "Cosecha",                gdd: 1800, kcIni: 0.25, kcFin: 0.25, esCritica: false },
    ],
  },

  // ── MAÍZ ──────────────────────────────────────────────────────────────────
  // GDD base 10°C, techo 30°C
  maiz: {
    tBase:    10,
    tCeiling: 30,
    etapas: [
      { id: "siembra",    nombre: "Siembra",               gdd:    0, kcIni: 0.20, kcFin: 0.20, esCritica: false },
      { id: "vE",         nombre: "Emergencia (VE)",        gdd:   80, kcIni: 0.30, kcFin: 0.40, esCritica: false },
      { id: "v1v5",       nombre: "Vegetativo V1-V5",       gdd:  200, kcIni: 0.40, kcFin: 0.80, esCritica: false },
      { id: "v6v10",      nombre: "Vegetativo V6-V10",      gdd:  450, kcIni: 0.80, kcFin: 1.05, esCritica: false },
      { id: "vt",         nombre: "Floración (VT)",         gdd:  800, kcIni: 1.05, kcFin: 1.20, esCritica: true  },
      { id: "r1",         nombre: "Silking (R1)",           gdd:  900, kcIni: 1.20, kcFin: 1.20, esCritica: true  },
      { id: "r2r3",       nombre: "Grano lechoso (R2-R3)",  gdd: 1100, kcIni: 1.20, kcFin: 1.10, esCritica: true  },
      { id: "r4r5",       nombre: "Grano pastoso (R4-R5)",  gdd: 1350, kcIni: 1.10, kcFin: 0.70, esCritica: false },
      { id: "r6",         nombre: "Madurez fisiológica",    gdd: 1600, kcIni: 0.70, kcFin: 0.40, esCritica: false },
      { id: "madurez",    nombre: "Cosecha",                gdd: 1750, kcIni: 0.40, kcFin: 0.40, esCritica: false },
    ],
  },

  // ── TRIGO ─────────────────────────────────────────────────────────────────
  // GDD base 0°C (vernalización), techo 26°C
  trigo: {
    tBase:    0,
    tCeiling: 26,
    etapas: [
      { id: "siembra",    nombre: "Siembra",               gdd:    0, kcIni: 0.20, kcFin: 0.20, esCritica: false },
      { id: "emergencia", nombre: "Emergencia",             gdd:   80, kcIni: 0.30, kcFin: 0.40, esCritica: false },
      { id: "macollaje",  nombre: "Macollaje",              gdd:  300, kcIni: 0.40, kcFin: 0.70, esCritica: false },
      { id: "encanazon",  nombre: "Encañazón",              gdd:  600, kcIni: 0.70, kcFin: 1.05, esCritica: false },
      { id: "espigazon",  nombre: "Espigazón",              gdd:  900, kcIni: 1.05, kcFin: 1.15, esCritica: true  },
      { id: "antesis",    nombre: "Antesis (floración)",    gdd: 1000, kcIni: 1.15, kcFin: 1.15, esCritica: true  },
      { id: "llenado",    nombre: "Llenado de granos",      gdd: 1200, kcIni: 1.15, kcFin: 0.75, esCritica: true  },
      { id: "madGrano",   nombre: "Madurez de cosecha",     gdd: 1500, kcIni: 0.75, kcFin: 0.30, esCritica: false },
      { id: "madurez",    nombre: "Cosecha",                gdd: 1650, kcIni: 0.30, kcFin: 0.30, esCritica: false },
    ],
  },

  // ── GIRASOL ───────────────────────────────────────────────────────────────
  // GDD base 6°C, techo 30°C
  girasol: {
    tBase:    6,
    tCeiling: 30,
    etapas: [
      { id: "siembra",    nombre: "Siembra",               gdd:    0, kcIni: 0.20, kcFin: 0.20, esCritica: false },
      { id: "emergencia", nombre: "Emergencia (V0)",        gdd:   60, kcIni: 0.30, kcFin: 0.40, esCritica: false },
      { id: "v1v4",       nombre: "Vegetativo V1-V4",       gdd:  200, kcIni: 0.40, kcFin: 0.70, esCritica: false },
      { id: "boton",      nombre: "Botón floral (R1)",      gdd:  500, kcIni: 0.70, kcFin: 1.05, esCritica: false },
      { id: "floracion",  nombre: "Floración (R5-R6)",      gdd:  700, kcIni: 1.05, kcFin: 1.15, esCritica: true  },
      { id: "llenado",    nombre: "Llenado de granos (R7)", gdd:  900, kcIni: 1.15, kcFin: 0.85, esCritica: true  },
      { id: "madFisio",   nombre: "Madurez fisiológica (R9)",gdd:1150, kcIni: 0.85, kcFin: 0.50, esCritica: false },
      { id: "madurez",    nombre: "Cosecha",                gdd: 1300, kcIni: 0.50, kcFin: 0.50, esCritica: false },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES DE FECHA
// ─────────────────────────────────────────────────────────────────────────────

function _parseDate(s) {
  // Acepta "YYYY-MM-DD" o Date
  if (s instanceof Date) return new Date(s);
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function _formatNASA(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function _formatISO(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function _addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function _addYears(date, n) {
  const d = new Date(date);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return d;
}

function _dayOfYear(date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  return Math.floor((date - start) / 86400000);
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULO DE GDD DIARIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GDD para un día usando el método de media-simple con techo.
 * @param {number} tmax
 * @param {number} tmin
 * @param {number} tBase
 * @param {number} tCeiling
 * @returns {number}
 */
function calcularGDD(tmax, tmin, tBase, tCeiling) {
  const tmaxAjust = Math.min(tmax, tCeiling);
  const tminAjust = Math.min(tmin, tCeiling);
  const tmean = (tmaxAjust + tminAjust) / 2;
  return Math.max(0, tmean - tBase);
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERPOLACIÓN DE Kc
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kc interpolado linealmente según GDD acumulado y la definición de etapas.
 * @param {number}   gddAcum   GDD acumulado hasta este día
 * @param {Object[]} etapas    Array de etapas del cultivo
 * @returns {number}           Kc interpolado
 */
function kcParaGDD(gddAcum, etapas) {
  // Antes de la primera etapa
  if (gddAcum <= etapas[0].gdd) return etapas[0].kcIni;

  for (let i = 1; i < etapas.length; i++) {
    const prev = etapas[i - 1];
    const curr = etapas[i];
    if (gddAcum <= curr.gdd) {
      const ratio = (gddAcum - prev.gdd) / (curr.gdd - prev.gdd);
      return prev.kcFin + ratio * (curr.kcIni - prev.kcFin);
    }
  }
  // Después de la última etapa
  return etapas[etapas.length - 1].kcFin;
}

/**
 * ID de etapa correspondiente al GDD acumulado.
 * @param {number}   gddAcum
 * @param {Object[]} etapas
 * @returns {string}
 */
function etapaParaGDD(gddAcum, etapas) {
  for (let i = etapas.length - 1; i >= 0; i--) {
    if (gddAcum >= etapas[i].gdd) return etapas[i].id;
  }
  return etapas[0].id;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUENTES DE DATOS — PLANIFICACIÓN (NASA POWER)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Descarga temperatura y precipitación histórica de NASA POWER.
 * @param {number} lat
 * @param {number} lon
 * @param {Date}   fechaInicio
 * @param {Date}   fechaFin
 * @returns {Promise<{ fecha:string, tmax:number, tmin:number, precip:number }[]>}
 */
async function fetchNASAPower(lat, lon, fechaInicio, fechaFin) {
  const params = new URLSearchParams({
    parameters:  "T2M_MAX,T2M_MIN,PRECTOTCORR",
    community:   "AG",
    longitude:   String(lon),
    latitude:    String(lat),
    start:       _formatNASA(fechaInicio),
    end:         _formatNASA(fechaFin),
    format:      "JSON",
  });

  const url = `${NASA_POWER_BASE}?${params}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });

  if (!resp.ok) {
    throw new Error(`NASA POWER HTTP ${resp.status}: ${resp.statusText}`);
  }

  const json = await resp.json();
  const tmaxRaw  = json.properties?.parameter?.T2M_MAX  ?? {};
  const tminRaw  = json.properties?.parameter?.T2M_MIN  ?? {};
  const precipRaw = json.properties?.parameter?.PRECTOTCORR ?? {};

  const dias = Object.keys(tmaxRaw).filter(k => k !== "20150101" && tmaxRaw[k] !== -999);
  return dias.map(k => ({
    fecha: `${k.slice(0,4)}-${k.slice(4,6)}-${k.slice(6,8)}`,
    tmax:  tmaxRaw[k]  === -999 ? 25 : tmaxRaw[k],
    tmin:  tminRaw[k]  === -999 ? 15 : tminRaw[k],
    precip: precipRaw[k] === -999 ?  0 : precipRaw[k],
  })).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ─────────────────────────────────────────────────────────────────────────────
// FUENTES DE DATOS — SEGUIMIENTO (OpenMeteo)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Descarga temperatura y precipitación de OpenMeteo.
 * Usa ERA5 para fechas pasadas y forecast para fechas futuras.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {Date}   fechaInicio
 * @param {Date}   fechaFin
 * @returns {Promise<{ fecha:string, tmax:number, tmin:number, precip:number }[]>}
 */
async function fetchOpenMeteo(lat, lon, fechaInicio, fechaFin) {
  const hoy       = new Date();
  const limiteArch = _addDays(hoy, -OPENMETEO_ARCHIVE_LAG_DIAS);
  const limiteForecast = _addDays(hoy, 16);

  const resultados = [];

  // Segmento histórico (ERA5)
  if (fechaInicio < limiteArch) {
    const finArch = fechaFin < limiteArch ? fechaFin : limiteArch;
    const datos = await _fetchOpenMeteoSegmento(
      OPENMETEO_ARCHIVE_BASE, lat, lon, fechaInicio, finArch
    );
    resultados.push(...datos);
  }

  // Segmento reciente / futuro (forecast)
  if (fechaFin >= limiteArch) {
    const iniForec = fechaInicio > limiteArch ? fechaInicio : limiteArch;
    const finForec = fechaFin > limiteForecast ? limiteForecast : fechaFin;
    if (iniForec > finForec) return resultados.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const datos = await _fetchOpenMeteoSegmento(
      OPENMETEO_FORECAST_BASE, lat, lon, iniForec, finForec
    );
    // Evitar duplicados por solapamiento
    const existentes = new Set(resultados.map(r => r.fecha));
    resultados.push(...datos.filter(r => !existentes.has(r.fecha)));
  }

  return resultados.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

async function _fetchOpenMeteoSegmento(baseUrl, lat, lon, fechaIni, fechaFin) {
  const paramsObj = {
    latitude:    String(lat),
    longitude:   String(lon),
    daily:       "temperature_2m_max,temperature_2m_min,precipitation_sum",
    timezone:    "America/Argentina/Buenos_Aires"
  };

  if (baseUrl === OPENMETEO_FORECAST_BASE) {
    const hoy = new Date();
    const pastDays = Math.max(0, Math.min(7, Math.ceil((hoy - fechaIni) / 86400000)));
    const futureDays = Math.max(1, Math.min(16, Math.ceil((fechaFin - hoy) / 86400000) + 1));
    if (pastDays > 0) paramsObj.past_days = String(pastDays);
    paramsObj.forecast_days = String(futureDays);
  } else {
    paramsObj.start_date = _formatISO(fechaIni);
    paramsObj.end_date = _formatISO(fechaFin);
  }

  const params = new URLSearchParams(paramsObj);

  const url = `${baseUrl}?${params}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(20000) });

  if (!resp.ok) {
    throw new Error(`OpenMeteo HTTP ${resp.status} (${baseUrl})`);
  }

  const json = await resp.json();
  const dates  = json.daily?.time ?? [];
  const tmaxArr = json.daily?.temperature_2m_max ?? [];
  const tminArr = json.daily?.temperature_2m_min ?? [];
  const pArr    = json.daily?.precipitation_sum  ?? [];

  return dates.map((fecha, i) => ({
    fecha,
    tmax:  tmaxArr[i] ?? 25,
    tmin:  tminArr[i] ?? 15,
    precip: pArr[i]    ??  0,
  })).filter(d => d.fecha >= _formatISO(fechaIni) && d.fecha <= _formatISO(fechaFin));
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el calendario fenológico completo para un cultivo.
 *
 * @param {Object}  opts
 * @param {string}  opts.cultivo         "soja"|"maiz"|"trigo"|"girasol"
 * @param {string}  opts.fechaSiembra    "YYYY-MM-DD"
 * @param {number}  opts.lat             Latitud decimal (negativo = Sur)
 * @param {number}  opts.lon             Longitud decimal
 * @param {number}  [opts.duracionDias]  Máx días a calcular (default: hasta madurez GDD)
 * @param {string}  [opts.modo]          "planificacion"|"seguimiento" (default: getModo())
 * @param {string}  [opts.faseENSO]      Forzar fase ENSO ("niño"|"niña"|"neutro")
 * @param {boolean} [opts.verbose]       Si true, incluye dailyLog en resultado
 *
 * @returns {Promise<CalendarioFenologico>}
 *
 * @typedef {Object} CalendarioFenologico
 * @property {string}   cultivo
 * @property {string}   fechaSiembra
 * @property {string}   modo          "planificacion"|"seguimiento"
 * @property {string}   faseENSO      Fase ENSO aplicada
 * @property {number}   factorENSO    Factor de ajuste precipitación (p.ej. 1.18)
 * @property {number}   gddTotal      GDD acumulado hasta el último día calculado
 * @property {number}   dias          Cantidad de días calculados
 * @property {string}   fechaFin      Fecha del último día calculado (ISO)
 * @property {EtapaSummary[]} etapas  Resumen de etapas alcanzadas
 * @property {number[]} kcPorDia      Kc por día (índice 0 = día de siembra)
 * @property {number[]} gddPorDia     GDD diario (no acumulado)
 * @property {number[]} gddAcumPorDia GDD acumulado por día
 * @property {number[]} lluviaPorDia  Precipitación diaria (mm), ajustada ENSO si planif.
 * @property {number[]} tmaxPorDia    Tmax diaria (°C)
 * @property {number[]} tminPorDia    Tmin diaria (°C)
 * @property {string[]} fechasPorDia  Fechas ISO de cada día
 * @property {string[]} etapaPorDia   ID de etapa para cada día
 * @property {boolean}  llegaMadurez  true si alcanzó el GDD de cosecha
 * @property {string}   [advertencia] Advertencias (ENSO fallback, datos incompletos, etc.)
 * @property {Object}   [fuentes]     { clima: "nasa_power"|"openmeteo", enso: "noaa_cpc"|"cache"|"fallback" }
 *
 * @typedef {Object} EtapaSummary
 * @property {string}  id
 * @property {string}  nombre
 * @property {string}  fechaInicio
 * @property {number}  gddAlcanzado
 * @property {number}  diasDesideSiembra
 * @property {number}  kcMedio
 * @property {boolean} esCritica
 */
async function calcularFenologia(opts) {
  const {
    cultivo,
    fechaSiembra,
    lat,
    lon,
    duracionDias,
    verbose = false,
  } = opts;

  // ── Validar cultivo ──────────────────────────────────────────────────────
  const defCultivo = CULTIVOS[cultivo];
  if (!defCultivo) {
    throw new Error(
      `Cultivo desconocido: "${cultivo}". Usar: ${Object.keys(CULTIVOS).join(", ")}`
    );
  }

  // ── Modo activo ──────────────────────────────────────────────────────────
  const MS   = _getModoSwitch();
  const modo = opts.modo ?? (MS.esPlanificacion() ? "planificacion" : "seguimiento");
  const esPlan = modo === "planificacion";

  // ── Determinar rango de fechas ───────────────────────────────────────────
  const siembra = _parseDate(fechaSiembra);
  const gddMaxCultivo = defCultivo.etapas[defCultivo.etapas.length - 1].gdd;
  // Estimación conservadora de días necesarios (GDD máximo / GDD promedio diario ~12)
  const diasEst = duracionDias ?? Math.ceil(gddMaxCultivo / 12) + 10;
  const fechaFin = _addDays(siembra, diasEst - 1);

  // ── Obtener datos climáticos ─────────────────────────────────────────────
  let diasClima;
  let fuenteClima;
  let advertencias = [];

  if (esPlan) {
    // Planificación: NASA POWER histórico promedio
    // Se usa el año de siembra; si la fecha fin cae en año siguiente, se pide hasta dic 31
    // y se completa con el mismo período del año siguiente si hace falta.
    diasClima   = await _obtenerClimaHistoricoNASA(lat, lon, siembra, fechaFin);
    fuenteClima = "nasa_power";
  } else {
    // Seguimiento: OpenMeteo (ERA5 + forecast)
    diasClima   = await fetchOpenMeteo(lat, lon, siembra, fechaFin);
    fuenteClima = "openmeteo";
  }

  if (diasClima.length === 0) {
    // API sin datos (período futuro o servicio inaccesible). El loop de simulación
    // usa valores por defecto (tmax=25, tmin=15, precip=0) para cada día faltante.
    advertencias.push("Sin datos climáticos de API; se usaron valores climatológicos por defecto.");
    fuenteClima = "fallback";
  }

  // ── ENSO (solo planificación) ────────────────────────────────────────────
  let faseENSO   = opts.faseENSO ?? "neutro";
  let factorENSO = 1.0;
  let fuenteENSO = "manual";

  if (esPlan && !opts.faseENSO) {
    const ENSO = _getEnso();
    if (ENSO) {
      try {
        const mesObj = siembra.getUTCMonth() + 1;
        const anioObj = siembra.getUTCFullYear();
        const resultadoENSO = await ENSO.getFaseENSO(anioObj, mesObj);
        faseENSO   = resultadoENSO.fase;
        factorENSO = 1 + resultadoENSO.factorAjuste;
        fuenteENSO = resultadoENSO.fuente;
        if (resultadoENSO.advertencia) advertencias.push(resultadoENSO.advertencia);
      } catch (e) {
        advertencias.push(`ENSO no disponible (${e.message}), usando fase neutro.`);
        faseENSO   = "neutro";
        factorENSO = 1.0;
        fuenteENSO = "fallback";
      }
    } else {
      advertencias.push("Módulo ENSO no cargado; sin ajuste de precipitación.");
    }
  } else if (esPlan && opts.faseENSO) {
    // Fase forzada por el caller
    const ajustes = { niño: 0.18, niña: -0.18, neutro: 0.0 };
    factorENSO = 1 + (ajustes[opts.faseENSO] ?? 0);
    fuenteENSO = "manual";
  }

  // ── Simulación día a día ─────────────────────────────────────────────────
  const fechasPorDia    = [];
  const tmaxPorDia      = [];
  const tminPorDia      = [];
  const lluviaPorDia    = [];
  const gddPorDia       = [];
  const gddAcumPorDia   = [];
  const kcPorDia        = [];
  const etapaPorDia     = [];

  let gddAcum = 0;
  let llegaMadurez = false;

  // Mapa por fecha para lookup O(1)
  const climaMap = Object.create(null);
  for (const d of diasClima) climaMap[d.fecha] = d;

  const { tBase, tCeiling, etapas } = defCultivo;
  const gddMadurez = etapas[etapas.length - 1].gdd;

  for (let i = 0; i < diasEst; i++) {
    const fechaDia = _addDays(siembra, i);
    const isoFecha = _formatISO(fechaDia);
    const cli = climaMap[isoFecha] ?? { tmax: 25, tmin: 15, precip: 0 };

    const gddDia  = calcularGDD(cli.tmax, cli.tmin, tBase, tCeiling);
    gddAcum      += gddDia;

    const kcDia   = kcParaGDD(gddAcum, etapas);
    const etapaDia = etapaParaGDD(gddAcum, etapas);

    // Ajuste ENSO de precipitación (solo planificación)
    const precipDia = esPlan
      ? Math.max(0, cli.precip * factorENSO)
      : cli.precip;

    fechasPorDia.push(isoFecha);
    tmaxPorDia.push(cli.tmax);
    tminPorDia.push(cli.tmin);
    lluviaPorDia.push(precipDia);
    gddPorDia.push(gddDia);
    gddAcumPorDia.push(gddAcum);
    kcPorDia.push(kcDia);
    etapaPorDia.push(etapaDia);

    if (gddAcum >= gddMadurez) {
      llegaMadurez = true;
      if (!duracionDias) break;  // Cortar si no se forzó duración
    }
  }

  // ── Construir resumen de etapas ──────────────────────────────────────────
  const etapasSummary = _construirResumenEtapas(
    etapas, gddAcumPorDia, kcPorDia, fechasPorDia, etapaPorDia
  );

  // ── Resultado final ──────────────────────────────────────────────────────
  const resultado = {
    cultivo,
    fechaSiembra:  _formatISO(siembra),
    modo,
    faseENSO,
    factorENSO,
    gddTotal:      gddAcum,
    dias:          fechasPorDia.length,
    fechaFin:      fechasPorDia[fechasPorDia.length - 1] ?? _formatISO(siembra),
    etapas:        etapasSummary,
    kcPorDia,
    gddPorDia,
    gddAcumPorDia,
    lluviaPorDia,
    tmaxPorDia,
    tminPorDia,
    fechasPorDia,
    etapaPorDia,
    llegaMadurez,
    fuentes: { clima: fuenteClima, enso: fuenteENSO },
  };

  if (advertencias.length > 0) {
    resultado.advertencia = advertencias.join(" | ");
  }

  // Guardar en localStorage para que hidrico.js lo consuma
  _persistirResultado(resultado);

  return resultado;
}

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER CLIMA HISTÓRICO NASA POWER (con manejo de año cruzado)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene datos de NASA POWER histórico.
 * Si el período incluye fechas futuras (NASA POWER tiene lag ~5 días), usa el mismo
 * período del año anterior como referencia climática histórica y re-etiqueta las fechas.
 * Si el período cruza un año calendario, realiza dos llamadas.
 * @private
 */
async function _obtenerClimaHistoricoNASA(lat, lon, fechaInicio, fechaFin) {
  const NASA_LAG_DIAS = 5;
  const limiteDisponible = _addDays(new Date(), -NASA_LAG_DIAS);

  // Si fechaFin está más allá de los datos disponibles, trabajar sobre el año anterior
  let iniReq    = fechaInicio;
  let finReq    = fechaFin;
  let yearShift = 0;

  if (fechaFin > limiteDisponible) {
    yearShift = 1;
    iniReq    = _addYears(fechaInicio, -1);
    finReq    = _addYears(fechaFin,    -1);
  }

  const anioIni = iniReq.getUTCFullYear();
  const anioFin = finReq.getUTCFullYear();

  let datos;
  if (anioIni === anioFin) {
    datos = await fetchNASAPower(lat, lon, iniReq, finReq);
  } else {
    // Año cruzado: split en 31 dic del año de siembra
    const finAnioUno = _parseDate(`${anioIni}-12-31`);
    const iniAnioDos = _parseDate(`${anioFin}-01-01`);
    const [parte1, parte2] = await Promise.all([
      fetchNASAPower(lat, lon, iniReq,     finAnioUno),
      fetchNASAPower(lat, lon, iniAnioDos, finReq),
    ]);
    datos = [...parte1, ...parte2];
  }

  // Re-etiquetar fechas al año real si se usó el año anterior como referencia
  if (yearShift > 0) {
    datos = datos.map(d => ({
      ...d,
      fecha: _formatISO(_addYears(_parseDate(d.fecha), yearShift)),
    }));
  }

  return datos;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTRUCCIÓN DE RESUMEN DE ETAPAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @private
 */
function _construirResumenEtapas(etapasDef, gddAcum, kcs, fechas, etapaIdsPorDia) {
  const summary = [];
  const alcanzadas = new Set();

  for (let i = 0; i < fechas.length; i++) {
    const etId = etapaIdsPorDia[i];
    if (alcanzadas.has(etId)) continue;
    alcanzadas.add(etId);

    const defEt = etapasDef.find(e => e.id === etId);
    if (!defEt) continue;

    // Calcular Kc medio de la etapa (hasta que cambie)
    let kcSum = 0, kcN = 0;
    for (let j = i; j < fechas.length && etapaIdsPorDia[j] === etId; j++) {
      kcSum += kcs[j]; kcN++;
    }

    summary.push({
      id:               defEt.id,
      nombre:           defEt.nombre,
      fechaInicio:      fechas[i],
      gddAlcanzado:     gddAcum[i],
      diasDesdeSiembra: i,
      kcMedio:          kcN > 0 ? Math.round((kcSum / kcN) * 1000) / 1000 : defEt.kcIni,
      esCritica:        defEt.esCritica,
    });
  }

  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// HUMEDAD DE SUELO — Open-Meteo (modo Seguimiento)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Descarga datos de humedad de suelo de Open-Meteo (ERA5 / forecast).
 * Agrega los datos horarios en medias diarias.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {Date}   fechaInicio
 * @param {Date}   fechaFin
 * @returns {Promise<{ fecha:string, sm_0_7:number|null, sm_7_28:number|null, sm_28_100:number|null }[]>}
 */
async function omHumedadSuelo(lat, lon, fechaInicio, fechaFin) {
  const hoy        = new Date();
  const limiteArch = _addDays(hoy, -OPENMETEO_ARCHIVE_LAG_DIAS);
  const baseUrl    = fechaFin < limiteArch ? OPENMETEO_ARCHIVE_BASE : OPENMETEO_FORECAST_BASE;

  const params = new URLSearchParams({
    latitude:   String(lat),
    longitude:  String(lon),
    hourly:     "soil_moisture_0_to_7cm,soil_moisture_7_to_28cm,soil_moisture_28_to_100cm",
    timezone:   "America/Argentina/Buenos_Aires",
    start_date: _formatISO(fechaInicio),
    end_date:   _formatISO(fechaFin),
  });

  const resp = await fetch(`${baseUrl}?${params}`, { signal: AbortSignal.timeout(20000) });
  if (!resp.ok) throw new Error(`OpenMeteo humedad suelo HTTP ${resp.status}`);

  const json  = await resp.json();
  const times = json.hourly?.time ?? [];
  const sm0   = json.hourly?.soil_moisture_0_to_7cm    ?? [];
  const sm1   = json.hourly?.soil_moisture_7_to_28cm   ?? [];
  const sm2   = json.hourly?.soil_moisture_28_to_100cm ?? [];

  // Agregar horas → medias diarias
  const diarios = Object.create(null);
  for (let i = 0; i < times.length; i++) {
    const fecha = times[i].slice(0, 10);
    if (!diarios[fecha]) diarios[fecha] = { sm0: [], sm1: [], sm2: [] };
    if (sm0[i] != null) diarios[fecha].sm0.push(sm0[i]);
    if (sm1[i] != null) diarios[fecha].sm1.push(sm1[i]);
    if (sm2[i] != null) diarios[fecha].sm2.push(sm2[i]);
  }

  const _media = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return Object.entries(diarios)
    .map(([fecha, v]) => ({
      fecha,
      sm_0_7:    _media(v.sm0),
      sm_7_28:   _media(v.sm1),
      sm_28_100: _media(v.sm2),
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Convierte humedad volumétrica Open-Meteo (m³/m³) a mm de agua aprovechable.
 * Usa CC y PMP estimados por textura (Saxton & Rawls referencia INTA).
 *
 * @param {number} smM3M3        Humedad volumétrica (m³/m³)
 * @param {number} profundidadCm Profundidad de la capa (cm)
 * @param {string} [textura]     Textura del suelo ("franco", "arcillosa", etc.)
 * @returns {number}             mm de agua aprovechable en esa capa
 */
function omSmAAgua(smM3M3, profundidadCm, textura) {
  const TEX = {
    "arenosa":           { cc: 0.18, pmp: 0.06 },
    "franco-arenosa":    { cc: 0.24, pmp: 0.10 },
    "franca":            { cc: 0.35, pmp: 0.14 },
    "franco":            { cc: 0.35, pmp: 0.14 },
    "franco-limosa":     { cc: 0.38, pmp: 0.16 },
    "limosa":            { cc: 0.42, pmp: 0.18 },
    "franco-arcillosa":  { cc: 0.40, pmp: 0.20 },
    "arcillo-limosa":    { cc: 0.44, pmp: 0.23 },
    "arcillosa":         { cc: 0.45, pmp: 0.22 },
    "molisol":           { cc: 0.37, pmp: 0.16 },
    "vertisol":          { cc: 0.43, pmp: 0.21 },
  };

  const key = (textura || "franca")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");
  const t = TEX[key] || TEX["franca"];

  const smDisp = Math.max(0, Math.min(t.cc, smM3M3) - t.pmp);
  return Math.max(0, smDisp * profundidadCm * 10);  // mm
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCIA EN localStorage
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY_FEN_ACTIVO   = "am_fenologia_activo";
const LS_KEY_FEN_KC_HOY   = "am_fen_kc_hoy";
const LS_KEY_FEN_ETAPA_HOY = "am_fen_etapa_hoy";
const LS_KEY_FEN_GDD_ACUM = "am_fen_gdd_acum";

/**
 * Persiste el resultado de fenología en localStorage para que hidrico.js
 * y otros módulos accedan al Kc actual sin recomputar.
 * También sincroniza el DOM del módulo hídrico si está en la página.
 * @private
 */
function _persistirResultado(res) {
  try {
    // Snapshot compacto (sin arrays diarios completos)
    const snap = {
      cultivo:       res.cultivo,
      fechaSiembra:  res.fechaSiembra,
      modo:          res.modo,
      faseENSO:      res.faseENSO,
      factorENSO:    res.factorENSO,
      gddTotal:      res.gddTotal,
      dias:          res.dias,
      fechaFin:      res.fechaFin,
      etapas:        res.etapas,
      llegaMadurez:  res.llegaMadurez,
      fuentes:       res.fuentes,
      ts:            new Date().toISOString(),
    };
    localStorage.setItem(LS_KEY_FEN_ACTIVO, JSON.stringify(snap));

    // Kc del día de hoy
    const hoyISO = _formatISO(new Date());
    const idxHoy = res.fechasPorDia.indexOf(hoyISO);
    if (idxHoy >= 0) {
      localStorage.setItem(LS_KEY_FEN_KC_HOY,    String(res.kcPorDia[idxHoy]));
      localStorage.setItem(LS_KEY_FEN_ETAPA_HOY, res.etapaPorDia[idxHoy]);
      localStorage.setItem(LS_KEY_FEN_GDD_ACUM,  String(res.gddAcumPorDia[idxHoy]));

      // Fecha fin de la etapa actual → usado por alertas.js para proximidad de cambio
      const etapaHoy = res.etapaPorDia[idxHoy];
      let fechaFinEtapa = res.fechaFin;
      for (let j = idxHoy + 1; j < res.etapaPorDia.length; j++) {
        if (res.etapaPorDia[j] !== etapaHoy) { fechaFinEtapa = res.fechasPorDia[j - 1]; break; }
      }
      localStorage.setItem("am_fen_fecha_etapa_fin", fechaFinEtapa);
    }
    // Duración total del ciclo para informe-cierre.js
    localStorage.setItem("am_fen_duracion_ciclo", String(res.dias));

    // ── Totales del ciclo para módulo hídrico ─────────────────────────────
    const precipTotal = res.lluviaPorDia.reduce((a, b) => a + b, 0);
    // Precipitación base NASA sin ajuste ENSO → va a bh-precip-hist
    // (hidrico.js aplica su propio factor ENSO sobre este valor base)
    const precipNasa = (res.modo === "planificacion" && res.factorENSO && res.factorENSO !== 1)
      ? precipTotal / res.factorENSO
      : precipTotal;

    // ETc total — Hargreaves-Samani simplificado (Ra promedio pampa ≈ 25 MJ/m²/día)
    let etcTotal = 0;
    for (let i = 0; i < res.kcPorDia.length; i++) {
      const tmax  = res.tmaxPorDia[i] ?? 25;
      const tmin  = res.tminPorDia[i] ?? 15;
      const tmean = (tmax + tmin) / 2;
      const dt    = Math.max(0, tmax - tmin);
      const et0   = Math.max(0, 0.0023 * (tmean + 17.8) * Math.sqrt(dt) * 25 * 0.408);
      etcTotal   += res.kcPorDia[i] * et0;
    }

    localStorage.setItem("am_fen_etc_total",    String(Math.round(etcTotal)));
    localStorage.setItem("am_fen_precip_total", String(Math.round(precipTotal)));
    localStorage.setItem("am_fen_precip_nasa",  String(Math.round(precipNasa)));

    // ── Sincronizar DOM del módulo hídrico si está activo en la página ────
    if (typeof document !== "undefined") {
      const elPrecipHist = document.getElementById("bh-precip-hist");
      if (elPrecipHist) elPrecipHist.value = Math.round(precipNasa);

      // Agua en perfil: usar barbecho si ya lo calculó; si no, calcular de s-h1/h2/h3
      const yaHayBarbecho = localStorage.getItem("am_fen_agua_perfil_fuente") === "barbecho_planificacion";
      if (!yaHayBarbecho) {
        const h1v = parseFloat((document.getElementById("s-h1") || {}).value) || 0;
        const h2v = parseFloat((document.getElementById("s-h2") || {}).value) || 0;
        const h3v = parseFloat((document.getElementById("s-h3") || {}).value) || 0;
        if (h1v > 0) {
          const aguaPerfil = Math.max(20, Math.min(350,
            Math.round((h1v * 0.06 + h2v * 0.18 + h3v * 0.54) * 10 * 2)
          ));
          localStorage.setItem("am_fen_agua_perfil", String(aguaPerfil));
          const elAgua = document.getElementById("bh-agua-perfil");
          if (elAgua) elAgua.value = aguaPerfil;
        }
      } else {
        // Barbecho ya calculó el agua; solo sincronizar al DOM si bh-agua-perfil está vacío
        const elAgua = document.getElementById("bh-agua-perfil");
        const aguaBarbecho = localStorage.getItem("am_fen_agua_perfil");
        if (elAgua && aguaBarbecho && !parseFloat(elAgua.value)) elAgua.value = aguaBarbecho;
      }

      if (typeof bhActualizar === "function") bhActualizar();
    }
  } catch (_) { /* Silencioso: contexto sin localStorage (Node/tests) */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS SINCRÓNICOS (para lectura rápida desde otros módulos)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kc del día de hoy según la última fenología calculada.
 * Lee de localStorage — no requiere async.
 * @returns {number|null}
 */
function getKcHoy() {
  try {
    const raw = localStorage.getItem(LS_KEY_FEN_KC_HOY);
    return raw != null ? parseFloat(raw) : null;
  } catch (_) { return null; }
}

/**
 * Etapa fenológica del día de hoy.
 * @returns {string|null}
 */
function getEtapaHoy() {
  try { return localStorage.getItem(LS_KEY_FEN_ETAPA_HOY) ?? null; }
  catch (_) { return null; }
}

/**
 * GDD acumulado hasta hoy.
 * @returns {number|null}
 */
function getGDDAcumHoy() {
  try {
    const raw = localStorage.getItem(LS_KEY_FEN_GDD_ACUM);
    return raw != null ? parseFloat(raw) : null;
  } catch (_) { return null; }
}

/**
 * Calendario fenológico guardado de la campaña activa.
 * @returns {Object|null}
 */
function getFenologiaActiva() {
  try {
    const raw = localStorage.getItem(LS_KEY_FEN_ACTIVO);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

/**
 * Kc para una fecha específica (interpolación por GDD).
 * Requiere el objeto CalendarioFenologico completo.
 *
 * @param {Object} calendario   Resultado de calcularFenologia()
 * @param {string} fechaISO     "YYYY-MM-DD"
 * @returns {number|null}
 */
function getKcParaFecha(calendario, fechaISO) {
  const idx = calendario.fechasPorDia.indexOf(fechaISO);
  return idx >= 0 ? calendario.kcPorDia[idx] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API DE CONSULTA RÁPIDA (sin fetch — solo con el snapshot persistido)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resumen de la etapa actual para mostrar en dashboard.
 * @returns {{ cultivo, etapa, esCritica, kcHoy, gddAcum, diasDesdeSiembra }|null}
 */
function getResumenActual() {
  try {
    const cal = getFenologiaActiva();
    if (!cal) return null;

    const etapaHoy = getEtapaHoy();
    const kcHoy    = getKcHoy();
    const gddAcum  = getGDDAcumHoy();

    const etInfo = cal.etapas.find(e => e.id === etapaHoy) ?? cal.etapas[0];

    return {
      cultivo:          cal.cultivo,
      fechaSiembra:     cal.fechaSiembra,
      modo:             cal.modo,
      faseENSO:         cal.faseENSO,
      etapaId:          etInfo.id,
      etapaNombre:      etInfo.nombre,
      esCritica:        etInfo.esCritica,
      kcHoy:            kcHoy,
      gddAcum:          gddAcum,
      diasDesdeSiembra: etInfo.diasDesdeSiembra,
    };
  } catch (_) { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTA DE CULTIVOS Y ETAPAS (para UI)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @returns {string[]} Cultivos disponibles
 */
function getCultivosDisponibles() {
  return Object.keys(CULTIVOS);
}

/**
 * Definición completa de etapas para un cultivo.
 * @param {string} cultivo
 * @returns {Object[]}
 */
function getEtapasCultivo(cultivo) {
  return (CULTIVOS[cultivo]?.etapas ?? []).map(e => ({ ...e }));
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calcularFenologia,
    getKcHoy,
    getEtapaHoy,
    getGDDAcumHoy,
    getFenologiaActiva,
    getResumenActual,
    getKcParaFecha,
    getCultivosDisponibles,
    getEtapasCultivo,
    omHumedadSuelo,
    omSmAAgua,
    calcularGDD,
    kcParaGDD,
    etapaParaGDD,
    fetchNASAPower,
    fetchOpenMeteo,
    CULTIVOS,
  };
} else if (typeof window !== "undefined") {
  window.Fenologia = {
    calcularFenologia,
    getKcHoy,
    getEtapaHoy,
    getGDDAcumHoy,
    getFenologiaActiva,
    getResumenActual,
    getKcParaFecha,
    getCultivosDisponibles,
    getEtapasCultivo,
    omHumedadSuelo,
    omSmAAgua,
    calcularGDD,
    kcParaGDD,
    etapaParaGDD,
    CULTIVOS,
  };
}
})();
