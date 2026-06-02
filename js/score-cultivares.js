// ════════════════════════════════════════════════════════
// AGROMOTOR — score-cultivares.js
// Score 0-100 por cultivo en 5 criterios (100 pts):
//   25 pts → Fecha de siembra vs ventana RECSO/INTA
//   20 pts → Balance hídrico del lote
//   15 pts → Fase ENSO/NOAA
//   25 pts → Zona agroecológica (latitud)
//   15 pts → Rotación (cultivo antecesor)
// Cultivos filtrados por grupo:
//   invierno → Trigo, Cebada, Colza (Planificación Fina)
//   verano   → Soja, Maíz, Girasol, Sorgo (Planificación Gruesa)
// Métricas económicas adicionales:
//   Rendimiento estimado (t/ha), Margen bruto (USD/ha),
//   Relación insumos/producto (qq)
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Cultivos por grupo ────────────────────────────────
  var CULTIVOS_INVIERNO = [
    { key: 'Trigo',  emoji: '🌾', label: 'Trigo',  grupo: 'invierno' },
    { key: 'Cebada', emoji: '🌾', label: 'Cebada', grupo: 'invierno' },
    { key: 'Colza',  emoji: '🟡', label: 'Colza',  grupo: 'invierno' },
  ];
  var CULTIVOS_VERANO = [
    { key: 'Soja',    emoji: '🌱', label: 'Soja',    grupo: 'verano' },
    { key: 'Maíz',    emoji: '🌽', label: 'Maíz',    grupo: 'verano' },
    { key: 'Girasol', emoji: '🌻', label: 'Girasol', grupo: 'verano' },
    { key: 'Sorgo',   emoji: '🌾', label: 'Sorgo',   grupo: 'verano' },
  ];

  // ── Datos económicos y agronómicos por cultivo ────────
  // rendBase/Opt: t/ha según agua disponible
  // costoBase: USD/ha campaña referencia 24/25
  // retencion: % export Argentina
  // aguaMin/Opt: mm necesarios para score mínimo/máximo
  // penRot: penalización por monocultivo (pts sobre 15)
  // precioRef: USD/t mercado local referencia
  // ensoNino/Nina: % ajuste rendimiento por fase ENSO
  var ECON = {
    Trigo:   { rendBase:3.5, rendOpt:5.5,  costoBase:450, retencion:12, aguaMin:250, aguaOpt:400, penRot:5,  precioRef:215, ensoNino:+5,  ensoNina:-8  },
    Cebada:  { rendBase:3.0, rendOpt:5.0,  costoBase:420, retencion:12, aguaMin:220, aguaOpt:380, penRot:5,  precioRef:210, ensoNino:-5,  ensoNina:+3  },
    Colza:   { rendBase:1.5, rendOpt:2.8,  costoBase:550, retencion:7,  aguaMin:300, aguaOpt:450, penRot:5,  precioRef:470, ensoNino:+8,  ensoNina:0   },
    Soja:    { rendBase:3.2, rendOpt:4.5,  costoBase:580, retencion:33, aguaMin:300, aguaOpt:500, penRot:15, precioRef:300, ensoNino:+10, ensoNina:-15 },
    Maíz:    { rendBase:8.0, rendOpt:12.0, costoBase:850, retencion:12, aguaMin:400, aguaOpt:600, penRot:8,  precioRef:215, ensoNino:+15, ensoNina:-20 },
    Girasol: { rendBase:2.2, rendOpt:3.5,  costoBase:480, retencion:7,  aguaMin:300, aguaOpt:500, penRot:10, precioRef:330, ensoNino:+8,  ensoNina:-12 },
    Sorgo:   { rendBase:6.0, rendOpt:9.0,  costoBase:420, retencion:12, aguaMin:200, aguaOpt:400, penRot:5,  precioRef:175, ensoNino:+8,  ensoNina:-10 },
  };

  // ── Ventanas de siembra ────────────────────────────────
  var VENTANAS_EXTRA = {
    pampeana_norte: {
      Cebada: { primera:'15-jun al 10-jul', segunda:'11-jul al 31-jul', temprana:'1-jun al 14-jun', tardia:'1-ago al 15-ago' },
      Colza:  { primera:'1-abr al 30-abr',  segunda:'1-may al 15-may',  temprana:'15-mar al 31-mar', tardia:'1-jun al 15-jun' },
      Sorgo:  { primera:'1-nov al 15-dic',  segunda:'16-dic al 15-ene', temprana:'15-oct al 31-oct', tardia:'16-ene al 28-feb' },
    },
    pampeana_sur: {
      Cebada: { primera:'1-jun al 30-jun', segunda:'1-jul al 31-jul', temprana:'15-may al 31-may', tardia:'1-ago al 15-ago' },
      Colza:  { primera:'1-mar al 30-abr', segunda:'1-may al 15-may', temprana:'15-feb al 28-feb', tardia:'16-may al 31-may' },
      Sorgo:  { primera:'1-nov al 30-nov', segunda:'1-dic al 15-ene', temprana:'15-oct al 31-oct', tardia:'16-ene al 28-feb' },
    },
    semiarida: {
      Cebada: { primera:'1-jun al 30-jun', segunda:'1-jul al 31-jul', temprana:'15-may al 31-may', tardia:'1-ago al 15-ago' },
      Colza:  { primera:'1-abr al 30-abr', segunda:'1-may al 15-may', temprana:'15-mar al 31-mar', tardia:'1-jun al 15-jun' },
      Sorgo:  { primera:'15-nov al 15-dic', segunda:'16-dic al 31-ene', temprana:'1-nov al 14-nov', tardia:'1-feb al 28-feb' },
    },
    nea: {
      Cebada: { primera:'15-jun al 15-jul', segunda:'16-jul al 15-ago', temprana:'1-jun al 14-jun', tardia:'16-ago al 31-ago' },
      Colza:  null,
      Sorgo:  { primera:'1-oct al 30-nov', segunda:'1-dic al 31-ene', temprana:'15-sep al 30-sep', tardia:'1-feb al 28-feb' },
    },
    noa: {
      Cebada: { primera:'15-jun al 31-jul', segunda:'1-ago al 31-ago', temprana:'1-jun al 14-jun', tardia:'1-sep al 30-sep' },
      Colza:  null,
      Sorgo:  { primera:'1-oct al 15-nov', segunda:'16-nov al 31-dic', temprana:'15-sep al 30-sep', tardia:'1-ene al 31-ene' },
    },
  };

  // ── Tolerancia hídrica ────────────────────────────────
  var TOL_HIDRICA = {
    Trigo:   { opt: 50, min: 28 },
    Cebada:  { opt: 45, min: 25 },
    Colza:   { opt: 60, min: 38 },
    Soja:    { opt: 60, min: 40 },
    Maíz:    { opt: 65, min: 45 },
    Girasol: { opt: 55, min: 30 },
    Sorgo:   { opt: 40, min: 15 },
  };

  // ── Respuesta ENSO ────────────────────────────────────
  var ENSO_RESP = {
    Trigo:   { nino: -1, nina: +1 },
    Cebada:  { nino: -1, nina: +1 },
    Colza:   { nino: +1, nina:  0 },
    Soja:    { nino: +1, nina: -1 },
    Maíz:    { nino: +1, nina: -1 },
    Girasol: { nino:  0, nina:  0 },
    Sorgo:   { nino:  0, nina: +1 },
  };

  // ── Cultivos por zona ─────────────────────────────────
  var CULTIVOS_POR_ZONA = {
    pampeana_norte: ['Soja','Maíz','Trigo','Girasol','Cebada','Sorgo'],
    pampeana_sur:   ['Trigo','Cebada','Soja','Girasol','Maíz','Colza'],
    semiarida:      ['Trigo','Cebada','Soja','Sorgo','Girasol','Maíz'],
    nea:            ['Soja','Maíz','Sorgo','Trigo','Girasol'],
    noa:            ['Soja','Maíz','Sorgo','Trigo','Cebada'],
  };

  // ── Antecesores disponibles ───────────────────────────
  var ANTECESORES = [
    { key: 'ninguno', label: 'Ninguno' },
    { key: 'no_se',   label: 'No sé' },
    { key: 'Soja',    label: '🌱 Soja' },
    { key: 'Maíz',    label: '🌽 Maíz' },
    { key: 'Trigo',   label: '🌾 Trigo' },
    { key: 'Cebada',  label: '🌾 Cebada' },
    { key: 'Girasol', label: '🌻 Girasol' },
    { key: 'Sorgo',   label: '🌾 Sorgo' },
    { key: 'Colza',   label: '🟡 Colza' },
  ];

  // ══════════════════════════════════════════════════════
  // MOTOR DE SCORING (100 pts en 5 criterios)
  // ══════════════════════════════════════════════════════

  var MESES = { ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11 };

  function parsearFecha(str) {
    var p = str.trim().split('-');
    var dia = parseInt(p[0]);
    var mes = MESES[p[1] && p[1].toLowerCase()];
    return (isNaN(dia) || mes === undefined) ? null : { dia:dia, mes:mes };
  }

  function parsearVentana(v) {
    var p = v.split(' al ');
    var ini = parsearFecha(p[0]);
    var fin = parsearFecha(p[1]);
    return (ini && fin) ? { ini:ini, fin:fin } : null;
  }

  function enVentana(mes, dia, v) {
    var sN = v.ini.mes*100 + v.ini.dia;
    var eN = v.fin.mes*100 + v.fin.dia;
    var dN = mes*100 + dia;
    return sN <= eN ? (dN >= sN && dN <= eN) : (dN >= sN || dN <= eN);
  }

  function detectarZona(lat) {
    if (!lat) return null;
    var latN = parseFloat(lat);
    if (isNaN(latN)) return null;
    var CV = (typeof window.CV_ZONAS !== 'undefined') ? window.CV_ZONAS : null;
    if (!CV) return null;
    var orden = ['pampeana_norte','pampeana_sur','semiarida','nea','noa'];
    for (var i = 0; i < orden.length; i++) {
      var k = orden[i];
      if (CV[k] && latN >= CV[k].latMin && latN <= CV[k].latMax) return k;
    }
    if (latN > -29) return 'noa';
    if (latN < -39) return 'pampeana_sur';
    return 'pampeana_norte';
  }

  // ── 1. Fecha (25 pts) ─────────────────────────────────
  function calcScoreFecha(cultivo, zona, fechaStr) {
    if (!fechaStr) return { pts:12, label:'Sin fecha de siembra definida' };
    var fecha = new Date(fechaStr + 'T12:00:00');
    var mes = fecha.getMonth();
    var dia = fecha.getDate();
    var CV = (typeof window.CV_ZONAS !== 'undefined') ? window.CV_ZONAS : null;
    var ventanas = (CV && CV[zona] && CV[zona].cultivos && CV[zona].cultivos[cultivo])
      ? CV[zona].cultivos[cultivo].ventana
      : (VENTANAS_EXTRA[zona] && VENTANAS_EXTRA[zona][cultivo]);
    if (!ventanas) return { pts:10, label:'Sin datos de ventana para esta zona' };
    var orden = ['primera','segunda','temprana','tardia'];
    var ptsMap = { primera:25, segunda:18, temprana:13, tardia:6 };
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
      if (v && enVentana(mes, dia, v)) return { pts:ptsMap[tipo], label:lblMap[tipo] };
    }
    return { pts:0, label:'Fuera de ventana de siembra ✗' };
  }

  // ── 2. Agua (20 pts) ──────────────────────────────────
  function calcScoreHidrico(cultivo, pctAgua) {
    if (pctAgua < 0) return { pts:10, label:'Sin datos de agua disponible' };
    var t = TOL_HIDRICA[cultivo] || { opt:55, min:35 };
    if (pctAgua >= t.opt) return { pts:20, label:'Agua disponible óptima ✓' };
    if (pctAgua >= t.min) {
      var pts = Math.round(8 + (pctAgua - t.min) / (t.opt - t.min) * 11);
      return { pts:pts, label:'Agua disponible moderada' };
    }
    return { pts:2, label:'Agua insuficiente — riesgo alto ✗' };
  }

  // ── 3. ENSO (15 pts) ──────────────────────────────────
  function calcScoreENSO(cultivo, fase) {
    if (!fase) return { pts:9, label:'Sin datos ENSO' };
    var r = ENSO_RESP[cultivo] || { nino:0, nina:0 };
    var esNino = /niño|nino/i.test(fase);
    var esNina = /niña|nina/i.test(fase);
    if (esNino) return r.nino > 0 ? { pts:15, label:'El Niño — favorable ✓' }
                     : r.nino < 0 ? { pts:3,  label:'El Niño — mayor riesgo ✗' }
                                  : { pts:9,  label:'El Niño — impacto neutro' };
    if (esNina) return r.nina > 0 ? { pts:15, label:'La Niña — favorable ✓' }
                     : r.nina < 0 ? { pts:3,  label:'La Niña — mayor riesgo ✗' }
                                  : { pts:9,  label:'La Niña — impacto neutro' };
    return { pts:9, label:'ENSO neutro — sin ajuste' };
  }

  // ── 4. Zona (25 pts) ──────────────────────────────────
  function calcScoreZona(cultivo, zona) {
    if (!zona) return { pts:14, label:'Sin coordenadas del lote' };
    var lista = CULTIVOS_POR_ZONA[zona] || [];
    var idx   = lista.indexOf(cultivo);
    var CV    = (typeof window.CV_ZONAS !== 'undefined') ? window.CV_ZONAS : null;
    var zLbl  = (CV && CV[zona]) ? CV[zona].label : zona;
    if (idx < 0)  return { pts:5,  label:'No recomendado en ' + zLbl };
    if (idx === 0) return { pts:25, label:zLbl + ' — cultivo principal ✓' };
    if (idx <= 2)  return { pts:20, label:zLbl + ' — muy recomendado ✓' };
    return               { pts:14, label:zLbl + ' — posible con manejo' };
  }

  // ── 5. Rotación (15 pts) ──────────────────────────────
  function calcScoreRotacion(cultivo, antecesor) {
    if (!antecesor || antecesor === 'no_se') return { pts:8, label:'Antecesor desconocido' };
    if (antecesor === 'ninguno') return { pts:15, label:'Primer cultivo en el lote — sin restricción ✓' };
    if (antecesor === cultivo) {
      var pen = (ECON[cultivo] && ECON[cultivo].penRot) || 8;
      var pts = Math.max(0, 15 - pen);
      var riesgo = pen >= 12 ? 'alto' : pen >= 7 ? 'moderado' : 'leve';
      return { pts:pts, label:cultivo + ' sobre ' + antecesor + ' — monocultivo, riesgo ' + riesgo + ' ✗' };
    }
    return { pts:15, label:'Rotación correcta: ' + cultivo + ' después de ' + antecesor + ' ✓' };
  }

  // ── Cálculo de métricas económicas ───────────────────
  function calcEconomia(cultivo, aguaMm, fase) {
    var e = ECON[cultivo];
    if (!e) return null;
    var factorAgua = aguaMm > 0 ? Math.min(1.1, aguaMm / e.aguaOpt) : 0.65;
    var ensoAdj = 0;
    if (fase) {
      if (/niño|nino/i.test(fase)) ensoAdj = e.ensoNino;
      else if (/niña|nina/i.test(fase)) ensoAdj = e.ensoNina;
    }
    var factorEnso = 1 + ensoAdj / 100;
    var rendEstim = (e.rendBase + (e.rendOpt - e.rendBase) * factorAgua) * factorEnso;
    rendEstim = Math.max(e.rendBase * 0.4, Math.round(rendEstim * 10) / 10);
    var precioNeto = e.precioRef * (1 - e.retencion / 100);
    var ingreso    = rendEstim * precioNeto;
    var margen     = Math.round(ingreso - e.costoBase);
    var relacion   = precioNeto > 0 ? (e.costoBase / precioNeto).toFixed(1) : '—';
    return {
      rendEstim:  rendEstim,
      margen:     margen,
      relacion:   relacion,
      precio:     e.precioRef,
      retencion:  e.retencion,
      costoBase:  e.costoBase,
    };
  }

  // ── Score total ────────────────────────────────────────
  function calcularScore(cultivo, params) {
    var sFecha  = calcScoreFecha(cultivo,   params.zona,     params.fechaStr);
    var sHidro  = calcScoreHidrico(cultivo, params.pctAgua);
    var sEnso   = calcScoreENSO(cultivo,    params.fase);
    var sZona   = calcScoreZona(cultivo,    params.zona);
    var sRot    = calcScoreRotacion(cultivo, params.antecesor);
    var eco     = calcEconomia(cultivo, params.aguaMm, params.fase);
    return {
      total:  sFecha.pts + sHidro.pts + sEnso.pts + sZona.pts + sRot.pts,
      fecha:  sFecha,
      hidro:  sHidro,
      enso:   sEnso,
      zona:   sZona,
      rot:    sRot,
      eco:    eco,
    };
  }

  // ══════════════════════════════════════════════════════
  // RENDER DEL WIDGET
  // ══════════════════════════════════════════════════════

  // grupo: 'invierno' → Trigo/Cebada/Colza
  //        'verano'   → Soja/Maíz/Girasol/Sorgo
  //        ''         → todos
  window.dlRenderScoreCultivares = function (lote, grupo) {
    var d  = lote.data || {};
    var ck = d.calcKeys || {};

    var coord      = d.coord   || '';
    var fechaStr   = d.fecha   || ck['am_siembra_fecha']           || '';
    var cultivoAct = d.cultivo || ck['am_siembra_cultivo']         || '';
    var aguaMm     = parseFloat(ck['am_hidrico_agua_actual_mm'])   || 0;
    var aguaCC     = parseFloat(ck['am_hidrico_cap_max_mm'])       || 0;
    var fase       = ck['am_enso_fase']                            || '';
    var antecesor  = d.antecesor || '';

    var lat     = coord ? coord.split(',')[0] : null;
    var zona    = detectarZona(lat);
    var CV      = (typeof window.CV_ZONAS !== 'undefined') ? window.CV_ZONAS : null;
    var pctAgua = aguaCC > 0 ? Math.min(100, Math.round(aguaMm / aguaCC * 100)) : -1;

    // Seleccionar cultivos según grupo (finos / gruesos)
    var listaCultivos = grupo === 'invierno' ? CULTIVOS_INVIERNO
                      : grupo === 'verano'   ? CULTIVOS_VERANO
                      : CULTIVOS_INVIERNO.concat(CULTIVOS_VERANO);

    var grupoLabel = grupo === 'invierno' ? 'Trigo · Cebada · Colza'
                   : grupo === 'verano'   ? 'Soja · Maíz · Girasol · Sorgo'
                   : 'Todos los cultivos';

    var params = { zona:zona, fechaStr:fechaStr, pctAgua:pctAgua, aguaMm:aguaMm, fase:fase, antecesor:antecesor };

    var scored = listaCultivos.map(function (c) {
      return Object.assign({}, c, { score: calcularScore(c.key, params) });
    });
    scored.sort(function (a, b) { return b.score.total - a.score.total; });

    // ── HTML ───────────────────────────────────────────
    var html = '<div class="sc-widget">';

    // Header
    html += '<div class="sc-header">';
    html +=   '<div class="sc-titulo">🏆 Score de cultivos <span class="sc-subtitulo">' + grupoLabel + '</span></div>';
    html +=   '<div class="sc-meta">';
    if (zona && CV && CV[zona]) html += '<span class="sc-chip">📍 ' + CV[zona].label + '</span>';
    if (fechaStr)    html += '<span class="sc-chip">📅 ' + fechaStr + '</span>';
    if (pctAgua >= 0) html += '<span class="sc-chip">💧 ' + pctAgua + '% CC</span>';
    if (fase)        html += '<span class="sc-chip">🌡️ ' + fase + '</span>';
    if (!coord)      html += '<span class="sc-chip sc-chip-warn">⚠ Sin coordenadas — score aproximado</span>';
    html +=   '</div>';
    html += '</div>';

    // Selector antecesor
    html += '<div class="sc-antecesor">';
    html +=   '<span class="sc-ant-label">Cultivo antecesor</span>';
    html +=   '<div class="sc-ant-opciones">';
    ANTECESORES.forEach(function (a) {
      var isActivo = antecesor ? (antecesor === a.key) : (a.key === 'no_se');
      html += '<button class="sc-ant-btn' + (isActivo ? ' sc-ant-btn-activo' : '') + '"';
      html +=   ' onclick="window.dlSetAntecesor(\'' + a.key + '\',\'' + esc(lote.id) + '\')">';
      html +=   a.label + '</button>';
    });
    html +=   '</div>';
    html += '</div>';

    // Tabla — columnas: Cultivo | Score | Rend. | Margen | Acción
    // Los sub-scores (fecha/agua/ENSO/zona/rot) van en el panel ℹ
    html += '<div class="sc-tabla">';
    html += '<div class="sc-tabla-head">';
    html +=   '<span>Cultivo</span>';
    html +=   '<span class="sc-col-score">Score</span>';
    html +=   '<span class="sc-col-rend">Rend.</span>';
    html +=   '<span class="sc-col-margen">Margen</span>';
    html +=   '<span></span>';
    html += '</div>';

    scored.forEach(function (c, idx) {
      var s = c.score;
      var esActivo = c.key === cultivoAct;
      var color = s.total >= 85 ? '#6DBF82'
                : s.total >= 65 ? '#C8A255'
                : s.total >= 45 ? '#E8A040'
                : '#D4522A';
      var margenColor = s.eco && s.eco.margen > 200 ? '#6DBF82'
                      : s.eco && s.eco.margen > 0   ? '#C8A255'
                      : '#D4522A';
      var infoId = 'sci-' + c.key + '_' + esc(lote.id);

      html += '<div class="sc-row-wrap">';

      html += '<div class="sc-row' + (esActivo ? ' sc-row-activa' : '') + (idx === 0 ? ' sc-row-top' : '') + '">';

      // Cultivo
      html += '<div class="sc-cultivo">';
      html +=   '<span class="sc-emoji">' + c.emoji + '</span>';
      html +=   '<span class="sc-nombre">' + c.label + '</span>';
      html +=   '<button class="sc-info-btn" onclick="window.dlToggleScoreInfo(\'' + infoId + '\')">ℹ</button>';
      if (esActivo) html += '<span class="sc-activo-badge">activo</span>';
      if (idx === 0 && !esActivo) html += '<span class="sc-top-badge">mejor opción</span>';
      html += '</div>';

      // Score (solo número, color indica nivel)
      html += '<div class="sc-col-score">';
      html +=   '<span class="sc-total" style="color:' + color + '">' + s.total + '</span>';
      html +=   '<div class="sc-score-bar"><div class="sc-score-fill" style="width:' + s.total + '%;background:' + color + '"></div></div>';
      html += '</div>';

      // Rendimiento estimado
      html += '<div class="sc-col-rend">';
      if (s.eco) {
        html += '<span class="sc-eco-val">' + s.eco.rendEstim.toFixed(1) + '</span>';
        html += '<span class="sc-eco-unit">t/ha</span>';
      } else {
        html += '<span class="sc-eco-nd">—</span>';
      }
      html += '</div>';

      // Margen bruto
      html += '<div class="sc-col-margen">';
      if (s.eco) {
        html += '<span class="sc-eco-val" style="color:' + margenColor + '">' + (s.eco.margen > 0 ? '+' : '') + s.eco.margen + '</span>';
        html += '<span class="sc-eco-unit">USD/ha</span>';
      } else {
        html += '<span class="sc-eco-nd">—</span>';
      }
      html += '</div>';

      // Acción
      html += '<div class="sc-col-accion">';
      if (esActivo) {
        html += '<span class="sc-sel-actual">✓</span>';
      } else {
        html += '<button class="sc-btn-sel" onclick="window.dlSeleccionarCultivo(\'' + c.key + '\',\'' + esc(lote.id) + '\')">Usar</button>';
      }
      html += '</div>';

      html += '</div>'; // .sc-row

      // Panel ℹ — breakdown de criterios + detalle económico
      html += '<div class="sc-info-panel" id="' + infoId + '" style="display:none">';
      html +=   '<div class="sc-info-grid">';
      html +=     '<div class="sc-info-kv"><span class="sc-info-k">📅 Fecha (' + s.fecha.pts + '/25)</span><span class="sc-info-v">' + esc(s.fecha.label) + '</span></div>';
      html +=     '<div class="sc-info-kv"><span class="sc-info-k">💧 Agua (' + s.hidro.pts + '/20)</span><span class="sc-info-v">' + esc(s.hidro.label) + '</span></div>';
      html +=     '<div class="sc-info-kv"><span class="sc-info-k">🌡️ ENSO (' + s.enso.pts + '/15)</span><span class="sc-info-v">' + esc(s.enso.label) + '</span></div>';
      html +=     '<div class="sc-info-kv"><span class="sc-info-k">📍 Zona (' + s.zona.pts + '/25)</span><span class="sc-info-v">' + esc(s.zona.label) + '</span></div>';
      html +=     '<div class="sc-info-kv"><span class="sc-info-k">🔄 Rotación (' + s.rot.pts + '/15)</span><span class="sc-info-v">' + esc(s.rot.label) + '</span></div>';
      if (s.eco) {
        html += '<div class="sc-info-kv"><span class="sc-info-k">💰 Precio ref.</span><span class="sc-info-v">USD ' + s.eco.precio + '/t · Ret. ' + s.eco.retencion + '% · Costo base USD ' + s.eco.costoBase + '/ha</span></div>';
        html += '<div class="sc-info-kv"><span class="sc-info-k">📊 Rel. ins/prod.</span><span class="sc-info-v">' + s.eco.relacion + ' qq/' + c.label.substring(0,3) + ' para cubrir insumos</span></div>';
      }
      html +=   '</div>';
      html += '</div>';

      html += '</div>'; // .sc-row-wrap
    });

    html += '</div>'; // .sc-tabla

    html += '<div class="sc-nota">Score agronómico: Fecha (25) · Agua (20) · ENSO (15) · Zona (25) · Rotación (15) = 100 pts. Margen bruto con precios y costos de referencia campaña 2024/25. No reemplaza el análisis profesional.</div>';

    // CTA
    html += '<div class="sc-cta">';
    html +=   '<div class="sc-cta-nav">';
    html +=     '<button class="sc-cta-nav-btn" onclick="window.dlVolverCards()">← Mis Lotes</button>';
    html +=     '<button class="sc-cta-nav-btn" onclick="window.dlAbrirLote(\'' + esc(lote.id) + '\')">← Hub del lote</button>';
    html +=   '</div>';
    html +=   '<button class="sc-btn-cultivares" onclick="window.dlAbrirModulo(\'cultivares\',\'' + esc(lote.id) + '\')">';
    html +=     '<span>🌾 Ver ranking de cultivares (RECSO/INTA)</span><span>→</span>';
    html +=   '</button>';
    html += '</div>';

    html += '</div>'; // .sc-widget
    return html;
  };

  // ── Helpers ───────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Helpers internos ──────────────────────────────────

  function _reabrirSeccion() {
    if (typeof window.dlAbrirSeccion !== 'function') return;
    var sec = (typeof window.dlGetSeccionAbierta === 'function')
      ? window.dlGetSeccionAbierta() : null;
    window.dlAbrirSeccion(sec || 'planfina');
  }

  // ── Acciones globales ──────────────────────────────────

  window.dlToggleScoreInfo = function (id) {
    var panel = document.getElementById(id);
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  };

  window.dlSetAntecesor = function (cultivo, loteId) {
    var lote = (window.AM_LOTES || []).find(function (l) { return l.id === loteId; });
    if (!lote) return;
    lote.data = lote.data || {};
    lote.data.antecesor = cultivo;
    if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
    _reabrirSeccion();
  };

  window.dlSeleccionarCultivo = function (cultivo, loteId) {
    var lote = (window.AM_LOTES || []).find(function (l) { return l.id === loteId; });
    if (!lote) return;
    lote.data = lote.data || {};
    lote.data.cultivo = cultivo;
    if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
    if (typeof amRenderSelectLotes  === 'function') amRenderSelectLotes();
    var sSelect = document.getElementById('s-cultivo');
    if (sSelect) {
      sSelect.value = cultivo;
      sSelect.dispatchEvent(new Event('change'));
    }
    if (typeof amToast === 'function') amToast(cultivo + ' seleccionado ✓', 'ok');
    _reabrirSeccion();
  };

})();
