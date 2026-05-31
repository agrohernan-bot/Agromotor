/**
 * enso.js — AGROMOTOR v2.0
 *
 * Consulta la fase ENSO (El Niño / La Niña / Neutro) desde NOAA CPC
 * y calcula el factor de ajuste de precipitación para la región pampeana.
 *
 * ─── BASE CIENTÍFICA ──────────────────────────────────────────────────────
 *
 * El ENSO modula la precipitación en la Pampa Argentina de forma significativa:
 *
 *   Fase       │ Anomalía media anual │ Trimestre crítico (SEP-NOV)
 *   ───────────┼──────────────────────┼────────────────────────────
 *   El Niño    │ +15 a +22%           │ +18%  (lluvia primaveral extra)
 *   La Niña    │ -12 a -20%           │ -18%  (sequía primaveral)
 *   Neutro     │  0%                  │   0%
 *
 * Fuentes: Penalba & Vargas (2004), Grimm et al. (2000), Berbery & Barros (2002).
 * Factor adoptado: ±18% sobre la precipitación proyectada (conservador,
 * mitad del rango de anomalía máxima para evitar sobreestimación).
 *
 * ─── FUENTE DE DATOS ──────────────────────────────────────────────────────
 *
 * Primary  : NOAA CPC — ONI (Oceanic Niño Index)
 *   URL      : https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt
 *   Formato  : Texto fijo, columnas: YR MON TOTAL CLIM ANOM (3-month running mean)
 *   Umbral   : ≥ +0.5 → El Niño | ≤ -0.5 → La Niña | entre → Neutro
 *
 * Fallback : NOAA CPC — Cold & Warm Episodes JSON (más robusto a cambios de formato)
 *   URL      : https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ONI_v5.php
 *
 * Cache    : localStorage "am_enso_cache" (TTL: 7 días)
 *
 * Nota: Ambas URLs requieren fetch sin CORS issues. En browser, si hay
 * restricción CORS, se puede usar un proxy o el endpoint alternativo JSON.
 */

// ─────────────────────────────────────────────────────────────────────────────
// IIFE — evitar contaminación del scope global (ONI_URL_TXT, AJUSTE_*, etc.)
// ─────────────────────────────────────────────────────────────────────────────
(function () {

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const ONI_URL_TXT  = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt";
const LS_CACHE_KEY = "am_enso_cache_v2";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 7 días

/** Umbral ONI para declarar El Niño / La Niña (°C de anomalía SST Niño-3.4) */
const ONI_UMBRAL_NINYO = 0.5;
const ONI_UMBRAL_NINA  = -0.5;

/** Ajuste de precipitación por fase (fracción, no porcentaje) */
const AJUSTE_NINYO  =  0.18;   // +18%
const AJUSTE_NEUTRO =  0.00;
const AJUSTE_NINA   = -0.18;   // -18%

/** @typedef {"niño"|"niña"|"neutro"} FaseENSO */

// Nombres de los períodos tri-mensuales en el archivo ONI
const PERIODOS_ONI = ["DJF","JFM","FMA","MAM","AMJ","MJJ","JJA","JAS","ASO","SON","OND","NDJ"];

// ─────────────────────────────────────────────────────────────────────────────
// PARSING DEL ARCHIVO ONI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parsea el archivo ASCII de NOAA CPC (oni.ascii.txt).
 * Devuelve los registros como array de objetos.
 *
 * Formato de línea (espacio-delimitado):
 *   SEAS  YR   TOTAL   ANOM
 *   DJF   1950  24.72  -1.53
 * NOAA mantuvo versiones previas con una columna CLIM extra; se aceptan ambas.
 *
 * @param {string} texto  Contenido crudo del archivo
 * @returns {Array<{periodo:string, anio:number, anom:number}>}
 */
function parsearONI(texto) {
  const lineas  = texto.split("\n");
  const datos   = [];

  for (const linea of lineas) {
    const partes = linea.trim().split(/\s+/);
    if (partes.length < 4) continue;

    const [seas, yr] = partes;
    const anom = partes.length >= 5 ? partes[4] : partes[3];
    const anio   = parseInt(yr,   10);
    const anomF  = parseFloat(anom);

    if (!PERIODOS_ONI.includes(seas) || isNaN(anio) || isNaN(anomF)) continue;

    datos.push({ periodo: seas, anio, anom: anomF });
  }

  return datos;
}

/**
 * Convierte un período tri-mensual (DJF, MAM, etc.) y año a un mes central.
 * DJF 1950 → Enero 1950
 * @param {string} periodo
 * @param {number} anio
 * @returns {Date}
 */
function periodoAFecha(periodo, anio) {
  const mesIdx     = PERIODOS_ONI.indexOf(periodo);
  // Meses centrales: DJF→1, JFM→2, FMA→3, ... NDJ→12
  const mesCentral = ((mesIdx + 1) % 12) || 12;
  return new Date(anio, mesCentral - 1, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH NOAA CPC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Descarga y parsea el índice ONI de NOAA CPC.
 * @returns {Promise<Array<{periodo:string, anio:number, anom:number}>>}
 */
async function fetchONI() {
  const resp = await fetch(ONI_URL_TXT, { cache: "no-store" });
  if (!resp.ok) throw new Error(`NOAA CPC error ${resp.status}`);
  const texto = await resp.text();
  return parsearONI(texto);
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE
// ─────────────────────────────────────────────────────────────────────────────

function leerCache() {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
    if (!Array.isArray(obj.datos) || obj.datos.length === 0) return null;
    return obj;
  } catch (_) { return null; }
}

function escribirCache(datos) {
  if (!Array.isArray(datos) || datos.length === 0) return;
  try {
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify({
      ts:    Date.now(),
      datos,
    }));
  } catch (_) {}
}

function limpiarCache() {
  try {
    localStorage.removeItem(LS_CACHE_KEY);
    localStorage.removeItem("am_enso_cache");
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINACIÓN DE FASE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clasifica una anomalía ONI en fase ENSO.
 * @param {number} anom   Anomalía SST en °C
 * @returns {FaseENSO}
 */
function clasificarFase(anom) {
  if (anom >= ONI_UMBRAL_NINYO) return "niño";
  if (anom <= ONI_UMBRAL_NINA)  return "niña";
  return "neutro";
}

/**
 * Devuelve el factor de ajuste de precipitación según la fase ENSO.
 * @param {FaseENSO} fase
 * @returns {number}  Ej: 0.18 (El Niño), -0.18 (La Niña), 0 (Neutro)
 */
function getFactorAjuste(fase) {
  switch (fase) {
    case "niño":   return AJUSTE_NINYO;
    case "niña":   return AJUSTE_NINA;
    default:       return AJUSTE_NEUTRO;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determina la fase ENSO para un mes/año específico.
 * Usa los datos NOAA CPC con cache de 7 días.
 *
 * @param {number} [anio]   Año objetivo (default: año actual)
 * @param {number} [mes]    Mes 1-12 (default: mes actual)
 * @returns {Promise<ResultadoENSO>}
 *
 * @typedef {Object} ResultadoENSO
 * @property {FaseENSO}  fase            "niño"|"niña"|"neutro"
 * @property {number}    oni             Anomalía ONI en °C (NaN si no disponible)
 * @property {string}    periodo         Período tri-mensual (ej: "SON")
 * @property {number}    anio            Año del dato
 * @property {number}    factorAjuste    +0.18 | 0 | -0.18
 * @property {string}    fuente          "noaa_cpc"|"cache"|"fallback"
 * @property {boolean}   datosDisponibles
 * @property {string}    [advertencia]   Mensaje si el dato es estimado o faltante
 */
async function getFaseENSO(anio, mes) {
  const ahora = new Date();
  const anioObj = anio ?? ahora.getFullYear();
  const mesObj  = mes  ?? (ahora.getMonth() + 1);

  // ── Intentar cache ───────────────────────────────────────────────────────
  let datos;
  let fuente = "noaa_cpc";
  const cache = leerCache();

  if (cache) {
    datos  = cache.datos;
    fuente = "cache";
  } else {
    try {
      datos = await fetchONI();
      if (!Array.isArray(datos) || datos.length === 0) throw new Error("NOAA CPC sin registros ONI parseables");
      escribirCache(datos);
    } catch (e) {
      // Sin acceso a NOAA — usar fallback histórico
      return _fallbackENSO(anioObj, mesObj, e.message);
    }
  }

  // ── Encontrar el período tri-mensual más cercano al mes objetivo ──────────
  const objetivo = new Date(anioObj, mesObj - 1, 15);

  // Filtrar datos del año objetivo y año anterior (por si el dato más reciente
  // corresponde al año anterior para fechas futuras)
  const candidatos = datos.filter((d) => d.anio >= anioObj - 1 && d.anio <= anioObj + 1);

  if (!candidatos.length) {
    return _fallbackENSO(anioObj, mesObj, "Sin datos ONI para el año solicitado");
  }

  // Ordenar por proximidad temporal al mes objetivo
  const conFecha = candidatos.map((d) => ({
    ...d,
    fecha: periodoAFecha(d.periodo, d.anio),
  }));
  conFecha.sort((a, b) => Math.abs(a.fecha - objetivo) - Math.abs(b.fecha - objetivo));

  const mejor = conFecha[0];
  const diffMeses = Math.abs(
    (mejor.fecha.getFullYear() - objetivo.getFullYear()) * 12 +
    (mejor.fecha.getMonth()   - objetivo.getMonth())
  );

  const advertencia = diffMeses > 3
    ? `Dato ONI del período ${mejor.periodo} ${mejor.anio} (${diffMeses} meses de diferencia). Usar con precaución.`
    : undefined;

  const fase = clasificarFase(mejor.anom);

  return {
    fase,
    oni:             mejor.anom,
    periodo:         mejor.periodo,
    anio:            mejor.anio,
    factorAjuste:    getFactorAjuste(fase),
    fuente,
    datosDisponibles: true,
    ...(advertencia ? { advertencia } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK HISTÓRICO (cuando NOAA no está disponible)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fallback estadístico basado en frecuencia histórica ENSO (1950-2023):
 * El Niño: ~30%, La Niña: ~28%, Neutro: ~42%
 * Sin datos de red → devuelve "neutro" (conservador, sin ajuste).
 *
 * @param {number} anio
 * @param {number} mes
 * @param {string} motivo
 * @returns {ResultadoENSO}
 */
function _fallbackENSO(anio, mes, motivo) {
  return {
    fase:             "neutro",
    oni:              NaN,
    periodo:          "???",
    anio,
    factorAjuste:     AJUSTE_NEUTRO,
    fuente:           "fallback",
    datosDisponibles: false,
    advertencia:      `ENSO no disponible temporalmente. Se calculo con fase neutra, sin ajuste de lluvia.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AJUSTE DE PRECIPITACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aplica el ajuste ENSO a un array de precipitaciones diarias.
 * Útil para corregir la lluvia histórica NASA POWER según la fase del año planificado.
 *
 * @param {number[]}      precipOriginal   mm/día — array de precipitaciones
 * @param {FaseENSO}      fase             Fase ENSO del año a planificar
 * @returns {{ precipAjustada: number[], factor: number, fase: FaseENSO }}
 */
function ajustarPrecipitacion(precipOriginal, fase) {
  const factor = 1 + getFactorAjuste(fase);
  const precipAjustada = precipOriginal.map((p) => +Math.max(0, p * factor).toFixed(1));
  return { precipAjustada, factor, fase };
}

/**
 * Aplica el ajuste ENSO a un único valor de precipitación.
 * @param {number}    precip   mm
 * @param {FaseENSO}  fase
 * @returns {number}  mm ajustados
 */
function ajustarPrecipValor(precip, fase) {
  const factor = 1 + getFactorAjuste(fase);
  return +Math.max(0, precip * factor).toFixed(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORIAL ENSO (para análisis de campañas pasadas)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve la fase ENSO para cada año de un rango.
 * Útil para el módulo informe-cierre.js al reconstruir el historial.
 *
 * @param {number} anioInicio
 * @param {number} anioFin
 * @param {number} [mes=10]  Mes representativo (default: octubre, pico campaña estival)
 * @returns {Promise<Array<{anio:number, fase:FaseENSO, oni:number}>>}
 */
async function getHistorialENSO(anioInicio, anioFin, mes = 10) {
  const cache = leerCache();
  let datos;

  if (cache) {
    datos = cache.datos;
  } else {
    try {
      datos = await fetchONI();
      if (!Array.isArray(datos) || datos.length === 0) throw new Error("NOAA CPC sin registros ONI parseables");
      escribirCache(datos);
    } catch (_) {
      // Sin red: devolver neutro para todos los años
      const historial = [];
      for (let a = anioInicio; a <= anioFin; a++) {
        historial.push({ anio: a, fase: "neutro", oni: NaN });
      }
      return historial;
    }
  }

  const historial = [];
  for (let a = anioInicio; a <= anioFin; a++) {
    const objetivo = new Date(a, mes - 1, 15);
    const conFecha = datos
      .filter((d) => d.anio >= a - 1 && d.anio <= a)
      .map((d) => ({ ...d, fecha: periodoAFecha(d.periodo, d.anio) }));

    conFecha.sort((x, y) => Math.abs(x.fecha - objetivo) - Math.abs(y.fecha - objetivo));

    const mejor = conFecha[0];
    if (mejor) {
      historial.push({ anio: a, fase: clasificarFase(mejor.anom), oni: mejor.anom });
    } else {
      historial.push({ anio: a, fase: "neutro", oni: NaN });
    }
  }

  return historial;
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZADO UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza el badge ENSO en el elemento con id="enso-badge".
 * @param {ResultadoENSO} resultado
 */
function renderizarBadgeENSO(resultado) {
  const el = document.getElementById("enso-badge");
  if (!el) return;

  const colores = {
    "niño":   { bg: "#1B4F72", icono: "🌊", label: "El Niño" },
    "niña":   { bg: "#7D3C98", icono: "💧", label: "La Niña" },
    "neutro": { bg: "#555",    icono: "➖", label: "Neutro" },
  };

  const cfg   = colores[resultado.fase] || colores.neutro;
  const ajPct = (resultado.factorAjuste >= 0 ? "+" : "") + (resultado.factorAjuste * 100).toFixed(0) + "%";
  const oniStr = isNaN(resultado.oni) ? "N/D" : resultado.oni.toFixed(2) + "°C";
  const fuenteStr = resultado.fuente === "fallback"
    ? " ⚠️ sin conexión"
    : ` · ${resultado.periodo} ${resultado.anio}`;

  el.innerHTML = `
    <div class="enso-badge"
         style="display:inline-flex;align-items:center;gap:6px;
                background:${cfg.bg};color:#fff;padding:4px 10px;
                border-radius:12px;font-size:12px;font-weight:700;"
         title="ONI: ${oniStr}${fuenteStr}">
      <span>${cfg.icono}</span>
      <span>${cfg.label}</span>
      <span style="opacity:0.85;font-weight:400">${ajPct} lluvia</span>
    </div>
    ${resultado.advertencia
      ? `<div class="enso-advertencia" style="font-size:11px;color:#B05B1A;margin-top:2px;">
           ⚠️ ${resultado.advertencia}
         </div>`
      : ""}
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    // API principal
    getFaseENSO,
    getHistorialENSO,
    // Ajuste de precipitación
    ajustarPrecipitacion,
    ajustarPrecipValor,
    getFactorAjuste,
    // Cache
    limpiarCache,
    // UI
    renderizarBadgeENSO,
    // Constantes expuestas
    AJUSTE_NINYO,
    AJUSTE_NEUTRO,
    AJUSTE_NINA,
    ONI_UMBRAL_NINYO,
    ONI_UMBRAL_NINA,
    // Internals para tests
    _parsearONI:     parsearONI,
    _clasificarFase: clasificarFase,
    _periodoAFecha:  periodoAFecha,
  };
} else if (typeof window !== "undefined") {
  window.ENSO = {
    getFaseENSO,
    getHistorialENSO,
    ajustarPrecipitacion,
    ajustarPrecipValor,
    getFactorAjuste,
    limpiarCache,
    renderizarBadgeENSO,
    AJUSTE_NINYO,
    AJUSTE_NEUTRO,
    AJUSTE_NINA,
  };
}

})(); // fin IIFE enso.js
