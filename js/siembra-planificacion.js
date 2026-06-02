// ════════════════════════════════════════════════════════
// AGROMOTOR — siembra-planificacion.js
// Widget de operativa de siembra:
//   · Ventana óptima por cultivo / zona / grupo
//   · Timeline visual de ventanas
//   · Capacidad sembradora × N unidades
//   · Ajuste por días lluvia según ENSO (NASA pampa)
//   · Análisis: % superficie en ventana, recomendación
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Ventanas de siembra completas por zona ────────────
  // Fuente: RECSO / INTA. Formato: 'DD-mmm al DD-mmm'
  var VENTANAS = {
    Trigo: {
      pampeana_norte: { primera:'1-jun al 30-jun',  segunda:'1-jul al 20-jul',  temprana:'15-may al 31-may', tardia:'21-jul al 10-ago' },
      pampeana_sur:   { primera:'1-may al 31-may',  segunda:'1-jun al 30-jun',  temprana:'15-abr al 30-abr', tardia:'1-jul al 20-jul'  },
      semiarida:      { primera:'1-jun al 30-jun',  segunda:'1-jul al 20-jul',  temprana:'15-may al 31-may', tardia:'21-jul al 10-ago' },
      nea:            { primera:'15-jun al 15-jul', segunda:'16-jul al 10-ago', temprana:'1-jun al 14-jun',  tardia:'11-ago al 31-ago' },
      noa:            { primera:'1-jun al 31-jul',  segunda:'1-ago al 31-ago',  temprana:'15-may al 31-may', tardia:'1-sep al 20-sep'  },
    },
    Cebada: {
      pampeana_norte: { primera:'15-jun al 10-jul', segunda:'11-jul al 31-jul', temprana:'1-jun al 14-jun',  tardia:'1-ago al 15-ago'  },
      pampeana_sur:   { primera:'1-jun al 30-jun',  segunda:'1-jul al 31-jul',  temprana:'15-may al 31-may', tardia:'1-ago al 15-ago'  },
      semiarida:      { primera:'15-jun al 10-jul', segunda:'11-jul al 31-jul', temprana:'1-jun al 14-jun',  tardia:'1-ago al 15-ago'  },
      nea:            { primera:'15-jun al 15-jul', segunda:'16-jul al 15-ago', temprana:'1-jun al 14-jun',  tardia:'16-ago al 31-ago' },
      noa:            { primera:'15-jun al 31-jul', segunda:'1-ago al 31-ago',  temprana:'1-jun al 14-jun',  tardia:'1-sep al 30-sep'  },
    },
    Colza: {
      pampeana_norte: { primera:'1-abr al 30-abr',  segunda:'1-may al 15-may',  temprana:'15-mar al 31-mar', tardia:'16-may al 15-jun' },
      pampeana_sur:   { primera:'1-mar al 30-abr',  segunda:'1-may al 15-may',  temprana:'15-feb al 28-feb', tardia:'16-may al 31-may' },
      semiarida:      { primera:'1-abr al 30-abr',  segunda:'1-may al 15-may',  temprana:'15-mar al 31-mar', tardia:'16-may al 15-jun' },
      nea:            null,
      noa:            null,
    },
    Soja: {
      pampeana_norte: { primera:'15-oct al 30-nov', segunda:'1-dic al 15-ene',  temprana:'1-oct al 14-oct',  tardia:'16-ene al 28-feb' },
      pampeana_sur:   { primera:'1-nov al 30-nov',  segunda:'1-dic al 31-dic',  temprana:'15-oct al 31-oct', tardia:'1-ene al 31-ene'  },
      semiarida:      { primera:'1-nov al 30-nov',  segunda:'1-dic al 15-ene',  temprana:'15-oct al 31-oct', tardia:'16-ene al 28-feb' },
      nea:            { primera:'1-oct al 30-nov',  segunda:'1-dic al 15-ene',  temprana:'15-sep al 30-sep', tardia:'16-ene al 28-feb' },
      noa:            { primera:'1-oct al 15-nov',  segunda:'16-nov al 31-dic', temprana:'15-sep al 30-sep', tardia:'1-ene al 31-ene'  },
    },
    'Maíz': {
      pampeana_norte: { primera:'15-sep al 31-oct', segunda:'1-nov al 30-nov',  temprana:'1-sep al 14-sep',  tardia:'1-dic al 31-dic'  },
      pampeana_sur:   { primera:'1-oct al 15-nov',  segunda:'16-nov al 30-nov', temprana:'15-sep al 30-sep', tardia:'1-dic al 15-dic'  },
      semiarida:      { primera:'1-oct al 15-nov',  segunda:'16-nov al 30-nov', temprana:'15-sep al 30-sep', tardia:'1-dic al 15-dic'  },
      nea:            { primera:'15-sep al 31-oct', segunda:'1-nov al 30-nov',  temprana:'1-sep al 14-sep',  tardia:'1-dic al 15-dic'  },
      noa:            { primera:'1-sep al 31-oct',  segunda:'1-nov al 30-nov',  temprana:'15-ago al 31-ago', tardia:'1-dic al 15-dic'  },
    },
    Girasol: {
      pampeana_norte: { primera:'15-sep al 31-oct', segunda:'1-nov al 30-nov',  temprana:'1-sep al 14-sep',  tardia:'1-dic al 15-dic'  },
      pampeana_sur:   { primera:'1-sep al 31-oct',  segunda:'1-nov al 30-nov',  temprana:'15-ago al 31-ago', tardia:'1-dic al 15-dic'  },
      semiarida:      { primera:'15-sep al 31-oct', segunda:'1-nov al 30-nov',  temprana:'1-sep al 14-sep',  tardia:'1-dic al 15-dic'  },
      nea:            { primera:'1-sep al 31-oct',  segunda:'1-nov al 30-nov',  temprana:'15-ago al 31-ago', tardia:'1-dic al 15-dic'  },
      noa:            { primera:'1-sep al 31-oct',  segunda:'1-nov al 30-nov',  temprana:'15-ago al 31-ago', tardia:'1-dic al 15-dic'  },
    },
    Sorgo: {
      pampeana_norte: { primera:'1-nov al 15-dic',  segunda:'16-dic al 15-ene', temprana:'15-oct al 31-oct', tardia:'16-ene al 28-feb' },
      pampeana_sur:   { primera:'1-nov al 30-nov',  segunda:'1-dic al 15-ene',  temprana:'15-oct al 31-oct', tardia:'16-ene al 28-feb' },
      semiarida:      { primera:'15-nov al 15-dic', segunda:'16-dic al 31-ene', temprana:'1-nov al 14-nov',  tardia:'1-feb al 28-feb'  },
      nea:            { primera:'1-oct al 30-nov',  segunda:'1-dic al 31-ene',  temprana:'15-sep al 30-sep', tardia:'1-feb al 28-feb'  },
      noa:            { primera:'1-oct al 15-nov',  segunda:'16-nov al 31-dic', temprana:'15-sep al 30-sep', tardia:'1-ene al 31-ene'  },
    },
  };

  // ── Ajuste días lluvia por ENSO y época ──────────────
  // Pampa argentina: promedio días/mes con lluvia > 5mm
  // Finos (abr-ago), gruesos (sep-feb)
  var LLUVIA_DIAS_MES = {
    invierno: { nino: 5.4, neutro: 3.6, nina: 2.4 },
    verano:   { nino: 9.0, neutro: 6.0, nina: 3.6 },
  };
  var DIAS_PISO_POST_LLUVIA = 2;
  var EVENTOS_POR_DIA_LLUVIA = 0.55;

  // ── Capacidad por defecto de sembradora ───────────────
  var DEFAULT_ANCHO  = 7;   // metros
  var DEFAULT_VEL    = 7;   // km/h
  var DEFAULT_EFIC   = 0.80; // eficiencia operativa
  var HORAS_DIA      = 9.7;
  var CULTIVOS_POR_GRUPO = {
    invierno: ['trigo', 'cebada', 'colza'],
    verano: ['soja', 'maiz', 'girasol', 'sorgo']
  };
  var GRUPO_LABEL = {
    invierno: 'Trigo, Cebada o Colza',
    verano: 'Soja, Maiz, Girasol o Sorgo'
  };

  // ── Utilidades de fecha ───────────────────────────────
  var MESES_IDX = { ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11 };
  var MESES_ABR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var DIAS_MES  = [31,28,31,30,31,30,31,31,30,31,30,31];

  function dayOfYear(mes, dia) {
    var d = 0;
    for (var i = 0; i < mes; i++) d += DIAS_MES[i];
    return d + dia;
  }

  // Para cultivos de verano, enero-feb son "mes 12-13" (cross-year)
  function adjustedDOY(mes, dia, esVerano) {
    var d = dayOfYear(mes, dia);
    if (esVerano && mes <= 1) d += 365; // ene/feb del año siguiente
    return d;
  }

  function parseFecha(str) {
    var p = str.trim().split('-');
    var dia = parseInt(p[0]);
    var mes = MESES_IDX[p[1] && p[1].toLowerCase()];
    return (isNaN(dia) || mes === undefined) ? null : { dia: dia, mes: mes };
  }

  function parseVentana(v) {
    if (!v) return null;
    var p = v.split(' al ');
    var ini = parseFecha(p[0]);
    var fin = parseFecha(p[1]);
    return (ini && fin) ? { ini: ini, fin: fin } : null;
  }

  function isoToDate(iso) {
    if (!iso) return null;
    var p = iso.split('-');
    return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
  }

  function dateToIso(d) {
    if (!d) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function formatFechaES(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return pad(parseInt(p[2])) + '/' + pad(parseInt(p[1])) + '/' + p[0];
  }

  function addDays(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + Math.ceil(n));
    return d;
  }

  function diasEnVentana(startISO, totalDias, ventanaParsed, esVerano) {
    if (!startISO || !ventanaParsed || totalDias <= 0) return 0;
    var sd = isoToDate(startISO);
    var edDOY = adjustedDOY(ventanaParsed.ini.mes, ventanaParsed.ini.dia, esVerano);
    var efDOY = adjustedDOY(ventanaParsed.fin.mes, ventanaParsed.fin.dia, esVerano);
    var overlapDias = 0;
    for (var i = 0; i < Math.ceil(totalDias); i++) {
      var cur = new Date(sd);
      cur.setDate(sd.getDate() + i);
      var curDOY = adjustedDOY(cur.getMonth(), cur.getDate(), esVerano);
      if (curDOY >= edDOY && curDOY <= efDOY) overlapDias++;
    }
    return Math.min(overlapDias, totalDias);
  }

  function estadoVentana(fechaISO, ventanas, esVerano) {
    if (!fechaISO || !ventanas) return { label: 'Sin ventana', clase: 'sp-badge-nd' };
    var d = isoToDate(fechaISO);
    if (!d) return { label: 'Fecha inválida', clase: 'sp-badge-nd' };
    var mes = d.getMonth();
    var dia = d.getDate();
    var tipos = [
      { key: 'primera',  label: 'En ventana óptima ✓',  clase: 'sp-badge-ok'   },
      { key: 'segunda',  label: 'Segunda época ✓',       clase: 'sp-badge-ok'   },
      { key: 'temprana', label: 'Siembra temprana ⚠',   clase: 'sp-badge-warn'  },
      { key: 'tardia',   label: 'Siembra tardía ⚠',     clase: 'sp-badge-warn'  },
    ];
    for (var i = 0; i < tipos.length; i++) {
      var t = tipos[i];
      var v = parseVentana(ventanas[t.key]);
      if (!v) continue;
      var ini = adjustedDOY(v.ini.mes, v.ini.dia, esVerano);
      var fin = adjustedDOY(v.fin.mes, v.fin.dia, esVerano);
      var cur = adjustedDOY(mes, dia, esVerano);
      if (cur >= ini && cur <= fin) return { label: t.label, clase: t.clase };
    }
    return { label: 'Fuera de ventana ✗', clase: 'sp-badge-fuera' };
  }

  // ── Leer sembradora guardada ──────────────────────────
  function leerSembradora() {
    try {
      var uid = (typeof AM_SESION !== 'undefined' && AM_SESION && AM_SESION.id) ? AM_SESION.id : 'local';
      var raw = localStorage.getItem('am_maquinaria_propias_v1_' + uid);
      var arr = raw ? JSON.parse(raw) : [];
      // Buscar la primera máquina que parezca sembradora (por nombre o simplemente la primera)
      var sem = arr.find(function (m) { return m && /sembra|siembra|disco|diente|neumática|neumatica/i.test(m.nombre || ''); });
      if (!sem && arr.length > 0) sem = arr[0];
      if (sem && sem.a > 0) return { ancho: sem.a, nombre: sem.nombre, isDefault: false };
    } catch (_) {}
    return { ancho: DEFAULT_ANCHO, nombre: null, isDefault: true };
  }

  // ── Calcular capacidad y duración ────────────────────
  function calcCapacidad(ancho, vel, efic, nMaq, factorLluvia) {
    var haHora    = (ancho * vel / 10) * efic;
    var haDiaBase = haHora * HORAS_DIA;
    var haDiaReal = haDiaBase * factorLluvia;
    return { haHora: haHora, haDiaBase: haDiaBase, haDia: haDiaReal * nMaq };
  }

  function ensoFaseLluvia(fase) {
    if (/niño|nino/i.test(fase || '')) return 'nino';
    if (/niña|nina/i.test(fase || '')) return 'nina';
    return 'neutro';
  }

  function calcOperatividadClima(esVerano, ensoKey) {
    var grupo = esVerano ? 'verano' : 'invierno';
    var tabla = LLUVIA_DIAS_MES[grupo] || LLUVIA_DIAS_MES.verano;
    var diasLluviaMes = tabla[ensoKey] || tabla.neutro;
    var eventosMes = diasLluviaMes * EVENTOS_POR_DIA_LLUVIA;
    var diasPisoMes = eventosMes * DIAS_PISO_POST_LLUVIA;
    var diasNoOperativosMes = clamp(diasLluviaMes + diasPisoMes, 1, 24);
    var factor = clamp(1 - (diasNoOperativosMes / 30), 0.20, 0.97);
    return {
      factor: factor,
      diasLluviaMes: diasLluviaMes,
      diasPisoMes: diasPisoMes,
      diasNoOperativosMes: diasNoOperativosMes,
      pctNoOperativo: Math.round((1 - factor) * 100)
    };
  }

  // ── Timeline HTML ─────────────────────────────────────
  function renderTimeline(ventanas, fechaISO, diasSiembra, esVerano) {
    if (!ventanas) return '';

    // Calcular rango de display: temprana.ini → tardia.fin (+padding)
    var todos = ['temprana','primera','segunda','tardia'];
    var doys  = [];
    todos.forEach(function (t) {
      var v = parseVentana(ventanas[t]);
      if (v) {
        doys.push(adjustedDOY(v.ini.mes, v.ini.dia, esVerano));
        doys.push(adjustedDOY(v.fin.mes, v.fin.dia, esVerano));
      }
    });
    if (doys.length === 0) return '';

    var dispIni = Math.min.apply(null, doys) - 10;
    var dispFin = Math.max.apply(null, doys) + 10;
    var span    = dispFin - dispIni;
    if (span <= 0) return '';

    function pct(mes, dia) {
      return Math.max(0, Math.min(100, (adjustedDOY(mes, dia, esVerano) - dispIni) / span * 100));
    }

    function band(v, cls) {
      if (!v) return '';
      var l = pct(v.ini.mes, v.ini.dia);
      var r = pct(v.fin.mes, v.fin.dia + 1);
      return '<div class="sp-tl-band ' + cls + '" style="left:' + l.toFixed(1) + '%;width:' + (r - l).toFixed(1) + '%"></div>';
    }

    var html = '<div class="sp-tl-wrap">';
    html += band(parseVentana(ventanas.temprana), 'sp-tl-temprana');
    html += band(parseVentana(ventanas.primera),  'sp-tl-primera');
    html += band(parseVentana(ventanas.segunda),  'sp-tl-segunda');
    html += band(parseVentana(ventanas.tardia),   'sp-tl-tardia');

    // Banda de siembra planeada
    if (fechaISO && diasSiembra > 0) {
      var dIso = isoToDate(fechaISO);
      if (dIso) {
        var inicioMes = dIso.getMonth();
        var inicioDia = dIso.getDate();
        var finDate   = addDays(dIso, diasSiembra);
        var finMes    = finDate.getMonth();
        var finDia    = finDate.getDate();
        var pL  = pct(inicioMes, inicioDia);
        var pR  = pct(finMes, finDia);
        var wid = Math.max(1, pR - pL);
        html += '<div class="sp-tl-sowing" style="left:' + pL.toFixed(1) + '%;width:' + wid.toFixed(1) + '%"></div>';
        html += '<div class="sp-tl-marker" style="left:' + pL.toFixed(1) + '%"></div>';
      }
    }
    html += '</div>'; // .sp-tl-wrap

    // Etiquetas de meses en el rango
    var mesesMostrar = [];
    for (var doy = dispIni; doy <= dispFin; doy++) {
      // Calcular en qué mes estamos
      var d = dispIni;
      var m = esVerano ? 8 : 0; // empezar por sep o ene según época
      // Simplificado: mostrar 5 etiquetas equidistantes
    }
    // Calculamos qué mes corresponde a dispIni para etiquetar
    var etiquetas = [];
    var mesAct = null;
    for (var offset = 0; offset <= span; offset += Math.floor(span / 5)) {
      var doyMes = dispIni + offset;
      // Convertir DOY a mes (aproximado, sin considerar año bisiesto)
      var mesReal = 0;
      var acum = 0;
      for (var mi = 0; mi < 12; mi++) {
        if (acum + DIAS_MES[mi] >= (esVerano && doyMes > 365 ? doyMes - 365 : doyMes)) { mesReal = mi; break; }
        acum += DIAS_MES[mi];
      }
      var pctEt = (offset / span * 100).toFixed(1);
      if (mesReal !== mesAct) {
        etiquetas.push({ pct: pctEt, mes: MESES_ABR[mesReal] });
        mesAct = mesReal;
      }
    }
    html += '<div class="sp-tl-months">';
    etiquetas.forEach(function (e) {
      html += '<span style="position:relative;left:' + (parseFloat(e.pct) > 70 ? '-8px' : '0') + '">' + e.mes + '</span>';
    });
    html += '</div>';

    // Leyenda
    html += '<div class="sp-tl-leyenda">';
    if (ventanas.temprana) html += '<span class="sp-tl-leg-item"><span class="sp-tl-leg-dot sp-leg-temprana"></span>Temprana: ' + ventanas.temprana + '</span>';
    if (ventanas.primera)  html += '<span class="sp-tl-leg-item"><span class="sp-tl-leg-dot sp-leg-primera"></span>1ª época: ' + ventanas.primera + '</span>';
    if (ventanas.segunda)  html += '<span class="sp-tl-leg-item"><span class="sp-tl-leg-dot sp-leg-segunda"></span>2ª época: ' + ventanas.segunda + '</span>';
    if (ventanas.tardia)   html += '<span class="sp-tl-leg-item"><span class="sp-tl-leg-dot sp-leg-tardia"></span>Tardía: ' + ventanas.tardia + '</span>';
    if (fechaISO && diasSiembra > 0) html += '<span class="sp-tl-leg-item"><span class="sp-tl-leg-dot sp-leg-siembra"></span>Tu siembra</span>';
    html += '</div>';

    return '<div class="sp-timeline-sec">' + html + '</div>';
  }

  // ── HTML principal ────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function cultivoEnGrupo(cultivo, grupo) {
    if (!grupo || !cultivo) return true;
    var permitidos = CULTIVOS_POR_GRUPO[grupo] || [];
    var key = String(cultivo || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/Ã¡|á/g, 'a').replace(/Ã©|é/g, 'e')
      .replace(/Ã­|í/g, 'i').replace(/Ã³|ó/g, 'o')
      .replace(/Ãº|ú/g, 'u').replace(/ñ|Ã±/g, 'n');
    return permitidos.indexOf(key) >= 0;
  }

  function renderPendienteCultivo(lote, grupo, cultivoActual) {
    var loteId = esc(lote.id);
    var grupoTxt = GRUPO_LABEL[grupo] || 'un cultivo del score';
    var motivo = cultivoActual
      ? 'El cultivo activo del lote es ' + esc(cultivoActual) + ', que no corresponde a esta secciÃ³n.'
      : 'TodavÃ­a no hay cultivo activo para este lote.';
    var html = '<div class="sp-widget sp-widget-empty">';
    html += '<div class="sp-header">';
    html +=   '<span class="sp-titulo">ðŸ“… Operativa de siembra</span>';
    html +=   '<span class="sp-zona-chip">Pendiente de cultivo</span>';
    html += '</div>';
    html += '<div class="sp-empty-body">';
    html +=   '<div class="sp-empty-title">ElegÃ­ un cultivo del score para activar la operativa</div>';
    html +=   '<div class="sp-empty-text">' + motivo + ' En esta planificaciÃ³n corresponde usar ' + esc(grupoTxt) + '.</div>';
    html +=   '<div class="sp-empty-actions">';
    html +=     '<button class="sp-btn-maquinaria sp-btn-score" onclick="window.spScrollScore()">';
    html +=       '<span>Volver al score y tocar Usar</span><span>â†‘</span>';
    html +=     '</button>';
    html +=     '<button class="sp-btn-maquinaria" onclick="window.dlAbrirLote(\'' + loteId + '\')">';
    html +=       '<span>Volver al hub del lote</span><span>â†’</span>';
    html +=     '</button>';
    html +=   '</div>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function _reabrirSeccion() {
    if (typeof window.dlAbrirSeccion !== 'function') return;
    var sec = (typeof window.dlGetSeccionAbierta === 'function') ? window.dlGetSeccionAbierta() : null;
    window.dlAbrirSeccion(sec || 'planfina');
  }

  window.spRender = function (lote, grupo) {
    var d       = lote.data || {};
    var ck      = d.calcKeys || {};
    var cultivo = d.cultivo  || ck['am_siembra_cultivo'] || '';
    var coord   = d.coord    || '';
    var sup     = parseFloat(d.superficie) || 0;
    var lat     = coord ? coord.split(',')[0] : null;
    var esVerano = grupo === 'verano';
    var loteId  = esc(lote.id);

    if (!cultivo || !cultivoEnGrupo(cultivo, grupo)) {
      return renderPendienteCultivo(lote, grupo, cultivo);
    }

    // Zona agronómica
    var zona = null;
    if (typeof window.CV_ZONAS !== 'undefined' && lat) {
      var latN = parseFloat(lat);
      var orden = ['pampeana_norte','pampeana_sur','semiarida','nea','noa'];
      for (var i = 0; i < orden.length; i++) {
        var k = orden[i];
        if (window.CV_ZONAS[k] && latN >= window.CV_ZONAS[k].latMin && latN <= window.CV_ZONAS[k].latMax) { zona = k; break; }
      }
    }
    if (!zona && lat) {
      var latN2 = parseFloat(lat);
      if (latN2 > -29) zona = 'noa';
      else if (latN2 < -39) zona = 'pampeana_sur';
      else zona = 'pampeana_norte';
    }
    var zonaLabel = zona
      ? ({ pampeana_norte:'Pamp. Norte', pampeana_sur:'Pamp. Sur', semiarida:'Semiárida', nea:'NEA', noa:'NOA' }[zona] || zona)
      : 'zona desconocida';

    var ventanas = zona && VENTANAS[cultivo] ? VENTANAS[cultivo][zona] : null;

    // Sembradora
    var sem   = leerSembradora();
    var cfg   = d.sembConfig || {};
    var ancho = cfg.ancho || sem.ancho;
    var vel   = cfg.vel   || DEFAULT_VEL;
    var efic  = cfg.efic  || DEFAULT_EFIC;
    var nMaq  = cfg.n     || 1;

    // ENSO
    var faseCode  = ck['am_enso_fase'] || d['hub-enso-fase'] || '';
    var ensoKey   = ensoFaseLluvia(faseCode);
    var faseLabel = ensoKey === 'nino' ? 'El Niño' : ensoKey === 'nina' ? 'La Niña' : 'Neutro';
    var lluviaOp  = calcOperatividadClima(esVerano, ensoKey);
    var factLluvia = lluviaOp.factor;

    // Fecha planeada
    var fechaISO = d.fechaSiembraPlan || '';
    var fechaConf = d.fechaSiembraConf || '';
    var estaConf  = !!(fechaConf);

    // Calcular duración de siembra para cada N
    var analisis = [1, 2, 3].map(function (n) {
      var cap  = calcCapacidad(ancho, vel, efic, n, factLluvia);
      var dias = sup > 0 ? (sup / cap.haDia) : 0;
      var finD = fechaISO ? addDays(isoToDate(fechaISO), dias) : null;
      var finISO = finD ? dateToIso(finD) : '';

      // % en ventana (usando ventana primera + segunda)
      var enVent = 0;
      if (fechaISO && dias > 0 && ventanas) {
        var dPrimera = diasEnVentana(fechaISO, dias, parseVentana(ventanas.primera), esVerano);
        var dSegunda = diasEnVentana(fechaISO, dias, parseVentana(ventanas.segunda), esVerano);
        enVent = Math.min(100, Math.round((dPrimera + dSegunda) / dias * 100));
      } else if (!ventanas) {
        enVent = -1; // sin datos
      }

      return { n: n, cap: cap, dias: dias, finISO: finISO, pctVentana: enVent };
    });

    // Estado de ventana de la fecha elegida
    var estVentana = fechaISO && ventanas
      ? estadoVentana(fechaISO, ventanas, esVerano)
      : { label: 'Ingresá una fecha', clase: 'sp-badge-nd' };

    // Cultivo emoji
    var emojiMap = { Trigo:'🌾', Cebada:'🌾', Colza:'🟡', Soja:'🌱', 'Maíz':'🌽', Girasol:'🌻', Sorgo:'🌾' };
    var emoji = emojiMap[cultivo] || '🌾';

    // ── Armar HTML ────────────────────────────────────────
    var html = '<div class="sp-widget">';

    // Header
    html += '<div class="sp-header">';
    html +=   '<span class="sp-titulo">📅 Operativa de siembra</span>';
    html +=   '<span class="sp-cultivo-badge">' + emoji + ' ' + esc(cultivo) + '</span>';
    if (zona) html += '<span class="sp-zona-chip">📍 ' + zonaLabel + '</span>';
    html += '</div>';

    // Fecha planeada
    html += '<div class="sp-fecha-sec">';
    html +=   '<div class="sp-sec-label">Fecha planeada de siembra</div>';
    html +=   '<div class="sp-fecha-row">';
    html +=     '<input type="date" class="sp-fecha-input" value="' + esc(fechaISO) + '"';
    html +=       ' onchange="window.spSetFechaPlan(this.value,\'' + loteId + '\')">';
    html +=     '<button class="sp-confirmar-btn' + (estaConf ? ' sp-conf-activo' : '') + '"';
    html +=       ' onclick="window.spConfirmarFecha(\'' + loteId + '\')"';
    html +=       ' title="' + (estaConf ? 'Ya confirmada — clic para desmarcar' : 'Confirmar como fecha real de siembra') + '">';
    html +=       estaConf ? '✓ Confirmada' : '○ Confirmar';
    html +=     '</button>';
    html +=     '<span class="sp-ventana-badge ' + estVentana.clase + '">' + esc(estVentana.label) + '</span>';
    html +=   '</div>';
    if (estaConf) html += '<div class="sp-conf-real">Sembrado el ' + formatFechaES(fechaConf) + '</div>';
    html += '</div>';

    // Timeline
    if (ventanas) {
      var diasSiembra1 = analisis[nMaq - 1] ? analisis[nMaq - 1].dias : 0;
      html += renderTimeline(ventanas, fechaISO, diasSiembra1, esVerano);
    }

    // Capacidad operativa
    html += '<div class="sp-cap-sec">';
    html +=   '<div class="sp-cap-toprow">';
    html +=     '<span class="sp-sec-label">Capacidad operativa</span>';
    if (sup > 0) html += '<span class="sp-sup-chip">📐 ' + sup + ' ha</span>';
    html +=   '</div>';

    var capBase = calcCapacidad(ancho, vel, efic, 1, 1);
    html += '<div class="sp-maq-info">';
    html +=   '🚜 ' + ancho + ' m · ' + vel + ' km/h · ' + capBase.haDia.toFixed(0) + ' ha/día base';
    if (sem.isDefault && !cfg.ancho) {
      html += '<span class="sp-default-hint">valores por defecto</span>';
    } else if (sem.nombre) {
      html += ' <span class="sp-default-hint">(' + esc(sem.nombre) + ')</span>';
    }
    html += '</div>';
    html += '<button class="sp-maq-link" onclick="window.dlAbrirModulo(\'maquinaria\',\'' + loteId + '\')">⚙ Configurar sembradora en Maquinaria →</button>';

    // Selector N sembradoras
    html += '<div class="sp-nsemb-row" style="margin-top:.45rem">';
    html +=   '<span class="sp-nsemb-label">Sembradoras:</span>';
    html +=   '<div class="sp-nsemb-btns">';
    [1, 2, 3].forEach(function (n) {
      html += '<button class="sp-nsemb-btn' + (n === nMaq ? ' sp-nsemb-activo' : '') + '"';
      html +=   ' onclick="window.spSetNSembradoras(' + n + ',\'' + loteId + '\')">&times;' + n + '</button>';
    });
    html +=   '</div>';
    if (faseCode) {
      html += '<span class="sp-enso-adj">ENSO ' + faseLabel + ': ';
      html += lluviaOp.diasLluviaMes.toFixed(1) + ' d lluvia + ';
      html += lluviaOp.diasPisoMes.toFixed(1) + ' d piso/mes';
      html += '</span>';
    }
    html += '</div>';

    // Tabla análisis
    if (sup > 0) {
      html += '<div class="sp-anl-tabla">';
      analisis.forEach(function (a) {
        var esActivo = a.n === nMaq;
        var badgeCls = a.pctVentana >= 95 ? 'sp-anl-verde'
                     : a.pctVentana >= 70 ? 'sp-anl-amarillo'
                     : a.pctVentana >= 0  ? 'sp-anl-rojo'
                     : '';
        var badgeTxt = a.pctVentana >= 0 ? a.pctVentana + '% en ventana' : 'sin datos';
        html += '<div class="sp-anl-row' + (esActivo ? ' sp-anl-activo' : '') + '">';
        html +=   '<span class="sp-anl-n">&times;' + a.n + '</span>';
        html +=   '<span class="sp-anl-dias">' + (a.dias > 0 ? a.dias.toFixed(1) + ' días' : '—') + '</span>';
        html +=   '<span class="sp-anl-fin">' + (a.finISO ? 'fin ' + formatFechaES(a.finISO) : '') + '</span>';
        html +=   '<span class="sp-anl-badge ' + badgeCls + '">' + badgeTxt + '</span>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="font-size:.7rem;color:rgba(237,224,196,.25);margin-top:.3rem">Cargá la superficie del lote para ver el análisis completo.</div>';
    }
    html += '</div>'; // .sp-cap-sec

    // Recomendación
    var activo = analisis[nMaq - 1];
    if (sup > 0 && activo) {
      var pct1 = activo.pctVentana;
      var pct2 = analisis[Math.min(1, analisis.length - 1)].pctVentana; // con ×2
      html += '<div class="sp-rec-sec">';

      if (pct1 >= 95) {
        html += '<span class="sp-rec-texto sp-rec-verde">✓ Podés sembrar toda la superficie en ventana óptima.</span>';
        if (nMaq > 1) html += '<span class="sp-rec-sub">Con ' + nMaq + ' sembradoras terminás en ' + activo.dias.toFixed(1) + ' días.</span>';
      } else if (pct1 >= 70) {
        var hFuera = Math.round(sup * (1 - pct1 / 100));
        html += '<span class="sp-rec-texto sp-rec-amarillo">⚠ ~' + hFuera + ' ha quedarían fuera de ventana óptima.</span>';
        if (nMaq < 3 && analisis[nMaq] && analisis[nMaq].pctVentana > pct1 + 10) {
          html += '<span class="sp-rec-sub">Con ×' + (nMaq + 1) + ' sembradoras mejorás a ' + analisis[nMaq].pctVentana + '% en ventana.</span>';
        }
      } else if (pct1 >= 0) {
        var hFuera2 = Math.round(sup * (1 - pct1 / 100));
        html += '<span class="sp-rec-texto sp-rec-rojo">✗ ' + hFuera2 + ' ha fuera de ventana — evaluá más maquinaria o ajustar la fecha.</span>';
        if (analisis[2].pctVentana > pct1 + 15) {
          html += '<span class="sp-rec-sub">Con ×3 sembradoras: ' + analisis[2].pctVentana + '% en ventana.</span>';
        }
      } else {
        html += '<span class="sp-rec-texto" style="color:rgba(237,224,196,.4)">Ingresá la fecha de siembra para ver el análisis.</span>';
      }

      if (pct1 < 95) {
        html += '<button class="sp-btn-maquinaria" onclick="window.dlAbrirModulo(\'maquinaria\',\'' + loteId + '\')">';
        html +=   '<span>🚜 Ajustar sembradora en Maquinaria</span><span>→</span>';
        html += '</button>';
      }

      html += '</div>';
    }

    html += '</div>'; // .sp-widget
    return html;
  };

  // ── Acciones globales ─────────────────────────────────

  window.spSetFechaPlan = function (fechaISO, loteId) {
    var lote = (window.AM_LOTES || []).find(function (l) { return l.id === loteId; });
    if (!lote) return;
    lote.data = lote.data || {};
    lote.data.fechaSiembraPlan = fechaISO;
    lote.data.fechaSiembraConf = ''; // reset confirmación si cambia la fecha
    if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
    _reabrirSeccion();
  };

  window.spConfirmarFecha = function (loteId) {
    var lote = (window.AM_LOTES || []).find(function (l) { return l.id === loteId; });
    if (!lote) return;
    lote.data = lote.data || {};
    if (lote.data.fechaSiembraConf) {
      lote.data.fechaSiembraConf = ''; // desmarcar
    } else {
      lote.data.fechaSiembraConf = lote.data.fechaSiembraPlan || '';
    }
    if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
    _reabrirSeccion();
  };

  window.spSetNSembradoras = function (n, loteId) {
    var lote = (window.AM_LOTES || []).find(function (l) { return l.id === loteId; });
    if (!lote) return;
    lote.data = lote.data || {};
    lote.data.sembConfig = lote.data.sembConfig || {};
    lote.data.sembConfig.n = n;
    if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado();
    _reabrirSeccion();
  };

  window.spScrollScore = function () {
    var el = document.querySelector('.sc-widget');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

})();
