/**
 * alertas.js — Sistema de alertas agronómicas AGROMOTOR v2.0
 *
 * Fuentes de señales:
 *   · Balance hídrico    (am_hidrico_*)
 *   · Fenología activa   (am_fen_*)
 *   · Clima / forecast   (OpenMeteo)
 *   · ENSO               (am_enso_*)
 *
 * Tipos de alerta:
 *   AGUA   — estrés hídrico, déficit crítico, exceso hídrico
 *   HELADA — Tmin < umbral en etapas sensibles
 *   CALOR  — Tmax > umbral en etapas críticas
 *   ENSO   — Niño/Niña con impacto probable en precipitaciones
 *   FENOL  — Avance de etapa, fecha proyectada próxima
 *
 * Severidad: "info" | "advertencia" | "critica"
 *
 * Exports (dual): CommonJS module.exports + window.Alertas
 */

"use strict";

/* ─────────────────────────── LS KEYS ─────────────────────────────────── */
const LS_KEY_ALERTAS     = "am_alertas_activas";
const LS_KEY_TS          = "am_alertas_ts";

// Entradas desde otros módulos
const LS_IN_MODO         = "am_modo_global";
const LS_IN_LAT          = "am_siembra_lat";
const LS_IN_LON          = "am_siembra_lon";
const LS_IN_CULTIVO      = "am_cultivo";
const LS_IN_ETAPA_ACTUAL = "am_fen_etapa_hoy";
const LS_IN_FECHA_ETAPA  = "am_fen_fecha_etapa_fin";
const LS_IN_AWC          = "am_lote_awc_mm";
const LS_IN_AGUA_ACTUAL  = "am_hidrico_agua_actual_mm";
const LS_IN_DEFICIT_ACUM = "am_hidrico_deficit_acum_mm";
const LS_IN_DIAS_ESTRES  = "am_hidrico_dias_estres";
const LS_IN_DIAS_ET_CRIT = "am_hidrico_dias_et_crit";
const LS_IN_ENSO_FASE    = "am_enso_fase";
const LS_IN_ENSO_FACTOR  = "am_enso_factor";

/* ─────────────────────────── UMBRALES ────────────────────────────────── */
const UMBRAL_ESTRES_FRAC   = 0.30;   // <30 % AWC → estrés
const UMBRAL_EXCESO_FRAC   = 0.90;   // >90 % AWC → exceso / anegamiento
const UMBRAL_DEFICIT_ADV   = 40;     // mm déficit acumulado → advertencia
const UMBRAL_DEFICIT_CRIT  = 80;     // mm déficit acumulado → crítico
const UMBRAL_DIAS_ESTRES_ADV  = 5;   // días consecutivos → advertencia
const UMBRAL_DIAS_ESTRES_CRIT = 10;  // días consecutivos → crítico

/** Tmin helada por cultivo (°C, etapa sensible) */
const UMBRAL_HELADA = {
  soja   : { vegetativa: 0, reproductiva: 2 },
  maiz   : { vegetativa: 0, reproductiva: 2 },
  trigo  : { vegetativa: -5, reproductiva: -2, "espigazon": 1, "antesis": 2 },
  girasol: { vegetativa: 0, reproductiva: 2 },
};

/** Tmax calor por cultivo en etapas críticas (°C) */
const UMBRAL_CALOR = {
  soja   : 35,
  maiz   : 35,
  trigo  : 32,
  girasol: 35,
};

/** Etapas reproductivas/sensibles donde temperatura importa más */
const ETAPAS_REPRODUCTIVAS = new Set([
  "r1","r3r4","r5",       // soja
  "vt","r1","r2r3",       // maiz
  "espigazon","antesis","llenado",  // trigo
  "floracion","llenado",  // girasol
]);

/* ─────────────────────────── UTILIDADES ──────────────────────────────── */
function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function sumarDias(fechaISO, n) {
  const d = new Date(fechaISO + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function leerLS(key, def = null) {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    return v !== null ? v : def;
  } catch { return def; }
}

function guardarLS(key, value) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch { /* noop */ }
}

/* ────────────────────── FETCH FORECAST CLIMA ─────────────────────────── */
/**
 * Obtiene temperatura máx/mín y precipitación para próximos N días.
 * @returns {Array<{fecha, tmax, tmin, precip}>}
 */
async function _fetchForecastCorto({ lat, lon, dias = 7, signal }) {
  const p = new URLSearchParams({
    latitude      : lat,
    longitude     : lon,
    forecast_days : dias,
    daily         : "temperature_2m_max,temperature_2m_min,precipitation_sum",
    timezone      : "auto",
  });
  const url  = `https://api.open-meteo.com/v1/forecast?${p}`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`OpenMeteo forecast HTTP ${resp.status}`);
  const json = await resp.json();
  const d    = json.daily;
  return d.time.map((fecha, i) => ({
    fecha,
    tmax  : d.temperature_2m_max[i]  ?? null,
    tmin  : d.temperature_2m_min[i]  ?? null,
    precip: Math.max(0, d.precipitation_sum[i] ?? 0),
  }));
}

/* ──────────────────────── EVALUADORES ────────────────────────────────── */

/** Alertas de agua a partir del estado del balance hídrico en localStorage */
function _evaluarAlertas_Agua(ctx) {
  const alertas = [];
  const {
    awcMm, aguaMm, deficitAcum, diasEstres, diasEtCrit,
  } = ctx;

  const fracAgua = awcMm > 0 ? aguaMm / awcMm : 1;

  // Estrés actual
  if (fracAgua < UMBRAL_ESTRES_FRAC) {
    const sev = diasEstres >= UMBRAL_DIAS_ESTRES_CRIT ? "critica" : "advertencia";
    alertas.push({
      tipo      : "AGUA",
      codigo    : "AGUA_ESTRES",
      severidad : sev,
      mensaje   : `Estrés hídrico activo: ${aguaMm.toFixed(0)} mm en perfil (${(fracAgua*100).toFixed(0)} % AWC)`,
      detalle   : `Llevan ${diasEstres} días con agua disponible < 30 % AWC.${diasEtCrit > 0 ? ` ${diasEtCrit} días coinciden con etapa crítica.` : ""}`,
      valor     : aguaMm,
      unidad    : "mm",
    });
  }

  // Exceso hídrico
  if (fracAgua > UMBRAL_EXCESO_FRAC) {
    alertas.push({
      tipo      : "AGUA",
      codigo    : "AGUA_EXCESO",
      severidad : "advertencia",
      mensaje   : `Perfil casi saturado: ${aguaMm.toFixed(0)} mm (${(fracAgua*100).toFixed(0)} % AWC)`,
      detalle   : "Riesgo de anegamiento o exceso de agua libre. Monitorear enfermedades de raíz.",
      valor     : aguaMm,
      unidad    : "mm",
    });
  }

  // Déficit acumulado
  if (deficitAcum >= UMBRAL_DEFICIT_ADV) {
    const sev = deficitAcum >= UMBRAL_DEFICIT_CRIT ? "critica" : "advertencia";
    alertas.push({
      tipo      : "AGUA",
      codigo    : "AGUA_DEFICIT",
      severidad : sev,
      mensaje   : `Déficit hídrico acumulado: ${deficitAcum.toFixed(0)} mm`,
      detalle   : `La demanda atmosférica superó la oferta hídrica en ${deficitAcum.toFixed(0)} mm.${diasEtCrit > 0 ? ` Impacto en etapas críticas: ${diasEtCrit} días.` : ""}`,
      valor     : deficitAcum,
      unidad    : "mm",
    });
  }

  return alertas;
}

/** Alertas de helada / calor basadas en forecast próximos 7 días */
function _evaluarAlertas_Temperatura(forecast, ctx) {
  const alertas = [];
  const { cultivo, etapaActual } = ctx;
  const cultivoNorm = (cultivo || "").toLowerCase();
  const esReprod    = ETAPAS_REPRODUCTIVAS.has((etapaActual || "").toLowerCase());

  const umbralHelada = (() => {
    const h = UMBRAL_HELADA[cultivoNorm];
    if (!h) return -3;
    const etNorm = (etapaActual || "").toLowerCase();
    if (h[etNorm] != null) return h[etNorm];
    return esReprod ? (h.reproductiva ?? 0) : (h.vegetativa ?? -3);
  })();

  const umbralCalor = UMBRAL_CALOR[cultivoNorm] ?? 35;

  for (const dia of forecast) {
    if (dia.tmin != null && dia.tmin <= umbralHelada) {
      const sev = dia.tmin <= umbralHelada - 3 ? "critica" : "advertencia";
      alertas.push({
        tipo      : "HELADA",
        codigo    : "HELADA_RIESGO",
        severidad : sev,
        mensaje   : `Riesgo de helada: Tmin ${dia.tmin.toFixed(1)} °C (${dia.fecha})`,
        detalle   : `Umbral para ${cultivo} en etapa ${etapaActual || "actual"}: ${umbralHelada} °C.`,
        fecha     : dia.fecha,
        valor     : dia.tmin,
        unidad    : "°C",
      });
    }

    if (esReprod && dia.tmax != null && dia.tmax >= umbralCalor) {
      alertas.push({
        tipo      : "CALOR",
        codigo    : "CALOR_CRITICO",
        severidad : "advertencia",
        mensaje   : `Calor excesivo en etapa crítica: Tmax ${dia.tmax.toFixed(1)} °C (${dia.fecha})`,
        detalle   : `Umbral daño por calor en ${cultivo}: ${umbralCalor} °C. Etapa: ${etapaActual || "—"}.`,
        fecha     : dia.fecha,
        valor     : dia.tmax,
        unidad    : "°C",
      });
    }
  }

  return alertas;
}

/** Alerta ENSO si fase activa y factor significativo */
function _evaluarAlertas_ENSO(ctx) {
  const alertas = [];
  const { faseENSO, factorENSO } = ctx;
  if (!faseENSO || faseENSO === "neutro") return alertas;

  const esNino  = faseENSO.toLowerCase().includes("niño");
  const esNina  = faseENSO.toLowerCase().includes("niña");
  const factAbs = Math.abs(factorENSO ?? 1);

  if (factAbs < 0.10) return alertas;  // variación menor al 10 %, no alertar

  const sev = factAbs >= 0.25 ? "advertencia" : "info";

  if (esNino) {
    alertas.push({
      tipo      : "ENSO",
      codigo    : "ENSO_NINO",
      severidad : sev,
      mensaje   : `El Niño activo: precipitaciones esperadas ${factorENSO >= 0 ? "+" : ""}${(factorENSO * 100).toFixed(0)} % vs normal`,
      detalle   : "El Niño tiende a incrementar lluvias en la región pampeana. Monitorear excesos y enfermedades fúngicas.",
      valor     : factorENSO,
      unidad    : "factor",
    });
  } else if (esNina) {
    alertas.push({
      tipo      : "ENSO",
      codigo    : "ENSO_NINA",
      severidad : sev,
      mensaje   : `La Niña activa: precipitaciones esperadas ${factorENSO >= 0 ? "+" : ""}${(factorENSO * 100).toFixed(0)} % vs normal`,
      detalle   : "La Niña tiende a reducir lluvias y aumentar temperaturas estivales. Mayor riesgo de déficit hídrico.",
      valor     : factorENSO,
      unidad    : "factor",
    });
  }

  return alertas;
}

/** Alerta fenológica: etapa crítica activa o próxima */
function _evaluarAlertas_Fenologia(ctx) {
  const alertas = [];
  const { etapaActual, fechaFinEtapa, cultivo } = ctx;
  if (!etapaActual) return alertas;

  const etNorm   = etapaActual.toLowerCase();
  const esReprod = ETAPAS_REPRODUCTIVAS.has(etNorm);

  if (esReprod) {
    alertas.push({
      tipo      : "FENOL",
      codigo    : "FENOL_ETAPA_CRITICA",
      severidad : "info",
      mensaje   : `Cultivo en etapa crítica: ${etapaActual} (${cultivo})`,
      detalle   : fechaFinEtapa
        ? `Fin estimado de etapa: ${fechaFinEtapa}. Máxima sensibilidad a estrés hídrico y temperatura.`
        : "Máxima sensibilidad a estrés hídrico y temperatura.",
      valor     : etapaActual,
      unidad    : "etapa",
    });
  }

  // Aviso si queda poco para fin de etapa
  if (fechaFinEtapa) {
    const hoy   = hoyISO();
    const msRest = new Date(fechaFinEtapa + "T12:00:00Z") - new Date(hoy + "T12:00:00Z");
    const dias  = Math.round(msRest / 86400000);
    if (dias >= 0 && dias <= 5) {
      alertas.push({
        tipo      : "FENOL",
        codigo    : "FENOL_CAMBIO_ETAPA",
        severidad : "info",
        mensaje   : `Cambio de etapa en ${dias} día${dias !== 1 ? "s" : ""}: ${etapaActual} → próxima`,
        detalle   : `Fecha estimada: ${fechaFinEtapa}. Actualizar seguimiento al cambiar de etapa.`,
        valor     : dias,
        unidad    : "días",
      });
    }
  }

  return alertas;
}

/* ──────────────────────── FUNCIÓN PRINCIPAL ──────────────────────────── */

/**
 * Evalúa todas las alertas y las persiste en localStorage.
 *
 * @param {object}  [opciones]
 * @param {boolean} [opciones.incluirForecast=true]   Fetch clima próx. 7 días
 * @param {object}  [opciones.estadoHidrico]          Balance de hidrico.js (opcional)
 * @param {object}  [opciones.estadoFenologia]        Fenología activa (opcional)
 * @param {AbortSignal} [opciones.signal]
 * @returns {Promise<Array<Alerta>>}
 */
async function evaluarAlertas({
  incluirForecast = true,
  estadoHidrico   = null,
  estadoFenologia = null,
  signal,
} = {}) {
  const cultivo     = leerLS(LS_IN_CULTIVO, "soja");
  const etapaActual = leerLS(LS_IN_ETAPA_ACTUAL, "");
  const fechaFinEtapa = leerLS(LS_IN_FECHA_ETAPA, null);
  const awcMm       = parseFloat(leerLS(LS_IN_AWC, "200")) || 200;
  const aguaMm      = parseFloat(leerLS(LS_IN_AGUA_ACTUAL, "140")) || 0;
  const deficitAcum = parseFloat(leerLS(LS_IN_DEFICIT_ACUM, "0")) || 0;
  const diasEstres  = parseInt(leerLS(LS_IN_DIAS_ESTRES, "0"), 10) || 0;
  const diasEtCrit  = parseInt(leerLS(LS_IN_DIAS_ET_CRIT, "0"), 10) || 0;
  const faseENSO    = leerLS(LS_IN_ENSO_FASE, "neutro");
  const factorENSO  = parseFloat(leerLS(LS_IN_ENSO_FACTOR, "0")) || 0;
  const lat         = parseFloat(leerLS(LS_IN_LAT, "-34"));
  const lon         = parseFloat(leerLS(LS_IN_LON, "-60"));

  // Si llegó estado desde módulo hidrico, sobreescribir LS
  const ctx_agua = estadoHidrico
    ? {
        awcMm     : estadoHidrico.awcMm,
        aguaMm    : estadoHidrico.aguaFinalMm,
        deficitAcum: estadoHidrico.deficitAcum,
        diasEstres : estadoHidrico.diasEstres,
        diasEtCrit : estadoHidrico.diasEtCritica,
      }
    : { awcMm, aguaMm, deficitAcum, diasEstres, diasEtCrit };

  const ctx_fen = estadoFenologia
    ? {
        etapaActual  : estadoFenologia.etapaActual || etapaActual,
        fechaFinEtapa: estadoFenologia.fechaFinEtapa || fechaFinEtapa,
        cultivo      : estadoFenologia.cultivo || cultivo,
      }
    : { etapaActual, fechaFinEtapa, cultivo };

  const ctxENSO = { faseENSO, factorENSO };

  // Acumular alertas
  let todasAlertas = [
    ..._evaluarAlertas_Agua(ctx_agua),
    ..._evaluarAlertas_ENSO(ctxENSO),
    ..._evaluarAlertas_Fenologia(ctx_fen),
  ];

  // Alertas de temperatura sólo si podemos fetch forecast
  if (incluirForecast) {
    try {
      const forecast = await _fetchForecastCorto({ lat, lon, dias: 7, signal });
      const alertasTemp = _evaluarAlertas_Temperatura(forecast, {
        cultivo   : ctx_fen.cultivo,
        etapaActual: ctx_fen.etapaActual,
      });
      todasAlertas = [...todasAlertas, ...alertasTemp];
    } catch (err) {
      console.warn("[Alertas] No se pudo obtener forecast:", err.message);
    }
  }

  // Ordenar: critica → advertencia → info
  const orden = { critica: 0, advertencia: 1, info: 2 };
  todasAlertas.sort((a, b) => (orden[a.severidad] ?? 3) - (orden[b.severidad] ?? 3));

  // Agregar timestamps
  const ts    = new Date().toISOString();
  const final = todasAlertas.map((al) => ({ ...al, ts }));

  // Persistir
  guardarLS(LS_KEY_ALERTAS, JSON.stringify(final));
  guardarLS(LS_KEY_TS,      ts);

  return final;
}

/* ──────────────────────── LECTURA ────────────────────────────────────── */
function leerAlertas() {
  try {
    const raw = leerLS(LS_KEY_ALERTAS, "[]");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function limpiarAlertas() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LS_KEY_ALERTAS);
      localStorage.removeItem(LS_KEY_TS);
    }
  } catch { /* noop */ }
}

/* ──────────────────────── RENDERIZADO HTML ────────────────────────────── */

const ICONO = {
  AGUA   : "💧",
  HELADA : "🧊",
  CALOR  : "🔥",
  ENSO   : "🌊",
  FENOL  : "🌱",
};

const COLOR = {
  critica    : "border-red-400 bg-red-50",
  advertencia: "border-yellow-400 bg-yellow-50",
  info       : "border-blue-300 bg-blue-50",
};

const COLOR_BADGE = {
  critica    : "bg-red-100 text-red-700",
  advertencia: "bg-yellow-100 text-yellow-700",
  info       : "bg-blue-100 text-blue-700",
};

function renderizarAlertas(alertas, contenedorId = "alertas-resultado") {
  const el = document.getElementById(contenedorId);
  if (!el) return;

  if (!alertas || alertas.length === 0) {
    el.innerHTML = `
      <div class="flex items-center gap-2 text-green-700 bg-green-50 border border-green-300 rounded-lg p-4">
        <span class="text-xl">✅</span>
        <span class="font-medium">Sin alertas activas para la campaña.</span>
      </div>`;
    return;
  }

  const items = alertas.map((al) => `
    <div class="border-l-4 ${COLOR[al.severidad]} rounded-lg p-3 flex gap-3">
      <div class="text-2xl leading-none">${ICONO[al.tipo] || "⚠️"}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <span class="text-sm font-semibold text-gray-800">${al.mensaje}</span>
          <span class="text-xs px-2 py-0.5 rounded-full font-medium ${COLOR_BADGE[al.severidad]}">${al.severidad}</span>
        </div>
        ${al.detalle ? `<div class="text-xs text-gray-600">${al.detalle}</div>` : ""}
      </div>
    </div>`).join("");

  const ts = alertas[0]?.ts
    ? `<div class="text-xs text-gray-400 text-right mt-2">Evaluado: ${new Date(alertas[0].ts).toLocaleString("es-AR")}</div>`
    : "";

  el.innerHTML = `<div class="space-y-2">${items}${ts}</div>`;
}

/* ──────────────────────── EXPORTS ────────────────────────────────────── */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    evaluarAlertas,
    leerAlertas,
    limpiarAlertas,
    renderizarAlertas,
    _evaluarAlertas_Agua,
    _evaluarAlertas_Temperatura,
    _evaluarAlertas_ENSO,
    _evaluarAlertas_Fenologia,
    _fetchForecastCorto,
  };
}

if (typeof window !== "undefined") {
  window.Alertas = {
    evaluarAlertas,
    leerAlertas,
    limpiarAlertas,
    renderizarAlertas,
  };
}
