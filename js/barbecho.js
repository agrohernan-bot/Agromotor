/**
 * barbecho.js — AGROMOTOR v2.0
 *
 * Calcula el balance hídrico del período de barbecho entre cultivos.
 * Es el eslabón que conecta campañas consecutivas y determina el
 * agua disponible al inicio de la siguiente campaña planificada.
 *
 * Fuentes de datos:
 *   - NASA POWER (precipitación diaria + temperatura max/min)
 *   - localStorage: am_suelo_awc (AWC del perfil en mm)
 *
 * Algoritmo (FAO-56 simplificado para barbecho):
 *   ET_barbecho(d) = ET0_Hargreaves(d) × 0.60 × 0.30
 *   agua(d) = MIN(AWC, MAX(0, agua(d-1) + lluvia(d) − ET_barbecho(d)))
 */

// ─────────────────────────────────────────────────────────────────────────────
// IIFE — evitar contaminación del scope global
// ─────────────────────────────────────────────────────────────────────────────
(function () {

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const BARBECHO_KC       = 0.30;   // Factor de reducción por rastrojo sin cultivo activo
const HARGREAVES_FACTOR = 0.60;   // Calibración regional pampeana
const NASA_POWER_BASE   = "https://power.larc.nasa.gov/api/temporal/daily/point";
const LS_KEY            = "am_barbecho_ultimo";   // Cache del último cálculo
const NASA_DATA_LAG     = 7;      // Días de rezago típico de NASA POWER

// ─────────────────────────────────────────────────────────────────────────────
// API NASA POWER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Descarga datos diarios de NASA POWER para un período y punto geográfico.
 * @param {number} lat
 * @param {number} lon
 * @param {string} fechaInicio  "YYYYMMDD"
 * @param {string} fechaFin     "YYYYMMDD"
 * @returns {Promise<Object>}   { dates: string[], precip: number[], tmax: number[], tmin: number[] }
 */
async function fetchNASAPower(lat, lon, fechaInicio, fechaFin) {
  const params = new URLSearchParams({
    parameters: "PRECTOTCORR,T2M_MAX,T2M_MIN",
    community:  "AG",
    longitude:  lon,
    latitude:   lat,
    start:      fechaInicio,
    end:        fechaFin,
    format:     "JSON",
  });

  const url = `${NASA_POWER_BASE}?${params}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let resp;
  try {
    resp = await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new Error(`NASA POWER error ${resp.status}: ${await resp.text()}`);

  const json = await resp.json();
  const props = json?.properties?.parameter;
  if (!props) throw new Error("Respuesta NASA POWER inesperada");

  const dates = Object.keys(props.PRECTOTCORR).sort();

  // -999 es el fill-value de NASA POWER para datos faltantes; tratar igual que null
  const clean = (v, fallback) => (v == null || v <= -998) ? fallback : v;

  return {
    dates,
    precip: dates.map(d => Math.max(0, clean(props.PRECTOTCORR[d], 0))),
    tmax:   dates.map(d => clean(props.T2M_MAX[d], 25)),
    tmin:   dates.map(d => clean(props.T2M_MIN[d], 10)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULOS AGROCLIMÁTICOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ET0 por Hargreaves-Samani con factor de calibración regional.
 * @param {number} tmax   °C
 * @param {number} tmin   °C
 * @param {number} diaAnio  1-366
 * @param {number} lat    grados decimales
 * @returns {number}  ET0 en mm/día
 */
function et0Hargreaves(tmax, tmin, diaAnio, lat) {
  const tmean  = (tmax + tmin) / 2;
  const tdelta = Math.max(0, tmax - tmin);
  const latRad = (lat * Math.PI) / 180;

  // Radiación solar extraterrestre (Ra) en MJ/m²/día
  const dr     = 1 + 0.033 * Math.cos((2 * Math.PI * diaAnio) / 365);
  const decl   = 0.409 * Math.sin((2 * Math.PI * diaAnio) / 365 - 1.39);
  const ws     = Math.acos(-Math.tan(latRad) * Math.tan(decl));
  const Ra     = (24 * 60 / Math.PI) * 0.082 * dr *
                 (ws * Math.sin(latRad) * Math.sin(decl) +
                  Math.cos(latRad) * Math.cos(decl) * Math.sin(ws));

  // Hargreaves original: ET0 = 0.0023 × (Tmean + 17.8) × TD^0.5 × Ra
  const et0Raw = 0.0023 * (tmean + 17.8) * Math.pow(tdelta, 0.5) * Ra * 0.408;
  return Math.max(0, et0Raw * HARGREAVES_FACTOR);
}

/**
 * Número de día del año a partir de una fecha ISO ("YYYY-MM-DD").
 * Usa UTC para evitar desfase de zona horaria (Argentina UTC-3).
 */
function diaDelAnio(fechaISO) {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const fecha    = new Date(Date.UTC(y, m - 1, d));
  const inicioAnio = new Date(Date.UTC(y, 0, 0));
  return Math.floor((fecha - inicioAnio) / 86400000);
}

function sumarDiasISO(fechaISO, dias) {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d + dias));
  return fecha.toISOString().slice(0, 10);
}

function rangoDiasISO(desdeISO, hastaISO) {
  const out = [];
  for (let f = desdeISO; f <= hastaISO; f = sumarDiasISO(f, 1)) out.push(f);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// BALANCE HÍDRICO BARBECHO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ejecuta el balance hídrico diario del período de barbecho.
 *
 * @param {Object} params
 * @param {number}  params.lat               Latitud del lote
 * @param {number}  params.lon               Longitud del lote
 * @param {number}  params.aguaInicioMm      Agua en perfil al momento de cosecha del antecesor (mm)
 * @param {string}  params.fechaCosechaAnt   Fecha cosecha antecesor "YYYY-MM-DD"
 * @param {string}  params.fechaSiembra      Fecha siembra nuevo cultivo "YYYY-MM-DD"
 * @param {number}  params.awcMm             Agua aprovechable total del perfil (mm)
 * @param {string}  [params.fuenteAgua]      "campana_anterior" | "usuario" (para trazabilidad)
 *
 * @returns {Promise<BalanceBarbecho>}
 */
async function calcularBarbecho(params) {
  const {
    lat, lon,
    aguaInicioMm,
    fechaCosechaAnt,
    fechaSiembra,
    awcMm,
    fuenteAgua = "usuario",
  } = params;

  // Validaciones básicas
  if (new Date(fechaSiembra) <= new Date(fechaCosechaAnt)) {
    throw new Error("La fecha de siembra debe ser posterior a la cosecha del antecesor");
  }
  if (aguaInicioMm < 0 || aguaInicioMm > awcMm) {
    throw new Error(`El agua inicial (${aguaInicioMm} mm) debe estar entre 0 y AWC (${awcMm} mm)`);
  }

  // Convertir fechas a formato NASA POWER (YYYYMMDD)
  const f2nasa = (iso) => iso.replace(/-/g, "");

  // NASA POWER tiene rezago de datos (~7 días); no pedir fechas futuras o muy recientes
  const limiteAPI = new Date(Date.now() - NASA_DATA_LAG * 86400000).toISOString().slice(0, 10);
  const fechaFinAPI = fechaSiembra > limiteAPI ? limiteAPI : fechaSiembra;

  let nasa = { dates: [], precip: [], tmax: [], tmin: [] };
  if (fechaCosechaAnt <= fechaFinAPI) {
    nasa = await fetchNASAPower(lat, lon, f2nasa(fechaCosechaAnt), f2nasa(fechaFinAPI));
  }

  // Balance diario
  const diario = [];
  let agua = Math.min(aguaInicioMm, awcMm);

  const fechasNASA = nasa.dates.map(d => d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8));
  const ultimaFechaNASA = fechasNASA.length ? fechasNASA[fechasNASA.length - 1] : null;
  const fechaEstimadaInicio = ultimaFechaNASA ? sumarDiasISO(ultimaFechaNASA, 1) : fechaCosechaAnt;
  const fechasEstimadas = fechaEstimadaInicio <= fechaSiembra ? rangoDiasISO(fechaEstimadaInicio, fechaSiembra) : [];
  const tmaxRef = nasa.tmax.length ? nasa.tmax.reduce((a, b) => a + b, 0) / nasa.tmax.length : 25;
  const tminRef = nasa.tmin.length ? nasa.tmin.reduce((a, b) => a + b, 0) / nasa.tmin.length : 10;

  const procesarDia = (fecha, lluvia, tmax, tmin, fuente) => {
    const dia     = diaDelAnio(fecha);
    const et0     = et0Hargreaves(tmax, tmin, dia, lat);
    const etBarb  = et0 * BARBECHO_KC;
    const delta   = lluvia - etBarb;

    const aguaAntes = agua;
    agua = Math.min(awcMm, Math.max(0, agua + delta));

    diario.push({
      fecha,
      lluvia:    +lluvia.toFixed(1),
      et0:       +et0.toFixed(1),
      etBarbecho:+etBarb.toFixed(1),
        delta:     +delta.toFixed(1),
        agua:      +agua.toFixed(1),
        fuente,
      });
  };

  for (let i = 0; i < fechasNASA.length; i++) {
    procesarDia(fechasNASA[i], nasa.precip[i], nasa.tmax[i], nasa.tmin[i], "nasa_power");
  }
  fechasEstimadas.forEach(fecha => {
    procesarDia(fecha, 0, tmaxRef, tminRef, "estimado_sin_lluvia");
  });

  // Totales
  const totalLluvia = nasa.precip.reduce((a, b) => a + b, 0);
  const totalET0    = diario.reduce((a, d) => a + d.et0, 0);
  const totalETBarb = diario.reduce((a, d) => a + d.etBarbecho, 0);
  const balanceNeto = totalLluvia - totalETBarb;

  /** @type {BalanceBarbecho} */
  const resultado = {
    // Identificación
    fechaCosechaAnt,
    fechaSiembra,
    lat, lon,
    duracionDias: diario.length,

    // Agua
    aguaInicioMm:    +aguaInicioMm.toFixed(1),
    fuenteAgua,
    awcMm,
    aguaFinalMm:     +agua.toFixed(1),     // ← Este valor va a agua_inicio de la nueva campaña

    // Totales climáticos
    lluviaTotalMm:   +totalLluvia.toFixed(1),
    et0TotalMm:      +totalET0.toFixed(1),
    etBarbechoMm:    +totalETBarb.toFixed(1),
    balanceNetoMm:   +balanceNeto.toFixed(1),

    // Detalle diario (para gráficos)
    diario,

    // Metadatos
    calculadoEn:     new Date().toISOString(),
    diasEstimados:   fechasEstimadas.length,
    version:         "2.0",
  };

  // Guardar en localStorage como cache
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(resultado));
  } catch (_) { /* en contexto sin DOM (tests) ignorar */ }

  return resultado;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE LECTURA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recupera el último cálculo de barbecho guardado, o null si no existe.
 * @returns {BalanceBarbecho|null}
 */
function leerUltimoBarbecho() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Devuelve el agua disponible al inicio de la campaña planificada.
 * Primero busca un cálculo previo; si no existe, retorna null.
 * @returns {number|null}  mm
 */
function getAguaInicioPlanificada() {
  const b = leerUltimoBarbecho();
  return b ? b.aguaFinalMm : null;
}

/**
 * Limpia el cache de barbecho (al cambiar de campaña o lote).
 */
function limpiarBarbecho() {
  try { localStorage.removeItem(LS_KEY); } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRACIÓN CON hidrico.js
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escribe el agua inicial de barbecho en las claves que lee hidrico.js,
 * marcando explícitamente la fuente como "barbecho_planificacion".
 *
 * Llamar esta función luego de calcularBarbecho() y antes de abrir hidrico.js.
 *
 * @param {BalanceBarbecho} balanceBarbecho
 */
function publicarAguaInicialParaHidrico(balanceBarbecho) {
  try {
    localStorage.setItem("am_fen_agua_perfil",        String(balanceBarbecho.aguaFinalMm));
    localStorage.setItem("am_fen_agua_perfil_fuente", "barbecho_planificacion");
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIO POST-COSECHA → siguiente barbecho
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY_INICIO = "am_barbecho_inicio_pendiente";

/**
 * Registra el estado hídrico al momento de cosecha para iniciar el seguimiento
 * del próximo período de barbecho.
 *
 * Llamar desde informe-cierre.js al cerrar una campaña. En este momento
 * la fecha de siembra del próximo cultivo aún es desconocida, por lo que
 * se guarda el "inicio" y se completa luego con completarBarbecho().
 *
 * También escribe en am_siembra_* para precompletar el formulario de la
 * próxima campaña (antecesor y agua al cosechar), de modo que
 * siembra.precargarFormulario() los muestre automáticamente.
 *
 * @param {Object} params
 * @param {string}  params.fechaIni      "YYYY-MM-DD" — fecha de cosecha
 * @param {number}  params.aguaIniMm     Agua en perfil al cosechar (mm)
 * @param {number}  params.lat
 * @param {number}  params.lon
 * @param {number}  [params.awcMm]       AWC del perfil — se lee de am_lote_awc_mm si omitido
 * @param {string}  [params.cultivo]     Cultivo cosechado ("soja","maiz"…)
 * @param {string}  [params.campanaId]   ID de la campaña que se cierra (trazabilidad)
 *
 * @returns {{ fechaIni, aguaIniMm, lat, lon, awcMm, cultivo, campanaId, registradoEn }}
 * @throws {Error} si faltan parámetros obligatorios
 */
function iniciarBarbechoPostCosecha({
  fechaIni,
  aguaIniMm,
  lat,
  lon,
  awcMm,
  cultivo,
  campanaId,
} = {}) {
  if (!fechaIni || typeof aguaIniMm !== "number" ||
      typeof lat  !== "number" || typeof lon !== "number") {
    throw new Error(
      "iniciarBarbechoPostCosecha: fechaIni, aguaIniMm, lat y lon son obligatorios"
    );
  }

  // Resolver AWC: parámetro explícito → LS → default pampeano
  let awc = awcMm;
  if (awc == null) {
    try {
      const raw = localStorage.getItem("am_lote_awc_mm");
      awc = raw ? parseFloat(raw) : 200;
    } catch (_) {
      awc = 200;
    }
  }

  const registro = {
    fechaIni,
    aguaIniMm:   +aguaIniMm.toFixed(1),
    lat,
    lon,
    awcMm:       awc,
    cultivo:     cultivo  ?? "",
    campanaId:   campanaId ?? "",
    registradoEn: new Date().toISOString(),
  };

  try {
    localStorage.setItem(LS_KEY_INICIO, JSON.stringify(registro));

    // Pre-completar campos antecesor para el formulario de siembra del próximo cultivo
    localStorage.setItem("am_siembra_fecha_cosecha_ant",    fechaIni);
    localStorage.setItem("am_siembra_agua_cosecha_ant_mm", String(aguaIniMm));
    if (cultivo) localStorage.setItem("am_siembra_cultivo_ant", cultivo);
  } catch (_) { /* contexto sin localStorage (Node/tests) */ }

  return registro;
}

/**
 * Completa el barbecho pendiente usando la fecha de siembra del próximo cultivo.
 *
 * Invoca calcularBarbecho() con los datos almacenados por
 * iniciarBarbechoPostCosecha() y, al terminar:
 *   1. Llama publicarAguaInicialParaHidrico() para dejar el agua lista en hidrico.js
 *   2. Limpia el registro pendiente (limpiarBarbechoInicioPendiente)
 *
 * Llamar desde siembra.guardarSiembra() o desde la init de la nueva campaña.
 *
 * @param {string} fechaSiembra  "YYYY-MM-DD" — fecha de siembra del nuevo cultivo
 * @returns {Promise<BalanceBarbecho>}
 * @throws {Error} si no hay barbecho pendiente
 */
async function completarBarbecho(fechaSiembra) {
  const pendiente = getBarbechoInicioPendiente();
  if (!pendiente) {
    throw new Error(
      "completarBarbecho: no hay barbecho pendiente. " +
      "Llamar primero a iniciarBarbechoPostCosecha()."
    );
  }

  const balance = await calcularBarbecho({
    lat:             pendiente.lat,
    lon:             pendiente.lon,
    aguaInicioMm:    pendiente.aguaIniMm,
    fechaCosechaAnt: pendiente.fechaIni,
    fechaSiembra,
    awcMm:           pendiente.awcMm,
    fuenteAgua:      "campana_anterior",
  });

  // Publicar resultado para hidrico.js y cerrar el pendiente
  publicarAguaInicialParaHidrico(balance);
  limpiarBarbechoInicioPendiente();

  return balance;
}

/**
 * Lee el registro de inicio post-cosecha guardado (sin fecha de siembra aún).
 * @returns {{ fechaIni, aguaIniMm, lat, lon, awcMm, cultivo, campanaId, registradoEn } | null}
 */
function getBarbechoInicioPendiente() {
  try {
    const raw = localStorage.getItem(LS_KEY_INICIO);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Elimina el registro de barbecho pendiente.
 * Llamar tras completarBarbecho() o al cambiar de lote/campaña.
 */
function limpiarBarbechoInicioPendiente() {
  try { localStorage.removeItem(LS_KEY_INICIO); } catch (_) {}
}

/**
 * Devuelve true si existe un barbecho pendiente de completar.
 * Útil para que nav.js muestre un indicador o para que siembra.js
 * ofrezca calcular el barbecho automáticamente al guardar la fecha.
 * @returns {boolean}
 */
function hayBarbechoPendiente() {
  return getBarbechoInicioPendiente() !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZADO UI (opcional — si el módulo carga en browser)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Muestra el resultado del balance en el elemento con id="barbecho-resultado".
 * Si no existe el elemento, no hace nada (modo test/headless).
 * @param {BalanceBarbecho} b
 */
function renderizarResultado(b) {
  const el = document.getElementById("barbecho-resultado");
  if (!el) return;

  const pct = b.awcMm > 0 ? Math.round((b.aguaFinalMm / b.awcMm) * 100) : 0;
  const colorPct = pct >= 60 ? "#2D6A4F" : pct >= 35 ? "#B05B1A" : "#E74C3C";

  el.innerHTML = `
    <div class="barbecho-card">
      <div class="barbecho-titulo">Balance de Barbecho</div>
      <div class="barbecho-periodo">
        ${b.fechaCosechaAnt} → ${b.fechaSiembra}
        <span class="barbecho-dias">(${b.duracionDias} días)</span>
      </div>
      <hr class="barbecho-hr">

      <div class="barbecho-grid">
        <div class="barbecho-item">
          <span class="barbecho-label">Agua al cosechar</span>
          <span class="barbecho-valor">${b.aguaInicioMm} mm</span>
          <span class="barbecho-fuente">${b.fuenteAgua}</span>
        </div>
        <div class="barbecho-item">
          <span class="barbecho-label">Lluvia barbecho</span>
          <span class="barbecho-valor">+${b.lluviaTotalMm} mm</span>
        </div>
        <div class="barbecho-item">
          <span class="barbecho-label">ET barbecho</span>
          <span class="barbecho-valor">−${b.etBarbechoMm} mm</span>
        </div>
        <div class="barbecho-item">
          <span class="barbecho-label">Balance neto</span>
          <span class="barbecho-valor ${b.balanceNetoMm >= 0 ? 'positivo' : 'negativo'}">${b.balanceNetoMm >= 0 ? '+' : ''}${b.balanceNetoMm} mm</span>
        </div>
      </div>

      <hr class="barbecho-hr">

      <div class="barbecho-agua-final">
        <span class="barbecho-label-grande">Agua al sembrar</span>
        <span class="barbecho-valor-grande" style="color:${colorPct}">
          ${b.aguaFinalMm} mm
        </span>
        <div class="barbecho-barra-contenedor">
          <div class="barbecho-barra" style="width:${pct}%;background:${colorPct}"></div>
        </div>
        <span class="barbecho-pct">${pct}% del AWC (${b.awcMm} mm)</span>
      </div>

      <div class="barbecho-fuente-datos">
        Datos: NASA POWER · Calculado ${new Date(b.calculadoEn).toLocaleString("es-AR")}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Compatible con CommonJS (Node/tests) y browser global
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    // Balance hídrico principal
    calcularBarbecho,
    // Lectura / caché
    leerUltimoBarbecho,
    getAguaInicioPlanificada,
    limpiarBarbecho,
    // Integración hidrico.js
    publicarAguaInicialParaHidrico,
    // Ciclo post-cosecha → siguiente campaña
    iniciarBarbechoPostCosecha,
    completarBarbecho,
    getBarbechoInicioPendiente,
    limpiarBarbechoInicioPendiente,
    hayBarbechoPendiente,
    // UI
    renderizarResultado,
    // Internals expuestos para testing
    _et0Hargreaves: et0Hargreaves,
    _diaDelAnio:    diaDelAnio,
  };
} else if (typeof window !== "undefined") {
  window.Barbecho = {
    // Balance hídrico principal
    calcularBarbecho,
    // Lectura / caché
    leerUltimoBarbecho,
    getAguaInicioPlanificada,
    limpiarBarbecho,
    // Integración hidrico.js
    publicarAguaInicialParaHidrico,
    // Ciclo post-cosecha → siguiente campaña
    iniciarBarbechoPostCosecha,
    completarBarbecho,
    getBarbechoInicioPendiente,
    limpiarBarbechoInicioPendiente,
    hayBarbechoPendiente,
    // UI
    renderizarResultado,
  };
}

/**
 * @typedef {Object} BalanceBarbecho
 * @property {string} fechaCosechaAnt
 * @property {string} fechaSiembra
 * @property {number} lat
 * @property {number} lon
 * @property {number} duracionDias
 * @property {number} aguaInicioMm
 * @property {string} fuenteAgua        "campana_anterior" | "usuario"
 * @property {number} awcMm
 * @property {number} aguaFinalMm       ← agua_inicio de la próxima campaña
 * @property {number} lluviaTotalMm
 * @property {number} et0TotalMm
 * @property {number} etBarbechoMm
 * @property {number} balanceNetoMm
 * @property {Array}  diario
 * @property {string} calculadoEn
 * @property {string} version
 */

})(); // fin IIFE barbecho.js
