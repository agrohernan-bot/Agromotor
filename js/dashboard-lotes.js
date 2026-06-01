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

  // ── MAPA DE SECCIONES ─────────────────────────────────
  var SECCIONES = {
    plangruesa: {
      titulo: 'Planificación Gruesa',
      emoji:  '🧭',
      desc:   '¿Qué sembrar? · Cultivares · Rotación · Historial',
      color:  '#2A5A8C',
      modulos: [
        { mod: 'decision',      emoji: '⚖️', titulo: '¿Qué sembrar?',          desc: 'Análisis multicriterio para elegir el cultivo correcto' },
        { mod: 'cultivares',    emoji: '🌾', titulo: 'Cultivares RECSO/INTA',   desc: 'Catálogo 2024-25 con recomendaciones por zona y ciclo' },
        { mod: 'rotacion',      emoji: '🔄', titulo: 'Rotación',                desc: 'Planificación de rotación multiañal de cultivos' },
        { mod: 'hist-campanas', emoji: '📊', titulo: 'Historial de campañas',   desc: 'Comparativo entre campañas anteriores del lote' },
      ]
    },
    planfina: {
      titulo: 'Planificación Fina',
      emoji:  '🎯',
      desc:   'Siembra · Suelo · Hídrico · Nutrición · Siembra variable',
      color:  '#1E4D2B',
      modulos: [
        { mod: 'siembra',          emoji: '🌱', titulo: 'Siembra',                desc: 'Diagnóstico de fecha óptima, densidad y ambientes' },
        { mod: 'suelo',            emoji: '🌍', titulo: 'Suelo P/K/Zn',           desc: 'Análisis de suelo · IDECOR · OLM · SoilGrids ISRIC' },
        { mod: 'hidrico',          emoji: '💧', titulo: 'Balance hídrico',         desc: 'ETC FAO + ENSO/NOAA + proyección de lluvias' },
        { mod: 'nutricion',        emoji: '🌿', titulo: 'Nutrición N/P/K',         desc: 'Balance nutricional — tablas Echeverría & García INTA' },
        { mod: 'siembra-variable', emoji: '🗺', titulo: 'Siembra variable',        desc: 'Ambientes por zona · prescripción · shapefile export' },
        { mod: 'fen-plan',         emoji: '📅', titulo: 'Simular fenología',       desc: 'Predicción de estadios con corrección ENSO/NOAA' },
        { mod: 'economia',         emoji: '💰', titulo: 'Presupuesto de campaña',  desc: 'Costos de insumos, maquinaria y labores' },
        { mod: 'maquinaria',       emoji: '🚜', titulo: 'Maquinaria',              desc: 'Inventario y costos de maquinaria propia o contratada' },
      ]
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
  var _mapaInstances = {};

  // ── DETERMINAR ESTADO DEL LOTE ────────────────────────
  function getEstado(lote) {
    var d  = lote.data || {};
    var ck = d.calcKeys || {};
    var cultivo = d.cultivo || ck['am_siembra_cultivo'] || '';
    var fecha   = d.fecha   || ck['am_siembra_fecha']   || '';
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

  // ── RENDER PANEL RAÍZ ─────────────────────────────────
  function renderPanel() {
    var panel = document.getElementById('mod-lotes');
    if (!panel) return;

    _destroyMiniMaps();
    if (_seccionAbierta && _loteAbierto) {
      panel.innerHTML = renderSeccion(_loteAbierto, _seccionAbierta);
    } else if (_loteAbierto) {
      panel.innerHTML = renderHub(_loteAbierto);
    } else {
      panel.innerHTML = renderCards();
      var lotes = window.AM_LOTES || [];
      setTimeout(function() {
        _initMiniMaps(lotes);
        _fetchClimaCards(lotes);
      }, 30);
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
    html +=     '<button class="dl-btn-clasica" onclick="window.dlIrClasica()" title="Acceder a todos los módulos individualmente">⚙ Vista clásica</button>';
    html +=   '</div>';
    html += '</div>';

    // ── Grid de cards ─────────────────────────────────────
    html += '<div class="dl-grid">';

    lotes.forEach(function (lote) {
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
    var fecha    = d.fecha   || ck['am_siembra_fecha']   || '';
    var fenEtapa = ck['am_fen_etapa_hoy'] || '';
    var aguaMm   = parseFloat(ck['am_hidrico_agua_actual_mm']) || 0;
    var aguaCC   = parseFloat(ck['am_hidrico_cap_max_mm']) || 0;
    var sup      = d.superficie || '';
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

    // Thumbnail satelital del polígono
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

    // Contenido según estado
    if (estado === 'vacio') {
      html += '<div class="dl-card-empty">Tocá para comenzar a planificar este lote</div>';
    } else {
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
      html += '</div>';
    }

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

    var html = '<div class="dl-page dl-page-hub">';

    // Breadcrumb
    html += breadcrumb([{ label: 'Mis Lotes', onclick: 'window.dlVolverCards()' }], lote.nombre);

    // Header del lote
    html += '<div class="dl-hub-header">';
    html +=   '<div class="dl-hub-nombre"><span class="dl-dot dl-dot-lg" style="background:' + eConf.dot + '"></span>' + esc(lote.nombre) + '</div>';
    html +=   '<div class="dl-hub-chips">';
    if (cultivo) html += chip('🌾 ' + cultivo);
    html +=     chip('<span style="color:' + eConf.texto + '">' + eConf.label + '</span>');
    if (coord)  html += chip('📍 ' + esc(coord));
    if (sup)    html += chip('📐 ' + esc(sup) + ' has');
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
      html += hubBtn(key, s.emoji, s.titulo, s.desc, s.color);
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

    var html = '<div class="dl-page dl-page-sec">';

    // Breadcrumb
    html += breadcrumb([
      { label: 'Mis Lotes',      onclick: 'window.dlVolverCards()' },
      { label: esc(lote.nombre), onclick: 'window.dlAbrirLote(\'' + esc(loteId) + '\')' }
    ], sec.titulo);

    // Header sección
    html += '<div class="dl-sec-header" style="border-left-color:' + sec.color + '">';
    html +=   '<span class="dl-sec-emoji">' + sec.emoji + '</span>';
    html +=   '<span class="dl-sec-titulo">' + sec.titulo + '</span>';
    html += '</div>';

    // Widgets contextuales según sección
    if (secKey === 'monitoreo') html += renderWidgetMonitoreo(lote);
    if (secKey === 'planfina') {
      html += renderWidgetPlanFina(lote);
      // Score de cultivos (si score-cultivares.js está cargado)
      if (typeof window.dlRenderScoreCultivares === 'function') {
        html += window.dlRenderScoreCultivares(lote);
      }
    }

    // Grid de módulos
    html += '<div class="dl-modulos-grid">';
    sec.modulos.forEach(function (m) {
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

  // ══════════════════════════════════════════════════════
  // WIDGETS DE DATOS EN TIEMPO REAL
  // ══════════════════════════════════════════════════════

  // ── Panel de estado para Monitoreo ────────────────────
  function renderWidgetMonitoreo(lote) {
    var d  = lote.data || {};
    var ck = d.calcKeys || {};

    var fenEtapa     = ck['am_fen_etapa_hoy']       || '';
    var fenFechaFin  = ck['am_fen_fecha_etapa_fin']  || '';
    var fenDurCiclo  = parseFloat(ck['am_fen_duracion_ciclo']) || 0;
    var cultivo      = d.cultivo || ck['am_siembra_cultivo']   || '';
    var fechaSiembra = d.fecha   || ck['am_siembra_fecha']     || '';
    var aguaMm       = parseFloat(ck['am_hidrico_agua_actual_mm'])  || 0;
    var aguaCC       = parseFloat(ck['am_hidrico_cap_max_mm'])      || 0;
    var deficitAcum  = parseFloat(ck['am_hidrico_deficit_acum_mm']) || 0;
    var diasEstres   = parseFloat(ck['am_hidrico_dias_estres'])     || 0;
    var ensoFase     = ck['am_enso_fase'] || '';
    var alertas      = [];
    try { alertas = JSON.parse(ck['am_alertas_activas'] || '[]'); } catch(e) {}
    if (!Array.isArray(alertas)) alertas = [];

    // Verificar si hay datos suficientes para mostrar el panel
    var tieneDatos = fenEtapa || (aguaCC > 0) || ensoFase;
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
    if (fenEtapa || pctCiclo > 0) {
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

    var cultivo     = d.cultivo || ck['am_siembra_cultivo']       || '';
    var fecha       = d.fecha   || ck['am_siembra_fecha']         || '';
    var coord       = d.coord   || '';
    var sueloTex    = d['sg-textura'] || ck['am_siembra_suelo'] || '';
    var sueloPH     = d['sg-ph']      || '';
    var ensoFase    = ck['am_enso_fase']  || '';
    var sup         = d.superficie        || '';

    var tieneDatos  = cultivo || fecha || coord || sueloTex;
    if (!tieneDatos) return '';

    var html = '<div class="dlw-panel dlw-panel-fina">';
    html += '<div class="dlw-panel-titulo">📋 Contexto del lote</div>';
    html += '<div class="dlw-chips-row">';

    if (cultivo)  html += '<span class="dlw-chip-data">🌾 ' + esc(cultivo) + '</span>';
    if (fecha)    html += '<span class="dlw-chip-data">📅 Siembra: ' + esc(fecha) + '</span>';
    if (coord)    html += '<span class="dlw-chip-data">📍 ' + esc(coord) + '</span>';
    if (sup)      html += '<span class="dlw-chip-data">📐 ' + esc(sup) + ' has</span>';
    if (sueloTex) html += '<span class="dlw-chip-data">🌍 ' + esc(sueloTex) + '</span>';
    if (sueloPH)  html += '<span class="dlw-chip-data">⚗️ pH: ' + esc(sueloPH) + '</span>';
    if (ensoFase) html += '<span class="dlw-chip-data">🌡️ ' + esc(ensoFase) + '</span>';

    html += '</div>';
    html += '</div>';
    return html;
  }

  // ── Barra de progreso fenológico para las cards ───────
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

  function chip(contenido) {
    return '<span class="dl-chip">' + contenido + '</span>';
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

  window.dlVolverCards = function () {
    _loteAbierto    = null;
    _seccionAbierta = null;
    renderPanel();
  };

  window.dlAbrirModulo = function (mod, loteId) {
    activarLote(loteId);
    _modContext = { loteId: loteId, secKey: _seccionAbierta, mod: mod };
    // Ir a vista clásica y abrir el módulo
    window.dlIrClasica();
    if (typeof switchMod === 'function') switchMod(mod);
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

  // Vista clásica: activar sidebar + mostrar dashboard clásico
  // Activamos el panel directamente para no pasar por amTieneAcceso
  window.dlIrClasica = function () {
    document.body.classList.add('dl-modo-clasico');
    document.body.classList.remove('dl-modo-nuevo');
    // Activar mod-dashboard directamente (bypass amTieneAcceso)
    document.querySelectorAll('.module-panel').forEach(function (p) {
      p.classList.remove('active');
    });
    var dash = document.getElementById('mod-dashboard');
    if (dash) dash.classList.add('active');
    var btnVolver = document.getElementById('btn-volver-dash');
    if (btnVolver) {
      btnVolver.classList.add('hidden');
      btnVolver.textContent = '← Volver';
      btnVolver.title = 'Volver';
    }
    var btnPDF = document.getElementById('btn-pdf-modulo');
    if (btnPDF) btnPDF.classList.add('hidden');
    // Sincronizar nav tab
    document.querySelectorAll('.nav-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.mod === 'dashboard');
    });
  };

  // Volver a la nueva UX desde la vista clásica
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
  window.dlInit = init;

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
    btnVolver.textContent = _modContext && _modContext.secKey ? '← Volver a ' + SECCIONES[_modContext.secKey].titulo : '← Mis Lotes';
    btnVolver.title = _modContext && _modContext.secKey ? 'Volver al hub anterior' : 'Volver a Mis Lotes';
  }

})();
