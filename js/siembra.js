/**
 * siembra.js — AGROMOTOR v2.0
 *
 * Módulo de registro de datos de siembra: fecha, cultivo, lote y coordenadas.
 * Es el punto de entrada del flujo planificación y el proveedor de datos
 * para todos los módulos aguas abajo (fenologia, hidrico, decision, economia).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  ESCRIBE estas claves en localStorage:                                      │
 * │    am_siembra_fecha           → "YYYY-MM-DD"                                │
 * │    am_siembra_cultivo         → "soja"|"maiz"|"trigo"|"girasol"             │
 * │    am_siembra_lote            → string (ID o nombre del lote)               │
 * │    am_siembra_lat             → number (grados decimales)                   │
 * │    am_siembra_lon             → number (grados decimales)                   │
 * │    am_siembra_densidad        → number (plantas/m² o kg/ha)                 │
 * │    am_siembra_variedad        → string (nombre de variedad, opcional)       │
 * │    am_siembra_cultivo_ant     → "soja"|"maiz"|"trigo"|"girasol"|"pastizal"  │
 * │    am_siembra_fecha_cosecha_ant → "YYYY-MM-DD" (cosecha del antecesor)      │
 * │    am_siembra_agua_cosecha_ant_mm → number (agua perfil al cosechar ant.)   │
 * │    am_siembra_ts              → ISO timestamp del último guardado            │
 * │    am_siembra_campana_id      → string (ID campaña asociada)                │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │  LEE estas claves de localStorage:                                          │
 * │    am_lote_activo             → JSON { id, nombre, lat, lon, awcMm, ... }   │
 * │    am_campana_activa_id       → string                                      │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Integración con barbecho.js:
 *   Si se registra un cultivo antecesor con fecha de cosecha y agua al cosechar,
 *   el módulo barbecho.js puede calcular el balance hídrico del período de
 *   barbecho automáticamente. La función `getTriggerBarbecho()` devuelve el
 *   objeto de parámetros listo para pasar a `calcularBarbecho()`.
 *
 * Uso típico:
 *   import { guardarSiembra, getSiembra, getTriggerBarbecho } from './siembra.js';
 *
 *   const { ok, errores } = guardarSiembra({
 *     fecha:          "2024-11-15",
 *     cultivo:        "soja",
 *     loteId:         "lote-norte-01",
 *     lat:            -33.12,
 *     lon:            -61.45,
 *     densidad:       32,                      // plantas/m²
 *     variedad:       "DM 4.2 OL",
 *     cultivoAnt:     "maiz",
 *     fechaCosechaAnt:"2024-04-20",
 *     aguaCosechaAntMm: 180,
 *   });
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const VERSION_SIEMBRA = "2.0.0";

// Claves escritas por este módulo
const LS_SIEMBRA_FECHA          = "am_siembra_fecha";
const LS_SIEMBRA_CULTIVO        = "am_siembra_cultivo";
const LS_SIEMBRA_LOTE           = "am_siembra_lote";
const LS_SIEMBRA_LAT            = "am_siembra_lat";
const LS_SIEMBRA_LON            = "am_siembra_lon";
const LS_SIEMBRA_DENSIDAD       = "am_siembra_densidad";
const LS_SIEMBRA_VARIEDAD       = "am_siembra_variedad";
const LS_SIEMBRA_CULTIVO_ANT    = "am_siembra_cultivo_ant";
const LS_SIEMBRA_FECHA_COS_ANT  = "am_siembra_fecha_cosecha_ant";
const LS_SIEMBRA_AGUA_COS_ANT   = "am_siembra_agua_cosecha_ant_mm";
const LS_SIEMBRA_TS             = "am_siembra_ts";
const LS_SIEMBRA_CAMPANA        = "am_siembra_campana_id";

// Claves leídas de otros módulos (solo lectura)
const LS_LOTE_ACTIVO            = "am_lote_activo";
const LS_CAMPANA_ID             = "am_campana_activa_id";

// Cultivos soportados (deben coincidir con fenologia.js)
const CULTIVOS_VALIDOS = ["soja", "maiz", "trigo", "girasol"];

// Cultivos antecesores soportados (más amplio; incluye pastizal y barbecho desnudo)
const CULTIVOS_ANT_VALIDOS = ["soja", "maiz", "trigo", "girasol", "girasol_sin_cosecha",
                               "sorgo", "pastizal", "barbecho_desnudo"];

// Rango de densidad aceptable por cultivo (plantas/m² equivalentes)
const DENSIDAD_RANGOS = {
  soja:    { min: 20,  max: 60,  unidad: "plantas/m²" },
  maiz:    { min: 4,   max: 14,  unidad: "plantas/m²" },
  trigo:   { min: 150, max: 500, unidad: "plantas/m²" },
  girasol: { min: 3,   max: 9,   unidad: "plantas/m²" },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS localStorage
// ─────────────────────────────────────────────────────────────────────────────

function _lsGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

function _lsSet(key, value) {
  try { localStorage.setItem(key, String(value)); return true; } catch (_) { return false; }
}

function _lsGetJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function _lsRemove(key) {
  try { localStorage.removeItem(key); } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida los datos de siembra. Devuelve lista de errores (vacía = OK).
 * @param {Object} datos
 * @returns {string[]}
 */
function validarSiembra(datos) {
  const errores = [];

  // Fecha de siembra
  if (!datos.fecha) {
    errores.push("La fecha de siembra es obligatoria.");
  } else {
    const d = new Date(datos.fecha);
    if (isNaN(d.getTime())) {
      errores.push(`Fecha de siembra inválida: "${datos.fecha}". Usar formato YYYY-MM-DD.`);
    } else {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (d > hoy) {
        errores.push("La fecha de siembra no puede ser futura.");
      }
    }
  }

  // Cultivo
  if (!datos.cultivo) {
    errores.push("El cultivo es obligatorio.");
  } else if (!CULTIVOS_VALIDOS.includes(datos.cultivo)) {
    errores.push(`Cultivo no reconocido: "${datos.cultivo}". Válidos: ${CULTIVOS_VALIDOS.join(", ")}.`);
  }

  // Lote
  if (!datos.loteId || String(datos.loteId).trim() === "") {
    errores.push("El ID de lote es obligatorio.");
  }

  // Coordenadas
  if (datos.lat === undefined || datos.lat === null) {
    errores.push("La latitud del lote es obligatoria.");
  } else if (typeof datos.lat !== "number" || datos.lat < -90 || datos.lat > 90) {
    errores.push(`Latitud fuera de rango: ${datos.lat}. Debe ser entre -90 y 90.`);
  }

  if (datos.lon === undefined || datos.lon === null) {
    errores.push("La longitud del lote es obligatoria.");
  } else if (typeof datos.lon !== "number" || datos.lon < -180 || datos.lon > 180) {
    errores.push(`Longitud fuera de rango: ${datos.lon}. Debe ser entre -180 y 180.`);
  }

  // Densidad (opcional pero si se proporciona, validar rango)
  if (datos.densidad !== undefined && datos.densidad !== null) {
    const cult = datos.cultivo;
    const rango = cult ? DENSIDAD_RANGOS[cult] : null;
    if (typeof datos.densidad !== "number" || datos.densidad <= 0) {
      errores.push("La densidad debe ser un número positivo.");
    } else if (rango && (datos.densidad < rango.min || datos.densidad > rango.max)) {
      errores.push(
        `Densidad fuera del rango esperado para ${cult}: ${datos.densidad} ` +
        `${rango.unidad} (esperado ${rango.min}–${rango.max}).`
      );
    }
  }

  // Cultivo antecesor (bloque opcional — si se da uno de los campos, todos son requeridos)
  const tieneAnt = datos.cultivoAnt || datos.fechaCosechaAnt ||
                   (datos.aguaCosechaAntMm !== undefined && datos.aguaCosechaAntMm !== null);

  if (tieneAnt) {
    if (!datos.cultivoAnt) {
      errores.push("Si registra datos del antecesor, el cultivo antecesor es obligatorio.");
    } else if (!CULTIVOS_ANT_VALIDOS.includes(datos.cultivoAnt)) {
      errores.push(`Cultivo antecesor no reconocido: "${datos.cultivoAnt}".`);
    }

    if (!datos.fechaCosechaAnt) {
      errores.push("Si registra datos del antecesor, la fecha de cosecha del antecesor es obligatoria.");
    } else {
      const dAnt = new Date(datos.fechaCosechaAnt);
      if (isNaN(dAnt.getTime())) {
        errores.push(`Fecha de cosecha del antecesor inválida: "${datos.fechaCosechaAnt}".`);
      } else if (datos.fecha) {
        const dSiem = new Date(datos.fecha);
        if (!isNaN(dSiem.getTime()) && dAnt >= dSiem) {
          errores.push("La cosecha del antecesor debe ser anterior a la fecha de siembra.");
        }
      }
    }

    if (datos.aguaCosechaAntMm === undefined || datos.aguaCosechaAntMm === null) {
      errores.push("Si registra datos del antecesor, el agua en perfil al cosechar el antecesor es obligatoria.");
    } else if (typeof datos.aguaCosechaAntMm !== "number" || datos.aguaCosechaAntMm < 0) {
      errores.push("El agua en perfil al cosechar el antecesor debe ser un número ≥ 0.");
    } else if (datos.aguaCosechaAntMm > 500) {
      errores.push("El agua en perfil al cosechar el antecesor parece excesiva (> 500 mm). Revisar.");
    }
  }

  return errores;
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARDADO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guarda los datos de siembra en localStorage.
 *
 * Acepta coordenadas explícitas o las resuelve automáticamente desde
 * el lote activo (am_lote_activo) si no se proveen.
 *
 * @param {Object}  datos
 * @param {string}  datos.fecha               "YYYY-MM-DD"
 * @param {string}  datos.cultivo             "soja"|"maiz"|"trigo"|"girasol"
 * @param {string}  datos.loteId              ID o nombre del lote
 * @param {number}  [datos.lat]               Latitud (si omite, lee am_lote_activo)
 * @param {number}  [datos.lon]               Longitud (si omite, lee am_lote_activo)
 * @param {number}  [datos.densidad]          Densidad de siembra
 * @param {string}  [datos.variedad]          Nombre de variedad
 * @param {string}  [datos.cultivoAnt]        Cultivo antecesor
 * @param {string}  [datos.fechaCosechaAnt]   Fecha cosecha antecesor "YYYY-MM-DD"
 * @param {number}  [datos.aguaCosechaAntMm]  Agua perfil al cosechar antecesor (mm)
 *
 * @returns {{ ok: boolean, errores: string[], datos: Object|null }}
 */
function guardarSiembra(datos) {
  // Resolver coordenadas desde el lote activo si no se proveen
  const datosResueltos = _resolverCoordenadas(datos);

  // Validar
  const errores = validarSiembra(datosResueltos);
  if (errores.length > 0) {
    return { ok: false, errores, datos: null };
  }

  const campanaId = _lsGet(LS_CAMPANA_ID) || "";
  const ts        = new Date().toISOString();

  // Escribir claves obligatorias
  _lsSet(LS_SIEMBRA_FECHA,   datosResueltos.fecha);
  _lsSet(LS_SIEMBRA_CULTIVO, datosResueltos.cultivo);
  _lsSet(LS_SIEMBRA_LOTE,    String(datosResueltos.loteId).trim());
  _lsSet(LS_SIEMBRA_LAT,     datosResueltos.lat);
  _lsSet(LS_SIEMBRA_LON,     datosResueltos.lon);
  _lsSet(LS_SIEMBRA_TS,      ts);
  _lsSet(LS_SIEMBRA_CAMPANA, campanaId);

  // Densidad y variedad (opcionales)
  if (datosResueltos.densidad !== undefined && datosResueltos.densidad !== null) {
    _lsSet(LS_SIEMBRA_DENSIDAD, datosResueltos.densidad);
  } else {
    _lsRemove(LS_SIEMBRA_DENSIDAD);
  }

  if (datosResueltos.variedad) {
    _lsSet(LS_SIEMBRA_VARIEDAD, String(datosResueltos.variedad).trim());
  } else {
    _lsRemove(LS_SIEMBRA_VARIEDAD);
  }

  // Datos del antecesor (opcionales)
  const tieneAnt = datosResueltos.cultivoAnt && datosResueltos.fechaCosechaAnt &&
                   datosResueltos.aguaCosechaAntMm !== undefined &&
                   datosResueltos.aguaCosechaAntMm !== null;

  if (tieneAnt) {
    _lsSet(LS_SIEMBRA_CULTIVO_ANT,   datosResueltos.cultivoAnt);
    _lsSet(LS_SIEMBRA_FECHA_COS_ANT, datosResueltos.fechaCosechaAnt);
    _lsSet(LS_SIEMBRA_AGUA_COS_ANT,  datosResueltos.aguaCosechaAntMm);
  } else {
    _lsRemove(LS_SIEMBRA_CULTIVO_ANT);
    _lsRemove(LS_SIEMBRA_FECHA_COS_ANT);
    _lsRemove(LS_SIEMBRA_AGUA_COS_ANT);
  }

  const datosGuardados = getSiembra();
  return { ok: true, errores: [], datos: datosGuardados };
}

/**
 * Intenta completar lat/lon desde am_lote_activo si el caller no los provee.
 * @param {Object} datos
 * @returns {Object}
 */
function _resolverCoordenadas(datos) {
  if (datos.lat !== undefined && datos.lat !== null &&
      datos.lon !== undefined && datos.lon !== null) {
    return datos;
  }

  const lote = _lsGetJSON(LS_LOTE_ACTIVO);
  if (!lote) return datos;

  return {
    ...datos,
    lat: datos.lat !== undefined && datos.lat !== null ? datos.lat : (lote.lat ?? lote.latitud ?? null),
    lon: datos.lon !== undefined && datos.lon !== null ? datos.lon : (lote.lon ?? lote.longitud ?? null),
    // Si no se proporcionó loteId pero hay uno en el lote activo, usarlo
    loteId: datos.loteId || lote.id || lote.nombre || "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LECTURA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve todos los datos de siembra guardados, o null si no hay ninguno.
 * @returns {SiembraData|null}
 */
function getSiembra() {
  const fecha = _lsGet(LS_SIEMBRA_FECHA);
  if (!fecha) return null;

  const latRaw = _lsGet(LS_SIEMBRA_LAT);
  const lonRaw = _lsGet(LS_SIEMBRA_LON);
  const densRaw = _lsGet(LS_SIEMBRA_DENSIDAD);
  const aguaRaw = _lsGet(LS_SIEMBRA_AGUA_COS_ANT);

  return {
    // Obligatorios
    fecha,
    cultivo:     _lsGet(LS_SIEMBRA_CULTIVO)   || null,
    loteId:      _lsGet(LS_SIEMBRA_LOTE)       || null,
    lat:         latRaw  !== null ? parseFloat(latRaw)  : null,
    lon:         lonRaw  !== null ? parseFloat(lonRaw)  : null,
    // Opcionales
    densidad:    densRaw !== null ? parseFloat(densRaw) : null,
    variedad:    _lsGet(LS_SIEMBRA_VARIEDAD)   || null,
    // Antecesor
    cultivoAnt:        _lsGet(LS_SIEMBRA_CULTIVO_ANT)   || null,
    fechaCosechaAnt:   _lsGet(LS_SIEMBRA_FECHA_COS_ANT) || null,
    aguaCosechaAntMm:  aguaRaw !== null ? parseFloat(aguaRaw) : null,
    // Meta
    ts:          _lsGet(LS_SIEMBRA_TS)         || null,
    campanaId:   _lsGet(LS_SIEMBRA_CAMPANA)    || null,
  };
}

/**
 * Devuelve sólo las claves que consumen los módulos de planificación.
 * Útil para verificar que siembra está completa antes de abrir fenologia.
 * @returns {{ completa: boolean, faltantes: string[] }}
 */
function getEstadoCompletitud() {
  const obligatorias = {
    [LS_SIEMBRA_FECHA]:   "Fecha de siembra",
    [LS_SIEMBRA_CULTIVO]: "Cultivo",
    [LS_SIEMBRA_LOTE]:    "Lote",
    [LS_SIEMBRA_LAT]:     "Latitud",
    [LS_SIEMBRA_LON]:     "Longitud",
  };

  const faltantes = [];
  for (const [key, label] of Object.entries(obligatorias)) {
    if (!_lsGet(key)) faltantes.push(label);
  }

  return { completa: faltantes.length === 0, faltantes };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRACIÓN CON barbecho.js
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve los parámetros necesarios para llamar a `calcularBarbecho()` de
 * barbecho.js, resolviendo los datos del lote activo y del suelo.
 *
 * Retorna null si no hay datos de antecesor registrados.
 *
 * Uso:
 *   const params = getTriggerBarbecho();
 *   if (params) {
 *     const balance = await calcularBarbecho(params);
 *   }
 *
 * @returns {TriggerBarbechoParams|null}
 */
function getTriggerBarbecho() {
  const s = getSiembra();
  if (!s) return null;

  // Se necesitan todos los datos del antecesor
  if (!s.cultivoAnt || !s.fechaCosechaAnt || s.aguaCosechaAntMm === null) {
    return null;
  }

  // AWC del lote: leer de am_lote_awc_mm o del objeto lote activo
  const awcRaw  = _lsGet("am_lote_awc_mm");
  const lote    = _lsGetJSON(LS_LOTE_ACTIVO);
  const awcMm   = awcRaw  ? parseFloat(awcRaw)  :
                  lote?.awcMm ? lote.awcMm       :
                  200;  // default pampeano si no hay dato de suelo

  return {
    lat:             s.lat,
    lon:             s.lon,
    aguaInicioMm:    s.aguaCosechaAntMm,
    fechaCosechaAnt: s.fechaCosechaAnt,
    fechaSiembra:    s.fecha,
    awcMm,
    fuenteAgua:      "campana_anterior",
    cultivoAnt:      s.cultivoAnt,      // trazabilidad extra
  };
}

/**
 * @typedef {Object} TriggerBarbechoParams
 * @property {number} lat
 * @property {number} lon
 * @property {number} aguaInicioMm
 * @property {string} fechaCosechaAnt
 * @property {string} fechaSiembra
 * @property {number} awcMm
 * @property {string} fuenteAgua
 * @property {string} cultivoAnt
 */

// ─────────────────────────────────────────────────────────────────────────────
// BORRADO / RESET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Elimina todos los datos de siembra del localStorage.
 * Llamar al cambiar de campaña o lote.
 */
function limpiarSiembra() {
  [
    LS_SIEMBRA_FECHA, LS_SIEMBRA_CULTIVO, LS_SIEMBRA_LOTE,
    LS_SIEMBRA_LAT, LS_SIEMBRA_LON, LS_SIEMBRA_DENSIDAD, LS_SIEMBRA_VARIEDAD,
    LS_SIEMBRA_CULTIVO_ANT, LS_SIEMBRA_FECHA_COS_ANT, LS_SIEMBRA_AGUA_COS_ANT,
    LS_SIEMBRA_TS, LS_SIEMBRA_CAMPANA,
  ].forEach(_lsRemove);
}

// ─────────────────────────────────────────────────────────────────────────────
// LOTE ACTIVO (helper de conveniencia)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el objeto del lote activo desde localStorage, o null.
 * @returns {Object|null}
 */
function getLoteActivo() {
  return _lsGetJSON(LS_LOTE_ACTIVO);
}

/**
 * Verifica si hay un lote activo válido (prerequisito para abrir siembra).
 * @returns {boolean}
 */
function hayLoteActivo() {
  const lote = getLoteActivo();
  return !!lote && !!(lote.id || lote.nombre);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZADO UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rellena el formulario HTML de siembra con los datos guardados.
 * Usa convención de nombres: el campo <input name="fecha"> → am_siembra_fecha.
 *
 * Si el elemento del formulario no existe en el DOM, no hace nada.
 *
 * @param {string} [formId="form-siembra"]
 */
function precargarFormulario(formId = "form-siembra") {
  const form = document.getElementById(formId);
  if (!form) return;

  const s = getSiembra();
  if (!s) {
    // Intentar precargar lote activo aunque no haya siembra guardada
    const lote = getLoteActivo();
    if (lote) {
      _setFormField(form, "loteId", lote.id || lote.nombre || "");
      _setFormField(form, "lat",    lote.lat ?? lote.latitud ?? "");
      _setFormField(form, "lon",    lote.lon ?? lote.longitud ?? "");
    }
    return;
  }

  _setFormField(form, "fecha",            s.fecha        || "");
  _setFormField(form, "cultivo",          s.cultivo      || "");
  _setFormField(form, "loteId",           s.loteId       || "");
  _setFormField(form, "lat",              s.lat          ?? "");
  _setFormField(form, "lon",              s.lon          ?? "");
  _setFormField(form, "densidad",         s.densidad     ?? "");
  _setFormField(form, "variedad",         s.variedad     || "");
  _setFormField(form, "cultivoAnt",       s.cultivoAnt   || "");
  _setFormField(form, "fechaCosechaAnt",  s.fechaCosechaAnt || "");
  _setFormField(form, "aguaCosechaAntMm", s.aguaCosechaAntMm ?? "");
}

/**
 * Lee los datos del formulario HTML y llama a guardarSiembra().
 * Devuelve el mismo resultado que guardarSiembra().
 *
 * @param {string} [formId="form-siembra"]
 * @returns {{ ok: boolean, errores: string[], datos: Object|null }}
 */
function guardarDesdeFormulario(formId = "form-siembra") {
  const form = document.getElementById(formId);
  if (!form) return { ok: false, errores: ["Formulario no encontrado en el DOM."], datos: null };

  const get = (name) => {
    const el = form.elements[name];
    return el ? el.value.trim() : "";
  };

  const latStr   = get("lat");
  const lonStr   = get("lon");
  const densStr  = get("densidad");
  const aguaStr  = get("aguaCosechaAntMm");

  const datos = {
    fecha:            get("fecha"),
    cultivo:          get("cultivo"),
    loteId:           get("loteId"),
    lat:              latStr  !== "" ? parseFloat(latStr)  : null,
    lon:              lonStr  !== "" ? parseFloat(lonStr)  : null,
    densidad:         densStr !== "" ? parseFloat(densStr) : null,
    variedad:         get("variedad")        || null,
    cultivoAnt:       get("cultivoAnt")      || null,
    fechaCosechaAnt:  get("fechaCosechaAnt") || null,
    aguaCosechaAntMm: aguaStr !== "" ? parseFloat(aguaStr) : null,
  };

  return guardarSiembra(datos);
}

/**
 * Muestra un resumen de la siembra guardada en el elemento con id="siembra-resumen".
 * @param {string} [elId="siembra-resumen"]
 */
function renderizarResumen(elId = "siembra-resumen") {
  const el = document.getElementById(elId);
  if (!el) return;

  const s = getSiembra();
  if (!s) {
    el.innerHTML = `<p style="color:#888;font-style:italic;">Sin siembra registrada.</p>`;
    return;
  }

  const cultivoLabel = {
    soja: "Soja", maiz: "Maíz", trigo: "Trigo", girasol: "Girasol",
  };

  const antecedente = s.cultivoAnt
    ? `<tr><td>Antecesor</td><td>${s.cultivoAnt} — cosecha ${s.fechaCosechaAnt || "?"} — ${s.aguaCosechaAntMm ?? "?"} mm perfil</td></tr>`
    : "";

  el.innerHTML = `
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <tr style="background:#F0F4F8;">
        <td style="padding:6px 10px;font-weight:700;color:#1B4F72;" colspan="2">
          Siembra registrada ✓
        </td>
      </tr>
      <tr><td style="padding:4px 10px;color:#666;width:140px;">Cultivo</td>
          <td style="padding:4px 10px;">${cultivoLabel[s.cultivo] || s.cultivo}</td></tr>
      <tr><td style="padding:4px 10px;color:#666;">Fecha</td>
          <td style="padding:4px 10px;">${s.fecha}</td></tr>
      <tr><td style="padding:4px 10px;color:#666;">Lote</td>
          <td style="padding:4px 10px;">${s.loteId}</td></tr>
      <tr><td style="padding:4px 10px;color:#666;">Coordenadas</td>
          <td style="padding:4px 10px;">${s.lat?.toFixed(4)}, ${s.lon?.toFixed(4)}</td></tr>
      ${s.densidad ? `<tr><td style="padding:4px 10px;color:#666;">Densidad</td>
          <td style="padding:4px 10px;">${s.densidad} ${DENSIDAD_RANGOS[s.cultivo]?.unidad || ""}</td></tr>` : ""}
      ${s.variedad ? `<tr><td style="padding:4px 10px;color:#666;">Variedad</td>
          <td style="padding:4px 10px;">${s.variedad}</td></tr>` : ""}
      ${antecedente}
    </table>
    <p style="margin:4px 0 0;font-size:11px;color:#aaa;">Guardado: ${s.ts ? new Date(s.ts).toLocaleString("es-AR") : "?"}</p>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS internos UI
// ─────────────────────────────────────────────────────────────────────────────

function _setFormField(form, name, value) {
  const el = form.elements[name];
  if (!el) return;
  if (el.tagName === "SELECT") {
    // Buscar la opción que coincida
    for (let i = 0; i < el.options.length; i++) {
      if (el.options[i].value === String(value)) {
        el.selectedIndex = i;
        return;
      }
    }
  } else {
    el.value = value;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG / EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resumen de estado del módulo para debugging.
 * @returns {string}
 */
function exportarResumen() {
  const s = getSiembra();
  const { completa, faltantes } = getEstadoCompletitud();
  const triggerBarb = getTriggerBarbecho();
  const lines = [
    `=== siembra.js v${VERSION_SIEMBRA} ===`,
    `Campaña activa : ${_lsGet(LS_CAMPANA_ID) || "(ninguna)"}`,
    `Lote activo    : ${hayLoteActivo() ? "sí" : "NO — prerequisito faltante"}`,
    ``,
    `Estado siembra :`,
    `  Completa: ${completa ? "✓" : "✗ — Faltan: " + faltantes.join(", ")}`,
  ];
  if (s) {
    lines.push(`  Cultivo     : ${s.cultivo}`);
    lines.push(`  Fecha       : ${s.fecha}`);
    lines.push(`  Lote        : ${s.loteId}`);
    lines.push(`  Coord.      : ${s.lat}, ${s.lon}`);
    if (s.variedad)   lines.push(`  Variedad    : ${s.variedad}`);
    if (s.densidad)   lines.push(`  Densidad    : ${s.densidad}`);
    if (s.cultivoAnt) lines.push(`  Antecesor   : ${s.cultivoAnt} — cosecha ${s.fechaCosechaAnt} — ${s.aguaCosechaAntMm} mm`);
  }
  lines.push(``);
  lines.push(`Trigger barbecho: ${triggerBarb ? "disponible ✓" : "sin datos de antecesor"}`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPEDEFS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SiembraData
 * @property {string}       fecha
 * @property {string}       cultivo
 * @property {string}       loteId
 * @property {number}       lat
 * @property {number}       lon
 * @property {number|null}  densidad
 * @property {string|null}  variedad
 * @property {string|null}  cultivoAnt
 * @property {string|null}  fechaCosechaAnt
 * @property {number|null}  aguaCosechaAntMm
 * @property {string|null}  ts
 * @property {string|null}  campanaId
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES EXPORTADAS
// ─────────────────────────────────────────────────────────────────────────────

const CULTIVOS     = CULTIVOS_VALIDOS;
const CULTIVOS_ANT = CULTIVOS_ANT_VALIDOS;

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

const _exports = {
  // Guardado
  guardarSiembra,
  guardarDesdeFormulario,
  // Lectura
  getSiembra,
  getEstadoCompletitud,
  getLoteActivo,
  hayLoteActivo,
  // Validación
  validarSiembra,
  // Barbecho
  getTriggerBarbecho,
  // Reset
  limpiarSiembra,
  // UI
  precargarFormulario,
  renderizarResumen,
  // Debug
  exportarResumen,
  // Constantes
  CULTIVOS,
  CULTIVOS_ANT,
  DENSIDAD_RANGOS,
  VERSION_SIEMBRA,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = _exports;
} else if (typeof window !== "undefined") {
  window.Siembra = _exports;
}
