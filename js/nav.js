// ════════════════════════════════════════════════════════
// AGROMOTOR — nav.js
// switchMod con lazy loading · DOMContentLoaded init
// renderSueloModulo · Control de navegación principal
// ════════════════════════════════════════════════════════

// ── ORDEN DE PESTAÑAS (única fuente de verdad) ───────────
// Coincide con el orden visual del nav en index.html.
var AM_TAB_ORDER = [
  'dashboard','decision','cultivares',
  'siembra','suelo','hidrico',
  'fertilizacion','fertoptima','balancenut',
  'economia','cosecha','maquinaria',
  'plagas','alerta-sanitaria','pulverizacion',
  'siembra-variable','mapa','asistente'
];
var AM_IDX_MAP = AM_TAB_ORDER.reduce(function(acc, m, i) { acc[m] = i; return acc; }, {});

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
      document.querySelectorAll('.nav-tab:not(.locked)').forEach(function(t) { t.classList.remove('active'); });
      var tabs = document.querySelectorAll('.nav-tab:not(.locked)');
      if (tabs[AM_IDX_MAP[mod]]) tabs[AM_IDX_MAP[mod]].classList.add('active');

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

  var tabs = document.querySelectorAll('.nav-tab:not(.locked)');
  if (tabs[AM_IDX_MAP[mod]]) tabs[AM_IDX_MAP[mod]].classList.add('active');
  var panel = document.getElementById('mod-' + mod);
  if (panel) panel.classList.add('active');

  // Mostrar/ocultar botón "Volver al Dashboard"
  var btnVolver = document.getElementById('btn-volver-dash');
  if (btnVolver) {
    if (mod === 'dashboard') btnVolver.classList.add('hidden');
    else btnVolver.classList.remove('hidden');
  }

  // Mostrar botón "Exportar PDF" solo en módulos con generador disponible
  var btnPDFMod = document.getElementById('btn-pdf-modulo');
  if (btnPDFMod) {
    var pdfModulos = ['decision','fertilizacion','balancenut','suelo','hidrico'];
    if (pdfModulos.indexOf(mod) >= 0) btnPDFMod.classList.remove('hidden');
    else btnPDFMod.classList.add('hidden');
  }
  // Refrescar estados de tarjetas al volver al Dashboard
  if (mod === 'dashboard' && typeof dashRefreshCards === 'function') {
    setTimeout(dashRefreshCards, 100);
  }
  // Scroll al inicio al cambiar de módulo
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e) { window.scrollTo(0,0); }

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
    if (typeof ecActualizarDolar === 'function' && !window._ecDolarCargado) {
      ecActualizarDolar(); window._ecDolarCargado = true;
    }
    if (typeof ecRenderDolar === 'function') ecRenderDolar();
    if (typeof ecActualizarCultivo === 'function') ecActualizarCultivo();
  }
  if (mod === 'fertilizacion') {
    _syncCultivo('f-cult');
    if (typeof loadMaq === 'function' && !window._fertMaqCargado) {
      loadMaq(); window._fertMaqCargado = true;
    }
    if (typeof updRend === 'function') updRend();
  }
  if (mod === 'maquinaria') {
    if (typeof loadMaq === 'function' && !window._fertMaqCargado) {
      loadMaq(); window._fertMaqCargado = true;
    }
  }
  if (mod === 'decision') {
    _syncCultivo('dec-cultivo');
    _syncFecha('dec-fecha');
  }
  if (mod === 'fertoptima') {
    _syncCultivo('fo-cultivo');
  }
  if (mod === 'cosecha') {
    _syncCultivo('cos-cultivo');
    _syncFecha('cos-fecha');
  }
  if (mod === 'siembra-variable') {
    _syncCultivo('sv-cultivo');
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
    _syncCultivo('pulv-cultivo');
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
  if (typeof amCargarSesion    === 'function') amCargarSesion();
  if (typeof amActualizarUI    === 'function') amActualizarUI();
  // ENSO se consulta una vez en background (datos compartidos por hidrico, siembra)
  setTimeout(function() {
    if (typeof consultarENSO === 'function' && !window._ensoCargado) {
      consultarENSO(); window._ensoCargado = true;
    }
  }, 1500);
  
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

  // ── COMPOSICIÓN GRANULOMÉTRICA Y TEXTURA ─────────────────
  var texEl = document.getElementById('suelo-textura-contenido');
  if (texEl && (d.clay != null || d.sand != null || d.silt != null)) {
    var clay = d.clay != null ? d.clay : (100 - (d.sand||0) - (d.silt||0));
    var sand = d.sand != null ? d.sand : 0;
    var silt = d.silt != null ? d.silt : Math.max(0, 100 - clay - sand);
    var bar = function(label, val, color) {
      var pct = Math.max(0, Math.min(100, val));
      return '<div style="margin-bottom:.55rem"><div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:.2rem"><span style="font-weight:600;color:#3D2210">' + label + '</span><span style="font-family:\'DM Mono\',monospace;font-weight:700;color:' + color + '">' + pct.toFixed(0) + '%</span></div><div style="background:#f1ebe0;height:10px;border-radius:5px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + color + ';transition:width .4s ease"></div></div></div>';
    };
    var html = '<div style="font-size:.74rem;color:#5a4a32;margin-bottom:.7rem">Análisis textural en los primeros 0–5 cm</div>';
    html += bar('🏖️ Arena', sand, '#C8A255');
    html += bar('🪨 Limo',  silt, '#8b6f47');
    html += bar('🏺 Arcilla', clay, '#a3543b');
    html += '<div style="margin-top:.9rem;padding:.6rem .85rem;background:#fbf6e9;border:1px solid rgba(200,162,85,.3);border-radius:8px;font-size:.78rem;color:#3D2210"><strong>Textura USDA:</strong> ' + (d.textura || '—') + (d.fuente ? '<div style="font-size:.7rem;color:#6b5b45;margin-top:.25rem">' + d.fuente + '</div>' : '') + '</div>';
    texEl.innerHTML = html;
  }

  // ── PROPIEDADES DEL SUELO — TABLA ─────────────────────────
  var tblEl = document.getElementById('suelo-tabla');
  if (tblEl) {
    var rows = [
      ['⚗️ pH (H₂O)',          d.ph != null ? d.ph.toFixed(1) : '—',           'Acidez/alcalinidad del suelo · óptimo 6.0–7.5'],
      ['🌱 C orgánico',         d.soc != null ? d.soc.toFixed(1) + ' g/kg' : '—', 'Carbono orgánico — base de la fertilidad biológica'],
      ['🌿 Materia orgánica',   mo != null ? mo.toFixed(1) + ' %' : '—',           'MO = SOC × 1.724 — reservas y agregación'],
      ['🔬 Nitrógeno total',    d.n != null ? d.n.toFixed(2) + ' g/kg' : '—',     'N total del suelo — mineralización potencial'],
      ['⚖️ Densidad aparente',  d.da != null ? d.da.toFixed(2) + ' g/cm³' : '—',  'Compactación · normal 1.0–1.4 g/cm³'],
      ['🧲 CEC',                d.cec != null ? d.cec.toFixed(1) + ' cmol/kg' : '—', 'Capacidad de intercambio catiónico'],
      ['🏺 Arcilla',            d.clay != null ? d.clay + ' %' : '—',             'Fracción fina · retención de agua y cationes'],
      ['🏖️ Arena',              d.sand != null ? d.sand + ' %' : '—',             'Fracción gruesa · drenaje'],
      ['🪨 Limo',               d.silt != null ? d.silt + ' %' : '—',             'Fracción media · agua disponible'],
      ['🗺️ Tipo de suelo',      d.textura || '—',                                 'Clasificación textural'],
    ];
    var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem">';
    html += '<thead><tr style="background:#f3ede0"><th style="text-align:left;padding:.55rem .8rem;font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;color:#5a4a32">Propiedad</th><th style="text-align:right;padding:.55rem .8rem;font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;color:#5a4a32">Valor</th><th style="text-align:left;padding:.55rem .8rem;font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;color:#5a4a32">Interpretación</th></tr></thead><tbody>';
    rows.forEach(function(r, i) {
      var bg = i % 2 === 0 ? '#fbf8f1' : '#ffffff';
      html += '<tr style="background:' + bg + ';border-bottom:1px solid rgba(74,46,26,.06)"><td style="padding:.55rem .8rem;font-weight:600;color:#3D2210">' + r[0] + '</td><td style="padding:.55rem .8rem;text-align:right;font-family:\'DM Mono\',monospace;font-weight:700;color:#1b3d28">' + r[1] + '</td><td style="padding:.55rem .8rem;font-size:.73rem;color:#5a4a32">' + r[2] + '</td></tr>';
    });
    html += '</tbody></table></div>';
    if (d.fuente) {
      html += '<div style="margin-top:.7rem;font-size:.7rem;color:#6b5b45;padding:.5rem .8rem;background:#fbf8f1;border:1px solid rgba(74,46,26,.12);border-radius:6px">' + (d.esFallback ? '⚠️ ' : '✅ ') + d.fuente + '</div>';
    }
    tblEl.innerHTML = html;
  }
}
