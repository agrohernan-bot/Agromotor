/**
 * campanas.js — AGROMOTOR v2.0
 *
 * Modelo de datos y gestión de campañas agrícolas.
 * Es el módulo fundacional del nuevo sistema: habilita la trazabilidad
 * entre campañas consecutivas, el encadenamiento hídrico y la separación
 * entre modo Planificación y modo Seguimiento.
 *
 * Almacenamiento primario : IndexedDB (am_campanas_db, objectStore "campanas")
 * Almacenamiento fallback : localStorage (clave "am_campanas_v2")
 *
 * Diseñado para correr en browser y en Node (tests).
 * En Node, IDB no existe → se usa el adaptador localStorage-like inyectado
 * por el harness de tests o el módulo idb-keyval.
 *
 * ─── SCHEMA ──────────────────────────────────────────────────────────────
 *
 * @typedef {Object} Campana
 * @property {string} id                  UUID v4 auto-generado
 * @property {string} lote_id             ID del lote/parcela (texto libre o UUID)
 * @property {string} cultivo             "soja"|"maiz"|"trigo"|"girasol"|etc.
 * @property {string} variedad            Nombre/código de variedad
 * @property {string} fecha_siembra       "YYYY-MM-DD" — planificada o real
 * @property {string} fecha_cosecha_est   "YYYY-MM-DD" — estimada (planificación)
 * @property {string|null} fecha_cosecha_real "YYYY-MM-DD" — real (seguimiento)
 * @property {number|null} rendimiento_obj   t/ha — objetivo
 * @property {number|null} rendimiento_real  t/ha — cosechado
 * @property {number}      agua_inicio_mm    mm — agua en perfil al sembrar
 * @property {string}      agua_inicio_fuente "barbecho"|"usuario"|"openmeteo"|"estimado"
 * @property {number|null} etc_total_mm      mm — ETc acumulada (se va actualizando)
 * @property {number|null} precip_total_mm   mm — lluvia acumulada (se va actualizando)
 * @property {string|null} fase_enso         "niño"|"niña"|"neutro" al momento de planificar
 * @property {string}      modo              "planificacion"|"seguimiento"
 * @property {string|null} campana_anterior_id  UUID de la campaña previa (mismo lote)
 * @property {string|null} barbecho_inicio   "YYYY-MM-DD" — cosecha antecesor
 * @property {string|null} barbecho_fin      "YYYY-MM-DD" — siembra esta campaña
 * @property {number|null} barbecho_agua_mm  mm — agua al inicio del barbecho
 * @property {string}      estado            "planificado"|"activo"|"cosechado"|"archivado"
 * @property {string}      creadaEn          ISO timestamp
 * @property {string}      actualizadaEn     ISO timestamp
 * @property {string}      version           "2.0"
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME        = "am_campanas_db";
const DB_VERSION     = 1;
const STORE_NAME     = "campanas";
const LS_FALLBACK    = "am_campanas_v2";
const LS_ACTIVA      = "am_campana_activa_id";
const SCHEMA_VERSION = "2.0";

const CULTIVOS_VALIDOS = [
  "soja", "maiz", "trigo", "girasol", "sorgo",
  "cebada", "colza", "mani", "algodon", "otro",
];

const ESTADOS_VALIDOS = ["planificado", "activo", "cosechado", "archivado"];
const CAMPANAS_MODOS_VALIDOS = ["planificacion", "seguimiento"];

// ─────────────────────────────────────────────────────────────────────────────
// UUID v4 (sin dependencias externas)
// ─────────────────────────────────────────────────────────────────────────────

function uuidv4() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para entornos sin crypto.randomUUID (Node <19)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPA DE ALMACENAMIENTO — abstracción IDB / localStorage
// ─────────────────────────────────────────────────────────────────────────────

let _db = null;       // Instancia IDB cacheada
let _useFallback = false;  // true si IDB no está disponible

/**
 * Abre (o retorna la instancia cacheada de) la base de datos IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
function abrirDB() {
  if (_db)          return Promise.resolve(_db);
  if (_useFallback) return Promise.reject(new Error("IDB no disponible, usando fallback"));

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      _useFallback = true;
      return reject(new Error("indexedDB no disponible"));
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("lote_id",           "lote_id",           { unique: false });
        store.createIndex("estado",            "estado",            { unique: false });
        store.createIndex("campana_anterior_id","campana_anterior_id",{ unique: false });
        store.createIndex("cultivo",           "cultivo",           { unique: false });
      }
    };

    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror    = ()  => {
      _useFallback = true;
      reject(new Error(`Error al abrir IDB: ${req.error}`));
    };
  });
}

// ── Fallback localStorage ────────────────────────────────────────────────────

function lsLeerTodas() {
  try {
    const raw = localStorage.getItem(LS_FALLBACK);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

function lsGuardarTodas(arr) {
  try { localStorage.setItem(LS_FALLBACK, JSON.stringify(arr)); } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida los campos mínimos de una campaña antes de persistirla.
 * @param {Partial<Campana>} c
 * @throws {Error} con descripción del campo inválido
 */
function validar(c) {
  if (!c.lote_id || typeof c.lote_id !== "string")
    throw new Error("lote_id es obligatorio");

  if (!CULTIVOS_VALIDOS.includes(c.cultivo))
    throw new Error(`cultivo inválido: "${c.cultivo}". Válidos: ${CULTIVOS_VALIDOS.join(", ")}`);

  if (!c.fecha_siembra || !/^\d{4}-\d{2}-\d{2}$/.test(c.fecha_siembra))
    throw new Error("fecha_siembra debe tener formato YYYY-MM-DD");

  if (!c.fecha_cosecha_est || !/^\d{4}-\d{2}-\d{2}$/.test(c.fecha_cosecha_est))
    throw new Error("fecha_cosecha_est debe tener formato YYYY-MM-DD");

  if (new Date(c.fecha_cosecha_est) <= new Date(c.fecha_siembra))
    throw new Error("fecha_cosecha_est debe ser posterior a fecha_siembra");

  if (typeof c.agua_inicio_mm !== "number" || c.agua_inicio_mm < 0)
    throw new Error("agua_inicio_mm debe ser un número ≥ 0");

  if (!CAMPANAS_MODOS_VALIDOS.includes(c.modo))
    throw new Error(`modo inválido: "${c.modo}". Válidos: ${CAMPANAS_MODOS_VALIDOS.join(", ")}`);

  if (!ESTADOS_VALIDOS.includes(c.estado))
    throw new Error(`estado inválido: "${c.estado}". Válidos: ${ESTADOS_VALIDOS.join(", ")}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD — operaciones principales
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea y persiste una nueva campaña.
 * @param {Omit<Campana,"id"|"creadaEn"|"actualizadaEn"|"version">} datos
 * @returns {Promise<Campana>}
 */
async function crearCampana(datos) {
  const ahora = new Date().toISOString();
  const campana = {
    // Defaults seguros
    variedad:             "",
    fecha_cosecha_real:   null,
    rendimiento_obj:      null,
    rendimiento_real:     null,
    agua_inicio_fuente:   "usuario",
    etc_total_mm:         null,
    precip_total_mm:      null,
    fase_enso:            null,
    modo:                 "planificacion",
    campana_anterior_id:  null,
    barbecho_inicio:      null,
    barbecho_fin:         null,
    barbecho_agua_mm:     null,
    estado:               "planificado",
    // Campos de encadenamiento (heredables de campaña anterior)
    cultivo_anterior:     null,
    suelo_textura:        null,
    agua_perfil_cierre:   null,
    // Sobreescribir con datos provistos
    ...datos,
    // Campos de sistema (no sobreescribibles por el llamador)
    id:             uuidv4(),
    creadaEn:       ahora,
    actualizadaEn:  ahora,
    version:        SCHEMA_VERSION,
  };

  validar(campana);
  await _persistir(campana);
  return campana;
}

/**
 * Recupera una campaña por su ID.
 * @param {string} id
 * @returns {Promise<Campana|null>}
 */
async function obtenerCampana(id) {
  try {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, "readonly")
                    .objectStore(STORE_NAME)
                    .get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  } catch (_) {
    const arr = lsLeerTodas();
    return arr.find((c) => c.id === id) ?? null;
  }
}

/**
 * Devuelve todas las campañas, opcionalmente filtradas.
 * @param {{ lote_id?: string, estado?: string, modo?: string }} [filtros]
 * @returns {Promise<Campana[]>}
 */
async function listarCampanas(filtros = {}) {
  let campanas;

  try {
    const db = await abrirDB();
    campanas = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, "readonly")
                    .objectStore(STORE_NAME)
                    .getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  } catch (_) {
    campanas = lsLeerTodas();
  }

  // Aplicar filtros
  if (filtros.lote_id) campanas = campanas.filter((c) => c.lote_id === filtros.lote_id);
  if (filtros.estado)  campanas = campanas.filter((c) => c.estado  === filtros.estado);
  if (filtros.modo)    campanas = campanas.filter((c) => c.modo    === filtros.modo);

  // Ordenar: más reciente primero
  campanas.sort((a, b) => new Date(b.creadaEn) - new Date(a.creadaEn));
  return campanas;
}

/**
 * Actualiza campos de una campaña existente.
 * @param {string} id
 * @param {Partial<Campana>} cambios
 * @returns {Promise<Campana>}
 */
async function actualizarCampana(id, cambios) {
  const original = await obtenerCampana(id);
  if (!original) throw new Error(`Campaña no encontrada: ${id}`);

  // Campos de sistema protegidos
  const protegidos = ["id", "creadaEn", "version"];
  protegidos.forEach((k) => delete cambios[k]);

  const actualizada = {
    ...original,
    ...cambios,
    actualizadaEn: new Date().toISOString(),
  };

  validar(actualizada);
  await _persistir(actualizada);
  return actualizada;
}

/**
 * Archiva una campaña (soft delete).
 * Para borrado físico usar `eliminarCampana()`.
 * @param {string} id
 * @returns {Promise<Campana>}
 */
async function archivarCampana(id) {
  return actualizarCampana(id, { estado: "archivado" });
}

/**
 * Elimina definitivamente una campaña (usar con cuidado).
 * @param {string} id
 * @returns {Promise<void>}
 */
async function eliminarCampana(id) {
  try {
    const db = await abrirDB();
    await new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, "readwrite")
                    .objectStore(STORE_NAME)
                    .delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch (_) {
    const arr = lsLeerTodas().filter((c) => c.id !== id);
    lsGuardarTodas(arr);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCIA INTERNA
// ─────────────────────────────────────────────────────────────────────────────

async function _persistir(campana) {
  try {
    const db = await abrirDB();
    await new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, "readwrite")
                    .objectStore(STORE_NAME)
                    .put(campana);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch (_) {
    // Fallback a localStorage
    const arr = lsLeerTodas();
    const idx = arr.findIndex((c) => c.id === campana.id);
    if (idx >= 0) arr[idx] = campana;
    else arr.push(campana);
    lsGuardarTodas(arr);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAÑA ACTIVA (singleton por sesión)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marca una campaña como la activa en la sesión actual.
 * Actualiza también su estado a "activo" si estaba en "planificado".
 * @param {string} id
 * @returns {Promise<Campana>}
 */
async function activarCampana(id) {
  const c = await obtenerCampana(id);
  if (!c) throw new Error(`Campaña no encontrada: ${id}`);

  const cambios = {};
  if (c.estado === "planificado") cambios.estado = "activo";

  const actualizada = Object.keys(cambios).length
    ? await actualizarCampana(id, cambios)
    : c;

  try { localStorage.setItem(LS_ACTIVA, id); } catch (_) {}
  return actualizada;
}

/**
 * Devuelve la campaña activa actual, o null si no hay ninguna.
 * @returns {Promise<Campana|null>}
 */
async function getCampanaActiva() {
  try {
    const id = localStorage.getItem(LS_ACTIVA);
    return id ? obtenerCampana(id) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Limpia la referencia a campaña activa (al cerrar/cambiar campaña).
 */
function limpiarCampanaActiva() {
  try { localStorage.removeItem(LS_ACTIVA); } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// ENCADENAMIENTO DE CAMPAÑAS (lógica de barbecho)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el historial de campañas de un lote en orden cronológico
 * (de más antigua a más reciente), siguiendo la cadena campana_anterior_id.
 * @param {string} lote_id
 * @returns {Promise<Campana[]>}
 */
async function getCadenaCampanas(lote_id) {
  const todas = await listarCampanas({ lote_id });
  if (!todas.length) return [];

  // Armar grafo de adyacencia: anterior → siguiente
  const porId   = Object.fromEntries(todas.map((c) => [c.id, c]));
  const tieneAntecesor = new Set(todas.map((c) => c.campana_anterior_id).filter(Boolean));

  // La raíz es la que no tiene campana_anterior_id apuntando a ella
  // O cuyo campana_anterior_id no está en el lote
  const raices = todas.filter(
    (c) => !c.campana_anterior_id || !porId[c.campana_anterior_id]
  );

  // Seguir la cadena a partir de la raíz más antigua
  const cadena = [];
  let actual = raices.sort((a, b) => new Date(a.fecha_siembra) - new Date(b.fecha_siembra))[0];

  while (actual) {
    cadena.push(actual);
    // Buscar la siguiente: la que tiene campana_anterior_id === actual.id
    const siguiente = todas.find((c) => c.campana_anterior_id === actual.id);
    actual = siguiente || null;
  }

  return cadena;
}

/**
 * Prepara los datos de una nueva campaña a partir de la cosecha de la anterior
 * y un resultado de balance de barbecho (output de barbecho.js).
 *
 * No persiste — devuelve un objeto listo para pasarle a crearCampana().
 *
 * @param {Campana}        campanaAnterior   Campaña ya cosechada
 * @param {Object}         balanceBarbecho   Output de calcularBarbecho()
 * @param {Partial<Campana>} datosCampanaNueva Campos específicos de la nueva campaña
 * @returns {Partial<Campana>}
 */
function prepararCampanaEncadenada(campanaAnterior, balanceBarbecho, datosCampanaNueva) {
  if (campanaAnterior.estado !== "cosechado" && campanaAnterior.estado !== "archivado") {
    throw new Error(
      `La campaña anterior (${campanaAnterior.id}) debe estar en estado "cosechado" o "archivado"`
    );
  }

  return {
    lote_id:              campanaAnterior.lote_id,
    modo:                 "planificacion",
    estado:               "planificado",
    agua_inicio_mm:       balanceBarbecho.aguaFinalMm,
    agua_inicio_fuente:   "barbecho",
    campana_anterior_id:  campanaAnterior.id,
    barbecho_inicio:      balanceBarbecho.fechaCosechaAnt,
    barbecho_fin:         balanceBarbecho.fechaSiembra,
    barbecho_agua_mm:     balanceBarbecho.aguaInicioMm,
    // Campos específicos de la nueva campaña (sobrescriben defaults)
    ...datosCampanaNueva,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTUALIZACIÓN DE PROGRESO HÍDRICO (desde hidrico.js y seguimiento.js)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acumula ETc y precipitaciones en la campaña activa.
 * Llamar al final de cada ciclo de cálculo hídrico.
 *
 * @param {string} id
 * @param {{ etc_mm?: number, precip_mm?: number }} acumulados
 * @returns {Promise<Campana>}
 */
async function actualizarHidrico(id, { etc_mm, precip_mm }) {
  const c = await obtenerCampana(id);
  if (!c) throw new Error(`Campaña no encontrada: ${id}`);

  const cambios = {};
  if (typeof etc_mm   === "number") cambios.etc_total_mm    = +(etc_mm).toFixed(1);
  if (typeof precip_mm === "number") cambios.precip_total_mm = +(precip_mm).toFixed(1);

  return actualizarCampana(id, cambios);
}

/**
 * Registra la cosecha real de la campaña.
 * Transiciona el estado a "cosechado" automáticamente.
 *
 * @param {string} id
 * @param {{ fecha_cosecha_real: string, rendimiento_real: number }} datos
 * @returns {Promise<Campana>}
 */
async function registrarCosecha(id, { fecha_cosecha_real, rendimiento_real }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_cosecha_real))
    throw new Error("fecha_cosecha_real debe tener formato YYYY-MM-DD");

  return actualizarCampana(id, {
    fecha_cosecha_real,
    rendimiento_real: typeof rendimiento_real === "number" ? +rendimiento_real.toFixed(2) : null,
    estado: "cosechado",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE LECTURA (sincronos, vía localStorage fallback)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el agua disponible al inicio de la campaña activa.
 * Útil para hidrico.js sin await en contextos síncronos limitados.
 * @returns {number|null}
 */
function getAguaInicioCampanaActiva() {
  try {
    const id  = localStorage.getItem(LS_ACTIVA);
    if (!id) return null;
    const arr = lsLeerTodas();
    const c   = arr.find((x) => x.id === id);
    return c ? c.agua_inicio_mm : null;
  } catch (_) { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADÍSTICAS DEL LOTE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula un resumen histórico del lote.
 * @param {string} lote_id
 * @returns {Promise<Object>}
 */
async function getEstadisticasLote(lote_id) {
  const campanas = await listarCampanas({ lote_id });
  const cosechadas = campanas.filter((c) => c.rendimiento_real != null);

  if (!cosechadas.length) {
    return { lote_id, campanas_total: campanas.length, cosechadas: 0 };
  }

  const rindPromedio = cosechadas.reduce((s, c) => s + c.rendimiento_real, 0) / cosechadas.length;
  const rindMax      = Math.max(...cosechadas.map((c) => c.rendimiento_real));
  const rindMin      = Math.min(...cosechadas.map((c) => c.rendimiento_real));

  const porCultivo = {};
  cosechadas.forEach((c) => {
    if (!porCultivo[c.cultivo]) porCultivo[c.cultivo] = [];
    porCultivo[c.cultivo].push(c.rendimiento_real);
  });

  return {
    lote_id,
    campanas_total:    campanas.length,
    cosechadas:        cosechadas.length,
    rendimiento_prom:  +rindPromedio.toFixed(2),
    rendimiento_max:   rindMax,
    rendimiento_min:   rindMin,
    por_cultivo:       Object.fromEntries(
      Object.entries(porCultivo).map(([cult, rinds]) => [
        cult,
        { n: rinds.length, prom: +(rinds.reduce((s, r) => s + r, 0) / rinds.length).toFixed(2) },
      ])
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIÓN / IMPORTACIÓN (respaldo)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exporta todas las campañas como JSON string (para backup).
 * @returns {Promise<string>}
 */
async function exportarCampanas() {
  const todas = await listarCampanas();
  return JSON.stringify({ exportadoEn: new Date().toISOString(), version: SCHEMA_VERSION, campanas: todas }, null, 2);
}

/**
 * Importa campañas desde un JSON de backup.
 * Las campañas con ID duplicado son actualizadas (no duplicadas).
 * @param {string} json
 * @returns {Promise<{ importadas: number, errores: string[] }>}
 */
async function importarCampanas(json) {
  let payload;
  try { payload = JSON.parse(json); }
  catch (e) { throw new Error("JSON inválido"); }

  const lista = Array.isArray(payload) ? payload : (payload.campanas ?? []);
  const errores = [];
  let importadas = 0;

  for (const c of lista) {
    try {
      // Asegurar campos de sistema antes de persistir
      const ts = new Date().toISOString();
      await _persistir({
        creadaEn:      ts,
        actualizadaEn: ts,
        version:       SCHEMA_VERSION,
        ...c,
      });
      importadas++;
    } catch (e) {
      errores.push(`${c.id ?? "???"}: ${e.message}`);
    }
  }

  return { importadas, errores };
}

// ─────────────────────────────────────────────────────────────────────────────
// API SIMPLIFICADA — alias y wrappers con nombres más cortos
// ─────────────────────────────────────────────────────────────────────────────

/** Inicializa la base de datos IndexedDB (llama en background al cargar). */
async function campanasInit() {
  try { await abrirDB(); } catch (_) {}
}

/**
 * Campaña activa del lote: primero busca por sesión, luego por estado "activo".
 * @param {string} loteId
 * @returns {Promise<Campana|null>}
 */
async function campanaActual(loteId) {
  const idSesion = (() => { try { return localStorage.getItem(LS_ACTIVA); } catch (_) { return null; } })();
  if (idSesion) {
    const c = await obtenerCampana(idSesion);
    if (c && c.lote_id === loteId) return c;
  }
  const activas = await listarCampanas({ lote_id: loteId, estado: "activo" });
  return activas[0] ?? null;
}

/**
 * Crea una nueva campaña para el lote, heredando datos de la campaña anterior.
 * @param {string}           loteId
 * @param {Partial<Campana>} datos
 * @returns {Promise<Campana>}
 */
async function campanaNueva(loteId, datos) {
  const anterior = await campanaActual(loteId);
  const base = {
    lote_id: loteId,
    modo:    "planificacion",
    estado:  "planificado",
    ...datos,
  };
  if (anterior) {
    if (!base.campana_anterior_id) base.campana_anterior_id = anterior.id;
    if (!base.cultivo_anterior)    base.cultivo_anterior    = anterior.cultivo;
    if (!base.suelo_textura && anterior.suelo_textura)
      base.suelo_textura = anterior.suelo_textura;
  }
  return crearCampana(base);
}

/** Alias corto de activarCampana(). */
async function campanaActivar(id) {
  return activarCampana(id);
}

/**
 * Cierra la campaña con resultados finales: rendimiento, agua de perfil, fecha.
 * @param {string} id
 * @param {{ rendimiento_real?: number, agua_perfil_cierre?: number, fecha_cosecha?: string }} resultados
 * @returns {Promise<Campana>}
 */
async function campanaCerrar(id, resultados = {}) {
  const cambios = { estado: "cosechado" };
  const fechaCosecha = resultados.fecha_cosecha || new Date().toISOString().slice(0, 10);
  cambios.fecha_cosecha_real = fechaCosecha;
  if (typeof resultados.rendimiento_real === "number")
    cambios.rendimiento_real    = +resultados.rendimiento_real.toFixed(2);
  if (typeof resultados.agua_perfil_cierre === "number")
    cambios.agua_perfil_cierre  = resultados.agua_perfil_cierre;
  try { localStorage.setItem("am_cosecha_fecha", fechaCosecha); } catch (_) {}
  return actualizarCampana(id, cambios);
}

/** Lista campañas del lote de más reciente a más antigua. */
function campanaListar(loteId) {
  return listarCampanas({ lote_id: loteId });
}

/**
 * Campaña anterior encadenada a la dada (por campana_anterior_id).
 * @param {string} id
 * @returns {Promise<Campana|null>}
 */
async function campanaAnterior(id) {
  const c = await obtenerCampana(id);
  if (!c?.campana_anterior_id) return null;
  return obtenerCampana(c.campana_anterior_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    // CRUD
    crearCampana,
    obtenerCampana,
    listarCampanas,
    actualizarCampana,
    archivarCampana,
    eliminarCampana,
    // Campaña activa
    activarCampana,
    getCampanaActiva,
    limpiarCampanaActiva,
    // Encadenamiento
    getCadenaCampanas,
    prepararCampanaEncadenada,
    // Progreso hídrico
    actualizarHidrico,
    registrarCosecha,
    // Estadísticas
    getEstadisticasLote,
    // Helpers
    getAguaInicioCampanaActiva,
    // Backup
    exportarCampanas,
    importarCampanas,
    // API simplificada
    campanasInit,
    campanaNueva,
    campanaActivar,
    campanaCerrar,
    campanaListar,
    campanaActual,
    campanaAnterior,
    // Internals expuestos para tests
    _uuidv4:    uuidv4,
    _validar:   validar,
    _persistir,
  };
} else if (typeof window !== "undefined") {
  window.Campanas = {
    // CRUD completo
    crearCampana,
    obtenerCampana,
    listarCampanas,
    actualizarCampana,
    archivarCampana,
    eliminarCampana,
    activarCampana,
    getCampanaActiva,
    limpiarCampanaActiva,
    getCadenaCampanas,
    prepararCampanaEncadenada,
    actualizarHidrico,
    registrarCosecha,
    getEstadisticasLote,
    getAguaInicioCampanaActiva,
    exportarCampanas,
    importarCampanas,
    // API simplificada
    campanasInit,
    campanaNueva,
    campanaActivar,
    campanaCerrar,
    campanaListar,
    campanaActual,
    campanaAnterior,
  };
}
