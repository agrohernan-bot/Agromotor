// ════════════════════════════════════════════════════════
// AGROMOTOR — asistente.js
// Asistente IA · Claude API · Contexto completo del lote
// 12 preguntas rápidas · Historial 10 turnos
// ════════════════════════════════════════════════════════

function iaConstruirContexto() {
  const ctx = [];

  // Coordenadas y ubicación
  const coord = $('s-coord')?.value;
  if (coord) ctx.push(`COORDENADAS DEL LOTE: ${coord}`);

  // Cultivo y fecha de siembra
  const cultivo = gv('s-cultivo') || '—';
  const fecha   = gv('s-fecha')   || '—';
  ctx.push(`CULTIVO: ${cultivo} · FECHA DE SIEMBRA PLANIFICADA: ${fecha}`);

  // Open-Meteo: datos climáticos tiempo real
  const t6    = $('sv-t6')?.textContent;
  const t18   = $('sv-t18')?.textContent;
  const h1    = $('sv-h1')?.textContent;
  const h2    = $('sv-h2')?.textContent;
  const h3    = $('sv-h3')?.textContent;
  const et0   = $('sv-et0')?.textContent;
  const vpd   = $('sv-vpd')?.textContent;
  const vient = $('sv-viento')?.textContent;
  const lluv  = $('sv-lluv')?.textContent;
  const gdd   = $('i-gdd')?.textContent;
  if (t6) ctx.push(`DATOS OPEN-METEO (tiempo real):
  - Temperatura suelo 6cm: ${t6}
  - Temperatura suelo 18cm: ${t18 || '—'}
  - Humedad 3-9cm: ${h1 || '—'}
  - Humedad 9-27cm: ${h2 || '—'}
  - Humedad 27-81cm: ${h3 || '—'}
  - ET₀ diaria: ${et0 || '—'}
  - VPD: ${vpd || '—'}
  - Viento: ${vient || '—'}
  - Prob. lluvia 72h: ${lluv || '—'}
  - GDD acumulados: ${gdd || '—'}`);

  // NASA POWER: histórico
  const npRad  = $('np-rad')?.textContent;
  const npPrec = $('np-prec')?.textContent;
  const npET0  = $('np-et0')?.textContent;
  const npBal  = $('np-bal')?.textContent;
  if (npRad && npRad !== '—') ctx.push(`DATOS NASA POWER (histórico 30 años):
  - Radiación solar: ${npRad}
  - Precipitación media mensual: ${npPrec}
  - ET₀ media mensual: ${npET0}
  - Balance hídrico histórico: ${npBal}`);

  // SoilGrids: datos de suelo
  const sgPH   = $('sg-ph')?.textContent;
  const sgClay = $('sg-clay')?.textContent;
  const sgSoc  = $('sg-soc')?.textContent;
  const sgN    = $('sg-n')?.textContent;
  const sgDA   = $('sg-da')?.textContent;
  const sgCEC  = $('sg-cec')?.textContent;
  const sgTex  = $('sg-textura')?.textContent;
  const sgSand = $('sg-sand')?.textContent;
  if (sgPH && sgPH !== '—') ctx.push(`DATOS DE SUELO (SoilGrids ISRIC 250m):
  - pH: ${sgPH}
  - Arcilla: ${sgClay} · Arena: ${sgSand}
  - C. orgánico: ${sgSoc}
  - N total: ${sgN}
  - Densidad aparente: ${sgDA}
  - CEC: ${sgCEC}
  - Tipo de suelo: ${sgTex}`);

  // Compactación
  const compact = $('sv-compact')?.textContent || $('sv-compact')?.value;
  const compSrc = $('compact-source')?.textContent;
  if (compact) ctx.push(`RIESGO DE COMPACTACIÓN:
  - MPa estimado: ${compact}
  - Fuente: ${compSrc || 'estimado'}`);

  // ENSO
  if (ENSO_DATA.fase) ctx.push(`ESTADO ENSO (NOAA/CPC):
  - Fase actual: ${ENSO_DATA.label}
  - Prob. El Niño: ${ENSO_DATA.prob_nino}% · Neutro: ${ENSO_DATA.prob_neutro}% · La Niña: ${ENSO_DATA.prob_nina}%
  - Sinopsis: ${ENSO_DATA.sinopsis?.slice(0,200) || '—'}`);

  // Economía
  const precioDisp = $('ec-precio-disp')?.value;
  const precioFut  = $('ec-precio-fut')?.value;
  const margenEl   = $('ec-tabla-body')?.textContent?.slice(0,200);
  const dolar      = EC_DOLAR?.oficial;
  if (precioDisp) ctx.push(`ECONOMÍA DE CAMPAÑA:
  - Precio disponible: USD ${precioDisp}/t
  - Precio futuro cosecha: USD ${precioFut}/t
  - Dólar oficial: $${dolar || '—'}
  - Superficie: ${gv('ec-sup') || '—'} ha · Rendimiento esperado: ${gv('ec-rend') || '—'} t/ha`);

  // Balance hídrico
  const bhRes = $('bh-res')?.classList.contains('hidden');
  if (!bhRes) {
    const bhKpis = $('bh-kpis')?.textContent?.replace(/\s+/g,' ').slice(0,300);
    if (bhKpis) ctx.push(`BALANCE HÍDRICO: ${bhKpis}`);
  }

  return ctx.length > 0
    ? ctx.join('\n\n')
    : 'No hay datos del lote cargados aún. El usuario puede consultarme preguntas generales sobre agronomía pampeana argentina.';
}

// ── SISTEMA PROMPT ────────────────────────────────────
function iaSistemaPrompt() {
  const contexto = iaConstruirContexto();
  return `Sos el asistente agronómico de AgroMotor, un motor agronómico de decisión desarrollado para asesores técnicos y productores de Argentina, con lógica basada en metodología INTA.

Tu rol es interpretar los datos del lote y responder preguntas agronómicas en lenguaje claro, directo y profesional — como lo haría un ingeniero agrónomo experimentado.

DATOS ACTUALES DEL LOTE:
${contexto}

REGLAS:
- Usá los datos reales del lote cuando estén disponibles. Si no hay datos, aclaralo.
- Respondé en español rioplatense (argentino). Usá "vos", "sos", "tenés".
- Sé directo: primero la recomendación, después la justificación.
- Citá las fuentes de datos cuando sea relevante (Open-Meteo, NASA POWER, SoilGrids, NOAA).
- Si el dato es estimado o tiene incertidumbre, aclaralo.
- Respuestas concisas: máximo 3-4 párrafos salvo que se pida más detalle.
- Nunca inventes datos. Si no tenés la información, decilo.
- Podés hacer preguntas de seguimiento si necesitás más contexto.
- Sos INTA-trained: usá terminología agronómica precisa pero explicá los términos técnicos.

ESPECIALIDADES: diagnóstico de siembra, riesgo de compactación, balance hídrico, ENSO y clima, suelo y fertilidad, cultivares y grupos de madurez, economía de campaña, manejo de rastrojos.`;
}

// ── FUNCIÓN PRINCIPAL DE ENVÍO ────────────────────────
async function iaEnviar() {
  if (IA_PENSANDO) return;
  const input = $('ia-input');
  const pregunta = input?.value?.trim();
  if (!pregunta) return;

  input.value = '';
  IA_PENSANDO = true;
  $('ia-btn').disabled = true;
  $('ia-btn').innerHTML = '<span style="font-size:1rem">⟳</span><span>...</span>';

  // Agregar mensaje del usuario al chat
  iaAgregarMensaje('user', pregunta);

  // Agregar al historial
  IA_HISTORIAL.push({ role: 'user', content: pregunta });

  // Indicador de escritura
  const typingId = iaAgregarTyping();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: iaSistemaPrompt(),
        messages: IA_HISTORIAL.slice(-10), // últimos 10 turnos para no exceder tokens
      })
    });

    const data = await response.json();
    const respuesta = data?.content?.[0]?.text || 'No pude generar una respuesta. Intentá de nuevo.';

    // Remover typing y agregar respuesta
    iaRemoverTyping(typingId);
    iaAgregarMensaje('assistant', respuesta);

    // Agregar al historial
    IA_HISTORIAL.push({ role: 'assistant', content: respuesta });

  } catch(e) {
    iaRemoverTyping(typingId);
    iaAgregarMensaje('error', 'Error de conexión con la IA. Verificá tu internet e intentá nuevamente.');
    console.error('IA error:', e);
  } finally {
    IA_PENSANDO = false;
    $('ia-btn').disabled = false;
    $('ia-btn').innerHTML = '<span style="font-size:1.3rem">📤</span><span>Enviar</span>';
    input?.focus();
  }
}

// ── HELPERS DE CHAT ───────────────────────────────────
function iaAgregarMensaje(role, texto) {
  const chat = $('ia-chat');
  if (!chat) return;

  const isUser = role === 'user';
  const isError = role === 'error';

  // Convertir markdown básico a HTML
  const html = texto
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(74,46,26,.08);padding:.1em .3em;border-radius:4px;font-family:DM Mono,monospace;font-size:.85em">$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  const div = document.createElement('div');
  div.style.cssText = `display:flex;gap:.7rem;align-items:flex-start;${isUser?'flex-direction:row-reverse':''}`;

  const avatar = isUser
    ? `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--grain),var(--earth));display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">👤</div>`
    : `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--canopy),#2A5A8C);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">🤖</div>`;

  const bubble = `<div style="
    background:${isUser?'linear-gradient(135deg,var(--canopy),#2A5A8C)':isError?'rgba(201,74,42,.08)':'white'};
    color:${isUser?'white':isError?'var(--warn)':'var(--ink)'};
    border-radius:${isUser?'12px 0 12px 12px':'0 12px 12px 12px'};
    padding:.75rem 1rem;
    max-width:85%;
    box-shadow:0 1px 4px rgba(74,46,26,.08);
    border:1px solid ${isUser?'transparent':isError?'rgba(201,74,42,.2)':'var(--border)'};
    font-size:.84rem;
    line-height:1.65">
    <p>${html}</p>
    ${!isUser?`<div style="font-size:.65rem;color:rgba(74,46,26,.35);margin-top:.5rem;border-top:1px solid rgba(74,46,26,.06);padding-top:.4rem">AgroMotor IA · ${new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</div>`:''}
  </div>`;

  div.innerHTML = avatar + bubble;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function iaAgregarTyping() {
  const chat = $('ia-chat');
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.style.cssText = 'display:flex;gap:.7rem;align-items:flex-start';
  div.innerHTML = `
    <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--canopy),#2A5A8C);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">🤖</div>
    <div style="background:white;border-radius:0 12px 12px 12px;padding:.75rem 1rem;border:1px solid var(--border);box-shadow:0 1px 4px rgba(74,46,26,.08)">
      <div style="display:flex;gap:.3rem;align-items:center;height:20px">
        <div style="width:7px;height:7px;border-radius:50%;background:var(--canopy);animation:pulse 1.2s ease-in-out infinite"></div>
        <div style="width:7px;height:7px;border-radius:50%;background:var(--canopy);animation:pulse 1.2s ease-in-out .4s infinite"></div>
        <div style="width:7px;height:7px;border-radius:50%;background:var(--canopy);animation:pulse 1.2s ease-in-out .8s infinite"></div>
      </div>
    </div>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return id;
}

function iaRemoverTyping(id) {
  $(id)?.remove();
}

function iaPreguntar(texto) {
  const input = $('ia-input');
  if (input) { input.value = texto; iaEnviar(); }
}

// ── ACTUALIZAR BANNER DE CONTEXTO ─────────────────────
function iaActualizarContextoBanner() {
  const coord = $('s-coord')?.value;
  const cult  = gv('s-cultivo');
  const banner = $('ia-contexto-banner');
  const resumen = $('ia-contexto-resumen');
  if (!banner || !resumen) return;

  if (coord) {
    const t6  = $('sv-t6')?.textContent  || '—';
    const h1  = $('sv-h1')?.textContent  || '—';
    const et0 = $('sv-et0')?.textContent || '—';
    const ph  = $('sg-ph')?.textContent  || '—';

    resumen.innerHTML = [
      `📍 ${coord.slice(0,25)}`,
      `🌾 ${cult || '—'}`,
      `🌡️ T°suelo: ${t6}`,
      `💧 Hum: ${h1}`,
      `🌿 ET₀: ${et0}`,
      ph !== '—' ? `⚗️ pH: ${ph}` : null,
      `🌊 ENSO: ${ENSO_DATA.label || '—'}`,
    ].filter(Boolean).map(d =>
      `<span style="font-size:.75rem;background:rgba(74,140,92,.1);padding:.2rem .5rem;border-radius:6px">${d}</span>`
    ).join('');
    banner.classList.remove('hidden');
  }
}

// ════════════════════════════════════════════════════════
// MÓDULO MAPA DISTRIBUIDORES — Leaflet + OpenStreetMap
// ════════════════════════════════════════════════════════

let MAPA_L       = null;   // instancia Leaflet
let MAPA_MARKERS = [];     // markers actuales
let MAPA_LOTE    = null;   // marker del lote
let MAPA_INIT    = false;  // ya inicializado

// Íconos Leaflet personalizados
function mapaIcono(destacado, verificado) {
  const color = destacado ? '#B87A20' : verificado ? '#2A7A4A' : '#4A8C5C';
  const size  = destacado ? 36 : 30;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      background:${color};border:2px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,.3);
      transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center">
      <span style="transform:rotate(45deg);font-size:${destacado?14:11}px">${destacado?'⭐':'🏪'}</span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size],
    popupAnchor: [0, -size]
  });
}

function mapaIconoLote() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:40px;height:40px;border-radius:50%;
      background:linear-gradient(135deg,#1A3320,#2D5A3D);
      border:3px solid white;
      box-shadow:0 2px 10px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;
      font-size:18px">📍</div>`,
    iconSize: [40,40],
    iconAnchor: [20,40],
    popupAnchor: [0,-40]
  });
}

// Inicializar mapa Leaflet
function mapaInicializar(lat, lon) {
  if (MAPA_INIT && MAPA_L) {
    MAPA_L.setView([lat, lon], 9);
    return;
  }

  $('mp-mapa-placeholder').style.display = 'none';
  $('mp-mapa').style.display = 'block';

  MAPA_L = L.map('mp-mapa', {
    center: [lat || -33.5, lon || -61.0],
    zoom: lat ? 9 : 6,
    zoomControl: true,
    attributionControl: true
  });

  // Capa base OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(MAPA_L);

  MAPA_INIT = true;
}

// Renderizar lista lateral y markers en el mapa
function mapaFiltrar() {
  const especie   = gv('mp-especie')    || '';
  const empresa   = gv('mp-empresa')    || '';
  const tipo      = gv('mp-tipo')       || '';
  const radio     = parseInt(gv('mp-radio') || '100');
  const soloDest  = $('mp-solo-dest')?.checked;
  const soloVer   = $('mp-solo-ver')?.checked;

  // Obtener coordenadas del lote si están disponibles
  let latLote = null, lonLote = null;
  const coordTxt = $('s-coord')?.value || $('suelo-coord')?.value;
  if (coordTxt) {
    const parsed = parsCoord(coordTxt);
    latLote = parsed[0]; lonLote = parsed[1];
  }

  // Filtrar DB
  let lista = DC_DB.filter(d => {
    if (especie  && !d.especies.includes(especie))   return false;
    if (empresa  && !d.empresas.includes(empresa))   return false;
    if (tipo     && d.tipo !== tipo)                  return false;
    if (soloDest && !d.dest)                          return false;
    if (soloVer  && !d.ver)                           return false;
    if (latLote !== null) {
      const km = dcDistancia(latLote, lonLote, d.lat, d.lon);
      if (km > radio) return false;
      d._km = km;
    } else {
      d._km = null;
    }
    return true;
  });

  // Ordenar: destacados primero, luego por distancia
  lista.sort((a, b) => {
    if (a.dest && !b.dest) return -1;
    if (!a.dest && b.dest) return 1;
    if (a._km !== null && b._km !== null) return a._km - b._km;
    return (b.ver?1:0) - (a.ver?1:0);
  });

  // Inicializar mapa centrado en el lote o en la pampa
  const centerLat = latLote || -33.5;
  const centerLon = lonLote || -61.0;
  mapaInicializar(centerLat, centerLon);

  // Limpiar markers anteriores
  MAPA_MARKERS.forEach(m => m.remove());
  MAPA_MARKERS = [];
  if (MAPA_LOTE) { MAPA_LOTE.remove(); MAPA_LOTE = null; }

  // Marker del lote
  if (latLote !== null) {
    MAPA_LOTE = L.marker([latLote, lonLote], { icon: mapaIconoLote(), zIndexOffset: 1000 })
      .addTo(MAPA_L)
      .bindPopup('<strong>📍 Tu lote</strong>');
    $('mp-lote-banner').classList.remove('hidden');
    $('mp-lote-coord').textContent = coordTxt?.slice(0,30);
  }

  // Agregar markers de distribuidores
  lista.forEach(d => {
    const marker = L.marker([d.lat, d.lon], { icon: mapaIcono(d.dest, d.ver) })
      .addTo(MAPA_L)
      .bindPopup(`
        <div style="font-family:'DM Sans',sans-serif;min-width:200px">
          <div style="font-weight:700;font-size:.9rem;margin-bottom:.3rem">
            ${d.dest?'⭐ ':''}${d.nombre}
          </div>
          <div style="font-size:.75rem;color:#666;margin-bottom:.4rem">${d.tipo} · ${d.loc}, ${d.prov}</div>
          ${d._km!==null?`<div style="font-size:.8rem;font-weight:600;color:#2A7A4A;margin-bottom:.4rem">📍 ${d._km.toFixed(0)} km del lote</div>`:''}
          <div style="display:flex;flex-wrap:wrap;gap:.2rem;margin-bottom:.5rem">
            ${d.empresas.slice(0,3).map(e=>`<span style="background:#e8f4e8;color:#1A5C2A;padding:.1rem .4rem;border-radius:5px;font-size:.68rem">${e}</span>`).join('')}
          </div>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap">
            ${d.wa?`<a href="https://wa.me/${d.wa}?text=Hola, vi su negocio en AgroMotor" target="_blank" style="background:#25D366;color:white;padding:.3rem .6rem;border-radius:6px;font-size:.72rem;text-decoration:none;font-weight:600">💬 WhatsApp</a>`:''}
            ${d.tel?`<a href="tel:+54${d.tel.replace(/\D/g,'').slice(-10)}" style="background:#2A7A4A;color:white;padding:.3rem .6rem;border-radius:6px;font-size:.72rem;text-decoration:none;font-weight:600">📞 Llamar</a>`:''}
          </div>
        </div>
      `, { maxWidth: 280 });

    marker.on('click', () => mapaSeleccionar(d));
    MAPA_MARKERS.push(marker);
  });

  // Ajustar vista para mostrar todos los markers
  if (MAPA_MARKERS.length > 0 && MAPA_L) {
    const group = L.featureGroup([
      ...MAPA_MARKERS,
      ...(MAPA_LOTE ? [MAPA_LOTE] : [])
    ]);
    MAPA_L.fitBounds(group.getBounds().pad(0.1));
  }

  // Actualizar lista lateral
  $('mp-count').textContent = `${lista.length} distribuidor${lista.length!==1?'es':''} encontrado${lista.length!==1?'s':''}${latLote?` en radio de ${radio} km`:''}`;

  $('mp-lista').innerHTML = lista.length === 0
    ? `<div class="alert info"><span class="ai">🔍</span><div class="ac">No hay distribuidores con esos filtros. Ampliá el radio o quitá algún filtro.</div></div>`
    : lista.map(d => {
        const kmStr = d._km !== null ? `<span style="font-weight:700;color:${d._km<50?'var(--ok)':d._km<100?'var(--caution)':'rgba(74,46,26,.5)'}"> · ${d._km.toFixed(0)} km</span>` : '';
        return `
        <div onclick="mapaSeleccionar(DC_DB.find(x=>x.id==='${d.id}'))"
          style="border:${d.dest?'2px solid rgba(200,162,85,.5)':'1px solid var(--border)'};
                 border-radius:10px;padding:.75rem;cursor:pointer;
                 background:${d.dest?'rgba(200,162,85,.04)':'white'};
                 transition:box-shadow .15s"
          onmouseenter="this.style.boxShadow='0 2px 12px rgba(74,46,26,.1)'"
          onmouseleave="this.style.boxShadow='none'">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="font-weight:700;font-size:.84rem">${d.dest?'⭐ ':''}${d.nombre}</div>
            <div style="font-size:.72rem;color:rgba(74,46,26,.5)">${d.ver?'✓':''}</div>
          </div>
          <div style="font-size:.72rem;color:rgba(74,46,26,.55);margin:.15rem 0">${d.tipo} · ${d.loc}${kmStr}</div>
          <div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.3rem">
            ${d.empresas.slice(0,4).map(e=>`<span style="background:rgba(74,140,92,.08);color:var(--canopy);padding:.1rem .4rem;border-radius:6px;font-size:.67rem">${e}</span>`).join('')}
          </div>
        </div>`;
      }).join('');
}

// Seleccionar distribuidor — resalta en mapa y muestra detalle
function mapaSeleccionar(d) {
  if (!d) return;

  // Centrar mapa en el distribuidor
  if (MAPA_L) MAPA_L.setView([d.lat, d.lon], 12);

  // Abrir popup del marker correspondiente
  const marker = MAPA_MARKERS.find(m => {
    const ll = m.getLatLng();
    return Math.abs(ll.lat - d.lat) < 0.001 && Math.abs(ll.lng - d.lon) < 0.001;
  });
  if (marker) marker.openPopup();

  // Panel de detalle
  const kmStr = d._km !== null ? `<span style="color:${d._km<50?'var(--ok)':d._km<100?'var(--caution)':'var(--ink)'}"> · ${d._km.toFixed(0)} km del lote</span>` : '';

  $('mp-seleccionado').innerHTML = `
    <div style="border:2px solid var(--canopy);border-radius:12px;padding:1rem;background:rgba(74,140,92,.04)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.6rem">
        <div>
          <div style="font-weight:700;font-size:.95rem">${d.dest?'⭐ ':''}${d.nombre}</div>
          <div style="font-size:.75rem;color:rgba(74,46,26,.55)">${d.tipo} · ${d.loc}, ${d.prov}${kmStr}</div>
        </div>
        ${d.ver?'<span style="background:rgba(42,122,74,.1);color:var(--ok);font-size:.68rem;padding:.2rem .5rem;border-radius:6px;font-weight:600">✓ Verificado</span>':''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.7rem">
        ${d.empresas.map(e=>`<span style="background:rgba(74,140,92,.1);color:var(--canopy);padding:.2rem .5rem;border-radius:8px;font-size:.73rem;font-weight:500">${e}</span>`).join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:.4rem">
        ${d.wa    ? `<a href="https://wa.me/${d.wa}?text=Hola, vi su negocio en AgroMotor y me gustaría consultar disponibilidad de semillas" target="_blank" style="display:inline-flex;align-items:center;gap:.3rem;background:#25D366;color:white;padding:.4rem .8rem;border-radius:8px;font-size:.75rem;font-weight:600;text-decoration:none">💬 WhatsApp</a>` : ''}
        ${d.tel   ? `<a href="tel:+54${d.tel.replace(/\D/g,'').slice(-10)}" style="display:inline-flex;align-items:center;gap:.3rem;background:var(--canopy);color:white;padding:.4rem .8rem;border-radius:8px;font-size:.75rem;font-weight:600;text-decoration:none">📞 ${d.tel}</a>` : ''}
        ${d.email ? `<a href="mailto:${d.email}" style="display:inline-flex;align-items:center;gap:.3rem;background:rgba(42,90,140,.9);color:white;padding:.4rem .8rem;border-radius:8px;font-size:.75rem;font-weight:600;text-decoration:none">✉️ Email</a>` : ''}
        ${d.web   ? `<a href="https://${d.web}" target="_blank" style="display:inline-flex;align-items:center;gap:.3rem;background:rgba(74,46,26,.08);color:var(--earth);padding:.4rem .8rem;border-radius:8px;font-size:.75rem;font-weight:600;text-decoration:none;border:1px solid var(--border)">🌐 ${d.web}</a>` : ''}
      </div>
    </div>`;

  $('mp-seleccionado').classList.remove('hidden');
}

// ── NAV ──