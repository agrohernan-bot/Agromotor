// MÃ³dulo PulverizaciÃ³n - Integrado

(function() {
  window.AM = window.AM || {};
  window.AM.pulverizacion = {};

// â”€â”€â”€ ESTADO GLOBAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let STATE = {
  lat: null, lon: null,
  meteo: null,       // datos open-meteo actuales
  hourly: null,      // pronÃ³stico horario
};

async function pulvClaude(payload) {
  if (typeof AM_SB === 'undefined' || typeof AM_CONFIG === 'undefined') {
    throw new Error('Config IA no disponible');
  }
  const { data: { session } } = await AM_SB.auth.getSession();
  if (!session) throw new Error('login_required');
  return fetch(AM_CONFIG.claudeProxy, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + session.access_token
    },
    body: JSON.stringify(payload)
  });
}

// â”€â”€â”€ TABS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showTab(id) {
  document.querySelectorAll('.module-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  // Marcar botÃ³n nav activo (cross-browser: no usa window.event legacy)
  const activeBtn = document.querySelector(`.nav-tab[onclick*="'${id}'"]`);
  if (activeBtn) activeBtn.classList.add('active');
  // Inicializar mapa si corresponde
  if (id === 'mapa') {
    setTimeout(() => {
      initMapa();
      if (mapaObj) mapaObj.invalidateSize();
    }, 100);
  }
}

// â”€â”€â”€ HORA HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function tickHora() {
  const el = document.getElementById('hora-header');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'});
  el.style.display = 'block';
}
setInterval(tickHora, 1000); tickHora();

// â”€â”€â”€ GPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _parsCoordDashboard() {
  var raw = (document.getElementById('s-coord') || {}).value || '';
  if (!raw.trim()) return null;
  var parts = raw.split(',');
  if (parts.length < 2) return null;
  var lat = parseFloat(parts[0].trim());
  var lon = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon };
}

function initGPS() {
  // Primero intentar usar coordenadas del lote activo en el Dashboard
  var dashCoord = _parsCoordDashboard();
  if (dashCoord) {
    STATE.lat = dashCoord.lat; STATE.lon = dashCoord.lon;
    setGPSState('ok', `Coordenadas del lote: <strong>${STATE.lat.toFixed(4)}Â°, ${STATE.lon.toFixed(4)}Â°</strong>`);
    // btn-refresh always visible in HTML
    fetchMeteo();
    return;
  }
  setGPSState('loading', 'Obteniendo ubicaciÃ³n GPS...');
  if (!navigator.geolocation) {
    setGPSState('error', 'GPS no disponible en este dispositivo');
    usarUbicacionDefault();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      STATE.lat = pos.coords.latitude;
      STATE.lon = pos.coords.longitude;
      setGPSState('ok', `UbicaciÃ³n: <strong>${STATE.lat.toFixed(4)}Â°, ${STATE.lon.toFixed(4)}Â°</strong> â€” PrecisiÃ³n: Â±${Math.round(pos.coords.accuracy)} m`);
      // btn-refresh always visible in HTML
      fetchMeteo();
    },
    err => {
      setGPSState('error', 'No se pudo obtener GPS â€” usando ubicaciÃ³n de referencia (CÃ³rdoba)');
      usarUbicacionDefault();
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function usarUbicacionDefault() {
  // Intentar coordenadas del Dashboard antes de usar CÃ³rdoba
  var dashCoord = _parsCoordDashboard();
  if (dashCoord) {
    STATE.lat = dashCoord.lat; STATE.lon = dashCoord.lon;
    setGPSState('ok', `Coordenadas del lote: <strong>${STATE.lat.toFixed(4)}Â°, ${STATE.lon.toFixed(4)}Â°</strong>`);
  } else {
    STATE.lat = -31.42; STATE.lon = -64.18; // CÃ³rdoba fallback
    setGPSState('ok', 'UbicaciÃ³n de referencia: <strong>CÃ³rdoba capital</strong> â€” IngresÃ¡ coordenadas en el Dashboard para datos locales');
  }
  // btn-refresh always visible in HTML
  fetchMeteo();
}

// Llamada desde nav.js al activar el mÃ³dulo
window.pulvRefrescarMeteo = function() {
  var dashCoord = _parsCoordDashboard();
  if (dashCoord) { STATE.lat = dashCoord.lat; STATE.lon = dashCoord.lon; }
  if (STATE.lat) {
    fetchMeteo();
  } else {
    // Primera vez o sin coordenadas: iniciar flujo GPS completo
    initGPS();
  }
};

function setGPSState(st, txt) {
  const dot = document.getElementById('pulv-gps-dot');
  const textEl = document.getElementById('pulv-gps-txt');
  dot.className = 'gps-dot-p' + (st === 'loading' ? ' loading' : st === 'error' ? ' error' : '');
  textEl.innerHTML = txt;
}

// â”€â”€â”€ FETCH OPEN-METEO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function fetchMeteo() {
  if (!STATE.lat) return;
  document.getElementById('pulv-sem-loading').style.display = 'flex';
  document.getElementById('pulv-sem-content').style.display = 'none';
  document.getElementById('pulv-ventana-card').style.display = 'none';

  const vars = [
    'temperature_2m', 'relative_humidity_2m', 'wind_speed_10m',
    'wind_direction_10m', 'apparent_temperature', 'precipitation_probability',
    'precipitation', 'dew_point_2m', 'surface_pressure', 'cloud_cover',
    'uv_index', 'wind_gusts_10m'
  ].join(',');

  const url = `https://api.open-meteo.com/v1/forecast?`
    + `latitude=${STATE.lat}&longitude=${STATE.lon}`
    + `&hourly=${vars}`
    + `&current=${vars}`
    + `&wind_speed_unit=kmh&temperature_unit=celsius&timezone=America%2FArgentina%2FBuenos_Aires`
    + `&forecast_days=2`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    STATE.meteo = data.current;
    STATE.hourly = data.hourly;
    renderSemaforo(data.current);
    renderVentana(data.hourly);
    renderDeriva(data.current);
    autoFillRegistro(data.current);
    actualizarCtxBadge();
    actualizarPanelAgua();
    actualizarMotorCobertura();
  } catch(e) {
    document.getElementById('pulv-sem-loading').innerHTML = `
      <div style="color:var(--warn);text-align:center;padding:2rem">
        âš ï¸ Error al conectar con Open-Meteo. VerificÃ¡ tu conexiÃ³n a internet.
      </div>`;
  }
}

// â”€â”€â”€ RENDER SEMÃFORO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderSemaforo(c) {
  const temp    = c.temperature_2m;
  const hr      = c.relative_humidity_2m;
  const viento  = c.wind_speed_10m;
  const rafagas = c.wind_gusts_10m;
  const pp      = c.precipitation;
  const pp_prob = c.precipitation_probability;
  const rocio   = c.dew_point_2m;

  // â”€â”€ EVALUAR CONDICIONES â”€â”€
  const alertas = [];
  let score = 0; // 0=verde, 1=amarillo, 2=rojo

  // Viento
  if (viento > 25)      { score = Math.max(score, 2); alertas.push({ ico:'ðŸš«', txt:`<strong>Viento excesivo (${viento} km/h):</strong> Riesgo alto de deriva. Suspender aplicaciÃ³n.`, sev:'rojo' }); }
  else if (viento > 15) { score = Math.max(score, 1); alertas.push({ ico:'âš ï¸', txt:`<strong>Viento moderado (${viento} km/h):</strong> Operar con precauciÃ³n, evaluar boquillas antideriva.`, sev:'amarillo' }); }
  else if (viento < 3)  { score = Math.max(score, 1); alertas.push({ ico:'âš ï¸', txt:`<strong>Viento muy bajo (${viento} km/h):</strong> Posible inversiÃ³n tÃ©rmica. Riesgo de gotas en suspensiÃ³n.`, sev:'amarillo' }); }
  else                  { alertas.push({ ico:'âœ…', txt:`<strong>Viento Ã³ptimo (${viento} km/h):</strong> CondiciÃ³n favorable para la aplicaciÃ³n.`, sev:'verde' }); }

  // RÃ¡fagas
  if (rafagas > 30) { score = Math.max(score, 2); alertas.push({ ico:'ðŸ’¨', txt:`<strong>RÃ¡fagas de ${rafagas} km/h:</strong> Peligro de deriva severa. No aplicar.`, sev:'rojo' }); }

  // Temperatura
  if (temp > 32)    { score = Math.max(score, 2); alertas.push({ ico:'ðŸŒ¡', txt:`<strong>Temperatura alta (${temp}Â°C):</strong> VolatilizaciÃ³n severa, especialmente de hormonales. Suspender.`, sev:'rojo' }); }
  else if (temp > 28) { score = Math.max(score, 1); alertas.push({ ico:'ðŸŒ¡', txt:`<strong>Temperatura elevada (${temp}Â°C):</strong> Posible volatilizaciÃ³n de herbicidas. Vigilar.`, sev:'amarillo' }); }
  else if (temp < 8) { score = Math.max(score, 1); alertas.push({ ico:'â„ï¸', txt:`<strong>Temperatura baja (${temp}Â°C):</strong> Metabolismo foliar lento, reducir absorciÃ³n de herbicidas sistÃ©micos.`, sev:'amarillo' }); }
  else              { alertas.push({ ico:'âœ…', txt:`<strong>Temperatura Ã³ptima (${temp}Â°C):</strong> CondiciÃ³n favorable para absorciÃ³n foliar.`, sev:'verde' }); }

  // Humedad relativa
  if (hr < 40)     { score = Math.max(score, 2); alertas.push({ ico:'ðŸœ', txt:`<strong>HR muy baja (${hr}%):</strong> Alta evaporaciÃ³n de gotas, deriva aumentada. No apto.`, sev:'rojo' }); }
  else if (hr < 55) { score = Math.max(score, 1); alertas.push({ ico:'ðŸ’§', txt:`<strong>HR baja (${hr}%):</strong> Mayor evaporaciÃ³n de gotas. Aumentar volumen de caldo.`, sev:'amarillo' }); }
  else if (hr > 90) { alertas.push({ ico:'ðŸŒ«', txt:`<strong>HR muy alta (${hr}%):</strong> Riesgo de hongos y lavado. Verificar fitotoxicidad del producto.`, sev:'info' }); }
  else              { alertas.push({ ico:'âœ…', txt:`<strong>Humedad adecuada (${hr}%):</strong> Buenas condiciones para la deposiciÃ³n del caldo.`, sev:'verde' }); }

  // Lluvia
  if (pp > 0)      { score = Math.max(score, 2); alertas.push({ ico:'ðŸŒ§', txt:`<strong>Lluvia activa (${pp} mm):</strong> Suspender inmediatamente la aplicaciÃ³n.`, sev:'rojo' }); }
  else if (pp_prob > 40) { score = Math.max(score, 1); alertas.push({ ico:'â›…', txt:`<strong>Probabilidad de lluvia: ${pp_prob}%:</strong> Riesgo de lavado. Verificar periodo libre de lluvia del producto.`, sev:'amarillo' }); }

  // InversiÃ³n tÃ©rmica nocturna (aproximaciÃ³n: hora + temp ~ rocÃ­o)
  const hora = new Date().getHours();
  const deltaTD = temp - rocio;
  if ((hora >= 20 || hora <= 7) && deltaTD < 3) {
    score = Math.max(score, 1);
    alertas.push({ ico:'ðŸŒ™', txt:`<strong>Posible inversiÃ³n tÃ©rmica:</strong> Horario nocturno con baja diferencia TÂ° - rocÃ­o (${deltaTD.toFixed(1)}Â°C). Riesgo de gotas en suspensiÃ³n y deriva a distancia.`, sev:'amarillo' });
  }

  // â”€â”€ DEFINIR ESTADO FINAL â”€â”€
  const estados = [
    { cls:'verde',    emoji:'âœ…', txt:'APTO PARA APLICAR',        color:'var(--ok)',      desc:`Las condiciones meteorolÃ³gicas actuales son favorables para realizar aplicaciones. SeguÃ­ las buenas prÃ¡cticas y verificÃ¡ cada 30 minutos.` },
    { cls:'amarillo', emoji:'âš ï¸', txt:'APLICAR CON PRECAUCIÃ“N',   color:'var(--caution)', desc:`Hay factores que requieren atenciÃ³n. PodÃ©s aplicar con precauciones adicionales. LeÃ© las alertas y ajustÃ¡ el equipo.` },
    { cls:'rojo',     emoji:'ðŸš«', txt:'NO APTO â€” SUSPENDER',      color:'var(--red)',     desc:`Las condiciones actuales no son aptas para pulverizar. Existe riesgo de deriva, pÃ©rdida de eficacia o fitotoxicidad. EsperÃ¡ mejores condiciones.` },
  ];
  const e = estados[score];

  document.getElementById('pulv-estado-txt').textContent = e.txt;
  document.getElementById('pulv-estado-txt').style.color = e.color;
  document.getElementById('pulv-desc-txt').textContent = e.desc;
  const badge = document.getElementById('pulv-badge');
  badge.className = 'semaforo-badge ' + e.cls;
  document.getElementById('pulv-emoji').textContent = e.emoji;
  document.getElementById('pulv-badge-txt').textContent = e.cls.toUpperCase();

  // â”€â”€ GRILLA VARIABLES â”€â”€
  const dirLabel = gradosADireccion(c.wind_direction_10m);
  const variables = [
    { var:'Temperatura', val: temp.toFixed(1), unit:'Â°C', st: temp>32?'warn': temp>28?'caution':'ok' },
    { var:'Humedad rel.', val: hr, unit:'%', st: hr<40?'warn': hr<55?'caution':'ok' },
    { var:'Viento', val: viento.toFixed(1), unit:'km/h', st: viento>25?'warn': viento>15||viento<3?'caution':'ok' },
    { var:'RÃ¡fagas', val: rafagas.toFixed(1), unit:'km/h', st: rafagas>30?'warn': rafagas>20?'caution':'ok' },
    { var:'DirecciÃ³n', val: dirLabel, unit:'', st:'info' },
    { var:'Punto de rocÃ­o', val: rocio.toFixed(1), unit:'Â°C', st:'info' },
    { var:'Prob. lluvia', val: pp_prob, unit:'%', st: pp_prob>50?'warn': pp_prob>25?'caution':'ok' },
    { var:'Nubosidad', val: c.cloud_cover, unit:'%', st:'info' },
  ];
  const grid = document.getElementById('pulv-meteo-grid');
  grid.innerHTML = variables.map(v => `
    <div class="meteo-cell">
      <div class="meteo-var">${v.var}</div>
      <div class="meteo-val ${v.st}">${v.val}<span class="meteo-unit">${v.unit}</span></div>
      <div class="meteo-status status-${v.st}">${v.st==='warn'?'âš  Alerta': v.st==='caution'?'PrecauciÃ³n': v.st==='ok'?'OK':'â€”'}</div>
    </div>`).join('');

  // â”€â”€ ALERTAS â”€â”€
  const lista = document.getElementById('pulv-alertas');
  lista.innerHTML = alertas.map(a => `
    <div class="alerta-item">
      <span class="alerta-icon">${a.ico}</span>
      <span class="alerta-text">${a.txt}</span>
    </div>`).join('');

  document.getElementById('pulv-sem-loading').style.display = 'none';
  document.getElementById('pulv-sem-content').style.display = 'block';
}

// â”€â”€â”€ RENDER VENTANA HORARIA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderVentana(hourly) {
  const ahora = new Date();
  const horas = hourly.time;
  const vientos = hourly.wind_speed_10m;
  const temps = hourly.temperature_2m;
  const hrs = hourly.relative_humidity_2m;
  const pps = hourly.precipitation_probability;

  // PrÃ³ximas 24 horas desde ahora
  const idxAhora = horas.findIndex(t => new Date(t) >= ahora);
  const idxFin = Math.min(idxAhora + 24, horas.length);
  const bloquesSlice = horas.slice(idxAhora, idxFin);

  const timeline = document.getElementById('pulv-timeline');
  timeline.innerHTML = bloquesSlice.map((t, i) => {
    const idx = idxAhora + i;
    const hora = new Date(t).getHours();
    const viento = vientos[idx];
    const temp = temps[idx];
    const hr = hrs[idx];
    const pp = pps[idx];

    let cls = 'apto';
    let emoji = 'âœ…';
    if (viento > 25 || temp > 32 || hr < 40 || pp > 50) { cls = 'no-apto'; emoji = 'ðŸš«'; }
    else if (viento > 15 || viento < 3 || temp > 28 || hr < 55 || pp > 25) { cls = 'parcial'; emoji = 'âš ï¸'; }

    const esAhora = i === 0;
    return `<div class="hour-block ${cls}" title="T: ${temp.toFixed(0)}Â°C | HR: ${hr}% | PP: ${pp}%">
      ${esAhora ? '<div class="hour-now">AHORA</div>' : ''}
      <div class="hour-label">${String(hora).padStart(2,'0')}:00</div>
      <div class="hour-emoji">${emoji}</div>
      <div class="hour-wind">${viento.toFixed(0)} km/h</div>
    </div>`;
  }).join('');

  document.getElementById('pulv-ventana-fecha').textContent = ahora.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' });
  document.getElementById('pulv-ventana-card').style.display = 'block';
}

// â”€â”€â”€ DERIVA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderDeriva(c) {
  if (!c) return;
  const viento = c.wind_speed_10m;
  const temp = c.temperature_2m;
  const hr = c.relative_humidity_2m;

  // Ãndice de riesgo 0â€“100
  let idx = 0;
  idx += Math.min(viento / 30 * 60, 60);   // viento aporta hasta 60 pts
  idx += Math.max(0, (35 - hr) / 35 * 20); // HR baja aporta hasta 20 pts
  idx += Math.max(0, (temp - 20) / 15 * 20); // temp alta hasta 20 pts
  idx = Math.min(Math.round(idx), 100);

  // Aguja: -90 = izq (bajo), 0 = centro (medio), 90 = der (alto)
  const deg = (idx / 100 * 180) - 90;
  document.getElementById('deriva-needle').style.setProperty('--needle-deg', deg + 'deg');
  document.getElementById('deriva-val').textContent = idx + '%';

  let label, cls;
  if (idx < 35) { label = 'Riesgo BAJO de deriva'; cls = 'bajo'; }
  else if (idx < 65) { label = 'Riesgo MEDIO de deriva'; cls = 'medio'; }
  else { label = 'Riesgo ALTO de deriva'; cls = 'alto'; }
  document.getElementById('deriva-label').textContent = label;

  ['bajo','medio','alto'].forEach(c => {
    const el = document.getElementById('dc-' + c);
    el.classList.remove('active', 'bajo', 'medio', 'alto');
  });
  document.getElementById('dc-' + cls).classList.add('active', cls);

  // Factores detallados
  const factores = document.getElementById('deriva-factores');
  factores.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem">
      ${[
        { lbl:'Velocidad de viento', val: viento.toFixed(1)+' km/h', peso: viento > 25 ? 'warn' : viento > 15 ? 'caution' : 'ok', tip: 'Determinante principal de deriva' },
        { lbl:'Temperatura', val: temp.toFixed(1)+'Â°C', peso: temp>32?'warn':temp>28?'caution':'ok', tip: 'Afecta volatilizaciÃ³n' },
        { lbl:'Humedad relativa', val: hr+'%', peso: hr<40?'warn':hr<55?'caution':'ok', tip: 'Determina evaporaciÃ³n de gotas' },
        { lbl:'Estabilidad atmosfÃ©rica', val: (new Date().getHours()>=20||new Date().getHours()<=7)?'Nocturna âš ':'Diurna âœ“', peso: (new Date().getHours()>=20||new Date().getHours()<=7)?'caution':'ok', tip: 'InversiÃ³n tÃ©rmica nocturna' },
      ].map(f => `
        <div style="padding:1rem;background:rgba(28,18,8,.04);border-radius:12px;border:1px solid var(--border)">
          <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(28,18,8,.4);margin-bottom:.3rem">${f.lbl}</div>
          <div style="font-family:'DM Mono',monospace;font-size:1.3rem;color:var(--${f.peso==='warn'?'warn':f.peso==='caution'?'caution':'ok'})">${f.val}</div>
          <div style="font-size:.7rem;color:rgba(28,18,8,.45);margin-top:.2rem">${f.tip}</div>
        </div>`).join('')}
    </div>
    <div style="margin-top:1rem;padding:.9rem 1.1rem;background:rgba(58,122,184,.06);border-radius:10px;border:1px solid rgba(58,122,184,.15);font-size:.8rem;color:rgba(28,18,8,.65);line-height:1.6">
      <strong>Nota agronÃ³mica INTA:</strong> El riesgo de deriva depende principalmente de la velocidad y turbulencia del viento, el tipo de boquilla, el volumen de aplicaciÃ³n y el tamaÃ±o de gota. Las condiciones de inversiÃ³n tÃ©rmica nocturna pueden transportar gotas pequeÃ±as varios kilÃ³metros.
    </div>`;
}

// â”€â”€â”€ BUFFER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function calcBuffer() {
  const lindero = document.getElementById('d-lindero').value;
  const boquilla = document.getElementById('d-boquilla').value;
  if (!lindero || !boquilla) return;

  const bufferBase = {
    soja: 20, hortalizas: 50, apicultura: 100, agua: 30, urbano: 75, forestal: 15
  };
  const factorBoquilla = {
    abanico_estandar: 1.0,
    abanico_antideriva: 0.6,
    doble_abanico: 0.75,
    cono_hueco: 1.3
  };
  const notas = {
    soja: 'Especialmente crÃ­tico en floraciÃ³n. La soja es muy sensible a hormonales (2,4-D, Dicamba).',
    hortalizas: 'Cultivos de alta sensibilidad. Se recomienda verificar viento < 8 km/h.',
    apicultura: 'Coordinar con apicultores. Aplicar en horario de menor actividad (noche o madrugada).',
    agua: 'Respetar legislaciÃ³n provincial. Algunos productos tienen restricciones adicionales.',
    urbano: 'Verificar ordenanzas municipales y zonas de exclusiÃ³n locales.',
    forestal: 'Considerar fauna silvestre y polinizadores nativos.'
  };

  const viento = STATE.meteo ? STATE.meteo.wind_speed_10m : 10;
  const factorViento = 1 + (viento / 25);
  const buffer = Math.round(bufferBase[lindero] * factorBoquilla[boquilla] * factorViento);

  document.getElementById('buffer-val').textContent = buffer;
  document.getElementById('buffer-nota').textContent = 'âš  ' + notas[lindero];
  document.getElementById('buffer-resultado').style.display = 'block';
}

// â”€â”€â”€ CALCULADORA CALDO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PRODUCTOS = {
  herbicida: [
    { nombre: 'Glifosato 48%',        dosis: 2.5,  unidad: 'L/ha',  mezcla: 'herbicida_sistemico' },
    { nombre: 'Glifosato + Dicamba',   dosis: 1.8,  unidad: 'L/ha',  mezcla: 'hormonal' },
    { nombre: '2,4-D Amina 72%',       dosis: 1.0,  unidad: 'L/ha',  mezcla: 'hormonal' },
    { nombre: 'Atrazina 50%',          dosis: 3.0,  unidad: 'L/ha',  mezcla: 'preemergente' },
    { nombre: 'Cletodim 12%',          dosis: 0.8,  unidad: 'L/ha',  mezcla: 'graminicida' },
    { nombre: 'Haloxifop 12%',         dosis: 0.7,  unidad: 'L/ha',  mezcla: 'graminicida' },
    { nombre: 'Metribuzin 70%',        dosis: 0.35, unidad: 'kg/ha', mezcla: 'preemergente' },
    { nombre: 'MetsulfurÃ³n 60%',       dosis: 0.007,unidad: 'kg/ha', mezcla: 'ats' },
  ],
  fungicida: [
    { nombre: 'Tebuconazole 25%',      dosis: 0.75, unidad: 'L/ha',  mezcla: 'triazol' },
    { nombre: 'Azoxistrobin + Cipro',  dosis: 0.3,  unidad: 'L/ha',  mezcla: 'estrobilurina' },
    { nombre: 'Trifloxistrobin + Cip.', dosis: 0.4, unidad: 'L/ha',  mezcla: 'estrobilurina' },
    { nombre: 'Fluxapiroxad + Epox.',  dosis: 0.4,  unidad: 'L/ha',  mezcla: 'sdhi' },
    { nombre: 'Mancozeb 80%',          dosis: 2.0,  unidad: 'kg/ha', mezcla: 'contacto' },
    { nombre: 'Iprodione 50%',         dosis: 1.5,  unidad: 'L/ha',  mezcla: 'dicarboximida' },
  ],
  insecticida: [
    { nombre: 'Clorpirifos 48%',       dosis: 1.0,  unidad: 'L/ha',  mezcla: 'op' },
    { nombre: 'Lambda-cialotrina 5%',  dosis: 0.15, unidad: 'L/ha',  mezcla: 'piretroide' },
    { nombre: 'Cipermetrina 25%',      dosis: 0.2,  unidad: 'L/ha',  mezcla: 'piretroide' },
    { nombre: 'Imidacloprid 35%',      dosis: 0.25, unidad: 'L/ha',  mezcla: 'neonicotinoide' },
    { nombre: 'Metamidofos 60%',       dosis: 0.8,  unidad: 'L/ha',  mezcla: 'op' },
    { nombre: 'Spinosad 12%',          dosis: 0.15, unidad: 'L/ha',  mezcla: 'spinosina' },
  ],
  fertilizante_foliar: [
    { nombre: 'Urea foliar 20%',       dosis: 3.0,  unidad: 'L/ha',  mezcla: 'foliar' },
    { nombre: 'Boro lÃ­quido',          dosis: 0.5,  unidad: 'L/ha',  mezcla: 'foliar' },
    { nombre: 'Azufre lÃ­quido 20%',    dosis: 1.5,  unidad: 'L/ha',  mezcla: 'foliar' },
    { nombre: 'Zinc + Manganeso',      dosis: 1.0,  unidad: 'L/ha',  mezcla: 'foliar' },
  ]
};

const ORDENES_MEZCLA = {
  herbicida_sistemico: ['1. Â½ tanque de agua limpia', '2. Coadyuvante / surfactante', '3. Glifosato', '4. Completar con agua', '5. Agitar suavemente'],
  hormonal:  ['1. Â½ tanque de agua limpia', '2. Agitar', '3. Hormonal (2,4-D / Dicamba) â€” agregar despacio', '4. Completar con agua', 'âš  NUNCA mezclar con emulsionables sin prueba de jarrita'],
  preemergente: ['1. Â½ tanque de agua limpia', '2. Dispersar el producto (PM) en agua aparte', '3. Agregar al tanque agitando', '4. Completar con agua', '5. Mantener agitaciÃ³n constante'],
  graminicida: ['1. Â½ tanque de agua limpia', '2. Aceite metilado (si se requiere)', '3. Graminicida', '4. Completar con agua', 'âš  No mezclar con glifosato sin evaluaciÃ³n'],
  ats: ['1. Â½ tanque de agua limpia', '2. Disolver el granulado en agua aparte', '3. Agregar al tanque', '4. Coadyuvante', '5. Completar con agua'],
  triazol: ['1. Â½ tanque de agua', '2. Coadyuvante (si se requiere)', '3. Fungicida triazol', '4. Completar con agua'],
  estrobilurina: ['1. Â½ tanque de agua', '2. Fungicida (generalmente mezcla formulada)', '3. Completar con agua'],
  sdhi: ['1. Â½ tanque de agua', '2. Fungicida SDHI', '3. Completar con agua', 'âœ“ Buena compatibilidad con triazoles'],
  contacto: ['1. Â½ tanque de agua', '2. Humectar el PM en agua aparte', '3. Agregar al tanque agitando', '4. Mantener agitaciÃ³n'],
  dicarboximida: ['1. Â½ tanque de agua', '2. Producto', '3. Completar con agua'],
  op: ['1. Â½ tanque de agua', '2. OP (aguas Ã¡cidas o neutras)', '3. Completar con agua', 'âš  Incompatible en pH > 7, usar buffer'],
  piretroide: ['1. Â½ tanque de agua', '2. Piretroide', '3. Completar con agua', 'âœ“ Compatible con OP y fungicidas en general'],
  neonicotinoide: ['1. Â½ tanque de agua', '2. Neonicotinoide', '3. Completar con agua'],
  spinosina: ['1. Â½ tanque de agua', '2. Spinosad (activar baja agitaciÃ³n)', '3. Completar con agua', 'âœ“ Selectivo para enemigos naturales'],
  foliar: ['1. Agua limpia pH 5.5â€“6.5', '2. Fertilizante foliar', '3. Completar con agua', 'âœ“ Aplicar con HR > 65% y temperatura fresca'],
};

const PAUTAS = {
  herbicida:   `<ul style="font-size:.83rem;color:rgba(28,18,8,.7);line-height:1.8;list-style:none">
    <li>ðŸŒ¡ Temperatura Ã³ptima: <strong>15â€“28Â°C</strong></li>
    <li>ðŸ’§ Humedad relativa: <strong>> 55%</strong></li>
    <li>ðŸ’¨ Viento: <strong>3â€“15 km/h</strong></li>
    <li>â˜€ï¸ Evitar horas de mÃ¡xima radiaciÃ³n (12â€“16 hs)</li>
    <li>ðŸŒ§ PerÃ­odo libre de lluvia: <strong>4â€“8 hs post-aplicaciÃ³n</strong> (segÃºn producto)</li>
    <li>âš ï¸ Hormonales (2,4-D, Dicamba): NO aplicar > 28Â°C ni con inversiÃ³n tÃ©rmica</li>
  </ul>`,
  fungicida:   `<ul style="font-size:.83rem;color:rgba(28,18,8,.7);line-height:1.8;list-style:none">
    <li>ðŸŒ¡ Temperatura: <strong>15â€“25Â°C</strong></li>
    <li>ðŸ’§ HR: <strong>> 60%</strong> (favorece adhesiÃ³n y absorciÃ³n)</li>
    <li>ðŸ’¨ Viento: <strong>3â€“12 km/h</strong></li>
    <li>ðŸŒ§ PerÃ­odo libre de lluvia: <strong>2â€“4 hs</strong></li>
    <li>ðŸ“… Aplicar en estadio preventivo (antes de infecciÃ³n)</li>
    <li>âœ“ Triazoles + estrobilurinas: mayor espectro y residualidad</li>
  </ul>`,
  insecticida: `<ul style="font-size:.83rem;color:rgba(28,18,8,.7);line-height:1.8;list-style:none">
    <li>ðŸŒ¡ Temperatura: <strong>15â€“30Â°C</strong></li>
    <li>ðŸ’¨ Viento: <strong>< 15 km/h</strong> (piretroides muy sensibles)</li>
    <li>ðŸŒ™ Piretroides: preferir aplicaciÃ³n vespertina/nocturna</li>
    <li>ðŸ Abejas: NO aplicar en floraciÃ³n con neonicotinoides u OP</li>
    <li>ðŸŒ§ PerÃ­odo libre de lluvia: <strong>1â€“2 hs</strong></li>
    <li>âš ï¸ OP organofosforados: mÃ¡xima precauciÃ³n EPP</li>
  </ul>`,
  fertilizante_foliar: `<ul style="font-size:.83rem;color:rgba(28,18,8,.7);line-height:1.8;list-style:none">
    <li>ðŸŒ¡ Temperatura: <strong>< 25Â°C</strong></li>
    <li>ðŸ’§ HR: <strong>> 65%</strong> (clave para absorciÃ³n foliar)</li>
    <li>â° Aplicar temprano (7â€“10 hs) o tarde (17â€“20 hs)</li>
    <li>ðŸŒ§ PerÃ­odo libre de lluvia: <strong>6 hs</strong></li>
    <li>ðŸ’¦ Aumentar volumen de caldo: <strong>100â€“150 L/ha</strong></li>
    <li>âš ï¸ Urea foliar: riesgo de quemado si > 25Â°C y HR baja</li>
  </ul>`,
};

function actualizarProductos() {
  const tipo = document.getElementById('c-tipo').value;
  const sel = document.getElementById('c-producto');
  sel.innerHTML = '<option value="">â€” Seleccionar producto â€”</option>';
  if (PRODUCTOS[tipo]) {
    PRODUCTOS[tipo].forEach((p, i) => {
      sel.innerHTML += `<option value="${i}">${p.nombre} (${p.dosis} ${p.unidad})</option>`;
    });
  }
  // Mostrar pautas
  const pauta = document.getElementById('pauta-body');
  if (PAUTAS[tipo]) { pauta.innerHTML = PAUTAS[tipo]; }
  else { pauta.innerHTML = '<p class="txt-muted">SeleccionÃ¡ un tipo de aplicaciÃ³n.</p>'; }
  calcCaldo();
}

function calcCaldo() {
  const tipo = document.getElementById('c-tipo').value;
  const prodIdx = document.getElementById('c-producto').value;
  const volha = parseFloat(document.getElementById('c-volha').value) || 80;
  const tanque = parseFloat(document.getElementById('c-tanque').value) || 3000;
  const ha = parseFloat(document.getElementById('c-ha').value) || null;

  if (!tipo || prodIdx === '') {
    // Resetear resultados
    ['r-dosis','r-prod-total','r-autonomia','r-tanques','r-agua','r-conc'].forEach(id => {
      document.getElementById(id).textContent = 'â€”';
    });
    return;
  }

  const prod = PRODUCTOS[tipo][parseInt(prodIdx)];
  const autonomia = Math.round(tanque / volha);
  const concPct = ((prod.dosis / volha) * 100).toFixed(2);

  document.getElementById('r-dosis').textContent = prod.dosis;
  document.getElementById('r-dosis-unit').textContent = prod.unidad;
  document.getElementById('r-autonomia').textContent = autonomia;
  document.getElementById('r-conc').textContent = concPct;

  if (ha) {
    const prodTotal = (prod.dosis * ha).toFixed(1);
    const tanquesTotal = Math.ceil(ha / autonomia);
    const aguaTotal = Math.round(volha * ha);
    document.getElementById('r-prod-total').textContent = prodTotal;
    document.getElementById('r-prod-unit').textContent = prod.unidad.replace('/ha','');
    document.getElementById('r-tanques').textContent = tanquesTotal;
    document.getElementById('r-agua').textContent = aguaTotal.toLocaleString('es-AR');
  } else {
    document.getElementById('r-prod-total').textContent = 'â€”';
    document.getElementById('r-tanques').textContent = 'â€”';
    document.getElementById('r-agua').textContent = 'â€”';
  }

  // Alertas de concentraciÃ³n
  const alBox = document.getElementById('caldo-alerta-box');
  if (parseFloat(concPct) < 0.5) {
    alBox.style.display = 'flex';
    document.getElementById('caldo-alerta-txt').textContent = `ConcentraciÃ³n muy baja (${concPct}%). Verificar que el volumen de caldo sea adecuado para lograr buena cobertura.`;
  } else if (parseFloat(concPct) > 5) {
    alBox.style.display = 'flex';
    document.getElementById('caldo-alerta-txt').textContent = `ConcentraciÃ³n alta (${concPct}%). Riesgo de fitotoxicidad. Verificar dosis y compatibilidad.`;
  } else { alBox.style.display = 'none'; }

  // Orden de agregado
  const ordenBody = document.getElementById('orden-body');
  const orden = ORDENES_MEZCLA[prod.mezcla];
  if (orden) {
    ordenBody.innerHTML = `<ol style="font-size:.83rem;color:rgba(28,18,8,.7);line-height:2;list-style:none">`
      + orden.map(s => `<li style="padding:.2rem 0;border-bottom:1px solid rgba(60,34,16,.06)">${s}</li>`).join('')
      + `</ol>`;
  }
}

// â”€â”€â”€ REGISTRO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function autoFillRegistro(c) {
  if (!c) return;
  const now = new Date();
  document.getElementById('reg-fecha').value = now.toISOString().split('T')[0];
  document.getElementById('reg-hora').value = now.toTimeString().slice(0,5);
  document.getElementById('reg-temp').value = c.temperature_2m.toFixed(1);
  document.getElementById('reg-viento').value = c.wind_speed_10m.toFixed(1);
  document.getElementById('reg-hr').value = c.relative_humidity_2m;
}

let historial = JSON.parse(localStorage.getItem('pulv-historial') || '[]');

function guardarRegistro() {
  const r = {
    id: Date.now(),
    fecha: document.getElementById('reg-fecha').value,
    hora: document.getElementById('reg-hora').value,
    lote: document.getElementById('reg-lote').value || 'â€”',
    ha: parseFloat(document.getElementById('reg-ha').value) || 0,
    cultivo: document.getElementById('reg-cultivo').value,
    operador: document.getElementById('reg-operador').value,
    equipo: document.getElementById('reg-equipo').value,
    producto: document.getElementById('reg-producto').value,
    dosis: document.getElementById('reg-dosis').value,
    volha: document.getElementById('reg-volha').value,
    temp: document.getElementById('reg-temp').value,
    viento: document.getElementById('reg-viento').value,
    hr: document.getElementById('reg-hr').value,
    condicion: document.getElementById('reg-condicion').value,
    obs: document.getElementById('reg-obs').value,
  };
  historial.unshift(r);
  localStorage.setItem('pulv-historial', JSON.stringify(historial));
  renderHistorial();
  toast('âœ… Ficha guardada correctamente');
}

function renderHistorial() {
  const tbody = document.getElementById('historial-body');
  if (!tbody) return;
  if (historial.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="txt-muted" style="text-align:center;padding:2rem">Sin registros aÃºn</td></tr>';
    return;
  }
  tbody.innerHTML = historial.map(r => `
    <tr>
      <td style="white-space:nowrap">${r.fecha} ${r.hora}</td>
      <td>${r.lote}</td>
      <td>${r.producto || 'â€”'}</td>
      <td>${r.ha || 'â€”'}</td>
      <td><span class="tag ${r.condicion}">${r.condicion==='verde'?'Apto':r.condicion==='amarillo'?'PrecauciÃ³n':'No apto'}</span></td>
    </tr>`).join('');

  const totalHa = historial.reduce((s,r) => s+(r.ha||0), 0);
  const resApps = document.getElementById('res-apps');
  const resHa = document.getElementById('res-ha');
  if (resApps) resApps.textContent = historial.length;
  if (resHa) resHa.textContent = totalHa.toLocaleString('es-AR');
}

function limpiarHistorial() {
  if (!confirm('Â¿Eliminar todos los registros?')) return;
  historial = [];
  localStorage.setItem('pulv-historial', '[]');
  renderHistorial();
}

function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const lote = document.getElementById('reg-lote').value || 'Sin nombre';
  const fecha = document.getElementById('reg-fecha').value;

  doc.setFillColor(15, 31, 20);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(253, 250, 245);
  doc.setFontSize(20);
  doc.text('AgroMotor â€” Registro de PulverizaciÃ³n', 15, 18);
  doc.setFontSize(10);
  doc.setTextColor(200, 162, 85);
  doc.text('MÃ³dulo PulverizaciÃ³n v1.0 Â· INTA', 15, 28);
  doc.setTextColor(140, 170, 150);
  doc.text('Generado: ' + new Date().toLocaleDateString('es-AR'), 15, 35);

  doc.setTextColor(28, 18, 8);
  let y = 52;
  const campos = [
    ['Lote / Establecimiento', lote],
    ['Fecha', fecha],
    ['Hora inicio', document.getElementById('reg-hora').value],
    ['Superficie', (document.getElementById('reg-ha').value || 'â€”') + ' ha'],
    ['Cultivo', document.getElementById('reg-cultivo').value],
    ['Operador', document.getElementById('reg-operador').value || 'â€”'],
    ['Equipo', document.getElementById('reg-equipo').value || 'â€”'],
    ['', ''],
    ['Producto', document.getElementById('reg-producto').value || 'â€”'],
    ['Dosis', (document.getElementById('reg-dosis').value || 'â€”') + ' L o kg/ha'],
    ['Volumen de caldo', (document.getElementById('reg-volha').value || 'â€”') + ' L/ha'],
    ['', ''],
    ['Temperatura', (document.getElementById('reg-temp').value || 'â€”') + ' Â°C'],
    ['Viento', (document.getElementById('reg-viento').value || 'â€”') + ' km/h'],
    ['Humedad relativa', (document.getElementById('reg-hr').value || 'â€”') + '%'],
    ['Estado de aplicaciÃ³n', document.getElementById('reg-condicion').value.toUpperCase()],
    ['', ''],
    ['Observaciones', document.getElementById('reg-obs').value || 'â€”'],
  ];
  campos.forEach(([k, v]) => {
    if (!k) { y += 4; return; }
    doc.setFontSize(9); doc.setTextColor(100,80,40);
    doc.text(k + ':', 15, y);
    doc.setFontSize(11); doc.setTextColor(28,18,8);
    doc.text(v, 70, y);
    y += 8;
  });

  doc.setFontSize(8); doc.setTextColor(150,130,100);
  doc.text('AgroMotor Â· Motor AgronÃ³mico de DecisiÃ³n Â· INTA Argentina', 15, 285);

  doc.save(`Pulverizacion_${lote.replace(/\s/g,'_')}_${fecha}.pdf`);
  toast('ðŸ“„ PDF exportado correctamente');
}

// â”€â”€â”€ UTILIDADES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function gradosADireccion(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastIn .3s ease reverse both';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}


// â”€â”€â”€ ASISTENTE IA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let chatHistory = [];
let chatBusy = false;

const SYSTEM_PROMPT = `Sos un asistente tÃ©cnico agronÃ³mico especializado en pulverizaciÃ³n agrÃ­cola para Argentina.
Tu nombre es "Asistente AgroMotor". RespondÃ©s en espaÃ±ol rioplatense, con terminologÃ­a tÃ©cnica precisa pero clara.

CONTEXTO Y ALCANCE:
- Especialista en manejo de malezas, plagas y enfermedades en cultivos extensivos argentinos (soja, maÃ­z, trigo, girasol, sorgo, pasturas)
- ConocÃ©s la normativa SENASA, los registros CASAFE, las recomendaciones INTA y la legislaciÃ³n fitosanitaria argentina
- ManejÃ¡s las guÃ­as HRAC para resistencia a herbicidas y FRAC para fungicidas
- ConocÃ©s los principales productos registrados en Argentina con sus principios activos, dosis y restricciones

SOBRE PULVERIZACIÃ“N Y CONDICIONES:
- ParÃ¡metros Ã³ptimos: temperatura 15-28Â°C, HR > 55%, viento 3-15 km/h, sin lluvia inminente
- Alertas de deriva, inversiÃ³n tÃ©rmica, volatilizaciÃ³n de hormonales
- Tipos de boquillas (XR, TTI, AI, cono hueco) y su relaciÃ³n con el espectro de gotas
- VolÃºmenes de caldo recomendados por tipo de aplicaciÃ³n (herbicida, fungicida, insecticida)

SOBRE MEZCLAS:
- ExplicÃ¡s el orden correcto de agregado al tanque (agua, coadyuvante, PM, SL, EC, etc.)
- AlertÃ¡s sobre incompatibilidades fÃ­sico-quÃ­micas (pH, precipitados, emulsiones rotas)
- MencionÃ¡s la importancia del test de jarrita

SOBRE RESISTENCIAS:
- Malezas con resistencia documentada en Argentina: rama negra (Conyza), yuyo colorado (Amaranthus), raigrÃ¡s (Lolium), sorgo de Alepo (Sorghum halepense)
- Estrategias de manejo: rotaciÃ³n de modos de acciÃ³n, mezclas, barbechos limpios, cultivos de cobertura

FORMATO DE RESPUESTAS:
- UsÃ¡ pÃ¡rrafos cortos y claros
- Cuando listÃ©s recomendaciones, usÃ¡ bullet points simples (â€¢)
- DestacÃ¡ alertas con âš ï¸ y recomendaciones positivas con âœ“
- Siempre recordÃ¡ que tus respuestas son orientativas y que hay que verificar el marbete del producto
- SÃ© concreto y prÃ¡ctico, como lo harÃ­a un tÃ©cnico de campo del INTA
- MÃ¡ximo 350 palabras por respuesta salvo que se pida mÃ¡s detalle`;

function buildContextMeteo() {
  if (!STATE.meteo) return '';
  const m = STATE.meteo;
  return `

[CONTEXTO METEO ACTUAL: T=${m.temperature_2m}Â°C, HR=${m.relative_humidity_2m}%, Viento=${m.wind_speed_10m}km/h, RÃ¡fagas=${m.wind_gusts_10m}km/h, PP=${m.precipitation}mm, Prob.lluvia=${m.precipitation_probability}%]`;
}

async function enviarMensaje() {
  const input = document.getElementById('chat-input');
  const texto = input.value.trim();
  if (!texto || chatBusy) return;

  // Agregar mensaje usuario
  agregarMensaje('user', texto);
  input.value = '';
  autoResizeTextarea(input);
  input.style.height = 'auto';

  // Ocultar chips tras el primer mensaje
  document.getElementById('chat-chips').style.display = 'none';

  // Agregar al historial
  chatHistory.push({ role: 'user', content: texto + buildContextMeteo() });

  // Mostrar typing
  const typingId = mostrarTyping();
  chatBusy = true;
  document.getElementById('chat-send-btn').disabled = true;

  try {
    const response = await pulvClaude({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: chatHistory
    });

    const data = await response.json();
    const respuesta = data.content?.[0]?.text || 'No pude procesar la respuesta.';

    quitarTyping(typingId);
    agregarMensaje('assistant', respuesta);
    chatHistory.push({ role: 'assistant', content: respuesta });

    // Limitar historial a 20 turnos para no exceder contexto
    if (chatHistory.length > 40) chatHistory = chatHistory.slice(-30);

  } catch(e) {
    quitarTyping(typingId);
    agregarMensaje('assistant', 'âš ï¸ No pude conectarme con el asistente IA. VerificÃ¡ tu conexiÃ³n a internet e intentÃ¡ nuevamente.');
  }

  chatBusy = false;
  document.getElementById('chat-send-btn').disabled = false;
  document.getElementById('chat-input').focus();
}

function agregarMensaje(rol, texto) {
  const msgs = document.getElementById('chat-messages');
  const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const avatar = rol === 'user' ? 'ðŸ‘¤' : 'ðŸ¤–';
  const tiempoLabel = rol === 'user' ? 'Vos' : 'Asistente IA';

  // Convertir markdown bÃ¡sico a HTML
  const html = texto
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\nâ€¢ /g, '<br>â€¢ ')
    .replace(/\n/g, '<br>');

  const div = document.createElement('div');
  div.className = 'msg ' + rol;
  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div>
      <div class="msg-bubble">${html}</div>
      <div class="msg-time">${tiempoLabel} Â· ${hora}</div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function mostrarTyping() {
  const msgs = document.getElementById('chat-messages');
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'msg assistant';
  div.id = id;
  div.innerHTML = `
    <div class="msg-avatar">ðŸ¤–</div>
    <div>
      <div class="msg-bubble">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return id;
}

function quitarTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function usarChip(el) {
  const input = document.getElementById('chat-input');
  input.value = el.textContent;
  autoResizeTextarea(input);
  enviarMensaje();
}

function chatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    enviarMensaje();
  }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 130) + 'px';
}

function limpiarChat() {
  chatHistory = [];
  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML = `
    <div class="msg assistant">
      <div class="msg-avatar">ðŸ¤–</div>
      <div>
        <div class="msg-bubble">
          <strong>Chat reiniciado.</strong> Â¿En quÃ© te puedo ayudar con la pulverizaciÃ³n?
        </div>
        <div class="msg-time">Asistente IA Â· listo</div>
      </div>
    </div>`;
  document.getElementById('chat-chips').style.display = 'flex';
}

// Mostrar badge meteo en el asistente cuando hay datos
function actualizarCtxBadge() {
  const b = document.getElementById('ctx-meteo-badge');
  if (b && STATE.meteo) b.style.display = 'inline-flex';
}


// â”€â”€â”€ BASE HRAC ARGENTINA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Fuentes: INTA Manfredi, AAPRESID Red de Malezas Resistentes, Heap I. (2024)
const HRAC_DB = [
  {
    id: 1,
    nombre: 'Rama negra',
    cientifico: 'Conyza bonariensis / Conyza sumatrensis',
    familia: 'asteraceas',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'total' },
      { hrac: 'D (PS II)', nombre: 'Atrazina / Metribuzin', nivel: 'total' },
    ],
    distribucion: 'Buenos Aires, CÃ³rdoba, Santa Fe, Entre RÃ­os, La Pampa, San Luis',
    primer_caso: 2003,
    alta_peligrosidad: true,
    estadios_sensibles: 'Roseta pequeÃ±a (< 5 cm) o pre-emergencia',
    metodos_alternativos: [
      'âœ“ Herbicidas HRAC F1: Saflufenacil (KixorÂ®) + aceite metilado',
      'âœ“ HRAC K3: Clormequat (en mezcla pre-siembra)',
      'âœ“ HRAC O: 2,4-D amina en dosis bajas en mezcla (con precauciÃ³n por volatilizaciÃ³n)',
      'âœ“ Control mecÃ¡nico: cincel o rastra de discos en barbecho',
      'âœ“ Cultivos de cobertura: vicia, centeno â€” reducen emergencia hasta 70%',
      'âœ“ Aplicar sobre rosetas pequeÃ±as; plantas > 10 cm requieren mezcla + aceite',
    ],
    manejo_integrado: [
      'âš  No confiar en glifosato solo: resistencia extendida en toda la regiÃ³n pampeana',
      'âš  Rotar modos de acciÃ³n en cada barbecho',
      'Monitorear lotes con historia de aplicaciones frecuentes de glifosato',
      'Priorizar aplicaciones en pre-emergencia o estadios muy tempranos',
    ],
    notas_inta: 'Caso paradigmÃ¡tico de resistencia en Argentina. INTA recomienda el uso de mezclas con al menos 2 modos de acciÃ³n diferentes y el manejo del banco de semillas con cultivos de cobertura.',
    cultivos_afectados: ['Soja', 'MaÃ­z', 'Girasol', 'Trigo', 'Barbecho'],
  },
  {
    id: 2,
    nombre: 'Yuyo colorado',
    cientifico: 'Amaranthus palmeri / A. hybridus / A. quitensis',
    familia: 'amarantaceas',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'total' },
      { hrac: 'B (ALS)', nombre: 'Imidazolinonas / Sulfonilureas', nivel: 'total' },
      { hrac: 'C1 (PS II)', nombre: 'Atrazina', nivel: 'parcial' },
    ],
    distribucion: 'CÃ³rdoba, Buenos Aires, Santa Fe, Entre RÃ­os â€” expansiÃ³n acelerada A. palmeri desde 2018',
    primer_caso: 1997,
    alta_peligrosidad: true,
    estadios_sensibles: 'Pre-emergencia o estadios muy tempranos (< 3 cm)',
    metodos_alternativos: [
      'âœ“ HRAC F1: Saflufenacil solo o en mezcla (KixorÂ® + glifosato)',
      'âœ“ HRAC K3: PendimetalÃ­n, S-metolacloro (pre-emergentes)',
      'âœ“ HRAC E: FomesafÃ©n en soja RR (post-emergencia temprana)',
      'âœ“ HRAC O: 2,4-D + glifosato en barbecho (plantas < 10 cm)',
      'âœ“ Soja con cobertura de cultivo + herbicida pre-emergente',
      'âœ“ Laboreo estratÃ©gico: no invertir suelo para no traer semillas nuevas',
    ],
    manejo_integrado: [
      'âš  A. palmeri: resistencia mÃºltiple documentada â€” mÃ¡xima alerta',
      'âš  Tasa de producciÃ³n: hasta 600.000 semillas/planta',
      'Umbral de daÃ±o: 1 planta/mÂ² puede costar 50% del rendimiento en soja',
      'RotaciÃ³n de cultivos con cereales de invierno mejora el control',
      'Nunca permitir que una planta llegue a semillar',
    ],
    notas_inta: 'A. palmeri es considerado la maleza de mayor potencial invasivo en Argentina. INTA Manfredi alerta sobre casos de resistencia mÃºltiple (Grupos B + G) en el norte de CÃ³rdoba y sur de Santiago del Estero.',
    cultivos_afectados: ['Soja', 'MaÃ­z', 'Girasol', 'Barbecho'],
  },
  {
    id: 3,
    nombre: 'Sorgo de Alepo',
    cientifico: 'Sorghum halepense',
    familia: 'poaceas',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'total' },
      { hrac: 'A (ACCasa)', nombre: 'Haloxifop / Cletodim / Fluazifop', nivel: 'parcial' },
    ],
    distribucion: 'Buenos Aires, CÃ³rdoba, Santa Fe, Entre RÃ­os, La Pampa, Chaco',
    primer_caso: 2005,
    alta_peligrosidad: true,
    estadios_sensibles: 'Macollos tempranos (< 30 cm), antes de que macollaje avance',
    metodos_alternativos: [
      'âœ“ HRAC A alternativos: Clethodim 24% a dosis plenas (verificar biÃ³tipo)',
      'âœ“ Control en Ã©pocas no crÃ­ticas: laboreo de rizomas (stress hÃ­drico verano)',
      'âœ“ Cultivos de invierno competitivos (trigo, cebada) en rotaciÃ³n',
      'âœ“ En maÃ­z: nicosulfurÃ³n en estadio adecuado (verificar hÃ­brido)',
      'âœ“ CombinaciÃ³n de control quÃ­mico + labranza en verano',
    ],
    manejo_integrado: [
      'âš  Biotipos resistentes a glifosato y ACCasa: opciones muy limitadas',
      'Evitar semillar â€” las semillas viables persisten 3-5 aÃ±os en suelo',
      'Limpiar mÃ¡quinas entre lotes para no diseminar rizomas',
      'Monitorear lotes con mÃ¡s de 8 aÃ±os de SD continua sin rotaciÃ³n',
    ],
    notas_inta: 'La resistencia a ACCasa en Sorghum halepense representa uno de los escenarios mÃ¡s complejos de manejo. INTA recomienda estrategias de largo plazo con rotaciÃ³n de cultivos como eje central.',
    cultivos_afectados: ['Soja', 'MaÃ­z', 'Girasol', 'Girasol', 'AlgodÃ³n'],
  },
  {
    id: 4,
    nombre: 'RaigrÃ¡s anual',
    cientifico: 'Lolium multiflorum',
    familia: 'poaceas',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'total' },
      { hrac: 'A (ACCasa)', nombre: 'Cletodim / Haloxifop', nivel: 'total' },
      { hrac: 'B (ALS)', nombre: 'MetsulfurÃ³n', nivel: 'parcial' },
    ],
    distribucion: 'Buenos Aires (principalmente sur y sudeste), La Pampa, CÃ³rdoba sur',
    primer_caso: 1996,
    alta_peligrosidad: true,
    estadios_sensibles: '2-3 hojas, antes del macollaje',
    metodos_alternativos: [
      'âœ“ HRAC K1: Trifluralin en presiembra incorporado en trigo',
      'âœ“ HRAC K3: Clormequat o pendimetalÃ­n en barbecho',
      'âœ“ HRAC F1: Pinoxaden en cereales (solo biotipos sin resistencia a ACCasa)',
      'âœ“ Mezclas de modos de acciÃ³n diferentes (consultar asesor)',
      'âœ“ Laboreo de alta calidad + fecha de siembra tardÃ­a en trigo',
      'âœ“ RotaciÃ³n con cultivos de verano para interrumpir ciclo',
    ],
    manejo_integrado: [
      'âš  Resistencia mÃºltiple documentada (G + A + B) en varias zonas',
      'El primer caso de resistencia en Argentina fue en raigrÃ¡s (1996)',
      'Monitorear densidades en lotes de trigo y pasturas',
      'Usar semilla certificada libre de raigrÃ¡s resistente',
    ],
    notas_inta: 'Primer biotipo resistente a herbicidas documentado en Argentina. La resistencia mÃºltiple complica el manejo en sistemas de producciÃ³n de trigo y pasturas del sur bonaerense.',
    cultivos_afectados: ['Trigo', 'Cebada', 'Pasturas', 'Barbecho'],
  },
  {
    id: 5,
    nombre: 'CapÃ­n / Pata de ganso',
    cientifico: 'Echinochloa colona / E. crus-galli',
    familia: 'poaceas',
    grupos_resistentes: [
      { hrac: 'A (ACCasa)', nombre: 'Quizalofop / Fluazifop', nivel: 'total' },
      { hrac: 'B (ALS)', nombre: 'Bispyribac-sodium (arroz)', nivel: 'parcial' },
    ],
    distribucion: 'Entre RÃ­os, Corrientes, Chaco, Formosa (principalmente en arroz irrigado)',
    primer_caso: 2010,
    alta_peligrosidad: false,
    estadios_sensibles: 'Pre-emergencia o 1-2 hojas',
    metodos_alternativos: [
      'âœ“ HRAC K3: PendimetalÃ­n, S-metolacloro (pre-emergentes en maÃ­z/soja)',
      'âœ“ HRAC N: Propanil en arroz (verificar biotipos)',
      'âœ“ Manejo del agua en arroz: inundaciÃ³n temprana',
      'âœ“ RotaciÃ³n arroz-soja-maÃ­z',
    ],
    manejo_integrado: [
      'Monitoreo temprano es clave â€” control en 1-2 hojas',
      'En sistemas arroceros: auditorÃ­a de aplicaciones pasadas',
      'Limpieza de equipos entre lotes de distintos productores',
    ],
    notas_inta: 'Problema creciente en NEA, especialmente en sistemas arroceros del litoral. La resistencia a ACCasa limita el uso de graminicidas clave.',
    cultivos_afectados: ['Arroz', 'Soja', 'MaÃ­z'],
  },
  {
    id: 6,
    nombre: 'Sunchillo',
    cientifico: 'Wedelia glauca',
    familia: 'asteraceas',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'parcial' },
    ],
    distribucion: 'NOA: Santiago del Estero, Chaco, TucumÃ¡n, Salta',
    primer_caso: 2012,
    alta_peligrosidad: false,
    estadios_sensibles: 'Planta joven, < 15 cm',
    metodos_alternativos: [
      'âœ“ HRAC O: 2,4-D amina a dosis plenas',
      'âœ“ HRAC C: PiclorÃ¡m en barbechos (producto de acciÃ³n residual)',
      'âœ“ Mezclas con dicamba o aminopiralid',
      'âœ“ Control mecÃ¡nico temprano antes de floraciÃ³n',
    ],
    manejo_integrado: [
      'Resistencia parcial: biotipos con reducciÃ³n de sensibilidad, no total',
      'Aumentar dosis de glifosato + coadyuvante puede dar resultado en algunos biotipos',
      'Monitorear lotes en segunda campaÃ±a o tardÃ­os del NOA',
    ],
    notas_inta: 'Maleza perenne de difÃ­cil control en el NOA. La resistencia parcial a glifosato requiere ajuste de estrategia en lotes con alta presiÃ³n.',
    cultivos_afectados: ['Soja', 'MaÃ­z', 'Girasol', 'Barbecho'],
  },
  {
    id: 7,
    nombre: 'Enredadera de campo',
    cientifico: 'Ipomoea purpurea / I. nil',
    familia: 'otras',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'parcial' },
    ],
    distribucion: 'CÃ³rdoba, Santa Fe, Buenos Aires norte, Entre RÃ­os',
    primer_caso: 2014,
    alta_peligrosidad: false,
    estadios_sensibles: '1-2 hojas verdaderas (muy pequeÃ±as)',
    metodos_alternativos: [
      'âœ“ HRAC F1: Saflufenacil (KixorÂ®) en pre o post temprana',
      'âœ“ HRAC E: FomesafÃ©n + glifosato en soja RR',
      'âœ“ HRAC O: 2,4-D en barbecho (control parcial)',
      'âœ“ Pre-emergentes: flumioxazin, sulfentrazone',
      'âœ“ Cosecha y limpieza: semillas con alta persistencia en suelo',
    ],
    manejo_integrado: [
      'DifÃ­cil control post-emergente una vez establecida',
      'Banco de semillas persistente: 5-7 aÃ±os en suelo',
      'Priorizar manejo pre-emergente o en estadios muy tempranos',
    ],
    notas_inta: 'Maleza de difÃ­cil control en soja. La resistencia parcial a glifosato suma complejidad. Estrategia clave: pre-emergentes + post temprana.',
    cultivos_afectados: ['Soja', 'MaÃ­z', 'Girasol'],
  },
  {
    id: 8,
    nombre: 'Mostacilla',
    cientifico: 'Raphanus sativus / Sinapis arvensis',
    familia: 'otras',
    grupos_resistentes: [
      { hrac: 'B (ALS)', nombre: 'MetsulfurÃ³n / Tribenuron', nivel: 'total' },
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'parcial' },
    ],
    distribucion: 'Buenos Aires, La Pampa, CÃ³rdoba sur â€” principalmente en trigo y barbecho',
    primer_caso: 2008,
    alta_peligrosidad: false,
    estadios_sensibles: '2-4 hojas, antes de elongaciÃ³n del tallo',
    metodos_alternativos: [
      'âœ“ HRAC O: 2,4-D amina + MCPA en trigo',
      'âœ“ HRAC C: Diclorprop en mezclas',
      'âœ“ HRAC I: Clopyralid (en girasol)',
      'âœ“ Mezclas de ALS + hormonales para demorar resistencia',
    ],
    manejo_integrado: [
      'âš  Resistencia a ALS extendida en zona triguera bonaerense',
      'Rotar modos de acciÃ³n en cada campaÃ±a de trigo',
      'Monitorear presencia antes de decidir el herbicida',
      'Evitar uso continuo de metsulfurÃ³n mÃ¡s de 2 campaÃ±as seguidas',
    ],
    notas_inta: 'La resistencia a ALS en mostacilla es uno de los casos mÃ¡s frecuentes en el cinturÃ³n triguero. INTA recomienda auditar el historial de herbicidas del lote antes de cada campaÃ±a.',
    cultivos_afectados: ['Trigo', 'Cebada', 'Girasol', 'Barbecho'],
  },
  {
    id: 9,
    nombre: 'Pasto cuaresma',
    cientifico: 'Digitaria sanguinalis',
    familia: 'poaceas',
    grupos_resistentes: [
      { hrac: 'A (ACCasa)', nombre: 'Fluazifop / Quizalofop', nivel: 'parcial' },
    ],
    distribucion: 'Buenos Aires, CÃ³rdoba, Santa Fe â€” casos puntuales en lotes con SD prolongada',
    primer_caso: 2016,
    alta_peligrosidad: false,
    estadios_sensibles: '1-3 hojas, antes de macollaje',
    metodos_alternativos: [
      'âœ“ HRAC K3: S-metolacloro pre-emergente',
      'âœ“ HRAC A alternativos: cletodim a dosis plenas',
      'âœ“ RotaciÃ³n con cultivos de invierno',
    ],
    manejo_integrado: [
      'Resistencia parcial â€” aumentar dosis puede ser efectivo en algunos biotipos',
      'Pre-emergentes son la estrategia mÃ¡s confiable',
      'No descuidar el control en bordes y cabeceras',
    ],
    notas_inta: 'Maleza secundaria que puede volverse problemÃ¡tica en sistemas con alta presiÃ³n de graminicidas. El monitoreo temprano permite el control con opciones todavÃ­a disponibles.',
    cultivos_afectados: ['Soja', 'MaÃ­z', 'Girasol'],
  },
  {
    id: 10,
    nombre: 'Avena fatua',
    cientifico: 'Avena fatua',
    familia: 'poaceas',
    grupos_resistentes: [
      { hrac: 'A (ACCasa)', nombre: 'Cletodim / Haloxifop / Fenoxaprop', nivel: 'total' },
      { hrac: 'B (ALS)', nombre: 'Difenzoquat', nivel: 'parcial' },
    ],
    distribucion: 'Buenos Aires (centro y sur), La Pampa â€” principalmente en trigo y cebada',
    primer_caso: 2009,
    alta_peligrosidad: false,
    estadios_sensibles: '2-3 hojas, antes del macollaje',
    metodos_alternativos: [
      'âœ“ HRAC K1: Trifluralin presiembra incorporado',
      'âœ“ HRAC K3: Clortolonil + pendimetalÃ­n (pre-emergente)',
      'âœ“ Pinoxaden (HRAC A, diferente sitio de acciÃ³n) en algunos biotipos',
      'âœ“ Fecha tardÃ­a de siembra en trigo para aprovechar falsa siembra',
      'âœ“ Cosecha limpia y limpieza de maquinaria entre lotes',
    ],
    manejo_integrado: [
      'Falsa siembra: preparar cama de siembra, esperar emergencia y destruir antes de sembrar',
      'Semilla certificada libre de avena',
      'Evitar trasladar granos o suelo entre lotes infestados',
    ],
    notas_inta: 'La resistencia a ACCasa limita severamente las opciones post-emergentes en cereales. El manejo preventivo (falsa siembra, semilla limpia) cobra importancia estratÃ©gica.',
    cultivos_afectados: ['Trigo', 'Cebada', 'Pasturas'],
  },
  {
    id: 11,
    nombre: 'Verdolaga',
    cientifico: 'Portulaca oleracea',
    familia: 'otras',
    grupos_resistentes: [
      { hrac: 'C1 (PS II)', nombre: 'Atrazina', nivel: 'total' },
    ],
    distribucion: 'CÃ³rdoba, Buenos Aires, Santa Fe â€” lotes con maÃ­z continuo y atrazina repetida',
    primer_caso: 2011,
    alta_peligrosidad: false,
    estadios_sensibles: 'Pre-emergencia o estadio muy temprano (cotiledones)',
    metodos_alternativos: [
      'âœ“ HRAC K3: S-metolacloro, acetoclor pre-emergente',
      'âœ“ HRAC G: Glifosato en post (no tiene resistencia)',
      'âœ“ HRAC F1: Saflufenacil en mezcla',
      'âœ“ RotaciÃ³n con soja para interrumpir presiÃ³n de atrazina',
    ],
    manejo_integrado: [
      'Resistencia especÃ­fica a atrazina â€” glifosato sigue siendo efectivo',
      'Rotar principios activos pre-emergentes en maÃ­z',
      'Monitorear lotes con historia de maÃ­z continuo',
    ],
    notas_inta: 'La resistencia a atrazina en verdolaga es relativamente localizada pero advierte sobre el riesgo del uso repetido del mismo herbicida pre-emergente en maÃ­z.',
    cultivos_afectados: ['MaÃ­z', 'Soja', 'Girasol'],
  },
  {
    id: 12,
    nombre: 'GramÃ³n / Gramilla',
    cientifico: 'Cynodon dactylon',
    familia: 'poaceas',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'parcial' },
    ],
    distribucion: 'Todo el paÃ­s â€” casos de tolerancia/resistencia documentados en Pampa hÃºmeda',
    primer_caso: 2015,
    alta_peligrosidad: false,
    estadios_sensibles: 'Control mÃ¡s efectivo en crecimiento activo',
    metodos_alternativos: [
      'âœ“ HRAC A: Cletodim o haloxifop a dosis mÃ¡ximas + aceite',
      'âœ“ Glifosato a dosis plenas en momento Ã³ptimo (final de verano)',
      'âœ“ Control mecÃ¡nico de rizomas en barbechos',
    ],
    manejo_integrado: [
      'Distinguir tolerancia natural vs resistencia real (alta biomasa dificulta control)',
      'Aplicar glifosato + ACCasa en mezcla para mayor eficacia',
      'El momento de aplicaciÃ³n (fin de verano) es clave para control de rizomas',
    ],
    notas_inta: 'La situaciÃ³n en gramÃ³n es mÃ¡s de tolerancia que resistencia confirmada en la mayorÃ­a de los casos. Sin embargo, la baja eficacia del glifosato en algunos lotes genera preocupaciÃ³n creciente.',
    cultivos_afectados: ['Soja', 'MaÃ­z', 'Girasol', 'Barbecho'],
  },
  {
    id: 13,
    nombre: 'Abrojo chico',
    cientifico: 'Xanthium spinosum / X. strumarium',
    familia: 'asteraceas',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'parcial' },
    ],
    distribucion: 'Buenos Aires, CÃ³rdoba, Santa Fe, Entre RÃ­os',
    primer_caso: 2013,
    alta_peligrosidad: false,
    estadios_sensibles: 'Cotiledones a 2 hojas verdaderas',
    metodos_alternativos: [
      'âœ“ HRAC E: FomesafÃ©n en soja (post-emergente)',
      'âœ“ HRAC O: 2,4-D en barbecho',
      'âœ“ HRAC F1: Saflufenacil en mezclas de barbecho',
      'âœ“ HRAC C: Dicamba en barbecho',
    ],
    manejo_integrado: [
      'Las semillas tienen dormancia â€” emergencias escalonadas complican el control',
      'El abrojo produce 2 tipos de semillas con diferente dormancia',
      'Impedir formaciÃ³n de frutos espinosos que se adhieren a cosechadoras',
    ],
    notas_inta: 'La resistencia parcial al glifosato requiere complementar con herbicidas de otros grupos. El fomesafÃ©n post-emergente en soja es actualmente la principal alternativa.',
    cultivos_afectados: ['Soja', 'MaÃ­z', 'Girasol', 'Barbecho'],
  },
  {
    id: 14,
    nombre: 'Blechum',
    cientifico: 'Blechum pyramidatum',
    familia: 'otras',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'total' },
    ],
    distribucion: 'NEA: Misiones, Corrientes, Chaco, Formosa',
    primer_caso: 2017,
    alta_peligrosidad: false,
    estadios_sensibles: 'PlÃ¡ntula pequeÃ±a',
    metodos_alternativos: [
      'âœ“ HRAC O: 2,4-D amina',
      'âœ“ HRAC F1: Saflufenacil',
      'âœ“ Control mecÃ¡nico en lotes con alta presencia',
    ],
    manejo_integrado: [
      'Caso relativamente reciente y con distribuciÃ³n acotada al NEA',
      'Monitorear su expansiÃ³n hacia zonas de soja en el noreste',
    ],
    notas_inta: 'Maleza de ambiente hÃºmedo con resistencia total a glifosato confirmada en NEA. Las alternativas son limitadas pero disponibles.',
    cultivos_afectados: ['Soja', 'Pasturas'],
  },
];

let hracFiltroActual = 'todos';
let hracBusqueda = '';

function renderHRAC() {
  const grid = document.getElementById('pulv-hrac-grid');
  if (!grid) return;
  const busq = hracBusqueda.toLowerCase();

  const filtrados = HRAC_DB.filter(m => {
    const matchFiltro =
      hracFiltroActual === 'todos' ||
      hracFiltroActual === m.familia ||
      (hracFiltroActual === 'alta_peligrosidad' && m.alta_peligrosidad);

    const matchBusq = !busq || [
      m.nombre, m.cientifico,
      m.grupos_resistentes.map(g => g.nombre + g.hrac).join(' '),
      m.distribucion
    ].some(txt => txt.toLowerCase().includes(busq));

    return matchFiltro && matchBusq;
  });

  if (!filtrados.length) {
    grid.innerHTML = '<div class="hrac-empty">ðŸ” No se encontraron malezas con ese criterio.<br><span style="font-size:.75rem">ProbÃ¡ con otro nombre o quitÃ¡ el filtro.</span></div>';
    return;
  }

  grid.innerHTML = filtrados.map(m => {
    const famCls = 'fam-' + m.familia;
    const famLabel = { amarantaceas:'AmarantÃ¡ceas', asteraceas:'AsterÃ¡ceas', poaceas:'PoÃ¡ceas', otras:'Otras' }[m.familia];
    const chips = m.grupos_resistentes.map(g =>
      `<span class="hrac-grupo-chip ${g.nivel === 'parcial' ? 'parcial' : ''}">${g.hrac}</span>`
    ).join('');

    return `<div class="hrac-card" onclick="pulvAbrirHRACModal(${m.id})">
      <div class="hrac-card-header">
        <div>
          <div class="hrac-nombre">${m.alta_peligrosidad ? 'âš  ' : ''}${m.nombre}</div>
          <div class="hrac-cientifico">${m.cientifico}</div>
        </div>
        <span class="hrac-badge-familia ${famCls}">${famLabel}</span>
      </div>
      <div class="hrac-card-body">
        <div class="hrac-row">
          <span class="hrac-row-label">Resistencia</span>
          <div class="hrac-grupos">${chips}</div>
        </div>
        <div class="hrac-row">
          <span class="hrac-row-label">Desde</span>
          <span class="hrac-row-val">${m.primer_caso}</span>
        </div>
        <div class="hrac-row">
          <span class="hrac-row-label">Presente en</span>
          <span class="hrac-row-val" style="font-size:.75rem">${m.distribucion.split(',').slice(0,3).join(', ')}${m.distribucion.split(',').length > 3 ? ' +' : ''}</span>
        </div>
      </div>
      <div class="hrac-card-footer">
        <div class="hrac-alternativas">${m.metodos_alternativos[0]}</div>
        ${m.alta_peligrosidad ? '<div class="hrac-alerta-zona">ðŸš¨ Alta peligrosidad â€” Manejo urgente</div>' : ''}
      </div>
    </div>`;
  }).join('');
}

function filtrarHRAC() {
  hracBusqueda = document.getElementById('pulv-hrac-search')?.value || '';
  renderHRAC();
}

function setFiltro(el, filtro) {
  hracFiltroActual = filtro;
  document.querySelectorAll('.hrac-filter').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderHRAC();
}

function abrirHRACModal(id) {
  const m = HRAC_DB.find(x => x.id === id);
  if (!m) return;

  document.getElementById('pulv-hrac-modal-titulo').textContent = m.nombre;
  document.getElementById('pulv-hrac-modal-sub').textContent = m.cientifico;

  const chips = m.grupos_resistentes.map(g =>
    `<span class="hrac-grupo-chip ${g.nivel === 'parcial' ? 'parcial' : ''}" style="font-size:.72rem;padding:.25rem .65rem">${g.hrac} â€” ${g.nombre} <em style="font-weight:400;font-style:normal">(${g.nivel})</em></span>`
  ).join(' ');

  document.getElementById('pulv-hrac-modal-body').innerHTML = `
    <div class="hrac-stat-row">
      <div class="hrac-stat">
        <div class="hrac-stat-val">${m.primer_caso}</div>
        <div class="hrac-stat-lbl">Primer caso</div>
      </div>
      <div class="hrac-stat">
        <div class="hrac-stat-val">${m.grupos_resistentes.length}</div>
        <div class="hrac-stat-lbl">Grupos HRAC</div>
      </div>
      <div class="hrac-stat">
        <div class="hrac-stat-val">${m.distribucion.split(',').length}</div>
        <div class="hrac-stat-lbl">Provincias</div>
      </div>
    </div>

    <div class="hrac-section-title">Resistencias documentadas</div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.8rem">${chips}</div>

    <div class="hrac-section-title">DistribuciÃ³n</div>
    <p style="font-size:.83rem;color:rgba(28,18,8,.7);margin-bottom:.8rem;line-height:1.55">ðŸ“ ${m.distribucion}</p>

    <div class="hrac-section-title">Estadio Ã³ptimo de control</div>
    <p style="font-size:.83rem;color:rgba(28,18,8,.7);margin-bottom:.8rem;line-height:1.55">ðŸŽ¯ ${m.estadios_sensibles}</p>

    <div class="hrac-section-title">Alternativas de control</div>
    ${m.metodos_alternativos.map(a => `<div class="hrac-manejo-item"><span>â€¢</span><span>${a}</span></div>`).join('')}

    <div class="hrac-section-title">Manejo integrado</div>
    ${m.manejo_integrado.map(a => `<div class="hrac-manejo-item"><span>â€¢</span><span>${a}</span></div>`).join('')}

    <div class="hrac-section-title">Cultivos afectados</div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem">
      ${m.cultivos_afectados.map(c => `<span style="font-size:.72rem;background:rgba(42,122,74,.1);color:var(--ok);border:1px solid rgba(42,122,74,.2);padding:.2rem .6rem;border-radius:8px;font-weight:600">${c}</span>`).join('')}
    </div>

    <div style="background:rgba(58,122,184,.07);border:1px solid rgba(58,122,184,.2);border-radius:12px;padding:1rem;margin-top:.5rem">
      <div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--spray-blue);margin-bottom:.4rem">ðŸ“‹ Nota INTA</div>
      <p style="font-size:.82rem;color:rgba(28,18,8,.7);line-height:1.6">${m.notas_inta}</p>
    </div>

    <div style="margin-top:1.2rem;text-align:center">
      <button class="btn-primary" style="font-size:.8rem;padding:.65rem 1.5rem"
        onclick="consultarAsistenteHRAC('${m.nombre}')">
        ðŸ¤– Consultar al Asistente IA sobre esta maleza
      </button>
    </div>
  `;

  document.getElementById('pulv-hrac-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function cerrarHRACModal(e) {
  if (e && e.target !== document.getElementById('pulv-hrac-modal')) return;
  document.getElementById('pulv-hrac-modal')?.classList.add('hidden');
  document.body.style.overflow = '';
}

function consultarAsistenteHRAC(nombreMaleza) {
  cerrarHRACModal();
  // Navegar al tab del asistente
  document.querySelectorAll('.module-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-asistente').classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t => {
    if (t.textContent.includes('Asistente')) t.classList.add('active');
  });
  // Pre-llenar la consulta
  const input = document.getElementById('chat-input');
  input.value = `Â¿QuÃ© estrategia de manejo recomendÃ¡s para ${nombreMaleza} en lotes con resistencia confirmada a glifosato? Â¿QuÃ© productos y en quÃ© orden de mezcla?`;
  autoResizeTextarea(input);
  input.focus();
}

// Init HRAC al cargar
renderHRAC();


// â•â•â• CALIDAD DE AGUA â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let productoAgua = 'glifosato';
let phActual = 7.5;
let fuenteAgua = 'pozo';

// Perfiles tÃ­picos de pH por fuente
const FUENTES_PH = {
  red:    { ph: 7.8, tds: 350, label: 'Red pÃºblica: pH tÃ­pico 7.5â€“8.5, TDS ~200â€“500 ppm' },
  pozo:   { ph: 7.5, tds: 500, label: 'Agua de pozo: pH tÃ­pico 7.0â€“8.5, TDS muy variable' },
  laguna: { ph: 8.2, tds: 800, label: 'Laguna/zanja: pH tÃ­pico 7.5â€“9.0, alto TDS estacional' },
  canal:  { ph: 7.6, tds: 450, label: 'Canal de riego: pH tÃ­pico 7.0â€“8.5, TDS moderado' },
};

// Base de conocimiento pH por producto
const PRODUCTO_PH = {
  glifosato: {
    ph_optimo: [4.5, 6.5],
    ph_limite: [6.5, 7.5],
    ph_critico: [7.5, 10],
    problema_alcalino: 'El glifosato se hidroliza rÃ¡pidamente en agua alcalina (pH > 7). Por cada unidad de pH sobre 7, la vida media del producto en el caldo se reduce a la mitad. A pH 8 puede perder 20â€“30% de eficacia antes de depositarse en la hoja.',
    problema_tds: 'Los cationes CaÂ²âº y MgÂ²âº de agua dura forman sales insolubles con el glifosato, neutralizando el principio activo antes de la aplicaciÃ³n.',
    acidificante: true,
    sulfato_amonio: true,
    sensibilidad_tds: 'alta',
  },
  glifo_2bd: {
    ph_optimo: [4.5, 6.0],
    ph_limite: [6.0, 7.0],
    ph_critico: [7.0, 10],
    problema_alcalino: 'La mezcla glifosato + 2,4-D requiere pH mÃ¡s bajo que cada producto por separado. El 2,4-D amina es estable en rango amplio pero el glifosato se degrada. Mantener pH 5â€“6 es crÃ­tico.',
    problema_tds: 'Igual que glifosato solo. El TDS alto antagoniza principalmente al glifosato de la mezcla.',
    acidificante: true,
    sulfato_amonio: true,
    sensibilidad_tds: 'alta',
  },
  glifo_dicamba: {
    ph_optimo: [4.5, 6.0],
    ph_limite: [6.0, 7.5],
    ph_critico: [7.5, 10],
    problema_alcalino: 'El dicamba es estable en rango amplio de pH. El riesgo es el glifosato. A pH > 7.5 la hidrÃ³lisis alcalina del glifosato compromete la eficacia de la mezcla.',
    problema_tds: 'Moderado. El dicamba no se ve afectado por TDS alto pero el glifosato sÃ­.',
    acidificante: true,
    sulfato_amonio: true,
    sensibilidad_tds: 'alta',
  },
  als: {
    ph_optimo: [5.0, 7.0],
    ph_limite: [7.0, 8.0],
    ph_critico: [4.0, 5.0],
    problema_alcalino: 'Las sulfonilureas e imidazolinonas son mÃ¡s estables que el glifosato pero el pH alcalino acelera la hidrÃ³lisis. A pH > 8 la degradaciÃ³n es significativa.',
    problema_tds: 'Baja sensibilidad al TDS. Los cationes Ca/Mg no antagonizan significativamente a los ALS.',
    acidificante: false,
    sulfato_amonio: false,
    sensibilidad_tds: 'baja',
    alerta_ph_bajo: 'Ojo: con pH < 5 los ALS tambiÃ©n se degradan por hidrÃ³lisis Ã¡cida.',
  },
  fungicida: {
    ph_optimo: [5.0, 8.0],
    ph_limite: [8.0, 9.0],
    ph_critico: [9.0, 10],
    problema_alcalino: 'Los triazoles y estrobilurinas son generalmente estables en rango amplio de pH. El problema a pH > 9 es la estabilidad de la emulsiÃ³n del formulado.',
    problema_tds: 'Baja sensibilidad. Los fungicidas de formulaciÃ³n EC o SC no se ven significativamente afectados por dureza.',
    acidificante: false,
    sulfato_amonio: false,
    sensibilidad_tds: 'baja',
  },
  insecticida: {
    ph_optimo: [5.0, 7.0],
    ph_limite: [7.0, 8.0],
    ph_critico: [8.0, 10],
    problema_alcalino: 'Los organofosforados (clorpirifos, metamidofos) son muy sensibles al pH alcalino â€” se hidrolizan rÃ¡pidamente. Los piretroides son moderadamente estables.',
    problema_tds: 'Baja-media. Algunos OP pueden precipitar con agua muy dura.',
    acidificante: true,
    sulfato_amonio: false,
    sensibilidad_tds: 'media',
    alerta_op: 'âš  Clorpirifos y otros OP: vida media de horas en agua alcalina. Usar buffer de pH es imprescindible.',
  },
  graminicida: {
    ph_optimo: [5.0, 7.0],
    ph_limite: [7.0, 8.0],
    ph_critico: [8.0, 10],
    problema_alcalino: 'Los graminicidas ACCasa (cletodim, haloxifop, quizalofop) se degradan en agua alcalina. La formulaciÃ³n EC es mÃ¡s sensible.',
    problema_tds: 'Media. El aceite metilado requerido para algunos graminicidas puede emulsionar mal con agua muy dura.',
    acidificante: false,
    sulfato_amonio: false,
    sensibilidad_tds: 'media',
    requiere_aceite: true,
  },
  foliar: {
    ph_optimo: [5.5, 6.5],
    ph_limite: [6.5, 7.5],
    ph_critico: [7.5, 10],
    problema_alcalino: 'El pH alcalino reduce la absorciÃ³n foliar de micronutrientes. La urea foliar requiere pH 5.5â€“6.5 para mÃ¡xima absorciÃ³n.',
    problema_tds: 'Alta para micronutrientes. El TDS elevado puede competir con la absorciÃ³n del nutriente aplicado.',
    acidificante: true,
    sulfato_amonio: false,
    sensibilidad_tds: 'media',
  },
};

function setFuente(el, fuente) {
  fuenteAgua = fuente;
  document.querySelectorAll('.fuente-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  // Prellenar valores tÃ­picos
  const f = FUENTES_PH[fuente];
  actualizarPH(f.ph);
  const phInput = document.getElementById('ph-slider') || document.getElementById('pa-ph');
  const tdsInput = document.getElementById('agua-tds') || document.getElementById('pa-tds');
  if (phInput) phInput.value = f.ph;
  if (tdsInput && (!tdsInput.value || parseInt(tdsInput.value, 10) === 500)) {
    tdsInput.value = f.tds;
  }
  calcularAgua();
}

function actualizarPH(val) {
  phActual = parseFloat(val);
  const display = document.getElementById('ph-display') || document.getElementById('pa-ph-num');
  const input = document.getElementById('ph-slider') || document.getElementById('pa-ph');
  if (display) display.textContent = phActual.toFixed(1);
  if (input) input.value = phActual;
  // Posicionar thumb (pH 4â€“10 = 0â€“100%)
  const pct = ((phActual - 4) / 6) * 100;
  const thumb = document.getElementById('ph-thumb') || document.getElementById('pa-ph-thumb');
  if (thumb) thumb.style.left = pct + '%';
  calcularAgua();
}

function actualizarPHManual(val) {
  const v = parseFloat(val);
  if (isNaN(v) || v < 4 || v > 10) return;
  actualizarPH(v);
}

function setProductoAgua(el, prod) {
  productoAgua = prod;
  document.querySelectorAll('.prod-chip').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  calcularAgua();
}

function sincronizarCE() {
  const ceEl = document.getElementById('agua-ce');
  const ce = parseFloat(ceEl ? ceEl.value : '');
  if (!isNaN(ce) && ce > 0) {
    // CE (ÂµS/cm) â‰ˆ TDS (ppm) Ã— 0.64 (factor empÃ­rico)
    const tds = Math.round(ce * 0.64);
    const tdsInput = document.getElementById('agua-tds') || document.getElementById('pa-tds');
    if (tdsInput) tdsInput.value = tds;
    calcularAgua();
  }
}

function calcDeltaT() {
  if (!STATE.meteo) return null;
  const T = STATE.meteo.temperature_2m;
  const Td = STATE.meteo.dew_point_2m;
  // AproximaciÃ³n: Tbh â‰ˆ T - (T - Td) / 3  (fÃ³rmula empÃ­rica Stull)
  const Tbh = T - (T - Td) / 3;
  return parseFloat((T - Tbh).toFixed(1));
}

function renderDeltaT() {
  const dt = calcDeltaT();
  const elVal = document.getElementById('deltat-val') || document.getElementById('pa-deltat-val');
  const elLabel = document.getElementById('deltat-label') || document.getElementById('pa-deltat-lbl');
  const cursor = document.getElementById('deltat-cursor') || document.getElementById('pa-deltat-cur');
  if (!elVal || !elLabel || !cursor) return;

  if (dt === null) {
    elVal.textContent = 'â€”';
    elLabel.textContent = 'Sin datos meteo Â· actualizÃ¡ GPS';
    return;
  }

  elVal.textContent = dt.toFixed(1) + 'Â°C';

  let color, label;
  if (dt < 8) {
    color = 'var(--ok)'; label = 'CondiciÃ³n Ã³ptima';
  } else if (dt < 10) {
    color = 'var(--caution)'; label = 'PrecauciÃ³n â€” evaporaciÃ³n elevada';
  } else {
    color = 'var(--red)'; label = 'No aplicar â€” pÃ©rdida severa de gotas';
  }
  elVal.style.color = color;
  elLabel.textContent = label;

  // Cursor: 0Â°C=0%, 10Â°C+=100%
  const pct = Math.min((dt / 12) * 100, 100);
  cursor.style.left = pct + '%';
}

function renderMeteoBadges() {
  if (!STATE.meteo) return;
  const v = STATE.meteo.wind_speed_10m;
  const hr = STATE.meteo.relative_humidity_2m;
  const dir = gradosADireccion(STATE.meteo.wind_direction_10m);

  const vientoVal = document.getElementById('agua-viento-val') || document.getElementById('pa-viento-val');
  if (vientoVal) vientoVal.textContent = v.toFixed(1);
  const vientoLabel = document.getElementById('agua-viento-label') || document.getElementById('pa-viento-lbl');
  if (vientoLabel) vientoLabel.textContent = 'km/h · ' + (v > 25 ? 'Excesivo' : v > 15 ? 'Moderado' : v < 3 ? 'Muy bajo' : 'Optimo');
  const vientoDir = document.getElementById('agua-viento-dir');
  if (vientoDir) vientoDir.textContent = 'Direccion: ' + dir;

  const hrVal = document.getElementById('agua-hr-val') || document.getElementById('pa-hr-val');
  if (hrVal) hrVal.textContent = hr;
  const hrLabel = document.getElementById('agua-hr-label') || document.getElementById('pa-hr-lbl');
  if (hrLabel) hrLabel.textContent = hr < 45 ? 'HR muy baja' : hr < 60 ? 'HR baja' : 'HR adecuada';

  renderDeltaT();
}

function calcularAgua() {
  const ph = phActual;
  const tdsEl = document.getElementById('agua-tds') || document.getElementById('pa-tds');
  const tds = parseFloat(tdsEl ? tdsEl.value : '') || 0;
  const prod = PRODUCTO_PH[productoAgua];
  if (!prod || !tdsEl) return;

  const recs = [];

  // â”€â”€ ANÃLISIS pH â”€â”€
  const [phOk1, phOk2] = prod.ph_optimo;
  const [phLim1, phLim2] = prod.ph_limite;
  const [phCrit1, phCrit2] = prod.ph_critico;

  let phEstado, phNivel;
  if (ph >= phOk1 && ph <= phOk2) {
    phEstado = 'ok';
    phNivel = 'ok';
    recs.push({
      nivel:'ok', icon:'âœ…',
      titulo:'pH Ã³ptimo (' + ph.toFixed(1) + ')',
      texto:'El pH del agua estÃ¡ dentro del rango ideal para ' + getProductoLabel() + '. No se requiere correcciÃ³n de pH.'
    });
  } else if (
    (ph > phOk2 && ph <= (prod.ph_critico[0] || 99)) ||
    (ph < phOk1 && ph >= 4)
  ) {
    phEstado = 'alerta'; phNivel = 'alerta';
    const correccion = ph > phOk2 ? 'reducir' : 'elevar';
    const target = ph > phOk2 ? phOk2 : phOk1;
    recs.push({
      nivel:'alerta', icon:'âš ï¸',
      titulo:'pH fuera del rango Ã³ptimo (' + ph.toFixed(1) + ')',
      texto:(prod.problema_alcalino || 'El pH actual puede reducir la eficacia del producto.') +
        ' RecomendaciÃ³n: usar acidificante/buffer para ' + correccion + ' el pH a ' + target + 'â€“' + phOk2 + '.'
    });
  } else {
    phEstado = 'critico'; phNivel = 'critico';
    recs.push({
      nivel:'critico', icon:'ðŸš¨',
      titulo:'pH crÃ­tico (' + ph.toFixed(1) + ') â€” correcciÃ³n urgente',
      texto:(prod.problema_alcalino || 'El pH actual compromete severamente la eficacia.') +
        ' Utilizar acidificante/buffer antes de agregar el fitosanitario. Target: pH ' + phOk1 + 'â€“' + phOk2 + '.'
    });
  }

  if (prod.alerta_ph_bajo && ph < 5.0) {
    recs.push({ nivel:'alerta', icon:'âš ï¸', titulo:'pH bajo â€” hidrÃ³lisis Ã¡cida', texto: prod.alerta_ph_bajo });
  }
  if (prod.alerta_op) {
    recs.push({ nivel:'critico', icon:'âš ï¸', titulo:'Organofosforado sensible al pH', texto: prod.alerta_op });
  }

  // â”€â”€ ANÃLISIS TDS â”€â”€
  if (prod.sensibilidad_tds === 'alta') {
    if (tds > 1000) {
      recs.push({
        nivel:'critico', icon:'ðŸ’§',
        titulo:'Agua muy dura (TDS ' + tds + ' ppm) â€” antagonismo severo',
        texto:'La alta concentraciÃ³n de CaÂ²âº y MgÂ²âº neutraliza el glifosato formando sales insolubles. ' +
          'Se recomienda sulfato de amonio al 2â€“3% (v/v) o 2â€“3 kg/100 L de caldo antes de agregar el herbicida.'
      });
    } else if (tds > 500) {
      recs.push({
        nivel:'alerta', icon:'ðŸ’§',
        titulo:'Agua moderadamente dura (TDS ' + tds + ' ppm)',
        texto:'Se recomienda sulfato de amonio al 1â€“2% para prevenir el antagonismo catiÃ³nico sobre el glifosato. ' +
          'Agregar el sulfato de amonio primero, dejar disolver, luego el herbicida.'
      });
    } else {
      recs.push({
        nivel:'ok', icon:'ðŸ’§',
        titulo:'Calidad de agua adecuada (TDS ' + tds + ' ppm)',
        texto:'El TDS no representa riesgo de antagonismo significativo para este producto.'
      });
    }
  } else if (prod.sensibilidad_tds === 'media' && tds > 800) {
    recs.push({
      nivel:'alerta', icon:'ðŸ’§',
      titulo:'TDS elevado (' + tds + ' ppm) â€” verificar emulsiÃ³n',
      texto:'Con agua muy dura, verificar que la formulaciÃ³n emulsione correctamente. Realizar prueba de jarrita antes de cargar el equipo.'
    });
  } else if (prod.sensibilidad_tds === 'baja') {
    recs.push({
      nivel:'info', icon:'ðŸ’§',
      titulo:'TDS ' + tds + ' ppm â€” sin riesgo para este producto',
      texto:'Los cationes disueltos no afectan significativamente la eficacia de este tipo de herbicida/fungicida.'
    });
  }

  if (prod.requiere_aceite) {
    recs.push({
      nivel:'info', icon:'ðŸ›¢',
      titulo:'Requiere aceite metilado de soja',
      texto:'Los graminicidas ACCasa necesitan aceite metilado de soja al 0.5â€“1% v/v para mejorar la absorciÃ³n cuticular. El agua dura puede afectar la calidad de la emulsiÃ³n â€” realizar prueba de jarrita.'
    });
  }

  // Renderizar recomendaciones agua
  const container = document.getElementById('agua-recs') || document.getElementById('pa-agua-recs');
  if (!container) return;
  container.innerHTML = recs.map(r => `
    <div class="rec-item ${r.nivel}">
      <div class="rec-icon">${r.icon}</div>
      <div class="rec-content">
        <div class="rec-titulo ${r.nivel}">${r.titulo}</div>
        <div class="rec-texto">${r.texto}</div>
      </div>
    </div>`).join('');

  // Badge semÃ¡foro
  const badge = document.getElementById('agua-semaforo-badge') || document.getElementById('pa-agua-badge');
  const hayCritico = recs.some(r => r.nivel === 'critico');
  const hayAlerta = recs.some(r => r.nivel === 'alerta');
  if (badge) badge.textContent = hayCritico ? 'ðŸ”´' : hayAlerta ? 'ðŸŸ¡' : 'ðŸŸ¢';

  // â”€â”€ ADYUVANTES â”€â”€
  calcularAdyuvantes(ph, tds, prod);
}

function calcularAdyuvantes(ph, tds, prod) {
  const dt = calcDeltaT();
  const viento = STATE.meteo ? STATE.meteo.wind_speed_10m : null;
  const hr = STATE.meteo ? STATE.meteo.relative_humidity_2m : null;
  const adyuvantes = [];

  // 1. Acidificante / buffer pH
  if (prod.acidificante && ph > 6.5) {
    const urgencia = ph > 8 ? 'imprescindible' : ph > 7.5 ? 'recomendado' : 'recomendado';
    adyuvantes.push({
      nombre: 'Acidificante / buffer pH',
      ejemplos: 'Ãcido cÃ­trico, RegulaidÂ®, AgriBufÂ®, CitrolaneÂ®',
      dosis: ph > 8 ? '300â€“500 cc/100 L' : '150â€“300 cc/100 L',
      prioridad: urgencia,
      razon: 'Corregir pH de ' + ph.toFixed(1) + ' â†’ 5.0â€“6.5 antes de agregar el fitosanitario',
      orden: 1,
    });
  }

  // 2. Sulfato de amonio
  if (prod.sulfato_amonio && tds > 300) {
    adyuvantes.push({
      nombre: 'Sulfato de amonio (SA)',
      ejemplos: '(NHâ‚„)â‚‚SOâ‚„ tÃ©cnico o formulado',
      dosis: tds > 800 ? '3 kg / 100 L caldo' : tds > 500 ? '2 kg / 100 L caldo' : '1â€“1.5 kg / 100 L caldo',
      prioridad: tds > 800 ? 'imprescindible' : 'recomendado',
      razon: 'Neutralizar antagonismo de CaÂ²âº/MgÂ²âº (TDS ' + tds + ' ppm). Agregar PRIMERO al agua.',
      orden: 0,
    });
  }

  // 3. Antievaporante segÃºn Delta T
  if (dt !== null) {
    if (dt >= 8) {
      adyuvantes.push({
        nombre: 'Antievaporante',
        ejemplos: 'ExtravonÂ®, CitowettÂ®, Vapor GardÂ® (cera de pino)',
        dosis: dt >= 10 ? '300â€“500 cc/100 L' : '200â€“300 cc/100 L',
        prioridad: dt >= 10 ? 'imprescindible' : 'recomendado',
        razon: 'Delta T ' + dt.toFixed(1) + 'Â°C â€” evaporaciÃ³n de gotas aumentada. ' +
          (dt >= 10 ? 'PÃ©rdida severa de producto antes del contacto foliar.' : 'Riesgo moderado de pÃ©rdida por evaporaciÃ³n.'),
        orden: 3,
      });
    }
  }

  // 4. Reductor de deriva segÃºn viento
  if (viento !== null && viento > 12) {
    adyuvantes.push({
      nombre: 'Reductor de deriva / engrosador de gota',
      ejemplos: 'AtplusÂ®, BondbreakerÂ®, BreakthruÂ® S240',
      dosis: '200â€“400 cc/100 L',
      prioridad: viento > 18 ? 'imprescindible' : 'recomendado',
      razon: 'Viento ' + viento.toFixed(1) + ' km/h â€” ' +
        (viento > 18 ? 'riesgo alto de deriva. Aumentar tamaÃ±o de gota es imprescindible.' : 'riesgo moderado de deriva. Complementar con boquilla antideriva.'),
      orden: 4,
    });
  }

  // 5. Surfactante / coadyuvante general
  if (productoAgua === 'graminicida') {
    adyuvantes.push({
      nombre: 'Aceite metilado de soja (FAME)',
      ejemplos: 'HastenÂ®, Soy Oil Methyl Ester, AssistÂ®',
      dosis: '0.5â€“1% v/v (500â€“1000 cc/100 L)',
      prioridad: 'imprescindible',
      razon: 'Los graminicidas ACCasa requieren aceite metilado para penetraciÃ³n cuticular eficaz.',
      orden: 2,
    });
  } else if (['glifosato','glifo_2bd','glifo_dicamba'].includes(productoAgua)) {
    adyuvantes.push({
      nombre: 'Coadyuvante no iÃ³nico / silicona',
      ejemplos: 'Silwet L-77Â®, Activator 90Â®, Silicone PlusÂ®',
      dosis: '100â€“200 cc/100 L',
      prioridad: 'opcional',
      razon: 'Mejora la cobertura y penetraciÃ³n del glifosato en condiciones de humedad baja o cutÃ­cula gruesa (malezas con cera).',
      orden: 5,
    });
  } else if (productoAgua === 'fungicida') {
    adyuvantes.push({
      nombre: 'Surfactante adherente',
      ejemplos: 'SticktiteÂ®, CodacideÂ®, AgralÂ®',
      dosis: '100â€“150 cc/100 L',
      prioridad: 'opcional',
      razon: 'Mejora la adhesiÃ³n del fungicida ante posibles lluvias leves o rocÃ­o post-aplicaciÃ³n.',
      orden: 5,
    });
  }

  // 6. HR muy baja â†’ recomendar horario
  if (hr !== null && hr < 50 && dt !== null && dt >= 6) {
    adyuvantes.push({
      nombre: 'â° CorrecciÃ³n de horario',
      ejemplos: 'No es un producto â€” es una decisiÃ³n operativa',
      dosis: 'Aplicar antes de las 10 hs o despuÃ©s de las 17 hs',
      prioridad: hr < 40 ? 'imprescindible' : 'recomendado',
      razon: 'HR ' + hr + '% + Delta T ' + dt.toFixed(1) + 'Â°C: condiciÃ³n crÃ­tica de evaporaciÃ³n. NingÃºn antievaporante compensa una aplicaciÃ³n al mediodÃ­a en estas condiciones.',
      orden: 6,
    });
  }

  // Ordenar por orden de aplicaciÃ³n
  adyuvantes.sort((a,b) => a.orden - b.orden);

  const container = document.getElementById('adyuvante-recs') || document.getElementById('pa-ady-recs');
  if (!container) return;
  if (!adyuvantes.length) {
    container.innerHTML = '<div class="rec-item ok"><div class="rec-icon">âœ…</div><div class="rec-content"><div class="rec-titulo ok">Sin adyuvantes adicionales requeridos</div><div class="rec-texto">Las condiciones actuales y el producto seleccionado no requieren adyuvantes especiales.</div></div></div>';
    const sem = document.getElementById('adyuvante-semaforo') || document.getElementById('pa-ady-sem');
    if (sem) sem.textContent = 'OK';
    return;
  }

  // Orden de agregado
  container.innerHTML = `
    <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(28,18,8,.38);margin-bottom:.8rem">
      Orden recomendado de agregado al tanque:
    </div>` +
    adyuvantes.map((a, i) => `
      <div class="adyuvante-row">
        <div>
          <div style="font-size:.65rem;color:rgba(28,18,8,.35);margin-bottom:.15rem">
            ${i+1}Â° agregar
          </div>
          <div class="adyuvante-nombre">${a.nombre}</div>
          <div style="font-size:.72rem;color:rgba(28,18,8,.5);margin-top:.15rem">${a.ejemplos}</div>
          <div style="font-size:.75rem;color:rgba(28,18,8,.6);margin-top:.2rem;line-height:1.4">${a.razon}</div>
        </div>
        <div class="adyuvante-dosis">${a.dosis}</div>
        <span class="adyuvante-tag ${a.prioridad}">${a.prioridad}</span>
      </div>`).join('');

  const tieneImprescindible = adyuvantes.some(a => a.prioridad === 'imprescindible');
  const sem = document.getElementById('adyuvante-semaforo') || document.getElementById('pa-ady-sem');
  if (sem) sem.textContent = tieneImprescindible ? 'Accion requerida' : 'Revisar';
}

function getProductoLabel() {
  const labels = {
    glifosato:'Glifosato', glifo_2bd:'Glifosato + 2,4-D', glifo_dicamba:'Glifosato + Dicamba',
    als:'ALS', fungicida:'Fungicida', insecticida:'Insecticida', graminicida:'Graminicida', foliar:'Fertilizante foliar'
  };
  return labels[productoAgua] || productoAgua;
}

// Llamar render meteo badges cuando llegan datos
const _origRender = typeof renderSemaforo === 'function' ? renderSemaforo : null;
function actualizarPanelAgua() {
  renderMeteoBadges();
  calcularAgua();
}


// â•â•â• MOTOR DE COBERTURA â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FÃ³rmula central: L/ha = (VMDÂ³ Ã— N Ã— Ï€) / (6 Ã— 10â·)
// Fuente: Leiva P.D. (INTA), FAO, Mathews G.A.

// â”€â”€ Base de boquillas ISO â”€â”€
// VMD a 3 bar para boquilla XR (abanico estÃ¡ndar)
// Factor de correcciÃ³n por tipo: TTI Ã—1.6, Twin Ã—1.1, HC Ã—0.85
const ISO_BOQUILLAS = [
  { iso:'005', nombre:'005 PÃºrpura',  color:'#7B2D8B', caudal_3bar:0.20, vmd_xr:130 },
  { iso:'0075',nombre:'0075 Rosa',   color:'#E75480', caudal_3bar:0.30, vmd_xr:145 },
  { iso:'01', nombre:'01 Naranja',   color:'#E8721A', caudal_3bar:0.40, vmd_xr:155 },
  { iso:'015',nombre:'015 Verde',    color:'#2E8B57', caudal_3bar:0.60, vmd_xr:170 },
  { iso:'02', nombre:'02 Amarillo',  color:'#DAA520', caudal_3bar:0.80, vmd_xr:200 },
  { iso:'025',nombre:'025 Lila',     color:'#9370DB', caudal_3bar:1.00, vmd_xr:230 },
  { iso:'03', nombre:'03 Azul',      color:'#1E5799', caudal_3bar:1.20, vmd_xr:260 },
  { iso:'04', nombre:'04 Rojo',      color:'#C0392B', caudal_3bar:1.60, vmd_xr:320 },
  { iso:'05', nombre:'05 MarrÃ³n',    color:'#7B5B3A', caudal_3bar:2.00, vmd_xr:380 },
  { iso:'06', nombre:'06 Gris',      color:'#607B8B', caudal_3bar:2.40, vmd_xr:440 },
  { iso:'08', nombre:'08 Blanco',    color:'#AAB8C2', caudal_3bar:3.20, vmd_xr:520 },
];

const TIPO_BOQUILLA_FACTOR_VMD = {
  xr: 1.0, tti: 1.65, twin: 1.10, hc: 0.85
};
const TIPO_BOQUILLA_FACTOR_CAUDAL_PRESION = {
  // caudal âˆ âˆš(P/P_ref)  â€” P_ref = 3 bar
  xr: 1.0, tti: 1.0, twin: 1.0, hc: 1.0
};

// Impactos objetivo por tipo de producto (FAO / INTA)
const IMPACTOS_OBJETIVO = {
  herb_sistemico:  { min:20, max:30,  cv:30, label:'Herbicida sistÃ©mico' },
  herb_contacto:   { min:30, max:40,  cv:30, label:'Herbicida contacto' },
  fung_sistemico:  { min:20, max:30,  cv:70, label:'Fungicida sistÃ©mico' },
  fung_contacto:   { min:50, max:70,  cv:70, label:'Fungicida contacto' },
  insect_sistemico:{ min:20, max:30,  cv:70, label:'Insecticida sistÃ©mico' },
  insect_contacto: { min:30, max:50,  cv:70, label:'Insecticida contacto' },
};

// VMD recomendado por tipo
const VMD_RECOMENDADO = {
  herb_sistemico:  { min:300, max:400, ideal:350 },
  herb_contacto:   { min:200, max:300, ideal:250 },
  fung_sistemico:  { min:200, max:325, ideal:250 },
  fung_contacto:   { min:150, max:250, ideal:200 },
  insect_sistemico:{ min:250, max:350, ideal:300 },
  insect_contacto: { min:150, max:250, ideal:200 },
};

// Factor de correcciÃ³n de cobertura por blanco
const FACTOR_BLANCO = {
  hoja_plana:     { factor:1.0, nota:'Hoja plana: cobertura directa sin penalizaciÃ³n.' },
  hoja_erecta:    { factor:0.75, nota:'Hoja erecta: Ã¡ngulo reduce cobertura ~25%. Considerar mayor volumen o velocidad reducida.' },
  'maleza_pequeÃ±a': { factor:1.0, nota:'Maleza pequeÃ±a: cobertura total del Ã¡rea objetivo.' },
  maleza_grande:  { factor:0.65, nota:'Maleza desarrollada: penetraciÃ³n en canopeo reduce cobertura ~35%. Bajar VMD.' },
  suelo:          { factor:1.0, nota:'Suelo/pre-emergente: cobertura directa.' },
};

// ClasificaciÃ³n VMD segÃºn ASABE S-572
function clasificarVMD(vmd) {
  if (vmd < 136) return { clase:'Extremadamente fino', color:'#3498db', deriva:'Muy alta â€” riesgo severo', code:'XF' };
  if (vmd < 177) return { clase:'Muy fino',             color:'#5dade2', deriva:'Alta â€” precauciÃ³n',       code:'VF' };
  if (vmd < 218) return { clase:'Fino',                 color:'#2ecc71', deriva:'Moderada',                code:'F' };
  if (vmd < 349) return { clase:'Medio',                color:'#27ae60', deriva:'Baja â€” condiciÃ³n Ã³ptima', code:'M' };
  if (vmd < 428) return { clase:'Grueso',               color:'#f39c12', deriva:'Muy baja',                code:'C' };
  if (vmd < 622) return { clase:'Muy grueso',           color:'#e67e22', deriva:'MÃ­nima',                  code:'VC' };
  return              { clase:'Extremadamente grueso', color:'#e74c3c', deriva:'Nula â€” cobertura limitada', code:'XC' };
}

// â”€â”€ FÃ“RMULA CENTRAL â”€â”€
// L/ha = (VMDÂ³ Ã— N Ã— Ï€) / (6 Ã— 10â·)
function calcLHaDesdeVMDyN(vmd, n) {
  return (Math.pow(vmd, 3) * n * Math.PI) / (6e7);
}
// N gotas/cmÂ² = (L/ha Ã— 6Ã—10â·) / (VMDÂ³ Ã— Ï€)
function calcNDesdeVMDyLha(vmd, lha) {
  return (lha * 6e7) / (Math.pow(vmd, 3) * Math.PI);
}
// Cobertura % = N Ã— Ï€ Ã— (VMD/2)Â² / 10â¸  (Ã¡rea de cada gota sobre 1 cmÂ²)
function calcCoberturaPct(n, vmd) {
  const r_cm = (vmd / 2) * 1e-4; // micrones a cm
  return Math.min(n * Math.PI * r_cm * r_cm * 100, 100);
}

// â”€â”€ AJUSTE AMBIENTAL DEL VMD â”€â”€
// Delta T alto â†’ evaporaciÃ³n en vuelo â†’ VMD efectivo aumenta (gota se hace mÃ¡s pequeÃ±a = llega mÃ¡s chica)
// Viento alto â†’ fragmentaciÃ³n adicional â†’ VMD efectivo disminuye
function calcVMDEfectivo(vmdNominal) {
  if (!STATE.meteo) return { vmdEf: vmdNominal, factorDT: 1.0, factorViento: 1.0, nota: null };

  const dt = calcDeltaT ? calcDeltaT() : null;
  const viento = STATE.meteo.wind_speed_10m;

  let factorDT = 1.0;
  let factorViento = 1.0;
  let notas = [];

  if (dt !== null) {
    if (dt > 10)      { factorDT = 0.82; notas.push(`âš  Delta T ${dt.toFixed(1)}Â°C: evaporaciÃ³n severa en vuelo â†’ VMD efectivo -18%`); }
    else if (dt > 8)  { factorDT = 0.90; notas.push(`âš  Delta T ${dt.toFixed(1)}Â°C: evaporaciÃ³n moderada â†’ VMD efectivo -10%`); }
    else if (dt > 5)  { factorDT = 0.95; notas.push(`â„¹ Delta T ${dt.toFixed(1)}Â°C: evaporaciÃ³n leve â†’ VMD efectivo -5%`); }
  }
  if (viento > 20)    { factorViento = 0.88; notas.push(`âš  Viento ${viento.toFixed(1)} km/h: fragmentaciÃ³n de gotas â†’ VMD efectivo -12%`); }
  else if (viento > 12){ factorViento = 0.94; notas.push(`â„¹ Viento ${viento.toFixed(1)} km/h: leve fragmentaciÃ³n â†’ VMD efectivo -6%`); }

  const vmdEf = Math.round(vmdNominal * factorDT * factorViento);
  return { vmdEf, factorDT, factorViento, nota: notas.join('<br>') };
}

// â”€â”€ CAUDAL DEL PICO segÃºn boquilla, presiÃ³n â”€â”€
// Q âˆ âˆš(P/P_ref)  â†’  Q(P) = Q_ref Ã— âˆš(P/3)
function calcCaudalPico(iso, presion, tipoBoquilla) {
  const bq = ISO_BOQUILLAS.find(b => b.iso === iso);
  if (!bq) return 0;
  return bq.caudal_3bar * Math.sqrt(presion / 3);
}

// VMD a presiÃ³n dada: VMD âˆ P^(-0.3) (empÃ­rico, Spraying Systems)
function calcVMDaPrension(vmdRef, presionRef, presionTrabajo) {
  return Math.round(vmdRef * Math.pow(presionRef / presionTrabajo, 0.3));
}

// â”€â”€ ESTADO MODO â”€â”€
let cobModo = 'a';
let tipoBoquillaSelec = 'xr';
let isoBoquillaSelec = '02';

function setCobModo(modo, el) {
  cobModo = modo;
  document.querySelectorAll('.cob-modo-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('cob-modo-a').style.display = modo === 'a' ? '' : 'none';
  document.getElementById('cob-modo-b').style.display = modo === 'b' ? '' : 'none';
  if (modo === 'b') { renderISOSelector(); calcularModoB(); }
}

function actualizarObjetivo() {
  if (!document.getElementById('cob-tipo-producto')) return;
  const tipo = document.getElementById('cob-tipo-producto').value;
  const obj = IMPACTOS_OBJETIVO[tipo];
  const vmdRec = VMD_RECOMENDADO[tipo];
  if (!obj) return;

  // Ajustar slider al valor medio recomendado
  const midImpactos = Math.round((obj.min + obj.max) / 2);
  document.getElementById('cob-impactos-slider').value = midImpactos;
  document.getElementById('cob-impactos-display').textContent = midImpactos;

  document.getElementById('cob-impactos-ref').innerHTML =
    `FAO/INTA: <strong>${obj.min}â€“${obj.max} gotas/cmÂ²</strong> Â· CV â‰¤ ${obj.cv}% Â· ` +
    `VMD recomendado: <strong>${vmdRec.min}â€“${vmdRec.max} Âµm</strong>`;

  // Ajustar VMD selector al ideal
  const vmdSel = document.getElementById('cob-vmd-objetivo');
  const opciones = Array.from(vmdSel.options).map(o => parseInt(o.value));
  const closest = opciones.reduce((a, b) => Math.abs(b - vmdRec.ideal) < Math.abs(a - vmdRec.ideal) ? b : a);
  vmdSel.value = closest;

  calcularCobertura();
}

function calcularCobertura() {
  const tipo = document.getElementById('cob-tipo-producto').value;
  const impactosObj = parseInt(document.getElementById('cob-impactos-slider').value);
  const vmdNominal = parseInt(document.getElementById('cob-vmd-objetivo').value);
  const velocidad = parseFloat(document.getElementById('cob-velocidad').value) || 20;
  const distPicos = parseFloat(document.getElementById('cob-dist-picos').value) || 0.525;
  const blanco = document.getElementById('cob-blanco').value;

  const { vmdEf, nota } = calcVMDEfectivo(vmdNominal);
  const factorBlanco = FACTOR_BLANCO[blanco].factor;
  const obj = IMPACTOS_OBJETIVO[tipo];

  // CÃ¡lculo central
  const lhaRequerido = calcLHaDesdeVMDyN(vmdEf, impactosObj / factorBlanco);
  const impactosLogrados = Math.round(calcNDesdeVMDyLha(vmdEf, lhaRequerido) * factorBlanco);
  const cobPct = calcCoberturaPct(impactosLogrados, vmdEf).toFixed(1);
  const vmdInfo = clasificarVMD(vmdEf);

  // Caudal necesario por pico: Q(L/min) = L/ha Ã— velocidad(km/h) Ã— distPicos(m) / 600
  const caudalPico = (lhaRequerido * velocidad * distPicos) / 600;

  // Boquilla recomendada: buscar la ISO cuyo caudal a 2.5 bar sea mÃ¡s cercano
  const presionTrabajo = 2.5;
  let boquillaRec = null;
  let menorDiff = Infinity;
  ISO_BOQUILLAS.forEach(b => {
    const q = b.caudal_3bar * Math.sqrt(presionTrabajo / 3);
    const vmdAPresion = calcVMDaPrension(b.vmd_xr, 3, presionTrabajo);
    if (Math.abs(q - caudalPico) < menorDiff && vmdAPresion <= vmdNominal * 1.15) {
      menorDiff = Math.abs(q - caudalPico);
      boquillaRec = { ...b, qTrabajo: q, vmdTrabajo: vmdAPresion };
    }
  });

  // Actualizar UI valores
  const elLha = document.getElementById('res-lha');
  elLha.textContent = lhaRequerido.toFixed(1);
  elLha.className = 'cob-stat-val ' + (lhaRequerido < 30 ? 'warn' : lhaRequerido > 150 ? 'warn' : 'ok');

  document.getElementById('res-vmd-ef').textContent = vmdEf;
  document.getElementById('res-impactos-logrados').textContent = impactosLogrados;
  document.getElementById('res-cobertura-pct').textContent = cobPct;

  // VMD barra
  const pctBarra = Math.min(((vmdEf - 100) / 500) * 100, 100);
  document.getElementById('vmd-cursor').style.left = Math.max(pctBarra, 2) + '%';
  const badge = document.getElementById('vmd-clase-badge');
  badge.textContent = vmdInfo.clase + ' (' + vmdInfo.code + ')';
  badge.style.background = vmdInfo.color + '22';
  badge.style.color = vmdInfo.color;
  badge.style.border = '1px solid ' + vmdInfo.color + '44';

  document.getElementById('vmd-derivabilidad').innerHTML =
    `<div style="font-size:.78rem;color:rgba(28,18,8,.65);line-height:1.5">
      <strong>Riesgo de deriva:</strong> ${vmdInfo.deriva}
    </div>`;

  // Veredicto
  const cumple = impactosLogrados >= obj.min;
  const excelente = impactosLogrados >= obj.max;
  const veredicto = document.getElementById('cob-veredicto-a');
  if (excelente) {
    veredicto.innerHTML = `<div class="cob-veredicto-icon">âœ…</div><div><div class="cob-veredicto-titulo" style="color:#6DBF82">Cobertura excelente</div><div class="cob-veredicto-texto">Con ${lhaRequerido.toFixed(0)} L/ha y VMD ${vmdEf} Âµm logrÃ¡s ${impactosLogrados} gotas/cmÂ² â€” supera el objetivo FAO de ${obj.min}â€“${obj.max} gotas/cmÂ² para ${obj.label.toLowerCase()}. ${FACTOR_BLANCO[blanco].nota}</div></div>`;
  } else if (cumple) {
    veredicto.innerHTML = `<div class="cob-veredicto-icon">âœ…</div><div><div class="cob-veredicto-titulo" style="color:#6DBF82">Cobertura adecuada</div><div class="cob-veredicto-texto">Con ${lhaRequerido.toFixed(0)} L/ha y VMD ${vmdEf} Âµm logrÃ¡s ${impactosLogrados} gotas/cmÂ² â€” dentro del rango FAO. ${FACTOR_BLANCO[blanco].nota}</div></div>`;
  } else {
    veredicto.innerHTML = `<div class="cob-veredicto-icon">âš ï¸</div><div><div class="cob-veredicto-titulo" style="color:#E8B84B">Cobertura insuficiente</div><div class="cob-veredicto-texto">Con estos parÃ¡metros solo logrÃ¡s ${impactosLogrados} gotas/cmÂ², por debajo del mÃ­nimo FAO de ${obj.min} para ${obj.label.toLowerCase()}. AumentÃ¡ el L/ha o reducÃ­ el VMD.</div></div>`;
  }

  // Ajuste ambiental
  const ajusteBody = document.getElementById('cob-ajuste-body');
  if (nota) {
    ajusteBody.innerHTML = `<div class="ajuste-ambiental">${nota}</div>
      <div style="font-size:.78rem;color:rgba(28,18,8,.6);margin-top:.7rem;line-height:1.55">
        VMD nominal: <strong>${vmdNominal} Âµm</strong> â†’ VMD efectivo en campo: <strong>${vmdEf} Âµm</strong>
      </div>`;
  } else {
    ajusteBody.innerHTML = `<div class="rec-item ok"><div class="rec-icon">âœ…</div><div class="rec-content"><div class="rec-titulo ok">Condiciones sin correcciÃ³n significativa</div><div class="rec-texto">Las condiciones ambientales actuales no modifican el VMD nominal de manera importante.</div></div></div>`;
  }

  // Boquilla recomendada
  if (boquillaRec) {
    document.getElementById('cob-boquilla-rec').innerHTML = `
      <div class="boquilla-rec-card">
        <div class="boquilla-rec-color-block" style="background:${boquillaRec.color}">
          ISO<br>${boquillaRec.iso}
        </div>
        <div class="boquilla-rec-info">
          <div class="nombre">${boquillaRec.nombre}</div>
          <div class="detalle">
            Caudal a ${presionTrabajo} bar: <strong>${boquillaRec.qTrabajo.toFixed(2)} L/min</strong><br>
            VMD tÃ­pico a ${presionTrabajo} bar: <strong>${boquillaRec.vmdTrabajo} Âµm</strong><br>
            Rango de trabajo: <strong>1.5â€“4 bar</strong>
          </div>
        </div>
      </div>
      <p style="font-size:.75rem;color:rgba(28,18,8,.55);line-height:1.5;margin-top:.3rem">
        RecomendaciÃ³n para boquilla tipo XR. Para TTI/AI el VMD aumenta ~65% â€” usar si viento > 12 km/h.
      </p>`;
  }

  // Tabla parÃ¡metros
  const presRec = (caudalPico / (boquillaRec ? boquillaRec.caudal_3bar : 1)) ** 2 * 3;
  document.getElementById('cob-params-tabla').innerHTML = `
    <table class="params-table">
      <thead><tr><th>ParÃ¡metro</th><th>Valor recomendado</th><th>Fundamento</th><th class="status-col">Estado</th></tr></thead>
      <tbody>
        <tr><td>Caudal L/ha</td><td class="val-col">${lhaRequerido.toFixed(1)} L/ha</td><td>Para lograr ${impactosObj} gotas/cmÂ² con VMD ${vmdEf} Âµm</td><td class="status-col"><span class="tag ${lhaRequerido<20||lhaRequerido>150?'amarillo':'verde'}">${lhaRequerido<20?'Muy bajo':lhaRequerido>150?'Alto':'Ã“ptimo'}</span></td></tr>
        <tr><td>VMD objetivo</td><td class="val-col">${vmdNominal} Âµm</td><td>Clase ${vmdInfo.clase} â€” ${vmdInfo.deriva.toLowerCase()}</td><td class="status-col"><span class="tag verde">${vmdInfo.code}</span></td></tr>
        <tr><td>VMD efectivo campo</td><td class="val-col">${vmdEf} Âµm</td><td>Corregido por Delta T y viento</td><td class="status-col"><span class="tag ${vmdEf < 150?'rojo':vmdEf < 200?'amarillo':'verde'}">${vmdEf < 150?'Deriva alta':vmdEf < 200?'PrecauciÃ³n':'OK'}</span></td></tr>
        <tr><td>Velocidad de avance</td><td class="val-col">${velocidad} km/h</td><td>Caudal por pico: ${caudalPico.toFixed(2)} L/min</td><td class="status-col"><span class="tag ${velocidad>25?'amarillo':'verde'}">${velocidad>25?'Revisar':'OK'}</span></td></tr>
        <tr><td>PresiÃ³n estimada</td><td class="val-col">${presRec.toFixed(1)} bar</td><td>Con boquilla ${boquillaRec ? boquillaRec.nombre : 'â€”'}</td><td class="status-col"><span class="tag ${presRec<1?'rojo':presRec>5?'amarillo':'verde'}">${presRec<1?'Muy baja':presRec>5?'Alta':'OK'}</span></td></tr>
        <tr><td>Cobertura foliar</td><td class="val-col">${cobPct}%</td><td>Ãrea cubierta por gotas sobre el blanco</td><td class="status-col"><span class="tag ${parseFloat(cobPct)<10?'rojo':parseFloat(cobPct)<25?'amarillo':'verde'}">${parseFloat(cobPct)<10?'Baja':parseFloat(cobPct)<25?'Moderada':'Buena'}</span></td></tr>
      </tbody>
    </table>`;
}

// â”€â”€ MODO B â”€â”€
function renderISOSelector() {
  const container = document.getElementById('iso-selector-b');
  if (!container) return;
  container.innerHTML = ISO_BOQUILLAS.map(b => `
    <div class="boquilla-chip ${b.iso === isoBoquillaSelec ? 'active' : ''}"
      onclick="setISO(this,'${b.iso}')">
      <div class="boquilla-color" style="background:${b.color}"></div>
      <div class="boquilla-nombre">${b.iso}</div>
      <div class="boquilla-caudal">${b.caudal_3bar} L/min</div>
    </div>`).join('');
}

function setISO(el, iso) {
  isoBoquillaSelec = iso;
  document.querySelectorAll('#iso-selector-b .boquilla-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const bq = ISO_BOQUILLAS.find(b => b.iso === iso);
  if (bq) document.getElementById('cob-b-presion-hint').textContent =
    `Caudal nominal a 3 bar: ${bq.caudal_3bar} L/min Â· Rango tÃ­pico: 1.5â€“4 bar`;
  calcularModoB();
}

function setTipoBoquilla(el, tipo) {
  tipoBoquillaSelec = tipo;
  document.querySelectorAll('#tipo-boquilla-grid .tipo-boquilla-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  calcularModoB();
}

function calcularModoB() {
  const iso = isoBoquillaSelec;
  const tipo = tipoBoquillaSelec;
  const velocidad = parseFloat(document.getElementById('cob-b-velocidad').value) || 20;
  const lha = parseFloat(document.getElementById('cob-b-lha').value) || 80;
  const presion = parseFloat(document.getElementById('cob-b-presion').value) || 2.5;
  const tipoAplicacion = document.getElementById('cob-b-tipo').value;

  const bq = ISO_BOQUILLAS.find(b => b.iso === iso);
  if (!bq) return;

  const factorVMD = TIPO_BOQUILLA_FACTOR_VMD[tipo] || 1.0;
  const vmdNominal = Math.round(calcVMDaPrension(bq.vmd_xr * factorVMD, 3, presion));
  const { vmdEf } = calcVMDEfectivo(vmdNominal);

  const impactos = Math.round(calcNDesdeVMDyLha(vmdEf, lha));
  const caudalPico = (lha * velocidad * 0.525) / 600;
  const obj = IMPACTOS_OBJETIVO[tipoAplicacion];

  document.getElementById('b-vmd').textContent = vmdEf;
  document.getElementById('b-impactos').textContent = impactos;
  document.getElementById('b-impactos').className = 'cob-stat-val ' + (impactos >= obj.min ? 'ok' : 'danger');
  document.getElementById('b-objetivo').textContent = obj.min + 'â€“' + obj.max;
  document.getElementById('b-caudal-pico').textContent = caudalPico.toFixed(2);

  const vmdInfo = clasificarVMD(vmdEf);
  const cumple = impactos >= obj.min;
  const excede = impactos >= obj.max;

  const verd = document.getElementById('cob-veredicto-b');
  if (excede) {
    verd.innerHTML = `<div class="cob-veredicto-icon">âœ…</div><div><div class="cob-veredicto-titulo" style="color:#6DBF82">ConfiguraciÃ³n excelente</div><div class="cob-veredicto-texto">Tu equipo logra ${impactos} gotas/cmÂ² con VMD ${vmdEf} Âµm â€” supera el objetivo FAO para ${obj.label.toLowerCase()}.</div></div>`;
  } else if (cumple) {
    verd.innerHTML = `<div class="cob-veredicto-icon">âœ…</div><div><div class="cob-veredicto-titulo" style="color:#6DBF82">ConfiguraciÃ³n adecuada</div><div class="cob-veredicto-texto">Tu equipo logra ${impactos} gotas/cmÂ² â€” dentro del rango FAO de ${obj.min}â€“${obj.max} para ${obj.label.toLowerCase()}.</div></div>`;
  } else {
    const lhaNeeded = calcLHaDesdeVMDyN(vmdEf, obj.min).toFixed(0);
    verd.innerHTML = `<div class="cob-veredicto-icon">ðŸš«</div><div><div class="cob-veredicto-titulo" style="color:#E8604A">Cobertura insuficiente</div><div class="cob-veredicto-texto">Solo logrÃ¡s ${impactos} gotas/cmÂ² (mÃ­nimo: ${obj.min}). Para alcanzar el objetivo necesitÃ¡s <strong>${lhaNeeded} L/ha</strong> con este VMD, o reducir el tamaÃ±o de gota.</div></div>`;
  }

  const cobPct = calcCoberturaPct(impactos, vmdEf).toFixed(1);
  document.getElementById('cob-b-analisis').innerHTML = `
    <div class="rec-item ${cumple?'ok':'critico'}">
      <div class="rec-icon">${cumple?'âœ…':'ðŸš«'}</div>
      <div class="rec-content">
        <div class="rec-titulo ${cumple?'ok':'critico'}">
          ${impactos} gotas/cmÂ² Â· Clase de gota: ${vmdInfo.clase}
        </div>
        <div class="rec-texto">
          Cobertura foliar estimada: <strong>${cobPct}%</strong><br>
          Deriva: <strong>${vmdInfo.deriva}</strong><br>
          ${!cumple ? `âš  Para alcanzar ${obj.min} gotas/cmÂ² necesitÃ¡s aumentar L/ha a <strong>${calcLHaDesdeVMDyN(vmdEf, obj.min).toFixed(0)} L/ha</strong> o reducir el VMD.` : ''}
        </div>
      </div>
    </div>
    <div style="font-size:.75rem;color:rgba(28,18,8,.5);margin-top:.8rem;line-height:1.6;padding:.7rem 1rem;background:rgba(28,18,8,.04);border-radius:10px">
      <strong>FÃ³rmula:</strong> N = (L/ha Ã— 6Ã—10â·) / (VMDÂ³ Ã— Ï€)<br>
      Con L/ha=${lha}, VMD efectivo=${vmdEf} Âµm â†’ <strong>${impactos} gotas/cmÂ²</strong>
    </div>`;
}

// Llamar cuando lleguen datos meteo
function actualizarMotorCobertura() {
  if (cobModo === 'a') calcularCobertura();
  else calcularModoB();
}


// â•â•â• TARJETA HIDROSENSIBLE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let thsGotas = [];
let thsTamano = 7; // radio en px del canvas
let thsModo = 'simulacion';
const THS_CANVAS_CM = 1; // representa 1 cmÂ²
const THS_DPI_EQUIV = 96;

function setThsSize(el, size) {
  thsTamano = size;
  document.querySelectorAll('.ths-size-dot').forEach(d => d.classList.remove('active'));
  el.classList.add('active');
}

function thsClickGota(e) {
  const canvas = document.getElementById('ths-canvas');
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  thsAgregarGota(x, y);
}

function thsTouchGota(e) {
  e.preventDefault();
  const canvas = document.getElementById('ths-canvas');
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  Array.from(e.touches).forEach(t => {
    const x = (t.clientX - rect.left) * scaleX;
    const y = (t.clientY - rect.top) * scaleY;
    thsAgregarGota(x, y);
  });
}

function thsAgregarGota(x, y) {
  // Radio variable Â± 20% para simular variabilidad natural
  const radio = thsTamano * (0.85 + Math.random() * 0.3);
  thsGotas.push({ x, y, r: radio });
  thsRenderCanvas();
  thsActualizarStats();
}

function thsRenderCanvas() {
  const canvas = document.getElementById('ths-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Fondo papel hidrosensible amarillo
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(0, 0, W, H);

  // Grid de referencia (1mm = ~4px equivalente)
  ctx.strokeStyle = 'rgba(180,160,80,.2)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Escala 1 cmÂ² box
  ctx.strokeStyle = 'rgba(150,130,60,.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, 96, 96);
  ctx.fillStyle = 'rgba(150,130,60,.6)';
  ctx.font = '10px DM Mono, monospace';
  ctx.fillText('1 cmÂ²', 14, 22);

  // Gotas azul-Ã­ndigo
  thsGotas.forEach(g => {
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30,80,180,.75)';
    ctx.fill();
    // Borde claro
    ctx.strokeStyle = 'rgba(80,130,220,.4)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  });

  // Contador en esquina
  const gotasCm2 = thsContarGotasCm2();
  ctx.fillStyle = 'rgba(28,18,8,.7)';
  ctx.font = 'bold 13px DM Sans, sans-serif';
  ctx.fillText(`${gotasCm2} g/cmÂ²`, W - 90, H - 12);
}

function thsContarGotasCm2() {
  // Cuenta gotas dentro del cuadrado de 96Ã—96px = 1cmÂ² de referencia
  return thsGotas.filter(g => g.x >= 10 && g.x <= 106 && g.y >= 10 && g.y <= 106).length;
}

function thsActualizarStats() {
  const n = thsContarGotasCm2();
  // VMD estimado: el radio en px â†’ escala a micrones (96px = 1cm, 10000Âµm/cm)
  const avgRadio = thsTamano; // px
  const vmdEstimado = Math.round((avgRadio / 96) * 10000 * 0.5); // diÃ¡metro en Âµm
  // L/ha estimado
  const lhaEst = ((Math.pow(vmdEstimado, 3) * n * Math.PI) / 6e7).toFixed(1);
  // Cobertura
  const r_cm = (vmdEstimado / 2) * 1e-4;
  const cobPct = Math.min(n * Math.PI * r_cm * r_cm * 100, 100).toFixed(1);

  document.getElementById('ths-impactos').textContent = n;
  document.getElementById('ths-vmd-est').textContent = vmdEstimado > 0 ? vmdEstimado + '' : 'â€”';
  document.getElementById('ths-cobertura').textContent = cobPct + '%';
  document.getElementById('ths-lha-est').textContent = lhaEst > 0 ? lhaEst : 'â€”';

  evaluarTarjeta();
}

function evaluarTarjeta() {
  const n = thsModo === 'real'
    ? parseInt(document.getElementById('ths-real-impactos').value) || 0
    : thsContarGotasCm2();
  const tipo = document.getElementById('ths-tipo-eval').value;
  const obj = IMPACTOS_OBJETIVO[tipo];
  if (!obj || n === 0) return;

  const cumple = n >= obj.min;
  const excede = n >= obj.max;
  const pct = Math.round((n / obj.min) * 100);

  const barColor = excede ? 'var(--ok)' : cumple ? '#6DBF82' : n > obj.min * 0.7 ? 'var(--caution)' : 'var(--red)';
  const barW = Math.min(pct, 100);

  // Calcular clases fuera del template
  const claseItem = excede ? 'ok' : cumple ? 'ok' : n > obj.min * 0.7 ? 'alerta' : 'critico';
  const iconoItem = excede ? 'âœ…' : cumple ? 'âœ…' : n > obj.min * 0.7 ? 'âš ï¸' : 'ðŸš«';
  const tituloItem = excede ? 'Cobertura excelente' : cumple ? 'Cobertura adecuada' : n > obj.min * 0.7 ? 'Cobertura marginal' : 'Cobertura insuficiente';
  const textoItem = n + ' gotas/cmÂ² Â· Objetivo FAO: ' + obj.min + 'â€“' + obj.max + ' para ' + obj.label.toLowerCase() + '.' + (!cumple ? ' NecesitÃ¡s aumentar el caudal o reducir el VMD.' : '');

  document.getElementById('ths-evaluacion').innerHTML =
    '<div style="margin-bottom:.8rem">' +
    '<div style="display:flex;justify-content:space-between;font-size:.72rem;color:rgba(28,18,8,.5);margin-bottom:.3rem">' +
    '<span>0</span><span>MÃ­n: ' + obj.min + '</span><span>Ã“ptimo: ' + obj.max + '</span></div>' +
    '<div style="height:10px;background:rgba(28,18,8,.08);border-radius:5px;overflow:hidden">' +
    '<div style="height:100%;width:' + barW + '%;background:' + barColor + ';border-radius:5px;transition:width .5s"></div></div>' +
    '<div style="font-size:.72rem;color:rgba(28,18,8,.45);margin-top:.25rem;text-align:right">' + n + ' de ' + obj.min + ' mÃ­nimos (' + pct + '%)</div></div>' +
    '<div class="rec-item ' + claseItem + '">' +
    '<div class="rec-icon">' + iconoItem + '</div>' +
    '<div class="rec-content">' +
    '<div class="rec-titulo ' + claseItem + '">' + tituloItem + '</div>' +
    '<div class="rec-texto">' + textoItem + '</div>' +
    '</div></div>';

  const verd = document.getElementById('ths-veredicto');
  const verdTitulo = excede ? 'AplicaciÃ³n excelente' : cumple ? 'AplicaciÃ³n correcta' : n > obj.min * 0.7 ? 'Revisar parÃ¡metros' : 'AplicaciÃ³n deficiente';
  verd.innerHTML =
    '<div style="font-size:1.4rem">' + iconoItem + '</div>' +
    '<div><div style="font-family:\'DM Serif Display\',serif;font-size:1rem;margin-bottom:.2rem">' + verdTitulo + '</div>' +
    '<div style="font-size:.78rem;color:rgba(255,253,248,.55)">' + n + ' gotas/cmÂ² Â· ' + pct + '% del objetivo FAO</div></div>';

  const ajDiv = document.getElementById('ths-ajustes');
  if (cumple) {
    ajDiv.innerHTML = '<div class="rec-item ok"><div class="rec-icon">âœ…</div><div class="rec-content"><div class="rec-titulo ok">Sin ajustes necesarios</div><div class="rec-texto">La cobertura lograda cumple con los estÃ¡ndares FAO/INTA para este tipo de aplicaciÃ³n.</div></div></div>';
  } else {
    ajDiv.innerHTML =
      '<div class="rec-item alerta"><div class="rec-icon">âš ï¸</div><div class="rec-content"><div class="rec-titulo alerta">Aumentar volumen de caldo</div><div class="rec-texto">Incrementar L/ha o reducir VMD para lograr mÃ¡s impactos por cmÂ².</div></div></div>' +
      '<div class="rec-item info"><div class="rec-icon">ðŸ’¨</div><div class="rec-content"><div class="rec-titulo info">Verificar velocidad de avance</div><div class="rec-texto">Reducir la velocidad aumenta el tiempo de exposiciÃ³n y mejora la cobertura.</div></div></div>' +
      '<div class="rec-item info"><div class="rec-icon">ðŸ”©</div><div class="rec-content"><div class="rec-titulo info">Evaluar cambio de boquilla</div><div class="rec-texto">Una boquilla de menor tamaÃ±o ISO produce gotas mÃ¡s pequeÃ±as y mÃ¡s numerosas a igual presiÃ³n.</div></div></div>';
  }
}

function thsAutoSpray() {
  // Genera spray automÃ¡tico basado en parÃ¡metros del Motor de Cobertura
  const n = parseInt(document.getElementById('cob-impactos-slider')?.value) || 30;
  const canvas = document.getElementById('ths-canvas');
  const W = canvas.width, H = canvas.height;
  thsGotas = [];

  // DistribuciÃ³n Poisson simulada en todo el canvas, concentrada en el cuadro 1cmÂ²
  const totalGotas = Math.round(n * 1.5); // un poco mÃ¡s para el Ã¡rea total
  for (let i = 0; i < totalGotas; i++) {
    const x = 10 + Math.random() * (W - 20);
    const y = 10 + Math.random() * (H - 20);
    const radio = thsTamano * (0.75 + Math.random() * 0.5);
    thsGotas.push({ x, y, r: radio });
  }
  thsRenderCanvas();
  thsActualizarStats();
}

function thsLimpiar() {
  thsGotas = [];
  const canvas = document.getElementById('ths-canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  thsRenderCanvas();
  document.getElementById('ths-impactos').textContent = '0';
  document.getElementById('ths-vmd-est').textContent = 'â€”';
  document.getElementById('ths-cobertura').textContent = '0%';
  document.getElementById('ths-lha-est').textContent = 'â€”';
}

function calcTarjetaReal() {
  const n = parseInt(document.getElementById('ths-real-impactos').value) || 0;
  const diam_mm = parseFloat(document.getElementById('ths-real-diametro').value) || 0;
  const tipo = document.getElementById('ths-real-tipo').value;

  // VMD real = diÃ¡metro mancha / factor de expansiÃ³n (~1.5â€“2x)
  const vmdReal = diam_mm > 0 ? Math.round((diam_mm * 1000) / 1.7) : 0; // mm â†’ Âµm / factor
  const lhaEst = vmdReal > 0 && n > 0 ? ((Math.pow(vmdReal,3) * n * Math.PI) / 6e7).toFixed(1) : 'â€”';
  const r_cm = (vmdReal / 2) * 1e-4;
  const cobPct = n > 0 && vmdReal > 0 ? Math.min(n * Math.PI * r_cm * r_cm * 100, 100).toFixed(1) : '0';

  document.getElementById('ths-impactos').textContent = n;
  document.getElementById('ths-vmd-est').textContent = vmdReal > 0 ? vmdReal : 'â€”';
  document.getElementById('ths-cobertura').textContent = cobPct + '%';
  document.getElementById('ths-lha-est').textContent = lhaEst;

  if (n > 0) evaluarTarjeta();
}

// Init canvas
function initTarjetaCanvas() {
  const canvas = document.getElementById('ths-canvas');
  if (!canvas) return;
  thsRenderCanvas();
}



// â•â•â• EVALUACIÃ“N DE CANOPEO â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let canopeoEscenario = 'barbecho';
let canopeoTeorico = { lha: null, vmd: null, impactos: null, tipo: null };

// Estructura de datos para cada posiciÃ³n y sus 3 repeticiones
// { superior: [{img, base64, resultado}, ...], medio: [...], inferior: [...] }
let canopeoData = {
  barbecho: [ {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null} ],
  superior: [ {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null} ],
  medio:    [ {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null} ],
  inferior: [ {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null} ],
};

const POSICION_CONFIG = {
  barbecho: { titulo:'Barbecho / Suelo desnudo', subtitulo:'Sin interferencia â€” cotejo directo con teÃ³rico', icon:'ðŸŒ¾', clase:'barbecho', color:'rgba(200,162,85,.15)' },
  superior: { titulo:'Tarjeta Superior', subtitulo:'Sin interferencia de canopeo â€” parte alta del cultivo', icon:'â˜€ï¸', clase:'superior', color:'rgba(58,122,184,.12)' },
  medio:    { titulo:'Tarjeta 1/3 Medio', subtitulo:'Interior del canopeo â€” zona media del cultivo', icon:'ðŸŒ¿', clase:'medio', color:'rgba(42,122,74,.1)' },
  inferior: { titulo:'Tarjeta 1/3 Inferior', subtitulo:'Base del canopeo â€” zona mÃ¡s difÃ­cil de penetrar', icon:'ðŸŒ±', clase:'inferior', color:'rgba(184,122,32,.1)' },
};

function setEscenario(esc) {
  canopeoEscenario = esc;
  document.getElementById('btn-esc-barbecho').classList.toggle('active', esc === 'barbecho');
  document.getElementById('btn-esc-cultivo').classList.toggle('active', esc === 'cultivo');
  renderPosiciones();
  document.getElementById('canopeo-cotejo').style.display = 'none';
}

function renderPosiciones() {
  const grid = document.getElementById('posiciones-grid');
  grid.className = 'posiciones-grid ' + canopeoEscenario;

  const posiciones = canopeoEscenario === 'barbecho'
    ? ['barbecho']
    : ['superior', 'medio', 'inferior'];

  grid.innerHTML = posiciones.map(pos => {
    const cfg = POSICION_CONFIG[pos];
    const datos = canopeoData[pos];
    return `
      <div class="posicion-card">
        <div class="posicion-header">
          <div class="posicion-badge ${cfg.clase}" style="background:${cfg.color}">${cfg.icon}</div>
          <div>
            <div class="posicion-titulo">${cfg.titulo}</div>
            <div class="posicion-subtitulo">${cfg.subtitulo}</div>
          </div>
        </div>

        <!-- 3 repeticiones -->
        <div class="rep-grid" id="rep-grid-${pos}">
          ${datos.map((rep, i) => `
            <div class="rep-slot ${rep.img ? 'loaded' : ''}" id="rep-slot-${pos}-${i}">
              <input type="file" accept="image/*" capture="environment"
                onchange="cargarRepFoto(event, '${pos}', ${i})">
              <div class="rep-slot-num">Rep ${i+1}</div>
              ${rep.img
                ? `<img src="${rep.img}" class="rep-slot-img">
                   <div class="rep-slot-overlay">
                     <div class="rep-slot-val">${rep.resultado ? rep.resultado.impactos_cm2 : '...'}</div>
                     <div class="rep-slot-lbl">g/cmÂ²</div>
                   </div>`
                : `<div class="rep-add-icon">ðŸ“·</div>
                   <div class="rep-add-label">Foto Rep ${i+1}</div>`
              }
            </div>`).join('')}
        </div>

        <!-- Stats de la posiciÃ³n -->
        <div class="posicion-stats" id="pos-stats-${pos}">
          ${calcStatsHTML(pos)}
        </div>
      </div>`;
  }).join('');
}

function calcStatsHTML(pos) {
  const datos = canopeoData[pos];
  const resultados = datos.filter(d => d.resultado);
  if (!resultados.length) {
    return `
      <div class="pos-stat"><div class="pos-stat-val">â€”</div><div class="pos-stat-lbl">Gotas/cmÂ²</div></div>
      <div class="pos-stat"><div class="pos-stat-val">â€”</div><div class="pos-stat-lbl">VMD Âµm</div></div>
      <div class="pos-stat"><div class="pos-stat-val">â€”</div><div class="pos-stat-lbl">L/ha</div></div>
      <div class="pos-stat"><div class="pos-stat-val">â€”</div><div class="pos-stat-lbl">CV%</div></div>`;
  }

  const impactos = resultados.map(r => r.resultado.impactos_cm2);
  const vmds     = resultados.map(r => r.resultado.vmd_estimado);
  const avgImp   = Math.round(impactos.reduce((a,b) => a+b, 0) / impactos.length);
  const avgVMD   = Math.round(vmds.reduce((a,b) => a+b, 0) / vmds.length);
  const lhaEst   = ((Math.pow(avgVMD, 3) * avgImp * Math.PI) / 6e7).toFixed(1);

  // CV% entre repeticiones
  let cv = 0;
  if (impactos.length > 1) {
    const mean = avgImp;
    const std = Math.sqrt(impactos.reduce((s,x) => s + Math.pow(x - mean, 2), 0) / impactos.length);
    cv = Math.round((std / mean) * 100);
  }

  const tipo = document.getElementById('can-tipo-aplic').value;
  const obj = IMPACTOS_OBJETIVO[tipo];
  const claseImp = avgImp >= (obj ? obj.min : 20) ? 'ok' : avgImp >= (obj ? obj.min * 0.7 : 14) ? 'warn' : 'danger';
  const claseCV  = cv <= 25 ? 'ok' : cv <= 40 ? 'warn' : 'danger';

  return `
    <div class="pos-stat"><div class="pos-stat-val ${claseImp}">${avgImp}</div><div class="pos-stat-lbl">Gotas/cmÂ²</div></div>
    <div class="pos-stat"><div class="pos-stat-val">${avgVMD}</div><div class="pos-stat-lbl">VMD Âµm</div></div>
    <div class="pos-stat"><div class="pos-stat-val">${lhaEst}</div><div class="pos-stat-lbl">L/ha est.</div></div>
    <div class="pos-stat"><div class="pos-stat-val ${claseCV}">${impactos.length > 1 ? cv + '%' : 'â€”'}</div><div class="pos-stat-lbl">CV%</div></div>`;
}

function actualizarBotonAnalizar() {
  const posiciones = canopeoEscenario === 'barbecho' ? ['barbecho'] : ['superior','medio','inferior'];
  const totalFotos = posiciones.reduce((s, pos) =>
    s + canopeoData[pos].filter(d => d.base64).length, 0);
  const btn = document.getElementById('btn-analizar-todo');
  btn.textContent = totalFotos > 0
    ? 'ðŸ¤– Analizar ' + totalFotos + ' tarjeta' + (totalFotos > 1 ? 's' : '') + ' con IA'
    : 'ðŸ¤– Analizar todas las tarjetas con IA';
  btn.disabled = totalFotos === 0;
}

async function analizarTodoCanopeo() {
  const posiciones = canopeoEscenario === 'barbecho' ? ['barbecho'] : ['superior','medio','inferior'];
  const tipo = document.getElementById('can-tipo-aplic').value;
  const obj = IMPACTOS_OBJETIVO[tipo];
  const btn = document.getElementById('btn-analizar-todo');

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0;display:inline-block;vertical-align:middle"></div> Analizando...';

  for (const pos of posiciones) {
    for (let i = 0; i < 3; i++) {
      const rep = canopeoData[pos][i];
      if (!rep.base64 || rep.resultado) continue;

      // Marcar como analizando
      const slot = document.getElementById('rep-slot-' + pos + '-' + i);
      if (slot) slot.classList.add('analizando');

      const posLabel = POSICION_CONFIG[pos].titulo;
      const condMeteo = STATE.meteo
        ? 'T=' + STATE.meteo.temperature_2m + 'Â°C, HR=' + STATE.meteo.relative_humidity_2m + '%, viento=' + STATE.meteo.wind_speed_10m + 'km/h.'
        : '';

      const prompt = 'AnalizÃ¡ esta tarjeta hidrosensible. PosiciÃ³n: ' + posLabel + '. Tipo de aplicaciÃ³n: ' + obj.label + ' (objetivo FAO: ' + obj.min + '-' + obj.max + ' gotas/cmÂ²). ' + condMeteo + ' RespondÃ© SOLO con JSON: {"impactos_cm2":<int>,"vmd_estimado":<int>,"cobertura_pct":<float>,"distribucion":"<uniforme|irregular|muy_irregular>","confianza":"<alta|media|baja>","cumple_objetivo":<bool>}';

      try {
        const response = await pulvClaude({
          model: 'claude-sonnet-4-5',
          max_tokens: 300,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: rep.mimeType || 'image/jpeg', data: rep.base64 } },
            { type: 'text', text: prompt }
          ]}]
        });
        const data = await response.json();
        const texto = data.content?.[0]?.text || '';
        const clean = texto.replace(/```json|```/g, '').trim();
        rep.resultado = JSON.parse(clean);
      } catch(e) {
        rep.resultado = { impactos_cm2: 0, vmd_estimado: 0, cobertura_pct: 0, distribucion:'â€”', confianza:'baja', cumple_objetivo:false, error: true };
      }

      // Actualizar slot con resultado
      if (slot) {
        slot.classList.remove('analizando');
        slot.innerHTML =
          '<div class="rep-slot-num">Rep ' + (idx+1) + '</div>' +
          '<img src="' + rep.img + '" class="rep-slot-img">' +
          '<div class="rep-slot-overlay">' +
            '<div class="rep-slot-val">' + (rep.resultado.impactos_cm2 || '?') + '</div>' +
            '<div class="rep-slot-lbl">g/cmÂ²</div>' +
          '</div>' +
          '<input type="file" accept="image/*" capture="environment" onchange="cargarRepFoto(event,' + JSON.stringify(pos) + ',' + i + ')">';
      }

      // Actualizar stats de la posiciÃ³n
      document.getElementById('pos-stats-' + pos).innerHTML = calcStatsHTML(pos);
    }
  }

  btn.disabled = false;
  btn.innerHTML = 'ðŸ”„ Re-analizar';

  // Mostrar cotejo
  generarCotejo();
}

function calcPromedioPos(pos) {
  const resultados = canopeoData[pos].filter(d => d.resultado && !d.resultado.error);
  if (!resultados.length) return null;
  const avgImp = Math.round(resultados.reduce((s,d) => s + d.resultado.impactos_cm2, 0) / resultados.length);
  const avgVMD = Math.round(resultados.reduce((s,d) => s + d.resultado.vmd_estimado, 0) / resultados.length);
  const lhaEst = parseFloat(((Math.pow(avgVMD, 3) * avgImp * Math.PI) / 6e7).toFixed(1));
  const impactos = resultados.map(d => d.resultado.impactos_cm2);
  let cv = 0;
  if (impactos.length > 1) {
    const mean = avgImp;
    const std = Math.sqrt(impactos.reduce((s,x) => s + Math.pow(x-mean,2), 0) / impactos.length);
    cv = Math.round((std / mean) * 100);
  }
  return { avgImp, avgVMD, lhaEst, cv, n: resultados.length };
}

function generarCotejo() {
  const posRef = canopeoEscenario === 'barbecho' ? 'barbecho' : 'superior';
  const statsRef = calcPromedioPos(posRef);
  if (!statsRef) return;

  const teorico = canopeoTeorico;
  const lhaReal = parseFloat(document.getElementById('can-lha-real').value) || statsRef.lhaEst;

  document.getElementById('canopeo-cotejo').style.display = '';

  // Filas de cotejo (solo si hay teÃ³rico)
  const rows = [];
  if (teorico.impactos) {
    const desvImp = teorico.impactos ? Math.round(((statsRef.avgImp - teorico.impactos) / teorico.impactos) * 100) : null;
    const desvVMD = teorico.vmd ? Math.round(((statsRef.avgVMD - teorico.vmd) / teorico.vmd) * 100) : null;
    const desvLha = lhaReal ? Math.round(((statsRef.lhaEst - lhaReal) / lhaReal) * 100) : null;

    const claseDesv = (d) => d === null ? '' : Math.abs(d) <= 15 ? 'ok' : Math.abs(d) <= 30 ? 'warn' : 'danger';

    rows.push(
      { lbl:'Impactos/cmÂ²', teo: teorico.impactos || 'â€”', real: statsRef.avgImp, desv: desvImp },
      { lbl:'VMD (Âµm)',      teo: teorico.vmd || 'â€”',      real: statsRef.avgVMD, desv: desvVMD },
      { lbl:'L/ha estimado', teo: lhaReal || 'â€”',          real: statsRef.lhaEst, desv: desvLha },
    );

    document.getElementById('cotejo-rows').innerHTML = rows.map(r => {
      const cls = claseDesv(r.desv);
      return '<div class="cotejo-row">' +
        '<div class="cotejo-label">' + r.lbl + '</div>' +
        '<div class="cotejo-val">' + r.teo + '</div>' +
        '<div class="cotejo-val">' + r.real + '</div>' +
        '<div class="cotejo-desvio ' + cls + '">' + (r.desv !== null ? (r.desv > 0 ? '+' : '') + r.desv + '%' : 'â€”') + '</div>' +
        '</div>';
    }).join('');

    // SemÃ¡foro global
    const desvios = [desvImp, desvVMD, desvLha].filter(d => d !== null);
    const maxDesv = Math.max(...desvios.map(Math.abs));
    document.getElementById('cotejo-semaforo').textContent = maxDesv <= 15 ? 'âœ…' : maxDesv <= 30 ? 'âš ï¸' : 'ðŸš«';
  } else {
    document.getElementById('cotejo-rows').innerHTML =
      '<div style="font-size:.8rem;color:rgba(255,253,248,.4);padding:.5rem">SincronizÃ¡ los datos teÃ³ricos del Motor de Cobertura para ver el cotejo completo.</div>';
    document.getElementById('cotejo-semaforo').textContent = 'â„¹ï¸';
  }

  // CV entre repeticiones
  const posiciones = canopeoEscenario === 'barbecho' ? ['barbecho'] : ['superior','medio','inferior'];
  document.getElementById('cv-resultados').innerHTML = posiciones.map(pos => {
    const st = calcPromedioPos(pos);
    if (!st) return '';
    const cfg = POSICION_CONFIG[pos];
    const colorCV = st.cv <= 25 ? '#6DBF82' : st.cv <= 40 ? 'var(--amber)' : '#E8604A';
    return '<div style="display:flex;align-items:center;gap:.8rem;margin-bottom:.4rem">' +
      '<span style="font-size:.72rem;color:rgba(255,253,248,.5);width:100px;flex-shrink:0">' + cfg.icon + ' ' + cfg.titulo.split(' ')[1] + '</span>' +
      '<div style="flex:1;height:8px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden">' +
        '<div style="height:100%;width:' + Math.min(st.cv, 100) + '%;background:' + colorCV + ';border-radius:4px"></div>' +
      '</div>' +
      '<span style="font-family:DM Mono,monospace;font-size:.75rem;color:' + colorCV + ';width:40px;text-align:right">' + (st.n > 1 ? st.cv + '%' : 'N/A') + '</span>' +
      '</div>';
  }).join('');

  // PenetraciÃ³n de canopeo (solo cultivo)
  if (canopeoEscenario === 'cultivo') {
    document.getElementById('penetracion-section').style.display = '';
    const stSup = calcPromedioPos('superior');
    const stMed = calcPromedioPos('medio');
    const stInf = calcPromedioPos('inferior');
    const base = stSup ? stSup.avgImp : 1;

    document.getElementById('penetracion-barras').innerHTML = [
      { lbl:'Superior', st: stSup, color:'#4A9AC4' },
      { lbl:'1/3 Medio', st: stMed, color:'#6DBF82' },
      { lbl:'1/3 Inferior', st: stInf, color:'var(--amber)' },
    ].map(row => {
      if (!row.st) return '';
      const pct = Math.round((row.st.avgImp / base) * 100);
      return '<div class="penetracion-row">' +
        '<div class="penetracion-label">' + row.lbl + '</div>' +
        '<div class="penetracion-track"><div class="penetracion-fill" style="width:' + pct + '%;background:' + row.color + '"></div></div>' +
        '<div class="penetracion-pct">' + pct + '%</div>' +
        '</div>';
    }).join('');
  } else {
    document.getElementById('penetracion-section').style.display = 'none';
  }

  // Sugerencias de ajuste
  generarSugerencias(statsRef, lhaReal);

  // TelemetrÃ­a
  guardarTelemetria(statsRef);
}

function generarSugerencias(statsRef, lhaReal) {
  const tipo = document.getElementById('can-tipo-aplic').value;
  const obj = IMPACTOS_OBJETIVO[tipo];
  const sugs = [];
  const teo = canopeoTeorico;

  // Cobertura insuficiente
  if (statsRef.avgImp < obj.min) {
    const deficit = Math.round(((obj.min - statsRef.avgImp) / statsRef.avgImp) * 100);
    sugs.push({
      tipo: 'critico',
      txt: '<strong>Cobertura insuficiente (' + statsRef.avgImp + ' vs ' + obj.min + ' g/cmÂ²):</strong> ' +
           'NecesitÃ¡s aumentar la cobertura un ' + deficit + '%. Opciones: ' +
           'â‘  Reducir velocidad de avance (' + deficit + '% menos) ' +
           'â‘¡ Aumentar L/ha (' + Math.round(lhaReal * (1 + deficit/100)) + ' L/ha) ' +
           'â‘¢ Cambiar a boquilla de menor tamaÃ±o ISO para reducir VMD.'
    });
  } else if (statsRef.avgImp >= obj.max * 1.3) {
    sugs.push({
      tipo: 'ok',
      txt: '<strong>Excelente cobertura (' + statsRef.avgImp + ' g/cmÂ²):</strong> SuperÃ¡s el objetivo FAO. PodÃ©s aumentar velocidad para mayor rendimiento sin comprometer eficacia.'
    });
  } else {
    sugs.push({
      tipo: 'ok',
      txt: '<strong>Cobertura dentro del objetivo (' + statsRef.avgImp + ' g/cmÂ²):</strong> Los parÃ¡metros de aplicaciÃ³n son correctos para este tipo de producto.'
    });
  }

  // CV alto
  if (statsRef.cv > 30 && statsRef.n > 1) {
    sugs.push({
      tipo: 'warn',
      txt: '<strong>DistribuciÃ³n irregular (CV ' + statsRef.cv + '%):</strong> Alta variabilidad entre repeticiones. Verificar: uniformidad de picos (aforo), presiÃ³n constante en el botalÃ³n, superposiciÃ³n correcta entre pasadas.'
    });
  }

  // VMD vs teÃ³rico
  if (teo.vmd && Math.abs(statsRef.avgVMD - teo.vmd) > teo.vmd * 0.20) {
    const delta = statsRef.avgVMD - teo.vmd;
    sugs.push({
      tipo: delta > 0 ? 'warn' : 'warn',
      txt: '<strong>VMD real ' + (delta > 0 ? 'mayor' : 'menor') + ' al teÃ³rico (' + statsRef.avgVMD + ' vs ' + teo.vmd + ' Âµm):</strong> ' +
           (delta > 0
             ? 'El Delta T y/o viento estÃ¡n evaporando/fragmentando las gotas. Considerar antievaporante o reducir el VMD objetivo.'
             : 'La presiÃ³n de trabajo puede ser mayor a la calibrada. Verificar manÃ³metro.')
    });
  }

  // PenetraciÃ³n (cultivo)
  if (canopeoEscenario === 'cultivo') {
    const stSup = calcPromedioPos('superior');
    const stInf = calcPromedioPos('inferior');
    if (stSup && stInf) {
      const penPct = Math.round((stInf.avgImp / stSup.avgImp) * 100);
      if (penPct < 20) {
        sugs.push({
          tipo: 'critico',
          txt: '<strong>PenetraciÃ³n de canopeo muy baja (' + penPct + '%):</strong> Solo el ' + penPct + '% de la cobertura superior llega al estrato inferior. Para mejorar: â‘  Reducir VMD (gotas mÃ¡s chicas penetran mejor) â‘¡ Aumentar presiÃ³n de trabajo â‘¢ Considerar equipo con asistencia de aire â‘£ Aplicar en estadio fenolÃ³gico mÃ¡s temprano.'
        });
      } else if (penPct < 40) {
        sugs.push({
          tipo: 'warn',
          txt: '<strong>PenetraciÃ³n de canopeo moderada (' + penPct + '%):</strong> Aceptable para fungicidas sistÃ©micos. Para contacto/protectores, considerar aumentar L/ha o reducir VMD.'
        });
      } else {
        sugs.push({
          tipo: 'ok',
          txt: '<strong>Buena penetraciÃ³n de canopeo (' + penPct + '%):</strong> La cobertura llega adecuadamente a los estratos inferiores del cultivo.'
        });
      }
    }
  }

  document.getElementById('canopeo-sugerencias').innerHTML = sugs.map(s =>
    '<div class="ajuste-sugerencia ' + s.tipo + '">' + s.txt + '</div>'
  ).join('');
}

function guardarTelemetria(statsRef) {
  // Guardar punto de datos en localStorage para futura sincronizaciÃ³n a Supabase
  const punto = {
    ts: new Date().toISOString(),
    lat: STATE.lat, lon: STATE.lon,
    escenario: canopeoEscenario,
    tipo: document.getElementById('can-tipo-aplic').value,
    cultivo: document.getElementById('can-cultivo').value,
    lha_real: parseFloat(document.getElementById('can-lha-real').value) || null,
    teo_lha: canopeoTeorico.lha,
    teo_vmd: canopeoTeorico.vmd,
    teo_impactos: canopeoTeorico.impactos,
    real_impactos: statsRef.avgImp,
    real_vmd: statsRef.avgVMD,
    real_lha: statsRef.lhaEst,
    cv: statsRef.cv,
    delta_t: STATE.meteo ? (calcDeltaT ? calcDeltaT() : null) : null,
    viento: STATE.meteo ? STATE.meteo.wind_speed_10m : null,
    hr: STATE.meteo ? STATE.meteo.relative_humidity_2m : null,
  };

  const telem = JSON.parse(localStorage.getItem('agromotor-telemetria') || '[]');
  telem.push(punto);
  // Mantener solo los Ãºltimos 100 puntos
  if (telem.length > 100) telem.shift();
  localStorage.setItem('agromotor-telemetria', JSON.stringify(telem));

  document.getElementById('telem-status').innerHTML =
    '<span style="color:var(--ok)">âœ… Guardado localmente (' + telem.length + ' registros)</span>';
}

function cargarTeoricoDesdeMotor() {
  // Leer los valores actuales del Motor de Cobertura
  const lhaEl = document.getElementById('res-lha');
  const vmdEl = document.getElementById('res-vmd-ef');
  const impEl = document.getElementById('res-impactos-logrados');

  const lha = lhaEl ? parseFloat(lhaEl.textContent) : null;
  const vmd = vmdEl ? parseInt(vmdEl.textContent) : null;
  const imp = impEl ? parseInt(impEl.textContent) : null;

  if (!lha || !vmd || !imp || isNaN(lha) || isNaN(vmd) || isNaN(imp)) {
    toast('âš ï¸ AndÃ¡ al Motor de Cobertura y calculÃ¡ primero');
    return;
  }

  canopeoTeorico = { lha, vmd, impactos: imp };
  document.getElementById('canopeo-teorico-txt').innerHTML =
    '<strong>' + imp + ' gotas/cmÂ²</strong> Â· VMD ' + vmd + ' Âµm Â· ' + lha + ' L/ha' +
    ' <span style="color:var(--ok);font-weight:600">âœ“ Sincronizado</span>';
  toast('âœ… Datos teÃ³ricos sincronizados desde el Motor de Cobertura');
}

function actualizarCotejo() {
  // Re-generar cotejo si ya hay resultados
  const posiciones = canopeoEscenario === 'barbecho' ? ['barbecho'] : ['superior'];
  const st = calcPromedioPos(posiciones[0]);
  if (st) generarCotejo();
}

// Parche: fix Ã­ndice en slot update durante anÃ¡lisis
const _origAnalizarTodoCanopeo = analizarTodoCanopeo;

// â•â•â• ANALIZADOR FOTO TARJETA HIDROSENSIBLE â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let fotoBase64 = null;
let fotoMimeType = 'image/jpeg';

function procesarFotoTarjeta(event) {
  const file = event.target.files[0];
  if (!file) return;

  fotoMimeType = file.type || 'image/jpeg';

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    fotoBase64 = dataUrl.split(',')[1]; // solo base64 sin prefijo

    // Mostrar preview
    document.getElementById('foto-placeholder').style.display = 'none';
    document.getElementById('foto-preview-container').style.display = '';
    document.getElementById('foto-preview-img').src = dataUrl;
    document.getElementById('btn-analizar-foto').disabled = false;
    document.getElementById('foto-resultado-ia').style.display = 'none';

    // Drag zone feedback
    document.getElementById('foto-drop-zone').style.borderColor = 'var(--ok)';
    document.getElementById('foto-drop-zone').style.background = 'rgba(42,122,74,.05)';
  };
  reader.readAsDataURL(file);
}

async function analizarFotoIA() {
  if (!fotoBase64) return;

  const tipoAplic = document.getElementById('foto-tipo-aplic').value;
  const obj = IMPACTOS_OBJETIVO[tipoAplic];
  const btnAnalizar = document.getElementById('btn-analizar-foto');

  btnAnalizar.disabled = true;
  btnAnalizar.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0"></div> Analizando...';

  document.getElementById('foto-resultado-ia').style.display = '';
  document.getElementById('ia-stats-row').innerHTML = '<div class="ia-typing"><div class="spinner" style="width:20px;height:20px;border-width:2px;flex-shrink:0"></div> La IA estÃ¡ analizando la tarjeta hidrosensible...</div>';
  document.getElementById('ia-veredicto-texto').innerHTML = '';

  const condMeteo = STATE.meteo ? (
    'Condiciones ambientales al momento: temperatura ' + STATE.meteo.temperature_2m + 'Â°C, ' +
    'HR ' + STATE.meteo.relative_humidity_2m + '%, viento ' + STATE.meteo.wind_speed_10m + ' km/h.'
  ) : '';

  const prompt = `Sos un experto en aplicaciÃ³n de fitosanitarios y anÃ¡lisis de tarjetas hidrosensibles. AnalizÃ¡ esta imagen de una tarjeta hidrosensible tomada despuÃ©s de una aplicaciÃ³n agrÃ­cola.

Tipo de aplicaciÃ³n realizada: ${obj.label} (objetivo FAO: ${obj.min}â€“${obj.max} gotas/cmÂ²).
${condMeteo}

Por favor analizÃ¡ la imagen y respondÃ© ÃšNICAMENTE con un objeto JSON con esta estructura exacta (sin texto adicional, sin backticks):
{
  "impactos_cm2": <nÃºmero entero estimado de gotas por cmÂ²>,
  "vmd_estimado": <VMD estimado en micrones, nÃºmero entero>,
  "cobertura_pct": <porcentaje de cobertura foliar, nÃºmero con un decimal>,
  "distribucion": "<uniforme|irregular|muy_irregular>",
  "confianza": "<alta|media|baja>",
  "cumple_objetivo": <true|false>,
  "calidad_imagen": "<buena|aceptable|deficiente>",
  "veredicto": "<texto de 2-3 oraciones con el veredicto agronÃ³mico>",
  "recomendaciones": ["<recomendaciÃ³n 1>", "<recomendaciÃ³n 2>", "<recomendaciÃ³n 3>"],
  "observaciones_imagen": "<observaciÃ³n sobre la calidad de la foto o factores que afectan el anÃ¡lisis>"
}`;

  try {
    const response = await pulvClaude({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: fotoMimeType,
              data: fotoBase64
            }
          },
          { type: 'text', text: prompt }
        ]
      }]
    });

    const data = await response.json();
    const texto = data.content?.[0]?.text || '';

    // Parsear JSON de la respuesta
    let resultado;
    try {
      const clean = texto.replace(/```json|```/g, '').trim();
      resultado = JSON.parse(clean);
    } catch(e) {
      throw new Error('No se pudo parsear la respuesta de la IA');
    }

    renderResultadoIA(resultado, obj);

  } catch(err) {
    document.getElementById('ia-stats-row').innerHTML =
      '<div style="color:var(--warn);font-size:.82rem;padding:.5rem">âš ï¸ Error al analizar: ' + err.message + '. VerificÃ¡ tu conexiÃ³n e intentÃ¡ nuevamente.</div>';
  }

  btnAnalizar.disabled = false;
  btnAnalizar.innerHTML = 'ðŸ”„ Volver a analizar';
}

function renderResultadoIA(r, obj) {
  const ts = new Date().toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'});
  document.getElementById('foto-timestamp').textContent = 'Analizado a las ' + ts;

  // Stats
  const colorImpactos = r.cumple_objetivo ? '#6DBF82' : r.impactos_cm2 > obj.min * 0.7 ? 'var(--amber)' : '#E8604A';
  const colorVMD = r.vmd_estimado < 150 ? '#E8604A' : r.vmd_estimado < 350 ? '#6DBF82' : 'var(--amber)';

  document.getElementById('ia-stats-row').innerHTML =
    '<div class="ia-stat">' +
      '<div class="ia-stat-val" style="color:' + colorImpactos + '">' + r.impactos_cm2 + '</div>' +
      '<div class="ia-stat-lbl">Gotas/cmÂ²</div>' +
    '</div>' +
    '<div class="ia-stat">' +
      '<div class="ia-stat-val" style="color:' + colorVMD + '">' + r.vmd_estimado + ' Âµm</div>' +
      '<div class="ia-stat-lbl">VMD estimado</div>' +
    '</div>' +
    '<div class="ia-stat">' +
      '<div class="ia-stat-val" style="color:rgba(255,253,248,.8)">' + r.cobertura_pct + '%</div>' +
      '<div class="ia-stat-lbl">Cobertura</div>' +
    '</div>' +
    '<div class="ia-stat">' +
      '<div class="ia-stat-val" style="font-size:1rem;color:rgba(255,253,248,.7)">' +
        (r.distribucion === 'uniforme' ? 'âœ… Uniforme' : r.distribucion === 'irregular' ? 'âš ï¸ Irregular' : 'ðŸš« Muy irregular') +
      '</div>' +
      '<div class="ia-stat-lbl">DistribuciÃ³n</div>' +
    '</div>';

  // Confianza badge
  const confLabel = r.confianza === 'alta' ? 'Alta confianza' : r.confianza === 'media' ? 'Confianza media' : 'Baja confianza';

  // Veredicto
  const veredictoHtml =
    '<div style="margin-bottom:.8rem">' +
      '<span style="font-size:1.1rem">' + (r.cumple_objetivo ? 'âœ…' : 'âš ï¸') + '</span>' +
      '<span style="font-weight:700;margin-left:.4rem;color:' + (r.cumple_objetivo ? '#6DBF82' : 'var(--amber)') + '">' +
        (r.cumple_objetivo ? 'Cobertura adecuada' : 'Cobertura insuficiente') +
      '</span>' +
      '<span class="ia-confidence ' + r.confianza + '" style="margin-left:.5rem">' + confLabel + '</span>' +
    '</div>' +
    '<div style="margin-bottom:.9rem;line-height:1.7">' + r.veredicto + '</div>' +
    (r.recomendaciones && r.recomendaciones.length ? (
      '<div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,253,248,.3);margin-bottom:.5rem">Recomendaciones</div>' +
      r.recomendaciones.map(rec => '<div style="display:flex;gap:.5rem;margin-bottom:.35rem"><span style="color:var(--spray-blue);flex-shrink:0">â†’</span><span>' + rec + '</span></div>').join('')
    ) : '') +
    (r.observaciones_imagen ? (
      '<div style="margin-top:.8rem;padding:.6rem .8rem;background:rgba(255,255,255,.04);border-radius:8px;font-size:.75rem;color:rgba(255,253,248,.4)">' +
      'ðŸ“· ' + r.observaciones_imagen + '</div>'
    ) : '') +
    '<div style="margin-top:.9rem;padding:.6rem .8rem;background:rgba(255,255,255,.04);border-radius:8px;font-size:.7rem;color:rgba(255,253,248,.3);line-height:1.5">' +
    'âš  El anÃ¡lisis por IA es orientativo. Para mediciÃ³n de precisiÃ³n usar DepositScan (USDA) o papel hidrosensible con lupa calibrada.' +
    '</div>';

  document.getElementById('ia-veredicto-texto').innerHTML = veredictoHtml;

  // Sincronizar con el panel de evaluaciÃ³n principal
  document.getElementById('ths-impactos').textContent = r.impactos_cm2;
  document.getElementById('ths-vmd-est').textContent = r.vmd_estimado;
  document.getElementById('ths-cobertura').textContent = r.cobertura_pct + '%';

  // Calcular L/ha estimado
  const lhaEst = ((Math.pow(r.vmd_estimado, 3) * r.impactos_cm2 * Math.PI) / 6e7).toFixed(1);
  document.getElementById('ths-lha-est').textContent = lhaEst;

  // Disparar evaluaciÃ³n general
  document.getElementById('ths-tipo-eval').value = document.getElementById('foto-tipo-aplic').value;
  evaluarTarjeta();
}

// Patch setThsModo para incluir el nuevo modo foto
const _origSetThsModo = setThsModo;
function setThsModo(modo) {
  document.getElementById('ths-modo-sim-btn').classList.toggle('active', modo === 'simulacion');
  document.getElementById('ths-modo-real-btn').classList.toggle('active', modo === 'real');
  document.getElementById('ths-modo-foto-btn').classList.toggle('active', modo === 'foto');
  document.getElementById('ths-modo-simulacion').style.display = modo === 'simulacion' ? '' : 'none';
  document.getElementById('ths-modo-real').style.display = modo === 'real' ? '' : 'none';
  document.getElementById('ths-modo-foto').style.display = modo === 'foto' ? '' : 'none';
  thsModo = modo;
}

// â•â•â• COMPATIBILIDAD DE MEZCLAS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Base de compatibilidad fÃ­sica y biolÃ³gica
// Estructura: clave = par de tipos, valor = {estado, titulo, texto, orden}
const COMPAT_DB = {
  // â”€â”€ PARES INCOMPATIBLES â”€â”€
  'glifosato+calcio':       { st:'incompatible', txt:'El CaÂ²âº forma sal insoluble con el glifosato (glicina-Ca), inactivÃ¡ndolo. Si el agua es dura, agregar sulfato de amonio PRIMERO.' },
  'glifosato+magnesio':     { st:'incompatible', txt:'Similar al calcio: el MgÂ²âº antagoniza el glifosato. Usar sulfato de amonio como corrector antes del herbicida.' },
  'op+alcalino':            { st:'incompatible', txt:'Los organofosforados (clorpirifos, metamidofos) se hidrolizan rÃ¡pidamente en pH > 7. Usar buffer Ã¡cido antes de agregar el OP.' },
  'cobre+emulsionable':     { st:'incompatible', txt:'Los fungicidas cÃºpricos son incompatibles con la mayorÃ­a de formulaciones EC (emulsionables). Pueden precipitar y tapar filtros.' },
  '2bd+temperatura':        { st:'precaucion', txt:'El 2,4-D amina a temperaturas > 28Â°C volatiliza. Verificar condiciones antes de mezclar con cualquier producto.' },
  'dicamba+temperatura':    { st:'precaucion', txt:'El dicamba a temperaturas > 30Â°C tiene alto riesgo de deriva por volatilizaciÃ³n. No mezclar en horas de calor extremo.' },

  // â”€â”€ PARES COMPATIBLES CON PRECAUCIÃ“N â”€â”€
  'glifosato+als':          { st:'precaucion', txt:'Compatibles fÃ­sicamente. BiolÃ³gicamente: algunos ALS pueden competir por absorciÃ³n con glifosato. Verificar cultivo objetivo.' },
  'glifosato+2bd':          { st:'precaucion', txt:'Mezcla frecuente y funcional. Requiere pH 5â€“6 para ambos productos. Usar acidificante + sulfato de amonio. Temperatura < 28Â°C.' },
  'glifosato+dicamba':      { st:'precaucion', txt:'Mezcla registrada (Engenia, Roundup PowerMax). Requiere pH < 7, temperatura < 30Â°C y condiciones de baja volatilizaciÃ³n.' },
  'triazol+estrobilurina':  { st:'compatible', txt:'Mezcla de referencia para fungicidas foliares. Complemento de modos de acciÃ³n (DMI + QoI). Amplia compatibilidad fÃ­sica.' },
  'triazol+insecticida':    { st:'compatible', txt:'Generalmente compatible. Verificar siempre test de jarrita. Mantener agitaciÃ³n durante la mezcla.' },
  'glifosato+graminicida':  { st:'precaucion', txt:'Potencial antagonismo: el cletodim puede inhibirse con glifosato. Consultar bibliografÃ­a de la especie objetivo.' },
  'fungicida+insecticida':  { st:'compatible', txt:'Mezcla habitual en cereales. Generalmente compatible. Verificar pH neutro y test de jarrita.' },
  'als+hormonal':           { st:'precaucion', txt:'Verificar compatibilidad por lote. Algunos ALS + hormonales pueden generar fitotoxicidad en condiciones de estrÃ©s.' },
  'foliar+herbicida':       { st:'precaucion', txt:'Riesgo de fitotoxicidad si el herbicida daÃ±a la cutÃ­cula. Generalmente evitar mezclar con herbicidas de contacto.' },
  'coadyuvante+fungicida':  { st:'compatible', txt:'Los surfactantes no iÃ³nicos son compatibles con la mayorÃ­a de fungicidas. Verificar concentraciÃ³n para evitar espuma.' },
  'sulfatoamonio+glifosato':{ st:'compatible', txt:'Mezcla recomendada: el sulfato de amonio mejora la eficacia del glifosato en agua dura. Agregar PRIMERO al agua, dejar disolver.' },
  'acidificante+op':        { st:'compatible', txt:'El buffer Ã¡cido es imprescindible para OP en agua alcalina. Agregar primero el acidificante, verificar pH 5â€“6.5 antes del OP.' },
};

const PRODUCTOS_MEZCLA = [
  { id:'glifosato',     nombre:'Glifosato 48%',           tipo:'herbicida', grupo:'glifosato',    orden:3, formulacion:'SL' },
  { id:'glifo_amonio',  nombre:'Glifosato amÃ³nico 66%',   tipo:'herbicida', grupo:'glifosato',    orden:3, formulacion:'SL' },
  { id:'2bd',           nombre:'2,4-D amina 72%',          tipo:'herbicida', grupo:'2bd',           orden:4, formulacion:'SL' },
  { id:'dicamba',       nombre:'Dicamba 48%',              tipo:'herbicida', grupo:'dicamba',       orden:4, formulacion:'SL' },
  { id:'als_metsulfuron',nombre:'MetsulfurÃ³n 60%',         tipo:'herbicida', grupo:'als',           orden:5, formulacion:'WG' },
  { id:'als_imazetapir',nombre:'Imazetapir 10%',           tipo:'herbicida', grupo:'als',           orden:5, formulacion:'SL' },
  { id:'atrazina',      nombre:'Atrazina 50% SC',          tipo:'herbicida', grupo:'preemergente',  orden:4, formulacion:'SC' },
  { id:'cletodim',      nombre:'Cletodim 24%',             tipo:'herbicida', grupo:'graminicida',   orden:4, formulacion:'EC' },
  { id:'haloxifop',     nombre:'Haloxifop 12%',            tipo:'herbicida', grupo:'graminicida',   orden:4, formulacion:'EC' },
  { id:'saflufenacil',  nombre:'Saflufenacil 70% WG',      tipo:'herbicida', grupo:'saflufenacil',  orden:4, formulacion:'WG' },
  { id:'tebuconazole',  nombre:'Tebuconazole 25%',         tipo:'fungicida', grupo:'triazol',       orden:5, formulacion:'EC' },
  { id:'azox_cipro',    nombre:'Azoxistrobin + Cipro.',    tipo:'fungicida', grupo:'estrobilurina', orden:5, formulacion:'SC' },
  { id:'triflox_cipro', nombre:'Trifloxistrobin + Cipro.', tipo:'fungicida', grupo:'estrobilurina', orden:5, formulacion:'SC' },
  { id:'fluxapiroxad',  nombre:'Fluxapiroxad + Epox.',     tipo:'fungicida', grupo:'sdhi',          orden:5, formulacion:'SC' },
  { id:'mancozeb',      nombre:'Mancozeb 80% PM',          tipo:'fungicida', grupo:'contacto',      orden:4, formulacion:'WP' },
  { id:'clorpirifos',   nombre:'Clorpirifos 48%',          tipo:'insecticida',grupo:'op',           orden:5, formulacion:'EC' },
  { id:'lambda',        nombre:'Lambda-cialotrina 5%',     tipo:'insecticida',grupo:'piretroide',   orden:5, formulacion:'EC' },
  { id:'cipermetrina',  nombre:'Cipermetrina 25%',         tipo:'insecticida',grupo:'piretroide',   orden:5, formulacion:'EC' },
  { id:'imidacloprid',  nombre:'Imidacloprid 35%',         tipo:'insecticida',grupo:'neonicotinoide',orden:5,formulacion:'SC' },
  { id:'sulfatoamonio', nombre:'Sulfato de amonio',        tipo:'coadyuvante',grupo:'sulfatoamonio',orden:1, formulacion:'SG' },
  { id:'acidificante',  nombre:'Acidificante/buffer pH',   tipo:'coadyuvante',grupo:'acidificante', orden:0, formulacion:'SL' },
  { id:'aceite_metil',  nombre:'Aceite metilado de soja',  tipo:'coadyuvante',grupo:'aceite',       orden:2, formulacion:'EC' },
  { id:'antideriva',    nombre:'Reductor de deriva',       tipo:'coadyuvante',grupo:'coadyuvante',  orden:2, formulacion:'SL' },
  { id:'antievaporante',nombre:'Antievaporante',           tipo:'coadyuvante',grupo:'coadyuvante',  orden:2, formulacion:'SL' },
  { id:'urea_foliar',   nombre:'Urea foliar 20%',          tipo:'foliar',    grupo:'foliar',        orden:5, formulacion:'SL' },
  { id:'boro',          nombre:'Boro lÃ­quido',             tipo:'foliar',    grupo:'foliar',        orden:5, formulacion:'SL' },
];

let mezclaSeleccion = [null, null]; // hasta 4 slots

function initMezclaSlots() {
  mezclaSeleccion = [null, null];
  renderMezclaSlots();
}

function renderMezclaSlots() {
  const cont = document.getElementById('mezcla-slots');
  cont.innerHTML = mezclaSeleccion.map((sel, i) => `
    <div class="mezcla-producto-slot ${sel ? 'lleno' : ''}">
      <div class="mezcla-slot-header">
        <div style="display:flex;align-items:center;gap:.5rem">
          <div class="mezcla-slot-num">${i+1}</div>
          <span style="font-size:.72rem;font-weight:600;color:rgba(28,18,8,.4);letter-spacing:.08em;text-transform:uppercase">
            Producto ${i+1}
          </span>
        </div>
        ${sel ? `<button class="mezcla-remove" onclick="quitarMezcla(${i})">âœ•</button>` : ''}
      </div>
      <select class="form-select" onchange="setMezcla(${i}, this.value)">
        <option value="">â€” Seleccionar producto â€”</option>
        ${PRODUCTOS_MEZCLA.map(p => `<option value="${p.id}" ${sel===p.id?'selected':''}>${p.nombre} (${p.tipo})</option>`).join('')}
      </select>
    </div>`).join('');
}

function setMezcla(idx, id) {
  mezclaSeleccion[idx] = id || null;
  renderMezclaSlots();
}

function quitarMezcla(idx) {
  mezclaSeleccion[idx] = null;
  renderMezclaSlots();
}

function agregarSlot() {
  if (mezclaSeleccion.length >= 4) return;
  mezclaSeleccion.push(null);
  renderMezclaSlots();
}

function analizarMezcla() {
  const seleccionados = mezclaSeleccion.filter(Boolean).map(id => PRODUCTOS_MEZCLA.find(p => p.id === id));
  if (seleccionados.length < 2) {
    document.getElementById('mezcla-resultado').innerHTML = '<div class="rec-item alerta"><div class="rec-icon">âš ï¸</div><div class="rec-content"><div class="rec-titulo alerta">SeleccionÃ¡ al menos 2 productos</div></div></div>';
    return;
  }

  const resultados = [];
  const alertasGlobales = [];

  // Evaluar cada par
  for (let i = 0; i < seleccionados.length; i++) {
    for (let j = i+1; j < seleccionados.length; j++) {
      const a = seleccionados[i], b = seleccionados[j];
      const key1 = a.grupo + '+' + b.grupo;
      const key2 = b.grupo + '+' + a.grupo;
      const compat = COMPAT_DB[key1] || COMPAT_DB[key2];

      if (compat) {
        resultados.push({ a: a.nombre, b: b.nombre, ...compat });
      } else {
        // Reglas generales
        let st = 'compatible', txt = 'Sin incompatibilidades conocidas documentadas. Realizar test de jarrita antes de cargar el equipo.';
        if (a.formulacion === 'EC' && b.formulacion === 'EC') {
          st = 'precaucion'; txt = 'Dos formulaciones EC (emulsionables): riesgo de rotura de emulsiÃ³n. Test de jarrita obligatorio.';
        }
        if (a.formulacion === 'WP' || b.formulacion === 'WP') {
          st = 'precaucion'; txt = 'FormulaciÃ³n WP (polvo mojable): dispersar en agua aparte antes de agregar al tanque. Mantener agitaciÃ³n.';
        }
        resultados.push({ a: a.nombre, b: b.nombre, st, txt });
      }
    }
  }

  // Reglas globales de la mezcla completa
  const grupos = seleccionados.map(p => p.grupo);
  if (grupos.includes('glifosato') && !grupos.includes('sulfatoamonio') && !grupos.includes('acidificante')) {
    alertasGlobales.push({ ico:'âš ï¸', txt:'La mezcla contiene glifosato pero no incluye sulfato de amonio ni acidificante. Se recomienda agregar ambos para agua dura y/o alcalina.' });
  }
  if (grupos.includes('op') && !grupos.includes('acidificante')) {
    alertasGlobales.push({ ico:'ðŸš¨', txt:'La mezcla contiene un organofosforado. Es imprescindible un buffer de pH. Agregar acidificante primero.' });
  }
  if (grupos.filter(g => g === 'ec' || g === 'graminicida' || g === 'triazol').length >= 2) {
    alertasGlobales.push({ ico:'ðŸ§ª', txt:'MÃºltiples formulaciones EC: realizar SIEMPRE test de jarrita antes de cargar el equipo completo.' });
  }

  // Veredicto global
  const hayIncompat = resultados.some(r => r.st === 'incompatible');
  const hayPrecaucion = resultados.some(r => r.st === 'precaucion');
  const verdGlobal = hayIncompat ? 'incompatible' : hayPrecaucion ? 'precaucion' : 'compatible';
  const verdIcono = hayIncompat ? 'ðŸš«' : hayPrecaucion ? 'âš ï¸' : 'âœ…';
  const verdTxt = hayIncompat ? 'Mezcla con incompatibilidades â€” revisar antes de aplicar' : hayPrecaucion ? 'Mezcla viable con precauciones' : 'Mezcla compatible';

  document.getElementById('mezcla-resultado').innerHTML = `
    <div class="compat-result ${verdGlobal}" style="margin-bottom:1rem">
      <div class="compat-header">
        <span style="font-size:1.3rem">${verdIcono}</span>
        <span class="compat-titulo ${verdGlobal}" style="font-size:1rem">${verdTxt}</span>
      </div>
    </div>
    ${alertasGlobales.map(a => `
      <div class="rec-item alerta" style="margin-bottom:.6rem">
        <div class="rec-icon">${a.ico}</div>
        <div class="rec-content"><div class="rec-texto">${a.txt}</div></div>
      </div>`).join('')}
    ${resultados.map(r => `
      <div class="compat-result ${r.st}">
        <div class="compat-header">
          <span style="font-size:1rem">${r.st==='incompatible'?'ðŸš«':r.st==='precaucion'?'âš ï¸':'âœ…'}</span>
          <span class="compat-titulo ${r.st}">${r.a} + ${r.b}</span>
        </div>
        <div class="compat-texto">${r.txt}</div>
      </div>`).join('')}`;

  // Orden de agregado
  const ordenados = [...seleccionados].sort((a,b) => a.orden - b.orden);
  document.getElementById('mezcla-orden').innerHTML = `
    <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(28,18,8,.35);margin-bottom:.8rem">
      Secuencia recomendada de carga al tanque:
    </div>
    ${ordenados.map((p, i) => `
      <div style="display:flex;align-items:center;gap:.8rem;padding:.6rem .8rem;border-radius:10px;border:1px solid var(--border);margin-bottom:.5rem;background:rgba(252,249,242,.7)">
        <div style="width:26px;height:26px;border-radius:50%;background:rgba(58,122,184,.12);color:var(--spray-blue);font-size:.75rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
        <div>
          <div style="font-size:.84rem;font-weight:600;color:var(--earth)">${p.nombre}</div>
          <div style="font-size:.7rem;color:rgba(28,18,8,.4)">${p.formulacion} Â· ${p.tipo}</div>
        </div>
      </div>`).join('')}
    <div style="font-size:.72rem;color:rgba(28,18,8,.4);margin-top:.7rem;line-height:1.5">
      âš  Siempre con el tanque a mitad de agua. Agitar entre cada producto. Completar con agua al final.
    </div>`;
}

// â•â•â• CARENCIA Y REINGRESO â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const CARENCIA_DB = [
  // Herbicidas
  { id:1, nombre:'Glifosato 48%', pa:'Glifosato', tipo:'herbicida', cultivos:['Soja','MaÃ­z','Girasol','Trigo','Barbecho'], carencia_dias:0, reingreso_hs:4, ica:'Clase IV â€” Ligeramente peligroso', notas:'Sin perÃ­odo de carencia para barbecho. En cultivos verificar marbete por variedad.' },
  { id:2, nombre:'2,4-D amina 72%', pa:'2,4-D amina', tipo:'herbicida', cultivos:['Trigo','MaÃ­z','Pasturas','Barbecho'], carencia_dias:21, reingreso_hs:24, ica:'Clase II â€” Moderadamente peligroso', notas:'No aplicar en floraciÃ³n. Distancia mÃ­nima de cultivos sensibles: 500 m.' },
  { id:3, nombre:'Dicamba 48%', pa:'Dicamba', tipo:'herbicida', cultivos:['MaÃ­z','Soja XtendFlex','Barbecho'], carencia_dias:30, reingreso_hs:24, ica:'Clase III â€” Levemente peligroso', notas:'Solo en variedades tolerantes. Alta volatilizaciÃ³n > 27Â°C.' },
  { id:4, nombre:'Atrazina 50%', pa:'Atrazina', tipo:'herbicida', cultivos:['MaÃ­z','Sorgo'], carencia_dias:45, reingreso_hs:12, ica:'Clase III', notas:'Residualidad alta en suelo. RestricciÃ³n de 45 dÃ­as antes de cosecha.' },
  { id:5, nombre:'MetsulfurÃ³n 60%', pa:'MetsulfurÃ³n metil', tipo:'herbicida', cultivos:['Trigo','Cebada'], carencia_dias:60, reingreso_hs:4, ica:'Clase IV', notas:'Alta residualidad. RestricciÃ³n estricta para cultivos de verano en rotaciÃ³n.' },
  { id:6, nombre:'Cletodim 24%', pa:'Cletodim', tipo:'herbicida', cultivos:['Soja','Girasol','Colza'], carencia_dias:45, reingreso_hs:12, ica:'Clase III', notas:'No aplicar en gramÃ­neas cultivadas. Respetar carencia estrictamente.' },
  { id:7, nombre:'Haloxifop 12%', pa:'Haloxifop-metil', tipo:'herbicida', cultivos:['Soja','Girasol'], carencia_dias:60, reingreso_hs:24, ica:'Clase II', notas:'Alta carencia. Verificar restricciones para exportaciÃ³n.' },
  { id:8, nombre:'Saflufenacil 70%', pa:'Saflufenacil', tipo:'herbicida', cultivos:['Barbecho','MaÃ­z'], carencia_dias:0, reingreso_hs:12, ica:'Clase III', notas:'Principalmente para barbecho. En maÃ­z verificar tolerancia varietal.' },
  // Fungicidas
  { id:9, nombre:'Tebuconazole 25%', pa:'Tebuconazole', tipo:'fungicida', cultivos:['Trigo','Soja','Girasol','MaÃ­z'], carencia_dias:21, reingreso_hs:24, ica:'Clase III', notas:'Triazol sistÃ©mico. Respetar carencia en trigo para exportaciÃ³n a UE.' },
  { id:10, nombre:'Azoxistrobin + Ciproconazole', pa:'Azoxistrobin + Ciproconazole', tipo:'fungicida', cultivos:['Soja','MaÃ­z','Trigo','Girasol'], carencia_dias:14, reingreso_hs:4, ica:'Clase IV', notas:'Estrobilurina + triazol. Amplio espectro. Buena selectividad.' },
  { id:11, nombre:'Trifloxistrobin + Ciproconazole', pa:'Trifloxistrobin + Ciproconazole', tipo:'fungicida', cultivos:['Soja','MaÃ­z','Trigo'], carencia_dias:21, reingreso_hs:4, ica:'Clase IV', notas:'Respetar lÃ­mites mÃ¡ximos de residuo para destino de exportaciÃ³n.' },
  { id:12, nombre:'Mancozeb 80%', pa:'Mancozeb', tipo:'fungicida', cultivos:['Soja','Papa','Tomate','Trigo'], carencia_dias:7, reingreso_hs:24, ica:'Clase III', notas:'Fungicida de contacto. Potencial irritante respiratorio. EPP obligatorio.' },
  { id:13, nombre:'Fluxapiroxad + Epoxiconazole', pa:'Fluxapiroxad + Epoxiconazole', tipo:'fungicida', cultivos:['Trigo','Soja','Cebada'], carencia_dias:30, reingreso_hs:12, ica:'Clase III', notas:'SDHI + triazol. Alta residualidad â€” respetar carencia para exportaciÃ³n.' },
  // Insecticidas
  { id:14, nombre:'Clorpirifos 48%', pa:'Clorpirifos', tipo:'insecticida', cultivos:['Soja','MaÃ­z','Girasol','Trigo'], carencia_dias:21, reingreso_hs:48, ica:'Clase II â€” Moderadamente peligroso', notas:'OP de amplio espectro. Altamente tÃ³xico para abejas. Reingreso 48 hs. Restricciones en UE.' },
  { id:15, nombre:'Lambda-cialotrina 5%', pa:'Lambda-cialotrina', tipo:'insecticida', cultivos:['Soja','MaÃ­z','Trigo','Girasol'], carencia_dias:14, reingreso_hs:24, ica:'Clase II', notas:'Piretroide. TÃ³xico para peces y abejas. Evitar aplicaciÃ³n en floraciÃ³n.' },
  { id:16, nombre:'Cipermetrina 25%', pa:'Cipermetrina', tipo:'insecticida', cultivos:['Soja','MaÃ­z','Trigo'], carencia_dias:14, reingreso_hs:24, ica:'Clase II', notas:'Piretroide de contacto. No aplicar cerca de cursos de agua.' },
  { id:17, nombre:'Imidacloprid 35%', pa:'Imidacloprid', tipo:'insecticida', cultivos:['Soja','MaÃ­z','Papa'], carencia_dias:21, reingreso_hs:12, ica:'Clase II', notas:'Neonicotinoide. Prohibido en floraciÃ³n. Restricciones por impacto en polinizadores.' },
  { id:18, nombre:'Metamidofos 60%', pa:'Metamidofos', tipo:'insecticida', cultivos:['Soja','AlgodÃ³n'], carencia_dias:21, reingreso_hs:48, ica:'Clase Ib â€” Altamente peligroso', notas:'âš  ALTA PELIGROSIDAD. EPP completo obligatorio. Revisar restricciones vigentes de SENASA.' },
  { id:19, nombre:'Spinosad 12%', pa:'Spinosad', tipo:'insecticida', cultivos:['Soja','MaÃ­z','Hortalizas'], carencia_dias:7, reingreso_hs:4, ica:'Clase IV â€” Ligeramente peligroso', notas:'Selectivo para enemigos naturales. Compatible con manejo integrado.' },
];

let carenciaFiltro = 'todos';
let carenciaBusqueda = '';

function renderCarencia() {
  if (!document.getElementById('carencia-lista')) return;
  const busq = carenciaBusqueda.toLowerCase();
  const lista = CARENCIA_DB.filter(p => {
    const matchFiltro = carenciaFiltro === 'todos' || p.tipo === carenciaFiltro || (carenciaFiltro === 'alta_carencia' && p.carencia_dias > 30);
    const matchBusq = !busq || [p.nombre, p.pa, p.cultivos.join(' ')].some(t => t.toLowerCase().includes(busq));
    return matchFiltro && matchBusq;
  });

  const hoy = new Date();
  document.getElementById('carencia-lista').innerHTML = lista.length === 0
    ? '<p class="txt-muted" style="text-align:center;padding:2rem">Sin resultados para esta bÃºsqueda.</p>'
    : lista.map(p => {
        // SemÃ¡foro de carencia
        const color = p.carencia_dias === 0 ? 'verde' : p.carencia_dias <= 14 ? 'verde' : p.carencia_dias <= 30 ? 'ambar' : 'roja';
        const reingSemaforo = p.reingreso_hs <= 4 ? 'verde' : p.reingreso_hs <= 24 ? 'ambar' : 'roja';
        return `
        <div class="carencia-card" onclick="this.classList.toggle('expandida')">
          <div class="carencia-card-header">
            <div>
              <div class="carencia-nombre">${p.nombre}</div>
              <div class="carencia-pa">${p.pa}</div>
            </div>
            <span class="tag ${color === 'verde' ? 'verde' : color === 'ambar' ? 'amarillo' : 'rojo'}">${p.tipo}</span>
          </div>
          <div class="carencia-card-body">
            <div class="carencia-dato">
              <div class="carencia-dato-val" style="color:${p.carencia_dias === 0 ? 'var(--ok)' : p.carencia_dias > 30 ? 'var(--red)' : 'var(--caution)'}">${p.carencia_dias}</div>
              <div class="carencia-dato-unit">dÃ­as</div>
              <div class="carencia-dato-lbl">Carencia</div>
            </div>
            <div class="carencia-dato">
              <div class="carencia-dato-val" style="color:${p.reingreso_hs <= 4 ? 'var(--ok)' : p.reingreso_hs >= 48 ? 'var(--red)' : 'var(--caution)'}">${p.reingreso_hs}</div>
              <div class="carencia-dato-unit">horas</div>
              <div class="carencia-dato-lbl">Reingreso</div>
            </div>
            <div class="carencia-dato">
              <div style="font-size:.72rem;color:rgba(28,18,8,.55);line-height:1.4">${p.ica}</div>
              <div class="carencia-dato-lbl" style="margin-top:.3rem">ClasificaciÃ³n</div>
            </div>
          </div>
          <div class="carencia-alerta ${color}">
            ðŸ“‹ Cultivos: <strong>${p.cultivos.join(', ')}</strong><br>
            ${p.notas}
          </div>
        </div>`;
      }).join('');
}

function filtrarCarencia() {
  carenciaBusqueda = document.getElementById('car-search').value;
  renderCarencia();
}

function setCarFiltro(el, filtro) {
  carenciaFiltro = filtro;
  document.querySelectorAll('.carencia-filtro').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderCarencia();
}

function calcFechaSegura() {
  const fechaAplic = document.getElementById('car-fecha-aplic').value;
  const dias = parseInt(document.getElementById('car-dias').value);
  if (!fechaAplic || isNaN(dias)) return;
  const fecha = new Date(fechaAplic);
  fecha.setDate(fecha.getDate() + dias);
  document.getElementById('car-fecha-cosecha').value = fecha.toISOString().split('T')[0];
  const hoy = new Date();
  const diffDias = Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
  document.getElementById('car-calc-resultado').innerHTML = diffDias > 0
    ? `âœ… Faltan <strong>${diffDias} dÃ­as</strong> para poder cosechar con seguridad.`
    : `âš ï¸ La fecha segura de cosecha ya pasÃ³ hace ${Math.abs(diffDias)} dÃ­as.`;
}


// â•â•â• MAPA DE LOTES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let mapaObj = null;
let mapaCapaSatelite = null;
let mapaCapaOsm = null;
let mapaSateliteActivo = false;
let modosDibujo = false;
let puntosPolygono = [];
let polylineTemp = null;
let polygonTemp = null;
let lotesGuardados = JSON.parse(localStorage.getItem('lotes-mapa') || '[]');
let loteSeleccionadoId = null;
let mapaLayers = {}; // id -> layer leaflet

function initMapa() {
  if (mapaObj) return;
  // Centro inicial: ubicaciÃ³n GPS o CÃ³rdoba
  const lat = STATE.lat || -31.42;
  const lon = STATE.lon || -64.18;

  mapaObj = L.map('lotes-map', { zoomControl: true }).setView([lat, lon], 13);

  // Capa OSM base
  mapaCapaOsm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Â© OpenStreetMap',
    maxZoom: 19
  }).addTo(mapaObj);

  // Capa satÃ©lite (Esri)
  mapaCapaSatelite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Â© Esri', maxZoom: 19 }
  );

  // Marcador GPS
  if (STATE.lat) {
    L.circleMarker([STATE.lat, STATE.lon], {
      radius: 8, fillColor: '#3A7AB8', color: 'white',
      weight: 2, fillOpacity: 0.9
    }).addTo(mapaObj).bindTooltip('Tu ubicaciÃ³n', { permanent: false });
  }

  // Click handler para dibujo
  mapaObj.on('click', mapaClick);
  mapaObj.on('dblclick', mapaDblClick);

  // Renderizar lotes guardados
  lotesGuardados.forEach(l => renderLoteEnMapa(l));
  renderListaLotes();

  document.getElementById('mapa-estado').textContent = 'âœ… Mapa listo â€” GPS activo';
}

function mapaClick(e) {
  if (!modosDibujo) return;

  const { lat, lng } = e.latlng;
  puntosPolygono.push([lat, lng]);

  // Actualizar preview
  if (polylineTemp) mapaObj.removeLayer(polylineTemp);
  polylineTemp = L.polyline(puntosPolygono, {
    color: '#3A7AB8', weight: 2, dashArray: '6,4', opacity: 0.8
  }).addTo(mapaObj);

  // Actualizar superficie y vÃ©rtices
  document.getElementById('nuevo-lote-vertices').textContent =
    `VÃ©rtices: ${puntosPolygono.length} (doble click para cerrar)`;

  if (puntosPolygono.length >= 3) {
    const sup = calcSuperficieHa(puntosPolygono);
    document.getElementById('nuevo-lote-sup').textContent =
      `Superficie estimada: ${sup.toFixed(2)} ha`;

    // Preview polÃ­gono cerrado
    if (polygonTemp) mapaObj.removeLayer(polygonTemp);
    polygonTemp = L.polygon(puntosPolygono, {
      color: '#3A7AB8', fillColor: '#3A7AB8',
      fillOpacity: 0.15, weight: 2
    }).addTo(mapaObj);
  }
}

function mapaDblClick(e) {
  if (!modosDibujo || puntosPolygono.length < 3) return;
  L.DomEvent.stop(e);
  // Cerrar polÃ­gono â€” mostrar formulario
  document.getElementById('panel-instrucciones').style.display = 'none';
  document.getElementById('panel-nuevo-lote').style.display = '';
  document.getElementById('nuevo-lote-nombre').focus();
}

function toggleDibujar() {
  if (modosDibujo) {
    cancelarDibujo();
  } else {
    modosDibujo = true;
    puntosPolygono = [];
    document.getElementById('btn-dibujar').classList.add('active');
    document.getElementById('btn-dibujar').textContent = 'âœ• Cancelar dibujo';
    document.getElementById('panel-instrucciones').style.display = '';
    document.getElementById('mapa-estado').textContent =
      'âœï¸ Modo dibujo â€” click para marcar vÃ©rtices, doble click para cerrar';
    mapaObj.getContainer().style.cursor = 'crosshair';
  }
}

function cancelarDibujo() {
  modosDibujo = false;
  puntosPolygono = [];
  if (polylineTemp) { mapaObj.removeLayer(polylineTemp); polylineTemp = null; }
  if (polygonTemp) { mapaObj.removeLayer(polygonTemp); polygonTemp = null; }
  document.getElementById('btn-dibujar').classList.remove('active');
  document.getElementById('btn-dibujar').innerHTML = 'âœï¸ Dibujar lote';
  document.getElementById('panel-instrucciones').style.display = 'none';
  document.getElementById('panel-nuevo-lote').style.display = 'none';
  document.getElementById('nuevo-lote-nombre').value = '';
  document.getElementById('nuevo-lote-estab').value = '';
  document.getElementById('mapa-estado').textContent = 'âœ… Mapa listo';
  mapaObj.getContainer().style.cursor = '';
}

function guardarLote() {
  const nombre = document.getElementById('nuevo-lote-nombre').value.trim() || 'Lote sin nombre';
  const estab = document.getElementById('nuevo-lote-estab').value.trim();
  if (puntosPolygono.length < 3) {
    alert('MarcÃ¡ al menos 3 puntos para definir el lote.');
    return;
  }

  const sup = calcSuperficieHa(puntosPolygono);
  const centroide = calcCentroide(puntosPolygono);
  const lote = {
    id: Date.now(),
    nombre,
    estab,
    sup: parseFloat(sup.toFixed(2)),
    puntos: puntosPolygono,
    centroide,
    color: colorLote(),
    fechaCreacion: new Date().toLocaleDateString('es-AR'),
  };

  lotesGuardados.push(lote);
  localStorage.setItem('lotes-mapa', JSON.stringify(lotesGuardados));

  renderLoteEnMapa(lote);
  renderListaLotes();
  cancelarDibujo();
  toast('ðŸ—º Lote "' + nombre + '" guardado Â· ' + sup.toFixed(1) + ' ha');
}

function renderLoteEnMapa(lote) {
  // Limpiar layer previo si existe
  if (mapaLayers[lote.id]) mapaObj.removeLayer(mapaLayers[lote.id]);

  const layer = L.polygon(lote.puntos, {
    color: lote.color || '#3A7AB8',
    fillColor: lote.color || '#3A7AB8',
    fillOpacity: 0.18, weight: 2.5,
  }).addTo(mapaObj);

  // Etiqueta en el centroide
  const label = L.divIcon({
    className: '',
    html: `<div style="background:rgba(252,249,242,.92);border:1px solid rgba(60,34,16,.15);border-radius:8px;padding:2px 7px;font-family:DM Sans,sans-serif;font-size:11px;font-weight:700;color:#3D2210;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.12)">${lote.nombre}</div>`,
    iconAnchor: [40, 10]
  });
  L.marker(lote.centroide, { icon: label }).addTo(mapaObj);

  // Popup con historial
  layer.on('click', () => mostrarDetalleLote(lote.id));
  mapaLayers[lote.id] = layer;
}

function mostrarDetalleLote(id) {
  loteSeleccionadoId = id;
  const lote = lotesGuardados.find(l => l.id === id);
  if (!lote) return;

  document.getElementById('detalle-lote-nombre').textContent = lote.nombre;
  document.getElementById('detalle-lote-meta').textContent =
    `${lote.estab ? lote.estab + ' Â· ' : ''}${lote.sup} ha Â· Creado: ${lote.fechaCreacion}`;

  // Historial de aplicaciones del registro
  const apls = historial.filter(a => a.lote && a.lote.toLowerCase().includes(lote.nombre.toLowerCase()));
  const histDiv = document.getElementById('detalle-lote-historial');

  if (apls.length === 0) {
    histDiv.innerHTML = '<p class="txt-muted" style="font-size:.75rem">Sin aplicaciones registradas para este lote.</p>';
  } else {
    histDiv.innerHTML = apls.slice(0, 5).map(a => `
      <div class="aplic-mini">
        <div class="aplic-mini-dot" style="background:${a.condicion==='verde'?'var(--ok)':a.condicion==='amarillo'?'var(--caution)':'var(--red)'}"></div>
        <div>
          <div style="font-weight:600;color:var(--earth)">${a.fecha} â€” ${a.producto || 'Sin producto'}</div>
          <div style="color:rgba(28,18,8,.45)">${a.ha || 'â€”'} ha Â· ${a.volha || 'â€”'} L/ha</div>
        </div>
      </div>`).join('');
    if (apls.length > 5) {
      histDiv.innerHTML += `<div style="font-size:.7rem;color:rgba(28,18,8,.4);text-align:center;margin-top:.3rem">+${apls.length-5} aplicaciones mÃ¡s en el registro</div>`;
    }
  }

  // Destacar en lista
  document.querySelectorAll('.lote-item').forEach(el => el.classList.remove('activo'));
  const elItem = document.getElementById('lote-item-' + id);
  if (elItem) elItem.classList.add('activo');

  document.getElementById('panel-detalle-lote').style.display = '';
}

function cerrarDetalle() {
  document.getElementById('panel-detalle-lote').style.display = 'none';
  loteSeleccionadoId = null;
  document.querySelectorAll('.lote-item').forEach(el => el.classList.remove('activo'));
}

function nuevaAplicacionDesdeLote() {
  const lote = lotesGuardados.find(l => l.id === loteSeleccionadoId);
  if (!lote) return;
  // Navegar al registro y prellenar
  showTabById('registro');
  document.getElementById('reg-lote').value = lote.nombre + (lote.estab ? ' â€” ' + lote.estab : '');
  document.getElementById('reg-ha').value = lote.sup;
  toast('ðŸ“‹ Registro prellenado con "' + lote.nombre + '"');
}

function showTabById(id) {
  document.querySelectorAll('.module-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t => {
    if (t.onclick && t.onclick.toString().includes("'" + id + "'")) t.classList.add('active');
  });
}

function renderListaLotes() {
  const lista = document.getElementById('lotes-lista');
  document.getElementById('lotes-count').textContent = lotesGuardados.length + ' lote' + (lotesGuardados.length !== 1 ? 's' : '');

  if (!lotesGuardados.length) {
    lista.innerHTML = '<p class="txt-muted" style="font-size:.78rem;text-align:center;padding:1rem">DibujÃ¡ tu primer lote usando el botÃ³n de arriba.</p>';
    return;
  }

  lista.innerHTML = lotesGuardados.map(l => {
    const apls = historial.filter(a => a.lote && a.lote.toLowerCase().includes(l.nombre.toLowerCase()));
    return `
      <div class="lote-item" id="lote-item-${l.id}" onclick="irALote(${l.id})">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem">
          <div>
            <div class="lote-nombre">
              <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${l.color};margin-right:.3rem;vertical-align:middle"></span>
              ${l.nombre}
            </div>
            <div class="lote-meta">${l.estab ? l.estab + ' Â· ' : ''}${l.sup} ha Â· ${apls.length} aplicacion${apls.length !== 1 ? 'es' : ''}</div>
          </div>
        </div>
        <div class="lote-acciones">
          <button class="lote-btn-sm" onclick="event.stopPropagation();mostrarDetalleLote(${l.id})">ðŸ“‹ Historial</button>
          <button class="lote-btn-sm" onclick="event.stopPropagation();irALote(${l.id})">ðŸ—º Ver</button>
          <button class="lote-btn-sm danger" onclick="event.stopPropagation();eliminarLote(${l.id})">ðŸ—‘</button>
        </div>
      </div>`;
  }).join('');
}

function irALote(id) {
  const lote = lotesGuardados.find(l => l.id === id);
  if (!lote || !mapaObj) return;
  mapaObj.fitBounds(L.polygon(lote.puntos).getBounds(), { padding:[30,30] });
  mostrarDetalleLote(id);
}

function eliminarLote(id) {
  const lote = lotesGuardados.find(l => l.id === id);
  if (!lote || !confirm('Â¿Eliminar el lote "' + lote.nombre + '"?')) return;
  if (mapaLayers[id]) { mapaObj.removeLayer(mapaLayers[id]); delete mapaLayers[id]; }
  lotesGuardados = lotesGuardados.filter(l => l.id !== id);
  localStorage.setItem('lotes-mapa', JSON.stringify(lotesGuardados));
  renderListaLotes();
  if (loteSeleccionadoId === id) cerrarDetalle();
}

function centrarGPS() {
  if (!mapaObj) return;
  const lat = STATE.lat || -31.42;
  const lon = STATE.lon || -64.18;
  mapaObj.setView([lat, lon], 14);
}

function toggleSatelite() {
  if (!mapaObj) return;
  mapaSateliteActivo = !mapaSateliteActivo;
  if (mapaSateliteActivo) {
    mapaCapaOsm.remove();
    mapaCapaSatelite.addTo(mapaObj);
    document.querySelector('[onclick="toggleSatelite()"]').classList.add('active');
  } else {
    mapaCapaSatelite.remove();
    mapaCapaOsm.addTo(mapaObj);
    document.querySelector('[onclick="toggleSatelite()"]').classList.remove('active');
  }
}

// â”€â”€ Utilidades geomÃ©tricas â”€â”€
function calcSuperficieHa(puntos) {
  // FÃ³rmula de Gauss (Shoelace) en coordenadas lat/lon â†’ mÂ² â†’ ha
  // AproximaciÃ³n local con factor de conversiÃ³n
  let area = 0;
  const n = puntos.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += puntos[i][1] * puntos[j][0];
    area -= puntos[j][1] * puntos[i][0];
  }
  area = Math.abs(area) / 2;
  // ConversiÃ³n: 1 grado lat â‰ˆ 111320 m, 1 grado lon â‰ˆ 111320 * cos(lat) m
  const latMedia = puntos.reduce((s, p) => s + p[0], 0) / n;
  const factorLat = 111320;
  const factorLon = 111320 * Math.cos(latMedia * Math.PI / 180);
  const areaM2 = area * factorLat * factorLon;
  return areaM2 / 10000; // â†’ hectÃ¡reas
}

function calcCentroide(puntos) {
  const lat = puntos.reduce((s, p) => s + p[0], 0) / puntos.length;
  const lng = puntos.reduce((s, p) => s + p[1], 0) / puntos.length;
  return [lat, lng];
}

const COLORES_LOTE = ['#3A7AB8','#2A7A4A','#B87A20','#7A3AB8','#C0392B','#16A085','#8E44AD','#2E86C1'];
let colorIdx = 0;
function colorLote() { return COLORES_LOTE[colorIdx++ % COLORES_LOTE.length]; }

// Inicializar mapa cuando se activa el tab

// â•â•â• EVALUACIÃ“N DE COBERTURA EN CANOPEO â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Estado global del mÃ³dulo
const CANOPEO = {
  modo: 'barbecho',
  // Cada posiciÃ³n: array de 3 repeticiones { base64, mime, resultado }
  barbecho: [ null, null, null ],
  superior: [ null, null, null ],
  medio:    [ null, null, null ],
  inferior: [ null, null, null ],
};

// â”€â”€ Sub-navegaciÃ³n â”€â”€
function setCanopeoModo(modo) {
  CANOPEO.modo = modo;
  ['barbecho','canopeo','sintesis'].forEach(m => {
    document.getElementById('canopeo-' + m).style.display = m === modo ? '' : 'none';
    document.getElementById('cansub-' + m).classList.toggle('active', m === modo);
  });
  if (modo === 'sintesis') generarSintesis();
}

// â”€â”€ Renderizar celdas de repeticiÃ³n â”€â”€
function renderReps(posicion) {
  const container = document.getElementById('reps-' + posicion);
  if (!container) return;
  container.innerHTML = CANOPEO[posicion].map((rep, i) => {
    const cls = rep ? (rep.resultado ? 'analizada' : 'cargada') : '';
    return '<div class="rep-cell ' + cls + '" id="rep-' + posicion + '-' + i + '">' +
      '<input type="file" accept="image/*" capture="environment" ' +
        'onchange="cargarRepFoto(event,' + JSON.stringify(posicion) + ',' + i + ')">' +
      (rep && rep.thumb ?
        '<img class="rep-thumb" src="' + rep.thumb + '" alt="Rep ' + (i+1) + '">' : '') +
      '<div class="rep-label">Rep ' + (i+1) + '</div>' +
      (rep && rep.resultado ?
        '<div class="rep-result" style="color:' + (rep.resultado.cumple_objetivo ? 'var(--ok)' : 'var(--caution)') + '">' +
          rep.resultado.impactos_cm2 + ' g/cmÂ²</div>' : '') +
      (rep && !rep.resultado && rep.base64 ?
        '<div class="rep-spinner">â³</div>' : '') +
      (!rep ? '<div style="font-size:1.3rem">ðŸ“·</div>' : '') +
    '</div>';
  }).join('');
}

function initReps() {
  ['barbecho','superior','medio','inferior'].forEach(pos => renderReps(pos));
}

// â”€â”€ Cargar foto en una repeticiÃ³n â”€â”€
function cargarRepFoto(event, posicion, idx) {
  const file = event.target.files[0];
  if (!file) return;
  const mime = file.type || 'image/jpeg';
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const base64 = dataUrl.split(',')[1];
    CANOPEO[posicion][idx] = { base64, mime, thumb: dataUrl, resultado: null };
    renderReps(posicion);
    // Actualizar borde del slot
    const slot = document.getElementById('slot-' + posicion);
    if (slot) slot.classList.add('cargada');
  };
  reader.readAsDataURL(file);
}

// â”€â”€ Analizar una repeticiÃ³n individual via Claude Vision â”€â”€
async function analizarRep(posicion, idx, tipoAplic) {
  const rep = CANOPEO[posicion][idx];
  if (!rep || !rep.base64) return null;

  const obj = IMPACTOS_OBJETIVO[tipoAplic];
  const posLabel = { barbecho:'suelo/barbecho', superior:'superior del canopeo',
                     medio:'1/3 medio del canopeo', inferior:'1/3 inferior del canopeo' }[posicion];

  const condMeteo = STATE.meteo
    ? 'Condiciones: T=' + STATE.meteo.temperature_2m + 'Â°C, HR=' +
      STATE.meteo.relative_humidity_2m + '%, viento=' + STATE.meteo.wind_speed_10m + ' km/h. '
    : '';

  const prompt = 'Sos experto en anÃ¡lisis de tarjetas hidrosensibles. Esta tarjeta fue colocada en la posiciÃ³n ' +
    posLabel + ' para evaluar cobertura de pulverizaciÃ³n agrÃ­cola. ' +
    'AplicaciÃ³n: ' + obj.label + ' (objetivo FAO: ' + obj.min + 'â€“' + obj.max + ' gotas/cmÂ²). ' +
    condMeteo +
    'RespondÃ© ÃšNICAMENTE con JSON sin texto adicional ni backticks: ' +
    '{"impactos_cm2":<int>,"vmd_estimado":<int>,"cobertura_pct":<float>,' +
    '"distribucion":"<uniforme|irregular|muy_irregular>",' +
    '"confianza":"<alta|media|baja>","cumple_objetivo":<bool>,' +
    '"lha_estimado":<float>}';

  try {
    const res = await pulvClaude({
      model:'claude-sonnet-4-5',
      max_tokens:400,
      messages:[{
        role:'user',
        content:[
          { type:'image', source:{ type:'base64', media_type:rep.mime, data:rep.base64 } },
          { type:'text', text:prompt }
        ]
      }]
    });
    const data = await res.json();
    const txt = data.content?.[0]?.text || '';
    const clean = txt.replace(/```json|```/g,'').trim();
    const resultado = JSON.parse(clean);

    // Calcular L/ha desde fÃ³rmula Leiva si no viene en la respuesta
    if (!resultado.lha_estimado && resultado.impactos_cm2 && resultado.vmd_estimado) {
      resultado.lha_estimado = parseFloat(
        ((Math.pow(resultado.vmd_estimado,3) * resultado.impactos_cm2 * Math.PI) / 6e7).toFixed(1)
      );
    }

    CANOPEO[posicion][idx].resultado = resultado;
    renderReps(posicion);
    return resultado;
  } catch(e) {
    console.error('Error analizando rep', posicion, idx, e);
    return null;
  }
}

// â”€â”€ Promediar resultados de una posiciÃ³n â”€â”€
function promediarPosicion(posicion) {
  const reps = CANOPEO[posicion].filter(r => r && r.resultado);
  if (!reps.length) return null;

  const n = reps.length;
  const impactos = reps.map(r => r.resultado.impactos_cm2);
  const vmd = reps.map(r => r.resultado.vmd_estimado);
  const cob = reps.map(r => r.resultado.cobertura_pct);
  const lha = reps.map(r => r.resultado.lha_estimado || 0);

  const avg = arr => arr.reduce((a,b) => a+b, 0) / n;
  const cv = arr => {
    const m = avg(arr);
    if (m === 0) return 0;
    const sd = Math.sqrt(arr.reduce((s,x) => s + Math.pow(x-m,2), 0) / n);
    return parseFloat((sd/m*100).toFixed(1));
  };

  return {
    impactos_avg: Math.round(avg(impactos)),
    impactos_cv:  cv(impactos),
    vmd_avg:      Math.round(avg(vmd)),
    cobertura_avg:parseFloat(avg(cob).toFixed(1)),
    lha_avg:      parseFloat(avg(lha).toFixed(1)),
    n_reps:       n,
    cumple: reps.every(r => r.resultado.cumple_objetivo),
  };
}

// â”€â”€ Mostrar stats en slot â”€â”€
function mostrarStatsSlot(posicion, stats) {
  if (!stats) return;
  const bar = document.getElementById('resultado-' + posicion);
  const statsEl = document.getElementById('stats-' + posicion);
  if (!bar || !statsEl) return;
  bar.style.display = '';

  const colorImp = stats.cumple ? 'var(--ok)' : stats.impactos_avg > 0 ? 'var(--caution)' : 'var(--red)';
  statsEl.innerHTML =
    '<div class="slot-stat"><div class="slot-stat-val" style="color:' + colorImp + '">' + stats.impactos_avg + '</div><div class="slot-stat-lbl">g/cmÂ²</div></div>' +
    '<div class="slot-stat"><div class="slot-stat-val">' + stats.vmd_avg + '</div><div class="slot-stat-lbl">VMD Âµm</div></div>' +
    '<div class="slot-stat"><div class="slot-stat-val">' + stats.cobertura_avg + '%</div><div class="slot-stat-lbl">Cobertura</div></div>' +
    '<div class="slot-stat"><div class="slot-stat-val">' + stats.lha_avg + '</div><div class="slot-stat-lbl">L/ha</div></div>';

  const slot = document.getElementById('slot-' + posicion);
  if (slot) { slot.classList.remove('cargada'); slot.classList.add('analizada'); }
}

// â”€â”€ Analizar todas â€” Barbecho â”€â”€
async function analizarTodosBarbecho() {
  const tipo = document.getElementById('barb-tipo-aplic').value;
  const obj = IMPACTOS_OBJETIVO[tipo];
  const btn = document.querySelector('[onclick="analizarTodosBarbecho()"]');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:.4rem"></div> Analizando...';

  for (let i = 0; i < 3; i++) {
    if (CANOPEO.barbecho[i] && CANOPEO.barbecho[i].base64) {
      await analizarRep('barbecho', i, tipo);
    }
  }

  const stats = promediarPosicion('barbecho');
  mostrarStatsSlot('barbecho', stats);

  if (stats) {
    // Cotejo con teÃ³rico
    const teorico = {
      lha: parseFloat(document.getElementById('res-lha')?.textContent) || null,
      impactos: parseInt(document.getElementById('cob-impactos-slider')?.value) || null,
      vmd: parseInt(document.getElementById('cob-vmd-objetivo')?.value) || null,
    };

    document.getElementById('barb-placeholder').style.display = 'none';
    document.getElementById('resultado-barbecho-panel').style.display = '';

    document.getElementById('barb-stats-resultado').innerHTML =
      '<div class="ia-stat"><div class="ia-stat-val" style="color:' + (stats.cumple?'#6DBF82':'var(--amber)') + '">' + stats.impactos_avg + '</div><div class="ia-stat-lbl">Gotas/cmÂ² prom.</div></div>' +
      '<div class="ia-stat"><div class="ia-stat-val">' + stats.lha_avg + '</div><div class="ia-stat-lbl">L/ha reales</div></div>' +
      '<div class="ia-stat"><div class="ia-stat-val">' + stats.vmd_avg + ' Âµm</div><div class="ia-stat-lbl">VMD real</div></div>' +
      '<div class="ia-stat"><div class="ia-stat-val" style="color:' + (stats.impactos_cv <= 30?'#6DBF82':stats.impactos_cv<=50?'var(--amber)':'#E8604A') + '">' + stats.impactos_cv + '%</div><div class="ia-stat-lbl">CV% reps</div></div>';

    // Cotejo teÃ³rico vs real
    if (teorico.lha) {
      const deltaLha = parseFloat(((stats.lha_avg - teorico.lha) / teorico.lha * 100).toFixed(1));
      const deltaImp = teorico.impactos ? parseFloat(((stats.impactos_avg - teorico.impactos) / teorico.impactos * 100).toFixed(1)) : null;
      const clsDelta = d => Math.abs(d) <= 10 ? 'ok' : Math.abs(d) <= 20 ? 'warn' : 'bad';

      document.getElementById('barb-cotejo-teorico').innerHTML =
        '<div class="cotejo-card">' +
        '<div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,253,248,.3);margin-bottom:.6rem">Cotejo teÃ³rico vs real</div>' +
        '<div class="cotejo-row"><span class="cotejo-label">L/ha</span><div class="cotejo-vals"><span class="cotejo-teorico">TeÃ³r: ' + teorico.lha + '</span><span class="cotejo-real">Real: ' + stats.lha_avg + '</span><span class="cotejo-delta ' + clsDelta(deltaLha) + '">' + (deltaLha > 0 ? '+' : '') + deltaLha + '%</span></div></div>' +
        (deltaImp !== null ? '<div class="cotejo-row"><span class="cotejo-label">Gotas/cmÂ²</span><div class="cotejo-vals"><span class="cotejo-teorico">TeÃ³r: ' + teorico.impactos + '</span><span class="cotejo-real">Real: ' + stats.impactos_avg + '</span><span class="cotejo-delta ' + clsDelta(deltaImp) + '">' + (deltaImp > 0 ? '+' : '') + deltaImp + '%</span></div></div>' : '') +
        '</div>';

      // Ajustes sugeridos
      const ajustes = generarAjustesBarbecho(stats, teorico, deltaLha, deltaImp, obj);
      document.getElementById('barb-ajustes-sugeridos').innerHTML = ajustes;
    }
  }

  btn.disabled = false;
  btn.innerHTML = 'ðŸ”„ Volver a analizar';
}

function generarAjustesBarbecho(stats, teorico, deltaLha, deltaImp, obj) {
  const sugs = [];

  if (deltaLha < -15) {
    sugs.push({ ico:'ðŸ’§', tipo:'Aumentar caudal', txt:'El caudal real (' + stats.lha_avg + ' L/ha) estÃ¡ ' + Math.abs(deltaLha) + '% por debajo del teÃ³rico. Opciones: reducir velocidad de avance, aumentar presiÃ³n de trabajo, o usar una boquilla de mayor ISO.' });
  } else if (deltaLha > 15) {
    sugs.push({ ico:'ðŸ’§', tipo:'Reducir caudal', txt:'El caudal real supera el teÃ³rico en ' + deltaLha + '%. Opciones: aumentar velocidad de avance o reducir presiÃ³n.' });
  }

  if (stats.impactos_avg < obj.min) {
    const lhaNecesario = ((Math.pow(stats.vmd_avg,3) * obj.min * Math.PI) / 6e7).toFixed(1);
    sugs.push({ ico:'ðŸŽ¯', tipo:'Cobertura insuficiente', txt:'Se necesitan ' + obj.min + ' gotas/cmÂ² mÃ­nimo. Con VMD actual de ' + stats.vmd_avg + ' Âµm necesitÃ¡s ' + lhaNecesario + ' L/ha. O reducir VMD para lograr mÃ¡s impactos con igual caudal.' });
  }

  if (stats.impactos_cv > 30) {
    sugs.push({ ico:'ðŸ“Š', tipo:'DistribuciÃ³n irregular', txt:'CV% de ' + stats.impactos_cv + '% entre repeticiones indica distribuciÃ³n no uniforme. Verificar boquillas tapadas, presiÃ³n inestable o velocidad variable.' });
  }

  if (!sugs.length) {
    return '<div class="ajuste-sugerido"><span style="font-size:1.1rem">âœ…</span><div><div class="ajuste-tipo" style="color:#6DBF82">Sin ajustes requeridos</div><div class="ajuste-texto">Los parÃ¡metros reales estÃ¡n dentro del rango aceptable respecto al teÃ³rico.</div></div></div>';
  }

  return sugs.map(s =>
    '<div class="ajuste-sugerido"><span style="font-size:1.1rem">' + s.ico + '</span>' +
    '<div><div class="ajuste-tipo" style="color:var(--amber)">' + s.tipo + '</div>' +
    '<div class="ajuste-texto">' + s.txt + '</div></div></div>'
  ).join('');
}

// â”€â”€ Analizar todos los estratos del canopeo â”€â”€
async function analizarTodosCanopeo() {
  const tipo = document.getElementById('can-tipo-aplic').value;
  const btn = document.querySelector('[onclick="analizarTodosCanopeo()"]');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:.4rem"></div> Analizando estratos...';

  for (const pos of ['superior','medio','inferior']) {
    for (let i = 0; i < 3; i++) {
      if (CANOPEO[pos][i] && CANOPEO[pos][i].base64) {
        await analizarRep(pos, i, tipo);
      }
    }
    const stats = promediarPosicion(pos);
    mostrarStatsSlot(pos, stats);
  }

  btn.disabled = false;
  btn.innerHTML = 'âœ… Analizados â€” ver SÃ­ntesis';
  toast('âœ… AnÃ¡lisis de canopeo completado â€” ir a SÃ­ntesis para ver resultados');
}

// â”€â”€ SÃ­ntesis general â”€â”€
function generarSintesis() {
  const statsBarbecho  = promediarPosicion('barbecho');
  const statsSuperior  = promediarPosicion('superior');
  const statsMedio     = promediarPosicion('medio');
  const statsInferior  = promediarPosicion('inferior');

  const tieneCanopeo = statsSuperior || statsMedio || statsInferior;
  const tieneBarbecho = statsBarbecho;

  if (!tieneCanopeo && !tieneBarbecho) {
    document.getElementById('sintesis-placeholder').style.display = '';
    document.getElementById('sintesis-contenido').style.display = 'none';
    return;
  }

  document.getElementById('sintesis-placeholder').style.display = 'none';
  document.getElementById('sintesis-contenido').style.display = '';

  let html = '';

  // â”€â”€ Barbecho â”€â”€
  if (tieneBarbecho) {
    const tipo = document.getElementById('barb-tipo-aplic')?.value || 'herb_sistemico';
    const obj = IMPACTOS_OBJETIVO[tipo];
    html += '<div style="margin-bottom:1.5rem">' +
      '<div style="font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,253,248,.3);margin-bottom:.8rem">Barbecho / Suelo</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem">' +
      statCard(statsBarbecho.impactos_avg, 'Gotas/cmÂ²', statsBarbecho.cumple ? '#6DBF82' : 'var(--amber)') +
      statCard(statsBarbecho.lha_avg, 'L/ha reales', 'rgba(255,253,248,.8)') +
      statCard(statsBarbecho.vmd_avg + ' Âµm', 'VMD real', 'rgba(255,253,248,.8)') +
      statCard(statsBarbecho.impactos_cv + '%', 'CV%', statsBarbecho.impactos_cv<=30?'#6DBF82':statsBarbecho.impactos_cv<=50?'var(--amber)':'#E8604A') +
      '</div></div>';
  }

  // â”€â”€ Canopeo â”€â”€
  if (tieneCanopeo) {
    const posiciones = [
      { key:'superior', label:'Superior', stats:statsSuperior, color:'#7ABAEE' },
      { key:'medio',    label:'Medio',    stats:statsMedio,    color:'var(--amber)' },
      { key:'inferior', label:'Inferior', stats:statsInferior, color:'#E8604A' },
    ].filter(p => p.stats);

    html += '<div style="font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,253,248,.3);margin-bottom:.8rem">Estratos del Canopeo</div>';

    // Tabla comparativa
    html += '<div style="background:rgba(255,255,255,.04);border-radius:12px;overflow:hidden;margin-bottom:1.2rem">' +
      '<div style="display:grid;grid-template-columns:auto repeat(4,1fr);gap:0">' +
      '<div style="padding:.6rem .8rem;font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,253,248,.25);border-bottom:1px solid rgba(255,255,255,.06)">Estrato</div>' +
      '<div style="padding:.6rem;text-align:center;font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,253,248,.25);border-bottom:1px solid rgba(255,255,255,.06)">Gotas/cmÂ²</div>' +
      '<div style="padding:.6rem;text-align:center;font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,253,248,.25);border-bottom:1px solid rgba(255,255,255,.06)">L/ha</div>' +
      '<div style="padding:.6rem;text-align:center;font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,253,248,.25);border-bottom:1px solid rgba(255,255,255,.06)">VMD Âµm</div>' +
      '<div style="padding:.6rem;text-align:center;font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,253,248,.25);border-bottom:1px solid rgba(255,255,255,.06)">CV%</div>' +
      posiciones.map(p =>
        '<div style="padding:.6rem .8rem;font-size:.78rem;font-weight:700;color:' + p.color + ';border-bottom:1px solid rgba(255,255,255,.04)">' + p.label + '</div>' +
        '<div style="padding:.6rem;text-align:center;font-size:.82rem;font-family:DM Mono,monospace;color:' + (p.stats.cumple?'#6DBF82':'var(--amber)') + ';border-bottom:1px solid rgba(255,255,255,.04)">' + p.stats.impactos_avg + '</div>' +
        '<div style="padding:.6rem;text-align:center;font-size:.82rem;font-family:DM Mono,monospace;color:rgba(255,253,248,.8);border-bottom:1px solid rgba(255,255,255,.04)">' + p.stats.lha_avg + '</div>' +
        '<div style="padding:.6rem;text-align:center;font-size:.82rem;font-family:DM Mono,monospace;color:rgba(255,253,248,.8);border-bottom:1px solid rgba(255,255,255,.04)">' + p.stats.vmd_avg + '</div>' +
        '<div style="padding:.6rem;text-align:center;font-size:.82rem;font-family:DM Mono,monospace;color:' + (p.stats.impactos_cv<=30?'#6DBF82':p.stats.impactos_cv<=50?'var(--amber)':'#E8604A') + ';border-bottom:1px solid rgba(255,255,255,.04)">' + p.stats.impactos_cv + '%</div>'
      ).join('') +
      '</div></div>';

    // Barra de penetraciÃ³n
    if (statsSuperior && statsSuperior.lha_avg > 0) {
      const lhaSup = statsSuperior.lha_avg;
      const lhaMed = statsMedio ? statsMedio.lha_avg : 0;
      const lhaInf = statsInferior ? statsInferior.lha_avg : 0;
      const total = lhaSup + lhaMed + lhaInf || 1;
      const pSup = Math.round(lhaSup/total*100);
      const pMed = Math.round(lhaMed/total*100);
      const pInf = 100 - pSup - pMed;

      const efMed = lhaSup > 0 ? Math.round(lhaMed/lhaSup*100) : 0;
      const efInf = lhaSup > 0 ? Math.round(lhaInf/lhaSup*100) : 0;

      html += '<div style="margin-bottom:1.2rem">' +
        '<div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,253,248,.3);margin-bottom:.6rem">DistribuciÃ³n de L/ha por estrato</div>' +
        '<div class="penetracion-track">' +
        '<div class="pen-seg pen-sup" style="flex:' + pSup + '">' + lhaSup + ' L/ha</div>' +
        (lhaMed > 0 ? '<div class="pen-seg pen-medio" style="flex:' + pMed + '">' + lhaMed + ' L/ha</div>' : '') +
        (lhaInf > 0 ? '<div class="pen-seg pen-inf" style="flex:' + pInf + '">' + lhaInf + ' L/ha</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:1.5rem;margin-top:.5rem;font-size:.7rem;color:rgba(255,253,248,.4)">' +
        '<span style="color:#7ABAEE">â–  Superior ' + pSup + '%</span>' +
        (lhaMed > 0 ? '<span style="color:#2ECC71">â–  Medio ' + pMed + '% (ef: ' + efMed + '% del sup)</span>' : '') +
        (lhaInf > 0 ? '<span style="color:#E8604A">â–  Inferior ' + pInf + '% (ef: ' + efInf + '% del sup)</span>' : '') +
        '</div></div>';

      // InterpretaciÃ³n agronÃ³mica
      const interpHtml = interpretarPenetracion(efMed, efInf,
        document.getElementById('can-tipo-aplic')?.value || 'fung_sistemico',
        document.getElementById('can-cultivo-estadio')?.value || 'soja_v6');
      html += interpHtml;
    }
  }

  document.getElementById('sintesis-panel-principal').innerHTML = html;
}

function statCard(val, lbl, color) {
  return '<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:.8rem;text-align:center;border:1px solid rgba(255,255,255,.07)">' +
    '<div style="font-family:DM Mono,monospace;font-size:1.3rem;color:' + color + ';line-height:1">' + val + '</div>' +
    '<div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.09em;color:rgba(255,253,248,.3);margin-top:.2rem">' + lbl + '</div>' +
    '</div>';
}

function interpretarPenetracion(efMed, efInf, tipoAplic, cultivo) {
  const msgs = [];

  // Umbrales por tipo de aplicaciÃ³n
  const esContacto = tipoAplic.includes('contacto');
  const esFungicida = tipoAplic.includes('fung');

  if (esFungicida) {
    if (efInf < 20) {
      msgs.push({ ico:'ðŸš¨', cls:'bad', txt:'PenetraciÃ³n inferior muy baja (' + efInf + '% del estrato superior). Para fungicidas el 1/3 inferior es crÃ­tico â€” allÃ­ estÃ¡ el inÃ³culo. Aumentar volumen de caldo, reducir VMD o usar boquillas orientadas hacia abajo.' });
    } else if (efInf < 40) {
      msgs.push({ ico:'âš ï¸', cls:'warn', txt:'PenetraciÃ³n al estrato inferior moderada (' + efInf + '%). Considerar aumentar L/ha o evaluar uso de coadyuvante penetrante para mejorar cobertura en zona de mayor presiÃ³n de enfermedad.' });
    } else {
      msgs.push({ ico:'âœ…', cls:'ok', txt:'Buena penetraciÃ³n al estrato inferior (' + efInf + '% del superior). DistribuciÃ³n adecuada para fungicida.' });
    }
  }

  if (esContacto && efInf < 25) {
    msgs.push({ ico:'âš ï¸', cls:'warn', txt:'Para productos de contacto la cobertura del estrato inferior es clave. Con ' + efInf + '% de eficiencia inferior hay riesgo de escape de plagas/enfermedades en esa zona.' });
  }

  if (efMed < 30) {
    msgs.push({ ico:'ðŸ’§', cls:'warn', txt:'El estrato medio recibe solo ' + efMed + '% del caldo aplicado al superior. El canopeo intercepta mÃ¡s del 70% del producto antes de llegar al medio. Verificar Ã­ndice de Ã¡rea foliar y ajustar horario de aplicaciÃ³n.' });
  }

  const colores = { ok:'#6DBF82', warn:'var(--amber)', bad:'#E8604A' };
  return '<div style="border-top:1px solid rgba(255,255,255,.07);padding-top:1rem;margin-top:.5rem">' +
    '<div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,253,248,.3);margin-bottom:.7rem">InterpretaciÃ³n agronÃ³mica</div>' +
    msgs.map(m =>
      '<div style="display:flex;gap:.6rem;align-items:flex-start;margin-bottom:.6rem;padding:.65rem .8rem;background:rgba(255,255,255,.04);border-radius:10px;border:1px solid rgba(255,255,255,.06)">' +
      '<span style="font-size:1rem;flex-shrink:0">' + m.ico + '</span>' +
      '<div style="font-size:.78rem;color:rgba(255,253,248,.65);line-height:1.55">' + m.txt + '</div>' +
      '</div>'
    ).join('') +
    '</div>';
}

// â”€â”€â”€ INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
renderHistorial();
initGPS();
calcularAgua();
if (document.getElementById('cob-tipo-producto')) actualizarObjetivo();
if (document.getElementById('tarjeta-canvas')) initTarjetaCanvas();
if (document.getElementById('mezcla-slots')) initMezclaSlots();
renderCarencia();
initReps();
// Fecha default hoy
if (document.getElementById("car-fecha-aplic")) document.getElementById("car-fecha-aplic").value = new Date().toISOString().split("T")[0];
// Init canopeo
if (document.getElementById('posiciones-grid')) {
  renderPosiciones();
  setEscenario('barbecho');
}



function pulvInit() {
  if(typeof renderHistorial === 'function') renderHistorial();
  if(typeof initGPS === 'function') initGPS();
  if(typeof calcularAgua === 'function') calcularAgua();
  if(document.getElementById('cob-tipo-producto') && typeof actualizarObjetivo === 'function') actualizarObjetivo();
  if(document.getElementById('tarjeta-canvas') && typeof initTarjetaCanvas === 'function') initTarjetaCanvas();
  if(document.getElementById('mezcla-slots') && typeof initMezclaSlots === 'function') initMezclaSlots();
  if(typeof renderCarencia === 'function') renderCarencia();
  if(typeof initReps === 'function') initReps();
  try { document.getElementById('car-fecha-aplic').value = new Date().toISOString().split('T')[0]; } catch(e){}
  if(document.getElementById('posiciones-grid') && typeof renderPosiciones === 'function') renderPosiciones();
  if(document.getElementById('posiciones-grid') && typeof setEscenario === 'function') setEscenario('barbecho');
}

// Iniciar de forma diferida si es importado o de inmediato si ya estÃ¡bamos.
setTimeout(() => { if(typeof pulvInit === 'function') pulvInit(); }, 100);

// â”€â”€ ALIASES GLOBALES â€” index.html usa estos nombres â”€â”€â”€â”€â”€â”€â”€â”€
window.pulvTab = function(id, btn) {
  document.querySelectorAll('.pulv-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.pulv-tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById('pulv-' + id);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
};
window.pulvShowTab         = (id) => showTab(id);
window.pulvCalcAgua        = () => calcularAgua();
window.pulvCalcBuffer      = () => calcBuffer();
window.pulvActualizarProductos = () => actualizarProductos();
window.pulvCalcCaldo       = () => calcCaldo();
window.pulvGuardarRegistro = () => guardarRegistro();
window.pulvExportarPDF     = () => exportarPDF();
window.pulvLimpiarHistorial= () => limpiarHistorial();
window.pulvFuentePH        = (el, val) => setFuente(el, val);
window.pulvSetProdAgua     = (el, prod) => setProductoAgua(el, prod);
window.pulvActualizarPH    = (val) => actualizarPHManual(val);
window.pulvSincronizarCE   = () => sincronizarCE();
window.pulvRenderHistorial = () => renderHistorial();
if(typeof renderHRAC === 'function') window.pulvRenderHRAC      = () => renderHRAC();
window.pulvFiltrarHRAC = () => filtrarHRAC();
window.pulvAbrirHRACModal = (id) => abrirHRACModal(id);
window.pulvInitGPS = () => initGPS();
window.pulvEnviarMensaje = () => enviarMensaje();

})();
