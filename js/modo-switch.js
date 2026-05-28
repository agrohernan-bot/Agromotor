/**
 * modo-switch.js — AGROMOTOR v2.0
 *
 * Interruptor global de modo: PLANIFICACIÓN vs SEGUIMIENTO.
 *
 * Este módulo es el árbitro que determina qué fuente de datos debe usar
 * cada módulo del sistema:
 *
 *   PLANIFICACIÓN  → NASA POWER (histórico) + barbecho.js
 *   SEGUIMIENTO    → OpenMeteo ERA5 (actual) + sensores/campo
 *
 * El modo se persiste en localStorage para sobrevivir recargas de página.
 * Todos los módulos (fenologia.js, hidrico.js, siembra.js, etc.) deben
 * consultar getModo() antes de elegir su fuente de datos.
 *
 * Patrón de uso:
 *   import { getModo, setModo, esPlanificacion, esSeguimiento } from './modo-switch.js';
 *
 *   if (esPlanificacion()) {
 *     // Usar NASA POWER, fechas planificadas
 *   } else {
 *     // Usar OpenMeteo, fechas reales, sensores
 *   }
 *
 * También emite un CustomEvent "am:modo-cambio" en el window (browser)
 * para que los componentes UI puedan reaccionar sin polling.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY_MODO    = "am_modo_global";
const LS_KEY_LOG     = "am_modo_log";
const EVENTO_CAMBIO  = "am:modo-cambio";

/** @typedef {"planificacion"|"seguimiento"} Modo */

/** @type {Modo} */
const MODO_DEFAULT = "planificacion";

const MODOS_VALIDOS = ["planificacion", "seguimiento"];

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO INTERNO (para contextos sin localStorage, e.g. Node/tests)
// ─────────────────────────────────────────────────────────────────────────────

let _modoMemoria = MODO_DEFAULT;

// ─────────────────────────────────────────────────────────────────────────────
// LECTURA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el modo activo: "planificacion" | "seguimiento".
 * @returns {Modo}
 */
function getModo() {
  try {
    const raw = localStorage.getItem(LS_KEY_MODO);
    return MODOS_VALIDOS.includes(raw) ? raw : MODO_DEFAULT;
  } catch (_) {
    // Contexto sin localStorage (Node/tests)
    return _modoMemoria;
  }
}

/**
 * @returns {boolean} true si el sistema está en modo Planificación
 */
function esPlanificacion() { return getModo() === "planificacion"; }

/**
 * @returns {boolean} true si el sistema está en modo Seguimiento
 */
function esSeguimiento() { return getModo() === "seguimiento"; }

// ─────────────────────────────────────────────────────────────────────────────
// ESCRITURA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cambia el modo global del sistema.
 *
 * @param {Modo}   modo      "planificacion" | "seguimiento"
 * @param {Object} [meta]   Metadatos opcionales para el log de auditoría
 * @param {string} [meta.motivo]     Texto libre describiendo el cambio
 * @param {string} [meta.usuario]    ID/nombre del usuario que hace el cambio
 * @throws {Error} si el modo no es válido
 */
function setModo(modo, meta = {}) {
  if (!MODOS_VALIDOS.includes(modo)) {
    throw new Error(`Modo inválido: "${modo}". Usar "planificacion" o "seguimiento"`);
  }

  const modoAnterior = getModo();
  if (modo === modoAnterior) return;  // Sin cambio, sin evento

  // Persistir
  try {
    localStorage.setItem(LS_KEY_MODO, modo);
  } catch (_) {
    _modoMemoria = modo;
  }

  // Log de auditoría
  _registrarCambio(modoAnterior, modo, meta);

  // Notificar a la UI (browser)
  _emitirEvento(modoAnterior, modo, meta);
}

/**
 * Alterna entre planificacion ↔ seguimiento.
 * @param {Object} [meta]
 * @returns {Modo}  El nuevo modo activo
 */
function toggleModo(meta = {}) {
  const nuevo = esPlanificacion() ? "seguimiento" : "planificacion";
  setModo(nuevo, meta);
  return nuevo;
}

/**
 * Fuerza el modo a planificación (útil al crear una nueva campaña).
 * @param {Object} [meta]
 */
function activarPlanificacion(meta = {}) { setModo("planificacion", meta); }

/**
 * Fuerza el modo a seguimiento (útil al iniciar monitoreo de campaña activa).
 * @param {Object} [meta]
 */
function activarSeguimiento(meta = {}) { setModo("seguimiento", meta); }

// ─────────────────────────────────────────────────────────────────────────────
// LOG DE AUDITORÍA
// ─────────────────────────────────────────────────────────────────────────────

const MAX_LOG_ENTRIES = 50;

/**
 * Registra el cambio de modo en un log circular en localStorage.
 * @param {Modo}   anterior
 * @param {Modo}   nuevo
 * @param {Object} meta
 */
function _registrarCambio(anterior, nuevo, meta) {
  try {
    const raw = localStorage.getItem(LS_KEY_LOG);
    const log = raw ? JSON.parse(raw) : [];
    log.push({
      ts:       new Date().toISOString(),
      de:       anterior,
      a:        nuevo,
      motivo:   meta.motivo  ?? "",
      usuario:  meta.usuario ?? "",
    });
    // Mantener solo las últimas N entradas
    if (log.length > MAX_LOG_ENTRIES) log.splice(0, log.length - MAX_LOG_ENTRIES);
    localStorage.setItem(LS_KEY_LOG, JSON.stringify(log));
  } catch (_) { /* silencioso */ }
}

/**
 * Devuelve el historial de cambios de modo.
 * @returns {Array}
 */
function getLogCambios() {
  try {
    const raw = localStorage.getItem(LS_KEY_LOG);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTO DOM (browser)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emite "am:modo-cambio" y "am:modo-changed" en window.
 * @param {Modo}   anterior
 * @param {Modo}   nuevo
 * @param {Object} meta
 */
function _emitirEvento(anterior, nuevo, meta) {
  try {
    const detail = { anterior, nuevo, meta };
    window.dispatchEvent(new CustomEvent(EVENTO_CAMBIO, { detail, bubbles: true }));
    // Alias solicitado por la UI (nombre en inglés, detail simplificado)
    window.dispatchEvent(new CustomEvent("am:modo-changed", {
      detail: { modo: nuevo, anterior, meta },
      bubbles: true,
    }));
  } catch (_) { /* Node o contexto sin window */ }
}

/**
 * Registra un listener para cambios de modo (browser).
 * @param {function({ anterior, nuevo, meta }):void} callback
 * @returns {function}  Función para remover el listener
 */
function onModoCambio(callback) {
  const handler = (e) => callback(e.detail);
  try {
    window.addEventListener(EVENTO_CAMBIO, handler);
    return () => window.removeEventListener(EVENTO_CAMBIO, handler);
  } catch (_) {
    return () => {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZADO UI (badge de modo en el header)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Actualiza el badge visual de modo en el elemento con id="am-modo-badge".
 * Si el elemento no existe, no hace nada.
 */
function renderizarBadge() {
  const el = document.getElementById("am-modo-badge");
  if (!el) return;

  const modo       = getModo();
  const isPlan     = modo === "planificacion";
  const label      = isPlan ? "PLANIFICACIÓN" : "SEGUIMIENTO";
  const bgColor    = isPlan ? "#1B4F72" : "#2D6A4F";
  const icono      = isPlan ? "📋" : "📡";
  const tooltip    = isPlan
    ? "Usando datos históricos NASA POWER — modo prospectivo"
    : "Usando datos en tiempo real OpenMeteo — modo monitoreo";

  el.innerHTML = `
    <span class="am-modo-badge"
          style="background:${bgColor};color:#fff;padding:4px 10px;border-radius:12px;
                 font-size:12px;font-weight:700;letter-spacing:0.5px;cursor:default;"
          title="${tooltip}">
      ${icono} ${label}
    </span>
  `;
}

/**
 * Inicializa el badge y escucha cambios futuros.
 * Llamar una vez en el arranque del módulo UI principal.
 */
function inicializarBadge() {
  renderizarBadge();
  onModoCambio(() => renderizarBadge());
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPATIBILIDAD CON MÓDULOS EXISTENTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escribe en las claves de localStorage que los módulos legacy (v1) leen.
 * Llamar tras cada setModo() si se necesita retrocompatibilidad.
 *
 * Claves legacy conocidas:
 *   am_modo_hidrico       → "planificacion" | "seguimiento"
 *   am_modo_fenologia     → "planificacion" | "seguimiento"
 */
function sincronizarModulosLegacy() {
  const m = getModo();
  try {
    localStorage.setItem("am_modo_hidrico",   m);
    localStorage.setItem("am_modo_fenologia", m);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO COMPLETO (para debugging / export)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Snapshot del estado actual del módulo (útil para debugging y tests).
 * @returns {Object}
 */
function getEstado() {
  return {
    modoActual:    getModo(),
    esPlanificacion: esPlanificacion(),
    esSeguimiento:   esSeguimiento(),
    logCambios:    getLogCambios(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API SIMPLIFICADA — alias y wrappers
// ─────────────────────────────────────────────────────────────────────────────

/** Inicializa el badge y el listener de cambios. Llamar una vez al cargar. */
function modoSwitchInit() {
  inicializarBadge();
}

/** Alterna entre planificación y seguimiento. Alias de toggleModo(). */
function modoSwitch(meta) {
  return toggleModo(meta);
}

/** Devuelve el modo activo. Alias de getModo(). */
function modoActual() {
  return getModo();
}

/**
 * Cambia el modo y actualiza la UI inmediatamente.
 * Emite "am:modo-changed" con { modo, anterior } vía setModo → _emitirEvento.
 * @param {Modo}   modo
 * @param {Object} [meta]
 */
function modoSetUI(modo, meta) {
  setModo(modo, meta);
  renderizarBadge();
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    // Lectura
    getModo,
    esPlanificacion,
    esSeguimiento,
    // Escritura
    setModo,
    toggleModo,
    activarPlanificacion,
    activarSeguimiento,
    // Log
    getLogCambios,
    // UI
    renderizarBadge,
    inicializarBadge,
    // Eventos
    onModoCambio,
    // Compat legacy
    sincronizarModulosLegacy,
    // Debug
    getEstado,
    // API simplificada
    modoSwitchInit,
    modoSwitch,
    modoActual,
    modoSetUI,
    // Constantes expuestas
    MODOS_VALIDOS,
    EVENTO_CAMBIO,
  };
} else if (typeof window !== "undefined") {
  window.ModoSwitch = {
    getModo,
    esPlanificacion,
    esSeguimiento,
    setModo,
    toggleModo,
    activarPlanificacion,
    activarSeguimiento,
    getLogCambios,
    renderizarBadge,
    inicializarBadge,
    onModoCambio,
    sincronizarModulosLegacy,
    getEstado,
    // API simplificada
    modoSwitchInit,
    modoSwitch,
    modoActual,
    modoSetUI,
  };
}
