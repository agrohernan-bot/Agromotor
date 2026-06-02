// ════════════════════════════════════════════════════════
// AGROMOTOR — lote-nuevo.js
// Modal "Nuevo Lote" con mapa Leaflet + polígono + superficie
// Reemplaza el flow básico de texto de amCrearLoteGlobal
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Estado interno del modal ───────────────────────────
  var _mapa     = null;   // instancia Leaflet
  var _marker   = null;   // marcador de punto
  var _poly     = null;   // polígono dibujado
  var _puntos   = [];     // puntos del polígono en construcción
  var _coords   = null;   // { lat, lng } del punto/centroide
  var _supPoly  = 0;      // superficie calculada del polígono (has)
  var _modoMapa = 'poligono';
  var _poligonoCerrado = false;
  var _editLoteId = null;

  function _distKmSimple(lat1, lon1, lat2, lon2) {
    var dLat = (lat2 - lat1) * 111;
    var dLon = (lon2 - lon1) * 111 * Math.cos(lat1 * Math.PI / 180);
    return Math.sqrt(dLat * dLat + dLon * dLon);
  }

  // ── Centro por defecto: Pampa húmeda argentina ─────────
  var DEFAULT_LAT = -34.0;
  var DEFAULT_LNG = -63.0;

  // ══════════════════════════════════════════════════════
  // MOSTRAR MODAL
  // ══════════════════════════════════════════════════════
  window.dlMostrarModalNuevoLote = function (editLoteId) {
    var limite = typeof amGetLoteLimit === 'function' ? amGetLoteLimit() : 5;
    if (!editLoteId && (window.AM_LOTES || []).length >= limite) {
      if (typeof amToast === 'function') amToast('Límite de lotes del plan alcanzado.', 'error');
      return;
    }

    // Limpiar modal previo si existe
    cerrarLimpiar(false);
    _editLoteId = editLoteId || null;

    var modal = document.createElement('div');
    modal.id = 'lnv-overlay';
    modal.className = 'lnv-overlay';
    modal.innerHTML = buildHTML(getLoteEditado());
    document.body.appendChild(modal);

    // Cerrar con click en fondo
    modal.addEventListener('click', function (e) {
      if (e.target === modal) window.dlCerrarModalLote();
    });

    // Foco en el nombre
    setTimeout(function () {
      var inp = document.getElementById('lnv-nombre');
      if (inp) inp.focus();
    }, 80);

    // Inicializar mapa
    setTimeout(initMapa, 120);
  };

  // ══════════════════════════════════════════════════════
  // HTML DEL MODAL
  // ══════════════════════════════════════════════════════
  function buildHTML(loteEdit) {
    var d = loteEdit && loteEdit.data ? loteEdit.data : {};
    var titulo = loteEdit ? 'Editar lote' : 'Nuevo lote';
    var accion = loteEdit ? 'Guardar cambios →' : 'Crear lote →';
    var cultivoOpts = [
      '<option value="">Sin definir todavía</option>',
      '<option value="Trigo">🌾 Trigo</option>',
      '<option value="Maíz">🌽 Maíz</option>',
      '<option value="Soja">🌱 Soja</option>',
      '<option value="Girasol">🌻 Girasol</option>',
      '<option value="Cebada">🌾 Cebada</option>',
      '<option value="Colza">🟡 Colza</option>',
      '<option value="Sorgo">🌾 Sorgo</option>',
    ].join('');

    return [
      '<div class="lnv-box">',

        // ── Cabecera
        '<div class="lnv-head">',
          '<div class="lnv-head-titulo">',
            '<span class="lnv-head-ico">🌍</span>',
            '<span>' + titulo + '</span>',
          '</div>',
          '<button class="lnv-close" onclick="window.dlCerrarModalLote()" title="Cerrar">✕</button>',
        '</div>',

        // ── Cuerpo
        '<div class="lnv-body">',

          // Nombre
          '<div class="lnv-fg">',
            '<label class="lnv-label">Nombre del lote <span class="lnv-req">*</span></label>',
            '<input id="lnv-nombre" class="lnv-input" type="text"',
            '  placeholder="Ej: Lote Sur, La Esperanza, Campo 3..."',
            '  value="' + escAttr(loteEdit ? loteEdit.nombre : '') + '"',
            '  autocomplete="off" oninput="this.style.borderColor=\'\'">',
          '</div>',

          // Cultivo inicial
          '<div class="lnv-fg">',
            '<label class="lnv-label">Cultivo inicial <span class="lnv-opt">(opcional)</span></label>',
            '<select id="lnv-cultivo" class="lnv-select">' + cultivoOpts + '</select>',
          '</div>',

          // Mapa
          '<div class="lnv-fg">',
            '<div class="lnv-mapa-header">',
              '<label class="lnv-label">Ubicación del lote</label>',
              '<div class="lnv-mapa-modos">',
                '<span class="lnv-modo-fijo">✏ Polígono obligatorio</span>',
              '</div>',
            '</div>',
            '<div class="lnv-mapa-hint" id="lnv-hint">Hacé click para agregar puntos al polígono. Doble-click para cerrarlo.</div>',
            '<div class="lnv-poly-controles" id="lnv-poly-controles">',
              '<button class="lnv-poly-btn" id="lnv-btn-deshacer" onclick="window.lnvDeshacer()">← Deshacer último punto</button>',
              '<button class="lnv-poly-btn lnv-poly-btn-danger" id="lnv-btn-reiniciar" onclick="window.lnvReiniciar()">↺ Reiniciar</button>',
            '</div>',
            '<div id="lnv-mapa" class="lnv-mapa"></div>',
            '<div id="lnv-coord-display" class="lnv-coord"></div>',
          '</div>',

          // Superficie
          '<div class="lnv-fg-row">',
            '<div class="lnv-fg lnv-half">',
              '<label class="lnv-label">Superficie <span class="lnv-opt">(has)</span></label>',
              '<input id="lnv-sup" class="lnv-input" type="number"',
              '  placeholder="Ej: 120" min="0.1" max="99999" step="0.1" value="' + escAttr(d.superficie || '') + '">',
            '</div>',
            '<div class="lnv-fg lnv-half" id="lnv-sup-auto-wrap" style="display:none">',
              '<label class="lnv-label">Calculada del polígono</label>',
              '<div id="lnv-sup-calc" class="lnv-sup-calc">— has</div>',
            '</div>',
          '</div>',

        '</div>', // .lnv-body

        // ── Footer
        '<div class="lnv-footer">',
          '<button class="lnv-btn-cancel" onclick="window.dlCerrarModalLote()">Cancelar</button>',
          '<button class="lnv-btn-crear" onclick="window.lnvCrearLote()">' + accion + '</button>',
        '</div>',

      '</div>', // .lnv-box
    ].join('');
  }

  // ══════════════════════════════════════════════════════
  // MAPA LEAFLET
  // ══════════════════════════════════════════════════════
  function initMapa() {
    if (typeof L === 'undefined') {
      document.getElementById('lnv-mapa').innerHTML =
        '<div style="padding:2rem;text-align:center;color:rgba(237,224,196,.4);font-size:.8rem">Mapa no disponible — ingresá las coordenadas manualmente</div>';
      return;
    }

    // Punto de partida: coordenadas del lote activo si existen
    var lat0 = DEFAULT_LAT, lng0 = DEFAULT_LNG, zoom0 = 9;
    var loteActivo = (window.AM_LOTES || []).find(function (l) {
      return l.id === window.AM_LOTE_ACTIVO;
    });
    if (loteActivo && loteActivo.data && loteActivo.data.coord) {
      var pts = String(loteActivo.data.coord).split(',');
      if (pts.length === 2) {
        var pLat = parseFloat(pts[0]), pLng = parseFloat(pts[1]);
        if (!isNaN(pLat) && !isNaN(pLng)) { lat0 = pLat; lng0 = pLng; zoom0 = 13; }
      }
    }

    _mapa = L.map('lnv-mapa', { zoomControl: true, attributionControl: false })
              .setView([lat0, lng0], zoom0);
    if (_mapa.doubleClickZoom) _mapa.doubleClickZoom.disable();

    // Imágenes satelitales Esri
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    ).addTo(_mapa);

    // Capa de etiquetas sobre satélite
    L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, opacity: 0.7 }
    ).addTo(_mapa);

    _mapa.on('click', onMapaClick);
    _mapa.on('dblclick', cerrarPoligono);
    cargarLoteEditadoEnMapa();
  }

  function actualizarBotonesControl() {
    var cont        = document.getElementById('lnv-poly-controles');
    var btnDeshacer = document.getElementById('lnv-btn-deshacer');
    var tienePuntos = _puntos.length > 0;
    if (cont)        cont.style.display        = tienePuntos ? 'flex' : 'none';
    if (btnDeshacer) btnDeshacer.style.display  = _poligonoCerrado ? 'none' : '';
  }

  function onMapaClick(e) {
    var lat = e.latlng.lat;
    var lng = e.latlng.lng;

    if (_poligonoCerrado) return;
    _puntos.push([lat, lng]);
    redibujarPoligono();
    actualizarBotonesControl();

    if (_puntos.length === 1) {
      actualizarHint('Seguí haciendo click para agregar puntos. Doble-click para cerrar.');
    }
    if (_puntos.length >= 3) {
      calcularSuperficiePoly();
    }
  }

  function actualizarMarcador(lat, lng) {
    if (_marker) _marker.remove();
    _marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: '<div class="lnv-pin"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    }).addTo(_mapa);
  }

  function redibujarPoligono() {
    if (_poly) _poly.remove();
    if (_puntos.length < 2) return;

    _poly = L.polygon(_puntos, {
      color: '#6DBF82',
      weight: 2,
      opacity: 0.9,
      fillColor: '#6DBF82',
      fillOpacity: 0.18
    }).addTo(_mapa);

  }

  function cerrarPoligono(e) {
    if (_modoMapa !== 'poligono' || _poligonoCerrado || _puntos.length < 3) return;
    if (e) L.DomEvent.stopPropagation(e);
    _poligonoCerrado = true;
    redibujarPoligono();
    calcularSuperficiePoly();
    actualizarHint('✅ Polígono cerrado. Podés ajustar la superficie o usar ↺ Reiniciar para redibujarlo.');
    actualizarBotonesControl();
  }

  window.lnvDeshacer = function () {
    if (_poligonoCerrado || _puntos.length === 0) return;
    _puntos.pop();
    redibujarPoligono();
    if (_puntos.length >= 3) {
      calcularSuperficiePoly();
    } else {
      _supPoly = 0;
      _coords  = null;
      var wrap    = document.getElementById('lnv-sup-auto-wrap');
      var coordEl = document.getElementById('lnv-coord-display');
      if (wrap)    wrap.style.display = 'none';
      if (coordEl) coordEl.innerHTML  = '';
    }
    if (_puntos.length === 0) {
      actualizarHint('Hacé click en el mapa para comenzar a dibujar el polígono.');
    }
    actualizarBotonesControl();
  };

  window.lnvReiniciar = function () {
    if (_poly) { _poly.remove(); _poly = null; }
    _puntos          = [];
    _coords          = null;
    _supPoly         = 0;
    _poligonoCerrado = false;
    var wrap    = document.getElementById('lnv-sup-auto-wrap');
    var supInp  = document.getElementById('lnv-sup');
    var coordEl = document.getElementById('lnv-coord-display');
    if (wrap)    wrap.style.display = 'none';
    if (supInp)  supInp.value       = '';
    if (coordEl) coordEl.innerHTML  = '';
    actualizarHint('Polígono eliminado. Hacé click para empezar de nuevo.');
    actualizarBotonesControl();
  };

  function calcularSuperficiePoly() {
    if (typeof turf === 'undefined' || _puntos.length < 3) return;

    try {
      var coords = _puntos.map(function (p) { return [p[1], p[0]]; });
      if (coords[0][0] !== coords[coords.length - 1][0]) coords.push(coords[0]);
      var poly = turf.polygon([coords]);
      var areaHa = turf.area(poly) / 10000;
      _supPoly = Math.round(areaHa * 10) / 10;

      // Centroide como coordenada del lote
      var centroid = turf.centroid(poly);
      _coords = {
        lat: centroid.geometry.coordinates[1].toFixed(5),
        lng: centroid.geometry.coordinates[0].toFixed(5)
      };
      actualizarCoordDisplay(_coords.lat, _coords.lng);

      // Mostrar superficie calculada
      var wrap = document.getElementById('lnv-sup-auto-wrap');
      var calc = document.getElementById('lnv-sup-calc');
      if (wrap) wrap.style.display = '';
      if (calc) calc.textContent = _supPoly + ' has';

      // Actualizar siempre el input con el área calculada del polígono
      var supInp = document.getElementById('lnv-sup');
      if (supInp) supInp.value = _supPoly;

    } catch (err) {
      console.warn('[lote-nuevo] Error calculando área:', err);
    }
  }

  function actualizarCoordDisplay(lat, lng) {
    var el = document.getElementById('lnv-coord-display');
    if (el) el.innerHTML = '📍 <strong>' + lat + ', ' + lng + '</strong>';
  }

  function actualizarHint(txt) {
    var el = document.getElementById('lnv-hint');
    if (el) el.textContent = txt;
  }

  // ── Cambio de modo mapa ───────────────────────────────
  window.lnvSetModo = function (modo) {
    _modoMapa = 'poligono';

    // Actualizar botones
    // Limpiar estado previo
    if (_marker) { _marker.remove(); _marker = null; }
    if (_poly)   { _poly.remove();   _poly   = null; }
    _puntos  = [];
    _coords  = null;
    _supPoly = 0;
    _poligonoCerrado = false;
    var wrap = document.getElementById('lnv-sup-auto-wrap');
    if (wrap) wrap.style.display = 'none';
    var coord = document.getElementById('lnv-coord-display');
    if (coord) coord.innerHTML = '';
    actualizarHint('Hacé click para agregar puntos al polígono. Doble-click para cerrarlo.');
  };

  // ══════════════════════════════════════════════════════
  // CREAR LOTE
  // ══════════════════════════════════════════════════════
  window.lnvCrearLote = function () {
    var editando = !!_editLoteId;
    var nombre  = (document.getElementById('lnv-nombre')?.value  || '').trim();
    var cultivo = (document.getElementById('lnv-cultivo')?.value || '');
    var supVal  = (document.getElementById('lnv-sup')?.value     || '');

    // Validar nombre
    if (!nombre) {
      var inp = document.getElementById('lnv-nombre');
      if (inp) {
        inp.style.borderColor = '#D4522A';
        inp.placeholder = 'El nombre es obligatorio';
        inp.focus();
      }
      return;
    }

    var coordStr = _coords ? (_coords.lat + ', ' + _coords.lng) : '';
    var supFinal = supVal || (_supPoly > 0 ? String(_supPoly) : '');
    var poligono = getPoligonoPersistible();
    if (!poligono) {
      if (typeof amToast === 'function') amToast('Dibujá el polígono del lote antes de guardar.', 'error');
      else alert('Dibujá el polígono del lote antes de guardar.');
      return;
    }

    var id = _editLoteId || ('lote_' + Date.now());
    var data = {
      cultivo:    cultivo,
      coord:      coordStr,
      superficie: supFinal,
      ts:         Date.now(),
    };
    data.polygon = poligono.puntos;
    data.geojson = poligono.geojson;

    if (_editLoteId) {
      var loteExistente = (window.AM_LOTES || []).find(function (l) { return l.id === _editLoteId; });
      if (loteExistente) {
        // Invalidar cache de suelo si el centroide se desplazó >1 km
        var prevSgLat = parseFloat((loteExistente.data || {})['sg-lat'] || 0);
        var prevSgLon = parseFloat((loteExistente.data || {})['sg-lon'] || 0);
        var newCLat   = _coords ? parseFloat(_coords.lat) : 0;
        var newCLon   = _coords ? parseFloat(_coords.lng) : 0;
        var centroideMovido = prevSgLat && newCLat &&
                              _distKmSimple(prevSgLat, prevSgLon, newCLat, newCLon) > 1;

        loteExistente.nombre = nombre;
        loteExistente.data = Object.assign({}, loteExistente.data || {}, data);

        if (centroideMovido) {
          ['sg-ts','sg-textura','sg-ph','sg-lat','sg-lon'].forEach(function(k) {
            delete loteExistente.data[k];
          });
          try { localStorage.removeItem('sg_full_' + _editLoteId); } catch(e) {}
        }
      }
    } else {
      window.AM_LOTES.push({ id: id, nombre: nombre, data: data });
    }
    window.AM_LOTE_ACTIVO = id;

    if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
    if (typeof amRenderSelectLotes  === 'function') amRenderSelectLotes();

    cerrarLimpiar(true);

    if (typeof amToast === 'function') amToast('Lote "' + nombre + '" ' + (editando ? 'actualizado' : 'creado') + ' ✓', 'ok');

    // Volver a Mis Lotes para que el usuario elija con qué lote continuar
    if (typeof window.dlVolverCards === 'function') window.dlVolverCards();
    else if (typeof window.dlRefrescar === 'function') window.dlRefrescar();
  };

  // ══════════════════════════════════════════════════════
  // CERRAR MODAL
  // ══════════════════════════════════════════════════════
  window.dlCerrarModalLote = function () {
    cerrarLimpiar(true);
  };

  function getPoligonoPersistible() {
    if (_modoMapa !== 'poligono' || _puntos.length < 3) return null;

    var puntos = _puntos.slice();
    var first = puntos[0];
    var last = puntos[puntos.length - 1];
    if (first && last && first[0] === last[0] && first[1] === last[1]) {
      puntos = puntos.slice(0, -1);
    }
    if (puntos.length < 3) return null;

    var coords = puntos.map(function (p) { return [p[1], p[0]]; });
    coords.push(coords[0]);

    return {
      puntos: puntos.map(function (p) {
        return { lat: Number(p[0].toFixed(6)), lng: Number(p[1].toFixed(6)) };
      }),
      geojson: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [coords]
        }
      }
    };
  }

  function getLoteEditado() {
    if (!_editLoteId) return null;
    return (window.AM_LOTES || []).find(function (l) { return l.id === _editLoteId; }) || null;
  }

  function cargarLoteEditadoEnMapa() {
    var lote = getLoteEditado();
    if (!lote || !lote.data) return;

    var d = lote.data;
    if (d.cultivo) {
      var cult = document.getElementById('lnv-cultivo');
      if (cult) cult.value = d.cultivo;
    }

    var coords = null;
    if (d.geojson && d.geojson.geometry && d.geojson.geometry.type === 'Polygon') {
      coords = d.geojson.geometry.coordinates[0].map(function (c) { return [c[1], c[0]]; });
      if (coords.length > 1) {
        var first = coords[0], last = coords[coords.length - 1];
        if (first[0] === last[0] && first[1] === last[1]) coords.pop();
      }
    } else if (Array.isArray(d.polygon)) {
      coords = d.polygon.map(function (p) { return [p.lat, p.lng]; });
    }

    if (coords && coords.length >= 3) {
      _modoMapa = 'poligono';
      _puntos = coords;
      _poligonoCerrado = true;
      redibujarPoligono();
      calcularSuperficiePoly();
      if (_poly) _mapa.fitBounds(_poly.getBounds().pad(0.12));
      actualizarHint('Polígono cargado. Usá ↺ Reiniciar si querés redibujarlo.');
      actualizarBotonesControl();
      return;
    }

    if (d.coord) {
      var parts = String(d.coord).split(',');
      if (parts.length === 2) {
        var lat = parseFloat(parts[0]), lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) _mapa.setView([lat, lng], 14);
      }
    }
  }

  function escAttr(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function cerrarLimpiar(removerDOM) {
    if (_mapa)   { try { _mapa.remove(); } catch(e) {} _mapa = null; }
    if (_marker) { _marker = null; }
    if (_poly)   { _poly   = null; }
    _puntos  = [];
    _coords  = null;
    _supPoly = 0;
    _poligonoCerrado = false;
    _modoMapa = 'poligono';
    _editLoteId = null;
    if (removerDOM) {
      var el = document.getElementById('lnv-overlay');
      if (el) el.remove();
    }
  }

  // ══════════════════════════════════════════════════════
  // INIT: sobreescribir dlCrearLote de dashboard-lotes.js
  // ══════════════════════════════════════════════════════
  // Se sobreescribe cuando este script carga (después de dashboard-lotes.js)
  window.dlCrearLote = function () {
    window.dlMostrarModalNuevoLote();
  };
  window.amCrearLoteGlobal = function () {
    window.dlMostrarModalNuevoLote();
  };

})();
