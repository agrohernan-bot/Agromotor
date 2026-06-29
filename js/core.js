// ════════════════════════════════════════════════════════
// AGROMOTOR — core.js
// Helpers compartidos, constantes globales y estado base
// Cargado primero — disponible para todos los módulos
// ════════════════════════════════════════════════════════


// ── HELPERS ──
(function() {
  window.AM = window.AM || {};
  window.AM.core = {};

const $=id=>document.getElementById(id);
function sv(id,val){const e=$(id);if(e)e.textContent=val}
function gv(id){return $(id)?.value}
function gi(id){return parseFloat($(id)?.value)||0}
function setR(id,val,dec=0){const e=$(id);if(!e)return;e.value=Math.round(val*10**dec)/10**dec;e.dispatchEvent(new Event('input'))}

// ── DB ──
const DB={
  hum:{
    Molisol:{Maíz:{n:18,i:24,x:32},Soja:{n:16,i:22,x:30},Girasol:{n:18,i:24,x:30},Trigo:{n:15,i:20,x:28},Cebada:{n:15,i:20,x:28},Sorgo:{n:18,i:24,x:32},Colza:{n:15,i:19,x:25}},
    Vertisol:{Maíz:{n:20,i:28,x:36},Soja:{n:18,i:26,x:34},Girasol:{n:20,i:28,x:36},Trigo:{n:18,i:26,x:34},Cebada:{n:18,i:25,x:32},Sorgo:{n:20,i:28,x:36},Colza:{n:18,i:25,x:32}},
    Alfisol:{Maíz:{n:16,i:22,x:30},Soja:{n:15,i:21,x:28},Girasol:{n:16,i:22,x:30},Trigo:{n:15,i:21,x:28},Cebada:{n:15,i:20,x:28},Sorgo:{n:16,i:22,x:30},Colza:{n:15,i:19,x:25}},
    Entisol:{Maíz:{n:14,i:20,x:28},Soja:{n:12,i:18,x:26},Girasol:{n:14,i:20,x:28},Trigo:{n:12,i:18,x:26},Cebada:{n:12,i:18,x:26},Sorgo:{n:14,i:20,x:28},Colza:{n:12,i:17,x:25}},
    Oxisol:{Maíz:{n:16,i:22,x:30},Soja:{n:15,i:21,x:28},Girasol:{n:16,i:22,x:30},Trigo:{n:15,i:21,x:28},Cebada:{n:15,i:21,x:28},Sorgo:{n:16,i:22,x:30},Colza:{n:15,i:19,x:25}},
  },
  suelo:{Molisol:{cc:34,pm:12,da:1.3},Vertisol:{cc:36,pm:20,da:1.35},Alfisol:{cc:36,pm:16,da:1.4},Entisol:{cc:10,pm:2,da:1.5},Oxisol:{cc:26,pm:10,da:1.2}},
  tMin:{Maíz:10,Soja:12,Girasol:8,Trigo:4,Cebada:4,Sorgo:15,Colza:5},
  tId:{Maíz:18,Soja:20,Girasol:14,Trigo:10,Cebada:8,Sorgo:20,Colza:10},
  prof:{
    Molisol:{Maíz:[3,5,8],Soja:[3,4,6],Girasol:[3,5,7],Trigo:[3,4,6],Cebada:[3,4,6],Sorgo:[2,3,5],Colza:[1,2,3]},
    Vertisol:{Maíz:[3,5,7],Soja:[3,4,6],Girasol:[3,5,7],Trigo:[3,4,6],Cebada:[3,4,6],Sorgo:[2,3,5],Colza:[1,2,3]},
    Alfisol:{Maíz:[4,5,8],Soja:[3,5,7],Girasol:[3,5,8],Trigo:[3,5,7],Cebada:[3,4,6],Sorgo:[3,4,6],Colza:[1,2,3]},
    Entisol:{Maíz:[4,6,9],Soja:[4,5,8],Girasol:[4,6,8],Trigo:[4,5,7],Cebada:[4,5,7],Sorgo:[3,4,6],Colza:[2,3,4]},
    Oxisol:{Maíz:[3,5,8],Soja:[3,4,6],Girasol:[3,5,7],Trigo:[3,4,6],Cebada:[3,4,6],Sorgo:[2,3,5],Colza:[1,2,3]},
  },
  npk:{Maíz:{N:25,P:4,K:3},Soja:{N:0,P:2,K:1.5},Girasol:{N:18,P:3,K:2.5},Trigo:{N:28,P:5,K:4},Cebada:{N:23,P:4,K:3.5},Sorgo:{N:22,P:4,K:3},Colza:{N:35,P:7,K:6}},
  rendR:{Maíz:[4,15],Soja:[1.5,5],Girasol:[1.5,4],Trigo:[2,8],Cebada:[2,7],Sorgo:[3,10],Colza:[1.5,4.5]},
  ferts:{'Urea':{N:46,P:0,K:0},'MAP (Fosfato Monoamónico)':{N:11,P:52,K:0},'DAP (Fosfato Diamónico)':{N:18,P:46,K:0},'KCl (Cloruro de Potasio)':{N:0,P:0,K:60}},
  maqs:{
    mixia:{a:13.5,t:[{n:'T1 Producto 1',v:9600},{n:'T2 Producto 2',v:4900},{n:'T3 Alfalfera/Ferti',v:1500}],f:'Crucianelli Mixia. Air Drill de altísima capacidad y chasis multipropósito. Hasta 13,50 m. Fino 17,5/21 cm; gruesa 35/38/42 cm por bloqueo. Tolva total 16.000 L con división 60/30/10. Neumática con flujos independientes.'},
    plantor:{a:18.9,t:[{n:'T1 Central',v:2400},{n:'T2 Central',v:2400},{n:'T3 Central',v:2400}],f:'Crucianelli Plantor. Air Planter de tolva central y pliegue frontal patentado. Anchos 12,60/15,70/18,90 m. Distancias 35/38,1/42/52,5/70/76,2 cm. 7.200 L totales en 3 tolvas de 2.400 L.'},
    drilor:{a:10,t:[{n:'T1 Semilla',v:5700},{n:'T2 Fertilizante',v:3800}],f:'Crucianelli Drilor. Air Drill de tolva centralizada y chasis articulado. Anchos 8,40 y 10 m. Fino 17,5/20/21/26,2 cm; gruesa hasta 70 cm. Carro de 9.500 L, configurable 60/40, 40/60 o 100% de un insumo.'},
    pionera:{a:16.38,t:[{n:'Semilla',v:6760},{n:'Fertilizante',v:3037},{n:'Alfalfero',v:495}],f:'Crucianelli Pionera. Multipropósito de tiro de punta, línea Nativa. Anchos 5,07-16,38 m. Fino 17,5/19/21/23,3/26,25 cm; gruesa opcional hasta 70 cm. Tolvas en chasis; referencia 15 m: 6.760 L semilla, 3.037 L ferti y 495 L alfalfero.'},
    gringa:{a:18.9,t:[{n:'Semilla aprox.',v:5522}],f:'Crucianelli Gringa. Sembradora modular de tiro de punta para granos gruesos. Anchos 6-18,90 m, 1 a 3 módulos. Distancias 35/38,1/42/52,5/70 cm. Transporte por tiro de punta; ancho en tractor 4,05 m, carretón 3,90 m y despeje 60 cm. Monotolvas compartimentadas; hasta ~5.522 L de semilla en versiones grandes.'},
    domina:{a:10.5,t:[],f:'Crucianelli Dómina. Sembradora de pliegue frontal y vertical para granos gruesos. Anchos 8,40/9,50/10,50 m. Distancias 35/42/52/60 cm. Transporte extremadamente reducido: 3,20 m. Tolvas en 3 compartimentos a lo largo del chasis; fuente sin litros normalizados.'},
    agrometalApx:{a:12.6,t:[{n:'Semilla',v:3660},{n:'Fertilizante',v:2440}],f:'Agrometal APX Seed Pro. Air Planter con pliegue frontal E-Folding. Anchos 9,05-12,60 m. Distancias 35/38/42/52,5/70 cm. Tolvas centrales presurizadas: 6.100 L totales, o 3.660 L semilla + 2.440 L fertilizante. Cuerpo Seed Pro y Twin Force.'},
    agrometalApxl:{a:19,t:[{n:'Semilla',v:7800},{n:'Fertilizante',v:5200}],f:'Agrometal APX-L. Air Planter de gran escala. Anchos 15/17/19 m. Distancias 42/52 cm. Air Cart de 13.000 L totales: 7.800 L semilla + 5.200 L fertilizante. Demanda 280-370 HP.'},
    agrometalTxPivot:{a:9.8,t:[{n:'Tolva máxima',v:2690}],f:'Agrometal TX Pivot 2. Sembradora Autotrailer de granos gruesos. Anchos 6,65-9,80 m. Distancias 35/38/42/52,5/70/76 cm. Transporte en 120 s, ancho 3,70 m y despeje 65 cm. Tolvas sobre chasis; máximo informado 2.690 L.'},
    agrometalTxMega:{a:20.47,t:[{n:'Semilla',v:9345}],f:'Agrometal TX Mega Gen 3. Modular de tiro de punta. Anchos 4,72-20,47 m. Distancias 35-70 cm. Transporte 3,90 m y despeje 60 cm. En 3 módulos alcanza hasta 9.345 L de semilla.'},
    agrometalAdx:{a:13,t:[{n:'Semilla',v:7800},{n:'Fertilizante',v:5200}],f:'Agrometal ADX Magna. Air Drill multipropósito de chasis articulado. Anchos 11 y 13 m. Fino 17,5/21/26 cm; gruesos 31/35/42/52 cm. Tolva 13.000 L dual 7.800/5.200 o 100% semilla. Sistema LAND Copy.'},
    agrometalMx:{a:15,t:[{n:'Semilla',v:5975},{n:'Fertilizante',v:3660},{n:'Alfalfa',v:1284}],f:'Agrometal MX Max. Multipropósito modular de tiro de punta. Anchos 5-15 m. Fino 17,5/21/26 cm; gruesos 35/42/52,5/70 cm. Módulo 15 m: 5.975 L semilla, 3.660 L fertilizante y 1.284 L alfalfa.'},
    apache54000:{a:15,t:[],f:'Apache 54000 Max. Multipropósito para finos y gruesos. Ancho de labor: 1 módulo 4-7 m, 2 módulos 8-12 m, 3 módulos 15 m. Distancias: finos 17,5/19,1/21 cm; gruesos 35/38,2/42/52,5/70 cm. Tolva compartimentada sin volumen normalizado en la fuente.'},
    apache27000:{a:21,t:[],f:'Apache 27000+. Modular de tiro de punta para granos gruesos. Ancho de labor: 8-21 m. Distancias: 35/40/42/52,5/70/76,5 cm. Transporte 3,20 m y despeje 58 cm. Monotolva compartimentada, sin volumen total normalizado en la fuente.'},
    apache99000:{a:12.4,t:[],f:'Apache 99000. Air Planter de precisión con pliegue frontal. Ancho de labor: 12,40 m. Distancias: 35/38,2/42/52,5/70/76,4 cm. Largo de traslado 8,20 m. Capacidad amplia 60/40 semilla/fertilizante, sin litros normalizados en la fuente.'},
    tanzi9200evox:{a:18.4,t:[{n:'T1 EVOX',v:9500},{n:'T2 EVOX',v:6400},{n:'T3 EVOX',v:4100}],f:'Tanzi 9200 Air Drill Gen 3 con Air Cart EVOX 20. Anchos: 9,2/12/13/14/18,4 m. Distancia base finos 19,1 cm; gruesos 38,2 cm por bloqueo hidráulico. EVOX 20: 20.000 L en 3 compartimentos.'},
    tanziSpecial3Evox:{a:14,t:[{n:'T1 EVOX',v:9500},{n:'T2 EVOX',v:6400},{n:'T3 EVOX',v:4100}],f:'Tanzi Special 3 Air Drill con Air Cart EVOX 20. Anchos: 10/12/13/14 m. Fino: 17,5/19,1/21/26 cm. Kit monograno opcional a 42/52/70 cm. EVOX 20: 20.000 L en 3 compartimentos.'},
    tanziSpecial4:{a:12,t:[{n:'T1 Semilla',v:3000},{n:'T2 Fertilizante',v:2000}],f:'Tanzi Special 4 Air Drill. Ancho: 5-12 m. Fino: 17,5/19,1/21/26 cm. Kit monograno opcional. Tolva presurizada integrada de 5.000 L con división 60/40.'},
    tanziSpecial5:{a:18.9,t:[{n:'T1 Independiente',v:2700},{n:'T2 Independiente',v:2700},{n:'T3 Independiente',v:2700}],f:'Tanzi Special 5 Air Planter. Anchos: 12,60/15,75/18,90 m. Distancias: 35/38/42/52/70 cm. Transporte 3,90 m. 8.100 L totales en 3 tolvas independientes de 2.700 L.'},
    superWalterW650Imperial:{a:16,t:[],f:'Súper Wálter W650 Imperial. Granos gruesos con pliegue de alas hacia adelante. Versiones 12/14/16 m. Distancias 35/38/42/45/52,5/70 cm. Transporte 3,90 m. 8 monotolvas plásticas compartimentadas, 126 L por línea; no se normaliza total por falta de cantidad de líneas exacta.'},
    superWalterW650Autotrailer:{a:12,t:[],f:'Súper Wálter W650 Autotrailer. Granos gruesos de tiro de punta súper angosta. Distancias 35-90 cm. Transporte Autotrailer de 3,00 m. Tolvas plásticas de gran capacidad con doble compartimento y tabique rebatible; fuente sin ancho/tolva total normalizados.'},
    superWalterW650AirDrill:{a:12,t:[{n:'Tolva central',v:6000}],f:'Súper Wálter W650 Air Drill. Granos gruesos en formato Air Planter de tolva central. Transporte plegable frontal, ancho 3,60 m. Tolva central única de ~6.000 L. Conducción neumática presurizada y dosificadores Matermacc MAGICSEM.'},
    superWalterW4500:{a:10,t:[],f:'Súper Wálter W4500. Sembradora de granos finos, pasturas y arroz. Distancias 17,5/21/26,25 cm, desde 17 hasta 62 líneas a 17,5. Transporte longitudinal por kit opcional. Tolvas de chapa de gran capacidad; fuente sin litros normalizados.'},
    ercaPfPremium:{a:14.7,t:[{n:'Semilla',v:2392},{n:'Fertilizante',v:2870}],f:'ERCA PF Premium. Granos gruesos de pliegue frontal, alta tecnología. Anchos 12,60 y 14,70 m; 24 o 28 líneas a 52,5 cm. Transporte 4,20 m y largo 11,5 m. Monotolva compartimentada: 2.000-2.392 L semilla + 2.870 L fertilizante, o 3.500 kg solo semilla.'},
    ercaLinea7g:{a:18,t:[],f:'ERCA Línea 7 G / Serie 6G. Modular tradicional de tiro de punta para granos gruesos. Hasta ~18 m según módulos. Dosificación mecánica, neumática, eléctrica o hidráulica. Monotolvas de gran capacidad; fuente sin litros normalizados.'},
    ercaLinea7f:{a:15.21,t:[],f:'ERCA Serie 6F / Línea 7 F. Multipropósito modular de tiro de punta. Anchos 5,07-15,21 m. Fino 17,5/19/21/26 cm, gruesa por kit opcional. Monotolvas compartimentadas de gran capacidad por módulo; fuente sin litros normalizados.'},
    ercaAirDrillTi13500:{a:14,t:[{n:'Tolva Ti 13.500',v:13500}],f:'ERCA Air Drill Serie Ti. Carro tolva, chasis articulado y transporte de tiro de frente. Versiones 9,2-14 m. Fino principalmente 19 cm o 25,4/50,8 cm. Capacidades 7.620 L, 12.000 L y Ti13.500 de 13.500 L.'},
    monumentalAd8300:{a:8.3,t:[{n:'Semilla',v:3250},{n:'Fertilizante',v:3250}],f:'Monumental AD-8300. Air Drill compacta. Ancho 8,30 m. Fino 17,5 cm; gruesos 35 y 52 cm. Tolva 6.500 L compartimentada 50/50. Sistema de carga en carretón vial sin desarmar.'},
    monumentalAd12000:{a:11.5,t:[{n:'Semilla',v:6380},{n:'Fertilizante',v:5220},{n:'Tercera tolva opcional',v:1400}],f:'Monumental AD-10000/AD-12000. Air Drill multipropósito. Anchos 9,80 y 11,50 m. Fino 17,5/19/21/26 cm; gruesos 35/38/42/52/70 cm. 11.600 L 55/45, con opción de 3ra tolva de 1.400 L para 13.000 L.'},
    monumentalAd16000:{a:16,t:[{n:'Compartimento 1',v:8000},{n:'Compartimento 2',v:8000}],f:'Monumental AD-16000. Air Drill de dimensiones masivas. Ancho 16 m. Fino 17,5/19/21/26 cm; gruesos 42/52/70 cm. Carro tolva 16.000 L dividido en dos compartimentos o versiones compactas de 13.500 L.'},
    custom:{a:7.0,t:[{n:'T1',v:4000},{n:'T2',v:2000}],f:'Promedio nacional de 7 m. Ajustá ancho y tolvas manualmente si tu equipo difiere.'},
  },
  prods:{Soja:0.75,Maíz:0.72,Trigo:0.78,Girasol:0.42,Sorgo:0.70,Urea:0.75,MAP:1.0,'Microgranulado Zn':0.95,Vacío:0},
  dosis:{Soja:80,Maíz:20,Trigo:120,Girasol:4,Sorgo:6,Urea:100,MAP:150,'Microgranulado Zn':20,Vacío:0},
};

// ── AGUA EN SUELO ───────────────────────────────────────
// Open-Meteo entrega humedad volumétrica (m³/m³). La disponibilidad para el
// cultivo se expresa entre PMP (0%) y capacidad de campo (100%).
function amSoilWaterThresholds(suelo, sg) {
  const presets = {
    molisol:  { cc:0.34, pmp:0.12 },
    vertisol: { cc:0.36, pmp:0.20 },
    alfisol:  { cc:0.36, pmp:0.16 },
    entisol:  { cc:0.18, pmp:0.07 },
    oxisol:   { cc:0.26, pmp:0.10 },
  };
  const key = String(suelo || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let out = presets[key] || { cc:0.34, pmp:0.14 };
  let fuente = 'tipo-suelo';
  let ccLab = Number(sg && (sg.cc ?? sg.thetaFC));
  let pmpLab = Number(sg && (sg.pmp ?? sg.thetaWP));
  if (ccLab > 1) ccLab /= 100;
  if (pmpLab > 1) pmpLab /= 100;
  if (sg && sg.retencionBase === 'gravimetrica') {
    const daLab = Number(sg.da);
    if (Number.isFinite(daLab) && daLab > 0) {
      ccLab *= daLab;
      pmpLab *= daLab;
    } else {
      ccLab = NaN;
      pmpLab = NaN;
    }
  }
  if (Number.isFinite(ccLab) && Number.isFinite(pmpLab) &&
      pmpLab >= 0.01 && ccLab <= 0.70 && ccLab - pmpLab >= 0.03) {
    out = { cc:ccLab, pmp:pmpLab };
    fuente = 'laboratorio';
  }

  // PTF Saxton & Rawls: arena/arcilla como fracción y materia orgánica en %.
  const sandPct = Number(sg && sg.sand);
  const clayPct = Number(sg && sg.clay);
  const socGkg  = Number(sg && sg.soc);
  if (fuente !== 'laboratorio' && Number.isFinite(sandPct) && Number.isFinite(clayPct) &&
      sandPct >= 0 && clayPct >= 0 && sandPct + clayPct <= 105) {
    const S = sandPct / 100;
    const C = clayPct / 100;
    const OM = Number.isFinite(socGkg) ? Math.max(0, socGkg * 0.1724) : 2.5;
    const wpT = -0.024*S + 0.487*C + 0.006*OM +
      0.005*S*OM - 0.013*C*OM + 0.068*S*C + 0.031;
    const fcT = -0.251*S + 0.195*C + 0.011*OM +
      0.006*S*OM - 0.027*C*OM + 0.452*S*C + 0.299;
    const pmp = wpT + 0.14*wpT - 0.02;
    const cc  = fcT + 1.283*fcT*fcT - 0.374*fcT - 0.015;
    if (Number.isFinite(cc) && Number.isFinite(pmp) &&
        pmp >= 0.02 && cc <= 0.60 && cc - pmp >= 0.05) {
      out = { cc, pmp };
      fuente = 'soilgrids-ptf';
    }
  }

  return { cc:out.cc, pmp:out.pmp, fuente };
}

function amSoilWaterDepletion(cultivo, et0, kc, sg) {
  const key = String(cultivo || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const pTabla = {
    soja:0.50, maiz:0.55, trigo:0.55, cebada:0.55,
    girasol:0.45, sorgo:0.55, colza:0.60, canola:0.60
  }[key] ?? 0.50;
  const et0N = Number(et0);
  const kcN = Number(kc);
  const etc = Number.isFinite(et0N) && et0N >= 0
    ? et0N * (Number.isFinite(kcN) && kcN > 0 ? kcN : 1)
    : 5;
  let p = pTabla + 0.04 * (5 - etc);
  const sand = Number(sg && sg.sand);
  const clay = Number(sg && sg.clay);
  if (Number.isFinite(sand) && sand >= 65) p += 0.05;
  if (Number.isFinite(clay) && clay >= 40) p -= 0.05;
  return { p:Math.max(0.10, Math.min(0.80, p)), pTabla, etc };
}

function amSoilAtDepth(sg, top, bottom) {
  const hs = sg && Array.isArray(sg.horizontes) ? sg.horizontes : [];
  if (!hs.length) return sg;
  const out = {}, pesos = {};
  hs.forEach(function(h) {
    const overlap = Math.max(0, Math.min(bottom, Number(h.bottom)) - Math.max(top, Number(h.top)));
    if (!overlap) return;
    ['sand','clay','silt','soc','da'].forEach(function(k) {
      const n = Number(h[k]);
      if (!Number.isFinite(n)) return;
      out[k] = (out[k] || 0) + n*overlap;
      pesos[k] = (pesos[k] || 0) + overlap;
    });
  });
  Object.keys(out).forEach(function(k) { out[k] /= pesos[k]; });
  return Object.keys(out).length ? out : sg;
}

function amSoilWaterProfile(layers, suelo, sg, options) {
  const umbral = amSoilWaterThresholds(suelo, sg);
  const dep = amSoilWaterDepletion(
    options && options.cultivo,
    options && options.et0,
    options && options.kc,
    sg
  );
  let aguaUtil = 0, capacidad = 0, aguaTotal = 0, profundidad = 0;
  let ccPond = 0, pmpPond = 0;
  let fuenteUmbrales = umbral.fuente;
  (layers || []).forEach(function(layer) {
    let theta = Number(layer && (layer.theta ?? layer.value));
    const depthCm = Number(layer && (layer.depthCm ?? layer.profundidadCm));
    if (!Number.isFinite(theta) || !Number.isFinite(depthCm) || depthCm <= 0) return;
    if (theta > 1) theta /= 100; // acepta sliders en % además de m³/m³
    if (theta < 0 || theta > 0.8) return;
    const uCapa = umbral.fuente === 'laboratorio' || !layer.sg
      ? umbral : amSoilWaterThresholds(suelo, layer.sg);
    if (uCapa.fuente === 'soilgrids-ptf') fuenteUmbrales = 'soilgrids-ptf-horizontes';
    profundidad += depthCm;
    aguaTotal += theta * depthCm * 10;
    aguaUtil += Math.max(0, Math.min(theta, uCapa.cc) - uCapa.pmp) * depthCm * 10;
    capacidad += (uCapa.cc - uCapa.pmp) * depthCm * 10;
    ccPond += uCapa.cc * depthCm;
    pmpPond += uCapa.pmp * depthCm;
  });
  const pct = capacidad > 0 && profundidad > 0
    ? Math.max(0, Math.min(100, aguaUtil / capacidad * 100))
    : null;
  const thetaProm = profundidad > 0 ? aguaTotal / (profundidad * 10) : null;
  const da = Number(sg && sg.da);
  const gravimetrica = thetaProm != null && Number.isFinite(da) && da > 0
    ? thetaProm / da : null;
  const ccPerfil = profundidad > 0 ? ccPond/profundidad : umbral.cc;
  const pmpPerfil = profundidad > 0 ? pmpPond/profundidad : umbral.pmp;
  const critica = pmpPerfil + (1-dep.p)*(ccPerfil-pmpPerfil);
  const pctCritico = (1-dep.p)*100;
  return {
    pct, aguaUtilMm:aguaUtil, capacidadUtilMm:capacidad, aguaTotalMm:aguaTotal,
    profundidadCm:profundidad, cc:ccPerfil, pmp:pmpPerfil,
    critica, pctCritico, p:dep.p, pTabla:dep.pTabla, etc:dep.etc,
    thetaVolumetrica:thetaProm, humedadGravimetrica:gravimetrica,
    agotamientoMm:capacidad > 0 ? capacidad-aguaUtil : null,
    rawMm:capacidad*dep.p, umbralUtilMm:capacidad*(1-dep.p),
    fuenteUmbrales,
    estado:pct == null ? 'sin-datos' : pct <= 0 ? 'pmp' : pct < pctCritico ? 'estres' : 'disponible'
  };
}

// ── PROYECCIÓN HÍDRICA ──
function amCropWaterStage(cultivo, diasDesdeSiembra, duracionCiclo) {
  const key = String(cultivo || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cfg = {
    soja:     { kcIni:0.30, kcMid:1.15, kcEnd:0.35, raizIni:15, raizMax:81 },
    maiz:     { kcIni:0.30, kcMid:1.20, kcEnd:0.40, raizIni:20, raizMax:81 },
    trigo:    { kcIni:0.30, kcMid:1.15, kcEnd:0.30, raizIni:15, raizMax:81 },
    cebada:   { kcIni:0.30, kcMid:1.10, kcEnd:0.30, raizIni:15, raizMax:81 },
    girasol:  { kcIni:0.35, kcMid:1.15, kcEnd:0.45, raizIni:20, raizMax:81 },
    sorgo:    { kcIni:0.30, kcMid:1.10, kcEnd:0.40, raizIni:20, raizMax:81 },
    colza:    { kcIni:0.35, kcMid:1.10, kcEnd:0.35, raizIni:15, raizMax:81 },
    canola:   { kcIni:0.35, kcMid:1.10, kcEnd:0.35, raizIni:15, raizMax:81 },
  }[key] || { kcIni:0.30, kcMid:1.10, kcEnd:0.40, raizIni:20, raizMax:81 };
  const dias = Math.max(0, Number(diasDesdeSiembra) || 0);
  const ciclo = Math.max(30, Number(duracionCiclo) || 150);
  const avance = Math.max(0, Math.min(1, dias/ciclo));
  let kc;
  if (avance <= 0.15) kc = cfg.kcIni;
  else if (avance < 0.40) kc = cfg.kcIni + (cfg.kcMid-cfg.kcIni)*((avance-0.15)/0.25);
  else if (avance <= 0.75) kc = cfg.kcMid;
  else kc = cfg.kcMid + (cfg.kcEnd-cfg.kcMid)*((avance-0.75)/0.25);
  const raizAvance = Math.min(1, avance/0.45);
  const raizCm = cfg.raizIni + (cfg.raizMax-cfg.raizIni)*raizAvance;
  return {
    avance,
    kc:Math.max(0.15, Math.min(1.30, kc)),
    raizCm:Math.max(cfg.raizIni, Math.min(81, raizCm)),
  };
}

function amRainInfiltrationFactor(sg, humedadPct) {
  const sand = Number(sg && sg.sand);
  const clay = Number(sg && sg.clay);
  let factor = 0.78;
  if (Number.isFinite(sand) && sand >= 65) factor = 0.88;
  else if (Number.isFinite(clay) && clay >= 40) factor = 0.66;
  else if (Number.isFinite(clay) && clay >= 30) factor = 0.72;
  const pct = Number(humedadPct);
  if (Number.isFinite(pct) && pct >= 90) factor -= 0.20;
  else if (Number.isFinite(pct) && pct >= 75) factor -= 0.10;
  return Math.max(0.45, Math.min(0.90, factor));
}

function amSoilWaterOutlook(perfilInicial, dias, options) {
  if (!perfilInicial || !Number.isFinite(Number(perfilInicial.aguaUtilMm)) ||
      !Number.isFinite(Number(perfilInicial.capacidadUtilMm))) return null;
  const opts = options || {};
  const horizonte = Math.max(1, Math.min(16, Number(opts.horizonte) || 16));
  const lista = (dias || []).slice(0, horizonte);
  let aguaSeca = Math.max(0, Number(perfilInicial.aguaUtilMm));
  let aguaPron = aguaSeca;
  let capacidad = Math.max(0, Number(perfilInicial.capacidadUtilMm));
  let diasSeca = aguaSeca <= Number(perfilInicial.umbralUtilMm) ? 0 : null;
  let diasPron = diasSeca;
  let diasModelo = perfilInicial.estado === 'estres' || perfilInicial.estado === 'pmp' ? 0 : null;
  let lluviaPuente = null;
  const serie = [];
  const factorBase = Number.isFinite(Number(opts.factorInfiltracion))
    ? Number(opts.factorInfiltracion)
    : amRainInfiltrationFactor(opts.sg, perfilInicial.pct);

  lista.forEach(function(d, idx) {
    const capDia = Number(d && d.capacidadUtilMm);
    const gananciaRaiz = Math.max(0, Number(d && d.gananciaRaizMm) || 0);
    if (Number.isFinite(capDia) && capDia > capacidad) capacidad = capDia;
    aguaSeca = Math.min(capacidad, aguaSeca + gananciaRaiz);
    aguaPron = Math.min(capacidad, aguaPron + gananciaRaiz);

    const et0 = Math.max(0, Number(d && d.et0) || 0);
    const kc = Math.max(0.15, Math.min(1.30, Number(d && d.kc) || Number(opts.kc) || 1));
    const etc = et0*kc;
    const lluvia = Math.max(0, Number(d && d.precipitacion) || 0);
    const prob = Math.max(0, Math.min(100, Number(d && d.probabilidad) || 0));
    const riego = Math.max(0, Number(d && d.riegoMm) || 0);
    const eficienciaRiego = Math.max(0.10, Math.min(1, Number(d && d.eficienciaRiego) || 1));
    const riegoEfectivo = riego*eficienciaRiego;
    const factorHum = amRainInfiltrationFactor(opts.sg, capacidad > 0 ? aguaPron/capacidad*100 : null);
    const factorInf = Math.min(factorBase, factorHum);
    const lluviaEfectiva = lluvia*factorInf*(prob/100);

    aguaSeca = Math.max(0, aguaSeca-etc);
    aguaPron = Math.max(0, Math.min(capacidad, aguaPron+lluviaEfectiva+riegoEfectivo-etc));
    const dep = amSoilWaterDepletion(opts.cultivo, et0, kc, opts.sg);
    const umbral = capacidad*(1-dep.p);
    const modelo = d && d.modeloPerfil;
    const modeloPct = modelo && Number.isFinite(Number(modelo.pct)) ? Number(modelo.pct) : null;
    const modeloUmbral = modelo && Number.isFinite(Number(modelo.pctCritico))
      ? Number(modelo.pctCritico) : (1-dep.p)*100;

    if (diasSeca == null && aguaSeca <= umbral) diasSeca = idx+1;
    if (diasPron == null && aguaPron <= umbral) diasPron = idx+1;
    if (diasModelo == null && modeloPct != null && modeloPct <= modeloUmbral) diasModelo = idx+1;
    if (!lluviaPuente && lluvia >= 3 && prob >= 50) {
      lluviaPuente = {
        dia:idx+1,
        fecha:d && d.fecha || '',
        precipitacion:lluvia,
        probabilidad:prob,
        efectiva:lluviaEfectiva,
      };
    }
    serie.push({
      dia:idx+1,
      fecha:d && d.fecha || '',
      et0, kc, etc, precipitacion:lluvia, probabilidad:prob, lluviaEfectiva,
      riegoMm:riego, eficienciaRiego, riegoEfectivo,
      aguaSinLluviaMm:aguaSeca, aguaPronosticoMm:aguaPron,
      capacidadUtilMm:capacidad, umbralUtilMm:umbral,
      pctPronostico:capacidad > 0 ? aguaPron/capacidad*100 : null,
      pctModelo:modeloPct,
      estresSinLluvia:aguaSeca <= umbral,
      estresPronostico:aguaPron <= umbral,
      estresModelo:modeloPct != null ? modeloPct <= modeloUmbral : null,
    });
  });

  let confianza = 'moderada';
  if (diasModelo != null && diasPron != null) {
    const dif = Math.abs(diasModelo-diasPron);
    confianza = dif <= 2 ? 'alta' : dif <= 4 ? 'moderada' : 'baja';
  } else if (diasModelo == null && diasPron == null && lista.length >= horizonte) {
    confianza = 'alta';
  } else if (diasModelo != null || diasPron != null) {
    confianza = 'baja';
  }
  let puente = 'sin-recarga';
  if (lluviaPuente) {
    if (diasSeca == null || lluviaPuente.dia < diasSeca) puente = 'antes';
    else if (lluviaPuente.dia === diasSeca) puente = 'mismo-dia';
    else puente = 'despues';
  }
  const candidatosOperativos = [diasPron, diasModelo].filter(function(v) {
    return v != null && Number.isFinite(Number(v));
  }).map(Number);
  const diasOperativos = candidatosOperativos.length
    ? Math.min.apply(null, candidatosOperativos) : null;
  return {
    horizonte,
    diasSinLluvia:diasSeca,
    diasConPronostico:diasPron,
    diasModelo,
    diasOperativos,
    fechaEstresSinLluvia:diasSeca > 0 && serie[diasSeca-1] ? serie[diasSeca-1].fecha : '',
    fechaEstresPronostico:diasPron > 0 && serie[diasPron-1] ? serie[diasPron-1].fecha : '',
    fechaEstresOperativo:diasOperativos > 0 && serie[diasOperativos-1] ? serie[diasOperativos-1].fecha : '',
    lluviaPuente,
    puente,
    confianza,
    serie,
  };
}

// ── COORDS ──
const SPOLY={
  Molisol:[[-68,-25],[-65,-27],[-62,-30],[-59,-33],[-57,-36],[-59,-39],[-62,-40],[-65,-38],[-67,-35],[-68,-30]],
  Vertisol:[[-60,-26],[-58,-28],[-56,-30],[-55,-32],[-57,-34],[-60,-32],[-61,-30],[-60,-26]],
  Entisol:[[-70,-20],[-67,-22],[-64,-24],[-61,-26],[-59,-28],[-61,-31],[-65,-33],[-68,-30],[-70,-25],[-70,-20]],
  Alfisol:[[-65,-38],[-62,-40],[-60,-42],[-58,-44],[-57,-46],[-59,-48],[-63,-47],[-66,-44],[-67,-41],[-65,-38]],
  Oxisol:[[-55,-23],[-54,-25],[-52,-27],[-52,-29],[-54,-30],[-56,-29],[-57,-27],[-55,-23]],
};
function inPoly(lat,lon,p){let d=false,n=p.length,j=n-1;for(let i=0;i<n;i++){const[xi,yi]=p[i],[xj,yj]=p[j];if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))d=!d;j=i}return d}
function detSuelo(lat,lon){for(const[t,p] of Object.entries(SPOLY))if(inPoly(lat,lon,p))return t;return null}
function parsCoord(txt){
  txt=txt.trim();
  const dec=txt.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
  if(dec){const la=+dec[1],lo=+dec[2];if(la>=-90&&la<=90&&lo>=-180&&lo<=180)return[la,lo];return[null,null];}
  const dms=txt.match(/(\d+)[°\s]\s*(\d+)['\u2019\s]\s*(\d+(?:[.,]\d+)?)["\u201d]?\s*([NS])\s+(\d+)[°\s]\s*(\d+)['\u2019\s]\s*(\d+(?:[.,]\d+)?)["\u201d]?\s*([EW])/i);
  if(dms){
    let la=+dms[1]+(+dms[2])/60+parseFloat(dms[3].replace(',','.'))/3600;
    let lo=+dms[5]+(+dms[6])/60+parseFloat(dms[7].replace(',','.'))/3600;
    if(dms[4].toUpperCase()==='S')la=-la;if(dms[8].toUpperCase()==='W')lo=-lo;
    if(la>=-90&&la<=90&&lo>=-180&&lo<=180)return[la,lo];return[null,null];
  }return[null,null];
}

// ── GPS ──
function usarGPS(){
  if(!navigator.geolocation){alert('Geolocalización no disponible.');return}
  const b=$('btn-gps');b.textContent='⟳';b.disabled=true;
  navigator.geolocation.getCurrentPosition(
    p=>{
      $('s-coord').value=`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`;
      b.textContent='📍 Mi ubicación';
      b.disabled=false;
      if(typeof amActualizarMapaInline === 'function') amActualizarMapaInline();
      buscarAPI();
    },
    ()=>{b.textContent='📍 Mi ubicación';b.disabled=false;alert('No se pudo obtener la ubicación GPS.')},
    {enableHighAccuracy:true,timeout:10000}
  );
}

// ── API STATUS ──
function setStatus(msg,loading=true){
  $('api-st').classList.remove('hidden');
  $('api-sp').textContent=loading?'⟳':'';
  $('api-sp').style.animation=loading?'spin 1s linear infinite':'none';
  $('api-msg').textContent=msg;
}

// ── OPEN-METEO ──

// ── LEAFLET MAP INLINE (Dashboard) ──
let amMap = null;
let amMapMarker = null;

function amInitMapaInline() {
  const container = document.getElementById('am-inline-map');
  if(!container || amMap) return;
  
  amMap = L.map('am-inline-map').setView([-33.395, -60.192], 5);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS'
  }).addTo(amMap);
  
  amMap.on('click', function(e) {
    if(!amMapMarker) {
      amMapMarker = L.marker(e.latlng).addTo(amMap);
    } else {
      amMapMarker.setLatLng(e.latlng);
    }
    const input = document.getElementById('s-coord');
    if(input) {
      input.value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      // Auto-fetch data on click
      if(typeof buscarAPI === 'function') buscarAPI();
    }
  });

  setTimeout(amActualizarMapaInline, 500);
}

function amActualizarMapaInline() {
  if(!amMap) return;
  const val = document.getElementById('s-coord')?.value;
  if(val) {
    const [lat, lon] = parsCoord(val);
    if(lat !== null && lon !== null) {
      if(!amMapMarker) amMapMarker = L.marker([lat, lon]).addTo(amMap);
      else amMapMarker.setLatLng([lat, lon]);
      amMap.setView([lat, lon], 14);
    }
  } else {
    if(amMapMarker) {
      amMap.removeLayer(amMapMarker);
      amMapMarker = null;
    }
    amMap.setView([-33.395, -60.192], 5);
  }
}

function amRefrescarMapaDashboard() {
  if(amMap) {
    setTimeout(() => {
      amMap.invalidateSize();
      amActualizarMapaInline();
    }, 200);
  }
}

window.amToggleNdviOverlay = function() {};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(amInitMapaInline, 800);
});

  // Exponer a global
  window.$ = $;
  window.sv = sv;
  window.gv = gv;
  window.gi = gi;
  window.setR = setR;
  window.amSoilWaterThresholds = amSoilWaterThresholds;
  window.amSoilWaterDepletion = amSoilWaterDepletion;
  window.amSoilAtDepth = amSoilAtDepth;
  window.amSoilWaterProfile = amSoilWaterProfile;
  window.amCropWaterStage = amCropWaterStage;
  window.amRainInfiltrationFactor = amRainInfiltrationFactor;
  window.amSoilWaterOutlook = amSoilWaterOutlook;
  window.AM.soilWater = {
    thresholds: amSoilWaterThresholds,
    depletion: amSoilWaterDepletion,
    soilAtDepth: amSoilAtDepth,
    profile: amSoilWaterProfile,
    cropStage: amCropWaterStage,
    infiltration: amRainInfiltrationFactor,
    outlook: amSoilWaterOutlook
  };
  window.DB = DB;
  window.SPOLY = SPOLY;
  window.inPoly = inPoly;
  window.detSuelo = detSuelo;
  window.parsCoord = parsCoord;
  window.usarGPS = usarGPS;
  window.setStatus = setStatus;
  window.amInitMapaInline = amInitMapaInline;
  window.amActualizarMapaInline = amActualizarMapaInline;
  window.amRefrescarMapaDashboard = amRefrescarMapaDashboard;

})();
