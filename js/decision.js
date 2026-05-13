// ════════════════════════════════════════════════════════
// AGROMOTOR — decision.js
// Selector de cultivo: rentable vs recomendable
// Conecta agua disponible + ENSO + precios + suelo
// para rankear cultivos antes de sembrar
// ════════════════════════════════════════════════════════

(function() {
  window.AM = window.AM || {};
  window.AM.decision = {};

// ── BASE DE DATOS DE CULTIVOS ─────────────────────────
var DEC_CULTIVOS = {
  Soja: {
    nombre: 'Soja',
    emoji: '🟡',
    // Requerimientos hídricos (mm ciclo completo)
    aguaMin: 300, aguaOpt: 500, aguaMax: 700,
    // Temperatura óptima germinación
    tMinGerm: 10, tOptGerm: 18,
    // Coeficiente de respuesta al agua FAO
    ky: 0.85,
    // Extracción de nutrientes (kg/t grano)
    extN: 75, extP: 18, extK: 50,
    // Retenciones export Argentina (%)
    retencion: 33,
    // Costos base orientativos USD/ha campaña 24/25
    costoBase: 580,
    // Rotación: penalización si es el mismo cultivo consecutivo
    penalizacionRotacion: 15,
    // Respuesta ENSO
    ensoNino: +10,   // % sobre rendimiento base
    ensoNina: -15,
    ensoNeutro: 0,
    // Rango de fechas óptimas (mes inicio)
    mesInicioOpt: 10, mesFinOpt: 12,
    // Requerimiento suelo
    phMin: 5.5, phMax: 7.5,
    moMin: 1.5,
    // Rendimiento base pampa (t/ha)
    rendBase: 3.2,
    rendOpt: 4.5,
  },
  Maiz: {
    nombre: 'Maíz',
    emoji: '🟠',
    aguaMin: 400, aguaOpt: 600, aguaMax: 800,
    tMinGerm: 10, tOptGerm: 16,
    ky: 1.25,
    extN: 120, extP: 22, extK: 80,
    retencion: 12,
    costoBase: 850,
    penalizacionRotacion: 8,
    ensoNino: +15,
    ensoNina: -20,
    ensoNeutro: 0,
    mesInicioOpt: 9, mesFinOpt: 12,
    phMin: 5.5, phMax: 7.5,
    moMin: 1.8,
    rendBase: 8.0,
    rendOpt: 12.0,
  },
  Trigo: {
    nombre: 'Trigo',
    emoji: '🟤',
    aguaMin: 250, aguaOpt: 400, aguaMax: 550,
    tMinGerm: 3, tOptGerm: 10,
    ky: 1.15,
    extN: 30, extP: 10, extK: 25,
    retencion: 12,
    costoBase: 450,
    penalizacionRotacion: 5,
    ensoNino: +5,
    ensoNina: -8,
    ensoNeutro: 0,
    mesInicioOpt: 5, mesFinOpt: 7,
    phMin: 6.0, phMax: 7.5,
    moMin: 1.5,
    rendBase: 3.5,
    rendOpt: 5.5,
  },
  Girasol: {
    nombre: 'Girasol',
    emoji: '🌻',
    aguaMin: 300, aguaOpt: 500, aguaMax: 650,
    tMinGerm: 8, tOptGerm: 12,
    ky: 0.95,
    extN: 50, extP: 20, extK: 120,
    retencion: 7,
    costoBase: 480,
    penalizacionRotacion: 10,
    ensoNino: +8,
    ensoNina: -12,
    ensoNeutro: 0,
    mesInicioOpt: 8, mesFinOpt: 10,
    phMin: 5.5, phMax: 7.0,
    moMin: 1.5,
    rendBase: 2.2,
    rendOpt: 3.5,
  },
  Sorgo: {
    nombre: 'Sorgo',
    emoji: '🔴',
    aguaMin: 200, aguaOpt: 400, aguaMax: 600,
    tMinGerm: 12, tOptGerm: 18,
    ky: 0.90,
    extN: 55, extP: 15, extK: 65,
    retencion: 12,
    costoBase: 420,
    penalizacionRotacion: 5,
    ensoNino: +8,
    ensoNina: -10,
    ensoNeutro: 0,
    mesInicioOpt: 10, mesFinOpt: 12,
    phMin: 5.5, phMax: 8.0,
    moMin: 1.2,
    rendBase: 6.0,
    rendOpt: 9.0,
  },
};

// ── FUNCIÓN PRINCIPAL ─────────────────────────────────
function decAnalizar() {
  // Leer datos del motor
  var aguaPerfil  = parseFloat((document.getElementById('bh-agua-perfil')  || {}).value) || 120;
  var precipCiclo = parseFloat((document.getElementById('bh-precip')        || {}).value) || 350;
  var aguaTotal   = aguaPerfil + precipCiclo * 0.75;

  var t6 = parseFloat(((document.getElementById('s-t6') || {}).textContent  || '').replace('°','')) || 18;
  var ph = window._sgDatos && window._sgDatos.ph ? window._sgDatos.ph : null;
  var mo = window._sgDatos && window._sgDatos.soc ? window._sgDatos.soc * 1.724 / 10 : null;

  var ensoFase = (typeof ENSO_DATA !== 'undefined' && ENSO_DATA.fase) ? ENSO_DATA.fase : 'neutro';

  var precioSoja    = parseFloat((document.getElementById('ec-precio-disp') || {}).value) || 300;
  var precioMaiz    = precioSoja * 0.72;
  var precioTrigo   = precioSoja * 0.68;
  var precioGirasol = precioSoja * 1.10;
  var precioSorgo   = precioSoja * 0.58;

  var precios = {
    Soja: precioSoja,
    Maiz: precioMaiz,
    Trigo: precioTrigo,
    Girasol: precioGirasol,
    Sorgo: precioSorgo,
  };

  var cultAnterior = (document.getElementById('dec-cult-anterior') || {}).value || '';

  var resultados = [];
  var cultivos = Object.keys(DEC_CULTIVOS);

  cultivos.forEach(function(nombre) {
    var c = DEC_CULTIVOS[nombre];
    var precio = precios[nombre] || 300;

    // ── SCORE AGRONÓMICO (0-100) ──
    var scoreAgro = 0;
    var factoresAgro = [];

    // Factor agua (40 puntos)
    var scoreAgua = 0;
    if (aguaTotal < c.aguaMin) {
      scoreAgua = Math.max(0, 20 * (aguaTotal / c.aguaMin));
      factoresAgro.push({label: 'Agua insuficiente', valor: Math.round(aguaTotal) + ' mm vs ' + c.aguaMin + ' mm mín', color: 'warn'});
    } else if (aguaTotal <= c.aguaOpt) {
      scoreAgua = 20 + 20 * ((aguaTotal - c.aguaMin) / (c.aguaOpt - c.aguaMin));
      factoresAgro.push({label: 'Agua adecuada', valor: Math.round(aguaTotal) + ' mm', color: 'ok'});
    } else {
      scoreAgua = 40;
      factoresAgro.push({label: 'Agua óptima o excedente', valor: Math.round(aguaTotal) + ' mm', color: 'ok'});
    }
    scoreAgro += scoreAgua;

    // Factor temperatura (20 puntos)
    var scoreTemp = 0;
    if (t6 >= c.tOptGerm) {
      scoreTemp = 20;
      factoresAgro.push({label: 'Temperatura óptima', valor: t6 + '°C', color: 'ok'});
    } else if (t6 >= c.tMinGerm) {
      scoreTemp = 10 + 10 * ((t6 - c.tMinGerm) / (c.tOptGerm - c.tMinGerm));
      factoresAgro.push({label: 'Temperatura aceptable', valor: t6 + '°C', color: 'caution'});
    } else {
      scoreTemp = 0;
      factoresAgro.push({label: 'Temperatura insuficiente', valor: t6 + '°C vs ' + c.tMinGerm + '°C mín', color: 'warn'});
    }
    scoreAgro += scoreTemp;

    // Factor ENSO (15 puntos)
    var scoreEnso = 8;
    if (ensoFase === 'nino' && c.ensoNino > 0) { scoreEnso = 15; factoresAgro.push({label: 'ENSO Niño — favorable', valor: '+' + c.ensoNino + '% rendimiento', color: 'ok'}); }
    else if (ensoFase === 'nino' && c.ensoNino <= 0) { scoreEnso = 3; factoresAgro.push({label: 'ENSO Niño — desfavorable', valor: c.ensoNino + '% rendimiento', color: 'warn'}); }
    else if (ensoFase === 'nina' && c.ensoNina < -10) { scoreEnso = 2; factoresAgro.push({label: 'ENSO Niña — muy desfavorable', valor: c.ensoNina + '% rendimiento', color: 'warn'}); }
    else if (ensoFase === 'nina') { scoreEnso = 5; factoresAgro.push({label: 'ENSO Niña — moderadamente desfavorable', valor: c.ensoNina + '% rendimiento', color: 'caution'}); }
    else { factoresAgro.push({label: 'ENSO Neutro', valor: 'Sin ajuste', color: 'ok'}); }
    scoreAgro += scoreEnso;

    // Factor suelo pH (10 puntos)
    if (ph !== null) {
      if (ph >= c.phMin && ph <= c.phMax) {
        scoreAgro += 10;
        factoresAgro.push({label: 'pH óptimo', valor: ph.toFixed(1), color: 'ok'});
      } else {
        scoreAgro += 3;
        factoresAgro.push({label: 'pH subóptimo', valor: ph.toFixed(1) + ' (óptimo ' + c.phMin + '-' + c.phMax + ')', color: 'caution'});
      }
    } else {
      scoreAgro += 7;
    }

    // Factor MO (5 puntos)
    if (mo !== null) {
      if (mo >= c.moMin) { scoreAgro += 5; }
      else { scoreAgro += 2; factoresAgro.push({label: 'MO baja', valor: mo.toFixed(1) + '% vs ' + c.moMin + '% mín', color: 'caution'}); }
    } else {
      scoreAgro += 4;
    }

    // Factor rotación (10 puntos)
    if (cultAnterior && cultAnterior === nombre) {
      scoreAgro += Math.max(0, 10 - c.penalizacionRotacion);
      factoresAgro.push({label: 'Mismo cultivo año anterior', valor: '-' + c.penalizacionRotacion + ' pts rotación', color: 'warn'});
    } else if (cultAnterior) {
      scoreAgro += 10;
      factoresAgro.push({label: 'Rotación correcta', valor: 'vs ' + cultAnterior, color: 'ok'});
    } else {
      scoreAgro += 8;
    }

    scoreAgro = Math.min(100, Math.max(0, Math.round(scoreAgro)));

    // ── RENDIMIENTO ESTIMADO ──
    var factorAgua = Math.min(1, aguaTotal / c.aguaOpt);
    var factorEnso = 1 + (ensoFase === 'nino' ? c.ensoNino : ensoFase === 'nina' ? c.ensoNina : 0) / 100;
    var rendEstim = c.rendBase * factorAgua * factorEnso;
    if (aguaTotal >= c.aguaOpt) rendEstim = c.rendOpt * factorEnso;
    rendEstim = Math.max(c.rendBase * 0.4, Math.round(rendEstim * 10) / 10);

    // ── SCORE ECONÓMICO ──
    var ingresosBruto = rendEstim * precio * (1 - c.retencion / 100);
    var costoTotal = c.costoBase;
    var margenBruto = ingresosBruto - costoTotal;
    var relInsumoProd = precio > 0 ? (c.costoBase / precio).toFixed(1) : '—';

    // Score económico 0-100 basado en margen bruto relativo
    var scoreEco = Math.min(100, Math.max(0, Math.round(50 + margenBruto / 10)));

    resultados.push({
      nombre: nombre,
      emoji: c.emoji,
      scoreAgro: scoreAgro,
      scoreEco: scoreEco,
      rendEstim: rendEstim,
      margenBruto: Math.round(margenBruto),
      ingresosBruto: Math.round(ingresosBruto),
      costoTotal: costoTotal,
      precio: precio,
      relInsumoProd: relInsumoProd,
      factoresAgro: factoresAgro,
      retencion: c.retencion,
    });
  });

  // Ordenar por score agronómico para ranking
  var rankAgro = resultados.slice().sort(function(a,b) { return b.scoreAgro - a.scoreAgro; });
  var rankEco  = resultados.slice().sort(function(a,b) { return b.margenBruto - a.margenBruto; });

  resultados.forEach(function(r) {
    r.posAgro = rankAgro.findIndex(function(x) { return x.nombre === r.nombre; }) + 1;
    r.posEco  = rankEco.findIndex(function(x)  { return x.nombre === r.nombre; }) + 1;
  });

  decRender(resultados, aguaTotal, ensoFase);
}

// ── RENDER ────────────────────────────────────────────
function decRender(resultados, aguaTotal, ensoFase) {
  var container = document.getElementById('dec-resultado');
  if (!container) return;

  var rankAgro = resultados.slice().sort(function(a,b) { return b.scoreAgro - a.scoreAgro; });
  var rankEco  = resultados.slice().sort(function(a,b) { return b.margenBruto - a.margenBruto; });

  var mejorAgro = rankAgro[0];
  var mejorEco  = rankEco[0];
  var coinciden = mejorAgro.nombre === mejorEco.nombre;

  // ── VEREDICTO PRINCIPAL ──
  var veredictoHtml = '<div style="background:linear-gradient(135deg,#0E2016,#1A3A25);border-radius:18px;padding:1.4rem 1.6rem;margin-bottom:1.2rem;border:1px solid rgba(109,191,130,.15)">';
  veredictoHtml += '<div style="font-size:.65rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(237,224,196,.4);margin-bottom:.8rem">⚖️ Análisis de decisión · ' + new Date().toLocaleDateString('es-AR') + '</div>';

  if (coinciden) {
    veredictoHtml += '<div style="font-family:\'DM Serif Display\',serif;font-size:1.5rem;color:white;margin-bottom:.4rem">';
    veredictoHtml += mejorAgro.emoji + ' ' + mejorAgro.nombre + ' — la mejor opción en ambos criterios</div>';
    veredictoHtml += '<div style="font-size:.84rem;color:rgba(237,224,196,.6);line-height:1.5">Es el cultivo más recomendable agronómicamente Y el más rentable para esta campaña. Condiciones del lote y precios actuales apuntan en la misma dirección.</div>';
  } else {
    veredictoHtml += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:.8rem">';
    veredictoHtml += '<div style="background:rgba(42,122,74,.15);border-radius:12px;padding:.9rem;border:1px solid rgba(42,122,74,.3)">';
    veredictoHtml += '<div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(109,191,130,.6);margin-bottom:.3rem">🌱 Más recomendable agronómicamente</div>';
    veredictoHtml += '<div style="font-size:1.3rem;font-weight:700;color:white">' + mejorAgro.emoji + ' ' + mejorAgro.nombre + '</div>';
    veredictoHtml += '<div style="font-size:.75rem;color:rgba(237,224,196,.5);margin-top:.2rem">Score agronómico: ' + mejorAgro.scoreAgro + '/100</div></div>';
    veredictoHtml += '<div style="background:rgba(200,162,85,.12);border-radius:12px;padding:.9rem;border:1px solid rgba(200,162,85,.25)">';
    veredictoHtml += '<div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(200,162,85,.6);margin-bottom:.3rem">💰 Más rentable este año</div>';
    veredictoHtml += '<div style="font-size:1.3rem;font-weight:700;color:white">' + mejorEco.emoji + ' ' + mejorEco.nombre + '</div>';
    veredictoHtml += '<div style="font-size:.75rem;color:rgba(237,224,196,.5);margin-top:.2rem">Margen: USD ' + mejorEco.margenBruto + '/ha</div></div></div>';
    veredictoHtml += '<div style="font-size:.82rem;color:rgba(237,224,196,.55);line-height:1.5">El análisis muestra una tensión entre rentabilidad y aptitud agronómica. Considerá el riesgo climático y la sustentabilidad del sistema antes de decidir.</div>';
  }
  veredictoHtml += '</div>';

  // ── TABLA COMPARATIVA ──
  var tablaHtml = '<div style="background:#fff;border-radius:14px;padding:1rem 1.1rem;border:1px solid rgba(74,46,26,.12);box-shadow:0 2px 10px rgba(0,0,0,.15)">';
  tablaHtml += '<div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--earth);margin-bottom:.6rem">Comparación completa de cultivos</div>';
  tablaHtml += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem">';
  tablaHtml += '<thead><tr style="background:#f3ede0">';
  tablaHtml += '<th style="padding:.6rem .8rem;text-align:left;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(74,46,26,.45)">Cultivo</th>';
  tablaHtml += '<th style="padding:.6rem .8rem;text-align:center;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(42,122,74,.7)">Score<br>Agronómico</th>';
  tablaHtml += '<th style="padding:.6rem .8rem;text-align:center;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(74,46,26,.45)">Rend.<br>estimado</th>';
  tablaHtml += '<th style="padding:.6rem .8rem;text-align:center;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(200,162,85,.8)">Margen<br>bruto</th>';
  tablaHtml += '<th style="padding:.6rem .8rem;text-align:center;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(74,46,26,.45)">Relación<br>ins/prod</th>';
  tablaHtml += '<th style="padding:.6rem .8rem;text-align:center;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(74,46,26,.45)">Decisión</th>';
  tablaHtml += '</tr></thead><tbody>';

  rankAgro.forEach(function(r, i) {
    var esMejorAgro = i === 0;
    var esMejorEco  = r.posEco === 1;
    var bg = i % 2 === 0 ? '#fbf8f1' : '#ffffff';
    if (esMejorAgro && esMejorEco) bg = '#e0f0e6';
    else if (esMejorAgro) bg = '#ecf6ef';
    else if (esMejorEco) bg = '#f7eed4';

    var scoreColor = r.scoreAgro >= 70 ? 'var(--ok)' : r.scoreAgro >= 50 ? 'var(--caution)' : 'var(--warn)';
    var margenColor = r.margenBruto > 200 ? 'var(--ok)' : r.margenBruto > 0 ? 'var(--caution)' : 'var(--warn)';
    var medalAgro = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i+1);
    var medalEco  = r.posEco === 1 ? '💰' : '';

    tablaHtml += '<tr style="background:' + bg + ';border-bottom:1px solid rgba(74,46,26,.06)">';
    tablaHtml += '<td style="padding:.7rem .8rem"><div style="display:flex;align-items:center;gap:.5rem"><span style="font-size:1.1rem">' + r.emoji + '</span><div><div style="font-weight:600;color:var(--ink)">' + r.nombre + '</div><div style="font-size:.68rem;color:rgba(74,46,26,.4)">Precio ref: USD ' + r.precio + '/t · Ret. ' + r.retencion + '%</div></div></div></td>';
    tablaHtml += '<td style="padding:.7rem .8rem;text-align:center"><div style="font-size:.8rem;margin-bottom:.2rem">' + medalAgro + '</div><div style="font-size:1.1rem;font-weight:700;color:' + scoreColor + '">' + r.scoreAgro + '</div><div style="font-size:.65rem;color:rgba(74,46,26,.4)">/100</div></td>';
    tablaHtml += '<td style="padding:.7rem .8rem;text-align:center;font-family:\'DM Mono\',monospace;font-weight:600">' + r.rendEstim.toFixed(1) + '<span style="font-size:.7rem;color:rgba(74,46,26,.4);font-family:inherit"> t/ha</span></td>';
    tablaHtml += '<td style="padding:.7rem .8rem;text-align:center"><div style="font-size:.8rem;margin-bottom:.1rem">' + medalEco + '</div><div style="font-size:1rem;font-weight:700;color:' + margenColor + '">USD ' + r.margenBruto + '</div><div style="font-size:.65rem;color:rgba(74,46,26,.4)">/ha</div></td>';
    tablaHtml += '<td style="padding:.7rem .8rem;text-align:center;font-family:\'DM Mono\',monospace">' + r.relInsumoProd + '<span style="font-size:.7rem;color:rgba(74,46,26,.4);font-family:inherit"> qq/' + r.nombre.substring(0,3) + '</span></td>';
    tablaHtml += '<td style="padding:.7rem .8rem;text-align:center"><button onclick="decElegir(\'' + r.nombre + '\')" style="background:linear-gradient(135deg,var(--canopy),var(--leaf));color:white;border:none;border-radius:8px;padding:.4rem .9rem;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">✓ Elegir</button></td>';
    tablaHtml += '</tr>';
  });

  tablaHtml += '</tbody></table></div></div>';

  // ── NOTA METODOLÓGICA ──
  var notaHtml = '<div style="margin-top:.8rem;font-size:.72rem;color:#6b5b45;padding:.6rem .9rem;background:#fbf8f1;border:1px solid rgba(74,46,26,.15);border-radius:8px;line-height:1.5">';
  notaHtml += '📊 Score agronómico: agua disponible (' + Math.round(aguaTotal) + ' mm) · temperatura · ENSO (' + ensoFase + ') · pH y MO del suelo · rotación · ';
  notaHtml += 'Margen bruto estimado con costos de referencia campaña 2024/25 · Precios base desde módulo Economía · ';
  notaHtml += 'Rendimiento estimado con función respuesta FAO. Validar con asesor antes de decidir.</div>';

  container.innerHTML = veredictoHtml + tablaHtml + notaHtml;
  container.classList.remove('hidden');
  // Ocultar placeholder cuando hay resultado
  var ph = document.getElementById('dec-placeholder');
  if (ph) ph.classList.add('hidden');
  container.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

// ── ELEGIR CULTIVO ────────────────────────────────────
function decElegir(cultivo) {
  // Propagar al resto del motor vía Store
  if (typeof AM !== 'undefined' && AM.store) {
    AM.store.update({ cultivo: cultivo });
  } else {
    // Fallback si no está el store
    var selSiembra = document.getElementById('s-cultivo');
    var selBH      = document.getElementById('bh-cultivo');
    var selCV      = document.getElementById('cv-cultivo');
    var selEC      = document.getElementById('ec-cultivo');
    if (selSiembra) selSiembra.value = cultivo;
    if (selBH)      selBH.value      = cultivo;
    if (selCV)      selCV.value      = cultivo;
    if (selEC)      selEC.value      = cultivo;
  }

  // Guardar elección
  document.getElementById('dec-cult-elegido') && (document.getElementById('dec-cult-elegido').textContent = cultivo);

  // Feedback visual
  var btn = document.getElementById('dec-cult-elegido-banner');
  if (btn) {
    btn.textContent = '✅ Elegiste ' + DEC_CULTIVOS[cultivo].emoji + ' ' + cultivo + ' — los módulos del motor se actualizaron';
    btn.classList.remove('hidden');
  }

  if (typeof amToast === 'function') amToast('✅ ' + cultivo + ' seleccionado — motor actualizado', 'ok');

  // Si ya están cargados, actualizar módulos (se ejecutará de todas formas vía store, pero forzamos porsia)
  if (typeof cvActualizar    === 'function') cvActualizar();
  if (typeof bhActualizar    === 'function') bhActualizar();
  if (typeof ecActualizarCultivo === 'function') ecActualizarCultivo();
}

  // Exponer a window para onclick en HTML
  window.decAnalizar = decAnalizar;
  window.decElegir = decElegir;

})();
