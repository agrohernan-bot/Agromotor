// ════════════════════════════════════════════════════════
// AGROMOTOR — notificaciones.js  v1.0
// Notificaciones push del navegador para alertas críticas
//
// Monitorea cambios en las alertas activas y el estado hídrico
// para emitir notificaciones automáticas sin necesidad de
// que el ingeniero tenga la pestaña visible.
//
// Requiere permiso explícito del usuario (estándar del navegador).
// El estado del permiso se guarda en localStorage para no pedirlo
// repetidamente.
//
// Fuentes monitoreadas:
//   · am_alertas_activas: alertas críticas y de advertencia
//   · am_hidrico_dias_estres: estrés hídrico acumulado
//   · am_ndvi_alerta: anomalía NDVI detectada
// ════════════════════════════════════════════════════════

(function () {
'use strict';

var LS_PERM        = 'am_notif_permiso';       // 'granted' | 'denied' | 'default'
var LS_LAST_NOTIF  = 'am_notif_ultima';        // timestamp de última notificación enviada
var LS_SEEN_IDS    = 'am_notif_vistas';        // JSON array de IDs de alertas ya notificadas
var MIN_INTERVALO  = 4 * 60 * 60 * 1000;      // no repetir la misma alerta en < 4h
var CHECK_MS       = 60 * 1000;               // chequear cada 60 segundos

var ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiMzQTdBNEEiLz48dGV4dCB4PSIxNiIgeT0iNDQiIGZvbnQtc2l6ZT0iMzIiPvCfjKE8L3RleHQ+PC9zdmc+';

// ─────────────────────────────────────────────────────────────────────────────
// PERMISO
// ─────────────────────────────────────────────────────────────────────────────

function permisoConcedido() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

function solicitarPermiso(callback) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') { if (callback) callback(true); return; }
  if (Notification.permission === 'denied')  { if (callback) callback(false); return; }
  Notification.requestPermission(function(result) {
    try { localStorage.setItem(LS_PERM, result); } catch(_) {}
    if (callback) callback(result === 'granted');
  });
}

function _ls(k) { try { return localStorage.getItem(k) || ''; } catch(_) { return ''; } }
function _lsJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(_) { return null; } }
function _lsSet(k, v) { try { localStorage.setItem(k, v); } catch(_) {} }

// ─────────────────────────────────────────────────────────────────────────────
// EMISIÓN DE NOTIFICACIONES
// ─────────────────────────────────────────────────────────────────────────────

function notifAlreadySent(id) {
  var vistas = _lsJSON(LS_SEEN_IDS) || [];
  return vistas.indexOf(id) !== -1;
}

function marcarVista(id) {
  var vistas = _lsJSON(LS_SEEN_IDS) || [];
  if (vistas.indexOf(id) === -1) vistas.push(id);
  if (vistas.length > 100) vistas = vistas.slice(-80);
  _lsSet(LS_SEEN_IDS, JSON.stringify(vistas));
}

function enviar(titulo, cuerpo, tag) {
  if (!permisoConcedido()) return;
  try {
    var n = new Notification(titulo, {
      body:    cuerpo,
      icon:    ICON,
      tag:     tag || 'agromotor-alerta',
      silent:  false,
    });
    n.onclick = function() {
      try { window.focus(); } catch(_) {}
      n.close();
    };
    _lsSet(LS_LAST_NOTIF, Date.now().toString());
  } catch(e) {
    console.warn('[AM Notif] Error enviando notificación:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHEQUEOS
// ─────────────────────────────────────────────────────────────────────────────

function chequearAlertas() {
  var alertas = _lsJSON('am_alertas_activas');
  if (!Array.isArray(alertas)) return;

  alertas.forEach(function(a) {
    var sv     = a.severidad || 'info';
    var msg    = a.mensaje || a.msg || '';
    if (!msg) return;

    // Solo notificar críticas y advertencias
    if (sv !== 'critica' && sv !== 'advertencia') return;

    // Crear un ID estable para esta alerta (tipo + primeras palabras del mensaje)
    var id = sv + ':' + msg.slice(0, 40).replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (notifAlreadySent(id)) return;

    var emoji = sv === 'critica' ? '🚨' : '⚠️';
    var lote = _ls('am_lote_nombre') || 'Lote activo';
    enviar(
      emoji + ' AGROMOTOR · ' + lote,
      msg.slice(0, 120),
      'am-alerta-' + id.slice(0, 20)
    );
    marcarVista(id);
  });
}

function chequearEstresHidrico() {
  var dias = parseInt(_ls('am_hidrico_dias_estres')) || 0;
  if (dias < 7) return;

  var id = 'estres-hidrico-' + Math.floor(dias / 5);  // Nuevo ID cada 5 días
  if (notifAlreadySent(id)) return;

  var cultivo = _ls('am_siembra_cultivo') || 'cultivo';
  var lote    = _ls('am_lote_nombre') || 'Lote activo';
  var awcPct  = parseInt(_ls('am_hidrico_agua_actual_mm') / Math.max(1, parseFloat(_ls('am_hidrico_cap_max_mm'))) * 100) || 0;

  enviar(
    '💧 AGROMOTOR · Estrés hídrico · ' + lote,
    cultivo + ': ' + dias + ' días en estrés hídrico. Agua en perfil: ' + awcPct + '%. Evaluar riego o impacto en rendimiento.',
    'am-estres-' + id
  );
  marcarVista(id);
}

function chequearNDVI() {
  var ndviAlerta = _lsJSON('am_ndvi_alerta');
  if (!ndviAlerta || !ndviAlerta.anomalia) return;

  var ts  = ndviAlerta.ts || 0;
  var age = Date.now() - ts;
  if (age > 24 * 60 * 60 * 1000) return; // alerta de más de 24h = ignorar

  var id = 'ndvi-anomalia-' + Math.floor(ts / (4 * 60 * 60 * 1000)); // una por período de 4h
  if (notifAlreadySent(id)) return;

  var lote   = _ls('am_lote_nombre') || 'Lote activo';
  var ndviV  = ndviAlerta.ndviActual || 0;
  var mu     = ndviAlerta.mu || 0;

  enviar(
    '🛰️ AGROMOTOR · Anomalía NDVI · ' + lote,
    'NDVI ' + ndviV.toFixed(2) + ' por debajo de la media histórica (' + mu.toFixed(2) + '). Hacer scouting del lote.',
    'am-ndvi-' + id
  );
  marcarVista(id);
}

function correrChequeos() {
  chequearAlertas();
  chequearEstresHidrico();
  chequearNDVI();
}

// ─────────────────────────────────────────────────────────────────────────────
// UI: BOTÓN DE PERMISOS
// ─────────────────────────────────────────────────────────────────────────────

function renderBtnNotif() {
  var el = document.getElementById('am-btn-notif');
  if (!el) return;

  if (typeof Notification === 'undefined') { el.style.display = 'none'; return; }

  var perm = Notification.permission;
  if (perm === 'granted') {
    el.innerHTML = '🔔 Notificaciones activas';
    el.style.background = 'rgba(42,122,74,.15)';
    el.style.color = '#2A7A4A';
    el.disabled = true;
  } else if (perm === 'denied') {
    el.innerHTML = '🔕 Notificaciones bloqueadas';
    el.style.background = 'rgba(212,82,42,.08)';
    el.style.color = '#D4522A';
    el.disabled = true;
  } else {
    el.innerHTML = '🔔 Activar alertas push';
    el.style.background = 'rgba(42,90,140,.12)';
    el.style.color = '#2A5A8C';
    el.disabled = false;
  }
}

window.amActivarNotificaciones = function() {
  solicitarPermiso(function(ok) {
    renderBtnNotif();
    if (ok) {
      enviar('✅ AGROMOTOR · Notificaciones activas', 'Recibirás alertas críticas de tus lotes aunque tengas la pestaña en segundo plano.', 'am-welcome');
      setTimeout(correrChequeos, 1000);
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  renderBtnNotif();

  // Si ya tiene permiso concedido, arrancar monitoreo directamente
  if (permisoConcedido()) {
    setTimeout(correrChequeos, 2000);
    setInterval(correrChequeos, CHECK_MS);
  }

  // Monitorear cambios de localStorage desde otras pestañas
  window.addEventListener('storage', function(e) {
    var watched = ['am_alertas_activas', 'am_hidrico_dias_estres', 'am_ndvi_alerta'];
    if (watched.indexOf(e.key) !== -1 && permisoConcedido()) {
      setTimeout(correrChequeos, 500);
    }
  });

  // También monitorear cuando las alertas se evalúan en la misma pestaña
  document.addEventListener('am:alertas-actualizadas', function() {
    if (permisoConcedido()) setTimeout(correrChequeos, 500);
  });
});

window.amNotifRenderBtn = renderBtnNotif;
window.amNotifChequear  = correrChequeos;

})(); // fin notificaciones.js
