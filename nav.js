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
    'plagas':        ['plagas.js'],
  };

  var archivos = modLazy[mod];
  if (archivos) {
    var pendientes = archivos.filter(function(a) { return !AM_MODULOS_CARGADOS[a]; });
    if (pendientes.length > 0) {
      document.querySelectorAll('.module-panel').forEach(function(p) { p.classList.remove('active'); });
      var panel = document.getElementById('mod-' + mod);
      if (panel) {
        panel.classList.add('active');
        panel.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem;gap:1rem;color:rgba(237,224,196,.4)"><div style="font-size:3rem">⟳</div><div style="font-size:.9rem">Cargando...</div></div>';
      }
      var idxMap = {siembra:0,suelo:1,economia:2,fertilizacion:3,maquinaria:4,hidrico:5,cultivares:6,asistente:7,mapa:8,pulverizacion:9,decision:10,fertoptima:11,balancenut:12,cosecha:13,seguimiento:14,plagas:15};
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

  var idxMap = {siembra:0,suelo:1,economia:2,fertilizacion:3,maquinaria:4,hidrico:5,cultivares:6,asistente:7,mapa:8,pulverizacion:9,decision:10,fertoptima:11,balancenut:12,cosecha:13,seguimiento:14,plagas:15};
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
  if (mod === 'economia' && typeof ecActualizarCultivo === 'function') ecActualizarCultivo();
  if (mod === 'hidrico') {
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
    var sc2 = document.getElementById('s-cultivo'), cv = document.getElementById('cv-cultivo');
    if (sc2 && cv) cv.value = sc2.value;
    var sf = document.getElementById('s-fecha'), cf = document.getElementById('cv-fecha');
    if (sf && cf) cf.value = sf.value;
    if (typeof cvActualizar === 'function') cvActualizar();
    setTimeout(function() { if (typeof dsRender === 'function') dsRender(); }, 300);
  }
  if (mod === 'asistente' && typeof iaActualizarContextoBanner === 'function') iaActualizarContextoBanner();
  if (mod === 'mapa') setTimeout(function() { if (typeof mapaFiltrar === 'function') mapaFiltrar(); }, 100);
  if (mod === 'pulverizacion') {
    setTimeout(function() { if (typeof pulvRefrescarMeteo === 'function') pulvRefrescarMeteo(); }, 200);
    if (typeof pulvRenderHistorial === 'function') pulvRenderHistorial();
    if (typeof pulvRenderHRAC === 'function') pulvRenderHRAC();
    if (typeof pulvCalcAgua === 'function') pulvCalcAgua();
  }
  if (mod === 'seguimiento' && typeof segInit === 'function') segInit();
  if (mod === 'cosecha' && typeof cosInit === 'function') cosInit();
  // Plagas: el usuario dispara el análisis manualmente con el botón "Analizar"
  // if (mod === 'plagas' && typeof amAnalizarPlagas === 'function') amAnalizarPlagas();
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
  setTimeout(function() { if (typeof cacheCargar === 'function') cacheCargar(); }, 800);
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
