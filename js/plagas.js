// ════════════════════════════════════════════════════════
// AGROMOTOR — js/plagas.js
// Módulo 07: Alertas de Plagas · Integrado con Lote Activo
// ════════════════════════════════════════════════════════

(function() {
  window.AM = window.AM || {};
  window.AM.plagas = {};

var RADIO_KM = 80; // radio de búsqueda de reportes comunitarios

// Reutilizar el cliente Supabase global (config.js lo define antes)
var sb = (typeof AM_SB !== 'undefined') ? AM_SB : null;
var supabaseActivo = sb !== null;

// ═══════════════════════════════════════════════════════════════
// ZONAS INTA con coordenadas
// ═══════════════════════════════════════════════════════════════
var INTA_ZONAS = [
  { nombre:'Marcos Juárez',           lat:-32.70, lon:-62.10 },
  { nombre:'Pergamino',               lat:-33.89, lon:-60.57 },
  { nombre:'Paraná',                  lat:-31.75, lon:-60.48 },
  { nombre:'Oliveros',                lat:-32.55, lon:-60.87 },
  { nombre:'Manfredi',                lat:-31.83, lon:-63.77 },
  { nombre:'Anguil',                  lat:-36.53, lon:-64.02 },
  { nombre:'Bordenave',               lat:-37.84, lon:-63.01 },
  { nombre:'Balcarce',                lat:-37.75, lon:-58.30 },
  { nombre:'General Villegas',        lat:-35.03, lon:-63.02 },
  { nombre:'Reconquista',             lat:-29.15, lon:-59.65 },
  { nombre:'Corrientes',              lat:-27.47, lon:-58.83 },
  { nombre:'Salta',                   lat:-24.78, lon:-65.42 },
  { nombre:'Concepción del Uruguay',  lat:-32.48, lon:-58.23 },
  { nombre:'Concordia',               lat:-31.39, lon:-58.02 }
];

// Estado global del módulo
var gState = { selectedSev: 0 };

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════
function today() { return new Date().toISOString().slice(0,10); }
function daysAgo(n) { var d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }

function haversineKm(lat1,lon1,lat2,lon2) {
  var R=6371, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+
        Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
        Math.sin(dLon/2)*Math.sin(dLon/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function riskClass(score) {
  if (score>=65) return 'high';
  if (score>=35) return 'med';
  if (score>0)   return 'low';
  return 'none';
}
function riskLabel(rc) {
  return {high:'PRESIÓN ALTA',med:'PRESIÓN MEDIA',low:'PRESIÓN BAJA',none:'SIN PRESIÓN'}[rc]||'SIN DATOS';
}
function stageInVuln(code,arr) { return arr.indexOf(code)!==-1; }

function nearestIntaZona(lat,lon) {
  var best=null, bestD=Infinity;
  INTA_ZONAS.forEach(function(z) {
    var d=haversineKm(lat,lon,z.lat,z.lon);
    if(d<bestD){bestD=d;best=z;}
  });
  return { zona:best, distKm:Math.round(bestD) };
}

function diasDesdeHoy(dateStr) {
  var d=new Date(dateStr+'T12:00:00'), now=new Date();
  return Math.round((now-d)/(1000*60*60*24));
}

function formatFecha(dateStr) {
  var p=dateStr.split('-'); return p[2]+'/'+p[1]+'/'+p[0];
}

function sevLabel(s) {
  return ['','Leve','Moderado','Importante','Severo','Explosión'][s]||s;
}

// ═══════════════════════════════════════════════════════════════
// FENOLOGÍA (igual que módulo de enfermedades)
// ═══════════════════════════════════════════════════════════════
function normCultivoAM(cultivo) {
  var s = String(cultivo || '').toLowerCase();
  try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch(e) {}
  if (/ma.z/.test(s)) return 'maiz';
  return s;
}

function grupoCultivoAM(cultivo) {
  var c = normCultivoAM(cultivo);
  if (['trigo','cebada','colza'].indexOf(c) >= 0) return 'invierno';
  if (['soja','maiz','girasol','sorgo'].indexOf(c) >= 0) return 'verano';
  return '';
}

function loteActivoAM() {
  try {
    if (typeof window.amGetLoteActivo === 'function') return window.amGetLoteActivo();
    return (window.AM_LOTES || []).find(function(l) { return String(l.id) === String(window.AM_LOTE_ACTIVO); }) || null;
  } catch(e) { return null; }
}

function fechaSiembraLoteAM(lote, cultivo) {
  var d = (lote && lote.data) || {};
  var ck = d.calcKeys || {};
  var planes = d.planificacionSiembra || {};
  var grupo = grupoCultivoAM(cultivo || d.cultivo || ck['am_siembra_cultivo'] || '');
  var plan = grupo ? (planes[grupo] || {}) : {};
  if (grupo && typeof window.amGetFechaSiembraGrupo === 'function') {
    var fechaGrupo = window.amGetFechaSiembraGrupo(lote, grupo);
    if (fechaGrupo) return fechaGrupo;
  }
  return plan.fechaSiembraConf || plan.fechaSiembraPlan
    || d.fechaSiembraConf || d.fechaSiembraPlan || d.fechaSiembra || d.fecha || ck['am_siembra_fecha'] || ''
    || (planes.invierno && (planes.invierno.fechaSiembraConf || planes.invierno.fechaSiembraPlan)) || ''
    || (planes.verano && (planes.verano.fechaSiembraConf || planes.verano.fechaSiembraPlan)) || '';
}

function coordsLoteAM(lote) {
  var d = (lote && lote.data) || {};
  if (d.coord) {
    var p = String(d.coord).replace(/\s/g,'').split(',');
    if (p.length >= 2) return { lat: parseFloat(p[0]), lon: parseFloat(p[1]) };
  }
  if (Array.isArray(d.polygon) && d.polygon.length) {
    var sLat = 0, sLon = 0;
    d.polygon.forEach(function(p2) { sLat += parseFloat(p2.lat) || 0; sLon += parseFloat(p2.lng) || 0; });
    return { lat: sLat / d.polygon.length, lon: sLon / d.polygon.length };
  }
  if (d.geojson && d.geojson.geometry && Array.isArray(d.geojson.geometry.coordinates)) {
    var ring = d.geojson.geometry.coordinates[0] || [];
    if (ring.length) {
      var rLat = 0, rLon = 0;
      ring.forEach(function(c) { rLat += parseFloat(c[1]) || 0; rLon += parseFloat(c[0]) || 0; });
      return { lat: rLat / ring.length, lon: rLon / ring.length };
    }
  }
  return null;
}

function setContextoPlagas(lote, cultivo, fecha, coords) {
  var form = document.getElementById('plagas-input-card');
  var ctx = document.getElementById('plagas-contexto-lote');
  if (form) form.style.display = 'none';
  if (!ctx) return;
  ctx.innerHTML = '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.9rem 1rem;margin-top:1rem">'
    + '<div style="font-size:.62rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:.55rem">Contexto heredado del lote</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:.4rem">'
    + '<span style="border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:.22rem .6rem;font-size:.72rem;color:rgba(255,255,255,.7)">' + (lote ? lote.nombre : 'Lote activo') + '</span>'
    + '<span style="border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:.22rem .6rem;font-size:.72rem;color:rgba(255,255,255,.7)">' + (cultivo || '-') + '</span>'
    + '<span style="border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:.22rem .6rem;font-size:.72rem;color:rgba(255,255,255,.7)">Siembra ' + (fecha || '-') + '</span>'
    + '<span style="border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:.22rem .6rem;font-size:.72rem;color:rgba(255,255,255,.7)">' + (coords ? coords.lat.toFixed(4) + ', ' + coords.lon.toFixed(4) : '-') + '</span>'
    + '</div></div>';
}

window.plagasPrepararAutoLote = function() {
  var lote = loteActivoAM();
  var d = (lote && lote.data) || {};
  var cultivo = normCultivoAM(d.cultivo || (d.calcKeys || {})['am_siembra_cultivo'] || (document.getElementById('s-cultivo') || {}).value || 'soja');
  if (!PESTS[cultivo]) cultivo = 'soja';
  var fecha = fechaSiembraLoteAM(lote, cultivo) || (document.getElementById('s-fecha') || {}).value || '';
  var coords = coordsLoteAM(lote);
  var pfEl = document.getElementById('plagas-siembra');
  if (pfEl && fecha) pfEl.value = fecha;
  setContextoPlagas(lote, cultivo, fecha, coords);
};

var PHENOLOGY = {
  soja:    { base:10, icon:'🫘', stages:[
    {gdd:0,code:'VE',name:'Emergencia'},{gdd:120,code:'V2',name:'V2'},
    {gdd:280,code:'V4',name:'V4'},{gdd:450,code:'V6',name:'V6'},
    {gdd:600,code:'R1',name:'R1 – Inicio floración'},{gdd:720,code:'R2',name:'R2 – Floración plena'},
    {gdd:870,code:'R3',name:'R3 – Inicio vainas'},{gdd:1020,code:'R4',name:'R4 – Vainas llenas'},
    {gdd:1180,code:'R5',name:'R5 – Inicio llenado'},{gdd:1380,code:'R6',name:'R6 – Llenado pleno'},
    {gdd:1600,code:'R7',name:'R7 – Madurez fisiológica'}
  ]},
  maiz:    { base:10, icon:'🌽', stages:[
    {gdd:0,code:'VE',name:'Emergencia'},{gdd:180,code:'V4',name:'V4'},
    {gdd:380,code:'V8',name:'V8'},{gdd:620,code:'V12',name:'V12'},
    {gdd:700,code:'VT',name:'VT – Emisión panoja'},{gdd:760,code:'R1',name:'R1 – Estigmas'},
    {gdd:900,code:'R2',name:'R2 – Ampolla'},{gdd:1060,code:'R3',name:'R3 – Lechoso'},
    {gdd:1260,code:'R4',name:'R4 – Pastoso'},{gdd:1480,code:'R5',name:'R5 – Dentado'},
    {gdd:1680,code:'R6',name:'R6 – Madurez'}
  ]},
  trigo:   { base:0,  icon:'🌾', stages:[
    {gdd:0,code:'Z10',name:'Emergencia'},{gdd:250,code:'Z21',name:'Z21 – Macollaje'},
    {gdd:500,code:'Z30',name:'Z30 – Encañazón'},{gdd:720,code:'Z45',name:'Z45 – Bota'},
    {gdd:900,code:'Z65',name:'Z65 – Antesis'},{gdd:1100,code:'Z75',name:'Z75 – Lechoso'},
    {gdd:1300,code:'Z87',name:'Z87 – Pastoso'},{gdd:1500,code:'Z92',name:'Z92 – Madurez'}
  ]},
  girasol: { base:6,  icon:'🌻', stages:[
    {gdd:0,code:'VE',name:'Emergencia'},{gdd:180,code:'V4',name:'V4'},
    {gdd:380,code:'V8',name:'V8'},{gdd:580,code:'R1',name:'R1 – Botón floral'},
    {gdd:740,code:'R5',name:'R5 – Inicio floración'},{gdd:900,code:'R6',name:'R6 – Floración plena'},
    {gdd:1100,code:'R8',name:'R8 – Formación aquenios'},{gdd:1350,code:'R9',name:'R9 – Madurez'}
  ]}
};

// ═══════════════════════════════════════════════════════════════
// MODELOS DE PLAGAS
// ═══════════════════════════════════════════════════════════════
var PESTS = {
  soja: [
    {
      id:'chinche_cuernos', name:'Chinche de los Cuernos', sci:'Dichelops furcatus', icon:'🪲',
      vuln:['R3','R4','R5','R6'],
      check: function(d) { return d.tmean >= 18 && d.tmean <= 28 && d.tmin >= 12; },
      checkF: function(d) {
        if (d.tmean >= 22 && d.tmin >= 16) return 'high';
        if (d.tmean >= 18 && d.tmin >= 12) return 'med';
        return 'none';
      },
      reasons: { fav:'T° nocturna > 12 °C favorece actividad y reproducción', unfav:'Temperatura baja — presión reducida' },
      rec: { high:'⚠️ Monitorear bordes de lote con manga entomológica. Umbral: 5 chinches/metro lineal',
             med:'👁 Recorrer bordes del lote, especialmente en R3-R4', low:'✅ Sin acción', none:'✅ Sin acción' }
    },
    {
      id:'anticarsia', name:'Oruga de la Soja', sci:'Anticarsia gemmatalis', icon:'🐛',
      vuln:['R1','R2','R3','R4','R5','R6'],
      check: function(d) { return d.tmean >= 25 && d.tmin >= 18 && d.hrMean >= 60; },
      checkF: function(d) {
        if (d.tmean >= 28 && d.tmin >= 20) return 'high';
        if (d.tmean >= 25 && d.tmin >= 18) return 'med';
        return 'none';
      },
      reasons: { fav:'Noches cálidas (> 18 °C) con temperatura media > 25 °C', unfav:'Temperatura no favorable' },
      rec: { high:'⚠️ Monitorear defoliación. Umbral: 30% defoliación pre-floración / 15% en floración',
             med:'👁 Observar folíolos — buscar excrementos y larvas', low:'✅ Sin acción', none:'✅ Sin acción' }
    },
    {
      id:'spodoptera_soja', name:'Oruga Cogollera', sci:'Spodoptera frugiperda', icon:'🐌',
      vuln:['VE','V2','V4','V6'],
      check: function(d) { return d.tmean >= 20 && d.tmean <= 30 && d.hrMean >= 55; },
      checkF: function(d) {
        if (d.tmean >= 24 && d.hrMean >= 65) return 'high';
        if (d.tmean >= 20 && d.hrMean >= 55) return 'med';
        return 'none';
      },
      reasons: { fav:'Temperatura cálida con humedad moderada — condición de vuelo de adultos', unfav:'Condiciones no favorables' },
      rec: { high:'⚠️ Monitorear cogollos en implantación. Umbral: 10% de plantas con daño activo',
             med:'👁 Recorrer el lote en las primeras horas', low:'✅ Sin acción', none:'✅ Sin acción' }
    },
    {
      id:'trips_soja', name:'Trips', sci:'Caliothrips phaseoli', icon:'🦗',
      vuln:['R1','R2','R3'],
      check: function(d) { return d.tmean >= 28 && d.hrMean < 60 && d.precip < 2; },
      checkF: function(d) {
        if (d.tmean >= 30 && d.hrMean < 55 && d.precip < 1) return 'high';
        if (d.tmean >= 28 && d.hrMean < 60 && d.precip < 2) return 'med';
        return 'none';
      },
      reasons: { fav:'Calor seco — trips prefiere condiciones de baja humedad sin lluvia', unfav:'Lluvias o humedad alta reducen la presión' },
      rec: { high:'⚠️ Monitorear con tarjetas adhesivas. Umbral orientativo: >30 trips/flor en R1',
             med:'👁 Observar flores y brotes — silvado plateado en folíolos', low:'✅ Sin acción', none:'✅ Sin acción' }
    }
  ],
  maiz: [
    {
      id:'spodoptera_maiz', name:'Cogollero del Maíz', sci:'Spodoptera frugiperda', icon:'🐛',
      vuln:['VE','V4','V8','V12'],
      check: function(d) { return d.tmean >= 20 && d.tmean <= 30 && d.hrMean >= 60; },
      checkF: function(d) {
        if (d.tmean >= 24 && d.hrMean >= 68) return 'high';
        if (d.tmean >= 20 && d.hrMean >= 60) return 'med';
        return 'none';
      },
      reasons: { fav:'Temperatura 20–30 °C con humedad moderada-alta — favorece vuelo y oviposición', unfav:'Condiciones no favorables' },
      rec: { high:'⚠️ Monitorear cogollos — umbral: 20% de plantas con larvas vivas en implantación',
             med:'👁 Recorrer el lote al amanecer — buscar síntomas de daño foliar', low:'✅ Sin acción', none:'✅ Sin acción' }
    },
    {
      id:'diatraea', name:'Barrenador del Tallo', sci:'Diatraea saccharalis', icon:'🪲',
      vuln:['V8','V12','VT','R1','R2','R3'],
      check: function(d) { return d.tmean >= 24 && d.hrMean >= 70; },
      checkF: function(d) {
        if (d.tmean >= 26 && d.hrMean >= 75) return 'high';
        if (d.tmean >= 24 && d.hrMean >= 70) return 'med';
        return 'none';
      },
      reasons: { fav:'Calor húmedo (T° > 24 °C, HR > 70 %%) — óptimo para ciclo larval', unfav:'Temperatura o humedad insuficiente' },
      rec: { high:'⚠️ Monitorear tallos en V8-R2. Umbral: 10-15% de plantas con daño de barrenado',
             med:'👁 Observar aserrín y orificios de entrada en la base del tallo', low:'✅ Sin acción', none:'✅ Sin acción' }
    },
    {
      id:'diabrotica', name:'Vaquita / Diabrótica', sci:'Diabrotica speciosa', icon:'🐞',
      vuln:['VE','V4','V8'],
      check: function(d) { return d.tmean >= 15 && d.tmean <= 25 && d.precip >= 3; },
      checkF: function(d) {
        if (d.tmean >= 18 && d.tmean <= 23 && d.precip >= 5) return 'high';
        if (d.tmean >= 15 && d.precip >= 3) return 'med';
        return 'none';
      },
      reasons: { fav:'Suelo húmedo en implantación — larvas atacan raíces, adultos el follaje', unfav:'Condiciones secas o temperatura extrema' },
      rec: { high:'⚠️ Monitorear raíces y folíolos. En adultos: umbral 6/planta en implantación',
             med:'👁 Evaluar "ventanillas" en hojas — daño característico de adultos', low:'✅ Sin acción', none:'✅ Sin acción' }
    }
  ],
  trigo: [
    {
      id:'pulgon_verde', name:'Pulgón Verde', sci:'Rhopalosiphum padi', icon:'🦟',
      vuln:['Z10','Z21','Z30'],
      check: function(d) { return d.tmean >= 10 && d.tmean <= 20 && d.tmin >= 2; },
      checkF: function(d) {
        if (d.tmean >= 12 && d.tmean <= 18 && d.tmin >= 5) return 'high';
        if (d.tmean >= 10 && d.tmin >= 2) return 'med';
        return 'none';
      },
      reasons: { fav:'T° suaves de otoño-invierno sin heladas — condición de establecimiento de colonias', unfav:'Heladas frecuentes o temperatura alta' },
      rec: { high:'⚠️ Monitorear vaina basal. Es vector del BYDV (virus del enanismo amarillo). Umbral: 1 pulgón alado/5 plantas',
             med:'👁 Revisar plantas basales — buscar colonias en vainas y hojas', low:'✅ Sin acción', none:'✅ Sin acción' }
    },
    {
      id:'pulgon_amarillo', name:'Pulgón Amarillo', sci:'Schizaphis graminum', icon:'🟡',
      vuln:['Z21','Z30','Z45'],
      check: function(d) { return d.tmean >= 15 && d.tmean <= 25 && d.hrMean < 65 && d.precip < 3; },
      checkF: function(d) {
        if (d.tmean >= 18 && d.tmean <= 24 && d.hrMean < 60 && d.precip < 1) return 'high';
        if (d.tmean >= 15 && d.hrMean < 65) return 'med';
        return 'none';
      },
      reasons: { fav:'Condiciones secas y templadas — pulgón amarillo prefiere baja HR', unfav:'Lluvias o alta humedad desfavorecen colonias' },
      rec: { high:'⚠️ Es vector del BYDV. Umbral: 1 pulgón alado/5 plantas o 10 ápteros/macollo',
             med:'👁 Monitorear láminas foliares — clorosis y enrollamiento', low:'✅ Sin acción', none:'✅ Sin acción' }
    },
    {
      id:'sitobion', name:'Pulgón de la Espiga', sci:'Sitobion avenae', icon:'🌿',
      vuln:['Z65','Z75','Z87'],
      check: function(d) { return d.tmean >= 15 && d.tmean <= 25; },
      checkF: function(d) {
        if (d.tmean >= 18 && d.tmean <= 23 && d.hrMean < 70) return 'high';
        if (d.tmean >= 15 && d.tmean <= 25) return 'med';
        return 'none';
      },
      reasons: { fav:'T° moderada en espigazón — coloniza directamente las espigas', unfav:'Temperatura fuera de rango óptimo' },
      rec: { high:'⚠️ Monitorear espigas en Z65-Z87. Umbral: 500 pulgones/m lineal o 5/espiga',
             med:'👁 Revisar espigas — buscar colonias compactas de color verde-amarillo', low:'✅ Sin acción', none:'✅ Sin acción' }
    }
  ],
  girasol: [
    {
      id:'helicoverpa', name:'Isoca de la Espiga', sci:'Helicoverpa zea', icon:'🐛',
      vuln:['R5','R6'],
      check: function(d) { return d.tmean >= 22 && d.tmin >= 17; },
      checkF: function(d) {
        if (d.tmean >= 26 && d.tmin >= 20) return 'high';
        if (d.tmean >= 22 && d.tmin >= 17) return 'med';
        return 'none';
      },
      reasons: { fav:'Noches muy cálidas — activo ovipositor en capítulos en floración', unfav:'Temperatura nocturna baja — menor actividad' },
      rec: { high:'⚠️ Monitorear capítulos con conteo de posturas. Umbral: 2 larvas/capítulo',
             med:'👁 Revisar el dorso de capítulos — buscar masas de huevos amarillentos', low:'✅ Sin acción', none:'✅ Sin acción' }
    },
    {
      id:'trips_girasol', name:'Trips del Girasol', sci:'Frankliniella schultzei', icon:'🦗',
      vuln:['R1','R5','R6'],
      check: function(d) { return d.tmean >= 25 && d.hrMean < 60 && d.precip < 2; },
      checkF: function(d) {
        if (d.tmean >= 28 && d.hrMean < 55) return 'high';
        if (d.tmean >= 25 && d.hrMean < 60) return 'med';
        return 'none';
      },
      reasons: { fav:'Calor seco durante floración — máxima presión en botón y capítulo abierto', unfav:'Lluvias frecuentes o temperatura baja' },
      rec: { high:'⚠️ Monitorear flores liguadas. Umbral orientativo: >50 trips/capítulo',
             med:'👁 Revisar flores — plateado de tépalos y deformación de aquenios', low:'✅ Sin acción', none:'✅ Sin acción' }
    }
  ]
};

// Estado global
var gState = { selectedSev: 0 };

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════
function today() { return new Date().toISOString().slice(0,10); }
function daysAgo(n) { var d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }

function haversineKm(lat1,lon1,lat2,lon2) {
  var R=6371, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+
        Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
        Math.sin(dLon/2)*Math.sin(dLon/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function riskClass(score) {
  if (score>=65) return 'high';
  if (score>=35) return 'med';
  if (score>0)   return 'low';
  return 'none';
}
function riskLabel(rc) {
  return {high:'PRESIÓN ALTA',med:'PRESIÓN MEDIA',low:'PRESIÓN BAJA',none:'SIN PRESIÓN'}[rc]||'SIN DATOS';
}
function stageInVuln(code,arr) { return arr.indexOf(code)!==-1; }

function nearestIntaZona(lat,lon) {
  var best=null, bestD=Infinity;
  INTA_ZONAS.forEach(function(z) {
    var d=haversineKm(lat,lon,z.lat,z.lon);
    if(d<bestD){bestD=d;best=z;}
  });
  return { zona:best, distKm:Math.round(bestD) };
}

function diasDesdeHoy(dateStr) {
  var d=new Date(dateStr+'T12:00:00'), now=new Date();
  return Math.round((now-d)/(1000*60*60*24));
}

function formatFecha(dateStr) {
  var p=dateStr.split('-'); return p[2]+'/'+p[1]+'/'+p[0];
}

function sevLabel(s) {
  return ['','Leve','Moderado','Importante','Severo','Explosión'][s]||s;
}

// ═══════════════════════════════════════════════════════════════
// API CALLS
// ═══════════════════════════════════════════════════════════════
function fetchWithTimeout(url, ms) {
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, ms);
  return fetch(url, { signal: ctrl.signal })
    .then(function(r){ clearTimeout(timer); return r.json(); })
    .catch(function(e){ clearTimeout(timer); throw e; });
}

function fetchClimateArchive(lat,lon,startDate,endDate) {
  var url = 'https://archive-api.open-meteo.com/v1/archive?latitude='+lat+'&longitude='+lon+
    '&start_date='+startDate+'&end_date='+endDate+
    '&daily=temperature_2m_max,temperature_2m_min&timezone=America%2FArgentina%2FBuenos_Aires';
  return fetchWithTimeout(url, 15000);
}

function fetchClimateForecast(lat,lon) {
  var url = 'https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+
    '&hourly=temperature_2m,relative_humidity_2m,precipitation'+
    '&past_days=14&forecast_days=7&timezone=America%2FArgentina%2FBuenos_Aires';
  return fetchWithTimeout(url, 15000);
}

// ═══════════════════════════════════════════════════════════════
// SUPABASE QUERIES
// ═══════════════════════════════════════════════════════════════
function supabaseTableEnabled(name) {
  var flags = (window.AM_CONFIG && window.AM_CONFIG.supabaseTables) || {};
  return flags[name] === true;
}

function fetchCommunityReports(lat,lon,cultivo) {
  if(!supabaseActivo||!sb) return Promise.resolve([]);
  if(!supabaseTableEnabled('pest_reports')) return Promise.resolve([]);
  var since=new Date(Date.now()-30*24*60*60*1000).toISOString();
  return sb.from('pest_reports').select('*')
    .gte('created_at',since).eq('cultivo',cultivo)
    .order('created_at',{ascending:false})
    .then(function(res) {
      if(res.error||!res.data) return [];
      return res.data
        .map(function(r){ r.distKm=Math.round(haversineKm(lat,lon,r.lat,r.lon)); return r; })
        .filter(function(r){ return r.distKm<=RADIO_KM; })
        .sort(function(a,b){ return a.distKm-b.distKm; });
    }).catch(function(){ return []; });
}

function fetchIntaAlerts(lat,lon,cultivo) {
  var zona=nearestIntaZona(lat,lon);
  if(!supabaseActivo||!sb) return Promise.resolve({alerts:[],zona:zona});
  if(!supabaseTableEnabled('inta_alerts')) return Promise.resolve({alerts:[],zona:zona});
  var since=new Date(Date.now()-45*24*60*60*1000).toISOString().slice(0,10);
  return sb.from('inta_alerts').select('*')
    .eq('zona',zona.zona.nombre).gte('fecha_boletin',since)
    .order('fecha_boletin',{ascending:false})
    .then(function(res){
      if(res.error||!res.data) return {alerts:[],zona:zona};
      return {alerts:res.data,zona:zona};
    }).catch(function(){ return {alerts:[],zona:zona}; });
}

function submitReport(data) {
  if(!supabaseActivo||!sb) return Promise.reject(new Error('Supabase no configurado'));
  if(!supabaseTableEnabled('pest_reports')) return Promise.reject(new Error('Reportes comunitarios no habilitados'));
  return sb.from('pest_reports').insert(data).then(function(res){
    if(res.error) throw new Error(res.error.message);
    return res;
  });
}

// ═══════════════════════════════════════════════════════════════
// PROCESAMIENTO CLIMÁTICO
// ═══════════════════════════════════════════════════════════════
function buildDailySummaries(hourlyData) {
  var times=hourlyData.hourly.time, temps=hourlyData.hourly.temperature_2m,
      rhs=hourlyData.hourly.relative_humidity_2m, precips=hourlyData.hourly.precipitation;
  var todayStr=today(), byDay={};
  for(var i=0;i<times.length;i++) {
    var day=times[i].slice(0,10);
    if(!byDay[day]) byDay[day]={temps:[],rhs:[],precip:0,isForecast:day>todayStr};
    byDay[day].temps.push(temps[i]);
    byDay[day].rhs.push(rhs[i]);
    byDay[day].precip+=(precips[i]||0);
  }
  return Object.keys(byDay).sort().map(function(d) {
    var e=byDay[d], tArr=e.temps, rArr=e.rhs;
    return {
      date:d,
      tmax:Math.max.apply(null,tArr), tmin:Math.min.apply(null,tArr),
      tmean:tArr.reduce(function(a,b){return a+b;},0)/tArr.length,
      hrMean:rArr.reduce(function(a,b){return a+b;},0)/rArr.length,
      precip:e.precip, isForecast:e.isForecast
    };
  });
}

function calcGDD(tmax,tmin,base){ return Math.max(0,(tmax+tmin)/2-base); }

function calcCumGDD(archiveData,dailySummaries,siembraDate,cultivo) {
  var base=PHENOLOGY[cultivo].base, cum=0;
  if(archiveData&&archiveData.daily) {
    var ad=archiveData.daily;
    for(var i=0;i<ad.time.length;i++) {
      if(ad.time[i]>=siembraDate) cum+=calcGDD(ad.temperature_2m_max[i],ad.temperature_2m_min[i],base);
    }
  }
  dailySummaries.forEach(function(ds) {
    if(!ds.isForecast&&ds.date>=siembraDate) cum+=calcGDD(ds.tmax,ds.tmin,base);
  });
  return Math.round(cum);
}

function getStage(cumGDD,cultivo) {
  var stages=PHENOLOGY[cultivo].stages, stage=stages[0];
  for(var i=stages.length-1;i>=0;i--) { if(cumGDD>=stages[i].gdd){stage=stages[i];break;} }
  return { stage:stage, pct:Math.min(100,Math.round(cumGDD/stages[stages.length-1].gdd*100)) };
}

var PEST_SEASON = {
  chinche_cuernos:[12,1,2,3],
  anticarsia:[11,12,1,2],
  spodoptera_soja:[10,11,12,1,2],
  trips_soja:[11,12,1,2],
  spodoptera_maiz:[9,10,11,12,1],
  diatraea:[11,12,1,2,3],
  diabrotica:[10,11,12],
  pulgon_verde:[6,7,8,9],
  pulgon_amarillo:[8,9,10],
  sitobion:[9,10,11],
  helicoverpa:[11,12,1],
  trips_girasol:[10,11,12]
};

function pestInSeason(pest,dateStr) {
  var months=PEST_SEASON[pest.id];
  if(!months||!months.length) return true;
  var d=dateStr?new Date(dateStr+'T12:00:00'):new Date();
  return months.indexOf(d.getMonth()+1)>=0;
}

function calcPestRisks(histDays,stageCode,cultivo) {
  var pests=PESTS[cultivo], recent7=histDays.slice(-7), results=[];
  pests.forEach(function(pest) {
    var favDays=0;
    recent7.forEach(function(d){ if(pest.check(d)) favDays++; });
    var rawScore=(favDays/7)*100;
    var inVuln=stageInVuln(stageCode,pest.vuln);
    var inSeason=pestInSeason(pest);
    var score=(inVuln&&inSeason)?rawScore:0;
    var rc=riskClass(score);
    var reason=favDays>=3
      ? pest.reasons.fav+' ('+favDays+'/7 días favorables)'
      : favDays>=1 ? pest.reasons.fav+' ('+favDays+'/7 días — incipiente)'
      : pest.reasons.unfav;
    if(!inSeason) reason='Fuera de epoca esperada para esta plaga. Se informa como vigilancia, sin alarma.';
    else if(!inVuln) reason='Cultivo fuera de la ventana vulnerable ('+pest.vuln.join(', ')+'). Se informa como vigilancia, sin alarma.';
    results.push({
      id:pest.id, name:pest.name, sci:pest.sci, icon:pest.icon,
      score:Math.round(score), riskClass:rc, favorableDays:favDays,
      inVuln:inVuln, inSeason:inSeason, reason:reason, vulnStages:pest.vuln,
      rec:pest.rec[rc]||pest.rec.none
    });
  });
  return results;
}

function calcForecastRisks(dailySummaries,stageCode,cultivo) {
  var pests=PESTS[cultivo];
  var fDays=dailySummaries.filter(function(d){return d.isForecast;}).slice(0,7);
  var diseases=pests.map(function(pest) {
    var dayRisks=fDays.map(function(d) {
      var raw=pest.checkF(d);
      var inVuln=stageInVuln(stageCode,pest.vuln);
      var inSeason=pestInSeason(pest,d.date);
      var rc=(inVuln&&inSeason)?raw:'none';
      return {date:d.date,rc:rc};
    });
    return {id:pest.id,name:pest.name,sci:pest.sci,dayRisks:dayRisks};
  });
  return {diseases:diseases,forecastDays:fDays};
}

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════
function renderMain(params) {
  var stageInfo=params.stageInfo, wSummary=params.wSummary,
      pestRisks=params.pestRisks, forecastData=params.forecastData,
      communityReports=params.communityReports, intaData=params.intaData,
      cultivo=params.cultivo, lat=params.lat, lon=params.lon;

  var stage=stageInfo.stage, icon=PHENOLOGY[cultivo].icon;
  var countHigh=pestRisks.filter(function(d){return d.riskClass==='high';}).length;
  var countMed =pestRisks.filter(function(d){return d.riskClass==='med';}).length;
  var countLow =pestRisks.filter(function(d){return d.riskClass!=='high'&&d.riskClass!=='med';}).length;
  var intaNear=intaData.zona;

  var html='';

  // Weather strip
  html+='<div class="weather-strip">';
  html+='<div class="weather-item"><span class="w-val">'+Math.round(wSummary.tmean)+'°C</span><span class="w-lbl">T° Media</span></div>';
  html+='<div class="weather-item"><span class="w-val">'+Math.round(wSummary.tmin)+'°C</span><span class="w-lbl">T° Mín</span></div>';
  html+='<div class="weather-item"><span class="w-val">'+Math.round(wSummary.hrMean)+'%%</span><span class="w-lbl">HR Media</span></div>';
  html+='<div class="weather-item"><span class="w-val">'+wSummary.precip.toFixed(0)+'mm</span><span class="w-lbl">Lluvia 7d</span></div>';
  html+='<div class="weather-item"><span class="w-val">📍'+intaNear.distKm+'km</span><span class="w-lbl">'+intaNear.zona.nombre.split(' ').slice(-1)[0]+'</span></div>';
  html+='</div>';

  // Fenología
  html+='<div class="feno-card">';
  html+='<div class="feno-icon">'+icon+'</div><div class="feno-info">';
  html+='<div class="feno-cultivo">'+cultivo.toUpperCase()+'</div>';
  html+='<div class="feno-estado">'+stage.code+' — '+stage.name+'</div>';
  html+='<div class="feno-gdd">'+stageInfo.cumGDD+' GDD acumulados (base '+PHENOLOGY[cultivo].base+'°C)</div>';
  html+='<div class="feno-progbar"><div class="feno-progbar-fill" style="width:'+stageInfo.pct+'%%"></div></div>';
  html+='</div></div>';

  // Summary
  html+='<div class="summary-strip">';
  html+='<div class="summary-item si-high"><div class="si-count">'+countHigh+'</div><div class="si-label">Presión Alta</div></div>';
  html+='<div class="summary-item si-med"><div class="si-count">'+countMed+'</div><div class="si-label">Presión Media</div></div>';
  html+='<div class="summary-item si-low"><div class="si-count">'+countLow+'</div><div class="si-label">Sin Presión</div></div>';
  html+='</div>';

  // Pest cards
  html+='<div class="section-title">Favorabilidad climática — últimos 7 días</div>';
  pestRisks.forEach(function(pest) {
    var pc='pc-'+pest.riskClass;
    html+='<div class="pest-card '+pc+'">';
    html+='<div class="pc-header"><div class="pc-left">';
    html+='<div class="pc-name">'+pest.icon+' '+pest.name+'</div>';
    html+='<div class="pc-sci">'+pest.sci+'</div>';
    html+='</div><div class="risk-badge rb-'+pest.riskClass+'">'+riskLabel(pest.riskClass)+'</div></div>';
    html+='<div class="pc-score-bar"><div class="pc-score-fill" style="width:'+pest.score+'%%"></div></div>';
    html+='<div class="pc-reason">'+pest.reason;
    if(!pest.inSeason) html+='<br><span class="pc-feno-warn">Fuera de epoca estacional esperada - sin alarma</span>';
    else if(!pest.inVuln) html+='<br><span class="pc-feno-warn">⏱ Cultivo fuera de la ventana vulnerable - sin alarma ('+pest.vulnStages.join(', ')+')</span>';
    html+='</div>';
    html+='<div class="pc-rec">'+pest.rec+'</div>';
    html+='<div class="orientativa-tag">⚠️ Estimación orientativa — validar con monitoreo</div>';
    html+='</div>';
  });

  // INTA alerts
  html+='<div class="section-title">Alertas INTA — '+intaNear.zona.nombre+' ('+intaNear.distKm+' km)</div>';
  if(!supabaseActivo) {
    html+='<div class="empty-box">🔧 Configurar Supabase para mostrar alertas INTA procesadas por la Edge Function diaria.</div>';
  } else if(intaData.alerts.length===0) {
    html+='<div class="empty-box">Sin alertas INTA recientes para '+cultivo+' en '+intaNear.zona.nombre+' (últimos 45 días).</div>';
  } else {
    intaData.alerts.forEach(function(a) {
      var nivelClass='inta-nivel-'+(a.nivel_alerta||'bajo');
      html+='<div class="inta-card">';
      html+='<div class="inta-card-header">';
      html+='<div class="inta-zona">📡 INTA '+a.zona+'</div>';
      html+='<div class="inta-fecha">'+formatFecha(a.fecha_boletin)+'</div>';
      html+='</div>';
      html+='<div class="inta-plaga">'+a.plaga+'</div>';
      html+='<div class="inta-resumen">'+a.resumen+'</div>';
      html+='<span class="inta-nivel '+nivelClass+'">'+a.nivel_alerta.toUpperCase()+'</span>';
      if(a.fuente_url) html+='<a class="inta-fuente" href="'+a.fuente_url+'" target="_blank">→ Ver boletín INTA original</a>';
      html+='</div>';
    });
  }

  // Community reports
  html+='<div class="section-title">Red comunitaria — reportes en '+RADIO_KM+' km</div>';
  if(!supabaseActivo) {
    html+='<div class="empty-box">🔧 Configurar Supabase para activar la red comunitaria de reportes.</div>';
  } else if(communityReports.length===0) {
    html+='<div class="empty-box">Sin reportes comunitarios de '+cultivo+' en los últimos 30 días dentro de '+RADIO_KM+' km.</div>';
  } else {
    communityReports.forEach(function(r) {
      var dias=diasDesdeHoy(r.created_at.slice(0,10));
      html+='<div class="report-card">';
      html+='<div class="rc-sev rc-sev-'+r.severidad+'">'+r.severidad+'</div>';
      html+='<div class="rc-info">';
      html+='<div class="rc-plaga">'+r.plaga_nombre+'</div>';
      html+='<div class="rc-meta">'+r.reporter_name+' · hace '+(dias===0?'hoy':dias+' días')+'</div>';
      if(r.nota) html+='<div class="rc-nota">"'+r.nota+'"</div>';
      html+='<div class="rc-dist">📍 '+r.distKm+' km de tu lote · '+sevLabel(r.severidad)+'</div>';
      html+='</div></div>';
    });
  }

  // Report form
  html+='<div class="section-title">Reportar una plaga</div>';
  html+=renderReportForm(cultivo,lat,lon);

  // Forecast heatmap
  html+='<div class="section-title">Condiciones favorables — próximos 7 días</div>';
  var fDays=forecastData.forecastDays;
  if(fDays.length>0) {
    var dias2=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    html+='<div class="forecast-wrap"><div class="forecast-header-row"><div class="fh-inner">';
    html+='<div class="fh-label">Plaga</div>';
    fDays.forEach(function(fd) {
      var p=fd.date.split('-');
      html+='<div class="fh-day">'+dias2[new Date(fd.date+'T12:00:00').getDay()]+'<span>'+p[2]+'/'+p[1]+'</span></div>';
    });
    html+='</div></div>';
    forecastData.diseases.forEach(function(fd) {
      html+='<div class="forecast-row"><div class="fr-pest">'+fd.name+'<span class="fr-sci">'+fd.sci+'</span></div>';
      fd.dayRisks.forEach(function(dr) {
        var dot=dr.rc==='high'?'▲':dr.rc==='med'?'◆':dr.rc==='low'?'●':'·';
        html+='<div class="fr-cell"><div class="fr-dot risk-'+dr.rc+'">'+dot+'</div></div>';
      });
      html+='</div>';
    });
    html+='</div>';
    html+='<div class="legend">';
    html+='<div class="legend-item"><div class="legend-dot" style="background:var(--high-bg);border:1px solid var(--high-bd)"></div>Alta presión</div>';
    html+='<div class="legend-item"><div class="legend-dot" style="background:var(--med-bg);border:1px solid var(--med-bd)"></div>Media</div>';
    html+='<div class="legend-item"><div class="legend-dot" style="background:var(--low-bg);border:1px solid var(--low-bd)"></div>Baja</div>';
    html+='<div class="legend-item"><div class="legend-dot" style="background:var(--none-bg);border:1px solid var(--none-bd)"></div>Sin presión</div>';
    html+='</div>';
  }

  document.getElementById('plagas-content').innerHTML=html;
  initReportForm();
}

function renderReportForm(cultivo,lat,lon) {
  var plagaOptions='';
  PESTS[cultivo].forEach(function(p) {
    plagaOptions+='<option value="'+p.id+'|'+p.name+'">'+p.icon+' '+p.name+'</option>';
  });
  var html='<div class="report-form" id="report-form-wrap">';
  html+='<div class="rf-title">📍 Reportar detección en campo</div>';
  html+='<div class="rf-grid">';
  html+='<div class="rf-group"><label>Tu nombre</label><input type="text" id="rf-nombre" placeholder="Ing. Apellido"></div>';
  html+='<div class="rf-group"><label>Plaga detectada</label><select id="rf-plaga">'+plagaOptions+'</select></div>';
  html+='<div class="rf-group" style="grid-column:1/-1"><label>Severidad</label>';
  html+='<div class="sev-selector">';
  [1,2,3,4,5].forEach(function(s) {
    html+='<button class="sev-btn" data-sev="'+s+'" onclick="selectSev('+s+')" type="button">'+s+'<br><span style="font-size:0.55rem;font-weight:normal">'+['','Leve','Mod','Imp','Sev','Expl'][s]+'</span></button>';
  });
  html+='</div></div>';
  html+='<div class="rf-group" style="grid-column:1/-1"><label>Nota adicional (opcional)</label><textarea id="rf-nota" placeholder="Ej: borde sur del lote, cerca de monte..."></textarea></div>';
  html+='<input type="hidden" id="rf-lat" value="'+lat+'">';
  html+='<input type="hidden" id="rf-lon" value="'+lon+'">';
  html+='<input type="hidden" id="rf-cultivo" value="'+cultivo+'">';
  html+='<button class="btn-reportar full-col" id="btn-reportar" onclick="enviarReporte()" type="button">📤 Enviar reporte a la red</button>';
  html+='</div>';
  html+='<div id="report-feedback"></div>';
  html+='</div>';
  return html;
}

function initReportForm() {
  gState.selectedSev=0;
}

function selectSev(s) {
  gState.selectedSev=s;
  document.querySelectorAll('.sev-btn').forEach(function(btn) {
    var bSev=parseInt(btn.dataset.sev);
    btn.className='sev-btn'+(bSev===s?' active-'+s:'');
  });
}

function actualizarPlaga() { /* form updates on analizar */ }

function enviarReporte() {
  var nombre=document.getElementById('rf-nombre').value.trim();
  var plagaVal=document.getElementById('rf-plaga').value;
  var nota=document.getElementById('rf-nota').value.trim();
  var lat=parseFloat(document.getElementById('rf-lat').value);
  var lon=parseFloat(document.getElementById('rf-lon').value);
  var cultivo=document.getElementById('rf-cultivo').value;
  var sev=gState.selectedSev;

  if(!nombre){alert('Por favor ingresá tu nombre.');return;}
  if(!sev){alert('Por favor seleccioná la severidad.');return;}
  if(!supabaseActivo){
    document.getElementById('report-feedback').innerHTML=
      '<div class="empty-box">🔧 Configurar Supabase para activar la red comunitaria.</div>'; return;
  }

  var parts=plagaVal.split('|');
  var btn=document.getElementById('btn-reportar');
  btn.disabled=true; btn.textContent='Enviando...';

  submitReport({
    lat:lat, lon:lon, cultivo:cultivo,
    plaga:parts[0], plaga_nombre:parts[1],
    severidad:sev, nota:nota||null, reporter_name:nombre
  }).then(function() {
    document.getElementById('report-feedback').innerHTML=
      '<div class="report-success">✅ Reporte enviado. Gracias por contribuir a la red!</div>';
    btn.textContent='📤 Enviar reporte a la red';
    btn.disabled=false;
    document.getElementById('rf-nombre').value='';
    document.getElementById('rf-nota').value='';
    gState.selectedSev=0;
    document.querySelectorAll('.sev-btn').forEach(function(b){b.className='sev-btn';});
  }).catch(function(err) {
    document.getElementById('report-feedback').innerHTML=
      '<div style="background:var(--high-bg);padding:0.6rem;border-radius:8px;font-size:0.75rem;color:var(--high)">Error al enviar: '+err.message+'</div>';
    btn.textContent='📤 Enviar reporte a la red';
    btn.disabled=false;
  });
}

// ═══════════════════════════════════════════════════════════════
// MAIN ANALIZAR
// ═══════════════════════════════════════════════════════════════
function showLoading(msg) {
  document.getElementById('plagas-content').innerHTML=
    '<div class="loading"><div class="loading-spinner">🔬</div><div class="loading-text">'+(msg||'Analizando...')+'</div></div>';
}
function showError(msg) {
  document.getElementById('plagas-content').innerHTML=
    '<div style="background:var(--high-bg);border:1.5px solid var(--high-bd);border-radius:10px;padding:0.8rem 1rem;color:var(--high);font-size:0.78rem;margin:1rem 0">⚠️ '+msg+'</div>';
}

window.amAnalizarPlagas = function() {
  if (typeof window.plagasPrepararAutoLote === 'function') window.plagasPrepararAutoLote();
  var loteAuto = loteActivoAM();
  var coordsAuto = coordsLoteAM(loteAuto);
  // 1. Coordenadas (siempre del Dashboard/Lote Activo)
  var coordRaw = (document.getElementById('s-coord') || {}).value || '';
  var lat = null, lon = null;
  if (coordsAuto && !isNaN(coordsAuto.lat) && !isNaN(coordsAuto.lon)) {
    lat = coordsAuto.lat; lon = coordsAuto.lon;
  } else if (coordRaw) {
    var parts = coordRaw.replace(/\s/g,'').split(',');
    if (parts.length >= 2) { lat = parseFloat(parts[0]); lon = parseFloat(parts[1]); }
  }

  // 2. Cultivo (Dashboard es el master, pero validamos)
  var dAuto = (loteAuto && loteAuto.data) || {};
  var cultivoEl = document.getElementById('s-cultivo');
  var cultivo = normCultivoAM(dAuto.cultivo || (dAuto.calcKeys || {})['am_siembra_cultivo'] || (cultivoEl ? cultivoEl.value : 'soja'));
  if (!PESTS[cultivo]) cultivo = 'soja';

  // 3. Fecha de siembra (Prioridad al input del módulo, fallback al Dashboard)
  var pfEl = document.getElementById('plagas-siembra');
  var sfEl = document.getElementById('s-fecha');
  var siembra = fechaSiembraLoteAM(loteAuto,cultivo) || ((pfEl && pfEl.value) ? pfEl.value : (sfEl ? sfEl.value : ''));

  // Sincronizar visualmente si se tomó del dashboard
  if (pfEl && !pfEl.value && siembra) pfEl.value = siembra;

  if(lat===null||isNaN(lat)||lon===null||isNaN(lon)){showError('Seleccioná un lote con coordenadas válidas en el Dashboard.');return;}
  if(!siembra){showError('Ingresá la fecha de siembra del cultivo.');return;}
  if(siembra>today()){
    document.getElementById('plagas-content').innerHTML=
      '<div class="empty-box">Cultivo planificado para '+formatFecha(siembra)+'. Todavia no corresponde generar alarmas de presion de plagas; se activara automaticamente desde la fecha de siembra.</div>';
    return;
  }

  var btn=document.getElementById('btn-analizar-plagas');
  if(btn) btn.disabled=true;
  showLoading('Consultando datos climáticos y red comunitaria...');

  var archiveEnd=daysAgo(15);
  var needArchive=siembra<archiveEnd;
  var archiveP=needArchive?fetchClimateArchive(lat,lon,siembra,archiveEnd):Promise.resolve(null);
  var forecastP=fetchClimateForecast(lat,lon);
  var communityP=fetchCommunityReports(lat,lon,cultivo);
  var intaP=fetchIntaAlerts(lat,lon,cultivo);

  Promise.all([archiveP,forecastP,communityP,intaP]).then(function(results) {
    var archiveData=results[0], forecastData=results[1],
        communityReports=results[2], intaData=results[3];

    var dailySummaries=buildDailySummaries(forecastData);
    var cumGDD=calcCumGDD(archiveData,dailySummaries,siembra,cultivo);
    var stageResult=getStage(cumGDD,cultivo);
    stageResult.cumGDD=cumGDD;

    var histDays=dailySummaries.filter(function(d){return !d.isForecast;});
    var last7=histDays.slice(-7);
    var wSummary={
      tmean:last7.reduce(function(a,d){return a+d.tmean;},0)/last7.length,
      tmin:Math.min.apply(null,last7.map(function(d){return d.tmin;})),
      hrMean:last7.reduce(function(a,d){return a+d.hrMean;},0)/last7.length,
      precip:last7.reduce(function(a,d){return a+d.precip;},0)
    };

    var stageCode=stageResult.stage.code;
    var pestRisks=calcPestRisks(histDays,stageCode,cultivo);
    var forecast=calcForecastRisks(dailySummaries,stageCode,cultivo);

    renderMain({
      stageInfo:stageResult, wSummary:wSummary, pestRisks:pestRisks,
      forecastData:forecast, communityReports:communityReports,
      intaData:intaData, cultivo:cultivo, lat:lat, lon:lon
    });
  }).catch(function(err) {
    showError('Error al consultar datos: '+err.message);
  }).finally(function() {
    if(btn) btn.disabled=false;
  });
}

// ── PANEL ESTACIONAL DE PLAGAS ────────────────────────
// Muestra automáticamente las plagas a vigilar según el mes actual,
// el cultivo del lote activo y la zona detectada por coordenadas.
// Se llama desde nav.js al entrar al módulo — no requiere análisis completo.

var PLAGAS_ESTACIONAL = {
  soja: {
    // meses de actividad típica por plaga (Argentina)
    cogollera:        [10,11,12,1],
    anticarsia:       [11,12,1,2],
    chinche_cuernos:  [12,1,2,3],
    trips_soja:       [11,12,1,2],
  },
  maiz: {
    cogollero_maiz:   [10,11,12,1],
    diatraea:         [11,12,1,2,3],
    diabrotica:       [10,11,12],
  },
  trigo: {
    pulgon_verde:     [6,7,8,9],
    pulgon_amarillo:  [8,9,10],
    sitobion:         [9,10,11],
  },
  girasol: {
    helicoverpa:      [11,12,1],
    trips_girasol:    [10,11,12],
  },
};

window.plagasRenderEstacional = function() {
  var mes = new Date().getMonth() + 1; // 1-12

  // Lote activo
  var cultivoEl = document.getElementById('s-cultivo');
  var cultivo   = (cultivoEl ? cultivoEl.value : 'Soja').toLowerCase();
  if (!PLAGAS_ESTACIONAL[cultivo]) cultivo = 'soja';

  // Zona aproximada desde coordenadas
  var coordRaw = (document.getElementById('s-coord') || {}).value || '';
  var lat = null;
  if (coordRaw) { var p = coordRaw.replace(/\s/g,'').split(','); if (p.length >= 2) lat = parseFloat(p[0]); }
  var zonaLabel = lat === null ? '' :
    lat > -29 ? 'NOA' : lat > -32 ? 'NEA' :
    lat > -35 ? 'Pampeana Norte' : lat > -38 ? 'Pampeana Sur' : 'Semiárida';

  // Nombre del lote
  var loteNombre = '';
  var lote = loteActivoAM();
  if (lote) loteNombre = lote.nombre || '';

  var estacional = PLAGAS_ESTACIONAL[cultivo] || {};
  var plagasMes = Object.entries(estacional).filter(function(e){ return e[1].includes(mes); });

  // Buscar datos de la plaga en PESTS
  var pestsData = PESTS[cultivo] || [];
  var mesNombre = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][mes];

  if (plagasMes.length === 0) {
    document.getElementById('plagas-content').innerHTML =
      '<div style="background:rgba(74,140,92,.08);border:1px solid rgba(74,140,92,.2);border-radius:12px;padding:1.2rem 1.4rem;margin-top:.5rem">' +
      '<div style="font-size:.82rem;font-weight:700;color:var(--canopy);margin-bottom:.4rem">✅ ' + mesNombre + ' — Baja presión estacional para ' + cultivo.charAt(0).toUpperCase()+cultivo.slice(1) + '</div>' +
      '<div style="font-size:.75rem;color:rgba(255,255,255,.5)">No hay plagas de alto riesgo típicas para este cultivo en ' + mesNombre + '. Ingresá la fecha de siembra y hacé clic en "Analizar" para un diagnóstico climático completo.</div>' +
      '</div>';
    return;
  }

  var html = '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:1rem 1.2rem;margin-top:.5rem">';
  html += '<div style="font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:.8rem">';
  html += '🗓️ Plagas a vigilar en ' + mesNombre;
  if (zonaLabel) html += ' · ' + zonaLabel;
  html += ' · ' + cultivo.charAt(0).toUpperCase()+cultivo.slice(1);
  if (loteNombre) html += ' · <span style="color:rgba(122,174,245,.7)">' + loteNombre + '</span>';
  html += '</div>';
  html += '<div style="display:grid;gap:.6rem">';

  plagasMes.forEach(function(entry) {
    var id   = entry[0];
    var pest = pestsData.find(function(p){ return p.id === id; }) || { name: id, icon:'🐛', rec:{} };
    html += '<div style="display:flex;align-items:flex-start;gap:.8rem;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:.65rem .9rem">';
    html += '<span style="font-size:1.4rem;margin-top:.1rem">' + (pest.icon||'🐛') + '</span>';
    html += '<div style="flex:1">';
    html += '<div style="font-size:.82rem;font-weight:700;color:rgba(255,255,255,.88)">' + (pest.name||id) + '</div>';
    html += '<div style="font-size:.72rem;color:rgba(255,255,255,.45);margin-top:.15rem">';
    if (pest.sci) html += '<em>' + pest.sci + '</em> · ';
    html += 'Estadios críticos: ' + (pest.vuln ? pest.vuln.join(', ') : '—') + '</div>';
    if (pest.rec && pest.rec.med) {
      html += '<div style="font-size:.72rem;color:rgba(255,200,80,.8);margin-top:.3rem">' + pest.rec.med + '</div>';
    }
    html += '</div></div>';
  });

  html += '</div>';
  html += '<div style="margin-top:.8rem;font-size:.7rem;color:rgba(255,255,255,.3)">⚡ Vista rápida estacional — Ingresá la fecha de siembra y hacé clic en <strong>"Analizar"</strong> para diagnóstico climático completo con GDD y pronóstico.</div>';
  html += '</div>';

  document.getElementById('plagas-content').innerHTML = html;
};

  // Exposición a global
  window.selectSev = selectSev;
  window.enviarReporte = enviarReporte;
  window.amPlagasUtils = {
    calcPestRisks: calcPestRisks,
    stageInVuln: stageInVuln,
    PESTS: PESTS,
  };

})();
