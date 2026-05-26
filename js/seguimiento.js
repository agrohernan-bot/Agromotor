// seguimiento.js — Panel de Monitoreo en Tiempo Real | AGROMOTOR v2.0
//
// Orquesta la actualización de todos los módulos de cálculo y expone el
// estado integrado de la campaña activa como un snapshot estructurado.
//
// En modo PLANIFICACIÓN: lee datos ya calculados (NASA POWER) desde localStorage.
// En modo SEGUIMIENTO:   dispara re-cálculo con OpenMeteo ERA5 + pronóstico
//                        al llamar a actualizarSeguimiento().
//
// API principal:
//   actualizarSeguimiento(opts?)  → Promise<Snapshot>  (orquesta todos los módulos)
//   getSeguimientoActivo()        → Snapshot | null     (sync, desde localStorage)
//   getDashboard()                → Dashboard           (sync, KPIs + alertas + etapa)
//   getKPIs()                     → KPIs                (sync, 10 indicadores clave)
//   getAlertPanel()               → AlertPanel          (sync, alertas clasificadas)
//   getPronostico(dias=16)        → PronosticoDia[]     (sync, proyección 16 días)
//   getEtapaActual()              → EtapaInfo | null    (sync, fenología hoy)
//   necesitaActualizacion()       → boolean             (true si datos > 3 h)
//   exportarHTML(snapshot?)       → string              (panel HTML completo)
//   exportarResumen()             → string              (resumen en texto plano)
//
// Lecturas de localStorage:
//   am_fenologia_activo, am_fen_kc_hoy, am_fen_etapa_hoy, am_fen_gdd_acum
//   am_hid_agua_hoy, am_hid_deficit_hoy, am_hid_etc_acum, am_hid_et0_acum
//   am_hid_lluvia_acum, am_hid_ks_hoy, am_hid_estres_hoy, am_hidrico_activo
//   am_hid_resumen_etapas, am_alertas_activas, am_alertas_nivel_max
//   am_siembra_lat, am_siembra_lon, am_siembra_cultivo, am_siembra_fecha
//   am_siembra_lote, am_lote_awc_mm, am_modo_activo
//   am_enso_fase, am_enso_factor, am_campana_activa_id, am_cierre_activo
//
// Escrituras en localStorage:
//   am_seguimiento_activo  → último Snapshot
//   am_seguimiento_ts      → timestamp (ms) de la última actualización

"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const VERSION_SEG      = "2.0.0";
const STALE_MS         = 3 * 60 * 60 * 1000;   // 3 horas antes de considerar dato viejo
const FORECAST_DIAS    = 16;                     // días del panel de pronóstico
const AWC_DEFAULT_MM   = 150;                    // mm por defecto si no hay configuración

// Niveles de alerta en orden creciente de criticidad
const NIVEL_ORDEN = { verde: 0, azul: 1, amarillo: 2, naranja: 3, rojo: 4 };

// Umbral de Ks por nivel de estrés (FAO-56)
const KS_NIVELES = {
  sin_estres: 1.00,
  leve:       0.80,
  moderado:   0.50,
  severo:     0.00,
};

// Duración estimada de campaña por cultivo (días) — para % avance
const DURACION_CAMPANA = {
  soja:    145,
  maiz:    160,
  trigo:   190,
  girasol: 130,
};

// LS keys de lectura
const LS_FEN_ACTIVO     = "am_fenologia_activo";
const LS_FEN_KC_HOY     = "am_fen_kc_hoy";
const LS_FEN_ETAPA_HOY  = "am_fen_etapa_hoy";
const LS_FEN_GDD_ACUM   = "am_fen_gdd_acum";
const LS_HID_AGUA       = "am_hid_agua_hoy";
const LS_HID_DEFICIT    = "am_hid_deficit_hoy";
const LS_HID_ETC        = "am_hid_etc_acum";
const LS_HID_ET0        = "am_hid_et0_acum";
const LS_HID_LLUVIA     = "am_hid_lluvia_acum";
const LS_HID_KS         = "am_hid_ks_hoy";
const LS_HID_ESTRES     = "am_hid_estres_hoy";
const LS_HID_ACTIVO     = "am_hidrico_activo";
const LS_HID_RESUMEN    = "am_hid_resumen_etapas";
const LS_ALERTAS        = "am_alertas_activas";
const LS_ALERTAS_NIV    = "am_alertas_nivel_max";
const LS_SIEMBRA_LAT    = "am_siembra_lat";
const LS_SIEMBRA_LON    = "am_siembra_lon";
const LS_SIEMBRA_CULT   = "am_siembra_cultivo";
const LS_SIEMBRA_FECHA  = "am_siembra_fecha";
const LS_SIEMBRA_LOTE   = "am_siembra_lote";
const LS_LOTE_AWC       = "am_lote_awc_mm";
const LS_MODO           = "am_modo_activo";
const LS_ENSO_FASE      = "am_enso_fase";
const LS_ENSO_FACTOR    = "am_enso_factor";
const LS_CAMPANA_ID     = "am_campana_activa_id";
const LS_CIERRE         = "am_cierre_activo";

// LS keys de escritura
const LS_SEG_ACTIVO     = "am_seguimiento_activo";
const LS_SEG_TS         = "am_seguimiento_ts";

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES INTERNAS
// ─────────────────────────────────────────────────────────────────────────────

function _lsGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function _lsSet(key, val) {
  try { localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val)); }
  catch (_) { /* cuota excedida — ignorar */ }
}
function _lsNum(key, fallback = null) {
  const v = parseFloat(_lsGet(key));
  return isNaN(v) ? fallback : v;
}
function _lsJSON(key) {
  try { return JSON.parse(_lsGet(key)); } catch (_) { return null; }
}

/** Diferencia en días entre dos fechas ISO (b - a). */
function _diasEntre(a, b) {
  try {
    const da = new Date(a), db = new Date(b);
    return Math.round((db - da) / 86400000);
  } catch (_) { return null; }
}

/** Fecha ISO de hoy (yyyy-mm-dd). */
function _hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Acceso a módulo opcional (puede no estar cargado en el entorno). */
function _mod(nombre) {
  if (typeof window !== "undefined" && window[nombre]) return window[nombre];
  try { return require(`./${nombre.toLowerCase()}.js`); } catch (_) { return null; }
}

/**
 * Clasifica el nivel de estrés a partir de Ks.
 * @param {number|null} ks
 * @returns {"sin_estres"|"leve"|"moderado"|"severo"}
 */
function _clasificarEstres(ks) {
  if (ks === null || ks === undefined) return "sin_estres";
  if (ks >= KS_NIVELES.sin_estres) return "sin_estres";
  if (ks >= KS_NIVELES.leve)       return "leve";
  if (ks >= KS_NIVELES.moderado)   return "moderado";
  return "severo";
}

/**
 * Calcula el % de avance de la campaña (0–100).
 * @param {string|null} fechaSiembra ISO
 * @param {string} cultivo
 * @param {string|null} fechaCosechaEst ISO
 * @returns {number}
 */
function _pctAvance(fechaSiembra, cultivo, fechaCosechaEst) {
  if (!fechaSiembra) return 0;
  const hoy    = _hoyISO();
  const diaSiem = _diasEntre(fechaSiembra, hoy) ?? 0;
  const durTotal = fechaCosechaEst
    ? (_diasEntre(fechaSiembra, fechaCosechaEst) ?? DURACION_CAMPANA[cultivo] ?? 150)
    : (DURACION_CAMPANA[cultivo] ?? 150);
  return Math.min(100, Math.max(0, Math.round((diaSiem / durTotal) * 100)));
}

/**
 * Determina el color de semáforo a partir del % de AWC disponible.
 * Espeja los umbrales de alertas.js §5.3.
 * @param {number} pctAWC
 * @returns {"verde"|"amarillo"|"naranja"|"rojo"}
 */
function _semaforoHidrico(pctAWC) {
  if (pctAWC <= 20) return "rojo";
  if (pctAWC <= 35) return "naranja";
  if (pctAWC <= 50) return "amarillo";
  return "verde";
}

// ─────────────────────────────────────────────────────────────────────────────
// LECTURA DE ESTADO INTEGRADO (sync)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lee todos los valores relevantes de localStorage y los devuelve en una sola
 * estructura normalizada. Nunca lanza excepción.
 * @returns {object} estado bruto
 */
function _leerEstado() {
  const fen    = _lsJSON(LS_FEN_ACTIVO) ?? {};
  const hid    = _lsJSON(LS_HID_ACTIVO) ?? {};
  const alertas = _lsJSON(LS_ALERTAS) ?? [];

  return {
    // Fenología
    fen,
    etapaHoy:     _lsGet(LS_FEN_ETAPA_HOY),
    kcHoy:        _lsNum(LS_FEN_KC_HOY),
    gddAcum:      _lsNum(LS_FEN_GDD_ACUM),

    // Hídrico
    hid,
    aguaHoy:      _lsNum(LS_HID_AGUA),
    deficitHoy:   _lsNum(LS_HID_DEFICIT),
    etcAcum:      _lsNum(LS_HID_ETC),
    et0Acum:      _lsNum(LS_HID_ET0),
    lluviaAcum:   _lsNum(LS_HID_LLUVIA),
    ksHoy:        _lsNum(LS_HID_KS),
    estresHoy:    _lsGet(LS_HID_ESTRES),
    resumenEtapas: _lsJSON(LS_HID_RESUMEN) ?? [],

    // Alertas
    alertas,
    nivelMax:     _lsGet(LS_ALERTAS_NIV) ?? "verde",

    // Siembra / lote
    lat:     _lsNum(LS_SIEMBRA_LAT),
    lon:     _lsNum(LS_SIEMBRA_LON),
    cultivo: _lsGet(LS_SIEMBRA_CULT) ?? "soja",
    fechaSiembra: _lsGet(LS_SIEMBRA_FECHA),
    lote:    _lsGet(LS_SIEMBRA_LOTE),
    awcMm:   _lsNum(LS_LOTE_AWC) ?? AWC_DEFAULT_MM,

    // Campaña / modo
    modo:        _lsGet(LS_MODO) ?? "planificacion",
    faseENSO:    _lsGet(LS_ENSO_FASE) ?? "neutro",
    factorENSO:  _lsNum(LS_ENSO_FACTOR, 1.0),
    campanaId:   _lsGet(LS_CAMPANA_ID),
    cierre:      _lsJSON(LS_CIERRE),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTRUCCIÓN DE KPIs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve los 10 KPIs principales del dashboard.
 * Todos los valores son números o null; la UI decide el formato.
 *
 * @returns {KPIs}
 */
function getKPIs() {
  const e = _leerEstado();

  const pctAWC  = e.awcMm > 0 ? Math.round((e.aguaHoy / e.awcMm) * 100) : null;
  const semaforo = pctAWC !== null ? _semaforoHidrico(pctAWC) : "verde";
  const estres  = e.estresHoy ?? _clasificarEstres(e.ksHoy);

  return {
    // Hídrico
    aguaMm:        e.aguaHoy,
    awcMm:         e.awcMm,
    pctAWC,
    semaforoHidrico: semaforo,
    etcAcumMm:     e.etcAcum,
    et0AcumMm:     e.et0Acum,
    lluviaAcumMm:  e.lluviaAcum,
    deficitAcumMm: e.deficitHoy,

    // Estrés
    ksHoy:   e.ksHoy,
    estresHoy: estres,

    // Fenología rápida
    kcHoy:   e.kcHoy,
    gddAcum: e.gddAcum,

    // Campaña
    modo:       e.modo,
    faseENSO:   e.faseENSO,
    cultivo:    e.cultivo,
    lote:       e.lote,
    campanaId:  e.campanaId,
    campanaTerminada: !!e.cierre,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ETAPA ACTUAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Información completa de la etapa fenológica actual.
 * @returns {EtapaInfo|null}
 */
function getEtapaActual() {
  const e = _leerEstado();
  const { fen, etapaHoy, cultivo, fechaSiembra } = e;
  if (!fen || !fen.etapas) return null;

  const etapas = fen.etapas ?? [];
  const idx    = etapas.findIndex(et => et.id === etapaHoy);
  const etapa  = idx >= 0 ? etapas[idx] : (etapas[0] ?? null);
  if (!etapa) return null;

  const siguiente = idx >= 0 && idx + 1 < etapas.length ? etapas[idx + 1] : null;
  const hoy       = _hoyISO();

  // Días restantes en la etapa actual (si tiene fecha de fin estimada)
  let diasRestantesEtapa = null;
  if (etapa.fechaFin) {
    diasRestantesEtapa = Math.max(0, _diasEntre(hoy, etapa.fechaFin) ?? 0);
  }

  // Días hasta cosecha estimada
  let diasHastaCosecha = null;
  if (fen.fechaCosechaEst) {
    diasHastaCosecha = Math.max(0, _diasEntre(hoy, fen.fechaCosechaEst) ?? 0);
  }

  return {
    etapaId:             etapa.id,
    etapaNombre:         etapa.nombre,
    esCritica:           etapa.esCritica ?? false,
    kcHoy:               e.kcHoy,
    gddAcum:             e.gddAcum,
    gddEtapa:            etapa.gdd ?? null,
    diasDesdeSiembra:    fechaSiembra ? _diasEntre(fechaSiembra, hoy) : null,
    diasRestantesEtapa,
    etapaSiguienteId:    siguiente?.id ?? null,
    etapaSiguienteNombre: siguiente?.nombre ?? null,
    diasHastaCosechaEst: diasHastaCosecha,
    fechaCosechaEst:     fen.fechaCosechaEst ?? null,
    porcentajeAvance:    _pctAvance(fechaSiembra, cultivo, fen.fechaCosechaEst),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL DE ALERTAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el panel de alertas estructurado para el dashboard.
 * @returns {AlertPanel}
 */
function getAlertPanel() {
  const e = _leerEstado();
  const alertas = Array.isArray(e.alertas) ? e.alertas : [];

  const nivelMax = alertas.reduce((max, a) => {
    return (NIVEL_ORDEN[a.nivel] ?? 0) > (NIVEL_ORDEN[max] ?? 0) ? a.nivel : max;
  }, "verde");

  return {
    nivel:     nivelMax,
    activas:   alertas,
    count:     alertas.length,
    hayRojo:   alertas.some(a => a.nivel === "rojo"),
    hayNaranja: alertas.some(a => a.nivel === "naranja"),
    hayAzul:   alertas.some(a => a.nivel === "azul"),
    hidricas:  alertas.filter(a => a.tipo === "hidrico"),
    pluvio:    alertas.filter(a => a.tipo === "pluviometrico"),
    termicas:  alertas.filter(a => a.tipo === "termico"),
    fungicas:  alertas.filter(a => a.tipo === "fungico"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRONÓSTICO 16 DÍAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Proyección de alertas para los próximos `dias` días.
 * Delega en Alertas.proyectarAlertas() si está disponible.
 * Si no, deriva una proyección simplificada desde el balance hídrico activo.
 *
 * @param {number} [dias=16]
 * @returns {PronosticoDia[]}
 */
function getPronostico(dias = FORECAST_DIAS) {
  const Alertas = _mod("Alertas");
  const e       = _leerEstado();

  // Camino ideal: delegar en el módulo de alertas
  if (Alertas && typeof Alertas.proyectarAlertas === "function") {
    const balance = e.hid;
    return Alertas.proyectarAlertas(balance, dias);
  }

  // Fallback: derivar desde los días del balance hídrico activo
  const diasBalance = (e.hid?.diasBalance ?? e.hid?.dias ?? []);
  const hoy = _hoyISO();
  const awcMm = e.awcMm;

  return diasBalance
    .filter(d => d.fecha > hoy)
    .slice(0, dias)
    .map(d => {
      const pct = awcMm > 0 ? Math.round((d.agua / awcMm) * 100) : null;
      return {
        fecha:   d.fecha,
        agua:    d.agua,
        pctAWC:  pct,
        ks:      d.ks ?? null,
        deficit: d.deficit ?? null,
        nivel:   pct !== null ? _semaforoHidrico(pct) : "verde",
        alertas: [],
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD INTEGRADO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye la estructura completa del dashboard a partir del estado actual
 * en localStorage. Operación 100% síncrona, sin llamadas de red.
 *
 * @returns {Dashboard}
 */
function getDashboard() {
  const e         = _leerEstado();
  const kpis      = getKPIs();
  const etapa     = getEtapaActual();
  const alertPanel = getAlertPanel();
  const pronostico = getPronostico(FORECAST_DIAS);

  // Recomendación principal
  const recomendacion = _generarRecomendacion(kpis, etapa, alertPanel);

  // Resumen de etapas del balance (para tabla de etapas)
  const etapas = e.resumenEtapas ?? [];

  return {
    version:     VERSION_SEG,
    generadoEn:  new Date().toISOString(),
    modo:        e.modo,
    cultivo:     e.cultivo,
    lote:        e.lote,
    campanaId:   e.campanaId,
    faseENSO:    e.faseENSO,
    factorENSO:  e.factorENSO,
    lat:         e.lat,
    lon:         e.lon,
    campanaTerminada: !!e.cierre,

    kpis,
    etapa,
    alertas: alertPanel,
    pronostico,
    etapas,

    recomendacion,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOMENDACIÓN AUTOMÁTICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el texto de recomendación principal para el día.
 * @param {object} kpis
 * @param {object|null} etapa
 * @param {object} alertPanel
 * @returns {string}
 */
function _generarRecomendacion(kpis, etapa, alertPanel) {
  const { cultivo, modo, pctAWC, estresHoy, ksHoy } = kpis;
  const nombreEtapa  = etapa?.etapaNombre ?? "etapa desconocida";
  const esCritica    = etapa?.esCritica ?? false;
  const hayRojo      = alertPanel.hayRojo;
  const hayNaranja   = alertPanel.hayNaranja;
  const cultivoNom   = cultivo ? cultivo.charAt(0).toUpperCase() + cultivo.slice(1) : "Cultivo";

  // ─── Alerta roja: estrés severo en período crítico ───────────────────────
  if (hayRojo && esCritica) {
    return `⛔ ${cultivoNom} en ESTRÉS SEVERO durante etapa crítica (${nombreEtapa}). ` +
      `Agua disponible: ${pctAWC !== null ? pctAWC + "%" : "s/d"} de la AWC. ` +
      `Riego urgente. Cada día sin agua puede costar rendimiento irreversible.`;
  }

  if (hayRojo) {
    return `⛔ Estrés severo detectado — agua en perfil criticamente baja (${pctAWC ?? "—"}% AWC). ` +
      `Riego inmediato.`;
  }

  // ─── Alerta naranja ───────────────────────────────────────────────────────
  if (hayNaranja && esCritica) {
    return `⚠️ Déficit hídrico en etapa crítica (${nombreEtapa}). ` +
      `Ks = ${ksHoy !== null ? ksHoy.toFixed(2) : "—"}. ` +
      `Programar riego en las próximas 48 h para proteger el llenado de grano.`;
  }

  if (hayNaranja) {
    return `⚠️ Agua en perfil por debajo del umbral recomendado (${pctAWC ?? "—"}% AWC). ` +
      `Evaluar riego en las próximas 48 h.`;
  }

  // ─── Exceso hídrico ───────────────────────────────────────────────────────
  if (alertPanel.alertas.some(a => a.nivel === "azul")) {
    return `🔵 Exceso pluviométrico acumulado. Riesgo de enfermedades fúngicas en ${nombreEtapa}. ` +
      `Evaluar aplicación preventiva de fungicida.`;
  }

  // ─── Condición normal o leve ──────────────────────────────────────────────
  if (estresHoy === "sin_estres") {
    if (esCritica) {
      return `✅ Balance hídrico adecuado en etapa crítica (${nombreEtapa}). ` +
        `Agua: ${pctAWC ?? "—"}% AWC. Continuar monitoreo diario.`;
    }
    return `✅ ${cultivoNom} sin estrés hídrico. Agua: ${pctAWC ?? "—"}% AWC durante ${nombreEtapa}. ` +
      `Condiciones normales.`;
  }

  if (estresHoy === "leve") {
    return `🟡 Estrés hídrico leve (Ks ${ksHoy?.toFixed(2) ?? "—"}). ` +
      `Monitorear el nivel de agua en los próximos días.` +
      (esCritica ? ` ¡Etapa crítica activa (${nombreEtapa})!` : "");
  }

  if (estresHoy === "moderado") {
    return `🟠 Estrés hídrico moderado detectado en ${nombreEtapa}. ` +
      `Ks = ${ksHoy?.toFixed(2) ?? "—"}. Programar riego.`;
  }

  return `Condición hídrica: ${pctAWC ?? "—"}% AWC | Ks ${ksHoy?.toFixed(2) ?? "—"} | Modo: ${modo}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECCIÓN DE OBSOLESCENCIA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @returns {boolean} true si el último seguimiento fue hace más de 3 horas.
 */
function necesitaActualizacion() {
  const ts = _lsNum(LS_SEG_TS);
  if (ts === null) return true;
  return (Date.now() - ts) > STALE_MS;
}

/** @returns {number|null} timestamp (ms) de la última actualización. */
function getTimestampActualizacion() {
  return _lsNum(LS_SEG_TS);
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOT PERSISTIDO
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {Snapshot|null} último snapshot guardado en localStorage. */
function getSeguimientoActivo() {
  return _lsJSON(LS_SEG_ACTIVO);
}

// ─────────────────────────────────────────────────────────────────────────────
// ORQUESTACIÓN PRINCIPAL: actualizarSeguimiento
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Orquesta la actualización de todos los módulos y persiste el nuevo snapshot.
 *
 * En modo PLANIFICACIÓN: re-ejecuta la fenología y el balance hídrico con
 * datos históricos NASA POWER (sin llamadas de red adicionales si el caché
 * no venció), y re-evalúa las alertas.
 *
 * En modo SEGUIMIENTO: fuerza re-cálculo con OpenMeteo ERA5 + pronóstico
 * (OpenMeteo es llamado por Hidrico y Fenologia internamente).
 *
 * @param {object} [opts]
 * @param {boolean} [opts.forzar=false]   Fuerza actualización aunque no haya pasado el intervalo
 * @param {boolean} [opts.soloAlertas=false]  Solo re-evalúa alertas (no recalcula balance)
 * @returns {Promise<Dashboard>}
 */
async function actualizarSeguimiento(opts = {}) {
  const { forzar = false, soloAlertas = false } = opts;

  // Si los datos son frescos y no se fuerza, devolver snapshot existente
  if (!forzar && !necesitaActualizacion()) {
    const existente = getSeguimientoActivo();
    if (existente) return existente;
  }

  const e = _leerEstado();

  // ── 1. Actualizar Fenología ─────────────────────────────────────────────
  if (!soloAlertas) {
    const Fenologia = _mod("Fenologia");
    if (Fenologia && typeof Fenologia.calcularFenologia === "function" &&
        e.lat !== null && e.lon !== null && e.fechaSiembra) {
      try {
        await Fenologia.calcularFenologia({
          lat:          e.lat,
          lon:          e.lon,
          cultivo:      e.cultivo,
          fechaSiembra: e.fechaSiembra,
          modo:         e.modo,
        });
      } catch (err) {
        console.warn("[seguimiento] Fenología no actualizó:", err.message ?? err);
      }
    }

    // ── 2. Actualizar Balance Hídrico ───────────────────────────────────────
    const Hidrico = _mod("Hidrico");
    if (Hidrico && typeof Hidrico.calcularBalanceHidrico === "function" &&
        e.lat !== null && e.lon !== null && e.fechaSiembra) {
      try {
        await Hidrico.calcularBalanceHidrico({
          lat:          e.lat,
          lon:          e.lon,
          cultivo:      e.cultivo,
          fechaSiembra: e.fechaSiembra,
          modo:         e.modo,
        });
      } catch (err) {
        console.warn("[seguimiento] Hídrico no actualizó:", err.message ?? err);
      }
    }
  }

  // ── 3. Re-evaluar Alertas ───────────────────────────────────────────────
  const Alertas = _mod("Alertas");
  if (Alertas && typeof Alertas.evaluarAlertas === "function") {
    try {
      await Alertas.evaluarAlertas();
    } catch (err) {
      console.warn("[seguimiento] Alertas no evaluó:", err.message ?? err);
    }
  }

  // ── 4. Construir y persistir dashboard ─────────────────────────────────
  const dashboard = getDashboard();

  _lsSet(LS_SEG_ACTIVO, dashboard);
  _lsSet(LS_SEG_TS, String(Date.now()));

  return dashboard;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIÓN HTML
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera un panel HTML completo del estado actual de la campaña.
 * Diseño responsivo; color-coded por nivel de alerta.
 *
 * @param {Dashboard} [snapshot] — si se omite, llama getDashboard()
 * @returns {string} HTML completo
 */
function exportarHTML(snapshot) {
  const d = snapshot ?? getDashboard();
  const k = d.kpis ?? {};
  const a = d.alertas ?? {};
  const etapa = d.etapa ?? {};
  const pronostico = Array.isArray(d.pronostico) ? d.pronostico : [];
  const etapas = Array.isArray(d.etapas) ? d.etapas : [];

  const fmt1 = v => (v !== null && v !== undefined) ? Number(v).toFixed(1) : "—";
  const fmtI = v => (v !== null && v !== undefined) ? Math.round(v) : "—";
  const fmtPct = v => (v !== null && v !== undefined) ? Math.round(v) + "%" : "—";

  const COLORES_NIV = {
    verde:    "#27AE60",
    amarillo: "#F39C12",
    naranja:  "#E67E22",
    rojo:     "#E74C3C",
    azul:     "#2980B9",
  };

  const colorNivel = n => COLORES_NIV[n] ?? "#888";
  const badgeNivel = (n, txt) =>
    `<span style="background:${colorNivel(n)};color:#fff;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700">${txt ?? n.toUpperCase()}</span>`;

  // ── Tarjetas KPI ─────────────────────────────────────────────────────────
  const kpiCards = [
    { label: "Agua en Perfil",   valor: `${fmtI(k.aguaMm)} mm`,       sub: `${fmtPct(k.pctAWC)} AWC` },
    { label: "Estrés Hídrico",  valor: (k.estresHoy ?? "—").replace("_", " "), sub: `Ks ${fmt1(k.ksHoy)}` },
    { label: "ETc Acumulado",   valor: `${fmtI(k.etcAcumMm)} mm`,     sub: `ET₀ acum: ${fmtI(k.et0AcumMm)} mm` },
    { label: "Lluvia Acumulada", valor: `${fmtI(k.lluviaAcumMm)} mm`, sub: `Déficit: ${fmtI(k.deficitAcumMm)} mm` },
    { label: "Kc Hoy",          valor: fmt1(k.kcHoy),                  sub: etapa.etapaNombre ?? "—" },
    { label: "GDD Acumulado",   valor: `${fmtI(k.gddAcum)} °Cd`,      sub: `Avance: ${fmtPct(etapa.porcentajeAvance)}` },
  ].map(c => `
    <div style="background:#fff;border-radius:10px;padding:16px 20px;box-shadow:0 2px 8px rgba(0,0,0,.08);min-width:150px;flex:1">
      <div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.5px">${c.label}</div>
      <div style="font-size:28px;font-weight:700;color:#1a1a2e;margin:4px 0">${c.valor}</div>
      <div style="font-size:12px;color:#999">${c.sub}</div>
    </div>`).join("");

  // ── Alertas activas ──────────────────────────────────────────────────────
  const alertasHTML = a.count > 0
    ? (a.activas ?? []).map(al => `
      <div style="border-left:4px solid ${colorNivel(al.nivel)};padding:10px 14px;margin-bottom:8px;background:#fafafa;border-radius:0 8px 8px 0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          ${badgeNivel(al.nivel)}
          <strong>${al.titulo}</strong>
        </div>
        <div style="font-size:13px;color:#444">${al.mensaje}</div>
        <div style="font-size:12px;color:#666;margin-top:4px"><strong>Acción:</strong> ${al.accion}</div>
      </div>`).join("")
    : `<div style="padding:12px;color:#27AE60;font-weight:600">✅ Sin alertas activas</div>`;

  // ── Pronóstico ──────────────────────────────────────────────────────────
  const pronosticoHTML = pronostico.length > 0
    ? `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px">
        ${pronostico.slice(0, FORECAST_DIAS).map(p => {
          const col = colorNivel(p.nivel ?? "verde");
          const dd  = (p.fecha ?? "").slice(8, 10);
          const mm  = (p.fecha ?? "").slice(5, 7);
          return `<div style="text-align:center;min-width:44px;padding:8px 6px;background:${col}18;border-top:3px solid ${col};border-radius:6px">
            <div style="font-size:11px;color:#666">${mm}/${dd}</div>
            <div style="font-weight:700;color:${col};font-size:13px">${fmtI(p.agua) ?? "—"}</div>
            <div style="font-size:10px;color:#888">mm</div>
          </div>`;
        }).join("")}
      </div>`
    : `<p style="color:#999;font-size:13px">Sin datos de pronóstico</p>`;

  // ── Tabla de etapas ──────────────────────────────────────────────────────
  const etapasHTML = etapas.length > 0
    ? `<table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f0f4f8">
          <th style="text-align:left;padding:8px">Etapa</th>
          <th style="text-align:right;padding:8px">ETc (mm)</th>
          <th style="text-align:right;padding:8px">Lluvia (mm)</th>
          <th style="text-align:right;padding:8px">Déficit (mm)</th>
          <th style="text-align:right;padding:8px">Ks prom.</th>
        </tr></thead>
        <tbody>
          ${etapas.map((et, i) => `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8f9fa"}${et.esCritica ? ";font-weight:700" : ""}">
            <td style="padding:7px 8px">${et.esCritica ? "⚑ " : ""}${et.nombre}</td>
            <td style="text-align:right;padding:7px 8px">${fmt1(et.etcMm ?? et.etc)}</td>
            <td style="text-align:right;padding:7px 8px">${fmt1(et.lluviaMm ?? et.lluvia)}</td>
            <td style="text-align:right;padding:7px 8px;color:${(et.deficitMm ?? et.deficit ?? 0) > 5 ? "#E74C3C" : "inherit"}">${fmt1(et.deficitMm ?? et.deficit)}</td>
            <td style="text-align:right;padding:7px 8px">${fmt1(et.ksPromedio ?? et.ks)}</td>
          </tr>`).join("")}
        </tbody>
      </table>`
    : `<p style="color:#999;font-size:13px">Sin datos de etapas</p>`;

  // ── Etapa actual (panel lateral) ─────────────────────────────────────────
  const etapaActualHTML = etapa ? `
    <div style="background:${etapa.esCritica ? "#FFF3CD" : "#E8F5E9"};border-radius:10px;padding:16px 20px">
      <div style="font-size:12px;color:#666;text-transform:uppercase">Etapa Actual</div>
      <div style="font-size:20px;font-weight:700;margin:4px 0">${etapa.etapaNombre ?? "—"}
        ${etapa.esCritica ? '<span style="font-size:12px;background:#E74C3C;color:#fff;padding:2px 8px;border-radius:12px;margin-left:6px">CRÍTICA</span>' : ""}
      </div>
      ${etapa.diasRestantesEtapa !== null
        ? `<div style="font-size:13px;color:#555">Días restantes en etapa: <strong>${etapa.diasRestantesEtapa}</strong></div>` : ""}
      ${etapa.etapaSiguienteNombre
        ? `<div style="font-size:12px;color:#777;margin-top:4px">Siguiente: ${etapa.etapaSiguienteNombre}</div>` : ""}
      ${etapa.diasHastaCosechaEst !== null
        ? `<div style="font-size:12px;color:#777">Cosecha estimada en <strong>${etapa.diasHastaCosechaEst}</strong> días</div>` : ""}
      <div style="margin-top:10px;background:#fff;border-radius:6px;overflow:hidden;height:8px">
        <div style="width:${etapa.porcentajeAvance ?? 0}%;background:#27AE60;height:100%;transition:width .3s"></div>
      </div>
      <div style="font-size:11px;color:#888;margin-top:3px">Avance de campaña: ${fmtPct(etapa.porcentajeAvance)}</div>
    </div>` : "";

  // ── ENSO badge ────────────────────────────────────────────────────────────
  const ensoColor = { nino: "#E74C3C", nina: "#2980B9", neutro: "#27AE60" }[d.faseENSO ?? "neutro"] ?? "#888";
  const ensoLabel = { nino: "El Niño", nina: "La Niña", neutro: "Neutro" }[d.faseENSO ?? "neutro"] ?? d.faseENSO;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AGROMOTOR v2.0 — Seguimiento: ${d.cultivo ?? ""} · ${d.lote ?? ""}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#F0F4F8;color:#1a1a2e;padding:20px}
    h2{font-size:16px;font-weight:700;color:#2c3e50;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e0e6ef}
    .card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.07);margin-bottom:20px}
    @media(max-width:700px){.kpi-grid{flex-direction:column!important}}
  </style>
</head>
<body>
  <!-- Encabezado -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px">AGROMOTOR v2.0 — Monitoreo</div>
      <div style="font-size:24px;font-weight:700">${(d.cultivo ?? "").charAt(0).toUpperCase() + (d.cultivo ?? "").slice(1)} · Lote ${d.lote ?? "—"}</div>
      <div style="font-size:13px;color:#777;margin-top:2px">
        Modo: <strong>${d.modo === "seguimiento" ? "Seguimiento (tiempo real)" : "Planificación"}</strong> &nbsp;|&nbsp;
        ENSO: <span style="color:${ensoColor};font-weight:700">${ensoLabel}</span> &nbsp;|&nbsp;
        ${d.lat !== null ? `${d.lat?.toFixed(2)}°, ${d.lon?.toFixed(2)}°` : "Ubicación no configurada"}
      </div>
    </div>
    <div style="text-align:right">
      ${badgeNivel(a.nivel ?? "verde", (a.nivel ?? "verde").toUpperCase())}
      <div style="font-size:11px;color:#aaa;margin-top:4px">${new Date(d.generadoEn).toLocaleString("es-AR")}</div>
    </div>
  </div>

  <!-- Recomendación del día -->
  <div style="background:#fff;border-left:5px solid ${colorNivel(a.nivel ?? "verde")};padding:14px 18px;border-radius:0 10px 10px 0;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,.06)">
    <div style="font-size:12px;color:#666;text-transform:uppercase;margin-bottom:4px">Recomendación del Día</div>
    <div style="font-size:15px;line-height:1.5">${d.recomendacion ?? ""}</div>
  </div>

  <!-- KPI Grid -->
  <div class="card">
    <h2>Estado Actual</h2>
    <div class="kpi-grid" style="display:flex;flex-wrap:wrap;gap:12px">${kpiCards}</div>
  </div>

  <!-- Etapa actual + Alertas (2 columnas) -->
  <div style="display:flex;gap:20px;flex-wrap:wrap">
    <div style="flex:1;min-width:280px">
      <div class="card">
        <h2>Fenología</h2>
        ${etapaActualHTML}
      </div>
    </div>
    <div style="flex:1;min-width:280px">
      <div class="card">
        <h2>Alertas Activas${a.count > 0 ? ` <span style="background:#E74C3C;color:#fff;border-radius:12px;padding:1px 8px;font-size:12px">${a.count}</span>` : ""}</h2>
        ${alertasHTML}
      </div>
    </div>
  </div>

  <!-- Pronóstico 16 días -->
  <div class="card">
    <h2>Pronóstico Hídrico — ${FORECAST_DIAS} Días</h2>
    <p style="font-size:12px;color:#888;margin-bottom:10px">Agua en perfil proyectada (mm). Color = nivel de alerta esperado.</p>
    ${pronosticoHTML}
  </div>

  <!-- Balance por etapa -->
  <div class="card">
    <h2>Balance por Etapa Fenológica</h2>
    ${etapasHTML}
  </div>

  <div style="text-align:center;color:#aaa;font-size:11px;margin-top:20px">
    AGROMOTOR v${VERSION_SEG} &nbsp;·&nbsp; Metodología FAO-56 &nbsp;·&nbsp; Hargreaves-Samani calibrado Pampas Argentinas
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUMEN EN TEXTO PLANO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resumen de texto plano del estado actual (para mensajes / logs).
 * @returns {string}
 */
function exportarResumen() {
  const d = getDashboard();
  const k = d.kpis ?? {};
  const a = d.alertas ?? {};
  const etapa = d.etapa ?? {};

  const fmt = v => (v !== null && v !== undefined) ? Number(v).toFixed(1) : "—";
  const fmtI = v => (v !== null && v !== undefined) ? Math.round(v) : "—";

  const lineas = [
    `AGROMOTOR v${VERSION_SEG} — Seguimiento ${new Date().toLocaleDateString("es-AR")}`,
    `Cultivo: ${d.cultivo ?? "—"} | Lote: ${d.lote ?? "—"} | Modo: ${d.modo}`,
    `ENSO: ${d.faseENSO ?? "neutro"} (factor ${fmt(d.factorENSO)})`,
    "",
    `── HÍDRICO ──`,
    `Agua en perfil: ${fmtI(k.aguaMm)} mm (${k.pctAWC ?? "—"}% AWC) → ${(k.semaforoHidrico ?? "verde").toUpperCase()}`,
    `ETc acum: ${fmtI(k.etcAcumMm)} mm | Lluvia acum: ${fmtI(k.lluviaAcumMm)} mm | Déficit: ${fmtI(k.deficitAcumMm)} mm`,
    `Ks hoy: ${fmt(k.ksHoy)} | Estrés: ${(k.estresHoy ?? "—").replace("_", " ")}`,
    "",
    `── FENOLOGÍA ──`,
    `Etapa: ${etapa.etapaNombre ?? "—"}${etapa.esCritica ? " [CRÍTICA]" : ""}`,
    `Kc hoy: ${fmt(k.kcHoy)} | GDD acum: ${fmtI(k.gddAcum)} °Cd | Avance: ${etapa.porcentajeAvance ?? "—"}%`,
    etapa.diasHastaCosechaEst !== null
      ? `Cosecha estimada en ${etapa.diasHastaCosechaEst} días (${etapa.fechaCosechaEst ?? "—"})`
      : "",
    "",
    `── ALERTAS (${a.count ?? 0}) ──`,
    ...(a.activas ?? []).map(al => `[${al.nivel.toUpperCase()}] ${al.titulo}: ${al.accion}`),
    a.count === 0 ? "Sin alertas activas." : "",
    "",
    `── RECOMENDACIÓN ──`,
    d.recomendacion ?? "",
  ].filter(l => l !== undefined);

  return lineas.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIÓN DUAL (CommonJS + global de navegador)
// ─────────────────────────────────────────────────────────────────────────────

const _exports = {
  // Principal (async — orquesta actualización)
  actualizarSeguimiento,

  // Lectores síncronos (para dashboard en tiempo real)
  getSeguimientoActivo,
  getDashboard,
  getKPIs,
  getAlertPanel,
  getPronostico,
  getEtapaActual,

  // Control de obsolescencia
  necesitaActualizacion,
  getTimestampActualizacion,

  // Exportaciones
  exportarHTML,
  exportarResumen,

  // Metadatos
  VERSION: VERSION_SEG,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = _exports;
}
if (typeof window !== "undefined") {
  window.Seguimiento = _exports;
}
