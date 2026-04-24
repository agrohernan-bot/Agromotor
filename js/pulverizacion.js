// Módulo Pulverización - Integrado


// ─── ESTADO GLOBAL ────────────────────────────────────────
let STATE = {
  lat: null, lon: null,
  meteo: null,       // datos open-meteo actuales
  hourly: null,      // pronóstico horario
};

// ─── TABS ─────────────────────────────────────────────────
function showTab(id) {
  document.querySelectorAll('.module-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  event.currentTarget.classList.add('active');
  // Inicializar mapa si corresponde
  if (id === 'mapa') {
    setTimeout(() => {
      initMapa();
      if (mapaObj) mapaObj.invalidateSize();
    }, 100);
  }
}

// ─── HORA HEADER ──────────────────────────────────────────
function tickHora() {
  const el = document.getElementById('hora-header');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'});
  el.style.display = 'block';
}
setInterval(tickHora, 1000); tickHora();

// ─── GPS ──────────────────────────────────────────────────
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
    setGPSState('ok', `Coordenadas del lote: <strong>${STATE.lat.toFixed(4)}°, ${STATE.lon.toFixed(4)}°</strong>`);
    document.getElementById('btn-refresh').style.display = '';
    fetchMeteo();
    return;
  }
  setGPSState('loading', 'Obteniendo ubicación GPS...');
  if (!navigator.geolocation) {
    setGPSState('error', 'GPS no disponible en este dispositivo');
    usarUbicacionDefault();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      STATE.lat = pos.coords.latitude;
      STATE.lon = pos.coords.longitude;
      setGPSState('ok', `Ubicación: <strong>${STATE.lat.toFixed(4)}°, ${STATE.lon.toFixed(4)}°</strong> — Precisión: ±${Math.round(pos.coords.accuracy)} m`);
      document.getElementById('btn-refresh').style.display = '';
      fetchMeteo();
    },
    err => {
      setGPSState('error', 'No se pudo obtener GPS — usando ubicación de referencia (Córdoba)');
      usarUbicacionDefault();
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function usarUbicacionDefault() {
  // Intentar coordenadas del Dashboard antes de usar Córdoba
  var dashCoord = _parsCoordDashboard();
  if (dashCoord) {
    STATE.lat = dashCoord.lat; STATE.lon = dashCoord.lon;
    setGPSState('ok', `Coordenadas del lote: <strong>${STATE.lat.toFixed(4)}°, ${STATE.lon.toFixed(4)}°</strong>`);
  } else {
    STATE.lat = -31.42; STATE.lon = -64.18; // Córdoba fallback
    setGPSState('ok', 'Ubicación de referencia: <strong>Córdoba capital</strong> — Ingresá coordenadas en el Dashboard para datos locales');
  }
  document.getElementById('btn-refresh').style.display = '';
  fetchMeteo();
}

// Llamada desde nav.js al activar el módulo
window.pulvRefrescarMeteo = function() {
  var dashCoord = _parsCoordDashboard();
  if (dashCoord) { STATE.lat = dashCoord.lat; STATE.lon = dashCoord.lon; }
  if (STATE.lat) fetchMeteo();
};

function setGPSState(st, txt) {
  const dot = document.getElementById('gps-dot');
  const textEl = document.getElementById('gps-text');
  dot.className = 'gps-dot' + (st === 'loading' ? ' loading' : st === 'error' ? ' error' : '');
  textEl.innerHTML = txt;
}

// ─── FETCH OPEN-METEO ────────────────────────────────────
async function fetchMeteo() {
  if (!STATE.lat) return;
  document.getElementById('sem-loading').style.display = 'flex';
  document.getElementById('sem-content').style.display = 'none';
  document.getElementById('ventana-card').style.display = 'none';

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
    document.getElementById('sem-loading').innerHTML = `
      <div style="color:var(--warn);text-align:center;padding:2rem">
        ⚠️ Error al conectar con Open-Meteo. Verificá tu conexión a internet.
      </div>`;
  }
}

// ─── RENDER SEMÁFORO ──────────────────────────────────────
function renderSemaforo(c) {
  const temp    = c.temperature_2m;
  const hr      = c.relative_humidity_2m;
  const viento  = c.wind_speed_10m;
  const rafagas = c.wind_gusts_10m;
  const pp      = c.precipitation;
  const pp_prob = c.precipitation_probability;
  const rocio   = c.dew_point_2m;

  // ── EVALUAR CONDICIONES ──
  const alertas = [];
  let score = 0; // 0=verde, 1=amarillo, 2=rojo

  // Viento
  if (viento > 25)      { score = Math.max(score, 2); alertas.push({ ico:'🚫', txt:`<strong>Viento excesivo (${viento} km/h):</strong> Riesgo alto de deriva. Suspender aplicación.`, sev:'rojo' }); }
  else if (viento > 15) { score = Math.max(score, 1); alertas.push({ ico:'⚠️', txt:`<strong>Viento moderado (${viento} km/h):</strong> Operar con precaución, evaluar boquillas antideriva.`, sev:'amarillo' }); }
  else if (viento < 3)  { score = Math.max(score, 1); alertas.push({ ico:'⚠️', txt:`<strong>Viento muy bajo (${viento} km/h):</strong> Posible inversión térmica. Riesgo de gotas en suspensión.`, sev:'amarillo' }); }
  else                  { alertas.push({ ico:'✅', txt:`<strong>Viento óptimo (${viento} km/h):</strong> Condición favorable para la aplicación.`, sev:'verde' }); }

  // Ráfagas
  if (rafagas > 30) { score = Math.max(score, 2); alertas.push({ ico:'💨', txt:`<strong>Ráfagas de ${rafagas} km/h:</strong> Peligro de deriva severa. No aplicar.`, sev:'rojo' }); }

  // Temperatura
  if (temp > 32)    { score = Math.max(score, 2); alertas.push({ ico:'🌡', txt:`<strong>Temperatura alta (${temp}°C):</strong> Volatilización severa, especialmente de hormonales. Suspender.`, sev:'rojo' }); }
  else if (temp > 28) { score = Math.max(score, 1); alertas.push({ ico:'🌡', txt:`<strong>Temperatura elevada (${temp}°C):</strong> Posible volatilización de herbicidas. Vigilar.`, sev:'amarillo' }); }
  else if (temp < 8) { score = Math.max(score, 1); alertas.push({ ico:'❄️', txt:`<strong>Temperatura baja (${temp}°C):</strong> Metabolismo foliar lento, reducir absorción de herbicidas sistémicos.`, sev:'amarillo' }); }
  else              { alertas.push({ ico:'✅', txt:`<strong>Temperatura óptima (${temp}°C):</strong> Condición favorable para absorción foliar.`, sev:'verde' }); }

  // Humedad relativa
  if (hr < 40)     { score = Math.max(score, 2); alertas.push({ ico:'🏜', txt:`<strong>HR muy baja (${hr}%):</strong> Alta evaporación de gotas, deriva aumentada. No apto.`, sev:'rojo' }); }
  else if (hr < 55) { score = Math.max(score, 1); alertas.push({ ico:'💧', txt:`<strong>HR baja (${hr}%):</strong> Mayor evaporación de gotas. Aumentar volumen de caldo.`, sev:'amarillo' }); }
  else if (hr > 90) { alertas.push({ ico:'🌫', txt:`<strong>HR muy alta (${hr}%):</strong> Riesgo de hongos y lavado. Verificar fitotoxicidad del producto.`, sev:'info' }); }
  else              { alertas.push({ ico:'✅', txt:`<strong>Humedad adecuada (${hr}%):</strong> Buenas condiciones para la deposición del caldo.`, sev:'verde' }); }

  // Lluvia
  if (pp > 0)      { score = Math.max(score, 2); alertas.push({ ico:'🌧', txt:`<strong>Lluvia activa (${pp} mm):</strong> Suspender inmediatamente la aplicación.`, sev:'rojo' }); }
  else if (pp_prob > 40) { score = Math.max(score, 1); alertas.push({ ico:'⛅', txt:`<strong>Probabilidad de lluvia: ${pp_prob}%:</strong> Riesgo de lavado. Verificar periodo libre de lluvia del producto.`, sev:'amarillo' }); }

  // Inversión térmica nocturna (aproximación: hora + temp ~ rocío)
  const hora = new Date().getHours();
  const deltaTD = temp - rocio;
  if ((hora >= 20 || hora <= 7) && deltaTD < 3) {
    score = Math.max(score, 1);
    alertas.push({ ico:'🌙', txt:`<strong>Posible inversión térmica:</strong> Horario nocturno con baja diferencia T° - rocío (${deltaTD.toFixed(1)}°C). Riesgo de gotas en suspensión y deriva a distancia.`, sev:'amarillo' });
  }

  // ── DEFINIR ESTADO FINAL ──
  const estados = [
    { cls:'verde',    emoji:'✅', txt:'APTO PARA APLICAR',        color:'var(--ok)',      desc:`Las condiciones meteorológicas actuales son favorables para realizar aplicaciones. Seguí las buenas prácticas y verificá cada 30 minutos.` },
    { cls:'amarillo', emoji:'⚠️', txt:'APLICAR CON PRECAUCIÓN',   color:'var(--caution)', desc:`Hay factores que requieren atención. Podés aplicar con precauciones adicionales. Leé las alertas y ajustá el equipo.` },
    { cls:'rojo',     emoji:'🚫', txt:'NO APTO — SUSPENDER',      color:'var(--red)',     desc:`Las condiciones actuales no son aptas para pulverizar. Existe riesgo de deriva, pérdida de eficacia o fitotoxicidad. Esperá mejores condiciones.` },
  ];
  const e = estados[score];

  document.getElementById('sem-estado-txt').textContent = e.txt;
  document.getElementById('sem-estado-txt').style.color = e.color;
  document.getElementById('sem-desc-txt').textContent = e.desc;
  const badge = document.getElementById('sem-badge');
  badge.className = 'semaforo-badge ' + e.cls;
  document.getElementById('sem-emoji').textContent = e.emoji;
  document.getElementById('sem-badge-txt').textContent = e.cls.toUpperCase();

  // ── GRILLA VARIABLES ──
  const dirLabel = gradosADireccion(c.wind_direction_10m);
  const variables = [
    { var:'Temperatura', val: temp.toFixed(1), unit:'°C', st: temp>32?'warn': temp>28?'caution':'ok' },
    { var:'Humedad rel.', val: hr, unit:'%', st: hr<40?'warn': hr<55?'caution':'ok' },
    { var:'Viento', val: viento.toFixed(1), unit:'km/h', st: viento>25?'warn': viento>15||viento<3?'caution':'ok' },
    { var:'Ráfagas', val: rafagas.toFixed(1), unit:'km/h', st: rafagas>30?'warn': rafagas>20?'caution':'ok' },
    { var:'Dirección', val: dirLabel, unit:'', st:'info' },
    { var:'Punto de rocío', val: rocio.toFixed(1), unit:'°C', st:'info' },
    { var:'Prob. lluvia', val: pp_prob, unit:'%', st: pp_prob>50?'warn': pp_prob>25?'caution':'ok' },
    { var:'Nubosidad', val: c.cloud_cover, unit:'%', st:'info' },
  ];
  const grid = document.getElementById('meteo-grid');
  grid.innerHTML = variables.map(v => `
    <div class="meteo-cell">
      <div class="meteo-var">${v.var}</div>
      <div class="meteo-val ${v.st}">${v.val}<span class="meteo-unit">${v.unit}</span></div>
      <div class="meteo-status status-${v.st}">${v.st==='warn'?'⚠ Alerta': v.st==='caution'?'Precaución': v.st==='ok'?'OK':'—'}</div>
    </div>`).join('');

  // ── ALERTAS ──
  const lista = document.getElementById('alertas-lista');
  lista.innerHTML = alertas.map(a => `
    <div class="alerta-item">
      <span class="alerta-icon">${a.ico}</span>
      <span class="alerta-text">${a.txt}</span>
    </div>`).join('');

  document.getElementById('sem-loading').style.display = 'none';
  document.getElementById('sem-content').style.display = 'block';
}

// ─── RENDER VENTANA HORARIA ───────────────────────────────
function renderVentana(hourly) {
  const ahora = new Date();
  const horas = hourly.time;
  const vientos = hourly.wind_speed_10m;
  const temps = hourly.temperature_2m;
  const hrs = hourly.relative_humidity_2m;
  const pps = hourly.precipitation_probability;

  // Próximas 24 horas desde ahora
  const idxAhora = horas.findIndex(t => new Date(t) >= ahora);
  const idxFin = Math.min(idxAhora + 24, horas.length);
  const bloquesSlice = horas.slice(idxAhora, idxFin);

  const timeline = document.getElementById('timeline');
  timeline.innerHTML = bloquesSlice.map((t, i) => {
    const idx = idxAhora + i;
    const hora = new Date(t).getHours();
    const viento = vientos[idx];
    const temp = temps[idx];
    const hr = hrs[idx];
    const pp = pps[idx];

    let cls = 'apto';
    let emoji = '✅';
    if (viento > 25 || temp > 32 || hr < 40 || pp > 50) { cls = 'no-apto'; emoji = '🚫'; }
    else if (viento > 15 || viento < 3 || temp > 28 || hr < 55 || pp > 25) { cls = 'parcial'; emoji = '⚠️'; }

    const esAhora = i === 0;
    return `<div class="hour-block ${cls}" title="T: ${temp.toFixed(0)}°C | HR: ${hr}% | PP: ${pp}%">
      ${esAhora ? '<div class="hour-now">AHORA</div>' : ''}
      <div class="hour-label">${String(hora).padStart(2,'0')}:00</div>
      <div class="hour-emoji">${emoji}</div>
      <div class="hour-wind">${viento.toFixed(0)} km/h</div>
    </div>`;
  }).join('');

  document.getElementById('ventana-fecha').textContent = ahora.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' });
  document.getElementById('ventana-card').style.display = 'block';
}

// ─── DERIVA ───────────────────────────────────────────────
function renderDeriva(c) {
  if (!c) return;
  const viento = c.wind_speed_10m;
  const temp = c.temperature_2m;
  const hr = c.relative_humidity_2m;

  // Índice de riesgo 0–100
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
        { lbl:'Temperatura', val: temp.toFixed(1)+'°C', peso: temp>32?'warn':temp>28?'caution':'ok', tip: 'Afecta volatilización' },
        { lbl:'Humedad relativa', val: hr+'%', peso: hr<40?'warn':hr<55?'caution':'ok', tip: 'Determina evaporación de gotas' },
        { lbl:'Estabilidad atmosférica', val: (new Date().getHours()>=20||new Date().getHours()<=7)?'Nocturna ⚠':'Diurna ✓', peso: (new Date().getHours()>=20||new Date().getHours()<=7)?'caution':'ok', tip: 'Inversión térmica nocturna' },
      ].map(f => `
        <div style="padding:1rem;background:rgba(28,18,8,.04);border-radius:12px;border:1px solid var(--border)">
          <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(28,18,8,.4);margin-bottom:.3rem">${f.lbl}</div>
          <div style="font-family:'DM Mono',monospace;font-size:1.3rem;color:var(--${f.peso==='warn'?'warn':f.peso==='caution'?'caution':'ok'})">${f.val}</div>
          <div style="font-size:.7rem;color:rgba(28,18,8,.45);margin-top:.2rem">${f.tip}</div>
        </div>`).join('')}
    </div>
    <div style="margin-top:1rem;padding:.9rem 1.1rem;background:rgba(58,122,184,.06);border-radius:10px;border:1px solid rgba(58,122,184,.15);font-size:.8rem;color:rgba(28,18,8,.65);line-height:1.6">
      <strong>Nota agronómica INTA:</strong> El riesgo de deriva depende principalmente de la velocidad y turbulencia del viento, el tipo de boquilla, el volumen de aplicación y el tamaño de gota. Las condiciones de inversión térmica nocturna pueden transportar gotas pequeñas varios kilómetros.
    </div>`;
}

// ─── BUFFER ───────────────────────────────────────────────
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
    soja: 'Especialmente crítico en floración. La soja es muy sensible a hormonales (2,4-D, Dicamba).',
    hortalizas: 'Cultivos de alta sensibilidad. Se recomienda verificar viento < 8 km/h.',
    apicultura: 'Coordinar con apicultores. Aplicar en horario de menor actividad (noche o madrugada).',
    agua: 'Respetar legislación provincial. Algunos productos tienen restricciones adicionales.',
    urbano: 'Verificar ordenanzas municipales y zonas de exclusión locales.',
    forestal: 'Considerar fauna silvestre y polinizadores nativos.'
  };

  const viento = STATE.meteo ? STATE.meteo.wind_speed_10m : 10;
  const factorViento = 1 + (viento / 25);
  const buffer = Math.round(bufferBase[lindero] * factorBoquilla[boquilla] * factorViento);

  document.getElementById('buffer-val').textContent = buffer;
  document.getElementById('buffer-nota').textContent = '⚠ ' + notas[lindero];
  document.getElementById('buffer-resultado').style.display = 'block';
}

// ─── CALCULADORA CALDO ────────────────────────────────────
const PRODUCTOS = {
  herbicida: [
    { nombre: 'Glifosato 48%',        dosis: 2.5,  unidad: 'L/ha',  mezcla: 'herbicida_sistemico' },
    { nombre: 'Glifosato + Dicamba',   dosis: 1.8,  unidad: 'L/ha',  mezcla: 'hormonal' },
    { nombre: '2,4-D Amina 72%',       dosis: 1.0,  unidad: 'L/ha',  mezcla: 'hormonal' },
    { nombre: 'Atrazina 50%',          dosis: 3.0,  unidad: 'L/ha',  mezcla: 'preemergente' },
    { nombre: 'Cletodim 12%',          dosis: 0.8,  unidad: 'L/ha',  mezcla: 'graminicida' },
    { nombre: 'Haloxifop 12%',         dosis: 0.7,  unidad: 'L/ha',  mezcla: 'graminicida' },
    { nombre: 'Metribuzin 70%',        dosis: 0.35, unidad: 'kg/ha', mezcla: 'preemergente' },
    { nombre: 'Metsulfurón 60%',       dosis: 0.007,unidad: 'kg/ha', mezcla: 'ats' },
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
    { nombre: 'Boro líquido',          dosis: 0.5,  unidad: 'L/ha',  mezcla: 'foliar' },
    { nombre: 'Azufre líquido 20%',    dosis: 1.5,  unidad: 'L/ha',  mezcla: 'foliar' },
    { nombre: 'Zinc + Manganeso',      dosis: 1.0,  unidad: 'L/ha',  mezcla: 'foliar' },
  ]
};

const ORDENES_MEZCLA = {
  herbicida_sistemico: ['1. ½ tanque de agua limpia', '2. Coadyuvante / surfactante', '3. Glifosato', '4. Completar con agua', '5. Agitar suavemente'],
  hormonal:  ['1. ½ tanque de agua limpia', '2. Agitar', '3. Hormonal (2,4-D / Dicamba) — agregar despacio', '4. Completar con agua', '⚠ NUNCA mezclar con emulsionables sin prueba de jarrita'],
  preemergente: ['1. ½ tanque de agua limpia', '2. Dispersar el producto (PM) en agua aparte', '3. Agregar al tanque agitando', '4. Completar con agua', '5. Mantener agitación constante'],
  graminicida: ['1. ½ tanque de agua limpia', '2. Aceite metilado (si se requiere)', '3. Graminicida', '4. Completar con agua', '⚠ No mezclar con glifosato sin evaluación'],
  ats: ['1. ½ tanque de agua limpia', '2. Disolver el granulado en agua aparte', '3. Agregar al tanque', '4. Coadyuvante', '5. Completar con agua'],
  triazol: ['1. ½ tanque de agua', '2. Coadyuvante (si se requiere)', '3. Fungicida triazol', '4. Completar con agua'],
  estrobilurina: ['1. ½ tanque de agua', '2. Fungicida (generalmente mezcla formulada)', '3. Completar con agua'],
  sdhi: ['1. ½ tanque de agua', '2. Fungicida SDHI', '3. Completar con agua', '✓ Buena compatibilidad con triazoles'],
  contacto: ['1. ½ tanque de agua', '2. Humectar el PM en agua aparte', '3. Agregar al tanque agitando', '4. Mantener agitación'],
  dicarboximida: ['1. ½ tanque de agua', '2. Producto', '3. Completar con agua'],
  op: ['1. ½ tanque de agua', '2. OP (aguas ácidas o neutras)', '3. Completar con agua', '⚠ Incompatible en pH > 7, usar buffer'],
  piretroide: ['1. ½ tanque de agua', '2. Piretroide', '3. Completar con agua', '✓ Compatible con OP y fungicidas en general'],
  neonicotinoide: ['1. ½ tanque de agua', '2. Neonicotinoide', '3. Completar con agua'],
  spinosina: ['1. ½ tanque de agua', '2. Spinosad (activar baja agitación)', '3. Completar con agua', '✓ Selectivo para enemigos naturales'],
  foliar: ['1. Agua limpia pH 5.5–6.5', '2. Fertilizante foliar', '3. Completar con agua', '✓ Aplicar con HR > 65% y temperatura fresca'],
};

const PAUTAS = {
  herbicida:   `<ul style="font-size:.83rem;color:rgba(28,18,8,.7);line-height:1.8;list-style:none">
    <li>🌡 Temperatura óptima: <strong>15–28°C</strong></li>
    <li>💧 Humedad relativa: <strong>> 55%</strong></li>
    <li>💨 Viento: <strong>3–15 km/h</strong></li>
    <li>☀️ Evitar horas de máxima radiación (12–16 hs)</li>
    <li>🌧 Período libre de lluvia: <strong>4–8 hs post-aplicación</strong> (según producto)</li>
    <li>⚠️ Hormonales (2,4-D, Dicamba): NO aplicar > 28°C ni con inversión térmica</li>
  </ul>`,
  fungicida:   `<ul style="font-size:.83rem;color:rgba(28,18,8,.7);line-height:1.8;list-style:none">
    <li>🌡 Temperatura: <strong>15–25°C</strong></li>
    <li>💧 HR: <strong>> 60%</strong> (favorece adhesión y absorción)</li>
    <li>💨 Viento: <strong>3–12 km/h</strong></li>
    <li>🌧 Período libre de lluvia: <strong>2–4 hs</strong></li>
    <li>📅 Aplicar en estadio preventivo (antes de infección)</li>
    <li>✓ Triazoles + estrobilurinas: mayor espectro y residualidad</li>
  </ul>`,
  insecticida: `<ul style="font-size:.83rem;color:rgba(28,18,8,.7);line-height:1.8;list-style:none">
    <li>🌡 Temperatura: <strong>15–30°C</strong></li>
    <li>💨 Viento: <strong>< 15 km/h</strong> (piretroides muy sensibles)</li>
    <li>🌙 Piretroides: preferir aplicación vespertina/nocturna</li>
    <li>🐝 Abejas: NO aplicar en floración con neonicotinoides u OP</li>
    <li>🌧 Período libre de lluvia: <strong>1–2 hs</strong></li>
    <li>⚠️ OP organofosforados: máxima precaución EPP</li>
  </ul>`,
  fertilizante_foliar: `<ul style="font-size:.83rem;color:rgba(28,18,8,.7);line-height:1.8;list-style:none">
    <li>🌡 Temperatura: <strong>< 25°C</strong></li>
    <li>💧 HR: <strong>> 65%</strong> (clave para absorción foliar)</li>
    <li>⏰ Aplicar temprano (7–10 hs) o tarde (17–20 hs)</li>
    <li>🌧 Período libre de lluvia: <strong>6 hs</strong></li>
    <li>💦 Aumentar volumen de caldo: <strong>100–150 L/ha</strong></li>
    <li>⚠️ Urea foliar: riesgo de quemado si > 25°C y HR baja</li>
  </ul>`,
};

function actualizarProductos() {
  const tipo = document.getElementById('c-tipo').value;
  const sel = document.getElementById('c-producto');
  sel.innerHTML = '<option value="">— Seleccionar producto —</option>';
  if (PRODUCTOS[tipo]) {
    PRODUCTOS[tipo].forEach((p, i) => {
      sel.innerHTML += `<option value="${i}">${p.nombre} (${p.dosis} ${p.unidad})</option>`;
    });
  }
  // Mostrar pautas
  const pauta = document.getElementById('pauta-body');
  if (PAUTAS[tipo]) { pauta.innerHTML = PAUTAS[tipo]; }
  else { pauta.innerHTML = '<p class="txt-muted">Seleccioná un tipo de aplicación.</p>'; }
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
      document.getElementById(id).textContent = '—';
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
    document.getElementById('r-prod-total').textContent = '—';
    document.getElementById('r-tanques').textContent = '—';
    document.getElementById('r-agua').textContent = '—';
  }

  // Alertas de concentración
  const alBox = document.getElementById('caldo-alerta-box');
  if (parseFloat(concPct) < 0.5) {
    alBox.style.display = 'flex';
    document.getElementById('caldo-alerta-txt').textContent = `Concentración muy baja (${concPct}%). Verificar que el volumen de caldo sea adecuado para lograr buena cobertura.`;
  } else if (parseFloat(concPct) > 5) {
    alBox.style.display = 'flex';
    document.getElementById('caldo-alerta-txt').textContent = `Concentración alta (${concPct}%). Riesgo de fitotoxicidad. Verificar dosis y compatibilidad.`;
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

// ─── REGISTRO ─────────────────────────────────────────────
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
    lote: document.getElementById('reg-lote').value || '—',
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
  toast('✅ Ficha guardada correctamente');
}

function renderHistorial() {
  const tbody = document.getElementById('historial-body');
  if (historial.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="txt-muted" style="text-align:center;padding:2rem">Sin registros aún</td></tr>';
    return;
  }
  tbody.innerHTML = historial.map(r => `
    <tr>
      <td style="white-space:nowrap">${r.fecha} ${r.hora}</td>
      <td>${r.lote}</td>
      <td>${r.producto || '—'}</td>
      <td>${r.ha || '—'}</td>
      <td><span class="tag ${r.condicion}">${r.condicion==='verde'?'Apto':r.condicion==='amarillo'?'Precaución':'No apto'}</span></td>
    </tr>`).join('');

  const totalHa = historial.reduce((s,r) => s+(r.ha||0), 0);
  document.getElementById('res-apps').textContent = historial.length;
  document.getElementById('res-ha').textContent = totalHa.toLocaleString('es-AR');
}

function limpiarHistorial() {
  if (!confirm('¿Eliminar todos los registros?')) return;
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
  doc.text('AgroMotor — Registro de Pulverización', 15, 18);
  doc.setFontSize(10);
  doc.setTextColor(200, 162, 85);
  doc.text('Módulo Pulverización v1.0 · INTA', 15, 28);
  doc.setTextColor(140, 170, 150);
  doc.text('Generado: ' + new Date().toLocaleDateString('es-AR'), 15, 35);

  doc.setTextColor(28, 18, 8);
  let y = 52;
  const campos = [
    ['Lote / Establecimiento', lote],
    ['Fecha', fecha],
    ['Hora inicio', document.getElementById('reg-hora').value],
    ['Superficie', (document.getElementById('reg-ha').value || '—') + ' ha'],
    ['Cultivo', document.getElementById('reg-cultivo').value],
    ['Operador', document.getElementById('reg-operador').value || '—'],
    ['Equipo', document.getElementById('reg-equipo').value || '—'],
    ['', ''],
    ['Producto', document.getElementById('reg-producto').value || '—'],
    ['Dosis', (document.getElementById('reg-dosis').value || '—') + ' L o kg/ha'],
    ['Volumen de caldo', (document.getElementById('reg-volha').value || '—') + ' L/ha'],
    ['', ''],
    ['Temperatura', (document.getElementById('reg-temp').value || '—') + ' °C'],
    ['Viento', (document.getElementById('reg-viento').value || '—') + ' km/h'],
    ['Humedad relativa', (document.getElementById('reg-hr').value || '—') + '%'],
    ['Estado de aplicación', document.getElementById('reg-condicion').value.toUpperCase()],
    ['', ''],
    ['Observaciones', document.getElementById('reg-obs').value || '—'],
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
  doc.text('AgroMotor · Motor Agronómico de Decisión · INTA Argentina', 15, 285);

  doc.save(`Pulverizacion_${lote.replace(/\s/g,'_')}_${fecha}.pdf`);
  toast('📄 PDF exportado correctamente');
}

// ─── UTILIDADES ───────────────────────────────────────────
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


// ─── ASISTENTE IA ─────────────────────────────────────────
let chatHistory = [];
let chatBusy = false;

const SYSTEM_PROMPT = `Sos un asistente técnico agronómico especializado en pulverización agrícola para Argentina.
Tu nombre es "Asistente AgroMotor". Respondés en español rioplatense, con terminología técnica precisa pero clara.

CONTEXTO Y ALCANCE:
- Especialista en manejo de malezas, plagas y enfermedades en cultivos extensivos argentinos (soja, maíz, trigo, girasol, sorgo, pasturas)
- Conocés la normativa SENASA, los registros CASAFE, las recomendaciones INTA y la legislación fitosanitaria argentina
- Manejás las guías HRAC para resistencia a herbicidas y FRAC para fungicidas
- Conocés los principales productos registrados en Argentina con sus principios activos, dosis y restricciones

SOBRE PULVERIZACIÓN Y CONDICIONES:
- Parámetros óptimos: temperatura 15-28°C, HR > 55%, viento 3-15 km/h, sin lluvia inminente
- Alertas de deriva, inversión térmica, volatilización de hormonales
- Tipos de boquillas (XR, TTI, AI, cono hueco) y su relación con el espectro de gotas
- Volúmenes de caldo recomendados por tipo de aplicación (herbicida, fungicida, insecticida)

SOBRE MEZCLAS:
- Explicás el orden correcto de agregado al tanque (agua, coadyuvante, PM, SL, EC, etc.)
- Alertás sobre incompatibilidades físico-químicas (pH, precipitados, emulsiones rotas)
- Mencionás la importancia del test de jarrita

SOBRE RESISTENCIAS:
- Malezas con resistencia documentada en Argentina: rama negra (Conyza), yuyo colorado (Amaranthus), raigrás (Lolium), sorgo de Alepo (Sorghum halepense)
- Estrategias de manejo: rotación de modos de acción, mezclas, barbechos limpios, cultivos de cobertura

FORMATO DE RESPUESTAS:
- Usá párrafos cortos y claros
- Cuando listés recomendaciones, usá bullet points simples (•)
- Destacá alertas con ⚠️ y recomendaciones positivas con ✓
- Siempre recordá que tus respuestas son orientativas y que hay que verificar el marbete del producto
- Sé concreto y práctico, como lo haría un técnico de campo del INTA
- Máximo 350 palabras por respuesta salvo que se pida más detalle`;

function buildContextMeteo() {
  if (!STATE.meteo) return '';
  const m = STATE.meteo;
  return `

[CONTEXTO METEO ACTUAL: T=${m.temperature_2m}°C, HR=${m.relative_humidity_2m}%, Viento=${m.wind_speed_10m}km/h, Ráfagas=${m.wind_gusts_10m}km/h, PP=${m.precipitation}mm, Prob.lluvia=${m.precipitation_probability}%]`;
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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: chatHistory
      })
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
    agregarMensaje('assistant', '⚠️ No pude conectarme con el asistente IA. Verificá tu conexión a internet e intentá nuevamente.');
  }

  chatBusy = false;
  document.getElementById('chat-send-btn').disabled = false;
  document.getElementById('chat-input').focus();
}

function agregarMensaje(rol, texto) {
  const msgs = document.getElementById('chat-messages');
  const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const avatar = rol === 'user' ? '👤' : '🤖';
  const tiempoLabel = rol === 'user' ? 'Vos' : 'Asistente IA';

  // Convertir markdown básico a HTML
  const html = texto
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n• /g, '<br>• ')
    .replace(/\n/g, '<br>');

  const div = document.createElement('div');
  div.className = 'msg ' + rol;
  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div>
      <div class="msg-bubble">${html}</div>
      <div class="msg-time">${tiempoLabel} · ${hora}</div>
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
    <div class="msg-avatar">🤖</div>
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
      <div class="msg-avatar">🤖</div>
      <div>
        <div class="msg-bubble">
          <strong>Chat reiniciado.</strong> ¿En qué te puedo ayudar con la pulverización?
        </div>
        <div class="msg-time">Asistente IA · listo</div>
      </div>
    </div>`;
  document.getElementById('chat-chips').style.display = 'flex';
}

// Mostrar badge meteo en el asistente cuando hay datos
function actualizarCtxBadge() {
  const b = document.getElementById('ctx-meteo-badge');
  if (b && STATE.meteo) b.style.display = 'inline-flex';
}


// ─── BASE HRAC ARGENTINA ──────────────────────────────────
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
    distribucion: 'Buenos Aires, Córdoba, Santa Fe, Entre Ríos, La Pampa, San Luis',
    primer_caso: 2003,
    alta_peligrosidad: true,
    estadios_sensibles: 'Roseta pequeña (< 5 cm) o pre-emergencia',
    metodos_alternativos: [
      '✓ Herbicidas HRAC F1: Saflufenacil (Kixor®) + aceite metilado',
      '✓ HRAC K3: Clormequat (en mezcla pre-siembra)',
      '✓ HRAC O: 2,4-D amina en dosis bajas en mezcla (con precaución por volatilización)',
      '✓ Control mecánico: cincel o rastra de discos en barbecho',
      '✓ Cultivos de cobertura: vicia, centeno — reducen emergencia hasta 70%',
      '✓ Aplicar sobre rosetas pequeñas; plantas > 10 cm requieren mezcla + aceite',
    ],
    manejo_integrado: [
      '⚠ No confiar en glifosato solo: resistencia extendida en toda la región pampeana',
      '⚠ Rotar modos de acción en cada barbecho',
      'Monitorear lotes con historia de aplicaciones frecuentes de glifosato',
      'Priorizar aplicaciones en pre-emergencia o estadios muy tempranos',
    ],
    notas_inta: 'Caso paradigmático de resistencia en Argentina. INTA recomienda el uso de mezclas con al menos 2 modos de acción diferentes y el manejo del banco de semillas con cultivos de cobertura.',
    cultivos_afectados: ['Soja', 'Maíz', 'Girasol', 'Trigo', 'Barbecho'],
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
    distribucion: 'Córdoba, Buenos Aires, Santa Fe, Entre Ríos — expansión acelerada A. palmeri desde 2018',
    primer_caso: 1997,
    alta_peligrosidad: true,
    estadios_sensibles: 'Pre-emergencia o estadios muy tempranos (< 3 cm)',
    metodos_alternativos: [
      '✓ HRAC F1: Saflufenacil solo o en mezcla (Kixor® + glifosato)',
      '✓ HRAC K3: Pendimetalín, S-metolacloro (pre-emergentes)',
      '✓ HRAC E: Fomesafén en soja RR (post-emergencia temprana)',
      '✓ HRAC O: 2,4-D + glifosato en barbecho (plantas < 10 cm)',
      '✓ Soja con cobertura de cultivo + herbicida pre-emergente',
      '✓ Laboreo estratégico: no invertir suelo para no traer semillas nuevas',
    ],
    manejo_integrado: [
      '⚠ A. palmeri: resistencia múltiple documentada — máxima alerta',
      '⚠ Tasa de producción: hasta 600.000 semillas/planta',
      'Umbral de daño: 1 planta/m² puede costar 50% del rendimiento en soja',
      'Rotación de cultivos con cereales de invierno mejora el control',
      'Nunca permitir que una planta llegue a semillar',
    ],
    notas_inta: 'A. palmeri es considerado la maleza de mayor potencial invasivo en Argentina. INTA Manfredi alerta sobre casos de resistencia múltiple (Grupos B + G) en el norte de Córdoba y sur de Santiago del Estero.',
    cultivos_afectados: ['Soja', 'Maíz', 'Girasol', 'Barbecho'],
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
    distribucion: 'Buenos Aires, Córdoba, Santa Fe, Entre Ríos, La Pampa, Chaco',
    primer_caso: 2005,
    alta_peligrosidad: true,
    estadios_sensibles: 'Macollos tempranos (< 30 cm), antes de que macollaje avance',
    metodos_alternativos: [
      '✓ HRAC A alternativos: Clethodim 24% a dosis plenas (verificar biótipo)',
      '✓ Control en épocas no críticas: laboreo de rizomas (stress hídrico verano)',
      '✓ Cultivos de invierno competitivos (trigo, cebada) en rotación',
      '✓ En maíz: nicosulfurón en estadio adecuado (verificar híbrido)',
      '✓ Combinación de control químico + labranza en verano',
    ],
    manejo_integrado: [
      '⚠ Biotipos resistentes a glifosato y ACCasa: opciones muy limitadas',
      'Evitar semillar — las semillas viables persisten 3-5 años en suelo',
      'Limpiar máquinas entre lotes para no diseminar rizomas',
      'Monitorear lotes con más de 8 años de SD continua sin rotación',
    ],
    notas_inta: 'La resistencia a ACCasa en Sorghum halepense representa uno de los escenarios más complejos de manejo. INTA recomienda estrategias de largo plazo con rotación de cultivos como eje central.',
    cultivos_afectados: ['Soja', 'Maíz', 'Girasol', 'Girasol', 'Algodón'],
  },
  {
    id: 4,
    nombre: 'Raigrás anual',
    cientifico: 'Lolium multiflorum',
    familia: 'poaceas',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'total' },
      { hrac: 'A (ACCasa)', nombre: 'Cletodim / Haloxifop', nivel: 'total' },
      { hrac: 'B (ALS)', nombre: 'Metsulfurón', nivel: 'parcial' },
    ],
    distribucion: 'Buenos Aires (principalmente sur y sudeste), La Pampa, Córdoba sur',
    primer_caso: 1996,
    alta_peligrosidad: true,
    estadios_sensibles: '2-3 hojas, antes del macollaje',
    metodos_alternativos: [
      '✓ HRAC K1: Trifluralin en presiembra incorporado en trigo',
      '✓ HRAC K3: Clormequat o pendimetalín en barbecho',
      '✓ HRAC F1: Pinoxaden en cereales (solo biotipos sin resistencia a ACCasa)',
      '✓ Mezclas de modos de acción diferentes (consultar asesor)',
      '✓ Laboreo de alta calidad + fecha de siembra tardía en trigo',
      '✓ Rotación con cultivos de verano para interrumpir ciclo',
    ],
    manejo_integrado: [
      '⚠ Resistencia múltiple documentada (G + A + B) en varias zonas',
      'El primer caso de resistencia en Argentina fue en raigrás (1996)',
      'Monitorear densidades en lotes de trigo y pasturas',
      'Usar semilla certificada libre de raigrás resistente',
    ],
    notas_inta: 'Primer biotipo resistente a herbicidas documentado en Argentina. La resistencia múltiple complica el manejo en sistemas de producción de trigo y pasturas del sur bonaerense.',
    cultivos_afectados: ['Trigo', 'Cebada', 'Pasturas', 'Barbecho'],
  },
  {
    id: 5,
    nombre: 'Capín / Pata de ganso',
    cientifico: 'Echinochloa colona / E. crus-galli',
    familia: 'poaceas',
    grupos_resistentes: [
      { hrac: 'A (ACCasa)', nombre: 'Quizalofop / Fluazifop', nivel: 'total' },
      { hrac: 'B (ALS)', nombre: 'Bispyribac-sodium (arroz)', nivel: 'parcial' },
    ],
    distribucion: 'Entre Ríos, Corrientes, Chaco, Formosa (principalmente en arroz irrigado)',
    primer_caso: 2010,
    alta_peligrosidad: false,
    estadios_sensibles: 'Pre-emergencia o 1-2 hojas',
    metodos_alternativos: [
      '✓ HRAC K3: Pendimetalín, S-metolacloro (pre-emergentes en maíz/soja)',
      '✓ HRAC N: Propanil en arroz (verificar biotipos)',
      '✓ Manejo del agua en arroz: inundación temprana',
      '✓ Rotación arroz-soja-maíz',
    ],
    manejo_integrado: [
      'Monitoreo temprano es clave — control en 1-2 hojas',
      'En sistemas arroceros: auditoría de aplicaciones pasadas',
      'Limpieza de equipos entre lotes de distintos productores',
    ],
    notas_inta: 'Problema creciente en NEA, especialmente en sistemas arroceros del litoral. La resistencia a ACCasa limita el uso de graminicidas clave.',
    cultivos_afectados: ['Arroz', 'Soja', 'Maíz'],
  },
  {
    id: 6,
    nombre: 'Sunchillo',
    cientifico: 'Wedelia glauca',
    familia: 'asteraceas',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'parcial' },
    ],
    distribucion: 'NOA: Santiago del Estero, Chaco, Tucumán, Salta',
    primer_caso: 2012,
    alta_peligrosidad: false,
    estadios_sensibles: 'Planta joven, < 15 cm',
    metodos_alternativos: [
      '✓ HRAC O: 2,4-D amina a dosis plenas',
      '✓ HRAC C: Piclorám en barbechos (producto de acción residual)',
      '✓ Mezclas con dicamba o aminopiralid',
      '✓ Control mecánico temprano antes de floración',
    ],
    manejo_integrado: [
      'Resistencia parcial: biotipos con reducción de sensibilidad, no total',
      'Aumentar dosis de glifosato + coadyuvante puede dar resultado en algunos biotipos',
      'Monitorear lotes en segunda campaña o tardíos del NOA',
    ],
    notas_inta: 'Maleza perenne de difícil control en el NOA. La resistencia parcial a glifosato requiere ajuste de estrategia en lotes con alta presión.',
    cultivos_afectados: ['Soja', 'Maíz', 'Girasol', 'Barbecho'],
  },
  {
    id: 7,
    nombre: 'Enredadera de campo',
    cientifico: 'Ipomoea purpurea / I. nil',
    familia: 'otras',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'parcial' },
    ],
    distribucion: 'Córdoba, Santa Fe, Buenos Aires norte, Entre Ríos',
    primer_caso: 2014,
    alta_peligrosidad: false,
    estadios_sensibles: '1-2 hojas verdaderas (muy pequeñas)',
    metodos_alternativos: [
      '✓ HRAC F1: Saflufenacil (Kixor®) en pre o post temprana',
      '✓ HRAC E: Fomesafén + glifosato en soja RR',
      '✓ HRAC O: 2,4-D en barbecho (control parcial)',
      '✓ Pre-emergentes: flumioxazin, sulfentrazone',
      '✓ Cosecha y limpieza: semillas con alta persistencia en suelo',
    ],
    manejo_integrado: [
      'Difícil control post-emergente una vez establecida',
      'Banco de semillas persistente: 5-7 años en suelo',
      'Priorizar manejo pre-emergente o en estadios muy tempranos',
    ],
    notas_inta: 'Maleza de difícil control en soja. La resistencia parcial a glifosato suma complejidad. Estrategia clave: pre-emergentes + post temprana.',
    cultivos_afectados: ['Soja', 'Maíz', 'Girasol'],
  },
  {
    id: 8,
    nombre: 'Mostacilla',
    cientifico: 'Raphanus sativus / Sinapis arvensis',
    familia: 'otras',
    grupos_resistentes: [
      { hrac: 'B (ALS)', nombre: 'Metsulfurón / Tribenuron', nivel: 'total' },
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'parcial' },
    ],
    distribucion: 'Buenos Aires, La Pampa, Córdoba sur — principalmente en trigo y barbecho',
    primer_caso: 2008,
    alta_peligrosidad: false,
    estadios_sensibles: '2-4 hojas, antes de elongación del tallo',
    metodos_alternativos: [
      '✓ HRAC O: 2,4-D amina + MCPA en trigo',
      '✓ HRAC C: Diclorprop en mezclas',
      '✓ HRAC I: Clopyralid (en girasol)',
      '✓ Mezclas de ALS + hormonales para demorar resistencia',
    ],
    manejo_integrado: [
      '⚠ Resistencia a ALS extendida en zona triguera bonaerense',
      'Rotar modos de acción en cada campaña de trigo',
      'Monitorear presencia antes de decidir el herbicida',
      'Evitar uso continuo de metsulfurón más de 2 campañas seguidas',
    ],
    notas_inta: 'La resistencia a ALS en mostacilla es uno de los casos más frecuentes en el cinturón triguero. INTA recomienda auditar el historial de herbicidas del lote antes de cada campaña.',
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
    distribucion: 'Buenos Aires, Córdoba, Santa Fe — casos puntuales en lotes con SD prolongada',
    primer_caso: 2016,
    alta_peligrosidad: false,
    estadios_sensibles: '1-3 hojas, antes de macollaje',
    metodos_alternativos: [
      '✓ HRAC K3: S-metolacloro pre-emergente',
      '✓ HRAC A alternativos: cletodim a dosis plenas',
      '✓ Rotación con cultivos de invierno',
    ],
    manejo_integrado: [
      'Resistencia parcial — aumentar dosis puede ser efectivo en algunos biotipos',
      'Pre-emergentes son la estrategia más confiable',
      'No descuidar el control en bordes y cabeceras',
    ],
    notas_inta: 'Maleza secundaria que puede volverse problemática en sistemas con alta presión de graminicidas. El monitoreo temprano permite el control con opciones todavía disponibles.',
    cultivos_afectados: ['Soja', 'Maíz', 'Girasol'],
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
    distribucion: 'Buenos Aires (centro y sur), La Pampa — principalmente en trigo y cebada',
    primer_caso: 2009,
    alta_peligrosidad: false,
    estadios_sensibles: '2-3 hojas, antes del macollaje',
    metodos_alternativos: [
      '✓ HRAC K1: Trifluralin presiembra incorporado',
      '✓ HRAC K3: Clortolonil + pendimetalín (pre-emergente)',
      '✓ Pinoxaden (HRAC A, diferente sitio de acción) en algunos biotipos',
      '✓ Fecha tardía de siembra en trigo para aprovechar falsa siembra',
      '✓ Cosecha limpia y limpieza de maquinaria entre lotes',
    ],
    manejo_integrado: [
      'Falsa siembra: preparar cama de siembra, esperar emergencia y destruir antes de sembrar',
      'Semilla certificada libre de avena',
      'Evitar trasladar granos o suelo entre lotes infestados',
    ],
    notas_inta: 'La resistencia a ACCasa limita severamente las opciones post-emergentes en cereales. El manejo preventivo (falsa siembra, semilla limpia) cobra importancia estratégica.',
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
    distribucion: 'Córdoba, Buenos Aires, Santa Fe — lotes con maíz continuo y atrazina repetida',
    primer_caso: 2011,
    alta_peligrosidad: false,
    estadios_sensibles: 'Pre-emergencia o estadio muy temprano (cotiledones)',
    metodos_alternativos: [
      '✓ HRAC K3: S-metolacloro, acetoclor pre-emergente',
      '✓ HRAC G: Glifosato en post (no tiene resistencia)',
      '✓ HRAC F1: Saflufenacil en mezcla',
      '✓ Rotación con soja para interrumpir presión de atrazina',
    ],
    manejo_integrado: [
      'Resistencia específica a atrazina — glifosato sigue siendo efectivo',
      'Rotar principios activos pre-emergentes en maíz',
      'Monitorear lotes con historia de maíz continuo',
    ],
    notas_inta: 'La resistencia a atrazina en verdolaga es relativamente localizada pero advierte sobre el riesgo del uso repetido del mismo herbicida pre-emergente en maíz.',
    cultivos_afectados: ['Maíz', 'Soja', 'Girasol'],
  },
  {
    id: 12,
    nombre: 'Gramón / Gramilla',
    cientifico: 'Cynodon dactylon',
    familia: 'poaceas',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'parcial' },
    ],
    distribucion: 'Todo el país — casos de tolerancia/resistencia documentados en Pampa húmeda',
    primer_caso: 2015,
    alta_peligrosidad: false,
    estadios_sensibles: 'Control más efectivo en crecimiento activo',
    metodos_alternativos: [
      '✓ HRAC A: Cletodim o haloxifop a dosis máximas + aceite',
      '✓ Glifosato a dosis plenas en momento óptimo (final de verano)',
      '✓ Control mecánico de rizomas en barbechos',
    ],
    manejo_integrado: [
      'Distinguir tolerancia natural vs resistencia real (alta biomasa dificulta control)',
      'Aplicar glifosato + ACCasa en mezcla para mayor eficacia',
      'El momento de aplicación (fin de verano) es clave para control de rizomas',
    ],
    notas_inta: 'La situación en gramón es más de tolerancia que resistencia confirmada en la mayoría de los casos. Sin embargo, la baja eficacia del glifosato en algunos lotes genera preocupación creciente.',
    cultivos_afectados: ['Soja', 'Maíz', 'Girasol', 'Barbecho'],
  },
  {
    id: 13,
    nombre: 'Abrojo chico',
    cientifico: 'Xanthium spinosum / X. strumarium',
    familia: 'asteraceas',
    grupos_resistentes: [
      { hrac: 'G (EPSPS)', nombre: 'Glifosato', nivel: 'parcial' },
    ],
    distribucion: 'Buenos Aires, Córdoba, Santa Fe, Entre Ríos',
    primer_caso: 2013,
    alta_peligrosidad: false,
    estadios_sensibles: 'Cotiledones a 2 hojas verdaderas',
    metodos_alternativos: [
      '✓ HRAC E: Fomesafén en soja (post-emergente)',
      '✓ HRAC O: 2,4-D en barbecho',
      '✓ HRAC F1: Saflufenacil en mezclas de barbecho',
      '✓ HRAC C: Dicamba en barbecho',
    ],
    manejo_integrado: [
      'Las semillas tienen dormancia — emergencias escalonadas complican el control',
      'El abrojo produce 2 tipos de semillas con diferente dormancia',
      'Impedir formación de frutos espinosos que se adhieren a cosechadoras',
    ],
    notas_inta: 'La resistencia parcial al glifosato requiere complementar con herbicidas de otros grupos. El fomesafén post-emergente en soja es actualmente la principal alternativa.',
    cultivos_afectados: ['Soja', 'Maíz', 'Girasol', 'Barbecho'],
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
    estadios_sensibles: 'Plántula pequeña',
    metodos_alternativos: [
      '✓ HRAC O: 2,4-D amina',
      '✓ HRAC F1: Saflufenacil',
      '✓ Control mecánico en lotes con alta presencia',
    ],
    manejo_integrado: [
      'Caso relativamente reciente y con distribución acotada al NEA',
      'Monitorear su expansión hacia zonas de soja en el noreste',
    ],
    notas_inta: 'Maleza de ambiente húmedo con resistencia total a glifosato confirmada en NEA. Las alternativas son limitadas pero disponibles.',
    cultivos_afectados: ['Soja', 'Pasturas'],
  },
];

let hracFiltroActual = 'todos';
let hracBusqueda = '';

function renderHRAC() {
  const grid = document.getElementById('hrac-grid');
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
    grid.innerHTML = '<div class="hrac-empty">🔍 No se encontraron malezas con ese criterio.<br><span style="font-size:.75rem">Probá con otro nombre o quitá el filtro.</span></div>';
    return;
  }

  grid.innerHTML = filtrados.map(m => {
    const famCls = 'fam-' + m.familia;
    const famLabel = { amarantaceas:'Amarantáceas', asteraceas:'Asteráceas', poaceas:'Poáceas', otras:'Otras' }[m.familia];
    const chips = m.grupos_resistentes.map(g =>
      `<span class="hrac-grupo-chip ${g.nivel === 'parcial' ? 'parcial' : ''}">${g.hrac}</span>`
    ).join('');

    return `<div class="hrac-card" onclick="abrirHRACModal(${m.id})">
      <div class="hrac-card-header">
        <div>
          <div class="hrac-nombre">${m.alta_peligrosidad ? '⚠ ' : ''}${m.nombre}</div>
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
        ${m.alta_peligrosidad ? '<div class="hrac-alerta-zona">🚨 Alta peligrosidad — Manejo urgente</div>' : ''}
      </div>
    </div>`;
  }).join('');
}

function filtrarHRAC() {
  hracBusqueda = document.getElementById('hrac-search-input').value;
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

  document.getElementById('modal-nombre').textContent = m.nombre;
  document.getElementById('modal-cientifico').textContent = m.cientifico;

  const chips = m.grupos_resistentes.map(g =>
    `<span class="hrac-grupo-chip ${g.nivel === 'parcial' ? 'parcial' : ''}" style="font-size:.72rem;padding:.25rem .65rem">${g.hrac} — ${g.nombre} <em style="font-weight:400;font-style:normal">(${g.nivel})</em></span>`
  ).join(' ');

  document.getElementById('modal-body').innerHTML = `
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

    <div class="hrac-section-title">Distribución</div>
    <p style="font-size:.83rem;color:rgba(28,18,8,.7);margin-bottom:.8rem;line-height:1.55">📍 ${m.distribucion}</p>

    <div class="hrac-section-title">Estadio óptimo de control</div>
    <p style="font-size:.83rem;color:rgba(28,18,8,.7);margin-bottom:.8rem;line-height:1.55">🎯 ${m.estadios_sensibles}</p>

    <div class="hrac-section-title">Alternativas de control</div>
    ${m.metodos_alternativos.map(a => `<div class="hrac-manejo-item"><span>•</span><span>${a}</span></div>`).join('')}

    <div class="hrac-section-title">Manejo integrado</div>
    ${m.manejo_integrado.map(a => `<div class="hrac-manejo-item"><span>•</span><span>${a}</span></div>`).join('')}

    <div class="hrac-section-title">Cultivos afectados</div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem">
      ${m.cultivos_afectados.map(c => `<span style="font-size:.72rem;background:rgba(42,122,74,.1);color:var(--ok);border:1px solid rgba(42,122,74,.2);padding:.2rem .6rem;border-radius:8px;font-weight:600">${c}</span>`).join('')}
    </div>

    <div style="background:rgba(58,122,184,.07);border:1px solid rgba(58,122,184,.2);border-radius:12px;padding:1rem;margin-top:.5rem">
      <div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--spray-blue);margin-bottom:.4rem">📋 Nota INTA</div>
      <p style="font-size:.82rem;color:rgba(28,18,8,.7);line-height:1.6">${m.notas_inta}</p>
    </div>

    <div style="margin-top:1.2rem;text-align:center">
      <button class="btn-primary" style="font-size:.8rem;padding:.65rem 1.5rem"
        onclick="consultarAsistenteHRAC('${m.nombre}')">
        🤖 Consultar al Asistente IA sobre esta maleza
      </button>
    </div>
  `;

  document.getElementById('hrac-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function cerrarHRACModal(e) {
  if (e && e.target !== document.getElementById('hrac-modal')) return;
  document.getElementById('hrac-modal').style.display = 'none';
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
  input.value = `¿Qué estrategia de manejo recomendás para ${nombreMaleza} en lotes con resistencia confirmada a glifosato? ¿Qué productos y en qué orden de mezcla?`;
  autoResizeTextarea(input);
  input.focus();
}

// Init HRAC al cargar
renderHRAC();


// ═══ CALIDAD DE AGUA ═══════════════════════════════════════

let productoAgua = 'glifosato';
let phActual = 7.5;
let fuenteAgua = 'pozo';

// Perfiles típicos de pH por fuente
const FUENTES_PH = {
  red:    { ph: 7.8, tds: 350, label: 'Red pública: pH típico 7.5–8.5, TDS ~200–500 ppm' },
  pozo:   { ph: 7.5, tds: 500, label: 'Agua de pozo: pH típico 7.0–8.5, TDS muy variable' },
  laguna: { ph: 8.2, tds: 800, label: 'Laguna/zanja: pH típico 7.5–9.0, alto TDS estacional' },
  canal:  { ph: 7.6, tds: 450, label: 'Canal de riego: pH típico 7.0–8.5, TDS moderado' },
};

// Base de conocimiento pH por producto
const PRODUCTO_PH = {
  glifosato: {
    ph_optimo: [4.5, 6.5],
    ph_limite: [6.5, 7.5],
    ph_critico: [7.5, 10],
    problema_alcalino: 'El glifosato se hidroliza rápidamente en agua alcalina (pH > 7). Por cada unidad de pH sobre 7, la vida media del producto en el caldo se reduce a la mitad. A pH 8 puede perder 20–30% de eficacia antes de depositarse en la hoja.',
    problema_tds: 'Los cationes Ca²⁺ y Mg²⁺ de agua dura forman sales insolubles con el glifosato, neutralizando el principio activo antes de la aplicación.',
    acidificante: true,
    sulfato_amonio: true,
    sensibilidad_tds: 'alta',
  },
  glifo_2bd: {
    ph_optimo: [4.5, 6.0],
    ph_limite: [6.0, 7.0],
    ph_critico: [7.0, 10],
    problema_alcalino: 'La mezcla glifosato + 2,4-D requiere pH más bajo que cada producto por separado. El 2,4-D amina es estable en rango amplio pero el glifosato se degrada. Mantener pH 5–6 es crítico.',
    problema_tds: 'Igual que glifosato solo. El TDS alto antagoniza principalmente al glifosato de la mezcla.',
    acidificante: true,
    sulfato_amonio: true,
    sensibilidad_tds: 'alta',
  },
  glifo_dicamba: {
    ph_optimo: [4.5, 6.0],
    ph_limite: [6.0, 7.5],
    ph_critico: [7.5, 10],
    problema_alcalino: 'El dicamba es estable en rango amplio de pH. El riesgo es el glifosato. A pH > 7.5 la hidrólisis alcalina del glifosato compromete la eficacia de la mezcla.',
    problema_tds: 'Moderado. El dicamba no se ve afectado por TDS alto pero el glifosato sí.',
    acidificante: true,
    sulfato_amonio: true,
    sensibilidad_tds: 'alta',
  },
  als: {
    ph_optimo: [5.0, 7.0],
    ph_limite: [7.0, 8.0],
    ph_critico: [4.0, 5.0],
    problema_alcalino: 'Las sulfonilureas e imidazolinonas son más estables que el glifosato pero el pH alcalino acelera la hidrólisis. A pH > 8 la degradación es significativa.',
    problema_tds: 'Baja sensibilidad al TDS. Los cationes Ca/Mg no antagonizan significativamente a los ALS.',
    acidificante: false,
    sulfato_amonio: false,
    sensibilidad_tds: 'baja',
    alerta_ph_bajo: 'Ojo: con pH < 5 los ALS también se degradan por hidrólisis ácida.',
  },
  fungicida: {
    ph_optimo: [5.0, 8.0],
    ph_limite: [8.0, 9.0],
    ph_critico: [9.0, 10],
    problema_alcalino: 'Los triazoles y estrobilurinas son generalmente estables en rango amplio de pH. El problema a pH > 9 es la estabilidad de la emulsión del formulado.',
    problema_tds: 'Baja sensibilidad. Los fungicidas de formulación EC o SC no se ven significativamente afectados por dureza.',
    acidificante: false,
    sulfato_amonio: false,
    sensibilidad_tds: 'baja',
  },
  insecticida: {
    ph_optimo: [5.0, 7.0],
    ph_limite: [7.0, 8.0],
    ph_critico: [8.0, 10],
    problema_alcalino: 'Los organofosforados (clorpirifos, metamidofos) son muy sensibles al pH alcalino — se hidrolizan rápidamente. Los piretroides son moderadamente estables.',
    problema_tds: 'Baja-media. Algunos OP pueden precipitar con agua muy dura.',
    acidificante: true,
    sulfato_amonio: false,
    sensibilidad_tds: 'media',
    alerta_op: '⚠ Clorpirifos y otros OP: vida media de horas en agua alcalina. Usar buffer de pH es imprescindible.',
  },
  graminicida: {
    ph_optimo: [5.0, 7.0],
    ph_limite: [7.0, 8.0],
    ph_critico: [8.0, 10],
    problema_alcalino: 'Los graminicidas ACCasa (cletodim, haloxifop, quizalofop) se degradan en agua alcalina. La formulación EC es más sensible.',
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
    problema_alcalino: 'El pH alcalino reduce la absorción foliar de micronutrientes. La urea foliar requiere pH 5.5–6.5 para máxima absorción.',
    problema_tds: 'Alta para micronutrientes. El TDS elevado puede competir con la absorción del nutriente aplicado.',
    acidificante: true,
    sulfato_amonio: false,
    sensibilidad_tds: 'media',
  },
};

function setFuente(el, fuente) {
  fuenteAgua = fuente;
  document.querySelectorAll('.fuente-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  // Prellenar valores típicos
  const f = FUENTES_PH[fuente];
  actualizarPH(f.ph);
  document.getElementById('ph-slider').value = f.ph;
  if (!document.getElementById('agua-tds').value || parseInt(document.getElementById('agua-tds').value) === 500) {
    document.getElementById('agua-tds').value = f.tds;
  }
  calcularAgua();
}

function actualizarPH(val) {
  phActual = parseFloat(val);
  document.getElementById('ph-display').textContent = phActual.toFixed(1);
  document.getElementById('ph-slider').value = phActual;
  // Posicionar thumb (pH 4–10 = 0–100%)
  const pct = ((phActual - 4) / 6) * 100;
  document.getElementById('ph-thumb').style.left = pct + '%';
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
  const ce = parseFloat(document.getElementById('agua-ce').value);
  if (!isNaN(ce) && ce > 0) {
    // CE (µS/cm) ≈ TDS (ppm) × 0.64 (factor empírico)
    const tds = Math.round(ce * 0.64);
    document.getElementById('agua-tds').value = tds;
    calcularAgua();
  }
}

function calcDeltaT() {
  if (!STATE.meteo) return null;
  const T = STATE.meteo.temperature_2m;
  const Td = STATE.meteo.dew_point_2m;
  // Aproximación: Tbh ≈ T - (T - Td) / 3  (fórmula empírica Stull)
  const Tbh = T - (T - Td) / 3;
  return parseFloat((T - Tbh).toFixed(1));
}

function renderDeltaT() {
  const dt = calcDeltaT();
  const elVal = document.getElementById('deltat-val');
  const elLabel = document.getElementById('deltat-label');
  const cursor = document.getElementById('deltat-cursor');

  if (dt === null) {
    elVal.textContent = '—';
    elLabel.textContent = 'Sin datos meteo · actualizá GPS';
    return;
  }

  elVal.textContent = dt.toFixed(1) + '°C';

  let color, label;
  if (dt < 8) {
    color = 'var(--ok)'; label = 'Condición óptima';
  } else if (dt < 10) {
    color = 'var(--caution)'; label = 'Precaución — evaporación elevada';
  } else {
    color = 'var(--red)'; label = 'No aplicar — pérdida severa de gotas';
  }
  elVal.style.color = color;
  elLabel.textContent = label;

  // Cursor: 0°C=0%, 10°C+=100%
  const pct = Math.min((dt / 12) * 100, 100);
  cursor.style.left = pct + '%';
}

function renderMeteoBadges() {
  if (!STATE.meteo) return;
  const v = STATE.meteo.wind_speed_10m;
  const hr = STATE.meteo.relative_humidity_2m;
  const dir = gradosADireccion(STATE.meteo.wind_direction_10m);

  document.getElementById('agua-viento-val').textContent = v.toFixed(1);
  document.getElementById('agua-viento-label').textContent = 'km/h · ' + (v > 25 ? '⚠ Excesivo' : v > 15 ? '⚠ Moderado' : v < 3 ? '⚠ Muy bajo' : '✓ Óptimo');
  document.getElementById('agua-viento-dir').textContent = 'Dirección: ' + dir;

  document.getElementById('agua-hr-val').textContent = hr;
  document.getElementById('agua-hr-label').textContent = hr < 45 ? '⚠ HR muy baja' : hr < 60 ? '⚠ HR baja' : '✓ HR adecuada';

  renderDeltaT();
}

function calcularAgua() {
  const ph = phActual;
  const tds = parseFloat(document.getElementById('agua-tds').value) || 0;
  const prod = PRODUCTO_PH[productoAgua];
  if (!prod) return;

  const recs = [];

  // ── ANÁLISIS pH ──
  const [phOk1, phOk2] = prod.ph_optimo;
  const [phLim1, phLim2] = prod.ph_limite;
  const [phCrit1, phCrit2] = prod.ph_critico;

  let phEstado, phNivel;
  if (ph >= phOk1 && ph <= phOk2) {
    phEstado = 'ok';
    phNivel = 'ok';
    recs.push({
      nivel:'ok', icon:'✅',
      titulo:'pH óptimo (' + ph.toFixed(1) + ')',
      texto:'El pH del agua está dentro del rango ideal para ' + getProductoLabel() + '. No se requiere corrección de pH.'
    });
  } else if (
    (ph > phOk2 && ph <= (prod.ph_critico[0] || 99)) ||
    (ph < phOk1 && ph >= 4)
  ) {
    phEstado = 'alerta'; phNivel = 'alerta';
    const correccion = ph > phOk2 ? 'reducir' : 'elevar';
    const target = ph > phOk2 ? phOk2 : phOk1;
    recs.push({
      nivel:'alerta', icon:'⚠️',
      titulo:'pH fuera del rango óptimo (' + ph.toFixed(1) + ')',
      texto:(prod.problema_alcalino || 'El pH actual puede reducir la eficacia del producto.') +
        ' Recomendación: usar acidificante/buffer para ' + correccion + ' el pH a ' + target + '–' + phOk2 + '.'
    });
  } else {
    phEstado = 'critico'; phNivel = 'critico';
    recs.push({
      nivel:'critico', icon:'🚨',
      titulo:'pH crítico (' + ph.toFixed(1) + ') — corrección urgente',
      texto:(prod.problema_alcalino || 'El pH actual compromete severamente la eficacia.') +
        ' Utilizar acidificante/buffer antes de agregar el fitosanitario. Target: pH ' + phOk1 + '–' + phOk2 + '.'
    });
  }

  if (prod.alerta_ph_bajo && ph < 5.0) {
    recs.push({ nivel:'alerta', icon:'⚠️', titulo:'pH bajo — hidrólisis ácida', texto: prod.alerta_ph_bajo });
  }
  if (prod.alerta_op) {
    recs.push({ nivel:'critico', icon:'⚠️', titulo:'Organofosforado sensible al pH', texto: prod.alerta_op });
  }

  // ── ANÁLISIS TDS ──
  if (prod.sensibilidad_tds === 'alta') {
    if (tds > 1000) {
      recs.push({
        nivel:'critico', icon:'💧',
        titulo:'Agua muy dura (TDS ' + tds + ' ppm) — antagonismo severo',
        texto:'La alta concentración de Ca²⁺ y Mg²⁺ neutraliza el glifosato formando sales insolubles. ' +
          'Se recomienda sulfato de amonio al 2–3% (v/v) o 2–3 kg/100 L de caldo antes de agregar el herbicida.'
      });
    } else if (tds > 500) {
      recs.push({
        nivel:'alerta', icon:'💧',
        titulo:'Agua moderadamente dura (TDS ' + tds + ' ppm)',
        texto:'Se recomienda sulfato de amonio al 1–2% para prevenir el antagonismo catiónico sobre el glifosato. ' +
          'Agregar el sulfato de amonio primero, dejar disolver, luego el herbicida.'
      });
    } else {
      recs.push({
        nivel:'ok', icon:'💧',
        titulo:'Calidad de agua adecuada (TDS ' + tds + ' ppm)',
        texto:'El TDS no representa riesgo de antagonismo significativo para este producto.'
      });
    }
  } else if (prod.sensibilidad_tds === 'media' && tds > 800) {
    recs.push({
      nivel:'alerta', icon:'💧',
      titulo:'TDS elevado (' + tds + ' ppm) — verificar emulsión',
      texto:'Con agua muy dura, verificar que la formulación emulsione correctamente. Realizar prueba de jarrita antes de cargar el equipo.'
    });
  } else if (prod.sensibilidad_tds === 'baja') {
    recs.push({
      nivel:'info', icon:'💧',
      titulo:'TDS ' + tds + ' ppm — sin riesgo para este producto',
      texto:'Los cationes disueltos no afectan significativamente la eficacia de este tipo de herbicida/fungicida.'
    });
  }

  if (prod.requiere_aceite) {
    recs.push({
      nivel:'info', icon:'🛢',
      titulo:'Requiere aceite metilado de soja',
      texto:'Los graminicidas ACCasa necesitan aceite metilado de soja al 0.5–1% v/v para mejorar la absorción cuticular. El agua dura puede afectar la calidad de la emulsión — realizar prueba de jarrita.'
    });
  }

  // Renderizar recomendaciones agua
  const container = document.getElementById('agua-recs');
  container.innerHTML = recs.map(r => `
    <div class="rec-item ${r.nivel}">
      <div class="rec-icon">${r.icon}</div>
      <div class="rec-content">
        <div class="rec-titulo ${r.nivel}">${r.titulo}</div>
        <div class="rec-texto">${r.texto}</div>
      </div>
    </div>`).join('');

  // Badge semáforo
  const badge = document.getElementById('agua-semaforo-badge');
  const hayCritico = recs.some(r => r.nivel === 'critico');
  const hayAlerta = recs.some(r => r.nivel === 'alerta');
  badge.textContent = hayCritico ? '🔴' : hayAlerta ? '🟡' : '🟢';

  // ── ADYUVANTES ──
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
      ejemplos: 'Ácido cítrico, Regulaid®, AgriBuf®, Citrolane®',
      dosis: ph > 8 ? '300–500 cc/100 L' : '150–300 cc/100 L',
      prioridad: urgencia,
      razon: 'Corregir pH de ' + ph.toFixed(1) + ' → 5.0–6.5 antes de agregar el fitosanitario',
      orden: 1,
    });
  }

  // 2. Sulfato de amonio
  if (prod.sulfato_amonio && tds > 300) {
    adyuvantes.push({
      nombre: 'Sulfato de amonio (SA)',
      ejemplos: '(NH₄)₂SO₄ técnico o formulado',
      dosis: tds > 800 ? '3 kg / 100 L caldo' : tds > 500 ? '2 kg / 100 L caldo' : '1–1.5 kg / 100 L caldo',
      prioridad: tds > 800 ? 'imprescindible' : 'recomendado',
      razon: 'Neutralizar antagonismo de Ca²⁺/Mg²⁺ (TDS ' + tds + ' ppm). Agregar PRIMERO al agua.',
      orden: 0,
    });
  }

  // 3. Antievaporante según Delta T
  if (dt !== null) {
    if (dt >= 8) {
      adyuvantes.push({
        nombre: 'Antievaporante',
        ejemplos: 'Extravon®, Citowett®, Vapor Gard® (cera de pino)',
        dosis: dt >= 10 ? '300–500 cc/100 L' : '200–300 cc/100 L',
        prioridad: dt >= 10 ? 'imprescindible' : 'recomendado',
        razon: 'Delta T ' + dt.toFixed(1) + '°C — evaporación de gotas aumentada. ' +
          (dt >= 10 ? 'Pérdida severa de producto antes del contacto foliar.' : 'Riesgo moderado de pérdida por evaporación.'),
        orden: 3,
      });
    }
  }

  // 4. Reductor de deriva según viento
  if (viento !== null && viento > 12) {
    adyuvantes.push({
      nombre: 'Reductor de deriva / engrosador de gota',
      ejemplos: 'Atplus®, Bondbreaker®, Breakthru® S240',
      dosis: '200–400 cc/100 L',
      prioridad: viento > 18 ? 'imprescindible' : 'recomendado',
      razon: 'Viento ' + viento.toFixed(1) + ' km/h — ' +
        (viento > 18 ? 'riesgo alto de deriva. Aumentar tamaño de gota es imprescindible.' : 'riesgo moderado de deriva. Complementar con boquilla antideriva.'),
      orden: 4,
    });
  }

  // 5. Surfactante / coadyuvante general
  if (productoAgua === 'graminicida') {
    adyuvantes.push({
      nombre: 'Aceite metilado de soja (FAME)',
      ejemplos: 'Hasten®, Soy Oil Methyl Ester, Assist®',
      dosis: '0.5–1% v/v (500–1000 cc/100 L)',
      prioridad: 'imprescindible',
      razon: 'Los graminicidas ACCasa requieren aceite metilado para penetración cuticular eficaz.',
      orden: 2,
    });
  } else if (['glifosato','glifo_2bd','glifo_dicamba'].includes(productoAgua)) {
    adyuvantes.push({
      nombre: 'Coadyuvante no iónico / silicona',
      ejemplos: 'Silwet L-77®, Activator 90®, Silicone Plus®',
      dosis: '100–200 cc/100 L',
      prioridad: 'opcional',
      razon: 'Mejora la cobertura y penetración del glifosato en condiciones de humedad baja o cutícula gruesa (malezas con cera).',
      orden: 5,
    });
  } else if (productoAgua === 'fungicida') {
    adyuvantes.push({
      nombre: 'Surfactante adherente',
      ejemplos: 'Sticktite®, Codacide®, Agral®',
      dosis: '100–150 cc/100 L',
      prioridad: 'opcional',
      razon: 'Mejora la adhesión del fungicida ante posibles lluvias leves o rocío post-aplicación.',
      orden: 5,
    });
  }

  // 6. HR muy baja → recomendar horario
  if (hr !== null && hr < 50 && dt !== null && dt >= 6) {
    adyuvantes.push({
      nombre: '⏰ Corrección de horario',
      ejemplos: 'No es un producto — es una decisión operativa',
      dosis: 'Aplicar antes de las 10 hs o después de las 17 hs',
      prioridad: hr < 40 ? 'imprescindible' : 'recomendado',
      razon: 'HR ' + hr + '% + Delta T ' + dt.toFixed(1) + '°C: condición crítica de evaporación. Ningún antievaporante compensa una aplicación al mediodía en estas condiciones.',
      orden: 6,
    });
  }

  // Ordenar por orden de aplicación
  adyuvantes.sort((a,b) => a.orden - b.orden);

  const container = document.getElementById('adyuvante-recs');
  if (!adyuvantes.length) {
    container.innerHTML = '<div class="rec-item ok"><div class="rec-icon">✅</div><div class="rec-content"><div class="rec-titulo ok">Sin adyuvantes adicionales requeridos</div><div class="rec-texto">Las condiciones actuales y el producto seleccionado no requieren adyuvantes especiales.</div></div></div>';
    document.getElementById('adyuvante-semaforo').textContent = '✅ OK';
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
            ${i+1}° agregar
          </div>
          <div class="adyuvante-nombre">${a.nombre}</div>
          <div style="font-size:.72rem;color:rgba(28,18,8,.5);margin-top:.15rem">${a.ejemplos}</div>
          <div style="font-size:.75rem;color:rgba(28,18,8,.6);margin-top:.2rem;line-height:1.4">${a.razon}</div>
        </div>
        <div class="adyuvante-dosis">${a.dosis}</div>
        <span class="adyuvante-tag ${a.prioridad}">${a.prioridad}</span>
      </div>`).join('');

  const tieneImprescindible = adyuvantes.some(a => a.prioridad === 'imprescindible');
  document.getElementById('adyuvante-semaforo').textContent = tieneImprescindible ? '⚠ Acción requerida' : '✓ Revisar';
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


// ═══ MOTOR DE COBERTURA ══════════════════════════════════
// Fórmula central: L/ha = (VMD³ × N × π) / (6 × 10⁷)
// Fuente: Leiva P.D. (INTA), FAO, Mathews G.A.

// ── Base de boquillas ISO ──
// VMD a 3 bar para boquilla XR (abanico estándar)
// Factor de corrección por tipo: TTI ×1.6, Twin ×1.1, HC ×0.85
const ISO_BOQUILLAS = [
  { iso:'005', nombre:'005 Púrpura',  color:'#7B2D8B', caudal_3bar:0.20, vmd_xr:130 },
  { iso:'0075',nombre:'0075 Rosa',   color:'#E75480', caudal_3bar:0.30, vmd_xr:145 },
  { iso:'01', nombre:'01 Naranja',   color:'#E8721A', caudal_3bar:0.40, vmd_xr:155 },
  { iso:'015',nombre:'015 Verde',    color:'#2E8B57', caudal_3bar:0.60, vmd_xr:170 },
  { iso:'02', nombre:'02 Amarillo',  color:'#DAA520', caudal_3bar:0.80, vmd_xr:200 },
  { iso:'025',nombre:'025 Lila',     color:'#9370DB', caudal_3bar:1.00, vmd_xr:230 },
  { iso:'03', nombre:'03 Azul',      color:'#1E5799', caudal_3bar:1.20, vmd_xr:260 },
  { iso:'04', nombre:'04 Rojo',      color:'#C0392B', caudal_3bar:1.60, vmd_xr:320 },
  { iso:'05', nombre:'05 Marrón',    color:'#7B5B3A', caudal_3bar:2.00, vmd_xr:380 },
  { iso:'06', nombre:'06 Gris',      color:'#607B8B', caudal_3bar:2.40, vmd_xr:440 },
  { iso:'08', nombre:'08 Blanco',    color:'#AAB8C2', caudal_3bar:3.20, vmd_xr:520 },
];

const TIPO_BOQUILLA_FACTOR_VMD = {
  xr: 1.0, tti: 1.65, twin: 1.10, hc: 0.85
};
const TIPO_BOQUILLA_FACTOR_CAUDAL_PRESION = {
  // caudal ∝ √(P/P_ref)  — P_ref = 3 bar
  xr: 1.0, tti: 1.0, twin: 1.0, hc: 1.0
};

// Impactos objetivo por tipo de producto (FAO / INTA)
const IMPACTOS_OBJETIVO = {
  herb_sistemico:  { min:20, max:30,  cv:30, label:'Herbicida sistémico' },
  herb_contacto:   { min:30, max:40,  cv:30, label:'Herbicida contacto' },
  fung_sistemico:  { min:20, max:30,  cv:70, label:'Fungicida sistémico' },
  fung_contacto:   { min:50, max:70,  cv:70, label:'Fungicida contacto' },
  insect_sistemico:{ min:20, max:30,  cv:70, label:'Insecticida sistémico' },
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

// Factor de corrección de cobertura por blanco
const FACTOR_BLANCO = {
  hoja_plana:     { factor:1.0, nota:'Hoja plana: cobertura directa sin penalización.' },
  hoja_erecta:    { factor:0.75, nota:'Hoja erecta: ángulo reduce cobertura ~25%. Considerar mayor volumen o velocidad reducida.' },
  maleza_pequeña: { factor:1.0, nota:'Maleza pequeña: cobertura total del área objetivo.' },
  maleza_grande:  { factor:0.65, nota:'Maleza desarrollada: penetración en canopeo reduce cobertura ~35%. Bajar VMD.' },
  suelo:          { factor:1.0, nota:'Suelo/pre-emergente: cobertura directa.' },
};

// Clasificación VMD según ASABE S-572
function clasificarVMD(vmd) {
  if (vmd < 136) return { clase:'Extremadamente fino', color:'#3498db', deriva:'Muy alta — riesgo severo', code:'XF' };
  if (vmd < 177) return { clase:'Muy fino',             color:'#5dade2', deriva:'Alta — precaución',       code:'VF' };
  if (vmd < 218) return { clase:'Fino',                 color:'#2ecc71', deriva:'Moderada',                code:'F' };
  if (vmd < 349) return { clase:'Medio',                color:'#27ae60', deriva:'Baja — condición óptima', code:'M' };
  if (vmd < 428) return { clase:'Grueso',               color:'#f39c12', deriva:'Muy baja',                code:'C' };
  if (vmd < 622) return { clase:'Muy grueso',           color:'#e67e22', deriva:'Mínima',                  code:'VC' };
  return              { clase:'Extremadamente grueso', color:'#e74c3c', deriva:'Nula — cobertura limitada', code:'XC' };
}

// ── FÓRMULA CENTRAL ──
// L/ha = (VMD³ × N × π) / (6 × 10⁷)
function calcLHaDesdeVMDyN(vmd, n) {
  return (Math.pow(vmd, 3) * n * Math.PI) / (6e7);
}
// N gotas/cm² = (L/ha × 6×10⁷) / (VMD³ × π)
function calcNDesdeVMDyLha(vmd, lha) {
  return (lha * 6e7) / (Math.pow(vmd, 3) * Math.PI);
}
// Cobertura % = N × π × (VMD/2)² / 10⁸  (área de cada gota sobre 1 cm²)
function calcCoberturaPct(n, vmd) {
  const r_cm = (vmd / 2) * 1e-4; // micrones a cm
  return Math.min(n * Math.PI * r_cm * r_cm * 100, 100);
}

// ── AJUSTE AMBIENTAL DEL VMD ──
// Delta T alto → evaporación en vuelo → VMD efectivo aumenta (gota se hace más pequeña = llega más chica)
// Viento alto → fragmentación adicional → VMD efectivo disminuye
function calcVMDEfectivo(vmdNominal) {
  if (!STATE.meteo) return { vmdEf: vmdNominal, factorDT: 1.0, factorViento: 1.0, nota: null };

  const dt = calcDeltaT ? calcDeltaT() : null;
  const viento = STATE.meteo.wind_speed_10m;

  let factorDT = 1.0;
  let factorViento = 1.0;
  let notas = [];

  if (dt !== null) {
    if (dt > 10)      { factorDT = 0.82; notas.push(`⚠ Delta T ${dt.toFixed(1)}°C: evaporación severa en vuelo → VMD efectivo -18%`); }
    else if (dt > 8)  { factorDT = 0.90; notas.push(`⚠ Delta T ${dt.toFixed(1)}°C: evaporación moderada → VMD efectivo -10%`); }
    else if (dt > 5)  { factorDT = 0.95; notas.push(`ℹ Delta T ${dt.toFixed(1)}°C: evaporación leve → VMD efectivo -5%`); }
  }
  if (viento > 20)    { factorViento = 0.88; notas.push(`⚠ Viento ${viento.toFixed(1)} km/h: fragmentación de gotas → VMD efectivo -12%`); }
  else if (viento > 12){ factorViento = 0.94; notas.push(`ℹ Viento ${viento.toFixed(1)} km/h: leve fragmentación → VMD efectivo -6%`); }

  const vmdEf = Math.round(vmdNominal * factorDT * factorViento);
  return { vmdEf, factorDT, factorViento, nota: notas.join('<br>') };
}

// ── CAUDAL DEL PICO según boquilla, presión ──
// Q ∝ √(P/P_ref)  →  Q(P) = Q_ref × √(P/3)
function calcCaudalPico(iso, presion, tipoBoquilla) {
  const bq = ISO_BOQUILLAS.find(b => b.iso === iso);
  if (!bq) return 0;
  return bq.caudal_3bar * Math.sqrt(presion / 3);
}

// VMD a presión dada: VMD ∝ P^(-0.3) (empírico, Spraying Systems)
function calcVMDaPrension(vmdRef, presionRef, presionTrabajo) {
  return Math.round(vmdRef * Math.pow(presionRef / presionTrabajo, 0.3));
}

// ── ESTADO MODO ──
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
  const tipo = document.getElementById('cob-tipo-producto').value;
  const obj = IMPACTOS_OBJETIVO[tipo];
  const vmdRec = VMD_RECOMENDADO[tipo];
  if (!obj) return;

  // Ajustar slider al valor medio recomendado
  const midImpactos = Math.round((obj.min + obj.max) / 2);
  document.getElementById('cob-impactos-slider').value = midImpactos;
  document.getElementById('cob-impactos-display').textContent = midImpactos;

  document.getElementById('cob-impactos-ref').innerHTML =
    `FAO/INTA: <strong>${obj.min}–${obj.max} gotas/cm²</strong> · CV ≤ ${obj.cv}% · ` +
    `VMD recomendado: <strong>${vmdRec.min}–${vmdRec.max} µm</strong>`;

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

  // Cálculo central
  const lhaRequerido = calcLHaDesdeVMDyN(vmdEf, impactosObj / factorBlanco);
  const impactosLogrados = Math.round(calcNDesdeVMDyLha(vmdEf, lhaRequerido) * factorBlanco);
  const cobPct = calcCoberturaPct(impactosLogrados, vmdEf).toFixed(1);
  const vmdInfo = clasificarVMD(vmdEf);

  // Caudal necesario por pico: Q(L/min) = L/ha × velocidad(km/h) × distPicos(m) / 600
  const caudalPico = (lhaRequerido * velocidad * distPicos) / 600;

  // Boquilla recomendada: buscar la ISO cuyo caudal a 2.5 bar sea más cercano
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
    veredicto.innerHTML = `<div class="cob-veredicto-icon">✅</div><div><div class="cob-veredicto-titulo" style="color:#6DBF82">Cobertura excelente</div><div class="cob-veredicto-texto">Con ${lhaRequerido.toFixed(0)} L/ha y VMD ${vmdEf} µm lográs ${impactosLogrados} gotas/cm² — supera el objetivo FAO de ${obj.min}–${obj.max} gotas/cm² para ${obj.label.toLowerCase()}. ${FACTOR_BLANCO[blanco].nota}</div></div>`;
  } else if (cumple) {
    veredicto.innerHTML = `<div class="cob-veredicto-icon">✅</div><div><div class="cob-veredicto-titulo" style="color:#6DBF82">Cobertura adecuada</div><div class="cob-veredicto-texto">Con ${lhaRequerido.toFixed(0)} L/ha y VMD ${vmdEf} µm lográs ${impactosLogrados} gotas/cm² — dentro del rango FAO. ${FACTOR_BLANCO[blanco].nota}</div></div>`;
  } else {
    veredicto.innerHTML = `<div class="cob-veredicto-icon">⚠️</div><div><div class="cob-veredicto-titulo" style="color:#E8B84B">Cobertura insuficiente</div><div class="cob-veredicto-texto">Con estos parámetros solo lográs ${impactosLogrados} gotas/cm², por debajo del mínimo FAO de ${obj.min} para ${obj.label.toLowerCase()}. Aumentá el L/ha o reducí el VMD.</div></div>`;
  }

  // Ajuste ambiental
  const ajusteBody = document.getElementById('cob-ajuste-body');
  if (nota) {
    ajusteBody.innerHTML = `<div class="ajuste-ambiental">${nota}</div>
      <div style="font-size:.78rem;color:rgba(28,18,8,.6);margin-top:.7rem;line-height:1.55">
        VMD nominal: <strong>${vmdNominal} µm</strong> → VMD efectivo en campo: <strong>${vmdEf} µm</strong>
      </div>`;
  } else {
    ajusteBody.innerHTML = `<div class="rec-item ok"><div class="rec-icon">✅</div><div class="rec-content"><div class="rec-titulo ok">Condiciones sin corrección significativa</div><div class="rec-texto">Las condiciones ambientales actuales no modifican el VMD nominal de manera importante.</div></div></div>`;
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
            VMD típico a ${presionTrabajo} bar: <strong>${boquillaRec.vmdTrabajo} µm</strong><br>
            Rango de trabajo: <strong>1.5–4 bar</strong>
          </div>
        </div>
      </div>
      <p style="font-size:.75rem;color:rgba(28,18,8,.55);line-height:1.5;margin-top:.3rem">
        Recomendación para boquilla tipo XR. Para TTI/AI el VMD aumenta ~65% — usar si viento > 12 km/h.
      </p>`;
  }

  // Tabla parámetros
  const presRec = (caudalPico / (boquillaRec ? boquillaRec.caudal_3bar : 1)) ** 2 * 3;
  document.getElementById('cob-params-tabla').innerHTML = `
    <table class="params-table">
      <thead><tr><th>Parámetro</th><th>Valor recomendado</th><th>Fundamento</th><th class="status-col">Estado</th></tr></thead>
      <tbody>
        <tr><td>Caudal L/ha</td><td class="val-col">${lhaRequerido.toFixed(1)} L/ha</td><td>Para lograr ${impactosObj} gotas/cm² con VMD ${vmdEf} µm</td><td class="status-col"><span class="tag ${lhaRequerido<20||lhaRequerido>150?'amarillo':'verde'}">${lhaRequerido<20?'Muy bajo':lhaRequerido>150?'Alto':'Óptimo'}</span></td></tr>
        <tr><td>VMD objetivo</td><td class="val-col">${vmdNominal} µm</td><td>Clase ${vmdInfo.clase} — ${vmdInfo.deriva.toLowerCase()}</td><td class="status-col"><span class="tag verde">${vmdInfo.code}</span></td></tr>
        <tr><td>VMD efectivo campo</td><td class="val-col">${vmdEf} µm</td><td>Corregido por Delta T y viento</td><td class="status-col"><span class="tag ${vmdEf < 150?'rojo':vmdEf < 200?'amarillo':'verde'}">${vmdEf < 150?'Deriva alta':vmdEf < 200?'Precaución':'OK'}</span></td></tr>
        <tr><td>Velocidad de avance</td><td class="val-col">${velocidad} km/h</td><td>Caudal por pico: ${caudalPico.toFixed(2)} L/min</td><td class="status-col"><span class="tag ${velocidad>25?'amarillo':'verde'}">${velocidad>25?'Revisar':'OK'}</span></td></tr>
        <tr><td>Presión estimada</td><td class="val-col">${presRec.toFixed(1)} bar</td><td>Con boquilla ${boquillaRec ? boquillaRec.nombre : '—'}</td><td class="status-col"><span class="tag ${presRec<1?'rojo':presRec>5?'amarillo':'verde'}">${presRec<1?'Muy baja':presRec>5?'Alta':'OK'}</span></td></tr>
        <tr><td>Cobertura foliar</td><td class="val-col">${cobPct}%</td><td>Área cubierta por gotas sobre el blanco</td><td class="status-col"><span class="tag ${parseFloat(cobPct)<10?'rojo':parseFloat(cobPct)<25?'amarillo':'verde'}">${parseFloat(cobPct)<10?'Baja':parseFloat(cobPct)<25?'Moderada':'Buena'}</span></td></tr>
      </tbody>
    </table>`;
}

// ── MODO B ──
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
    `Caudal nominal a 3 bar: ${bq.caudal_3bar} L/min · Rango típico: 1.5–4 bar`;
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
  document.getElementById('b-objetivo').textContent = obj.min + '–' + obj.max;
  document.getElementById('b-caudal-pico').textContent = caudalPico.toFixed(2);

  const vmdInfo = clasificarVMD(vmdEf);
  const cumple = impactos >= obj.min;
  const excede = impactos >= obj.max;

  const verd = document.getElementById('cob-veredicto-b');
  if (excede) {
    verd.innerHTML = `<div class="cob-veredicto-icon">✅</div><div><div class="cob-veredicto-titulo" style="color:#6DBF82">Configuración excelente</div><div class="cob-veredicto-texto">Tu equipo logra ${impactos} gotas/cm² con VMD ${vmdEf} µm — supera el objetivo FAO para ${obj.label.toLowerCase()}.</div></div>`;
  } else if (cumple) {
    verd.innerHTML = `<div class="cob-veredicto-icon">✅</div><div><div class="cob-veredicto-titulo" style="color:#6DBF82">Configuración adecuada</div><div class="cob-veredicto-texto">Tu equipo logra ${impactos} gotas/cm² — dentro del rango FAO de ${obj.min}–${obj.max} para ${obj.label.toLowerCase()}.</div></div>`;
  } else {
    const lhaNeeded = calcLHaDesdeVMDyN(vmdEf, obj.min).toFixed(0);
    verd.innerHTML = `<div class="cob-veredicto-icon">🚫</div><div><div class="cob-veredicto-titulo" style="color:#E8604A">Cobertura insuficiente</div><div class="cob-veredicto-texto">Solo lográs ${impactos} gotas/cm² (mínimo: ${obj.min}). Para alcanzar el objetivo necesitás <strong>${lhaNeeded} L/ha</strong> con este VMD, o reducir el tamaño de gota.</div></div>`;
  }

  const cobPct = calcCoberturaPct(impactos, vmdEf).toFixed(1);
  document.getElementById('cob-b-analisis').innerHTML = `
    <div class="rec-item ${cumple?'ok':'critico'}">
      <div class="rec-icon">${cumple?'✅':'🚫'}</div>
      <div class="rec-content">
        <div class="rec-titulo ${cumple?'ok':'critico'}">
          ${impactos} gotas/cm² · Clase de gota: ${vmdInfo.clase}
        </div>
        <div class="rec-texto">
          Cobertura foliar estimada: <strong>${cobPct}%</strong><br>
          Deriva: <strong>${vmdInfo.deriva}</strong><br>
          ${!cumple ? `⚠ Para alcanzar ${obj.min} gotas/cm² necesitás aumentar L/ha a <strong>${calcLHaDesdeVMDyN(vmdEf, obj.min).toFixed(0)} L/ha</strong> o reducir el VMD.` : ''}
        </div>
      </div>
    </div>
    <div style="font-size:.75rem;color:rgba(28,18,8,.5);margin-top:.8rem;line-height:1.6;padding:.7rem 1rem;background:rgba(28,18,8,.04);border-radius:10px">
      <strong>Fórmula:</strong> N = (L/ha × 6×10⁷) / (VMD³ × π)<br>
      Con L/ha=${lha}, VMD efectivo=${vmdEf} µm → <strong>${impactos} gotas/cm²</strong>
    </div>`;
}

// Llamar cuando lleguen datos meteo
function actualizarMotorCobertura() {
  if (cobModo === 'a') calcularCobertura();
  else calcularModoB();
}


// ═══ TARJETA HIDROSENSIBLE ══════════════════════════════
let thsGotas = [];
let thsTamano = 7; // radio en px del canvas
let thsModo = 'simulacion';
const THS_CANVAS_CM = 1; // representa 1 cm²
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
  // Radio variable ± 20% para simular variabilidad natural
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

  // Escala 1 cm² box
  ctx.strokeStyle = 'rgba(150,130,60,.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, 96, 96);
  ctx.fillStyle = 'rgba(150,130,60,.6)';
  ctx.font = '10px DM Mono, monospace';
  ctx.fillText('1 cm²', 14, 22);

  // Gotas azul-índigo
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
  ctx.fillText(`${gotasCm2} g/cm²`, W - 90, H - 12);
}

function thsContarGotasCm2() {
  // Cuenta gotas dentro del cuadrado de 96×96px = 1cm² de referencia
  return thsGotas.filter(g => g.x >= 10 && g.x <= 106 && g.y >= 10 && g.y <= 106).length;
}

function thsActualizarStats() {
  const n = thsContarGotasCm2();
  // VMD estimado: el radio en px → escala a micrones (96px = 1cm, 10000µm/cm)
  const avgRadio = thsTamano; // px
  const vmdEstimado = Math.round((avgRadio / 96) * 10000 * 0.5); // diámetro en µm
  // L/ha estimado
  const lhaEst = ((Math.pow(vmdEstimado, 3) * n * Math.PI) / 6e7).toFixed(1);
  // Cobertura
  const r_cm = (vmdEstimado / 2) * 1e-4;
  const cobPct = Math.min(n * Math.PI * r_cm * r_cm * 100, 100).toFixed(1);

  document.getElementById('ths-impactos').textContent = n;
  document.getElementById('ths-vmd-est').textContent = vmdEstimado > 0 ? vmdEstimado + '' : '—';
  document.getElementById('ths-cobertura').textContent = cobPct + '%';
  document.getElementById('ths-lha-est').textContent = lhaEst > 0 ? lhaEst : '—';

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
  const iconoItem = excede ? '✅' : cumple ? '✅' : n > obj.min * 0.7 ? '⚠️' : '🚫';
  const tituloItem = excede ? 'Cobertura excelente' : cumple ? 'Cobertura adecuada' : n > obj.min * 0.7 ? 'Cobertura marginal' : 'Cobertura insuficiente';
  const textoItem = n + ' gotas/cm² · Objetivo FAO: ' + obj.min + '–' + obj.max + ' para ' + obj.label.toLowerCase() + '.' + (!cumple ? ' Necesitás aumentar el caudal o reducir el VMD.' : '');

  document.getElementById('ths-evaluacion').innerHTML =
    '<div style="margin-bottom:.8rem">' +
    '<div style="display:flex;justify-content:space-between;font-size:.72rem;color:rgba(28,18,8,.5);margin-bottom:.3rem">' +
    '<span>0</span><span>Mín: ' + obj.min + '</span><span>Óptimo: ' + obj.max + '</span></div>' +
    '<div style="height:10px;background:rgba(28,18,8,.08);border-radius:5px;overflow:hidden">' +
    '<div style="height:100%;width:' + barW + '%;background:' + barColor + ';border-radius:5px;transition:width .5s"></div></div>' +
    '<div style="font-size:.72rem;color:rgba(28,18,8,.45);margin-top:.25rem;text-align:right">' + n + ' de ' + obj.min + ' mínimos (' + pct + '%)</div></div>' +
    '<div class="rec-item ' + claseItem + '">' +
    '<div class="rec-icon">' + iconoItem + '</div>' +
    '<div class="rec-content">' +
    '<div class="rec-titulo ' + claseItem + '">' + tituloItem + '</div>' +
    '<div class="rec-texto">' + textoItem + '</div>' +
    '</div></div>';

  const verd = document.getElementById('ths-veredicto');
  const verdTitulo = excede ? 'Aplicación excelente' : cumple ? 'Aplicación correcta' : n > obj.min * 0.7 ? 'Revisar parámetros' : 'Aplicación deficiente';
  verd.innerHTML =
    '<div style="font-size:1.4rem">' + iconoItem + '</div>' +
    '<div><div style="font-family:\'DM Serif Display\',serif;font-size:1rem;margin-bottom:.2rem">' + verdTitulo + '</div>' +
    '<div style="font-size:.78rem;color:rgba(255,253,248,.55)">' + n + ' gotas/cm² · ' + pct + '% del objetivo FAO</div></div>';

  const ajDiv = document.getElementById('ths-ajustes');
  if (cumple) {
    ajDiv.innerHTML = '<div class="rec-item ok"><div class="rec-icon">✅</div><div class="rec-content"><div class="rec-titulo ok">Sin ajustes necesarios</div><div class="rec-texto">La cobertura lograda cumple con los estándares FAO/INTA para este tipo de aplicación.</div></div></div>';
  } else {
    ajDiv.innerHTML =
      '<div class="rec-item alerta"><div class="rec-icon">⚠️</div><div class="rec-content"><div class="rec-titulo alerta">Aumentar volumen de caldo</div><div class="rec-texto">Incrementar L/ha o reducir VMD para lograr más impactos por cm².</div></div></div>' +
      '<div class="rec-item info"><div class="rec-icon">💨</div><div class="rec-content"><div class="rec-titulo info">Verificar velocidad de avance</div><div class="rec-texto">Reducir la velocidad aumenta el tiempo de exposición y mejora la cobertura.</div></div></div>' +
      '<div class="rec-item info"><div class="rec-icon">🔩</div><div class="rec-content"><div class="rec-titulo info">Evaluar cambio de boquilla</div><div class="rec-texto">Una boquilla de menor tamaño ISO produce gotas más pequeñas y más numerosas a igual presión.</div></div></div>';
  }
}

function thsAutoSpray() {
  // Genera spray automático basado en parámetros del Motor de Cobertura
  const n = parseInt(document.getElementById('cob-impactos-slider')?.value) || 30;
  const canvas = document.getElementById('ths-canvas');
  const W = canvas.width, H = canvas.height;
  thsGotas = [];

  // Distribución Poisson simulada en todo el canvas, concentrada en el cuadro 1cm²
  const totalGotas = Math.round(n * 1.5); // un poco más para el área total
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
  document.getElementById('ths-vmd-est').textContent = '—';
  document.getElementById('ths-cobertura').textContent = '0%';
  document.getElementById('ths-lha-est').textContent = '—';
}

function calcTarjetaReal() {
  const n = parseInt(document.getElementById('ths-real-impactos').value) || 0;
  const diam_mm = parseFloat(document.getElementById('ths-real-diametro').value) || 0;
  const tipo = document.getElementById('ths-real-tipo').value;

  // VMD real = diámetro mancha / factor de expansión (~1.5–2x)
  const vmdReal = diam_mm > 0 ? Math.round((diam_mm * 1000) / 1.7) : 0; // mm → µm / factor
  const lhaEst = vmdReal > 0 && n > 0 ? ((Math.pow(vmdReal,3) * n * Math.PI) / 6e7).toFixed(1) : '—';
  const r_cm = (vmdReal / 2) * 1e-4;
  const cobPct = n > 0 && vmdReal > 0 ? Math.min(n * Math.PI * r_cm * r_cm * 100, 100).toFixed(1) : '0';

  document.getElementById('ths-impactos').textContent = n;
  document.getElementById('ths-vmd-est').textContent = vmdReal > 0 ? vmdReal : '—';
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



// ═══ EVALUACIÓN DE CANOPEO ══════════════════════════════

let canopeoEscenario = 'barbecho';
let canopeoTeorico = { lha: null, vmd: null, impactos: null, tipo: null };

// Estructura de datos para cada posición y sus 3 repeticiones
// { superior: [{img, base64, resultado}, ...], medio: [...], inferior: [...] }
let canopeoData = {
  barbecho: [ {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null} ],
  superior: [ {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null} ],
  medio:    [ {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null} ],
  inferior: [ {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null}, {img:null,base64:null,resultado:null} ],
};

const POSICION_CONFIG = {
  barbecho: { titulo:'Barbecho / Suelo desnudo', subtitulo:'Sin interferencia — cotejo directo con teórico', icon:'🌾', clase:'barbecho', color:'rgba(200,162,85,.15)' },
  superior: { titulo:'Tarjeta Superior', subtitulo:'Sin interferencia de canopeo — parte alta del cultivo', icon:'☀️', clase:'superior', color:'rgba(58,122,184,.12)' },
  medio:    { titulo:'Tarjeta 1/3 Medio', subtitulo:'Interior del canopeo — zona media del cultivo', icon:'🌿', clase:'medio', color:'rgba(42,122,74,.1)' },
  inferior: { titulo:'Tarjeta 1/3 Inferior', subtitulo:'Base del canopeo — zona más difícil de penetrar', icon:'🌱', clase:'inferior', color:'rgba(184,122,32,.1)' },
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
                     <div class="rep-slot-lbl">g/cm²</div>
                   </div>`
                : `<div class="rep-add-icon">📷</div>
                   <div class="rep-add-label">Foto Rep ${i+1}</div>`
              }
            </div>`).join('')}
        </div>

        <!-- Stats de la posición -->
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
      <div class="pos-stat"><div class="pos-stat-val">—</div><div class="pos-stat-lbl">Gotas/cm²</div></div>
      <div class="pos-stat"><div class="pos-stat-val">—</div><div class="pos-stat-lbl">VMD µm</div></div>
      <div class="pos-stat"><div class="pos-stat-val">—</div><div class="pos-stat-lbl">L/ha</div></div>
      <div class="pos-stat"><div class="pos-stat-val">—</div><div class="pos-stat-lbl">CV%</div></div>`;
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
    <div class="pos-stat"><div class="pos-stat-val ${claseImp}">${avgImp}</div><div class="pos-stat-lbl">Gotas/cm²</div></div>
    <div class="pos-stat"><div class="pos-stat-val">${avgVMD}</div><div class="pos-stat-lbl">VMD µm</div></div>
    <div class="pos-stat"><div class="pos-stat-val">${lhaEst}</div><div class="pos-stat-lbl">L/ha est.</div></div>
    <div class="pos-stat"><div class="pos-stat-val ${claseCV}">${impactos.length > 1 ? cv + '%' : '—'}</div><div class="pos-stat-lbl">CV%</div></div>`;
}

function actualizarBotonAnalizar() {
  const posiciones = canopeoEscenario === 'barbecho' ? ['barbecho'] : ['superior','medio','inferior'];
  const totalFotos = posiciones.reduce((s, pos) =>
    s + canopeoData[pos].filter(d => d.base64).length, 0);
  const btn = document.getElementById('btn-analizar-todo');
  btn.textContent = totalFotos > 0
    ? '🤖 Analizar ' + totalFotos + ' tarjeta' + (totalFotos > 1 ? 's' : '') + ' con IA'
    : '🤖 Analizar todas las tarjetas con IA';
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
        ? 'T=' + STATE.meteo.temperature_2m + '°C, HR=' + STATE.meteo.relative_humidity_2m + '%, viento=' + STATE.meteo.wind_speed_10m + 'km/h.'
        : '';

      const prompt = 'Analizá esta tarjeta hidrosensible. Posición: ' + posLabel + '. Tipo de aplicación: ' + obj.label + ' (objetivo FAO: ' + obj.min + '-' + obj.max + ' gotas/cm²). ' + condMeteo + ' Respondé SOLO con JSON: {"impactos_cm2":<int>,"vmd_estimado":<int>,"cobertura_pct":<float>,"distribucion":"<uniforme|irregular|muy_irregular>","confianza":"<alta|media|baja>","cumple_objetivo":<bool>}';

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            messages: [{ role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: rep.mimeType || 'image/jpeg', data: rep.base64 } },
              { type: 'text', text: prompt }
            ]}]
          })
        });
        const data = await response.json();
        const texto = data.content?.[0]?.text || '';
        const clean = texto.replace(/```json|```/g, '').trim();
        rep.resultado = JSON.parse(clean);
      } catch(e) {
        rep.resultado = { impactos_cm2: 0, vmd_estimado: 0, cobertura_pct: 0, distribucion:'—', confianza:'baja', cumple_objetivo:false, error: true };
      }

      // Actualizar slot con resultado
      if (slot) {
        slot.classList.remove('analizando');
        slot.innerHTML =
          '<div class="rep-slot-num">Rep ' + (idx+1) + '</div>' +
          '<img src="' + rep.img + '" class="rep-slot-img">' +
          '<div class="rep-slot-overlay">' +
            '<div class="rep-slot-val">' + (rep.resultado.impactos_cm2 || '?') + '</div>' +
            '<div class="rep-slot-lbl">g/cm²</div>' +
          '</div>' +
          '<input type="file" accept="image/*" capture="environment" onchange="cargarRepFoto(event,' + JSON.stringify(pos) + ',' + i + ')">';
      }

      // Actualizar stats de la posición
      document.getElementById('pos-stats-' + pos).innerHTML = calcStatsHTML(pos);
    }
  }

  btn.disabled = false;
  btn.innerHTML = '🔄 Re-analizar';

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

  // Filas de cotejo (solo si hay teórico)
  const rows = [];
  if (teorico.impactos) {
    const desvImp = teorico.impactos ? Math.round(((statsRef.avgImp - teorico.impactos) / teorico.impactos) * 100) : null;
    const desvVMD = teorico.vmd ? Math.round(((statsRef.avgVMD - teorico.vmd) / teorico.vmd) * 100) : null;
    const desvLha = lhaReal ? Math.round(((statsRef.lhaEst - lhaReal) / lhaReal) * 100) : null;

    const claseDesv = (d) => d === null ? '' : Math.abs(d) <= 15 ? 'ok' : Math.abs(d) <= 30 ? 'warn' : 'danger';

    rows.push(
      { lbl:'Impactos/cm²', teo: teorico.impactos || '—', real: statsRef.avgImp, desv: desvImp },
      { lbl:'VMD (µm)',      teo: teorico.vmd || '—',      real: statsRef.avgVMD, desv: desvVMD },
      { lbl:'L/ha estimado', teo: lhaReal || '—',          real: statsRef.lhaEst, desv: desvLha },
    );

    document.getElementById('cotejo-rows').innerHTML = rows.map(r => {
      const cls = claseDesv(r.desv);
      return '<div class="cotejo-row">' +
        '<div class="cotejo-label">' + r.lbl + '</div>' +
        '<div class="cotejo-val">' + r.teo + '</div>' +
        '<div class="cotejo-val">' + r.real + '</div>' +
        '<div class="cotejo-desvio ' + cls + '">' + (r.desv !== null ? (r.desv > 0 ? '+' : '') + r.desv + '%' : '—') + '</div>' +
        '</div>';
    }).join('');

    // Semáforo global
    const desvios = [desvImp, desvVMD, desvLha].filter(d => d !== null);
    const maxDesv = Math.max(...desvios.map(Math.abs));
    document.getElementById('cotejo-semaforo').textContent = maxDesv <= 15 ? '✅' : maxDesv <= 30 ? '⚠️' : '🚫';
  } else {
    document.getElementById('cotejo-rows').innerHTML =
      '<div style="font-size:.8rem;color:rgba(255,253,248,.4);padding:.5rem">Sincronizá los datos teóricos del Motor de Cobertura para ver el cotejo completo.</div>';
    document.getElementById('cotejo-semaforo').textContent = 'ℹ️';
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

  // Penetración de canopeo (solo cultivo)
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

  // Telemetría
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
      txt: '<strong>Cobertura insuficiente (' + statsRef.avgImp + ' vs ' + obj.min + ' g/cm²):</strong> ' +
           'Necesitás aumentar la cobertura un ' + deficit + '%. Opciones: ' +
           '① Reducir velocidad de avance (' + deficit + '% menos) ' +
           '② Aumentar L/ha (' + Math.round(lhaReal * (1 + deficit/100)) + ' L/ha) ' +
           '③ Cambiar a boquilla de menor tamaño ISO para reducir VMD.'
    });
  } else if (statsRef.avgImp >= obj.max * 1.3) {
    sugs.push({
      tipo: 'ok',
      txt: '<strong>Excelente cobertura (' + statsRef.avgImp + ' g/cm²):</strong> Superás el objetivo FAO. Podés aumentar velocidad para mayor rendimiento sin comprometer eficacia.'
    });
  } else {
    sugs.push({
      tipo: 'ok',
      txt: '<strong>Cobertura dentro del objetivo (' + statsRef.avgImp + ' g/cm²):</strong> Los parámetros de aplicación son correctos para este tipo de producto.'
    });
  }

  // CV alto
  if (statsRef.cv > 30 && statsRef.n > 1) {
    sugs.push({
      tipo: 'warn',
      txt: '<strong>Distribución irregular (CV ' + statsRef.cv + '%):</strong> Alta variabilidad entre repeticiones. Verificar: uniformidad de picos (aforo), presión constante en el botalón, superposición correcta entre pasadas.'
    });
  }

  // VMD vs teórico
  if (teo.vmd && Math.abs(statsRef.avgVMD - teo.vmd) > teo.vmd * 0.20) {
    const delta = statsRef.avgVMD - teo.vmd;
    sugs.push({
      tipo: delta > 0 ? 'warn' : 'warn',
      txt: '<strong>VMD real ' + (delta > 0 ? 'mayor' : 'menor') + ' al teórico (' + statsRef.avgVMD + ' vs ' + teo.vmd + ' µm):</strong> ' +
           (delta > 0
             ? 'El Delta T y/o viento están evaporando/fragmentando las gotas. Considerar antievaporante o reducir el VMD objetivo.'
             : 'La presión de trabajo puede ser mayor a la calibrada. Verificar manómetro.')
    });
  }

  // Penetración (cultivo)
  if (canopeoEscenario === 'cultivo') {
    const stSup = calcPromedioPos('superior');
    const stInf = calcPromedioPos('inferior');
    if (stSup && stInf) {
      const penPct = Math.round((stInf.avgImp / stSup.avgImp) * 100);
      if (penPct < 20) {
        sugs.push({
          tipo: 'critico',
          txt: '<strong>Penetración de canopeo muy baja (' + penPct + '%):</strong> Solo el ' + penPct + '% de la cobertura superior llega al estrato inferior. Para mejorar: ① Reducir VMD (gotas más chicas penetran mejor) ② Aumentar presión de trabajo ③ Considerar equipo con asistencia de aire ④ Aplicar en estadio fenológico más temprano.'
        });
      } else if (penPct < 40) {
        sugs.push({
          tipo: 'warn',
          txt: '<strong>Penetración de canopeo moderada (' + penPct + '%):</strong> Aceptable para fungicidas sistémicos. Para contacto/protectores, considerar aumentar L/ha o reducir VMD.'
        });
      } else {
        sugs.push({
          tipo: 'ok',
          txt: '<strong>Buena penetración de canopeo (' + penPct + '%):</strong> La cobertura llega adecuadamente a los estratos inferiores del cultivo.'
        });
      }
    }
  }

  document.getElementById('canopeo-sugerencias').innerHTML = sugs.map(s =>
    '<div class="ajuste-sugerencia ' + s.tipo + '">' + s.txt + '</div>'
  ).join('');
}

function guardarTelemetria(statsRef) {
  // Guardar punto de datos en localStorage para futura sincronización a Supabase
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
  // Mantener solo los últimos 100 puntos
  if (telem.length > 100) telem.shift();
  localStorage.setItem('agromotor-telemetria', JSON.stringify(telem));

  document.getElementById('telem-status').innerHTML =
    '<span style="color:var(--ok)">✅ Guardado localmente (' + telem.length + ' registros)</span>';
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
    toast('⚠️ Andá al Motor de Cobertura y calculá primero');
    return;
  }

  canopeoTeorico = { lha, vmd, impactos: imp };
  document.getElementById('canopeo-teorico-txt').innerHTML =
    '<strong>' + imp + ' gotas/cm²</strong> · VMD ' + vmd + ' µm · ' + lha + ' L/ha' +
    ' <span style="color:var(--ok);font-weight:600">✓ Sincronizado</span>';
  toast('✅ Datos teóricos sincronizados desde el Motor de Cobertura');
}

function actualizarCotejo() {
  // Re-generar cotejo si ya hay resultados
  const posiciones = canopeoEscenario === 'barbecho' ? ['barbecho'] : ['superior'];
  const st = calcPromedioPos(posiciones[0]);
  if (st) generarCotejo();
}

// Parche: fix índice en slot update durante análisis
const _origAnalizarTodoCanopeo = analizarTodoCanopeo;

// ═══ ANALIZADOR FOTO TARJETA HIDROSENSIBLE ══════════════

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
  document.getElementById('ia-stats-row').innerHTML = '<div class="ia-typing"><div class="spinner" style="width:20px;height:20px;border-width:2px;flex-shrink:0"></div> La IA está analizando la tarjeta hidrosensible...</div>';
  document.getElementById('ia-veredicto-texto').innerHTML = '';

  const condMeteo = STATE.meteo ? (
    'Condiciones ambientales al momento: temperatura ' + STATE.meteo.temperature_2m + '°C, ' +
    'HR ' + STATE.meteo.relative_humidity_2m + '%, viento ' + STATE.meteo.wind_speed_10m + ' km/h.'
  ) : '';

  const prompt = `Sos un experto en aplicación de fitosanitarios y análisis de tarjetas hidrosensibles. Analizá esta imagen de una tarjeta hidrosensible tomada después de una aplicación agrícola.

Tipo de aplicación realizada: ${obj.label} (objetivo FAO: ${obj.min}–${obj.max} gotas/cm²).
${condMeteo}

Por favor analizá la imagen y respondé ÚNICAMENTE con un objeto JSON con esta estructura exacta (sin texto adicional, sin backticks):
{
  "impactos_cm2": <número entero estimado de gotas por cm²>,
  "vmd_estimado": <VMD estimado en micrones, número entero>,
  "cobertura_pct": <porcentaje de cobertura foliar, número con un decimal>,
  "distribucion": "<uniforme|irregular|muy_irregular>",
  "confianza": "<alta|media|baja>",
  "cumple_objetivo": <true|false>,
  "calidad_imagen": "<buena|aceptable|deficiente>",
  "veredicto": "<texto de 2-3 oraciones con el veredicto agronómico>",
  "recomendaciones": ["<recomendación 1>", "<recomendación 2>", "<recomendación 3>"],
  "observaciones_imagen": "<observación sobre la calidad de la foto o factores que afectan el análisis>"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
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
      })
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
      '<div style="color:var(--warn);font-size:.82rem;padding:.5rem">⚠️ Error al analizar: ' + err.message + '. Verificá tu conexión e intentá nuevamente.</div>';
  }

  btnAnalizar.disabled = false;
  btnAnalizar.innerHTML = '🔄 Volver a analizar';
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
      '<div class="ia-stat-lbl">Gotas/cm²</div>' +
    '</div>' +
    '<div class="ia-stat">' +
      '<div class="ia-stat-val" style="color:' + colorVMD + '">' + r.vmd_estimado + ' µm</div>' +
      '<div class="ia-stat-lbl">VMD estimado</div>' +
    '</div>' +
    '<div class="ia-stat">' +
      '<div class="ia-stat-val" style="color:rgba(255,253,248,.8)">' + r.cobertura_pct + '%</div>' +
      '<div class="ia-stat-lbl">Cobertura</div>' +
    '</div>' +
    '<div class="ia-stat">' +
      '<div class="ia-stat-val" style="font-size:1rem;color:rgba(255,253,248,.7)">' +
        (r.distribucion === 'uniforme' ? '✅ Uniforme' : r.distribucion === 'irregular' ? '⚠️ Irregular' : '🚫 Muy irregular') +
      '</div>' +
      '<div class="ia-stat-lbl">Distribución</div>' +
    '</div>';

  // Confianza badge
  const confLabel = r.confianza === 'alta' ? 'Alta confianza' : r.confianza === 'media' ? 'Confianza media' : 'Baja confianza';

  // Veredicto
  const veredictoHtml =
    '<div style="margin-bottom:.8rem">' +
      '<span style="font-size:1.1rem">' + (r.cumple_objetivo ? '✅' : '⚠️') + '</span>' +
      '<span style="font-weight:700;margin-left:.4rem;color:' + (r.cumple_objetivo ? '#6DBF82' : 'var(--amber)') + '">' +
        (r.cumple_objetivo ? 'Cobertura adecuada' : 'Cobertura insuficiente') +
      '</span>' +
      '<span class="ia-confidence ' + r.confianza + '" style="margin-left:.5rem">' + confLabel + '</span>' +
    '</div>' +
    '<div style="margin-bottom:.9rem;line-height:1.7">' + r.veredicto + '</div>' +
    (r.recomendaciones && r.recomendaciones.length ? (
      '<div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,253,248,.3);margin-bottom:.5rem">Recomendaciones</div>' +
      r.recomendaciones.map(rec => '<div style="display:flex;gap:.5rem;margin-bottom:.35rem"><span style="color:var(--spray-blue);flex-shrink:0">→</span><span>' + rec + '</span></div>').join('')
    ) : '') +
    (r.observaciones_imagen ? (
      '<div style="margin-top:.8rem;padding:.6rem .8rem;background:rgba(255,255,255,.04);border-radius:8px;font-size:.75rem;color:rgba(255,253,248,.4)">' +
      '📷 ' + r.observaciones_imagen + '</div>'
    ) : '') +
    '<div style="margin-top:.9rem;padding:.6rem .8rem;background:rgba(255,255,255,.04);border-radius:8px;font-size:.7rem;color:rgba(255,253,248,.3);line-height:1.5">' +
    '⚠ El análisis por IA es orientativo. Para medición de precisión usar DepositScan (USDA) o papel hidrosensible con lupa calibrada.' +
    '</div>';

  document.getElementById('ia-veredicto-texto').innerHTML = veredictoHtml;

  // Sincronizar con el panel de evaluación principal
  document.getElementById('ths-impactos').textContent = r.impactos_cm2;
  document.getElementById('ths-vmd-est').textContent = r.vmd_estimado;
  document.getElementById('ths-cobertura').textContent = r.cobertura_pct + '%';

  // Calcular L/ha estimado
  const lhaEst = ((Math.pow(r.vmd_estimado, 3) * r.impactos_cm2 * Math.PI) / 6e7).toFixed(1);
  document.getElementById('ths-lha-est').textContent = lhaEst;

  // Disparar evaluación general
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

// ═══ COMPATIBILIDAD DE MEZCLAS ════════════════════════════

// Base de compatibilidad física y biológica
// Estructura: clave = par de tipos, valor = {estado, titulo, texto, orden}
const COMPAT_DB = {
  // ── PARES INCOMPATIBLES ──
  'glifosato+calcio':       { st:'incompatible', txt:'El Ca²⁺ forma sal insoluble con el glifosato (glicina-Ca), inactivándolo. Si el agua es dura, agregar sulfato de amonio PRIMERO.' },
  'glifosato+magnesio':     { st:'incompatible', txt:'Similar al calcio: el Mg²⁺ antagoniza el glifosato. Usar sulfato de amonio como corrector antes del herbicida.' },
  'op+alcalino':            { st:'incompatible', txt:'Los organofosforados (clorpirifos, metamidofos) se hidrolizan rápidamente en pH > 7. Usar buffer ácido antes de agregar el OP.' },
  'cobre+emulsionable':     { st:'incompatible', txt:'Los fungicidas cúpricos son incompatibles con la mayoría de formulaciones EC (emulsionables). Pueden precipitar y tapar filtros.' },
  '2bd+temperatura':        { st:'precaucion', txt:'El 2,4-D amina a temperaturas > 28°C volatiliza. Verificar condiciones antes de mezclar con cualquier producto.' },
  'dicamba+temperatura':    { st:'precaucion', txt:'El dicamba a temperaturas > 30°C tiene alto riesgo de deriva por volatilización. No mezclar en horas de calor extremo.' },

  // ── PARES COMPATIBLES CON PRECAUCIÓN ──
  'glifosato+als':          { st:'precaucion', txt:'Compatibles físicamente. Biológicamente: algunos ALS pueden competir por absorción con glifosato. Verificar cultivo objetivo.' },
  'glifosato+2bd':          { st:'precaucion', txt:'Mezcla frecuente y funcional. Requiere pH 5–6 para ambos productos. Usar acidificante + sulfato de amonio. Temperatura < 28°C.' },
  'glifosato+dicamba':      { st:'precaucion', txt:'Mezcla registrada (Engenia, Roundup PowerMax). Requiere pH < 7, temperatura < 30°C y condiciones de baja volatilización.' },
  'triazol+estrobilurina':  { st:'compatible', txt:'Mezcla de referencia para fungicidas foliares. Complemento de modos de acción (DMI + QoI). Amplia compatibilidad física.' },
  'triazol+insecticida':    { st:'compatible', txt:'Generalmente compatible. Verificar siempre test de jarrita. Mantener agitación durante la mezcla.' },
  'glifosato+graminicida':  { st:'precaucion', txt:'Potencial antagonismo: el cletodim puede inhibirse con glifosato. Consultar bibliografía de la especie objetivo.' },
  'fungicida+insecticida':  { st:'compatible', txt:'Mezcla habitual en cereales. Generalmente compatible. Verificar pH neutro y test de jarrita.' },
  'als+hormonal':           { st:'precaucion', txt:'Verificar compatibilidad por lote. Algunos ALS + hormonales pueden generar fitotoxicidad en condiciones de estrés.' },
  'foliar+herbicida':       { st:'precaucion', txt:'Riesgo de fitotoxicidad si el herbicida daña la cutícula. Generalmente evitar mezclar con herbicidas de contacto.' },
  'coadyuvante+fungicida':  { st:'compatible', txt:'Los surfactantes no iónicos son compatibles con la mayoría de fungicidas. Verificar concentración para evitar espuma.' },
  'sulfatoamonio+glifosato':{ st:'compatible', txt:'Mezcla recomendada: el sulfato de amonio mejora la eficacia del glifosato en agua dura. Agregar PRIMERO al agua, dejar disolver.' },
  'acidificante+op':        { st:'compatible', txt:'El buffer ácido es imprescindible para OP en agua alcalina. Agregar primero el acidificante, verificar pH 5–6.5 antes del OP.' },
};

const PRODUCTOS_MEZCLA = [
  { id:'glifosato',     nombre:'Glifosato 48%',           tipo:'herbicida', grupo:'glifosato',    orden:3, formulacion:'SL' },
  { id:'glifo_amonio',  nombre:'Glifosato amónico 66%',   tipo:'herbicida', grupo:'glifosato',    orden:3, formulacion:'SL' },
  { id:'2bd',           nombre:'2,4-D amina 72%',          tipo:'herbicida', grupo:'2bd',           orden:4, formulacion:'SL' },
  { id:'dicamba',       nombre:'Dicamba 48%',              tipo:'herbicida', grupo:'dicamba',       orden:4, formulacion:'SL' },
  { id:'als_metsulfuron',nombre:'Metsulfurón 60%',         tipo:'herbicida', grupo:'als',           orden:5, formulacion:'WG' },
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
  { id:'boro',          nombre:'Boro líquido',             tipo:'foliar',    grupo:'foliar',        orden:5, formulacion:'SL' },
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
        ${sel ? `<button class="mezcla-remove" onclick="quitarMezcla(${i})">✕</button>` : ''}
      </div>
      <select class="form-select" onchange="setMezcla(${i}, this.value)">
        <option value="">— Seleccionar producto —</option>
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
    document.getElementById('mezcla-resultado').innerHTML = '<div class="rec-item alerta"><div class="rec-icon">⚠️</div><div class="rec-content"><div class="rec-titulo alerta">Seleccioná al menos 2 productos</div></div></div>';
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
          st = 'precaucion'; txt = 'Dos formulaciones EC (emulsionables): riesgo de rotura de emulsión. Test de jarrita obligatorio.';
        }
        if (a.formulacion === 'WP' || b.formulacion === 'WP') {
          st = 'precaucion'; txt = 'Formulación WP (polvo mojable): dispersar en agua aparte antes de agregar al tanque. Mantener agitación.';
        }
        resultados.push({ a: a.nombre, b: b.nombre, st, txt });
      }
    }
  }

  // Reglas globales de la mezcla completa
  const grupos = seleccionados.map(p => p.grupo);
  if (grupos.includes('glifosato') && !grupos.includes('sulfatoamonio') && !grupos.includes('acidificante')) {
    alertasGlobales.push({ ico:'⚠️', txt:'La mezcla contiene glifosato pero no incluye sulfato de amonio ni acidificante. Se recomienda agregar ambos para agua dura y/o alcalina.' });
  }
  if (grupos.includes('op') && !grupos.includes('acidificante')) {
    alertasGlobales.push({ ico:'🚨', txt:'La mezcla contiene un organofosforado. Es imprescindible un buffer de pH. Agregar acidificante primero.' });
  }
  if (grupos.filter(g => g === 'ec' || g === 'graminicida' || g === 'triazol').length >= 2) {
    alertasGlobales.push({ ico:'🧪', txt:'Múltiples formulaciones EC: realizar SIEMPRE test de jarrita antes de cargar el equipo completo.' });
  }

  // Veredicto global
  const hayIncompat = resultados.some(r => r.st === 'incompatible');
  const hayPrecaucion = resultados.some(r => r.st === 'precaucion');
  const verdGlobal = hayIncompat ? 'incompatible' : hayPrecaucion ? 'precaucion' : 'compatible';
  const verdIcono = hayIncompat ? '🚫' : hayPrecaucion ? '⚠️' : '✅';
  const verdTxt = hayIncompat ? 'Mezcla con incompatibilidades — revisar antes de aplicar' : hayPrecaucion ? 'Mezcla viable con precauciones' : 'Mezcla compatible';

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
          <span style="font-size:1rem">${r.st==='incompatible'?'🚫':r.st==='precaucion'?'⚠️':'✅'}</span>
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
          <div style="font-size:.7rem;color:rgba(28,18,8,.4)">${p.formulacion} · ${p.tipo}</div>
        </div>
      </div>`).join('')}
    <div style="font-size:.72rem;color:rgba(28,18,8,.4);margin-top:.7rem;line-height:1.5">
      ⚠ Siempre con el tanque a mitad de agua. Agitar entre cada producto. Completar con agua al final.
    </div>`;
}

// ═══ CARENCIA Y REINGRESO ═════════════════════════════════
const CARENCIA_DB = [
  // Herbicidas
  { id:1, nombre:'Glifosato 48%', pa:'Glifosato', tipo:'herbicida', cultivos:['Soja','Maíz','Girasol','Trigo','Barbecho'], carencia_dias:0, reingreso_hs:4, ica:'Clase IV — Ligeramente peligroso', notas:'Sin período de carencia para barbecho. En cultivos verificar marbete por variedad.' },
  { id:2, nombre:'2,4-D amina 72%', pa:'2,4-D amina', tipo:'herbicida', cultivos:['Trigo','Maíz','Pasturas','Barbecho'], carencia_dias:21, reingreso_hs:24, ica:'Clase II — Moderadamente peligroso', notas:'No aplicar en floración. Distancia mínima de cultivos sensibles: 500 m.' },
  { id:3, nombre:'Dicamba 48%', pa:'Dicamba', tipo:'herbicida', cultivos:['Maíz','Soja XtendFlex','Barbecho'], carencia_dias:30, reingreso_hs:24, ica:'Clase III — Levemente peligroso', notas:'Solo en variedades tolerantes. Alta volatilización > 27°C.' },
  { id:4, nombre:'Atrazina 50%', pa:'Atrazina', tipo:'herbicida', cultivos:['Maíz','Sorgo'], carencia_dias:45, reingreso_hs:12, ica:'Clase III', notas:'Residualidad alta en suelo. Restricción de 45 días antes de cosecha.' },
  { id:5, nombre:'Metsulfurón 60%', pa:'Metsulfurón metil', tipo:'herbicida', cultivos:['Trigo','Cebada'], carencia_dias:60, reingreso_hs:4, ica:'Clase IV', notas:'Alta residualidad. Restricción estricta para cultivos de verano en rotación.' },
  { id:6, nombre:'Cletodim 24%', pa:'Cletodim', tipo:'herbicida', cultivos:['Soja','Girasol','Colza'], carencia_dias:45, reingreso_hs:12, ica:'Clase III', notas:'No aplicar en gramíneas cultivadas. Respetar carencia estrictamente.' },
  { id:7, nombre:'Haloxifop 12%', pa:'Haloxifop-metil', tipo:'herbicida', cultivos:['Soja','Girasol'], carencia_dias:60, reingreso_hs:24, ica:'Clase II', notas:'Alta carencia. Verificar restricciones para exportación.' },
  { id:8, nombre:'Saflufenacil 70%', pa:'Saflufenacil', tipo:'herbicida', cultivos:['Barbecho','Maíz'], carencia_dias:0, reingreso_hs:12, ica:'Clase III', notas:'Principalmente para barbecho. En maíz verificar tolerancia varietal.' },
  // Fungicidas
  { id:9, nombre:'Tebuconazole 25%', pa:'Tebuconazole', tipo:'fungicida', cultivos:['Trigo','Soja','Girasol','Maíz'], carencia_dias:21, reingreso_hs:24, ica:'Clase III', notas:'Triazol sistémico. Respetar carencia en trigo para exportación a UE.' },
  { id:10, nombre:'Azoxistrobin + Ciproconazole', pa:'Azoxistrobin + Ciproconazole', tipo:'fungicida', cultivos:['Soja','Maíz','Trigo','Girasol'], carencia_dias:14, reingreso_hs:4, ica:'Clase IV', notas:'Estrobilurina + triazol. Amplio espectro. Buena selectividad.' },
  { id:11, nombre:'Trifloxistrobin + Ciproconazole', pa:'Trifloxistrobin + Ciproconazole', tipo:'fungicida', cultivos:['Soja','Maíz','Trigo'], carencia_dias:21, reingreso_hs:4, ica:'Clase IV', notas:'Respetar límites máximos de residuo para destino de exportación.' },
  { id:12, nombre:'Mancozeb 80%', pa:'Mancozeb', tipo:'fungicida', cultivos:['Soja','Papa','Tomate','Trigo'], carencia_dias:7, reingreso_hs:24, ica:'Clase III', notas:'Fungicida de contacto. Potencial irritante respiratorio. EPP obligatorio.' },
  { id:13, nombre:'Fluxapiroxad + Epoxiconazole', pa:'Fluxapiroxad + Epoxiconazole', tipo:'fungicida', cultivos:['Trigo','Soja','Cebada'], carencia_dias:30, reingreso_hs:12, ica:'Clase III', notas:'SDHI + triazol. Alta residualidad — respetar carencia para exportación.' },
  // Insecticidas
  { id:14, nombre:'Clorpirifos 48%', pa:'Clorpirifos', tipo:'insecticida', cultivos:['Soja','Maíz','Girasol','Trigo'], carencia_dias:21, reingreso_hs:48, ica:'Clase II — Moderadamente peligroso', notas:'OP de amplio espectro. Altamente tóxico para abejas. Reingreso 48 hs. Restricciones en UE.' },
  { id:15, nombre:'Lambda-cialotrina 5%', pa:'Lambda-cialotrina', tipo:'insecticida', cultivos:['Soja','Maíz','Trigo','Girasol'], carencia_dias:14, reingreso_hs:24, ica:'Clase II', notas:'Piretroide. Tóxico para peces y abejas. Evitar aplicación en floración.' },
  { id:16, nombre:'Cipermetrina 25%', pa:'Cipermetrina', tipo:'insecticida', cultivos:['Soja','Maíz','Trigo'], carencia_dias:14, reingreso_hs:24, ica:'Clase II', notas:'Piretroide de contacto. No aplicar cerca de cursos de agua.' },
  { id:17, nombre:'Imidacloprid 35%', pa:'Imidacloprid', tipo:'insecticida', cultivos:['Soja','Maíz','Papa'], carencia_dias:21, reingreso_hs:12, ica:'Clase II', notas:'Neonicotinoide. Prohibido en floración. Restricciones por impacto en polinizadores.' },
  { id:18, nombre:'Metamidofos 60%', pa:'Metamidofos', tipo:'insecticida', cultivos:['Soja','Algodón'], carencia_dias:21, reingreso_hs:48, ica:'Clase Ib — Altamente peligroso', notas:'⚠ ALTA PELIGROSIDAD. EPP completo obligatorio. Revisar restricciones vigentes de SENASA.' },
  { id:19, nombre:'Spinosad 12%', pa:'Spinosad', tipo:'insecticida', cultivos:['Soja','Maíz','Hortalizas'], carencia_dias:7, reingreso_hs:4, ica:'Clase IV — Ligeramente peligroso', notas:'Selectivo para enemigos naturales. Compatible con manejo integrado.' },
];

let carenciaFiltro = 'todos';
let carenciaBusqueda = '';

function renderCarencia() {
  const busq = carenciaBusqueda.toLowerCase();
  const lista = CARENCIA_DB.filter(p => {
    const matchFiltro = carenciaFiltro === 'todos' || p.tipo === carenciaFiltro || (carenciaFiltro === 'alta_carencia' && p.carencia_dias > 30);
    const matchBusq = !busq || [p.nombre, p.pa, p.cultivos.join(' ')].some(t => t.toLowerCase().includes(busq));
    return matchFiltro && matchBusq;
  });

  const hoy = new Date();
  document.getElementById('carencia-lista').innerHTML = lista.length === 0
    ? '<p class="txt-muted" style="text-align:center;padding:2rem">Sin resultados para esta búsqueda.</p>'
    : lista.map(p => {
        // Semáforo de carencia
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
              <div class="carencia-dato-unit">días</div>
              <div class="carencia-dato-lbl">Carencia</div>
            </div>
            <div class="carencia-dato">
              <div class="carencia-dato-val" style="color:${p.reingreso_hs <= 4 ? 'var(--ok)' : p.reingreso_hs >= 48 ? 'var(--red)' : 'var(--caution)'}">${p.reingreso_hs}</div>
              <div class="carencia-dato-unit">horas</div>
              <div class="carencia-dato-lbl">Reingreso</div>
            </div>
            <div class="carencia-dato">
              <div style="font-size:.72rem;color:rgba(28,18,8,.55);line-height:1.4">${p.ica}</div>
              <div class="carencia-dato-lbl" style="margin-top:.3rem">Clasificación</div>
            </div>
          </div>
          <div class="carencia-alerta ${color}">
            📋 Cultivos: <strong>${p.cultivos.join(', ')}</strong><br>
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
    ? `✅ Faltan <strong>${diffDias} días</strong> para poder cosechar con seguridad.`
    : `⚠️ La fecha segura de cosecha ya pasó hace ${Math.abs(diffDias)} días.`;
}


// ═══ MAPA DE LOTES ═════════════════════════════════════
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
  // Centro inicial: ubicación GPS o Córdoba
  const lat = STATE.lat || -31.42;
  const lon = STATE.lon || -64.18;

  mapaObj = L.map('lotes-map', { zoomControl: true }).setView([lat, lon], 13);

  // Capa OSM base
  mapaCapaOsm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(mapaObj);

  // Capa satélite (Esri)
  mapaCapaSatelite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: '© Esri', maxZoom: 19 }
  );

  // Marcador GPS
  if (STATE.lat) {
    L.circleMarker([STATE.lat, STATE.lon], {
      radius: 8, fillColor: '#3A7AB8', color: 'white',
      weight: 2, fillOpacity: 0.9
    }).addTo(mapaObj).bindTooltip('Tu ubicación', { permanent: false });
  }

  // Click handler para dibujo
  mapaObj.on('click', mapaClick);
  mapaObj.on('dblclick', mapaDblClick);

  // Renderizar lotes guardados
  lotesGuardados.forEach(l => renderLoteEnMapa(l));
  renderListaLotes();

  document.getElementById('mapa-estado').textContent = '✅ Mapa listo — GPS activo';
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

  // Actualizar superficie y vértices
  document.getElementById('nuevo-lote-vertices').textContent =
    `Vértices: ${puntosPolygono.length} (doble click para cerrar)`;

  if (puntosPolygono.length >= 3) {
    const sup = calcSuperficieHa(puntosPolygono);
    document.getElementById('nuevo-lote-sup').textContent =
      `Superficie estimada: ${sup.toFixed(2)} ha`;

    // Preview polígono cerrado
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
  // Cerrar polígono — mostrar formulario
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
    document.getElementById('btn-dibujar').textContent = '✕ Cancelar dibujo';
    document.getElementById('panel-instrucciones').style.display = '';
    document.getElementById('mapa-estado').textContent =
      '✏️ Modo dibujo — click para marcar vértices, doble click para cerrar';
    mapaObj.getContainer().style.cursor = 'crosshair';
  }
}

function cancelarDibujo() {
  modosDibujo = false;
  puntosPolygono = [];
  if (polylineTemp) { mapaObj.removeLayer(polylineTemp); polylineTemp = null; }
  if (polygonTemp) { mapaObj.removeLayer(polygonTemp); polygonTemp = null; }
  document.getElementById('btn-dibujar').classList.remove('active');
  document.getElementById('btn-dibujar').innerHTML = '✏️ Dibujar lote';
  document.getElementById('panel-instrucciones').style.display = 'none';
  document.getElementById('panel-nuevo-lote').style.display = 'none';
  document.getElementById('nuevo-lote-nombre').value = '';
  document.getElementById('nuevo-lote-estab').value = '';
  document.getElementById('mapa-estado').textContent = '✅ Mapa listo';
  mapaObj.getContainer().style.cursor = '';
}

function guardarLote() {
  const nombre = document.getElementById('nuevo-lote-nombre').value.trim() || 'Lote sin nombre';
  const estab = document.getElementById('nuevo-lote-estab').value.trim();
  if (puntosPolygono.length < 3) {
    alert('Marcá al menos 3 puntos para definir el lote.');
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
  toast('🗺 Lote "' + nombre + '" guardado · ' + sup.toFixed(1) + ' ha');
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
    `${lote.estab ? lote.estab + ' · ' : ''}${lote.sup} ha · Creado: ${lote.fechaCreacion}`;

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
          <div style="font-weight:600;color:var(--earth)">${a.fecha} — ${a.producto || 'Sin producto'}</div>
          <div style="color:rgba(28,18,8,.45)">${a.ha || '—'} ha · ${a.volha || '—'} L/ha</div>
        </div>
      </div>`).join('');
    if (apls.length > 5) {
      histDiv.innerHTML += `<div style="font-size:.7rem;color:rgba(28,18,8,.4);text-align:center;margin-top:.3rem">+${apls.length-5} aplicaciones más en el registro</div>`;
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
  document.getElementById('reg-lote').value = lote.nombre + (lote.estab ? ' — ' + lote.estab : '');
  document.getElementById('reg-ha').value = lote.sup;
  toast('📋 Registro prellenado con "' + lote.nombre + '"');
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
    lista.innerHTML = '<p class="txt-muted" style="font-size:.78rem;text-align:center;padding:1rem">Dibujá tu primer lote usando el botón de arriba.</p>';
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
            <div class="lote-meta">${l.estab ? l.estab + ' · ' : ''}${l.sup} ha · ${apls.length} aplicacion${apls.length !== 1 ? 'es' : ''}</div>
          </div>
        </div>
        <div class="lote-acciones">
          <button class="lote-btn-sm" onclick="event.stopPropagation();mostrarDetalleLote(${l.id})">📋 Historial</button>
          <button class="lote-btn-sm" onclick="event.stopPropagation();irALote(${l.id})">🗺 Ver</button>
          <button class="lote-btn-sm danger" onclick="event.stopPropagation();eliminarLote(${l.id})">🗑</button>
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
  if (!lote || !confirm('¿Eliminar el lote "' + lote.nombre + '"?')) return;
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

// ── Utilidades geométricas ──
function calcSuperficieHa(puntos) {
  // Fórmula de Gauss (Shoelace) en coordenadas lat/lon → m² → ha
  // Aproximación local con factor de conversión
  let area = 0;
  const n = puntos.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += puntos[i][1] * puntos[j][0];
    area -= puntos[j][1] * puntos[i][0];
  }
  area = Math.abs(area) / 2;
  // Conversión: 1 grado lat ≈ 111320 m, 1 grado lon ≈ 111320 * cos(lat) m
  const latMedia = puntos.reduce((s, p) => s + p[0], 0) / n;
  const factorLat = 111320;
  const factorLon = 111320 * Math.cos(latMedia * Math.PI / 180);
  const areaM2 = area * factorLat * factorLon;
  return areaM2 / 10000; // → hectáreas
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

// ═══ EVALUACIÓN DE COBERTURA EN CANOPEO ══════════════════

// Estado global del módulo
const CANOPEO = {
  modo: 'barbecho',
  // Cada posición: array de 3 repeticiones { base64, mime, resultado }
  barbecho: [ null, null, null ],
  superior: [ null, null, null ],
  medio:    [ null, null, null ],
  inferior: [ null, null, null ],
};

// ── Sub-navegación ──
function setCanopeoModo(modo) {
  CANOPEO.modo = modo;
  ['barbecho','canopeo','sintesis'].forEach(m => {
    document.getElementById('canopeo-' + m).style.display = m === modo ? '' : 'none';
    document.getElementById('cansub-' + m).classList.toggle('active', m === modo);
  });
  if (modo === 'sintesis') generarSintesis();
}

// ── Renderizar celdas de repetición ──
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
          rep.resultado.impactos_cm2 + ' g/cm²</div>' : '') +
      (rep && !rep.resultado && rep.base64 ?
        '<div class="rep-spinner">⏳</div>' : '') +
      (!rep ? '<div style="font-size:1.3rem">📷</div>' : '') +
    '</div>';
  }).join('');
}

function initReps() {
  ['barbecho','superior','medio','inferior'].forEach(pos => renderReps(pos));
}

// ── Cargar foto en una repetición ──
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

// ── Analizar una repetición individual via Claude Vision ──
async function analizarRep(posicion, idx, tipoAplic) {
  const rep = CANOPEO[posicion][idx];
  if (!rep || !rep.base64) return null;

  const obj = IMPACTOS_OBJETIVO[tipoAplic];
  const posLabel = { barbecho:'suelo/barbecho', superior:'superior del canopeo',
                     medio:'1/3 medio del canopeo', inferior:'1/3 inferior del canopeo' }[posicion];

  const condMeteo = STATE.meteo
    ? 'Condiciones: T=' + STATE.meteo.temperature_2m + '°C, HR=' +
      STATE.meteo.relative_humidity_2m + '%, viento=' + STATE.meteo.wind_speed_10m + ' km/h. '
    : '';

  const prompt = 'Sos experto en análisis de tarjetas hidrosensibles. Esta tarjeta fue colocada en la posición ' +
    posLabel + ' para evaluar cobertura de pulverización agrícola. ' +
    'Aplicación: ' + obj.label + ' (objetivo FAO: ' + obj.min + '–' + obj.max + ' gotas/cm²). ' +
    condMeteo +
    'Respondé ÚNICAMENTE con JSON sin texto adicional ni backticks: ' +
    '{"impactos_cm2":<int>,"vmd_estimado":<int>,"cobertura_pct":<float>,' +
    '"distribucion":"<uniforme|irregular|muy_irregular>",' +
    '"confianza":"<alta|media|baja>","cumple_objetivo":<bool>,' +
    '"lha_estimado":<float>}';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:400,
        messages:[{
          role:'user',
          content:[
            { type:'image', source:{ type:'base64', media_type:rep.mime, data:rep.base64 } },
            { type:'text', text:prompt }
          ]
        }]
      })
    });
    const data = await res.json();
    const txt = data.content?.[0]?.text || '';
    const clean = txt.replace(/```json|```/g,'').trim();
    const resultado = JSON.parse(clean);

    // Calcular L/ha desde fórmula Leiva si no viene en la respuesta
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

// ── Promediar resultados de una posición ──
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

// ── Mostrar stats en slot ──
function mostrarStatsSlot(posicion, stats) {
  if (!stats) return;
  const bar = document.getElementById('resultado-' + posicion);
  const statsEl = document.getElementById('stats-' + posicion);
  if (!bar || !statsEl) return;
  bar.style.display = '';

  const colorImp = stats.cumple ? 'var(--ok)' : stats.impactos_avg > 0 ? 'var(--caution)' : 'var(--red)';
  statsEl.innerHTML =
    '<div class="slot-stat"><div class="slot-stat-val" style="color:' + colorImp + '">' + stats.impactos_avg + '</div><div class="slot-stat-lbl">g/cm²</div></div>' +
    '<div class="slot-stat"><div class="slot-stat-val">' + stats.vmd_avg + '</div><div class="slot-stat-lbl">VMD µm</div></div>' +
    '<div class="slot-stat"><div class="slot-stat-val">' + stats.cobertura_avg + '%</div><div class="slot-stat-lbl">Cobertura</div></div>' +
    '<div class="slot-stat"><div class="slot-stat-val">' + stats.lha_avg + '</div><div class="slot-stat-lbl">L/ha</div></div>';

  const slot = document.getElementById('slot-' + posicion);
  if (slot) { slot.classList.remove('cargada'); slot.classList.add('analizada'); }
}

// ── Analizar todas — Barbecho ──
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
    // Cotejo con teórico
    const teorico = {
      lha: parseFloat(document.getElementById('res-lha')?.textContent) || null,
      impactos: parseInt(document.getElementById('cob-impactos-slider')?.value) || null,
      vmd: parseInt(document.getElementById('cob-vmd-objetivo')?.value) || null,
    };

    document.getElementById('barb-placeholder').style.display = 'none';
    document.getElementById('resultado-barbecho-panel').style.display = '';

    document.getElementById('barb-stats-resultado').innerHTML =
      '<div class="ia-stat"><div class="ia-stat-val" style="color:' + (stats.cumple?'#6DBF82':'var(--amber)') + '">' + stats.impactos_avg + '</div><div class="ia-stat-lbl">Gotas/cm² prom.</div></div>' +
      '<div class="ia-stat"><div class="ia-stat-val">' + stats.lha_avg + '</div><div class="ia-stat-lbl">L/ha reales</div></div>' +
      '<div class="ia-stat"><div class="ia-stat-val">' + stats.vmd_avg + ' µm</div><div class="ia-stat-lbl">VMD real</div></div>' +
      '<div class="ia-stat"><div class="ia-stat-val" style="color:' + (stats.impactos_cv <= 30?'#6DBF82':stats.impactos_cv<=50?'var(--amber)':'#E8604A') + '">' + stats.impactos_cv + '%</div><div class="ia-stat-lbl">CV% reps</div></div>';

    // Cotejo teórico vs real
    if (teorico.lha) {
      const deltaLha = parseFloat(((stats.lha_avg - teorico.lha) / teorico.lha * 100).toFixed(1));
      const deltaImp = teorico.impactos ? parseFloat(((stats.impactos_avg - teorico.impactos) / teorico.impactos * 100).toFixed(1)) : null;
      const clsDelta = d => Math.abs(d) <= 10 ? 'ok' : Math.abs(d) <= 20 ? 'warn' : 'bad';

      document.getElementById('barb-cotejo-teorico').innerHTML =
        '<div class="cotejo-card">' +
        '<div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,253,248,.3);margin-bottom:.6rem">Cotejo teórico vs real</div>' +
        '<div class="cotejo-row"><span class="cotejo-label">L/ha</span><div class="cotejo-vals"><span class="cotejo-teorico">Teór: ' + teorico.lha + '</span><span class="cotejo-real">Real: ' + stats.lha_avg + '</span><span class="cotejo-delta ' + clsDelta(deltaLha) + '">' + (deltaLha > 0 ? '+' : '') + deltaLha + '%</span></div></div>' +
        (deltaImp !== null ? '<div class="cotejo-row"><span class="cotejo-label">Gotas/cm²</span><div class="cotejo-vals"><span class="cotejo-teorico">Teór: ' + teorico.impactos + '</span><span class="cotejo-real">Real: ' + stats.impactos_avg + '</span><span class="cotejo-delta ' + clsDelta(deltaImp) + '">' + (deltaImp > 0 ? '+' : '') + deltaImp + '%</span></div></div>' : '') +
        '</div>';

      // Ajustes sugeridos
      const ajustes = generarAjustesBarbecho(stats, teorico, deltaLha, deltaImp, obj);
      document.getElementById('barb-ajustes-sugeridos').innerHTML = ajustes;
    }
  }

  btn.disabled = false;
  btn.innerHTML = '🔄 Volver a analizar';
}

function generarAjustesBarbecho(stats, teorico, deltaLha, deltaImp, obj) {
  const sugs = [];

  if (deltaLha < -15) {
    sugs.push({ ico:'💧', tipo:'Aumentar caudal', txt:'El caudal real (' + stats.lha_avg + ' L/ha) está ' + Math.abs(deltaLha) + '% por debajo del teórico. Opciones: reducir velocidad de avance, aumentar presión de trabajo, o usar una boquilla de mayor ISO.' });
  } else if (deltaLha > 15) {
    sugs.push({ ico:'💧', tipo:'Reducir caudal', txt:'El caudal real supera el teórico en ' + deltaLha + '%. Opciones: aumentar velocidad de avance o reducir presión.' });
  }

  if (stats.impactos_avg < obj.min) {
    const lhaNecesario = ((Math.pow(stats.vmd_avg,3) * obj.min * Math.PI) / 6e7).toFixed(1);
    sugs.push({ ico:'🎯', tipo:'Cobertura insuficiente', txt:'Se necesitan ' + obj.min + ' gotas/cm² mínimo. Con VMD actual de ' + stats.vmd_avg + ' µm necesitás ' + lhaNecesario + ' L/ha. O reducir VMD para lograr más impactos con igual caudal.' });
  }

  if (stats.impactos_cv > 30) {
    sugs.push({ ico:'📊', tipo:'Distribución irregular', txt:'CV% de ' + stats.impactos_cv + '% entre repeticiones indica distribución no uniforme. Verificar boquillas tapadas, presión inestable o velocidad variable.' });
  }

  if (!sugs.length) {
    return '<div class="ajuste-sugerido"><span style="font-size:1.1rem">✅</span><div><div class="ajuste-tipo" style="color:#6DBF82">Sin ajustes requeridos</div><div class="ajuste-texto">Los parámetros reales están dentro del rango aceptable respecto al teórico.</div></div></div>';
  }

  return sugs.map(s =>
    '<div class="ajuste-sugerido"><span style="font-size:1.1rem">' + s.ico + '</span>' +
    '<div><div class="ajuste-tipo" style="color:var(--amber)">' + s.tipo + '</div>' +
    '<div class="ajuste-texto">' + s.txt + '</div></div></div>'
  ).join('');
}

// ── Analizar todos los estratos del canopeo ──
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
  btn.innerHTML = '✅ Analizados — ver Síntesis';
  toast('✅ Análisis de canopeo completado — ir a Síntesis para ver resultados');
}

// ── Síntesis general ──
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

  // ── Barbecho ──
  if (tieneBarbecho) {
    const tipo = document.getElementById('barb-tipo-aplic')?.value || 'herb_sistemico';
    const obj = IMPACTOS_OBJETIVO[tipo];
    html += '<div style="margin-bottom:1.5rem">' +
      '<div style="font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,253,248,.3);margin-bottom:.8rem">Barbecho / Suelo</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem">' +
      statCard(statsBarbecho.impactos_avg, 'Gotas/cm²', statsBarbecho.cumple ? '#6DBF82' : 'var(--amber)') +
      statCard(statsBarbecho.lha_avg, 'L/ha reales', 'rgba(255,253,248,.8)') +
      statCard(statsBarbecho.vmd_avg + ' µm', 'VMD real', 'rgba(255,253,248,.8)') +
      statCard(statsBarbecho.impactos_cv + '%', 'CV%', statsBarbecho.impactos_cv<=30?'#6DBF82':statsBarbecho.impactos_cv<=50?'var(--amber)':'#E8604A') +
      '</div></div>';
  }

  // ── Canopeo ──
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
      '<div style="padding:.6rem;text-align:center;font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,253,248,.25);border-bottom:1px solid rgba(255,255,255,.06)">Gotas/cm²</div>' +
      '<div style="padding:.6rem;text-align:center;font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,253,248,.25);border-bottom:1px solid rgba(255,255,255,.06)">L/ha</div>' +
      '<div style="padding:.6rem;text-align:center;font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,253,248,.25);border-bottom:1px solid rgba(255,255,255,.06)">VMD µm</div>' +
      '<div style="padding:.6rem;text-align:center;font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,253,248,.25);border-bottom:1px solid rgba(255,255,255,.06)">CV%</div>' +
      posiciones.map(p =>
        '<div style="padding:.6rem .8rem;font-size:.78rem;font-weight:700;color:' + p.color + ';border-bottom:1px solid rgba(255,255,255,.04)">' + p.label + '</div>' +
        '<div style="padding:.6rem;text-align:center;font-size:.82rem;font-family:DM Mono,monospace;color:' + (p.stats.cumple?'#6DBF82':'var(--amber)') + ';border-bottom:1px solid rgba(255,255,255,.04)">' + p.stats.impactos_avg + '</div>' +
        '<div style="padding:.6rem;text-align:center;font-size:.82rem;font-family:DM Mono,monospace;color:rgba(255,253,248,.8);border-bottom:1px solid rgba(255,255,255,.04)">' + p.stats.lha_avg + '</div>' +
        '<div style="padding:.6rem;text-align:center;font-size:.82rem;font-family:DM Mono,monospace;color:rgba(255,253,248,.8);border-bottom:1px solid rgba(255,255,255,.04)">' + p.stats.vmd_avg + '</div>' +
        '<div style="padding:.6rem;text-align:center;font-size:.82rem;font-family:DM Mono,monospace;color:' + (p.stats.impactos_cv<=30?'#6DBF82':p.stats.impactos_cv<=50?'var(--amber)':'#E8604A') + ';border-bottom:1px solid rgba(255,255,255,.04)">' + p.stats.impactos_cv + '%</div>'
      ).join('') +
      '</div></div>';

    // Barra de penetración
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
        '<div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,253,248,.3);margin-bottom:.6rem">Distribución de L/ha por estrato</div>' +
        '<div class="penetracion-track">' +
        '<div class="pen-seg pen-sup" style="flex:' + pSup + '">' + lhaSup + ' L/ha</div>' +
        (lhaMed > 0 ? '<div class="pen-seg pen-medio" style="flex:' + pMed + '">' + lhaMed + ' L/ha</div>' : '') +
        (lhaInf > 0 ? '<div class="pen-seg pen-inf" style="flex:' + pInf + '">' + lhaInf + ' L/ha</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:1.5rem;margin-top:.5rem;font-size:.7rem;color:rgba(255,253,248,.4)">' +
        '<span style="color:#7ABAEE">■ Superior ' + pSup + '%</span>' +
        (lhaMed > 0 ? '<span style="color:#2ECC71">■ Medio ' + pMed + '% (ef: ' + efMed + '% del sup)</span>' : '') +
        (lhaInf > 0 ? '<span style="color:#E8604A">■ Inferior ' + pInf + '% (ef: ' + efInf + '% del sup)</span>' : '') +
        '</div></div>';

      // Interpretación agronómica
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

  // Umbrales por tipo de aplicación
  const esContacto = tipoAplic.includes('contacto');
  const esFungicida = tipoAplic.includes('fung');

  if (esFungicida) {
    if (efInf < 20) {
      msgs.push({ ico:'🚨', cls:'bad', txt:'Penetración inferior muy baja (' + efInf + '% del estrato superior). Para fungicidas el 1/3 inferior es crítico — allí está el inóculo. Aumentar volumen de caldo, reducir VMD o usar boquillas orientadas hacia abajo.' });
    } else if (efInf < 40) {
      msgs.push({ ico:'⚠️', cls:'warn', txt:'Penetración al estrato inferior moderada (' + efInf + '%). Considerar aumentar L/ha o evaluar uso de coadyuvante penetrante para mejorar cobertura en zona de mayor presión de enfermedad.' });
    } else {
      msgs.push({ ico:'✅', cls:'ok', txt:'Buena penetración al estrato inferior (' + efInf + '% del superior). Distribución adecuada para fungicida.' });
    }
  }

  if (esContacto && efInf < 25) {
    msgs.push({ ico:'⚠️', cls:'warn', txt:'Para productos de contacto la cobertura del estrato inferior es clave. Con ' + efInf + '% de eficiencia inferior hay riesgo de escape de plagas/enfermedades en esa zona.' });
  }

  if (efMed < 30) {
    msgs.push({ ico:'💧', cls:'warn', txt:'El estrato medio recibe solo ' + efMed + '% del caldo aplicado al superior. El canopeo intercepta más del 70% del producto antes de llegar al medio. Verificar índice de área foliar y ajustar horario de aplicación.' });
  }

  const colores = { ok:'#6DBF82', warn:'var(--amber)', bad:'#E8604A' };
  return '<div style="border-top:1px solid rgba(255,255,255,.07);padding-top:1rem;margin-top:.5rem">' +
    '<div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,253,248,.3);margin-bottom:.7rem">Interpretación agronómica</div>' +
    msgs.map(m =>
      '<div style="display:flex;gap:.6rem;align-items:flex-start;margin-bottom:.6rem;padding:.65rem .8rem;background:rgba(255,255,255,.04);border-radius:10px;border:1px solid rgba(255,255,255,.06)">' +
      '<span style="font-size:1rem;flex-shrink:0">' + m.ico + '</span>' +
      '<div style="font-size:.78rem;color:rgba(255,253,248,.65);line-height:1.55">' + m.txt + '</div>' +
      '</div>'
    ).join('') +
    '</div>';
}

// ─── INIT ─────────────────────────────────────────────────
renderHistorial();
initGPS();
calcularAgua();
actualizarObjetivo();
initTarjetaCanvas();
initMezclaSlots();
renderCarencia();
initReps();
// Fecha default hoy
document.getElementById("car-fecha-aplic").value = new Date().toISOString().split("T")[0];
// Init canopeo
renderPosiciones();
setEscenario('barbecho');



function pulvInit() {
  if(typeof renderHistorial === 'function') renderHistorial();
  if(typeof initGPS === 'function') initGPS();
  if(typeof calcularAgua === 'function') calcularAgua();
  if(typeof actualizarObjetivo === 'function') actualizarObjetivo();
  if(typeof initTarjetaCanvas === 'function') initTarjetaCanvas();
  if(typeof initMezclaSlots === 'function') initMezclaSlots();
  if(typeof renderCarencia === 'function') renderCarencia();
  if(typeof initReps === 'function') initReps();
  try { document.getElementById('car-fecha-aplic').value = new Date().toISOString().split('T')[0]; } catch(e){}
  if(typeof renderPosiciones === 'function') renderPosiciones();
  if(typeof setEscenario === 'function') setEscenario('barbecho');
}

// Iniciar de forma diferida si es importado o de inmediato si ya estábamos.
setTimeout(() => { if(typeof pulvInit === 'function') pulvInit(); }, 100);
