// ════════════════════════════════════════════════════════
// AGROMOTOR — nav.js
// switchMod con lazy loading · DOMContentLoaded init
// renderSueloModulo · Control de navegación principal
// ════════════════════════════════════════════════════════

// ── LAZY LOADER ──────────────────────────────────────────
var AM_MODULOS_CARGADOS = {};

function amCargarModulo(archivo, callback) {
  if (AM_MODULOS_CARGADOS[archivo]) {
    if (callback) callback();
    return;
  }
  var script = document.createElement('script');
  script.src = 'js/' + archivo;
  script.onload = function() {
    AM_MODULOS_CARGADOS[archivo] = true;
    if (callback) callback();
  };
  script.onerror = function() {
    console.error('Error cargando modulo:', archivo);
  };
  document.head.appendChild(script);
}

// ── SWITCH DE MÓDULOS ─────────────────────────────────────
function switchMod(mod) {

  if (typeof amTieneAcceso === 'function' && !amTieneAcceso(mod)) {
    if (typeof amMostrarModalUpgrade === 'function') amMostrarModalUpgrade(mod);
    return;
  }

  var modLazy = {
    'hidrico':       ['hidrico.js'],
    'cultivares':    ['cultivares.js', 'cultivares-extra.js'],
    'mapa':          ['mapa.js'],
    'pulverizacion': ['pulverizacion.js'],
    'decision':      ['decision.js'],
    'fertoptima':    ['fertilizacion-optima.js'],
    'balancenut':    ['balance-nutricional.js'],
    'seguimiento':   ['seguimiento.js'],
    'cosecha':       ['cosecha.js'],
    'plagas':           ['plagas.js'],
    'siembra-variable':  ['siembra-variable.js'],
    'alerta-sanitaria':  ['alerta-sanitaria.js'],
  };

  var archivos = modLazy[mod];
  if (archivos) {
    var pendientes = archivos.filter(function(a) { return !AM_MODULOS_CARGADOS[a]; });
    if (pendientes.length > 0) {
      document.querySelectorAll('.module-panel').forEach(function(p) { p.classList.remove('active'); });
      var panel = document.getElementById('mod-' + mod);
      if (panel && !panel.children.length) {
        panel.classList.add('active');
        panel.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem;gap:1rem;color:rgba(237,224,196,.4)"><div style="font-size:3rem">⟳</div><div style="font-size:.9rem">Cargando...</div></div>';
      } else if (panel) {
        panel.classList.add('active');
      }
      var idxMap = {dashboard:0,siembra:1,suelo:2,hidrico:3,cultivares:4,economia:5,fertilizacion:6,fertoptima:7,balancenut:8,maquinaria:9,cosecha:10,decision:11,pulverizacion:12,mapa:13,plagas:14,'alerta-sanitaria':15,'siembra-variable':16,asistente:17};
      document.querySelectorAll('.nav-tab:not(.locked)').forEach(function(t) { t.classList.remove('active'); });
      var tabs = document.querySelectorAll('.nav-tab:not(.locked)');
      if (tabs[idxMap[mod]]) tabs[idxMap[mod]].classList.add('active');

      var i = 0;
      function cargarSiguiente() {
        if (i >= archivos.length) { _activarModulo(mod); return; }
        amCargarModulo(archivos[i], function() { i++; cargarSiguiente(); });
      }
      cargarSiguiente();
      return;
    }
  }

  _activarModulo(mod);
}

function _activarModulo(mod) {
  document.querySelectorAll('.nav-tab:not(.locked)').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.module-panel').forEach(function(p) { p.classList.remove('active'); });

  var idxMap = {dashboard:0,siembra:1,suelo:2,economia:3,fertilizacion:4,maquinaria:5,hidrico:6,cultivares:7,asistente:8,mapa:9,pulverizacion:10,decision:11,fertoptima:12,balancenut:13,cosecha:14,plagas:15,'siembra-variable':16,'alerta-sanitaria':17};
  var tabs = document.querySelectorAll('.nav-tab:not(.locked)');
  if (tabs[idxMap[mod]]) tabs[idxMap[mod]].classList.add('active');
  var panel = document.getElementById('mod-' + mod);
  if (panel) panel.classList.add('active');

  if (mod === 'suelo' && window._sgDatos && Object.keys(window._sgDatos).length > 0) {
    if (typeof renderSueloModulo === 'function') renderSueloModulo(window._sgDatos);
    var coord = document.getElementById('s-coord');
    var sc = document.getElementById('suelo-coord');
    if (coord && sc) sc.value = coord.value;
  }
  // ── Sincronizar cultivo/fecha del Dashboard a todos los módulos ──
  var _sc = document.getElementById('s-cultivo');
  var _sf = document.getElementById('s-fecha');
  var _syncCultivo = function(destId) { var d = document.getElementById(destId); if (_sc && d && _sc.value) d.value = _sc.value; };
  var _syncFecha   = function(destId) { var d = document.getElementById(destId); if (_sf && d && _sf.value) d.value = _sf.value; };

  if (mod === 'economia') {
    _syncCultivo('ec-cultivo');
    if (typeof ecActualizarCultivo === 'function') ecActualizarCultivo();
  }
  if (mod === 'fertilizacion') {
    _syncCultivo('f-cult');
    if (typeof updRend === 'function') updRend();
  }
  if (mod === 'balancenut') {
    _syncCultivo('bn-cultivo');
  }
  if (mod === 'hidrico') {
    _syncCultivo('bh-cultivo');
    _syncFecha('bh-fecha');
    var bhs = document.getElementById('bh-suelo');
    var ss = document.getElementById('s-suelo');
    if (bhs && ss) bhs.value = ss.value || 'Molisol';
    var h1 = parseFloat((document.getElementById('s-h1') || {}).value) || 0;
    var h2 = parseFloat((document.getElementById('s-h2') || {}).value) || 0;
    var h3 = parseFloat((document.getElementById('s-h3') || {}).value) || 0;
    if (h1 > 0 && document.getElementById('bh-agua-perfil'))
      document.getElementById('bh-agua-perfil').value = Math.max(20, Math.min(350, Math.round((h1*0.06+h2*0.18+h3*0.54)*10*2)));
    if (typeof ENSO_DATA !== 'undefined' && ENSO_DATA.fase && document.getElementById('bh-enso'))
      document.getElementById('bh-enso').value = ENSO_DATA.fase;
    if (typeof bhActualizar === 'function') bhActualizar();
  }
  if (mod === 'cultivares') {
    _syncCultivo('cv-cultivo');
    _syncFecha('cv-fecha');
    if (typeof cvActualizar === 'function') cvActualizar();
    setTimeout(function() { if (typeof dsRender === 'function') dsRender(); }, 300);
  }
  if (mod === 'asistente' && typeof iaActualizarContextoBanner === 'function') iaActualizarContextoBanner();
  if (mod === 'mapa') setTimeout(function() { if (typeof mapaFiltrar === 'function') mapaFiltrar(); }, 100);
  if (mod === 'pulverizacion') {
    setTimeout(function() { if (typeof pulvRefrescarMeteo === 'function') pulvRefrescarMeteo(); }, 200);
    setTimeout(function() {
      if (typeof pulvRenderHistorial === 'function') pulvRenderHistorial();
      if (typeof pulvRenderHRAC      === 'function') pulvRenderHRAC();
      if (typeof pulvCalcAgua        === 'function') pulvCalcAgua();
    }, 300);
  }
  if (mod === 'seguimiento' && typeof segInit === 'function') segInit();
  if (mod === 'cosecha' && typeof cosInit === 'function') cosInit();
  if (mod === 'siembra-variable'  && typeof svInit === 'function') svInit();
  if (mod === 'alerta-sanitaria'  && typeof asInit === 'function') asInit();
  if (mod === 'plagas') {
    _syncCultivo('plagas-cultivo');
    _syncFecha('plagas-siembra');
  }
}

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var hoy = new Date().toISOString().split('T')[0];
  ['s-fecha','bh-fecha','cv-fecha'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = hoy;
  });
  if (typeof loadMaq     === 'function') loadMaq();
  if (typeof updRend     === 'function') updRend();
  if (typeof ecActualizarDolar === 'function') ecActualizarDolar();
  if (typeof ecRenderDolar     === 'function') ecRenderDolar();
  if (typeof consultarENSO     === 'function') consultarENSO();
  if (typeof amCargarSesion    === 'function') amCargarSesion();
  if (typeof amActualizarUI    === 'function') amActualizarUI();
  
  setTimeout(function() { amCargarModulo('hidrico.js'); amCargarModulo('cultivares.js'); }, 2000);
  setTimeout(function() { amCargarModulo('cultivares-extra.js'); amCargarModulo('mapa.js'); amCargarModulo('pulverizacion.js'); }, 5000);
  var trafico = document.getElementById('s-trafico');
  if (trafico) {
    trafico.addEventListener('change', function() {
      var sg = window._sgDatos; if (!sg) return;
      var hum = parseFloat((document.getElementById('s-h1')||{}).value) || 22;
      var traf = parseInt(this.value) || 0;
      if (typeof calcularCompactacion === 'function') {
        var calc = calcularCompactacion(sg, hum, traf, window._diaRef);
        if (calc) {
          if (typeof setR === 'function') setR('s-compact', calc.mpaEstimado, 1);
          var cs = document.getElementById('compact-source');
          if (cs) cs.textContent = '← recalculado (tráfico actualizado)';
          if (typeof renderCompactacion === 'function') renderCompactacion(calc, sg);
        }
      }
    });
  }
  
  // Custom scroll horizontal
  var navInner = document.querySelector('.nav-inner');
  if(navInner) {
    navInner.addEventListener('wheel', function(e) {
      if(e.deltaY !== 0) { e.preventDefault(); navInner.scrollLeft += e.deltaY; }
    });
  }
});

// ── RENDER SUELO ──────────────────────────────────────────
function renderSueloModulo(d) {
  if (!d || Object.keys(d).length === 0) return;
  var mo = d.soc != null ? d.soc * 1.724 / 10 : null;
  var map = {
    'sg-ph':      d.ph   != null ? d.ph.toFixed(1)   : null,
    'sg-soc':     d.soc  != null ? d.soc.toFixed(1)  : null,
    'sg-n':       d.n    != null ? d.n.toFixed(2)     : null,
    'sg-da':      d.da   != null ? d.da.toFixed(2)   : null,
    'sg-cec':     d.cec  != null ? d.cec.toFixed(1)  : null,
    'sg-mo':      mo     != null ? mo.toFixed(1)      : null,
    'sg-textura': d.textura || null,
  };
  Object.keys(map).forEach(function(id) {
    var el = document.getElementById(id);
    if (el && map[id]) el.textContent = map[id];
  });
  var kpis = document.getElementById('suelo-kpis');
  var ph = document.getElementById('suelo-placeholder');
  if (kpis) kpis.classList.remove('hidden');
  if (ph) ph.classList.add('hidden');
  var alertas = [];
  if (d.ph != null && d.ph < 5.5)
    alertas.push('<div class="alert danger"><span class="ai">⚗️</span><div class="ac"><strong>pH muy ácido (' + d.ph.toFixed(1) + ')</strong> — Aplicar cal agrícola para elevar a pH 6.2.</div></div>');
  else if (d.ph != null && d.ph <= 7.5)
    alertas.push('<div class="alert ok"><span class="ai">⚗️</span><div class="ac"><strong>pH óptimo (' + d.ph.toFixed(1) + ')</strong> — Rango ideal para cultivos pampeanos.</div></div>');
  else if (d.ph != null)
    alertas.push('<div class="alert warn"><span class="ai">⚗️</span><div class="ac"><strong>pH alcalino (' + d.ph.toFixed(1) + ')</strong> — Monitorear P, Fe y Zn.</div></div>');
  if (mo != null && mo < 2.0)
    alertas.push('<div class="alert danger"><span class="ai">🌱</span><div class="ac"><strong>MO baja (' + mo.toFixed(1) + '%)</strong> — Priorizar cobertura y SD.</div></div>');
  else if (mo != null && mo < 3.5)
    alertas.push('<div class="alert warn"><span class="ai">🌱</span><div class="ac"><strong>MO media (' + mo.toFixed(1) + '%)</strong> — Mantener manejo de rastrojos.</div></div>');
  else if (mo != null)
    alertas.push('<div class="alert ok"><span class="ai">🌱</span><div class="ac"><strong>MO alta (' + mo.toFixed(1) + '%)</strong> — Buena estructura y reservas.</div></div>');
  if (d.da != null && d.da > 1.45)
    alertas.push('<div class="alert warn"><span class="ai">⚖️</span><div class="ac"><strong>DA alta (' + d.da.toFixed(2) + ' g/cm³)</strong> — Verificar compactación con penetrómetro.</div></div>');
  if (d.cec != null && d.cec < 10)
    alertas.push('<div class="alert info"><span class="ai">🧲</span><div class="ac"><strong>CEC baja (' + d.cec.toFixed(1) + ' cmol/kg)</strong> — Fraccionar aplicaciones de K y Ca.</div></div>');
  var alertasEl = document.getElementById('suelo-alertas');
  if (alertasEl) alertasEl.innerHTML = alertas.join('');
}
