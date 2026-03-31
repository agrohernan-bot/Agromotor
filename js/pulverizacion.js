// ════════════════════════════════════════════════════════
// AGROMOTOR — pulverizacion.js
// Semáforo agronómico · Delta T · Deriva · Caldo
// Registro de aplicación · HRAC · Calidad de agua
// ════════════════════════════════════════════════════════

// MÓDULO PULVERIZACIÓN — AgroMotor v3.5
// JS completo con prefijo pulv para evitar conflictos
// Conectado a Open-Meteo ya disponible en el motor
// ════════════════════════════════════════════════════════

// ── ESTADO LOCAL ─────────────────────────────────────
let PULV_METEO = null;   // datos meteo del módulo principal
let PULV_HOURLY = null;  // pronóstico horario
let pulvProdAgua = 'glifosato';
let pulvPhActual = 7.5;

// ── NAVEGACIÓN INTERNA ────────────────────────────────
function pulvTab(id, el) {
  document.querySelectorAll('.pulv-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.pulv-tab').forEach(t => t.classList.remove('active'));
  $('pulv-' + id)?.classList.add('active');
  el?.classList.add('active');
  if (id === 'hrac') pulvRenderHRAC();
  if (id === 'agua') { pulvRenderMeteoBadgesAgua(); pulvCalcAgua(); }
}

// ── INTEGRACIÓN CON MOTOR PRINCIPAL ──────────────────
// Cuando el usuario entra al módulo de pulverización,
// reutilizamos los datos de Open-Meteo ya consultados
function pulvRefrescarMeteo() {
  // Intentar tomar datos del motor principal
  const t = parseFloat($('sv-t6')?.textContent) || null;
  const hr = parseFloat($('sv-h1')?.textContent) || null;
  const viento = parseFloat($('sv-viento')?.textContent) || null;
  const vpd = parseFloat($('sv-vpd')?.textContent) || null;

  if (t !== null && hr !== null) {
    PULV_METEO = {
      temperature_2m: t,
      relative_humidity_2m: hr,
      wind_speed_10m: viento || 10,
      wind_gusts_10m: (viento || 10) * 1.4,
      dew_point_2m: t - ((100 - hr) / 5),
      precipitation: 0,
      precipitation_probability: 0,
      wind_direction_10m: 180,
    };
    pulvRenderSemaforo(PULV_METEO);
    pulvRenderDeriva(PULV_METEO);
    pulvAutoFillRegistro(PULV_METEO);
    pulvRenderMeteoBadgesAgua();
    $('pulv-gps-dot').className = 'gps-dot-p';
    $('pulv-gps-txt').innerHTML = `Datos del lote activo — T° suelo <strong>${t}°C</strong> · HR <strong>${hr}%</strong> · Viento <strong>${viento || '—'} km/h</strong>`;
  } else {
    $('pulv-gps-dot').className = 'gps-dot-p error';
    $('pulv-gps-txt').textContent = 'Sin datos — cargá coordenadas en el módulo de Siembra primero';
  }

  // Intentar obtener pronóstico horario del motor
  if (window._meteoHourly) {
    PULV_HOURLY = window._meteoHourly;
    pulvRenderVentana(PULV_HOURLY);
  }
}

// ── SEMÁFORO PRINCIPAL ────────────────────────────────
function pulvRenderSemaforo(c) {
  if (!c) return;
  const temp = c.temperature_2m, hr = c.relative_humidity_2m;
  const viento = c.wind_speed_10m, rafagas = c.wind_gusts_10m;
  const pp = c.precipitation || 0, ppProb = c.precipitation_probability || 0;
  const rocio = c.dew_point_2m || (temp - ((100 - hr) / 5));

  const alertas = [];
  let score = 0;

  // Viento
  if (viento > 25)      { score = Math.max(score,2); alertas.push({ico:'🚫',txt:`<strong>Viento excesivo (${viento} km/h):</strong> Riesgo alto de deriva. Suspender aplicación.`,sev:'rojo'}); }
  else if (viento > 15) { score = Math.max(score,1); alertas.push({ico:'⚠️',txt:`<strong>Viento moderado (${viento} km/h):</strong> Operar con precaución, evaluar boquillas antideriva.`,sev:'amarillo'}); }
  else if (viento < 3)  { score = Math.max(score,1); alertas.push({ico:'⚠️',txt:`<strong>Viento muy bajo (${viento} km/h):</strong> Posible inversión térmica. Riesgo de gotas en suspensión.`,sev:'amarillo'}); }
  else                  { alertas.push({ico:'✅',txt:`<strong>Viento óptimo (${viento} km/h):</strong> Condición favorable para la aplicación.`,sev:'verde'}); }

  if (rafagas > 30) { score = Math.max(score,2); alertas.push({ico:'💨',txt:`<strong>Ráfagas de ${rafagas.toFixed(0)} km/h:</strong> Peligro de deriva severa. No aplicar.`,sev:'rojo'}); }

  // Temperatura
  if (temp > 32)      { score = Math.max(score,2); alertas.push({ico:'🌡',txt:`<strong>Temperatura alta (${temp}°C):</strong> Volatilización severa, especialmente de hormonales. Suspender.`,sev:'rojo'}); }
  else if (temp > 28) { score = Math.max(score,1); alertas.push({ico:'🌡',txt:`<strong>Temperatura elevada (${temp}°C):</strong> Posible volatilización. Vigilar.`,sev:'amarillo'}); }
  else if (temp < 8)  { score = Math.max(score,1); alertas.push({ico:'❄️',txt:`<strong>Temperatura baja (${temp}°C):</strong> Metabolismo foliar lento. Menor absorción de sistémicos.`,sev:'amarillo'}); }
  else                { alertas.push({ico:'✅',txt:`<strong>Temperatura óptima (${temp}°C):</strong> Condición favorable para absorción foliar.`,sev:'verde'}); }

  // Humedad
  if (hr < 40)      { score = Math.max(score,2); alertas.push({ico:'🏜',txt:`<strong>HR muy baja (${hr}%):</strong> Alta evaporación de gotas. No apto.`,sev:'rojo'}); }
  else if (hr < 55) { score = Math.max(score,1); alertas.push({ico:'💧',txt:`<strong>HR baja (${hr}%):</strong> Mayor evaporación. Aumentar volumen de caldo.`,sev:'amarillo'}); }
  else              { alertas.push({ico:'✅',txt:`<strong>Humedad adecuada (${hr}%):</strong> Buenas condiciones para deposición del caldo.`,sev:'verde'}); }

  // Lluvia
  if (pp > 0) { score = Math.max(score,2); alertas.push({ico:'🌧',txt:`<strong>Lluvia activa (${pp} mm):</strong> Suspender inmediatamente.`,sev:'rojo'}); }
  else if (ppProb > 40) { score = Math.max(score,1); alertas.push({ico:'⛅',txt:`<strong>Probabilidad de lluvia: ${ppProb}%:</strong> Riesgo de lavado. Verificar período libre del producto.`,sev:'amarillo'}); }

  // Inversión térmica
  const hora = new Date().getHours();
  const deltaTD = temp - rocio;
  if ((hora >= 20 || hora <= 7) && deltaTD < 3) {
    score = Math.max(score,1);
    alertas.push({ico:'🌙',txt:`<strong>Posible inversión térmica:</strong> Horario nocturno con baja diferencia T°-rocío (${deltaTD.toFixed(1)}°C). Riesgo de gotas en suspensión.`,sev:'amarillo'});
  }

  const estados = [
    {txt:'✅ APTO para pulverizar', desc:'Las condiciones meteorológicas actuales son favorables. Verificar el período libre de lluvia del producto antes de aplicar.', cls:'verde', ico:'✅', badge:'APTO'},
    {txt:'⚠️ Aplicar con precaución', desc:'Hay condiciones que requieren atención. Revisar las alertas antes de decidir. Considerar horario alternativo.', cls:'amarillo', ico:'⚠️', badge:'PRECAUCIÓN'},
    {txt:'🚫 NO aplicar', desc:'Las condiciones actuales representan un riesgo significativo de deriva, volatilización o ineficacia. Esperar mejores condiciones.', cls:'rojo', ico:'🚫', badge:'NO APTO'},
  ];
  const e = estados[score];

  $('pulv-sem-loading').style.display = 'none';
  $('pulv-sem-content').style.display = 'block';
  $('pulv-estado-txt').textContent = e.txt;
  $('pulv-desc-txt').textContent = e.desc;
  const badge = $('pulv-badge');
  badge.className = 'sem-badge ' + e.cls;
  $('pulv-emoji').textContent = e.ico;
  $('pulv-badge-txt').textContent = e.badge;

  // KPIs meteo
  const campos = [
    {lbl:'Temperatura',  val:`${temp}°C`,      cls: temp>32?'warn':temp<8?'caution':'ok',   st: temp>32?'warn':temp<8?'caution':'ok'},
    {lbl:'HR',           val:`${hr}%`,          cls: hr<40?'warn':hr<55?'caution':'ok',       st: hr<40?'warn':hr<55?'caution':'ok'},
    {lbl:'Viento',       val:`${viento} km/h`,  cls: viento>25?'warn':viento<3?'caution':viento>15?'caution':'ok', st: viento>25?'warn':viento>15?'caution':'ok'},
    {lbl:'Ráfagas',      val:`${rafagas.toFixed(0)} km/h`, cls: rafagas>30?'warn':'neutral',  st: rafagas>30?'warn':'ok'},
    {lbl:'T°-Rocío',     val:`${deltaTD.toFixed(1)}°C`,   cls: deltaTD<3?'caution':'ok',      st: deltaTD<3?'caution':'ok'},
    {lbl:'Prob. Lluvia', val:`${ppProb}%`,       cls: ppProb>40?'caution':'ok',                st: ppProb>40?'caution':'ok'},
  ];
  $('pulv-meteo-grid').innerHTML = campos.map(f =>
    `<div class="meteo-cel"><div class="meteo-var">${f.lbl}</div><div class="meteo-val ${f.cls}">${f.val}</div><div class="mstatus ${f.st}">${f.st==='ok'?'OK':f.st==='warn'?'ALERTA':'ATENCIÓN'}</div></div>`
  ).join('');

  $('pulv-alertas').innerHTML = alertas.map(a =>
    `<div class="al-item"><span>${a.ico}</span><span style="color:rgba(28,18,8,.75)">${a.txt}</span></div>`
  ).join('');
}

// ── VENTANA HORARIA ───────────────────────────────────
function pulvRenderVentana(hourly) {
  if (!hourly?.time) return;
  const now = new Date();
  const nowH = now.getHours();
  const fechaEl = $('pulv-ventana-fecha');
  if (fechaEl) fechaEl.textContent = now.toLocaleDateString('es-AR',{weekday:'short',day:'2-digit',month:'short'});

  const bloques = [];
  for (let i = 0; i < Math.min(24, hourly.time.length); i++) {
    const t = new Date(hourly.time[i]);
    const h = t.getHours();
    const temp = hourly.temperature_2m?.[i] || 20;
    const hr   = hourly.relative_humidity_2m?.[i] || 60;
    const viento = hourly.wind_speed_10m?.[i] || 10;
    const pp = hourly.precipitation_probability?.[i] || 0;
    const pasado = t < now;
    let clase = 'apto';
    if (viento > 25 || temp > 32 || hr < 40) clase = 'no-apto';
    else if (viento > 15 || temp > 28 || hr < 55 || pp > 40) clase = 'parcial';
    const esAhora = h === nowH;
    bloques.push(`<div class="hour-b ${pasado?'pasado':clase}">${esAhora?'<div class="hour-now">AHORA</div>':''}<div class="hour-lbl">${String(h).padStart(2,'0')}:00</div><div style="font-size:.9rem">${clase==='apto'?'✅':clase==='parcial'?'⚠️':'🚫'}</div><div style="font-size:.65rem;font-family:\'DM Mono\',monospace;margin-top:.2rem">${viento.toFixed(0)}km</div></div>`);
  }
  $('pulv-timeline').innerHTML = bloques.join('');
  $('pulv-ventana-card').classList.remove('hidden');
}

// ── DERIVA ────────────────────────────────────────────
function pulvRenderDeriva(c) {
  if (!c) return;
  const v = c.wind_speed_10m, hr = c.relative_humidity_2m;
  const temp = c.temperature_2m, r = c.wind_gusts_10m;

  let riesgo = 0;
  if (v > 20) riesgo = 90;
  else if (v > 15) riesgo = 70;
  else if (v > 10) riesgo = 45;
  else if (v > 5)  riesgo = 25;
  else riesgo = 15;

  if (hr < 50) riesgo = Math.min(100, riesgo + 15);
  if (temp > 30) riesgo = Math.min(100, riesgo + 10);

  const deg = -90 + (riesgo / 100) * 180;
  const needle = $('pulv-derive-needle');
  if (needle) needle.style.setProperty('--needle-deg', deg + 'deg');

  const lbl = riesgo < 30 ? 'Bajo' : riesgo < 55 ? 'Moderado' : riesgo < 75 ? 'Alto' : 'Muy Alto';
  if ($('pulv-deriva-val')) $('pulv-deriva-val').textContent = riesgo + '%';
  if ($('pulv-deriva-lbl')) $('pulv-deriva-lbl').textContent = `Riesgo ${lbl} de deriva`;

  const fctrs = [
    {lbl:'Viento', val:`${v} km/h`, cls: v>15?'warn':v>10?'caution':'ok'},
    {lbl:'Ráfagas', val:`${r.toFixed(0)} km/h`, cls: r>25?'warn':r>18?'caution':'ok'},
    {lbl:'HR', val:`${hr}%`, cls: hr<50?'warn':hr<65?'caution':'ok'},
    {lbl:'T°', val:`${temp}°C`, cls: temp>30?'warn':temp>25?'caution':'ok'},
  ];
  if ($('pulv-deriva-fctrs')) {
    $('pulv-deriva-fctrs').innerHTML = fctrs.map(f =>
      `<div class="drift-f ${f.cls}"><div class="df-val" style="color:${f.cls==='warn'?'var(--warn)':f.cls==='caution'?'var(--caution)':'var(--ok)'}">${f.val}</div><div class="df-lbl">${f.lbl}</div></div>`
    ).join('');
  }
}

// ── BUFFER ────────────────────────────────────────────
function pulvCalcBuffer() {
  const lindero = gv('pd-lindero'), boquilla = gv('pd-boquilla');
  if (!lindero || !boquilla) return;
  const bufBase = {soja:20,hortalizas:50,apicultura:100,agua:30,urbano:75,forestal:15};
  const fBoquilla = {abanico_estandar:1.0,abanico_antideriva:0.6,doble_abanico:0.75,cono_hueco:1.3};
  const notas = {
    soja:'Especialmente crítico en floración. La soja es muy sensible a hormonales (2,4-D, Dicamba).',
    hortalizas:'Cultivos de alta sensibilidad. Verificar viento < 8 km/h.',
    apicultura:'Coordinar con apicultores. Aplicar en horario de menor actividad.',
    agua:'Respetar legislación provincial. Algunos productos tienen restricciones adicionales.',
    urbano:'Verificar ordenanzas municipales y zonas de exclusión locales.',
    forestal:'Considerar fauna silvestre y polinizadores nativos.'
  };
  const v = PULV_METEO?.wind_speed_10m || 10;
  const fV = 1 + (v / 25);
  const buf = Math.round(bufBase[lindero] * (fBoquilla[boquilla]||1) * fV);
  if ($('pd-buffer-val')) $('pd-buffer-val').textContent = buf;
  if ($('pd-buffer-nota')) $('pd-buffer-nota').textContent = '⚠ ' + (notas[lindero]||'');
  $('pd-buffer-res')?.classList.remove('hidden');
}

// ── CALCULADORA CALDO ─────────────────────────────────
const PULV_PRODUCTOS = {
  herbicida:[
    {nombre:'Glifosato 48%',dosis:2.5,unidad:'L/ha',mezcla:'herbicida_sistemico'},
    {nombre:'Glifosato + Dicamba',dosis:1.8,unidad:'L/ha',mezcla:'hormonal'},
    {nombre:'2,4-D Amina 72%',dosis:1.0,unidad:'L/ha',mezcla:'hormonal'},
    {nombre:'Atrazina 50%',dosis:3.0,unidad:'L/ha',mezcla:'preemergente'},
    {nombre:'Cletodim 12%',dosis:0.8,unidad:'L/ha',mezcla:'graminicida'},
    {nombre:'Haloxifop 12%',dosis:0.7,unidad:'L/ha',mezcla:'graminicida'},
    {nombre:'Metribuzin 70%',dosis:0.35,unidad:'kg/ha',mezcla:'preemergente'},
    {nombre:'Metsulfurón 60%',dosis:0.007,unidad:'kg/ha',mezcla:'ats'},
  ],
  fungicida:[
    {nombre:'Tebuconazole 25%',dosis:0.75,unidad:'L/ha',mezcla:'triazol'},
    {nombre:'Azoxistrobin + Cipro',dosis:0.3,unidad:'L/ha',mezcla:'estrobilurina'},
    {nombre:'Trifloxistrobin + Cip.',dosis:0.4,unidad:'L/ha',mezcla:'estrobilurina'},
    {nombre:'Fluxapiroxad + Epox.',dosis:0.4,unidad:'L/ha',mezcla:'sdhi'},
    {nombre:'Mancozeb 80%',dosis:2.0,unidad:'kg/ha',mezcla:'contacto'},
  ],
  insecticida:[
    {nombre:'Clorpirifos 48%',dosis:1.0,unidad:'L/ha',mezcla:'op'},
    {nombre:'Lambda-cialotrina 5%',dosis:0.15,unidad:'L/ha',mezcla:'piretroide'},
    {nombre:'Cipermetrina 25%',dosis:0.2,unidad:'L/ha',mezcla:'piretroide'},
    {nombre:'Imidacloprid 35%',dosis:0.25,unidad:'L/ha',mezcla:'neonicotinoide'},
    {nombre:'Spinosad 12%',dosis:0.15,unidad:'L/ha',mezcla:'spinosina'},
  ],
  fertilizante_foliar:[
    {nombre:'Urea foliar 20%',dosis:3.0,unidad:'L/ha',mezcla:'foliar'},
    {nombre:'Boro líquido',dosis:0.5,unidad:'L/ha',mezcla:'foliar'},
    {nombre:'Azufre líquido 20%',dosis:1.5,unidad:'L/ha',mezcla:'foliar'},
    {nombre:'Zinc + Manganeso',dosis:1.0,unidad:'L/ha',mezcla:'foliar'},
  ]
};

const PULV_ORDENES = {
  herbicida_sistemico:['1. ½ tanque de agua limpia','2. Coadyuvante / surfactante','3. Glifosato','4. Completar con agua','5. Agitar suavemente'],
  hormonal:['1. ½ tanque de agua limpia','2. Agitar','3. Hormonal (2,4-D / Dicamba) — agregar despacio','4. Completar con agua','⚠ NUNCA mezclar con emulsionables sin prueba de jarrita'],
  preemergente:['1. ½ tanque de agua limpia','2. Dispersar el PM en agua aparte','3. Agregar al tanque agitando','4. Completar con agua','5. Mantener agitación constante'],
  graminicida:['1. ½ tanque de agua limpia','2. Aceite metilado (si se requiere)','3. Graminicida','4. Completar con agua','⚠ No mezclar con glifosato sin evaluación'],
  ats:['1. ½ tanque de agua limpia','2. Disolver el granulado en agua aparte','3. Agregar al tanque','4. Coadyuvante','5. Completar con agua'],
  triazol:['1. ½ tanque de agua','2. Coadyuvante (si se requiere)','3. Fungicida triazol','4. Completar con agua'],
  estrobilurina:['1. ½ tanque de agua','2. Fungicida (mezcla formulada)','3. Completar con agua'],
  sdhi:['1. ½ tanque de agua','2. Fungicida SDHI','3. Completar con agua','✓ Buena compatibilidad con triazoles'],
  contacto:['1. ½ tanque de agua','2. Humectar PM en agua aparte','3. Agregar al tanque agitando','4. Mantener agitación'],
  op:['1. ½ tanque de agua','2. OP (aguas ácidas o neutras)','3. Completar con agua','⚠ Incompatible pH > 7, usar buffer'],
  piretroide:['1. ½ tanque de agua','2. Piretroide','3. Completar con agua','✓ Compatible con OP y fungicidas'],
  neonicotinoide:['1. ½ tanque de agua','2. Neonicotinoide','3. Completar con agua'],
  spinosina:['1. ½ tanque de agua','2. Spinosad (baja agitación)','3. Completar con agua','✓ Selectivo para enemigos naturales'],
  foliar:['1. Agua limpia pH 5.5–6.5','2. Fertilizante foliar','3. Completar con agua','✓ Aplicar con HR > 65% y temperatura fresca'],
};

const PULV_PAUTAS = {
  herbicida:`<ul style="font-size:.82rem;color:rgba(28,18,8,.7);line-height:1.8;list-style:none"><li>🌡 Temperatura: <strong>15–28°C</strong></li><li>💧 HR: <strong>> 55%</strong></li><li>💨 Viento: <strong>3–15 km/h</strong></li><li>☀️ Evitar 12–16 hs (máxima radiación)</li><li>🌧 Período libre lluvia: <strong>4–8 hs</strong></li><li>⚠️ Hormonales (2,4-D, Dicamba): NO > 28°C ni con inversión térmica</li></ul>`,
  fungicida:`<ul style="font-size:.82rem;color:rgba(28,18,8,.7);line-height:1.8;list-style:none"><li>🌡 Temperatura: <strong>15–25°C</strong></li><li>💧 HR: <strong>> 60%</strong></li><li>💨 Viento: <strong>3–12 km/h</strong></li><li>🌧 Período libre lluvia: <strong>2–4 hs</strong></li><li>📅 Aplicar en estadio preventivo</li></ul>`,
  insecticida:`<ul style="font-size:.82rem;color:rgba(28,18,8,.7);line-height:1.8;list-style:none"><li>🌡 Temperatura: <strong>15–30°C</strong></li><li>💨 Viento: <strong>< 15 km/h</strong></li><li>🌙 Piretroides: preferir aplicación vespertina/nocturna</li><li>🐝 NO aplicar en floración con neonicotinoides u OP</li><li>🌧 Período libre lluvia: <strong>1–2 hs</strong></li></ul>`,
  fertilizante_foliar:`<ul style="font-size:.82rem;color:rgba(28,18,8,.7);line-height:1.8;list-style:none"><li>🌡 Temperatura: <strong>< 25°C</strong></li><li>💧 HR: <strong>> 65%</strong></li><li>⏰ Aplicar 7–10 hs o 17–20 hs</li><li>🌧 Período libre lluvia: <strong>6 hs</strong></li><li>💦 Volumen: <strong>100–150 L/ha</strong></li></ul>`,
};

function pulvActualizarProductos() {
  const tipo = gv('pc-tipo');
  const sel = $('pc-producto');
  sel.innerHTML = '<option value="">— Seleccionar producto —</option>';
  if (PULV_PRODUCTOS[tipo]) {
    PULV_PRODUCTOS[tipo].forEach((p,i) => {
      sel.innerHTML += `<option value="${i}">${p.nombre} (${p.dosis} ${p.unidad})</option>`;
    });
  }
  if ($('pc-pauta-body')) $('pc-pauta-body').innerHTML = PULV_PAUTAS[tipo] || '<p class="txt-muted">Seleccioná el tipo de aplicación.</p>';
  pulvCalcCaldo();
}

function pulvCalcCaldo() {
  const tipo = gv('pc-tipo'), prodIdx = gv('pc-producto');
  const volha = parseFloat($('pc-volha')?.value) || 80;
  const tanque = parseFloat($('pc-tanque')?.value) || 3000;
  const ha = parseFloat($('pc-ha')?.value) || null;
  if (!tipo || prodIdx === '' || prodIdx === null) return;
  const prod = PULV_PRODUCTOS[tipo]?.[parseInt(prodIdx)];
  if (!prod) return;

  const aut = Math.round(tanque / volha);
  const conc = ((prod.dosis / volha) * 100).toFixed(2);
  if ($('pr-dosis'))  $('pr-dosis').textContent = prod.dosis;
  if ($('pr-dosis-u')) $('pr-dosis-u').textContent = prod.unidad;
  if ($('pr-aut'))    $('pr-aut').textContent = aut;
  if ($('pr-conc'))   $('pr-conc').textContent = conc;

  if (ha) {
    if ($('pr-total'))   $('pr-total').textContent = (prod.dosis * ha).toFixed(1);
    if ($('pr-total-u')) $('pr-total-u').textContent = prod.unidad.replace('/ha','');
    if ($('pr-tanques')) $('pr-tanques').textContent = Math.ceil(ha / aut);
    if ($('pr-agua'))    $('pr-agua').textContent = Math.round(volha * ha).toLocaleString('es-AR');
  }

  const alBox = $('pr-alerta');
  if (alBox) {
    if (parseFloat(conc) < 0.5)      { alBox.classList.remove('hidden'); alBox.innerHTML = `⚠️ Concentración muy baja (${conc}%). Verificar volumen de caldo.`; }
    else if (parseFloat(conc) > 5)   { alBox.classList.remove('hidden'); alBox.innerHTML = `⚠️ Concentración alta (${conc}%). Riesgo de fitotoxicidad.`; }
    else                             { alBox.classList.add('hidden'); }
  }

  const ordenBody = $('pc-orden-body');
  if (ordenBody) {
    const orden = PULV_ORDENES[prod.mezcla];
    if (orden) ordenBody.innerHTML = `<ol style="font-size:.82rem;color:rgba(28,18,8,.7);line-height:2;list-style:none">${orden.map(s=>`<li style="padding:.15rem 0;border-bottom:1px solid rgba(60,34,16,.06)">${s}</li>`).join('')}</ol>`;
  }
}

// ── REGISTRO ──────────────────────────────────────────
let PULV_HISTORIAL = JSON.parse(localStorage.getItem('pulv-hist-v2') || '[]');

function pulvAutoFillRegistro(c) {
  if (!c) return;
  const now = new Date();
  if ($('preg-fecha')) $('preg-fecha').value = now.toISOString().split('T')[0];
  if ($('preg-hora'))  $('preg-hora').value  = now.toTimeString().slice(0,5);
  if ($('preg-temp'))  $('preg-temp').value  = c.temperature_2m?.toFixed(1) || '';
  if ($('preg-viento'))$('preg-viento').value= c.wind_speed_10m?.toFixed(1) || '';
  if ($('preg-hr'))    $('preg-hr').value    = c.relative_humidity_2m || '';
}

function pulvGuardarRegistro() {
  const r = {
    id: Date.now(),
    fecha: $('preg-fecha')?.value,
    hora: $('preg-hora')?.value,
    lote: $('preg-lote')?.value || '—',
    ha: parseFloat($('preg-ha')?.value) || 0,
    cultivo: $('preg-cultivo')?.value,
    operador: $('preg-operador')?.value,
    equipo: $('preg-equipo')?.value,
    producto: $('preg-producto')?.value,
    dosis: $('preg-dosis')?.value,
    volha: $('preg-volha')?.value,
    temp: $('preg-temp')?.value,
    viento: $('preg-viento')?.value,
    hr: $('preg-hr')?.value,
    condicion: gv('preg-condicion'),
    obs: $('preg-obs')?.value,
  };
  PULV_HISTORIAL.unshift(r);
  try { localStorage.setItem('pulv-hist-v2', JSON.stringify(PULV_HISTORIAL)); } catch(e){}
  pulvRenderHistorial();
  amToast('✅ Ficha guardada correctamente', 'ok');
}

function pulvRenderHistorial() {
  const tbody = $('preg-historial');
  if (!tbody) return;
  if (!PULV_HISTORIAL.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="txt-muted" style="text-align:center;padding:1.5rem">Sin registros aún</td></tr>';
    $('preg-stats').textContent = '0 aplicaciones';
    return;
  }
  tbody.innerHTML = PULV_HISTORIAL.map(r =>
    `<tr><td style="white-space:nowrap">${r.fecha} ${r.hora}</td><td>${r.lote}</td><td>${r.producto||'—'}</td><td>${r.ha||'—'}</td><td><span class="tag ${r.condicion}">${r.condicion==='verde'?'Apto':r.condicion==='amarillo'?'Precaución':'No apto'}</span></td></tr>`
  ).join('');
  const totalHa = PULV_HISTORIAL.reduce((s,r)=>s+(r.ha||0),0);
  if ($('preg-stats')) $('preg-stats').textContent = `${PULV_HISTORIAL.length} aplicaciones · ${totalHa.toLocaleString('es-AR')} ha total`;
}

function pulvLimpiarHistorial() {
  if (!confirm('¿Eliminar todos los registros?')) return;
  PULV_HISTORIAL = [];
  try { localStorage.setItem('pulv-hist-v2','[]'); } catch(e){}
  pulvRenderHistorial();
}

function pulvExportarPDF() {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:'mm',format:'a4'});
    doc.setFillColor(15,31,20); doc.rect(0,0,210,40,'F');
    doc.setTextColor(253,250,245); doc.setFontSize(18);
    doc.text('AgroMotor — Registro de Pulverización', 15, 18);
    doc.setFontSize(10); doc.setTextColor(200,162,85);
    doc.text('Módulo Pulverización v3.5 · INTA Argentina', 15, 27);
    doc.setTextColor(28,18,8);
    let y = 52;
    const campos = [
      ['Lote',$('preg-lote')?.value||'—'],['Fecha',$('preg-fecha')?.value||'—'],
      ['Hora',$('preg-hora')?.value||'—'],['Superficie',($('preg-ha')?.value||'—')+' ha'],
      ['Cultivo',$('preg-cultivo')?.value||'—'],['Operador',$('preg-operador')?.value||'—'],
      ['Equipo',$('preg-equipo')?.value||'—'],['',''],
      ['Producto',$('preg-producto')?.value||'—'],['Dosis',($('preg-dosis')?.value||'—')+' L/ha'],
      ['Vol. caldo',($('preg-volha')?.value||'—')+' L/ha'],['',''],
      ['Temperatura',($('preg-temp')?.value||'—')+'°C'],['Viento',($('preg-viento')?.value||'—')+' km/h'],
      ['HR',($('preg-hr')?.value||'—')+'%'],['Estado',gv('preg-condicion')?.toUpperCase()||'—'],
      ['',''],['Observaciones',$('preg-obs')?.value||'—'],
    ];
    campos.forEach(([k,v])=>{
      if (!k){y+=4;return;}
      doc.setFontSize(9);doc.setTextColor(100,80,40);doc.text(k+':',15,y);
      doc.setFontSize(11);doc.setTextColor(28,18,8);doc.text(String(v),70,y);
      y+=8;
    });
    doc.setFontSize(8);doc.setTextColor(150,130,100);
    doc.text('AgroMotor · Motor Agronómico de Decisión · INTA Argentina',15,285);
    const lote = ($('preg-lote')?.value||'lote').replace(/\s/g,'_');
    const fecha = $('preg-fecha')?.value||new Date().toISOString().split('T')[0];
    doc.save(`Pulverizacion_${lote}_${fecha}.pdf`);
    amToast('📄 PDF exportado correctamente','ok');
  } catch(e) { amToast('⚠️ Error al generar PDF','err'); }
}

// ── HRAC ──────────────────────────────────────────────
const PULV_HRAC_DB = [
  {id:1,nombre:'Rama negra',cientifico:'Conyza bonariensis / C. sumatrensis',familia:'asteraceas',grupos:[{hrac:'G (EPSPS)',nombre:'Glifosato',nivel:'total'},{hrac:'B (ALS)',nombre:'Metsulfurón / Clorsulfurón',nivel:'total'},{hrac:'D (PS II)',nombre:'Atrazina / Metribuzin',nivel:'total'}],dist:'Buenos Aires, Córdoba, Santa Fe, Entre Ríos, La Pampa, San Luis',primer:2003,peligro:true,estadio:'Roseta pequeña (< 5 cm) o pre-emergencia',alternativas:['✓ HRAC F1: Saflufenacil (Kixor®) + aceite metilado','✓ HRAC O: 2,4-D amina en mezcla (precaución volatilización)','✓ Control mecánico: cincel en barbecho','✓ Cultivos de cobertura: vicia, centeno — reducen emergencia hasta 70%'],manejo:['⚠ No confiar en glifosato solo: resistencia extendida en toda la pampa','Rotar modos de acción en cada barbecho','Priorizar aplicaciones en estadios muy tempranos'],nota:'Caso paradigmático de resistencia en Argentina. INTA recomienda mezclas con al menos 2 modos de acción y manejo del banco de semillas.',cultivos:['Soja','Maíz','Girasol','Trigo','Barbecho']},
  {id:2,nombre:'Yuyo colorado',cientifico:'Amaranthus palmeri / A. hybridus',familia:'amarantaceas',grupos:[{hrac:'G (EPSPS)',nombre:'Glifosato',nivel:'total'},{hrac:'B (ALS)',nombre:'Imidazolinonas / Sulfonilureas',nivel:'total'}],dist:'Córdoba, Buenos Aires, Santa Fe, Entre Ríos',primer:1997,peligro:true,estadio:'Pre-emergencia o < 3 cm',alternativas:['✓ HRAC F1: Saflufenacil solo o en mezcla','✓ HRAC K3: Pendimetalín, S-metolacloro (pre-emergentes)','✓ HRAC E: Fomesafén en soja RR'],manejo:['⚠ A. palmeri: resistencia múltiple documentada — máxima alerta','Tasa de producción: hasta 600.000 semillas/planta','Nunca permitir que una planta llegue a semillar'],nota:'A. palmeri es considerado la maleza de mayor potencial invasivo en Argentina.',cultivos:['Soja','Maíz','Girasol','Barbecho']},
  {id:3,nombre:'Sorgo de Alepo',cientifico:'Sorghum halepense',familia:'poaceas',grupos:[{hrac:'G (EPSPS)',nombre:'Glifosato',nivel:'total'},{hrac:'A (ACCasa)',nombre:'Haloxifop / Cletodim',nivel:'parcial'}],dist:'Buenos Aires, Córdoba, Santa Fe, Entre Ríos, La Pampa',primer:2005,peligro:true,estadio:'Macollos tempranos (< 30 cm)',alternativas:['✓ HRAC A: Clethodim 24% a dosis plenas','✓ Cultivos de invierno competitivos en rotación','✓ En maíz: nicosulfurón en estadio adecuado'],manejo:['⚠ Biotipos resistentes a glifosato y ACCasa: opciones muy limitadas','Limpiar máquinas entre lotes — no diseminar rizomas'],nota:'La resistencia a ACCasa en S. halepense representa uno de los escenarios más complejos de manejo.',cultivos:['Soja','Maíz','Girasol','Barbecho']},
  {id:4,nombre:'Raigrás anual',cientifico:'Lolium multiflorum',familia:'poaceas',grupos:[{hrac:'G (EPSPS)',nombre:'Glifosato',nivel:'total'},{hrac:'A (ACCasa)',nombre:'Cletodim / Haloxifop',nivel:'total'},{hrac:'B (ALS)',nombre:'Metsulfurón',nivel:'parcial'}],dist:'Buenos Aires (sur), La Pampa, Córdoba sur',primer:1996,peligro:true,estadio:'2-3 hojas, antes del macollaje',alternativas:['✓ HRAC K1: Trifluralin presiembra incorporado','✓ HRAC F1: Pinoxaden en cereales (biotipos sin resistencia ACCasa)','✓ Rotación con cultivos de verano'],manejo:['⚠ Resistencia múltiple documentada (G + A + B)','El primer caso de resistencia en Argentina fue en raigrás (1996)'],nota:'Primer biotipo resistente documentado en Argentina. La resistencia múltiple complica el manejo en trigo y pasturas.',cultivos:['Trigo','Cebada','Pasturas','Barbecho']},
  {id:5,nombre:'Mostacilla',cientifico:'Raphanus sativus / Sinapis arvensis',familia:'otras',grupos:[{hrac:'B (ALS)',nombre:'Metsulfurón / Tribenuron',nivel:'total'},{hrac:'G (EPSPS)',nombre:'Glifosato',nivel:'parcial'}],dist:'Buenos Aires, La Pampa, Córdoba sur',primer:2008,peligro:false,estadio:'2-4 hojas, antes de elongación',alternativas:['✓ HRAC O: 2,4-D amina + MCPA en trigo','✓ HRAC C: Diclorprop en mezclas','✓ HRAC I: Clopyralid (en girasol)'],manejo:['⚠ Resistencia a ALS extendida en zona triguera bonaerense','Rotar modos de acción cada campaña de trigo'],nota:'La resistencia a ALS en mostacilla es uno de los casos más frecuentes en el cinturón triguero.',cultivos:['Trigo','Cebada','Girasol','Barbecho']},
];

let pulvHRACBusq = '';

function pulvRenderHRAC() {
  const grid = $('pulv-hrac-grid');
  if (!grid) return;
  const q = pulvHRACBusq.toLowerCase();
  const filtradas = q ? PULV_HRAC_DB.filter(m =>
    m.nombre.toLowerCase().includes(q) ||
    m.cientifico.toLowerCase().includes(q) ||
    m.grupos.some(g => g.hrac.toLowerCase().includes(q) || g.nombre.toLowerCase().includes(q))
  ) : PULV_HRAC_DB;

  const famCol = {asteraceas:'rgba(184,122,32,.15)',poaceas:'rgba(58,122,184,.15)',amarantaceas:'rgba(192,57,43,.15)',otras:'rgba(42,122,74,.15)'};
  const famLbl = {asteraceas:'Asteráceas',poaceas:'Poáceas',amarantaceas:'Amarantáceas',otras:'Otras'};

  grid.innerHTML = filtradas.map(m => {
    const chips = m.grupos.map(g =>
      `<span style="font-size:.65rem;padding:.15rem .5rem;border-radius:8px;background:${g.nivel==='parcial'?'rgba(184,122,32,.12)':'rgba(192,57,43,.12)'};color:${g.nivel==='parcial'?'var(--caution)':'#C0392B'};border:1px solid ${g.nivel==='parcial'?'rgba(184,122,32,.3)':'rgba(192,57,43,.3)'};font-weight:600">${g.hrac}</span>`
    ).join(' ');
    return `<div class="hrac-card" onclick="pulvAbrirModal(${m.id})">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:.5rem">
        <div>
          <div class="hrac-nombre">${m.peligro?'⚠ ':''}${m.nombre}</div>
          <div style="font-size:.72rem;color:rgba(28,18,8,.45);font-style:italic">${m.cientifico}</div>
        </div>
        <span style="font-size:.65rem;padding:.18rem .55rem;border-radius:8px;background:${famCol[m.familia]||'rgba(74,46,26,.08)'};color:rgba(28,18,8,.6);font-weight:600;white-space:nowrap">${famLbl[m.familia]||m.familia}</span>
      </div>
      <div style="margin-bottom:.5rem">${chips}</div>
      <div style="font-size:.7rem;color:rgba(28,18,8,.45)">Desde ${m.primer} · ${m.dist.split(',').slice(0,2).join(',')}...</div>
      <div style="font-size:.73rem;color:rgba(28,18,8,.6);margin-top:.4rem;font-style:italic">${m.alternativas[0]}</div>
      ${m.peligro?'<div style="font-size:.65rem;background:rgba(192,57,43,.08);color:#C0392B;padding:.25rem .6rem;border-radius:6px;margin-top:.4rem;font-weight:600">🚨 Alta peligrosidad</div>':''}
    </div>`;
  }).join('');
}

function pulvFiltrarHRAC() {
  pulvHRACBusq = $('pulv-hrac-search')?.value || '';
  pulvRenderHRAC();
}

function pulvAbrirModal(id) {
  const m = PULV_HRAC_DB.find(x => x.id === id);
  if (!m) return;
  $('pulv-hrac-modal-titulo').textContent = m.nombre;
  $('pulv-hrac-modal-sub').textContent = m.cientifico;
  const chips = m.grupos.map(g =>
    `<span style="font-size:.72rem;padding:.22rem .6rem;border-radius:8px;background:${g.nivel==='parcial'?'rgba(184,122,32,.12)':'rgba(192,57,43,.12)'};color:${g.nivel==='parcial'?'var(--caution)':'#C0392B'};border:1px solid ${g.nivel==='parcial'?'rgba(184,122,32,.3)':'rgba(192,57,43,.3)'};font-weight:600">${g.hrac} — ${g.nombre} (${g.nivel})</span>`
  ).join(' ');
  $('pulv-hrac-modal-body').innerHTML = `
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.9rem">${chips}</div>
    <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(28,18,8,.38);margin:.7rem 0 .3rem">Distribución</div>
    <p style="font-size:.82rem;color:rgba(28,18,8,.7);line-height:1.5;margin-bottom:.7rem">📍 ${m.dist}</p>
    <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(28,18,8,.38);margin:.7rem 0 .3rem">Estadio óptimo de control</div>
    <p style="font-size:.82rem;color:rgba(28,18,8,.7);line-height:1.5;margin-bottom:.7rem">🎯 ${m.estadio}</p>
    <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(28,18,8,.38);margin:.7rem 0 .3rem">Alternativas de control</div>
    ${m.alternativas.map(a=>`<div style="display:flex;gap:.5rem;align-items:flex-start;font-size:.81rem;color:rgba(28,18,8,.7);line-height:1.5;margin-bottom:.35rem"><span>•</span><span>${a}</span></div>`).join('')}
    <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(28,18,8,.38);margin:.7rem 0 .3rem">Manejo integrado</div>
    ${m.manejo.map(a=>`<div style="display:flex;gap:.5rem;align-items:flex-start;font-size:.81rem;color:rgba(28,18,8,.7);line-height:1.5;margin-bottom:.35rem"><span>•</span><span>${a}</span></div>`).join('')}
    <div style="background:rgba(58,122,184,.07);border:1px solid rgba(58,122,184,.2);border-radius:12px;padding:.9rem;margin-top:.8rem">
      <div style="font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3A7AB8;margin-bottom:.3rem">📋 Nota INTA</div>
      <p style="font-size:.81rem;color:rgba(28,18,8,.7);line-height:1.5">${m.nota}</p>
    </div>`;
  $('pulv-hrac-modal').classList.remove('hidden');
}

// ── CALIDAD DE AGUA ───────────────────────────────────
const PULV_PROD_PH = {
  glifosato:{ph_opt:[4.5,6.5],ph_lim:[6.5,7.5],acidificante:true,sulfato_amonio:true,sens_tds:'alta',prob:'El glifosato se hidroliza en agua alcalina (pH > 7). A pH 8 puede perder 20-30% de eficacia antes de depositarse en la hoja.'},
  glifo_2bd:{ph_opt:[4.5,6.0],ph_lim:[6.0,7.0],acidificante:true,sulfato_amonio:true,sens_tds:'alta',prob:'Mezcla glifosato + 2,4-D requiere pH más bajo. Mantener pH 5-6 es crítico.'},
  glifo_dicamba:{ph_opt:[4.5,6.0],ph_lim:[6.0,7.5],acidificante:true,sulfato_amonio:true,sens_tds:'moderada',prob:'El dicamba es estable en amplio rango de pH. El riesgo es el glifosato a pH > 7.5.'},
  als:{ph_opt:[5.0,6.5],ph_lim:[6.5,7.5],acidificante:true,sulfato_amonio:false,sens_tds:'baja',prob:'Las sulfonilureas e imidazolinonas son estables en rango amplio pero pueden degradarse a pH > 8.'},
  fungicida:{ph_opt:[5.5,7.5],ph_lim:[7.5,8.5],acidificante:false,sulfato_amonio:false,sens_tds:'baja',prob:'Los triazoles y estrobilurinas son relativamente estables en rango amplio de pH.'},
  insecticida:{ph_opt:[5.0,7.0],ph_lim:[7.0,8.0],acidificante:true,sulfato_amonio:false,sens_tds:'moderada',prob:'Los organofosforados (OP) se hidrolizan rápidamente a pH > 7. Usar buffer es crítico.'},
  graminicida:{ph_opt:[5.0,6.5],ph_lim:[6.5,7.5],acidificante:true,sulfato_amonio:false,sens_tds:'moderada',requiere_aceite:true,prob:'Los graminicidas ACCasa requieren aceite metilado y agua de baja dureza para penetración cuticular eficaz.'},
  foliar:{ph_opt:[5.5,6.5],ph_lim:[6.5,7.0],acidificante:true,sulfato_amonio:false,sens_tds:'moderada',prob:'Los fertilizantes foliares son más eficaces en agua ligeramente ácida. La urea puede causar quemado a pH > 7.'},
};

function pulvSetProdAgua(el, prod) {
  pulvProdAgua = prod;
  document.querySelectorAll('#pa-prod-chips .prod-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function pulvActualizarPH(val) {
  pulvPhActual = parseFloat(val) || 7.5;
  if ($('pa-ph-num')) $('pa-ph-num').textContent = pulvPhActual.toFixed(1);
  const pos = ((pulvPhActual - 4) / 6) * 100;
  if ($('pa-ph-thumb')) $('pa-ph-thumb').style.left = Math.max(0,Math.min(100,pos)) + '%';
  pulvCalcAgua();
}

function pulvFuentePH(el, ph) {
  pulvActualizarPH(ph);
  if ($('pa-ph')) $('pa-ph').value = ph;
  document.querySelectorAll('.fuente-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function pulvCalcDeltaT() {
  if (!PULV_METEO) return null;
  const t = PULV_METEO.temperature_2m;
  const hr = PULV_METEO.relative_humidity_2m;
  // Delta T simplificado (Fórmula de Stull aproximada)
  return t - ((100 - hr) / 5);
}

function pulvRenderMeteoBadgesAgua() {
  if (!PULV_METEO) return;
  const t = PULV_METEO.temperature_2m;
  const hr = PULV_METEO.relative_humidity_2m;
  const v = PULV_METEO.wind_speed_10m;

  // Delta T simplificado (Fórmula de Stull aproximada)
  const dt = t - ((100 - hr) / 5);

  if ($('pa-deltat-val')) {
    $('pa-deltat-val').textContent = dt.toFixed(1) + '°C';
    $('pa-deltat-val').style.color = dt >= 10 ? 'var(--warn)' : dt >= 8 ? 'var(--caution)' : 'var(--ok)';
  }
  if ($('pa-deltat-lbl')) $('pa-deltat-lbl').textContent = dt >= 10 ? 'No aplicar' : dt >= 8 ? 'Límite — precaución' : 'Óptimo para aplicación';
  const pos = Math.max(0, Math.min(100, (dt / 12) * 100));
  if ($('pa-deltat-cur')) $('pa-deltat-cur').style.left = pos + '%';

  if ($('pa-viento-val')) $('pa-viento-val').textContent = v.toFixed(1);
  if ($('pa-hr-val')) $('pa-hr-val').textContent = hr;
  if ($('pa-hr-lbl')) $('pa-hr-lbl').textContent = hr < 40 ? '⚠ Muy baja' : hr < 55 ? 'Baja' : hr > 90 ? 'Muy alta' : 'Óptima';
}

function pulvCalcAgua() {
  const ph = parseFloat($('pa-ph')?.value) || 7.5;
  const tds = parseFloat($('pa-tds')?.value) || 500;
  const prod = PULV_PROD_PH[pulvProdAgua] || PULV_PROD_PH.glifosato;
  const recs = [];

  // pH
  if (ph >= prod.ph_opt[0] && ph <= prod.ph_opt[1]) {
    recs.push({nivel:'ok',icon:'✅',titulo:`pH óptimo (${ph.toFixed(1)}) para este producto`,texto:`El rango óptimo para ${pulvProdAgua} es pH ${prod.ph_opt[0]}–${prod.ph_opt[1]}. Condición ideal.`});
  } else if (ph >= prod.ph_lim[0] && ph <= prod.ph_lim[1]) {
    recs.push({nivel:'alerta',icon:'⚠️',titulo:`pH aceptable pero subóptimo (${ph.toFixed(1)})`,texto:`Considerar acidificante. ${prod.prob}`});
  } else if (ph > prod.ph_lim[1]) {
    recs.push({nivel:'critico',icon:'🔴',titulo:`pH alcalino crítico (${ph.toFixed(1)}) — Acción urgente`,texto:`${prod.prob} Usar acidificante para llevar pH a ${prod.ph_opt[0]}–${prod.ph_opt[1]}.`});
  } else {
    recs.push({nivel:'alerta',icon:'⚠️',titulo:`pH muy ácido (${ph.toFixed(1)})`,texto:'El agua muy ácida puede afectar la estabilidad de algunos productos y causar fitotoxicidad.'});
  }

  // TDS
  if (prod.sens_tds === 'alta' && tds > 500) {
    recs.push({nivel:'critico',icon:'💧',titulo:`TDS alto (${tds} ppm) — Antagonismo catiónico`,texto:`El agua dura antagoniza este producto. Usar sulfato de amonio para neutralizar Ca²⁺ y Mg²⁺.`});
  } else if (prod.sens_tds === 'moderada' && tds > 800) {
    recs.push({nivel:'alerta',icon:'💧',titulo:`TDS elevado (${tds} ppm)`,texto:'El TDS alto puede reducir la eficacia. Considerar usar agua de menor dureza o agregar buffer.'});
  } else {
    recs.push({nivel:'ok',icon:'💎',titulo:`TDS (${tds} ppm) — aceptable`,texto:'Los sólidos disueltos no representan un riesgo significativo para este producto.'});
  }

  const container = $('pa-agua-recs');
  if (container) {
    container.innerHTML = recs.map(r =>
      `<div class="rec-item ${r.nivel}"><div style="font-size:1rem;flex-shrink:0">${r.icon}</div><div><div class="rec-ttl ${r.nivel}">${r.titulo}</div><div class="rec-txt">${r.texto}</div></div></div>`
    ).join('');
  }

  const badge = $('pa-agua-badge');
  if (badge) badge.textContent = recs.some(r=>r.nivel==='critico') ? '🔴' : recs.some(r=>r.nivel==='alerta') ? '🟡' : '🟢';

  pulvCalcAdyuvantes(ph, tds, prod);
}

function pulvCalcAdyuvantes(ph, tds, prod) {
  const dt = PULV_METEO ? PULV_METEO.temperature_2m - ((100 - PULV_METEO.relative_humidity_2m) / 5) : null;
  const v = PULV_METEO?.wind_speed_10m || null;
  const hr = PULV_METEO?.relative_humidity_2m || null;
  const adys = [];

  if (prod.acidificante && ph > 6.5) {
    adys.push({nombre:'Acidificante / buffer pH',ejemplos:'Ácido cítrico, Regulaid®, AgriBuf®',dosis:ph>8?'300–500 cc/100 L':'150–300 cc/100 L',prioridad:ph>8?'imprescindible':'recomendado',razon:`Corregir pH ${ph.toFixed(1)} → 5.0–6.5`,orden:1});
  }
  if (prod.sulfato_amonio && tds > 300) {
    adys.push({nombre:'Sulfato de amonio (SA)',ejemplos:'(NH₄)₂SO₄ técnico o formulado',dosis:tds>800?'3 kg/100 L':tds>500?'2 kg/100 L':'1–1.5 kg/100 L',prioridad:tds>800?'imprescindible':'recomendado',razon:`Neutralizar antagonismo Ca²⁺/Mg²⁺ (TDS ${tds} ppm). Agregar PRIMERO.`,orden:0});
  }
  if (dt !== null && dt >= 8) {
    adys.push({nombre:'Antievaporante',ejemplos:'Extravon®, Citowett®, Vapor Gard®',dosis:dt>=10?'300–500 cc/100 L':'200–300 cc/100 L',prioridad:dt>=10?'imprescindible':'recomendado',razon:`Delta T ${dt.toFixed(1)}°C — evaporación de gotas aumentada.`,orden:3});
  }
  if (v !== null && v > 12) {
    adys.push({nombre:'Reductor de deriva / engrosador de gota',ejemplos:'Atplus®, Bondbreaker®, Breakthru® S240',dosis:'200–400 cc/100 L',prioridad:v>18?'imprescindible':'recomendado',razon:`Viento ${v.toFixed(1)} km/h — riesgo ${v>18?'alto':'moderado'} de deriva.`,orden:4});
  }
  if (pulvProdAgua === 'graminicida') {
    adys.push({nombre:'Aceite metilado de soja (FAME)',ejemplos:'Hasten®, Soy Oil Methyl Ester',dosis:'0.5–1% v/v',prioridad:'imprescindible',razon:'Los graminicidas ACCasa requieren aceite para penetración cuticular eficaz.',orden:2});
  }
  if (hr !== null && hr < 50 && dt !== null && dt >= 6) {
    adys.push({nombre:'⏰ Corrección de horario',ejemplos:'No es un producto — es una decisión operativa',dosis:'Aplicar antes de las 10 hs o después de las 17 hs',prioridad:hr<40?'imprescindible':'recomendado',razon:`HR ${hr}% + Delta T ${dt.toFixed(1)}°C: condición crítica de evaporación.`,orden:6});
  }

  adys.sort((a,b) => a.orden - b.orden);
  const container = $('pa-ady-recs');
  if (!container) return;

  if (!adys.length) {
    container.innerHTML = '<div class="rec-item ok"><div style="font-size:1rem">✅</div><div><div class="rec-ttl ok">Sin adyuvantes adicionales requeridos</div><div class="rec-txt">Las condiciones actuales no requieren adyuvantes especiales.</div></div></div>';
    if ($('pa-ady-sem')) $('pa-ady-sem').textContent = '✅ OK';
    return;
  }

  container.innerHTML = `<div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(28,18,8,.38);margin-bottom:.7rem">Orden recomendado de agregado al tanque:</div>` +
    adys.map((a,i) =>
      `<div class="adyuvante-row"><div><div style="font-size:.62rem;color:rgba(28,18,8,.35);margin-bottom:.1rem">${i+1}° agregar</div><div style="font-weight:600;font-size:.83rem;color:var(--earth)">${a.nombre}</div><div style="font-size:.7rem;color:rgba(28,18,8,.48);margin-top:.1rem">${a.ejemplos}</div><div style="font-size:.74rem;color:rgba(28,18,8,.6);margin-top:.15rem;line-height:1.4">${a.razon}</div></div><div style="font-family:'DM Mono',monospace;font-size:.8rem;color:rgba(28,18,8,.65);white-space:nowrap">${a.dosis}</div><span class="adyuvante-tag ${a.prioridad}">${a.prioridad}</span></div>`
    ).join('');
  if ($('pa-ady-sem')) $('pa-ady-sem').textContent = adys.some(a=>a.prioridad==='imprescindible') ? '⚠ Acción requerida' : '✓ Revisar';
}

// ── INIT ──────────────────────────────────────────────
pulvRenderHistorial();


// Modelo: densidad base × factor agua × factor fecha
// Logro de implantación dinámico según condiciones del lote
// Ajustes vs. código original:
//   • Trigo/Cebada: salida en kg/ha (no semillas/metro)
//   • Agua efectiva: usa datos del módulo Balance Hídrico
//   • IDs propios con prefijo ds- para evitar conflictos
//   • Sorgo: límite superior ajustado a 200.000 pl/ha
//   • Cebada: incorporada con lógica similar a trigo
// ════════════════════════════════════════════════════════

const DS_DB = {
  Soja: {
    tipo: 'grano_grueso',
    unidad: 'plantas/ha',
    base: { bajo:220000, medio:300000, alto:380000 },
    aguaOptima: { min:220, max:500 },
    fechas: { temprano:1.00, normal:0.96, tardio:0.92 },
    logroBase: 0.86,
    surcosRef: 0.52,
    limites: { min:160000, max:460000 },
    tOptGerm: 18,
  },
  Maíz: {
    tipo: 'grano_grueso',
    unidad: 'plantas/ha',
    base: { bajo:52000, medio:72000, alto:88000 },
    aguaOptima: { min:260, max:520 },
    fechas: { temprano:1.00, normal:0.96, tardio:0.90 },
    logroBase: 0.94,
    surcosRef: 0.52,
    limites: { min:38000, max:98000 },
    tOptGerm: 16,
  },
  Trigo: {
    tipo: 'grano_fino',
    unidad: 'kg/ha',
    base: { bajo:120, medio:160, alto:200 },   // kg/ha semilla
    aguaOptima: { min:180, max:420 },
    fechas: { temprano:0.96, normal:1.00, tardio:1.10 },
    logroBase: 0.82,
    surcosRef: 0.19,
    limites: { min:90, max:240 },              // kg/ha
    tOptGerm: 10,
    pmsDef: 35,                                // g por defecto
  },
  Girasol: {
    tipo: 'grano_grueso',
    unidad: 'plantas/ha',
    base: { bajo:36000, medio:48000, alto:58000 },
    aguaOptima: { min:220, max:450 },
    fechas: { temprano:1.00, normal:0.97, tardio:0.93 },
    logroBase: 0.91,
    surcosRef: 0.52,
    limites: { min:28000, max:70000 },
    tOptGerm: 10,
  },
  Sorgo: {
    tipo: 'grano_grueso',
    unidad: 'plantas/ha',
    base: { bajo:120000, medio:160000, alto:200000 }, // ajustado: máx 200k
    aguaOptima: { min:180, max:420 },
    fechas: { temprano:0.97, normal:1.00, tardio:0.95 },
    logroBase: 0.87,
    surcosRef: 0.52,
    limites: { min:90000, max:200000 },        // ajustado
    tOptGerm: 17,
  },
  Cebada: {
    tipo: 'grano_fino',
    unidad: 'kg/ha',
    base: { bajo:100, medio:140, alto:180 },
    aguaOptima: { min:160, max:400 },
    fechas: { temprano:0.96, normal:1.00, tardio:1.08 },
    logroBase: 0.82,
    surcosRef: 0.17,
    limites: { min:80, max:220 },
    tOptGerm: 8,
    pmsDef: 42,
  },
};

// Detectar ventana de siembra según cultivo y fecha
function dsDetectarVentana(cultivo, fechaStr) {
  if (!fechaStr) return 'normal';
  const f = new Date(fechaStr + 'T12:00:00');
  const m = f.getMonth() + 1;
  const d = f.getDate();
  switch(cultivo) {
    case 'Maíz':
      if (m===9||(m===10&&d<=20)) return 'temprano';
      if (m===10||m===11||(m===12&&d<=15)) return 'normal';
      return 'tardio';
    case 'Soja':
      if (m===10||(m===11&&d<=15)) return 'temprano';
      if (m===11||m===12) return 'normal';
      return 'tardio';
    case 'Trigo': case 'Cebada':
      if (m===5||(m===6&&d<=10)) return 'temprano';
      if (m===6||(m===7&&d<=10)) return 'normal';
      return 'tardio';
    case 'Girasol':
      if (m===8||(m===9&&d<=15)) return 'temprano';
      if (m===9||(m===10&&d<=10)) return 'normal';
      return 'tardio';
    case 'Sorgo':
      if (m===10||(m===11&&d<=10)) return 'temprano';
      if (m===11||m===12) return 'normal';
      return 'tardio';
    default: return 'normal';
  }
}

// Factor de corrección por disponibilidad hídrica
function dsFactorAgua(aguaTotal, minOpt, maxOpt) {
  if (!isFinite(aguaTotal) || aguaTotal <= 0) return 1.0;
  if (aguaTotal < minOpt * 0.75) return 0.82;
  if (aguaTotal < minOpt * 0.90) return 0.90;
  if (aguaTotal < minOpt)        return 0.96;
  if (aguaTotal <= maxOpt)       return 1.00;
  if (aguaTotal <= maxOpt * 1.15) return 1.05;
  return 1.08;
}

// Logro de implantación dinámico — usa datos reales del motor
function dsLogroDinamico(cultivo, logroBase, tOpt) {
  let logro = logroBase;

  // Temperatura de suelo (Open-Meteo)
  const t6 = parseFloat($('s-t6')?.value) || 18;
  if (t6 < tOpt - 6)        logro -= 0.10;
  else if (t6 < tOpt - 3)   logro -= 0.05;
  else if (t6 > tOpt + 10)  logro -= 0.03;

  // Humedad superficial
  const hum = parseFloat($('s-h1')?.value) || 22;
  if (hum < 12)       logro -= 0.08;
  else if (hum < 16)  logro -= 0.04;
  else if (hum > 38)  logro -= 0.03;

  // Compactación (MPa)
  const comp = parseFloat($('s-compact')?.value) || 1.5;
  if (comp > 3.0)        logro -= 0.10;
  else if (comp > 2.5)   logro -= 0.07;
  else if (comp > 2.0)   logro -= 0.04;

  // Viento operativo (km/h)
  const viento = parseFloat($('s-viento')?.value) || 12;
  if (viento > 30)        logro -= 0.03;
  else if (viento > 20)   logro -= 0.015;

  // Velocidad de avance de la sembradora
  const vel = parseFloat($('m-vel')?.value) || 7.5;
  if (vel > 9.5)      logro -= 0.04;
  else if (vel > 8.0) logro -= 0.02;

  // Soja y Sorgo tienen mayor plasticidad
  if (cultivo === 'Soja' || cultivo === 'Sorgo') logro += 0.01;

  return Math.max(0.65, Math.min(0.98, logro));
}

// Función principal de cálculo
function dsCalcular() {
  // Tomar datos del módulo de Cultivares (o Siembra como fallback)
  const cultivo  = gv('cv-cultivo') || gv('s-cultivo') || 'Soja';
  const ambiente = gv('cv-ambiente') || 'medio';
  const cfg = DS_DB[cultivo];
  if (!cfg) return null;

  // Fecha de siembra
  const fechaStr = gv('bh-fecha') || gv('s-fecha') || '';
  const ventana  = dsDetectarVentana(cultivo, fechaStr);

  // Agua disponible — preferir datos del módulo Balance Hídrico
  const aguaPerfil  = gi('bh-agua-perfil')  || 120;
  const precipCiclo = gi('bh-precip')       || 350;
  // 75% de precipitación es efectiva (consistente con módulo BH)
  const aguaTotal   = aguaPerfil + precipCiclo * 0.75;

  // Distancia entre surcos — específica para densidad
  const surcoM = parseFloat($('ds-surco')?.value) || cfg.surcosRef;
  const pms    = parseFloat($('ds-pms')?.value)   || cfg.pmsDef || 35;

  // Ambiente → densidad base
  const ambKey = ['bajo','medio','alto'].includes(ambiente) ? ambiente : 'medio';
  const densBase = cfg.base[ambKey];

  // Factores de corrección
  const fAgua  = dsFactorAgua(aguaTotal, cfg.aguaOptima.min, cfg.aguaOptima.max);
  const fFecha = cfg.fechas[ventana] || 1.0;

  // ── GRANO GRUESO (maíz, soja, girasol, sorgo) ────────
  if (cfg.tipo === 'grano_grueso') {
    let plantasObj = densBase * fAgua * fFecha;
    plantasObj = Math.max(cfg.limites.min, Math.min(cfg.limites.max, plantasObj));

    const logro       = dsLogroDinamico(cultivo, cfg.logroBase, cfg.tOptGerm);
    const semillasHa  = plantasObj / logro;
    const semillasMt  = (semillasHa * surcoM) / 10000;

    return {
      cultivo, ambiente, ventana, aguaTotal: Math.round(aguaTotal),
      fAgua: fAgua.toFixed(2), fFecha: fFecha.toFixed(2),
      logro: Math.round(logro * 100),
      plantasObj: Math.round(plantasObj),
      semillasHa: Math.round(semillasHa),
      semillasMt: semillasMt.toFixed(2),
      surcoCm: (surcoM * 100).toFixed(0),
      tipo: 'grano_grueso',
      unidad: cfg.unidad,
    };
  }

  // ── GRANO FINO (trigo, cebada) ────────────────────────
  // Salida en kg/ha y semillas/m²
  if (cfg.tipo === 'grano_fino') {
    let kgHaObj = densBase * fAgua * fFecha;
    kgHaObj = Math.max(cfg.limites.min, Math.min(cfg.limites.max, kgHaObj));

    // Convertir kg/ha → semillas/m² → semillas/metro lineal
    const semM2    = (kgHaObj * 1000) / pms;           // semillas/m²
    const semMt    = semM2 * surcoM;                     // semillas/metro lineal
    const logro    = dsLogroDinamico(cultivo, cfg.logroBase, cfg.tOptGerm);
    const semHaBruto = semM2 * 10000 / logro;           // semillas brutas a sembrar

    return {
      cultivo, ambiente, ventana, aguaTotal: Math.round(aguaTotal),
      fAgua: fAgua.toFixed(2), fFecha: fFecha.toFixed(2),
      logro: Math.round(logro * 100),
      kgHaObj: Math.round(kgHaObj),
      semM2: Math.round(semM2),
      semMt: semMt.toFixed(1),
      surcoCm: (surcoM * 100).toFixed(0),
      pms,
      tipo: 'grano_fino',
      unidad: cfg.unidad,
    };
  }

  return null;
}

// Render del resultado
function dsRender() {
  const res = $('ds-res');
  if (!res) return;
  const d = dsCalcular();
  if (!d) {
    res.innerHTML = `<div class="alert warn"><span class="ai">⚠️</span><div class="ac">Seleccioná un cultivo válido para calcular la densidad.</div></div>`;
    return;
  }

  const ventanaLabel = { temprano:'Temprana ⬆️', normal:'Normal ✅', tardio:'Tardía ⬇️' }[d.ventana] || d.ventana;
  const fAguaNum = parseFloat(d.fAgua);
  const fAguaColor = fAguaNum >= 1.0 ? 'var(--ok)' : fAguaNum >= 0.9 ? 'var(--caution)' : 'var(--warn)';

  // ── KPIs según tipo de cultivo ──
  let kpis = '';
  let detalle = '';
  let alertaImplant = '';

  if (d.tipo === 'grano_grueso') {
    kpis = `
      <div class="kc blue">
        <div class="kl">Semillas / metro</div>
        <div class="kv">${d.semillasMt}</div>
        <div class="ku">a ${d.surcoCm} cm entre surcos</div>
      </div>
      <div class="kc">
        <div class="kl">Plantas objetivo</div>
        <div class="kv">${(d.plantasObj/1000).toFixed(1)}k</div>
        <div class="ku">plantas/ha</div>
      </div>
      <div class="kc neutral">
        <div class="kl">Semillas a sembrar</div>
        <div class="kv">${(d.semillasHa/1000).toFixed(1)}k</div>
        <div class="ku">semillas/ha brutas</div>
      </div>
      <div class="kc ${d.logro < 80 ? 'warn' : ''}">
        <div class="kl">Logro estimado</div>
        <div class="kv">${d.logro}%</div>
        <div class="ku">implantación real</div>
      </div>`;
    detalle = `<strong>${d.semillasMt}</strong> semillas/metro a <strong>${d.surcoCm} cm</strong> entre surcos, para lograr <strong>${d.plantasObj.toLocaleString()} plantas/ha</strong>`;
    if (d.logro < 80) {
      alertaImplant = `<div class="alert warn" style="margin-top:.7rem"><span class="ai">⚠️</span><div class="ac"><strong>Logro de implantación bajo (${d.logro}%)</strong> — Las condiciones actuales del lote (temperatura de suelo, humedad o compactación) reducen el porcentaje esperado de plantas nacidas. Corregí las condiciones o aumentá la dosis de semilla.</div></div>`;
    }
  }

  if (d.tipo === 'grano_fino') {
    kpis = `
      <div class="kc blue">
        <div class="kl">Semillas / metro</div>
        <div class="kv">${d.semMt}</div>
        <div class="ku">a ${d.surcoCm} cm entre surcos</div>
      </div>
      <div class="kc">
        <div class="kl">Densidad recomendada</div>
        <div class="kv">${d.kgHaObj}</div>
        <div class="ku">kg/ha de semilla</div>
      </div>
      <div class="kc neutral">
        <div class="kl">Semillas / m²</div>
        <div class="kv">${d.semM2}</div>
        <div class="ku">plantas/m² objetivo</div>
      </div>
      <div class="kc ${d.logro < 78 ? 'warn' : ''}">
        <div class="kl">Logro estimado</div>
        <div class="kv">${d.logro}%</div>
        <div class="ku">implantación real</div>
      </div>`;
    detalle = `<strong>${d.kgHaObj} kg/ha</strong> de semilla (PMS ${d.pms}g) → <strong>${d.semM2} semillas/m²</strong> → <strong>${d.semMt} semillas/metro lineal</strong>`;
    if (d.logro < 78) {
      alertaImplant = `<div class="alert warn" style="margin-top:.7rem"><span class="ai">⚠️</span><div class="ac"><strong>Logro bajo para cereal de invierno (${d.logro}%)</strong> — Revisá temperatura de suelo, humedad y regulación de la sembradora antes de sembrar.</div></div>`;
    }
  }

  res.innerHTML = `
    <!-- KPI cards -->
    <div class="rg" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:1rem">
      ${kpis}
    </div>

    <!-- Alerta de implantación -->
    ${alertaImplant}

    <!-- Resumen interpretativo -->
    <div class="alert info" style="margin-top:.7rem">
      <span class="ai">📏</span>
      <div class="ac">
        Para <strong>${d.cultivo}</strong> en ambiente <strong>${d.ambiente}</strong>,
        siembra <strong>${ventanaLabel}</strong> con
        <strong>${d.aguaTotal} mm</strong> de agua disponible:
        ${detalle}.
      </div>
    </div>

    <!-- Tabla de factores -->
    <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--earth);margin:1rem 0 .4rem">Factores de ajuste aplicados</div>
    <table class="dt">
      <thead><tr>
        <th>Factor</th><th class="mn">Valor</th><th>Efecto</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>💧 Disponibilidad hídrica</td>
          <td class="mn" style="color:${fAguaColor};font-weight:700">${d.fAgua}</td>
          <td style="font-size:.78rem;color:rgba(74,46,26,.6)">
            ${fAguaNum >= 1.05 ? 'Exceso de agua — aumenta densidad' :
              fAguaNum >= 1.00 ? 'Agua óptima — densidad base' :
              fAguaNum >= 0.96 ? 'Agua levemente escasa — reduce 4%' :
              fAguaNum >= 0.90 ? 'Déficit moderado — reduce 10%' :
                                 'Déficit severo — reduce 18%'}
          </td>
        </tr>
        <tr>
          <td>📅 Fecha de siembra</td>
          <td class="mn" style="font-weight:700">${d.fFecha}</td>
          <td style="font-size:.78rem;color:rgba(74,46,26,.6)">Siembra ${ventanaLabel}</td>
        </tr>
        <tr>
          <td>🌱 Logro de implantación</td>
          <td class="mn" style="color:${d.logro < 80?'var(--warn)':'var(--ok)'};font-weight:700">${d.logro}%</td>
          <td style="font-size:.78rem;color:rgba(74,46,26,.6)">Estimado con datos reales del lote</td>
        </tr>
        <tr>
          <td>🌊 Oferta hídrica total</td>
          <td class="mn">${d.aguaTotal} mm</td>
          <td style="font-size:.78rem;color:rgba(74,46,26,.6)">Perfil + precipitación ciclo (75% efectiva)</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top:.7rem;font-size:.7rem;color:rgba(74,46,26,.4);padding:.4rem .7rem;background:rgba(74,46,26,.03);border-radius:6px">
      📊 Modelo: densidad base (ambiente) × factor hídrico × factor fecha ÷ logro implantación ·
      Logro calculado con T° suelo, humedad, compactación y velocidad de avance del módulo de Siembra ·
      Fuente bibliográfica: Andrade et al. (INTA) · FAO-56 ·
      Validar con análisis de implantación a campo (conteo de plantas 30 DDS).
    </div>`;
}

// ════════════════════════════════════════════════════════
// COMPARADOR DE CULTIVARES
// ════════════════════════════════════════════════════════