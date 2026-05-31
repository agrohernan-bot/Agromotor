// ════════════════════════════════════════════════════════
// AGROMOTOR — historial-campanas.js  v2.0
// Historial y comparador de campañas año a año
//
// v2.0: + rendimiento real editable por campaña
//       + precio/qq editable para cálculo de ingreso
//       + indicadores delta ↑↓ entre campañas
//       + panel comparador visual (barras CSS + KPIs)
//       + métricas de eficiencia: CO₂/qq, N/qq
//
// Storage: am_campanas_hist · JSON array · máx 10 entradas
// ════════════════════════════════════════════════════════

(function () {
'use strict';

var LS_KEY   = 'am_campanas_hist';
var MAX_CAMP = 10;

// ─────────────────────────────────────────────────────────────────────────────
// LECTURA DE ESTADO ACTUAL
// ─────────────────────────────────────────────────────────────────────────────

function _ls(k)  { try { return localStorage.getItem(k) || ''; } catch(_) { return ''; } }
function _lsN(k) { return parseFloat(_ls(k)) || 0; }
function _lsI(k) { return parseInt(_ls(k))   || 0; }
function _lsJ(k) { try { return JSON.parse(_ls(k) || 'null'); } catch(_) { return null; } }
function _gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }

function capturar() {
  var cultivo    = _ls('am_siembra_cultivo') || _gv('s-cultivo') || '';
  var fechaSiem  = _ls('am_siembra_fecha')   || _gv('s-fecha')   || '';
  var lote       = _ls('am_lote_nombre')     || 'Lote principal';
  var enso       = _ls('am_enso_fase')       || 'neutro';
  var etapa      = _ls('am_fen_etapa_hoy')   || '';
  var pctCiclo   = _lsN('am_fen_pct_ciclo');
  var diasEstres = _lsI('am_hidrico_dias_estres');
  var aguaMm     = _lsN('am_hidrico_agua_actual_mm');
  var capMax     = _lsN('am_hidrico_cap_max_mm');
  var aguaPct    = capMax > 0 ? Math.round(aguaMm / capMax * 100) : 0;
  var rendP50    = _lsN('am_rend_pred_p50');
  var co2PorTon  = _lsN('am_hc_ultimo_por_ton');
  var nKgHa      = _lsN('nc_n_kg');
  var alertas    = _lsJ('am_alertas_activas');
  var numAlertas = Array.isArray(alertas) ? alertas.length : 0;
  // Precio/qq desde módulo economía
  var precioQq   = _lsN('am_precio_quintal') ||
    parseFloat((_ls('am_ec_precio_disp') || '')) || 0;

  return {
    id:         Date.now(),
    lote:       lote,
    cultivo:    cultivo,
    fechaSiem:  fechaSiem,
    enso:       enso,
    etapa:      etapa,
    pctCiclo:   pctCiclo,
    diasEstres: diasEstres,
    aguaPct:    aguaPct,
    rendP50:    rendP50,
    rendReal:   0,      // se completa post-cosecha
    co2PorTon:  co2PorTon,
    nKgHa:      nKgHa,
    numAlertas: numAlertas,
    precioQq:   precioQq,
    ts:         Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────

function cargar() {
  try { return JSON.parse(_ls(LS_KEY) || '[]'); } catch(_) { return []; }
}
function persistir(arr) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch(_) {}
}

function guardarSnapshot() {
  var c    = capturar();
  var hist = cargar();
  hist = hist.filter(function(h) {
    return !(h.lote === c.lote && h.cultivo === c.cultivo && h.fechaSiem === c.fechaSiem);
  });
  hist.unshift(c);
  if (hist.length > MAX_CAMP) hist = hist.slice(0, MAX_CAMP);
  persistir(hist);
  return c;
}

function eliminar(id) {
  persistir(cargar().filter(function(c) { return c.id !== id; }));
}

function editarCampo(id, campo, valor) {
  var hist = cargar();
  hist = hist.map(function(h) {
    if (h.id === id) {
      h[campo] = parseFloat(valor) || 0;
    }
    return h;
  });
  persistir(hist);
  // Refrescar solo el comparador para no perder el foco del input
  renderComparador(document.getElementById('hc-comparador-panel'), cargar());
  renderDashCard();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE FORMATO Y CÁLCULO
// ─────────────────────────────────────────────────────────────────────────────

var ENSO_LABEL = { nina:'Niña ❄️', niña:'Niña ❄️', nino:'Niño 🌡️', niño:'Niño 🌡️', neutro:'Neutro ➖', neutral:'Neutro ➖' };
var ENSO_COLOR = { nina:'#7BAFD4', nino:'#D4522A', neutro:'rgba(237,224,196,.5)', neutral:'rgba(237,224,196,.5)' };

function _normEnso(e) {
  return (e || 'neutro').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
}
function fmtDate(s) {
  if (!s) return '—';
  var d = new Date(s + (s.length === 10 ? 'T12:00:00' : ''));
  return isNaN(d) ? s : d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
}
function fmtTs(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'});
}
function dash() { return '<span style="opacity:.3">—</span>'; }

// Delta entre valor actual y anterior: retorna badge HTML con ↑↓→
// lowerIsBetter: true para métricas donde menor = mejor (estrés, CO₂, N)
function deltaBadge(valActual, valPrev, lowerIsBetter) {
  if (!valActual || !valPrev) return '';
  var pct = Math.round((valActual - valPrev) / valPrev * 100);
  if (Math.abs(pct) < 2) return '';
  var mejor = lowerIsBetter ? pct < 0 : pct > 0;
  var color = mejor ? '#2A7A4A' : '#D4522A';
  var arrow = pct > 0 ? '↑' : '↓';
  return ' <span style="font-size:.62rem;font-weight:700;color:' + color + ';opacity:.85">'
    + arrow + Math.abs(pct) + '%</span>';
}

// Rendimiento efectivo: real si disponible, sino P50
function rendEfectivo(d) { return d.rendReal > 0 ? d.rendReal : d.rendP50; }

// ─────────────────────────────────────────────────────────────────────────────
// RENDER TABLA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

function render() {
  var el = document.getElementById('mod-hist-campanas');
  if (!el) return;

  var actual = capturar();
  var hist   = cargar();
  var cols   = [{ tipo:'actual', data:actual }].concat(
    hist.slice(0,4).map(function(h) { return {tipo:'guardada', data:h}; })
  );

  // ── Cabeceras ──
  var thActual = '<th style="padding:.65rem .9rem;font-size:.72rem;font-weight:700;color:#7FC99E;'
    + 'background:rgba(42,122,74,.1);border-bottom:2px solid rgba(42,122,74,.3);'
    + 'white-space:nowrap;text-align:left">▶ Campaña actual</th>';

  var thHist = hist.slice(0,4).map(function(h) {
    var lbl = (h.cultivo||'Lote') + ' · ' + fmtTs(h.ts);
    return '<th style="padding:.65rem .9rem;font-size:.72rem;font-weight:600;opacity:.6;'
      + 'border-bottom:1px solid rgba(237,224,196,.12);white-space:nowrap;text-align:left">'
      + lbl
      + '<button onclick="window.histCampEliminar('+h.id+')" title="Eliminar" '
      + 'style="margin-left:.4rem;background:none;border:none;cursor:pointer;'
      + 'opacity:.3;font-size:.65rem;color:inherit;padding:0">✕</button></th>';
  }).join('');

  // ── Celdas con delta vs columna anterior ──
  function rowCells(fn, lowerIsBetter, numFn) {
    return cols.map(function(col, i) {
      var bg  = i === 0 ? 'background:rgba(42,122,74,.05);' : '';
      var val = numFn ? numFn(col.data) : null;
      var prevVal = (i > 0 && numFn) ? numFn(cols[i-1].data) : null;
      var delta = (val && prevVal) ? deltaBadge(val, prevVal, lowerIsBetter) : '';
      return '<td style="'+bg+'padding:.55rem .9rem;font-size:.82rem;'
        + 'border-bottom:1px solid rgba(237,224,196,.07)">'
        + fn(col.data) + delta + '</td>';
    }).join('');
  }

  var FILAS = [
    { label:'Cultivo',
      cells: rowCells(function(d){return d.cultivo||dash();}) },
    { label:'Siembra',
      cells: rowCells(function(d){return fmtDate(d.fechaSiem);}) },
    { label:'Avance ciclo',
      cells: rowCells(function(d){
        if(!d.pctCiclo) return dash();
        var c=d.pctCiclo>=80?'#2A7A4A':d.pctCiclo>=40?'#C8A255':'#6b7280';
        var etq=d.etapa?' <span style="font-size:.68rem;opacity:.55">·&nbsp;'+d.etapa+'</span>':'';
        return '<span style="font-weight:700;color:'+c+'">'+d.pctCiclo+'%</span>'+etq;
      },false, function(d){return d.pctCiclo;}) },
    { label:'Rend. P50',
      cells: rowCells(function(d){
        if(!d.rendP50) return dash();
        return '<strong>'+d.rendP50+'</strong> <span style="opacity:.6;font-size:.75rem">qq/ha</span>';
      },true, function(d){return d.rendP50;}) },
    { label:'Rend. real',
      cells: cols.map(function(col,i){
        var bg = i===0 ? 'background:rgba(42,122,74,.05);':'';
        var d  = col.data;
        if(col.tipo==='actual'){
          return '<td style="'+bg+'padding:.55rem .9rem;font-size:.82rem;'
            +'border-bottom:1px solid rgba(237,224,196,.07)"><em style="opacity:.35;font-size:.75rem">se registra al cosechar</em></td>';
        }
        var prevRend = i>0 ? rendEfectivo(cols[i-1].data) : null;
        var curRend  = d.rendReal||0;
        var delta    = (curRend>0&&prevRend>0) ? deltaBadge(curRend,prevRend,false) : '';
        return '<td style="'+bg+'padding:.45rem .9rem;border-bottom:1px solid rgba(237,224,196,.07)">'
          +'<div style="display:flex;align-items:center;gap:.3rem">'
          +'<input type="number" min="0" step="0.5" placeholder="qq/ha" value="'+(d.rendReal||'')+'"'
          +' onchange="window.histCampEditar('+d.id+',%27rendReal%27,this.value)"'
          +' style="width:70px;font-size:.78rem;padding:.2rem .4rem;border:1px solid rgba(237,224,196,.2);'
          +'border-radius:5px;background:rgba(237,224,196,.06);color:inherit;font-family:inherit">'
          +(d.rendReal>0?'<span style="font-size:.68rem;opacity:.55">qq/ha</span>'+delta:'')
          +'</div></td>';
      }).join('') },
    { label:'Precio/qq',
      cells: cols.map(function(col,i){
        var bg = i===0?'background:rgba(42,122,74,.05);':'';
        var d  = col.data;
        if(col.tipo==='actual'){
          var pAct = d.precioQq||0;
          return '<td style="'+bg+'padding:.45rem .9rem;border-bottom:1px solid rgba(237,224,196,.07)">'
            +(pAct>0?'U$D '+pAct+' <span style="font-size:.68rem;opacity:.5">/qq</span>':dash())+'</td>';
        }
        return '<td style="'+bg+'padding:.45rem .9rem;border-bottom:1px solid rgba(237,224,196,.07)">'
          +'<div style="display:flex;align-items:center;gap:.3rem">'
          +'<input type="number" min="0" step="0.5" placeholder="U$D" value="'+(d.precioQq||'')+'"'
          +' onchange="window.histCampEditar('+d.id+',%27precioQq%27,this.value)"'
          +' style="width:65px;font-size:.78rem;padding:.2rem .4rem;border:1px solid rgba(237,224,196,.2);'
          +'border-radius:5px;background:rgba(237,224,196,.06);color:inherit;font-family:inherit">'
          +(d.precioQq>0?'<span style="font-size:.68rem;opacity:.55">/qq</span>':'')
          +'</div></td>';
      }).join('') },
    { label:'Ingreso bruto',
      cells: rowCells(function(d){
        var r=rendEfectivo(d), p=d.precioQq||0;
        if(!r||!p) return dash();
        return '<strong style="color:#2A7A4A">U$D '+Math.round(r*p).toLocaleString('es-AR')+'</strong>'
          +' <span style="opacity:.5;font-size:.75rem">/ha</span>';
      },false, function(d){var r=rendEfectivo(d),p=d.precioQq||0; return r&&p?r*p:0;}) },
    { label:'Días estrés híd.',
      cells: rowCells(function(d){
        if(!d.diasEstres) return '<span style="color:#2A7A4A;font-size:.78rem">✅ Sin estrés</span>';
        var c=d.diasEstres>=15?'#D4522A':d.diasEstres>=7?'#C8800A':'#C8A255';
        return '<span style="color:'+c+';font-weight:700">'+d.diasEstres+'d</span>';
      },true, function(d){return d.diasEstres||0;}) },
    { label:'Agua perfil',
      cells: rowCells(function(d){
        if(!d.aguaPct) return dash();
        var c=d.aguaPct>=60?'#2A7A4A':d.aguaPct>=35?'#C8800A':'#D4522A';
        return '<span style="color:'+c+';font-weight:600">'+d.aguaPct+'%</span>';
      },false,function(d){return d.aguaPct||0;}) },
    { label:'ENSO',
      cells: rowCells(function(d){
        var k=_normEnso(d.enso),c=ENSO_COLOR[k]||'rgba(237,224,196,.5)';
        return '<span style="color:'+c+'">'+(ENSO_LABEL[k]||d.enso||'—')+'</span>';
      }) },
    { label:'N aplicado',
      cells: rowCells(function(d){
        if(!d.nKgHa) return dash();
        return d.nKgHa+' <span style="opacity:.6;font-size:.75rem">kg N/ha</span>';
      },true,function(d){return d.nKgHa||0;}) },
    { label:'Huella CO₂',
      cells: rowCells(function(d){
        if(!d.co2PorTon) return dash();
        return d.co2PorTon+' <span style="opacity:.6;font-size:.75rem">kg CO₂-eq/t</span>';
      },true,function(d){return d.co2PorTon||0;}) },
    { label:'Alertas',
      cells: rowCells(function(d){
        if(!d.numAlertas) return '<span style="color:#2A7A4A;font-size:.78rem">✅ Sin alertas</span>';
        return '<span style="color:#D4522A;font-weight:700">🚨 '+d.numAlertas+'</span>';
      },true,function(d){return d.numAlertas||0;}) },
  ];

  var tablaHTML;
  if (hist.length === 0) {
    tablaHTML = '<div style="padding:2.5rem 1rem;text-align:center;opacity:.4;font-size:.88rem;line-height:1.6">'
      + 'Guardá la campaña actual para empezar a comparar.<br>'
      + '<span style="font-size:.78rem">El próximo año vas a ver esta campaña vs la nueva.</span></div>';
  } else {
    var filasTR = FILAS.map(function(f) {
      return '<tr><td style="padding:.5rem .9rem;font-size:.68rem;font-weight:700;opacity:.5;'
        +'white-space:nowrap;border-bottom:1px solid rgba(237,224,196,.07);'
        +'letter-spacing:.04em;text-transform:uppercase">'+f.label+'</td>'+f.cells+'</tr>';
    }).join('');
    tablaHTML = '<div style="overflow-x:auto;margin-top:.6rem">'
      +'<table style="width:100%;border-collapse:collapse;min-width:520px">'
      +'<thead><tr><th style="padding:.65rem .9rem;font-size:.68rem;text-align:left;'
      +'border-bottom:1px solid rgba(237,224,196,.12);opacity:.45">Métrica</th>'
      +thActual+thHist+'</tr></thead><tbody>'+filasTR+'</tbody></table></div>';
  }

  var badge = hist.length > 0
    ? '<span style="font-size:.73rem;opacity:.4;margin-left:.8rem">'
      +hist.length+' campaña'+(hist.length!==1?'s':'')+' guardada'+(hist.length!==1?'s':'')+'</span>'
    : '';

  el.innerHTML = ''
    +'<div style="padding:1.4rem 1.4rem 0">'
    +'<div class="module-title" style="margin-bottom:.25rem">'
    +'📊 <em>Historial de Campañas</em>'
    +'<span style="font-size:.68rem;background:rgba(42,90,140,.15);color:#7BAFD4;'
    +'border-radius:10px;padding:.15rem .55rem;margin-left:.6rem;font-weight:500">año a año</span>'
    +'</div>'
    +'<div class="module-subtitle" style="margin-bottom:1rem">'
    +'Guardá un snapshot y registrá el rendimiento real al cosechar. Los indicadores <span style="font-weight:600">↑↓</span> comparan cada campaña con la anterior.'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">'
    +'<button id="hc-btn-guardar" onclick="window.histCampGuardar()" '
    +'style="background:rgba(42,122,74,.18);color:#7FC99E;border:1px solid rgba(42,122,74,.3);'
    +'border-radius:8px;padding:.45rem 1.2rem;font-size:.82rem;cursor:pointer;'
    +'font-family:inherit;font-weight:600">💾 Guardar campaña actual</button>'
    +badge+'</div></div>'
    +'<div style="padding:.6rem 1.4rem .4rem">'+tablaHTML+'</div>'
    +'<div id="hc-comparador-panel" style="padding:0 1.4rem 1.6rem"></div>';

  renderComparador(document.getElementById('hc-comparador-panel'), hist);
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL COMPARADOR VISUAL
// ─────────────────────────────────────────────────────────────────────────────

function renderComparador(el, hist) {
  if (!el || hist.length === 0) return;

  // Máximo 5 campañas en el gráfico (más reciente primero)
  var items = hist.slice(0, 5).reverse(); // cronológico en el gráfico

  // Rendimiento efectivo (real si existe, sino P50)
  var maxRend = 0;
  items.forEach(function(h) {
    var r = rendEfectivo(h); if (r > maxRend) maxRend = r;
  });
  if (maxRend === 0) maxRend = 50; // fallback para escala

  // ── Gráfico de barras CSS ──
  var barras = items.map(function(h) {
    var r     = rendEfectivo(h);
    var isReal = h.rendReal > 0;
    var pct   = r > 0 ? Math.max(4, Math.round(r / maxRend * 100)) : 0;
    var color = isReal ? '#2A7A4A' : 'rgba(42,122,74,.45)';
    var lbl   = fmtTs(h.ts) || (h.cultivo||'?');
    var rLbl  = r > 0 ? r+' qq' : '—';
    return '<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:48px;gap:.3rem">'
      +'<div style="font-size:.68rem;font-weight:700;color:'+color+'">'+rLbl+'</div>'
      +'<div style="flex:1;width:100%;display:flex;align-items:flex-end">'
      +'<div style="width:100%;height:'+pct+'%;min-height:4px;background:'+color+';border-radius:4px 4px 0 0;'
      +'transition:height .4s"'+(isReal?' title="Rendimiento real"':' title="Predicción P50"')+'></div>'
      +'</div>'
      +'<div style="font-size:.63rem;opacity:.5;text-align:center;white-space:nowrap">'+lbl+'</div>'
      +(isReal?'<div style="font-size:.55rem;color:#2A7A4A;opacity:.7">real</div>'
              :'<div style="font-size:.55rem;opacity:.35">P50</div>')
      +'</div>';
  }).join('');

  // ── KPIs resumen ──
  var rends    = items.map(rendEfectivo).filter(Boolean);
  var estres   = items.map(function(h){return h.diasEstres||0;}).filter(function(v){return v>0;});
  var co2s     = items.map(function(h){return h.co2PorTon||0;}).filter(Boolean);
  var nEfics   = items.filter(function(h){return rendEfectivo(h)>0&&h.nKgHa>0;})
                     .map(function(h){return Math.round(h.nKgHa/rendEfectivo(h)*10)/10;});
  var co2Efics = items.filter(function(h){return rendEfectivo(h)>0&&h.co2PorTon>0;})
                     .map(function(h){return Math.round(h.co2PorTon/10)/10;}); // kg CO₂-eq/qq

  function avg(arr) { return arr.length ? Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length*10)/10 : null; }
  function minOf(arr) { return arr.length ? Math.min.apply(null,arr) : null; }
  function maxOf(arr) { return arr.length ? Math.max.apply(null,arr) : null; }

  var kpis = [];
  if (rends.length > 0) {
    kpis.push({ ico:'🌾', lbl:'Rend. media', val: avg(rends)+' qq/ha', sub:'últimas '+rends.length+' campañas' });
    kpis.push({ ico:'🏆', lbl:'Mejor campaña', val: maxOf(rends)+' qq/ha', sub:'máximo histórico' });
  }
  if (estres.length > 0)
    kpis.push({ ico:'💧', lbl:'Estrés medio', val: avg(estres)+'d', sub:'días en déficit hídrico' });
  if (nEfics.length > 0)
    kpis.push({ ico:'🧪', lbl:'Efic. N', val: avg(nEfics)+' kg N/qq', sub:'nitrógeno por quintal' });
  if (co2Efics.length > 0)
    kpis.push({ ico:'🌍', lbl:'Huella media', val: avg(co2s)+' kg/t', sub:'CO₂-eq por tonelada' });

  var kpiHTML = kpis.map(function(k) {
    return '<div style="background:rgba(237,224,196,.04);border:1px solid rgba(237,224,196,.1);'
      +'border-radius:10px;padding:.7rem .9rem;text-align:center;min-width:110px">'
      +'<div style="font-size:1.1rem">'+k.ico+'</div>'
      +'<div style="font-size:.88rem;font-weight:700;margin:.15rem 0">'+k.val+'</div>'
      +'<div style="font-size:.65rem;font-weight:600;opacity:.55;text-transform:uppercase;letter-spacing:.04em">'+k.lbl+'</div>'
      +'<div style="font-size:.6rem;opacity:.35;margin-top:.1rem">'+k.sub+'</div>'
      +'</div>';
  }).join('');

  el.innerHTML = hist.length < 2 ? '' :
    '<div style="border-top:1px solid rgba(237,224,196,.1);padding-top:1.2rem;margin-top:.2rem">'
    +'<div style="font-size:.7rem;font-weight:700;opacity:.45;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.8rem">'
    +'📈 Evolución de rendimiento</div>'
    +'<div style="display:flex;gap:.5rem;align-items:flex-end;height:110px;'
    +'padding-bottom:.2rem;border-bottom:1px solid rgba(237,224,196,.12)">'+barras+'</div>'
    +'<div style="font-size:.6rem;opacity:.3;margin-top:.3rem;margin-bottom:1rem">'
    +'Verde sólido = rendimiento real · verde claro = predicción P50 · editá el campo "Rend. real" en la tabla</div>'
    +(kpis.length > 0
      ? '<div style="font-size:.7rem;font-weight:700;opacity:.45;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.6rem">'
        +'📊 Resumen histórico</div>'
        +'<div style="display:flex;flex-wrap:wrap;gap:.5rem">'+kpiHTML+'</div>'
      : '')
    +'</div>';
}

// ─────────────────────────────────────────────────────────────────────────────
// MINI-CARD EN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

function renderDashCard() {
  var el = document.getElementById('dash-hist-campanas-card');
  if (!el) return;
  var hist = cargar();
  var n    = hist.length;
  var txt  = n === 0
    ? 'Sin campañas guardadas aún'
    : n+' campaña'+(n!==1?'s':'')+' · última: '+fmtTs((hist[0]||{}).ts);
  el.innerHTML = '<div style="font-size:.72rem;opacity:.55;margin-top:.2rem">'+txt+'</div>';
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

window.histCampGuardar = function() {
  guardarSnapshot();
  render();
  renderDashCard();
  var btn = document.getElementById('hc-btn-guardar');
  if (btn) {
    var orig = btn.innerHTML;
    btn.innerHTML = '✅ Guardado';
    btn.disabled = true;
    setTimeout(function() { btn.innerHTML = orig; btn.disabled = false; }, 1800);
  }
};

window.histCampEliminar = function(id) {
  eliminar(id);
  render();
  renderDashCard();
};

window.histCampEditar = function(id, campo, valor) {
  editarCampo(id, campo, valor);
};

window.histCampanasRender = function() {
  render();
  renderDashCard();
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(renderDashCard, 600);
});

})(); // fin historial-campanas.js  v2.0
