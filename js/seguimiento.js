// ════════════════════════════════════════════════════════════════════
// BASE DE DATOS AGRONÓMICA
// ════════════════════════════════════════════════════════════════════
(function() {
  window.AM = window.AM || {};
  window.AM.seguimiento = {};
const SEG_CULTIVOS = {
  Soja:{nombre:'Soja',emoji:'🌱',base:10,ky:0.85,
    etcMin:450,etcMax:650,mmPorTon:140,
    estadios:[
      {cod:'VE',label:'VE · Emergencia',gdd:80,icon:'🌱',desc:'Cotiledones por encima del suelo'},
      {cod:'V1',label:'V1 · 1er nudo',gdd:180,icon:'🪴',desc:'Primer nudo con hoja trifoliada'},
      {cod:'V3',label:'V3 · 3er nudo',gdd:310,icon:'🌿',desc:'Desarrollo activo de hojas y tallos'},
      {cod:'V6',label:'V6 · 6to nudo',gdd:520,icon:'🌿',desc:'Canopeo cerrado, alta demanda nutricional'},
      {cod:'R1',label:'R1 · Floración',gdd:850,icon:'🌸',desc:'Una flor abierta — período crítico'},
      {cod:'R3',label:'R3 · Vainas',gdd:1100,icon:'🫘',desc:'Vainas 5mm — determina estructura de rinde'},
      {cod:'R5',label:'R5 · Llenado',gdd:1350,icon:'⚡',desc:'Granos en vainas — crítico para rinde'},
      {cod:'R7',label:'R7 · Madurez',gdd:1700,icon:'🌾',desc:'Una vaina en color madurez'},
    ],
    alertas:{R1:'🌸 <strong>Floración (R1)</strong> — período crítico. Proteger con fungicida. Alta sensibilidad a déficit hídrico.',R3:'🫘 <strong>Inicio vainas (R3)</strong> — control de lepidópteros y chinches.',R5:'⚡ <strong>Llenado (R5)</strong> — 30 días que definen el rinde. Déficit = pérdida directa de tn/ha.'},
    kyPeriodos:{vegetativo:0.2,floracion:1.0,llenado:0.8,maduracion:0.3}
  },
  Maiz:{nombre:'Maíz',emoji:'🌽',base:8,ky:0.9,
    etcMin:500,etcMax:700,mmPorTon:120,
    estadios:[
      {cod:'VE',label:'VE · Emergencia',gdd:75,icon:'🌱',desc:'Coleóptilo visible'},
      {cod:'V3',label:'V3 · 3 hojas',gdd:185,icon:'🌿',desc:'Crecimiento apical en raíz'},
      {cod:'V6',label:'V6 · 6 hojas',gdd:320,icon:'🌿',desc:'Diferenciación de hileras de granos'},
      {cod:'V10',label:'V10 · 10 hojas',gdd:510,icon:'🌿',desc:'Elongación rápida del tallo'},
      {cod:'VT',label:'VT · Panoja',gdd:850,icon:'🌾',desc:'Última hoja — antesis próxima'},
      {cod:'R1',label:'R1 · Floración',gdd:950,icon:'🌸',desc:'Emisión de estigmas — crítico 10 días'},
      {cod:'R3',label:'R3 · Lechoso',gdd:1150,icon:'🌽',desc:'Llenado activo de granos'},
      {cod:'R6',label:'R6 · Madurez',gdd:1500,icon:'🌾',desc:'Capa negra — rinde definido'},
    ],
    alertas:{VT:'🌾 <strong>Panoja (VT)</strong> — revisar trips. Alta sensibilidad a VPD.',R1:'🌸 <strong>Floración (R1)</strong> — T°>33°C daña el polen. Déficit hídrico = -30% rinde.',R3:'🌽 <strong>Lechoso (R3)</strong> — controlar pulgones, proteger canopeo.'},
    kyPeriodos:{vegetativo:0.25,floracion:1.0,llenado:0.85,maduracion:0.35}
  },
  Trigo:{nombre:'Trigo',emoji:'🌾',base:0,ky:0.65,
    etcMin:300,etcMax:450,mmPorTon:90,
    estadios:[
      {cod:'Z10',label:'Z10 · Germinación',gdd:90,icon:'🌱',desc:'Emergencia del coleóptilo'},
      {cod:'Z21',label:'Z21 · Macollaje',gdd:280,icon:'🌿',desc:'Primer macollo visible'},
      {cod:'Z30',label:'Z30 · Encañazón',gdd:490,icon:'🌿',desc:'Primer nudo detectable'},
      {cod:'Z55',label:'Z55 · Espigazón',gdd:750,icon:'🌾',desc:'Mitad de la espiga emergida'},
      {cod:'Z65',label:'Z65 · Antesis',gdd:900,icon:'🌸',desc:'Floración — crítico fusarium'},
      {cod:'Z71',label:'Z71 · Lechoso',gdd:1100,icon:'🌾',desc:'Llenado activo de granos'},
      {cod:'Z87',label:'Z87 · Madurez',gdd:1500,icon:'🌾',desc:'Madurez fisiológica'},
    ],
    alertas:{Z65:'🌸 <strong>Antesis (Z65)</strong> — ventana fungicida contra fusariosis. No postergar.',Z55:'🌾 <strong>Espigazón</strong> — revisar roya amarilla y del tallo.'},
    kyPeriodos:{vegetativo:0.2,floracion:0.9,llenado:0.7,maduracion:0.2}
  },
  Girasol:{nombre:'Girasol',emoji:'🌻',base:6,ky:0.75,
    etcMin:450,etcMax:600,mmPorTon:150,
    estadios:[
      {cod:'V2',label:'V2 · Emergencia',gdd:100,icon:'🌱',desc:'Primer par de hojas verdaderas'},
      {cod:'V8',label:'V8 · 8 hojas',gdd:380,icon:'🌿',desc:'Desarrollo vegetativo activo'},
      {cod:'R1',label:'R1 · Botón floral',gdd:560,icon:'🌼',desc:'Botón visible entre hojas jóvenes'},
      {cod:'R4',label:'R4 · Floración',gdd:700,icon:'🌻',desc:'50% floración — crítico para polinización'},
      {cod:'R6',label:'R6 · Llenado',gdd:900,icon:'⚡',desc:'Llenado activo — determinante rinde en aceite'},
      {cod:'R9',label:'R9 · Madurez',gdd:1200,icon:'🌾',desc:'Madurez fisiológica'},
    ],
    alertas:{R4:'🌻 <strong>Floración (R4)</strong> — evitar aplicaciones que dañen polinizadores.'},
    kyPeriodos:{vegetativo:0.2,floracion:0.95,llenado:0.8,maduracion:0.3}
  },
};

const SEG_GDD_MENSUAL = {
  b0:[527,490,430,345,265,205,200,225,295,390,465,518],
  b6:[380,345,295,215,148,92,95,115,178,265,328,372],
  b8:[340,300,240,145,75,32,35,58,108,190,262,322],
  b10:[310,270,210,115,55,18,20,40,85,165,235,295],
};
// Promedios históricos pampeanos NASA POWER 1991-2020 (precipitación mensual mm)
const HIST_PREC_MENS = [90,80,80,60,30,15,15,20,45,70,85,95]; // base mensual pampeano núcleo
// Temperatura media mensual histórica (°C)
const HIST_TMED_MENS = [23.5,22.8,20.2,16.0,12.1,8.8,8.2,10.5,13.8,17.5,20.5,22.8];

function segGddTab(base){if(base<=0)return SEG_GDD_MENSUAL.b0;if(base<=6)return SEG_GDD_MENSUAL.b6;if(base<=8)return SEG_GDD_MENSUAL.b8;return SEG_GDD_MENSUAL.b10}

// ════════════════════════════════════════════════════════════════════
// GESTOR DE LOTES — ESTADO GLOBAL
// ════════════════════════════════════════════════════════════════════
let SEG_LOTES = [];       // [{id, nombre, establecimiento, cultivo, sup, fechaSiem, coord, rendObj, ...datos calculados}]
let SEG_LOTE_ACTIVO = null; // id del lote activo

const SEG_STATE = {
  cultivo:null,fechaSiem:null,coord:null,
  gddAcumulado:0,gddHistorial:[],
  ndvi:null,ndviHistorial:[],ndviTipo:'proxy',
  bitacora:[],estadioActual:null,
  hidrico:null,
  rendimiento:null,
  historico:null,
};
const BIT_COLORES = {
  herbicida:{bg:'rgba(58,122,74,.15)',border:'rgba(58,122,74,.3)',icon:'🌿',label:'Herbicida'},
  fungicida:{bg:'rgba(74,46,26,.12)',border:'rgba(74,46,26,.25)',icon:'🍄',label:'Fungicida'},
  insecticida:{bg:'rgba(212,82,42,.1)',border:'rgba(212,82,42,.25)',icon:'🐛',label:'Insecticida'},
  fertilizacion:{bg:'rgba(200,162,85,.12)',border:'rgba(200,162,85,.3)',icon:'⚗️',label:'Fertilización'},
  riego:{bg:'rgba(42,90,140,.1)',border:'rgba(42,90,140,.25)',icon:'💧',label:'Riego'},
  scouting:{bg:'rgba(42,90,140,.08)',border:'rgba(42,90,140,.2)',icon:'🔍',label:'Scouting'},
  cosecha:{bg:'rgba(200,162,85,.18)',border:'rgba(200,162,85,.4)',icon:'🌾',label:'Cosecha'},
  otro:{bg:'rgba(74,46,26,.06)',border:'rgba(74,46,26,.15)',icon:'📌',label:'Otro'},
};

if(typeof $ === 'undefined'){window.$=id=>document.getElementById(id)}

// ════════ PERSISTENCIA ════════
function segGuardar(){
  try{localStorage.setItem('am_seg_lotes',JSON.stringify(SEG_LOTES));localStorage.setItem('am_seg_lote_activo',SEG_LOTE_ACTIVO||'');localStorage.setItem('am_seg_state',JSON.stringify(SEG_STATE));}catch(e){}
}
function segCargar(){
  try{
    const l=localStorage.getItem('am_seg_lotes');if(l)SEG_LOTES=JSON.parse(l);
    const a=localStorage.getItem('am_seg_lote_activo');if(a)SEG_LOTE_ACTIVO=a;
    const s=localStorage.getItem('am_seg_state');if(s)Object.assign(SEG_STATE,JSON.parse(s));
  }catch(e){}
}

// ════════════════════════════════════════════════════════════════════
// GESTOR DE LOTES
// ════════════════════════════════════════════════════════════════════
function segAbrirModalNuevoLote(){
  const hoy=new Date().toISOString().split('T')[0];
  if($('lote-fecha'))$('lote-fecha').value=hoy;
  $('modal-nuevo-lote').classList.remove('hidden');
  setTimeout(()=>$('lote-nombre')?.focus(),100);
}
function segCerrarModalLote(){$('modal-nuevo-lote').classList.add('hidden')}

function segCrearLote(){
  const nombre=$('lote-nombre')?.value?.trim();
  const estab=$('lote-establecimiento')?.value?.trim()||'';
  const cultivo=$('lote-cultivo')?.value||'Soja';
  const sup=parseFloat($('lote-sup')?.value)||50;
  const fecha=$('lote-fecha')?.value||'';
  const coord=$('lote-coord')?.value?.trim()||'';
  const rendObj=parseFloat($('lote-rend-obj')?.value)||3.5;
  if(!nombre){segToast('⚠️ Ingresá el nombre del lote','warn');return;}
  if(!fecha){segToast('⚠️ Ingresá la fecha de siembra','warn');return;}

  const id='lote_'+Date.now();
  const lote={id,nombre,estab,cultivo,sup,fechaSiem:fecha,coord,rendObj,
    gddAcumulado:0,gddHistorial:[],ndvi:null,ndviHistorial:[],ndviTipo:'proxy',
    bitacora:[],estadioActual:null,hidrico:null,alertas:[]};
  SEG_LOTES.push(lote);
  SEG_LOTE_ACTIVO=id;
  segGuardar();
  segCerrarModalLote();
  segRenderChips();
  segCargarLote(id);
  segToast(`✅ Lote "${nombre}" creado`,'ok');
  // Auto-calcular si tiene coordenadas
  if(coord)setTimeout(()=>segCalcularGDD(),300);
}

function segRenderChips(){
  const container=$('seg-lotes-chips');
  const countEl=$('seg-lotes-count');
  if(!container)return;
  if(countEl)countEl.textContent=`${SEG_LOTES.length} / 50`;
  if(SEG_LOTES.length===0){
    container.innerHTML='<div style="font-size:.76rem;color:rgba(237,224,196,.25);padding:.4rem .2rem;font-style:italic">Creá tu primer lote para comenzar el seguimiento →</div>';
    return;
  }
  container.innerHTML=SEG_LOTES.map(l=>{
    const cult=SEG_CULTIVOS[l.cultivo];
    const activo=l.id===SEG_LOTE_ACTIVO;
    const alertas=l.alertas||[];
    const tieneAlerta=alertas.length>0;
    return `<div class="lote-chip ${activo?'activo':''} ${tieneAlerta&&!activo?'alerta-activa':''}" onclick="segCargarLote('${l.id}')" title="${l.estab?l.estab+' · ':''}${l.sup} ha · ${l.cultivo}">
      ${cult?.emoji||'🌾'} ${l.nombre}
      ${l.gddAcumulado>0?`<span style="font-size:.6rem;background:rgba(200,162,85,.2);color:var(--amber);padding:.05rem .35rem;border-radius:8px;font-family:'DM Mono',monospace">${l.gddAcumulado}</span>`:''}
      ${tieneAlerta?'<span class="lote-alerta-dot"></span>':''}
    </div>`;
  }).join('');
}

function segCargarLote(id){
  const lote=SEG_LOTES.find(l=>l.id===id);
  if(!lote)return;
  SEG_LOTE_ACTIVO=id;

  // Copiar datos del lote al SEG_STATE
  Object.assign(SEG_STATE,{
    cultivo:lote.cultivo,fechaSiem:lote.fechaSiem,coord:lote.coord,
    gddAcumulado:lote.gddAcumulado||0,gddHistorial:lote.gddHistorial||[],
    ndvi:lote.ndvi,ndviHistorial:lote.ndviHistorial||[],ndviTipo:lote.ndviTipo||'proxy',
    bitacora:lote.bitacora||[],estadioActual:lote.estadioActual,
    hidrico:lote.hidrico,rendimiento:lote.rendimiento,
  });

  // Poblar formularios
  if($('seg-cultivo'))$('seg-cultivo').value=lote.cultivo||'Soja';
  if($('seg-fecha-siem'))$('seg-fecha-siem').value=lote.fechaSiem||'';
  if($('seg-coord'))$('seg-coord').value=lote.coord||'';
  if($('seg-ndvi-coord'))$('seg-ndvi-coord').value=lote.coord||'';
  if($('seg-hid-coord'))$('seg-hid-coord').value=lote.coord||'';
  if($('seg-hid-fecha'))$('seg-hid-fecha').value=lote.fechaSiem||'';
  if($('hist-coord'))$('hist-coord').value=lote.coord||'';
  if($('hist-fecha-siem'))$('hist-fecha-siem').value=lote.fechaSiem||'';
  if($('rend-cultivo'))$('rend-cultivo').value=lote.cultivo||'Soja';
  if($('rend-obj'))$('rend-obj').value=lote.rendObj||3.5;

  const nombreEl=$('seg-lote-nombre-gdd');
  if(nombreEl)nombreEl.textContent=lote.nombre;

  segActualizarCultivoInfo();
  segRenderChips();

  if(SEG_STATE.gddAcumulado>0)segRenderGDD();
  else{$('seg-gdd-placeholder').classList.remove('hidden');$('seg-gdd-resultado').classList.add('hidden');}
  if(SEG_STATE.ndvi!==null)segRenderNDVI();
  bitRenderLista();
  if(SEG_STATE.rendimiento)rendRender(SEG_STATE.rendimiento);
  segGuardar();
  segToast(`📂 Lote "${lote.nombre}" activo`,'ok');
}

function segActualizarLoteActivo(campo,valor){
  const lote=SEG_LOTES.find(l=>l.id===SEG_LOTE_ACTIVO);
  if(!lote)return;
  lote[campo]=valor;
  SEG_STATE[campo]=valor;
  segGuardar();
}

function segLoteActivo(){return SEG_LOTES.find(l=>l.id===SEG_LOTE_ACTIVO)||null}

// ════════════════════════════════════════════════════════════════════
// ALERTAS PROACTIVAS
// ════════════════════════════════════════════════════════════════════
let SEG_ALERTAS_PENDIENTES=[];
let SEG_ALERTA_IDX=0;

function segEvaluarAlertas(){
  const alertas=[];
  SEG_LOTES.forEach(lote=>{
    if(!lote.gddAcumulado||!lote.cultivo)return;
    const cult=SEG_CULTIVOS[lote.cultivo];
    if(!cult)return;
    const gdd=lote.gddAcumulado;
    // Buscar estadio actual
    let estadioIdx=0;
    for(let i=0;i<cult.estadios.length;i++){if(gdd>=cult.estadios[i].gdd)estadioIdx=i;else break;}
    const estadioAct=cult.estadios[estadioIdx];
    const estadioSig=cult.estadios[estadioIdx+1]||null;

    // Alerta por estadio crítico actual
    if(cult.alertas[estadioAct.cod]){
      alertas.push({lote:lote.nombre,tipo:'danger',
        msg:cult.alertas[estadioAct.cod].replace(/<[^>]+>/g,''),
        accion:'Ver módulo GDD'});
    }
    // Alerta si el siguiente estadio está a menos de 3 días
    if(estadioSig){
      const diasFalta=segEstimarDias(gdd,estadioSig.gdd,cult.base);
      if(diasFalta<=3&&cult.alertas[estadioSig.cod]){
        alertas.push({lote:lote.nombre,tipo:'warn',
          msg:`En ${diasFalta} días: ${cult.alertas[estadioSig.cod].replace(/<[^>]+>/g,'')}`,
          accion:'Ver fenología'});
      }
    }
    // Alerta hídrica si hay datos
    if(lote.hidrico){
      const cob=lote.hidrico.pctCobertura;
      if(cob<50&&estadioAct.cod.startsWith('R')){
        alertas.push({lote:lote.nombre,tipo:'danger',
          msg:`Déficit hídrico severo (${cob}% cobertura ET₀) en estadio ${estadioAct.cod} — riesgo alto de pérdida de rinde`,
          accion:'Ver balance hídrico'});
      } else if(cob<70&&estadioAct.cod.startsWith('R')){
        alertas.push({lote:lote.nombre,tipo:'warn',
          msg:`Déficit hídrico moderado (${cob}% cobertura ET₀) — monitorear de cerca`,
          accion:'Ver balance hídrico'});
      }
    }
    // Alerta NDVI bajo en estadio vegetativo avanzado
    if(lote.ndvi&&lote.ndvi<0.35&&gdd>300){
      alertas.push({lote:lote.nombre,tipo:'danger',
        msg:`NDVI bajo (${lote.ndvi.toFixed(2)}) en cultivo establecido — scouting urgente`,
        accion:'Ver NDVI'});
    }
    // Guardar alertas en el lote
    lote.alertas=alertas.filter(a=>a.lote===lote.nombre);
  });

  SEG_ALERTAS_PENDIENTES=alertas;
  segRenderBanner();
  segRenderChips(); // actualizar puntos rojos
}

function segRenderBanner(){
  const banner=$('seg-alertas-banner');
  const btn=$('seg-alerta-btn');
  const count=$('seg-alerta-count');
  const plural=$('seg-alerta-plural');
  if(!banner)return;

  if(SEG_ALERTAS_PENDIENTES.length===0){
    banner.innerHTML='';
    if(btn)btn.style.display='none';
    return;
  }
  if(btn){btn.style.display='flex';btn.style.display='inline-flex';}
  if(count)count.textContent=SEG_ALERTAS_PENDIENTES.length;
  if(plural)plural.textContent=SEG_ALERTAS_PENDIENTES.length===1?'':'s';

  const a=SEG_ALERTAS_PENDIENTES[SEG_ALERTA_IDX%SEG_ALERTAS_PENDIENTES.length];
  if(!a){banner.innerHTML='';return;}
  const n=SEG_ALERTAS_PENDIENTES.length;
  banner.innerHTML=`
    <div class="alerta-proactiva-bar ${a.tipo}">
      <div class="alerta-dot"></div>
      <div class="alerta-txt">${a.msg}</div>
      <span class="alerta-lote-badge">📍 ${a.lote}</span>
      ${n>1?`<button class="alerta-nav-btn" onclick="segMostrarProximaAlerta()">▶ ${SEG_ALERTA_IDX+1}/${n}</button>`:''}
      <button class="alerta-close" onclick="segDismissAlerta()" title="Cerrar">✕</button>
    </div>`;
}

function segMostrarProximaAlerta(){
  SEG_ALERTA_IDX=(SEG_ALERTA_IDX+1)%Math.max(1,SEG_ALERTAS_PENDIENTES.length);
  segRenderBanner();
}
function segDismissAlerta(){
  if($('seg-alertas-banner'))$('seg-alertas-banner').innerHTML='';
}

// ════════════════════════════════════════════════════════════════════
// MÓDULO 1: GDD Y FENOLOGÍA
// ════════════════════════════════════════════════════════════════════
function segActualizarCultivoInfo(){
  const cultNom=$('seg-cultivo')?.value;
  const cult=SEG_CULTIVOS[cultNom];
  if(!cult)return;
  const el=$('seg-cult-info');if(!el)return;
  const gddTotal=cult.estadios[cult.estadios.length-1].gdd;
  el.innerHTML=`<span>🌡️ Base: <strong>${cult.base}°C</strong></span><span>📅 GDD ciclo: <strong>${gddTotal}</strong></span><span>Ky FAO: <strong>${cult.ky}</strong></span><span>🌍 Pampeano núcleo</span>`;
}

async function segCalcularGDD(){
  const cultNom=$('seg-cultivo')?.value;
  const fechaStr=$('seg-fecha-siem')?.value;
  const coordStr=$('seg-coord')?.value?.trim();
  if(!cultNom||!fechaStr){segToast('⚠️ Completá cultivo y fecha de siembra','warn');return;}
  const btn=$('btn-seg-calcular');
  if(btn){btn.innerHTML='<span class="spin"></span> Calculando...';btn.disabled=true;}
  const cult=SEG_CULTIVOS[cultNom];
  const fechaSiem=new Date(fechaStr+'T00:00:00');
  const hoy=new Date();
  let gddReal=null;let historialMeses=[];
  if(coordStr){
    const coords=segParsearCoord(coordStr);
    if(coords){
      try{gddReal=await segFetchGDDOpenMeteo(coords.lat,coords.lon,fechaSiem,hoy,cult.base);historialMeses=gddReal.historial;}
      catch(e){console.warn('Open-Meteo falló, usando estimación',e);}
    }
  }
  if(!gddReal){const r=segCalcularGDDMensual(fechaSiem,hoy,cult);SEG_STATE.gddAcumulado=r.total;historialMeses=r.historial;}
  else SEG_STATE.gddAcumulado=gddReal.total;
  SEG_STATE.cultivo=cultNom;SEG_STATE.fechaSiem=fechaStr;SEG_STATE.gddHistorial=historialMeses;
  if(coordStr)SEG_STATE.coord=coordStr;
  // Guardar en lote activo
  const lote=segLoteActivo();
  if(lote){Object.assign(lote,{cultivo:cultNom,fechaSiem:fechaStr,coord:coordStr||lote.coord,gddAcumulado:SEG_STATE.gddAcumulado,gddHistorial:historialMeses});}
  segGuardar();
  if(btn){btn.innerHTML='📊 Calcular';btn.disabled=false;}
  segRenderGDD();
  // Auto-sync a rendimiento
  rendSincronizarDesdeGDD();
  // Evaluar alertas
  segEvaluarAlertas();
  segToast(`✅ ${SEG_STATE.gddAcumulado.toLocaleString()} GDD calculados`,'ok');
}

async function segFetchGDDOpenMeteo(lat,lon,desde,hasta,base){
  const fmt=d=>d.toISOString().split('T')[0];
  const url=`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${fmt(desde)}&end_date=${fmt(hasta)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration&timezone=America%2FArgentina%2FBuenos_Aires`;
  const r=await fetch(url);const d=await r.json();
  if(!d.daily)throw new Error('Sin datos');
  const{time,temperature_2m_max:tmax,temperature_2m_min:tmin,precipitation_sum:prec,et0_fao_evapotranspiration:eto}=d.daily;
  let totalGDD=0;const porMes={};
  time.forEach((f,i)=>{
    const Tmax=Math.min(tmax[i]||0,base<=6?35:base<=8?38:40);
    const Tmin=Math.max(tmin[i]||0,base);
    const g=Math.max(0,(Tmax+Tmin)/2-base);
    totalGDD+=g;
    const mes=f.slice(0,7);
    if(!porMes[mes])porMes[mes]={gdd:0,lluvia:0,eto:0};
    porMes[mes].gdd+=g;porMes[mes].lluvia+=prec[i]||0;porMes[mes].eto+=eto[i]||0;
  });
  // Guardar datos para otros módulos
  SEG_STATE._rawDaily={time,tmax,tmin,prec,eto,lat,lon};
  const historial=Object.entries(porMes).map(([mes,v])=>({mes,gdd:Math.round(v.gdd),lluvia:Math.round(v.lluvia),eto:Math.round(v.eto)}));
  return{total:Math.round(totalGDD),historial};
}

function segCalcularGDDMensual(desde,hasta,cult){
  const tab=segGddTab(cult.base);const historial=[];let total=0;let d=new Date(desde);
  while(d<hasta){
    const mes=d.getMonth();const anio=d.getFullYear();
    const inicioMes=new Date(anio,mes,1);const finMes=new Date(anio,mes+1,0);
    const inicio=d>inicioMes?d:inicioMes;const fin=hasta<finMes?hasta:finMes;
    const frac=(fin-inicio)/(finMes-inicioMes+86400000);
    const g=Math.round(tab[mes]*frac);total+=g;
    historial.push({mes:`${anio}-${String(mes+1).padStart(2,'0')}`,gdd:g,lluvia:Math.round(HIST_PREC_MENS[mes]*frac),eto:Math.round([160,145,120,80,45,25,30,45,70,110,135,155][mes]*frac)});
    d=new Date(anio,mes+1,1);
  }
  return{total,historial};
}

function segRenderGDD(){
  const cultNom=SEG_STATE.cultivo;const cult=SEG_CULTIVOS[cultNom];if(!cult)return;
  const gdd=SEG_STATE.gddAcumulado;const gddMax=cult.estadios[cult.estadios.length-1].gdd;
  const pct=Math.min(100,Math.round(gdd/gddMax*100));
  const fechaSiem=new Date(SEG_STATE.fechaSiem+'T00:00:00');
  const diasCampania=Math.round((new Date()-fechaSiem)/86400000);
  let estadioIdx=0;
  for(let i=0;i<cult.estadios.length;i++){if(gdd>=cult.estadios[i].gdd)estadioIdx=i;else break;}
  const estadioAct=cult.estadios[estadioIdx];const estadioSig=cult.estadios[estadioIdx+1]||null;
  SEG_STATE.estadioActual=estadioAct.cod;
  const lote=segLoteActivo();if(lote)lote.estadioActual=estadioAct.cod;
  $('seg-gdd-placeholder').classList.add('hidden');$('seg-gdd-resultado').classList.remove('hidden');
  const gddHastaFlor=cult.estadios.find(e=>e.cod==='R1')?.gdd||gddMax;
  const diasHastaFlor=estadioAct.gdd<gddHastaFlor?segEstimarDias(gdd,gddHastaFlor,cult.base):null;
  $('seg-gdd-kpis').innerHTML=`
    <div class="kpi-dark"><div class="kl">GDD acumulados</div><div class="kv" style="color:var(--amber)">${gdd.toLocaleString()}</div><div class="ku">base ${cult.base}°C</div></div>
    <div class="kpi-dark"><div class="kl">Días de campaña</div><div class="kv" style="color:var(--sprout)">${diasCampania}</div><div class="ku">desde siembra</div></div>
    <div class="kpi-dark"><div class="kl">Progreso ciclo</div><div class="kv" style="color:var(--white)">${pct}%</div><div class="ku">del ciclo total</div></div>
    <div class="kpi-dark"><div class="kl">${diasHastaFlor?'Días a floración':'Post-floración'}</div><div class="kv" style="color:${diasHastaFlor?'#7AAEF5':'var(--sprout)'}">${diasHastaFlor||'✓'}</div><div class="ku">${diasHastaFlor?'estimados':'completada'}</div></div>`;
  const arc=251.2;const offset=arc-(arc*pct/100);
  const fillEl=$('seg-gauge-fill');if(fillEl)setTimeout(()=>{fillEl.style.strokeDashoffset=offset;},100);
  const gmEl=$('seg-gauge-mid');if(gmEl)gmEl.textContent=Math.round(gddMax/2);
  const gxEl=$('seg-gauge-max');if(gxEl)gxEl.textContent=gddMax;
  const gvEl=$('seg-gdd-val');if(gvEl)gvEl.textContent=gdd.toLocaleString();
  const pcEl=$('seg-pct-ciclo');if(pcEl)pcEl.textContent=`${pct}% del ciclo completo`;
  const gddHastaSig=estadioSig?estadioSig.gdd-gdd:0;
  $('seg-estadio-actual').innerHTML=`
    <div style="text-align:center;padding:.5rem 0 1rem">
      <div style="font-size:2.8rem;margin-bottom:.4rem">${estadioAct.icon}</div>
      <div style="font-family:'DM Serif Display',serif;font-size:1.3rem;color:var(--amber);margin-bottom:.3rem">${estadioAct.label}</div>
      <div style="font-size:.78rem;color:rgba(74,46,26,.6);line-height:1.5;max-width:220px;margin:0 auto">${estadioAct.desc}</div>
    </div>
    ${estadioSig?`<div style="background:rgba(74,46,26,.05);border-radius:10px;padding:.7rem;border:1px solid var(--border)">
      <div style="font-size:.65rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(74,46,26,.45);margin-bottom:.3rem">Próximo estadio</div>
      <div style="font-size:.82rem;font-weight:600;color:var(--earth)">${estadioSig.icon} ${estadioSig.label}</div>
      <div style="font-size:.73rem;color:rgba(74,46,26,.5);margin-top:.2rem">Faltan <strong>${gddHastaSig} GDD</strong> · ${segEstimarDias(gdd,estadioSig.gdd,cult.base)} días est.</div>
    </div>`:`<div class="alert ok"><span class="ai">🌾</span><div class="ac"><strong>Ciclo completado</strong> — Madurez fisiológica alcanzada.</div></div>`}`;
  $('seg-timeline').innerHTML=cult.estadios.map((e,i)=>{
    const comp=gdd>=e.gdd;const act=i===estadioIdx;
    const est=act?'actual':comp?'completado':'futuro';
    return `<div class="fen-stage"><div class="fen-dot ${est}" title="${e.desc}">${e.icon}</div><div class="fen-label ${est}">${e.cod}</div><div class="fen-gdd ${est}">${e.gdd}</div></div>`;
  }).join('');
  const alertaTexto=cult.alertas[estadioAct.cod]||(estadioSig&&cult.alertas[estadioSig.cod]?`⚠️ Próximo: ${cult.alertas[estadioSig.cod]}`:null);
  $('seg-alertas-fen').innerHTML=alertaTexto?`<div class="alert warn"><span class="ai">⚡</span><div class="ac">${alertaTexto}</div></div>`:`<div class="alert ok"><span class="ai">✅</span><div class="ac">Estadio sin alertas críticas activas para esta semana.</div></div>`;
  const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const fechasHTML=cult.estadios.map(e=>{
    const diasD=segEstimarDiasDesde(fechaSiem,e.gdd,cult.base);
    const fecha=new Date(fechaSiem);fecha.setDate(fecha.getDate()+diasD);
    const yaFue=gdd>=e.gdd;const esAct=e.cod===estadioAct.cod;
    return `<div style="padding:.8rem;border-radius:10px;border:1px solid ${esAct?'rgba(200,162,85,.3)':'var(--border)'};background:${esAct?'rgba(200,162,85,.06)':yaFue?'rgba(42,122,74,.04)':'rgba(74,46,26,.03)'}">
      <div style="font-size:1.2rem;margin-bottom:.2rem">${e.icon}</div>
      <div style="font-size:.75rem;font-weight:700;color:${esAct?'var(--amber)':yaFue?'var(--ok)':'rgba(74,46,26,.5)'}">${e.cod}</div>
      <div style="font-size:.7rem;color:rgba(74,46,26,.55);margin-top:.15rem">${fecha.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}</div>
      <div style="font-size:.63rem;color:rgba(74,46,26,.35);font-family:'DM Mono',monospace">${e.gdd} GDD</div>
      ${yaFue?'<div style="font-size:.62rem;color:var(--ok)">✓</div>':esAct?'<div style="font-size:.62rem;color:var(--amber)">●</div>':''}
    </div>`;
  }).join('');
  $('seg-fechas-clave').innerHTML=fechasHTML;
  if(SEG_STATE.gddHistorial.length>0){
    const maxG=Math.max(...SEG_STATE.gddHistorial.map(m=>m.gdd),1);
    $('seg-chart-gdd').innerHTML=SEG_STATE.gddHistorial.map(m=>{
      const pctBar=Math.round(m.gdd/maxG*100);
      const mes=parseInt(m.mes.split('-')[1])-1;
      return `<div class="chart-bar-row"><div class="chart-bar-label">${meses[mes]} '${m.mes.slice(2,4)}</div><div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pctBar}%;background:linear-gradient(90deg,var(--canopy),var(--sprout))"></div></div><div class="chart-bar-val">${m.gdd}</div></div>`;
    }).join('');
  }
}

function segEstimarDias(gddActual,gddObjetivo,base){
  const tab=segGddTab(base);const hoy=new Date();let d=new Date(hoy);let gdd=gddActual;let dias=0;
  while(gdd<gddObjetivo&&dias<365){const dm=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();gdd+=tab[d.getMonth()]/dm;d.setDate(d.getDate()+1);dias++;}return dias;
}
function segEstimarDiasDesde(fechaOrigen,gddObjetivo,base){
  const tab=segGddTab(base);let d=new Date(fechaOrigen);let gdd=0;let dias=0;
  while(gdd<gddObjetivo&&dias<365){const dm=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();gdd+=tab[d.getMonth()]/dm;d.setDate(d.getDate()+1);dias++;}return dias;
}
function segParsearCoord(str){
  const parts=str.replace(/\s/g,' ').split(/[,\s]+/).filter(Boolean);
  if(parts.length<2)return null;
  const lat=parseFloat(parts[0].replace(',','.'));const lon=parseFloat(parts[1].replace(',','.'));
  if(isNaN(lat)||isNaN(lon))return null;return{lat,lon};
}

// ════════════════════════════════════════════════════════════════════
// MÓDULO 2: NDVI
// ════════════════════════════════════════════════════════════════════
async function segCargarNDVI(){
  const coordStr=$('seg-ndvi-coord')?.value?.trim();const apiKey=$('seg-agro-key')?.value?.trim();
  if(!coordStr){segToast('⚠️ Ingresá coordenadas del lote','warn');return;}
  const coords=segParsearCoord(coordStr);if(!coords){segToast('⚠️ Coordenadas inválidas','warn');return;}
  const btn=$('btn-seg-ndvi');if(btn){btn.innerHTML='<span class="spin"></span> Cargando...';btn.disabled=true;}
  try{if(!apiKey)await segCalcularNDVIProxy(coords);else await segCargarNDVIAgromonitoring(coords,apiKey);}
  catch(e){console.error(e);segToast('⚠️ Error al cargar NDVI. Usando estimación proxy.','warn');await segCalcularNDVIProxy(coords);}
  if(btn){btn.innerHTML='🛰️ Cargar imágenes satelitales';btn.disabled=false;}
  const lote=segLoteActivo();
  if(lote){lote.ndvi=SEG_STATE.ndvi;lote.ndviHistorial=SEG_STATE.ndviHistorial;lote.ndviTipo=SEG_STATE.ndviTipo;}
  segGuardar();segEvaluarAlertas();
}
async function segCalcularNDVIProxy(coords){
  const hoy=new Date();const hace30=new Date(hoy);hace30.setDate(hoy.getDate()-30);
  const desde=SEG_STATE.fechaSiem?new Date(SEG_STATE.fechaSiem+'T00:00:00'):hace30;
  const desdeFetch=desde>hace30?hace30:desde;
  const url=`https://archive-api.open-meteo.com/v1/archive?latitude=${coords.lat}&longitude=${coords.lon}&start_date=${desdeFetch.toISOString().split('T')[0]}&end_date=${hoy.toISOString().split('T')[0]}&daily=precipitation_sum,et0_fao_evapotranspiration,temperature_2m_max&timezone=America%2FArgentina%2FBuenos_Aires`;
  const r=await fetch(url);const d=await r.json();if(!d.daily)throw new Error('Sin datos');
  const prec30=d.daily.precipitation_sum.slice(-30).reduce((a,b)=>(a||0)+(b||0),0);
  const eto30=d.daily.et0_fao_evapotranspiration.slice(-30).reduce((a,b)=>(a||0)+(b||0),0);
  const ratioHid=eto30>0?Math.min(1.2,prec30/eto30):0.5;
  const diasCamp=SEG_STATE.fechaSiem?Math.round((hoy-new Date(SEG_STATE.fechaSiem+'T00:00:00'))/86400000):60;
  const pctCiclo=Math.min(100,diasCamp/120);
  const ndviBase=pctCiclo<0.5?0.2+0.5*(pctCiclo*2):0.7-0.5*((pctCiclo-0.5)*2);
  const ndvi=Math.max(0.05,Math.min(0.90,ndviBase*Math.min(1,ratioHid+0.3)));
  const historial=d.daily.time.reduce((acc,f,i)=>{
    const mes=f.slice(0,7);if(!acc.find(m=>m.mes===mes))acc.push({mes,ndvis:[]});
    const m=acc.find(x=>x.mes===mes);const p=d.daily.precipitation_sum[i]||0;const e=d.daily.et0_fao_evapotranspiration[i]||0;
    if(e>0)m.ndvis.push(Math.max(0.05,Math.min(0.9,0.3+(p/e)*0.4)));return acc;
  },[]).map(m=>({mes:m.mes,ndvi:+(m.ndvis.reduce((a,b)=>a+b,0)/Math.max(1,m.ndvis.length)).toFixed(3)}));
  SEG_STATE.ndvi=+ndvi.toFixed(3);SEG_STATE.ndviHistorial=historial;SEG_STATE.ndviTipo='proxy';
  segRenderNDVI();
}
async function segCargarNDVIAgromonitoring(coords,apiKey){
  const radio=parseFloat($('seg-lote-radio')?.value||500);
  const polygon=segCrearPoligonoCuadrado(coords.lat,coords.lon,radio);
  const polyRes=await fetch(`https://agromonitoring.com/api/agromonitoring/polygons?appid=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'AgroMotor_lote',geo_json:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[polygon]}}})});
  const poly=await polyRes.json();if(!poly.id)throw new Error('Error polígono');
  const hasta=Math.floor(Date.now()/1000);const desde=hasta-90*86400;
  const ndviRes=await fetch(`https://agromonitoring.com/api/agromonitoring/ndvi/history?polyid=${poly.id}&appid=${apiKey}&start=${desde}&end=${hasta}`);
  const ndviData=await ndviRes.json();
  if(ndviData&&ndviData.length>0){
    const ultimo=ndviData[ndviData.length-1];
    SEG_STATE.ndvi=+(ultimo.data?.mean||0.4).toFixed(3);
    SEG_STATE.ndviHistorial=ndviData.slice(-12).map(item=>({mes:new Date(item.dt*1000).toISOString().slice(0,7),ndvi:+(item.data?.mean||0).toFixed(3)}));
    SEG_STATE.ndviTipo='real';
  }
  segRenderNDVI();
}
function segCrearPoligonoCuadrado(lat,lon,r){const d=r/111320;return[[lon-d,lat-d],[lon+d,lat-d],[lon+d,lat+d],[lon-d,lat+d],[lon-d,lat-d]];}
function segRenderNDVI(){
  const ndvi=SEG_STATE.ndvi;if(ndvi===null)return;
  $('seg-ndvi-placeholder').classList.add('hidden');$('seg-ndvi-gauge').classList.remove('hidden');
  $('seg-ndvi-val').textContent=ndvi.toFixed(2);
  const pct=Math.max(0,Math.min(100,(ndvi/0.9)*100));
  const ptr=$('seg-ndvi-pointer');if(ptr)setTimeout(()=>{ptr.style.left=pct+'%';},200);
  const tipo=SEG_STATE.ndviTipo==='real'?'Sentinel-2 real':'estimado proxy Open-Meteo';
  const fEl=$('seg-ndvi-fecha');if(fEl)fEl.textContent=`${tipo} · ${new Date().toLocaleDateString('es-AR')}`;
  let interpHtml;
  if(ndvi>=0.65)interpHtml=`<div class="alert ok"><span class="ai">🟢</span><div class="ac"><strong>Vegetación vigorosa (${ndvi.toFixed(2)})</strong> — Canopeo denso y saludable.</div></div>`;
  else if(ndvi>=0.45)interpHtml=`<div class="alert warn"><span class="ai">🟡</span><div class="ac"><strong>Vegetación moderada (${ndvi.toFixed(2)})</strong> — Monitorear de cerca.</div></div>`;
  else interpHtml=`<div class="alert danger"><span class="ai">🔴</span><div class="ac"><strong>Vegetación baja/estresada (${ndvi.toFixed(2)})</strong> — Scouting urgente.</div></div>`;
  const interpEl=$('seg-ndvi-interp');if(interpEl)interpEl.innerHTML=interpHtml;
  if(SEG_STATE.ndviHistorial.length>0){
    const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    $('seg-ndvi-chart').innerHTML=SEG_STATE.ndviHistorial.map(m=>{
      const pctBar=Math.round((m.ndvi/0.9)*100);const mes=parseInt(m.mes.split('-')[1])-1;
      const color=m.ndvi>=0.65?'var(--ok)':m.ndvi>=0.45?'var(--caution)':'var(--warn)';
      return `<div class="chart-bar-row"><div class="chart-bar-label">${meses[mes]} '${m.mes.slice(2,4)}</div><div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pctBar}%;background:${color}"></div></div><div class="chart-bar-val">${m.ndvi.toFixed(2)}</div></div>`;
    }).join('');
  }
  $('seg-ndvi-recomendaciones').classList.remove('hidden');
  const cultNom=SEG_STATE.cultivo||'el cultivo';
  $('seg-ndvi-rec-contenido').innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem">
    <div style="padding:.8rem;background:rgba(74,46,26,.03);border-radius:10px;border:1px solid var(--border)"><div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(74,46,26,.5);margin-bottom:.4rem">¿Qué indica?</div><div style="font-size:.8rem;color:rgba(74,46,26,.7);line-height:1.6">NDVI ${ndvi.toFixed(2)} para ${cultNom}: ${ndvi>=0.65?'canopeo bien desarrollado, sin estrés visible.':ndvi>=0.45?'desarrollo aceptable, revisar nutrición y agua.':'posibles problemas, verificar a campo.'}</div></div>
    <div style="padding:.8rem;background:rgba(74,46,26,.03);border-radius:10px;border:1px solid var(--border)"><div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(74,46,26,.5);margin-bottom:.4rem">Acción</div><div style="font-size:.8rem;color:rgba(74,46,26,.7);line-height:1.6">${ndvi>=0.65?'✅ Monitoreo semanal.':ndvi>=0.45?'⚠️ Scouting esta semana.':'🚨 Scouting urgente. Identificar causa.'}</div></div>
  </div><div style="margin-top:.7rem;font-size:.7rem;color:rgba(74,46,26,.4);padding:.4rem .7rem;background:rgba(74,46,26,.03);border-radius:6px">📡 ${SEG_STATE.ndviTipo==='proxy'?'NDVI estimado con ratio precipitación/ET₀ Open-Meteo — para NDVI real: registrar en agromonitoring.com e ingresar API key':'Datos reales Sentinel-2 · Agromonitoring · Resolución ~10-20m'}</div>`;
}

// ════════════════════════════════════════════════════════════════════
// MÓDULO 3: ESTRÉS HÍDRICO
// ════════════════════════════════════════════════════════════════════
async function segCalcularHidrico(){
  const coordStr=$('seg-hid-coord')?.value?.trim();const fechaStr=$('seg-hid-fecha')?.value;
  if(!coordStr||!fechaStr){segToast('⚠️ Completá coordenadas y fecha','warn');return;}
  const coords=segParsearCoord(coordStr);if(!coords){segToast('⚠️ Coordenadas inválidas','warn');return;}
  const hoy=new Date();
  try{
    const url=`https://archive-api.open-meteo.com/v1/archive?latitude=${coords.lat}&longitude=${coords.lon}&start_date=${fechaStr}&end_date=${hoy.toISOString().split('T')[0]}&daily=precipitation_sum,et0_fao_evapotranspiration&timezone=America%2FArgentina%2FBuenos_Aires`;
    const r=await fetch(url);const d=await r.json();if(!d.daily)throw new Error('Sin datos');
    const prec=d.daily.precipitation_sum.reduce((a,b)=>(a||0)+(b||0),0);
    const eto=d.daily.et0_fao_evapotranspiration.reduce((a,b)=>(a||0)+(b||0),0);
    const balance=prec-eto;const pctCobertura=eto>0?Math.min(100,Math.round(prec/eto*100)):100;
    const porMes={};
    d.daily.time.forEach((f,i)=>{const mes=f.slice(0,7);if(!porMes[mes])porMes[mes]={lluvia:0,eto:0};porMes[mes].lluvia+=d.daily.precipitation_sum[i]||0;porMes[mes].eto+=d.daily.et0_fao_evapotranspiration[i]||0;});
    const hidrico={prec:Math.round(prec),eto:Math.round(eto),balance:Math.round(balance),pctCobertura,porMes};
    SEG_STATE.hidrico=hidrico;
    const lote=segLoteActivo();if(lote)lote.hidrico=hidrico;
    // Auto-sync a rendimiento
    if($('rend-prec-acum'))$('rend-prec-acum').value=Math.round(prec);
    if($('rend-eto-acum'))$('rend-eto-acum').value=Math.round(eto);
    $('seg-hid-placeholder').classList.add('hidden');$('seg-hid-resultado').classList.remove('hidden');
    const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    $('seg-hid-kpis').innerHTML=`
      <div class="kpi-dark"><div class="kl">Lluvia acumulada</div><div class="kv" style="color:#7AAEF5">${Math.round(prec)}</div><div class="ku">mm desde siembra</div></div>
      <div class="kpi-dark"><div class="kl">ET₀ acumulada</div><div class="kv" style="color:var(--amber)">${Math.round(eto)}</div><div class="ku">mm demanda potencial</div></div>
      <div class="kpi-dark"><div class="kl">Balance neto</div><div class="kv" style="color:${balance>=0?'var(--sprout)':'var(--warn)'}">${balance>=0?'+':''}${Math.round(balance)}</div><div class="ku">mm lluvia−ET₀</div></div>
      <div class="kpi-dark"><div class="kl">Cobertura hídrica</div><div class="kv" style="color:${pctCobertura>=80?'var(--sprout)':pctCobertura>=60?'var(--amber)':'var(--warn)'}">${pctCobertura}%</div><div class="ku">de demanda ET₀</div></div>`;
    const maxVal=Math.max(...Object.values(porMes).map(m=>Math.max(m.lluvia,m.eto)),1);
    $('seg-hid-chart').innerHTML=`<div style="display:flex;gap:.5rem;margin-bottom:.5rem"><span style="display:inline-flex;align-items:center;gap:.25rem;font-size:.68rem;color:rgba(74,46,26,.5)"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#7AAEF5"></span>Lluvia</span><span style="display:inline-flex;align-items:center;gap:.25rem;font-size:.68rem;color:rgba(74,46,26,.5);margin-left:.4rem"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:rgba(200,162,85,.7)"></span>ET₀</span></div>`+
    Object.entries(porMes).map(([mes,v])=>{
      const mn=parseInt(mes.split('-')[1])-1;const pL=Math.round(v.lluvia/maxVal*100);const pE=Math.round(v.eto/maxVal*100);
      return `<div style="margin-bottom:.5rem"><div style="font-size:.68rem;color:rgba(74,46,26,.5);margin-bottom:.2rem">${meses[mn]} '${mes.slice(2,4)}</div>
        <div style="display:flex;align-items:center;gap:.4rem"><div style="flex:1;height:6px;background:rgba(74,46,26,.06);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pL}%;background:#7AAEF5;border-radius:3px"></div></div><span style="font-size:.62rem;font-family:'DM Mono',monospace;min-width:38px;color:rgba(74,46,26,.5)">${Math.round(v.lluvia)}mm</span></div>
        <div style="display:flex;align-items:center;gap:.4rem"><div style="flex:1;height:6px;background:rgba(74,46,26,.06);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pE}%;background:rgba(200,162,85,.7);border-radius:3px"></div></div><span style="font-size:.62rem;font-family:'DM Mono',monospace;min-width:38px;color:rgba(74,46,26,.5)">${Math.round(v.eto)}mm</span></div></div>`;
    }).join('');
    $('seg-hid-semaforo').innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.5rem">`+
    Object.entries(porMes).map(([mes,v])=>{
      const ratio=v.eto>0?v.lluvia/v.eto:1;const color=ratio>=0.8?'var(--sprout)':ratio>=0.5?'var(--amber)':'var(--warn)';
      const icon=ratio>=0.8?'✅':ratio>=0.5?'⚠️':'🔴';const mn=parseInt(mes.split('-')[1])-1;
      return `<div style="padding:.65rem;border-radius:9px;background:rgba(15,31,20,.3);border:1px solid ${ratio>=0.8?'rgba(42,122,74,.2)':ratio>=0.5?'rgba(184,122,32,.2)':'rgba(212,82,42,.2)'}"><div style="font-size:.62rem;color:rgba(237,224,196,.35);text-transform:uppercase;margin-bottom:.2rem">${meses[mn]} '${mes.slice(2,4)}</div><div style="font-size:1rem">${icon}</div><div style="font-size:.68rem;color:rgba(237,224,196,.55);margin-top:.15rem">${Math.round(v.lluvia)}/${Math.round(v.eto)}mm</div><div style="font-size:.63rem;color:${color};font-weight:700">${Math.round(ratio*100)}%</div></div>`;
    }).join('')+'</div><div style="margin-top:.7rem;font-size:.7rem;color:rgba(74,46,26,.4);padding:.35rem .6rem;background:rgba(74,46,26,.03);border-radius:6px">📡 Open-Meteo ERA5 · ET₀ FAO-56 diaria real · Cobertura = lluvia/ET₀</div>';
    segGuardar();segEvaluarAlertas();
    rendActualizar();
  }catch(e){console.error(e);segToast('⚠️ Error al obtener datos hídricos','warn');}
}

// ════════════════════════════════════════════════════════════════════
// MÓDULO 4 [NUEVO]: RENDIMIENTO POTENCIAL DINÁMICO
// ════════════════════════════════════════════════════════════════════
function rendSincronizarDesdeGDD(){
  const cult=SEG_CULTIVOS[SEG_STATE.cultivo];if(!cult)return;
  // Sincronizar cultivo
  if($('rend-cultivo'))$('rend-cultivo').value=SEG_STATE.cultivo;
  const lote=segLoteActivo();
  if(lote&&lote.rendObj&&$('rend-obj'))$('rend-obj').value=lote.rendObj;
  // % ciclo desde GDD
  if(SEG_STATE.gddAcumulado>0){
    const gddMax=cult.estadios[cult.estadios.length-1].gdd;
    const pct=Math.min(100,Math.round(SEG_STATE.gddAcumulado/gddMax*100));
    if($('rend-pct-ciclo'))$('rend-pct-ciclo').value=pct;
  }
  // Hídrico desde datos calculados
  if(SEG_STATE.hidrico){
    if($('rend-prec-acum'))$('rend-prec-acum').value=SEG_STATE.hidrico.prec;
    if($('rend-eto-acum'))$('rend-eto-acum').value=SEG_STATE.hidrico.eto;
  }
  rendActualizar();
}

function rendActualizar(){
  const cultNom=$('rend-cultivo')?.value||'Soja';
  const rendObj=parseFloat($('rend-obj')?.value)||3.5;
  const aguaPerfil=parseFloat($('rend-agua-perfil')?.value)||120;
  const precAcum=parseFloat($('rend-prec-acum')?.value)||0;
  const etoAcum=parseFloat($('rend-eto-acum')?.value)||0;
  const pctCiclo=parseFloat($('rend-pct-ciclo')?.value)||50;
  const cult=SEG_CULTIVOS[cultNom]||SEG_CULTIVOS.Soja;

  // ETc objetivo del cultivo para el rendimiento buscado
  const etcObj=Math.max(cult.etcMin,Math.min(cult.etcMax,cult.mmPorTon*rendObj));
  // Agua total disponible hasta ahora
  const aguaDisp=aguaPerfil+precAcum*0.8; // 80% de eficiencia de lluvia
  // ETA = agua evapotranspirada real (lo que realmente se usó)
  const eta=Math.min(aguaDisp,etoAcum>0?etoAcum:etcObj*(pctCiclo/100));
  // ETc hasta ahora (demanda del cultivo al % de ciclo actual)
  const etcHastaAhora=etcObj*(pctCiclo/100);
  // Reducción de rendimiento por déficit hídrico (FAO Ky)
  const deficitRelativo=etcHastaAhora>0?Math.max(0,1-eta/etcHastaAhora):0;
  const reduccionRend=cult.ky*deficitRelativo;
  const rendProyectado=Math.max(0,rendObj*(1-reduccionRend));
  const deltaRend=rendProyectado-rendObj;
  const pctLogro=Math.round(rendProyectado/rendObj*100);

  const datos={rendObj,rendProyectado,deltaRend,pctLogro,etcObj,aguaDisp,eta,etcHastaAhora,deficitRelativo,reduccionRend,cultNom,pctCiclo,aguaPerfil,precAcum,etoAcum};
  SEG_STATE.rendimiento=datos;
  const lote=segLoteActivo();if(lote)lote.rendimiento=datos;
  rendRender(datos);
  segGuardar();
}

function rendRender(d){
  if(!d)return;
  // Valor central
  const vEl=$('rend-val-actual');if(vEl)vEl.textContent=d.rendProyectado.toFixed(2);
  const pctEl=$('rend-pct-logro');if(pctEl)pctEl.textContent=`${d.pctLogro}% del objetivo`;
  // Barra
  const barEl=$('rend-barra-proy');const barTxt=$('rend-barra-txt');
  if(barEl)setTimeout(()=>{barEl.style.width=d.pctLogro+'%';barEl.style.background=d.pctLogro>=90?'linear-gradient(90deg,var(--canopy),var(--sprout))':d.pctLogro>=70?'linear-gradient(90deg,#6A4A10,var(--grain))':'linear-gradient(90deg,#6A1A0A,var(--warn))';},100);
  if(barTxt)barTxt.textContent=`${d.rendProyectado.toFixed(2)} / ${d.rendObj.toFixed(2)} t/ha`;
  // Delta badge
  const deltaEl=$('rend-delta-badge');
  if(deltaEl){
    const signo=d.deltaRend>=0?'+':'';
    const clase=d.pctLogro>=90?'ok':d.pctLogro>=70?'warn':'baja';
    deltaEl.className=`rend-delta ${clase}`;
    deltaEl.innerHTML=`${signo}${d.deltaRend.toFixed(2)} t/ha vs objetivo ${d.rendObj} t/ha`;
  }
  // Factores
  const factEl=$('rend-factores');
  if(factEl){
    const cobertura=d.etcHastaAhora>0?Math.min(100,Math.round(d.eta/d.etcHastaAhora*100)):100;
    const rows=[
      {label:'Rend. objetivo',val:`${d.rendObj.toFixed(2)} t/ha`,color:'rgba(74,46,26,.7)',icon:'🎯'},
      {label:'ETc del ciclo',val:`${Math.round(d.etcObj)} mm`,color:'rgba(74,46,26,.7)',icon:'💧'},
      {label:'Agua disponible',val:`${Math.round(d.aguaDisp)} mm`,color:'rgba(74,46,26,.7)',icon:'🌧️'},
      {label:'Cobertura ETc',val:`${cobertura}%`,color:cobertura>=80?'var(--ok)':cobertura>=60?'var(--caution)':'var(--warn)',icon:cobertura>=80?'✅':'⚠️'},
      {label:'Déficit relativo',val:`${Math.round(d.deficitRelativo*100)}%`,color:d.deficitRelativo<0.2?'var(--ok)':d.deficitRelativo<0.4?'var(--caution)':'var(--warn)',icon:d.deficitRelativo<0.2?'✅':'⚠️'},
      {label:`Ky FAO (${SEG_CULTIVOS[d.cultNom]?.ky||0.85})`,val:`-${Math.round(d.reduccionRend*100)}%`,color:d.reduccionRend<0.1?'var(--ok)':d.reduccionRend<0.25?'var(--caution)':'var(--warn)',icon:'📉'},
    ];
    factEl.innerHTML='<table style="width:100%;border-collapse:collapse">'+
    rows.map((r,i)=>`<tr style="border-bottom:1px solid rgba(74,46,26,.07)"><td style="padding:.5rem .6rem;font-size:.75rem;color:rgba(74,46,26,.5)">${r.icon} ${r.label}</td><td style="padding:.5rem .6rem;font-size:.82rem;font-weight:700;text-align:right;color:${r.color}">${r.val}</td></tr>`).join('')+
    '</table>';}

  // Escenarios de cierre
  const escEl=$('rend-escenarios');
  if(escEl){
    const cult=SEG_CULTIVOS[d.cultNom]||SEG_CULTIVOS.Soja;
    const pctRestante=(100-d.pctCiclo)/100;
    const escenarios=[
      {label:'Seco (P20)',factor:.4,color:'var(--warn)',icon:'🔴'},
      {label:'Normal-seco (P35)',factor:.7,color:'var(--caution)',icon:'🟡'},
      {label:'Normal (P50)',factor:1.0,color:'#2A5A8C',icon:'🔵'},
      {label:'Normal-húmedo (P65)',factor:1.3,color:'var(--ok)',icon:'🟢'},
      {label:'Húmedo (P80)',factor:1.6,color:'#1A4A2A',icon:'💧'},
    ];
    const precMensHist=130; // mm/mes promedio pampeano campaña
    escEl.innerHTML='<table style="width:100%;border-collapse:collapse"><thead><tr style="background:rgba(74,46,26,.05)"><th style="padding:.5rem .7rem;font-size:.63rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(74,46,26,.45);text-align:left">Escenario lluvia restante</th><th style="padding:.5rem .7rem;font-size:.63rem;text-transform:uppercase;color:rgba(74,46,26,.45)">Precip.</th><th style="padding:.5rem .7rem;font-size:.63rem;text-transform:uppercase;color:rgba(74,46,26,.45)">Rind. final</th><th style="padding:.5rem .7rem;min-width:100px;font-size:.63rem;text-transform:uppercase;color:rgba(74,46,26,.45)">vs objetivo</th></tr></thead><tbody>'+
    escenarios.map(esc=>{
      const precRest=Math.round(precMensHist*3*pctRestante*esc.factor);
      const aguaTotFinal=d.aguaDisp+precRest*0.8;
      const etaFinal=Math.min(aguaTotFinal,d.etcObj);
      const defFinal=Math.max(0,1-etaFinal/d.etcObj);
      const rFinal=Math.max(0,d.rendObj*(1-cult.ky*defFinal));
      const pctF=Math.round(rFinal/d.rendObj*100);
      const bw=Math.min(100,pctF);
      return `<tr style="border-bottom:1px solid rgba(74,46,26,.06)">
        <td style="padding:.6rem .7rem;font-size:.78rem;font-weight:600">${esc.icon} ${esc.label}</td>
        <td style="padding:.6rem .7rem;font-size:.78rem;text-align:center;font-family:'DM Mono',monospace">${precRest} mm</td>
        <td style="padding:.6rem .7rem;font-size:.85rem;font-weight:700;text-align:center;color:${esc.color}">${rFinal.toFixed(2)}</td>
        <td style="padding:.6rem .7rem;min-width:100px">
          <div style="display:flex;align-items:center;gap:.4rem">
            <div style="flex:1;height:7px;background:rgba(74,46,26,.08);border-radius:3px;overflow:hidden"><div style="height:100%;width:${bw}%;background:${esc.color};border-radius:3px"></div></div>
            <span style="font-size:.7rem;font-weight:700;color:${esc.color};min-width:32px">${pctF}%</span>
          </div>
        </td></tr>`;
    }).join('')+'</tbody></table><div style="margin-top:.5rem;font-size:.7rem;color:rgba(74,46,26,.4);padding:.35rem .6rem;background:rgba(74,46,26,.03);border-radius:6px">FAO Ky · ETc mínima calculada · Percentiles precipitación histórica pampeana · Agua actual = perfil + lluvia acumulada × 0.8 eficiencia</div>';}

  // Curva de impacto hídrico
  const curvaEl=$('rend-curva-hidrica');
  if(curvaEl){
    const cult=SEG_CULTIVOS[d.cultNom]||SEG_CULTIVOS.Soja;
    const puntos=[];
    for(let cob=0;cob<=120;cob+=10){
      const def=Math.max(0,1-cob/100);
      const r=Math.max(0,d.rendObj*(1-cult.ky*def));
      puntos.push({cob,r});
    }
    const maxR=d.rendObj;
    curvaEl.innerHTML='<div style="display:flex;align-items:flex-end;gap:2px;height:80px;padding-bottom:.3rem">'
      +puntos.map(p=>{
        const h=Math.round((p.r/maxR)*100);
        const color=p.cob>=80?'var(--ok)':p.cob>=60?'var(--caution)':'var(--warn)';
        const esActual=Math.abs(p.cob-(d.etcHastaAhora>0?Math.round(d.eta/d.etcHastaAhora*100):100))<=5;
        return `<div style="flex:1;height:${Math.max(4,h)}%;background:${color};border-radius:2px 2px 0 0;opacity:${esActual?1:.45};border:${esActual?'2px solid white':''};position:relative;transition:height .8s" title="Cobertura ${p.cob}% → ${p.r.toFixed(2)} t/ha">${esActual?`<div style="position:absolute;bottom:100%;left:50%;transform:translateX(-50%);font-size:.55rem;color:white;white-space:nowrap;background:rgba(0,0,0,.5);padding:.1rem .2rem;border-radius:2px;margin-bottom:2px">▲</div>`:''}`;
      }).join('')+'</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:.6rem;font-family:DM Mono,monospace;color:rgba(61,34,16,.35);margin-top:.2rem">'
      +puntos.filter((_,i)=>i%2===0).map(p=>`<span>${p.cob}%</span>`).join('')+'</div>'
      +`<div style="text-align:center;font-size:.7rem;color:rgba(74,46,26,.45);margin-top:.4rem">% cobertura ETc → rendimiento (t/ha) · triángulo ▲ = posición actual</div>`;
  }
}

// ════════════════════════════════════════════════════════════════════
// MÓDULO 5 [NUEVO]: COMPARACIÓN VS HISTÓRICO
// ════════════════════════════════════════════════════════════════════
async function histComparar(){
  const coordStr=$('hist-coord')?.value?.trim();const fechaStr=$('hist-fecha-siem')?.value;
  if(!coordStr||!fechaStr){segToast('⚠️ Completá coordenadas y fecha de siembra','warn');return;}
  const coords=segParsearCoord(coordStr);if(!coords){segToast('⚠️ Coordenadas inválidas','warn');return;}
  const btn=$('btn-hist');if(btn){btn.innerHTML='<span class="spin"></span> Comparando...';btn.disabled=true;}
  try{
    const hoy=new Date();const fechaSiem=new Date(fechaStr+'T00:00:00');
    const diasCamp=Math.round((hoy-fechaSiem)/86400000);
    // Datos actuales
    const urlActual=`https://archive-api.open-meteo.com/v1/archive?latitude=${coords.lat}&longitude=${coords.lon}&start_date=${fechaStr}&end_date=${hoy.toISOString().split('T')[0]}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=America%2FArgentina%2FBuenos_Aires`;
    const rA=await fetch(urlActual);const dA=await rA.json();
    if(!dA.daily)throw new Error('Sin datos actuales');
    const precActual=dA.daily.precipitation_sum.reduce((a,b)=>(a||0)+(b||0),0);
    // GDD actual (base soja 10°C como referencia)
    const cultNom=SEG_STATE.cultivo||'Soja';const cult=SEG_CULTIVOS[cultNom]||SEG_CULTIVOS.Soja;
    let gddActual=0;
    dA.daily.temperature_2m_max.forEach((tmax,i)=>{const tmin=dA.daily.temperature_2m_min[i]||0;gddActual+=Math.max(0,(Math.min(tmax||0,40)+Math.max(tmin,cult.base))/2-cult.base);});
    // Histórico: calcular qué debería haber acumulado en el mismo período
    const mesinicioSiem=fechaSiem.getMonth();const tab=segGddTab(cult.base);
    let gddHist=0;let precHist=0;let d=new Date(fechaSiem);
    while(d<=hoy){
      const mes=d.getMonth();const dm=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
      gddHist+=tab[mes]/dm;precHist+=HIST_PREC_MENS[mes]/dm;
      d.setDate(d.getDate()+1);
    }
    // Percentil aproximado (posición relativa)
    const pctGDD=Math.min(100,Math.round(gddActual/Math.max(gddHist,1)*100));
    const pctPrec=Math.min(150,Math.round(precActual/Math.max(precHist,1)*100));
    const desvGDD=gddActual-gddHist;const desvPrec=precActual-precHist;
    // Por mes
    const porMesAct={};const porMesHist={};
    dA.daily.time.forEach((f,i)=>{
      const mes=f.slice(0,7);if(!porMesAct[mes])porMesAct[mes]={prec:0,gdd:0};
      porMesAct[mes].prec+=dA.daily.precipitation_sum[i]||0;
      const tmax=dA.daily.temperature_2m_max[i]||0;const tmin=dA.daily.temperature_2m_min[i]||0;
      porMesAct[mes].gdd+=Math.max(0,(Math.min(tmax,40)+Math.max(tmin,cult.base))/2-cult.base);
    });
    Object.entries(porMesAct).forEach(([mes])=>{
      const mn=parseInt(mes.split('-')[1])-1;const dm=new Date(parseInt(mes.slice(0,4)),mn+1,0).getDate();
      porMesHist[mes]={prec:Math.round(HIST_PREC_MENS[mn]),gdd:Math.round(tab[mn])};
    });
    $('hist-placeholder').classList.add('hidden');$('hist-resultado').classList.remove('hidden');
    const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    // KPIs
    $('hist-kpis').innerHTML=`
      <div class="kpi-dark"><div class="kl">Lluvia actual</div><div class="kv" style="color:#7AAEF5">${Math.round(precActual)}</div><div class="ku">mm acumulados</div></div>
      <div class="kpi-dark"><div class="kl">Lluvia histórica</div><div class="kv" style="color:rgba(237,224,196,.5)">${Math.round(precHist)}</div><div class="ku">mm promedio</div></div>
      <div class="kpi-dark"><div class="kl">GDD actuales</div><div class="kv" style="color:var(--amber)">${Math.round(gddActual)}</div><div class="ku">base ${cult.base}°C</div></div>
      <div class="kpi-dark"><div class="kl">GDD histórico</div><div class="kv" style="color:rgba(237,224,196,.5)">${Math.round(gddHist)}</div><div class="ku">promedio 30 años</div></div>`;
    // Gráfico lluvia
    const maxPrec=Math.max(...Object.entries(porMesAct).map(([m,v])=>Math.max(v.prec,porMesHist[m]?.prec||0)),1);
    $('hist-chart-lluvia').innerHTML=`<div style="display:flex;gap:.3rem;margin-bottom:.4rem">
      <span style="display:inline-flex;align-items:center;gap:.25rem;font-size:.68rem;color:rgba(74,46,26,.5)"><span style="display:inline-block;width:8px;height:8px;background:#7AAEF5;border-radius:2px"></span>Actual</span>
      <span style="display:inline-flex;align-items:center;gap:.25rem;font-size:.68rem;color:rgba(74,46,26,.5);margin-left:.4rem"><span style="display:inline-block;width:8px;height:8px;background:rgba(237,224,196,.3);border-radius:2px"></span>Histórico</span>
    </div>`+
    Object.entries(porMesAct).map(([mes,v])=>{
      const mn=parseInt(mes.split('-')[1])-1;const hist=porMesHist[mes]||{prec:0};
      const pA=Math.round(v.prec/maxPrec*100);const pH=Math.round(hist.prec/maxPrec*100);
      const ratio=hist.prec>0?v.prec/hist.prec:1;
      const badge=ratio>=1.1?`<span class="hist-badge sobre">+${Math.round((ratio-1)*100)}%</span>`:ratio<=0.7?`<span class="hist-badge bajo">${Math.round((ratio-1)*100)}%</span>`:`<span class="hist-badge normal">normal</span>`;
      return `<div style="margin-bottom:.5rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem"><div style="font-size:.68rem;color:rgba(74,46,26,.5)">${meses[mn]} '${mes.slice(2,4)}</div>${badge}</div>
        <div class="hist-bar-wrap" style="margin-bottom:2px"><div class="hist-bar-track"><div class="hist-bar-fill" style="width:${pA}%;background:#7AAEF5"></div></div><div class="hist-bar-val">${Math.round(v.prec)}mm</div></div>
        <div class="hist-bar-wrap"><div class="hist-bar-track"><div class="hist-bar-fill" style="width:${pH}%;background:rgba(237,224,196,.25)"></div></div><div class="hist-bar-val">${hist.prec}mm</div></div>
      </div>`;
    }).join('');
    // Gráfico GDD
    const maxGDD=Math.max(...Object.entries(porMesAct).map(([m,v])=>Math.max(v.gdd,porMesHist[m]?.gdd||0)),1);
    $('hist-chart-gdd').innerHTML=Object.entries(porMesAct).map(([mes,v])=>{
      const mn=parseInt(mes.split('-')[1])-1;const hist=porMesHist[mes]||{gdd:0};
      const pA=Math.round(v.gdd/maxGDD*100);const pH=Math.round(hist.gdd/maxGDD*100);
      const ratio=hist.gdd>0?v.gdd/hist.gdd:1;
      const color=ratio>=1.05?'var(--warn)':ratio>=0.95?'var(--ok)':'#7AAEF5';
      const badge=ratio>=1.05?`<span class="hist-badge" style="background:rgba(212,82,42,.1);color:var(--warn)">+${Math.round((ratio-1)*100)}% calor</span>`:ratio<=0.95?`<span class="hist-badge azul">${Math.round((ratio-1)*100)}% fresco</span>`:`<span class="hist-badge normal">normal</span>`;
      return `<div style="margin-bottom:.5rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem"><div style="font-size:.68rem;color:rgba(74,46,26,.5)">${meses[mn]} '${mes.slice(2,4)}</div>${badge}</div>
        <div class="hist-bar-wrap" style="margin-bottom:2px"><div class="hist-bar-track"><div class="hist-bar-fill" style="width:${pA}%;background:${color}"></div></div><div class="hist-bar-val">${Math.round(v.gdd)}</div></div>
        <div class="hist-bar-wrap"><div class="hist-bar-track"><div class="hist-bar-fill" style="width:${pH}%;background:rgba(237,224,196,.2)"></div></div><div class="hist-bar-val">${hist.gdd}</div></div>
      </div>`;
    }).join('');
    // Percentil visual
    const pctFinalPrec=Math.min(150,pctPrec);const pctFinalGDD=Math.min(150,pctGDD);
    $('hist-percentil').innerHTML=`
      <div style="margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;font-weight:600;color:rgba(74,46,26,.65);margin-bottom:.3rem">
          <span>💧 Lluvia: ${Math.round(precActual)} mm actual vs ${Math.round(precHist)} mm histórico</span>
          <span style="color:${pctFinalPrec>=100?'#7AAEF5':pctFinalPrec>=80?'var(--ok)':pctFinalPrec>=50?'var(--caution)':'var(--warn)'}">${pctFinalPrec}%</span>
        </div>
        <div style="height:14px;background:rgba(74,46,26,.08);border-radius:7px;overflow:hidden;position:relative">
          <div style="height:100%;width:${Math.min(100,pctFinalPrec)}%;background:${pctFinalPrec>=100?'#7AAEF5':pctFinalPrec>=80?'var(--ok)':pctFinalPrec>=50?'var(--caution)':'var(--warn)'};border-radius:7px;transition:width 1s"></div>
          <div style="position:absolute;top:0;bottom:0;left:50%;width:2px;background:rgba(74,46,26,.3)"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.62rem;color:rgba(74,46,26,.35);margin-top:.15rem"><span>Muy seco</span><span>Histórico</span><span>Muy húmedo</span></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:.75rem;font-weight:600;color:rgba(74,46,26,.65);margin-bottom:.3rem">
          <span>🌡️ GDD: ${Math.round(gddActual)} actual vs ${Math.round(gddHist)} histórico</span>
          <span style="color:${pctFinalGDD>=105?'var(--warn)':pctFinalGDD>=95?'var(--ok)':'#7AAEF5'}">${pctFinalGDD}%</span>
        </div>
        <div style="height:14px;background:rgba(74,46,16,.08);border-radius:7px;overflow:hidden;position:relative">
          <div style="height:100%;width:${Math.min(100,pctFinalGDD)}%;background:${pctFinalGDD>=105?'var(--warn)':pctFinalGDD>=95?'var(--ok)':'#7AAEF5'};border-radius:7px;transition:width 1s"></div>
          <div style="position:absolute;top:0;bottom:0;left:50%;width:2px;background:rgba(74,46,26,.3)"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.62rem;color:rgba(74,46,26,.35);margin-top:.15rem"><span>Año fresco</span><span>Histórico</span><span>Año cálido</span></div>
      </div>`;
    // Diagnóstico
    let diag=[];
    if(pctPrec<70)diag.push({tipo:'danger',txt:`<strong>Campaña seca (${pctFinalPrec}% del histórico)</strong> — La precipitación acumulada está ${Math.round(precHist-precActual)} mm por debajo del promedio. Riesgo hídrico elevado para estadios críticos.`});
    else if(pctPrec>130)diag.push({tipo:'info',txt:`<strong>Campaña húmeda (${pctFinalPrec}% del histórico)</strong> — Precipitación ${Math.round(precActual-precHist)} mm sobre el promedio. Evaluar riesgos de enfermedades foliares y compactación.`});
    else diag.push({tipo:'ok',txt:`<strong>Precipitación dentro del rango histórico</strong> — Acumulado (${Math.round(precActual)} mm) dentro de la variabilidad normal de la región.`});
    if(pctGDD>108)diag.push({tipo:'warn',txt:`<strong>Campaña más cálida de lo normal (+${Math.round(desvGDD)} GDD)</strong> — El cultivo está avanzando más rápido que el promedio histórico. Anticipar los estadios críticos en el calendario.`});
    else if(pctGDD<92)diag.push({tipo:'info',txt:`<strong>Campaña más fresca de lo normal (${Math.round(desvGDD)} GDD)</strong> — El ciclo está más lento de lo habitual. Los estadios se alcanzarán más tarde.`});
    else diag.push({tipo:'ok',txt:`<strong>Temperatura dentro del rango histórico</strong> — La acumulación de GDD sigue el ritmo normal del período.`});
    $('hist-diagnostico').innerHTML=diag.map(d=>`<div class="alert ${d.tipo}"><span class="ai">${d.tipo==='danger'?'🚨':d.tipo==='warn'?'⚠️':d.tipo==='info'?'ℹ️':'✅'}</span><div class="ac">${d.txt}</div></div>`).join('')+
    '<div style="margin-top:.7rem;font-size:.7rem;color:rgba(74,46,26,.4);padding:.35rem .6rem;background:rgba(74,46,26,.03);border-radius:6px">📡 Datos actuales: Open-Meteo ERA5 · Histórico: NASA POWER 1991-2020 · Zona pampeana núcleo (ajustar para zonas marginales)</div>';
    SEG_STATE.historico={pctPrec:pctFinalPrec,pctGDD:pctFinalGDD,precActual:Math.round(precActual),precHist:Math.round(precHist),gddActual:Math.round(gddActual),gddHist:Math.round(gddHist)};
    segGuardar();
  }catch(e){console.error(e);segToast('⚠️ Error al comparar con histórico','warn');}
  if(btn){btn.innerHTML='📊 Comparar';btn.disabled=false;}
}

// ════════════════════════════════════════════════════════════════════
// BITÁCORA
// ════════════════════════════════════════════════════════════════════
let bitFiltroActivo='todos';
function bitRegistrar(){
  const tipo=$('bit-tipo')?.value||'otro';const fecha=$('bit-fecha')?.value;
  const estadio=$('bit-estadio')?.value||'';const producto=$('bit-producto')?.value?.trim()||'';
  const dosis=$('bit-dosis')?.value?.trim()||'';const obs=$('bit-obs')?.value?.trim()||'';
  if(!fecha){segToast('⚠️ Ingresá la fecha','warn');return;}
  if(!producto&&!obs){segToast('⚠️ Ingresá producto u observación','warn');return;}
  const item={id:Date.now(),tipo,fecha,estadio,producto,dosis,obs,loteId:SEG_LOTE_ACTIVO};
  SEG_STATE.bitacora.unshift(item);
  const lote=segLoteActivo();if(lote)lote.bitacora=SEG_STATE.bitacora;
  segGuardar();
  if($('bit-producto'))$('bit-producto').value='';if($('bit-dosis'))$('bit-dosis').value='';if($('bit-obs'))$('bit-obs').value='';
  bitRenderLista();segToast('✅ Labor registrada','ok');
}
function bitEliminar(id){SEG_STATE.bitacora=SEG_STATE.bitacora.filter(b=>b.id!==id);const lote=segLoteActivo();if(lote)lote.bitacora=SEG_STATE.bitacora;segGuardar();bitRenderLista();}
function bitFiltrar(tipo){
  bitFiltroActivo=tipo;
  document.querySelectorAll('[id^="bfil-"]').forEach(b=>{b.style.background='';b.style.borderColor='';b.style.color='';});
  const a=$(`bfil-${tipo}`);if(a){a.style.background='rgba(109,191,130,.15)';a.style.borderColor='rgba(109,191,130,.3)';a.style.color='var(--sprout)';}
  bitRenderLista();
}
function bitRenderLista(){
  const lista=bitFiltroActivo==='todos'?SEG_STATE.bitacora:SEG_STATE.bitacora.filter(b=>b.tipo===bitFiltroActivo);
  const cEl=$('bit-contador');if(cEl)cEl.textContent=`${SEG_STATE.bitacora.length}`;
  const empty=$('bit-empty');const listaEl=$('bit-lista');if(!listaEl)return;
  if(lista.length===0){if(empty)empty.classList.remove('hidden');listaEl.querySelectorAll('.bitacora-item').forEach(e=>e.remove());return;}
  if(empty)empty.classList.add('hidden');
  listaEl.innerHTML=lista.map(item=>{
    const cfg=BIT_COLORES[item.tipo]||BIT_COLORES.otro;
    const f=new Date(item.fecha+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'});
    return `<div class="bitacora-item"><div class="bit-icon" style="background:${cfg.bg};border:1px solid ${cfg.border}">${cfg.icon}</div>
      <div class="bit-body"><div class="bit-titulo">${cfg.label}${item.producto?' — '+item.producto:''}</div>
      <div class="bit-meta">📅 ${f}${item.estadio?' · '+item.estadio:''}${item.dosis?' · '+item.dosis:''}</div>
      ${item.obs?`<div style="font-size:.74rem;color:rgba(74,46,26,.55);margin-top:.2rem;font-style:italic">${item.obs}</div>`:''}</div>
      <button class="bit-delete" onclick="bitEliminar(${item.id})">✕</button></div>`;
  }).join('');
  const resEl=$('bit-resumen');const resCard=$('bit-resumen-card');
  if(resEl&&SEG_STATE.bitacora.length>0){
    const porTipo=SEG_STATE.bitacora.reduce((acc,b)=>{acc[b.tipo]=(acc[b.tipo]||0)+1;return acc;},{});
    resEl.innerHTML=Object.entries(porTipo).map(([t,n])=>{const c=BIT_COLORES[t]||BIT_COLORES.otro;return `<div class="chart-bar-row"><div class="chart-bar-label">${c.icon} ${c.label}</div><div class="chart-bar-track"><div class="chart-bar-fill" style="width:${n/SEG_STATE.bitacora.length*100}%;background:${c.border}"></div></div><div class="chart-bar-val">${n}</div></div>`;}).join('');
    if(resCard)resCard.classList.remove('hidden');
  }
}

// ════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════
function segGenerarDashboard(){
  const cultNom=SEG_STATE.cultivo;const fechaSiem=SEG_STATE.fechaSiem;
  if(!cultNom&&!fechaSiem&&SEG_STATE.bitacora.length===0){$('seg-dash-placeholder').classList.remove('hidden');$('seg-dash-contenido').classList.add('hidden');return;}
  $('seg-dash-placeholder').classList.add('hidden');$('seg-dash-contenido').classList.remove('hidden');
  const cult=cultNom?SEG_CULTIVOS[cultNom]:null;
  const dias=fechaSiem?Math.round((new Date()-new Date(fechaSiem+'T00:00:00'))/86400000):null;
  const lote=segLoteActivo();
  const cEl=$('dash-cult-nombre');if(cEl)cEl.textContent=cultNom?`${cult.emoji} ${cult.nombre}${lote?' · '+lote.nombre:''}`:lote?'🌾 '+lote.nombre:'🌾 Campaña';
  const sEl=$('dash-siem-info');if(sEl)sEl.textContent=fechaSiem?`Siembra: ${new Date(fechaSiem+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'})}${lote?` · ${lote.sup} ha`:''}`:'Sin fecha';
  const dEl=$('dash-dias');if(dEl)dEl.textContent=dias!==null?dias:'—';
  const gdd=SEG_STATE.gddAcumulado;const ndvi=SEG_STATE.ndvi;const rend=SEG_STATE.rendimiento;
  // Semáforo fenológico
  const colorFen=gdd>0?'verde':'amarillo';
  const semFen=$('dash-sem-fen');if(semFen){semFen.className=`sem-luz ${colorFen}`;semFen.textContent='🌡️';}
  const sfv=$('dash-sem-fen-val');if(sfv)sfv.textContent=gdd>0?`${SEG_STATE.estadioActual||'—'} · ${gdd.toLocaleString()} GDD`:'Sin calcular';
  // Semáforo hídrico
  const hid=SEG_STATE.hidrico;const cobHid=hid?hid.pctCobertura:null;
  const colorHid=cobHid===null?'amarillo':cobHid>=80?'verde':cobHid>=55?'amarillo':'rojo';
  const semHid=$('dash-sem-hid');if(semHid){semHid.className=`sem-luz ${colorHid}`;semHid.textContent='💧';}
  const shv=$('dash-sem-hid-val');if(shv)shv.textContent=cobHid!==null?`${cobHid}% cobertura ET₀`:'Ver módulo hídrico';
  // Semáforo rendimiento
  const pctRend=rend?rend.pctLogro:null;
  const colorRend=pctRend===null?'amarillo':pctRend>=90?'verde':pctRend>=70?'amarillo':'rojo';
  const semRend=$('dash-sem-rend');if(semRend){semRend.className=`sem-luz ${colorRend}`;semRend.textContent='🌾';}
  const srv=$('dash-sem-rend-val');if(srv)srv.textContent=rend?`${rend.rendProyectado.toFixed(2)} t/ha proy.`:'Calcular rendimiento';
  // KPIs
  $('dash-kpis').innerHTML=`
    <div class="kpi-dark"><div class="kl">Estadio actual</div><div class="kv" style="font-size:1.4rem;color:var(--amber)">${SEG_STATE.estadioActual||'—'}</div><div class="ku">${gdd>0?gdd.toLocaleString()+' GDD':'Sin calcular'}</div></div>
    <div class="kpi-dark"><div class="kl">NDVI del lote</div><div class="kv" style="font-size:1.6rem;color:${ndvi?(ndvi>=0.65?'var(--sprout)':ndvi>=0.45?'var(--amber)':'var(--warn)'):'rgba(237,224,196,.3)'}">${ndvi?ndvi.toFixed(2):'—'}</div><div class="ku">${ndvi?(ndvi>=0.65?'vigor alto':ndvi>=0.45?'moderado':'bajo'):'Sin cargar'}</div></div>
    <div class="kpi-dark"><div class="kl">Rend. proyectado</div><div class="kv" style="font-size:1.4rem;color:${pctRend?(pctRend>=90?'var(--sprout)':pctRend>=70?'var(--amber)':'var(--warn)'):'rgba(237,224,196,.3)'}">${rend?rend.rendProyectado.toFixed(2)+'':'—'}</div><div class="ku">${rend?'t/ha · '+rend.pctLogro+'% obj.':'Sin calcular'}</div></div>
    <div class="kpi-dark"><div class="kl">Labores bitácora</div><div class="kv" style="color:var(--white)">${SEG_STATE.bitacora.length}</div><div class="ku">registradas</div></div>`;
  // Acciones
  const acciones=[];
  if(!cultNom||!fechaSiem)acciones.push({ico:'🌾',txt:'Configurar cultivo y fecha de siembra',prior:'alta'});
  if(gdd===0)acciones.push({ico:'📊',txt:'Calcular GDD acumulados para determinar estadio fenológico',prior:'alta'});
  if(!ndvi)acciones.push({ico:'🛰️',txt:'Cargar NDVI satelital del lote',prior:'media'});
  if(!hid)acciones.push({ico:'💧',txt:'Calcular balance hídrico acumulado desde siembra',prior:'media'});
  if(!rend)acciones.push({ico:'📈',txt:'Sincronizar y calcular rendimiento potencial',prior:'media'});
  if(cult&&gdd>0&&cult.alertas[SEG_STATE.estadioActual])acciones.push({ico:'⚡',txt:cult.alertas[SEG_STATE.estadioActual].replace(/<[^>]+>/g,''),prior:'alta'});
  if(SEG_STATE.bitacora.filter(b=>b.tipo==='scouting').length===0)acciones.push({ico:'🔍',txt:'Realizar primer scouting del lote',prior:'media'});
  if(acciones.length===0)acciones.push({ico:'✅',txt:'Todo en orden. Continuar monitoreo regular.',prior:'baja'});
  const cP={alta:'rgba(212,82,42,.15)',media:'rgba(200,162,85,.1)',baja:'rgba(42,122,74,.08)'};
  const bP={alta:'rgba(212,82,42,.3)',media:'rgba(200,162,85,.25)',baja:'rgba(42,122,74,.2)'};
  $('dash-acciones').innerHTML=acciones.map(a=>`<div style="display:flex;gap:.7rem;padding:.65rem .9rem;border-radius:10px;background:${cP[a.prior]};border:1px solid ${bP[a.prior]};margin-bottom:.5rem;align-items:flex-start"><span style="font-size:1rem;flex-shrink:0">${a.ico}</span><span style="font-size:.8rem;color:rgba(74,46,26,.75);line-height:1.5">${a.txt}</span></div>`).join('');
  // Alertas proactivas en dashboard
  if(SEG_ALERTAS_PENDIENTES.length>0){
    const alertasBanner=SEG_ALERTAS_PENDIENTES.slice(0,3).map(a=>`<div class="alert ${a.tipo==='danger'?'danger':'warn'}"><span class="ai">${a.tipo==='danger'?'🚨':'⚠️'}</span><div class="ac">${a.msg} <span style="font-weight:700">· ${a.lote}</span></div></div>`).join('');
    $('dash-acciones').innerHTML=alertasBanner+$('dash-acciones').innerHTML;
  }
  const ultimos=SEG_STATE.bitacora.slice(0,5);
  $('dash-ultimos-eventos').innerHTML=ultimos.length===0?`<div style="text-align:center;padding:1.2rem;color:rgba(74,46,26,.35);font-size:.82rem">Sin eventos registrados</div>`:
  ultimos.map(item=>{const cfg=BIT_COLORES[item.tipo]||BIT_COLORES.otro;const f=new Date(item.fecha+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short'});return `<div class="bitacora-item"><div class="bit-icon" style="background:${cfg.bg};border:1px solid ${cfg.border}">${cfg.icon}</div><div class="bit-body"><div class="bit-titulo">${cfg.label}${item.producto?' — '+item.producto:''}</div><div class="bit-meta">📅 ${f}${item.estadio?' · '+item.estadio:''}</div></div></div>`;}).join('');
}

function segExportarPDF(){
  if(typeof window.jspdf==='undefined'&&typeof jsPDF==='undefined'){segToast('⚠️ jsPDF disponible en AgroMotor completo','warn');return;}
  const{jsPDF:JPDF}=window.jspdf||{};if(!JPDF){alert('PDF disponible en AgroMotor completo.');return;}
  const lote=segLoteActivo();const doc=new JPDF();
  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('AgroMotor — Resumen de Campaña',20,20);
  doc.setFontSize(11);doc.setFont('helvetica','normal');
  doc.text(`Lote: ${lote?.nombre||'—'}  ·  Campo: ${lote?.estab||'—'}  ·  Sup: ${lote?.sup||'—'} ha`,20,32);
  doc.text(`Cultivo: ${SEG_STATE.cultivo||'—'}  ·  Siembra: ${SEG_STATE.fechaSiem||'—'}  ·  Objetivo: ${lote?.rendObj||'—'} t/ha`,20,40);
  doc.text(`GDD acumulados: ${SEG_STATE.gddAcumulado}  ·  Estadio: ${SEG_STATE.estadioActual||'—'}  ·  NDVI: ${SEG_STATE.ndvi||'—'}`,20,48);
  if(SEG_STATE.rendimiento)doc.text(`Rendimiento proyectado: ${SEG_STATE.rendimiento.rendProyectado.toFixed(2)} t/ha (${SEG_STATE.rendimiento.pctLogro}% del objetivo)`,20,56);
  if(SEG_STATE.hidrico)doc.text(`Balance hídrico: ${SEG_STATE.hidrico.prec}mm lluvia · ${SEG_STATE.hidrico.eto}mm ET₀ · ${SEG_STATE.hidrico.pctCobertura}% cobertura`,20,64);
  doc.text(`Labores registradas: ${SEG_STATE.bitacora.length}  ·  Generado: ${new Date().toLocaleDateString('es-AR')}`,20,72);
  if(SEG_STATE.bitacora.length>0){
    doc.setFont('helvetica','bold');doc.text('Bitácora de labores:',20,84);doc.setFont('helvetica','normal');
    SEG_STATE.bitacora.slice(0,18).forEach((b,i)=>{const cfg=BIT_COLORES[b.tipo];doc.text(`${b.fecha} · ${cfg?.label||b.tipo}${b.producto?' · '+b.producto:''}${b.dosis?' · '+b.dosis:''}`,22,92+i*7);});
  }
  doc.save(`AgroMotor-${lote?.nombre||'Campaña'}-${new Date().toISOString().split('T')[0]}.pdf`);
  segToast('📄 PDF exportado','ok');
}

// ════════════════════════════════════════════════════════════════════
// NAVEGACIÓN TABS
// ════════════════════════════════════════════════════════════════════
function segCambiarTab(tab){
  document.querySelectorAll('.seg-panel').forEach(p=>p.classList.add('hidden'));
  document.querySelectorAll('.seg-tab').forEach(t=>t.classList.remove('active'));
  const panel=$(`seg-panel-${tab}`);const btn=$(`seg-t-${tab}`);
  if(panel)panel.classList.remove('hidden');if(btn)btn.classList.add('active');
  if(tab==='dashboard')segGenerarDashboard();
  if(tab==='rendimiento'){rendSincronizarDesdeGDD();rendActualizar();}
}

// ════════════════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════════════════
function segToast(msg,tipo='ok'){
  if(typeof amToast==='function'){amToast(msg,tipo);return;}
  const existing=document.querySelector('.seg-toast');if(existing)existing.remove();
  const t=document.createElement('div');t.className='seg-toast';
  t.style.cssText=`position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);z-index:9999;padding:.75rem 1.4rem;border-radius:10px;font-size:.84rem;font-weight:600;font-family:'DM Sans',sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.25);animation:segToastIn .3s ease both;max-width:340px;text-align:center;background:${tipo==='ok'?'rgba(42,122,74,.9)':tipo==='warn'?'rgba(184,122,32,.9)':'rgba(26,15,8,.9)'};color:white;border:1px solid ${tipo==='ok'?'rgba(109,191,130,.4)':'rgba(255,255,255,.15)'}`;
  t.textContent=msg;
  const style=document.createElement('style');style.textContent='@keyframes segToastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
  document.head.appendChild(style);document.body.appendChild(t);setTimeout(()=>t.remove(),3500);
}

// ════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ════════════════════════════════════════════════════════════════════
function segInit(){
  segCargar();
  const hoy=new Date().toISOString().split('T')[0];
  if($('bit-fecha')&&!$('bit-fecha').value)$('bit-fecha').value=hoy;
  // Cargar coordenadas desde AgroMotor si existen
  const coordAM=typeof gv==='function'?(gv('s-coord')||gv('suelo-coord')||''):'';
  const cultAM=typeof gv==='function'?gv('s-cultivo'):'';
  const fechaAM=typeof gv==='function'?gv('s-fecha'):'';
  // Renderizar lotes existentes
  segRenderChips();
  // Si hay un lote activo, cargarlo
  if(SEG_LOTE_ACTIVO){const lote=SEG_LOTES.find(l=>l.id===SEG_LOTE_ACTIVO);if(lote){segCargarLote(SEG_LOTE_ACTIVO);}}
  else if(SEG_LOTES.length>0){segCargarLote(SEG_LOTES[0].id);}
  else{
    // Datos desde AgroMotor
    if(cultAM&&$('seg-cultivo'))$('seg-cultivo').value=cultAM;
    segActualizarCultivoInfo();
  }
  // Evaluar alertas al cargar
  segEvaluarAlertas();
  // Evaluar alertas cada 30 minutos
  setInterval(segEvaluarAlertas,30*60*1000);
  // Render rendimiento inicial
  rendActualizar();
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',segInit);}else{segInit();}
if(typeof AM_PLANES!=='undefined'){['asesor','empresa'].forEach(plan=>{if(AM_PLANES[plan]?.modulos&&!AM_PLANES[plan].modulos.includes('seguimiento'))AM_PLANES[plan].modulos.push('seguimiento');});}

  // Exposición a global
  window.segAbrirModalNuevoLote = segAbrirModalNuevoLote;
  window.segCerrarModalLote = segCerrarModalLote;
  window.segCrearLote = segCrearLote;
  window.segCargarLote = segCargarLote;
  window.segMostrarProximaAlerta = segMostrarProximaAlerta;
  window.segDismissAlerta = segDismissAlerta;
  window.segActualizarCultivoInfo = segActualizarCultivoInfo;
  window.segCalcularGDD = segCalcularGDD;
  window.segCargarNDVI = segCargarNDVI;
  window.segCalcularHidrico = segCalcularHidrico;
  window.rendActualizar = rendActualizar;
  window.histComparar = histComparar;
  if(typeof bitActualizarFormulario !== 'undefined') window.bitActualizarFormulario = bitActualizarFormulario;
  if(typeof bitRegistrarLabor !== 'undefined') window.bitRegistrarLabor = bitRegistrarLabor;
  if(typeof bitEliminar !== 'undefined') window.bitEliminar = bitEliminar;
  if(typeof segGenerarDashboard !== 'undefined') window.segGenerarDashboard = segGenerarDashboard;
  if(typeof segExportarPDF !== 'undefined') window.segExportarPDF = segExportarPDF;
  window.segCambiarTab = segCambiarTab;

})();
