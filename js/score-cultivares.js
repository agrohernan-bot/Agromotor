// ════════════════════════════════════════════════════════
// AGROMOTOR — score-cultivares.js
// Score 0-100 por cultivo basado en:
//   30 pts → Fecha de siembra vs ventana RECSO/INTA
//   25 pts → Balance hídrico del lote
//   20 pts → Fase ENSO/NOAA
//   25 pts → Zona agroecológica (latitud)
// Usa CV_ZONAS de cultivares.js como fuente de datos
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Lista de cultivos a evaluar ───────────────────────
  var CULTIVOS = [
    { key: 'Trigo',   emoji: '🌾', label: 'Trigo',   grupo: 'invierno' },
    { key: 'Cebada',  emoji: '🌾', label: 'Cebada',  grupo: 'invierno' },
    { key: 'Colza',   emoji: '🟡', label: 'Colza',   grupo: 'invierno' },
    { key: 'Soja',    emoji: '🌱', label: 'Soja',    grupo: 'verano'   },
    { key: 'Maíz',    emoji: '🌽', label: 'Maíz',    grupo: 'verano'   },
    { key: 'Girasol', emoji: '🌻', label: 'Girasol', grupo: 'verano'   },
    { key: 'Sorgo',   emoji: '🌾', label: 'Sorgo',   grupo: 'verano'   },
  ];

  // ── Ventanas de siembra para cultivos sin datos en CV_ZONAS ──
  // (Cebada, Colza, Sorgo — datos INTA Argentina)
  var VENTANAS_EXTRA = {
    // pampeana_norte
    pampeana_norte: {
      Cebada:  { primera:'15-jun al 10-jul', segunda:'11-jul al 31-jul', temprana:'1-jun al 14-jun', tardia:'1-ago al 15-ago' },
      Colza:   { primera:'1-abr al 30-abr',  segunda:'1-may al 15-may',  temprana:'15-mar al 31-mar', tardia:'1-jun al 15-jun' },
      Sorgo:   { primera:'1-nov al 15-dic',  segunda:'16-dic al 15-ene', temprana:'15-oct al 31-oct', tardia:'16-ene al 28-feb' },
    },
    // pampeana_sur
    pampeana_sur: {
      Cebada:  { primera:'1-jun al 30-jun', segunda:'1-jul al 31-jul', temprana:'15-may al 31-may', tardia:'1-ago al 15-ago' },
      Colza:   { primera:'1-mar al 30-abr', segunda:'1-may al 15-may', temprana:'15-feb al 28-feb', tardia:'16-may al 31-may' },
      Sorgo:   { primera:'1-nov al 30-nov', segunda:'1-dic al 15-ene', temprana:'15-oct al 31-oct', tardia:'16-ene al 28-feb' },
    },
    // semiarida
    semiarida: {
      Cebada:  { primera:'1-jun al 30-jun', segunda:'1-jul al 31-jul', temprana:'15-may al 31-may', tardia:'1-ago al 15-ago' },
      Colza:   { primera:'1-abr al 30-abr', segunda:'1-may al 15-may', temprana:'15-mar al 31-mar', tardia:'1-jun al 15-jun' },
      Sorgo:   { primera:'15-nov al 15-dic', segunda:'16-dic al 31-ene', temprana:'1-nov al 14-nov', tardia:'1-feb al 28-feb' },
    },
    // nea
    nea: {
      Cebada:  { primera:'15-jun al 15-jul', segunda:'16-jul al 15-ago', temprana:'1-jun al 14-jun', tardia:'16-ago al 31-ago' },
      Colza:   null, // no recomendada en NEA
      Sorgo:   { primera:'1-oct al 30-nov', segunda:'1-dic al 31-ene', temprana:'15-sep al 30-sep', tardia:'1-feb al 28-feb' },
    },
    // noa
    noa: {
      Cebada:  { primera:'15-jun al 31-jul', segunda:'1-ago al 31-ago', temprana:'1-jun al 14-jun', tardia:'1-sep al 30-sep' },
      Colza:   null,
      Sorgo:   { primera:'1-oct al 15-nov', segunda:'16-nov al 31-dic', temprana:'15-sep al 30-sep', tardia:'1-ene al 31-ene' },
    },
  };

  // ── Tolerancia hídrica por cultivo ────────────────────
  // opt: % CC para score máximo; min: % CC para score mínimo
  var TOLERANCIA_HIDRICA = {
    Trigo:   { opt: 50, min: 28, desc: 'tolerante a sequía moderada' },
    Cebada:  { opt: 45, min: 25, desc: 'muy tolerante a sequía' },
    Colza:   { opt: 60, min: 38, desc: 'requiere buena humedad' },
    Soja:    { opt: 60, min: 40, desc: 'alta demanda hídrica' },
    Maíz:    { opt: 65, min: 45, desc: 'muy alta demanda hídrica' },
    Girasol: { opt: 55, min: 30, desc: 'moderada demanda, tolera sequía' },
    Sorgo:   { opt: 40, min: 15, desc: 'alta tolerancia a sequía' },
  };

  // ── Respuesta ENSO por cultivo ─────────────────────────
  // El Niño → más lluvias en Pampa → favorece demandantes de agua
  // La Niña → menos lluvias → favorece tolerantes a sequía
  var ENSO_RESP = {
    Trigo:   { nino: -1, nina: +1, desc: 'La Niña favorece (menor exceso de humedad)' },
    Cebada:  { nino: -1, nina: +1, desc: 'La Niña favorece (menor riesgo de fusarium)' },
    Colza:   { nino: +1, nina:  0, desc: 'El Niño puede mejorar rendimiento' },
    Soja:    { nino: +1, nina: -1, desc: 'El Niño favorece (más lluvias en floración)' },
    Maíz:    { nino: +1, nina: -1, desc: 'El Niño favorece (menos estrés en llenado)' },
    Girasol: { nino:  0, nina:  0, desc: 'Respuesta neutra al ENSO' },
    Sorgo:   { nino:  0, nina: +1, desc: 'La Niña no lo afecta — tolerante' },
  };

  // ── Cultivos por zona ──────────────────────────────────
  var CULTIVOS_POR_ZONA = {
    pampeana_norte: ['Soja','Maíz','Trigo','Girasol','Cebada','Sorgo'],
    pampeana_sur:   ['Trigo','Cebada','Soja','Girasol','Maíz','Colza'],
    semiarida:      ['Trigo','Cebada','Soja','Sorgo','Girasol','Maíz'],
    nea:            ['Soja','Maíz','Sorgo','Trigo','Girasol'],
    noa:            ['Soja','Maíz','Sorgo','Trigo','Cebada'],
  };

  // ══════════════════════════════════════════════════════
  // MOTOR DE SCORING
  // ══════════════════════════════════════════════════════

  var MESES = { ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11 };

  function parsearFecha(str) {
    var p = str.trim().split('-');
    if (p.length < 2) return null;
    var dia = parseInt(p[0]);
    var mes = MESES[p[1].toLowerCase()];
    return (isNaN(dia) || mes === undefined) ? null : { dia: dia, mes: mes };
  }

  function parsearVentana(v) {
    var p = v.split(' al ');
    if (p.length < 2) return null;
    var ini = parsearFecha(p[0]);
    var fin = parsearFecha(p[1]);
    return (ini && fin) ? { ini: ini, fin: fin } : null;
  }

  function enVentana(mes, dia, v) {
    var sN = v.ini.mes * 100 + v.ini.dia;
    var eN = v.fin.mes * 100 + v.fin.dia;
    var dN = mes * 100 + dia;
    return sN <= eN ? (dN >= sN && dN <= eN) : (dN >= sN || dN <= eN);
  }

  function detectarZona(lat) {
    if (!lat) return null;
    var latN = parseFloat(lat);
    if (isNaN(latN)) return null;
    var CV = (typeof CV_ZONAS !== 'undefined') ? CV_ZONAS : null;
    if (!CV) return null;
    var orden = ['pampeana_norte','pampeana_sur','semiarida','nea','noa'];
    for (var i = 0; i < orden.length; i++) {
      var k = orden[i];
      if (CV[k] && latN >= CV[k].latMin && latN <= CV[k].latMax) return k;
    }
    // Si no matchea, usar la zona más cercana
    if (latN > -29) return 'noa';
    if (latN < -39) return 'pampeana_sur';
    return 'pampeana_norte';
  }

  // ── Score de fecha ─────────────────────────────────────
  function calcScoreFecha(cultivo, zona, fechaStr) {
    if (!fechaStr) return { pts: 15, tipo: null, label: 'Sin fecha de siembra definida' };
    var fecha = new Date(fechaStr + 'T12:00:00');
    var mes = fecha.getMonth();
    var dia = fecha.getDate();

    // Buscar ventana: primero en CV_ZONAS, luego en VENTANAS_EXTRA
    var CV = (typeof CV_ZONAS !== 'undefined') ? CV_ZONAS : null;
    var ventanas = (CV && CV[zona] && CV[zona].cultivos[cultivo])
      ? CV[zona].cultivos[cultivo].ventana
      : (VENTANAS_EXTRA[zona] && VENTANAS_EXTRA[zona][cultivo]);

    if (!ventanas) return { pts: 10, tipo: 'sin_data', label: 'Sin datos de ventana para esta zona' };

    var orden = ['primera','segunda','temprana','tardia'];
    var ptsMap = { primera: 30, segunda: 22, temprana: 16, tardia: 8 };
    var lblMap = {
      primera:  'Ventana óptima ✓',
      segunda:  'Segunda época — aceptable',
      temprana: 'Siembra temprana — riesgo leve',
      tardia:   'Siembra tardía — menor potencial',
    };
    for (var i = 0; i < orden.length; i++) {
      var tipo = orden[i];
      if (!ventanas[tipo]) continue;
      var v = parsearVentana(ventanas[tipo]);
      if (v && enVentana(mes, dia, v)) {
        return { pts: ptsMap[tipo], tipo: tipo, label: lblMap[tipo] };
      }
    }
    return { pts: 0, tipo: 'fuera', label: 'Fuera de ventana de siembra ✗' };
  }

  // ── Score hídrico ──────────────────────────────────────
  function calcScoreHidrico(cultivo, pctAgua) {
    if (pctAgua < 0) return { pts: 15, label: 'Sin datos de agua' };
    var t = TOLERANCIA_HIDRICA[cultivo] || { opt: 55, min: 35 };
    if (pctAgua >= t.opt) return { pts: 25, label: 'Agua disponible óptima ✓' };
    if (pctAgua >= t.min) {
      var fraccion = (pctAgua - t.min) / (t.opt - t.min);
      var pts = Math.round(10 + fraccion * 14); // 10 a 24
      return { pts: pts, label: 'Agua disponible moderada' };
    }
    return { pts: 3, label: 'Agua insuficiente — riesgo alto ✗' };
  }

  // ── Score ENSO ─────────────────────────────────────────
  function calcScoreENSO(cultivo, fase) {
    if (!fase) return { pts: 12, label: 'Sin datos ENSO' };
    var r = ENSO_RESP[cultivo] || { nino: 0, nina: 0 };
    var esNino = /niño|nino/i.test(fase);
    var esNina = /niña|nina/i.test(fase);
    if (esNino) return r.nino > 0 ? { pts: 20, label: 'El Niño — favorable ✓' }
                     : r.nino < 0 ? { pts: 5,  label: 'El Niño — mayor riesgo ✗' }
                                  : { pts: 12, label: 'El Niño — impacto neutro' };
    if (esNina) return r.nina > 0 ? { pts: 20, label: 'La Niña — favorable ✓' }
                     : r.nina < 0 ? { pts: 5,  label: 'La Niña — mayor riesgo ✗' }
                                  : { pts: 12, label: 'La Niña — impacto neutro' };
    return { pts: 12, label: 'ENSO neutro' };
  }

  // ── Score de zona ──────────────────────────────────────
  function calcScoreZona(cultivo, zona) {
    if (!zona) return { pts: 15, label: 'Sin coordenadas del lote' };
    var lista = CULTIVOS_POR_ZONA[zona] || [];
    var idx   = lista.indexOf(cultivo);
    var CV    = (typeof CV_ZONAS !== 'undefined') ? CV_ZONAS : null;
    var zonaLabel = (CV && CV[zona]) ? CV[zona].label : zona;
    if (idx < 0) return { pts: 5,  label: 'No recomendado en ' + zonaLabel };
    if (idx === 0) return { pts: 25, label: zonaLabel + ' — cultivo principal ✓' };
    if (idx <= 2)  return { pts: 20, label: zonaLabel + ' — muy recomendado ✓' };
    return           { pts: 14, label: zonaLabel + ' — posible con manejo' };
  }

  // ── Score total ────────────────────────────────────────
  function calcularScore(cultivo, params) {
    // params: { zona, fechaStr, pctAgua, fase }
    var sFecha  = calcScoreFecha(cultivo,  params.zona, params.fechaStr);
    var sHidro  = calcScoreHidrico(cultivo, params.pctAgua);
    var sEnso   = calcScoreENSO(cultivo,   params.fase);
    var sZona   = calcScoreZona(cultivo,   params.zona);
    var total   = sFecha.pts + sHidro.pts + sEnso.pts + sZona.pts;
    return {
      total:  total,
      fecha:  sFecha,
      hidro:  sHidro,
      enso:   sEnso,
      zona:   sZona,
    };
  }

  // ══════════════════════════════════════════════════════
  // RENDER DEL WIDGET
  // ══════════════════════════════════════════════════════

  window.dlRenderScoreCultivares = function (lote) {
    var d  = lote.data || {};
    var ck = d.calcKeys || {};

    var coord      = d.coord   || '';
    var fechaStr   = d.fecha   || ck['am_siembra_fecha'] || '';
    var cultivoAct = d.cultivo || ck['am_siembra_cultivo'] || '';
    var aguaMm     = parseFloat(ck['am_hidrico_agua_actual_mm']) || 0;
    var aguaCC     = parseFloat(ck['am_hidrico_cap_max_mm'])     || 0;
    var fase       = ck['am_enso_fase'] || '';

    var lat = coord ? coord.split(',')[0] : null;
    var zona = detectarZona(lat);
    var CV   = (typeof CV_ZONAS !== 'undefined') ? CV_ZONAS : null;

    var pctAgua = aguaCC > 0 ? Math.min(100, Math.round(aguaMm / aguaCC * 100)) : -1;

    var params = { zona: zona, fechaStr: fechaStr, pctAgua: pctAgua, fase: fase };

    // Calcular scores para todos los cultivos
    var scored = CULTIVOS.map(function (c) {
      return Object.assign({}, c, { score: calcularScore(c.key, params) });
    });

    // Ordenar por score total descendente
    scored.sort(function (a, b) { return b.score.total - a.score.total; });

    // ── Construir HTML ─────────────────────────────────
    var html = '<div class="sc-widget">';

    // Header
    html += '<div class="sc-header">';
    html +=   '<div class="sc-titulo">🏆 Score de cultivos <span class="sc-subtitulo">¿qué conviene sembrar en este lote?</span></div>';
    html +=   '<div class="sc-meta">';
    if (zona && CV && CV[zona]) html += '<span class="sc-chip">📍 ' + CV[zona].label + '</span>';
    if (fechaStr)   html += '<span class="sc-chip">📅 ' + fechaStr + '</span>';
    if (pctAgua >= 0) html += '<span class="sc-chip">💧 ' + pctAgua + '% CC</span>';
    if (fase)       html += '<span class="sc-chip">🌡️ ' + fase + '</span>';
    if (!coord)     html += '<span class="sc-chip sc-chip-warn">⚠ Sin coordenadas — score aproximado</span>';
    html +=   '</div>';
    html += '</div>';

    // Tabla
    html += '<div class="sc-tabla">';
    html += '<div class="sc-tabla-head">';
    html +=   '<span>Cultivo</span>';
    html +=   '<span class="sc-col-fecha">Fecha</span>';
    html +=   '<span class="sc-col-agua">Agua</span>';
    html +=   '<span class="sc-col-enso">ENSO</span>';
    html +=   '<span class="sc-col-zona">Zona</span>';
    html +=   '<span class="sc-col-total">Score</span>';
    html +=   '<span></span>';
    html += '</div>';

    scored.forEach(function (c, idx) {
      var s = c.score;
      var esActivo = c.key === cultivoAct;
      var color = s.total >= 85 ? '#6DBF82'
                : s.total >= 65 ? '#C8A255'
                : s.total >= 45 ? '#E8A040'
                : '#D4522A';
      var emoji_nivel = s.total >= 85 ? '✅' : s.total >= 65 ? '🟡' : s.total >= 45 ? '🟠' : '🔴';

      html += '<div class="sc-row' + (esActivo ? ' sc-row-activa' : '') + (idx === 0 ? ' sc-row-top' : '') + '">';

      // Cultivo
      html += '<div class="sc-cultivo">';
      html +=   '<span class="sc-emoji">' + c.emoji + '</span>';
      html +=   '<span class="sc-nombre">' + c.label + '</span>';
      if (esActivo) html += '<span class="sc-activo-badge">activo</span>';
      if (idx === 0 && !esActivo) html += '<span class="sc-top-badge">mejor opción</span>';
      html += '</div>';

      // Sub-scores con tooltip
      html += ptsCell(s.fecha.pts,  30, s.fecha.label,  'sc-col-fecha');
      html += ptsCell(s.hidro.pts,  25, s.hidro.label,  'sc-col-agua');
      html += ptsCell(s.enso.pts,   20, s.enso.label,   'sc-col-enso');
      html += ptsCell(s.zona.pts,   25, s.zona.label,   'sc-col-zona');

      // Total
      html += '<div class="sc-col-total">';
      html +=   '<span class="sc-total" style="color:' + color + '">' + emoji_nivel + ' ' + s.total + '</span>';
      html += '</div>';

      // Botón seleccionar
      html += '<div>';
      if (esActivo) {
        html += '<span class="sc-sel-actual">✓</span>';
      } else {
        html += '<button class="sc-btn-sel" onclick="window.dlSeleccionarCultivo(\'' + c.key + '\',\'' + lote.id + '\')">Usar</button>';
      }
      html += '</div>';

      html += '</div>'; // .sc-row
    });

    html += '</div>'; // .sc-tabla

    // Nota metodológica
    html += '<div class="sc-nota">Criterios: ventanas RECSO/INTA · Balance hídrico actual · Fase ENSO/NOAA · Zona agroecológica por latitud. No reemplaza el análisis profesional.</div>';
    html += '</div>'; // .sc-widget

    return html;
  };

  function ptsCell(pts, max, tooltip, clase) {
    var pct  = Math.round(pts / max * 100);
    var col  = pct >= 85 ? '#6DBF82' : pct >= 60 ? '#C8A255' : '#D4522A';
    return [
      '<div class="sc-pts-cell ' + clase + '" title="' + esc(tooltip) + '">',
        '<div class="sc-pts-bar"><div style="width:' + pct + '%;background:' + col + '" class="sc-pts-fill"></div></div>',
        '<span class="sc-pts-num" style="color:' + col + '">' + pts + '</span>',
      '</div>'
    ].join('');
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Acción: seleccionar cultivo ────────────────────────
  window.dlSeleccionarCultivo = function (cultivo, loteId) {
    var lote = (window.AM_LOTES || []).find(function (l) { return l.id === loteId; });
    if (!lote) return;
    lote.data = lote.data || {};
    lote.data.cultivo = cultivo;

    if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
    if (typeof amRenderSelectLotes  === 'function') amRenderSelectLotes();

    // Sincronizar con el selector global del módulo siembra
    var sSelect = document.getElementById('s-cultivo');
    if (sSelect) {
      sSelect.value = cultivo;
      sSelect.dispatchEvent(new Event('change'));
    }

    if (typeof amToast === 'function') amToast(cultivo + ' seleccionado como cultivo del lote ✓', 'ok');

    // Refrescar la sección para mostrar el cambio
    if (typeof window.dlAbrirSeccion === 'function') window.dlAbrirSeccion('planfina');
  };

})();
