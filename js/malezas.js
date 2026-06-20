// ════════════════════════════════════════════════════════
// AGROMOTOR — malezas.js  v1.0
// Módulo Malezas — identificación, ventanas de control, resistencias
//
// Funciones principales (automáticas, zero inputs):
//   1. Lista de malezas prioritarias según cultivo + época
//   2. Ventana óptima de control (estado fenológico del cultivo)
//   3. Alertas de resistencia por ingrediente activo
//   4. Guía de rotación de modos de acción (HRAC)
//
// El ingeniero puede filtrar por cultivo y añadir observaciones en campo.
// La detección de malezas "presentes" se registra en la Bitácora.
// ════════════════════════════════════════════════════════

(function () {
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// BASE DE MALEZAS PRIORITARIAS (Argentina pampeana)
// ─────────────────────────────────────────────────────────────────────────────

var MALEZAS = [
  // ── Gramíneas ──
  { id:'ryegrass',    nombre:'Raigrás anual',    lat:'Lolium multiflorum',
    cultivos:['trigo','cebada','girasol'],
    momento:'Pre-emergencia o hasta 2 hojas verdaderas',
    hrac:['A','K3','N'],
    resistencias:['A (ACCasa): muy frecuente','B (ALS): en avance'],
    peligrosidad:3, tipo:'graminea',
    tip:'Controlar antes de 2 hojas. Rotar con grupos K3 o N si hay resistencia A.' },

  { id:'avena_fatua', nombre:'Avena fatua',       lat:'Avena fatua',
    cultivos:['trigo','cebada'],
    momento:'1-4 hojas verdaderas del malezón',
    hrac:['A','K3'],
    resistencias:['A (ACCasa): frecuente en zona sur'],
    peligrosidad:3, tipo:'graminea',
    tip:'Muestrear temprano. Cebada: máximo tolerado 2-3 plantas/m².' },

  { id:'sorgo_alepo', nombre:'Sorgo de Alepo',    lat:'Sorghum halepense',
    cultivos:['soja','maiz','girasol','sorgo'],
    momento:'Hasta 4-6 hojas (precoz = menor rebrote de rizomas)',
    hrac:['A','N','Z'],
    resistencias:['A (ACCasa): confirmada en varias provincias'],
    peligrosidad:3, tipo:'graminea',
    tip:'Evitar tardía: los rizomas ya están formados. Dos aplicaciones si hay rebrote fuerte.' },

  { id:'capim_mongol', nombre:'Capim mongol / Capín', lat:'Echinochloa crus-galli',
    cultivos:['soja','girasol','maiz'],
    momento:'1-3 hojas, antes de macollaje',
    hrac:['A','K3'],
    resistencias:['A (ACCasa): reportes puntuales'],
    peligrosidad:2, tipo:'graminea',
    tip:'Controlar temprano. Alta competencia si supera 2-3 hojas.' },

  { id:'grama_rhodes',  nombre:'Pata de ganso (Eleusine)',  lat:'Eleusine indica',
    cultivos:['soja','girasol'],
    momento:'1-3 hojas verdaderas',
    hrac:['A'],
    resistencias:['A (ACCasa): frecuente'],
    peligrosidad:2, tipo:'graminea',
    tip:'Rotar entre grupos A distintos (fops vs dims) y K3.' },

  // ── Latifoliadas ──
  { id:'amaranto',    nombre:'Yuyo colorado / Amaranto',  lat:'Amaranthus hybridus / quitensis',
    cultivos:['soja','maiz','girasol'],
    momento:'Hasta 10 cm de altura (≤ 4 hojas verdaderas)',
    hrac:['C1','E','O'],
    resistencias:['E (PPO): confirmada en soja RR · C1 (PSII): en avance'],
    peligrosidad:3, tipo:'latifoliada',
    tip:'Principal maleza resistente en soja. Usar mezclas con modos de acción distintos. Monitoreo post-aplicación crítico.' },

  { id:'senecio',     nombre:'Senecio',           lat:'Senecio madagascariensis / pampeanus',
    cultivos:['trigo','cebada','soja'],
    momento:'Planta activa menor a 5 cm, antes de elongación',
    hrac:['B','O'],
    resistencias:['B (ALS): muy frecuente en zona bonaerense'],
    peligrosidad:3, tipo:'latifoliada',
    tip:'Clave en invernales. B resistente = usar reguladores de crecimiento (O) o mezclas con D/C1.' },

  { id:'rama_negra',  nombre:'Rama negra',        lat:'Conyza bonariensis / sumatrensis',
    cultivos:['soja','maiz','trigo'],
    momento:'Roseta ≤ 10 cm, preferentemente en barbecho',
    hrac:['D','O','E'],
    resistencias:['Glifosato (G) muy frecuente · D: casos puntuales'],
    peligrosidad:3, tipo:'latifoliada',
    tip:'Control en barbecho con mezcla paraquat + D o 2,4-D+picloram. Evitar estados avanzados (bolting).' },

  { id:'nabo',        nombre:'Nabo / Mostacilla',  lat:'Raphanus sativus / Sinapis arvensis',
    cultivos:['trigo','cebada','girasol'],
    momento:'Hasta 4 hojas (antes de botón floral)',
    hrac:['B','C1','O'],
    resistencias:['B (ALS): moderada'],
    peligrosidad:2, tipo:'latifoliada',
    tip:'Muy agresivo en invernales. Usar mezcla B+O o B+C1 para ampliar espectro.' },

  { id:'cleome',      nombre:'Cleome / Poroto del diablo', lat:'Cleome tucumanensis',
    cultivos:['soja','maiz'],
    momento:'Hasta 10 cm de altura',
    hrac:['E','C1'],
    resistencias:['En estudio'],
    peligrosidad:2, tipo:'latifoliada',
    tip:'Emergencia escalonada → difícil control en una sola pasada. Considerar aplicación anticipada.' },

  { id:'chinchilla',  nombre:'Sunchillo / Verbena',lat:'Verbena bonariensis',
    cultivos:['soja','girasol','maiz'],
    momento:'Plántula ≤ 5 cm',
    hrac:['D','O'],
    resistencias:['Tolerancia moderada a B'],
    peligrosidad:1, tipo:'latifoliada',
    tip:'Control con mezcla 2,4-D amine + cloropicrina o paraquat en barbecho.' },

  { id:'correhuela',  nombre:'Correhuela',          lat:'Convolvulus arvensis',
    cultivos:['soja','girasol','maiz'],
    momento:'Brotes ≤ 15 cm, rebrote primaveral',
    hrac:['O'],
    resistencias:['Tolerante a glifosato'],
    peligrosidad:2, tipo:'latifoliada',
    tip:'Difícil control. Mezcla 2,4-D + MCPA en estados tempranos. Repetir ante rebrote.' },
];

// Grupos HRAC con colores
var HRAC_LABELS = {
  'A':  { label:'A · ACCasa',      color:'#D4522A', desc:'Fops, dims: inhiben síntesis de lípidos' },
  'B':  { label:'B · ALS',         color:'#B87A20', desc:'Imidazolinonas, sulfonilureas: inhiben ALS' },
  'C1': { label:'C1 · PSII',       color:'#2A5A8C', desc:'Triacinas, triacinas asim.' },
  'D':  { label:'D · PSI',         color:'#6B5B95', desc:'Paraquat, diquat: generan radicales libres' },
  'E':  { label:'E · PPO',         color:'#C94A2A', desc:'Inhibidores de protoporfirina IX' },
  'G':  { label:'G · EPSP',        color:'#8A4A18', desc:'Glifosato: inhibe síntesis aminoácidos' },
  'K3': { label:'K3 · Mitosis',    color:'#3A7A4A', desc:'Dinitroanilinas: inhiben tubulina' },
  'N':  { label:'N · Elongasa',    color:'#2A7A5A', desc:'Cloroacetamidas: inhibición de elongasa' },
  'O':  { label:'O · Auxinas',     color:'#C8800A', desc:'2,4-D, MCPA, dicamba: reguladores crecimiento' },
  'Z':  { label:'Z · Multi',       color:'#6b7280', desc:'Multisitio / mecanismo incierto' },
};

// ─────────────────────────────────────────────────────────────────────────────
// LÓGICA
// ─────────────────────────────────────────────────────────────────────────────

function _ls(k) { try { return localStorage.getItem(k) || ''; } catch(_) { return ''; } }

function _loteActivo() {
  try {
    return (typeof window.amGetLoteActivo === 'function') ? window.amGetLoteActivo() : null;
  } catch(_) {
    return null;
  }
}

function _loteVal(data, keys) {
  data = data || {};
  for (var i = 0; i < keys.length; i++) {
    var v = data[keys[i]];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

function _fechaPlanificada(data) {
  var plan = data && data.planificacionSiembra;
  if (!plan || typeof plan !== 'object') return '';
  for (var k in plan) {
    if (!Object.prototype.hasOwnProperty.call(plan, k)) continue;
    var v = plan[k];
    if (typeof v === 'string' && v) return v;
    if (v && typeof v === 'object') {
      if (v.fechaSiembraConf) return v.fechaSiembraConf;
      if (v.fechaSiembra) return v.fechaSiembra;
      if (v.fecha) return v.fecha;
    }
  }
  return '';
}

function _normCultivo(c) {
  var s = (c || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (s.includes('maiz') || s.includes('maíz')) return 'maiz';
  if (s.includes('trigo'))   return 'trigo';
  if (s.includes('cebada'))  return 'cebada';
  if (s.includes('girasol')) return 'girasol';
  if (s.includes('sorgo'))   return 'sorgo';
  if (s.includes('soja'))    return 'soja';
  return null;
}

function malezasParaCultivo(cultKey) {
  if (!cultKey) return MALEZAS;
  return MALEZAS.filter(function(m) {
    return !cultKey || m.cultivos.indexOf(cultKey) !== -1;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

var _cultFiltro = null;
var _tipoFiltro = null;
var _termBusqueda = '';

function renderModulo() {
  var el = document.getElementById('mod-malezas');
  if (!el) return;

  var lote      = _loteActivo();
  var data      = (lote && lote.data) || {};
  var cultivo   = _loteVal(data, ['cultivo','cultivoActual']) || _ls('am_siembra_cultivo') || (document.getElementById('s-cultivo') ? document.getElementById('s-cultivo').value : '');
  var cultKey   = _normCultivo(cultivo);
  var etapa     = _loteVal(data, ['fenologiaEtapa','etapaFenologica','etapaActual']) || _ls('am_fen_etapa_hoy') || '';
  var diasSiem  = null;
  var fechaSiem = _loteVal(data, ['fechaSiembraReal','fechaSiembra']) || _fechaPlanificada(data) || _ls('am_siembra_fecha');
  if (fechaSiem) {
    var d = new Date(fechaSiem + 'T12:00:00');
    var h = new Date(); h.setHours(12,0,0,0);
    diasSiem = Math.round((h - d) / 86400000);
  }

  el.innerHTML = '<div class="mz-wrap">' +
    _htmlHeader(cultivo, etapa, diasSiem, lote && lote.nombre) +
    _htmlFiltros(cultKey) +
    _htmlVentana(cultKey, diasSiem) +
    '<div id="mz-lista">' + _htmlLista(cultKey) + '</div>' +
    _htmlRotacion() +
    '</div>';

  _initFiltros();
}

function _htmlHeader(cultivo, etapa, diasSiem, loteActivoNombre) {
  var loteNombre = loteActivoNombre || _ls('am_lote_nombre') || 'Lote Principal';
  return '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">' +
    '<div>' +
      '<div class="module-title" style="margin-bottom:.15rem">🌿 Malezas</div>' +
      '<div class="module-subtitle">Identificación · Ventanas de control · Resistencias HRAC</div>' +
    '</div>' +
    '<div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center">' +
      (cultivo ? '<span style="font-size:.72rem;background:rgba(42,122,74,.1);color:#2A7A4A;border:1px solid rgba(42,122,74,.25);padding:2px 8px;border-radius:5px;font-weight:700">🌾 ' + _esc(cultivo) + '</span>' : '') +
      (etapa   ? '<span style="font-size:.72rem;background:#f1f5f9;color:#374151;border:1px solid #e2e8f0;padding:2px 8px;border-radius:5px">🌱 ' + _esc(etapa) + '</span>' : '') +
      (diasSiem !== null ? '<span style="font-size:.72rem;color:#6b7280">Día ' + diasSiem + '</span>' : '') +
      '<span id="mod-lote-badge-malezas" style="font-size:.68rem;color:#6b7280">📂 ' + _esc(loteNombre) + '</span>' +
    '</div>' +
  '</div>';
}

function _htmlFiltros(cultKey) {
  var cultOpts = [
    {v:'',label:'Todos los cultivos'},
    {v:'soja',label:'🟡 Soja'},
    {v:'maiz',label:'🌽 Maíz'},
    {v:'trigo',label:'🌾 Trigo'},
    {v:'cebada',label:'🟤 Cebada'},
    {v:'girasol',label:'🌻 Girasol'},
    {v:'sorgo',label:'🔴 Sorgo'},
  ].map(function(o) {
    return '<option value="' + o.v + '"' + (cultKey === o.v ? ' selected' : '') + '>' + o.label + '</option>';
  }).join('');

  return '<div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem;align-items:center">' +
    '<select id="mz-fil-cultivo" style="border:1.5px solid #d1d5db;border-radius:8px;padding:.4rem .7rem;font-size:.8rem;cursor:pointer;background:#fff;font-family:inherit">' + cultOpts + '</select>' +
    '<button id="mz-fil-todas" onclick="mzFiltrar(\'todas\')" class="mz-tipo-btn mz-active" style="border:1.5px solid #d1d5db;background:#fff;border-radius:8px;padding:.4rem .8rem;font-size:.78rem;cursor:pointer;font-family:inherit">Todas</button>' +
    '<button id="mz-fil-gram"  onclick="mzFiltrar(\'graminea\')" class="mz-tipo-btn" style="border:1.5px solid #d1d5db;background:#fff;border-radius:8px;padding:.4rem .8rem;font-size:.78rem;cursor:pointer;font-family:inherit">🌾 Gramíneas</button>' +
    '<button id="mz-fil-lati"  onclick="mzFiltrar(\'latifoliada\')" class="mz-tipo-btn" style="border:1.5px solid #d1d5db;background:#fff;border-radius:8px;padding:.4rem .8rem;font-size:.78rem;cursor:pointer;font-family:inherit">🌿 Latifoliadas</button>' +
    '<input id="mz-buscar" type="text" placeholder="🔍 Buscar maleza..." oninput="mzBuscar(this.value)" style="border:1.5px solid #d1d5db;border-radius:8px;padding:.4rem .8rem;font-size:.78rem;font-family:inherit;min-width:160px">' +
  '</div>';
}

function _htmlVentana(cultKey, diasSiem) {
  if (!cultKey || diasSiem === null) return '';

  var VENTANAS_CTRL = {
    soja:    { pre:{hasta:5,label:'Pre-emergencia hasta V1 (5-7 días post-siembra)'}, post:{desde:7,hasta:35,label:'Post-emergencia V1-V3'} },
    maiz:    { pre:{hasta:5,label:'Pre-emergencia (siembra a VE)'}, post:{desde:12,hasta:45,label:'Post-emergencia V2-V6'} },
    trigo:   { pre:{hasta:10,label:'Pre-siembra a pre-emergencia'}, post:{desde:15,hasta:60,label:'Macollaje Z21-Z31'} },
    cebada:  { pre:{hasta:10,label:'Pre-siembra a pre-emergencia'}, post:{desde:15,hasta:55,label:'Macollaje Z21-Z31'} },
    girasol: { pre:{hasta:5,label:'Pre-emergencia (0-5 días)'}, post:{desde:10,hasta:40,label:'Post-emergencia V2-V4 ≤ 25cm'} },
    sorgo:   { pre:{hasta:5,label:'Pre-emergencia'}, post:{desde:12,hasta:40,label:'Post-emergencia V2-V5'} },
  };

  var vv = VENTANAS_CTRL[cultKey];
  if (!vv) return '';

  var inPre   = diasSiem <= vv.pre.hasta;
  var inPost  = diasSiem >= vv.post.desde && diasSiem <= vv.post.hasta;
  var yaLate  = diasSiem > vv.post.hasta;

  var estado, estColor, estBg, estIco, estMsg;
  if (inPre) {
    estado = 'VENTANA PRE-EMERGENCIA ACTIVA'; estColor = '#2A7A4A'; estBg = 'rgba(42,122,74,.07)'; estIco = '🟢';
    estMsg = vv.pre.label + '. Aplicar herbicidas pre-emergentes o de corta acción residual.';
  } else if (inPost) {
    estado = 'VENTANA POST-EMERGENCIA ACTIVA'; estColor = '#2A5A8C'; estBg = 'rgba(42,90,140,.07)'; estIco = '🟢';
    estMsg = vv.post.label + '. Controlar con herbicidas selectivos post-emergentes.';
  } else if (yaLate) {
    estado = 'VENTANAS ÓPTIMAS PASADAS'; estColor = '#C8A255'; estBg = 'rgba(200,160,85,.07)'; estIco = '⚠️';
    estMsg = 'El cultivo ya cerró el canopeo. Evaluar si el nivel de infestación justifica control.';
  } else {
    var diasFalta = vv.post.desde - diasSiem;
    estado = 'Próxima ventana post-emergencia en ~' + diasFalta + ' días'; estColor = '#C8A255'; estBg = 'rgba(200,160,85,.07)'; estIco = '⏳';
    estMsg = vv.post.label;
  }

  return '<div style="background:' + estBg + ';border:1.5px solid ' + estColor + '33;border-radius:10px;padding:.75rem 1rem;margin-bottom:1rem">' +
    '<div style="font-size:.68rem;font-weight:700;color:' + estColor + ';text-transform:uppercase;letter-spacing:.06em;margin-bottom:.3rem">' + estIco + ' ' + estado + ' · Día ' + diasSiem + '</div>' +
    '<div style="font-size:.78rem;color:#374151">' + _esc(estMsg) + '</div>' +
  '</div>';
}

function _htmlLista(cultKey) {
  var lista = malezasParaCultivo(cultKey || _cultFiltro || null);

  if (_tipoFiltro && _tipoFiltro !== 'todas') {
    lista = lista.filter(function(m) { return m.tipo === _tipoFiltro; });
  }
  if (_termBusqueda) {
    var t = _termBusqueda.toLowerCase();
    lista = lista.filter(function(m) {
      return m.nombre.toLowerCase().includes(t) || (m.lat || '').toLowerCase().includes(t);
    });
  }

  if (lista.length === 0) {
    return '<div style="text-align:center;padding:2rem;color:#9ca3af;font-size:.85rem">Sin malezas para los filtros seleccionados.</div>';
  }

  // Agrupar por tipo
  var gram  = lista.filter(function(m) { return m.tipo === 'graminea'; });
  var lati  = lista.filter(function(m) { return m.tipo === 'latifoliada'; });

  var html = '';
  if (gram.length)  html += _sectionHTML('🌾 Gramíneas', gram);
  if (lati.length)  html += _sectionHTML('🌿 Latifoliadas', lati);
  return html;
}

function _sectionHTML(titulo, lista) {
  var html = '<div style="font-size:.68rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.08em;padding:.3rem 0;border-bottom:1px solid #e5e7eb;margin-bottom:.5rem;margin-top:.75rem">' + titulo + '</div>';
  html += '<div style="display:flex;flex-direction:column;gap:.5rem">';
  lista.forEach(function(m) {
    var pColores = ['','#C8A255','#E8860A','#D4522A'];
    var pColor   = pColores[m.peligrosidad] || '#D4522A';
    var pLabel   = ['','Baja','Media','Alta'][m.peligrosidad] || 'Alta';
    var pEstrella = '★'.repeat(m.peligrosidad) + '☆'.repeat(3 - m.peligrosidad);

    var hracBadges = m.hrac.map(function(h) {
      var hInfo = HRAC_LABELS[h] || { label: h, color: '#6b7280' };
      return '<span style="font-size:.58rem;background:' + hInfo.color + '18;color:' + hInfo.color + ';border:1px solid ' + hInfo.color + '44;padding:1px 5px;border-radius:3px;font-weight:700" title="' + _esc(hInfo.desc || '') + '">' + h + '</span>';
    }).join(' ');

    var resBadges = m.resistencias.map(function(r) {
      return '<span style="font-size:.62rem;color:#D4522A;background:#fef2f2;border:1px solid #fca5a566;padding:1px 5px;border-radius:3px">⚠️ ' + _esc(r) + '</span>';
    }).join(' ');

    html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:.7rem .9rem">' +
      '<div style="display:flex;align-items:flex-start;gap:.5rem;margin-bottom:.35rem">' +
        '<div style="flex:1">' +
          '<div style="font-weight:700;font-size:.84rem;color:#1f2937">' + _esc(m.nombre) + '</div>' +
          '<div style="font-size:.66rem;color:#9ca3af;font-style:italic">' + _esc(m.lat) + '</div>' +
        '</div>' +
        '<span style="font-size:.65rem;color:' + pColor + ';font-weight:700;white-space:nowrap">' + pEstrella + ' ' + pLabel + '</span>' +
      '</div>' +
      '<div style="font-size:.7rem;color:#374151;margin-bottom:.35rem">⏰ <b>Controlar:</b> ' + _esc(m.momento) + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-bottom:.35rem">' + hracBadges + '</div>' +
      (m.resistencias.length ? '<div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.3rem">' + resBadges + '</div>' : '') +
      '<div style="font-size:.69rem;color:#4b5563;background:#f9fafb;border-radius:5px;padding:.3rem .5rem;border-left:3px solid #3A7A4A">💡 ' + _esc(m.tip) + '</div>' +
    '</div>';
  });
  html += '</div>';
  return html;
}

function _htmlRotacion() {
  var grupos = Object.keys(HRAC_LABELS).slice(0, 8);
  var html = '<div class="card" style="margin-top:1.2rem;border:1.5px solid rgba(42,90,140,.2);background:#f8fafb">' +
    '<div class="card-title" style="color:#2A5A8C;margin-bottom:.6rem">🔄 Guía de rotación de modos de acción HRAC</div>' +
    '<div style="font-size:.72rem;color:#6b7280;margin-bottom:.65rem">Rotar entre grupos distintos para retrasar la aparición de resistencias.</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:.35rem">';

  grupos.forEach(function(h) {
    var info = HRAC_LABELS[h];
    html += '<div style="background:' + info.color + '12;border:1px solid ' + info.color + '44;border-radius:7px;padding:.4rem .65rem">' +
      '<div style="font-size:.68rem;font-weight:800;color:' + info.color + '">' + info.label + '</div>' +
      '<div style="font-size:.62rem;color:#6b7280;margin-top:.1rem">' + _esc(info.desc) + '</div>' +
    '</div>';
  });

  html += '</div>' +
    '<div style="font-size:.62rem;color:#9ca3af;margin-top:.55rem;border-top:1px solid #e5e7eb;padding-top:.4rem">' +
      '📚 Clasificación HRAC (Herbicide Resistance Action Committee). Para resistencia confirmada, combiná grupos con distinto sitio de acción.' +
    '</div>' +
  '</div>';
  return html;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTROS INTERACTIVOS
// ─────────────────────────────────────────────────────────────────────────────

function _initFiltros() {
  var selCult = document.getElementById('mz-fil-cultivo');
  if (selCult) {
    selCult.onchange = function() {
      _cultFiltro = selCult.value || null;
      document.getElementById('mz-lista').innerHTML = _htmlLista(_cultFiltro);
    };
  }
}

window.mzFiltrar = function(tipo) {
  _tipoFiltro = tipo === 'todas' ? null : tipo;
  document.querySelectorAll('.mz-tipo-btn').forEach(function(b) { b.classList.remove('mz-active'); b.style.background = '#fff'; b.style.color = '#374151'; });
  var btn = document.getElementById('mz-fil-' + (tipo === 'graminea' ? 'gram' : tipo === 'latifoliada' ? 'lati' : 'todas'));
  if (btn) { btn.classList.add('mz-active'); btn.style.background = '#3A7A4A'; btn.style.color = '#fff'; }
  var sel = document.getElementById('mz-fil-cultivo');
  _cultFiltro = sel ? sel.value || null : _cultFiltro;
  document.getElementById('mz-lista').innerHTML = _htmlLista(_cultFiltro);
};

window.mzBuscar = function(term) {
  _termBusqueda = term || '';
  var sel = document.getElementById('mz-fil-cultivo');
  _cultFiltro = sel ? sel.value || null : _cultFiltro;
  document.getElementById('mz-lista').innerHTML = _htmlLista(_cultFiltro);
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

window.malezasRender = renderModulo;

document.addEventListener('am:malezas-activado', renderModulo);

})(); // fin malezas.js
