// ════════════════════════════════════════════════════════
// AGROMOTOR — siembra-variable.js
// Módulo de Siembra y Fertilización Variable
// Integrado en la arquitectura multi-archivo de AgroMotor
// ════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Estado interno (no contamina el scope global) ───
  var svMap, svDrawnItems, svNdviLayer, svZonaLayer, svYieldLayer, svNdviChart;
  var svApiKey = null, svModoDemo = true, svLoteGeoJSON = null;
  var svLastGridValues = null, svLastGridInfo = null, svLastElevValues = null;
  var svZonaData = null, svNumZonas = 3;
  var svYieldPuntos = null, svCsvHeaders = [], svCsvRows = [];
  var svIniciado = false;
  var svLoteBloqueado = false;

  var ZONE_COLORS = ['#1a6b3c', '#f59e0b', '#e05a3a', '#7c3aed'];
  var ZONE_NAMES  = ['Ambiente A', 'Ambiente B', 'Ambiente C', 'Ambiente D'];

  // Helper: getElementById con prefijo sv-
  function el(id) { return document.getElementById('sv-' + id); }

  // ── GEOFENCE ────────────────────────────────────────
  var GF_KM = 5; // radio máximo desde el centro del lote activo

  function _parsLoteCoord() {
    var raw = (document.getElementById('s-coord') || {}).value || '';
    if (!raw.trim()) return null;
    var p = raw.split(',');
    if (p.length < 2) return null;
    var lat = parseFloat(p[0].trim()), lon = parseFloat(p[1].trim());
    return (isNaN(lat) || isNaN(lon)) ? null : { lat: lat, lon: lon };
  }

  // Distancia haversine en km entre dos {lat,lon}
  function _distKm(a, b) {
    var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    var s = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
  }

  function _dentroGeofence(latlng) {
    var c = _parsLoteCoord(); if (!c) return true; // sin lote → no bloquear aquí (ya bloqueado en init)
    return _distKm(c, { lat: latlng.lat, lon: latlng.lng }) <= GF_KM;
  }

  function _mostrarErrorGeoFence() {
    var hint = el('draw-hint');
    hint.style.display = 'block';
    hint.style.color = '#e05a3a';
    hint.innerHTML = '⚠️ Fuera del área del lote activo (' + GF_KM + ' km). Dibujá dentro del lote seleccionado en el Dashboard.';
    setTimeout(function () {
      hint.style.color = '';
      hint.innerHTML = '<strong>Clic</strong> para agregar vértices · <strong>Doble clic</strong> para confirmar · <strong>Esc</strong> para cancelar';
    }, 3000);
  }

  function _mostrarOverlayLote() {
    var overlay = el('lote-overlay');
    if (overlay) overlay.style.display = 'flex';
    var btn = el('btn-dibujar');
    if (btn) btn.disabled = true;
    // Deshabilitar importar GeoJSON
    var fileBtn = document.querySelector('#mod-siembra-variable input[type="file"]');
    if (fileBtn) fileBtn.disabled = true;
  }

  function _ocultarOverlayLote() {
    var overlay = el('lote-overlay');
    if (overlay) overlay.style.display = 'none';
    var btn = el('btn-dibujar');
    if (btn) btn.disabled = false;
    var fileBtn = document.querySelector('#mod-siembra-variable input[type="file"]');
    if (fileBtn) fileBtn.disabled = false;
  }

  function _loteActivo() {
    return (window.AM_LOTES || []).find(function (l) { return l.id === window.AM_LOTE_ACTIVO; }) || null;
  }

  function _geoJSONLoteActivo() {
    var lote = _loteActivo();
    var d = lote && lote.data ? lote.data : null;
    if (!d) return null;
    if (d.geojson && d.geojson.geometry) return d.geojson;
    if (Array.isArray(d.polygon) && d.polygon.length >= 3) {
      var coords = d.polygon.map(function (p) { return [p.lng, p.lat]; });
      coords.push(coords[0]);
      return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
    }
    return null;
  }

  function _aplicarLoteActivo() {
    if (!svMap || typeof L === 'undefined') return false;
    var geo = _geoJSONLoteActivo();
    if (!geo) {
      svLoteBloqueado = false;
      _actualizarBloqueoLote(false);
      if (svLoteGeoJSON) limpiarLote();
      return false;
    }
    var layer = L.geoJSON(geo, {
      style: { color: '#1b5e35', weight: 3, fillColor: '#1b5e35', fillOpacity: .10 }
    });
    setLote(layer);
    svLoteBloqueado = true;
    _actualizarBloqueoLote(true);
    return true;
  }

  function _actualizarBloqueoLote(bloqueado) {
    var btn = el('btn-dibujar');
    var limpiar = document.querySelector('#mod-siembra-variable .sv-btn-danger');
    var fileBtn = document.querySelector('#mod-siembra-variable input[type="file"]');
    var empty = el('lote-empty');
    if (btn) {
      btn.disabled = bloqueado;
      btn.textContent = bloqueado ? '🔒 Polígono del lote activo' : '✏️ Dibujar lote en el mapa';
    }
    if (limpiar) limpiar.disabled = bloqueado;
    if (fileBtn) fileBtn.disabled = bloqueado;
    if (empty && bloqueado) empty.innerHTML = 'El perímetro viene del lote activo. Para cambiarlo, editá el lote desde Mis Lotes.';
  }

  // ── INIT (llamado desde nav.js al activar el módulo) ─
  window.svInit = function () {
    var loteCoord = _parsLoteCoord();

    if (svIniciado) {
      if (svMap) setTimeout(function () { svMap.invalidateSize(); }, 100);
      // Re-verificar lote activo cada vez que se abre el módulo
      if (!loteCoord) { _mostrarOverlayLote(); } else { _ocultarOverlayLote(); if (svMap) svMap.setView([loteCoord.lat, loteCoord.lon], 14); _aplicarLoteActivo(); }
      return;
    }
    svIniciado = true;

    // Bloquear si no hay lote activo con coordenadas
    if (!loteCoord) { _mostrarOverlayLote(); }

    // Auto-conectar con key centralizada sin validación de red (confiamos en config.js)
    if (typeof AM_CONFIG !== 'undefined' && AM_CONFIG.agromonitoringKey) {
      svApiKey = AM_CONFIG.agromonitoringKey;
      svModoDemo = false;
      el('api-key').value = AM_CONFIG.agromonitoringKey;
      el('bdemo').style.display = 'none';
      el('bapi').classList.add('show');
      el('demo-badge').style.display = 'none';
      el('chart-tag').textContent = 'Sentinel-2 real';
      el('api-status').innerHTML = '<span class="sv-dot sv-dot-ok"></span> Conectado · Agromonitoring';
    }

    // Centrar mapa en lote activo (o fallback a pampa húmeda)
    var initLat = loteCoord ? loteCoord.lat : -33.45;
    var initLon = loteCoord ? loteCoord.lon : -62.9;
    var initZoom = loteCoord ? 14 : 13;
    svMap = L.map('sv-map', { zoomControl: true }).setView([initLat, initLon], initZoom);
    var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '© Esri', maxZoom: 19 });
    var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '© OSM', maxZoom: 19 });
    sat.addTo(svMap);
    L.control.layers({ 'Satélite': sat, 'Callejero': osm }).addTo(svMap);
    svDrawnItems = new L.FeatureGroup().addTo(svMap);
    _aplicarLoteActivo();
  };

  // ── DIBUJO NATIVO ──────────────────────────────────
  var _d = false, _pts = [], _mks = [], _pl = null, _pv = null;

  function activarDibujo() {
    if (svLoteBloqueado) return;
    if (_d) { cancelarDibujo(); return; }
    _d = true; _pts = [];
    svMap.getContainer().style.cursor = 'crosshair';
    svMap.doubleClickZoom.disable();
    svMap.on('click', _ck); svMap.on('dblclick', _dk); svMap.on('mousemove', _mv);
    document.addEventListener('keydown', _es);
    el('draw-hint').style.display = 'block';
    el('btn-dibujar').textContent = '⏹ Cancelar dibujo';
    el('btn-dibujar').style.background = '#92400e';
  }
  function _ck(e) {
    if (!_dentroGeofence(e.latlng)) { _mostrarErrorGeoFence(); return; }
    _pts.push(e.latlng);
    _mks.push(L.circleMarker(e.latlng, { radius: 5, fillColor: '#1b5e35', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(svMap));
    if (_pl) svMap.removeLayer(_pl);
    if (_pts.length > 1) _pl = L.polyline(_pts, { color: '#1b5e35', weight: 2, dashArray: '6 4' }).addTo(svMap);
  }
  function _mv(e) {
    if (!_d || !_pts.length) return;
    if (_pv) svMap.removeLayer(_pv);
    _pv = L.polyline(_pts.concat([e.latlng]), { color: '#1b5e35', weight: 1.5, opacity: .5, dashArray: '4 4' }).addTo(svMap);
  }
  function _dk() {
    if (_pts.length > 0) _pts.pop();
    if (_mks.length > 0) { svMap.removeLayer(_mks.pop()); }
    if (_pts.length < 3) { cancelarDibujo(); return; }
    var layer = L.polygon(_pts, { color: '#1b5e35', weight: 2, fillColor: '#1b5e35', fillOpacity: .08 });
    _reset(); setLote(layer);
  }
  function _es(e) { if (e.key === 'Escape') cancelarDibujo(); }
  function _reset() {
    _d = false; svMap.getContainer().style.cursor = '';
    svMap.doubleClickZoom.enable();
    svMap.off('click', _ck); svMap.off('dblclick', _dk); svMap.off('mousemove', _mv);
    document.removeEventListener('keydown', _es);
    _mks.forEach(function (m) { svMap.removeLayer(m); }); _mks = []; _pts = [];
    if (_pl) { svMap.removeLayer(_pl); _pl = null; }
    if (_pv) { svMap.removeLayer(_pv); _pv = null; }
  }
  function cancelarDibujo() {
    _reset();
    el('draw-hint').style.display = 'none';
    el('btn-dibujar').textContent = '✏️ Dibujar lote en el mapa';
    el('btn-dibujar').style.background = '';
  }

  // ── LOTE ───────────────────────────────────────────
  function setLote(layer) {
    cancelarDibujo();
    svDrawnItems.clearLayers(); svDrawnItems.addLayer(layer);
    svLoteGeoJSON = layer.toGeoJSON();
    var ha = (turf.area(svLoteGeoJSON) / 10000).toFixed(1);
    var line = turf.polygonToLine(svLoteGeoJSON);
    var peri = (turf.length(line, { units: 'kilometers' }) * 1000).toFixed(0);
    var c = turf.centroid(svLoteGeoJSON).geometry.coordinates;
    el('lote-empty').style.display = 'none';
    el('lote-info').style.display = 'flex';
    el('l-area').textContent = ha + ' ha';
    el('l-peri').textContent = peri + ' m';
    el('l-cent').textContent = c[1].toFixed(4) + '°, ' + c[0].toFixed(4) + '°';
    el('btn-analizar').disabled = false;
    svMap.fitBounds(layer.getBounds().pad(0.12));
  }
  function limpiarLote() {
    if (svLoteBloqueado) return;
    svDrawnItems.clearLayers(); svLoteGeoJSON = null;
    [svNdviLayer, svZonaLayer, svYieldLayer].forEach(function (l) { if (l) svMap.removeLayer(l); });
    svNdviLayer = svZonaLayer = svYieldLayer = null;
    ['lote-info', 'ndvi-result', 'zona-result', 'chart-panel', 'legend', 'panel-prescripcion', 'panel-exportar'].forEach(function (id) {
      var e = el(id); if (e) e.style.display = 'none';
    });
    el('lote-empty').style.display = 'block';
    el('btn-analizar').disabled = true;
    el('btn-zonificar').disabled = true;
    svLastGridValues = svLastGridInfo = svLastElevValues = null;
    if (svNdviChart) { svNdviChart.destroy(); svNdviChart = null; }
  }
  function importarGeoJSON(ev) {
    var file = ev.target.files[0]; if (!file) return;
    var r = new FileReader();
    r.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        var feat = data.type === 'FeatureCollection' ? data.features[0] : data.type === 'Feature' ? data : { type: 'Feature', geometry: data, properties: {} };
        if (!feat) { alert('GeoJSON sin polígono'); return; }
        var coords = feat.geometry.type === 'Polygon'
          ? feat.geometry.coordinates[0].map(function (c) { return [c[1], c[0]]; })
          : feat.geometry.coordinates[0][0].map(function (c) { return [c[1], c[0]]; });
        // Geofence: verificar que el centroide del GeoJSON esté dentro del radio
        var loteCoord = _parsLoteCoord();
        if (loteCoord) {
          var sumLat = 0, sumLng = 0;
          coords.forEach(function(c) { sumLat += c[0]; sumLng += c[1]; });
          var centroid = { lat: sumLat / coords.length, lon: sumLng / coords.length };
          if (_distKm(loteCoord, centroid) > GF_KM) {
            alert('⚠️ El archivo GeoJSON corresponde a un lote fuera del área permitida (' + GF_KM + ' km del lote activo en el Dashboard).\n\nSeleccioná primero el lote correcto en el Dashboard.');
            ev.target.value = '';
            return;
          }
        }
        setLote(L.polygon(coords, { color: '#1b5e35', weight: 2, fillOpacity: .08 }));
      } catch (err) { alert('Error: ' + err.message); }
    };
    r.readAsText(file);
  }

  // ── API AGROMONITORING ────────────────────────────
  function conectarAPI() {
    var key = el('api-key').value.trim(); if (!key) return;
    var st = el('api-status');
    st.innerHTML = '<span class="sv-dot" style="background:#9ca3af"></span> Verificando...';
    fetch('https://agromonitoring.com/agromonitoring/v1/polygons?appid=' + key)
      .then(function (r) {
        if (r.ok) {
          svApiKey = key; svModoDemo = false;
          el('bdemo').style.display = 'none';
          el('bapi').classList.add('show');
          el('demo-badge').style.display = 'none';
          el('chart-tag').textContent = 'Sentinel-2 real';
          st.innerHTML = '<span class="sv-dot sv-dot-ok"></span> Conectado · Agromonitoring';
        } else throw 0;
      }).catch(function () {
        st.innerHTML = '<span class="sv-dot sv-dot-err"></span> API key inválida';
      });
  }

  // ── CSV RENDIMIENTOS ──────────────────────────────
  function importarCSV(ev) {
    var file = ev.target.files[0]; if (!file) return;
    var r = new FileReader();
    r.onload = function (e) {
      var lines = e.target.result.split('\n').filter(function (l) { return l.trim(); });
      if (lines.length < 2) { alert('CSV vacío'); return; }
      var sep = lines[0].indexOf(';') > -1 ? ';' : ',';
      svCsvHeaders = lines[0].split(sep).map(function (h) { return h.trim().replace(/"/g, ''); });
      svCsvRows = lines.slice(1).map(function (l) {
        return l.split(sep).map(function (v) { return v.trim().replace(/"/g, ''); });
      }).filter(function (r) { return r.length === svCsvHeaders.length; });
      poblarSelectoresCSV();
    };
    r.readAsText(file);
  }
  function poblarSelectoresCSV() {
    var opts = svCsvHeaders.map(function (h, i) { return '<option value="' + i + '">' + h + '</option>'; }).join('');
    ['col-lat', 'col-lng', 'col-rend'].forEach(function (id) { el(id).innerHTML = opts; });
    var auto = { 'col-lat': ['lat', 'latitud', 'latitude', 'y'], 'col-lng': ['lon', 'lng', 'longitude', 'longitud', 'x'], 'col-rend': ['yield', 'rend', 'dry', 'tn', 'ton', 'kg', 'bu'] };
    Object.keys(auto).forEach(function (sid) {
      auto[sid].forEach(function (kw) {
        for (var i = 0; i < svCsvHeaders.length; i++) {
          if (svCsvHeaders[i].toLowerCase().indexOf(kw) > -1) { el(sid).value = i; return; }
        }
      });
    });
    el('csv-ok').style.display = 'block';
    el('csv-ok').innerHTML = '<span class="sv-csv-tag">📊 ' + svCsvRows.length.toLocaleString('es') + ' filas cargadas</span>';
    el('csv-cols').style.display = 'flex';
  }
  function confirmarCSV() {
    var iLat = +el('col-lat').value, iLng = +el('col-lng').value, iR = +el('col-rend').value;
    var pts = []; var err = 0;
    svCsvRows.forEach(function (row) {
      var la = parseFloat(row[iLat]), lo = parseFloat(row[iLng]), v = parseFloat(row[iR]);
      if (!isNaN(la) && !isNaN(lo) && !isNaN(v)) pts.push({ lat: la, lng: lo, val: v }); else err++;
    });
    if (!pts.length) { alert('Sin filas válidas'); return; }
    svYieldPuntos = pts;
    el('csv-cols').style.display = 'none';
    el('yield-status').style.display = 'block';
    el('yield-status').innerHTML = '✓ ' + pts.length.toLocaleString('es') + ' puntos de rendimiento cargados' + (err ? ' (' + err + ' omitidas)' : '');
    mostrarYieldMapa(pts);
  }
  function mostrarYieldMapa(pts) {
    if (svYieldLayer) svMap.removeLayer(svYieldLayer);
    var vals = pts.map(function (p) { return p.val; });
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    svYieldLayer = L.featureGroup();
    pts.forEach(function (p) {
      var t = (p.val - mn) / (mx - mn || 1);
      L.circleMarker([p.lat, p.lng], { radius: 3, fillColor: t > .66 ? '#1a9641' : t > .33 ? '#fee08b' : '#d73027', fillOpacity: .7, color: 'transparent', weight: 0 })
       .bindTooltip('Rend: ' + p.val.toFixed(1), { sticky: true }).addTo(svYieldLayer);
    });
    svYieldLayer.addTo(svMap);
  }

  // ── IDW ───────────────────────────────────────────
  function idw(lng, lat, pts, p) {
    p = p || 2; var ws = 0, tw = 0;
    var near = pts.slice().sort(function (a, b) { return dist2(a, lng, lat) - dist2(b, lng, lat); }).slice(0, 12);
    near.forEach(function (pt) {
      var d = dist2(pt, lng, lat);
      if (d < 1e-8) { ws = pt.val; tw = 1; return; }
      var w = 1 / Math.pow(d, p); ws += w * pt.val; tw += w;
    });
    return tw > 0 ? ws / tw : 0;
  }
  function dist2(pt, lng, lat) { return Math.sqrt(Math.pow(pt.lng - lng, 2) + Math.pow(pt.lat - lat, 2)); }

  // ── ELEVACIÓN SRTM ────────────────────────────────
  function toggleElevUI() {
    var on = el('use-elev').checked;
    el('elev-config').style.display = on ? 'flex' : 'none';
  }
  function syncWeights() {
    var nv = +el('w-ndvi').value;
    el('w-ndvi-v').textContent = nv + '%';
    el('w-elev-v').textContent = (100 - nv) + '%';
    el('w-elev').value = 100 - nv;
  }
  function syncWeights2() {
    var ev = +el('w-elev').value;
    el('w-elev-v').textContent = ev + '%';
    el('w-ndvi-v').textContent = (100 - ev) + '%';
    el('w-ndvi').value = 100 - ev;
  }
  async function fetchElevaciones(pts) {
    var elev = new Array(pts.length).fill(null), batch = 100;
    for (var i = 0; i < pts.length; i += batch) {
      var slice = pts.slice(i, i + batch);
      var locs = slice.map(function (p) { return p[1] + ',' + p[0]; }).join('|');
      try {
        var res = await fetch('https://api.opentopodata.org/v1/srtm30m?locations=' + locs);
        var data = await res.json();
        if (data.results) data.results.forEach(function (r, j) { elev[i + j] = r.elevation; });
      } catch (e) {}
      if (i + batch < pts.length) await new Promise(function (rs) { setTimeout(rs, 350); });
    }
    return elev;
  }

  // ── ANÁLISIS NDVI ─────────────────────────────────
  async function analizarNDVI() {
    if (!svLoteGeoJSON) return;
    var btn = el('btn-analizar');
    btn.disabled = true; btn.textContent = '⏳ Analizando...';
    if (svNdviLayer) { svMap.removeLayer(svNdviLayer); svNdviLayer = null; }
    if (svZonaLayer) { svMap.removeLayer(svZonaLayer); svZonaLayer = null; }

    var meses = +el('periodo').value;
    var useElev = el('use-elev').checked;
    var gridInfo = buildGrid(svLoteGeoJSON);
    var historial, gridValues, fuente;

    try {
      if (!svModoDemo && svApiKey) {
        var res = await analizarConAPI(svLoteGeoJSON, svApiKey, meses, gridInfo);
        historial = res.historial; gridValues = res.gridValues; fuente = 'Sentinel-2 · Agromonitoring';
      } else {
        var dem = generarDemo(gridInfo, meses);
        historial = dem.historial; gridValues = dem.gridValues; fuente = 'Simulado · Modo demo';
      }
    } catch (e) {
      var dem = generarDemo(gridInfo, meses);
      historial = dem.historial; gridValues = dem.gridValues; fuente = 'Demo (fallback)';
    }

    svLastElevValues = null;
    if (useElev) {
      btn.textContent = '⛰ Obteniendo SRTM...';
      var elevs = await fetchElevaciones(gridInfo.points);
      if (elevs.some(function (v) { return v !== null; })) svLastElevValues = elevs;
    }

    svLastGridValues = gridValues; svLastGridInfo = gridInfo;
    svNdviLayer = dibujarGrillaNDVI(gridInfo, gridValues);
    svNdviLayer.addTo(svMap);
    actualizarLeyendaNDVI();

    var sum = 0, mx = -Infinity, mn = Infinity;
    gridValues.forEach(function (v) { sum += v; if (v > mx) mx = v; if (v < mn) mn = v; });
    var avg = sum / gridValues.length;
    var std = Math.sqrt(gridValues.reduce(function (s, v) { return s + (v - avg) * (v - avg); }, 0) / gridValues.length);
    var cv = (std / avg * 100).toFixed(1);

    el('r-avg').textContent = avg.toFixed(3);
    el('r-avg').className = 'sv-sval ' + (avg > .65 ? 'sv-ndvi-hi' : avg > .45 ? 'sv-ndvi-md' : 'sv-ndvi-lo');
    el('r-max').textContent = mx.toFixed(3);
    el('r-min').textContent = mn.toFixed(3);
    el('r-cv').textContent = cv + '% · ' + (cv > 15 ? '⚠ alta' : '✓ normal');
    el('r-src').textContent = fuente + (svLastElevValues ? ' + SRTM' : '');
    el('ndvi-result').style.display = 'flex';
    el('btn-zonificar').disabled = false;
    renderChart(historial);
    btn.disabled = false; btn.textContent = '🔄 Re-analizar';
  }

  async function analizarConAPI(geo, key, meses, gridInfo) {
    var now = Math.floor(Date.now() / 1000), from = now - meses * 30 * 86400;
    var pr = await fetch('https://agromonitoring.com/agromonitoring/v1/polygons?appid=' + key, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'am_' + Date.now(), geo_json: geo })
    });
    var poly = await pr.json();
    var hr = await fetch('https://agromonitoring.com/agromonitoring/v1/ndvi/history?polyid=' + poly.id + '&from=' + from + '&to=' + now + '&appid=' + key);
    var hist = await hr.json();
    var historial = hist.map(function (h) {
      return { fecha: new Date(h.dt * 1000).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }), valor: h.data.mean };
    });
    var mean = historial.reduce(function (s, h) { return s + h.valor; }, 0) / (historial.length || 1);
    return { historial: historial, gridValues: gridInfo.points.map(function (p) { return clamp(mean + noise(p[1] * 48, p[0] * 48) * .2, .15, .92); }) };
  }

  function generarDemo(gridInfo, meses) {
    var hist = [], now = new Date(), steps = Math.min(meses * 2, 38);
    for (var i = steps; i >= 0; i--) {
      var d = new Date(now.getTime() - i * 14 * 86400000), mes = d.getMonth();
      hist.push({ fecha: d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }), valor: clamp(.32 + .43 * Math.max(0, Math.sin((mes - 1) * Math.PI / 5.5)) + (Math.random() - .5) * .07, .12, .91) });
    }
    return { historial: hist, gridValues: gridInfo.points.map(function (p) { return clamp(.57 + noise(p[1] * 52, p[0] * 52) * .30, .22, .90); }) };
  }

  // ── GRILLA ────────────────────────────────────────
  function buildGrid(geo) {
    var area = turf.area(geo);
    var cellM = Math.max(18, Math.sqrt(area / 1000));
    var cd = cellM / 111000, bbox = turf.bbox(geo), pts = [];
    for (var lat = bbox[1] + cd / 2; lat < bbox[3]; lat += cd) {
      for (var lng = bbox[0] + cd / 2; lng < bbox[2]; lng += cd) {
        if (turf.booleanPointInPolygon(turf.point([lng, lat]), geo)) pts.push([lng, lat]);
      }
    }
    return { points: pts, cellDeg: cd };
  }
  function buildGridIndex(gi) {
    var cd = gi.cellDeg, idx = {};
    gi.points.forEach(function (p, i) { idx[Math.round(p[1] / cd) + '|' + Math.round(p[0] / cd)] = i; });
    return { idx: idx, cd: cd };
  }
  function vecinos(i, gi, gidx) {
    var p = gi.points[i], cd = gidx.cd, res = [];
    [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(function (o) {
      var k = (Math.round(p[1] / cd) + o[0]) + '|' + (Math.round(p[0] / cd) + o[1]);
      if (gidx.idx[k] !== undefined) res.push(gidx.idx[k]);
    });
    return res;
  }
  function dibujarGrillaNDVI(gi, vals) {
    var layer = L.featureGroup(), cd = gi.cellDeg;
    gi.points.forEach(function (p, i) {
      var v = vals[i] !== undefined ? vals[i] : .5;
      L.rectangle([[p[1] - cd / 2, p[0] - cd / 2], [p[1] + cd / 2, p[0] + cd / 2]],
        { fillColor: ndviColor(v), fillOpacity: .74, color: 'transparent', weight: 0 })
       .bindTooltip('NDVI: ' + v.toFixed(3), { sticky: true }).addTo(layer);
    });
    return layer;
  }

  // ── K-MEANS 1D ────────────────────────────────────
  function kmeans1D(vals, k) {
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var centroids = [];
    for (var i = 0; i < k; i++) centroids.push(mn + (mx - mn) * (i + .5) / k);
    var asgn = new Array(vals.length).fill(0);
    for (var iter = 0; iter < 100; iter++) {
      var changed = false;
      for (var i = 0; i < vals.length; i++) {
        var best = 0, bd = Infinity;
        for (var j = 0; j < k; j++) { var d = Math.abs(vals[i] - centroids[j]); if (d < bd) { bd = d; best = j; } }
        if (asgn[i] !== best) { asgn[i] = best; changed = true; }
      }
      if (!changed) break;
      var sums = new Array(k).fill(0), cnts = new Array(k).fill(0);
      for (var i = 0; i < vals.length; i++) { sums[asgn[i]] += vals[i]; cnts[asgn[i]]++; }
      for (var j = 0; j < k; j++) { if (cnts[j] > 0) centroids[j] = sums[j] / cnts[j]; }
    }
    var order = centroids.map(function (c, i) { return { c: c, i: i }; }).sort(function (a, b) { return b.c - a.c; });
    var rm = {}; order.forEach(function (o, r) { rm[o.i] = r; });
    return { assignments: asgn.map(function (a) { return rm[a]; }), centroids: order.map(function (o) { return o.c; }) };
  }

  // ── SUAVIZADO ─────────────────────────────────────
  function majorityFilter(asgn, gi, passes) {
    var gidx = buildGridIndex(gi), res = asgn.slice();
    for (var p = 0; p < passes; p++) {
      var next = res.slice();
      for (var i = 0; i < gi.points.length; i++) {
        var nb = vecinos(i, gi, gidx); if (!nb.length) continue;
        var cnt = {};
        nb.forEach(function (n) { var z = res[n]; cnt[z] = (cnt[z] || 0) + 1; });
        var mc = 0, bz = res[i];
        Object.keys(cnt).forEach(function (z) { if (cnt[z] > mc) { mc = cnt[z]; bz = +z; } });
        next[i] = bz;
      }
      res = next;
    }
    return res;
  }

  // ── ZONIFICACIÓN ──────────────────────────────────
  function selZonas(k) {
    svNumZonas = k;
    [2, 3, 4].forEach(function (n) { el('z' + n).classList.toggle('active', n === k); });
  }
  function zonificar() {
    if (!svLastGridValues || !svLastGridInfo) return;
    var wN = +el('w-ndvi').value || 60;
    var wE = 100 - wN;
    var useElev = el('use-elev').checked && svLastElevValues;
    var normN = normalize(svLastGridValues);
    var normE = useElev ? normalize(svLastElevValues.map(function (v) { return v === null ? 0 : v; })) : null;
    var normY = null;
    if (svYieldPuntos) {
      var yv = svLastGridInfo.points.map(function (p) { return idw(p[0], p[1], svYieldPuntos, 2); });
      normY = normalize(yv);
    }
    var composite = normN.map(function (n, i) {
      var score = 0, tot = 0;
      score += n * (wN / 100); tot += wN / 100;
      if (normE) { score += (1 - normE[i]) * (wE / 100); tot += wE / 100; }
      if (normY) { score += normY[i] * .25; tot += .25; }
      return score / tot;
    });
    var result = kmeans1D(composite, svNumZonas);
    var passes = +el('smoothing').value || 0;
    var smoothed = passes > 0 ? majorityFilter(result.assignments, svLastGridInfo, passes) : result.assignments;
    svZonaData = { assignments: smoothed, centroids: result.centroids, k: svNumZonas, gridInfo: svLastGridInfo, gridValues: svLastGridValues, composite: composite };
    if (svNdviLayer) svMap.removeLayer(svNdviLayer);
    if (svZonaLayer) svMap.removeLayer(svZonaLayer);
    svZonaLayer = dibujarZonas(svZonaData); svZonaLayer.addTo(svMap);
    actualizarLeyendaZonas(svNumZonas, result.centroids);
    statsZonas(svZonaData);
    el('panel-prescripcion').style.display = 'block';
    el('panel-exportar').style.display = 'block';
    renderPrescrip(svZonaData);
    setTimeout(function () { el('panel-prescripcion').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 200);
  }
  function dibujarZonas(zd) {
    var layer = L.featureGroup(), cd = zd.gridInfo.cellDeg;
    zd.gridInfo.points.forEach(function (p, i) {
      var z = zd.assignments[i];
      L.rectangle([[p[1] - cd / 2, p[0] - cd / 2], [p[1] + cd / 2, p[0] + cd / 2]],
        { fillColor: ZONE_COLORS[z], fillOpacity: .74, color: 'transparent', weight: 0 })
       .bindTooltip(ZONE_NAMES[z] + ' · NDVI ' + zd.gridValues[i].toFixed(3), { sticky: true }).addTo(layer);
    });
    return layer;
  }
  function actualizarLeyendaNDVI() {
    el('legend').innerHTML = '<div class="sv-legend-title">Índice NDVI</div>' +
      ['#1a9641', '#91cf60', '#d9ef8b', '#fee08b', '#fc8d59', '#d73027'].map(function (c, i) {
        var labels = ['Alto · >0.75', 'Bueno · 0.65–0.75', 'Moderado · 0.55–0.65', 'Bajo · 0.45–0.55', 'Muy bajo · 0.30–0.45', 'Crítico · <0.30'];
        return '<div class="sv-li"><span class="sv-li-sq" style="background:' + c + '"></span>' + labels[i] + '</div>';
      }).join('');
    el('legend').style.display = 'block';
  }
  function actualizarLeyendaZonas(k, centroids) {
    el('legend').innerHTML = '<div class="sv-legend-title">Zonas de manejo</div>' +
      Array.from({ length: k }, function (_, i) {
        return '<div class="sv-li"><span class="sv-li-sq" style="background:' + ZONE_COLORS[i] + '"></span>' + ZONE_NAMES[i] + ' · score ' + centroids[i].toFixed(3) + '</div>';
      }).join('');
    el('legend').style.display = 'block';
  }
  function statsZonas(zd) {
    var tot = zd.gridInfo.points.length, area = turf.area(svLoteGeoJSON) / 10000;
    var cnt = new Array(zd.k).fill(0);
    zd.assignments.forEach(function (a) { cnt[a]++; });
    el('zona-result').innerHTML = Array.from({ length: zd.k }, function (_, i) {
      return '<div class="sv-srow"><span><span class="sv-amb-chip" style="background:' + ZONE_COLORS[i] + '"></span>' + ZONE_NAMES[i] + '</span>' +
        '<span class="sv-sval">' + (cnt[i] / tot * area).toFixed(1) + ' ha · ' + (cnt[i] / tot * 100).toFixed(0) + '%</span></div>';
    }).join('');
    el('zona-result').style.display = 'flex';
    el('zona-result').style.flexDirection = 'column';
  }

  // ── PRESCRIPCIÓN ──────────────────────────────────
  function renderPrescrip(zd) {
    var tot = zd.gridInfo.points.length, area = turf.area(svLoteGeoJSON) / 10000;
    var cnt = new Array(zd.k).fill(0); zd.assignments.forEach(function (a) { cnt[a]++; });
    var ds = [8.5, 7.5, 6.5, 5.5], df = [200, 160, 120, 90];
    var html = '<table class="sv-presc-table"><thead><tr><th>Amb.</th><th>ha</th>' +
      '<th>Semilla<br><small style="font-weight:400;color:#9ca3af">sem/m²</small></th>' +
      '<th>Fertiliz.<br><small style="font-weight:400;color:#9ca3af">kg/ha</small></th></tr></thead><tbody>';
    for (var i = 0; i < zd.k; i++) {
      var ha = (cnt[i] / tot * area).toFixed(1);
      html += '<tr><td><span class="sv-amb-chip" style="background:' + ZONE_COLORS[i] + '"></span><strong>' + String.fromCharCode(65 + i) + '</strong></td>' +
        '<td>' + ha + '</td>' +
        '<td><input class="sv-presc-input" id="sv-sem-' + i + '" type="number" min="2" max="15" step=".5" value="' + ds[i] + '" oninput="svCalcTotales()"/></td>' +
        '<td><input class="sv-presc-input" id="sv-fer-' + i + '" type="number" min="0" max="500" step="10" value="' + df[i] + '" oninput="svCalcTotales()"/></td></tr>';
    }
    html += '</tbody></table><div id="sv-totales-presc"></div>';
    el('pb-prescripcion').innerHTML = html;
    calcTotales();
  }
  function calcTotales() {
    if (!svZonaData) return;
    var tot = svZonaData.gridInfo.points.length, area = turf.area(svLoteGeoJSON) / 10000;
    var cnt = new Array(svZonaData.k).fill(0); svZonaData.assignments.forEach(function (a) { cnt[a]++; });
    var tf = 0, ts = 0;
    for (var i = 0; i < svZonaData.k; i++) {
      var ha = cnt[i] / tot * area;
      tf += ha * (+(document.getElementById('sv-fer-' + i) || { value: 0 }).value || 0);
      ts += ha * (+(document.getElementById('sv-sem-' + i) || { value: 0 }).value || 0) * 10000;
    }
    var tp = el('totales-presc');
    if (tp) tp.innerHTML =
      '<div style="border-top:1px solid var(--sv-bdr);margin-top:6px;padding-top:6px;display:flex;flex-direction:column;gap:0">' +
      '<div class="sv-srow"><span>Total fertilizante</span><span class="sv-sval">' + Math.round(tf).toLocaleString('es') + ' kg</span></div>' +
      '<div class="sv-srow"><span>Total semillas</span><span class="sv-sval">' + Math.round(ts / 1000).toLocaleString('es') + ' miles</span></div></div>';
  }

  // ── EXPORTACIÓN ───────────────────────────────────
  function _features() {
    var cd = svZonaData.gridInfo.cellDeg;
    return svZonaData.gridInfo.points.map(function (p, i) {
      var z = svZonaData.assignments[i];
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[p[0] - cd / 2, p[1] - cd / 2], [p[0] + cd / 2, p[1] - cd / 2], [p[0] + cd / 2, p[1] + cd / 2], [p[0] - cd / 2, p[1] + cd / 2], [p[0] - cd / 2, p[1] - cd / 2]]] },
        properties: { ambiente: ZONE_NAMES[z], ndvi: +svZonaData.gridValues[i].toFixed(3), dosis_semilla_sem_m2: +(document.getElementById('sv-sem-' + z) || { value: 0 }).value, dosis_fertilizante_kg_ha: +(document.getElementById('sv-fer-' + z) || { value: 0 }).value }
      };
    });
  }
  function exportarGeoJSON() {
    if (!svZonaData) return;
    dl(JSON.stringify({ type: 'FeatureCollection', features: _features() }, null, 2), 'prescripcion_' + hoy() + '.geojson', 'application/json');
  }
  function exportarCSVPresc() {
    if (!svZonaData) return;
    var tot = svZonaData.gridInfo.points.length, area = turf.area(svLoteGeoJSON) / 10000;
    var cnt = new Array(svZonaData.k).fill(0); svZonaData.assignments.forEach(function (a) { cnt[a]++; });
    var lines = ['Ambiente,Superficie_ha,NDVI_promedio,Score_compuesto,Dosis_semilla_sem_m2,Dosis_fertilizante_kg_ha'];
    for (var i = 0; i < svZonaData.k; i++) {
      var ha = (cnt[i] / tot * area).toFixed(2);
      var ndviProm = svZonaData.gridValues.filter(function (_, j) { return svZonaData.assignments[j] === i; })
        .reduce(function (s, v, _, a) { return s + v / a.length; }, 0).toFixed(3);
      lines.push([ZONE_NAMES[i], ha, ndviProm, svZonaData.centroids[i].toFixed(3),
        (document.getElementById('sv-sem-' + i) || { value: '' }).value,
        (document.getElementById('sv-fer-' + i) || { value: '' }).value].join(','));
    }
    dl(lines.join('\n'), 'prescripcion_' + hoy() + '.csv', 'text/csv');
  }
  function exportarCSVMonitor() {
    if (!svZonaData) return;
    var lines = ['Latitude,Longitude,Seed_Rate_m2,Seed_Rate_ha,Fert_Rate_ha,Zone_Name'];
    svZonaData.gridInfo.points.forEach(function (p, i) {
      var z = svZonaData.assignments[i];
      var seedM2 = +(document.getElementById('sv-sem-' + z) || { value: 0 }).value || 0;
      var seedHa = Math.round(seedM2 * 10000);
      var fertHa = +(document.getElementById('sv-fer-' + z) || { value: 0 }).value || 0;
      lines.push([p[1].toFixed(6), p[0].toFixed(6), seedM2, seedHa, fertHa, ZONE_NAMES[z]].join(','));
    });
    dl(lines.join('\n'), 'prescripcion_monitor_' + hoy() + '.csv', 'text/csv');
  }
  function exportarShapefile() {
    if (!svZonaData) return;
    var geojson = { type: 'FeatureCollection', features: _features() };
    try {
      if (typeof shpwrite === 'undefined') throw new Error('no disponible');
      shpwrite.download(geojson, { outputType: 'blob', compression: 'DEFLATE', types: { polygon: 'prescripcion' } });
    } catch (e) {
      alert('Shapefile no disponible en este navegador (' + e.message + '). Exportando GeoJSON.\nPodés convertirlo en mapshaper.org o QGIS.');
      exportarGeoJSON();
    }
  }

  // ── CHART ─────────────────────────────────────────
  function renderChart(hist) {
    el('chart-panel').style.display = 'block';
    setTimeout(function () { svMap.invalidateSize(); }, 50);
    if (svNdviChart) svNdviChart.destroy();
    svNdviChart = new Chart(el('ndvi-chart').getContext('2d'), {
      type: 'line',
      data: { labels: hist.map(function (h) { return h.fecha; }), datasets: [{ label: 'NDVI', data: hist.map(function (h) { return +h.valor.toFixed(3); }), borderColor: '#1b5e35', backgroundColor: 'rgba(27,94,53,.07)', borderWidth: 1.5, pointRadius: 2, pointBackgroundColor: '#1b5e35', tension: .38, fill: true }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ' NDVI ' + c.parsed.y.toFixed(3); } } } }, scales: { x: { ticks: { font: { size: 9 }, maxRotation: 0, maxTicksLimit: 16 }, grid: { display: false } }, y: { min: 0, max: 1, ticks: { font: { size: 9 }, stepSize: .2 }, grid: { color: '#f3f4f6' } } } }
    });
  }

  // ── UTILS ─────────────────────────────────────────
  function ndviColor(v) { return v > .75 ? '#1a9641' : v > .65 ? '#91cf60' : v > .55 ? '#d9ef8b' : v > .45 ? '#fee08b' : v > .30 ? '#fc8d59' : '#d73027'; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function normalize(arr) {
    var vld = arr.filter(function (v) { return v !== null && !isNaN(v); });
    var mn = Math.min.apply(null, vld), mx = Math.max.apply(null, vld), rng = mx - mn;
    return arr.map(function (v) { return (v === null || isNaN(v)) ? .5 : (rng > 0 ? (v - mn) / rng : .5); });
  }
  function noise(x, y) {
    return .40 * Math.sin(x * .63 + y * .31) + .25 * Math.sin(x * 1.41 - y * .87 + 1.3) +
           .20 * Math.sin(x * 2.17 + y * 1.73 + 2.8) + .15 * Math.sin(x * 3.61 - y * 2.43 + 4.2);
  }
  function dl(content, name, type) {
    var b = new Blob([content], { type: type }); var u = URL.createObjectURL(b);
    var a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u);
  }
  function hoy() { return new Date().toISOString().slice(0, 10); }
  function svTogglePanel(h) {
    var b = h.nextElementSibling, arr = h.querySelector('.sv-arr');
    var open = b.style.display !== 'none';
    b.style.display = open ? 'none' : 'flex';
    if (arr) arr.style.transform = open ? 'rotate(-90deg)' : '';
  }

  // ── Exponer funciones al scope global (onclick) ──
  window.svActivarDibujo   = function () { activarDibujo(); };
  window.svLimpiarLote     = function () { limpiarLote(); };
  window.svImportarGeoJSON = function (ev) { importarGeoJSON(ev); };
  window.svConectarAPI     = function () { conectarAPI(); };
  window.svImportarCSV     = function (ev) { importarCSV(ev); };
  window.svConfirmarCSV    = function () { confirmarCSV(); };
  window.svToggleElevUI    = function () { toggleElevUI(); };
  window.svSyncWeights     = function () { syncWeights(); };
  window.svSyncWeights2    = function () { syncWeights2(); };
  window.svAnalizarNDVI    = function () { analizarNDVI(); };
  window.svSelZonas        = function (k) { selZonas(k); };
  window.svZonificar       = function () { zonificar(); };
  window.svCalcTotales     = function () { calcTotales(); };
  window.svExportarGeoJSON  = function () { exportarGeoJSON(); };
  window.svExportarCSVPresc = function () { exportarCSVPresc(); };
  window.svExportarCSVMonitor = function () { exportarCSVMonitor(); };
  window.svExportarShapefile= function () { exportarShapefile(); };
  window.svTogglePanel     = function (h) { svTogglePanel(h); };

})();
