// ════════════════════════════════════════════════════════
// AGROMOTOR — pdf-modulo.js
// Generadores específicos de PDF por módulo agronómico.
// Membrete profesional + análisis del módulo + firma + disclaimer.
// Usado por botones "📄 PDF" en cada panel de resultado.
// ════════════════════════════════════════════════════════

(function() {
  'use strict';

  // Paleta común
  const COL = {
    VERDE:  [30, 77, 43],
    VERDE2: [58, 122, 74],
    DORADO: [200, 162, 85],
    TIERRA: [61, 34, 16],
    GRIS:   [120, 120, 120],
    CLARO:  [245, 241, 234],
    NEGRO:  [28, 18, 8],
    AZUL:   [42, 90, 140],
    AMBAR:  [232, 184, 75],
    OK:     [42, 122, 74],
    WARN:   [184, 122, 32],
    DANGER: [201, 74, 42],
  };

  // ── BASE: crea un PDF con membrete profesional ──────
  function crearPDFBase(tituloModulo, subtitulo) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const PW = 210, PH = 297;
    const ML = 15, MR = 15, MT = 15;
    const W = PW - ML - MR;
    let y = MT;

    // Header verde
    doc.setFillColor(...COL.VERDE);
    doc.rect(0, 0, PW, 38, 'F');
    doc.setFillColor(...COL.DORADO);
    doc.rect(0, 38, PW, 1.5, 'F');

    // Logo
    doc.setFillColor(...COL.VERDE2);
    doc.roundedRect(ML, 8, 22, 22, 3, 3, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(16);
    doc.text('🌱', ML+4, 23);

    // Título
    doc.setTextColor(255,255,255);
    doc.setFontSize(18);
    doc.setFont('helvetica','bold');
    doc.text('AgroMotor', ML+26, 17);
    doc.setFontSize(8);
    doc.setFont('helvetica','normal');
    doc.setTextColor(200, 230, 200);
    doc.text(tituloModulo.toUpperCase(), ML+26, 23);
    if (subtitulo) {
      doc.setFontSize(7);
      doc.text(subtitulo, ML+26, 28);
    }

    // Membrete del Ing.
    const sess = window.AM_SESION;
    if (sess) {
      doc.setTextColor(...COL.DORADO);
      doc.setFontSize(9);
      doc.setFont('helvetica','bold');
      const prefijo = sess.rol === 'agronomo' ? 'Ing. Agr. ' : '';
      doc.text(`${prefijo}${sess.nombre}`, PW-ML, 14, { align:'right' });
      doc.setFontSize(7);
      doc.setFont('helvetica','normal');
      doc.setTextColor(220, 230, 200);
      const matLine = sess.matricula
        ? `Matrícula ${sess.matricula} · ${sess.cpia || ''}${sess.matriculaVerificada ? ' ✓' : ''}`
        : (sess.rol === 'estudiante' ? 'Estudiante de Agronomía' : '');
      if (matLine) doc.text(matLine, PW-ML, 19, { align:'right' });
      doc.text(sess.email || '', PW-ML, 24, { align:'right' });
    }

    // Fecha
    const ahora = new Date();
    const fechaStr = ahora.toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
    const horaStr  = ahora.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    doc.setTextColor(180, 200, 180);
    doc.setFontSize(7);
    doc.text(`${fechaStr} · ${horaStr}`, PW-ML, 30, { align:'right' });

    y = 48;

    return { doc, y, PW, PH, ML, MR, MT, W, COL };
  }

  // ── DATOS DEL LOTE (sección común al inicio de cada PDF) ──
  function seccionDatosLote(ctx, datos) {
    const { doc, ML, W, COL } = ctx;
    let y = ctx.y;
    doc.setFillColor(...COL.VERDE);
    doc.rect(ML, y, W, 8, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(9.5);
    doc.setFont('helvetica','bold');
    doc.text('📍 IDENTIFICACIÓN DEL LOTE', ML+3, y+5.5);
    y += 10;

    doc.setFontSize(8.5);
    doc.setFont('helvetica','normal');
    doc.setTextColor(...COL.NEGRO);
    let alt = false;
    Object.entries(datos).forEach(([label, val]) => {
      if (val && val !== '—') {
        doc.setFillColor(...(alt ? [255,255,255] : COL.CLARO));
        doc.rect(ML, y, W, 6, 'F');
        doc.setTextColor(...COL.GRIS);
        doc.text(label, ML+3, y+4);
        doc.setTextColor(...COL.NEGRO);
        doc.setFont('helvetica','bold');
        doc.text(String(val), ML+W-3, y+4, { align:'right' });
        doc.setFont('helvetica','normal');
        y += 6;
        alt = !alt;
      }
    });
    ctx.y = y + 4;
  }

  // ── SECCIÓN HEADER ────────────────────────────────────
  function seccion(ctx, titulo, color = ctx.COL.VERDE) {
    const { doc, ML, W } = ctx;
    let y = ctx.y;
    doc.setFillColor(...color);
    doc.rect(ML, y, W, 8, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(9.5);
    doc.setFont('helvetica','bold');
    doc.text(titulo, ML+3, y+5.5);
    ctx.y = y + 11;
  }

  function checkPage(ctx, needed = 20) {
    if (ctx.y + needed > ctx.PH - 25) {
      ctx.doc.addPage();
      ctx.y = ctx.MT + 8;
    }
  }

  // ── FIRMA + DISCLAIMER + FOOTER (al final) ─────────────
  function cerrarPDF(ctx) {
    const { doc, ML, W, PW, PH, COL } = ctx;
    const sess = window.AM_SESION;

    // Firma del Ing.
    if (sess && sess.rol === 'agronomo' && sess.matricula) {
      checkPage(ctx, 45);
      const ySig = Math.max(ctx.y + 10, PH - 50);
      doc.setDrawColor(...COL.DORADO);
      doc.setLineWidth(0.4);
      doc.line(ML+W*0.55, ySig, ML+W, ySig);
      doc.setTextColor(...COL.TIERRA);
      doc.setFontSize(9);
      doc.setFont('helvetica','bold');
      doc.text(`Ing. Agr. ${sess.nombre}`, ML+W*0.775, ySig+5, { align:'center' });
      doc.setFontSize(7.5);
      doc.setFont('helvetica','normal');
      doc.setTextColor(...COL.GRIS);
      const matSign = `Matrícula ${sess.matricula} · ${sess.cpia || ''}${sess.matriculaVerificada ? ' (verificada)' : ''}`;
      doc.text(matSign, ML+W*0.775, ySig+10, { align:'center' });

      // Disclaimer
      doc.setFontSize(6.8);
      doc.setFont('helvetica','italic');
      doc.setTextColor(...COL.GRIS);
      const disclaimer = 'Este análisis ha sido generado por AgroMotor con datos satelitales y meteorológicos en tiempo real (Open-Meteo, NASA POWER, SoilGrids ISRIC, ENSO/NOAA). Las recomendaciones son orientativas y deben validarse con el criterio profesional del firmante. Documento sin valor de receta agronómica oficial salvo firma manuscrita.';
      const dispLines = doc.splitTextToSize(disclaimer, W*0.5);
      doc.text(dispLines, ML, ySig+5);
    }

    // Footer común
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(...COL.VERDE);
      doc.rect(0, PH-14, PW, 14, 'F');
      doc.setFillColor(...COL.DORADO);
      doc.rect(0, PH-14, PW, 1, 'F');
      doc.setTextColor(200, 220, 200);
      doc.setFontSize(7);
      doc.setFont('helvetica','normal');
      doc.text('AgroMotor · Motor Agronómico de Decisión · Lógica agronómica INTA Argentina', ML, PH-7);
      doc.text(`Página ${p} de ${totalPages}`, PW-ML, PH-7, { align:'right' });
      doc.setTextColor(...COL.DORADO);
      doc.text('agromotor.com.ar', PW/2, PH-7, { align:'center' });
    }
  }

  // ── HELPERS DE LECTURA DOM ────────────────────────────
  function gv(id) { var e = document.getElementById(id); return e ? (e.value || '').trim() : ''; }
  function gtv(id) { var e = document.getElementById(id); return e ? (e.textContent || '').trim() : ''; }

  function datosLoteComunes() {
    return {
      'Coordenadas GPS':  gv('s-coord') || '—',
      'Cultivo':          gv('s-cultivo') || '—',
      'Fecha de siembra': gv('s-fecha') || '—',
      'Tipo de suelo':    gv('s-suelo') || '—',
      'Ubicación':        gtv('i-ubi') || '—',
    };
  }

  function nombreArchivo(modulo) {
    var cult = gv('s-cultivo') || 'lote';
    var fecha = new Date().toISOString().split('T')[0];
    return `AgroMotor_${modulo}_${cult.replace(/\s/g,'_')}_${fecha}.pdf`;
  }

  // ════════════════════════════════════════════════════
  // GENERADORES POR MÓDULO
  // ════════════════════════════════════════════════════

  // ── DECISIÓN ─────────────────────────────────────────
  window.pdfDecision = function() {
    try {
      var cont = document.getElementById('dec-resultado');
      if (!cont || cont.classList.contains('hidden')) {
        amToast('Primero ejecutá el análisis (botón "Analizar y comparar cultivos").', 'err');
        return;
      }
      var ctx = crearPDFBase('Análisis de Decisión de Cultivo', '¿Qué sembrar? · Comparación agronómica + económica');
      var doc = ctx.doc;

      seccionDatosLote(ctx, datosLoteComunes());

      // Veredicto
      seccion(ctx, '⚖️ VEREDICTO PRINCIPAL', ctx.COL.VERDE);
      var veredicto = cont.querySelector('div[style*="font-size:1.5rem"], div[style*="font-size: 1.5rem"]')?.textContent?.trim();
      if (!veredicto) {
        var d1 = cont.querySelector('div[style*="font-size:1.3rem"]')?.textContent?.trim();
        var d2 = cont.querySelectorAll('div[style*="font-size:1.3rem"]')[1]?.textContent?.trim();
        veredicto = `Recomendación agronómica: ${d1 || '—'}  ·  Más rentable: ${d2 || '—'}`;
      }
      doc.setFontSize(11);
      doc.setFont('helvetica','bold');
      doc.setTextColor(...ctx.COL.VERDE);
      var lines = doc.splitTextToSize(veredicto, ctx.W-6);
      doc.text(lines, ctx.ML+3, ctx.y);
      ctx.y += lines.length * 6 + 4;

      // Tabla comparativa de cultivos
      seccion(ctx, '📊 COMPARACIÓN COMPLETA DE CULTIVOS', ctx.COL.VERDE2);
      var rows = cont.querySelectorAll('tbody tr');
      doc.setFontSize(8);
      doc.setFont('helvetica','bold');
      doc.setTextColor(...ctx.COL.NEGRO);
      // Header
      doc.setFillColor(...ctx.COL.CLARO);
      doc.rect(ctx.ML, ctx.y, ctx.W, 7, 'F');
      doc.text('Cultivo', ctx.ML+3, ctx.y+5);
      doc.text('Score', ctx.ML+60, ctx.y+5, {align:'center'});
      doc.text('Rend t/ha', ctx.ML+85, ctx.y+5, {align:'center'});
      doc.text('Margen USD/ha', ctx.ML+115, ctx.y+5, {align:'center'});
      doc.text('Ins/Prod', ctx.ML+150, ctx.y+5, {align:'center'});
      ctx.y += 8;
      doc.setFont('helvetica','normal');
      var alt = false;
      rows.forEach(function(tr) {
        checkPage(ctx, 9);
        var cells = tr.querySelectorAll('td');
        if (cells.length < 5) return;
        if (alt) { doc.setFillColor(252,250,245); doc.rect(ctx.ML, ctx.y, ctx.W, 7, 'F'); }
        var nombreCult = cells[0]?.textContent.replace(/\s+/g,' ').slice(0, 35);
        var score = cells[1]?.textContent.replace(/\s+/g,' ').match(/\d+/)?.[0] || '—';
        var rend = cells[2]?.textContent.replace(/\s+/g,' ').match(/[\d.]+/)?.[0] || '—';
        var margen = cells[3]?.textContent.replace(/\s+/g,' ').match(/-?\d+/)?.[0] || '—';
        var ratio = cells[4]?.textContent.replace(/\s+/g,' ').match(/[\d.]+/)?.[0] || '—';
        doc.setFontSize(8);
        doc.text(nombreCult, ctx.ML+3, ctx.y+5);
        doc.text(score, ctx.ML+60, ctx.y+5, {align:'center'});
        doc.text(rend, ctx.ML+85, ctx.y+5, {align:'center'});
        doc.text('USD ' + margen, ctx.ML+115, ctx.y+5, {align:'center'});
        doc.text(ratio, ctx.ML+150, ctx.y+5, {align:'center'});
        ctx.y += 7;
        alt = !alt;
      });
      ctx.y += 4;

      // Notas metodológicas
      var nota = cont.querySelector('div[style*="margin-top:.8rem"]')?.textContent?.trim();
      if (nota) {
        seccion(ctx, '📋 METODOLOGÍA', ctx.COL.AZUL);
        doc.setFontSize(7.5);
        doc.setFont('helvetica','italic');
        doc.setTextColor(...ctx.COL.GRIS);
        var notaLines = doc.splitTextToSize(nota, ctx.W-6);
        doc.text(notaLines, ctx.ML+3, ctx.y);
        ctx.y += notaLines.length * 4;
      }

      cerrarPDF(ctx);
      doc.save(nombreArchivo('Decision'));
      amToast('✅ Análisis de Decisión exportado a PDF', 'ok');
    } catch(e) {
      console.error('pdfDecision error:', e);
      amToast('Error generando PDF: ' + e.message, 'err');
    }
  };

  // ── FERTILIZACIÓN ────────────────────────────────────
  window.pdfFertilizacion = function() {
    try {
      var ctx = crearPDFBase('Plan de Fertilización NPK', 'Cálculo de dosis · Costos en USD por hectárea');
      var doc = ctx.doc;
      seccionDatosLote(ctx, datosLoteComunes());

      seccion(ctx, '⚗️ PARÁMETROS DEL CÁLCULO', ctx.COL.VERDE);
      var datos = {
        'Cultivo':                gv('f-cult') || '—',
        'Superficie (ha)':        gv('f-sup') || '—',
        'Rendimiento objetivo':   (gv('f-rend') || '—') + ' t/ha',
        'N suelo (kg/ha)':        gv('f-n') || '—',
        'P suelo (ppm)':          gv('f-p') || '—',
        'K suelo (ppm)':          gv('f-k') || '—',
      };
      doc.setFontSize(8.5);
      var alt = false;
      Object.entries(datos).forEach(function(kv) {
        var label = kv[0], val = kv[1];
        if (alt) { doc.setFillColor(...ctx.COL.CLARO); doc.rect(ctx.ML, ctx.y, ctx.W, 6, 'F'); }
        doc.setFont('helvetica','normal');
        doc.setTextColor(...ctx.COL.GRIS);
        doc.text(label, ctx.ML+3, ctx.y+4);
        doc.setFont('helvetica','bold');
        doc.setTextColor(...ctx.COL.NEGRO);
        doc.text(val, ctx.ML+ctx.W-3, ctx.y+4, {align:'right'});
        ctx.y += 6; alt = !alt;
      });
      ctx.y += 4;

      // Plan de fertilización (resultado del cálculo)
      var resCard = document.getElementById('f-res');
      if (resCard && !resCard.classList.contains('hidden')) {
        seccion(ctx, '📋 PLAN RECOMENDADO', ctx.COL.VERDE2);
        doc.setFontSize(8.5);
        doc.setFont('helvetica','normal');
        doc.setTextColor(...ctx.COL.NEGRO);
        var planText = resCard.textContent.replace(/\s+/g, ' ').trim().slice(0, 1500);
        var planLines = doc.splitTextToSize(planText, ctx.W-6);
        planLines.forEach(function(l) { checkPage(ctx, 6); doc.text(l, ctx.ML+3, ctx.y); ctx.y += 4.5; });
      } else {
        doc.setFontSize(8.5);
        doc.setTextColor(...ctx.COL.GRIS);
        doc.setFont('helvetica','italic');
        doc.text('Ejecutá el cálculo para incluir el plan de fertilización en el PDF.', ctx.ML+3, ctx.y);
        ctx.y += 8;
      }

      cerrarPDF(ctx);
      doc.save(nombreArchivo('Fertilizacion'));
      amToast('✅ Plan de Fertilización exportado a PDF', 'ok');
    } catch(e) {
      console.error('pdfFertilizacion error:', e);
      amToast('Error generando PDF: ' + e.message, 'err');
    }
  };

  // ── BALANCE NUTRICIONAL ──────────────────────────────
  window.pdfBalanceNutricional = function() {
    try {
      var cont = document.getElementById('bn-resultado');
      if (!cont || cont.classList.contains('hidden')) {
        amToast('Primero ejecutá el análisis de Balance Nutricional.', 'err');
        return;
      }
      var ctx = crearPDFBase('Balance Nutricional Post-cosecha', 'Extracción real · Recomendación próxima campaña');
      var doc = ctx.doc;
      seccionDatosLote(ctx, datosLoteComunes());

      seccion(ctx, '🔄 BALANCE NUTRICIONAL DEL CICLO', ctx.COL.VERDE);
      var rows = cont.querySelectorAll('table tbody tr');
      if (rows.length) {
        doc.setFontSize(8);
        doc.setFont('helvetica','bold');
        doc.setTextColor(...ctx.COL.NEGRO);
        doc.setFillColor(...ctx.COL.CLARO);
        doc.rect(ctx.ML, ctx.y, ctx.W, 7, 'F');
        doc.text('Nutriente', ctx.ML+3, ctx.y+5);
        doc.text('Extracción', ctx.ML+50, ctx.y+5);
        doc.text('Aporte', ctx.ML+95, ctx.y+5);
        doc.text('Balance neto', ctx.ML+135, ctx.y+5);
        ctx.y += 8;
        doc.setFont('helvetica','normal');
        rows.forEach(function(tr) {
          checkPage(ctx, 8);
          var c = tr.querySelectorAll('td');
          if (c.length < 5) return;
          doc.setFontSize(8);
          doc.text(c[0]?.textContent.trim().slice(0,30), ctx.ML+3, ctx.y+4);
          doc.text(c[1]?.textContent.trim(), ctx.ML+50, ctx.y+4);
          doc.text(c[3]?.textContent.trim(), ctx.ML+95, ctx.y+4);
          var bal = c[5]?.textContent.trim() || '—';
          var balNum = parseFloat(bal.match(/-?\d+/)?.[0] || '0');
          doc.setTextColor(...(balNum >= 0 ? ctx.COL.OK : ctx.COL.WARN));
          doc.setFont('helvetica','bold');
          doc.text(bal, ctx.ML+135, ctx.y+4);
          doc.setFont('helvetica','normal');
          doc.setTextColor(...ctx.COL.NEGRO);
          ctx.y += 6;
        });
        ctx.y += 4;
      }

      // Recomendaciones (alerts)
      var alerts = cont.querySelectorAll('.alert');
      if (alerts.length) {
        seccion(ctx, '💊 RECOMENDACIONES PRÓXIMA CAMPAÑA', ctx.COL.AMBAR);
        alerts.forEach(function(a) {
          checkPage(ctx, 12);
          var txt = a.textContent.replace(/\s+/g,' ').trim();
          var bgColor = a.classList.contains('danger') ? ctx.COL.DANGER : a.classList.contains('warn') ? ctx.COL.WARN : ctx.COL.OK;
          doc.setDrawColor(...bgColor);
          doc.setLineWidth(0.5);
          doc.line(ctx.ML, ctx.y-1, ctx.ML, ctx.y+9);
          doc.setFontSize(8);
          doc.setTextColor(...ctx.COL.NEGRO);
          doc.setFont('helvetica','normal');
          var lines = doc.splitTextToSize(txt, ctx.W-8);
          lines.slice(0, 4).forEach(function(l) { doc.text(l, ctx.ML+4, ctx.y+4); ctx.y += 4.5; });
          ctx.y += 3;
        });
      }

      cerrarPDF(ctx);
      doc.save(nombreArchivo('BalanceNutricional'));
      amToast('✅ Balance Nutricional exportado a PDF', 'ok');
    } catch(e) {
      console.error('pdfBalanceNutricional error:', e);
      amToast('Error generando PDF: ' + e.message, 'err');
    }
  };

  // ── SUELO ────────────────────────────────────────────
  window.pdfSuelo = function() {
    try {
      if (!window._sgDatos) {
        amToast('Primero analizá el suelo con SoilGrids.', 'err');
        return;
      }
      var ctx = crearPDFBase('Análisis de Suelo · SoilGrids ISRIC', 'pH · MO · NPK · CEC · Densidad aparente · Textura');
      var doc = ctx.doc;
      seccionDatosLote(ctx, datosLoteComunes());

      var d = window._sgDatos;
      seccion(ctx, '🌍 PROPIEDADES DEL PERFIL (0-5 cm)', ctx.COL.VERDE);
      var mo = d.soc != null ? (d.soc * 1.724 / 10).toFixed(1) : null;
      var props = [
        ['pH (H₂O)',          d.ph != null ? d.ph.toFixed(1) : '—',           'óptimo 6.0-7.5'],
        ['C orgánico',        d.soc != null ? d.soc.toFixed(1) + ' g/kg' : '—', 'base de fertilidad biológica'],
        ['Materia orgánica',  mo ? mo + ' %' : '—',                            'reservas y agregación'],
        ['Nitrógeno total',   d.n != null ? d.n.toFixed(2) + ' g/kg' : '—',    'mineralización potencial'],
        ['Densidad aparente', d.da != null ? d.da.toFixed(2) + ' g/cm³' : '—', 'compactación · normal 1.0-1.4'],
        ['CEC',               d.cec != null ? d.cec.toFixed(1) + ' cmol/kg' : '—', 'capacidad intercambio catiónico'],
        ['Arcilla',           d.clay != null ? d.clay + ' %' : '—',            'fracción fina'],
        ['Arena',              d.sand != null ? d.sand + ' %' : '—',            'fracción gruesa · drenaje'],
        ['Limo',              d.silt != null ? d.silt + ' %' : '—',            'fracción media'],
        ['Tipo de suelo',     d.textura || '—',                                 'clasificación textural'],
      ];
      doc.setFontSize(8);
      doc.setFillColor(...ctx.COL.CLARO);
      doc.rect(ctx.ML, ctx.y, ctx.W, 7, 'F');
      doc.setFont('helvetica','bold');
      doc.setTextColor(...ctx.COL.NEGRO);
      doc.text('Propiedad', ctx.ML+3, ctx.y+5);
      doc.text('Valor', ctx.ML+70, ctx.y+5, {align:'center'});
      doc.text('Interpretación', ctx.ML+90, ctx.y+5);
      ctx.y += 8;
      var alt = false;
      props.forEach(function(p) {
        checkPage(ctx, 7);
        if (alt) { doc.setFillColor(252,250,245); doc.rect(ctx.ML, ctx.y, ctx.W, 6, 'F'); }
        doc.setFont('helvetica','bold');
        doc.text(p[0], ctx.ML+3, ctx.y+4);
        doc.setFont('helvetica','normal');
        doc.setTextColor(...ctx.COL.OK);
        doc.text(p[1], ctx.ML+70, ctx.y+4, {align:'center'});
        doc.setTextColor(...ctx.COL.GRIS);
        doc.setFontSize(7);
        doc.text(p[2], ctx.ML+90, ctx.y+4);
        doc.setFontSize(8);
        doc.setTextColor(...ctx.COL.NEGRO);
        ctx.y += 6; alt = !alt;
      });
      ctx.y += 4;

      // Alertas del suelo
      var alertasEl = document.getElementById('suelo-alertas');
      if (alertasEl && alertasEl.children.length > 0) {
        seccion(ctx, '⚠️ ALERTAS Y RECOMENDACIONES', ctx.COL.AMBAR);
        alertasEl.querySelectorAll('.alert').forEach(function(a) {
          checkPage(ctx, 10);
          var txt = a.textContent.replace(/\s+/g,' ').trim();
          doc.setFontSize(8);
          doc.setTextColor(...ctx.COL.NEGRO);
          doc.setFont('helvetica','normal');
          var lines = doc.splitTextToSize(txt, ctx.W-6);
          lines.slice(0, 3).forEach(function(l) { doc.text(l, ctx.ML+3, ctx.y+4); ctx.y += 4.5; });
          ctx.y += 2;
        });
      }

      // Fuente
      if (d.fuente) {
        ctx.y += 2;
        doc.setFontSize(7);
        doc.setFont('helvetica','italic');
        doc.setTextColor(...ctx.COL.GRIS);
        var srcLines = doc.splitTextToSize(d.fuente, ctx.W-6);
        srcLines.forEach(function(l) { checkPage(ctx, 5); doc.text(l, ctx.ML+3, ctx.y); ctx.y += 3.8; });
      }

      cerrarPDF(ctx);
      doc.save(nombreArchivo('Suelo'));
      amToast('✅ Análisis de Suelo exportado a PDF', 'ok');
    } catch(e) {
      console.error('pdfSuelo error:', e);
      amToast('Error generando PDF: ' + e.message, 'err');
    }
  };

  // ── HÍDRICO ──────────────────────────────────────────
  window.pdfHidrico = function() {
    try {
      var resCont = document.getElementById('bh-res');
      if (!resCont || resCont.classList.contains('hidden')) {
        amToast('Primero ejecutá el balance hídrico.', 'err');
        return;
      }
      var ctx = crearPDFBase('Balance Hídrico y Escenario Climático', 'Agua disponible · Requerimiento · ENSO · Riego suplementario');
      var doc = ctx.doc;
      seccionDatosLote(ctx, datosLoteComunes());

      seccion(ctx, '💧 DIAGNÓSTICO HÍDRICO DEL CICLO', ctx.COL.VERDE);
      doc.setFontSize(9);
      doc.setFont('helvetica','normal');
      doc.setTextColor(...ctx.COL.NEGRO);
      var resText = resCont.textContent.replace(/\s+/g, ' ').trim().slice(0, 2500);
      var lines = doc.splitTextToSize(resText, ctx.W-6);
      lines.forEach(function(l) { checkPage(ctx, 6); doc.text(l, ctx.ML+3, ctx.y); ctx.y += 4.5; });

      cerrarPDF(ctx);
      doc.save(nombreArchivo('Hidrico'));
      amToast('✅ Balance Hídrico exportado a PDF', 'ok');
    } catch(e) {
      console.error('pdfHidrico error:', e);
      amToast('Error generando PDF: ' + e.message, 'err');
    }
  };

  // ── Botón flotante context-aware ─────────────────────
  // Detecta el módulo activo y dispara el generador correspondiente.
  window.amExportarPDFModulo = function() {
    if (!window.AM_SESION) {
      amToast('Iniciá sesión primero — el PDF se firma con tu matrícula profesional.', 'err');
      if (typeof amMostrarModal === 'function') amMostrarModal('login');
      return;
    }
    var activePanel = document.querySelector('.module-panel.active');
    var modId = activePanel?.id?.replace('mod-','');
    var fns = {
      'decision':     window.pdfDecision,
      'fertilizacion':window.pdfFertilizacion,
      'balancenut':   window.pdfBalanceNutricional,
      'suelo':        window.pdfSuelo,
      'hidrico':      window.pdfHidrico,
    };
    var fn = fns[modId];
    if (typeof fn === 'function') fn();
    else amToast('Este módulo aún no soporta exportar PDF.', 'err');
  };

})();
