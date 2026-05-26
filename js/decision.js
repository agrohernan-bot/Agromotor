/**
 * decision.js — Soporte de decisiones agronómicas AGROMOTOR v2.0
 *
 * Sintetiza señales de hidrico.js, alertas.js y fenologia.js para
 * generar recomendaciones accionables:
 *   · Riego (oportunidad, lámina sugerida, prioridad)
 *   · Fungicidas / protección de cultivo
 *   · Ajuste de estrategia (densidad, fecha, variedad)
 *   · Señales para cierre anticipado de campaña
 *
 * Prioridad: "alta" | "media" | "baja"
 *
 * Exports (dual): CommonJS module.exports + window.Decision
 */

"use strict";

/* ──────────────────────────── LS KEYS ──────────────────────────────────── */
const LS_KEY_DECISIONES  = "am_decision_ultima";
const LS_KEY_TS          = "am_decision_ts";

const LS_IN_AWC          = "am_lote_awc_mm";
const LS_IN_AGUA_ACTUAL  = "am_hidrico_agua_actual_mm";
const LS_IN_DEFICIT_ACUM = "am_hidrico_deficit_acum_mm";
const LS_IN_DIAS_ESTRES  = "am_hidrico_dias_estres";
const LS_IN_DIAS_ET_CRIT = "am_hidrico_dias_et_crit";
const LS_IN_ETC_TOTAL    = "am_hidrico_etc_total";
const LS_IN_CULTIVO      = "am_cultivo";
const LS_IN_ETAPA_ACTUAL = "am_fen_etapa_actual";
const LS_IN_ENSO_FASE    = "am_enso_fase";
const LS_IN_ENSO_FACTOR  = "am_enso_factor";
const LS_IN_MODO         = "am_modo_global";

/* ──────────────────────────── UMBRALES ──────────────────────────────────── */
const RIEGO_UMBRAL_DEFICIT  = 30;   // mm → recomendar riego
const RIEGO_UMBRAL_FRAC_AWC = 0.45; // 45 % AWC → evaluación riego
const RIEGO_LAMINA_REPONER  = 0.80; // llenar hasta 80 % AWC
const FUNGICIDA_HUMEDAD_MIN = 0.70; // >70 % AWC + etapa crít → revisar fungi
const DIAS_ESTRES_RIESGO    = 3;    // 3+ días de estrés → prioridad riego alta

/** Etapas donde el riego tiene mayor impacto relativo */
const ETAPAS_RIEGO_ALTO_IMPACTO = new Set([
  "r1","r3r4","r5",
  "vt","r1","r2r3",
  "espigazon","antesis","llenado",
  "floracion","llenado",
]);

/* ──────────────────────────── UTILIDADES ───────────────────────────────── */
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

function redondear(n, dec = 1) {
  return Math.round(n * 10 ** dec) / 10 ** dec;
}

/* ──────────────────────── GENERADORES DE RECOMENDACIONES ─────────────── */

function _recomendacion_Riego(ctx) {
  const recs = [];
  const { awcMm, aguaMm, deficitAcum, diasEstres, diasEtCrit, etapaActual } = ctx;

  const fracAgua   = awcMm > 0 ? aguaMm / awcMm : 1;
  const metaAgua   = awcMm * RIEGO_LAMINA_REPONER;
  const laminaRec  = Math.max(0, metaAgua - aguaMm);
  const etapaAlta  = ETAPAS_RIEGO_ALTO_IMPACTO.has((etapaActual || "").toLowerCase());

  const necesitaRiego =
    fracAgua < RIEGO_UMBRAL_FRAC_AWC ||
    deficitAcum >= RIEGO_UMBRAL_DEFICIT ||
    diasEstres >= DIAS_ESTRES_RIESGO;

  if (!necesitaRiego) return recs;

  let prioridad = "media";
  if (diasEtCrit > 0 || (diasEstres >= DIAS_ESTRES_RIESGO && etapaAlta)) prioridad = "alta";
  if (fracAgua > RIEGO_UMBRAL_FRAC_AWC && deficitAcum < RIEGO_UMBRAL_DEFICIT)  prioridad = "baja";

  recs.push({
    categoria : "RIEGO",
    codigo    : "RIEGO_DEFICITARIO",
    prioridad,
    accion    : `Aplicar riego: lámina sugerida ${redondear(laminaRec, 0)} mm`,
    fundamento: `Agua en perfil: ${redondear(aguaMm, 0)} mm (${(fracAgua * 100).toFixed(0)} % AWC). ` +
                `Déficit acumulado: ${redondear(deficitAcum, 0)} mm. ` +
                (diasEstres > 0 ? `${diasEstres} días de estrés.` : "") +
                (diasEtCrit > 0 ? ` ⚠️ ${diasEtCrit} días en etapa crítica.` : ""),
    valorClave : redondear(laminaRec, 0),
    unidad     : "mm",
  });

  return recs;
}

function _recomendacion_Fungicida(ctx) {
  const recs = [];
  const { awcMm, aguaMm, etapaActual, cultivo } = ctx;

  const fracAgua = awcMm > 0 ? aguaMm / awcMm : 1;
  const etapaAlta = ETAPAS_RIEGO_ALTO_IMPACTO.has((etapaActual || "").toLowerCase());

  // Condición favorable para enfermedades: alta humedad del suelo + etapa sensible
  if (fracAgua >= FUNGICIDA_HUMEDAD_MIN && etapaAlta) {
    let motivo = "";
    const c = (cultivo || "").toLowerCase();
    if (c === "soja")    motivo = "Roya, Mancha ojo de rana";
    else if (c === "maiz")  motivo = "Tizón, Mancha foliar";
    else if (c === "trigo") motivo = "Roya amarilla, Fusarium en espigas";
    else if (c === "girasol") motivo = "Sclerotinia, Phomopsis";
    else motivo = "enfermedades fúngicas";

    recs.push({
      categoria : "FUNGICIDA",
      codigo    : "FUNGI_CONDICIONES_FAVORABLES",
      prioridad : "media",
      accion    : `Monitorear y evaluar aplicación fungicida preventiva (${motivo})`,
      fundamento: `Perfil con ${(fracAgua * 100).toFixed(0)} % AWC y cultivo en etapa ${etapaActual}. ` +
                  "Condiciones favorables para desarrollo de enfermedades fúngicas.",
      valorClave : fracAgua,
      unidad     : "frac AWC",
    });
  }

  return recs;
}

function _recomendacion_Estrategia(ctx) {
  const recs = [];
  const { deficitAcum, diasEtCrit, faseENSO, factorENSO, modo, cultivo } = ctx;

  // Campaña con alto déficit en etapas críticas → posible impacto en rendimiento
  if (diasEtCrit >= 3) {
    recs.push({
      categoria : "ESTRATEGIA",
      codigo    : "ESTRAT_RENDIMIENTO_RIESGO",
      prioridad : diasEtCrit >= 6 ? "alta" : "media",
      accion    : "Revisar expectativa de rendimiento y ajustar presupuesto de cosecha",
      fundamento: `${diasEtCrit} días de estrés hídrico en etapas críticas. ` +
                  `Déficit acumulado: ${redondear(deficitAcum, 0)} mm.`,
      valorClave : diasEtCrit,
      unidad     : "días críticos",
    });
  }

  // ENSO Niña → planificación campaña siguiente
  if ((faseENSO || "").toLowerCase().includes("niña") && Math.abs(factorENSO || 0) > 0.15) {
    recs.push({
      categoria : "ESTRATEGIA",
      codigo    : "ESTRAT_NINA_SEGUIMIENTO",
      prioridad : "baja",
      accion    : "Para próxima campaña: considerar variedades tolerantes a sequía y ajustar fechas de siembra",
      fundamento: `La Niña activa con impacto ${(factorENSO * 100).toFixed(0)} % en precipitaciones. ` +
                  "Planificar campaña siguiente con mayor buffer hídrico.",
      valorClave : factorENSO,
      unidad     : "factor ENSO",
    });
  }

  // Modo seguimiento con alto déficit → señal de cierre si es fin de ciclo
  if (modo === "seguimiento" && deficitAcum >= 80) {
    recs.push({
      categoria : "ESTRATEGIA",
      codigo    : "ESTRAT_ANTICIPAR_COSECHA",
      prioridad : "baja",
      accion    : "Evaluar adelanto de cosecha si el cultivo está en madurez fisiológica",
      fundamento: `Déficit acumulado elevado (${redondear(deficitAcum, 0)} mm). ` +
                  "En madurez fisiológica, la demora puede empeorar calidad de grano.",
      valorClave : deficitAcum,
      unidad     : "mm déficit",
    });
  }

  return recs;
}

/* ──────────────────────── FUNCIÓN PRINCIPAL ──────────────────────────── */

/**
 * Genera lista de recomendaciones basadas en el estado actual de la campaña.
 *
 * @param {object}  [opciones]
 * @param {object}  [opciones.balanceHidrico]   output de calcularHidrico()
 * @param {object}  [opciones.estadoFenologia]  { etapaActual, cultivo }
 * @param {Array}   [opciones.alertasActivas]   output de evaluarAlertas()
 * @returns {Promise<Array<Recomendacion>>}
 */
async function generarDecisiones({
  balanceHidrico   = null,
  estadoFenologia  = null,
  alertasActivas   = null,
} = {}) {
  // Construir contexto unificado
  const awcMm      = balanceHidrico?.awcMm      ?? parseFloat(leerLS(LS_IN_AWC, "200")) || 200;
  const aguaMm     = balanceHidrico?.aguaFinalMm ?? parseFloat(leerLS(LS_IN_AGUA_ACTUAL, "140")) || 0;
  const deficitAcum= balanceHidrico?.deficitAcum ?? parseFloat(leerLS(LS_IN_DEFICIT_ACUM, "0")) || 0;
  const diasEstres = balanceHidrico?.diasEstres  ?? parseInt(leerLS(LS_IN_DIAS_ESTRES, "0"), 10) || 0;
  const diasEtCrit = balanceHidrico?.diasEtCritica ?? parseInt(leerLS(LS_IN_DIAS_ET_CRIT, "0"), 10) || 0;
  const cultivo    = estadoFenologia?.cultivo    ?? leerLS(LS_IN_CULTIVO, "soja");
  const etapaActual= estadoFenologia?.etapaActual ?? leerLS(LS_IN_ETAPA_ACTUAL, "");
  const faseENSO   = leerLS(LS_IN_ENSO_FASE, "neutro");
  const factorENSO = parseFloat(leerLS(LS_IN_ENSO_FACTOR, "0")) || 0;
  const modo       = (leerLS(LS_IN_MODO, "planificacion") || "planificacion").toLowerCase();

  const ctx = {
    awcMm, aguaMm, deficitAcum, diasEstres, diasEtCrit,
    cultivo, etapaActual, faseENSO, factorENSO, modo,
  };

  const recs = [
    ..._recomendacion_Riego(ctx),
    ..._recomendacion_Fungicida(ctx),
    ..._recomendacion_Estrategia(ctx),
  ];

  // Ordenar: alta → media → baja
  const orden = { alta: 0, media: 1, baja: 2 };
  recs.sort((a, b) => (orden[a.prioridad] ?? 3) - (orden[b.prioridad] ?? 3));

  const ts    = new Date().toISOString();
  const final = recs.map((r) => ({ ...r, ts }));

  guardarLS(LS_KEY_DECISIONES, JSON.stringify(final));
  guardarLS(LS_KEY_TS,         ts);

  return final;
}

/* ──────────────────────── LECTURA ────────────────────────────────────── */
function leerDecisiones() {
  try {
    const raw = leerLS(LS_KEY_DECISIONES, "[]");
    return JSON.parse(raw);
  } catch { return []; }
}

function limpiarDecisiones() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LS_KEY_DECISIONES);
      localStorage.removeItem(LS_KEY_TS);
    }
  } catch { /* noop */ }
}

/* ──────────────────────── RENDERIZADO HTML ───────────────────────────── */

const ICONO_CAT = {
  RIEGO     : "💧",
  FUNGICIDA : "🍃",
  ESTRATEGIA: "🎯",
};

const COLOR_PRIO = {
  alta  : "border-red-400 bg-red-50",
  media : "border-yellow-400 bg-yellow-50",
  baja  : "border-gray-300 bg-gray-50",
};

const BADGE_PRIO = {
  alta  : "bg-red-100 text-red-700",
  media : "bg-yellow-100 text-yellow-700",
  baja  : "bg-gray-100 text-gray-600",
};

function renderizarDecisiones(decisiones, contenedorId = "decision-resultado") {
  const el = document.getElementById(contenedorId);
  if (!el) return;

  if (!decisiones || decisiones.length === 0) {
    el.innerHTML = `
      <div class="flex items-center gap-2 text-green-700 bg-green-50 border border-green-300 rounded-lg p-4">
        <span class="text-xl">✅</span>
        <span class="font-medium">Sin recomendaciones de acción inmediata.</span>
      </div>`;
    return;
  }

  const items = decisiones.map((r) => `
    <div class="border-l-4 ${COLOR_PRIO[r.prioridad]} rounded-lg p-3 flex gap-3">
      <div class="text-2xl leading-none">${ICONO_CAT[r.categoria] || "📋"}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <span class="text-xs font-bold uppercase tracking-wide text-gray-500">${r.categoria}</span>
          <span class="text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_PRIO[r.prioridad]}">${r.prioridad}</span>
        </div>
        <div class="text-sm font-semibold text-gray-800 mb-1">${r.accion}</div>
        <div class="text-xs text-gray-600">${r.fundamento}</div>
      </div>
    </div>`).join("");

  const ts = decisiones[0]?.ts
    ? `<div class="text-xs text-gray-400 text-right mt-2">Generado: ${new Date(decisiones[0].ts).toLocaleString("es-AR")}</div>`
    : "";

  el.innerHTML = `<div class="space-y-2">${items}${ts}</div>`;
}

/* ──────────────────────── EXPORTS ────────────────────────────────────── */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generarDecisiones,
    leerDecisiones,
    limpiarDecisiones,
    renderizarDecisiones,
    _recomendacion_Riego,
    _recomendacion_Fungicida,
    _recomendacion_Estrategia,
  };
}

if (typeof window !== "undefined") {
  window.Decision = {
    generarDecisiones,
    leerDecisiones,
    limpiarDecisiones,
    renderizarDecisiones,
  };
}
