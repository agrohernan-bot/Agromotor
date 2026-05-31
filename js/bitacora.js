// ════════════════════════════════════════════════════════
// AGROMOTOR — bitacora.js  v1.0
// Bitácora de campo automática
//
// El ingeniero elige el tipo de actividad y escribe una nota opcional.
// Todo el contexto (fecha, lote, cultivo, etapa, clima, alertas) se
// captura automáticamente desde el estado actual del sistema.
//
// Storage: localStorage key "am_bitacora_v2" → array de entradas.
// Max 200 entradas (circular buffer).
// ════════════════════════════════════════════════════════

(function () {
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

var LS_KEY     = 'am_bitacora_v2';
var MAX_ENTRADAS = 200;

var TIPOS = [
  { id: 'visita',         emoji: '👁️',  label: 'Visita al lote'           },
  { id: 'fitosanitario',  emoji: '💊',  label: 'Aplicación fitosanitaria'  },
  { id: 'fertilizacion',  emoji: '🧪',  label: 'Fertilización'             },
  { id: 'siembra_acto',   emoji: '🌱',  label: 'Acto de siembra'           },
  { id: 'cosecha_acto',   emoji: '🌾',  label: 'Acto de cosecha'           },
  { id: 'suelo_analisis', emoji: '🔬',  label: 'Análisis de suelo'         },
  { id: 'riego',          emoji: '💦',  label: 'Riego'                     },
  { id: 'incidencia',     emoji: '🚨',  label: 'Incidencia (plaga/enf.)'   },
  { id: 'foto',           emoji: '📸',  label: 'Registro fotográfico'      },
  { id: 'otro',           emoji: '📝',  label: 'Otro'                      },
];

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────

function leerEntradas() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(_) { return []; }
}

function guardarEntradas(lista) {
  try {
    // Mantener solo las últimas MAX_ENTRADAS
    var guarda = lista.length > MAX_ENTRADAS ? lista.slice(lista.length - MAX_ENTRADAS) : lista;
    localStorage.setItem(LS_KEY, JSON.stringify(guarda));
  } catch(_) {}
}

function agregarEntrada(entrada) {
  var lista = leerEntradas();
  lista.push(entrada);
  guardarEntradas(lista);
}

function eliminarEntrada(id) {
  var lista = leerEntradas().filter(function(e) { return e.id !== id; });
  guardarEntradas(lista);
  renderLista();
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURA DE CONTEXTO AUTOMÁTICO
// ─────────────────────────────────────────────────────────────────────────────

function ls(k) {
  try { return localStorage.getItem(k) || ''; } catch(_) { return ''; }
}

function capturarContexto() {
  var ahora = new Date();
  var loteActivo = (typeof window.AM_LOTE_ACTIVO !== 'undefined') ? window.AM_LOTE_ACTIVO : '';
  var loteNombre = '';
  if (typeof window.AM_LOTES !== 'undefined') {
    var lObj = window.AM_LOTES.find(function(l) { return l.id === loteActivo; });
    if (lObj) loteNombre = lObj.nombre;
  }

  // Temperatura actual (sv-t6 primero, fallback i-temp)
  var elTemp = document.getElementById('sv-t6') || document.getElementById('i-temp');
  var tempStr = elTemp ? elTemp.textContent.trim() : '';

  // ET0 actual
  var elEt0 = document.getElementById('sv-et0') || document.getElementById('i-et0');
  var et0Str = elEt0 ? elEt0.textContent.trim() : '';

  // Viento
  var elViento = document.getElementById('sv-viento') || document.getElementById('i-viento');
  var vientoStr = elViento ? elViento.textContent.trim() : '';

  // Alertas
  var alertCount = 0;
  try { alertCount = JSON.parse(ls('am_alertas_activas') || '[]').length; } catch(_) {}

  return {
    id:           ahora.getTime().toString(),
    fecha:        ahora.toISOString().slice(0, 10),
    hora:         ahora.toTimeString().slice(0, 5),
    loteId:       loteActivo,
    loteNombre:   loteNombre || ls('am_lote_nombre') || 'Lote Principal',
    cultivo:      ls('am_siembra_cultivo') || '',
    etapa:        ls('am_fen_etapa_hoy') || '',
    diasSiembra:  diasDesde(ls('am_siembra_fecha')),
    coord:        ls('am_siembra_lat') && ls('am_siembra_lon')
                    ? ls('am_siembra_lat') + ', ' + ls('am_siembra_lon')
                    : (document.getElementById('s-coord') ? (document.getElementById('s-coord').value || '') : ''),
    tempC:        tempStr,
    et0:          et0Str,
    viento:       vientoStr,
    ensoFase:     ls('am_enso_fase') || '',
    hidroPct:     calcHidroPct(),
    alertas:      alertCount,
  };
}

function diasDesde(fechaISO) {
  if (!fechaISO) return null;
  try {
    var d = new Date(fechaISO + 'T12:00:00');
    var hoy = new Date(); hoy.setHours(12,0,0,0);
    return Math.round((hoy - d) / 86400000);
  } catch(_) { return null; }
}

function calcHidroPct() {
  var agua = parseFloat(ls('am_hidrico_agua_actual_mm')) || 0;
  var cap  = parseFloat(ls('am_hidrico_cap_max_mm'))     || 0;
  if (cap <= 0) return null;
  return Math.min(100, Math.round(agua / cap * 100));
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

function renderModulo() {
  var el = document.getElementById('mod-bitacora');
  if (!el) return;

  el.innerHTML = '<div class="bt-wrap">' + _htmlHeader() + _htmlForm() + _htmlLista() + '</div>';
  _initFormListeners();
}

function _htmlHeader() {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.6rem;margin-bottom:1rem">
      <div>
        <div class="module-title" style="margin-bottom:.15rem">📓 Bitácora de Campo</div>
        <div class="module-subtitle">Registro automático de actividades · contexto capturado por el sistema</div>
      </div>
      <span id="mod-lote-badge-bitacora" class="mod-lote-badge" style="display:none"></span>
    </div>
  `;
}

function _htmlForm() {
  var ctx = capturarContexto();

  // Contexto auto-capturado (display strip)
  var ctxItems = [];
  if (ctx.loteNombre) ctxItems.push(`<span>📂 <b>${_esc(ctx.loteNombre)}</b></span>`);
  if (ctx.cultivo)    ctxItems.push(`<span>🌾 <b>${_esc(ctx.cultivo)}</b></span>`);
  if (ctx.etapa)      ctxItems.push(`<span>🌱 ${_esc(ctx.etapa)}</span>`);
  if (ctx.diasSiembra !== null) ctxItems.push(`<span>📅 Día ${ctx.diasSiembra} desde siembra</span>`);
  if (ctx.tempC && ctx.tempC !== '—') ctxItems.push(`<span>🌡️ ${_esc(ctx.tempC)}</span>`);
  if (ctx.et0  && ctx.et0  !== '—') ctxItems.push(`<span>🌿 ET₀ ${_esc(ctx.et0)}</span>`);
  if (ctx.hidroPct !== null) {
    var hColor = ctx.hidroPct >= 60 ? '#2A7A4A' : ctx.hidroPct >= 35 ? '#C8A255' : '#D4522A';
    ctxItems.push(`<span style="color:${hColor}">💧 ${ctx.hidroPct}% perfil</span>`);
  }
  if (ctx.ensoFase) ctxItems.push(`<span>🌊 ${_esc(ctx.ensoFase)}</span>`);
  if (ctx.alertas > 0) ctxItems.push(`<span style="color:#D4522A">🚨 ${ctx.alertas} alertas</span>`);

  var tiposOpts = TIPOS.map(function(t) {
    return `<option value="${t.id}">${t.emoji} ${t.label}</option>`;
  }).join('');

  return `
    <div class="card bt-form-card" style="border:1.5px solid rgba(42,122,74,.25);background:#f4fbf6">
      <div class="card-title" style="color:#1b5e35;margin-bottom:.8rem">
        ✍️ Nueva Entrada
        <span style="font-size:.68rem;font-weight:400;color:#6b7280;margin-left:.5rem">${ctx.fecha} · ${ctx.hora}</span>
      </div>

      <!-- Contexto auto-capturado -->
      <div style="display:flex;flex-wrap:wrap;gap:.35rem .75rem;font-size:.72rem;color:#374151;background:rgba(42,122,74,.07);border-radius:8px;padding:.55rem .75rem;margin-bottom:.9rem;border:1px solid rgba(42,122,74,.15)">
        <span style="font-size:.62rem;font-weight:700;color:#6b7280;width:100%;margin-bottom:.15rem">📡 AUTO-CAPTURADO</span>
        ${ctxItems.length ? ctxItems.join('') : '<span style="color:#9ca3af">Sin datos de lote activo</span>'}
      </div>

      <!-- Tipo de actividad -->
      <div style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:.75rem">
        <label style="font-size:.72rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.04em">Tipo de actividad</label>
        <select id="bt-tipo" style="border:1.5px solid #d1d5db;border-radius:8px;padding:.55rem .75rem;font-size:.85rem;color:#1f2937;background:#fff;font-family:inherit;cursor:pointer">
          ${tiposOpts}
        </select>
      </div>

      <!-- Nota libre -->
      <div style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:.9rem">
        <label style="font-size:.72rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.04em">
          Notas <span style="font-weight:400;text-transform:none;font-size:.68rem;color:#9ca3af">(opcional · máx 300 caracteres)</span>
        </label>
        <textarea id="bt-nota" maxlength="300" rows="3"
          placeholder="Observaciones adicionales, productos usados, dosis, condiciones del lote…"
          style="border:1.5px solid #d1d5db;border-radius:8px;padding:.55rem .75rem;font-size:.84rem;color:#1f2937;background:#fff;font-family:inherit;resize:vertical;line-height:1.45"></textarea>
        <div id="bt-nota-count" style="font-size:.65rem;color:#9ca3af;text-align:right">0 / 300</div>
      </div>

      <button id="bt-guardar" onclick="window.btGuardar()"
        style="background:#3A7A4A;color:#fff;border:none;border-radius:10px;padding:.65rem 1.4rem;font-size:.88rem;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:.02em">
        💾 Guardar entrada
      </button>
    </div>
  `;
}

function _htmlLista() {
  var entradas = leerEntradas().slice().reverse(); // newest first
  if (entradas.length === 0) {
    return `
      <div style="text-align:center;padding:3rem 1rem;color:rgba(28,18,8,.3)">
        <div style="font-size:3rem;margin-bottom:.75rem">📓</div>
        <div style="font-size:.9rem">Sin entradas todavía.</div>
        <div style="font-size:.8rem;margin-top:.3rem">Registrá tu primera actividad con el formulario de arriba.</div>
      </div>
    `;
  }

  // Agrupar por fecha
  var porFecha = {};
  entradas.forEach(function(e) {
    if (!porFecha[e.fecha]) porFecha[e.fecha] = [];
    porFecha[e.fecha].push(e);
  });

  var html = '<div class="bt-lista" style="display:flex;flex-direction:column;gap:.5rem;margin-top:1rem">';

  Object.keys(porFecha).forEach(function(fecha) {
    var label = _labelFecha(fecha);
    html += `<div class="bt-fecha-sep" style="font-size:.65rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;padding:.3rem 0;border-bottom:1px solid #e5e7eb;margin-bottom:.25rem">${label}</div>`;

    porFecha[fecha].forEach(function(e) {
      html += _htmlEntrada(e);
    });
  });

  html += '</div>';
  return html;
}

function _htmlEntrada(e) {
  var tipo = TIPOS.find(function(t) { return t.id === e.tipo; }) || TIPOS[TIPOS.length - 1];

  var metaItems = [];
  if (e.cultivo)    metaItems.push(`🌾 ${_esc(e.cultivo)}`);
  if (e.etapa)      metaItems.push(`🌱 ${_esc(e.etapa)}`);
  if (e.diasSiembra !== null && e.diasSiembra !== undefined) metaItems.push(`Día ${e.diasSiembra}`);
  if (e.tempC && e.tempC !== '—') metaItems.push(`🌡️ ${_esc(e.tempC)}`);
  if (e.et0  && e.et0  !== '—')  metaItems.push(`ET₀ ${_esc(e.et0)}`);
  if (e.hidroPct !== null && e.hidroPct !== undefined) {
    var hC = e.hidroPct >= 60 ? '#2A7A4A' : e.hidroPct >= 35 ? '#C8A255' : '#D4522A';
    metaItems.push(`<span style="color:${hC}">💧${e.hidroPct}%</span>`);
  }
  if (e.ensoFase) metaItems.push(`🌊 ${_esc(e.ensoFase)}`);
  if (e.alertas > 0) metaItems.push(`<span style="color:#D4522A">🚨 ${e.alertas}</span>`);

  return `
    <div class="bt-entry" style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:.7rem .9rem;display:flex;flex-direction:column;gap:.35rem">
      <div style="display:flex;align-items:center;gap:.5rem">
        <span style="font-size:1.2rem">${tipo.emoji}</span>
        <div style="flex:1">
          <div style="font-weight:700;font-size:.84rem;color:#1f2937">${tipo.label}</div>
          <div style="font-size:.7rem;color:#6b7280">
            📂 ${_esc(e.loteNombre || '—')} · ${e.hora}
          </div>
        </div>
        <button onclick="window.btEliminar('${e.id}')"
          style="border:none;background:none;color:#d1d5db;cursor:pointer;font-size:.8rem;padding:.2rem .4rem;border-radius:4px"
          title="Eliminar entrada">✕</button>
      </div>
      ${metaItems.length ? `<div style="display:flex;flex-wrap:wrap;gap:.25rem .6rem;font-size:.67rem;color:#6b7280">${metaItems.join(' · ')}</div>` : ''}
      ${e.nota ? `<div style="font-size:.8rem;color:#374151;background:#f9fafb;border-radius:6px;padding:.4rem .55rem;border-left:3px solid #3A7A4A">${_esc(e.nota)}</div>` : ''}
    </div>
  `;
}

function _labelFecha(fechaISO) {
  var hoy = new Date().toISOString().slice(0, 10);
  var ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (fechaISO === hoy)  return 'Hoy · ' + fechaISO;
  if (fechaISO === ayer) return 'Ayer · ' + fechaISO;
  return fechaISO;
}

function renderLista() {
  var el = document.getElementById('mod-bitacora');
  if (!el) return;
  var listaDiv = el.querySelector('.bt-lista');
  var parent   = listaDiv ? listaDiv.parentNode : null;
  if (!parent) { renderModulo(); return; }
  // Replace only the list section
  var tmp = document.createElement('div');
  tmp.innerHTML = _htmlLista();
  var newList = tmp.firstElementChild;
  if (listaDiv && newList) {
    parent.replaceChild(newList, listaDiv);
  } else if (!listaDiv && newList) {
    parent.appendChild(newList);
  } else {
    renderModulo();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCIONES
// ─────────────────────────────────────────────────────────────────────────────

function _initFormListeners() {
  var ta = document.getElementById('bt-nota');
  var cnt = document.getElementById('bt-nota-count');
  if (ta && cnt) {
    ta.addEventListener('input', function() {
      cnt.textContent = ta.value.length + ' / 300';
    });
  }
}

window.btGuardar = function() {
  var tipoEl = document.getElementById('bt-tipo');
  var notaEl = document.getElementById('bt-nota');
  if (!tipoEl) return;

  var tipo = tipoEl.value;
  var nota = notaEl ? notaEl.value.trim() : '';
  var ctx  = capturarContexto();

  var entrada = Object.assign({}, ctx, { tipo: tipo, nota: nota });
  agregarEntrada(entrada);

  // Feedback visual rápido
  var btn = document.getElementById('bt-guardar');
  if (btn) {
    var orig = btn.innerHTML;
    btn.innerHTML = '✅ Guardado';
    btn.style.background = '#2A7A4A';
    btn.disabled = true;
    setTimeout(function() {
      btn.innerHTML = orig;
      btn.style.background = '#3A7A4A';
      btn.disabled = false;
      if (notaEl) notaEl.value = '';
      if (document.getElementById('bt-nota-count')) document.getElementById('bt-nota-count').textContent = '0 / 300';
    }, 1200);
  }

  renderLista();
};

window.btEliminar = function(id) {
  eliminarEntrada(id);
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT / INIT
// ─────────────────────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

window.bitacoraRender = renderModulo;

// Auto-render cuando el módulo ya está activo (carga lazy)
document.addEventListener('DOMContentLoaded', function() {
  var el = document.getElementById('mod-bitacora');
  if (el && el.classList.contains('active')) renderModulo();
});

// Escucha activación del módulo
window.addEventListener('am:modulo-activado', function(e) {
  if (e.detail && e.detail.mod === 'bitacora') {
    renderModulo();
    if (typeof window.amActualizarBadgesLote === 'function') window.amActualizarBadgesLote();
  }
});

})(); // fin IIFE bitacora.js
