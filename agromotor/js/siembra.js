// AGROMOTOR — siembra.js
// Diagnóstico de siembra · Open-Meteo · Score 0-100 · Pronóstico 7 días · Inversión térmica

async function buscarAPI(){
  const[lat,lon]=parsCoord(gv('s-coord'));
  if(lat===null){alert('Formato no reconocido.\nEjemplos:\n• 33°23\'42.55"S 60°11\'29.87"W\n• -33.395, -60.192');return}
  const btn=$('btn-api');btn.disabled=true;btn.textContent='⟳ Consultando...';
  setStatus('Obteniendo ubicación (OpenStreetMap)...');
  try{
    // 1. Nominatim
    let ubi=`${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,{headers:{'User-Agent':'AgroMotor/2.0'}});
      const d=await r.json(),a=d.address||{};
      const loc=a.city||a.town||a.village||a.county||'';
      const prov=a.state||'';
      ubi=[loc,prov].filter(Boolean).join(', ')||ubi;
    }catch(e){}
    $('i-ubi').textContent=ubi;

    // 2. Suelo auto
    const sa=detSuelo(lat,lon);
    if(sa){$('s-suelo').value=sa;$('i-suelo').textContent=sa+' (auto)';$('s-sbadge').textContent='← auto'}
    else{$('i-suelo').textContent='No detectado — elegir manualmente'}

    setStatus('Descargando datos meteorológicos y de suelo — Open-Meteo...');

    // 3. Open-Meteo — llamada única con TODAS las variables
    const hoy=new Date();
    const fs=gv('s-fecha');
    const fsel=fs?new Date(fs+'T12:00:00'):hoy;
    const fmt=d=>d.toISOString().split('T')[0];
    const ini=new Date(fsel);ini.setDate(ini.getDate()-3);
    const fin=new Date(fsel);fin.setDate(fin.getDate()+7);

    const url='https://api.open-meteo.com/v1/forecast?'+
      `latitude=${lat}&longitude=${lon}&timezone=auto`+
      `&start_date=${fmt(ini)}&end_date=${fmt(fin)}`+
      '&hourly=soil_temperature_6cm,soil_temperature_18cm,'+
      'soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,soil_moisture_27_to_81cm,'+
      'et0_fao_evapotranspiration,vapour_pressure_deficit,wind_speed_10m'+
      '&daily=temperature_2m_max,temperature_2m_min,'+
      'precipitation_probability_max,precipitation_sum,'+
      'et0_fao_evapotranspiration,growing_degree_days_base_0_limit_50,'+
      'wind_speed_10m_max,wind_gusts_10m_max,shortwave_radiation_sum';

    const res=await fetch(url);
    if(!res.ok)throw new Error('Open-Meteo HTTP '+res.status);
    const data=await res.json();

    // Procesar hourly → avg diario
    const h=data.hourly||{},ht=h.time||[];
    const dh={};
    ht.forEach((t,i)=>{
      const d=t.split('T')[0];
      if(!dh[d])dh[d]={st6:[],st18:[],sm39:[],sm927:[],sm2781:[],et0:[],vpd:[],wind:[]};
      if(h.soil_temperature_6cm?.[i]!=null)dh[d].st6.push(h.soil_temperature_6cm[i]);
      if(h.soil_temperature_18cm?.[i]!=null)dh[d].st18.push(h.soil_temperature_18cm[i]);
      if(h.soil_moisture_3_to_9cm?.[i]!=null)dh[d].sm39.push(h.soil_moisture_3_to_9cm[i]*100);
      if(h.soil_moisture_9_to_27cm?.[i]!=null)dh[d].sm927.push(h.soil_moisture_9_to_27cm[i]*100);
      if(h.soil_moisture_27_to_81cm?.[i]!=null)dh[d].sm2781.push(h.soil_moisture_27_to_81cm[i]*100);
      if(h.et0_fao_evapotranspiration?.[i]!=null)dh[d].et0.push(h.et0_fao_evapotranspiration[i]);
      if(h.vapour_pressure_deficit?.[i]!=null)dh[d].vpd.push(h.vapour_pressure_deficit[i]);
      if(h.wind_speed_10m?.[i]!=null)dh[d].wind.push(h.wind_speed_10m[i]);
    });
    const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;

    const dd=data.daily||{},dt=dd.time||[];
    const dias=dt.map((fecha,i)=>{
      const x=dh[fecha]||{};
      return{fecha,
        tMax:dd.temperature_2m_max?.[i]??null,tMin:dd.temperature_2m_min?.[i]??null,
        precP:dd.precipitation_probability_max?.[i]??null,precS:dd.precipitation_sum?.[i]??null,
        et0d:dd.et0_fao_evapotranspiration?.[i]??null,
        gdd:dd.growing_degree_days_base_0_limit_50?.[i]??null,
        windMax:dd.wind_speed_10m_max?.[i]??null,
        rad:dd.shortwave_radiation_sum?.[i]??null,
        st6:avg(x.st6||[]),st18:avg(x.st18||[]),
        sm39:avg(x.sm39||[]),sm927:avg(x.sm927||[]),sm2781:avg(x.sm2781||[]),
        et0h:avg(x.et0||[]),vpdh:avg(x.vpd||[]),windh:avg(x.wind||[]),
      };
    });

    const fselStr=fmt(fsel);
    const dRef=dias.find(d=>d.fecha===fselStr)||dias.find(d=>d.fecha>=fselStr)||dias[3];
    const iRef=dias.indexOf(dRef);

    // GDD acumulados hasta fecha de siembra
    const gddAc=dias.slice(0,iRef+1).reduce((s,d)=>s+(d.gdd||0),0);
    window._gddAc=gddAc;

    // Lluvia 72h
    const lluv72=Math.max(...dias.slice(iRef,iRef+3).map(d=>d.precP||0));

    // Autocompletar sliders
    if(dRef){
      if(dRef.st6!=null)setR('s-t6',dRef.st6);
      if(dRef.st18!=null)setR('s-t18',dRef.st18);
      if(dRef.sm39!=null)setR('s-h1',Math.min(50,dRef.sm39));
      if(dRef.sm927!=null)setR('s-h2',Math.min(50,dRef.sm927));
      if(dRef.sm2781!=null)setR('s-h3',Math.min(50,dRef.sm2781));
      if(dRef.et0d!=null)setR('s-et0',dRef.et0d,1);
      if(dRef.vpdh!=null)setR('s-vpd',dRef.vpdh,2);
      if(dRef.windh!=null)setR('s-viento',dRef.windh);
    }
    setR('s-lluv',lluv72);

    // Panel info
    $('i-temp').textContent=dRef?.st6!=null?dRef.st6.toFixed(1)+'°C':'—';
    $('i-hum').textContent=dRef?.sm39!=null?dRef.sm39.toFixed(1)+'%':'—';
    $('i-et0').textContent=dRef?.et0d!=null?dRef.et0d.toFixed(1)+' mm/d':'—';
    $('i-vpd').textContent=dRef?.vpdh!=null?dRef.vpdh.toFixed(2)+' kPa':'—';
    $('i-viento').textContent=dRef?.windh!=null?dRef.windh.toFixed(0)+' km/h':'—';
    $('i-gdd').textContent=gddAc>0?gddAc.toFixed(0)+' GDD':'—';
    $('api-info').classList.remove('hidden');

    renderPron(dias,fselStr);
    setStatus('✅ Open-Meteo cargado — consultando NASA POWER (histórico 30 años)...',true);
    // Actualizar banner del asistente IA
    setTimeout(iaActualizarContextoBanner, 500);

    // Guardar diaRef globalmente para usar en compactación
    window._diaRef = diaRef;

    // ── NASA POWER: llamada paralela, no bloquea si falla ──
    const mesSimb = fsel.getMonth() + 1; // 1-12
    buscarNASAPower(lat, lon, mesSimb)
      .then(props => {
        renderNASAPower(props, mesSimb, lat, lon);
        setStatus('✅ Open-Meteo + NASA POWER cargados correctamente', false);
      })
      .catch(e => {
        // Falla silenciosa — Open-Meteo ya funcionó
        setStatus('✅ Open-Meteo cargado · NASA POWER no disponible (se puede usar igualmente)', false);
        console.warn('NASA POWER:', e.message);
      });

    // ── SOILGRIDS: mostrar DB interna INMEDIATAMENTE, luego intentar API real ──
    // Paso 1: mostrar datos internos de inmediato (siempre funciona)
    const sueloTipo = detSuelo(lat, lon) || 'Molisol';
    const datosInternos = await buscarSoilGrids(lat, lon); // tiene fallback garantizado
    // Siempre va a devolver algo (API real o DB interna)
    window._sgDatos = datosInternos;
    renderSoilGrids(datosInternos);
    renderSueloModulo(datosInternos);
    if ($('suelo-coord') && $('s-coord')?.value) $('suelo-coord').value = $('s-coord').value;
    if (datosInternos.textura) {
      const sel = $('s-suelo');
      if (sel) {
        sel.value = datosInternos.textura;
        $('s-sbadge').textContent = datosInternos.esFallback ? '← DB interna' : '← SoilGrids 250m';
      }
    }
    window._daReal = datosInternos.da;
    // Calcular compactación con los datos disponibles
    const humActualSG = parseFloat($('s-h1')?.value) || 22;
    const traficoSG   = parseInt($('s-trafico')?.value) || 0;
    const calcCompSG  = calcularCompactacion(datosInternos, humActualSG, traficoSG, window._diaRef);
    if (calcCompSG) {
      setR('s-compact', calcCompSG.mpaEstimado, 1);
      $('compact-source').textContent = datosInternos.esFallback
        ? '← estimado (DB interna pampa)'
        : '← calculado (SoilGrids + Open-Meteo)';
      $('compact-calc-info').textContent =
        `Índice S: ${calcCompSG.indiceS.toFixed(3)} · DA: ${datosInternos.da?.toFixed(2)||'—'} g/cm³ · Arcilla: ${datosInternos.clay?.toFixed(0)||'—'}% · MO: ${calcCompSG.mo?.toFixed(1)||'—'}%`;
      renderCompactacion(calcCompSG, datosInternos);
    }
  }catch(e){
    setStatus('⚠️ Error al consultar la API. Podés ingresar los datos manualmente.',false);
    console.error(e);
  }finally{btn.disabled=false;btn.textContent='🌡️ Obtener datos'}
}

// ── PRONÓSTICO ──
function renderPron(dias,fRef){
  const cult=gv('s-cultivo'),suelo=gv('s-suelo');
  const tMinC=DB.tMin[cult]||10,hRef=DB.hum[suelo]?.[cult];
  const hoy=new Date().toISOString().split('T')[0];
  const dias8=dias.filter(d=>{const df=(new Date(d.fecha+'T12:00')-new Date(fRef+'T12:00'))/86400e3;return df>=-2&&df<=7});

  const hdr=`<div class="pr hdr">
    <div>Fecha</div><div class="mn">T°sue.</div><div class="mn">Hum%</div>
    <div class="mn">ET₀</div><div class="mn">Viento</div><div class="mn">Lluv%</div><div>Estado</div>
  </div>`;

  const rows=dias8.map(d=>{
    const esR=d.fecha===fRef,diff=Math.round((new Date(d.fecha+'T12:00')-new Date(fRef+'T12:00'))/86400e3);
    const lbl=esR?'📌 Siembra':d.fecha===hoy?'Hoy':diff>0?`+${diff}d`:`${diff}d`;
    let est='—',ch='';
    if(d.st6!=null&&d.sm39!=null){
      const hOk=hRef?d.sm39>=hRef.n&&d.sm39<=hRef.x:true,tOk=d.st6>=tMinC,wOk=!d.windMax||d.windMax<25;
      if(hOk&&tOk&&wOk){est='✅ Apto';ch='ok-chip'}
      else if(!tOk&&!hOk){est='🚫 T°+H°';ch='danger-chip'}
      else if(!tOk){est='⚠️ T° baja';ch='warn-chip'}
      else if(!wOk){est='⚠️ Viento';ch='warn-chip'}
      else{est='⚠️ Humedad';ch='warn-chip'}
    }
    const ec=d.et0d!=null?(d.et0d>6?'color:#C94A2A':d.et0d>4?'color:#B87A20':'color:#2A7A4A'):'';
    const wc=d.windMax!=null?(d.windMax>25?'color:#C94A2A':d.windMax>15?'color:#B87A20':''):'';
    return`<div class="pr ${esR?'today':''}">
      <div><span style="font-size:.65rem;color:rgba(74,46,26,.4)">${lbl}</span><br>${d.fecha.slice(5).replace('-','/')}</div>
      <div class="mn">${d.st6!=null?d.st6.toFixed(1)+'°':'—'}</div>
      <div class="mn">${d.sm39!=null?d.sm39.toFixed(1)+'%':'—'}</div>
      <div class="mn" style="${ec}">${d.et0d!=null?d.et0d.toFixed(1):'—'}</div>
      <div class="mn" style="${wc}">${d.windMax!=null?d.windMax.toFixed(0):'—'}</div>
      <div class="mn">${d.precP!=null?d.precP+'%':'—'}</div>
      <div><span class="chip ${ch}">${est}</span></div>
    </div>`;
  }).join('');

  $('pron-card').classList.remove('hidden');
  $('pron-tabla').innerHTML=hdr+rows;
}

// ── DIAGNÓSTICO SIEMBRA ──
function calcSiembra(){
  const cult=gv('s-cultivo'),suelo=gv('s-suelo');
  const h1=+gv('s-h1'),h2=+gv('s-h2'),h3=+gv('s-h3');
  const lluv=+gv('s-lluv'),t6=+gv('s-t6'),t18=+gv('s-t18');
  const rast=gv('s-rast')==='si',comp=+gv('s-compact');
  const et0=+gv('s-et0'),vpd=+gv('s-vpd'),viento=+gv('s-viento');

  const hRef=DB.hum[suelo]?.[cult],sRef=DB.suelo[suelo],prof=DB.prof[suelo]?.[cult];
  const tMin=DB.tMin[cult],tId=DB.tId[cult];
  if(!hRef||!prof||!sRef)return;

  const tEf=rast?t6-1.5:t6;
  const{cc,pm,da}=sRef;

  // Agua útil total en perfil 80 cm (mm)
  const auMm=(Math.max(0,h1-pm)*6+Math.max(0,h2-pm)*18+Math.max(0,h3-pm)*56)*da/100;
  const diasR=et0>0?Math.round(auMm/et0):999;

  // Scores
  // HUMEDAD
  let sH,eH,mH;
  if(h1<hRef.n){sH=lluv>=70?55:Math.max(0,40-(hRef.n-h1)*3);eH=lluv>=70?'a':'r';mH=lluv>=70?`Humedad baja (${h1}%) pero lluvia pronosticada (${lluv}%) podría compensar. Evaluar siembra preventiva.`:`Humedad insuficiente (${h1}% < mín ${hRef.n}%). Sin lluvia prevista, no se recomienda sembrar.`}
  else if(h1>hRef.x){sH=Math.max(20,70-(h1-hRef.x)*4);eH='r';mH=`Humedad excesiva (${h1}% > máx ${hRef.x}%). Riesgo de pudrición de semilla y problemas de apertura de surco.`}
  else{sH=Math.min(100,100-Math.abs(h1-hRef.i)*3);eH=lluv>=80&&h1>hRef.i?'a':'v';mH=eH==='v'?`Humedad óptima (${h1}%). Condición ideal para siembra a ${prof[1]} cm.`:`Humedad adecuada (${h1}%) pero lluvia (${lluv}%) podría exceder el máximo. Sembrar a profundidad máxima (${prof[2]} cm).`}

  // TEMPERATURA
  let sT,eT,mT;
  if(tEf<tMin){sT=Math.max(0,30-(tMin-tEf)*5);eT='r';mT=`Temperatura insuficiente (${tEf.toFixed(1)}°C < mín ${tMin}°C para ${cult}). Alto riesgo de falla en germinación.`}
  else if(tEf<tId){sT=60+(tEf-tMin)/(tId-tMin)*40;eT='a';mT=`Temperatura aceptable pero subóptima (${tEf.toFixed(1)}°C). Germinación lenta. Ideal: ${tId}°C.`}
  else{sT=100;eT='v';mT=`Temperatura óptima (${tEf.toFixed(1)}°C ≥ ${tId}°C). Germinación normal esperada.`}
  const gradT=t6-t18;
  if(gradT>3)mT+=` Gradiente positivo 6→18cm (+${gradT.toFixed(1)}°C) — favorable para emergencia rápida.`;
  else if(gradT<-2)mT+=` ⚠️ INVERSIÓN TÉRMICA: suelo más frío en superficie (${gradT.toFixed(1)}°C). Riesgo de emergencia lenta o encostramiento térmico — considerar retrasar la siembra.`;

  // RESERVA HÍDRICA (ET₀)
  let sE,eE,mE;
  if(diasR>=14){sE=100;eE='v';mE=`Reserva hídrica sólida: ${auMm.toFixed(0)} mm agua útil en el perfil → ${diasR} días antes de marchitez permanente.`}
  else if(diasR>=7){sE=70;eE='a';mE=`Reserva moderada: ${auMm.toFixed(0)} mm → ${diasR} días de reserva a ET₀ ${et0} mm/d. Monitorear lluvia.`}
  else{sE=25;eE='r';mE=`Reserva crítica: ${auMm.toFixed(0)} mm → solo ${diasR} días a ET₀ ${et0} mm/d. Riesgo de estrés hídrico severo.`}

  // VPD
  let sV,eV,mV;
  if(vpd<0.4){sV=80;eV='a';mV=`VPD muy bajo (${vpd.toFixed(2)} kPa). Transpiración reducida. Riesgo de enfermedades fúngicas por alta humedad foliar.`}
  else if(vpd<=1.6){sV=100;eV='v';mV=`VPD óptimo (${vpd.toFixed(2)} kPa). Demanda atmosférica normal — condición favorable para establecimiento del cultivo.`}
  else if(vpd<=2.5){sV=60;eV='a';mV=`VPD elevado (${vpd.toFixed(2)} kPa). Estrés hídrico moderado. Germinación más lenta y mayor exigencia de establecimiento.`}
  else{sV=20;eV='r';mV=`VPD muy alto (${vpd.toFixed(2)} kPa). Estrés hídrico severo — evapotranspiración máxima. Postergar siembra de ser posible.`}

  // VIENTO
  let sW,eW,mW;
  if(viento<10){sW=100;eW='v';mW=`Viento calmo (${viento} km/h). Condiciones operativas ideales.`}
  else if(viento<20){sW=85;eW='v';mW=`Viento moderado (${viento} km/h). Sin restricciones para siembra.`}
  else if(viento<30){sW=50;eW='a';mW=`Viento fuerte (${viento} km/h). Puede afectar distribución de semilla en sembradoras a chorrillo. No aplicar herbicidas.`}
  else{sW=15;eW='r';mW=`Viento muy fuerte (${viento} km/h). No se recomienda sembrar ni aplicar agroquímicos.`}

  // COMPACTACIÓN
  let sC,eC,mC;
  if(comp<1){sC=100;eC='v';mC=`Resistencia baja (${comp} MPa). Condición ideal para penetración de raíces.`}
  else if(comp<2){sC=90-(comp-1)*30;eC='v';mC=`Resistencia normal (${comp} MPa). Sin restricciones significativas.`}
  else if(comp<3){sC=60-(comp-2)*30;eC='a';mC=`Resistencia moderada (${comp} MPa). Puede limitar raíces. Evaluar subsolado.`}
  else{sC=Math.max(10,30-(comp-3)*20);eC='r';mC=`Resistencia alta (${comp} MPa). Limitación severa al crecimiento radicular. Se recomienda laboreo.`}

  // SCORE GLOBAL (ponderado)
  const sg=Math.round(sH*.30+sT*.25+sE*.15+sV*.10+sC*.15+sW*.05);
  const[dec,dCol,dIco]=sg>=75?['APTO PARA SIEMBRA','#1A5C2A','✅']:sg>=50?['SIEMBRA CON PRECAUCIÓN','#7A4A10','⚠️']:['NO RECOMENDADO SEMBRAR','#7A1A0A','🚫'];

  let profRec;
  if(eH==='v'&&lluv<60)profRec=`${prof[1]} cm (profundidad ideal)`;
  else if(lluv>=70||h1>hRef.i)profRec=`${prof[2]} cm (máxima — evitar pudrición por exceso hídrico)`;
  else if(h1<hRef.n)profRec=`${prof[2]} cm (máxima — alcanzar humedad disponible)`;
  else profRec=`${prof[1]} cm`;

  const gdd=window._gddAc||0;
  const gddTxt=gdd>0?` · ${gdd.toFixed(0)} GDD acumulados`:'';

  // RENDER
  $('s-ph').classList.add('hidden');$('s-res').classList.remove('hidden');

  $('s-banner').innerHTML=`<div style="background:${dCol};border-radius:12px;padding:1.2rem 1.5rem;margin-bottom:1rem;display:flex;align-items:center;gap:1rem">
    <span style="font-size:1.8rem">${dIco}</span>
    <div>
      <div style="font-family:'DM Serif Display',serif;font-size:1.3rem;color:white">${dec}</div>
      <div style="font-size:.74rem;color:rgba(255,255,255,.65);margin-top:.2rem">${cult} · ${suelo} · Score: ${sg}/100${gddTxt}</div>
    </div>
  </div>`;

  $('s-kpis').innerHTML=`
    <div class="kc ${sg<50?'danger':sg<75?'warn':''}"><div class="kl">Score global</div><div class="kv">${sg}</div><div class="ku">/ 100</div></div>
    <div class="kc ${eE==='r'?'danger':eE==='a'?'warn':''}"><div class="kl">Días reserva</div><div class="kv">${diasR>99?'∞':diasR}</div><div class="ku">ET₀ ${et0} mm/d</div></div>
    <div class="kc ${eV==='r'?'danger':eV==='a'?'warn':''}"><div class="kl">VPD</div><div class="kv">${vpd.toFixed(1)}</div><div class="ku">kPa</div></div>
    <div class="kc ${eW==='r'?'danger':eW==='a'?'warn':''}"><div class="kl">Viento</div><div class="kv">${viento}</div><div class="ku">km/h</div></div>
    <div class="kc neutral"><div class="kl">Agua útil</div><div class="kv">${auMm.toFixed(0)}</div><div class="ku">mm perfil</div></div>
    <div class="kc blue"><div class="kl">Prof. rec.</div><div class="kv">${prof[1]}</div><div class="ku">cm</div></div>`;

  const inds=[
    {l:'Humedad zona activa (3-9 cm)',s:sH,e:eH,v:`${h1}%`,r:`${hRef.n}-${hRef.x}%`},
    {l:'Temperatura suelo (6 cm)',s:sT,e:eT,v:`${tEf.toFixed(1)}°C`,r:`≥${tMin}°C`},
    {l:'Reserva hídrica / ET₀',s:sE,e:eE,v:`${diasR>99?'∞':diasR} días`,r:`ET₀ ${et0} mm/d`},
    {l:'VPD atmosférico',s:sV,e:eV,v:`${vpd.toFixed(2)} kPa`,r:'0.4–1.6 kPa'},
    {l:'Compactación',s:sC,e:eC,v:`${comp} MPa`,r:'<2.0 MPa'},
    {l:'Viento operativo',s:sW,e:eW,v:`${viento} km/h`,r:'<20 km/h'},
  ];
  $('s-inds').innerHTML=inds.map(x=>`
    <div style="margin-bottom:.8rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.22rem">
        <div style="font-size:.79rem;font-weight:600;color:var(--earth)">${x.l}</div>
        <div class="sema ${x.e}"><div class="sema-dot"></div>${x.v} · ${x.r}</div>
      </div>
      <div class="pb"><div class="pf ${x.s<50?'danger':x.s<70?'warn':''}" style="width:${x.s}%"></div></div>
    </div>`).join('');

  const tipos={v:'ok',a:'warn',r:'danger'};
  const iconos={v:'✅',a:'⚠️',r:'🚫'};
  const msgs=[[mH,eH],[mT,eT],[mE,eE],[mV,eV],[mC,eC],[mW,eW]];
  const spec=['💨','💨'];
  $('s-recs').innerHTML=msgs.map(([m,e])=>`<div class="alert ${tipos[e]}"><span class="ai">${iconos[e]}</span><div class="ac">${m}</div></div>`).join('')+
    `<div class="alert info"><span class="ai">📏</span><div class="ac"><strong>Profundidad de siembra:</strong> ${profRec} para ${cult} en ${suelo}</div></div>`;
}
