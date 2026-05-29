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

  // ── NUTRICIÓN DE CULTIVO (Plan + Balance) ────────────
  window.pdfNutricion = function() {
    try {
      var planRes = document.getElementById('nc-plan-resultado');
      var balRes  = document.getElementById('nc-balance-resultado');
      var planOk  = planRes && planRes.style.display !== 'none' && planRes.innerHTML.trim() !== '';
      var balOk   = balRes  && !balRes.classList.contains('hidden') && balRes.innerHTML.trim() !== '';

      if (!planOk && !balOk) {
        amToast('Calculá el plan o el balance antes de exportar el PDF.', 'err');
        return;
      }

      var ctx = crearPDFBase('Nutrición de Cultivo', 'Plan de fertilización · Balance post-cosecha');
      var doc = ctx.doc;
      seccionDatosLote(ctx, datosLoteComunes());

      // ── PLAN DE FERTILIZACIÓN ──────────────────────────
      if (planOk) {
        seccion(ctx, '⚗️ PLAN DE FERTILIZACIÓN', ctx.COL.VERDE);

        var alt = false;
        doc.setFontSize(8.5);
        [
          ['Cultivo',              gtv('nc-lbl-cultivo') || gv('s-cultivo') || '—'],
          ['Rendimiento objetivo', (gv('nc-rend-obj') || '—') + ' t/ha'],
          ['Precio grano',         'USD ' + (gv('nc-precio-grano') || '—') + '/t'],
          ['Superficie',           (gv('nc-sup') || '—') + ' ha'],
        ].forEach(function(row) {
          if (alt) { doc.setFillColor(...ctx.COL.CLARO); doc.rect(ctx.ML, ctx.y, ctx.W, 6, 'F'); }
          doc.setFont('helvetica','normal'); doc.setTextColor(...ctx.COL.GRIS);
          doc.text(row[0], ctx.ML+3, ctx.y+4);
          doc.setFont('helvetica','bold'); doc.setTextColor(...ctx.COL.NEGRO);
          doc.text(row[1], ctx.ML+ctx.W-3, ctx.y+4, {align:'right'});
          ctx.y += 6; alt = !alt;
        });
        ctx.y += 4;

        // Encabezado de costo total
        var planHeader = planRes.querySelector('[style*="0E2016"]');
        if (planHeader) {
          checkPage(ctx, 8);
          var hTxt = planHeader.textContent.replace(/\s+/g,' ').trim();
          doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(...ctx.COL.VERDE2);
          var hLines = doc.splitTextToSize(hTxt.slice(0,160), ctx.W-6);
          hLines.slice(0,3).forEach(function(l) { doc.text(l, ctx.ML+3, ctx.y); ctx.y += 5; });
          ctx.y += 4;
        }

        // Tabla de nutrientes
        var nutCards = planRes.querySelectorAll('[style*="border-radius:12px"]');
        if (nutCards.length) {
          checkPage(ctx, 14);
          doc.setFillColor(...ctx.COL.VERDE2);
          doc.rect(ctx.ML, ctx.y, ctx.W, 7, 'F');
          doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont('helvetica','bold');
          var ncols = [38, 16, 17, 17, 19, 18, 13, 16];
          var nhdrs = ['Nutriente/Fertilizante','Req.','Disp.','Déficit','Dosis rec.','Producto','B/C','Costo'];
          var nx = ctx.ML + 2;
          nhdrs.forEach(function(h, i) { doc.text(h, nx, ctx.y+5); nx += ncols[i]; });
          ctx.y += 8;

          nutCards.forEach(function(card, ci) {
            checkPage(ctx, 8);
            // Nombre del nutriente (primer hijo del primer child = div flex header)
            var hdr = card.firstElementChild && card.firstElementChild.firstElementChild;
            var nutNom = hdr ? hdr.textContent.replace(/\s+/g,' ').trim() : '—';
            // KPIs por índice: 0=Disp, 1=Req, 2=Déficit, 3=Dosis INTA, 4=Dosis rec, 5=Producto, 6=B/C, 7=Costo
            var cells = card.querySelectorAll('[style*="f9f7f2"]');
            function kpiVal(idx) {
              var cell = cells[idx];
              if (!cell) return '—';
              var divs = cell.querySelectorAll('div');
              return divs.length >= 2 ? divs[1].textContent.trim() : '—';
            }
            if (ci % 2 === 0) { doc.setFillColor(...ctx.COL.CLARO); doc.rect(ctx.ML, ctx.y, ctx.W, 6, 'F'); }
            doc.setFontSize(7);
            nx = ctx.ML + 2;
            [nutNom, kpiVal(1), kpiVal(0), kpiVal(2), kpiVal(4), kpiVal(5), kpiVal(6), kpiVal(7)].forEach(function(v, i) {
              doc.setFont('helvetica', i===0 ? 'bold' : 'normal');
              doc.setTextColor(...ctx.COL.NEGRO);
              if (i === 3) { // déficit: naranja si positivo
                var num = parseFloat(v.replace(/[^\d.-]/g,'') || '0');
                if (num > 0) doc.setTextColor(...ctx.COL.WARN);
              }
              doc.text(v.slice(0,18), nx, ctx.y+4);
              nx += ncols[i];
            });
            ctx.y += 6;
          });
          ctx.y += 4;
        }
      }

      // ── BALANCE POST-COSECHA ─────────────────────────────
      if (balOk) {
        checkPage(ctx, 20);
        seccion(ctx, '⚖️ BALANCE NUTRICIONAL POST-COSECHA', ctx.COL.VERDE2);

        var alt2 = false;
        doc.setFontSize(8.5);
        var rastVal = gv('nc-bn-rastrojo');
        [
          ['Cultivo',          gv('nc-bn-cultivo') || '—'],
          ['Rendimiento',      (gv('nc-bn-rend') || '—') + ' t/ha'],
          ['Superficie',       (gv('nc-bn-sup') || '—') + ' ha'],
          ['Destino rastrojo', rastVal === 'campo' ? 'Retenido en campo (se recicla)' : 'Extraído / rolado / quemado'],
        ].forEach(function(row) {
          if (alt2) { doc.setFillColor(...ctx.COL.CLARO); doc.rect(ctx.ML, ctx.y, ctx.W, 6, 'F'); }
          doc.setFont('helvetica','normal'); doc.setTextColor(...ctx.COL.GRIS);
          doc.text(row[0], ctx.ML+3, ctx.y+4);
          doc.setFont('helvetica','bold'); doc.setTextColor(...ctx.COL.NEGRO);
          doc.text(row[1], ctx.ML+ctx.W-3, ctx.y+4, {align:'right'});
          ctx.y += 6; alt2 = !alt2;
        });
        ctx.y += 4;

        // Tabla balance
        var balTbRows = balRes.querySelectorAll('table tbody tr');
        if (balTbRows.length) {
          checkPage(ctx, 14);
          doc.setFillColor(...ctx.COL.VERDE);
          doc.rect(ctx.ML, ctx.y, ctx.W, 7, 'F');
          doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont('helvetica','bold');
          var bcols = [35, 22, 25, 22, 23, 22, 21];
          var bhdrs = ['Nutriente','Extr.grano','Extr.rastro.','Ferti.','Natural','Bal.neto','Total lote'];
          var bx = ctx.ML + 2;
          bhdrs.forEach(function(h, i) { doc.text(h, bx, ctx.y+5); bx += bcols[i]; });
          ctx.y += 8;

          balTbRows.forEach(function(tr, ri) {
            checkPage(ctx, 8);
            var tds = tr.querySelectorAll('td');
            if (tds.length < 6) return;
            if (ri % 2 === 0) { doc.setFillColor(...ctx.COL.CLARO); doc.rect(ctx.ML, ctx.y, ctx.W, 6, 'F'); }
            doc.setFontSize(7);
            bx = ctx.ML + 2;
            Array.from(tds).slice(0,7).forEach(function(td, ti) {
              var txt = td.textContent.trim().slice(0, 22);
              doc.setFont('helvetica', ti===0 ? 'bold' : 'normal');
              doc.setTextColor(...ctx.COL.NEGRO);
              if (ti === 5) { // balance neto: color por signo
                var num = parseFloat(txt.replace(/[^\d.-]/g,'') || '0');
                var neg = txt.charAt(0) === '-';
                if (neg) num = -Math.abs(num);
                doc.setTextColor(...(num >= 0 ? ctx.COL.OK : num > -30 ? ctx.COL.WARN : ctx.COL.DANGER));
                doc.setFont('helvetica','bold');
              }
              doc.text(txt, bx, ctx.y+4);
              bx += bcols[ti] || 20;
            });
            ctx.y += 6;
          });
          ctx.y += 4;
        }

        // Recomendaciones
        var balAlerts = balRes.querySelectorAll('.alert');
        if (balAlerts.length) {
          checkPage(ctx, 10);
          seccion(ctx, '💊 RECOMENDACIONES PRÓXIMA CAMPAÑA', ctx.COL.AMBAR);
          balAlerts.forEach(function(a) {
            checkPage(ctx, 14);
            var txt = a.textContent.replace(/\s+/g,' ').trim();
            var bgColor = a.classList.contains('danger') ? ctx.COL.DANGER : a.classList.contains('warn') ? ctx.COL.WARN : ctx.COL.OK;
            doc.setDrawColor(...bgColor); doc.setLineWidth(0.5);
            doc.line(ctx.ML, ctx.y-1, ctx.ML, ctx.y+9);
            doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...ctx.COL.NEGRO);
            var aLines = doc.splitTextToSize(txt, ctx.W-8);
            aLines.slice(0,4).forEach(function(l) { checkPage(ctx, 6); doc.text(l, ctx.ML+4, ctx.y+4); ctx.y += 4.5; });
            ctx.y += 3;
          });
        }
      }

      cerrarPDF(ctx);
      doc.save(nombreArchivo('Nutricion'));
      amToast('✅ Plan de Nutrición exportado a PDF', 'ok');
    } catch(e) {
      console.error('pdfNutricion error:', e);
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

  // ── COSECHA ──────────────────────────────────────────
  window.pdfCosecha = function() {
    try {
      var ctx = crearPDFBase('Cosecha · Costos y márgenes', 'Tarifas · Fletes · Almacenamiento · Decisión venta');
      var doc = ctx.doc;
      seccionDatosLote(ctx, datosLoteComunes());

      seccion(ctx, '🌾 RESUMEN DEL LOTE', ctx.COL.VERDE);
      var datos = {
        'Cultivo':              gv('cos-cultivo') || '—',
        'Superficie (ha)':      gv('cos-sup') || '—',
        'Rendimiento (qq/ha)':  gv('cos-rend') || '—',
        'Humedad cosecha (%)':  gv('cos-hum') || '—',
        'Producción total (t)': gtv('kv-ton') || '—',
        'Producción quintales': gtv('kv-qq') || '—',
        'Ingreso bruto USD':    gtv('kv-bruto-usd') || '—',
        'Ingreso bruto ARS':    gtv('kv-bruto-ars') || '—',
      };
      var alt = false;
      doc.setFontSize(8.5);
      Object.entries(datos).forEach(function(kv) {
        if (alt) { doc.setFillColor(...ctx.COL.CLARO); doc.rect(ctx.ML, ctx.y, ctx.W, 6, 'F'); }
        doc.setFont('helvetica','normal');
        doc.setTextColor(...ctx.COL.GRIS);
        doc.text(kv[0], ctx.ML+3, ctx.y+4);
        doc.setFont('helvetica','bold');
        doc.setTextColor(...ctx.COL.NEGRO);
        doc.text(String(kv[1]), ctx.ML+ctx.W-3, ctx.y+4, {align:'right'});
        ctx.y += 6; alt = !alt;
      });
      ctx.y += 4;

      // Si hay decisión IA renderizada (resumen narrativo)
      var iaResumen = document.getElementById('cos-ia-output')?.textContent?.trim();
      if (iaResumen && iaResumen.length > 50) {
        seccion(ctx, '🤖 ANÁLISIS NARRATIVO', ctx.COL.AZUL);
        doc.setFontSize(8.5);
        doc.setFont('helvetica','normal');
        doc.setTextColor(...ctx.COL.NEGRO);
        var iaLines = doc.splitTextToSize(iaResumen.slice(0, 2500), ctx.W-6);
        iaLines.forEach(function(l) { checkPage(ctx, 6); doc.text(l, ctx.ML+3, ctx.y); ctx.y += 4.5; });
      }

      cerrarPDF(ctx);
      doc.save(nombreArchivo('Cosecha'));
      amToast('✅ Análisis de Cosecha exportado a PDF', 'ok');
    } catch(e) {
      console.error('pdfCosecha error:', e);
      amToast('Error generando PDF: ' + e.message, 'err');
    }
  };

  // ── PLAGAS ───────────────────────────────────────────
  window.pdfPlagas = function() {
    try {
      var cont = document.querySelector('#mod-plagas .resultado, #mod-plagas [id*="resultado"]') ||
                 document.querySelector('#mod-plagas');
      var ctx = crearPDFBase('Alertas de Plagas', 'Favorabilidad climática · Umbrales INTA · Monitoreo recomendado');
      var doc = ctx.doc;
      seccionDatosLote(ctx, datosLoteComunes());

      // Banner orientativa
      seccion(ctx, '⚠️ ESTIMACIÓN ORIENTATIVA', ctx.COL.AMBAR);
      doc.setFontSize(8);
      doc.setFont('helvetica','italic');
      doc.setTextColor(...ctx.COL.GRIS);
      var disclaimer = 'Los modelos evalúan condiciones climáticas favorables para el desarrollo poblacional de cada plaga. No reemplazan el monitoreo a campo. Las decisiones de control deben tomarse con observación directa.';
      var dispLines = doc.splitTextToSize(disclaimer, ctx.W-6);
      dispLines.forEach(function(l) { doc.text(l, ctx.ML+3, ctx.y); ctx.y += 4.5; });
      ctx.y += 3;

      // Riesgos por plaga (si hay tabla)
      seccion(ctx, '🐛 RIESGO POR PLAGA', ctx.COL.WARN);
      var tablaPlagas = cont?.querySelector('table');
      if (tablaPlagas) {
        var rows = tablaPlagas.querySelectorAll('tbody tr');
        doc.setFontSize(8);
        rows.forEach(function(tr) {
          checkPage(ctx, 8);
          var cells = tr.querySelectorAll('td');
          if (cells.length < 2) return;
          var plaga = cells[0]?.textContent.trim().slice(0, 40);
          var riesgo = cells[1]?.textContent.trim().slice(0, 60);
          doc.setFont('helvetica','bold');
          doc.text(plaga, ctx.ML+3, ctx.y+4);
          doc.setFont('helvetica','normal');
          doc.text(riesgo, ctx.ML+70, ctx.y+4);
          ctx.y += 6;
        });
      } else {
        doc.setFontSize(9);
        doc.setFont('helvetica','italic');
        doc.setTextColor(...ctx.COL.GRIS);
        doc.text('Ejecutá el análisis de presión de plagas para incluir el detalle.', ctx.ML+3, ctx.y);
        ctx.y += 8;
      }

      cerrarPDF(ctx);
      doc.save(nombreArchivo('Plagas'));
      amToast('✅ Reporte de Plagas exportado a PDF', 'ok');
    } catch(e) {
      console.error('pdfPlagas error:', e);
      amToast('Error generando PDF: ' + e.message, 'err');
    }
  };

  // ── PULVERIZACIÓN ────────────────────────────────────
  window.pdfPulverizacion = function() {
    try {
      var ctx = crearPDFBase('Ventana de Pulverización', 'Semáforo agronómico · Delta T · Deriva · Calidad de agua');
      var doc = ctx.doc;
      seccionDatosLote(ctx, datosLoteComunes());

      seccion(ctx, '💦 CONDICIONES METEOROLÓGICAS ACTUALES', ctx.COL.VERDE);
      var datos = {
        'Temperatura (°C)':       gtv('pa-temp-val') || '—',
        'Humedad relativa (%)':   gtv('pa-hr-val') || '—',
        'Viento (km/h)':          gtv('pa-viento-val') || '—',
        'Delta T':                gtv('pa-deltat-val') || gtv('pa-dt-val') || '—',
        'Buffer recomendado':     gtv('pd-buffer-val') || '—',
      };
      doc.setFontSize(9);
      var alt = false;
      Object.entries(datos).forEach(function(kv) {
        if (alt) { doc.setFillColor(...ctx.COL.CLARO); doc.rect(ctx.ML, ctx.y, ctx.W, 6, 'F'); }
        doc.setFont('helvetica','normal');
        doc.setTextColor(...ctx.COL.GRIS);
        doc.text(kv[0], ctx.ML+3, ctx.y+4);
        doc.setFont('helvetica','bold');
        doc.setTextColor(...ctx.COL.NEGRO);
        doc.text(String(kv[1]), ctx.ML+ctx.W-3, ctx.y+4, {align:'right'});
        ctx.y += 6; alt = !alt;
      });
      ctx.y += 4;

      // Caldo
      var caldoRes = document.getElementById('pulv-caldo-res');
      if (caldoRes && caldoRes.textContent.trim().length > 20) {
        seccion(ctx, '🧪 CALCULADORA DE CALDO', ctx.COL.AZUL);
        doc.setFontSize(8.5);
        doc.setFont('helvetica','normal');
        doc.setTextColor(...ctx.COL.NEGRO);
        var caldoLines = doc.splitTextToSize(caldoRes.textContent.replace(/\s+/g,' ').trim().slice(0, 2000), ctx.W-6);
        caldoLines.forEach(function(l) { checkPage(ctx, 6); doc.text(l, ctx.ML+3, ctx.y); ctx.y += 4.5; });
      }

      cerrarPDF(ctx);
      doc.save(nombreArchivo('Pulverizacion'));
      amToast('✅ Ventana de Pulverización exportada a PDF', 'ok');
    } catch(e) {
      console.error('pdfPulverizacion error:', e);
      amToast('Error generando PDF: ' + e.message, 'err');
    }
  };

  // ── CULTIVARES ───────────────────────────────────────
  window.pdfCultivares = function() {
    try {
      var cultivo = gv('cv-cultivo') || 'Soja';
      var ctx = crearPDFBase(
        'Recomendador de Cultivares — ' + cultivo,
        'Grupos de Madurez · RECSO/INTA 2024-25 · Zona detectada del lote'
      );
      var doc = ctx.doc;
      seccionDatosLote(ctx, datosLoteComunes());

      // ── Zona y parámetros detectados automáticamente ──
      seccion(ctx, 'ZONA Y PARAMETROS DEL LOTE', ctx.COL.VERDE);
      doc.setFontSize(9);
      doc.setFont('helvetica','normal');
      doc.setTextColor(...ctx.COL.NEGRO);

      var zonaLabel  = document.getElementById('cv-zona-label')?.textContent  || gv('cv-zona') || '—';
      var tipoLabel  = document.getElementById('cv-tipo-label')?.textContent  || '—';
      var ambLabel   = document.getElementById('cv-amb-label')?.textContent   || '—';
      var ambRazon   = document.getElementById('cv-amb-razon')?.textContent   || '';
      var fechaSiem  = gv('cv-fecha') || '—';

      var filas = [
        ['Zona agroecologica', zonaLabel.replace(/·/g,'·').substring(0,70)],
        ['Cultivo',            cultivo],
        ['Fecha de siembra',   fechaSiem],
        ['Posicion de siembra',tipoLabel.replace(/[⚠️]/g,'').trim()],
        ['Calidad de ambiente',ambLabel],
      ];
      if (ambRazon) filas.push(['Indicadores suelo', ambRazon.replace(/🛰️|📚/g,'').trim().substring(0,80)]);

      filas.forEach(function(f) {
        checkPage(ctx, 6);
        doc.setFont('helvetica','normal');
        doc.setTextColor(...ctx.COL.GRIS);
        doc.text(f[0] + ':', ctx.ML+3, ctx.y+4);
        doc.setFont('helvetica','bold');
        doc.setTextColor(...ctx.COL.NEGRO);
        var lines = doc.splitTextToSize(f[1], ctx.W - 52);
        doc.text(lines, ctx.ML+52, ctx.y+4);
        ctx.y += Math.max(6, lines.length * 4.5);
      });
      ctx.y += 3;

      // ── GMs recomendados (del panel de zona-info) ────
      var zonaInfoEl = document.getElementById('cv-zona-info');
      if (zonaInfoEl) {
        var gmSpans = zonaInfoEl.querySelectorAll('span[style*="border-radius:12px"]');
        if (gmSpans.length > 0) {
          seccion(ctx, 'GRUPOS DE MADUREZ RECOMENDADOS', ctx.COL.VERDE2);
          doc.setFontSize(8.5);
          var gmTexts = Array.from(gmSpans).map(function(s){ return s.textContent.trim(); });
          var gmLine  = gmTexts.join('   ');
          doc.setFont('helvetica','bold');
          doc.setTextColor(...ctx.COL.NEGRO);
          doc.text(gmLine.substring(0,120), ctx.ML+3, ctx.y+5);
          ctx.y += 9;
          doc.setFont('helvetica','normal');
          doc.setFontSize(7.5);
          doc.setTextColor(...ctx.COL.GRIS);
          doc.text('★ = GM optimo para la posicion de siembra y ambiente · Fuente: RECSO/RET-INASE (INTA Oliveros) 2024-25', ctx.ML+3, ctx.y);
          ctx.y += 8;
        }
      }

      // ── Ranking de cultivares (del DOM generado por cvActualizar) ─
      var rankingEl = document.getElementById('cv-ranking-content');
      if (rankingEl) {
        // Extraer cultivares de los divs de ranking buscando el texto estructurado
        var cultivarDivs = rankingEl.querySelectorAll('div[style*="border-radius:12px"]');
        if (cultivarDivs.length > 0) {
          seccion(ctx, 'RANKING DE CULTIVARES — ' + cultivo.toUpperCase(), ctx.COL.VERDE);
          doc.setFontSize(8.5);
          var pos = 0;
          cultivarDivs.forEach(function(d) {
            if (pos >= 10) return;
            var txt = d.textContent.replace(/\s+/g,' ').trim();
            // Filtrar divs que no son cultivares (el div de metodología, etc)
            if (txt.length < 20 || txt.indexOf('%') === -1) return;
            checkPage(ctx, 18);
            pos++;
            // Primera línea: nombre + rend%
            var match = txt.match(/([A-Z][A-Za-z0-9\s\-\/]+)\s+(\d+)%/);
            var nombre = match ? match[1].trim() : txt.slice(0,40);
            var rend   = match ? match[2] + '%' : '';
            doc.setFont('helvetica','bold');
            doc.setTextColor(...ctx.COL.NEGRO);
            doc.text('#' + pos + '  ' + nombre + (rend ? '  →  ' + rend + ' vs testigo' : ''), ctx.ML+3, ctx.y+4);
            ctx.y += 5;
            // Segunda línea: resto del texto (empresa, GM, nota)
            doc.setFont('helvetica','normal');
            doc.setFontSize(7.5);
            doc.setTextColor(...ctx.COL.GRIS);
            var resto = txt.replace(nombre,'').replace(rend,'').replace(/[#\d\s]+$/,'').trim();
            var lines = doc.splitTextToSize(resto.substring(0, 220), ctx.W-6);
            lines.slice(0,3).forEach(function(l){ doc.text(l, ctx.ML+5, ctx.y+4); ctx.y += 4; });
            doc.setFontSize(8.5);
            ctx.y += 3;
          });
          if (pos === 0) {
            doc.setFont('helvetica','italic');
            doc.setTextColor(...ctx.COL.GRIS);
            doc.text('Completa los parametros del lote para incluir el ranking.', ctx.ML+3, ctx.y);
            ctx.y += 8;
          }
        }
      }

      // ── Nota metodológica ────────────────────────────
      checkPage(ctx, 16);
      ctx.y += 4;
      doc.setFontSize(7);
      doc.setFont('helvetica','italic');
      doc.setTextColor(...ctx.COL.GRIS);
      var nota = 'Fuentes: RECSO (INTA Oliveros) 370 ensayos / 62 localidades · RET-INASE · Zona detectada automaticamente de coordenadas del lote · ' +
                 'Calidad de ambiente calculada de SoilGrids ISRIC 250m (SOC, CEC, textura) · Rendimiento relativo promedio vs. testigo regional · Campana 2024/25';
      doc.splitTextToSize(nota, ctx.W).forEach(function(l){ doc.text(l, ctx.ML, ctx.y); ctx.y += 4; });

      cerrarPDF(ctx);
      doc.save(nombreArchivo('Cultivares'));
      amToast('✅ Cultivares exportado a PDF', 'ok');
    } catch(e) {
      console.error('pdfCultivares error:', e);
      amToast('Error generando PDF: ' + e.message, 'err');
    }
  };

  // ── ECONOMÍA ─────────────────────────────────────────
  window.pdfEconomia = function() {
    try {
      var ctx = crearPDFBase('Economía de Campaña', 'Margen bruto · Dólar tiempo real · Insumos · Flete');
      var doc = ctx.doc;
      seccionDatosLote(ctx, datosLoteComunes());

      seccion(ctx, '💰 PRECIOS DE GRANO Y TIPO DE CAMBIO', ctx.COL.VERDE);
      var datos = {
        'Cultivo':                 gv('ec-cultivo') || '—',
        'Precio disponible':       gv('ec-precio-disp') ? 'USD ' + gv('ec-precio-disp') + '/t' : '—',
        'Precio futuro cosecha':   gv('ec-precio-fut') ? 'USD ' + gv('ec-precio-fut') + '/t' : '—',
        'Convertido USD/qq':       gtv('ec-precio-qq') || '—',
        'Spread fut-disp':         gtv('ec-spread') || '—',
        'Dólar Oficial':           gtv('ec-dolar-oficial') || '—',
        'Dólar Blue':              gtv('ec-dolar-blue') || '—',
        'Dólar MEP':               gtv('ec-dolar-mep') || '—',
        'Dólar CCL':               gtv('ec-dolar-ccl') || '—',
        'Superficie (ha)':         gv('ec-sup') || '—',
        'Rendimiento (t/ha)':      gv('ec-rend') || '—',
      };
      doc.setFontSize(8.5);
      var alt = false;
      Object.entries(datos).forEach(function(kv) {
        if (alt) { doc.setFillColor(...ctx.COL.CLARO); doc.rect(ctx.ML, ctx.y, ctx.W, 6, 'F'); }
        doc.setFont('helvetica','normal');
        doc.setTextColor(...ctx.COL.GRIS);
        doc.text(kv[0], ctx.ML+3, ctx.y+4);
        doc.setFont('helvetica','bold');
        doc.setTextColor(...ctx.COL.NEGRO);
        doc.text(String(kv[1]), ctx.ML+ctx.W-3, ctx.y+4, {align:'right'});
        ctx.y += 6; alt = !alt;
      });
      ctx.y += 4;

      // Comparativo de márgenes (si está renderizado)
      var compDiv = document.getElementById('ec-tabla-body') || document.getElementById('ec-comparativo');
      if (compDiv && compDiv.textContent.trim().length > 30) {
        seccion(ctx, '📊 COMPARATIVO DE MÁRGENES', ctx.COL.VERDE2);
        doc.setFontSize(8.5);
        doc.setFont('helvetica','normal');
        doc.setTextColor(...ctx.COL.NEGRO);
        var compLines = doc.splitTextToSize(compDiv.textContent.replace(/\s+/g,' ').trim().slice(0, 2500), ctx.W-6);
        compLines.forEach(function(l) { checkPage(ctx, 6); doc.text(l, ctx.ML+3, ctx.y); ctx.y += 4.5; });
      }

      cerrarPDF(ctx);
      doc.save(nombreArchivo('Economia'));
      amToast('✅ Economía exportada a PDF', 'ok');
    } catch(e) {
      console.error('pdfEconomia error:', e);
      amToast('Error generando PDF: ' + e.message, 'err');
    }
  };

  // ── Informe de Cierre de Campaña ─────────────────────
  window.pdfInformeCierre = function() {
    try {
      // Leer datos del cierre almacenado
      var raw = localStorage.getItem('am_campana_cerrada_ultima');
      var d   = raw ? JSON.parse(raw) : null;

      // Si no hay cierre guardado, intentar leer estado actual de los módulos
      if (!d) {
        var esMs = 'No se encontró informe de cierre. Cerrá la campaña desde el módulo de Seguimiento primero.';
        amToast(esMs, 'err');
        return;
      }

      var ctx = crearPDFBase('Informe de Cierre de Campaña',
        (d.cultivo || '').charAt(0).toUpperCase() + (d.cultivo || '').slice(1) +
        (d.lote ? ' · ' + d.lote : '') +
        (d.fechaCosecha ? ' · Cosecha ' + d.fechaCosecha : ''));

      var doc = ctx.doc;

      // Función helper para fila de datos
      function fila(etiqueta, valor, alt) {
        checkPage(ctx, 7);
        if (alt) { doc.setFillColor(...ctx.COL.CLARO); doc.rect(ctx.ML, ctx.y, ctx.W, 6, 'F'); }
        doc.setFont('helvetica','normal'); doc.setTextColor(...ct