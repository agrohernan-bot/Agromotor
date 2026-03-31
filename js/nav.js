// ════════════════════════════════════════════════════════
// AGROMOTOR — nav.js
// switchMod con lazy loading · DOMContentLoaded init
// renderSueloModulo · Control de navegación
// ════════════════════════════════════════════════════════
 
// ── LAZY LOADER ──────────────────────────────────────────
// Carga un módulo JS solo cuando el usuario lo necesita
const AM_MODULOS_CARGADOS = {};
 
function amCargarModulo(archivo, callback) {
  if (AM_MODULOS_CARGADOS[archivo]) {
    if (callback) callback();
    return;
  }
  const script = document.createElement('script');
  script.src = 'js/' + archivo;
  script.onload = () => {
    AM_MODULOS_CARGADOS[archivo] = true;
    if (callback) callback();
  };
  script.onerror = () => {
    console.error('Error cargando módulo:', archivo);
    amToast('⚠️ Error cargando módulo ' + archivo, 'err');
  };
  document.head.appendChild(script);
}
 
// Precarga en segundo plano los módulos más usados
function amPrecargarModulos() {
  // Después de 2 segundos, precargar los módulos más probables
  setTimeout(() => {
    amCargarModulo('hidrico.js');
    amCargarModulo('cultivares.js');
  }, 2000);
  // Después de 5 segundos, precargar el resto
  setTimeout(() => {
    amCargarModulo('cultivares-extra.js');
    amCargarModulo('mapa.js');
    amCargarModulo('asistente.js');
    amCargarModulo('pdf.js');
  }, 5000);
}
 
// ── SWITCH DE MÓDULOS CON LAZY LOADING ───────────────────
function switchMod(mod) {
  // Control de acceso por plan
  if (typeof amTieneAcceso === 'function' && !amTieneAcceso(mod)) {
    if (typeof amMostrarModalUpgrade === 'function') amMostrarModalUpgrade(mod);
    return;
  }
 
  // Módulos que necesitan cargarse bajo demanda
  const modLazy = {
    'hidrico':         ['hidrico.js'],
    'cultivares':      ['cultivares.js', 'cultivares-extra.js'],
    'mapa':            ['mapa.js'],
    'asistente':       ['asistente.js'],
    'pulverizacion':   ['pulverizacion.js'],
    'seguimiento':     ['seguimiento.js'],
    'cosecha':         ['cosecha.js'],
  };
 
  const archivos = modLazy[mod];
  if (archivos) {
    // Contar cuántos necesitan cargarse
    const pendientes = archivos.filter(a => !AM_MODULOS_CARGADOS[a]);
    if (pendientes.length > 0) {
      // Mostrar indicador de carga
      document.querySelectorAll('.module-panel').forEach(p => p.classList.remove('active'));
      const panel = $('mod-' + mod);
      if (panel) {
        panel.classList.add('active');
        panel.innerHTML = \`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem;gap:1rem;color:rgba(237,224,196,.4)">
          <div style="font-size:3rem;animation:spin 1s linear infinite">⟳</div>
          <div style="font-size:.9rem">Cargando módulo...</div>
        </div>\`;
      }
      // Activar tab visualmente
      document.querySelectorAll('.nav-tab:not(.locked)').forEach(t => t.classList.remove('active'));
      const idx = {siembra:0,suelo:1,economia:2,fertilizacion:3,maquinaria:4,hidrico:5,cultivares:6,asistente:7,mapa:8,pulverizacion:9,seguimiento:10,cosecha:11}[mod];
      document.querySelectorAll('.nav-tab:not(.locked)')[idx]?.classList.add('active');
 
      // Cargar todos los archivos del módulo en secuencia
      let i = 0;
      function cargarSiguiente() {
        if (i >= archivos.length) {
          _activarModulo(mod); // todos cargados
          return;
        }
        amCargarModulo(archivos[i], () => { i++; cargarSiguiente(); });
      }
      cargarSiguiente();
      return;
    }
  }
 
  _activarModulo(mod);
}
 
function _activarModulo(mod) {
  document.querySelectorAll('.nav-tab:not(.locked)').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.module-panel').forEach(p => p.classList.remove('active'));
 
  const idx = {siembra:0,suelo:1,economia:2,fertilizacion:3,maquinaria:4,hidrico:5,cultivares:6,asistente:7,mapa:8,pulverizacion:9,seguimiento:10,cosecha:11}[mod];
  document.querySelectorAll('.nav-tab:not(.locked)')[idx]?.classList.add('active');
  $('mod-' + mod)?.classList.add('active');
 
  // Hooks post-activación por módulo
  if (mod === 'suelo' && window._sgDatos && Object.keys(window._sgDatos).length > 0) {
    if (typeof renderSueloModulo === 'function') renderSueloModulo(window._sgDatos);
    const coord = $('s-coord')?.value;
    if (coord && $('suelo-coord')) $('suelo-coord').value = coord;
  }
  if (mod === 'economia') ecActualizarCultivo?.();
  if (mod === 'hidrico') {
    const suelo = gv('s-suelo') || 'Molisol';
    if ($('bh-suelo')) $('bh-suelo').value = suelo;
    const h1 = parseFloat($('s-h1')?.value) || 0;
    const h2 = parseFloat($('s-h2')?.value) || 0;
    const h3 = parseFloat($('s-h3')?.value) || 0;
    if (h1 > 0 && $('bh-agua-perfil')) {
      const mmEstim = Math.round((h1*0.06 + h2*0.18 + h3*0.54)*10*2);
      $('bh-agua-perfil').value = Math.max(20, Math.min(350, mmEstim));
    }
    const npPrec = $('np-prec')?.textContent;
    if (npPrec && npPrec !== '—') {
      const mmMes = parseFloat(npPrec);
      if (!isNaN(mmMes) && $('bh-precip-hist')) $('bh-precip-hist').value = Math.round(mmMes * 5.5);
    }
    if (ENSO_DATA?.fase && $('bh-enso')) $('bh-enso').value = ENSO_DATA.fase;
    bhActualizar?.();
  }
  if (mod === 'cultivares') {
    const cult = gv('s-cultivo');
    if (cult && $('cv-cultivo')) $('cv-cultivo').value = cult;
    const fecha = gv('s-fecha');
    if (fecha && $('cv-fecha')) $('cv-fecha').value = fecha;
    const coordTxt = $('s-coord')?.value;
    if (coordTxt) {
      const [lat] = parsCoord(coordTxt);
      if (lat !== null) {
        const zonaAuto = cvDetectarZona?.(lat);
        if (zonaAuto && $('cv-zona')) {
          $('cv-zona').value = zonaAuto;
          $('cv-zona-auto').textContent = '← detectada por GPS';
        }
      }
    }
    const bhCult = gv('bh-cultivo');
    if (bhCult && $('cv-cultivo') && !gv('cv-cultivo')) $('cv-cultivo').value = bhCult;
    cvActualizar?.();
    setTimeout(() => dsRender?.(), 300);
  }
  if (mod === 'asistente') iaActualizarContextoBanner?.();
  if (mod === 'mapa') setTimeout(() => mapaFiltrar?.(), 100);
  if (mod === 'pulverizacion') {
    setTimeout(() => pulvRefrescarMeteo?.(), 200);
    pulvRenderHistorial?.();
    pulvRenderHRAC?.();
    pulvCalcAgua?.();
  }
  if (mod === 'seguimiento') segInit?.();
  if (mod === 'cosecha') cosInit?.();
}
 
// ════════════════════════════════════════════════════════
// AGROMOTOR — nav.js
// switchMod con lazy loading · DOMContentLoaded init
// renderSueloModulo · Control de navegación principal
// ════════════════════════════════════════════════════════
 
 
// ── INIT ──
document.addEventListener('DOMContentLoaded',()=>{
  $('s-fecha').value=new Date().toISOString().split('T')[0];
  if($('bh-fecha'))$('bh-fecha').value=new Date().toISOString().split('T')[0];
  if($('cv-fecha'))$('cv-fecha').value=new Date().toISOString().split('T')[0];
  loadMaq();updRend();
  ecActualizarDolar();
  ecRenderDolar();
  consultarENSO();
  // Cargar cache del último lote si existe
  setTimeout(cacheCargar, 800);
  $('s-trafico')?.addEventListener('change',()=>{
    const sg=window._sgDatos;if(!sg)return;
    const hum=parseFloat($('s-h1')?.value)||22;
    const traf=parseInt($('s-trafico')?.value)||0;
    const calc=calcularCompactacion(sg,hum,traf,window._diaRef);
    if(calc){
      setR('s-compact',calc.mpaEstimado,1);
      $('compact-source').textContent='← recalculado (tráfico actualizado)';
      renderCompactacion(calc,sg);
    }
  });
});
async function consultarSuelo() {
  const txt = $('suelo-coord')?.value || $('s-coord')?.value;
  if (!txt?.trim()) { alert('Ingresá las coordenadas del lote.'); return; }
  const [lat, lon] = parsCoord(txt);
  if (lat === null) { alert('Formato no reconocido.\nEjemplo: -33.395, -60.192'); return; }
 
  const btn = $('btn-suelo');
  btn.disabled = true; btn.textContent = '⟳ Consultando...';
  const st = $('suelo-st'), sp = $('suelo-sp'), sm = $('suelo-msg');
  st.classList.remove('hidden');
  sp.style.animation = 'spin 1s linear infinite';
  sm.textContent = 'Consultando SoilGrids ISRIC (puede tardar 15-30 seg)...';
 
  try {
    const datos = await buscarSoilGrids(lat, lon);
    window._sgDatos = datos;
    renderSueloModulo(datos);
    sp.style.animation = 'none';
    sm.textContent = '✅ Datos de suelo cargados correctamente';
    // También actualizar el panel de siembra
    renderSoilGrids(datos);
    if (datos.textura) {
      const sel = $('s-suelo');
      if (sel) { sel.value = datos.textura; $('s-sbadge').textContent = '← SoilGrids'; }
    }
  } catch(e) {
    sp.style.animation = 'none';
    sm.textContent = '⚠️ Error al consultar SoilGrids. Intentá nuevamente.';
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = '🌍 Analizar suelo';
  }
}
 
function renderSueloModulo(d) {
  if (!d || Object.keys(d).length === 0) return;
  const mo = d.soc != null ? d.soc * 1.724 / 10 : null;
 
  // ── KPI cards ──
  const kpiDefs = [
    { label:'pH suelo',       val: d.ph,   fmt: v=>v.toFixed(1),       unit: d.ph!=null?(d.ph<5.5?'🚫 Muy ácido':d.ph<6?'⚠️ Ácido':d.ph<=7.5?'✅ Óptimo':'⚠️ Alcalino'):'', cls: d.ph!=null&&(d.ph<5.5||d.ph>7.8)?'danger':d.ph!=null&&d.ph>=6&&d.ph<=7.5?'':'neutral' },
    { label:'Mat. Orgánica',  val: mo,     fmt: v=>v.toFixed(1),       unit: mo!=null?(mo<2?'🚫 Baja':mo<3.5?'⚠️ Media':'✅ Alta'):'%', cls: mo!=null&&mo<2?'danger':mo!=null&&mo<3.5?'warn':'' },
    { label:'C. Orgánico',    val: d.soc,  fmt: v=>v.toFixed(1),       unit: 'g/kg', cls: 'neutral' },
    { label:'N total',        val: d.n,    fmt: v=>v.toFixed(2),       unit: 'g/kg', cls: 'neutral' },
    { label:'Dens. aparente', val: d.da,   fmt: v=>v.toFixed(2),       unit: d.da!=null?(d.da>1.45?'⚠️ Alta':d.da<1.2?'Baja':'✅ Normal'):'g/cm³', cls: d.da!=null&&d.da>1.45?'warn':'' },
    { label:'CEC',            val: d.cec,  fmt: v=>v.toFixed(0),       unit: d.cec!=null?(d.cec>25?'Alta':d.cec>15?'Media':'⚠️ Baja'):'cmol/kg', cls: d.cec!=null&&d.cec<10?'warn':'' },
    { label:'Arcilla',        val: d.clay, fmt: v=>v.toFixed(0),       unit: '%', cls: 'neutral' },
    { label:'Arena',          val: d.sand, fmt: v=>v.toFixed(0),       unit: '%', cls: 'neutral' },
    { label:'Limo',           val: d.silt, fmt: v=>v.toFixed(0),       unit: '%', cls: 'neutral' },
    { label:'Tipo de suelo',  val: d.textura, fmt: v=>v,               unit: 'SoilGrids 250m', cls: '', big: true },
  ];
 
  $('suelo-kpi-grid').innerHTML = kpiDefs
    .filter(k => k.val != null)
    .map(k => `<div class="kc ${k.cls||'neutral'}" ${k.big?'style="background:linear-gradient(135deg,#3A2A0E,#6A4A1A)"':''}>
      <div class="kl">${k.label}</div>
      <div class="kv" style="${k.big?'font-size:1rem;color:var(--grain)':''}">${k.fmt(k.val)}</div>
      <div class="ku">${k.unit}</div>
    </div>`).join('');
 
  // ── Textura visual ──
  let texHtml = '';
  if (d.clay != null && d.sand != null && d.silt != null) {
    const tot = d.clay + d.sand + d.silt || 100;
    texHtml = `
      <div style="margin-bottom:1rem">
        <div style="display:flex;height:28px;border-radius:8px;overflow:hidden;gap:2px;margin-bottom:.5rem">
          <div style="flex:${d.clay/tot*100};background:#C94A2A;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:white;font-weight:700;min-width:32px">${d.clay.toFixed(0)}%</div>
          <div style="flex:${d.silt/tot*100};background:#B87A20;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:white;font-weight:700;min-width:32px">${d.silt.toFixed(0)}%</div>
          <div style="flex:${d.sand/tot*100};background:#C8A255;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:white;font-weight:700;min-width:32px">${d.sand.toFixed(0)}%</div>
        </div>
        <div style="display:flex;gap:1.5rem;font-size:.78rem;color:rgba(74,46,26,.65)">
          <span><span style="display:inline-block;width:12px;height:12px;background:#C94A2A;border-radius:2px;margin-right:.3rem;vertical-align:middle"></span>Arcilla</span>
          <span><span style="display:inline-block;width:12px;height:12px;background:#B87A20;border-radius:2px;margin-right:.3rem;vertical-align:middle"></span>Limo</span>
          <span><span style="display:inline-block;width:12px;height:12px;background:#C8A255;border-radius:2px;margin-right:.3rem;vertical-align:middle"></span>Arena</span>
        </div>
      </div>
      ${d.textura?`<div class="alert info"><span class="ai">🗺️</span><div class="ac"><strong>Tipo de suelo estimado: ${d.textura}</strong> — basado en clasificación textural USDA/WRB. La capacidad de campo estimada es ~${d.clay>=35?35:d.sand>=65?12:28}% y el punto de marchitez ~${d.clay>=35?18:d.sand>=65?4:12}%, con un agua útil máxima de ~${d.clay>=35?17:d.sand>=65?8:16}%.</div></div>`:''}`;
  }
  $('suelo-textura-contenido').innerHTML = texHtml;
 
  // ── Tabla completa ──
  const ccEstim = d.clay>=35?35:d.sand>=65?12:28;
  const pmEstim = d.clay>=35?18:d.sand>=65?4:12;
  $('suelo-tabla').innerHTML = `
    <div style="overflow-x:auto">
    <table class="dt">
      <thead><tr><th>Propiedad</th><th>Valor (0-5 cm)</th><th>Unidad</th><th>Interpretación agronómica</th></tr></thead>
      <tbody>
        ${d.ph  !=null?`<tr><td><strong>⚗️ pH (H₂O)</strong></td><td class="mn" style="font-size:1rem;font-weight:700">${d.ph.toFixed(1)}</td><td>—</td><td>${d.ph<5.5?'🚫 Muy ácido — encalado urgente':d.ph<6.0?'⚠️ Ácido — considerar encalado':d.ph<=7.5?'✅ Óptimo para cultivos pampeanos':'⚠️ Alcalino — limita P, Fe, Zn'}</td></tr>`:''}
        ${mo    !=null?`<tr><td><strong>🌱 Materia orgánica</strong></td><td class="mn" style="font-size:1rem;font-weight:700">${mo.toFixed(1)}</td><td>%</td><td>${mo>3.5?'✅ Alta — excelente estructura y fertilidad':mo>2.0?'⚠️ Media — mantener con manejo de rastrojos':'🚫 Baja — suelo degradado, priorizar SD y cobertura'}</td></tr>`:''}
        ${d.soc !=null?`<tr><td>🌿 Carbono orgánico</td><td class="mn">${d.soc.toFixed(1)}</td><td>g/kg</td><td>Cada 1% de MO aporta ~20-30 kg N/ha/año mineralizable</td></tr>`:''}
        ${d.n   !=null?`<tr><td><strong>🔬 N total</strong></td><td class="mn" style="font-weight:700">${d.n.toFixed(2)}</td><td>g/kg</td><td>Relación C/N ≈ ${d.soc&&d.n?(d.soc/d.n).toFixed(0):'—'} · ${d.soc&&d.n&&(d.soc/d.n)<10?'Mineralización rápida':d.soc&&d.n&&(d.soc/d.n)>15?'Mineralización lenta':'Normal'}</td></tr>`:''}
        ${d.da  !=null?`<tr><td><strong>⚖️ Densidad aparente</strong></td><td class="mn" style="font-weight:700">${d.da.toFixed(2)}</td><td>g/cm³</td><td>${d.da>1.55?'🚫 Muy alta — compactación severa':d.da>1.40?'⚠️ Alta — riesgo de compactación':d.da<1.10?'Baja — alta MO':'✅ Normal'}</td></tr>`:''}
        ${d.cec !=null?`<tr><td><strong>🧲 CEC</strong></td><td class="mn" style="font-weight:700">${d.cec.toFixed(1)}</td><td>cmol/kg</td><td>${d.cec>25?'✅ Alta — excelente retención de nutrientes':d.cec>15?'Media — adecuada':'⚠️ Baja — fraccioná aplicaciones de K y Ca'}</td></tr>`:''}
        ${d.clay!=null?`<tr><td>🏺 Arcilla</td><td class="mn">${d.clay.toFixed(0)}</td><td>%</td><td>${d.clay>40?'Vértica — plástica en húmedo, dura en seco':d.clay>25?'Media — buen balance':'Baja — drenaje rápido, baja retención'}</td></tr>`:''}
        ${d.sand!=null?`<tr><td>🏖️ Arena</td><td class="mn">${d.sand.toFixed(0)}</td><td>%</td><td>—</td></tr>`:''}
        ${d.silt!=null?`<tr><td>🌫️ Limo</td><td class="mn">${d.silt.toFixed(0)}</td><td>%</td><td>—</td></tr>`:''}
        <tr style="background:rgba(74,140,92,.07)"><td><strong>💧 Cap. campo (estimada)</strong></td><td class="mn"><strong>~${ccEstim}</strong></td><td>%</td><td>Punto de marchitez: ~${pmEstim}% · Agua útil: ~${ccEstim-pmEstim}%</td></tr>
        ${d.textura?`<tr class="hl"><td><strong>🗺️ Tipo de suelo</strong></td><td colspan="2"><strong>${d.textura}</strong></td><td>Clasificación por textura USDA → WRB</td></tr>`:''}
      </tbody>
    </table></div>`;
 
  // ── Alertas ──
  $('suelo-alertas').innerHTML = [
    d.ph!=null&&d.ph<5.5  ? `<div class="alert danger"><span class="ai">⚗️</span><div class="ac"><strong>pH muy ácido (${d.ph.toFixed(1)}) — Acción urgente</strong><br>Aplicar aproximadamente ${((6.2-(d.ph??5))*600).toFixed(0)} kg/ha de cal agrícola (calcita o dolomita) para elevar a pH 6.2. La disponibilidad de P, Ca y Mg está severamente reducida.</div></div>` : '',
    d.ph!=null&&d.ph>=6&&d.ph<=7.5 ? `<div class="alert ok"><span class="ai">⚗️</span><div class="ac"><strong>pH óptimo (${d.ph.toFixed(1)})</strong> — Rango ideal para la mayoría de los cultivos pampeanos. Sin necesidad de corrección.</div></div>` : '',
    d.ph!=null&&d.ph>7.5  ? `<div class="alert warn"><span class="ai">⚗️</span><div class="ac"><strong>pH alcalino (${d.ph.toFixed(1)})</strong> — Monitorear disponibilidad de P, Fe y Zn. Verificar con análisis local.</div></div>` : '',
    mo!=null&&mo<2.0 ? `<div class="alert danger"><span class="ai">🌱</span><div class="ac"><strong>Materia orgánica baja (${mo.toFixed(1)}%)</strong><br>Suelo con estructura comprometida. Priorizar: siembra directa, cobertura permanente, retención total de rastrojos y rotación con gramíneas. Cada 1% de MO adicional aporta ~20-30 kg N/ha/año mineralizable.</div></div>` : '',
    mo!=null&&mo>=2&&mo<3.5 ? `<div class="alert warn"><span class="ai">🌱</span><div class="ac"><strong>Materia orgánica media (${mo.toFixed(1)}%)</strong><br>Mantener o mejorar con manejo de rastrojos y rotaciones. El potencial productivo del suelo está por debajo del óptimo.</div></div>` : '',
    mo!=null&&mo>=3.5 ? `<div class="alert ok"><span class="ai">🌱</span><div class="ac"><strong>Materia orgánica alta (${mo.toFixed(1)}%)</strong><br>Buena estructura y reserva de nutrientes. Mantener las prácticas de manejo actuales.</div></div>` : '',
    d.da!=null&&d.da>1.45 ? `<div class="alert warn"><span class="ai">⚖️</span><div class="ac"><strong>Densidad aparente alta (${d.da.toFixed(2)} g/cm³)</strong><br>Indica compactación existente. Confirmar con penetrómetro en el lote. La porosidad reducida limita el crecimiento radicular y la tasa de infiltración del agua.</div></div>` : '',
    d.cec!=null&&d.cec<10 ? `<div class="alert info"><span class="ai">🧲</span><div class="ac"><strong>CEC baja (${d.cec.toFixed(1)} cmol/kg)</strong><br>El suelo tiene escasa capacidad de retener cationes. Fraccioná las aplicaciones de K y Ca.</div></div>` : '',
  ].filter(Boolean).join('');
 
  $('suelo-placeholder').classList.add('hidden');
  $('suelo-kpis').classList.remove('hidden');
}
// ════════════════════════════════════════════════════════
// GENERADOR DE REPORTE PDF — AgroMotor v3.3
// Usa jsPDF para construir el PDF directamente (sin html2canvas)
// Resultado: reporte profesional A4 listo para WhatsApp
// ════════════════════════════════════════════════════════
 
