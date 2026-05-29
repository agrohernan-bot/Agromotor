// ════════════════════════════════════════════════════════
// AGROMOTOR — dashboard-ux.js
// · Estados de tarjetas del Dashboard (✅/⚠️/⏳)
// · Banner offline / online
// · Prompt de instalación PWA
// ════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── ESTADOS DE TARJETAS ─────────────────────────────────
  // Reglas: cada módulo decide su estado según datos del lote.
  function _val(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }
  function _hasCoord() {
    var c = _val('s-coord');
    return /-?\d+\.?\d*\s*,\s*-?\d+\.?\d*/.test(c);
  }
  function _hasCultivo() { return !!_val('s-cultivo'); }
  function _hasFecha()   { return !!_val('s-fecha'); }
  function _hasSueloAPI() {
    return window._sgDatos && Object.keys(window._sgDatos).length > 0;
  }
  function _hasNasaAPI() {
    var el = document.getElementById('np-rad');
    return el && el.textContent && el.textContent !== '—';
  }

  var REGLAS = {
    'decision':         function() { return _hasCoord() ? 'ok' : 'warn'; },
    'cultivares':       function() { return _hasCultivo() ? 'ok' : 'warn'; },
    'siembra':          function() { return _hasCoord() && _hasCultivo() ? 'ok' : 'warn'; },
    'suelo':            function() { return _hasSueloAPI() ? 'ok' : (_hasCoord() ? 'warn' : 'empty'); },
    'hidrico':          function() { return _hasNasaAPI() && _hasCultivo() ? 'ok' : 'warn'; },
    'nutricion':        function() { return _hasCultivo() ? 'ok' : 'warn'; },
    'economia':         function() { return _hasCultivo() ? 'ok' : 'warn'; },
    'cosecha':          function() { return _hasCultivo() ? 'ok' : 'warn'; },
    'maquinaria':       function() { return 'ok'; }, // siempre disponible
    'plagas':           function() { return _hasCultivo() && _hasFecha() ? 'ok' : 'warn'; },
    'alerta-sanitaria': function() { return _hasCoord() && _hasCultivo() ? 'ok' : 'warn'; },
    'pulverizacion':    function() { return _hasCoord() ? 'ok' : 'warn'; },
    'siembra-variable': function() { return _hasCoord() ? 'ok' : 'empty'; },
    'mapa':             function() { return _hasCoord() ? 'ok' : 'warn'; },
    'asistente':        function() { return 'ok'; },
  };

  var ICON = { ok: '✅', warn: '⚠️', empty: '⏳' };
  var TITLE = {
    ok:    'Datos suficientes para usar este módulo',
    warn:  'Faltan datos en el Dashboard (coordenadas, cultivo o fecha)',
    empty: 'Sin datos cargados todavía'
  };

  function dashRefreshCards() {
    document.querySelectorAll('.mod-card').forEach(function(card) {
      var oc = card.getAttribute('onclick') || '';
      var m = oc.match(/switchMod\('([^']+)'\)/);
      if (!m) return;
      var mod = m[1];
      var regla = REGLAS[mod];
      if (!regla) return;
      var estado = regla();
      var slot = card.querySelector('.mc-status');
      if (!slot) return;
      slot.setAttribute('data-status', estado);
      slot.textContent = ICON[estado] || '';
      slot.title = TITLE[estado] || '';
    });
  }
  window.dashRefreshCards = dashRefreshCards;

  // Refrescar cuando cambian inputs clave del Dashboard
  document.addEventListener('DOMContentLoaded', function() {
    ['s-coord','s-cultivo','s-fecha','s-suelo'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', dashRefreshCards);
    });
    document.addEventListener('click', function(e) {
      var card = e.target.closest && e.target.closest('.mod-card');
      if (!card) return;
      var oc = card.getAttribute('onclick') || '';
      var m = oc.match(/switchMod\('([^']+)'\)/);
      if (!m || typeof window.switchMod !== 'function') return;
      e.preventDefault();
      e.stopPropagation();
      window.switchMod(m[1]);
    }, true);
    setTimeout(dashRefreshCards, 600);
  });

  // Hook adicional: al volver al Dashboard, refrescar
  var _origActivar = window._activarModulo;
  if (typeof _origActivar !== 'function') {
    // Esperar a que nav.js termine
  }
  // Observar cambios en _sgDatos (suelo) cada vez que se navega
  setInterval(function() {
    if (document.getElementById('mod-dashboard') &&
        document.getElementById('mod-dashboard').classList.contains('active')) {
      dashRefreshCards();
    }
  }, 3000);


  // ── BANNER OFFLINE / ONLINE ─────────────────────────────
  function ensureBanner() {
    var b = document.getElementById('am-net-banner');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'am-net-banner';
    b.className = 'am-net-banner hidden';
    document.body.appendChild(b);
    return b;
  }
  function setNetBanner(online) {
    var b = ensureBanner();
    if (online) {
      b.textContent = '✅ Conexión restablecida';
      b.classList.remove('offline');
      b.classList.add('online');
      b.classList.remove('hidden');
      setTimeout(function() { b.classList.add('hidden'); }, 2500);
    } else {
      b.textContent = '📡 Sin conexión — los datos en tiempo real no están disponibles. Podés seguir trabajando con los datos cargados.';
      b.classList.remove('online');
      b.classList.add('offline');
      b.classList.remove('hidden');
    }
  }
  window.addEventListener('online',  function() { setNetBanner(true);  });
  window.addEventListener('offline', function() { setNetBanner(false); });
  document.addEventListener('DOMContentLoaded', function() {
    if (!navigator.onLine) setNetBanner(false);
  });


  // ── PROMPT DE INSTALACIÓN PWA ──────────────────────────
  var _deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    _deferredPrompt = e;
    var btn = document.getElementById('am-btn-pwa');
    if (btn) btn.classList.remove('hidden');
  });
  window.amInstalarPWA = function() {
    if (!_deferredPrompt) {
      alert('La app ya está instalada o tu navegador no soporta instalación.');
      return;
    }
    _deferredPrompt.prompt();
    _deferredPrompt.userChoice.then(function(choice) {
      _deferredPrompt = null;
      var btn = document.getElementById('am-btn-pwa');
      if (btn) btn.classList.add('hidden');
    });
  };
  window.addEventListener('appinstalled', function() {
    var btn = document.getElementById('am-btn-pwa');
    if (btn) btn.classList.add('hidden');
    _deferredPrompt = null;
  });

})();
