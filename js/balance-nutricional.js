// ════════════════════════════════════════════════════════
// AGROMOTOR — balance-nutricional.js
// Balance nutricional post-cosecha
// Cierra el ciclo: suelo → campaña → cosecha → próxima siembra
// Fuente: tablas extracción INTA / FAO / Echeverría & García
// ════════════════════════════════════════════════════════

(function() {
  window.AM = window.AM || {};
  window.AM.balanceNutricional = {};

// ── EXTRACCIÓN POR CULTIVO (kg nutriente / t grano) ──
var BN_EXTRACCION = {
  Soja: {
    N:    { grano: 75,  rastrojo: 12, total: 87  },
    P2O5: { grano: 18,  rastrojo: 4,  total: 22  },
    K2O:  { grano: 20,  rastrojo: 30, total: 50  },
    S:    { grano: 5,   rastrojo: 2,  total: 7   },
    Ca:   { grano: 3,   rastrojo: 8,  total: 11  },
    Mg:   { grano: 3,   rastrojo: 4,  total: 7   },
    // Fracción que queda en el campo si se deja el rastrojo
    rastrojoEnCampo: true,
  },
  Maiz: {
    N:    { grano: 120, rastrojo: 30, total: 150 },
    P2O5: { grano: 22,  rastrojo: 8,  total: 30  },
    K2O:  { grano: 15,  rastrojo: 65, total: 80  },
    S:    { grano: 8,   rastrojo: 4,  total: 12  },
    Ca:   { grano: 2,   rastrojo: 18, total: 20  },
    Mg:   { grano: 4,   rastrojo: 8,  total: 12  },
    rastrojoEnCampo: true,
  },
  Trigo: {
    N:    { grano: 30,  rastrojo: 12, total: 42  },
    P2O5: { grano: 10,  rastrojo: 4,  total: 14  },
    K2O:  { grano: 7,   rastrojo: 18, total: 25  },
    S:    { grano: 4,   rastrojo: 2,  total: 6   },
    Ca:   { grano: 1,   rastrojo: 6,  total: 7   },
    Mg:   { grano: 2,   rastrojo: 3,  total: 5   },
    rastrojoEnCampo: true,
  },
  Girasol: {
    N:    { grano: 50,  rastrojo: 20, total: 70  },
    P2O5: { grano: 20,  rastrojo: 8,  total: 28  },
    K2O:  { grano: 15,  rastrojo: 105,total: 120 },
    S:    { grano: 6,   rastrojo: 3,  total: 9   },
    Ca:   { grano: 2,   rastrojo: 25, total: 27  },
    Mg:   { grano: 4,   rastrojo: 10, total: 14  },
    rastrojoEnCampo: true,
  },
  Sorgo: {
    N:    { grano: 55,  rastrojo: 20, total: 75  },
    P2O5: { grano: 15,  rastrojo: 6,  total: 21  },
    K2O:  { grano: 15,  rastrojo: 50, total: 65  },
    S:    { grano: 4,   rastrojo: 2,  total: 6   },
    Ca:   { grano: 2,   rastrojo: 12, total: 14  },
    Mg:   { grano: 3,   rastrojo: 6,  total: 9   },
    rastrojoEnCampo: true,
  },
};

// ── NIVELES DE REFERENCIA EN SUELO (ppm o kg/ha) ──────
// Umbrales agronómicos para la pampa húmeda
var BN_UMBRALES = {
  N:    { critico: 40,  bajo: 80,  optimo: 120, alto: 180, unidad: 'kg/ha 0-60cm' },
  P:    { critico: 8,   bajo: 12,  optimo: 18,  alto: 25,  unidad: 'ppm Bray' },
  K:    { critico: 100, bajo: 150, optimo: 200, alto: 280, unidad: 'ppm' },
  S:    { critico: 5,   bajo: 8,   optimo: 12,  alto: 20,  unidad: 'ppm' },
  MO:   { critico: 1.5, bajo: 2.5, optimo: 3.5, alto: 5.0, unidad: '%' },
};

// ── EQUIVALENCIA FERTILIZANTE POR NUTRIENTE ──────────
var BN_FERTILIZANTES = {
  N:    { nombre: 'Urea (46-0-0)',    riqueza: 0.46, precioRef: 380 },
  P2O5: { nombre: 'MAP (11-52-0)',    riqueza: 0.52, precioRef: 620 },
  K2O:  { nombre: 'Cloruro de K',    riqueza: 0.60, precioRef: 480 },
  S:    { nombre: 'SuMag (22% S)',    riqueza: 0.22, precioRef: 280 },
};

// ── FUNCIÓN PRINCIPAL ─────────────────────────────────
function bnAnalizar() {
  // Leer datos del formulario
  var cultivo  = (document.getElementById('bn-cultivo')  || {}).value || 'Soja';
  var rend     = parseFloat((document.getElementById('bn-rend')     || {}).value) || 3.5;
  var sup      = parseFloat((document.getElementById('bn-sup')      || {}).value) || 100;
  var rastrojo = (document.getElementById('bn-rastrojo') || {}).value || 'campo';
  var fertN    = parseFloat((document.getElementById('bn-fert-n')   || {}).value) || 0;
  var fertP    = parseFloat((document.getElementById('bn-fert-p')   || {}).value) || 0;
  var fertS    = parseFloat((document.getElementById('bn-fert-s')   || {}).value) || 0;

  // Datos del suelo actual (de SoilGrids si están disponibles)
  var ph  = window._sgDatos && window._sgDatos.ph  ? window._sgDatos.ph  : null;
  var mo  = window._sgDatos && window._sgDatos.soc ? window._sgDatos.soc * 1.724 / 10 : null;
  var nSuelo = window._sgDatos && window._sgDatos.n ? window._sgDatos.n * 1000 : null;

  var ext = BN_EXTRACCION[cultivo];
  if (!ext) {
    var errEl = document.getElementById('bn-resultado');
    if (errEl) errEl.innerHTML = '<div style="color:var(--warn);padding:1rem">Cultivo no reconocido. Seleccioná un cultivo válido.</div>';
    return;
  }

  // ── CALCULAR BALANCE ──────────────────────────────
  var rastrojoQueda = rastrojo === 'campo';

  var balance = {};
  var nutrientes = ['N', 'P2O5', 'K2O', 'S'];

  nutrientes.forEach(function(nut) {
    var datos = ext[nut];
    if (!datos) return;

    // Extracción real según manejo de rastrojo
    var extraccionGrano     = datos.grano * rend;
    var extraccionRastrojo  = rastrojoQueda ? 0 : datos.rastrojo * rend;
    var extraccionTotal     = extraccionGrano + extraccionRastrojo;

    // Aporte de fertilizantes (con eficiencia de recuperación)
    var eficiencia = nut === 'N' ? 0.65 : nut === 'P2O5' ? 0.25 : nut === 'K2O' ? 0.40 : 0.50;
    var aporteFert = 0;
    if (nut === 'N')    aporteFert = fertN * 0.46 * eficiencia;
    if (nut === 'P2O5') aporteFert = fertP * 0.52 * eficiencia;
    if (nut === 'S')    aporteFert = fertS * 0.22 * eficiencia;

    // Aporte natural del suelo (mineralización estimada)
    var aporteNatural = 0;
    if (nut === 'N') aporteNatural = mo ? mo * 20 : 40; // ~20 kg N/% MO/año
    if (nut === 'S') aporteNatural = 8;  // mineralización base S pampa

    // Balance neto
    var balanceNeto = aporteFert + aporteNatural - extraccionTotal;

    balance[nut] = {
      extraccionGrano:    Math.round(extraccionGrano),
      extraccionRastrojo: Math.round(extraccionRastrojo),
      extraccionTotal:    Math.round(extraccionTotal),
      aporteFert:         Math.round(aporteFert),
      aporteNatural:      Math.round(aporteNatural),
      balanceNeto:        Math.round(balanceNeto),
      balanceLote:        Math.round(balanceNeto * sup),
    };
  });

  // ── RECOMENDACIÓN PRÓXIMA CAMPAÑA ────────────────
  var recomendaciones = [];

  // N
  if (balance.N) {
    var defN = -balance.N.balanceNeto;
    if (defN > 60) {
      recomendaciones.push({
        nut: 'N', urgencia: 'alta',
        titulo: 'Déficit de Nitrógeno significativo',
        texto: 'La campaña extrajo ' + balance.N.extraccionTotal + ' kg N/ha y el suelo no repone suficiente. Para la próxima campaña considerá aplicar entre ' + Math.round(defN * 0.8) + ' y ' + Math.round(defN * 1.2) + ' kg N/ha según el cultivo siguiente.',
        dosis: Math.round(defN),
        fertNombre: BN_FERTILIZANTES.N.nombre,
        cantFert: Math.round(defN / 0.46),
        costoEstim: Math.round(defN / 0.46 * BN_FERTILIZANTES.N.precioRef / 1000),
      });
    } else if (defN > 20) {
      recomendaciones.push({
        nut: 'N', urgencia: 'media',
        titulo: 'Nitrógeno levemente negativo',
        texto: 'Déficit moderado de ' + defN + ' kg N/ha. El suelo puede estar en situación de minería lenta de N. Monitorear MO a mediano plazo.',
        dosis: Math.round(defN),
        fertNombre: BN_FERTILIZANTES.N.nombre,
        cantFert: Math.round(defN / 0.46),
        costoEstim: Math.round(defN / 0.46 * BN_FERTILIZANTES.N.precioRef / 1000),
      });
    } else if (balance.N.balanceNeto > 0) {
      recomendaciones.push({
        nut: 'N', urgencia: 'ok',
        titulo: 'Balance de Nitrógeno positivo',
        texto: 'El suelo quedó con superávit de ' + balance.N.balanceNeto + ' kg N/ha disponible para la próxima campaña.',
        dosis: 0,
      });
    }
  }

  // P
  if (balance.P2O5) {
    var defP = -balance.P2O5.balanceNeto;
    if (defP > 15) {
      recomendaciones.push({
        nut: 'P', urgencia: 'alta',
        titulo: 'Déficit de Fósforo — reposición necesaria',
        texto: 'Se extrajeron ' + balance.P2O5.extraccionTotal + ' kg P2O5/ha y no se repuso suficiente. El nivel de P en suelo bajó. Para la próxima campaña: ' + Math.round(defP * 0.9) + '-' + Math.round(defP * 1.1) + ' kg P2O5/ha.',
        dosis: Math.round(defP),
        fertNombre: BN_FERTILIZANTES.P2O5.nombre,
        cantFert: Math.round(defP / 0.52),
        costoEstim: Math.round(defP / 0.52 * BN_FERTILIZANTES.P2O5.precioRef / 1000),
      });
    } else if (balance.P2O5.balanceNeto >= 0) {
      recomendaciones.push({
        nut: 'P', urgencia: 'ok',
        titulo: 'Fósforo repuesto correctamente',
        texto: 'La fertilización fosfatada compensó la extracción del cultivo. Continuar con plan de mantenimiento.',
        dosis: 0,
      });
    }
  }

  // S
  if (balance.S) {
    var defS = -balance.S.balanceNeto;
    if (defS > 5) {
      recomendaciones.push({
        nut: 'S', urgencia: 'media',
        titulo: 'Déficit de Azufre',
        texto: 'El cultivo extrajo más S del que se repuso. Para la próxima campaña: 15-25 kg S/ha según análisis.',
        dosis: Math.round(defS),
        fertNombre: BN_FERTILIZANTES.S.nombre,
        cantFert: Math.round(defS / 0.22),
        costoEstim: Math.round(defS / 0.22 * BN_FERTILIZANTES.S.precioRef / 1000),
      });
    }
  }

  // K - alerta especial para girasol
  if (balance.K2O && cultivo === 'Girasol') {
    var defK = -balance.K2O.balanceNeto;
    if (defK > 50) {
      recomendaciones.push({
        nut: 'K', urgencia: 'alta',
        titulo: 'Atención: Girasol extrae mucho Potasio',
        texto: 'El girasol tiene la mayor extracción de K2O entre los cultivos pampeanos (' + balance.K2O.extraccionTotal + ' kg K2O/ha). En suelos con menos de 150 ppm K considerar reposición.',
        dosis: Math.round(defK),
      });
    }
  }

  // Alerta MO si hay datos
  if (mo !== null && mo < 2.5 && balance.N.balanceNeto < 0) {
    recomendaciones.push({
      nut: 'MO', urgencia: 'media',
      titulo: 'MO baja + déficit N: ciclo negativo',
      texto: 'Con MO ' + mo.toFixed(1) + '% y balance de N negativo, el suelo está en proceso de degradación. Priorizar la retención de rastrojo y considerar cultivos de cobertura en la rotación.',
      dosis: 0,
    });
  }

  bnRender(balance, recomendaciones, cultivo, rend, sup, rastrojoQueda);
}

// ── RENDER ────────────────────────────────────────────
function bnRender(balance, recs, cultivo, rend, sup, rastrojoQueda) {
  var container = document.getElementById('bn-resultado');
  if (!container) return;

  var html = '';

  // ── RESUMEN BALANCE ──
  html += '<div style="background:linear-gradient(135deg,#0E2016,#1A3A25);border-radius:16px;padding:1.2rem 1.4rem;margin-bottom:1.2rem;border:1px solid rgba(109,191,130,.15)">';
  html += '<div style="font-size:.62rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(237,224,196,.35);margin-bottom:.8rem">';
  html += '🌾 Balance nutricional post-cosecha — ' + cultivo + ' · ' + rend + ' t/ha · ' + sup + ' ha · Rastrojo: ' + (rastrojoQueda ? 'en campo' : 'extraído');
  html += '</div>';

  // Tabla resumen
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">';
  html += '<thead><tr>';
  var ths = ['Nutriente', 'Extracción grano', 'Extracción rastrojo', 'Aporte ferti.', 'Aporte natural', 'Balance neto', 'Balance lote'];
  ths.forEach(function(th) {
    html += '<th style="padding:.5rem .7rem;font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(237,224,196,.4);text-align:center;white-space:nowrap">' + th + '</th>';
  });
  html += '</tr></thead><tbody>';

  var nutLabels = {N:'Nitrógeno (N)', P2O5:'Fósforo (P₂O₅)', K2O:'Potasio (K₂O)', S:'Azufre (S)'};
  var nutColors = {N:'#6DBF82', P2O5:'#E8B84B', K2O:'#7ABAEE', S:'#C8A255'};

  Object.keys(balance).forEach(function(nut) {
    var b = balance[nut];
    var color = nutColors[nut] || 'white';
    var balColor = b.balanceNeto >= 0 ? '#6DBF82' : b.balanceNeto > -30 ? '#E8B84B' : '#D4522A';
    html += '<tr style="border-bottom:1px solid rgba(237,224,196,.06)">';
    html += '<td style="padding:.6rem .7rem;font-weight:600;color:' + color + ';white-space:nowrap">' + (nutLabels[nut]||nut) + '</td>';
    html += '<td style="padding:.6rem .7rem;text-align:center;font-family:\'DM Mono\',monospace;color:rgba(237,224,196,.8)">-' + b.extraccionGrano + ' kg/ha</td>';
    html += '<td style="padding:.6rem .7rem;text-align:center;font-family:\'DM Mono\',monospace;color:rgba(237,224,196,.5)">-' + b.extraccionRastrojo + ' kg/ha</td>';
    html += '<td style="padding:.6rem .7rem;text-align:center;font-family:\'DM Mono\',monospace;color:#6DBF82">+' + b.aporteFert + ' kg/ha</td>';
    html += '<td style="padding:.6rem .7rem;text-align:center;font-family:\'DM Mono\',monospace;color:rgba(237,224,196,.5)">+' + b.aporteNatural + ' kg/ha</td>';
    html += '<td style="padding:.6rem .7rem;text-align:center;font-family:\'DM Mono\',monospace;font-weight:700;color:' + balColor + '">';
    html += (b.balanceNeto >= 0 ? '+' : '') + b.balanceNeto + ' kg/ha</td>';
    html += '<td style="padding:.6rem .7rem;text-align:center;font-family:\'DM Mono\',monospace;font-size:.78rem;color:rgba(237,224,196,.5)">';
    html += (b.balanceLote >= 0 ? '+' : '') + b.balanceLote + ' kg</td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  html += '<div style="font-size:.68rem;color:rgba(237,224,196,.3);margin-top:.5rem">Rastrojo ' + (rastrojoQueda ? 'retenido en campo — sus nutrientes se reciclan gradualmente' : 'extraído del lote — extracción total incluida') + '</div>';
  html += '</div>';

  // ── RECOMENDACIONES ──
  html += '<div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C8A255;margin-bottom:.6rem">💊 Recomendaciones para la próxima campaña</div>';

  if (recs.length === 0) {
    html += '<div class="alert ok"><span class="ai">✅</span><div class="ac"><strong>Balance equilibrado</strong> — La fertilización realizada repuso adecuadamente los nutrientes extraídos. El suelo quedó en buenas condiciones para la próxima campaña.</div></div>';
  } else {
    recs.forEach(function(r) {
      var cls = r.urgencia === 'alta' ? 'danger' : r.urgencia === 'media' ? 'warn' : r.urgencia === 'ok' ? 'ok' : 'info';
      var ico = r.urgencia === 'alta' ? '🔴' : r.urgencia === 'media' ? '🟡' : r.urgencia === 'ok' ? '✅' : 'ℹ️';
      html += '<div class="alert ' + cls + '" style="margin-bottom:.6rem">';
      html += '<span class="ai">' + ico + '</span>';
      html += '<div class="ac"><strong>' + r.titulo + '</strong><br>' + r.texto;
      if (r.dosis > 0 && r.fertNombre) {
        html += '<div style="margin-top:.5rem;padding:.5rem .7rem;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:7px;font-size:.77rem">';
        html += '📦 <strong>Fertilizante sugerido:</strong> ' + r.fertNombre;
        html += ' · Dosis: <strong>' + r.cantFert + ' kg/ha</strong>';
        html += ' · Costo estimado: <strong>USD ' + r.costoEstim + '/ha</strong>';
        html += '</div>';
      }
      html += '</div></div>';
    });
  }

  // ── ESTADO DEL SUELO POST-COSECHA ──
  html += '<div class="card gap-top">';
  html += '<div class="card-title">🌍 Estado estimado del suelo post-cosecha</div>';
  html += '<div style="font-size:.78rem;color:rgba(74,46,26,.6);line-height:1.7">';

  if (window._sgDatos && window._sgDatos.ph) {
    var mo_val = window._sgDatos.soc ? (window._sgDatos.soc * 1.724 / 10).toFixed(1) : '—';
    var nTotal = window._sgDatos.n ? (window._sgDatos.n * 1000).toFixed(0) : '—';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.6rem;margin-bottom:.8rem">';

    var estadoItems = [
      { label:'pH actual', valor: window._sgDatos.ph.toFixed(1), nota:'No cambia por cosecha' },
      { label:'MO estimada', valor: mo_val + '%', nota: balance.N && balance.N.balanceNeto < -50 ? '⚠ en descenso' : 'estable' },
      { label:'N total suelo', valor: nTotal + ' kg/ha', nota: balance.N ? (balance.N.balanceNeto >= 0 ? 'repuesto' : 'déficit ' + Math.abs(balance.N.balanceNeto) + ' kg') : '—' },
    ];

    estadoItems.forEach(function(item) {
      html += '<div style="background:#fbf6ec;border-radius:10px;padding:.7rem;border:1px solid var(--border)">';
      html += '<div style="font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(74,46,26,.4);margin-bottom:.2rem">' + item.label + '</div>';
      html += '<div style="font-size:1.1rem;font-weight:600;color:var(--earth)">' + item.valor + '</div>';
      html += '<div style="font-size:.68rem;color:rgba(74,46,26,.4);margin-top:.15rem">' + item.nota + '</div>';
      html += '</div>';
    });
    html += '</div>';
  } else {
    html += '<div class="alert info"><span class="ai">💡</span><div class="ac">Cargá las coordenadas del lote en el módulo de Siembra y consultá SoilGrids para ver el estado actual del suelo integrado en este análisis.</div></div>';
  }

  html += '</div></div>';

  // ── NOTA METODOLÓGICA ──
  html += '<div style="margin-top:.8rem;font-size:.72rem;color:#6b5b45;padding:.6rem .9rem;background:#fbf8f1;border:1px solid rgba(74,46,26,.15);border-radius:8px;line-height:1.5">';
  html += '📊 Tablas de extracción: INTA Balcarce · Echeverría & García · FAO (2006) · ';
  html += 'Aporte natural N: ~20 kg/% MO/año (mineralización base pampa húmeda) · ';
  html += 'Eficiencia fertilizantes: N=65%, P=25%, K=40%, S=50% (promedios pampa) · ';
  html += 'No reemplaza el análisis de suelo post-cosecha — complementa la interpretación.';
  html += '</div>';

  container.innerHTML = html;
  container.classList.remove('hidden');
  var ph = document.getElementById('bn-placeholder');
  if (ph) ph.classList.add('hidden');
  container.scrollIntoView({behavior:'smooth', block:'nearest'});
}

  // Exposición a global
  window.bnAnalizar = bnAnalizar;

})();
