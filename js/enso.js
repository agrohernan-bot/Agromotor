/**
 * enso.js — AGROMOTOR v2.0
 *
 * Consulta la fase ENSO (El Niño / La Niña / Neutro) desde la base de datos Supabase
 * (tabla oni_cache, actualizada mensualmente) y calcula el factor de ajuste de precipitación.
 *
 * También provee integración con AgroENSO (Monzon et al. 2026) para renderizar desvíos históricos
 * de rendimiento por departamento y cultivo.
 */

(function () {

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const ONI_URL_TXT  = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt";
const LS_CACHE_KEY = "am_enso_cache_v2";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 7 días

const ONI_UMBRAL_NINYO = 0.5;
const ONI_UMBRAL_NINA  = -0.5;

const AJUSTE_NINYO  =  0.18;   // +18%
const AJUSTE_NEUTRO =  0.00;
const AJUSTE_NINA   = -0.18;   // -18%

const PERIODOS_ONI = ["DJF","JFM","FMA","MAM","AMJ","MJJ","JJA","JAS","ASO","SON","OND","NDJ"];

// ─────────────────────────────────────────────────────────────────────────────
// TRADUCTOR DE FASE
// ─────────────────────────────────────────────────────────────────────────────

function mapDbFaseToLocal(dbFase) {
  if (dbFase === 'ElNino') return 'niño';
  if (dbFase === 'LaNina') return 'niña';
  return 'neutro';
}

function mapCropToDb(cultivo, fechaSiembraStr) {
  if (!cultivo) return '';
  const clean = cultivo.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Quitar acentos
  
  if (clean === 'soja' || clean === 'soja1' || clean === 'soja 1ra' || clean === 'soja_1ra') {
    if (fechaSiembraStr) {
      const parts = fechaSiembraStr.split('-');
      if (parts.length >= 2) {
        const mes = parseInt(parts[1], 10);
        if (mes === 12 || mes === 1 || mes === 2) {
          return 'Soja2';
        }
      }
    }
    return 'Soja1';
  }
  if (clean === 'soja2' || clean === 'soja 2da' || clean === 'soja_2da') return 'Soja2';
  if (clean === 'maiz') return 'Maiz';
  if (clean === 'trigo') return 'Trigo';
  if (clean === 'girasol') return 'Girasol';
  if (clean === 'cebada') return 'Cebada';
  return ''; // Sorgo, Colza, etc.
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function faseDbToLabel(faseDb) {
  if (faseDb === 'ElNino') return 'El Nino';
  if (faseDb === 'LaNina') return 'La Nina';
  return 'Neutro';
}

function faseLocalToDb(fase) {
  if (fase === 'nino') return 'ElNino';
  if (fase === 'nina') return 'LaNina';
  return 'Neutral';
}

function getCropCriticalWindow(cultivo) {
  const clean = String(cultivo || '').toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (clean.includes('maiz')) return 'VT-R2';
  if (clean.includes('soja')) return 'R3-R6';
  if (clean.includes('trigo') || clean.includes('cebada')) return 'floracion y llenado';
  if (clean.includes('girasol')) return 'R4-R6';
  return 'periodo critico';
}

function buildGenericAdvisory(infoText) {
  const d = window.ENSO_DATA || { fase:'neutro', label:'Neutro' };
  const status = infoText ? 'AgroENSO departamental pendiente' : 'ENSO general activo';
  const faseTxt = d.label || 'Neutro';
  const faseNote = d.fase === 'nina'
    ? 'Priorizar lectura de reserva util y riesgo de deficit en floracion.'
    : d.fase === 'nino'
      ? 'Vigilar excesos, anegamiento y ventanas operativas luego de lluvias.'
      : 'Usar la reserva del perfil y el pronostico corto como senal principal.';

  return {
    status,
    tone: infoText ? 'warn' : 'neutral',
    title: `Lectura climatica: ${faseTxt}`,
    summary: infoText || faseNote,
    dashboardText: `${status}. ${faseNote}`,
    bullets: [
      'Interpretacion regional, no reemplaza el balance hidrico del lote.',
      faseNote,
      'Completar ubicacion y cultivo permite activar la lectura historica por departamento.'
    ]
  };
}

function buildDetailedAdvisory(activeLote, impactosOrdenados, currentFaseDb, cultivo) {
  const current = impactosOrdenados.find(i => i.fase_enso === currentFaseDb) || impactosOrdenados[0];
  const dev = current ? parseFloat(current.rend_vs_promedio_pct) : 0;
  const devStr = (dev >= 0 ? '+' : '') + dev.toFixed(1) + '%';
  const faseTxt = faseDbToLabel(currentFaseDb);
  const critico = getCropCriticalWindow(cultivo);
  const depto = activeLote?.data?.depto_nombre || 'la zona';
  const significativo = !!current?.significativo;

  let tone = 'neutral';
  let summary = `En ${depto}, ${cultivo} se comporto cerca del promedio historico bajo fase ${faseTxt} (${devStr}).`;
  let manejo = `Mantener el rendimiento objetivo atado a reserva util, pronostico corto y avance del cultivo.`;
  let hidrico = `Monitorear especialmente ${critico}, donde el cultivo expresa mejor el impacto hidrico.`;

  if (dev <= -10) {
    tone = 'risk';
    summary = `Senal de riesgo: en ${depto}, ${cultivo} rindio ${devStr} frente al promedio bajo fase ${faseTxt}.`;
    manejo = 'Bajar agresividad del rendimiento objetivo si el perfil no esta cargado; priorizar ambientes con mejor reserva.';
    hidrico = `Seguir de cerca deficit y dias de estres en ${critico}.`;
  } else if (dev <= -5) {
    tone = 'warn';
    summary = `Senal moderadamente penalizante: ${cultivo} muestra ${devStr} historico bajo fase ${faseTxt} en ${depto}.`;
    manejo = 'Ajustar expectativas por ambiente y evitar decisiones que dependan de lluvias oportunas.';
    hidrico = `Revisar cobertura hidrica antes de atravesar ${critico}.`;
  } else if (dev >= 10) {
    tone = 'opportunity';
    summary = `Senal favorable: ${cultivo} rindio ${devStr} frente al promedio bajo fase ${faseTxt} en ${depto}.`;
    manejo = 'Si el perfil acompana, sostener planteos de mayor potencial y revisar nutricion para no limitar respuesta.';
    hidrico = `Aprovechar la mejor oferta hidrica sin descuidar excesos o perdidas operativas.`;
  } else if (dev >= 5) {
    tone = 'opportunity';
    summary = `Senal levemente favorable: ${cultivo} muestra ${devStr} historico bajo fase ${faseTxt} en ${depto}.`;
    manejo = 'Mantener objetivo, pero validarlo con agua util y pronostico de corto plazo.';
    hidrico = `Cuidar ventanas de labor y seguimiento en ${critico}.`;
  }

  const sigNote = significativo
    ? 'El efecto aparece como estadisticamente significativo en la base AgroENSO.'
    : 'La senal historica no figura como estadisticamente significativa; usarla como contexto.';

  return {
    status: 'AgroENSO departamental activo',
    tone,
    title: `Lectura agronomica para ${cultivo}`,
    summary,
    dashboardText: `${faseTxt}: ${cultivo} ${devStr} historico en ${depto}. ${manejo}`,
    bullets: [hidrico, manejo, sigNote]
  };
}

function renderAdvisoryBox(advisory) {
  const toneCfg = {
    risk:        { color:'#C62828', bg:'rgba(201,74,42,.08)', border:'rgba(201,74,42,.25)' },
    warn:        { color:'#B87A20', bg:'rgba(184,122,32,.08)', border:'rgba(184,122,32,.25)' },
    opportunity: { color:'#1565C0', bg:'rgba(21,101,192,.08)', border:'rgba(21,101,192,.25)' },
    neutral:     { color:'#2A5A8C', bg:'rgba(42,90,140,.08)', border:'rgba(42,90,140,.25)' }
  };
  const cfg = toneCfg[advisory?.tone] || toneCfg.neutral;
  const bullets = (advisory?.bullets || []).map(b => `
    <div style="display:flex;gap:.45rem;align-items:flex-start">
      <span style="color:${cfg.color};font-weight:700">-</span>
      <span>${escapeHtml(b)}</span>
    </div>
  `).join('');

  return `
    <div style="margin-top:.8rem;padding:.75rem;border-radius:8px;border:1px solid ${cfg.border};background:${cfg.bg}">
      <div style="display:flex;justify-content:space-between;gap:.6rem;align-items:center;margin-bottom:.45rem">
        <div style="font-size:.78rem;font-weight:800;color:${cfg.color}">${escapeHtml(advisory?.title || 'Lectura agronomica')}</div>
        <div style="font-size:.62rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${cfg.color};white-space:nowrap">${escapeHtml(advisory?.status || 'ENSO')}</div>
      </div>
      <div style="font-size:.75rem;line-height:1.45;color:rgba(74,46,26,.78);margin-bottom:.5rem">${escapeHtml(advisory?.summary || '')}</div>
      <div style="display:flex;flex-direction:column;gap:.28rem;font-size:.72rem;line-height:1.35;color:rgba(74,46,26,.66)">
        ${bullets}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSING DEL ARCHIVO ONI
// ─────────────────────────────────────────────────────────────────────────────

function parsearONI(texto) {
  const lineas  = texto.split("\n");
  const datos   = [];

  for (const linea of lineas) {
    const partes = linea.trim().split(/\s+/);
    if (partes.length < 4) continue;

    const [seas, yr] = partes;
    const anom = partes.length >= 5 ? partes[4] : partes[3];
    const anio   = parseInt(yr,   10);
    const anomF  = parseFloat(anom);

    if (!PERIODOS_ONI.includes(seas) || isNaN(anio) || isNaN(anomF)) continue;

    datos.push({ periodo: seas, anio, anom: anomF });
  }

  return datos;
}

function periodoAFecha(periodo, anio) {
  const mesIdx     = PERIODOS_ONI.indexOf(periodo);
  const mesCentral = ((mesIdx + 1) % 12) || 12;
  return new Date(anio, mesCentral - 1, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH NOAA CPC
// ─────────────────────────────────────────────────────────────────────────────

async function fetchONI() {
  const proxyUrl = window.AM_CONFIG?.ensoProxy;
  if (proxyUrl) {
    const proxyResp = await fetch(proxyUrl, { cache: "no-store" });
    if (proxyResp.ok) {
      const proxyJson = await proxyResp.json();
      if (Array.isArray(proxyJson.datos) && proxyJson.datos.length > 0) {
        return proxyJson.datos;
      }
      throw new Error("ENSO proxy sin registros ONI");
    }
  }

  const resp = await fetch(ONI_URL_TXT, { cache: "no-store" });
  if (!resp.ok) throw new Error(`NOAA CPC error ${resp.status}`);
  const texto = await resp.text();
  return parsearONI(texto);
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE LOCAL
// ─────────────────────────────────────────────────────────────────────────────

function leerCache() {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
    if (!Array.isArray(obj.datos) || obj.datos.length === 0) return null;
    return obj;
  } catch (_) { return null; }
}

function escribirCache(datos) {
  if (!Array.isArray(datos) || datos.length === 0) return;
  try {
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify({
      ts:    Date.now(),
      datos,
    }));
  } catch (_) {}
}

function limpiarCache() {
  try {
    localStorage.removeItem(LS_CACHE_KEY);
    localStorage.removeItem("am_enso_cache");
  } catch (_) {}
}

function clasificarFase(anom) {
  if (anom >= ONI_UMBRAL_NINYO) return "niño";
  if (anom <= ONI_UMBRAL_NINA)  return "niña";
  return "neutro";
}

function getFactorAjuste(fase) {
  switch (fase) {
    case "niño":   return AJUSTE_NINYO;
    case "niña":   return AJUSTE_NINA;
    default:       return AJUSTE_NEUTRO;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

async function getFaseENSO(anio, mes) {
  // 1. Intentar consultar oni_cache desde Supabase en tiempo real
  if (typeof window !== "undefined" && window.AM_SB) {
    try {
      const { data, error } = await window.AM_SB.from('oni_cache').select('*').eq('id', 1).single();
      if (!error && data) {
        const localFase = mapDbFaseToLocal(data.fase_actual);
        return {
          fase:             localFase,
          oni:              parseFloat(data.oni_valor),
          periodo:          data.trimestre || '???',
          anio:             new Date(data.actualizado_en).getFullYear(),
          factorAjuste:     getFactorAjuste(localFase),
          fuente:           "supabase_db",
          datosDisponibles: true
        };
      }
    } catch (dbErr) {
      console.warn("[ENSO] Error cargando desde oni_cache DB, intentando NOAA...", dbErr);
    }
  }

  // 2. Fallback a NOAA CPC
  const ahora = new Date();
  const anioObj = anio ?? ahora.getFullYear();
  const mesObj  = mes  ?? (ahora.getMonth() + 1);

  let datos;
  let fuente = "noaa_cpc";
  const cache = leerCache();

  if (cache) {
    datos  = cache.datos;
    fuente = "cache";
  } else {
    try {
      datos = await fetchONI();
      if (!Array.isArray(datos) || datos.length === 0) throw new Error("NOAA CPC sin registros ONI parseables");
      escribirCache(datos);
    } catch (e) {
      return _fallbackENSO(anioObj, mesObj, e.message);
    }
  }

  const objetivo = new Date(anioObj, mesObj - 1, 15);
  const candidatos = datos.filter((d) => d.anio >= anioObj - 1 && d.anio <= anioObj + 1);

  if (!candidatos.length) {
    return _fallbackENSO(anioObj, mesObj, "Sin datos ONI para el año solicitado");
  }

  const conFecha = candidatos.map((d) => ({
    ...d,
    fecha: periodoAFecha(d.periodo, d.anio),
  }));
  conFecha.sort((a, b) => Math.abs(a.fecha - objetivo) - Math.abs(b.fecha - objetivo));

  const mejor = conFecha[0];
  const diffMeses = Math.abs(
    (mejor.fecha.getFullYear() - objetivo.getFullYear()) * 12 +
    (mejor.fecha.getMonth()   - objetivo.getMonth())
  );

  const advertencia = diffMeses > 3
    ? `Dato ONI del período ${mejor.periodo} ${mejor.anio} (${diffMeses} meses de diferencia). Usar con precaución.`
    : undefined;

  const fase = clasificarFase(mejor.anom);

  return {
    fase,
    oni:             mejor.anom,
    periodo:         mejor.periodo,
    anio:            mejor.anio,
    factorAjuste:    getFactorAjuste(fase),
    fuente,
    datosDisponibles: true,
    ...(advertencia ? { advertencia } : {}),
  };
}

function _fallbackENSO(anio, mes, motivo) {
  return {
    fase:             "neutro",
    oni:              NaN,
    periodo:          "???",
    anio,
    factorAjuste:     AJUSTE_NEUTRO,
    fuente:           "fallback",
    datosDisponibles: false,
    advertencia:      `ENSO no disponible temporalmente. Se calculó con fase neutra, sin ajuste de lluvia.`,
  };
}

function ajustarPrecipitacion(precipOriginal, fase) {
  const factor = 1 + getFactorAjuste(fase);
  const precipAjustada = precipOriginal.map((p) => +Math.max(0, p * factor).toFixed(1));
  return { precipAjustada, factor, fase };
}

function ajustarPrecipValor(precip, fase) {
  const factor = 1 + getFactorAjuste(fase);
  return +Math.max(0, precip * factor).toFixed(1);
}

async function getHistorialENSO(anioInicio, anioFin, mes = 10) {
  const cache = leerCache();
  let datos;

  if (cache) {
    datos = cache.datos;
  } else {
    try {
      datos = await fetchONI();
      if (!Array.isArray(datos) || datos.length === 0) throw new Error("NOAA CPC sin registros ONI parseables");
      escribirCache(datos);
    } catch (_) {
      const historial = [];
      for (let a = anioInicio; a <= anioFin; a++) {
        historial.push({ anio: a, fase: "neutro", oni: NaN });
      }
      return historial;
    }
  }

  const historial = [];
  for (let a = anioInicio; a <= anioFin; a++) {
    const objetivo = new Date(a, mes - 1, 15);
    const conFecha = datos
      .filter((d) => d.anio >= a - 1 && d.anio <= a)
      .map((d) => ({ ...d, fecha: periodoAFecha(d.periodo, d.anio) }));

    conFecha.sort((x, y) => Math.abs(x.fecha - objetivo) - Math.abs(y.fecha - objetivo));

    const mejor = conFecha[0];
    if (mejor) {
      historial.push({ anio: a, fase: clasificarFase(mejor.anom), oni: mejor.anom });
    } else {
      historial.push({ anio: a, fase: "neutro", oni: NaN });
    }
  }

  return historial;
}

function renderizarBadgeENSO(resultado) {
  const el = document.getElementById("enso-badge");
  if (!el) return;

  const colores = {
    "niño":   { bg: "#2A7A4A", icono: "🌊", label: "El Niño" },
    "niña":   { bg: "#C94A2A", icono: "💧", label: "La Niña" },
    "neutro": { bg: "#2A5A8C", icono: "➖", label: "Neutro" },
  };

  const cfg   = colores[resultado.fase] || colores.neutro;
  const ajPct = (resultado.factorAjuste >= 0 ? "+" : "") + (resultado.factorAjuste * 100).toFixed(0) + "%";
  const oniStr = isNaN(resultado.oni) ? "N/D" : resultado.oni.toFixed(2) + "°C";
  const fuenteStr = resultado.fuente === "fallback"
    ? " ⚠️ sin conexión"
    : ` · ${resultado.periodo} ${resultado.anio}`;

  el.innerHTML = `
    <div class="enso-badge"
         style="display:inline-flex;align-items:center;gap:6px;
                background:${cfg.bg};color:#fff;padding:4px 10px;
                border-radius:12px;font-size:12px;font-weight:700;"
         title="ONI: ${oniStr}${fuenteStr}">
      <span>${cfg.icono}</span>
      <span>${cfg.label}</span>
      <span style="opacity:0.85;font-weight:400">${ajPct} lluvia</span>
    </div>
    ${resultado.advertencia
      ? `<div class="enso-advertencia" style="font-size:11px;color:#B05B1A;margin-top:2px;">
           ⚠️ ${resultado.advertencia}
         </div>`
      : ""}
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRACIÓN DE DATA DE RENDIMIENTOS (AgroENSO)
// ─────────────────────────────────────────────────────────────────────────────

async function amEnsoGetImpacto(provinciaId, deptoId, cultivo, fechaSiembraStr) {
  if (typeof window === "undefined" || !window.AM_SB) return null;
  const cultDb = mapCropToDb(cultivo, fechaSiembraStr);
  if (!cultDb) return null;

  const { data, error } = await window.AM_SB.from('enso_rendimiento')
    .select('fase_enso, rend_promedio_kgha, rend_general_kgha, rend_vs_promedio_pct, significativo, n_campanas')
    .eq('provincia_id', provinciaId)
    .eq('depto_id', deptoId)
    .eq('cultivo', cultDb);

  if (error) {
    console.error('[ENSO] Error consultando enso_rendimiento:', error);
    return null;
  }
  return data;
}

function renderStandardProbabilities(container, infoText) {
  const d = window.ENSO_DATA || { fase:'neutro', label:'Neutro', prob_nino:15, prob_neutro:55, prob_nina:30, sinopsis:'Cargando...', ts:null };
  const colors = { nino:'#2A7A4A', neutro:'#2A5A8C', nina:'#C94A2A' };
  const icons  = { nino:'🌧️', neutro:'⚖️', nina:'☀️' };
  const col    = colors[d.fase] || colors.neutro;
  const advisory = buildGenericAdvisory(infoText);
  window.AM_ENSO_ADVISORY = advisory;

  const barra = (label, pct, color) => `
    <div style="margin-bottom:.5rem">
      <div style="display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:.2rem">
        <span>${label}</span><span style="font-weight:700">${pct}%</span>
      </div>
      <div style="height:8px;background:rgba(74,46,26,.08);border-radius:4px">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width .5s"></div>
      </div>
    </div>`;

  let html = `
    <div style="display:flex;align-items:center;gap:.8rem;padding:.8rem;background:${col}18;border-radius:10px;border:1px solid ${col}44;margin-bottom:.8rem">
      <div style="font-size:2rem">${icons[d.fase]}</div>
      <div>
        <div style="font-size:1rem;font-weight:700;color:${col}">${icons[d.fase]} ${d.label}</div>
        <div style="font-size:.73rem;color:rgba(74,46,26,.55);margin-top:.2rem">Estado actual del ENSO · Fuente: NOAA/CPC</div>
      </div>
    </div>
    ${barra('🌧️ El Niño', d.prob_nino, '#2A7A4A')}
    ${barra('⚖️ Neutro', d.prob_neutro, '#2A5A8C')}
    ${barra('☀️ La Niña', d.prob_nina, '#C94A2A')}
  `;

  if (infoText) {
    html += `
      <div style="margin-top:.6rem;font-size:.74rem;color:#b05b1a;background:#fef7e0;padding:.5rem;border-radius:6px;line-height:1.3">
        💡 ${infoText}
      </div>
    `;
  } else {
    html += `
      <div style="margin-top:.7rem;font-size:.75rem;color:rgba(74,46,26,.6);font-style:italic;line-height:1.5">
        ${d.sinopsis.slice(0,250)}${d.sinopsis.length>250?'...':''}
      </div>
    `;
  }

  html += renderAdvisoryBox(advisory);
  container.innerHTML = html;
  if (typeof amEnsoUpdateMacroCard === 'function') {
    amEnsoUpdateMacroCard();
  }
}

async function amEnsoRenderDetailedPanel() {
  const container = document.getElementById('enso-panel');
  if (!container) return;

  const activeLote = (typeof window !== "undefined" && typeof window.amGetLoteActivo === 'function')
    ? window.amGetLoteActivo()
    : null;

  if (!activeLote || !activeLote.data) {
    renderStandardProbabilities(container);
    return;
  }

  let provId = parseInt(activeLote.data.provincia_id, 10);
  let deptoId = parseInt(activeLote.data.depto_id, 10);
  const cultivo = activeLote.data.cultivo || 'Soja';
  const fechaSiembra = activeLote.data.fechaSiembra || '';

  // ── Auto-geolocalización en background usando coordenadas si no tiene provincia/departamento IDs ──
  if ((isNaN(provId) || isNaN(deptoId)) && activeLote.data.coord) {
    container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:rgba(74,46,26,.35);font-size:.85rem">⟳ Detectando departamento en background...</div>';
    let coordsParsed = null;
    if (typeof window.parsCoord === 'function') {
      coordsParsed = window.parsCoord(activeLote.data.coord);
    }
    if (coordsParsed && coordsParsed[0] != null && coordsParsed[1] != null) {
      const [lat, lon] = coordsParsed;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
          headers: { 'User-Agent': 'AgroMotor/2.0' }
        });
        const d = await r.json();
        const a = d.address || {};
        const prov = a.state || '';
        const cleanState = prov.replace(/Provincia de/i, '').replace(/Provincia/i, '').trim();
        const cleanCounty = (a.county || a.city || a.town || a.village || '')
          .replace(/Departamento/i, '')
          .replace(/Partido de/i, '')
          .replace(/Partido/i, '')
          .replace(/Comuna de/i, '')
          .replace(/Comuna/i, '')
          .trim();

        if (cleanState && cleanCounty && typeof window.AM_SB !== 'undefined') {
          const { data, error } = await window.AM_SB.from('enso_rendimiento')
            .select('provincia_id, depto_id, provincia_nombre, depto_nombre')
            .ilike('provincia_nombre', cleanState)
            .ilike('depto_nombre', cleanCounty)
            .limit(1);

          if (!error && data && data.length > 0) {
            const match = data[0];
            activeLote.data.provincia_id = match.provincia_id;
            activeLote.data.depto_id = match.depto_id;
            activeLote.data.provincia_nombre = match.provincia_nombre;
            activeLote.data.depto_nombre = match.depto_nombre;
            
            provId = match.provincia_id;
            deptoId = match.depto_id;

            if (typeof window.amGuardarLotesEstado === 'function') {
              window.amGuardarLotesEstado();
              console.log(`[ENSO Auto-Geocoding] Mapeado: ${match.depto_nombre}, ${match.provincia_nombre} (${match.depto_id})`);
            }
            if (typeof amEnsoUpdateMacroCard === 'function') {
              amEnsoUpdateMacroCard();
            }
          }
        }
      } catch (err) {
        console.error('[ENSO Auto-Geocoding] Error:', err);
      }
    }
  }

  if (isNaN(provId) || isNaN(deptoId)) {
    renderStandardProbabilities(container, "Resolvé la ubicación en el mapa del Dashboard para cargar datos geolocalizados de rendimiento histórico.");
    return;
  }

  const cultDb = mapCropToDb(cultivo, fechaSiembra);
  if (!cultDb) {
    renderStandardProbabilities(container, `AgroENSO no cuenta con datos de rendimiento para el cultivo de ${cultivo}.`);
    return;
  }

  container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:rgba(74,46,26,.35);font-size:.85rem">⟳ Cargando desvíos de AgroENSO...</div>';
  
  let impactos = null;
  try {
    impactos = await amEnsoGetImpacto(provId, deptoId, cultivo, fechaSiembra);
  } catch (err) {
    console.warn('[ENSO] Error fetching impact data:', err);
  }

  if (!impactos || impactos.length === 0) {
    renderStandardProbabilities(container, `No se encontraron datos históricos de AgroENSO para la combinación de zona y el cultivo ${cultivo}.`);
    return;
  }

  const order = ['ElNino', 'Neutral', 'LaNina'];
  const sorted = order.map(fase => impactos.find(i => i.fase_enso === fase)).filter(Boolean);

  const currentFaseDb = faseLocalToDb(window.ENSO_DATA?.fase);
  const deptoNombre = activeLote.data.depto_nombre || 'zona';
  const provNombre = activeLote.data.provincia_nombre || '';
  const advisory = buildDetailedAdvisory(activeLote, sorted, currentFaseDb, cultivo);
  window.AM_ENSO_ADVISORY = advisory;

  let html = `
    <div style="font-size: .83rem; font-weight: 600; color: var(--earth); margin-bottom: .6rem; text-align: center">
      Tendencia Histórica para ${cultivo} en ${deptoNombre}${provNombre ? ', ' + provNombre : ''}
    </div>
    <div style="display:flex; flex-direction:column; gap:.6rem; margin-bottom:.8rem">
  `;

  sorted.forEach(imp => {
    const dev = parseFloat(imp.rend_vs_promedio_pct);
    const isCurrent = imp.fase_enso === currentFaseDb;
    const isSig = imp.significativo;
    const label = imp.fase_enso === 'ElNino' ? '🌧️ El Niño' : imp.fase_enso === 'LaNina' ? '☀️ La Niña' : '⚖️ Neutro';
    
    let barColor = '#757575';
    if (dev > 5) barColor = '#1565C0';
    else if (dev < -5) barColor = '#C62828';

    const devStr = (dev >= 0 ? '+' : '') + dev.toFixed(1) + '%';
    const maxVisualDev = 30;
    const pctWidth = Math.min(100, Math.max(5, (Math.abs(dev) / maxVisualDev) * 100));

    const currentStyle = isCurrent 
      ? `border: 2px solid var(--amber); box-shadow: 0 0 8px rgba(232,184,75,.4); background: var(--white); font-weight: 700;` 
      : `border: 1px solid rgba(60,34,16,.08); background: rgba(255,255,255,.4);`;

    html += `
      <div style="padding: .6rem; border-radius: 8px; ${currentStyle} transition: all 0.3s">
        <div style="display:flex; justify-content:space-between; font-size:.78rem; margin-bottom:.3rem">
          <span>
            ${isCurrent ? '<b>👉 ' : ''}${label}${isCurrent ? '</b>' : ''}
            ${isSig ? '<span style="color:var(--amber); font-weight:bold" title="Efecto estadísticamente significativo (Wilcoxon p < 0.05)">★</span>' : ''}
          </span>
          <span style="font-weight:700; color: ${barColor}">${devStr}</span>
        </div>
        <div style="height: 10px; background: rgba(74,46,26,.05); border-radius: 5px; position: relative; overflow: hidden">
          <div style="height: 100%; width: ${pctWidth}%; background: ${barColor}; border-radius: 5px; margin-left: ${dev < 0 ? 'auto' : '0'}; transition: width 0.6s"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:.67rem; color:rgba(74,46,26,.5); margin-top:.2rem">
          <span>Promedio: ${Math.round(imp.rend_promedio_kgha)} kg/ha</span>
          <span>Campañas: ${imp.n_campanas || 0}</span>
        </div>
      </div>
    `;
  });

  html += renderAdvisoryBox(advisory);

  html += `
    </div>
    <div style="font-size: .68rem; color: rgba(74,46,26,.5); line-height: 1.4; text-align: center; font-style: italic; border-top: 1px dashed rgba(60,34,16,.1); padding-top: .5rem">
      Fuente: <b>AgroENSO</b> (Monzon et al. 2026). Desvíos ajustados por tecnología.<br>
      * La estrella (★) indica un efecto estadísticamente significativo.
    </div>
  `;

  container.innerHTML = html;
  if (typeof amEnsoUpdateMacroCard === 'function') {
    amEnsoUpdateMacroCard();
  }
}

function amEnsoUpdateMacroCard() {
  const card = document.getElementById('dash-enso-info');
  const badge = document.getElementById('dash-enso-badge');
  const text = document.getElementById('dash-enso-text');
  if (!card || !badge || !text) return;

  const d = window.ENSO_DATA;
  if (!d || !d.fase) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');

  const colors = { nino:'#2A7A4A', neutro:'#2A5A8C', nina:'#C94A2A' };
  const icons  = { nino:'🌧️', neutro:'⚖️', nina:'☀️' };
  const col    = colors[d.fase] || colors.neutro;

  badge.style.background = col;
  badge.textContent = `${icons[d.fase]} ${d.label}`;
  
  const oniStr = d.oni_valor != null && !isNaN(d.oni_valor) ? `${d.oni_valor.toFixed(2)} °C` : 'N/D';
  const advisory = window.AM_ENSO_ADVISORY || buildGenericAdvisory();
  text.innerHTML = `
    <div>Anomalía ONI: <b>${oniStr}</b> (${d.trimestre || '—'}). <b>${escapeHtml(advisory.status)}</b></div>
    <div style="margin-top:.18rem;line-height:1.35;color:#4b5563">${escapeHtml(advisory.dashboardText || advisory.summary || '')}</div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getFaseENSO,
    getHistorialENSO,
    ajustarPrecipitacion,
    ajustarPrecipValor,
    getFactorAjuste,
    limpiarCache,
    renderizarBadgeENSO,
    AJUSTE_NINYO,
    AJUSTE_NEUTRO,
    AJUSTE_NINA,
    ONI_UMBRAL_NINYO,
    ONI_UMBRAL_NINA,
    mapCropToDb,
    mapDbFaseToLocal,
    _buildDetailedAdvisory: buildDetailedAdvisory,
    _faseLocalToDb: faseLocalToDb,
    _parsearONI:     parsearONI,
    _clasificarFase: clasificarFase,
    _periodoAFecha:  periodoAFecha,
  };
} else if (typeof window !== "undefined") {
  window.ENSO = {
    getFaseENSO,
    getHistorialENSO,
    ajustarPrecipitacion,
    ajustarPrecipValor,
    getFactorAjuste,
    limpiarCache,
    renderizarBadgeENSO,
    AJUSTE_NINYO,
    AJUSTE_NEUTRO,
    AJUSTE_NINA,
  };
  window.amEnsoGetImpacto = amEnsoGetImpacto;
  window.amEnsoRenderDetailedPanel = amEnsoRenderDetailedPanel;
  window.amEnsoUpdateMacroCard = amEnsoUpdateMacroCard;
}

})();
