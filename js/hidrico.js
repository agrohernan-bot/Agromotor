/**
 * hidrico.js — Balance hídrico diario AGROMOTOR v2.0
 * Modo PLANIFICACIÓN : NASA POWER + Hargreaves-Samani (factor 0.60)
 * Modo SEGUIMIENTO   : OpenMeteo ERA5/forecast + ET0 directo
 *
 * Exports (dual):  CommonJS module.exports  +  window.Hidrico
 */

"use strict";

/* ───────────────────────── CLAVES localStorage ───────────────────────── */
const LS_KEY_ULTIMO       = "am_hidrico_ultimo";
const LS_KEY_AGUA_ACTUAL  = "am_hidrico_agua_actual_mm";
const LS_KEY_DEFICIT_ACUM = "am_hidrico_deficit_acum_mm";
const LS_KEY_TS           = "am_hidrico_ts";
const LS_IN_AGUA_PERFIL   = "am_fen_agua_perfil";
const LS_IN_AWC           = "am_lote_awc_mm";
const LS_IN_MODO          = "am_modo_global";
const LS_IN_LAT           = "am_siembra_lat";
const LS_IN_LON           = "am_siembra_lon";

/* ───────────────────────── CONSTANTES ────────────────────────────────── */
const HARGREAVES_FACTOR  = 0.60;   // calibración Pampa Húmeda
const AWC_DEFAULT_MM     = 200;    // capacidad hídrica suelo pampeano típico
const ESTRES_UMBRAL_FRAC = 0.30;   // <30 % AWC → estrés hídrico
const ERA5_LAG_DIAS      = 7;      // ERA5 disponible con ~7 días de rezago

/** Etapas marcadas como críticas por cultivo (intersectan con etapaPorDia) */
const ETAPAS_CRITICAS = {
  soja:    new Set(["r1", "r3r4", "r5"]),
  maiz:    new Set(["vt", "r1", "r2r3"]),
  trigo:   new Set(["espigazon", "antesis", "llenado"]),
  girasol: new Set(["floracion", "llenado"]),
};

/* ───────────────────────── UTILIDADES FECHA ──────────────────────────── */
function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function restarDias(fechaISO, n) {
  const d = new Date(fechaISO + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function sumarDias(fechaISO, n) {
  const d = new Date(fechaISO + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diasEntre(desde, hasta) {
  const a = new Date(desde + "T12:00:00Z");
  const b = new Date(hasta + "T12:00:00Z");
  return Math.round((b - a) / 86400000);
}

function _diaDelAnio(fechaISO) {
  const d   = new Date(fechaISO + "T12:00:00Z");
  const ini = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.floor((d - ini) / 86400000) + 1;
}

function fmtFecha(fechaISO) {
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

/* ───────────────────────── ET0 HARGREAVES-SAMANI ─────────────────────── */
/**
 * @param {number} tmax  °C
 * @param {number} tmin  °C
 * @param {number} lat   grados decimales
 * @param {number} doy   día del año (1-365)
 * @returns {number}     mm/día
 */
function _et0Hargreaves(tmax, tmin, lat, doy) {
  const phi = (lat * Math.PI) / 180;
  const dr  = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const dec = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws  = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(dec))));
  const Ra  =
    ((24 * 60 * 0.082) / Math.PI) *
    dr *
    (ws * Math.sin(phi) * Math.sin(dec) +
      Math.cos(phi) * Math.cos(dec) * Math.sin(ws));
  const dtd = Math.max(0, tmax - tmin);
  const tmm = (tmax + tmin) / 2;
  const et0 = HARGREAVES_FACTOR * 0.0023 * Ra * (tmm + 17.8) * Math.sqrt(dtd);
  return Math.max(0, et0);
}

/* ───────────────────────── FETCHES CLIMA ─────────────────────────────── */

/**
 * NASA POWER — split automático si el período cruza año calendario.
 * @returns {Array<{fecha, tmax, tmin, precip}>}
 */
async function _fetchNASAPower({ lat, lon, fechaIni, fechaFin, signal }) {
  const anioIni = parseInt(fechaIni.slice(0, 4), 10);
  const anioFin = parseInt(fechaFin.slice(0, 4), 10);

  if (anioIni !== anioFin) {
    const [parteA, parteB] = await Promise.all([
      _fetchNASAPower({ lat, lon, fechaIni, fechaFin: `${anioIni}-12-31`, signal }),
      _fetchNASAPower({ lat, lon, fechaIni: `${anioFin}-01-01`, fechaFin, signal }),
    ]);
    return [...parteA, ...parteB];
  }

  const fmt    = (s) => s.replace(/-/g, "");
  const params = new URLSearchParams({
    parameters : "T2M_MAX,T2M_MIN,PRECTOTCORR",
    community  : "AG",
    longitude  : lon,
    latitude   : lat,
    start      : fmt(fechaIni),
    end        : fmt(fechaFin),
    format     : "JSON",
  });
  const url  = `https://power.larc.nasa.gov/api/temporal/daily/point?${params}`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`NASA POWER HTTP ${resp.status}`);
  const json = await resp.json();

  const tmax_map  = json.properties.parameter.T2M_MAX;
  const tmin_map  = json.properties.parameter.T2M_MIN;
  const prec_map  = json.properties.parameter.PRECTOTCORR;

  return Object.keys(tmax_map).map((key) => {
    const fecha = `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
    return {
      fecha,
      tmax  : tmax_map[key],
      tmin  : tmin_map[key],
      precip: Math.max(0, prec_map[key] ?? 0),
      et0   : null,          // calculado por Hargreaves
    };
  });
}

/**
 * OpenMeteo ERA5-archive + forecast — híbrido continuo.
 * @returns {Array<{fecha, et0, precip, tmax, tmin}>}
 */
async function _fetchOpenMeteoSeguimiento({ lat, lon, fechaIni, fechaFin, signal }) {
  const HOY    = hoyISO();
  const LIMITE = restarDias(HOY, ERA5_LAG_DIAS);      // hasta dónde llega ERA5

  const VARS = "et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min";

  const resultados = {};

  // ── ERA5 archive ──────────────────────────────────────────────────────
  if (fechaIni <= LIMITE) {
    const finEra5 = fechaFin < LIMITE ? fechaFin : LIMITE;
    const p = new URLSearchParams({
      latitude        : lat,
      longitude       : lon,
      start_date      : fechaIni,
      end_date        : finEra5,
      daily           : VARS,
      timezone        : "auto",
    });
    const url  = `https://archive-api.open-meteo.com/v1/archive?${p}`;
    const resp = await fetch(url, { signal });
    if (!resp.ok) throw new Error(`OpenMeteo ERA5 HTTP ${resp.status}`);
    const json = await resp.json();
    _parsearOpenMeteo(json, resultados);
  }

  // ── Forecast (cubre rezago reciente + futuro) ─────────────────────────
  if (fechaFin > LIMITE) {
    const pastDays     = Math.max(0, diasEntre(LIMITE, HOY) + ERA5_LAG_DIAS + 1);
    const forecastDays = Math.max(1, diasEntre(HOY, fechaFin) + 1);
    const p = new URLSearchParams({
      latitude      : lat,
      longitude     : lon,
      past_days     : pastDays,
      forecast_days : Math.min(forecastDays, 16),    // límite API gratuita
      daily         : VARS,
      timezone      : "auto",
    });
    const url  = `https://api.open-meteo.com/v1/forecast?${p}`;
    const resp = await fetch(url, { signal });
    if (!resp.ok) throw new Error(`OpenMeteo forecast HTTP ${resp.status}`);
    const json = await resp.json();
    _parsearOpenMeteo(json, resultados);             // forecast pisa ERA5 si hay overlap
  }

  // Convertir mapa a array ordenado dentro del rango pedido
  return Object.keys(resultados)
    .filter((f) => f >= fechaIni && f <= fechaFin)
    .sort()
    .map((f) => resultados[f]);
}

function _parsearOpenMeteo(json, mapa) {
  const d    = json.daily;
  const n    = d.time.length;
  for (let i = 0; i < n; i++) {
    const fecha = d.time[i];
    mapa[fecha] = {
      fecha,
      et0   : d.et0_fao_evapotranspiration?.[i]   ?? null,
      precip: Math.max(0, d.precipitation_sum?.[i] ?? 0),
      tmax  : d.temperature_2m_max?.[i]            ?? null,
      tmin  : d.temperature_2m_min?.[i]            ?? null,
    };
  }
}

/* ───────────────────── BALANCE HÍDRICO DIARIO ────────────────────────── */

/**
 * Corre el balance día a día.
 * @param {object} p
 * @param {Array}  p.diasClima      [{fecha, et0|null, precip, tmax, tmin}]
 * @param {Array}  p.kcPorDia       [number]  — puede ser null (standalone)
 * @param {Array}  p.etapaPorDia    [string]  — puede ser null
 * @param {number} p.aguaIni        mm iniciales en el perfil
 * @param {number} p.awcMm          capacidad de agua útil total
 * @param {string} p.modo           "planificacion" | "seguimiento"
 * @param {number} p.lat
 * @param {string} p.cultivo
 * @returns {{dias:Array, totales:object}}
 */
function _correrBalanceDiario({ diasClima, kcPorDia, etapaPorDia, aguaIni, awcMm, modo, lat, cultivo }) {
  const cultivoNorm  = (cultivo || "").toLowerCase();
  const etapasCritic = ETAPAS_CRITICAS[cultivoNorm] || new Set();

  let aguaActual  = Math.min(awcMm, Math.max(0, aguaIni));
  let etcTotal    = 0;
  let lluviaTotal = 0;
  let deficitAcum = 0;
  let diasEstres  = 0;
  let diasEtCrit  = 0;

  const dias = diasClima.map((clima, i) => {
    const doy  = _diaDelAnio(clima.fecha);
    const kc   = (kcPorDia && kcPorDia[i] != null) ? kcPorDia[i] : 1.0;
    const etap = (etapaPorDia && etapaPorDia[i]) ? etapaPorDia[i] : "—";

    // ET0: usar directo si seguimiento y disponible, sino Hargreaves
    let et0;
    if (modo === "seguimiento" && clima.et0 != null && clima.et0 >= 0) {
      et0 = clima.et0;
    } else {
      const tmax = clima.tmax ?? 25;
      const tmin = clima.tmin ?? 10;
      et0 = _et0Hargreaves(tmax, tmin, lat, doy);
    }

    const etc           = et0 * kc;
    const lluvia        = Math.max(0, clima.precip ?? 0);
    const aguaConLluvia = Math.min(awcMm, aguaActual + lluvia);
    const extraccion    = Math.min(aguaConLluvia, etc);       // no extrae más de lo disponible
    const deficitDia    = Math.max(0, etc - extraccion);
    const aguaFin       = Math.max(0, aguaConLluvia - extraccion);
    const fracLlenado   = awcMm > 0 ? aguaFin / awcMm : 0;
    const estresHidrico = fracLlenado < ESTRES_UMBRAL_FRAC;
    const esCritica     = etapasCritic.has(etap);

    etcTotal    += etc;
    lluviaTotal += lluvia;
    deficitAcum += deficitDia;
    if (estresHidrico)              diasEstres++;
    if (estresHidrico && esCritica) diasEtCrit++;

    aguaActual = aguaFin;

    return {
      fecha       : clima.fecha,
      etapa       : etap,
      kc          : +kc.toFixed(3),
      et0         : +et0.toFixed(2),
      etc         : +etc.toFixed(2),
      lluvia      : +lluvia.toFixed(1),
      aguaIni     : +(aguaConLluvia - extraccion + extraccion - lluvia).toFixed(1), // aprox antes de lluvia
      aguaFin     : +aguaFin.toFixed(1),
      fracLlenado : +fracLlenado.toFixed(3),
      deficitDia  : +deficitDia.toFixed(2),
      estresHidrico,
      esCritica,
    };
  });

  return {
    dias,
    totales: {
      etcTotal    : +etcTotal.toFixed(1),
      lluviaTotal : +lluviaTotal.toFixed(1),
      deficitAcum : +deficitAcum.toFixed(1),
      aguaFinalMm : +aguaActual.toFixed(1),
      diasEstres,
      diasEtCritica: diasEtCrit,
    },
  };
}

/* ───────────────────── RESUMEN POR ETAPA ─────────────────────────────── */
function _resumirPorEtapa(dias) {
  const mapa = {};
  for (const d of dias) {
    if (!mapa[d.etapa]) {
      mapa[d.etapa] = {
        etapa       : d.etapa,
        dias        : 0,
        etcTotal    : 0,
        lluviaTotal : 0,
        deficitAcum : 0,
        diasEstres  : 0,
        esCritica   : d.esCritica,
      };
    }
    const e = mapa[d.etapa];
    e.dias++;
    e.etcTotal    += d.etc;
    e.lluviaTotal += d.lluvia;
    e.deficitAcum += d.deficitDia;
    if (d.estresHidrico) e.diasEstres++;
  }
  return Object.values(mapa).map((e) => ({
    ...e,
    etcTotal    : +e.etcTotal.toFixed(1),
    lluviaTotal : +e.lluviaTotal.toFixed(1),
    deficitAcum : +e.deficitAcum.toFixed(1),
  }));
}

/* ─────────────────── FUNCIÓN PRINCIPAL ───────────────────────────────── */

/**
 * Calcula el balance hídrico diario para la campaña activa.
 *
 * @param {object}  p
 * @param {number}  p.lat
 * @param {number}  p.lon
 * @param {string}  p.fechaIni        ISO
 * @param {string}  p.fechaFin        ISO
 * @param {string}  p.cultivo         "soja" | "maiz" | "trigo" | "girasol"
 * @param {string}  p.modo            "planificacion" | "seguimiento"
 * @param {number}  [p.awcMm]         mm (default AWC_DEFAULT_MM)
 * @param {number}  [p.aguaIniMm]     mm al inicio (default awcMm * 0.7)
 * @param {object}  [p.calendario]    output de fenologia.js (integración)
 * @param {string}  [p.campanaId]
 * @param {string}  [p.faseENSO]
 * @param {number}  [p.factorENSO]
 * @param {AbortSignal} [p.signal]
 * @returns {Promise<BalanceHidrico>}
 */
async function calcularHidrico({
  lat,
  lon,
  fechaIni,
  fechaFin,
  cultivo,
  modo,
  awcMm,
  aguaIniMm,
  calendario,
  campanaId,
  faseENSO,
  factorENSO,
  signal,
} = {}) {
  /* ── Defaults ── */
  const _awc    = awcMm    ?? leerLS(LS_IN_AWC, AWC_DEFAULT_MM);
  const _aguaIni= aguaIniMm ?? (_awc * 0.7);
  const _modo   = (modo || leerLS(LS_IN_MODO, "planificacion")).toLowerCase();
  const _lat    = lat  ?? parseFloat(leerLS(LS_IN_LAT, "-34"));
  const _lon    = lon  ?? parseFloat(leerLS(LS_IN_LON, "-60"));

  /* ── Vectores Kc / etapa / clima ── */
  let kcPorDia    = null;
  let etapaPorDia = null;
  let diasClima;

  let fuenteClima = _modo === "seguimiento" ? "openmeteo" : "nasa_power";
  let fuenteEt0   = _modo === "seguimiento" ? "openmeteo_directo" : "hargreaves";
  let fuenteKc    = "estimado";

  if (calendario && Array.isArray(calendario.kcPorDia)) {
    // ── MODO INTEGRADO: reutilizar arrays de fenologia.js ──────────────
    kcPorDia    = calendario.kcPorDia;
    etapaPorDia = calendario.etapaPorDia || null;
    fuenteKc    = "fenologia";

    if (_modo === "seguimiento") {
      // Fetch OpenMeteo para ET0 directo (y completar con Hargreaves si faltan)
      diasClima = await _fetchOpenMeteoSeguimiento({
        lat: _lat, lon: _lon,
        fechaIni, fechaFin,
        signal,
      });
    } else {
      // Reusar clima de fenologia si viene incluido
      if (Array.isArray(calendario.tmaxPorDia)) {
        diasClima = calendario.fechasPorDia.map((fecha, i) => ({
          fecha,
          tmax  : calendario.tmaxPorDia[i],
          tmin  : calendario.tminPorDia[i],
          precip: calendario.lluviaPorDia[i] ?? 0,
          et0   : null,
        }));
        fuenteClima = "nasa_power_reutilizado";
      } else {
        diasClima = await _fetchNASAPower({ lat: _lat, lon: _lon, fechaIni, fechaFin, signal });
      }
    }
  } else {
    // ── MODO STANDALONE: fetch clima independiente, Kc estimado ────────
    if (_modo === "seguimiento") {
      diasClima = await _fetchOpenMeteoSeguimiento({ lat: _lat, lon: _lon, fechaIni, fechaFin, signal });
    } else {
      diasClima = await _fetchNASAPower({ lat: _lat, lon: _lon, fechaIni, fechaFin, signal });
    }
    // Kc lineal simplificado (sin etapas): 0.35 → 1.15 → 0.55
    const n = diasClima.length;
    kcPorDia = diasClima.map((_, i) => {
      const frac = i / Math.max(1, n - 1);
      if (frac < 0.25)      return 0.35 + frac * (0.7 / 0.25);
      else if (frac < 0.75) return 1.05 + (frac - 0.25) * (0.10 / 0.50);
      else                  return 1.15 - (frac - 0.75) * (0.60 / 0.25);
    });
  }

  /* ── Balance ── */
  const { dias, totales } = _correrBalanceDiario({
    diasClima,
    kcPorDia,
    etapaPorDia,
    aguaIni : _aguaIni,
    awcMm   : _awc,
    modo    : _modo,
    lat     : _lat,
    cultivo,
  });

  const etapas = _resumirPorEtapa(dias);
  const ts     = new Date().toISOString();

  const resultado = {
    cultivo,
    fechaIni,
    fechaFin,
    modo         : _modo,
    faseENSO     : faseENSO  || null,
    factorENSO   : factorENSO || null,
    campanaId    : campanaId  || null,
    aguaIniMm    : +_aguaIni.toFixed(1),
    awcMm        : _awc,
    ...totales,
    dias,
    etapas,
    ts,
    fuentes      : {
      clima : fuenteClima,
      et0   : fuenteEt0,
      kc    : fuenteKc,
    },
  };

  /* ── Persistir en localStorage ── */
  guardarLS(LS_KEY_ULTIMO,       JSON.stringify(resultado));
  guardarLS(LS_KEY_AGUA_ACTUAL,  String(resultado.aguaFinalMm));
  guardarLS(LS_KEY_DEFICIT_ACUM, String(resultado.deficitAcum));
  guardarLS(LS_KEY_TS,           ts);

  return resultado;
}

/* ─────────────────── LECTURA / ESTADO ────────────────────────────────── */

function leerUltimoHidrico() {
  try {
    const raw = leerLS(LS_KEY_ULTIMO, null);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getAguaActual() {
  return parseFloat(leerLS(LS_KEY_AGUA_ACTUAL, "0")) || 0;
}

function getDeficitAcumulado() {
  return parseFloat(leerLS(LS_KEY_DEFICIT_ACUM, "0")) || 0;
}

function limpiarHidrico() {
  const keys = [LS_KEY_ULTIMO, LS_KEY_AGUA_ACTUAL, LS_KEY_DEFICIT_ACUM, LS_KEY_TS];
  keys.forEach((k) => {
    try { localStorage.removeItem(k); } catch { /* noop */ }
  });
}

/** Publica señales de estado para que otros módulos (alertas, decision) lean. */
function publicarEstadoHidrico(balance) {
  if (!balance) return;
  guardarLS("am_hidrico_dias_estres",    String(balance.diasEstres));
  guardarLS("am_hidrico_dias_et_crit",   String(balance.diasEtCritica));
  guardarLS("am_hidrico_etc_total",      String(balance.etcTotal));
  guardarLS("am_hidrico_deficit_etapas", JSON.stringify(balance.etapas));
}

/* ─────────────────── RENDERIZADO HTML ────────────────────────────────── */

function renderizarResultado(balance, contenedorId = "hidrico-resultado") {
  const el = document.getElementById(contenedorId);
  if (!el || !balance) return;

  const {
    cultivo, fechaIni, fechaFin, modo,
    awcMm, aguaIniMm, aguaFinalMm,
    etcTotal, lluviaTotal, deficitAcum,
    diasEstres, diasEtCritica,
    etapas, ts,
  } = balance;

  const bal = lluviaTotal - etcTotal;
  const balColor  = bal >= 0 ? "text-green-600" : "text-red-600";
  const defColor  = deficitAcum > 80 ? "text-red-600" : deficitAcum > 40 ? "text-yellow-600" : "text-green-600";
  const aguaColor = (aguaFinalMm / awcMm) < 0.30 ? "text-red-600" : "text-blue-700";

  let etapasHtml = "";
  for (const e of etapas) {
    const defCls = e.deficitAcum > 30 ? "text-red-600 font-semibold" : "";
    const critBadge = e.esCritica ? ' <span class="text-xs bg-orange-100 text-orange-700 rounded px-1">crítica</span>' : "";
    etapasHtml += `
      <tr class="border-t text-sm">
        <td class="py-1 pr-3 font-medium">${e.etapa}${critBadge}</td>
        <td class="text-right pr-3">${e.dias}</td>
        <td class="text-right pr-3">${e.lluviaTotal.toFixed(0)}</td>
        <td class="text-right pr-3">${e.etcTotal.toFixed(0)}</td>
        <td class="text-right ${defCls}">${e.deficitAcum.toFixed(0)}</td>
        <td class="text-right">${e.diasEstres}</td>
      </tr>`;
  }

  el.innerHTML = `
    <div class="space-y-4">
      <!-- Encabezado resumen -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-blue-50 rounded-lg p-3 text-center">
          <div class="text-xs text-gray-500 mb-1">ETc acumulada</div>
          <div class="text-2xl font-bold text-blue-700">${etcTotal.toFixed(0)} mm</div>
        </div>
        <div class="bg-blue-50 rounded-lg p-3 text-center">
          <div class="text-xs text-gray-500 mb-1">Lluvia acumulada</div>
          <div class="text-2xl font-bold text-blue-600">${lluviaTotal.toFixed(0)} mm</div>
        </div>
        <div class="bg-blue-50 rounded-lg p-3 text-center">
          <div class="text-xs text-gray-500 mb-1">Balance hídrico</div>
          <div class="text-2xl font-bold ${balColor}">${bal >= 0 ? "+" : ""}${bal.toFixed(0)} mm</div>
        </div>
        <div class="bg-blue-50 rounded-lg p-3 text-center">
          <div class="text-xs text-gray-500 mb-1">Déficit acumulado</div>
          <div class="text-2xl font-bold ${defColor}">${deficitAcum.toFixed(0)} mm</div>
        </div>
      </div>

      <!-- Estado actual del perfil -->
      <div class="flex items-center gap-4 bg-gray-50 rounded-lg p-3 text-sm">
        <div>
          <span class="text-gray-500">Agua en perfil:</span>
          <span class="${aguaColor} font-bold ml-1">${aguaFinalMm.toFixed(0)} mm</span>
          <span class="text-gray-400 text-xs ml-1">(${((aguaFinalMm / awcMm) * 100).toFixed(0)} % AWC)</span>
        </div>
        <div class="h-4 flex-1 bg-gray-200 rounded-full overflow-hidden">
          <div class="h-full rounded-full ${aguaColor.includes('red') ? 'bg-red-400' : 'bg-blue-500'}"
               style="width:${Math.min(100, (aguaFinalMm / awcMm) * 100).toFixed(0)}%"></div>
        </div>
        <div class="text-gray-500">${awcMm} mm AWC</div>
      </div>

      <!-- Días de estrés -->
      ${(diasEstres > 0) ? `
      <div class="flex gap-4 text-sm">
        <span class="text-red-600">⚠️ <b>${diasEstres}</b> días con estrés hídrico</span>
        ${diasEtCritica > 0 ? `<span class="text-orange-600 font-semibold">🔥 <b>${diasEtCritica}</b> en etapa crítica</span>` : ""}
      </div>` : '<div class="text-sm text-green-600">✅ Sin días de estrés hídrico</div>'}

      <!-- Tabla por etapa -->
      <div>
        <h4 class="text-sm font-semibold text-gray-700 mb-2">Resumen por etapa</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-gray-500 text-right">
                <th class="text-left pr-3">Etapa</th>
                <th class="pr-3">Días</th>
                <th class="pr-3">Lluvia (mm)</th>
                <th class="pr-3">ETc (mm)</th>
                <th class="pr-3">Déficit (mm)</th>
                <th>D.Estrés</th>
              </tr>
            </thead>
            <tbody>${etapasHtml}</tbody>
          </table>
        </div>
      </div>

      <div class="text-xs text-gray-400 text-right">
        Calculado: ${new Date(ts).toLocaleString("es-AR")} · modo: ${modo}
      </div>
    </div>`;
}

/* ─────────────────── HELPERS localStorage ────────────────────────────── */
function leerLS(key, def = null) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v : def;
  } catch {
    return def;
  }
}

function guardarLS(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota exceeded u otros: silencioso */
  }
}

/* ─────────────────── EXPORTS ─────────────────────────────────────────── */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calcularHidrico,
    leerUltimoHidrico,
    getAguaActual,
    getDeficitAcumulado,
    limpiarHidrico,
    publicarEstadoHidrico,
    renderizarResultado,
    /* internos exportados para testing */
    _et0Hargreaves,
    _correrBalanceDiario,
    _resumirPorEtapa,
    _fetchNASAPower,
    _fetchOpenMeteoSeguimiento,
    _diaDelAnio,
  };
}

if (typeof window !== "undefined") {
  window.Hidrico = {
    calcularHidrico,
    leerUltimoHidrico,
    getAguaActual,
    getDeficitAcumulado,
    limpiarHidrico,
    publicarEstadoHidrico,
    renderizarResultado,
  };
}
