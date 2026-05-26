/**
 * AGROMOTOR v2.0 — nav.js
 * Navegación principal con guard de rutas.
 *
 * Responsabilidades:
 *  - Definir el árbol de rutas del pipeline
 *  - Evaluar App.verificarGuard(ruta) antes de activar/mostrar cada ítem
 *  - Renderizar nav HTML con estado: activo / habilitado / bloqueado
 *  - Publicar ruta activa en localStorage (am_nav_ruta_activa)
 *  - Escuchar cambios de estado para re-render automático
 */

"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const LS_RUTA_ACTIVA = "am_nav_ruta_activa";
const LS_MODO        = "am_modo";                    // "planificacion" | "seguimiento"
const LS_CAMPANA_ID  = "am_campana_id";
const LS_CAMPANA_ACT = "am_campana_activa";          // "1" | "0"

/**
 * Definición canónica del pipeline.
 * orden: posición en la barra
 * requiere: claves LS que deben existir (no vacías) para habilitar
 * icono: emoji / SVG id
 */
const RUTAS = [
  {
    id:       "barbecho",
    label:    "Barbecho",
    icono:    "🌱",
    orden:    1,
    requiere: [],                                     // siempre accesible
    modos:    ["planificacion", "seguimiento"],
  },
  {
    id:       "fenologia",
    label:    "Fenología",
    icono:    "📅",
    orden:    2,
    requiere: ["am_campana_id"],
    modos:    ["planificacion", "seguimiento"],
  },
  {
    id:       "hidrico",
    label:    "Hídrico",
    icono:    "💧",
    orden:    3,
    requiere: ["am_campana_id", "am_fenologia_etapa_actual"],
    modos:    ["planificacion", "seguimiento"],
  },
  {
    id:       "alertas",
    label:    "Alertas",
    icono:    "🔔",
    orden:    4,
    requiere: ["am_campana_id", "am_hidrico_etc_total"],
    modos:    ["planificacion", "seguimiento"],
  },
  {
    id:       "decision",
    label:    "Decisiones",
    icono:    "⚖️",
    orden:    5,
    requiere: ["am_campana_id", "am_hidrico_etc_total"],
    modos:    ["planificacion", "seguimiento"],
  },
  {
    id:       "informe-cierre",
    label:    "Cierre",
    icono:    "📊",
    orden:    6,
    requiere: ["am_campana_id", "am_campana_activa"],
    modos:    ["planificacion", "seguimiento"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Estado interno del módulo
// ─────────────────────────────────────────────────────────────────────────────

let _rutaActiva   = null;
let _listeners    = [];
let _navContainer = null;   // elemento DOM raíz del nav (si se usó renderizarNav)

// ─────────────────────────────────────────────────────────────────────────────
// Guard de rutas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evalúa si una ruta puede activarse.
 * Primero consulta App.verificarGuard (si está disponible), luego
 * aplica la lógica local basada en requiere[].
 *
 * @param {string} rutaId
 * @returns {{ habilitada: boolean, razon: string|null }}
 */
function verificarGuard(rutaId) {
  const ruta = RUTAS.find(r => r.id === rutaId);
  if (!ruta) {
    return { habilitada: false, razon: `Ruta desconocida: ${rutaId}` };
  }

  // ── 1. Delegar a App.verificarGuard si existe ────────────────────────────
  if (typeof window !== "undefined" &&
      typeof window.App !== "undefined" &&
      typeof window.App.verificarGuard === "function") {
    try {
      const resultado = window.App.verificarGuard(rutaId);
      // App.verificarGuard puede retornar bool o { habilitada, razon }
      if (typeof resultado === "boolean") {
        return { habilitada: resultado, razon: resultado ? null : "App guard denegó acceso" };
      }
      if (typeof resultado === "object" && resultado !== null &&
          "habilitada" in resultado) {
        return resultado;
      }
    } catch (e) {
      console.warn("[nav] App.verificarGuard lanzó error:", e);
      // continúa con lógica local
    }
  }

  // ── 2. Guard local: verificar claves LS requeridas ───────────────────────
  for (const clave of ruta.requiere) {
    const val = _lsGet(clave);
    if (!val) {
      return {
        habilitada: false,
        razon:      `Requiere completar paso previo (${clave.replace("am_", "")})`,
      };
    }
    // am_campana_activa debe ser "1"
    if (clave === LS_CAMPANA_ACT && val !== "1") {
      return {
        habilitada: false,
        razon:      "No hay campaña activa",
      };
    }
  }

  // ── 3. Verificar modo compatible ─────────────────────────────────────────
  const modoActual = _lsGet(LS_MODO);
  if (modoActual && ruta.modos.length > 0 && !ruta.modos.includes(modoActual)) {
    return {
      habilitada: false,
      razon:      `Módulo no disponible en modo ${modoActual}`,
    };
  }

  return { habilitada: true, razon: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Navegación activa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Navega a una ruta si el guard lo permite.
 * Actualiza LS, notifica listeners, re-renderiza si hay contenedor.
 *
 * @param {string} rutaId
 * @returns {{ ok: boolean, razon: string|null }}
 */
function navegarA(rutaId) {
  const { habilitada, razon } = verificarGuard(rutaId);

  if (!habilitada) {
    console.warn(`[nav] Acceso bloqueado a "${rutaId}": ${razon}`);
    return { ok: false, razon };
  }

  _rutaActiva = rutaId;
  _lsSet(LS_RUTA_ACTIVA, rutaId);
  _notificarListeners(rutaId);

  if (_navContainer) {
    _actualizarDOM(_navContainer);
  }

  return { ok: true, razon: null };
}

/**
 * Retorna la ruta activa actual (desde LS como fuente de verdad).
 */
function getRutaActiva() {
  return _lsGet(LS_RUTA_ACTIVA) || _rutaActiva || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderizado HTML
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye y retorna el HTML del nav.
 * Si se pasa container (HTMLElement), lo inyecta directamente y
 * guarda referencia para re-renders automáticos.
 *
 * @param {object}      [opciones]
 * @param {HTMLElement} [opciones.container]      - elemento DOM donde inyectar
 * @param {string}      [opciones.claseNav]       - clase CSS del <nav>
 * @param {boolean}     [opciones.mostrarModo]    - mostrar badge de modo
 * @returns {string} HTML generado
 */
function renderizarNav(opciones = {}) {
  const {
    container     = null,
    claseNav      = "am-nav",
    mostrarModo   = true,
  } = opciones;

  if (container) {
    _navContainer = container;
  }

  const html = _construirHTML({ claseNav, mostrarModo });

  if (container) {
    container.innerHTML = html;
    _adjuntarEventos(container);
  }

  return html;
}

/**
 * Construye el HTML del nav (sin inyectar).
 */
function _construirHTML({ claseNav, mostrarModo }) {
  const rutaAct  = getRutaActiva();
  const modo     = _lsGet(LS_MODO) || "";
  const campanaId = _lsGet(LS_CAMPANA_ID) || "";

  const modoBadge = mostrarModo && modo
    ? `<span class="am-nav__modo am-nav__modo--${modo}">${_labelModo(modo)}</span>`
    : "";

  const items = RUTAS
    .sort((a, b) => a.orden - b.orden)
    .map(ruta => {
      const { habilitada, razon } = verificarGuard(ruta.id);
      const activo    = ruta.id === rutaAct;
      const clases    = [
        "am-nav__item",
        activo      ? "am-nav__item--activo"    : "",
        habilitada  ? "am-nav__item--habilitado" : "am-nav__item--bloqueado",
      ].filter(Boolean).join(" ");

      const tooltip = !habilitada && razon
        ? `title="${_esc(razon)}"`
        : "";

      const iconoHtml = `<span class="am-nav__icono" aria-hidden="true">${ruta.icono}</span>`;
      const labelHtml = `<span class="am-nav__label">${_esc(ruta.label)}</span>`;
      const candadoHtml = !habilitada
        ? `<span class="am-nav__lock" aria-label="bloqueado">🔒</span>`
        : "";

      // Botón (accesible): deshabilitado si bloqueado
      return `
        <li class="${clases}" role="none">
          <button
            class="am-nav__btn"
            data-ruta="${ruta.id}"
            ${!habilitada ? "disabled" : ""}
            ${activo ? 'aria-current="page"' : ""}
            ${tooltip}
            role="menuitem"
            type="button"
          >
            ${iconoHtml}${labelHtml}${candadoHtml}
          </button>
        </li>`.trim();
    })
    .join("\n");

  return `
<nav class="${claseNav}" aria-label="Navegación AGROMOTOR" role="navigation">
  <div class="am-nav__header">
    <span class="am-nav__logo">🌾 AGROMOTOR</span>
    ${modoBadge}
    ${campanaId ? `<span class="am-nav__campana">${_esc(campanaId)}</span>` : ""}
  </div>
  <ul class="am-nav__lista" role="menubar" aria-orientation="vertical">
    ${items}
  </ul>
</nav>`.trim();
}

/**
 * Actualiza sólo los estados (activo/bloqueado) sin reconstruir todo el DOM.
 * Más eficiente para re-renders frecuentes.
 *
 * @param {HTMLElement} container
 */
function _actualizarDOM(container) {
  if (!container) return;

  const rutaAct = getRutaActiva();
  const btns    = container.querySelectorAll(".am-nav__btn[data-ruta]");

  btns.forEach(btn => {
    const rutaId = btn.dataset.ruta;
    const { habilitada, razon } = verificarGuard(rutaId);
    const activo = rutaId === rutaAct;
    const li     = btn.closest(".am-nav__item");

    // Actualizar clase del li
    li.classList.toggle("am-nav__item--activo",     activo);
    li.classList.toggle("am-nav__item--habilitado",  habilitada);
    li.classList.toggle("am-nav__item--bloqueado",  !habilitada);

    // Atributos del botón
    btn.disabled = !habilitada;
    if (activo) {
      btn.setAttribute("aria-current", "page");
    } else {
      btn.removeAttribute("aria-current");
    }
    if (!habilitada && razon) {
      btn.setAttribute("title", razon);
    } else {
      btn.removeAttribute("title");
    }

    // Ícono de candado
    let candado = btn.querySelector(".am-nav__lock");
    if (!habilitada && !candado) {
      const span = document.createElement("span");
      span.className  = "am-nav__lock";
      span.setAttribute("aria-label", "bloqueado");
      span.textContent = "🔒";
      btn.appendChild(span);
    } else if (habilitada && candado) {
      candado.remove();
    }
  });
}

/**
 * Adjunta event listeners a los botones del nav inyectado.
 *
 * @param {HTMLElement} container
 */
function _adjuntarEventos(container) {
  container.querySelectorAll(".am-nav__btn[data-ruta]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const rutaId = e.currentTarget.dataset.ruta;
      const { ok, razon } = navegarA(rutaId);
      if (!ok) {
        // Feedback visual efímero en el botón
        const li = e.currentTarget.closest(".am-nav__item");
        li.classList.add("am-nav__item--shake");
        setTimeout(() => li.classList.remove("am-nav__item--shake"), 600);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Listeners externos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registra callback para cambios de ruta.
 * @param {(rutaId: string) => void} fn
 * @returns {() => void} función de desregistro
 */
function onNavegacion(fn) {
  if (typeof fn !== "function") return () => {};
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter(l => l !== fn);
  };
}

function _notificarListeners(rutaId) {
  _listeners.forEach(fn => {
    try { fn(rutaId); } catch (e) { console.error("[nav] listener error:", e); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reacción a cambios de estado externos (localStorage)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Llama esto cuando el estado externo cambie (p.ej. después de calcularHidrico).
 * Re-evalúa guards y actualiza el nav si hay contenedor activo.
 */
function refrescarNav() {
  if (_navContainer) {
    _actualizarDOM(_navContainer);
  }
}

/**
 * Escucha eventos 'storage' para re-renders automáticos entre pestañas.
 * Solo activo en contexto browser.
 */
function iniciarEscuchaStorage() {
  if (typeof window === "undefined") return;
  window.addEventListener("storage", (e) => {
    if (e.key && e.key.startsWith("am_")) {
      refrescarNav();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────

function _lsGet(clave) {
  try {
    return localStorage.getItem(clave) || null;
  } catch (_) {
    return null;
  }
}

function _lsSet(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch (_) {}
}

function _labelModo(modo) {
  return modo === "planificacion" ? "Planificación" : "Seguimiento";
}

function _esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS mínimo (inyectable si no hay hoja externa)
// ─────────────────────────────────────────────────────────────────────────────

const NAV_CSS = `
.am-nav { font-family: inherit; user-select: none; }
.am-nav__header { display: flex; align-items: center; gap: 8px; padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb; }
.am-nav__logo { font-weight: 700; font-size: 1.1rem; }
.am-nav__modo { font-size: 0.7rem; padding: 2px 8px; border-radius: 99px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em; }
.am-nav__modo--planificacion { background: #dbeafe; color: #1e40af; }
.am-nav__modo--seguimiento   { background: #d1fae5; color: #065f46; }
.am-nav__campana { font-size: 0.75rem; color: #6b7280; margin-left: auto; }
.am-nav__lista { list-style: none; margin: 0; padding: 8px 0; }
.am-nav__item { margin: 2px 0; }
.am-nav__btn { width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; border: none; background: transparent; cursor: pointer;
  text-align: left; border-radius: 6px; transition: background 0.15s; font-size: 0.9rem; }
.am-nav__btn:hover:not(:disabled) { background: #f3f4f6; }
.am-nav__item--activo .am-nav__btn { background: #eff6ff; color: #2563eb; font-weight: 600; }
.am-nav__item--bloqueado .am-nav__btn { color: #9ca3af; cursor: not-allowed; }
.am-nav__icono { font-size: 1.1rem; flex-shrink: 0; }
.am-nav__label { flex: 1; }
.am-nav__lock  { font-size: 0.75rem; opacity: 0.6; }
@keyframes am-shake {
  0%,100% { transform: translateX(0); }
  20%,60%  { transform: translateX(-4px); }
  40%,80%  { transform: translateX(4px); }
}
.am-nav__item--shake .am-nav__btn { animation: am-shake 0.4s ease; }
`;

/**
 * Inyecta el CSS del nav en el <head> si no está ya presente.
 */
function inyectarCSS() {
  if (typeof document === "undefined") return;
  if (document.getElementById("am-nav-css")) return;
  const style = document.createElement("style");
  style.id = "am-nav-css";
  style.textContent = NAV_CSS;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inicializa el módulo nav.
 * - Recupera ruta activa de LS
 * - Inicia escucha de storage
 * - Inyecta CSS (opcional)
 *
 * @param {object}  [opciones]
 * @param {boolean} [opciones.css=true]         - inyectar CSS embebido
 * @param {boolean} [opciones.escuchaStorage=true]
 */
function inicializar(opciones = {}) {
  const {
    css           = true,
    escuchaStorage = true,
  } = opciones;

  // Restaurar ruta activa desde LS
  const rutaLS = _lsGet(LS_RUTA_ACTIVA);
  if (rutaLS) {
    _rutaActiva = rutaLS;
  }

  if (css)            inyectarCSS();
  if (escuchaStorage) iniciarEscuchaStorage();
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports duales
// ─────────────────────────────────────────────────────────────────────────────

const _public = {
  inicializar,
  navegarA,
  verificarGuard,
  getRutaActiva,
  renderizarNav,
  refrescarNav,
  onNavegacion,
  inyectarCSS,
  RUTAS,
  // internals expuestos para testing
  _construirHTML,
  _actualizarDOM,
  _notificarListeners,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = _public;
}

if (typeof window !== "undefined") {
  window.Nav = _public;
}
