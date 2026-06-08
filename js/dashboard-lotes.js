// ════════════════════════════════════════════════════════
// AGROMOTOR — dashboard-lotes.js
// Nueva UX: Grid de tarjetas de lotes + Lote Hub + Hubs de módulos
// Corre sobre la arquitectura existente sin modificarla.
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── ESTADOS DE LOTE ──────────────────────────────────
  var ESTADOS = {
    vacio:        { label: 'Sin datos',       dot: 'rgba(237,224,196,.3)',  texto: '#EDE0C4' },
    planificando: { label: 'Planificando',    dot: '#7AAEF5',               texto: '#7AAEF5' },
    sembrado:     { label: 'Sembrado',        dot: '#6DBF82',               texto: '#6DBF82' },
    creciendo:    { label: 'En crecimiento',  dot: '#3A7A4A',               texto: '#6DBF82' },
    cosechando:   { label: 'Cosechando',      dot: '#C8A255',               texto: '#C8A255' },
  };

  // ── MÓDULOS COMUNES A PLANIFICACIÓN GRUESA Y FINA ─────
  // Ambas secciones tienen los mismos módulos; la diferencia
  // está en los cultivos que evalúa el score (invierno vs verano).
  var MOD_PLAN_COMUN = [
    { mod: 'siembra',          emoji: '🌱', titulo: 'Siembra',                desc: 'Fecha óptima, densidad y ambientes de siembra' },
    { mod: 'cultivares',       emoji: '🌾', titulo: 'Cultivares RECSO/INTA',   desc: 'Ranking de cultivares por zona y ciclo' },
    { mod: 'suelo',            emoji: '🌍', titulo: 'Suelo P/K/Zn',           desc: 'Análisis de suelo · IDECOR · OLM · SoilGrids ISRIC' },
    { mod: 'hidrico',          emoji: '💧', titulo: 'Balance hídrico',         desc: 'ETC FAO + ENSO/NOAA + proyección de lluvias' },
    { mod: 'nutricion',        emoji: '🌿', titulo: 'Nutrición N/P/K',         desc: 'Balance nutricional — tablas Echeverría & García INTA' },
    { mod: 'siembra-variable', emoji: '🗺', titulo: 'Siembra variable',        desc: 'Ambientes por zona · prescripción · shapefile export' },
    { mod: 'donde-comprar',    emoji: '📍', titulo: 'Dónde comprar',           desc: 'Distribuidores e insumos cercanos al lote' },
    { mod: 'fen-plan',         emoji: '📅', titulo: 'Simular fenología',       desc: 'Predicción de estadios con corrección ENSO/NOAA' },
    { mod: 'economia',         emoji: '💰', titulo: 'Presupuesto de campaña',  desc: 'Costos de insumos, maquinaria y labores' },
    { mod: 'maquinaria',       emoji: '🚜', titulo: 'Maquinaria',              desc: 'Inventario y costos de maquinaria propia o contratada' },
    { mod: 'decision',         emoji: '⚖️', titulo: '¿Qué sembrar?',          desc: 'Análisis multicriterio: rentabilidad vs. aptitud agronómica' },
    { mod: 'rotacion',         emoji: '🔄', titulo: 'Rotación',                desc: 'Planificación de rotación multiañal de cultivos' },
    { mod: 'hist-campanas',    emoji: '📊', titulo: 'Historial de campañas',   desc: 'Comparativo entre campañas anteriores del lote' },
  ];

  // ── MAPA DE SECCIONES ─────────────────────────────────
  var SECCIONES = {
    plangruesa: {
      titulo: 'Planificación Gruesa',
      emoji:  '🌽',
      desc:   'Soja · Maíz · Girasol · Sorgo — cultivos de verano',
      color:  '#2A5A8C',
      grupo:  'verano',
      modulos: MOD_PLAN_COMUN,
    },
    planfina: {
      titulo: 'Planificación Fina',
      emoji:  '🌾',
      desc:   'Trigo · Cebada · Colza — cultivos de invierno',
      color:  '#1E4D2B',
      grupo:  'invierno',
      modulos: MOD_PLAN_COMUN,
    },
    monitoreo: {
      titulo: 'Monitoreo',
      emoji:  '📡',
      desc:   'Clima · Fenología · Plagas · NDVI · Economía · Cosecha',
      color:  '#7B3F00',
      modulos: [
        { mod: 'fen-seg',          emoji: '🌿', titulo: 'Fenología en tiempo real', desc: 'Estadio actual · días transcurridos · % ciclo completado' },
        { mod: 'plagas',           emoji: '🐛', titulo: 'Plagas',                   desc: 'Umbrales de acción y favorabilidad climática por zona' },
        { mod: 'alerta-sanitaria', emoji: '🦠', titulo: 'Enfermedades',             desc: 'Alertas sanitarias por cultivo/región — umbrales INTA' },
        { mod: 'pulverizacion',    emoji: '💦', titulo: 'Ventanas de pulverización', desc: 'Análisis climatológico para aplicaciones fitosanitarias' },
        { mod: 'malezas',          emoji: '🌿', titulo: 'Malezas',                  desc: 'Manejo integrado de malezas resistentes' },
        { mod: 'mapa',             emoji: '🛰', titulo: 'Mapa / Imágenes satelitales', desc: 'Visualización geográfica del lote y capas satelitales' },
        { mod: 'economia',         emoji: '💰', titulo: 'Margen bruto real',         desc: 'Seguimiento del margen en tiempo real vs. presupuesto' },
        { mod: 'cosecha',          emoji: '🌾', titulo: 'Cosecha',                  desc: 'Estimación de rendimiento y logística de cosecha' },
        { mod: 'bitacora',         emoji: '📓', titulo: 'Bitácora de labores',       desc: 'Registro cronológico de todas las labores del lote' },
        { mod: 'huella-carbono',   emoji: '🌍', titulo: 'Huella de carbono',         desc: 'Cálculo de emisiones CO₂ del lote en la campaña' },
      ]
    }
  };

  // ── ESTADO INTERNO ────────────────────────────────────
  var _loteAbierto = null;
  var _seccionAbierta = null;
  var _modContext = null;
  var _climaCache = {};
  var _hubDataCache = {};  // keyed by loteId_month
  var _mapaInstances = {};
  var _dlClienteFiltro = null;

  var CULTIVOS_CAMPANA = {
    planfina: ['Trigo', 'Cebada', 'Colza'],
    plangruesa: ['Soja', 'Maíz', 'Girasol', 'Sorgo']
  };

  var VENTANAS_CAMPANA = {
    Trigo: {
      pampeana_norte: { primera:'1-jun al 30-jun', segunda:'1-jul al 20-jul', temprana:'15-may al 31-may', tardia:'21-jul al 10-ago' },
      pampeana_sur:   { primera:'1-may al 31-may', segunda:'1-jun al 30-jun', temprana:'15-abr al 30-abr', tardia:'1-jul al 20-jul' },
      semiarida:      { primera:'1-jun al 30-jun', segunda:'1-jul al 20-jul', temprana:'15-may al 31-may', tardia:'21-jul al 10-ago' },
      nea:            { primera:'15-jun al 15-jul', segunda:'16-jul al 10-ago', temprana:'1-jun al 14-jun', tardia:'11-ago al 31-ago' },
      noa:            { primera:'1-jun al 31-jul', segunda:'1-ago al 31-ago', temprana:'15-may al 31-may', tardia:'1-sep al 20-sep' }
    },
    Cebada: {
      pampeana_norte: { primera:'15-jun al 10-jul', segunda:'11-jul al 31-jul', temprana:'1-jun al 14-jun', tardia:'1-ago al 15-ago' },
      pampeana_sur:   { primera:'1-jun al 30-jun', segunda:'1-jul al 31-jul', temprana:'15-may al 31-may', tardia:'1-ago al 15-ago' },
      semiarida:      { primera:'15-jun al 10-jul', segunda:'11-jul al 31-jul', temprana:'1-jun al 14-jun', tardia:'1-ago al 15-ago' },
      nea:            { primera:'15-jun al 15-jul', segunda:'16-jul al 15-ago', temprana:'1-jun al 14-jun', tardia:'16-ago al 31-ago' },
      noa:            { primera:'15-jun al 31-jul', segunda:'1-ago al 31-ago', temprana:'1-jun al 14-jun', tardia:'1-sep al 30-sep' }
    },
    Colza: {
      pampeana_norte: { primera:'1-abr al 30-abr', segunda:'1-may al 15-may', temprana:'15-mar al 31-mar', tardia:'16-may al 15-jun' },
      pampeana_sur:   { primera:'1-mar al 30-abr', segunda:'1-may al 15-may', temprana:'15-feb al 28-feb', tardia:'16-may al 31-may' },
      semiarida:      { primera:'1-abr al 30-abr', segunda:'1-may al 15-may', temprana:'15-mar al 31-mar', tardia:'16-may al 15-jun' },
      nea: null,
      noa: null
    },
    Soja: {
      pampeana_norte: { primera:'15-oct al 30-nov', segunda:'1-dic al 15-ene', temprana:'1-oct al 14-oct', tardia:'16-ene al 28-feb' },
      pampeana_sur:   { primera:'1-nov al 30-nov', segunda:'1-dic al 31-dic', temprana:'15-oct al 31-oct', tardia:'1-ene al 31-ene' },
      semiarida:      { primera:'1-nov al 30-nov', segunda:'1-dic al 15-ene', temprana:'15-oct al 31-oct', tardia:'16-ene al 28-feb' },
      nea:            { primera:'1-oct al 30-nov', segunda:'1-dic al 15-ene', temprana:'15-sep al 30-sep', tardia:'16-ene al 28-feb' },
      noa:            { primera:'1-oct al 15-nov', segunda:'16-nov al 31-dic', temprana:'15-sep al 30-sep', tardia:'1-ene al 31-ene' }
    },
    'Maíz': {
      pampeana_norte: { primera:'15-sep al 31-oct', segunda:'1-nov al 30-nov', temprana:'1-sep al 14-sep', tardia:'1-dic al 31-dic' },
      pampeana_sur:   { primera:'1-oct al 15-nov', segunda:'16-nov al 30-nov', temprana:'15-sep al 30-sep', tardia:'1-dic al 15-dic' },
      semiarida:      { primera:'1-oct al 15-nov', segunda:'16-nov al 30-nov', temprana:'15-sep al 30-sep', tardia:'1-dic al 15-dic' },
      nea:            { primera:'15-sep al 31-oct', segunda:'1-nov al 30-nov', temprana:'1-sep al 14-sep', tardia:'1-dic al 15-dic' },
      noa:            { primera:'1-sep al 31-oct', segunda:'1-nov al 30-nov', temprana:'15-ago al 31-ago', tardia:'1-dic al 15-dic' }
    },
    Girasol: {
      pampeana_norte: { primera:'15-sep al 31-oct', segunda:'1-nov al 30-nov', temprana:'1-sep al 14-sep', tardia:'1-dic al 15-dic' },
      pampeana_sur:   { primera:'1-sep al 31-oct', segunda:'1-nov al 30-nov', temprana:'15-ago al 31-ago', tardia:'1-dic al 15-dic' },
      semiarida:      { primera:'15-sep al 31-oct', segunda:'1-nov al 30-nov', temprana:'1-sep al 14-sep', tardia:'1-dic al 15-dic' },
      nea:            { primera:'1-sep al 31-oct', segunda:'1-nov al 30-nov', temprana:'15-ago al 31-ago', tardia:'1-dic al 15-dic' },
      noa:            { primera:'1-sep al 31-oct', segunda:'1-nov al 30-nov', temprana:'15-ago al 31-ago', tardia:'1-dic al 15-dic' }
    },
    Sorgo: {
      pampeana_norte: { primera:'1-nov al 15-dic', segunda:'16-dic al 15-ene', temprana:'15-oct al 31-oct', tardia:'16-ene al 28-feb' },
      pampeana_sur:   { primera:'1-nov al 30-nov', segunda:'1-dic al 15-ene', temprana:'15-oct al 31-oct', tardia:'16-ene al 28-feb' },
      semiarida:      { primera:'15-nov al 15-dic', segunda:'16-dic al 31-ene', temprana:'1-nov al 14-nov', tardia:'1-feb al 28-feb' },
      nea:            { primera:'1-oct al 30-nov', segunda:'1-dic al 31-ene', temprana:'15-sep al 30-sep', tardia:'1-feb al 28-feb' },
      noa:            { primera:'1-oct al 15-nov', segunda:'16-nov al 31-dic', temprana:'15-sep al 30-sep', tardia:'1-ene al 31-ene' }
    }
  };

  var MESES_CAMPANA = { ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11 };

  // ── DETERMINAR ESTADO DEL LOTE ────────────────────────
  function getEstado(lote) {
    var d  = lote.data || {};
    var ck = d.calcKeys || {};
    var cultivo = d.cultivo || ck['am_siembra_cultivo'] || '';
    var fecha   = _fechaSiembraEfectiva(d, ck, cultivo);
    if (!cultivo && !fecha) return 'vacio';
    if (!fecha) return 'planificando';
    var hoy     = new Date();
    var fSiembra = new Date(fecha + 'T12:00:00');
    if (fSiembra > hoy) return 'planificando';
    var fen = (ck['am_fen_etapa_hoy'] || '').toLowerCase();
    if (!fen) return 'sembrado';
    if (/cosech|madur|granol|madurez|cosecha/.test(fen)) return 'cosechando';
    return 'creciendo';
  }

  // ── ESCAPING HTML ─────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── COORDENADAS DEL LOTE ─────────────────────────────
  function _normCultivoPlan(cultivo) {
    var s = String(cultivo || '').toLowerCase();
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch(e) {}
    if (/ma.z/.test(s)) return 'maiz';
    return s;
  }

  function _grupoPorCultivo(cultivo) {
    var c = _normCultivoPlan(cultivo);
    if (['trigo','cebada','colza'].indexOf(c) >= 0) return 'invierno';
    if (['soja','maiz','girasol','sorgo'].indexOf(c) >= 0) return 'verano';
    return '';
  }

  function _fechaSiembraEfectiva(d, ck, cultivo) {
    d = d || {};
    ck = ck || {};
    var planes = d.planificacionSiembra || {};
    var grupo = _grupoPorCultivo(cultivo || d.cultivo || ck['am_siembra_cultivo'] || '');
    var planGrupo = grupo ? (planes[grupo] || {}) : {};
    return planGrupo.fechaSiembraConf || planGrupo.fechaSiembraPlan
      || d.fechaSiembraConf || d.fechaSiembraPlan || d.fechaSiembra || d.fecha || ck['am_siembra_fecha'] || ''
      || (planes.invierno && (planes.invierno.fechaSiembraConf || planes.invierno.fechaSiembraPlan)) || ''
      || (planes.verano && (planes.verano.fechaSiembraConf || planes.verano.fechaSiembraPlan)) || '';
  }

  function _coordsFromLote(lote) {
    var d = lote.data || {};
    if (Array.isArray(d.polygon) && d.polygon.length > 0) {
      var sLat = 0, sLng = 0;
      d.polygon.forEach(function(p) { sLat += p.lat; sLng += p.lng; });
      return { lat: sLat / d.polygon.length, lng: sLng / d.polygon.length };
    }
    if (d.geojson && d.geojson.geometry && Array.isArray(d.geojson.geometry.coordinates)) {
      var ring = d.geojson.geometry.coordinates[0] || [];
      if (ring.length > 0) {
        var rLat = 0, rLng = 0;
        ring.forEach(function(c) { rLat += c[1]; rLng += c[0]; });
        return { lat: rLat / ring.length, lng: rLng / ring.length };
      }
    }
    if (d.coord) {
      var parts = String(d.coord).split(',');
      if (parts.length === 2) {
        var lat = parseFloat(parts[0]), lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) return { lat: lat, lng: lng };
      }
    }
    return null;
  }

  function _zonaCampana(lote) {
    var coords = _coordsFromLote(lote);
    if (!coords) return 'pampeana_norte';
    var lat = parseFloat(coords.lat);
    if (isNaN(lat)) return 'pampeana_norte';
    if (typeof window.CV_ZONAS !== 'undefined') {
      for (var z in window.CV_ZONAS) {
        if (!Object.prototype.hasOwnProperty.call(window.CV_ZONAS, z)) continue;
        var cfg = window.CV_ZONAS[z];
        if (cfg && lat >= cfg.latMin && lat <= cfg.latMax) return z;
      }
    }
    if (lat > -29) return 'noa';
    if (lat < -39) return 'pampeana_sur';
    return 'pampeana_norte';
  }

  function _parseFechaVentana(str) {
    if (!str) return null;
    var p = String(str).trim().split('-');
    var dia = parseInt(p[0], 10);
    var mes = MESES_CAMPANA[p[1] && p[1].toLowerCase()];
    return (isNaN(dia) || mes === undefined) ? null : { dia: dia, mes: mes };
  }

  function _partesVentana(str) {
    if (!str) return null;
    var p = String(str).split(' al ');
    if (p.length !== 2) return null;
    return { ini: p[0], fin: p[1] };
  }

  function _cierreCampana(secKey, zona, baseYear) {
    var cultivos = CULTIVOS_CAMPANA[secKey] || [];
    var esGruesa = secKey === 'plangruesa';
    var cierre = null;
    cultivos.forEach(function(cultivo) {
      var porZona = VENTANAS_CAMPANA[cultivo] && VENTANAS_CAMPANA[cultivo][zona];
      if (!porZona) return;
      Object.keys(porZona).forEach(function(k) {
        var partes = _partesVentana(porZona[k]);
        if (!partes) return;
        var ini = _parseFechaVentana(partes.ini);
        var fin = _parseFechaVentana(partes.fin);
        if (!ini || !fin) return;
        var finYear = baseYear;
        if (esGruesa && fin.mes <= 1) finYear += 1;
        if (!esGruesa && fin.mes < ini.mes) finYear += 1;
        var f = new Date(finYear, fin.mes, fin.dia, 23, 59, 59, 999);
        if (!cierre || f > cierre) cierre = f;
      });
    });
    return cierre;
  }

  function getCampanaPlanificacion(lote, secKey, fechaBase) {
    if (secKey !== 'planfina' && secKey !== 'plangruesa') return null;
    var hoy = fechaBase ? new Date(fechaBase) : new Date();
    if (isNaN(hoy.getTime())) hoy = new Date();
    var zona = _zonaCampana(lote);
    var year = hoy.getFullYear();

    if (secKey === 'planfina') {
      var cierreFina = _cierreCampana(secKey, zona, year);
      var campYear = cierreFina && hoy > cierreFina ? year + 1 : year;
      return {
        tipo: 'fina',
        label: String(campYear),
        clave: 'fina-' + campYear,
        zona: zona,
        cierre: cierreFina
      };
    }

    var baseYear = hoy.getMonth() <= 1 ? year - 1 : year;
    var cierreGruesa = _cierreCampana(secKey, zona, baseYear);
    if (cierreGruesa && hoy > cierreGruesa) {
      baseYear += 1;
      cierreGruesa = _cierreCampana(secKey, zona, baseYear);
    }
    return {
      tipo: 'gruesa',
      label: baseYear + '/' + (baseYear + 1),
      clave: 'gruesa-' + baseYear + '-' + (baseYear + 1),
      zona: zona,
      cierre: cierreGruesa
    };
  }

  function tituloSeccion(lote, secKey) {
    var sec = SECCIONES[secKey];
    if (!sec) return '';
    if (!lote) return sec.titulo;
    var camp = getCampanaPlanificacion(lote, secKey);
    return camp ? (sec.titulo + ' ' + camp.label) : sec.titulo;
  }

  // ── RENDER PANEL RAÍZ ─────────────────────────────────
  function renderPanel() {
    var panel = document.getElementById('mod-lotes');
    if (!panel) return;

    _destroyMiniMaps();
    if (_seccionAbierta && _loteAbierto) {
      panel.innerHTML = renderSeccion(_loteAbierto, _seccionAbierta);
      if (_seccionAbierta === 'monitoreo') {
        var _loteMon = _loteAbierto;
        setTimeout(function() {
          _fetchHubData(_loteMon);
        }, 50);
      }
    } else if (_loteAbierto) {
      panel.innerHTML = renderHub(_loteAbierto);
      var _loteHub = _loteAbierto;
      setTimeout(function() {
        _fetchLugar(_loteHub);
      }, 50);
    } else {
      panel.innerHTML = renderCards();
      var lotes = window.AM_LOTES || [];
      setTimeout(function() {
        _initMiniMaps(lotes);
        _fetchClimaCards(lotes);
        _fetchSueloCards(lotes);
      }, 30);
    }
    actualizarBotonVolverNuevaUX();
  }

  function actualizarBotonVolverNuevaUX() {
    var btnVolver = document.getElementById('btn-volver-dash');
    if (!btnVolver || document.body.classList.contains('dl-modo-clasico')) return;
    if (_seccionAbierta && _loteAbierto) {
      var lote = getLote(_loteAbierto);
      var nombre = lote && lote.nombre ? lote.nombre : 'lote';
      btnVolver.classList.remove('hidden');
      btnVolver.textContent = '← Volver a ' + nombre;
      btnVolver.title = 'Volver al hub del lote';
      btnVolver.onclick = function () { window.dlAbrirLote(_loteAbierto); };
    } else {
      btnVolver.classList.add('hidden');
      btnVolver.onclick = function () {
        if (window.dlVolverAnterior) window.dlVolverAnterior();
        else if (typeof switchMod === 'function') switchMod('lotes');
      };
    }
  }

  // ══════════════════════════════════════════════════════
  // PANTALLA 1: GRID DE TARJETAS
  // ══════════════════════════════════════════════════════
  function renderCards() {
    var lotes  = window.AM_LOTES || [];
    var limite = typeof amGetLoteLimit === 'function' ? amGetLoteLimit() : 5;

    var html = '<div class="dl-page dl-page-cards">';

    // ── Cabecera ─────────────────────────────────────────
    html += '<div class="dl-page-header">';
    html +=   '<div>';
    html +=     '<h1 class="dl-page-titulo">Mis Lotes</h1>';
    // Mostrar contador solo si hay sesión activa (limite > 1 = logueado)
    var contadorTxt = (limite > 1)
      ? lotes.length + ' / ' + limite + ' lotes'
      : lotes.length + (lotes.length === 1 ? ' lote' : ' lotes');
    html +=     '<p class="dl-page-sub">Seleccioná un lote para trabajar · <span id="dl-counter">' + contadorTxt + '</span></p>';
    html +=   '</div>';
    html +=   '<div class="dl-header-actions">';
    html +=     '<button class="dl-btn-nuevo" onclick="window.dlCrearLote()">➕ Nuevo lote</button>';
    html +=     '<button class="dl-btn-clasica" onclick="window.amMostrarModalClientes && window.amMostrarModalClientes()" title="Gestionar clientes">Clientes</button>';
    html +=   '</div>';
    html += '</div>';

    var clientesUnicos = {};
    lotes.forEach(function (l) {
      var cn = (l.data && l.data.clienteNombre) ? l.data.clienteNombre.trim() : '';
      clientesUnicos[cn] = (clientesUnicos[cn] || 0) + 1;
    });
    var nomClientes = Object.keys(clientesUnicos);
    var hayFiltros = nomClientes.length > 1 || (nomClientes.length === 1 && nomClientes[0] !== '');
    if (hayFiltros) {
      html += '<div class="dl-cliente-filtros">';
      html += '<button class="am-chip' + (_dlClienteFiltro === null ? ' am-chip-active' : '') + '" onclick="window._dlFiltrar(null)">Todos (' + lotes.length + ')</button>';
      nomClientes.slice().sort(function(a,b){ if(!a)return 1;if(!b)return -1;return a.localeCompare(b,'es'); }).forEach(function(cn) {
        var activo = _dlClienteFiltro === cn;
        html += '<button class="am-chip' + (activo ? ' am-chip-active' : '') + '" onclick="window._dlFiltrar(\'' + esc(cn).replace(/'/g,"\\'") + '\')">' + esc(cn || 'Sin cliente') + ' (' + clientesUnicos[cn] + ')</button>';
      });
      html += '</div>';
    }

    var lotesRender = lotes;
    if (_dlClienteFiltro !== null) {
      lotesRender = lotes.filter(function (l) {
        return ((l.data && l.data.clienteNombre) ? l.data.clienteNombre.trim() : '') === _dlClienteFiltro;
      });
    }

    // ── Aviso de login si no hay sesión ──────────────────
    if (!window.AM_SESION) {
      html += '<div class="dl-login-aviso">';
      html += '<span>🔑 ¿Ya tenés cuenta? Tus lotes están guardados.</span>';
      html += '<button class="dl-btn-login" onclick="window.amMostrarModal && window.amMostrarModal(\'login\')">Iniciá sesión para verlos →</button>';
      html += '</div>';
    }

    // ── Grid de cards ─────────────────────────────────────
    html += '<div class="dl-grid">';

    lotesRender.forEach(function (lote) {
      html += renderCard(lote);
    });

    // Slots vacíos hasta el límite (máx 6 en pantalla)
    var slots = Math.min(limite, 6) - lotes.length;
    for (var i = 0; i < slots; i++) {
      html += '<div class="dl-card dl-card-slot" onclick="window.dlCrearLote()">';
      html +=   '<div class="dl-slot-inner"><span class="dl-slot-ico">＋</span><span class="dl-slot-txt">Nuevo lote</span></div>';
      html += '</div>';
    }

    html += '</div>'; // .dl-grid
    html += '</div>'; // .dl-page

    return html;
  }

  function renderCard(lote) {
    var d        = lote.data || {};
    var ck       = d.calcKeys || {};
    var estado   = getEstado(lote);
    var eConf    = ESTADOS[estado];
    var cultivo  = d.cultivo || ck['am_siembra_cultivo'] || '';
    var fecha    = _fechaSiembraEfectiva(d, ck, cultivo);
    var fenEtapa = ck['am_fen_etapa_hoy'] || '';
    var aguaMm   = parseFloat(ck['am_hidrico_agua_actual_mm']) || 0;
    var aguaCC   = parseFloat(ck['am_hidrico_cap_max_mm']) || 0;
    var sup      = d.superficie || '';
    // Recalcular desde el GeoJSON guardado para corregir valores históricos incorrectos
    if (typeof turf !== 'undefined' && d.geojson && d.geojson.geometry) {
      try {
        var areaHa = Math.round(turf.area(d.geojson) / 10000 * 10) / 10;
        if (areaHa > 0) sup = String(areaHa);
      } catch(_e) {}
    }
    var sueloTex = d['sg-textura'] || ck['am_siembra_suelo'] || '';
    var alertas  = 0;
    try { alertas = (JSON.parse(ck['am_alertas_activas'] || '[]') || []).length; } catch(e) {}
    var isActivo   = lote.id === window.AM_LOTE_ACTIVO;
    var hasPolygon = (Array.isArray(d.polygon) && d.polygon.length > 2) ||
                     !!(d.geojson && d.geojson.geometry);
    var coords     = _coordsFromLote(lote);

    var html = '<div class="dl-card' + (isActivo ? ' dl-card-activa' : '') + '" onclick="window.dlAbrirLote(\'' + esc(lote.id) + '\')">';

    html += '<div class="dl-card-actions" onclick="event.stopPropagation()">';
    html +=   '<button class="dl-card-action" onclick="window.dlEditarLote(\'' + esc(lote.id) + '\')" title="Editar lote">✎</button>';
    html +=   '<button class="dl-card-action dl-card-action-danger" onclick="window.dlEliminarLote(\'' + esc(lote.id) + '\')" title="Eliminar lote">🗑</button>';
    html += '</div>';

    // Thumbnail satelital — solo si hay polígono dibujado
    if (hasPolygon) {
      html += '<div class="dl-card-mapa" id="dl-mapa-' + esc(lote.id) + '"></div>';
    }

    // Cabecera de card
    html += '<div class="dl-card-head">';
    html +=   '<div class="dl-card-nombre"><span class="dl-dot" style="background:' + eConf.dot + '"></span>' + esc(lote.nombre) + '</div>';
    if (alertas > 0) html += '<div class="dl-alerta-badge">⚠ ' + alertas + '</div>';
    if (isActivo)    html += '<div class="dl-activo-chip">activo</div>';
    html += '</div>';

    // Estado
    html += '<div class="dl-card-estado" style="color:' + eConf.texto + '">' + eConf.label + '</div>';

    // Cuerpo de la card: datos de suelo/clima siempre que estén disponibles;
    // cultivo/fecha/fenología solo aparecen una vez planificado.
    var tieneDatos = sup || sueloTex || coords || aguaCC > 0;
    html += '<div class="dl-card-body">';
    if (cultivo)  html += kv('🌾 Cultivo', cultivo);
    if (fecha)    html += kv('📅 Siembra', fecha);
    if (fenEtapa) html += kv('🌱 Etapa',   fenEtapa);
    if (sup)      html += kv('📐 Área',    sup + ' ha');
    if (sueloTex) html += kv('🌍 Suelo',   sueloTex);
    if (aguaCC > 0) {
      var pct = Math.min(100, Math.round(aguaMm / aguaCC * 100));
      var bcolor = pct < 30 ? '#D4522A' : pct < 60 ? '#C8A255' : '#6DBF82';
      html += '<div class="dl-hidrico">';
      html +=   '<div class="dl-hidrico-top"><span>💧 Humedad suelo</span><strong style="color:' + bcolor + '">' + pct + '%</strong></div>';
      html +=   '<div class="dl-hidrico-bar"><div class="dl-hidrico-fill" style="width:' + pct + '%;background:' + bcolor + '"></div></div>';
      html += '</div>';
    }
    if (coords) html += '<div id="dl-clima-' + esc(lote.id) + '"></div>';
    html += renderBarraCiclo(ck, fecha);
    if (!tieneDatos && estado === 'vacio') {
      html += '<div class="dl-card-empty">Tocá para comenzar a planificar este lote</div>';
    }
    html += '</div>';

    // Footer con flecha
    html += '<div class="dl-card-footer">Ver lote →</div>';
    html += '</div>'; // .dl-card

    return html;
  }

  function kv(k, v) {
    return '<div class="dl-kv"><span class="dl-kv-k">' + esc(k) + '</span><span class="dl-kv-v">' + esc(v) + '</span></div>';
  }

  // ══════════════════════════════════════════════════════
  // PANTALLA 2: LOTE HUB
  // ══════════════════════════════════════════════════════
  function renderHub(loteId) {
    var lote = getLote(loteId);
    if (!lote) return '';

    var d       = lote.data || {};
    var ck      = d.calcKeys || {};
    var estado  = getEstado(lote);
    var eConf   = ESTADOS[estado];
    var cultivo = d.cultivo || ck['am_siembra_cultivo'] || '';
    var coord   = d.coord   || '';
    var sup     = d.superficie || '';
    // Recalcular desde GeoJSON para corregir valores históricos incorrectos
    if (typeof turf !== 'undefined' && d.geojson && d.geojson.geometry) {
      try {
        var areaHa = Math.round(turf.area(d.geojson) / 10000 * 10) / 10;
        if (areaHa > 0) sup = String(areaHa);
      } catch(_e) {}
    }
    d.campanasActivas = d.campanasActivas || {};
    ['plangruesa', 'planfina'].forEach(function(key) {
      var camp = getCampanaPlanificacion(lote, key);
      if (camp) d.campanasActivas[key] = camp.clave;
    });

    var html = '<div class="dl-page dl-page-hub">';

    // Breadcrumb
    html += breadcrumb([{ label: 'Mis Lotes', onclick: 'window.dlVolverCards()' }], lote.nombre);

    // Header del lote
    html += '<div class="dl-hub-header">';
    html +=   '<div class="dl-hub-nombre"><span class="dl-dot dl-dot-lg" style="background:' + eConf.dot + '"></span>' + esc(lote.nombre) + '</div>';
    html +=   '<div class="dl-hub-chips">';
    if (cultivo) html += chip('🌾 ' + cultivo, 'lg');
    html +=     chip('<span style="color:' + eConf.texto + '">' + eConf.label + '</span>', 'lg');
    if (sup)    html += chip('📐 ' + esc(sup) + ' has', 'lg');
    // Lugar: usar caché en lote.data o placeholder para fetch async
    var lugarGuardado = d['geo-lugar'] || '';
    html +=   '<span class="dl-chip dl-chip-lugar" id="dl-hub-lugar-' + esc(loteId) + '">' +
                (lugarGuardado ? '📍 ' + esc(lugarGuardado) : '📍&hairsp;<span class="dl-lugar-cargando">···</span>') +
              '</span>';
    html +=   '</div>';

    // Acciones rápidas del lote
    html +=   '<div class="dl-hub-acciones">';
    html +=     '<button class="dl-hub-accion" onclick="window.dlEditarLote(\'' + esc(loteId) + '\')" title="Editar lote">✎ Editar</button>';
    html +=     '<button class="dl-hub-accion dl-hub-accion-danger" onclick="window.dlEliminarLote(\'' + esc(loteId) + '\')" title="Eliminar lote">🗑 Eliminar</button>';
    html +=   '</div>';
    html += '</div>';

    // 3 botones grandes
    html += '<div class="dl-hub-grid">';
    Object.keys(SECCIONES).forEach(function (key) {
      var s = SECCIONES[key];
      var titulo = tituloSeccion(lote, key);
      html += hubBtn(key, s.emoji, titulo, s.desc, s.color);
    });
    html += '</div>';

    html += '</div>'; // .dl-page
    return html;
  }

  function hubBtn(key, emoji, titulo, desc, color) {
    return [
      '<div class="dl-hub-btn" onclick="window.dlAbrirSeccion(\'' + key + '\')" style="--hub-color:' + color + '">',
        '<div class="dl-hub-emoji">' + emoji + '</div>',
        '<div class="dl-hub-info">',
          '<div class="dl-hub-titulo">' + titulo + '</div>',
          '<div class="dl-hub-desc">' + desc + '</div>',
        '</div>',
        '<div class="dl-hub-arrow">→</div>',
      '</div>'
    ].join('');
  }

  // ══════════════════════════════════════════════════════
  // PANTALLA 3: SECCIÓN (lista de módulos)
  // ══════════════════════════════════════════════════════
  function renderSeccion(loteId, secKey) {
    var lote = getLote(loteId);
    var sec  = SECCIONES[secKey];
    if (!lote || !sec) return '';
    var titulo = tituloSeccion(lote, secKey);
    var camp = getCampanaPlanificacion(lote, secKey);
    if (camp) {
      lote.data = lote.data || {};
      lote.data.campanasActivas = lote.data.campanasActivas || {};
      lote.data.campanasActivas[secKey] = camp.clave;
    }

    var html = '<div class="dl-page dl-page-sec">';

    // Header sección
    html += '<div class="dl-sec-header" style="border-left-color:' + sec.color + '">';
    html +=   '<span class="dl-sec-emoji">' + sec.emoji + '</span>';
    html +=   '<span class="dl-sec-titulo">' + titulo + '</span>';
    html += '</div>';

    // Widgets contextuales según sección
    if (secKey === 'monitoreo') {
      html += renderWidgetPlanFina(lote);
      html += renderFenologiaMonitoreo(lote);
      html += renderWidgetMonitoreo(lote);
      html += renderSanidadMonitoreo(lote);
      html += renderDatosLotePanel(loteId);
    }
    if (secKey === 'planfina' || secKey === 'plangruesa') {
      html += renderWidgetPlanFina(lote);
      // Score de cultivos filtrado por grupo (invierno / verano)
      if (typeof window.dlRenderScoreCultivares === 'function') {
        html += window.dlRenderScoreCultivares(lote, sec.grupo || '');
      }
      // Widget de operativa de siembra (ventana, duración, análisis)
      if (typeof window.spRender === 'function') {
        html += window.spRender(lote, sec.grupo || '');
      }
    }

    // Grid de módulos
    html += '<div class="dl-modulos-grid">';
    sec.modulos.forEach(function (m) {
      if (secKey === 'monitoreo' && m.mod === 'fen-seg') return;
      html += '<div class="dl-modulo-card" onclick="window.dlAbrirModulo(\'' + m.mod + '\',\'' + esc(loteId) + '\')">';
      html +=   '<div class="dl-mod-emoji">' + m.emoji + '</div>';
      html +=   '<div class="dl-mod-cuerpo">';
      html +=     '<div class="dl-mod-titulo">' + m.titulo + '</div>';
      html +=     '<div class="dl-mod-desc">' + m.desc + '</div>';
      html +=   '</div>';
      html +=   '<div class="dl-mod-arrow">→</div>';
      html += '</div>';
    });
    html += '</div>'; // .dl-modulos-grid

    html += '</div>'; // .dl-page
    return html;
  }

  function renderDatosLotePanel(loteId) {
    var html = '<div class="dl-hub-datos" id="dl-hub-datos-' + esc(loteId) + '">';
    html +=   '<div class="dl-hub-datos-loading">';
    html +=     '<span class="dl-hub-datos-spinner">⟳</span> Cargando datos del lote...';
    html +=   '</div>';
    html += '</div>';
    return html;
  }

  // ══════════════════════════════════════════════════════
  // WIDGETS DE DATOS EN TIEMPO REAL
  // ══════════════════════════════════════════════════════

  // ── Panel de estado para Monitoreo ────────────────────
  var FEN_ETAPAS_MON = {
    soja: [
      { label: 'Emergencia', pct: 6, color: '#B8E6B0' },
      { label: 'Vegetativo', pct: 30, color: '#6DBF82' },
      { label: 'Floracion', pct: 17, color: '#FFB800' },
      { label: 'Llenado', pct: 22, color: '#E8860A' },
      { label: 'Madurez', pct: 25, color: '#8A4A18' }
    ],
    maiz: [
      { label: 'Emergencia', pct: 5, color: '#B8E6B0' },
      { label: 'Vegetativo', pct: 35, color: '#6DBF82' },
      { label: 'Floracion', pct: 8, color: '#FFB800' },
      { label: 'Llenado', pct: 40, color: '#E8860A' },
      { label: 'Madurez', pct: 12, color: '#8A4A18' }
    ],
    trigo: [
      { label: 'Germinacion', pct: 8, color: '#B8E6B0' },
      { label: 'Macollaje', pct: 18, color: '#6DBF82' },
      { label: 'Encaniado', pct: 18, color: '#FFDD66' },
      { label: 'Espigazon', pct: 10, color: '#FFB800' },
      { label: 'Llenado', pct: 32, color: '#E8860A' },
      { label: 'Madurez', pct: 14, color: '#8A4A18' }
    ],
    cebada: [
      { label: 'Germinacion', pct: 7, color: '#B8E6B0' },
      { label: 'Macollaje', pct: 18, color: '#6DBF82' },
      { label: 'Encaniado', pct: 20, color: '#FFDD66' },
      { label: 'Espigazon', pct: 10, color: '#FFB800' },
      { label: 'Llenado', pct: 31, color: '#E8860A' },
      { label: 'Madurez', pct: 14, color: '#8A4A18' }
    ],
    girasol: [
      { label: 'Emergencia', pct: 8, color: '#B8E6B0' },
      { label: 'Vegetativo', pct: 28, color: '#6DBF82' },
      { label: 'Boton floral', pct: 12, color: '#FFDD66' },
      { label: 'Floracion', pct: 15, color: '#FFB800' },
      { label: 'Llenado', pct: 24, color: '#E8860A' },
      { label: 'Madurez', pct: 13, color: '#8A4A18' }
    ],
    sorgo: [
      { label: 'Emergencia', pct: 6, color: '#B8E6B0' },
      { label: 'Vegetativo', pct: 28, color: '#6DBF82' },
      { label: 'Encaniado', pct: 15, color: '#FFDD66' },
      { label: 'Floracion', pct: 10, color: '#FFB800' },
      { label: 'Llenado', pct: 18, color: '#E8860A' },
      { label: 'Madurez', pct: 23, color: '#8A4A18' }
    ],
    colza: [
      { label: 'Emergencia', pct: 8, color: '#B8E6B0' },
      { label: 'Roseta', pct: 24, color: '#6DBF82' },
      { label: 'Elongacion', pct: 20, color: '#FFDD66' },
      { label: 'Floracion', pct: 18, color: '#FFB800' },
      { label: 'Llenado', pct: 18, color: '#E8860A' },
      { label: 'Madurez', pct: 12, color: '#8A4A18' }
    ]
  };

  var FEN_CICLO_DEFAULT_MON = {
    soja: 150, maiz: 150, trigo: 190, cebada: 180, girasol: 130, sorgo: 140, colza: 170
  };

  function normCultivoFen(cultivo) {
    var s = (cultivo || '').toLowerCase();
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch(e) {}
    if (s.indexOf('maiz') >= 0) return 'maiz';
    if (s.indexOf('trigo') >= 0) return 'trigo';
    if (s.indexOf('cebada') >= 0) return 'cebada';
    if (s.indexOf('girasol') >= 0) return 'girasol';
    if (s.indexOf('sorgo') >= 0) return 'sorgo';
    if (s.indexOf('colza') >= 0) return 'colza';
    if (s.indexOf('soja') >= 0) return 'soja';
    return '';
  }

  function diasDesdeIso(fechaISO) {
    if (!fechaISO) return null;
    var d = new Date(fechaISO + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    var hoy = new Date();
    hoy.setHours(12, 0, 0, 0);
    return Math.round((hoy - d) / 86400000);
  }

  function fmtFechaCorta(fechaISO) {
    if (!fechaISO) return '';
    var p = String(fechaISO).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : fechaISO;
  }

  function etapaPorPct(etapas, pctHoy) {
    var acum = 0;
    for (var i = 0; i < etapas.length; i++) {
      acum += etapas[i].pct;
      if (pctHoy <= acum) return { actual: etapas[i], idx: i };
    }
    return { actual: etapas[etapas.length - 1], idx: etapas.length - 1 };
  }

  function renderFenologiaMonitoreo(lote) {
    var d  = lote.data || {};
    var ck = d.calcKeys || {};
    var cultivo = d.cultivo || ck['am_siembra_cultivo'] || '';
    var fechaSiembra = _fechaSiembraEfectiva(d, ck, cultivo);
    var key = normCultivoFen(cultivo);
    var etapas = key ? FEN_ETAPAS_MON[key] : null;
    var ciclo = parseFloat(ck['am_fen_duracion_ciclo']) || (key ? FEN_CICLO_DEFAULT_MON[key] : 0);
    var etapaGuardada = ck['am_fen_etapa_hoy'] || '';
    var finEtapa = ck['am_fen_fecha_etapa_fin'] || '';

    if (!cultivo || !fechaSiembra || !etapas || ciclo <= 0) {
      var falta = !cultivo ? 'cultivo' : (!fechaSiembra ? 'fecha de siembra' : 'cultivo compatible');
      return [
        '<div class="dlw-panel dlw-fen-panel dlw-fen-empty">',
          '<div class="dlw-panel-titulo">Fenologia del cultivo</div>',
          '<div class="dlw-fen-empty-title">Sin grafica fenologica activa</div>',
          '<div class="dlw-meta">Falta ' + esc(falta) + ' para ubicar el cultivo en el ciclo.</div>',
        '</div>'
      ].join('');
    }

    var dias = diasDesdeIso(fechaSiembra);
    if (dias === null || dias < 0) dias = 0;
    var pctHoy = Math.min(100, Math.max(0, dias / ciclo * 100));
    var pctRound = Math.round(pctHoy);
    var ep = etapaPorPct(etapas, pctHoy);
    var etapaActual = etapaGuardada || (ep.actual ? ep.actual.label : '');
    var diasRestantes = Math.max(0, Math.round(ciclo - dias));

    var html = '<div class="dlw-panel dlw-fen-panel">';
    html += '<div class="dlw-fen-head">';
    html +=   '<div>';
    html +=     '<div class="dlw-panel-titulo">Fenologia del cultivo</div>';
    html +=     '<div class="dlw-fen-stage">' + esc(etapaActual || 'Seguimiento activo') + '</div>';
    html +=   '</div>';
    html +=   '<div class="dlw-fen-actions">';
    html +=     '<div class="dlw-fen-pct">' + pctRound + '%</div>';
    html +=     '<button type="button" class="dlw-fen-more" onclick="window.dlAbrirFenologiaDetalle && window.dlAbrirFenologiaDetalle(\'' + esc(lote.id) + '\')">Más detalles</button>';
    html +=   '</div>';
    html += '</div>';
    html += '<div class="dlw-fen-kpis">';
    html +=   '<span>' + esc(cultivo) + '</span>';
    html +=   '<span>Siembra ' + esc(fmtFechaCorta(fechaSiembra)) + '</span>';
    html +=   '<span>Dia ' + Math.round(dias) + ' / ' + Math.round(ciclo) + '</span>';
    if (diasRestantes > 0) html += '<span>Restan ~' + diasRestantes + ' d</span>';
    html += '</div>';
    html += '<div class="dlw-fen-track-wrap"><div class="dlw-fen-track">';
    etapas.forEach(function(e, idx) {
      var cls = 'dlw-fen-seg' + (idx === etapas.length - 1 ? ' dlw-fen-seg-last' : '');
      var segLabel = e.pct >= 10 ? esc(e.label) : '';
      html += '<div class="' + cls + '" style="width:' + e.pct + '%;background:' + e.color + '"><span>' + segLabel + '</span></div>';
    });
    html += '<div class="dlw-fen-marker" style="left:' + pctRound + '%"><span>Hoy</span></div>';
    html += '</div></div>';
    html += '<div class="dlw-fen-foot">';
    if (finEtapa) html += '<span>Proxima etapa estimada: ' + esc(finEtapa) + '</span>';
    else if (ep.idx < etapas.length - 1) html += '<span>Proxima etapa: ' + esc(etapas[ep.idx + 1].label) + '</span>';
    else html += '<span>Ciclo en tramo final</span>';
    html += '</div></div>';
    return html;
  }

  function renderWidgetMonitoreo(lote) {
    var d  = lote.data || {};
    var ck = d.calcKeys || {};

    var fenEtapa     = ck['am_fen_etapa_hoy']       || '';
    var fenFechaFin  = ck['am_fen_fecha_etapa_fin']  || '';
    var fenDurCiclo  = parseFloat(ck['am_fen_duracion_ciclo']) || 0;
    var cultivo      = d.cultivo || ck['am_siembra_cultivo']   || '';
    var fechaSiembra = _fechaSiembraEfectiva(d, ck, cultivo);
    var aguaMm       = parseFloat(ck['am_hidrico_agua_actual_mm'])  || 0;
    var aguaCC       = parseFloat(ck['am_hidrico_cap_max_mm'])      || 0;
    var deficitAcum  = parseFloat(ck['am_hidrico_deficit_acum_mm']) || 0;
    var diasEstres   = parseFloat(ck['am_hidrico_dias_estres'])     || 0;
    var ensoFase     = ck['am_enso_fase'] || '';
    var alertas      = [];
    try { alertas = JSON.parse(ck['am_alertas_activas'] || '[]'); } catch(e) {}
    if (!Array.isArray(alertas)) alertas = [];

    // Verificar si hay datos suficientes para mostrar el panel
    var tieneDatos = (aguaCC > 0) || ensoFase || alertas.length > 0;
    if (!tieneDatos) return '';

    // Calcular % del ciclo
    var pctCiclo = 0;
    var diasTranscurridos = 0;
    if (fechaSiembra && fenDurCiclo > 0) {
      var hoy     = new Date();
      var siembra = new Date(fechaSiembra + 'T12:00:00');
      diasTranscurridos = Math.max(0, Math.round((hoy - siembra) / 86400000));
      pctCiclo = Math.min(100, Math.round(diasTranscurridos / fenDurCiclo * 100));
    }

    // Estado hídrico
    var pctAgua   = aguaCC > 0 ? Math.min(100, Math.round(aguaMm / aguaCC * 100)) : -1;
    var colorAgua = pctAgua < 30 ? '#D4522A' : pctAgua < 55 ? '#C8A255' : '#6DBF82';
    var labelAgua = pctAgua < 30 ? 'Déficit severo' : pctAgua < 55 ? 'Bajo estrés' : 'Bien hidratado';

    // ENSO
    var ensoColor = ensoFase.includes('Niño') ? '#E87A5A' : ensoFase.includes('Niña') ? '#7AAEF5' : '#C8A255';
    var ensoIco   = ensoFase.includes('Niño') ? '🌡️' : ensoFase.includes('Niña') ? '🌬️' : '⚖️';

    var html = '<div class="dlw-panel">';

    // Título del panel
    html += '<div class="dlw-panel-titulo">📊 Estado actual del lote</div>';
    html += '<div class="dlw-grid">';

    // Fenología
    if (false && (fenEtapa || pctCiclo > 0)) {
      html += '<div class="dlw-card">';
      html +=   '<div class="dlw-card-titulo">🌱 Fenología</div>';
      if (fenEtapa) html += '<div class="dlw-valor">' + esc(fenEtapa) + '</div>';
      if (cultivo)  html += '<div class="dlw-meta">' + esc(cultivo) + (fechaSiembra ? ' · sembrado ' + fechaSiembra : '') + '</div>';
      if (pctCiclo > 0) {
        html += '<div class="dlw-barra-wrap">';
        html +=   '<div class="dlw-barra-label"><span>Ciclo</span><span style="color:#6DBF82">' + pctCiclo + '%</span></div>';
        html +=   '<div class="dlw-barra"><div class="dlw-barra-fill dlw-barra-verde" style="width:' + pctCiclo + '%"></div></div>';
        html += '</div>';
        if (diasTranscurridos > 0) html += '<div class="dlw-meta">' + diasTranscurridos + ' días desde siembra' + (fenDurCiclo > 0 ? ' / ' + fenDurCiclo + ' del ciclo' : '') + '</div>';
      }
      if (fenFechaFin) html += '<div class="dlw-meta">Próxima etapa: ' + esc(fenFechaFin) + '</div>';
      html += '</div>';
    }

    // Balance hídrico
    if (pctAgua >= 0) {
      html += '<div class="dlw-card">';
      html +=   '<div class="dlw-card-titulo">💧 Balance hídrico</div>';
      html +=   '<div class="dlw-valor" style="color:' + colorAgua + '">' + labelAgua + '</div>';
      html +=   '<div class="dlw-barra-wrap">';
      html +=     '<div class="dlw-barra-label"><span>' + aguaMm.toFixed(0) + ' mm</span><span style="color:' + colorAgua + '">' + pctAgua + '%</span></div>';
      html +=     '<div class="dlw-barra"><div class="dlw-barra-fill" style="width:' + pctAgua + '%;background:' + colorAgua + '"></div></div>';
      html +=   '</div>';
      if (deficitAcum > 0) html += '<div class="dlw-meta">Déficit acumulado: ' + deficitAcum.toFixed(0) + ' mm</div>';
      if (diasEstres > 0)  html += '<div class="dlw-meta" style="color:#D4522A">⚠ ' + diasEstres + ' días de estrés hídrico</div>';
      html += '</div>';
    }

    // ENSO + Alertas (columna derecha)
    html += '<div class="dlw-card">';
    if (ensoFase) {
      html += '<div class="dlw-card-titulo">' + ensoIco + ' ENSO / Clima</div>';
      html += '<div class="dlw-valor" style="color:' + ensoColor + '">' + esc(ensoFase) + '</div>';
      html += '<div class="dlw-meta">Condición climática de la campaña</div>';
    }
    if (alertas.length > 0) {
      html += '<div class="dlw-card-titulo" style="margin-top:' + (ensoFase ? '.75rem' : '0') + '">⚠ Alertas activas</div>';
      alertas.slice(0, 3).forEach(function (a) {
        var txt = typeof a === 'string' ? a : (a.mensaje || a.texto || JSON.stringify(a));
        html += '<div class="dlw-alerta-item">' + esc(txt.substring(0, 80)) + '</div>';
      });
      if (alertas.length > 3) html += '<div class="dlw-meta">' + (alertas.length - 3) + ' alertas más →</div>';
    } else if (!ensoFase) {
      html += '<div class="dlw-meta dlw-sin-datos">Sin datos de campaña todavía.<br>Completá la Planificación Fina primero.</div>';
    }
    html += '</div>';

    html += '</div>'; // .dlw-grid
    html += '</div>'; // .dlw-panel
    return html;
  }

  // ── Panel de contexto para Planificación Fina ─────────
  function renderWidgetPlanFina(lote) {
    var d  = lote.data || {};
    var ck = d.calcKeys || {};
    var sueloTex = d['sg-textura'] || ck['am_siembra_suelo'] || '';
    var sup      = d.superficie || '';
    var nombre   = lote.nombre || 'Lote';

    var html = '<div class="dlw-panel dlw-panel-fina">';
    html += '<div class="dlw-panel-titulo">Contexto del lote</div>';
    html += '<div class="dlw-chips-row">';
    html += '<span class="dlw-chip-data">' + esc(nombre) + '</span>';
    if (sup) html += '<span class="dlw-chip-data">' + esc(sup) + ' has</span>';
    if (sueloTex) html += '<span class="dlw-chip-data">' + esc(sueloTex) + '</span>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // ── Barra de progreso fenológico para las cards ───────
  function _sanNivelCfg(nivel) {
    return {
      alto:  { label: 'Atencion alta', cls: 'alto',  color: '#D4522A' },
      medio: { label: 'Vigilar',       cls: 'medio', color: '#C8A255' },
      bajo:  { label: 'Controlado',    cls: 'bajo',  color: '#6DBF82' },
      nd:    { label: 'Sin datos',     cls: 'nd',    color: 'rgba(237,224,196,.45)' }
    }[nivel || 'nd'] || { label: 'Sin datos', cls: 'nd', color: 'rgba(237,224,196,.45)' };
  }

  function _sanNombresPlagas(cultivo) {
    var mes = new Date().getMonth() + 1;
    var c = _normCultivoPlan(cultivo);
    var mapa = {
      soja: [{ n:'Orugas defoliadoras', m:[11,12,1,2] }, { n:'Chinches', m:[12,1,2,3] }, { n:'Trips', m:[11,12,1,2] }],
      maiz: [{ n:'Cogollero', m:[9,10,11,12,1] }, { n:'Barrenador', m:[11,12,1,2,3] }, { n:'Diabrotica', m:[10,11,12] }],
      trigo: [{ n:'Pulgon verde', m:[6,7,8,9] }, { n:'Pulgon amarillo', m:[8,9,10] }, { n:'Pulgon de la espiga', m:[9,10,11] }],
      girasol: [{ n:'Isoca bolillera', m:[11,12,1] }, { n:'Trips', m:[10,11,12] }],
      sorgo: [{ n:'Pulgones', m:[11,12,1,2] }, { n:'Cogollero', m:[10,11,12,1] }],
      cebada: [{ n:'Pulgones', m:[6,7,8,9] }, { n:'Trips', m:[9,10] }],
      colza: [{ n:'Pulgones', m:[5,6,7,8] }, { n:'Orugas', m:[7,8,9] }]
    };
    return (mapa[c] || []).filter(function(x) { return x.m.indexOf(mes) >= 0; }).map(function(x) { return x.n; });
  }

  function _sanEnfermedadesClave(cultivo) {
    var c = _normCultivoPlan(cultivo);
    return {
      soja: ['Roya asiatica', 'Mancha ojo de rana', 'Septoria'],
      maiz: ['Tizon del norte', 'Roya comun', 'Mancha gris'],
      trigo: ['Roya de la hoja', 'Septoriosis', 'Fusariosis'],
      girasol: ['Sclerotinia', 'Roya', 'Alternaria'],
      sorgo: ['Roya', 'Antracnosis'],
      cebada: ['Mancha en red', 'Roya', 'Ramularia'],
      colza: ['Phoma', 'Sclerotinia']
    }[c] || ['Complejo sanitario'];
  }

  function _sanClima(data) {
    data = data || {};
    var om = data.om || {};
    var cur = om.current || {};
    var daily = om.daily || {};
    var prob = daily.precipitation_probability_max || [];
    var mm = daily.precipitation_sum || [];
    var probMax = prob.length ? Math.max.apply(null, prob.slice(0, 3).map(function(v) { return parseFloat(v) || 0; })) : 0;
    var lluvia3 = mm.slice(0, 3).reduce(function(a, v) { return a + (parseFloat(v) || 0); }, 0);
    return { hr: parseFloat(cur.relative_humidity_2m), temp: parseFloat(cur.temperature_2m), prob3: probMax, lluvia3: lluvia3 };
  }

  function _sanEtapaCritica(cultivo, etapa) {
    var c = _normCultivoPlan(cultivo);
    var e = String(etapa || '').toLowerCase();
    if (!e) return false;
    if (c === 'trigo' || c === 'cebada') return /enca|bota|espig|antes|flora|llen/.test(e);
    if (c === 'soja') return /r1|r2|r3|r4|r5|flora|vaina|llen/.test(e);
    if (c === 'maiz' || c === 'sorgo') return /v8|v12|vt|r1|r2|panoja|estigma|flora/.test(e);
    if (c === 'girasol') return /boton|flora|r5|r6|r7/.test(e);
    return false;
  }

  function renderSanidadMonitoreo(lote, hubData) {
    var d = lote.data || {};
    var ck = d.calcKeys || {};
    var loteId = esc(lote.id);
    var cultivo = d.cultivo || ck['am_siembra_cultivo'] || '';
    var fecha = _fechaSiembraEfectiva(d, ck, cultivo);
    var etapa = ck['am_fen_etapa_hoy'] || '';
    var clima = _sanClima(hubData || _hubDataCache[lote.id + '_' + (new Date().getMonth() + 1)] || {});
    var plagas = _sanNombresPlagas(cultivo);
    var enfBase = _sanEnfermedadesClave(cultivo);
    var alertas = [];
    try { alertas = JSON.parse(ck['am_alertas_activas'] || '[]'); } catch(e) {}
    if (!Array.isArray(alertas)) alertas = [];

    var climaHumedo = (clima.hr >= 85) || (clima.prob3 >= 60) || (clima.lluvia3 >= 5);
    var climaCalido = !isNaN(clima.temp) && clima.temp >= 18;
    var critica = _sanEtapaCritica(cultivo, etapa);
    var nivelPlagas = plagas.length >= 2 && climaCalido ? 'alto' : (plagas.length ? 'medio' : 'bajo');
    var nivelEnf = alertas.length ? 'alto' : ((climaHumedo && critica) ? 'alto' : (climaHumedo || critica ? 'medio' : 'bajo'));
    if (!cultivo || !fecha) nivelPlagas = nivelEnf = 'nd';

    var pCfg = _sanNivelCfg(nivelPlagas);
    var eCfg = _sanNivelCfg(nivelEnf);
    var climaTxt = clima.prob3 || clima.lluvia3 || !isNaN(clima.hr)
      ? 'HR ' + (isNaN(clima.hr) ? '-' : Math.round(clima.hr) + '%') + ' - lluvia 3d ' + clima.lluvia3.toFixed(0) + ' mm - prob ' + Math.round(clima.prob3) + '%'
      : 'Esperando datos climaticos del lote';
    var etapaTxt = etapa ? etapa : (fecha ? 'Seguimiento fenologico activo' : 'Falta fecha de siembra');

    var html = '<div class="dlw-panel dlw-san-panel" id="dl-sanidad-' + loteId + '">';
    html += '<div class="dlw-san-head">';
    html +=   '<div><div class="dlw-panel-titulo">Guardia sanitaria</div><div class="dlw-san-sub">Situacion actual para decidir recorridas y entrar al detalle.</div></div>';
    html +=   '<div class="dlw-san-weather">' + esc(climaTxt) + '</div>';
    html += '</div>';
    html += '<div class="dlw-san-grid">';

    html += '<div class="dlw-san-card dlw-san-' + pCfg.cls + '">';
    html +=   '<div class="dlw-san-card-top"><span class="dlw-san-ico">🐛</span><div><div class="dlw-san-title">Plagas</div><div class="dlw-san-risk" style="color:' + pCfg.color + '">' + pCfg.label + '</div></div></div>';
    html +=   '<div class="dlw-san-body">';
    if (plagas.length) {
      html += '<div class="dlw-san-focus">Mirar: ' + esc(plagas.slice(0, 3).join(' - ')) + '</div>';
      html += '<div class="dlw-san-note">Presion estacional para ' + esc(cultivo || 'cultivo') + '. Validar con recorrida y umbrales.</div>';
    } else {
      html += '<div class="dlw-san-focus">Sin plaga estacional dominante este mes</div>';
      html += '<div class="dlw-san-note">Mantener monitoreo semanal y revisar bordes/lotes vecinos.</div>';
    }
    html +=   '</div>';
    html +=   "<button type=\"button\" class=\"dlw-san-btn\" onclick=\"window.dlAbrirModulo('plagas','" + loteId + "')\">Ver plagas</button>";
    html += '</div>';

    html += '<div class="dlw-san-card dlw-san-' + eCfg.cls + '">';
    html +=   '<div class="dlw-san-card-top"><span class="dlw-san-ico">🦠</span><div><div class="dlw-san-title">Enfermedades</div><div class="dlw-san-risk" style="color:' + eCfg.color + '">' + eCfg.label + '</div></div></div>';
    html +=   '<div class="dlw-san-body">';
    if (alertas.length) {
      var alertaTxt = alertas[0] && (alertas[0].titulo || alertas[0].msg || alertas[0].mensaje || alertas[0]);
      html += '<div class="dlw-san-focus">Alerta activa: ' + esc(String(alertaTxt).substring(0, 72)) + '</div>';
    } else {
      html += '<div class="dlw-san-focus">Mirar: ' + esc(enfBase.slice(0, 3).join(' - ')) + '</div>';
    }
    html += '<div class="dlw-san-note">' + esc(etapaTxt) + (climaHumedo ? ' - ambiente humedo favorable.' : ' - sin senal climatica fuerte.') + '</div>';
    html +=   '</div>';
    html +=   "<button type=\"button\" class=\"dlw-san-btn\" onclick=\"window.dlAbrirModulo('alerta-sanitaria','" + loteId + "')\">Ver enfermedades</button>";
    html += '</div>';

    html += '</div>';
    html += '<div class="dlw-san-foot">Orientativo: prioriza que revisar; la decision requiere monitoreo a campo.</div>';
    html += '</div>';
    return html;
  }

  function renderBarraCiclo(ck, fechaSiembra) {
    var fenDurCiclo = parseFloat(ck['am_fen_duracion_ciclo']) || 0;
    if (!fechaSiembra || fenDurCiclo <= 0) return '';
    var hoy = new Date();
    var siem = new Date(fechaSiembra + 'T12:00:00');
    var dias = Math.max(0, Math.round((hoy - siem) / 86400000));
    var pct  = Math.min(100, Math.round(dias / fenDurCiclo * 100));
    if (pct <= 0) return '';
    var col  = pct > 85 ? '#C8A255' : '#6DBF82';
    return [
      '<div class="dl-ciclo">',
        '<div class="dl-ciclo-label"><span>🌱 Ciclo</span><span style="color:' + col + '">' + pct + '%</span></div>',
        '<div class="dl-hidrico-bar"><div class="dl-hidrico-fill" style="width:' + pct + '%;background:' + col + '"></div></div>',
      '</div>'
    ].join('');
  }

  // ── MINI-MAPA SATELITAL ──────────────────────────────
  function _destroyMiniMaps() {
    Object.keys(_mapaInstances).forEach(function(id) {
      try { _mapaInstances[id].remove(); } catch(e) {}
    });
    _mapaInstances = {};
  }

  function _initMiniMaps(lotes) {
    if (typeof L === 'undefined') return;
    lotes.forEach(function(lote) {
      var d = lote.data || {};
      var leafletCoords;
      if (Array.isArray(d.polygon) && d.polygon.length > 2) {
        leafletCoords = d.polygon.map(function(p) { return [p.lat, p.lng]; });
      } else if (d.geojson && d.geojson.geometry && Array.isArray(d.geojson.geometry.coordinates)) {
        var ring = d.geojson.geometry.coordinates[0] || [];
        if (ring.length > 2) leafletCoords = ring.map(function(c) { return [c[1], c[0]]; });
      }
      if (!leafletCoords) return;
      var el = document.getElementById('dl-mapa-' + lote.id);
      if (!el) return;
      try {
        var map = L.map(el, {
          zoomControl: false, attributionControl: false,
          dragging: false, touchZoom: false, doubleClickZoom: false,
          scrollWheelZoom: false, keyboard: false, tap: false
        });
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19, tileSize: 256
        }).addTo(map);
        var poly = L.polygon(leafletCoords, {
          color: '#6DBF82', weight: 2,
          fillColor: '#6DBF82', fillOpacity: 0.15
        }).addTo(map);
        map.fitBounds(poly.getBounds(), { padding: [6, 6] });
        map.invalidateSize();
        _mapaInstances[lote.id] = map;
      } catch(e) {}
    });
  }

  // ── CLIMA ASÍNCRONO EN CARDS ─────────────────────────
  function _fetchClimaCards(lotes) {
    lotes.forEach(function(lote) {
      var coords = _coordsFromLote(lote);
      if (!coords) return;
      var el = document.getElementById('dl-clima-' + lote.id);
      if (!el) return;
      var cKey = coords.lat.toFixed(2) + ',' + coords.lng.toFixed(2);
      if (_climaCache[cKey]) {
        _renderClimaInCard(el, _climaCache[cKey]);
        return;
      }
      var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + coords.lat.toFixed(4) +
                '&longitude=' + coords.lng.toFixed(4) +
                '&current=temperature_2m&daily=precipitation_probability_max' +
                '&forecast_days=1&timezone=auto';
      fetch(url)
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
          if (!data) return;
          var temp = data.current ? data.current.temperature_2m : null;
          var prob = (data.daily && data.daily.precipitation_probability_max)
                     ? data.daily.precipitation_probability_max[0] : null;
          var result = { temp: temp, prob: prob };
          _climaCache[cKey] = result;
          var el2 = document.getElementById('dl-clima-' + lote.id);
          if (el2) _renderClimaInCard(el2, result);
        })
        .catch(function() {});
    });
  }

  function _fetchSueloCards(lotes) {
    if (typeof window.sgAutoFetchLote !== 'function') return;
    lotes.forEach(function(lote) {
      var ts  = parseInt((lote.data || {})['sg-ts'] || 0, 10);
      var age = Date.now() - ts;
      if (!ts || age > 90 * 24 * 3600 * 1000) {
        window.sgAutoFetchLote(lote);
      }
    });
  }

  // ── HUB DATA PANEL ─────────────────────────────────────
  async function _fetchHubData(loteId) {
    var el = document.getElementById('dl-hub-datos-' + loteId);
    if (!el) return;

    var lote = getLote(loteId);
    if (!lote) return;
    var coords = _coordsFromLote(lote);
    if (!coords) {
      el.innerHTML = '<div class="dl-hub-datos-nocoord">📍 Agregá coordenadas al lote para ver datos climáticos y de suelo.</div>';
      return;
    }

    var lat = coords.lat, lng = coords.lng;
    var now = new Date();
    var mes = now.getMonth() + 1;
    var cacheKey = loteId + '_' + mes;

    // Check cache (session TTL for NASA, 15min effectively via session)
    if (_hubDataCache[cacheKey]) {
      _renderHubDatos(el, _hubDataCache[cacheKey], loteId);
      return;
    }

    try {
      var [omData, nasaProps, ensoResult] = await Promise.all([
        fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng +
          '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,soil_temperature_0cm,soil_moisture_3_9cm' +
          '&daily=et0_fao_evapotranspiration,precipitation_probability_max,precipitation_sum,' +
          'temperature_2m_max,temperature_2m_min,weather_code' +
          '&timezone=auto&forecast_days=7').then(function(r) { return r.json(); }),
        (typeof window.buscarNASAPower === 'function'
          ? window.buscarNASAPower(lat, lng, mes)
          : Promise.resolve(null)),
        (window.ENSO && typeof window.ENSO.getFaseENSO === 'function'
          ? window.ENSO.getFaseENSO().catch(function() { return null; })
          : Promise.resolve(null))
      ]);

      var result = { om: omData, nasa: nasaProps, enso: ensoResult };
      _hubDataCache[cacheKey] = result;
      if (!document.getElementById('dl-hub-datos-' + loteId)) return; // user navigated away
      _renderHubDatos(el, result, loteId);
    } catch(e) {
      if (el) el.innerHTML = '<div class="dl-hub-datos-error">Error cargando datos. Comprobá la conexión.</div>';
    }
  }

  function _renderHubDatos(el, data, loteId) {
    var html = '';

    // ── Open-Meteo panel ────────────────────────────────────
    var om = data.om || {};
    var cur = om.current || {};
    var day = (om.daily || {});

    var tAire  = cur.temperature_2m != null ? cur.temperature_2m.toFixed(1) + '°C' : '—';
    var hr     = cur.relative_humidity_2m != null ? Math.round(cur.relative_humidity_2m) + '%' : '—';
    var viento = cur.wind_speed_10m != null ? Math.round(cur.wind_speed_10m) + ' km/h' : '—';
    var tSuelo = cur.soil_temperature_0cm != null ? cur.soil_temperature_0cm.toFixed(1) + '°C' : '—';
    var humSuelo = cur.soil_moisture_3_9cm != null ? (cur.soil_moisture_3_9cm * 100).toFixed(1) + '%' : '—';

    var vpd = '—';
    if (cur.temperature_2m != null && cur.relative_humidity_2m != null) {
      var T = cur.temperature_2m, H = cur.relative_humidity_2m;
      var vpdVal = 0.611 * Math.exp(17.27 * T / (T + 237.3)) * (1 - H / 100);
      vpd = vpdVal.toFixed(2) + ' kPa';
    }

    var et0 = (day.et0_fao_evapotranspiration && day.et0_fao_evapotranspiration[0] != null)
      ? day.et0_fao_evapotranspiration[0].toFixed(1) + ' mm/d' : '—';
    var pLluvia = (day.precipitation_probability_max && day.precipitation_probability_max[0] != null)
      ? day.precipitation_probability_max[0] + '%' : '—';

    html += '<div class="dl-hdatos-sec">';
    html +=   '<div class="dl-hdatos-titulo">📡 Open-Meteo · Tiempo real</div>';
    html +=   '<div class="dl-hdatos-grid">';
    html +=     _hdKV('🌡️', 'T° aire', tAire);
    html +=     _hdKV('💦', 'HR', hr);
    html +=     _hdKV('🌬️', 'Viento', viento);
    html +=     _hdKV('🌧️', 'P. lluvia', pLluvia);
    html +=     _hdKV('🌡', 'T° suelo', tSuelo);
    html +=     _hdKV('💧', 'Hum. suelo', humSuelo);
    html +=     _hdKV('🌿', 'ET₀', et0);
    html +=     _hdKV('🌫️', 'VPD', vpd);
    html +=   '</div>';
    html += '</div>';

    // ── NASA POWER + ENSO panel ──────────────────────────
    var nasaClaves = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    var mesNombres = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    var nowN = new Date();
    var mesN = nowN.getMonth() + 1;
    var mKey = nasaClaves[mesN - 1];
    var mesNom = mesNombres[mesN];

    var nasa = data.nasa;
    var enso = data.enso;

    var ensoBadge = '';
    var precFactor = 1;
    if (enso) {
      var fase = enso.fase || 'neutro';
      var factorAdj = (window.ENSO && typeof window.ENSO.getFactorAjuste === 'function')
        ? window.ENSO.getFactorAjuste(fase) : 0;
      precFactor = 1 + factorAdj;
      var faseLabel = fase === 'niño' ? 'El Niño' : fase === 'niña' ? 'La Niña' : 'Neutro';
      var faseColor = fase === 'niño' ? '#D4835A' : fase === 'niña' ? '#7B8DC8' : '#6DBF82';
      var pctStr = factorAdj !== 0 ? ' · ' + (factorAdj > 0 ? '+' : '') + Math.round(factorAdj * 100) + '% prec.' : '';
      ensoBadge = '<span class="dl-hdatos-badge" style="background:' + faseColor + '22;border-color:' + faseColor + '44;color:' + faseColor + '">' + esc(mesNom) + ' · ' + faseLabel + pctStr + '</span>';

      // Persistir fase ENSO en lote.data para que el score widget la use
      // sin necesidad de que el usuario haya ejecutado el módulo ENSO
      var loteEnso = getLote(loteId);
      if (loteEnso) {
        loteEnso.data = loteEnso.data || {};
        if (!loteEnso.data['hub-enso-fase']) {
          loteEnso.data['hub-enso-fase'] = faseLabel;
          if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
        }
      }
    }

    if (nasa) {
      var nGet = function(k) { return nasa[k] ? nasa[k][mKey] : null; };
      var rad  = nGet('ALLSKY_SFC_SW_DWN');
      var tmax = nGet('T2M_MAX');
      var tmin = nGet('T2M_MIN');
      var precD = nGet('PRECTOTCORR');
      var et0N = nGet('EVPTRNS');
      var rhN  = nGet('RH2M');
      var precM  = precD  != null ? precD  * 30 * precFactor : null;
      var et0M   = et0N   != null ? et0N   * 30 : null;
      var balHid = precM  != null && et0M != null ? precM - et0M : null;
      var drd    = precM  != null ? Math.round(precM / 3.5) : null;

      html += '<div class="dl-hdatos-sec dl-hdatos-sec-nasa">';
      html +=   '<div class="dl-hdatos-titulo"><span>🚀 NASA POWER · Histórico 30 años</span>' + ensoBadge + '</div>';
      html +=   '<div class="dl-hdatos-grid">';
      html +=     _hdKV('☀️', 'Radiación', rad != null ? rad.toFixed(1) + ' MJ/m²/d' : '—');
      html +=     _hdKV('💧', 'Prec/mes', precM != null ? precM.toFixed(0) + ' mm' : '—');
      html +=     _hdKV('🌡', 'T°máx', tmax != null ? tmax.toFixed(1) + '°C' : '—');
      html +=     _hdKV('🥶', 'T°mín', tmin != null ? tmin.toFixed(1) + '°C' : '—');
      html +=     _hdKV('🌿', 'ET₀/mes', et0M != null ? et0M.toFixed(0) + ' mm' : '—');
      html +=     _hdKV('💦', 'HR', rhN != null ? rhN.toFixed(0) + '%' : '—');
      html +=     _hdKV('📅', 'Días lluvia', drd != null ? '~' + drd + ' d' : '—');
      var balColor = balHid != null ? (balHid >= 0 ? '#6DBF82' : '#D4522A') : '';
      html +=     _hdKV('📊', 'Balance', balHid != null ? '<strong style="color:' + balColor + '">' + (balHid >= 0 ? '+' : '') + balHid.toFixed(0) + ' mm</strong>' : '—', true);
      html +=   '</div>';
      html += '</div>';
    }

    // ── SoilGrids panel ──────────────────────────────────
    var loteObj = getLote(loteId);
    var sgDatos = null;
    var sgCacheIncompleto = false;
    function _sgNum(v) {
      if (v === '' || v == null || String(v).toLowerCase() === 'nan') return null;
      var n = parseFloat(v);
      return isFinite(n) ? n : null;
    }
    function _sgSanitize(sg) {
      if (!sg) return null;
      return {
        ph:      _sgNum(sg.ph),
        clay:    _sgNum(sg.clay),
        sand:    _sgNum(sg.sand),
        soc:     _sgNum(sg.soc),
        n:       _sgNum(sg.n),
        da:      _sgNum(sg.da),
        cec:     _sgNum(sg.cec),
        textura: sg.textura || null
      };
    }
    function _sgDesdeLoteData(lote) {
      var d = lote && lote.data ? lote.data : null;
      if (!d || !d['sg-textura']) return null;
      return {
        ph:      _sgNum(d['sg-ph']),
        clay:    _sgNum(d['sg-clay']),
        sand:    _sgNum(d['sg-sand']),
        soc:     _sgNum(d['sg-soc']),
        n:       _sgNum(d['sg-n']),
        da:      _sgNum(d['sg-da']),
        cec:     _sgNum(d['sg-cec']),
        textura: d['sg-textura'] || null
      };
    }
    function _sgMerge(base, fallback) {
      base = _sgSanitize(base) || {};
      fallback = fallback || {};
      ['ph','clay','sand','soc','n','da','cec','textura'].forEach(function(k) {
        if ((base[k] === '' || base[k] == null) && fallback[k] != null && fallback[k] !== '') base[k] = fallback[k];
      });
      return base;
    }
    function _sgCompleto(sg) {
      sg = _sgSanitize(sg);
      return !!(sg && sg.clay != null && sg.sand != null && sg.soc != null && sg.n != null && sg.da != null && sg.cec != null);
    }
    try {
      var sgRaw = localStorage.getItem('sg_full_' + loteId);
      if (sgRaw) {
        var sgCache = JSON.parse(sgRaw);
        if (sgCache && sgCache.datos) sgDatos = sgCache.datos;
      }
    } catch(_e) {}

    // Fallback to lote.data fields
    if (!sgDatos && loteObj && loteObj.data && loteObj.data['sg-textura']) {
      var d = loteObj.data;
      sgDatos = {
        ph:      d['sg-ph']   !== '' && d['sg-ph']   != null ? parseFloat(d['sg-ph'])   : null,
        clay:    d['sg-clay'] !== '' && d['sg-clay'] != null ? parseFloat(d['sg-clay']) : null,
        sand:    d['sg-sand'] !== '' && d['sg-sand'] != null ? parseFloat(d['sg-sand']) : null,
        soc:     d['sg-soc']  !== '' && d['sg-soc']  != null ? parseFloat(d['sg-soc'])  : null,
        n:       d['sg-n']    !== '' && d['sg-n']    != null ? parseFloat(d['sg-n'])    : null,
        da:      d['sg-da']   !== '' && d['sg-da']   != null ? parseFloat(d['sg-da'])   : null,
        cec:     d['sg-cec']  !== '' && d['sg-cec']  != null ? parseFloat(d['sg-cec'])  : null,
        textura: d['sg-textura'] || null
      };
    }

    sgDatos = _sgMerge(sgDatos, _sgDesdeLoteData(loteObj));
    sgCacheIncompleto = !!sgDatos && !_sgCompleto(sgDatos);
    if (sgCacheIncompleto) {
      try { localStorage.removeItem('sg_full_' + loteId); } catch (_) {}
      if (loteObj && loteObj.data) {
        ['sg-textura','sg-ph','sg-clay','sg-sand','sg-soc','sg-n','sg-da','sg-cec','sg-lat','sg-lon','sg-ts'].forEach(function(k) { delete loteObj.data[k]; });
        if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
      }
      sgDatos = null;
    }

    if (sgDatos) {
      html += '<div class="dl-hdatos-sec dl-hdatos-sec-sg">';
      html +=   '<div class="dl-hdatos-titulo" style="display:flex;align-items:center;justify-content:space-between">🌍 SoilGrids ISRIC · 250 m <button onclick="dlSgRefrescar(\'' + loteId + '\')" style="background:none;border:none;font-size:.75rem;cursor:pointer;color:rgba(237,224,196,.45);padding:0 0 0 .4rem" title="Forzar nueva consulta">🔄</button></div>';
      html +=   '<div class="dl-hdatos-grid">';
      html +=     _hdKV('🧪', 'pH', sgDatos.ph != null ? (sgDatos.ph.toFixed ? sgDatos.ph.toFixed(1) : sgDatos.ph) : '—');
      html +=     _hdKV('🏺', 'Arcilla', sgDatos.clay != null ? sgDatos.clay.toFixed(0) + '%' : '—');
      html +=     _hdKV('🏖', 'Arena', sgDatos.sand != null ? sgDatos.sand.toFixed(0) + '%' : '—');
      html +=     _hdKV('🌿', 'C.org', sgDatos.soc != null ? sgDatos.soc.toFixed(1) + ' g/kg' : '—');
      html +=     _hdKV('🔬', 'N total', sgDatos.n != null ? sgDatos.n.toFixed(2) + ' g/kg' : '—');
      html +=     _hdKV('⚖️', 'DA', sgDatos.da != null ? sgDatos.da.toFixed(2) + ' g/cm³' : '—');
      html +=     _hdKV('⚡', 'CEC', sgDatos.cec != null ? sgDatos.cec.toFixed(1) + ' cmol' : '—');
      html +=     _hdKV('🗺', 'Textura', sgDatos.textura || '—');
      html +=   '</div>';
      html += '</div>';
    } else {
      // trigger background fetch if not cached
      if (loteObj && typeof window.sgAutoFetchLote === 'function') {
        window.sgAutoFetchLote(loteObj).then(function() {
          var elNow = document.getElementById('dl-hub-datos-' + loteId);
          if (elNow) {
            var sgRaw2 = localStorage.getItem('sg_full_' + loteId);
            if (sgRaw2) {
              delete _hubDataCache[loteId + '_' + (new Date().getMonth() + 1)];
              _fetchHubData(loteId);
            }
          }
        });
        html += '<div class="dl-hdatos-sec dl-hdatos-sec-sg">';
        html +=   '<div class="dl-hdatos-titulo">🌍 SoilGrids ISRIC · 250 m</div>';
        html +=   '<div class="dl-hdatos-loading-sub">Consultando base de datos de suelos...</div>';
        html += '</div>';
      }
    }

    // ── Pronóstico 7 días ────────────────────────────────────
    var omF = data.om || {};
    var dF  = omF.daily || {};
    if (dF.time && dF.time.length > 0) {
      var diasNom = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
      html += '<div class="dl-hdatos-sec dl-hdatos-sec-prono">';
      html +=   '<div class="dl-hdatos-titulo">🌧️ Pronóstico 7 días · Open-Meteo</div>';
      html +=   '<div class="dl-prono-row">';
      for (var di = 0; di < Math.min(7, dF.time.length); di++) {
        var fecha   = new Date(dF.time[di] + 'T12:00:00');
        var dNom    = di === 0 ? 'Hoy' : di === 1 ? 'Mañana' : diasNom[fecha.getDay()];
        var wco     = dF.weather_code ? dF.weather_code[di] : 0;
        var wEmoji  = _wmoEmoji(wco);
        var tmax    = dF.temperature_2m_max ? dF.temperature_2m_max[di] : null;
        var tmin    = dF.temperature_2m_min ? dF.temperature_2m_min[di] : null;
        var prob    = dF.precipitation_probability_max ? dF.precipitation_probability_max[di] : null;
        var mm      = dF.precipitation_sum ? dF.precipitation_sum[di] : null;
        var probPct = prob != null ? Math.round(prob) : 0;
        var barColor = probPct >= 70 ? '#5A9FD4' : probPct >= 40 ? '#7BB8D4' : 'rgba(237,224,196,.2)';
        var textColor = probPct >= 40 ? '#9CCFE8' : 'rgba(237,224,196,.45)';

        html += '<div class="dl-prono-dia">';
        html +=   '<div class="dl-prono-nom">' + esc(dNom) + '</div>';
        html +=   '<div class="dl-prono-ico">' + wEmoji + '</div>';
        html +=   '<div class="dl-prono-temp">';
        html +=     (tmax != null ? '<span class="dl-prono-tmax">' + Math.round(tmax) + '°</span>' : '');
        html +=     (tmin != null ? '<span class="dl-prono-tmin">' + Math.round(tmin) + '°</span>' : '');
        html +=   '</div>';
        html +=   '<div class="dl-prono-bar-wrap">';
        html +=     '<div class="dl-prono-bar" style="height:' + probPct + '%;background:' + barColor + '"></div>';
        html +=   '</div>';
        html +=   '<div class="dl-prono-prob" style="color:' + textColor + '">' + (prob != null ? probPct + '%' : '—') + '</div>';
        html +=   '<div class="dl-prono-mm">' + (mm != null && mm > 0 ? mm.toFixed(1) + ' mm' : '—') + '</div>';
        html += '</div>';
      }
      html +=   '</div>';
      html += '</div>';
    }

    el.innerHTML = html || '<div class="dl-hub-datos-empty">Sin datos disponibles.</div>';
    var sanEl = document.getElementById('dl-sanidad-' + loteId);
    var sanLote = getLote(loteId);
    if (sanEl && sanLote) sanEl.outerHTML = renderSanidadMonitoreo(sanLote, data);
  }

  function _wmoEmoji(code) {
    if (code === 0)                          return '☀️';
    if (code <= 2)                           return '🌤️';
    if (code === 3)                          return '☁️';
    if (code <= 48)                          return '🌫️';
    if (code <= 57)                          return '🌦️';
    if (code <= 67)                          return '🌧️';
    if (code <= 77)                          return '❄️';
    if (code <= 82)                          return '🌦️';
    if (code <= 86)                          return '🌨️';
    if (code <= 99)                          return '⛈️';
    return '🌡';
  }

  function _hdKV(ico, label, val, raw) {
    var valStr = raw ? val : esc(String(val));
    return '<div class="dl-hdatos-item">' +
      '<span class="dl-hdatos-ico">' + ico + '</span>' +
      '<div class="dl-hdatos-content">' +
        '<span class="dl-hdatos-label">' + esc(label) + '</span>' +
        '<span class="dl-hdatos-val">' + valStr + '</span>' +
      '</div>' +
      '</div>';
  }

  function _renderClimaInCard(el, data) {
    var parts = [];
    if (data.temp !== null && data.temp !== undefined) {
      parts.push('🌡️ ' + parseFloat(data.temp).toFixed(1) + '°C');
    }
    if (data.prob !== null && data.prob !== undefined) {
      var p = parseInt(data.prob, 10);
      var col = p > 60 ? '#7AAEF5' : p > 30 ? '#C8A255' : 'rgba(237,224,196,.4)';
      parts.push('<span style="color:' + col + '">🌧️ ' + p + '%</span>');
    }
    if (parts.length) {
      el.innerHTML = '<div class="dl-card-clima">' + parts.join('<span class="dl-clima-sep"> · </span>') + '</div>';
    }
  }

  // ── HELPERS DE HTML ──────────────────────────────────
  function breadcrumb(crumbs, actual) {
    var html = '<nav class="dl-breadcrumb">';
    crumbs.forEach(function (c) {
      html += '<button class="dl-bc-btn" onclick="' + c.onclick + '">' + c.label + '</button>';
      html += '<span class="dl-bc-sep">/</span>';
    });
    html += '<span class="dl-bc-actual">' + actual + '</span>';
    html += '</nav>';
    return html;
  }

  function chip(contenido, size) {
    var cls = 'dl-chip' + (size === 'lg' ? ' dl-chip-lg' : '');
    return '<span class="' + cls + '">' + contenido + '</span>';
  }

  async function _fetchLugar(loteId) {
    var lote = getLote(loteId);
    if (!lote) return;
    // Si ya está guardado, no hacer nada (renderHub ya lo mostró)
    if (lote.data && lote.data['geo-lugar']) return;
    var coords = _coordsFromLote(lote);
    if (!coords) return;
    var el = document.getElementById('dl-hub-lugar-' + loteId);
    if (!el) return;
    try {
      var res = await fetch(
        'https://nominatim.openstreetmap.org/reverse?lat=' + coords.lat +
        '&lon=' + coords.lng + '&format=json&zoom=10&accept-language=es',
        { headers: { 'Accept': 'application/json' } }
      );
      var json = await res.json();
      var addr = json.address || {};
      var loc  = addr.city || addr.town || addr.village || addr.hamlet || '';
      var dist = addr.county || addr.state_district || '';
      var lugar = loc && dist ? loc + ', ' + dist : loc || dist || addr.state || '';
      if (!lugar) return;
      lote.data['geo-lugar'] = lugar;
      if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
      var elNow = document.getElementById('dl-hub-lugar-' + loteId);
      if (elNow) elNow.innerHTML = '📍 ' + esc(lugar);
    } catch(_e) {
      var elNow = document.getElementById('dl-hub-lugar-' + loteId);
      if (elNow) elNow.style.display = 'none';
    }
  }

  function getLote(id) {
    return (window.AM_LOTES || []).find(function (l) { return l.id === id; }) || null;
  }

  // ══════════════════════════════════════════════════════
  // NAVEGACIÓN PÚBLICA
  // ══════════════════════════════════════════════════════

  window.dlAbrirLote = function (loteId) {
    activarLote(loteId);
    _loteAbierto    = loteId;
    _seccionAbierta = null;
    renderPanel();
  };

  window.dlAbrirSeccion = function (secKey) {
    _seccionAbierta = secKey;
    renderPanel();
  };

  window.dlGetSeccionAbierta = function () { return _seccionAbierta; };

  window.dlVolverCards = function () {
    _loteAbierto    = null;
    _seccionAbierta = null;
    renderPanel();
  };

  window.dlAbrirModulo = function (mod, loteId) {
    activarLote(loteId);
    _modContext = { loteId: loteId, secKey: _seccionAbierta, mod: mod };
    if (typeof switchMod === 'function') switchMod(mod);
  };

  window.dlAbrirFenologiaDetalle = function(loteId) {
    window.AM_FEN_AUTO_DETALLE = true;
    window.dlAbrirModulo('fen-seg', loteId);
  };

  window.dlVolverAnterior = function () {
    var ctx = _modContext || {};
    document.body.classList.remove('dl-modo-clasico');
    document.body.classList.add('dl-modo-nuevo');

    document.querySelectorAll('.module-panel').forEach(function (p) {
      p.classList.remove('active');
    });
    var lotes = document.getElementById('mod-lotes');
    if (lotes) lotes.classList.add('active');

    if (ctx.loteId && getLote(ctx.loteId)) {
      _loteAbierto = ctx.loteId;
      _seccionAbierta = ctx.secKey || null;
    } else {
      _loteAbierto = null;
      _seccionAbierta = null;
    }

    document.querySelectorAll('.nav-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.mod === 'lotes');
    });
    var btnVolver = document.getElementById('btn-volver-dash');
    if (btnVolver) btnVolver.classList.add('hidden');
    var btnPDF = document.getElementById('btn-pdf-modulo');
    if (btnPDF) btnPDF.classList.add('hidden');
    renderPanel();
  };

  window.dlEditarLote = function (loteId) {
    var lote = getLote(loteId);
    if (!lote) return;
    activarLote(loteId);
    if (typeof window.dlMostrarModalNuevoLote === 'function') {
      window.dlMostrarModalNuevoLote(loteId);
    }
  };

  window.dlEliminarLote = function (loteId) {
    var lote = getLote(loteId);
    if (!lote) return;
    var esUltimo = (window.AM_LOTES || []).length <= 1;
    var pregunta = esUltimo
      ? '¿Eliminar los datos del lote "' + lote.nombre + '"? Quedará un lote vacío para empezar de nuevo.'
      : '¿Eliminar el lote "' + lote.nombre + '" y todos sus datos?';
    if (!confirm(pregunta)) return;
    if (esUltimo) {
      window.AM_LOTES = [{ id: 'default', nombre: 'Lote Principal', data: {} }];
      window.AM_LOTE_ACTIVO = 'default';
    } else {
      window.AM_LOTES = (window.AM_LOTES || []).filter(function (l) { return l.id !== loteId; });
      if (window.AM_LOTE_ACTIVO === loteId) {
        window.AM_LOTE_ACTIVO = window.AM_LOTES[0] ? window.AM_LOTES[0].id : 'default';
      }
    }
    if (_loteAbierto === loteId) {
      _loteAbierto = null;
      _seccionAbierta = null;
    }
    if (_modContext && _modContext.loteId === loteId) _modContext = null;
    if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
    if (typeof cacheCargar === 'function') cacheCargar();
    if (typeof amRenderSelectLotes === 'function') amRenderSelectLotes();
    if (typeof amToast === 'function') amToast('Lote "' + lote.nombre + '" eliminado', 'ok');
    renderPanel();
  };

  function activarLote(loteId) {
    if (!loteId) return;
    window.AM_LOTE_ACTIVO = loteId;
    var sel = document.getElementById('am-global-lotes');
    if (sel) sel.value = loteId;
    var selDash = document.getElementById('am-dash-lotes');
    if (selDash) selDash.value = loteId;
    if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
    if (typeof cacheCargar === 'function') cacheCargar();
    if (typeof amRenderSelectLotes === 'function') amRenderSelectLotes();
    if (typeof amActualizarBadgesLote === 'function') amActualizarBadgesLote();
    if (typeof amRefrescarMapaDashboard === 'function') amRefrescarMapaDashboard();
  }

  // Volver a la nueva UX desde cualquier módulo
  window.dlVolverNueva = function () {
    document.body.classList.remove('dl-modo-clasico');
    document.body.classList.add('dl-modo-nuevo');
    // Activar mod-lotes directamente (bypass amTieneAcceso)
    document.querySelectorAll('.module-panel').forEach(function (p) {
      p.classList.remove('active');
    });
    var lotes = document.getElementById('mod-lotes');
    if (lotes) lotes.classList.add('active');
    var btnVolver = document.getElementById('btn-volver-dash');
    if (btnVolver) btnVolver.classList.add('hidden');
    var btnPDF = document.getElementById('btn-pdf-modulo');
    if (btnPDF) btnPDF.classList.add('hidden');
    document.querySelectorAll('.nav-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.mod === 'lotes');
    });
    window.dlRefrescar();
  };

  // Refrescar el panel de lotes (útil tras crear/editar lotes)
  window.dlRefrescar = function () {
    renderPanel();
  };

  window._dlFiltrar = function (nombre) {
    _dlClienteFiltro = nombre;
    renderPanel();
  };

  // ══════════════════════════════════════════════════════
  // INICIALIZACIÓN
  // ══════════════════════════════════════════════════════
  function init() {
    // Activar modo nueva UX por defecto
    document.body.classList.add('dl-modo-nuevo');

    // Parchear switchMod para gestionar visibilidad del sidebar
    patchSwitchMod();

    // Renderizar panel inicial
    renderPanel();

    // Patch: cuando se actualicen los lotes, refrescar las tarjetas
    var _origRender = window.amRenderSelectLotes;
    if (typeof _origRender === 'function') {
      window.amRenderSelectLotes = function () {
        _origRender.apply(this, arguments);
        // Solo refrescar si estamos en la vista de cards (no en hub ni módulo)
        if (!_loteAbierto && !_seccionAbierta) {
          renderPanel();
        }
      };
    }
  }

  // Exponer init para ser llamado desde app.html
  window.dlSgRefrescar = function(loteId) {
    var loteObj = getLote(loteId);
    if (!loteObj || typeof window.sgAutoFetchLote !== 'function') return;

    try { localStorage.removeItem('sg_full_' + loteId); } catch (_) {}
    if (loteObj.data) {
      ['sg-textura','sg-ph','sg-clay','sg-sand','sg-soc','sg-n','sg-da','sg-cec','sg-lat','sg-lon','sg-ts'].forEach(function(k) {
        delete loteObj.data[k];
      });
      if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
    }
    delete _hubDataCache[loteId + '_' + (new Date().getMonth() + 1)];

    var sgSec = document.querySelector('#dl-hub-datos-' + loteId + ' .dl-hdatos-sec-sg');
    if (sgSec) {
      sgSec.innerHTML = '<div class="dl-hdatos-titulo">SoilGrids ISRIC - 250 m</div>' +
        '<div class="dl-hdatos-loading-sub">Consultando base de datos de suelos...</div>';
    }

    window.sgAutoFetchLote(loteObj).then(function() {
      delete _hubDataCache[loteId + '_' + (new Date().getMonth() + 1)];
      _fetchHubData(loteId);
    }).catch(function() {
      if (typeof amToast === 'function') amToast('Error al consultar SoilGrids', 'err');
    });
  };

  window.dlInit = init;
  window.dlGetCampanaPlanificacion = getCampanaPlanificacion;

  // ── PATCH switchMod: gestionar visibilidad de sidebar ──
  // Se ejecuta en init() una vez que switchMod está disponible
  function patchSwitchMod() {
    var _orig = window.switchMod;
    if (typeof _orig !== 'function') return;
    window.switchMod = function (mod) {
      if (mod === 'lotes' || mod === 'dashboard') {
        window.dlVolverNueva();
        return;
      } else {
        document.body.classList.remove('dl-modo-nuevo');
        document.body.classList.add('dl-modo-clasico');
      }
      var res = _orig.apply(this, arguments);
      actualizarBotonVolver(mod);
      return res;
    };
  }

  function actualizarBotonVolver(mod) {
    var btnVolver = document.getElementById('btn-volver-dash');
    if (!btnVolver) return;
    if (mod === 'dashboard' || mod === 'lotes') {
      btnVolver.classList.add('hidden');
      return;
    }
    btnVolver.classList.remove('hidden');
    var tituloVolver = _modContext && _modContext.secKey ? tituloSeccion(getLote(_modContext.loteId), _modContext.secKey) : '';
    btnVolver.textContent = tituloVolver ? '← Volver a ' + tituloVolver : '← Mis Lotes';
    btnVolver.title = _modContext && _modContext.secKey ? 'Volver al hub anterior' : 'Volver a Mis Lotes';
    btnVolver.onclick = function () { window.dlVolverAnterior(); };
  }

})();
