// AGROMOTOR — siembra.js
// Diagnóstico de siembra · Open-Meteo · Score 0-100 · Pronóstico 7 días · Inversión térmica

(function() {
  window.AM = window.AM || {};
  window.AM.siembra = {};

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  async function fetchOpenMeteoSeguro(url,urlFallback){
    async function leer(res){
      if(res.ok)return res.json();
      let detalle='';
      try{
        const err=await res.json();
        detalle=err?.reason?': '+err.reason:'';
      }catch(_){}
      throw new Error('Open-Meteo HTTP '+res.status+detalle);
    }
    try{
      return await leer(await fetch(url));
    }catch(e){
      console.warn('[Siembra] Open-Meteo intento principal fallo:',e.message);
      try{
        return await leer(await fetch(urlFallback));
      }catch(e2){
        throw new Error(e2.message||e.message);
      }
    }
  }

  async function buscarAPI(){
    const[lat,lon]=parsCoord(gv('s-coord'));
    if(lat===null){alert('Formato no reconocido.\nEjemplos:\n• 33°23\'42.55"S 60°11\'29.87"W\n• -33.395, -60.192');return}
    try{localStorage.setItem('am_siembra_lat',String(lat));localStorage.setItem('am_siembra_lon',String(lon));}catch(_){}
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

        // --- AgroENSO Mapping ---
        const cleanState = prov.replace(/Provincia de/i, '').replace(/Provincia/i, '').trim();
        const cleanCounty = (a.county || a.city || a.town || a.village || '')
          .replace(/Departamento/i, '')
          .replace(/Partido de/i, '')
          .replace(/Partido/i, '')
          .replace(/Comuna de/i, '')
          .replace(/Comuna/i, '')
          .trim();

        if (cleanState && cleanCounty && typeof window.AM_SB !== 'undefined') {
          window.AM_SB.from('enso_rendimiento')
            .select('provincia_id, depto_id, provincia_nombre, depto_nombre')
            .ilike('provincia_nombre', cleanState)
            .ilike('depto_nombre', cleanCounty)
            .limit(1)
            .then(({ data, error }) => {
              if (!error && data && data.length > 0) {
                const match = data[0];
                const activeLote = (typeof window.amGetLoteActivo === 'function') ? window.amGetLoteActivo() : null;
                if (activeLote) {
                  activeLote.data = activeLote.data || {};
                  activeLote.data.provincia_id = match.provincia_id;
                  activeLote.data.depto_id = match.depto_id;
                  activeLote.data.provincia_nombre = match.provincia_nombre;
                  activeLote.data.depto_nombre = match.depto_nombre;
                  if (typeof window.amGuardarLotesEstado === 'function') {
                    window.amGuardarLotesEstado();
                    console.log(`[ENSO Geocoding] Guardado: ${match.depto_nombre}, ${match.provincia_nombre} (Depto ID: ${match.depto_id}, Prov ID: ${match.provincia_id})`);
                  }
                }
              } else {
                console.warn('[ENSO Geocoding] No se encontró correspondencia para:', cleanCounty, cleanState, error);
              }
            });
        }
      }catch(e){}
      $('i-ubi').textContent=ubi;

      // 2. Suelo auto
      const sa=detSuelo(lat,lon);
      if(sa){$('s-suelo').value=sa;$('i-suelo').textContent=sa+' (auto)';$('s-sbadge').textContent='← auto'}
      else{$('i-suelo').textContent='No detectado — elegir manualmente'}

      setStatus('Descargando datos meteorológicos y de suelo — Open-Meteo...');

      // 3. Open-Meteo — llamada única con TODAS las variables
      const hoy=new Date();
      hoy.setHours(12,0,0,0);
      const fs=gv('s-fecha');
      const fsel=fs?new Date(fs+'T12:00:00'):hoy;
      const fmt=d=>d.toISOString().split('T')[0];
      const minApi=new Date(hoy);minApi.setDate(minApi.getDate()-3);
      const maxApi=new Date(hoy);maxApi.setDate(maxApi.getDate()+15);
      const apiRef=(fsel<minApi||fsel>maxApi)?hoy:fsel;
      const fechaFueraRango=apiRef.getTime()!==fsel.getTime();
      const ini=new Date(apiRef);ini.setDate(ini.getDate()-3);
      const fin=new Date(apiRef);fin.setDate(fin.getDate()+15);

      const meteoVars='&hourly=soil_temperature_6cm,soil_temperature_18cm,'+
        'soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,soil_moisture_27_to_81cm,'+
        'et0_fao_evapotranspiration,vapour_pressure_deficit,wind_speed_10m'+
        '&daily=temperature_2m_max,temperature_2m_min,'+
        'precipitation_probability_max,precipitation_sum,'+
        'et0_fao_evapotranspiration,growing_degree_days_base_0_limit_50,'+
        'wind_speed_10m_max,wind_gusts_10m_max,shortwave_radiation_sum';
      const meteoBase=`latitude=${lat}&longitude=${lon}&timezone=auto`;
      const url='https://api.open-meteo.com/v1/forecast?'+
        meteoBase+`&start_date=${fmt(ini)}&end_date=${fmt(fin)}`+meteoVars;
      const urlFallback='https://api.open-meteo.com/v1/forecast?'+
        meteoBase+'&past_days=3&forecast_days=16'+meteoVars;

      const data=await fetchOpenMeteoSeguro(url,urlFallback);

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

      window._siembraDias=dias;

      const fselStr=fmt(apiRef);
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
      const placeholder = $('api-info-placeholder');
      if(placeholder) placeholder.classList.add('hidden');
      $('api-info').classList.remove('hidden');

      renderPron(dias,fselStr);
      try{ renderGestionSiembra(); }catch(_){}
      const avisoFechaApi=fechaFueraRango?' con fecha actual (la fecha elegida queda fuera del pronóstico disponible)':'';
      setStatus('✅ Open-Meteo cargado'+avisoFechaApi+' — consultando NASA POWER (histórico 30 años)...',true);
      // Actualizar banner del asistente IA
      setTimeout(iaActualizarContextoBanner, 500);

      // Guardar diaRef globalmente para usar en compactación
      window._diaRef = dRef;

      // ── NASA POWER: llamada paralela, no bloquea si falla ──
      const buscarNasa = window.buscarNASAPower;
      const renderNasa = window.renderNASAPower;
      const buscarSuelo = window.buscarSoilGrids;
      const renderSuelo = window.renderSoilGrids;
      if (typeof buscarSuelo !== 'function' || typeof renderSuelo !== 'function') {
        throw new Error('Modulo de APIs de suelo no cargado');
      }
      const mesSimb = fsel.getMonth() + 1; // 1-12
      if (typeof buscarNasa === 'function' && typeof renderNasa === 'function') buscarNasa(lat, lon, mesSimb)
        .then(props => {
          renderNasa(props, mesSimb, lat, lon);
          setStatus('✅ Open-Meteo'+avisoFechaApi+' + NASA POWER cargados correctamente', false);
        })
        .catch(e => {
          // Falla silenciosa — Open-Meteo ya funcionó
          setStatus('✅ Open-Meteo cargado'+avisoFechaApi+' · NASA POWER no disponible (se puede usar igualmente)', false);
          console.warn('NASA POWER:', e.message);
        });
      else console.warn('NASA POWER: modulo no cargado');

      // ── SOILGRIDS: mostrar DB interna INMEDIATAMENTE, luego intentar API real ──
      // Paso 1: mostrar datos internos de inmediato (siempre funciona)
      const sueloTipo = detSuelo(lat, lon) || 'Molisol';
      const datosInternos = await buscarSuelo(lat, lon); // tiene fallback garantizado
      // Siempre va a devolver algo (API real o DB interna)
      window._sgDatos = datosInternos;
      renderSuelo(datosInternos);
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
      if (typeof window.amEnsoUpdateMacroCard === 'function') {
        window.amEnsoUpdateMacroCard();
      }
      if (typeof window.amEnsoRenderDetailedPanel === 'function') {
        window.amEnsoRenderDetailedPanel();
      }
      if (typeof cacheGuardar === 'function') setTimeout(cacheGuardar, 1000);
    }catch(e){
      const detalle = e && e.message ? e.message : 'error desconocido';
      setStatus('⚠️ Error al consultar la API: ' + detalle + '. Podés ingresar los datos manualmente.',false);
      console.error('[Siembra] Error al consultar APIs', e);
    }finally{btn.disabled=false;btn.textContent='🌡️ Obtener datos'}
  }

  // ── PRONÓSTICO ──
  function renderPron(dias,fRef){
    const cult=gv('s-cultivo'),suelo=gv('s-suelo');
    const tMinC=DB.tMin[cult]||10,hRef=DB.hum[suelo]?.[cult];
    const hoy=new Date().toISOString().split('T')[0];
    const dias17=dias.filter(d=>{const df=(new Date(d.fecha+'T12:00')-new Date(fRef+'T12:00'))/86400e3;return df>=-2&&df<=16});

    const hdr=`<div class="pr hdr">
      <div>Fecha</div><div class="mn">T°sue.</div><div class="mn">Hum%</div>
      <div class="mn">ET₀</div><div class="mn">Viento</div><div class="mn">Lluv%</div><div>Estado</div>
    </div>`;

    const rows=dias17.map(d=>{
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

    // Persistir datos de siembra para módulos dependientes (fenologia, alertas, informe-cierre)
    try{
      const fecha=gv('s-fecha');
      if(fecha)localStorage.setItem('am_siembra_fecha',fecha);
      localStorage.setItem('am_siembra_cultivo',cult);
      localStorage.setItem('am_cultivo',cult);
      // Coordenadas: refrescar desde el campo por si no pasaron por buscarAPI
      const coordParsed=parsCoord(gv('s-coord'));
      if(coordParsed[0]!==null){
        localStorage.setItem('am_siembra_lat',String(coordParsed[0]));
        localStorage.setItem('am_siembra_lon',String(coordParsed[1]));
      }
    }catch(_){}

    // ÉPOCA DE SIEMBRA — verificar ventana antes de mostrar el diagnóstico
    let epocaHtml = '';
    try {
      const fechaSb = gv('s-fecha');
      const coordSb = parsCoord(gv('s-coord'));
      const latSb   = coordSb[0] !== null ? coordSb[0] : null;
      const zonaSb  = (typeof window.detectarZona === 'function') ? window.detectarZona(latSb) : null;
      if (fechaSb && zonaSb && typeof window.calcScoreFecha === 'function') {
        const ep = window.calcScoreFecha(cult, zonaSb, fechaSb);
        if (ep.pts === 0) {
          epocaHtml = `<div style="background:#7A1A0A;border-radius:12px;padding:1rem 1.2rem;margin-bottom:.9rem;display:flex;align-items:flex-start;gap:.8rem">
            <span style="font-size:1.6rem;line-height:1">⏰</span>
            <div>
              <div style="font-family:'DM Serif Display',serif;font-size:1.05rem;color:white;font-weight:700">FUERA DE ÉPOCA DE SIEMBRA</div>
              <div style="font-size:.74rem;color:rgba(255,255,255,.8);margin-top:.25rem">${cult} · ${ep.label} · Revisá el calendario de siembra para tu zona antes de sembrar.</div>
            </div>
          </div>`;
        } else if (ep.pts < 18) {
          const epTitulo = ep.label.toLowerCase().includes('temprana') ? 'FECHA TEMPRANA — Riesgo leve'
                         : ep.label.toLowerCase().includes('tard')     ? 'FECHA TARDÍA — Menor potencial'
                         : 'FECHA FUERA DE VENTANA ÓPTIMA';
          epocaHtml = `<div style="background:#7A4A10;border-radius:12px;padding:1rem 1.2rem;margin-bottom:.9rem;display:flex;align-items:flex-start;gap:.8rem">
            <span style="font-size:1.6rem;line-height:1">⚠️</span>
            <div>
              <div style="font-family:'DM Serif Display',serif;font-size:1.05rem;color:white;font-weight:700">${epTitulo}</div>
              <div style="font-size:.74rem;color:rgba(255,255,255,.8);margin-top:.25rem">${cult} · ${ep.label} · El diagnóstico aplica igual si decidís sembrar.</div>
            </div>
          </div>`;
        }
      }
    } catch(_) {}

    // RENDER
    $('s-ph').classList.add('hidden');$('s-res').classList.remove('hidden');

    $('s-banner').innerHTML=epocaHtml+`<div style="background:${dCol};border-radius:12px;padding:1.2rem 1.5rem;margin-bottom:1rem;display:flex;align-items:center;gap:1rem">
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

    // Exponer resultado para captura en dlRegistrarSiembra (Fase B snapshot)
    try {
      const _ltR = typeof window.amGetLoteActivo === 'function' ? window.amGetLoteActivo() : null;
      window.AM_SIEMBRA_LAST_RESULT = {
        loteId: _ltR ? _ltR.id : null,
        score: sg, label: dec,
        humedad: h1, vpd, viento,
        diasReserva: diasR > 99 ? null : diasR,
        fechaDiag: gv('s-fecha'),
        ts: Date.now(),
      };
    } catch(_) {}

    // Botón "Registrar siembra" si hay un grupo en pre-siembra para este lote
    const _sRegDiv = $('s-registrar-btn');
    if (_sRegDiv) {
      try {
        const _ltReg = typeof window.amGetLoteActivo === 'function' ? window.amGetLoteActivo() : null;
        const _fgReg = (_ltReg && _ltReg.data && _ltReg.data.faseGrupos) || {};
        const _preReg = ['verano','invierno'].filter(g => _fgReg[g] === 'pre-siembra');
        const _grupoReg = window.AM_SIEMBRA_CURRENT_GRUPO || _preReg[0] || null;
        if (_grupoReg && _ltReg && _fgReg[_grupoReg] === 'pre-siembra') {
          const _liReg = _ltReg.id;
          _sRegDiv.innerHTML = `<div style="margin-top:1.2rem;padding-top:1rem;border-top:1px solid rgba(74,46,26,.12)">
            <button onclick="window.dlRegistrarSiembra('${_liReg}','${_grupoReg}')"
              style="background:#2A5A3A;color:#fff;border:none;border-radius:10px;padding:.7rem 1.4rem;font-size:.88rem;font-weight:700;cursor:pointer;width:100%">
              ✅ Registrar siembra realizada
            </button>
          </div>`;
        } else { _sRegDiv.innerHTML = ''; }
      } catch(_) { _sRegDiv.innerHTML = ''; }
    }
  }

  // ══════════════════════════════════════════════════════
  // GESTIÓN DE SIEMBRA EN CURSO
  // Motor de aptitud diaria + ventanas de siembra + progreso
  // ══════════════════════════════════════════════════════

  // Clasifica un día según humedad de suelo, temperatura (ventana 3 días),
  // lluvia y viento. dias = array completo del forecast; i = índice del día.
  function clasificarDiaSiembra(dias, i, cult, suelo) {
    const d = dias[i];
    const sRef = DB.suelo[suelo] || { cc:34, pm:12 };
    const tMin = DB.tMin[cult] || 8;
    const cc = sRef.cc, pm = sRef.pm;
    const h = d.sm39, t = d.st6;
    const precip = d.precS != null ? d.precS : 0;
    const wind = d.windMax != null ? d.windMax : 0;

    // Humedad → condición + agua disponible
    let condHum = '—', aguaDisp = null, humSembrable = false;
    if (h != null) {
      aguaDisp = Math.max(0, h - pm);
      if (h <= pm) { condHum = 'Muy seco'; humSembrable = false; }
      else if (h >= cc) { condHum = 'Anegado'; humSembrable = false; }
      else { condHum = 'Agua útil'; humSembrable = true; }
    }

    // Temperatura: ventana de 3 días (hoy + 2 previos), todos ≥ tMin
    let tempApta = true;
    if (t == null) { tempApta = false; }
    else {
      for (let k = Math.max(0, i - 2); k <= i; k++) {
        if (dias[k].st6 == null || dias[k].st6 < tMin) { tempApta = false; break; }
      }
    }

    // Profundidad dinámica (más profundo cuanto más seco, dentro del rango del suelo)
    let prof = null;
    const profR = (DB.prof[suelo] && DB.prof[suelo][cult]) || null;
    if (profR && humSembrable && h != null) {
      const mp = profR[0], xp = profR[2];
      prof = (mp + (xp - mp) * ((cc - h) / (cc - pm))).toFixed(1);
    }

    // Estado final por prioridad
    let estado, emoji, label;
    if (precip > 5)                  { estado='lluvia';  emoji='🔴'; label='Lluvia ' + precip.toFixed(0) + ' mm'; }
    else if (h != null && h >= cc)   { estado='anegado'; emoji='⛔'; label='Suelo saturado'; }
    else if (h != null && h <= pm)   { estado='seco';    emoji='🟤'; label='Muy seco'; }
    else if (!tempApta)              { estado='frio';    emoji='🔵'; label='Temp. baja'; }
    else if (wind > 25)              { estado='viento';  emoji='💨'; label='Viento ' + wind.toFixed(0) + ' km/h'; }
    else if (humSembrable && tempApta) { estado='apto';  emoji='🟢'; label='Apto'; }
    else                             { estado='marginal';emoji='🟡'; label='Marginal'; }

    return { fecha:d.fecha, estado, emoji, label, condHum, aguaDisp, tempApta, prof,
             h, t, precip, wind, sembrable: (estado==='apto'||estado==='marginal') };
  }

  // Genera recomendación inteligente a partir de la secuencia de días.
  function generarRecomendacion(clasif, idxHoy) {
    if (!clasif.length) return null;
    const hoy = clasif[idxHoy] || clasif[0];
    const futuros = clasif.slice(idxHoy);

    // Próxima lluvia
    let proxLluvia = -1;
    for (let k = 1; k < futuros.length; k++) {
      if (futuros[k].estado === 'lluvia') { proxLluvia = k; break; }
    }
    // Próxima ventana sembrable y su largo
    let proxVentana = -1, largoVentana = 0;
    for (let k = 0; k < futuros.length; k++) {
      if (futuros[k].sembrable) {
        if (proxVentana === -1) proxVentana = k;
        largoVentana++;
      } else if (proxVentana !== -1) {
        break;
      }
    }

    let nivel, titulo, detalle;
    const fechaLbl = f => { const p = f.split('-'); return p[2] + '/' + p[1]; };

    if (hoy.estado === 'lluvia') {
      nivel = 'esperar'; titulo = '⛔ No sembrar hoy — lluvia';
      const sig = proxVentana >= 0 ? '· Próxima ventana: ' + fechaLbl(futuros[proxVentana].fecha) + (largoVentana>1?' ('+largoVentana+' días)':'') : '· Sin ventana clara en el pronóstico';
      detalle = 'Hay ' + hoy.precip.toFixed(0) + ' mm previstos. ' + sig;
    } else if (hoy.estado === 'anegado') {
      let diasSecado = 0;
      for (let k = 1; k < futuros.length; k++) { if (futuros[k].estado !== 'anegado') break; diasSecado++; }
      nivel = 'esperar'; titulo = '⛔ Suelo saturado — esperá ' + (diasSecado>0?diasSecado+' día'+(diasSecado>1?'s':''):'el drenaje');
      detalle = proxVentana >= 0 ? 'El suelo drena hacia ' + fechaLbl(futuros[proxVentana].fecha) + '. No ingreses hasta entonces para evitar compactación.' : 'Monitoreá el drenaje antes de ingresar.';
    } else if (hoy.estado === 'seco') {
      nivel = 'esperar'; titulo = '🟤 Suelo muy seco — riesgo de mala implantación';
      detalle = proxLluvia >= 0 ? 'Lluvia prevista el ' + fechaLbl(futuros[proxLluvia].fecha) + ' podría mejorar la humedad. Evaluá esperar.' : 'Sin lluvia en el pronóstico. Considerá sembrar más profundo para alcanzar humedad.';
    } else if (hoy.estado === 'frio') {
      nivel = 'precaucion'; titulo = '🔵 Temperatura de suelo baja';
      detalle = 'La germinación será lenta. ' + (proxVentana>=0 && futuros[proxVentana].estado==='apto' ? 'Mejores condiciones desde ' + fechaLbl(futuros[proxVentana].fecha) + '.' : 'Monitoreá la evolución de la temperatura.');
    } else if (hoy.sembrable) {
      // Hoy se puede sembrar — ¿urgencia por lluvia próxima?
      if (proxLluvia >= 1 && proxLluvia <= 3) {
        nivel = 'urgente';
        let diasAntes = 0;
        for (let k = 0; k < proxLluvia; k++) { if (futuros[k].sembrable) diasAntes++; }
        titulo = '✅ URGENTE: aprovechá la ventana antes de la lluvia';
        detalle = 'Tenés ' + diasAntes + ' día' + (diasAntes>1?'s':'') + ' aptos antes de la lluvia del ' + fechaLbl(futuros[proxLluvia].fecha) + '. Maximizá el avance.';
      } else if (largoVentana >= 5) {
        nivel = 'optimo'; titulo = '✅ Ventana extendida — condiciones óptimas';
        detalle = 'Tenés ' + largoVentana + ' días consecutivos aptos. Ritmo de siembra normal sin apuro.';
      } else {
        nivel = 'optimo'; titulo = '✅ HOY: condiciones aptas para sembrar';
        detalle = largoVentana>1 ? 'Ventana de ' + largoVentana + ' días. Aprovechá el clima favorable.' : 'Ventana corta de 1 día — priorizá el avance.';
      }
    } else {
      nivel = 'precaucion'; titulo = '🟡 Condiciones marginales';
      detalle = proxVentana>=0 ? 'Mejores condiciones desde ' + fechaLbl(futuros[proxVentana].fecha) + '.' : 'Evaluá con criterio profesional.';
    }
    return { nivel, titulo, detalle };
  }

  function scFechaCorta(fecha) {
    if (!fecha || typeof fecha !== 'string') return '--/--';
    const p = fecha.split('-');
    return p.length >= 3 ? (p[2] + '/' + p[1]) : fecha;
  }

  function scHoyISO() {
    return new Date().toISOString().split('T')[0];
  }

  function scGetHaDia(sr, lote) {
    const maqLote = (lote && lote.data && lote.data.maquinaria) || {};
    const manual = parseFloat(sr.haDiaria || 0);
    const maq = parseFloat(maqLote.haDia || 0);
    let local = 0;
    try { local = parseFloat(localStorage.getItem('am_maq_hd') || '0'); } catch(_) {}
    if (manual > 0) return { valor: manual, fuente: 'ajuste manual' };
    if (maq > 0) return { valor: maq, fuente: 'Maquinaria' };
    if (local > 0) return { valor: local, fuente: 'ultimo calculo de Maquinaria' };
    return { valor: 0, fuente: '' };
  }

  function scIndiceInicioProyeccion(clasif, sr, idxHoy) {
    const fecha = sr.fecha || sr.fechaReal || sr.fechaSiembra || '';
    const idxFecha = fecha ? clasif.findIndex(c => c.fecha >= fecha) : -1;
    if (idxFecha >= 0) return Math.min(idxFecha, Math.max(0, idxHoy));
    return Math.max(0, idxHoy);
  }

  function scAvanceConfirmadoPorFecha(sr) {
    const out = {};
    const arr = Array.isArray(sr.avanceDiario) ? sr.avanceDiario : [];
    arr.forEach(r => {
      if (!r || !r.fecha) return;
      const acum = parseFloat(r.haAcumuladasReales);
      if (!isNaN(acum)) out[r.fecha] = { acumuladas: acum, ts: r.ts || 0 };
    });
    return out;
  }

  function scProyectarAvance(clasif, idxHoy, sr, total, haDia) {
    const hoy = scHoyISO();
    const confirmadas = scAvanceConfirmadoPorFecha(sr);
    const baseManual = parseFloat(sr.hectareasCompletadas || 0) || 0;
    const idxInicio = scIndiceInicioProyeccion(clasif, sr, idxHoy);
    let acumuladas = 0;
    let anclaFecha = '';

    Object.keys(confirmadas).sort().forEach(fecha => {
      if (fecha < clasif[idxInicio].fecha || fecha > hoy) return;
      acumuladas = Math.max(acumuladas, confirmadas[fecha].acumuladas);
      anclaFecha = fecha;
    });
    acumuladas = Math.max(acumuladas, baseManual);

    const filas = [];
    let finEstim = null;
    let diasAptos = 0;
    let diasBloqueados = 0;

    for (let i = idxInicio; i < clasif.length; i++) {
      const c = clasif[i];
      const antes = acumuladas;
      const real = confirmadas[c.fecha];
      let haDiaReal = 0;
      let estadoAvance = 'estimado';
      let motivo = c.label;

      if (real) {
        acumuladas = Math.min(total || real.acumuladas, Math.max(0, real.acumuladas));
        haDiaReal = Math.max(0, acumuladas - antes);
        estadoAvance = 'confirmado';
        motivo = 'Cargado por usuario';
      } else if (total > 0 && acumuladas >= total) {
        estadoAvance = 'completo';
        motivo = 'Siembra completa';
      } else if (c.sembrable && haDia > 0) {
        if (c.fecha >= hoy) diasAptos++;
        haDiaReal = total > 0 ? Math.min(haDia, Math.max(0, total - acumuladas)) : haDia;
        acumuladas += haDiaReal;
        motivo = c.label + ' · avance estimado';
      } else {
        if (c.fecha >= hoy) diasBloqueados++;
        estadoAvance = 'bloqueado';
      }

      if (!finEstim && total > 0 && acumuladas >= total) finEstim = c.fecha;
      filas.push({
        fecha: c.fecha,
        estado: c.estado,
        sembrable: c.sembrable,
        label: c.label,
        avance: haDiaReal,
        acumuladas: acumuladas,
        estadoAvance: estadoAvance,
        motivo: motivo,
        esHoy: c.fecha === hoy,
        desdeAncla: !!anclaFecha
      });
    }

    const hoyFila = filas.find(f => f.fecha === hoy) || filas.find(f => f.fecha > hoy) || filas[0] || null;
    return {
      filas: filas,
      completadasHoy: hoyFila ? hoyFila.acumuladas : acumuladas,
      finEstim: finEstim,
      diasAptos: diasAptos,
      diasBloqueados: diasBloqueados,
      anclaFecha: anclaFecha
    };
  }

  function renderGestionSiembra() {
    const card = $('siembra-curso');
    if (!card) return;

    // Solo mostrar si el grupo activo está en-curso
    if (window.AM_SIEMBRA_FASE !== 'en-curso') { card.classList.add('hidden'); card.innerHTML=''; return; }
    card.classList.remove('hidden');

    const cult = gv('s-cultivo'), suelo = gv('s-suelo');
    const dias = window._siembraDias || null;
    const lote = (typeof window.amGetLoteActivo === 'function') ? window.amGetLoteActivo() : null;
    const grupo = window.AM_SIEMBRA_CURRENT_GRUPO || (cult && ['Trigo','Cebada','Colza'].indexOf(cult)>=0 ? 'invierno':'verano');
    const sr = (lote && lote.data && lote.data.siembraRealizada && lote.data.siembraRealizada[grupo]) || {};

    let html = '<div class="card gap-top" style="border:1.5px solid rgba(74,140,92,.35)">';
    html += '<div class="card-title">📅 Gestión de siembra en curso <span style="font-size:.66rem;font-weight:400;color:rgba(74,46,26,.4);margin-left:auto">' + esc(cult) + ' · pronóstico Open-Meteo</span></div>';

    if (!dias || !dias.length) {
      html += '<div style="padding:1.5rem;text-align:center;color:rgba(74,46,26,.5);font-size:.85rem">Presioná <strong>Obtener datos</strong> para ver el pronóstico de ventanas de siembra de los próximos días.</div>';
    } else {
      // Clasificar todos los días
      const clasif = dias.map((_, i) => clasificarDiaSiembra(dias, i, cult, suelo));
      const hoyStr = new Date().toISOString().split('T')[0];
      let idxHoy = clasif.findIndex(c => c.fecha === hoyStr);
      if (idxHoy < 0) idxHoy = clasif.findIndex(c => c.fecha >= hoyStr);
      if (idxHoy < 0) idxHoy = 0;

      // 1. RECOMENDACIÓN DESTACADA
      const rec = generarRecomendacion(clasif, idxHoy);
      if (rec) {
        const colores = {
          urgente:    ['#7A4A10','#FFF3D6'], optimo: ['#1A5C2A','#D6F5DE'],
          precaucion: ['#7A4A10','#FFF3D6'], esperar:['#7A1A0A','#FBD9D2'],
        };
        const cz = colores[rec.nivel] || colores.optimo;
        html += '<div style="background:' + cz[0] + ';border-radius:12px;padding:1.1rem 1.3rem;margin-bottom:1rem">' +
          '<div style="font-family:\'DM Serif Display\',serif;font-size:1.1rem;color:white;font-weight:700">' + rec.titulo + '</div>' +
          '<div style="font-size:.8rem;color:rgba(255,255,255,.85);margin-top:.3rem">' + rec.detalle + '</div>' +
        '</div>';
      }

      // 2. CALENDARIO DE APTITUD (solo desde hoy en adelante)
      const futuros = clasif.slice(idxHoy);
      html += '<div class="sl">Ventanas de siembra — próximos ' + futuros.length + ' días</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0 1rem">';
      const diaSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
      futuros.forEach(c => {
        const dObj = new Date(c.fecha + 'T12:00:00');
        const ds = diaSemana[dObj.getDay()];
        const dnum = c.fecha.split('-')[2];
        const bg = c.estado==='apto'?'rgba(74,140,92,.18)':c.estado==='marginal'?'rgba(184,122,32,.16)':c.estado==='lluvia'?'rgba(201,74,42,.16)':c.estado==='anegado'?'rgba(100,100,100,.16)':c.estado==='seco'?'rgba(140,90,40,.14)':c.estado==='frio'?'rgba(42,90,140,.14)':'rgba(120,120,180,.14)';
        const bd = c.estado==='apto'?'rgba(74,140,92,.5)':'rgba(74,46,26,.12)';
        const tip = c.label + (c.h!=null?' · Hum ' + c.h.toFixed(0) + '% (' + c.condHum + ')':'') + (c.t!=null?' · Suelo ' + c.t.toFixed(0) + '°':'') + (c.prof?' · Prof ' + c.prof + 'cm':'');
        html += '<div title="' + esc(tip) + '" style="flex:1 1 calc(14.28% - .4rem);min-width:62px;background:' + bg + ';border:1px solid ' + bd + ';border-radius:9px;padding:.5rem .3rem;text-align:center">' +
          '<div style="font-size:.62rem;color:rgba(74,46,26,.5);text-transform:uppercase;letter-spacing:.5px">' + ds + ' ' + dnum + '</div>' +
          '<div style="font-size:1.15rem;line-height:1.4">' + c.emoji + '</div>' +
          '<div style="font-size:.6rem;color:rgba(74,46,26,.55);font-weight:600">' + (c.h!=null?c.h.toFixed(0)+'%':'—') + '</div>' +
        '</div>';
      });
      html += '</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:.5rem .9rem;font-size:.66rem;color:rgba(74,46,26,.5);margin-bottom:1rem">' +
        '<span>🟢 Apto</span><span>🟡 Marginal</span><span>🔴 Lluvia</span><span>⛔ Saturado</span><span>🟤 Muy seco</span><span>🔵 Frío</span><span>💨 Viento</span></div>';

      // 3. PROGRESO DE SIEMBRA
      const total = parseFloat(sr.hectareasTotal || (lote && lote.data && lote.data.superficie) || 0) || 0;
      const completadas = parseFloat(sr.hectareasCompletadas || 0) || 0;
      const haDiaInfo = scGetHaDia(sr, lote);
      let haDia = haDiaInfo.valor;
      const proy = scProyectarAvance(clasif, idxHoy, sr, total, haDia);
      const restantes = Math.max(0, total - completadas);
      const pct = total > 0 ? Math.min(100, Math.round(completadas / total * 100)) : 0;
      const diasNec = haDia > 0 ? Math.ceil(restantes / haDia) : null;

      // Proyectar fin sobre días aptos del forecast
      const finEstim = proy.finEstim;

      html += '<div class="sl">Progreso de siembra</div>';
      html += '<div style="margin:.5rem 0">';
      html += '<div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:.3rem"><span style="color:rgba(74,46,26,.6)">' + completadas.toFixed(0) + ' / ' + (total>0?total.toFixed(0):'—') + ' ha</span><span style="font-weight:700;color:#2A5A3A">' + pct + '%</span></div>';
      html += '<div style="height:10px;background:rgba(74,46,26,.1);border-radius:6px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#4A9A5A,#2A5A3A);border-radius:6px"></div></div>';
      html += '</div>';

      html += '<div class="rg" style="margin-top:.7rem">';
      html += '<div class="kc neutral"><div class="kl">Restante</div><div class="kv">' + restantes.toFixed(0) + '</div><div class="ku">ha</div></div>';
      html += '<div class="kc neutral"><div class="kl">Capacidad</div><div class="kv">' + (haDia>0?haDia.toFixed(0):'—') + '</div><div class="ku">ha/día</div></div>';
      html += '<div class="kc ' + (diasNec!=null&&diasNec>0?'':'neutral') + '"><div class="kl">Días de trabajo</div><div class="kv">' + (diasNec!=null?diasNec:'—') + '</div><div class="ku">a capacidad</div></div>';
      html += '<div class="kc blue"><div class="kl">Fin estimado</div><div class="kv" style="font-size:1rem">' + (finEstim?finEstim.split('-').slice(1).reverse().join('/'):'—') + '</div><div class="ku">según ventanas</div></div>';
      html += '</div>';

      html += '<div style="margin-top:.75rem;background:rgba(42,90,58,.07);border:1px solid rgba(42,90,58,.12);border-radius:10px;padding:.75rem .85rem">';
      html += '<div style="display:flex;justify-content:space-between;gap:.7rem;align-items:center;flex-wrap:wrap;margin-bottom:.55rem">';
      html += '<div style="font-size:.74rem;font-weight:800;color:#1E4D2B;text-transform:uppercase;letter-spacing:.04em">Proyección automática</div>';
      html += '<div style="font-size:.68rem;color:rgba(74,46,26,.58)">Capacidad: ' + (haDia>0?haDia.toFixed(1) + ' ha/día': 'sin dato') + (haDiaInfo.fuente ? ' · ' + esc(haDiaInfo.fuente) : '') + '</div>';
      html += '</div>';
      const filasGraf = proy.filas.filter(f => f.fecha >= scHoyISO()).slice(0, 12);
      if (!filasGraf.length || haDia <= 0) {
        html += '<div style="font-size:.75rem;color:rgba(74,46,26,.55)">AgroMotor puede estimar el avance automáticamente cuando tenga la capacidad operativa en ha/día. Cargala acá o calculala en Maquinaria.</div>';
      } else {
        html += '<div style="display:grid;grid-template-columns:repeat(' + Math.min(6, filasGraf.length) + ',minmax(42px,1fr));gap:.4rem">';
        filasGraf.forEach(f => {
          const basePct = haDia > 0 ? Math.min(100, Math.round((f.avance / haDia) * 100)) : 0;
          const bg = f.estadoAvance === 'confirmado' ? '#2E6EA5' : (f.estadoAvance === 'bloqueado' ? '#C94A2A' : (f.estadoAvance === 'completo' ? '#7C8A77' : '#2A8A4A'));
          const fill = f.estadoAvance === 'bloqueado' ? 100 : Math.max(8, basePct);
          html += '<div title="' + esc(f.motivo) + '" style="min-width:0">';
          html += '<div style="height:54px;background:rgba(74,46,26,.08);border-radius:8px;display:flex;align-items:flex-end;overflow:hidden;border:1px solid rgba(74,46,26,.08)"><div style="width:100%;height:' + fill + '%;background:' + bg + ';opacity:' + (f.avance>0 || f.estadoAvance==='bloqueado' ? '1' : '.35') + '"></div></div>';
          html += '<div style="font-size:.58rem;color:rgba(74,46,26,.55);text-align:center;margin-top:.22rem">' + scFechaCorta(f.fecha) + '</div>';
          html += '<div style="font-size:.62rem;font-weight:800;color:#1E4D2B;text-align:center">' + (f.avance>0?f.avance.toFixed(0):'0') + ' ha</div>';
          html += '</div>';
        });
        html += '</div>';
        html += '<div style="display:flex;gap:.65rem;flex-wrap:wrap;margin-top:.55rem;font-size:.64rem;color:rgba(74,46,26,.58)"><span><b style="color:#2A8A4A">■</b> Estimado</span><span><b style="color:#2E6EA5">■</b> Confirmado</span><span><b style="color:#C94A2A">■</b> Bloqueado</span><span>' + proy.diasAptos + ' días aptos · ' + proy.diasBloqueados + ' bloqueados</span></div>';
      }
      html += '</div>';

      // Inputs de avance
      html += '<div style="display:flex;flex-wrap:wrap;gap:.6rem;align-items:flex-end;margin-top:.9rem;padding-top:.9rem;border-top:1px solid rgba(74,46,26,.1)">';
      html += '<div style="flex:1;min-width:120px"><label style="font-size:.7rem;color:rgba(74,46,26,.55);display:block;margin-bottom:.2rem">Ha completadas</label><input type="number" id="sc-ha-comp" value="' + completadas + '" min="0" max="' + (total||99999) + '" style="width:100%;padding:.45rem .6rem;border:1px solid rgba(74,46,26,.2);border-radius:8px"></div>';
      html += '<div style="flex:1;min-width:120px"><label style="font-size:.7rem;color:rgba(74,46,26,.55);display:block;margin-bottom:.2rem">Ha/día (capacidad)</label><input type="number" id="sc-ha-dia" value="' + (haDia>0?haDia.toFixed(1):'') + '" placeholder="ej: 35" min="0" step="0.1" style="width:100%;padding:.45rem .6rem;border:1px solid rgba(74,46,26,.2);border-radius:8px"></div>';
      html += '<button onclick="window.scGuardarAvance(\'' + esc(grupo) + '\')" style="background:#2A5A3A;color:#fff;border:none;border-radius:8px;padding:.55rem 1.1rem;font-size:.8rem;font-weight:700;cursor:pointer">Actualizar avance</button>';
      if (haDia <= 0) {
        html += '<button onclick="window.dlAbrirModulo&&window.dlAbrirModulo(\'maquinaria\',(window.amGetLoteActivo&&window.amGetLoteActivo()||{}).id)" style="background:rgba(74,140,92,.12);color:#1E4D2B;border:1px solid rgba(74,140,92,.3);border-radius:8px;padding:.55rem 1.1rem;font-size:.8rem;font-weight:600;cursor:pointer">🚜 Calcular en Maquinaria</button>';
      }
      html += '</div>';

      if (completadas >= total && total > 0) {
        html += '<div style="margin-top:.9rem;background:rgba(74,140,92,.12);border-radius:10px;padding:.8rem 1rem;text-align:center;font-size:.85rem;font-weight:700;color:#1E4D2B">🎉 Siembra completada — el cultivo está 100% implantado</div>';
      }
    }

    html += '</div>';
    card.innerHTML = html;
  }

  // Guardar avance de siembra (ha completadas + capacidad opcional)
  window.scGuardarAvance = function(grupo) {
    const lote = (typeof window.amGetLoteActivo === 'function') ? window.amGetLoteActivo() : null;
    if (!lote) return;
    lote.data = lote.data || {};
    lote.data.siembraRealizada = lote.data.siembraRealizada || {};
    const entry = lote.data.siembraRealizada[grupo] || {};
    const haComp = parseFloat((document.getElementById('sc-ha-comp')||{}).value);
    if (!isNaN(haComp)) {
      entry.hectareasCompletadas = Math.max(0, haComp);
      entry.avanceDiario = Array.isArray(entry.avanceDiario) ? entry.avanceDiario : [];
      const hoy = scHoyISO();
      const idx = entry.avanceDiario.findIndex(r => r && r.fecha === hoy);
      const rec = {
        fecha: hoy,
        haAcumuladasReales: entry.hectareasCompletadas,
        estado: 'confirmado',
        ts: Date.now()
      };
      if (idx >= 0) entry.avanceDiario[idx] = Object.assign({}, entry.avanceDiario[idx], rec);
      else entry.avanceDiario.push(rec);
      entry.avanceDiario.sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
    }
    const haDiaEl = document.getElementById('sc-ha-dia');
    if (haDiaEl) {
      const v = parseFloat(haDiaEl.value);
      if (!isNaN(v) && v > 0) {
        entry.haDiaria = v;
        lote.data.maquinaria = lote.data.maquinaria || {};
        lote.data.maquinaria.haDia = v;
        try{ localStorage.setItem('am_maq_hd', String(v)); }catch(_){}
      }
    }
    if (!entry.hectareasTotal && lote.data.superficie) entry.hectareasTotal = parseFloat(lote.data.superficie) || 0;
    lote.data.siembraRealizada[grupo] = entry;
    if (typeof window.amGuardarLotesEstado === 'function') window.amGuardarLotesEstado();
    if (typeof window.amToast === 'function') window.amToast('Avance de siembra actualizado', 'ok');
    try { renderGestionSiembra(); } catch(_) {}
  };

  // Exponer a global por retrocompatibilidad HTML
  window.buscarAPI = buscarAPI;
  window.calcSiembra = calcSiembra;
  window.siembraRenderGestion = renderGestionSiembra;

})();
