// NOTA ARQUITECTURA: Este archivo no está cargado en app.html (versión actual).
// El arranque real vive en app.html + js/cache.js + js/nav.js.
// Ver docs/STATE_CONTRACT.md antes de modificar o reactivar.

/**
 * app.js — AGROMOTOR v2.0
 *
 * Punto de entrada y orquestador de la aplicación.
 *
 * Responsabilidades:
 *   1. Inicializar am_modo_global (ModoSwitch)
 *   2. Resolver e inicializar la campaña activa (am_campana_activa_id)
 *   3. Resolver e inicializar el lote activo (am_lote_activo)
 *   4. Registrar guards de navegación y event listeners globales
 *   5. Exponer la API de campaña/lote que consumen todos los módulos
 *   6. Coordinar el arranque de módulos secundarios (badge, nav, etc.)
 *
 * Flujo de arranque:
 *   App.init()
 *     ├── _inicializarModo()         → ModoSwitch.getModo() ya disponible
 *     ├── _cargarCampana()           → am_campana_activa_id disponible
 *     ├── _cargarLote()              → am_lote_activo disponible
 *     ├── _registrarEventListeners() → reacciona a cambios de campaña/lote
 *     └── _arrancarModulosUI()       → badge de modo, nav guards, etc.
 *
 * Todos los módulos (siembra, fenologia, hidrico, barbecho…) leen
 * am_campana_activa_id y am_lote_activo desde localStorage. app.js es
 * el único responsable de ESCRIBIR esas claves al inicio y al cambiar.
 *
 * Patrón de uso:
 *   import App from './app.js';
 *   document.addEventListener('DOMContentLoaded', () => App.init());
 *
 *   // O con callback de éxito:
 *   App.init({ onListo: ({ campana, lote, modo }) => console.log('Listo', modo) });
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const LS_CAMPANA_ACTIVA  = "am_campana_activa_id";
const LS_CAMPANAS_DB     = "am_campanas_db";       // JSON array de campañas registradas
const LS_LOTE_ACTIVO     = "am_lote_activo";        // JSON con {id, nombre, lat, lon, awcMm, ...}
const LS_LOTES_DB        = "am_lotes_db";           // JSON array de lotes registrados
const LS_APP_VERSION     = "am_app_version";
const LS_APP_INIT_TS     = "am_app_init_ts";
const LS_ULTIMO_LOTE_ID  = "am_ultimo_lote_id";    // Persistencia de lote entre sesiones

const APP_VERSION        = "2.0.0";
const MODO_DEFAULT       = "planificacion";

// Eventos globales emitidos por app.js
const EV_APP_LISTA        = "am:app-lista";         // App completamente inicializada
const EV_CAMPANA_CAMBIO   = "am:campana-cambio";    // { anterior, nueva }
const EV_LOTE_CAMBIO      = "am:lote-cambio";       // { anterior, nuevo }

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO INTERNO
// ─────────────────────────────────────────────────────────────────────────────

let _inicializado = false;
let _campanaActiva = null;   // objeto Campana
let _loteActivo   = null;    // objeto Lote
let _opcionesInit = {};

// ─────────────────────────────────────────────────────────────────────────────
// ESQUEMAS / TIPOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Campana
 * @property {string}  id           UUID de campaña  (e.g. "2024-soja-lp")
 * @property {string}  nombre       Etiqueta humana   (e.g. "Soja 2024/25 — LP Norte")
 * @property {string}  cultivo      "soja"|"maiz"|"trigo"|"girasol"
 * @property {string}  loteId       ID del lote asociado
 * @property {string}  estado       "planificacion"|"activa"|"cosechada"|"cerrada"
 * @property {string}  creadaEn     ISO timestamp
 * @property {string}  [actualizadaEn]
 */

/**
 * @typedef {Object} Lote
 * @property {string}  id
 * @property {string}  nombre
 * @property {number}  lat
 * @property {number}  lon
 * @property {number}  [awcMm]      Agua disponible total del perfil (mm)
 * @property {number}  [hectareas]
 * @property {string}  [descripcion]
 */

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS LOCALSTORAGE
// ─────────────────────────────────────────────────────────────────────────────

function _lsGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

function _lsSet(key, val) {
  try { localStorage.setItem(key, String(val)); } catch (_) {}
}

function _lsGetJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function _lsSetJSON(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)); } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE DE DATOS EMBEBIDA (localStorage-backed)
// ─────────────────────────────────────────────────────────────────────────────

// ── Lotes ──

/** @returns {Lote[]} */
function getLotes() {
  return _lsGetJSON(LS_LOTES_DB) || [];
}

/** @param {Lote[]} lotes */
function _guardarLotes(lotes) {
  _lsSetJSON(LS_LOTES_DB, lotes);
}

/**
 * Crea o actualiza un lote en la DB.
 * @param {Lote} lote
 * @returns {Lote}
 */
function upsertLote(lote) {
  if (!lote.id) throw new Error("upsertLote: lote.id es obligatorio");
  const lotes = getLotes();
  const idx = lotes.findIndex(l => l.id === lote.id);
  if (idx >= 0) lotes[idx] = { ...lotes[idx], ...lote };
  else          lotes.push(lote);
  _guardarLotes(lotes);
  return getLotes().find(l => l.id === lote.id);
}

/**
 * @param {string} id
 * @returns {Lote|null}
 */
function getLotePorId(id) {
  return getLotes().find(l => l.id === id) || null;
}

// ── Campañas ──

/** @returns {Campana[]} */
function getCampanas() {
  return _lsGetJSON(LS_CAMPANAS_DB) || [];
}

/** @param {Campana[]} campanas */
function _guardarCampanas(campanas) {
  _lsSetJSON(LS_CAMPANAS_DB, campanas);
}

/**
 * Crea o actualiza una campaña.
 * @param {Campana} campana
 * @returns {Campana}
 */
function upsertCampana(campana) {
  if (!campana.id) throw new Error("upsertCampana: campana.id es obligatorio");
  const campanas = getCampanas();
  const idx = campanas.findIndex(c => c.id === campana.id);
  const ahora = new Date().toISOString();
  if (idx >= 0) {
    campanas[idx] = { ...campanas[idx], ...campana, actualizadaEn: ahora };
  } else {
    campanas.push({ creadaEn: ahora, estado: "planificacion", ...campana });
  }
  _guardarCampanas(campanas);
  return getCampanas().find(c => c.id === campana.id);
}

/**
 * @param {string} id
 * @returns {Campana|null}
 */
function getCampanaPorId(id) {
  return getCampanas().find(c => c.id === id) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN DE MODO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Garantiza que am_modo_global tenga un valor válido.
 * Si ModoSwitch está disponible, lo usa; si no, escribe directamente.
 */
function _inicializarModo() {
  const modoActual = _lsGet("am_modo_global");
  if (!["planificacion", "seguimiento"].includes(modoActual)) {
    _lsSet("am_modo_global", MODO_DEFAULT);
  }

  // También sincronizar claves legacy que leen módulos v1
  const m = _lsGet("am_modo_global");
  _lsSet("am_modo_hidrico",   m);
  _lsSet("am_modo_fenologia", m);

  // Si ModoSwitch fue cargado como global, inicializar badge
  if (typeof window !== "undefined" && window.ModoSwitch) {
    window.ModoSwitch.inicializarBadge?.();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLUCIÓN DE CAMPAÑA ACTIVA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carga la campaña activa desde localStorage.
 * Si am_campana_activa_id apunta a una campaña inexistente (base vacía),
 * limpia la clave para no dejar estado inconsistente.
 *
 * @returns {Campana|null}
 */
function _cargarCampana() {
  const id = _lsGet(LS_CAMPANA_ACTIVA);
  if (!id) return null;

  const campana = getCampanaPorId(id);
  if (!campana) {
    // ID obsoleto — limpiar
    _lsSet(LS_CAMPANA_ACTIVA, "");
    return null;
  }

  _campanaActiva = campana;
  return campana;
}

/**
 * Activa una campaña: escribe am_campana_activa_id y actualiza estado interno.
 * Emite EV_CAMPANA_CAMBIO.
 *
 * @param {string} id
 * @returns {Campana}
 */
function activarCampana(id) {
  const campana = getCampanaPorId(id);
  if (!campana) throw new Error(`activarCampana: campaña "${id}" no encontrada`);

  const anterior = _campanaActiva;
  _campanaActiva = campana;
  _lsSet(LS_CAMPANA_ACTIVA, id);
  // Alias para informe-cierre.js
  _lsSet("am_campana_id", id);

  // Si el lote de la campaña es diferente al lote activo, sincronizar
  if (campana.loteId && campana.loteId !== _loteActivo?.id) {
    const lote = getLotePorId(campana.loteId);
    if (lote) _aplicarLote(lote);
  }

  _emitir(EV_CAMPANA_CAMBIO, { anterior, nueva: campana });
  return campana;
}

/**
 * Crea una nueva campaña y la activa inmediatamente.
 *
 * @param {Object} datos
 * @param {string} datos.id        UUID único (el caller genera)
 * @param {string} datos.nombre
 * @param {string} datos.cultivo
 * @param {string} datos.loteId
 * @param {string} [datos.estado]  por defecto "planificacion"
 * @returns {Campana}
 */
function crearYActivarCampana(datos) {
  const campana = upsertCampana(datos);
  activarCampana(campana.id);
  return campana;
}

/**
 * Cierra la campaña activa (estado → "cerrada") y limpia am_campana_activa_id.
 * @param {Object} [meta]
 * @param {string} [meta.motivo]
 */
function cerrarCampanaActiva(meta = {}) {
  if (!_campanaActiva) return;

  upsertCampana({ ..._campanaActiva, estado: "cerrada" });

  const anterior = _campanaActiva;
  _campanaActiva = null;
  _lsSet(LS_CAMPANA_ACTIVA, "");

  _emitir(EV_CAMPANA_CAMBIO, { anterior, nueva: null, motivo: meta.motivo || "cierre" });
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLUCIÓN DE LOTE ACTIVO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escribe el lote activo en localStorage (am_lote_activo + am_ultimo_lote_id).
 * Esta es la fuente de verdad para todos los módulos que leen am_lote_activo.
 * @param {Lote} lote
 */
function _aplicarLote(lote) {
  _loteActivo = lote;
  _lsSetJSON(LS_LOTE_ACTIVO, lote);
  _lsSet(LS_ULTIMO_LOTE_ID, lote.id);
  // Sincronizar AWC para barbecho.js
  if (lote.awcMm) _lsSet("am_lote_awc_mm", String(lote.awcMm));
  // Alias para informe-cierre.js y alertas.js
  if (lote.nombre) _lsSet("am_lote_nombre", lote.nombre);
  if (lote.lat != null) _lsSet("am_siembra_lat", String(lote.lat));
  if (lote.lon != null) _lsSet("am_siembra_lon", String(lote.lon));
}

/**
 * Carga el lote activo.
 * Prioridad: lote de la campaña activa → último lote usado → null
 * @returns {Lote|null}
 */
function _cargarLote() {
  // 1. Desde la campaña activa
  if (_campanaActiva?.loteId) {
    const lote = getLotePorId(_campanaActiva.loteId);
    if (lote) { _aplicarLote(lote); return lote; }
  }

  // 2. Desde am_lote_activo ya en localStorage (sesión anterior)
  const loteGuardado = _lsGetJSON(LS_LOTE_ACTIVO);
  if (loteGuardado?.id) {
    // Refrescar desde DB por si fue actualizado
    const loteDB = getLotePorId(loteGuardado.id) || loteGuardado;
    _aplicarLote(loteDB);
    return loteDB;
  }

  // 3. Último lote recordado
  const ultimoId = _lsGet(LS_ULTIMO_LOTE_ID);
  if (ultimoId) {
    const lote = getLotePorId(ultimoId);
    if (lote) { _aplicarLote(lote); return lote; }
  }

  return null;
}

/**
 * Activa un lote: lo escribe en am_lote_activo y emite EV_LOTE_CAMBIO.
 * @param {string} id
 * @returns {Lote}
 */
function activarLote(id) {
  const lote = getLotePorId(id);
  if (!lote) throw new Error(`activarLote: lote "${id}" no encontrado`);

  const anterior = _loteActivo;
  _aplicarLote(lote);
  _emitir(EV_LOTE_CAMBIO, { anterior, nuevo: lote });
  return lote;
}

/**
 * Registra un nuevo lote en la DB y lo activa.
 * @param {Lote} lote
 * @returns {Lote}
 */
function registrarYActivarLote(lote) {
  if (!lote.id || !lote.nombre || lote.lat == null || lote.lon == null) {
    throw new Error("registrarYActivarLote: id, nombre, lat y lon son obligatorios");
  }
  upsertLote(lote);
  return activarLote(lote.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTOS DOM
// ─────────────────────────────────────────────────────────────────────────────

function _emitir(nombre, detalle) {
  try {
    window.dispatchEvent(new CustomEvent(nombre, { detail: detalle, bubbles: true }));
  } catch (_) {}
}

/**
 * Registra un listener en el window (browser).
 * @param {string}   evento   EV_APP_LISTA | EV_CAMPANA_CAMBIO | EV_LOTE_CAMBIO | "am:modo-cambio"
 * @param {function} callback
 * @returns {function}  Función para remover el listener
 */
function on(evento, callback) {
  const handler = (e) => callback(e.detail);
  try {
    window.addEventListener(evento, handler);
    return () => window.removeEventListener(evento, handler);
  } catch (_) { return () => {}; }
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARDS DE NAVEGACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Definición de un guard de navegación.
 * Cada guard revisa precondiciones antes de permitir acceso a una sección.
 *
 * @typedef {Object} Guard
 * @property {string}   ruta       Identificador de sección (coincide con nav.js)
 * @property {function} condicion  () => boolean — true si se permite el acceso
 * @property {string}   mensaje    Qué mostrar si falla
 * @property {string}   [redirigir] Ruta alternativa a la que enviar al usuario
 */

/** @type {Guard[]} */
const _guards = [
  {
    ruta:      "siembra",
    condicion: () => Boolean(_lsGetJSON(LS_LOTE_ACTIVO)?.id),
    mensaje:   "Seleccioná un lote activo antes de registrar la siembra.",
    redirigir: "lotes",
  },
  {
    ruta:      "fenologia",
    condicion: () => Boolean(_lsGet("am_siembra_fecha") && _lsGet("am_siembra_cultivo")),
    mensaje:   "Registrá la siembra antes de consultar la fenología.",
    redirigir: "siembra",
  },
  {
    ruta:      "hidrico",
    condicion: () => Boolean(_lsGet("am_siembra_fecha")),
    mensaje:   "Registrá la siembra antes de calcular el balance hídrico.",
    redirigir: "siembra",
  },
  {
    ruta:      "barbecho",
    condicion: () => Boolean(_lsGetJSON(LS_LOTE_ACTIVO)?.id),
    mensaje:   "Seleccioná un lote activo antes de calcular el barbecho.",
    redirigir: "lotes",
  },
  {
    ruta:      "alertas",
    condicion: () => Boolean(_lsGet("am_siembra_fecha") && _lsGet("am_campana_activa_id")),
    mensaje:   "Necesitás una campaña activa con siembra registrada para ver alertas.",
    redirigir: "siembra",
  },
  {
    ruta:      "decision",
    condicion: () => Boolean(_lsGet("am_siembra_fecha")),
    mensaje:   "Registrá la siembra para acceder al módulo de decisión.",
    redirigir: "siembra",
  },
  {
    ruta:      "informe-cierre",
    condicion: () => Boolean(_lsGet("am_campana_activa_id")),
    mensaje:   "Necesitás una campaña activa para generar el informe de cierre.",
    redirigir: "campanas",
  },
];

/**
 * Verifica si se puede navegar a una ruta dada.
 *
 * @param {string} ruta
 * @returns {{ permitido: boolean, mensaje?: string, redirigir?: string }}
 */
function verificarGuard(ruta) {
  const guard = _guards.find(g => g.ruta === ruta);
  if (!guard) return { permitido: true };
  if (guard.condicion()) return { permitido: true };
  return { permitido: false, mensaje: guard.mensaje, redirigir: guard.redirigir };
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULOS UI SECUNDARIOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inicializa módulos UI que dependen de haber cargado campaña y lote.
 * Se llama al final de init().
 */
function _arrancarModulosUI() {
  // Badge de modo (modo-switch.js)
  if (typeof window !== "undefined" && window.ModoSwitch) {
    window.ModoSwitch.renderizarBadge?.();
  }

  // Nav activo (nav.js)
  if (typeof window !== "undefined" && window.Nav) {
    window.Nav.refrescarEstado?.();
  }

  // Siembra: si hay datos previos en LS, renderizar resumen si el contenedor existe
  if (typeof window !== "undefined" && window.Siembra) {
    window.Siembra.renderizarResumen?.("siembra-resumen");
  }

  // Actualizar indicadores de campaña/lote en el header si existen
  _actualizarHeaderIndicadores();
}

/**
 * Escribe el nombre de campaña y lote en elementos del header si existen.
 * IDs esperados: #am-campana-nombre, #am-lote-nombre
 */
function _actualizarHeaderIndicadores() {
  try {
    const elCampana = document.getElementById("am-campana-nombre");
    if (elCampana) {
      elCampana.textContent = _campanaActiva
        ? _campanaActiva.nombre
        : "— Sin campaña activa —";
    }

    const elLote = document.getElementById("am-lote-nombre");
    if (elLote) {
      elLote.textContent = _loteActivo
        ? `${_loteActivo.nombre} (${_loteActivo.lat?.toFixed(3)}°, ${_loteActivo.lon?.toFixed(3)}°)`
        : "— Sin lote activo —";
    }
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO DE EVENT LISTENERS GLOBALES
// ─────────────────────────────────────────────────────────────────────────────

function _registrarEventListeners() {
  // Cuando cambia el modo, sincronizar legacy keys
  on("am:modo-cambio", ({ nuevo }) => {
    _lsSet("am_modo_hidrico",   nuevo);
    _lsSet("am_modo_fenologia", nuevo);
  });

  // Cuando cambia la campaña, actualizar indicadores de header
  on(EV_CAMPANA_CAMBIO, () => _actualizarHeaderIndicadores());

  // Cuando cambia el lote, actualizar indicadores de header
  on(EV_LOTE_CAMBIO, () => _actualizarHeaderIndicadores());
}

// ─────────────────────────────────────────────────────────────────────────────
// DATOS DE DEMOSTRACIÓN (seed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carga un conjunto mínimo de datos de prueba si la DB está vacía.
 * Útil para desarrollo y demos. No sobrescribe datos existentes.
 *
 * @param {boolean} [forzar=false]  Si true, sobrescribe incluso si ya existen datos
 */
function cargarDatosDemo(forzar = false) {
  const lotesDemoId = "demo-lote-lp-norte";

  if (!forzar && getLotePorId(lotesDemoId)) {
    return; // Ya existen datos demo
  }

  // Lote de demostración — La Pampa Norte (zona agrícola pampeana)
  upsertLote({
    id:          lotesDemoId,
    nombre:      "Lp Norte — Potreros 5 y 6",
    lat:         -37.2500,
    lon:         -63.7500,
    awcMm:       180,
    hectareas:   95,
    descripcion: "Suelo Franco Arcilloso — INTA Serie La Pampa Norte",
  });

  // Campaña de demostración
  const campanaId = "demo-campana-soja-2425";
  if (!getCampanaPorId(campanaId)) {
    upsertCampana({
      id:      campanaId,
      nombre:  "Soja 24/25 — Lp Norte",
      cultivo: "soja",
      loteId:  lotesDemoId,
      estado:  "planificacion",
    });
  }

  console.info("[AGROMOTOR] Datos demo cargados:", { lotesDemoId, campanaId });
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO Y DIAGNÓSTICO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve un snapshot del estado actual de la aplicación.
 * Útil para debugging y para que los módulos conozcan el contexto.
 *
 * @returns {Object}
 */
function getEstado() {
  return {
    version:        APP_VERSION,
    inicializado:   _inicializado,
    modo:           _lsGet("am_modo_global") || MODO_DEFAULT,
    campanaActiva:  _campanaActiva,
    loteActivo:     _loteActivo,
    siembra: {
      fecha:    _lsGet("am_siembra_fecha"),
      cultivo:  _lsGet("am_siembra_cultivo"),
      completa: Boolean(_lsGet("am_siembra_fecha") && _lsGet("am_siembra_cultivo")),
    },
    barbecho: {
      disponible: Boolean(_lsGet("am_barbecho_ultimo")),
    },
    guards: {
      siembra:        verificarGuard("siembra"),
      fenologia:      verificarGuard("fenologia"),
      hidrico:        verificarGuard("hidrico"),
      barbecho:       verificarGuard("barbecho"),
      alertas:        verificarGuard("alertas"),
      decision:       verificarGuard("decision"),
      "informe-cierre": verificarGuard("informe-cierre"),
    },
    totalLotes:    getLotes().length,
    totalCampanas: getCampanas().length,
  };
}

/**
 * Imprime el estado en la consola (diagnóstico rápido).
 */
function diagnosticar() {
  const estado = getEstado();
  console.group("[AGROMOTOR] Estado de la aplicación");
  console.log("Versión:", estado.version);
  console.log("Modo:", estado.modo);
  console.log("Campaña activa:", estado.campanaActiva?.nombre ?? "(ninguna)");
  console.log("Lote activo:", estado.loteActivo?.nombre ?? "(ninguno)");
  console.log("Siembra registrada:", estado.siembra.completa);
  console.log("Guards:", estado.guards);
  console.groupEnd();
  return estado;
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inicializa la aplicación. Debe llamarse una vez, al cargar el DOM.
 *
 * @param {Object}   [opciones]
 * @param {boolean}  [opciones.demo=false]        Si true, carga datos demo si la DB está vacía
 * @param {string}   [opciones.campanaId]          Forzar campaña específica
 * @param {string}   [opciones.loteId]             Forzar lote específico
 * @param {function} [opciones.onListo]            Callback cuando la app está lista
 * @param {function} [opciones.onSinLote]          Callback si no hay lote activo al arrancar
 * @param {function} [opciones.onSinCampana]       Callback si no hay campaña activa al arrancar
 *
 * @returns {Object}  Estado inicial de la aplicación
 */
function init(opciones = {}) {
  if (_inicializado) {
    console.warn("[AGROMOTOR] app.init() llamado más de una vez — ignorado");
    return getEstado();
  }

  _opcionesInit = opciones;

  // 1. Marcar versión y timestamp
  _lsSet(LS_APP_VERSION, APP_VERSION);
  _lsSet(LS_APP_INIT_TS, new Date().toISOString());

  // 2. Modo global
  _inicializarModo();

  // 3. Datos demo (si corresponde y DB vacía)
  if (opciones.demo) cargarDatosDemo(false);

  // 4. Campaña activa
  if (opciones.campanaId) {
    // Caller fuerza una campaña específica
    const campana = getCampanaPorId(opciones.campanaId);
    if (campana) {
      _campanaActiva = campana;
      _lsSet(LS_CAMPANA_ACTIVA, campana.id);
    }
  } else {
    _cargarCampana();
  }

  // 5. Lote activo
  if (opciones.loteId) {
    const lote = getLotePorId(opciones.loteId);
    if (lote) _aplicarLote(lote);
  } else {
    _cargarLote();
  }

  // 6. Listeners globales
  _registrarEventListeners();

  // 7. Módulos UI (solo en browser)
  if (typeof window !== "undefined") {
    _arrancarModulosUI();
  }

  // 8. Marcar como inicializado
  _inicializado = true;

  // 9. Callbacks y evento
  const estado = getEstado();

  if (!_loteActivo && opciones.onSinLote) {
    opciones.onSinLote(estado);
  }
  if (!_campanaActiva && opciones.onSinCampana) {
    opciones.onSinCampana(estado);
  }
  if (opciones.onListo) {
    opciones.onListo(estado);
  }

  _emitir(EV_APP_LISTA, estado);

  console.info(`[AGROMOTOR v${APP_VERSION}] App inicializada —`,
    `Modo: ${estado.modo}`,
    `| Campaña: ${_campanaActiva?.nombre ?? "ninguna"}`,
    `| Lote: ${_loteActivo?.nombre ?? "ninguno"}`
  );

  return estado;
}

/**
 * Resetea la aplicación al estado de fábrica (borra TODO el localStorage am_*).
 * ¡DESTRUCTIVO! Uso exclusivo en testing y desarrollo.
 *
 * @param {boolean} [confirmar=false]  Debe ser true para ejecutar
 */
function resetFactoria(confirmar = false) {
  if (!confirmar) {
    console.error("[AGROMOTOR] resetFactoria: pasar confirmar=true para ejecutar");
    return;
  }

  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith("am_"))
      .forEach(k => localStorage.removeItem(k));
  } catch (_) {}

  _inicializado   = false;
  _campanaActiva  = null;
  _loteActivo     = null;
  _opcionesInit   = {};

  console.warn("[AGROMOTOR] Estado de fábrica restaurado");
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

const _exports = {
  // Ciclo de vida
  init,
  resetFactoria,

  // Lotes
  getLotes,
  getLotePorId,
  upsertLote,
  activarLote,
  registrarYActivarLote,

  // Campañas
  getCampanas,
  getCampanaPorId,
  upsertCampana,
  activarCampana,
  crearYActivarCampana,
  cerrarCampanaActiva,

  // Guards
  verificarGuard,

  // Accesores rápidos
  getCampanaActiva: () => _campanaActiva,
  getLoteActivo:    () => _loteActivo,
  getModo:          () => _lsGet("am_modo_global") || MODO_DEFAULT,

  // Eventos
  on,

  // Diagnóstico
  getEstado,
  diagnosticar,
  cargarDatosDemo,

  // Constantes
  EV_APP_LISTA,
  EV_CAMPANA_CAMBIO,
  EV_LOTE_CAMBIO,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = _exports;
} else if (typeof window !== "undefined") {
  window.App = _exports;

  // Auto-init cuando el DOM esté listo (si no fue llamado manualmente)
  // El caller puede prevenir el auto-init con window.AM_NO_AUTOINIT = true
  if (!window.AM_NO_AUTOINIT) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        if (!_inicializado) init(window.AM_INIT_OPTIONS || {});
      });
    } else {
      if (!_inicializado) init(window.AM_INIT_OPTIONS || {});
    }
  }
}
