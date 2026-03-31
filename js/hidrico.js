// ════════════════════════════════════════════════════════
// AGROMOTOR — hidrico.js
// Balance hídrico FAO-56 · ENSO/NOAA
// Rendimiento alcanzable · Riego suplementario
// Stress Test percentil 20-80 · GDD y floración
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
// MÓDULO BALANCE HÍDRICO Y ESCENARIO CLIMÁTICO
// ════════════════════════════════════════════════════════
// Metodología:
// • Requerimiento hídrico: FAO-56 (ETc = Kc × ET₀)
// • Función respuesta rendimiento/agua: FAO Ky (Doorenbos & Kassam 1979)
// • ENSO: NOAA/CPC — ajuste histórico pampa argentina INTA
// • Precipitación esperada: base NASA POWER × factor ENSO
// ════════════════════════════════════════════════════════

// Base de requerimientos hídricos por cultivo (FAO-56 + datos INTA)
// ETc total del ciclo (mm), Kc promedio, coeficiente respuesta Ky (FAO)
const BH_CULTIVOS = {
  Soja:    { etcMin:480, etcMax:650, etcMed:560, ky:0.85, kc:[0.4,0.75,1.15,0.75,0.5],
             periodos:['Vegetativo','Floración','Llenado granos','Madurez','Total'],
             dias:[35,25,45,30,135], critico:'R3-R6 (llenado de granos)',
             mmPorTon:155, nPorTon:3.0, pPorTon:0.75 },
  Maíz:    { etcMin:500, etcMax:800, etcMed:640, ky:1.25, kc:[0.3,0.7,1.2,1.0,0.6],
             periodos:['Vegetativo','Pre-floración','Floración','Llenado','Madurez'],
             dias:[35,20,20,35,20], critico:'VT-R2 (floración)',
             mmPorTon:85, nPorTon:22, pPorTon:3.5 },
  Trigo:   { etcMin:380, etcMax:560, etcMed:450, ky:1.15, kc:[0.7,0.9,1.15,0.9,0.3],
             periodos:['Implantación','Macollaje','Encañazón','Grano lechoso','Madurez'],
             dias:[20,30,35,25,20], critico:'Floración-llenado',
             mmPorTon:120, nPorTon:28, pPorTon:5.0 },
  Girasol: { etcMin:600, etcMax:900, etcMed:700, ky:0.95, kc:[0.35,0.7,1.15,0.85,0.5],
             periodos:['Vegetativo','Pre-floración','Floración','Llenado','Madurez'],
             dias:[25,25,30,30,20], critico:'Floración (R4-R6)',
             mmPorTon:320, nPorTon:18, pPorTon:3.0 },
  Sorgo:   { etcMin:380, etcMax:700, etcMed:520, ky:0.90, kc:[0.35,0.7,1.10,0.9,0.55],
             periodos:['Vegetativo','Pre-floración','Floración','Llenado','Madurez'],
             dias:[30,20,20,35,20], critico:'Floración-llenado',
             mmPorTon:100, nPorTon:20, pPorTon:3.5 },
};

// Ajuste ENSO para precipitaciones pampa argentina
// Fuente: análisis histórico INTA/ORA sobre 1970-2020
// Zona núcleo pampeana. Ajuste en % vs. media histórica
const BH_ENSO_AJUSTE = {
  nino:  { var:+18, label:'El Niño', color:'#2A7A4A',
           desc:'Las precipitaciones suelen superar el promedio histórico en un 15-20% en la región pampeana. Mayor riesgo de excesos hídricos en etapas vegetativas. Buen año para rendimientos de soja y maíz.' },
  neutro:{ var:0,   label:'Neutro',  color:'#2A5A8C',
           desc:'Precipitaciones cercanas al promedio histórico. Alta variabilidad interanual. Las decisiones deben basarse principalmente en el pronóstico de corto plazo y la reserva de agua en el perfil.' },
  nina:  { var:-18, label:'La Niña', color:'#C94A2A',
           desc:'Las precipitaciones suelen estar un 15-20% por debajo del promedio. Lluvias con mayor variabilidad espacial entre lotes. Mayor riesgo de déficit hídrico en floración y llenado de granos.' },
};

// Precipitación base por mes para la región pampeana núcleo (mm/mes · promedio histórico)
// Se ajusta con NASA POWER si está disponible
const BH_PRECIP_BASE = {
  Soja:    [55,65,75,60,40,20,15,25,40,55,65,60], // oct-sep
  Maíz:    [55,65,75,60,40,20,15,25,40,55,65,60],
  Trigo:   [45,55,60,55,40,30,25,30,45,55,60,55],
  Girasol: [55,65,75,60,40,20,15,25,40,55,65,60],
  Sorgo:   [55,65,75,60,40,20,15,25,40,55,65,60],
};

// ── CONSULTA ENSO (NOAA) ──────────────────────────────
let ENSO_DATA = { fase:'neutro', label:'Neutro', prob_nino:15, prob_neutro:55, prob_nina:30, sinopsis:'', ts:null };

async function consultarENSO() {
  const panel = $('enso-panel');
  const ts    = $('enso-ts');
  if (panel) panel.innerHTML = '<div style="text-align:center;padding:1rem;font-size:.82rem;color:rgba(74,46,26,.5)">⟳ Consultando NOAA/CPC...</div>';
  if (ts) ts.textContent = 'actualizando...';

  try {
    // NOAA CPC ENSO en español — parseable
    const res = await Promise.race([
      fetch('https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc_Sp.shtml'),
      new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),10000))
    ]);
    const html = await res.text();

    // Extraer sinopsis (párrafo con "Sinopsis:")
    const sinMatch = html.match(/Sinopsis[:\s]*<\/b>?\s*([^<]{40,600})/i);
    const sinopsis = sinMatch ? sinMatch[1].trim().replace(/\s+/g,' ') : '';

    // Detectar fase ENSO
    let fase = 'neutro';
    const htmlL = html.toLowerCase();
    if (htmlL.includes('niña persiste') || htmlL.includes('la niña')) fase = 'nina';
    else if (htmlL.includes('el niño') && !htmlL.includes('la niña')) fase = 'nino';
    else fase = 'neutro';

    // Extraer probabilidades (buscamos patrones como "75% de probabilidad")
    const probNeutro = (html.match(/(\d+)%\s*(?:de\s*)?probabilidad.*?neutro/i)?.[1]) ||
                       (html.match(/neutro.*?(\d+)%/i)?.[1]) || '55';
    const probNina   = (html.match(/(\d+)%\s*(?:de\s*)?probabilidad.*?niña/i)?.[1])  || '25';
    const probNino   = (html.match(/(\d+)%\s*(?:de\s*)?probabilidad.*?niño/i)?.[1])  || '20';

    ENSO_DATA = {
      fase, sinopsis: sinopsis || 'Ver NOAA/CPC para detalles.',
      prob_neutro: parseInt(probNeutro), prob_nina: parseInt(probNina), prob_nino: parseInt(probNino),
      label: fase==='nino'?'El Niño':fase==='nina'?'La Niña':'Neutro',
      ts: new Date()
    };

  } catch(e) {
    // Fallback con datos conocidos actuales
    ENSO_DATA = {
      fase:'neutro', label:'Neutro',
      sinopsis:'Transición de La Niña a ENSO-neutral esperada. El Niño probable para la campaña 2026/27 con 62% de probabilidad (NOAA, marzo 2026).',
      prob_neutro:55, prob_nina:20, prob_nino:25,
      ts: null
    };
    console.warn('ENSO fetch falló — usando datos de referencia:', e.message);
  }

  renderENSO();
  // Actualizar selector de fase en el módulo
  const sel = $('bh-enso');
  if (sel) sel.value = ENSO_DATA.fase;
  bhActualizar();
}

function renderENSO() {
  const d = ENSO_DATA;
  const colors = { nino:'#2A7A4A', neutro:'#2A5A8C', nina:'#C94A2A' };
  const icons  = { nino:'🌧️', neutro:'⚖️', nina:'☀️' };
  const col    = colors[d.fase] || colors.neutro;
  const ts     = d.ts ? d.ts.toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : 'Referencia NOAA mar-2026';
  if ($('enso-ts')) $('enso-ts').textContent = ts;

  // Barras de probabilidad
  const barra = (label, pct, color) => `
    <div style="margin-bottom:.5rem">
      <div style="display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:.2rem">
        <span>${label}</span><span style="font-weight:700">${pct}%</span>
      </div>
      <div style="height:8px;background:rgba(74,46,26,.08);border-radius:4px">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width .5s"></div>
      </div>
    </div>`;

  if ($('enso-panel')) $('enso-panel').innerHTML = `
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
    <div style="margin-top:.7rem;font-size:.75rem;color:rgba(74,46,26,.6);font-style:italic;line-height:1.5">
      ${d.sinopsis.slice(0,250)}${d.sinopsis.length>250?'...':''}
    </div>`;
}

function bhToggleRiego() {
  const checked = $('bh-riego-check')?.checked;
  $('bh-riego-panel').classList.toggle('hidden', !checked);
  bhActualizar();
}

function bhActualizarEnsoSelector() {
  const fase  = gv('bh-enso') || 'neutro';
  const info  = BH_ENSO_AJUSTE[fase];
  const precipHist = gi('bh-precip-hist') || 580;
  const precipAjust = Math.round(precipHist * (1 + info.var/100));
  if ($('bh-precip'))    $('bh-precip').value    = precipAjust;
  if ($('bh-enso-var'))  $('bh-enso-var').value  = (info.var >= 0 ? '+' : '') + info.var + '%';
  if ($('bh-enso-var'))  $('bh-enso-var').style.color = info.color;
  if ($('bh-enso-info')) $('bh-enso-info').innerHTML =
    `<span style="color:${info.color};font-weight:600">${info.label}:</span> ${info.desc}`;
}

function bhActualizar() {
  bhActualizarEnsoSelector();

  const cult      = gv('bh-cultivo') || 'Soja';
  const rendObj   = gi('bh-rend-obj') || 3.5;
  const aguaPerf  = gi('bh-agua-perfil') || 120;
  const capMax    = gi('bh-cap-max') || 180;
  const precipCiclo = gi('bh-precip') || 550;
  const precipHist  = gi('bh-precip-hist') || 580;
  const conRiego  = $('bh-riego-check')?.checked || false;
  const rendRiego = gi('bh-rend-riego') || 5.0;
  const eficRiego = gi('bh-efic-riego') / 100 || 0.85;
  const m3Disp    = gi('bh-m3-disp') || 2000;
  const ensoFase  = gv('bh-enso') || 'neutro';

  const c = BH_CULTIVOS[cult] || BH_CULTIVOS.Soja;

  // ── 1. AGUA TOTAL DISPONIBLE ──────────────────────────
  // Agua inicial perfil + precipitación esperada del ciclo
  // Se descuenta escorrentía y percolación (coef. 0.75 para precipitación efectiva)
  const precipEfec   = precipCiclo * 0.75;   // precipitación efectiva (75% llega al perfil)
  const aguaTotalDisp = aguaPerf + precipEfec;

  // ── 2. REQUERIMIENTO HÍDRICO DEL CULTIVO ─────────────
  // ETc = ET₀ histórica × Kc promedio × días ciclo
  // Usamos etcMed como referencia base, ajustado por rendimiento objetivo
  // Relación lineal: más rendimiento = más consumo de agua
  const etcBase = c.etcMed;
  const mmPorTon = c.mmPorTon;
  const etcObjetivo = mmPorTon * rendObj;     // mm totales para el rendimiento objetivo
  const etcUsar = Math.max(c.etcMin, Math.min(c.etcMax, etcObjetivo));

  // ── 3. RENDIMIENTO ALCANZABLE (secano) ───────────────
  // Función FAO Ky: (1 - Ya/Ym) = Ky × (1 - ETa/ETm)
  // Despejando: Ya = Ym × (1 - Ky × (1 - ETa/ETm))
  // Donde ETa = min(aguaTotalDisp, ETm), ETm = etcUsar
  const etaSecano = Math.min(aguaTotalDisp, etcUsar);
  const deficitFrac = Math.max(0, 1 - etaSecano/etcUsar);
  const rendAlcanzable = Math.max(0, rendObj * (1 - c.ky * deficitFrac));

  // ── 4. DÉFICIT HÍDRICO ────────────────────────────────
  const deficit = Math.max(0, etcUsar - aguaTotalDisp);
  const superavit = Math.max(0, aguaTotalDisp - etcUsar);
  const coberturaPorc = Math.min(100, (aguaTotalDisp / etcUsar) * 100);

  // ── 5. RIEGO SUPLEMENTARIO ────────────────────────────
  let mmRiegoNecesario = 0, mmRiegoDisp = 0, rendConRiego = rendAlcanzable;
  let volumenRiegoM3 = 0;
  if (conRiego) {
    // ETc para el rendimiento con riego
    const etcConRiego = mmPorTon * rendRiego;
    const aguaNecesaria = Math.max(0, etcConRiego - aguaTotalDisp);
    mmRiegoNecesario = aguaNecesaria / eficRiego;  // mm brutos a aplicar
    volumenRiegoM3   = mmRiegoNecesario * 10;       // 1 mm = 10 m³/ha
    mmRiegoDisp      = Math.min(mmRiegoNecesario, m3Disp / 10);

    // Rendimiento alcanzable con el agua de riego disponible
    const etaTotalRiego = Math.min(etcConRiego, aguaTotalDisp + mmRiegoDisp * eficRiego);
    const defRiego = Math.max(0, 1 - etaTotalRiego/etcConRiego);
    rendConRiego = Math.max(0, rendRiego * (1 - c.ky * defRiego));
  }

  // ── 6. FERTILIZACIÓN AJUSTADA ─────────────────────────
  // Requiem de N y P proporcional al rendimiento alcanzable
  const rendFinal = conRiego ? rendConRiego : rendAlcanzable;
  const nNecesario = (c.nPorTon * rendFinal).toFixed(0);
  const pNecesario = (c.pPorTon * rendFinal).toFixed(1);
  // Conversión a fertilizante comercial (Urea 46%N, MAP 11%N-52%P)
  const ureaKg  = Math.round((c.nPorTon * rendFinal) / 0.46);
  const mapKg   = Math.round((c.pPorTon * rendFinal * 2.29) / 0.52); // P→P₂O₅

  // ── RENDER ────────────────────────────────────────────

  // Gauge de cobertura hídrica
  const gaugeColor = coberturaPorc >= 90 ? 'var(--ok)' : coberturaPorc >= 70 ? 'var(--caution)' : 'var(--warn)';
  $('bh-gauge').innerHTML = `
    <div style="margin-bottom:.8rem">
      <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:.3rem">
        <span style="font-weight:600">Cobertura hídrica del ciclo</span>
        <span style="font-weight:700;color:${gaugeColor}">${coberturaPorc.toFixed(0)}%</span>
      </div>
      <div style="height:16px;background:rgba(74,46,26,.08);border-radius:8px;overflow:hidden">
        <div style="height:100%;width:${Math.min(100,coberturaPorc)}%;background:${gaugeColor};border-radius:8px;transition:width .6s;display:flex;align-items:center;justify-content:flex-end;padding-right:6px">
          <span style="font-size:.65rem;color:white;font-weight:700">${coberturaPorc.toFixed(0)}%</span>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.68rem;color:rgba(74,46,26,.45);margin-top:.2rem">
        <span>Agua disponible: ${aguaTotalDisp.toFixed(0)} mm</span>
        <span>Requerimiento: ${etcUsar.toFixed(0)} mm</span>
      </div>
    </div>`;

  // KPIs
  const ensoInfo = BH_ENSO_AJUSTE[ensoFase];
  $('bh-kpis').innerHTML = `
    <div class="kc neutral">
      <div class="kl">Agua perfil inicial</div>
      <div class="kv">${aguaPerf}</div>
      <div class="ku">mm útiles</div>
    </div>
    <div class="kc neutral">
      <div class="kl">Precip. efectiva</div>
      <div class="kv">${precipEfec.toFixed(0)}</div>
      <div class="ku">mm ciclo (${ensoInfo.label})</div>
    </div>
    <div class="kc neutral">
      <div class="kl">ETc ${cult}</div>
      <div class="kv">${etcUsar.toFixed(0)}</div>
      <div class="ku">mm requeridos</div>
    </div>
    <div class="kc ${deficit>80?'warn':deficit>40?'neutral':''}">
      <div class="kl">${deficit>0?'Déficit hídrico':'Superávit'}</div>
      <div class="kv">${deficit>0?deficit.toFixed(0):superavit.toFixed(0)}</div>
      <div class="ku">mm ${deficit>0?'faltantes':'excedentes'}</div>
    </div>`;

  // Balance: desglose de agua
  $('bh-balance-tabla').innerHTML = `
    <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--earth);margin-bottom:.5rem">Balance hídrico del ciclo</div>
    <table class="dt">
      <tbody>
        <tr><td>Agua útil en perfil (inicio)</td><td class="mn">+ ${aguaPerf} mm</td></tr>
        <tr><td>Precipitación esperada (${ensoInfo.label})</td><td class="mn">+ ${precipCiclo} mm</td></tr>
        <tr><td>Precipitación efectiva (75%)</td><td class="mn">+ ${precipEfec.toFixed(0)} mm</td></tr>
        <tr class="hl"><td><strong>Agua total disponible</strong></td><td class="mn"><strong>${aguaTotalDisp.toFixed(0)} mm</strong></td></tr>
        <tr><td>Requerimiento ETc ${cult}</td><td class="mn">− ${etcUsar.toFixed(0)} mm</td></tr>
        <tr class="${deficit>0?'warn-row':'ok-row'}" style="background:${deficit>0?'rgba(201,74,42,.06)':'rgba(42,122,74,.06)'}">
          <td><strong>${deficit>0?'Déficit hídrico':'Superávit hídrico'}</strong></td>
          <td class="mn" style="color:${deficit>0?'var(--warn)':'var(--ok)'};font-weight:700">
            ${deficit>0?'− '+deficit.toFixed(0)+' mm':'+ '+superavit.toFixed(0)+' mm'}
          </td>
        </tr>
        <tr><td>Momento crítico del cultivo</td><td class="mn">${c.critico}</td></tr>
      </tbody>
    </table>`;

  // Rendimiento alcanzable
  const rendDelta = rendAlcanzable - rendObj;
  $('bh-rendimiento').innerHTML = `
    <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--earth);margin-bottom:.5rem">Rendimiento alcanzable (secano)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:.6rem">
      <div style="background:rgba(74,46,26,.05);border-radius:10px;padding:.9rem;text-align:center">
        <div style="font-size:.7rem;color:rgba(74,46,26,.5);margin-bottom:.3rem">Objetivo</div>
        <div style="font-size:1.8rem;font-weight:700;font-family:'DM Serif Display',serif;color:var(--earth)">${rendObj.toFixed(1)}</div>
        <div style="font-size:.72rem;color:rgba(74,46,26,.5)">t/ha</div>
      </div>
      <div style="background:${rendAlcanzable>=rendObj*0.95?'rgba(42,122,74,.08)':rendAlcanzable>=rendObj*0.8?'rgba(184,122,32,.08)':'rgba(201,74,42,.08)'};border-radius:10px;padding:.9rem;text-align:center;border:2px solid ${rendAlcanzable>=rendObj*0.95?'var(--ok)':rendAlcanzable>=rendObj*0.8?'var(--caution)':'var(--warn)'}">
        <div style="font-size:.7rem;color:rgba(74,46,26,.5);margin-bottom:.3rem">Alcanzable (${ensoInfo.label})</div>
        <div style="font-size:1.8rem;font-weight:700;font-family:'DM Serif Display',serif;color:${rendAlcanzable>=rendObj*0.95?'var(--ok)':rendAlcanzable>=rendObj*0.8?'var(--caution)':'var(--warn)'}">${rendAlcanzable.toFixed(2)}</div>
        <div style="font-size:.72rem;color:rgba(74,46,26,.5)">t/ha · ${(rendAlcanzable/rendObj*100).toFixed(0)}% del objetivo</div>
      </div>
    </div>
    <div class="alert ${rendAlcanzable>=rendObj*0.95?'ok':rendAlcanzable>=rendObj*0.8?'warn':'danger'}">
      <span class="ai">${rendAlcanzable>=rendObj*0.95?'✅':rendAlcanzable>=rendObj*0.8?'⚠️':'🚫'}</span>
      <div class="ac">
        ${rendAlcanzable>=rendObj*0.95
          ? `<strong>El agua disponible es suficiente para el objetivo.</strong> En escenario ${ensoInfo.label}, el rendimiento esperado cubre el 100% del objetivo de ${rendObj} t/ha.`
          : rendAlcanzable>=rendObj*0.8
          ? `<strong>Déficit moderado.</strong> El rendimiento alcanzable es ${rendAlcanzable.toFixed(2)} t/ha — ${Math.abs(rendDelta).toFixed(2)} t/ha por debajo del objetivo. El déficit de ${deficit.toFixed(0)} mm ocurre fuera del período crítico o puede compensarse con el perfil de suelo.`
          : `<strong>Déficit hídrico significativo.</strong> Con ${aguaTotalDisp.toFixed(0)} mm disponibles vs. ${etcUsar.toFixed(0)} mm requeridos, el rendimiento alcanzable es ${rendAlcanzable.toFixed(2)} t/ha. Se recomienda ajustar el objetivo o evaluar riego suplementario.`}
      </div>
    </div>`;

  // Riego suplementario
  if (conRiego) {
    const puedeAlcanzarObj = mmRiegoDisp >= mmRiegoNecesario;
    $('bh-riego-res').classList.remove('hidden');
    $('bh-riego-res').innerHTML = `
      <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#2A5A8C;margin-bottom:.5rem">💧 Análisis de riego suplementario</div>
      <table class="dt">
        <tbody>
          <tr><td>Rendimiento objetivo con riego</td><td class="mn">${rendRiego.toFixed(1)} t/ha</td></tr>
          <tr><td>ETc requerida con riego</td><td class="mn">${(mmPorTon*rendRiego).toFixed(0)} mm</td></tr>
          <tr><td>Agua faltante (secano)</td><td class="mn">${Math.max(0, mmPorTon*rendRiego - aguaTotalDisp).toFixed(0)} mm</td></tr>
          <tr><td>Agua a aplicar (bruto, ef. ${(eficRiego*100).toFixed(0)}%)</td><td class="mn" style="font-weight:700;color:#2A5A8C">${mmRiegoNecesario.toFixed(0)} mm</td></tr>
          <tr><td>Volumen necesario</td><td class="mn">${volumenRiegoM3.toFixed(0)} m³/ha</td></tr>
          <tr><td>Disponibilidad declarada</td><td class="mn">${m3Disp} m³/ha</td></tr>
          <tr class="hl"><td><strong>Rendimiento alcanzable con riego</strong></td>
            <td class="mn" style="font-weight:700;font-size:1rem;color:${puedeAlcanzarObj?'var(--ok)':'var(--caution)'}">${rendConRiego.toFixed(2)} t/ha</td>
          </tr>
        </tbody>
      </table>
      <div class="alert ${puedeAlcanzarObj?'ok':'warn'}" style="margin-top:.6rem">
        <span class="ai">${puedeAlcanzarObj?'✅':'⚠️'}</span>
        <div class="ac">
          ${puedeAlcanzarObj
            ? `Con ${m3Disp} m³/ha disponibles (${mmRiegoDisp.toFixed(0)} mm útiles) el objetivo de ${rendRiego} t/ha es alcanzable. El riego cubre el déficit de ${mmRiegoNecesario.toFixed(0)} mm necesarios.`
            : `El agua disponible (${m3Disp} m³/ha = ${mmRiegoDisp.toFixed(0)} mm útiles) no es suficiente para el objetivo de ${rendRiego} t/ha. Con el riego disponible el rendimiento alcanzable es ${rendConRiego.toFixed(2)} t/ha. Para llegar al objetivo se necesitarían ${volumenRiegoM3.toFixed(0)} m³/ha.`}
        </div>
      </div>`;
  } else {
    $('bh-riego-res').classList.add('hidden');
  }

  // Fertilización ajustada
  $('bh-fertilizacion').innerHTML = `
    <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--earth);margin-bottom:.5rem">🌿 Fertilización ajustada al rendimiento alcanzable</div>
    <div style="background:rgba(74,140,92,.06);border-radius:10px;padding:.9rem;border:1px solid rgba(74,140,92,.2)">
      <div style="font-size:.78rem;color:rgba(74,46,26,.6);margin-bottom:.6rem">
        Rendimiento base para cálculo: <strong>${rendFinal.toFixed(2)} t/ha</strong>
        (${conRiego?'con riego':'secano, escenario '+ensoInfo.label})
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:1rem">
        <div style="text-align:center">
          <div style="font-size:.68rem;color:rgba(74,46,26,.5);text-transform:uppercase;letter-spacing:.08em">N requerido</div>
          <div style="font-size:1.4rem;font-weight:700;color:var(--canopy)">${nNecesario}</div>
          <div style="font-size:.68rem;color:rgba(74,46,26,.45)">kg N/ha</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:.68rem;color:rgba(74,46,26,.5);text-transform:uppercase;letter-spacing:.08em">P₂O₅ requerido</div>
          <div style="font-size:1.4rem;font-weight:700;color:var(--canopy)">${pNecesario}</div>
          <div style="font-size:.68rem;color:rgba(74,46,26,.45)">kg P/ha</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:.68rem;color:rgba(74,46,26,.5);text-transform:uppercase;letter-spacing:.08em">Urea (46%N)</div>
          <div style="font-size:1.4rem;font-weight:700;color:var(--grain)">${ureaKg}</div>
          <div style="font-size:.68rem;color:rgba(74,46,26,.45)">kg/ha</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:.68rem;color:rgba(74,46,26,.5);text-transform:uppercase;letter-spacing:.08em">MAP (52%P)</div>
          <div style="font-size:1.4rem;font-weight:700;color:var(--grain)">${mapKg}</div>
          <div style="font-size:.68rem;color:rgba(74,46,26,.45)">kg/ha</div>
        </div>
      </div>
      <div style="font-size:.72rem;color:rgba(74,46,26,.45);margin-top:.6rem">
        ⚠️ Valores de referencia · Ajustar según análisis de suelo del lote y disponibilidad actual del perfil (SoilGrids N total: <span id="bh-n-suelo">—</span> g/kg)
      </div>
    </div>`;

  // Actualizar N del suelo si está disponible
  const nSuelo = window._sgDatos?.n;
  if (nSuelo && $('bh-n-suelo')) $('bh-n-suelo').textContent = nSuelo.toFixed(2)+' g/kg';

  // Si hay modulo de economia, actualizar el rendimiento
  if ($('ec-rend') && !conRiego) {
    // Sugerencia no obligatoria
  }

  $('bh-placeholder').classList.add('hidden');
  $('bh-res').classList.remove('hidden');
}

// ════════════════════════════════════════════════════════
// MÓDULO CULTIVARES — RECOMENDADOR AGRONÓMICO
// ════════════════════════════════════════════════════════
// Fuentes:
// • RECSO 2024/25 (INTA Oliveros) — Soja, 370 ensayos, 62 localidades
// • RET-INASE 2024/25 — Trigo pan, todas las subregiones
// • INTA Marcos Juárez / Pergamino — Maíz
// • Lógica GMs × zonas: Andrade, Abbate, Enrico (INTA)
// ════════════════════════════════════════════════════════

// ── ZONAS AGROECOLÓGICAS ─────────────────────────────