/**
 * informe-cierre.js — Informe de cierre de campaña AGROMOTOR v2.0
 *
 * Consolida toda la información de la campaña activa y genera:
 *   1. Objeto BalanceCampana con KPIs hídricos, fenológicos y decisiones
 *   2. Renderizado HTML "tarjeta de campaña"
 *   3. Trigger Barbecho.iniciarBarbechoPostCosecha() al cerrar
 *
 * Flujo:
 *   cerrarCampana(opciones)
 *     ↓
 *   leerEstados()      — consolida localStorage de todos los módulos
 *     ↓
 *   calcularKPIs()     — EUH, balance lluvia/ETc, días estrés, notas
 *     ↓
 *   persistirCierre()  — am_campana_cerrada_* + historial
 *     ↓
 *   Barbecho.iniciarBarbechoPostCosecha()  — si módulo disponible
 *
 * Exports (dual): CommonJS module.exports + window.InformeCierre
 */

"use strict";

/* ──────────────────────────── LS KEYS ──────────────────────────────────── */
// Escritura
const LS_KEY_CIERRE    = "am_campana_cerrada_ultima";
const LS_KEY_HISTORIAL = "am_campana_historial";
const LS_KEY_TS        = "am_cierre_ts";

// Lectura módulos
const LS_IN_CAMPANA_ID   = "am_campana_id";
const LS_IN_CULTIVO      = "am_cultivo";
const LS_IN_MODO         = "am_modo_global";
const LS_IN_LAT          = "am_siembra_lat";
const LS_IN_LON          = "am_siembra_lon";
const LS_IN_LOTE         = "am_lote_nombre";
const LS_IN_AWC          = "am_lote_awc_mm";
const LS_IN_FECHA_SIEM   = "am_siembra_fecha";
const LS_IN_FECHA_COS    = "am_cosecha_fecha";

// Hidrico
const LS_IN_AGUA_FINAL   = "am_hidrico_agua_actual_mm";
const LS_IN_DEFICIT      = "am_hidrico_deficit_acum_mm";
const LS_IN_DIAS_ESTRES  = "am_hidrico_dias_estres";
const LS_IN_DIAS_ET_CRIT = "am_hidrico_dias_et_crit";
const LS_IN_ETC_TOTAL    = "am_hidrico_etc_total";
const LS_IN_HIDRICO_OBJ  = "am_hidrico_ultimo";

// Fenologia
const LS_IN_DURACION_CICLO = "am_fen_duracion_ciclo";
const LS_IN_ETAPAS_JSON    = "am_hidrico_deficit_etapas";  // desde publicarEstadoHidrico

// ENSO
const LS_IN_ENSO_FASE    = "am_enso_fase";
const LS_IN_ENSO_FACTOR  = "am_enso_factor";

// Decisiones
const LS_IN_DECISIONES   = "am_decision_ultima";

/* ──────────────────────────── UTILIDADES ───────────────────────────────── */
function hoyISO() {
  return new Date().toISOString().slice(0, 10);
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

function parseJSON(raw, def) {
  try { return JSON.parse(raw); } catch { return def; }
}

/* ──────────────────────── CONSOLIDACIÓN DE ESTADO ────────────────────── */
function _leerEstados() {
  const hidricoRaw = leerLS(LS_IN_HIDRICO_OBJ, null);
  const hidrico    = hidricoRaw ? parseJSON(hidricoRaw, null) : null;

  return {
    campanaId   : leerLS(LS_IN_CAMPANA_ID, `campaña-${hoyISO()}`),
    cultivo     : leerLS(LS_IN_CULTIVO, "soja"),
    modo        : leerLS(LS_IN_MODO, "planificacion"),
    lat         : parseFloat(leerLS(LS_IN_LAT, "-34")) || -34,
    lon         : parseFloat(leerLS(LS_IN_LON, "-60")) || -60,
    lote        : leerLS(LS_IN_LOTE, "Sin nombre"),
    awcMm       : parseFloat(leerLS(LS_IN_AWC, "200")) || 200,
    fechaSiembra: leerLS(LS_IN_FECHA_SIEM, null),
    fechaCosecha: leerLS(LS_IN_FECHA_COS, hoyISO()),

    // Hídrico
    hidrico,
    aguaFinalMm : hidrico?.aguaFinalMm  ?? parseFloat(leerLS(LS_IN_AGUA_FINAL, "0")) || 0,
    deficitAcum : hidrico?.deficitAcum  ?? parseFloat(leerLS(LS_IN_DEFICIT, "0")) || 0,
    diasEstres  : hidrico?.diasEstres   ?? parseInt(leerLS(LS_IN_DIAS_ESTRES, "0"), 10) || 0,
    diasEtCrit  : hidrico?.diasEtCritica ?? parseInt(leerLS(LS_IN_DIAS_ET_CRIT, "0"), 10) || 0,
    etcTotal    : hidrico?.etcTotal     ?? parseFloat(leerLS(LS_IN_ETC_TOTAL, "0")) || 0,
    lluviaTotal : hidrico?.lluviaTotal  ?? 0,
    etapas      : hidrico?.etapas       ?? parseJSON(leerLS(LS_IN_ETAPAS_JSON, "[]"), []),

    // ENSO
    faseENSO  : leerLS(LS_IN_ENSO_FASE, "neutro"),
    factorENSO: parseFloat(leerLS(LS_IN_ENSO_FACTOR, "0")) || 0,

    // Decisiones
    decisiones: parseJSON(leerLS(LS_IN_DECISIONES, "[]"), []),
  };
}

/* ──────────────────────── CÁLCULO DE KPIs ────────────────────────────── */
function _calcularKPIs(est) {
  const {
    etcTotal, lluviaTotal, awcMm,
    diasEstres, diasEtCrit, deficitAcum, aguaFinalMm,
    hidrico,
  } = est;

  // Eficiencia de uso del agua (EUH): qué tan bien la lluvia cubrió la ETc
  const euh = etcTotal > 0 ? Math.min(1, lluviaTotal / etcTotal) : null;

  // Balance hídrico de la campaña
  const balanceMm = lluviaTotal - etcTotal;

  // Calificación cualitativa de la campaña
  let calificacion;
  if (diasEtCrit === 0 && deficitAcum < 40)      calificacion = "Excelente";
  else if (diasEtCrit <= 2 && deficitAcum < 70)  calificacion = "Buena";
  else if (diasEtCrit <= 5 && deficitAcum < 120) calificacion = "Regular";
  else                                            calificacion = "Comprometida";

  // Notas automáticas
  const notas = [];
  if (diasEtCrit > 0)
    notas.push(`${diasEtCrit} día(s) de estrés hídrico en etapas críticas — revisar expectativa de rinde.`);
  if (deficitAcum > 80)
    notas.push(`Déficit acumulado elevado: ${deficitAcum.toFixed(0)} mm — considerar cultivo de cobertura.`);
  if (lluviaTotal > etcTotal * 1.4)
    notas.push("Exceso hídrico durante la campaña — evaluar drenaje y sanidad radical.");
  if (est.faseENSO && !est.faseENSO.toLowerCase().includes("neutro"))
    notas.push(`ENSO (${est.faseENSO}) activo durante la campaña — factor a considerar en proyección.`);

  return { euh, balanceMm, calificacion, notas };
}

/* ──────────────────────── FUNCIÓN PRINCIPAL ──────────────────────────── */

/**
 * Cierra la campaña activa, genera el informe y dispara barbecho post-cosecha.
 *
 * @param {object}  [opciones]
 * @param {string}  [opciones.fechaCosecha]       ISO (default: hoy)
 * @param {number}  [opciones.rendimientoReal]     kg/ha (si está disponible)
 * @param {string}  [opciones.notas]              notas manuales del usuario
 * @param {object}  [opciones.balanceHidrico]     override de hidrico.js
 * @param {boolean} [opciones.iniciarBarbecho]    default: true
 * @returns {Promise<BalanceCampana>}
 */
async function cerrarCampana({
  fechaCosecha    = null,
  rendimientoReal = null,
  notas           = "",
  balanceHidrico  = null,
  iniciarBarbecho = true,
} = {}) {
  const est = _leerEstados();
  if (balanceHidrico) Object.assign(est, {
    hidrico     : balanceHidrico,
    aguaFinalMm : balanceHidrico.aguaFinalMm,
    deficitAcum : balanceHidrico.deficitAcum,
    diasEstres  : balanceHidrico.diasEstres,
    diasEtCrit  : balanceHidrico.diasEtCritica,
    etcTotal    : balanceHidrico.etcTotal,
    lluviaTotal : balanceHidrico.lluviaTotal,
    etapas      : balanceHidrico.etapas,
  });

  if (fechaCosecha) est.fechaCosecha = fechaCosecha;

  const kpis = _calcularKPIs(est);
  const ts   = new Date().toISOString();

  const cierre = {
    campanaId       : est.campanaId,
    cultivo         : est.cultivo,
    modo            : est.modo,
    lote            : est.lote,
    lat             : est.lat,
    lon             : est.lon,
    fechaSiembra    : est.fechaSiembra,
    fechaCosecha    : est.fechaCosecha,
    awcMm           : est.awcMm,

    // Hídrico
    etcTotal        : est.etcTotal,
    lluviaTotal     : est.lluviaTotal,
    deficitAcum     : est.deficitAcum,
    aguaFinalMm     : est.aguaFinalMm,
    diasEstres      : est.diasEstres,
    diasEtCritica   : est.diasEtCrit,
    etapas          : est.etapas,

    // KPIs calculados
    euh             : kpis.euh,
    balanceMm       : kpis.balanceMm,
    calificacion    : kpis.calificacion,
    notasAuto       : kpis.notas,

    // ENSO
    faseENSO        : est.faseENSO,
    factorENSO      : est.factorENSO,

    // Rendimiento (si disponible)
    rendimientoReal : rendimientoReal ?? null,

    // Notas manuales
    notas           : notas || null,

    ts,
  };

  // Persistir cierre actual
  guardarLS(LS_KEY_CIERRE, JSON.stringify(cierre));
  guardarLS(LS_KEY_TS,     ts);

  // Agregar a historial (max 10 campañas)
  const histRaw  = leerLS(LS_KEY_HISTORIAL, "[]");
  const historial = parseJSON(histRaw, []);
  historial.unshift(cierre);
  if (historial.length > 10) historial.pop();
  guardarLS(LS_KEY_HISTORIAL, JSON.stringify(historial));

  // Trigger barbecho post-cosecha
  if (iniciarBarbecho) {
    try {
      const Barbecho = (typeof window !== "undefined" && window.Barbecho)
        || (typeof require !== "undefined" ? require("./barbecho.js") : null);
      if (Barbecho && typeof Barbecho.iniciarBarbechoPostCosecha === "function") {
        Barbecho.iniciarBarbechoPostCosecha({
          fechaCosecha: est.fechaCosecha,
          cultivo      : est.cultivo,
          aguaActualMm : est.aguaFinalMm,
          awcMm        : est.awcMm,
        });
      }
    } catch (err) {
      console.warn("[InformeCierre] Barbecho.iniciarBarbechoPostCosecha no disponible:", err.message);
    }
  }

  return cierre;
}

/* ──────────────────────── LECTURA ────────────────────────────────────── */
function leerUltimoCierre() {
  try { return parseJSON(leerLS(LS_KEY_CIERRE, null), null); } catch { return null; }
}

function leerHistorialCampanas() {
  try { return parseJSON(leerLS(LS_KEY_HISTORIAL, "[]"), []); } catch { return []; }
}

/* ──────────────────────── RENDERIZADO HTML ───────────────────────────── */
const CALIFICACION_COLOR = {
  "Excelente"   : "text-green-700 bg-green-50 border-green-300",
  "Buena"       : "text-blue-700 bg-blue-50 border-blue-300",
  "Regular"     : "text-yellow-700 bg-yellow-50 border-yellow-300",
  "Comprometida": "text-red-700 bg-red-50 border-red-300",
};

function renderizarCierre(cierre, contenedorId = "cierre-resultado") {
  const el = document.getElementById(contenedorId);
  if (!el || !cierre) return;

  const {
    cultivo, lote, fechaSiembra, fechaCosecha,
    etcTotal, lluviaTotal, deficitAcum, aguaFinalMm, awcMm,
    diasEstres, diasEtCritica,
    euh, balanceMm, calificacion, notasAuto,
    faseENSO, rendimientoReal, notas, ts,
    etapas,
  } = cierre;

  const calColor  = CALIFICACION_COLOR[calificacion] || "text-gray-700 bg-gray-50 border-gray-300";
  const balColor  = balanceMm >= 0 ? "text-green-600" : "text-red-600";
  const euhPct    = euh != null ? (euh * 100).toFixed(0) : "—";
  const euhColor  = euh > 0.8 ? "text-green-600" : euh > 0.6 ? "text-yellow-600" : "text-red-600";

  // Tabla por etapa
  let etapasHtml = "";
  for (const e of (etapas || [])) {
    const defCls = e.deficitAcum > 30 ? "text-red-600" : "";
    etapasHtml += `
      <tr class="border-t text-sm">
        <td class="py-1 pr-3 font-medium">${e.etapa}${e.esCritica ? ' <span class="text-xs text-orange-600">(crítica)</span>' : ""}</td>
        <td class="text-right pr-3">${e.dias}</td>
        <td class="text-right pr-3">${(e.lluviaTotal||0).toFixed(0)}</td>
        <td class="text-right pr-3">${(e.etcTotal||0).toFixed(0)}</td>
        <td class="text-right ${defCls}">${(e.deficitAcum||0).toFixed(0)}</td>
      </tr>`;
  }

  const notasAutoHtml = (notasAuto || []).map(
    (n) => `<li class="text-sm text-gray-700">${n}</li>`
  ).join("");

  el.innerHTML = `
    <div class="space-y-4">
      <!-- Encabezado campaña -->
      <div class="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 class="text-lg font-bold text-gray-900">${cultivo.charAt(0).toUpperCase() + cultivo.slice(1)} — ${lote}</h3>
          <div class="text-sm text-gray-500">
            ${fechaSiembra ? `Siembra: ${fechaSiembra}` : ""}
            ${fechaCosecha ? ` · Cosecha: ${fechaCosecha}` : ""}
            ${faseENSO && !faseENSO.toLowerCase().includes("neutro") ? ` · ENSO: ${faseENSO}` : ""}
          </div>
        </div>
        <div class="border rounded-lg px-4 py-2 text-center font-bold ${calColor}">
          ${calificacion}
        </div>
      </div>

      <!-- KPIs principales -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div class="bg-blue-50 rounded-lg p-3">
          <div class="text-xs text-gray-500 mb-1">ETc total</div>
          <div class="text-xl font-bold text-blue-700">${(etcTotal||0).toFixed(0)} mm</div>
        </div>
        <div class="bg-blue-50 rounded-lg p-3">
          <div class="text-xs text-gray-500 mb-1">Lluvia total</div>
          <div class="text-xl font-bold text-blue-600">${(lluviaTotal||0).toFixed(0)} mm</div>
        </div>
        <div class="bg-blue-50 rounded-lg p-3">
          <div class="text-xs text-gray-500 mb-1">Balance</div>
          <div class="text-xl font-bold ${balColor}">${balanceMm >= 0 ? "+" : ""}${(balanceMm||0).toFixed(0)} mm</div>
        </div>
        <div class="bg-blue-50 rounded-lg p-3">
          <div class="text-xs text-gray-500 mb-1">EUH</div>
          <div class="text-xl font-bold ${euhColor}">${euhPct} %</div>
        </div>
      </div>

      <!-- Estrés y déficit -->
      <div class="flex flex-wrap gap-4 text-sm bg-gray-50 rounded-lg p-3">
        <span>💧 Agua final: <b>${(aguaFinalMm||0).toFixed(0)} mm</b> / ${awcMm} mm AWC</span>
        <span>📉 Déficit: <b>${(deficitAcum||0).toFixed(0)} mm</b></span>
        ${diasEstres > 0 ? `<span class="text-red-600">⚠️ <b>${diasEstres}</b> días estrés</span>` : ""}
        ${diasEtCritica > 0 ? `<span class="text-orange-600 font-semibold">🔥 <b>${diasEtCritica}</b> días estrés crítico</span>` : ""}
        ${rendimientoReal != null ? `<span class="text-green-700 font-semibold">🌾 Rinde: ${rendimientoReal} kg/ha</span>` : ""}
      </div>

      <!-- Tabla etapas -->
      ${etapas && etapas.length > 0 ? `
      <div>
        <h4 class="text-sm font-semibold text-gray-700 mb-2">Balance por etapa</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-gray-500 text-right">
                <th class="text-left pr-3">Etapa</th>
                <th class="pr-3">Días</th>
                <th class="pr-3">Lluvia</th>
                <th class="pr-3">ETc</th>
                <th>Déficit</th>
              </tr>
            </thead>
            <tbody>${etapasHtml}</tbody>
          </table>
        </div>
      </div>` : ""}

      <!-- Notas automáticas -->
      ${notasAutoHtml ? `
      <div>
        <h4 class="text-sm font-semibold text-gray-700 mb-1">Observaciones</h4>
        <ul class="space-y-1 list-disc list-inside">${notasAutoHtml}</ul>
      </div>` : ""}

      <!-- Notas manuales -->
      ${notas ? `
      <div class="bg-yellow-50 rounded-lg p-3 text-sm text-gray-700">
        <span class="font-semibold">Notas:</span> ${notas}
      </div>` : ""}

      <div class="text-xs text-gray-400 text-right">Cierre: ${new Date(ts).toLocaleString("es-AR")}</div>
    </div>`;
}

/* ──────────────────────── EXPORTS ────────────────────────────────────── */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    cerrarCampana,
    leerUltimoCierre,
    leerHistorialCampanas,
    renderizarCierre,
    _leerEstados,
    _calcularKPIs,
  };
}

if (typeof window !== "undefined") {
  window.InformeCierre = {
    cerrarCampana,
    leerUltimoCierre,
    leerHistorialCampanas,
    renderizarCierre,
  };
}
