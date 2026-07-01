// AgroMotor - Monitoreo NDVI real y trazable.
// Extiende mapa.js (mapa base y distribuidores) sin generar valores sinteticos.
(function () {
  'use strict';

  var baseInit = window.mapaSatelitalInit;
  var ndviOverlay = null;
  var chart = null;
  var lastResult = null;
  var productActive = 'ndvi';

  function internals() { return window.satMapaInterno || {}; }
  function getLote() {
    if (typeof window.amGetLoteActivo === 'function') return window.amGetLoteActivo();
    return typeof internals().getLote === 'function' ? internals().getLote() : null;
  }
  function getPolygon(lote) {
    return typeof internals().getPolygon === 'function' ? internals().getPolygon(lote) : null;
  }
  function getGeoJSON(lote) {
    return typeof internals().getGeoJSON === 'function' ? internals().getGeoJSON(lote) : null;
  }
  function getMap() {
    return typeof internals().getMap === 'function' ? internals().getMap() : null;
  }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function fmt(value, digits) {
    var n = num(value);
    return n == null ? '—' : n.toFixed(digits == null ? 1 : digits);
  }
  function shortDate(value) {
    if (!value) return '—';
    var raw = String(value);
    var date = new Date(raw.length === 10 ? raw + 'T12:00:00' : raw);
    return isNaN(date.getTime()) ? raw : date.toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' });
  }
  function daysOld(value) {
    var date = new Date(value);
    return isNaN(date.getTime()) ? null : Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  }
  function groupFor(lote) {
    var data = (lote && lote.data) || {};
    if (typeof window.amGrupoPorCultivo === 'function') {
      var central = window.amGrupoPorCultivo(data.cultivo || data.cultivoActivo || '');
      if (central) return central;
    }
    var phases = data.faseGrupos || {};
    var active = ['verano','invierno'].filter(function (group) {
      var raw = phases[group];
      return String((raw && raw.fase) || raw || '') === 'en-curso';
    });
    return active.length === 1 ? active[0] : 'verano';
  }
  function agronomicContext(lote) {
    var data = (lote && lote.data) || {};
    var group = groupFor(lote);
    var planted = (data.siembraRealizada || {})[group] || {};
    var plan = (data.planificacionSiembra || {})[group] || {};
    var phaseRaw = (data.faseGrupos || {})[group];
    var phase = String((phaseRaw && phaseRaw.fase) || phaseRaw || '');
    var date = typeof window.amGetFechaSiembraGrupo === 'function'
      ? window.amGetFechaSiembraGrupo(lote, group)
      : (planted.fecha || plan.fechaSiembraConf || plan.fechaSiembraPlan || data.fechaSiembra || '');
    var crop = planted.cultivo || data.cultivo || data.cultivoActivo || plan.cultivo || '';
    var explicit = String(data.estadoCobertura || '').toLowerCase();
    var state = explicit || ((phase === 'en-curso' || planted.fecha) ? 'cultivo' : phase === 'pre-siembra' ? 'barbecho' : 'sin-definir');
    return { group:group, phase:phase, date:date, crop:crop, state:state };
  }

  function renderAgronomicContext(lote) {
    var element = document.getElementById('mapa-sat-contexto-agro');
    if (!element || !lote) return;
    var context = agronomicContext(lote);
    var label = context.state === 'cultivo' ? 'Cultivo implantado'
      : context.state === 'barbecho' ? 'Barbecho'
      : context.state === 'cobertura' ? 'Cultivo de cobertura'
      : 'Estado sin definir';
    var detail = context.state === 'cultivo'
      ? ((context.crop || 'Cultivo sin identificar') + (context.date ? ' · sembrado ' + shortDate(context.date) : ' · falta fecha de siembra'))
      : context.state === 'barbecho'
        ? 'El NDVI se interpreta como vegetación espontánea o cobertura viva.'
        : context.state === 'cobertura'
          ? 'El NDVI se interpreta como actividad de la cobertura vegetal.'
          : 'Definir el estado mejora la interpretación; nunca modifica el NDVI observado.';
    var needsPlantingData = context.state === 'cultivo' && (!context.crop || !context.date);
    element.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:.7rem;flex-wrap:wrap">' +
        '<div><div style="font-weight:900;color:#1E4D2B;font-size:.8rem">' + esc(label) + '</div>' +
        '<div style="font-size:.7rem;color:rgba(28,18,8,.62);margin-top:.15rem">' + esc(detail) + '</div></div>' +
        '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' +
          '<select onchange="satGuardarEstadoCobertura(this.value)" aria-label="Estado de cobertura del lote" style="border:1px solid rgba(74,46,26,.18);border-radius:8px;padding:.4rem .5rem;background:#fff;color:#4A2E1A;font-size:.72rem">' +
            '<option value="sin-definir"' + (context.state === 'sin-definir' ? ' selected' : '') + '>Sin definir</option>' +
            '<option value="cultivo"' + (context.state === 'cultivo' ? ' selected' : '') + '>Cultivo implantado</option>' +
            '<option value="barbecho"' + (context.state === 'barbecho' ? ' selected' : '') + '>Barbecho</option>' +
            '<option value="cobertura"' + (context.state === 'cobertura' ? ' selected' : '') + '>Cultivo de cobertura</option>' +
          '</select>' +
          (needsPlantingData ? '<button type="button" onclick="satAbrirCargaContexto()" class="sat-mini-action">Completar siembra</button>' : '') +
        '</div>' +
      '</div>';
  }

  function saveCoverState(state) {
    var lote = getLote();
    if (!lote) return;
    lote.data = lote.data || {};
    if (state === 'sin-definir') delete lote.data.estadoCobertura;
    else lote.data.estadoCobertura = state;
    if (typeof window.amGuardarLotesEstado === 'function') window.amGuardarLotesEstado();
    renderAgronomicContext(lote);
    if (lastResult) renderAnalysis(lastResult);
  }

  function openPlanting() {
    var lote = getLote();
    if (!lote) return;
    var group = groupFor(lote);
    window.AM_SIEMBRA_GRUPO = group;
    if (typeof window.dlAbrirModulo === 'function') window.dlAbrirModulo('siembra', lote.id);
    else if (typeof window.dlRegistrarSiembra === 'function') window.dlRegistrarSiembra(lote.id, group);
    else if (typeof window.switchMod === 'function') window.switchMod('siembra');
  }

  function openLotEditor() {
    var lote = getLote();
    if (!lote) return;
    if (typeof window.dlEditarLote === 'function') window.dlEditarLote(lote.id);
    else if (typeof window.switchMod === 'function') window.switchMod('lotes');
  }

  function clearOverlay() {
    var map = getMap();
    if (map && ndviOverlay) map.removeLayer(ndviOverlay);
    ndviOverlay = null;
    if (typeof internals().clearLegacyAnalysis === 'function') internals().clearLegacyAnalysis();
  }

  function drawOverlay(image, bbox) {
    clearOverlay();
    var map = getMap();
    if (!map || !image || !Array.isArray(bbox) || bbox.length !== 4 || typeof L === 'undefined') return;
    ndviOverlay = L.imageOverlay(image, [[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { opacity:.82, interactive:false });
    if (productActive === 'ndvi') ndviOverlay.addTo(map);
  }

  function showProduct(product) {
    productActive = product;
    var map = getMap();
    if (map && ndviOverlay) {
      if (product === 'ndvi') ndviOverlay.addTo(map);
      else map.removeLayer(ndviOverlay);
    }
    document.querySelectorAll('[data-sat-product]').forEach(function (button) {
      var active = button.getAttribute('data-sat-product') === product;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('sat-layer-active', active);
    });
  }

  function kpi(label, value, note, color) {
    return '<div class="sat-kpi"><div class="sat-kpi-label">' + esc(label) + '</div>' +
      '<div class="sat-kpi-value" style="color:' + color + '">' + esc(value) + '</div>' +
      '<div class="sat-kpi-note">' + esc(note) + '</div></div>';
  }
  function alertCard(type, title, text, action) {
    var color = type === 'alta' ? '#B42318' : type === 'media' ? '#B87A20' : '#1E6B3A';
    var background = type === 'alta' ? 'rgba(180,35,24,.08)' : type === 'media' ? 'rgba(184,122,32,.10)' : 'rgba(30,107,58,.08)';
    return '<div class="sat-alert" style="border-color:' + color + '44;background:' + background + '">' +
      '<div style="font-weight:900;color:' + color + ';font-size:.8rem">' + esc(title) + '</div>' +
      '<div style="font-size:.72rem;line-height:1.45;color:rgba(28,18,8,.68);margin-top:.18rem">' + esc(text) + '</div>' +
      (action || '') + '</div>';
  }

  function renderAnalysis(result) {
    var kpis = document.getElementById('mapa-sat-kpis');
    var alerts = document.getElementById('mapa-sat-alertas');
    var source = document.getElementById('mapa-sat-fuente');
    var stats = result.estadisticas || {};
    var scene = result.escena || {};
    var context = agronomicContext(result.lote || getLote());
    var age = daysOld(scene.fecha);
    var coverage = num(scene.coberturaPct);
    var messages = [];

    if (result.esCache) messages.push({ type:'media', title:'Último dato válido guardado', text:'Los proveedores no respondieron ahora. El valor no fue recalculado ni sustituido por una estimación.' });
    if (age != null && age > 20) messages.push({ type:'media', title:'Escena desactualizada', text:'La última escena útil tiene ' + age + ' días. Se conservará hasta disponer de una observación válida más reciente.' });
    if (coverage != null && coverage < 75) messages.push({ type:'media', title:'Cobertura útil limitada', text:'Solo ' + coverage.toFixed(0) + '% del lote tuvo píxeles válidos después de excluir nubes y sombras.' });
    if (context.state === 'sin-definir') {
      messages.push({ type:'media', title:'Falta contexto agronómico', text:'El NDVI es real. Definir cultivo, barbecho o cobertura permite convertirlo en una lectura agronómica correcta.' });
    } else if (context.state === 'barbecho') {
      messages.push(num(stats.mean) >= .35
        ? { type:'media', title:'Vegetación activa en barbecho', text:'El índice indica cobertura verde relevante, compatible con malezas o una cobertura viva.' }
        : { type:'ok', title:'Baja actividad vegetal en barbecho', text:'La escena muestra poca vegetación fotosintéticamente activa.' });
    } else if (context.state === 'cobertura') {
      messages.push({ type:'ok', title:'Cobertura vegetal observada', text:'La lectura representa actividad de la cobertura y no vigor de un cultivo comercial.' });
    } else {
      if (!context.crop || !context.date) {
        messages.push({ type:'media', title:'Completar datos de siembra', text:'Falta cultivo o fecha para contrastar la observación con el estadio esperado.' });
      } else if (num(stats.delta) != null && num(stats.delta) < -.06) {
        messages.push({ type:'media', title:'Descenso entre escenas', text:'El NDVI medio cayó ' + Math.abs(num(stats.delta)).toFixed(2) + ' respecto de la observación válida anterior.' });
      } else {
        messages.push({ type:'ok', title:'Seguimiento actualizado', text:'Lectura interpretada para ' + context.crop + ' sembrado el ' + shortDate(context.date) + '.' });
      }
    }

    var mean = num(stats.mean);
    var cv = num(stats.cvPct);
    var delta = num(stats.delta);
    if (kpis) kpis.innerHTML =
      kpi('NDVI medio', fmt(mean, 2), context.state === 'barbecho' ? 'actividad vegetal' : 'observado', mean >= .65 ? '#1E6B3A' : mean >= .45 ? '#B87A20' : '#B42318') +
      kpi('Cobertura útil', coverage == null ? '—' : coverage.toFixed(0) + '%', scene.calidad ? 'calidad ' + scene.calidad : 'píxeles válidos', coverage != null && coverage < 75 ? '#B87A20' : '#1E6B3A') +
      kpi('Heterogeneidad', cv == null ? '—' : cv.toFixed(1) + '%', 'CV espacial real', cv > 20 ? '#B42318' : cv > 14 ? '#B87A20' : '#1E6B3A') +
      kpi('Cambio', delta == null ? '—' : (delta >= 0 ? '+' : '') + delta.toFixed(2), 'vs. escena válida previa', delta < -.06 ? '#B42318' : delta > .04 ? '#1E6B3A' : '#4A2E1A');
    if (alerts) alerts.innerHTML = messages.map(function (message) {
      var action = message.title === 'Completar datos de siembra'
        ? '<button type="button" onclick="satAbrirCargaContexto()" class="sat-inline-action">Completar siembra</button>' : '';
      return alertCard(message.type, message.title, message.text, action);
    }).join('');
    if (source) source.textContent = (result.producto || 'NDVI observado') + ' · ' + (result.proveedor || 'Proveedor satelital') +
      ' · ' + (scene.satelite || 'Satélite') + ' · escena ' + shortDate(scene.fecha) +
      (num(scene.nubesPct) != null ? ' · nubes ' + num(scene.nubesPct).toFixed(1) + '%' : '') +
      (result.esCache ? ' · dato guardado' : '');
    renderChart(result.historial || []);
  }

  function renderChart(history) {
    var canvas = document.getElementById('mapa-sat-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (chart) chart.destroy();
    chart = new Chart(canvas.getContext('2d'), {
      type:'line',
      data:{
        labels:history.map(function (item) { return shortDate(item.fecha); }),
        datasets:[{ label:'NDVI', data:history.map(function (item) { return item.mean; }), borderColor:'#1E6B3A', backgroundColor:'rgba(30,107,58,.10)', borderWidth:2, pointRadius:2.5, tension:.24, fill:true }]
      },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ x:{ ticks:{ font:{ size:9 }, maxTicksLimit:5 }, grid:{ display:false } }, y:{ min:0, max:1, ticks:{ font:{ size:9 }, stepSize:.2 }, grid:{ color:'rgba(74,46,26,.08)' } } } }
    });
  }

  function renderEmpty(reason, lote) {
    var kpis = document.getElementById('mapa-sat-kpis');
    var alerts = document.getElementById('mapa-sat-alertas');
    var source = document.getElementById('mapa-sat-fuente');
    if (kpis) kpis.innerHTML = kpi('NDVI medio','—','sin escena válida','#6B625A') +
      kpi('Cobertura útil','—','sin datos','#6B625A') + kpi('Heterogeneidad','—','sin datos','#6B625A') + kpi('Cambio','—','sin datos','#6B625A');
    if (alerts) alerts.innerHTML = alertCard('media', reason.title, reason.text, reason.action || '');
    if (source) source.textContent = 'Sin escena válida · Esri se muestra únicamente como mapa de referencia.';
    if (chart) { chart.destroy(); chart = null; }

    var saved = lote && lote.data && lote.data.ndviSeguimiento;
    if (saved && saved.producto === 'NDVI observado' && saved.escena && saved.estadisticas) {
      lastResult = Object.assign({}, saved, { lote:lote, esCache:true });
      renderAnalysis(lastResult);
    }
  }

  async function analyze() {
    var button = document.getElementById('mapa-sat-btn-analizar');
    if (button) { button.disabled = true; button.textContent = 'Buscando escena válida...'; }
    try {
      if (typeof baseInit === 'function') baseInit();
      var lote = getLote();
      var polygon = getPolygon(lote);
      var geojson = getGeoJSON(lote);
      renderAgronomicContext(lote);
      if (!lote) {
        renderEmpty({ title:'Sin lote activo', text:'Seleccioná un lote para consultar imágenes satelitales.' }, null);
        return;
      }
      if (!polygon || polygon.length < 3 || !geojson) {
        renderEmpty({
          title:'Falta el polígono del lote',
          text:'Un centroide no alcanza para medir NDVI. Dibujá o editá el perímetro en Mis Lotes.',
          action:'<button type="button" onclick="satAbrirEditarLote()" class="sat-inline-action">Editar lote</button>'
        }, lote);
        return;
      }

      var response = await fetch('/api/ndvi', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ geojson:geojson })
      });
      var payload = await response.json().catch(function () { return { ok:false }; });
      if (!response.ok || !payload.ok) {
        var providers = Array.isArray(payload.intentos) ? payload.intentos.map(function (item) { return item.proveedor; }).join(' y ') : 'los proveedores';
        renderEmpty({ title:'NDVI temporalmente no disponible', text:'No se obtuvo una escena real con calidad suficiente desde ' + providers + '. No se generó ningún valor estimado.' }, lote);
        return;
      }

      payload.lote = lote;
      var savedHistory = lote.data && lote.data.ndviSeguimiento && Array.isArray(lote.data.ndviSeguimiento.historial)
        ? lote.data.ndviSeguimiento.historial : [];
      var byDate = {};
      savedHistory.concat(payload.historial || []).forEach(function (item) {
        if (item && item.fecha && num(item.mean) != null) byDate[String(item.fecha).slice(0, 10)] = item;
      });
      payload.historial = Object.keys(byDate).sort().slice(-18).map(function (key) { return byDate[key]; });
      lastResult = payload;
      drawOverlay(payload.imagenNdvi, payload.bbox);
      renderAnalysis(payload);
      lote.data = lote.data || {};
      lote.data.ndviSeguimiento = {
        producto:'NDVI observado',
        proveedor:payload.proveedor,
        escena:payload.escena,
        estadisticas:payload.estadisticas,
        historial:payload.historial,
        actualizadoEn:new Date().toISOString()
      };
      if (typeof window.amGuardarLotesEstado === 'function') window.amGuardarLotesEstado();
    } catch (error) {
      renderEmpty({ title:'Servicio NDVI no disponible', text:'No fue posible consultar los proveedores satelitales. No se generó ningún valor de reemplazo.' }, getLote());
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Actualizar NDVI real'; }
    }
  }

  function init() {
    if (typeof baseInit === 'function') baseInit();
    var lote = getLote();
    renderAgronomicContext(lote);
  }

  window.mapaSatelitalInit = init;
  window.mapaSatAnalizar = analyze;
  window.satGuardarEstadoCobertura = saveCoverState;
  window.satAbrirCargaContexto = openPlanting;
  window.satAbrirEditarLote = openLotEditor;
  window.satMostrarProducto = showProduct;
})();
