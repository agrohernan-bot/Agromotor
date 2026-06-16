// ════════════════════════════════════════════════════════
// AGROMOTOR — alerta-sanitaria.js
// Evaluación de riesgo de enfermedades en tiempo real
// 14 patógenos · Soja / Maíz / Trigo / Girasol
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  function asEl(id) { return document.getElementById('as-' + id); }

  // ── FENOLOGÍA ─────────────────────────────────────────
  var PHENOLOGY = {
    soja: {
      base: 10, icon: '🫘',
      stages: [
        {gdd:0,   code:'VE', name:'Emergencia'},
        {gdd:120, code:'V2', name:'V2 – 2 nudos'},
        {gdd:280, code:'V4', name:'V4 – 4 nudos'},
        {gdd:450, code:'V6', name:'V6 – 6 nudos'},
        {gdd:600, code:'R1', name:'R1 – Inicio floración'},
        {gdd:720, code:'R2', name:'R2 – Floración plena'},
        {gdd:870, code:'R3', name:'R3 – Inicio vainas'},
        {gdd:1020,code:'R4', name:'R4 – Vainas llenas'},
        {gdd:1180,code:'R5', name:'R5 – Inicio llenado'},
        {gdd:1380,code:'R6', name:'R6 – Llenado pleno'},
        {gdd:1600,code:'R7', name:'R7 – Madurez fisiológica'}
      ]
    },
    maiz: {
      base: 10, icon: '🌽',
      stages: [
        {gdd:0,   code:'VE', name:'Emergencia'},
        {gdd:180, code:'V4', name:'V4'},
        {gdd:380, code:'V8', name:'V8'},
        {gdd:620, code:'V12',name:'V12'},
        {gdd:700, code:'VT', name:'VT – Emisión panoja'},
        {gdd:760, code:'R1', name:'R1 – Estigmas (silking)'},
        {gdd:900, code:'R2', name:'R2 – Ampolla'},
        {gdd:1060,code:'R3', name:'R3 – Lechoso'},
        {gdd:1260,code:'R4', name:'R4 – Pastoso'},
        {gdd:1480,code:'R5', name:'R5 – Dentado'},
        {gdd:1680,code:'R6', name:'R6 – Madurez fisiológica'}
      ]
    },
    trigo: {
      base: 0, icon: '🌾',
      stages: [
        {gdd:0,   code:'Z10',name:'Z10 – Emergencia'},
        {gdd:250, code:'Z21',name:'Z21 – Macollaje'},
        {gdd:500, code:'Z30',name:'Z30 – Encañazón'},
        {gdd:720, code:'Z45',name:'Z45 – Bota'},
        {gdd:900, code:'Z65',name:'Z65 – Antesis (floración)'},
        {gdd:1100,code:'Z75',name:'Z75 – Grano lechoso'},
        {gdd:1300,code:'Z87',name:'Z87 – Grano pastoso'},
        {gdd:1500,code:'Z92',name:'Z92 – Madurez fisiológica'}
      ]
    },
    girasol: {
      base: 6, icon: '🌻',
      stages: [
        {gdd:0,   code:'VE', name:'Emergencia'},
        {gdd:180, code:'V4', name:'V4'},
        {gdd:380, code:'V8', name:'V8'},
        {gdd:580, code:'R1', name:'R1 – Botón floral visible'},
        {gdd:740, code:'R5', name:'R5 – Inicio floración'},
        {gdd:900, code:'R6', name:'R6 – Floración plena'},
        {gdd:1100,code:'R8', name:'R8 – Formación aquenios'},
        {gdd:1350,code:'R9', name:'R9 – Madurez fisiológica'}
      ]
    }
  };

  // ── ENFERMEDADES ──────────────────────────────────────
  var DISEASES = {
    soja: [
      {
        id:'roya', name:'Roya Asiática', sci:'Phakopsora pachyrhizi', icon:'🍂',
        vuln:['R1','R2','R3','R4','R5','R6'],
        check: function(d){ return d.tmean>=15 && d.tmean<=28 && d.hoursHR75>=6; },
        checkForecast: function(d){
          if(d.tmean>=22 && d.tmean<=28 && d.hoursHR75>=8) return 'high';
          if(d.tmean>=15 && d.tmean<=28 && d.hoursHR75>=4) return 'med';
          return 'none';
        },
        reasons:{ fav:'Temperatura 15–28 °C con HR > 75 % por ≥ 6 h/día', unfav:'Sin horas suficientes de alta humedad relativa' },
        rec:{ high:'⚠️ Aplicar fungicida preventivo de inmediato — cultivo en ventana crítica', med:'👁 Monitorear cada 3–4 días y estar listo para aplicar', low:'✅ Sin acción requerida — continuar monitoreo semanal', none:'✅ Sin riesgo — condiciones desfavorables para el patógeno' }
      },
      {
        id:'cercospora', name:'Mancha Ojo de Rana', sci:'Cercospora sojina', icon:'🟤',
        vuln:['R3','R4','R5','R6','R7'],
        check: function(d){ return d.tmean>=20 && d.tmean<=30 && d.hoursHR80>=8; },
        checkForecast: function(d){
          if(d.tmean>=22 && d.tmean<=30 && d.hoursHR80>=10) return 'high';
          if(d.tmean>=20 && d.tmean<=30 && d.hoursHR80>=6)  return 'med';
          return 'none';
        },
        reasons:{ fav:'T° 20–30 °C con HR > 80 % por ≥ 8 h/día', unfav:'Humedad insuficiente o temperatura fuera de rango' },
        rec:{ high:'⚠️ Aplicar fungicida — condiciones óptimas para infección', med:'👁 Monitorear manchas en hojas bajas', low:'✅ Sin acción', none:'✅ Sin riesgo' }
      },
      {
        id:'muerte_subita', name:'Muerte Súbita', sci:'Fusarium virguliforme', icon:'⚫',
        vuln:['VE','V2','V4','V6'],
        check: function(d){ return d.tmean>=12 && d.tmean<=20 && d.precip>=5; },
        checkForecast: function(d){
          if(d.tmean>=14 && d.tmean<=18 && d.precip>=8) return 'high';
          if(d.tmean>=12 && d.tmean<=20 && d.precip>=3) return 'med';
          return 'none';
        },
        reasons:{ fav:'Suelo frío y húmedo — condición de infección en raíces', unfav:'Temperatura o humedad fuera del rango de infección' },
        rec:{ high:'⚠️ Evaluar semilla tratada; no hay control curativo disponible', med:'👁 Observar síntomas de clorosis intervenal', low:'✅ Sin acción', none:'✅ Sin riesgo' }
      },
      {
        id:'tizon_hoja', name:'Tizón de la Hoja', sci:'Septoria glycines', icon:'🟡',
        vuln:['V4','V6','R1','R2','R3'],
        check: function(d){ return d.tmean>=20 && d.tmean<=30 && d.precip>=2; },
        checkForecast: function(d){
          if(d.tmean>=22 && d.precip>=5 && d.hoursHR80>=8) return 'high';
          if(d.tmean>=20 && d.precip>=2) return 'med';
          return 'none';
        },
        reasons:{ fav:'Lluvias frecuentes con temperatura cálida', unfav:'Sin precipitaciones relevantes' },
        rec:{ high:'⚠️ Considerar fungicida — especialmente si hay roya simultánea', med:'👁 Monitorear follaje', low:'✅ Sin acción', none:'✅ Sin riesgo' }
      }
    ],
    maiz: [
      {
        id:'tizon_norte', name:'Tizón del Norte', sci:'Exserohilum turcicum', icon:'🍃',
        vuln:['V8','V12','VT','R1','R2'],
        check: function(d){ return d.tmean>=18 && d.tmean<=27 && d.hoursHR90>=6; },
        checkForecast: function(d){
          if(d.tmean>=20 && d.tmean<=27 && d.hoursHR90>=10) return 'high';
          if(d.tmean>=18 && d.tmean<=27 && d.hoursHR90>=5)  return 'med';
          return 'none';
        },
        reasons:{ fav:'T° 18–27 °C con alta humedad ≥ 6 h/día', unfav:'Humedad insuficiente' },
        rec:{ high:'⚠️ Aplicar fungicida — ventana V8-R2 es crítica', med:'👁 Monitorear lesiones cigáricas en hojas medias', low:'✅ Sin acción', none:'✅ Sin riesgo' }
      },
      {
        id:'roya_comun', name:'Roya Común', sci:'Puccinia sorghi', icon:'🟠',
        vuln:['V8','VT','R1','R2','R3'],
        check: function(d){ return d.tmean>=16 && d.tmean<=23 && d.hoursHR90>=12; },
        checkForecast: function(d){
          if(d.tmean>=16 && d.tmean<=23 && d.hoursHR90>=14) return 'high';
          if(d.tmean>=16 && d.tmean<=25 && d.hoursHR90>=8)  return 'med';
          return 'none';
        },
        reasons:{ fav:'Noches frescas y húmedas (T° 16–23 °C, HR > 90 % ≥ 12 h)', unfav:'Temperatura alta o baja humedad nocturna' },
        rec:{ high:'⚠️ Aplicar fungicida — especialmente en híbridos susceptibles', med:'👁 Monitorear pústulas anaranjadas en hojas', low:'✅ Sin acción', none:'✅ Sin riesgo' }
      },
      {
        id:'mancha_gris', name:'Mancha Gris', sci:'Cercospora zeae-maydis', icon:'⚪',
        vuln:['R1','R2','R3','R4'],
        check: function(d){ return d.tmean>=22 && d.tmean<=30 && d.hoursHR90>=12; },
        checkForecast: function(d){
          if(d.tmean>=24 && d.hoursHR90>=14) return 'high';
          if(d.tmean>=22 && d.hoursHR90>=10) return 'med';
          return 'none';
        },
        reasons:{ fav:'Días cálidos con noches muy húmedas', unfav:'Condiciones no favorables' },
        rec:{ high:'⚠️ Aplicar fungicida — lote con antecedentes de la enfermedad', med:'👁 Observar lesiones rectangulares en hojas', low:'✅ Sin acción', none:'✅ Sin riesgo' }
      }
    ],
    trigo: [
      {
        id:'fusarium', name:'Fusariosis de la Espiga', sci:'Fusarium graminearum', icon:'🌾',
        vuln:['Z65','Z75'],
        check: function(d){ return d.tmean>=15 && d.tmean<=30 && (d.precip>=2 || d.hoursHR90>=8); },
        checkForecast: function(d){
          if(d.tmean>=20 && d.tmean<=28 && (d.precip>=5 || d.hoursHR90>=10)) return 'high';
          if(d.tmean>=15 && (d.precip>=2 || d.hoursHR90>=6)) return 'med';
          return 'none';
        },
        reasons:{ fav:'Lluvia/humedad durante antesis — ventana de infección crítica de 72 h', unfav:'Sin lluvias durante floración' },
        rec:{ high:'⚠️ Aplicar fungicida en Z65 de manera urgente — sin segunda oportunidad', med:'👁 Estar listo para aplicar ante lluvia durante floración', low:'✅ Sin acción', none:'✅ Condiciones secas favorables' }
      },
      {
        id:'roya_hoja', name:'Roya de la Hoja', sci:'Puccinia triticina', icon:'🟫',
        vuln:['Z30','Z45','Z65','Z75'],
        check: function(d){ return d.tmean>=10 && d.tmean<=30 && d.hoursHR90>=4; },
        checkForecast: function(d){
          if(d.tmean>=15 && d.tmean<=25 && d.hoursHR90>=8) return 'high';
          if(d.tmean>=10 && d.tmean<=30 && d.hoursHR90>=4) return 'med';
          return 'none';
        },
        reasons:{ fav:'Rocío frecuente con temperatura 10–30 °C', unfav:'Baja humedad foliar' },
        rec:{ high:'⚠️ Aplicar fungicida antes de Z65', med:'👁 Monitorear pústulas anaranjadas en hojas bandera', low:'✅ Sin acción', none:'✅ Sin riesgo' }
      },
      {
        id:'septoriosis', name:'Septoriosis', sci:'Zymoseptoria tritici', icon:'🟤',
        vuln:['Z30','Z45','Z65'],
        check: function(d){ return d.tmean>=10 && d.tmean<=25 && d.precip>=0.5 && d.hoursHR80>=8; },
        checkForecast: function(d){
          if(d.tmean>=12 && d.tmean<=22 && d.precip>=2 && d.hoursHR80>=10) return 'high';
          if(d.tmean>=10 && d.precip>=0.5 && d.hoursHR80>=6) return 'med';
          return 'none';
        },
        reasons:{ fav:'Lluvia con alta humedad foliar y T° moderada', unfav:'Condiciones poco favorables' },
        rec:{ high:'⚠️ Aplicar fungicida — ciclo de 20 días desde infección a síntomas', med:'👁 Monitorear manchas con halo clorótico', low:'✅ Sin acción', none:'✅ Sin riesgo' }
      },
      {
        id:'oidio', name:'Oídio', sci:'Blumeria graminis', icon:'⬜',
        vuln:['Z21','Z30','Z45'],
        check: function(d){ return d.tmean>=10 && d.tmean<=25 && d.hrMean>=70 && d.precip<5; },
        checkForecast: function(d){
          if(d.tmean>=15 && d.tmean<=22 && d.hrMean>=75 && d.precip<2) return 'high';
          if(d.tmean>=10 && d.tmean<=25 && d.hrMean>=70 && d.precip<5) return 'med';
          return 'none';
        },
        reasons:{ fav:'Humedad moderada sin lluvias — no necesita mojadura foliar', unfav:'Temperatura fuera de rango o sin humedad suficiente' },
        rec:{ high:'⚠️ Aplicar fungicida — observar polvo blanco en hojas y vainas', med:'👁 Monitorear en canopeo denso y baja luminosidad', low:'✅ Sin acción', none:'✅ Sin riesgo' }
      }
    ],
    girasol: [
      {
        id:'sclerotinia', name:'Sclerotinia', sci:'Sclerotinia sclerotiorum', icon:'🌻',
        vuln:['R5','R6'],
        check: function(d){ return d.tmean>=10 && d.tmean<=25 && d.hoursHR80>=8; },
        checkForecast: function(d){
          if(d.tmean>=12 && d.tmean<=22 && d.hoursHR80>=12 && d.precip>=2) return 'high';
          if(d.tmean>=10 && d.tmean<=25 && d.hoursHR80>=8) return 'med';
          return 'none';
        },
        reasons:{ fav:'Alta humedad durante floración — infección vía pétalos caídos', unfav:'Condiciones secas durante floración' },
        rec:{ high:'⚠️ Aplicar fungicida apical en R5 — única ventana de control eficaz', med:'👁 Monitorear marchitamiento apical y lesiones acuosas', low:'✅ Sin acción', none:'✅ Condiciones no favorables' }
      },
      {
        id:'mildiu', name:'Mildiu', sci:'Plasmopara halstedii', icon:'🟢',
        vuln:['VE','V4'],
        check: function(d){ return d.tmean>=10 && d.tmean<=20 && d.precip>=3; },
        checkForecast: function(d){
          if(d.tmean>=12 && d.tmean<=18 && d.precip>=6) return 'high';
          if(d.tmean>=10 && d.tmean<=20 && d.precip>=3) return 'med';
          return 'none';
        },
        reasons:{ fav:'Lluvias con temperatura fresca en implantación', unfav:'Sin lluvias o temperatura alta' },
        rec:{ high:'⚠️ Evaluar semilla tratada con metalaxil; no hay control foliar curativo', med:'👁 Observar plántulas con hojas pálidas y envés blanquecino', low:'✅ Sin acción', none:'✅ Sin riesgo' }
      }
    ]
  };

  var MOJADURA_DEPENDENT = ['roya','cercospora','tizon_hoja','fusarium','roya_hoja','septoriosis','sclerotinia','tizon_norte'];

  // ── UTILIDADES ────────────────────────────────────────
  function todayStr() { return new Date().toISOString().slice(0,10); }
  function daysAgo(n) { var d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
  function riskClass(s){ return s>=65?'high':s>=35?'med':s>0?'low':'none'; }
  function riskLabel(rc){ return {high:'RIESGO ALTO',med:'RIESGO MEDIO',low:'RIESGO BAJO',none:'SIN RIESGO'}[rc]||'SIN DATOS'; }
  function stageInVuln(code,arr){ return arr.indexOf(code)!==-1; }

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
    }
    catch(e) { return null; }
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
  function fechaSiembraLoteAM(lote,cultivo) {
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
  function setContextoAS(lote,cultivo,fecha,coords) {
    var form = document.getElementById('as-input-card');
    var ctx = document.getElementById('as-contexto-lote');
    if (form) form.style.display = 'none';
    if (!ctx) return;
    ctx.innerHTML = '<div class="as-auto-context"><div class="as-auto-title">Contexto heredado del lote</div>'
      + '<div class="as-auto-chips">'
      + '<span>' + (lote ? lote.nombre : 'Lote activo') + '</span>'
      + '<span>' + (cultivo || '-') + '</span>'
      + '<span>Siembra ' + (fecha || '-') + '</span>'
      + '<span>' + (coords ? coords.lat.toFixed(4) + ', ' + coords.lon.toFixed(4) : '-') + '</span>'
      + '</div></div>';
  }
  window.asPrepararAutoLote = function() {
    var lote = loteActivoAM();
    var d = (lote && lote.data) || {};
    var ck = d.calcKeys || {};
    var cultivo = normCultivoAM(d.cultivo || ck['am_siembra_cultivo'] || (document.getElementById('s-cultivo') || {}).value || 'soja');
    if (!DISEASES[cultivo]) cultivo = 'soja';
    var coords = coordsLoteAM(lote);
    var fecha = fechaSiembraLoteAM(lote,cultivo) || (document.getElementById('s-fecha') || {}).value || '';
    if (coords) {
      if (asEl('lat')) asEl('lat').value = coords.lat.toFixed(5);
      if (asEl('lon')) asEl('lon').value = coords.lon.toFixed(5);
    }
    if (asEl('cultivo')) asEl('cultivo').value = cultivo;
    if (asEl('siembra') && fecha) asEl('siembra').value = fecha;
    setContextoAS(lote,cultivo,fecha,coords);
  };

  // ── APIs ──────────────────────────────────────────────
  function fetchArchive(lat,lon,start,end){
    return fetch('https://archive-api.open-meteo.com/v1/archive?latitude='+lat+'&longitude='+lon
      +'&start_date='+start+'&end_date='+end
      +'&daily=temperature_2m_max,temperature_2m_min'
      +'&timezone=America%2FArgentina%2FBuenos_Aires').then(function(r){return r.json();});
  }
  function fetchForecast(lat,lon){
    return fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon
      +'&hourly=temperature_2m,relative_humidity_2m,precipitation,dew_point_2m'
      +'&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_max'
      +'&past_days=14&forecast_days=7'
      +'&timezone=America%2FArgentina%2FBuenos_Aires').then(function(r){return r.json();});
  }

  // ── PROCESAMIENTO ─────────────────────────────────────
  function buildDailySummaries(hourly){
    var times=hourly.hourly.time, temps=hourly.hourly.temperature_2m,
        rhs=hourly.hourly.relative_humidity_2m, precips=hourly.hourly.precipitation;
    var today=todayStr(), byDay={};
    for(var i=0;i<times.length;i++){
      var day=times[i].slice(0,10);
      if(!byDay[day]) byDay[day]={temps:[],rhs:[],precip:0,isForecast:day>today};
      byDay[day].temps.push(temps[i]);
      byDay[day].rhs.push(rhs[i]);
      byDay[day].precip+=(precips[i]||0);
    }
    return Object.keys(byDay).sort().map(function(d){
      var e=byDay[d],tArr=e.temps,rArr=e.rhs;
      var tmean=tArr.reduce(function(a,b){return a+b;},0)/tArr.length;
      var hrMean=rArr.reduce(function(a,b){return a+b;},0)/rArr.length;
      return {
        date:d, isForecast:e.isForecast,
        tmax:Math.max.apply(null,tArr), tmin:Math.min.apply(null,tArr),
        tmean:tmean, hrMean:hrMean, hrMax:Math.max.apply(null,rArr),
        hoursHR75:rArr.filter(function(v){return v>75;}).length,
        hoursHR80:rArr.filter(function(v){return v>80;}).length,
        hoursHR90:rArr.filter(function(v){return v>90;}).length,
        precip:e.precip
      };
    });
  }

  function calcGDD(tmax,tmin,base){ return Math.max(0,((tmax+tmin)/2)-base); }

  function calcCumGDD(archiveData,summaries,siembra,cultivo){
    var base=PHENOLOGY[cultivo].base, cum=0;
    if(archiveData&&archiveData.daily){
      var d=archiveData.daily;
      for(var i=0;i<d.time.length;i++){
        if(d.time[i]>=siembra) cum+=calcGDD(d.temperature_2m_max[i],d.temperature_2m_min[i],base);
      }
    }
    summaries.forEach(function(s){ if(!s.isForecast&&s.date>=siembra) cum+=calcGDD(s.tmax,s.tmin,base); });
    return Math.round(cum);
  }

  function getStage(cumGDD,cultivo){
    var stages=PHENOLOGY[cultivo].stages, stage=stages[0];
    for(var i=stages.length-1;i>=0;i--){ if(cumGDD>=stages[i].gdd){stage=stages[i];break;} }
    var maxGDD=stages[stages.length-1].gdd;
    return {stage:stage, pct:Math.min(100,Math.round((cumGDD/maxGDD)*100)), maxGDD:maxGDD};
  }

  function daysSinceRain(histDays,threshold){
    threshold=threshold||1.0;
    var today=todayStr();
    var sorted=histDays.slice().sort(function(a,b){return a.date>b.date?1:-1;});
    for(var i=sorted.length-1;i>=0;i--){
      if(sorted[i].precip>=threshold){
        var diff=(new Date(today+'T12:00:00')-new Date(sorted[i].date+'T12:00:00'))/(1000*60*60*24);
        return Math.round(diff);
      }
    }
    return null;
  }

  function mojMult(dsr){
    if(dsr===null) return 0.8;
    if(dsr<=1) return 1.35; if(dsr<=3) return 1.15; if(dsr<=7) return 1.0;
    if(dsr<=14) return 0.85; return 0.75;
  }

  var DISEASE_SEASON = {
    roya:[12,1,2,3], cercospora:[1,2,3,4], muerte_subita:[10,11,12,1], tizon_hoja:[12,1,2,3],
    tizon_norte:[11,12,1,2,3], roya_comun:[11,12,1,2], mancha_gris:[12,1,2,3],
    fusarium:[9,10,11], roya_hoja:[7,8,9,10,11], septoriosis:[6,7,8,9,10], oidio:[6,7,8,9],
    sclerotinia:[11,12,1], roya_girasol:[11,12,1], alternaria:[12,1,2]
  };

  function diseaseInSeason(dis,dateStr) {
    var months=DISEASE_SEASON[dis.id];
    if(!months||!months.length) return true;
    var d=dateStr?new Date(dateStr+'T12:00:00'):new Date();
    return months.indexOf(d.getMonth()+1)>=0;
  }

  function calcDiseaseRisks(histDays,stageCode,cultivo){
    var diseases=DISEASES[cultivo], recent7=histDays.slice(-7);
    var dsr=daysSinceRain(histDays,1.0);
    return diseases.map(function(dis){
      var favDays=recent7.filter(function(d){return dis.check(d);}).length;
      var raw=(favDays/7)*100;
      var usesMoj=MOJADURA_DEPENDENT.indexOf(dis.id)!==-1;
      if(usesMoj) raw=Math.min(100,raw*mojMult(dsr));
      var inVuln=stageInVuln(stageCode,dis.vuln);
      var inSeason=diseaseInSeason(dis);
      var score=(inVuln&&inSeason)?raw:0;
      var rc=riskClass(score);
      var reason=favDays>=3?dis.reasons.fav+' ('+favDays+'/7 días favorables)'
        :favDays>=1?dis.reasons.fav+' ('+favDays+'/7 días — leve)':dis.reasons.unfav;
      if(!inSeason) reason='Fuera de epoca sanitaria esperada para este patogeno. Se informa como vigilancia, sin alarma.';
      else if(!inVuln) reason='Cultivo fuera de la ventana vulnerable ('+dis.vuln.join(', ')+'). Se informa como vigilancia, sin alarma.';
      return {id:dis.id,name:dis.name,sci:dis.sci,icon:dis.icon,score:Math.round(score),
        riskClass:rc,favorableDays:favDays,inVuln:inVuln,inSeason:inSeason,usesMojadura:usesMoj,
        reason:reason,rec:dis.rec[rc]||dis.rec['none'],vulnStages:dis.vuln};
    });
  }

  function calcForecastRisks(allDays,stageCode,cultivo){
    var diseases=DISEASES[cultivo];
    var fDays=allDays.filter(function(d){return d.isForecast;}).slice(0,7);
    var rows=diseases.map(function(dis){
      return {id:dis.id,name:dis.name,sci:dis.sci,
        dayRisks:fDays.map(function(fd){
          var raw=dis.checkForecast(fd);
          var inVuln=stageInVuln(stageCode,dis.vuln);
          var inSeason=diseaseInSeason(dis,fd.date);
          var rc=(inVuln&&inSeason)?raw:'none';
          return {date:fd.date,rc:rc};
        })
      };
    });
    return {diseases:rows,forecastDays:fDays};
  }

  // ── RENDER ────────────────────────────────────────────
  var CONTENT_ID = 'as-main-content';

  function setContent(html){ var el=document.getElementById(CONTENT_ID); if(el) el.innerHTML=html; }

  function showLoading(msg){
    setContent('<div class="as-loading"><div class="as-spinner">🔬</div><div class="as-loading-text">'+(msg||'Analizando condiciones sanitarias...')+'</div></div>');
  }
  function showError(msg){
    setContent('<div class="as-error-box">⚠️ '+msg+'</div>');
  }

  function renderMain(stageInfo,wSummary,risks,dsr,forecast,cultivo){
    var stage=stageInfo.stage, icon=PHENOLOGY[cultivo].icon;
    var multVal=mojMult(dsr);
    var multColor=multVal>1.1?'var(--as-high)':multVal>1.0?'var(--as-med)':multVal<0.9?'#888':'var(--as-leaf)';

    var rainLabel=dsr===null?'>14d':dsr===0?'hoy':dsr+'d';
    var rainNote=dsr===null?'Sin lluvia significativa en 14 días'
      :dsr===0?'Llovió hoy — follaje muy húmedo'
      :dsr===1?'Llovió ayer — follaje todavía húmedo'
      :'Última lluvia hace '+dsr+' días';
    var multDesc=multVal>=1.35?'riesgo de mojadura aumentado significativamente'
      :multVal>=1.15?'riesgo de mojadura aumentado levemente'
      :multVal<=0.85?'riesgo reducido por canopeo seco':'sin corrección';

    var countHigh=risks.filter(function(d){return d.riskClass==='high';}).length;
    var countMed =risks.filter(function(d){return d.riskClass==='med';}).length;
    var countLow =risks.filter(function(d){return d.riskClass==='low'||d.riskClass==='none';}).length;

    var h='<div class="as-results">';
    // Columna izquierda
    h+='<div>';

    // Weather strip
    h+='<div class="as-weather-strip">';
    h+='<div class="as-weather-item"><span class="as-w-val">'+Math.round(wSummary.tmean)+'°C</span><span class="as-w-lbl">T° Media</span></div>';
    h+='<div class="as-weather-item"><span class="as-w-val">'+Math.round(wSummary.tmax)+'°C</span><span class="as-w-lbl">T° Máx</span></div>';
    h+='<div class="as-weather-item"><span class="as-w-val">'+Math.round(wSummary.hrMean)+'%</span><span class="as-w-lbl">HR Media</span></div>';
    h+='<div class="as-weather-item"><span class="as-w-val">'+wSummary.precip.toFixed(0)+'mm</span><span class="as-w-lbl">Lluvia 7d</span></div>';
    h+='<div class="as-weather-item"><span class="as-w-val">💧 '+rainLabel+'</span><span class="as-w-lbl">Últ. lluvia</span></div>';
    h+='</div>';

    // Disease cards
    h+='<div class="as-section-title">Estado actual — últimos 7 días</div>';
    risks.forEach(function(dis){
      var dc='as-dc-'+dis.riskClass;
      h+='<div class="as-disease-card '+dc+'">';
      h+='<div class="as-dc-header"><div class="as-dc-left">';
      h+='<div class="as-dc-name">'+dis.icon+' '+dis.name+'</div>';
      h+='<div class="as-dc-sci">'+dis.sci+'</div></div>';
      h+='<div class="as-risk-badge as-rb-'+dis.riskClass+'">'+riskLabel(dis.riskClass)+'</div>';
      h+='</div>';
      h+='<div class="as-score-bar"><div class="as-score-fill" style="width:'+dis.score+'%"></div></div>';
      h+='<div class="as-dc-reason">'+dis.reason;
      if(dis.usesMojadura&&multVal!==1.0){
        var mojTxt=multVal>1.0
          ?'💧 Corrección mojadura foliar (+'+Math.round((multVal-1)*100)+'%)'
          :'💧 Canopeo seco — corrección a la baja ('+Math.round((multVal-1)*100)+'%)';
        h+='<br><span style="color:'+multColor+';font-size:.65rem">'+mojTxt+'</span>';
      }
      if(!dis.inSeason){
        h+='<br><span class="as-feno-warn">Fuera de epoca sanitaria esperada - sin alarma</span>';
      } else if(!dis.inVuln){
        h+='<br><span class="as-feno-warn">⏱ Cultivo fuera de la ventana vulnerable - sin alarma ('+dis.vulnStages.join(', ')+')</span>';
      }
      h+='</div>';
      h+='<div class="as-dc-rec">'+dis.rec+'</div></div>';
    });

    // Heatmap
    var fDays=forecast.forecastDays;
    h+='<div class="as-section-title">Pronóstico — próximos 7 días</div>';
    if(fDays.length>0){
      h+='<div class="as-forecast-wrap">';
      h+='<div class="as-fh-inner"><div class="as-fh-label">Enfermedad</div>';
      var dias=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
      fDays.forEach(function(fd){
        var p=fd.date.split('-');
        h+='<div class="as-fh-day">'+dias[new Date(fd.date+'T12:00:00').getDay()]+'<span>'+p[2]+'/'+p[1]+'</span></div>';
      });
      h+='</div>';
      forecast.diseases.forEach(function(fd2){
        h+='<div class="as-forecast-row"><div class="as-fr-disease">'+fd2.name+'<span class="as-fr-sci">'+fd2.sci+'</span></div>';
        fd2.dayRisks.forEach(function(dr){
          var dot=dr.rc==='high'?'▲':dr.rc==='med'?'◆':dr.rc==='low'?'●':'·';
          h+='<div class="as-fr-cell"><div class="as-fr-dot as-risk-'+dr.rc+'">'+dot+'</div></div>';
        });
        h+='</div>';
      });
      h+='</div>';
      h+='<div class="as-legend">';
      h+='<div class="as-legend-item"><div class="as-legend-dot" style="background:var(--as-high-bg);border:1px solid var(--as-high-bd)"></div> Alto</div>';
      h+='<div class="as-legend-item"><div class="as-legend-dot" style="background:var(--as-med-bg);border:1px solid var(--as-med-bd)"></div> Medio</div>';
      h+='<div class="as-legend-item"><div class="as-legend-dot" style="background:var(--as-low-bg);border:1px solid var(--as-low-bd)"></div> Bajo</div>';
      h+='<div class="as-legend-item"><div class="as-legend-dot" style="background:var(--as-none-bg);border:1px solid var(--as-none-bd)"></div> Sin riesgo</div>';
      h+='</div>';
    }
    h+='</div>'; // cierra columna izquierda

    // Columna derecha: fenología + resumen
    h+='<div class="as-side-panel">';

    // Rain note
    h+='<div class="as-rain-note" style="color:'+multColor+'">💧 '+rainNote+' — '+multDesc+'</div>';

    // Fenología
    h+='<div class="as-feno-card">';
    h+='<div class="as-feno-icon">'+icon+'</div>';
    h+='<div class="as-feno-info">';
    h+='<div class="as-feno-cultivo">'+cultivo.toUpperCase()+'</div>';
    h+='<div class="as-feno-estado">'+stage.code+' — '+stage.name+'</div>';
    h+='<div class="as-feno-gdd">'+stageInfo.cumGDD+' GDD acumulados (base '+PHENOLOGY[cultivo].base+'°C)</div>';
    h+='<div class="as-feno-bar"><div class="as-feno-fill" style="width:'+stageInfo.pct+'%"></div></div>';
    h+='</div></div>';

    // Summary strip
    h+='<div class="as-summary-strip">';
    h+='<div class="as-summary-item as-si-high"><div class="as-si-count">'+countHigh+'</div><div class="as-si-label">Riesgo Alto</div></div>';
    h+='<div class="as-summary-item as-si-med"><div class="as-si-count">'+countMed+'</div><div class="as-si-label">Riesgo Medio</div></div>';
    h+='<div class="as-summary-item as-si-low"><div class="as-si-count">'+countLow+'</div><div class="as-si-label">Sin riesgo</div></div>';
    h+='</div>';

    h+='</div>'; // cierra side panel
    h+='</div>'; // cierra as-results

    setContent(h);
  }

  // ── ANALIZAR ──────────────────────────────────────────
  function analizar(){
    if (typeof window.asPrepararAutoLote === 'function') window.asPrepararAutoLote();
    var lat     = parseFloat((asEl('lat')||{}).value);
    var lon     = parseFloat((asEl('lon')||{}).value);
    var cultivo = (asEl('cultivo')||{}).value;
    var siembra = (asEl('siembra')||{}).value;

    if(isNaN(lat)||isNaN(lon)){ showError('Ingresá coordenadas válidas.'); return; }
    if(!siembra){ showError('Ingresá la fecha de siembra.'); return; }
    if(siembra>todayStr()){
      setContent('<div class="as-error-box">Cultivo planificado para '+siembra+'. Todavia no corresponde generar alarmas sanitarias; se activara automaticamente desde la fecha de siembra.</div>');
      return;
    }

    var btn=asEl('btn-analizar');
    if(btn) btn.disabled=true;
    showLoading('Consultando datos climáticos Open-Meteo...');

    var archiveEnd=daysAgo(15);
    var needArchive=siembra<archiveEnd;
    var archiveP=needArchive?fetchArchive(lat,lon,siembra,archiveEnd):Promise.resolve(null);

    Promise.all([archiveP, fetchForecast(lat,lon)])
      .then(function(res){
        var archiveData=res[0], forecastData=res[1];
        showLoading('Calculando fenología y riesgo sanitario...');
        var summaries=buildDailySummaries(forecastData);
        var cumGDD=calcCumGDD(archiveData,summaries,siembra,cultivo);
        var stageResult=getStage(cumGDD,cultivo);
        stageResult.cumGDD=cumGDD;
        var histDays=summaries.filter(function(d){return !d.isForecast;});
        var last7=histDays.slice(-7);
        var wSummary={
          tmean:last7.reduce(function(a,d){return a+d.tmean;},0)/last7.length,
          tmax:Math.max.apply(null,last7.map(function(d){return d.tmax;})),
          hrMean:last7.reduce(function(a,d){return a+d.hrMean;},0)/last7.length,
          precip:last7.reduce(function(a,d){return a+d.precip;},0)
        };
        var dsr=daysSinceRain(histDays,1.0);
        var risks=calcDiseaseRisks(histDays,stageResult.stage.code,cultivo);
        var forecast=calcForecastRisks(summaries,stageResult.stage.code,cultivo);
        renderMain(stageResult,wSummary,risks,dsr,forecast,cultivo);
      })
      .catch(function(err){
        showError('Error al consultar datos climáticos: '+err.message);
        console.error(err);
      })
      .finally(function(){
        if(btn) btn.disabled=false;
      });
  }

  // ── INIT (llamado desde nav.js al activar el módulo) ──
  window.asInit = function(){
    // Auto-poblar desde el motor
    var coord = (document.getElementById('s-coord')||{}).value || '';
    if(coord){
      var parts=coord.split(',').map(function(p){return parseFloat(p.trim());});
      if(parts.length===2&&!isNaN(parts[0])&&!isNaN(parts[1])){
        var latEl=asEl('lat'), lonEl=asEl('lon');
        if(latEl) latEl.value=parts[0].toFixed(4);
        if(lonEl) lonEl.value=parts[1].toFixed(4);
      }
    }
    var cultEl=asEl('cultivo');
    if(cultEl){
      var cultMotor=(document.getElementById('s-cultivo')||{}).value||'';
      var cultMap={soja:'soja',maiz:'maiz','maíz':'maiz',trigo:'trigo',girasol:'girasol'};
      var mapped=cultMap[cultMotor.toLowerCase()];
      if(mapped) cultEl.value=mapped;
    }
    var fechaEl=asEl('siembra');
    if(fechaEl){
      var fMotor=(document.getElementById('s-fecha')||{}).value||'';
      if(fMotor) fechaEl.value=fMotor;
      else if(!fechaEl.value){
        var d=new Date(); d.setDate(d.getDate()-90);
        fechaEl.value=d.toISOString().slice(0,10);
      }
    }
    if (typeof window.asPrepararAutoLote === 'function') window.asPrepararAutoLote();
  };

  window.asAnalizar = analizar;
  window.asUtils = {
    calcDiseaseRisks: calcDiseaseRisks,
    stageInVuln: stageInVuln,
    DISEASES: DISEASES,
  };

})();
