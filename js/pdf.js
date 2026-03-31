// ════════════════════════════════════════════════════════
// AGROMOTOR — pdf.js
// Generador de Reporte PDF A4 profesional
// jsPDF · Reporte completo del lote
// ════════════════════════════════════════════════════════

async function generarPDF() {
  const btn = $('btn-pdf');
  const textoOriginal = btn.innerHTML;
  btn.innerHTML = '⟳ Generando...';
  btn.disabled = true;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const PW = 210, PH = 297;
    const ML = 15, MR = 15, MT = 15;
    let y = MT;

    // ── PALETA ──────────────────────────────────────────
    const VERDE  = [30, 77, 43];
    const VERDE2 = [58, 122, 74];
    const DORADO = [200, 162, 85];
    const TIERRA = [61, 34, 16];
    const GRIS   = [120, 120, 120];
    const CLARO  = [245, 241, 234];
    const NEGRO  = [28, 18, 8];

    // ── HELPERS ──────────────────────────────────────────
    const W = PW - ML - MR; // ancho útil = 180mm
    const txtV  = id => $(id)?.textContent?.trim() || '—';
    const inpV  = id => $(id)?.value?.trim()       || '—';
    const saltoLinea = (n=5) => { y += n; };

    function checkPage(needed = 20) {
      if (y + needed > PH - 15) { doc.addPage(); y = MT; }
    }

    function seccion(titulo, colorFondo = VERDE) {
      checkPage(14);
      doc.setFillColor(...colorFondo);
      doc.roundedRect(ML, y, W, 8, 2, 2, 'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(9);
      doc.setFont('helvetica','bold');
      doc.text(titulo.toUpperCase(), ML+3, y+5.5);
      doc.setTextColor(...NEGRO);
      y += 11;
    }

    function fila(label, valor, color = null) {
      checkPage(7);
      doc.setFontSize(8.5);
      doc.setFont('helvetica','normal');
      doc.setTextColor(...GRIS);
      doc.text(label, ML+2, y);
      doc.setTextColor(color ? color[0] : NEGRO[0], color ? color[1] : NEGRO[1], color ? color[2] : NEGRO[2]);
      doc.setFont('helvetica','bold');
      doc.text(String(valor), ML+2+65, y, { maxWidth: W-70 });
      doc.setTextColor(...NEGRO);
      doc.setFont('helvetica','normal');
      y += 6;
    }

    function filaBanda(label, valor, banda = false) {
      checkPage(7);
      if (banda) {
        doc.setFillColor(...CLARO);
        doc.rect(ML, y-4, W, 6.5, 'F');
      }
      fila(label, valor);
    }

    function kpiRow(items) {
      // items = [{label, valor, unit}]
      checkPage(18);
      const cw = W / items.length;
      items.forEach((item, i) => {
        const x = ML + i*cw;
        doc.setFillColor(...VERDE);
        doc.roundedRect(x, y, cw-2, 14, 2, 2, 'F');
        doc.setTextColor(255,255,255);
        doc.setFontSize(7);
        doc.setFont('helvetica','normal');
        doc.text(item.label.toUpperCase(), x+2, y+4.5, { maxWidth: cw-4 });
        doc.setFontSize(11);
        doc.setFont('helvetica','bold');
        doc.text(String(item.valor), x+2, y+11);
        if (item.unit) {
          doc.setFontSize(6.5);
          doc.setFont('helvetica','normal');
          doc.text(item.unit, x+2+doc.getTextWidth(String(item.valor))+1, y+11);
        }
      });
      doc.setTextColor(...NEGRO);
      y += 17;
    }

    // ════════════════════════════════════════════════════
    // PÁGINA 1
    // ════════════════════════════════════════════════════

    // ── HEADER ──────────────────────────────────────────
    // Fondo oscuro header
    doc.setFillColor(...VERDE);
    doc.rect(0, 0, PW, 38, 'F');

    // Línea dorada
    doc.setFillColor(...DORADO);
    doc.rect(0, 38, PW, 1.5, 'F');

    // Logo placeholder
    doc.setFillColor(...VERDE2);
    doc.roundedRect(ML, 8, 22, 22, 3, 3, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(16);
    doc.text('🌱', ML+4, 23);

    // Título
    doc.setTextColor(255,255,255);
    doc.setFontSize(20);
    doc.setFont('helvetica','bold');
    doc.text('AgroMotor', ML+26, 18);
    doc.setFontSize(8.5);
    doc.setFont('helvetica','normal');
    doc.setTextColor(200, 230, 200);
    doc.text('REPORTE AGRONÓMICO DE LOTE', ML+26, 24);
    doc.text('Motor Agronómico de Decisión · Lógica INTA Argentina', ML+26, 30);

    // Fecha y hora
    const ahora = new Date();
    const fechaStr = ahora.toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
    const horaStr  = ahora.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    doc.setTextColor(200,220,200);
    doc.setFontSize(7.5);
    doc.text(`Generado: ${fechaStr} · ${horaStr}`, PW-ML, 30, { align:'right' });

    // Plan del usuario
    if (AM_SESION) {
      const planInfo = AM_PLANES[AM_SESION.plan];
      doc.setTextColor(...DORADO);
      doc.text(`${planInfo.nombre} · ${AM_SESION.nombre}`, PW-ML, 18, { align:'right' });
    }

    y = 48;

    // ── DATOS DEL LOTE ────────────────────────────────────
    seccion('📍 Identificación del lote', VERDE);

    const coord   = inpV('s-coord');
    const cultivo = inpV('s-cultivo') || inpV('bh-cultivo') || '—';
    const fechaSiem = inpV('s-fecha');
    const suelo   = inpV('s-suelo');
    const loc     = txtV('s-loc') || '—';

    filaBanda('Coordenadas GPS',   coord,      false);
    filaBanda('Ubicación',         loc,         true);
    filaBanda('Cultivo',           cultivo,    false);
    filaBanda('Fecha de siembra',  fechaSiem,   true);
    filaBanda('Tipo de suelo',     suelo,      false);

    saltoLinea(4);

    // ── DIAGNÓSTICO DE SIEMBRA ────────────────────────────
    const scoreEl = document.querySelector('.score-num') || $('s-score');
    const scoreVal = scoreEl?.textContent?.trim() || '—';
    const t6v  = txtV('sv-t6');
    const h1v  = txtV('sv-h1');
    const et0v = txtV('sv-et0');
    const vpdv = txtV('sv-vpd');
    const viev = txtV('sv-viento');
    const gddv = txtV('i-gdd') || txtV('s-gdd') || '—';

    seccion('🌡️ Diagnóstico de siembra · Open-Meteo en tiempo real', VERDE);

    // Score visual
    const scoreNum = parseFloat(scoreVal) || 0;
    const scoreColor = scoreNum >= 70 ? [42,122,74] : scoreNum >= 50 ? [184,122,32] : [201,74,42];
    const scoreLabel = scoreNum >= 70 ? 'APTO' : scoreNum >= 50 ? 'CONDICIONADO' : 'NO RECOMENDADO';

    doc.setFillColor(...scoreColor);
    doc.roundedRect(ML, y, 55, 18, 3, 3, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(20);
    doc.setFont('helvetica','bold');
    doc.text(scoreVal, ML+4, y+13);
    doc.setFontSize(8);
    doc.setFont('helvetica','normal');
    doc.text('/ 100', ML+22, y+13);
    doc.setFontSize(9);
    doc.setFont('helvetica','bold');
    doc.text(scoreLabel, ML+32, y+8);
    doc.setFontSize(7);
    doc.setFont('helvetica','normal');
    doc.text('Score de aptitud de siembra', ML+32, y+14);
    doc.setTextColor(...NEGRO);
    y += 22;

    kpiRow([
      { label:'T° suelo 6cm', valor:t6v,  unit:'' },
      { label:'Humedad 0-9cm',valor:h1v,  unit:'' },
      { label:'ET₀ diaria',   valor:et0v, unit:'' },
      { label:'VPD',          valor:vpdv, unit:'' },
      { label:'Viento',       valor:viev, unit:'' },
    ]);

    // Compactación
    const compV = inpV('s-compact') || txtV('sv-compact');
    const compSrc = txtV('compact-source');
    if (compV && compV !== '—') {
      fila('Riesgo de compactación', `${compV} MPa ${compSrc ? '· '+compSrc.replace('←','').trim() : ''}`, compV > 2 ? [201,74,42] : [184,122,32]);
    }

    saltoLinea(4);

    // ── SUELO ─────────────────────────────────────────────
    const phV   = txtV('sg-ph');
    const mocV  = txtV('sg-soc');
    const nV    = txtV('sg-n');
    const daV   = txtV('sg-da');
    const cecV  = txtV('sg-cec');
    const texV  = txtV('sg-textura') || inpV('s-suelo');

    if (phV && phV !== '—') {
      checkPage(50);
      seccion('🌍 Análisis de suelo · SoilGrids ISRIC 250m', [42,90,140]);
      kpiRow([
        { label:'pH', valor:phV, unit:'' },
        { label:'C. Orgánico', valor:mocV, unit:'g/kg' },
        { label:'N total', valor:nV, unit:'g/kg' },
        { label:'DA', valor:daV, unit:'g/cm³' },
        { label:'CEC', valor:cecV, unit:'cmol/kg' },
      ]);
      fila('Tipo de suelo estimado', texV);
      saltoLinea(4);
    }

    // ── ECONOMÍA ──────────────────────────────────────────
    const precDisp = inpV('ec-precio-disp');
    const precFut  = inpV('ec-precio-fut');
    const rendEc   = inpV('ec-rend');
    const supEc    = inpV('ec-sup');
    const dolarOf  = EC_DOLAR?.oficial?.toLocaleString('es-AR') || '—';

    if (precDisp && precDisp !== '—') {
      checkPage(55);
      seccion('💰 Economía de campaña · Precios Rosario', [139,89,16]);

      // Extraer márgenes de la tabla
      const tbRows = $('ec-tabla-body')?.querySelectorAll('tr') || [];
      let margenHoy = '—', margenCos = '—', ingBrutHoy = '—', costTotal = '—';
      tbRows.forEach(tr => {
        const celdas = tr.querySelectorAll('td');
        if (celdas[0]?.textContent?.includes('Margen bruto')) {
          margenHoy = celdas[1]?.textContent?.trim() || '—';
          margenCos = celdas[2]?.textContent?.trim() || '—';
        }
        if (celdas[0]?.textContent?.includes('Ingreso bruto')) {
          ingBrutHoy = celdas[1]?.textContent?.trim() || '—';
        }
      });

      kpiRow([
        { label:'Precio hoy', valor:`USD ${precDisp}`, unit:'/t' },
        { label:'Precio cosecha', valor:`USD ${precFut}`, unit:'/t' },
        { label:'Rendimiento', valor:rendEc, unit:'t/ha' },
        { label:'Superficie', valor:supEc, unit:'ha' },
        { label:'Dólar oficial', valor:`$${dolarOf}`, unit:'' },
      ]);

      // Tabla margen
      const mgNum = parseFloat(margenHoy);
      const mgColor = mgNum >= 0 ? VERDE : [201,74,42];
      fila('Margen bruto hoy (USD/ha)',      margenHoy, mgColor);
      fila('Margen bruto a cosecha (USD/ha)', margenCos);
      fila('Ingreso bruto (USD/ha)',          ingBrutHoy);
      saltoLinea(4);
    }

    // ── BALANCE HÍDRICO ───────────────────────────────────
    const bhRes = !$('bh-res')?.classList?.contains('hidden');
    if (bhRes) {
      checkPage(50);
      seccion('💧 Balance hídrico · FAO-56 · ENSO/NOAA', [22,70,130]);

      const ensoFase  = ENSO_DATA?.label || '—';
      const bhCult    = inpV('bh-cultivo');
      const bhRend    = inpV('bh-rend-obj');
      const bhPrecip  = inpV('bh-precip');
      const bhPerfil  = inpV('bh-agua-perfil');

      fila('Cultivo / Rendimiento objetivo', `${bhCult} · ${bhRend} t/ha`);
      fila('Escenario ENSO actual', ensoFase, ensoFase.includes('Niña') ? [201,74,42] : ensoFase.includes('Niño') ? VERDE : [42,90,140]);
      fila('Precipitación esperada ciclo', `${bhPrecip} mm`);
      fila('Agua útil perfil inicial', `${bhPerfil} mm`);

      // KPIs del balance
      const bhKpiEl = $('bh-kpis');
      if (bhKpiEl) {
        const kpiTexts = bhKpiEl.querySelectorAll('.kv');
        const kpiLabs  = bhKpiEl.querySelectorAll('.kl');
        const kpiUnits = bhKpiEl.querySelectorAll('.ku');
        const kItems   = [];
        kpiTexts.forEach((kv,i) => {
          kItems.push({
            label: kpiLabs[i]?.textContent || `KPI ${i+1}`,
            valor: kv.textContent,
            unit:  kpiUnits[i]?.textContent?.split('·')[0]?.trim() || ''
          });
        });
        if (kItems.length) kpiRow(kItems.slice(0,5));
      }
      saltoLinea(4);
    }

    // ── CULTIVARES TOP 3 ──────────────────────────────────
    const rankingCards = $('cv-ranking-content')?.querySelectorAll('[style*="border-radius:12px"]') || [];
    if (rankingCards.length > 0) {
      checkPage(50);
      seccion('🌱 Top 3 cultivares recomendados · RECSO/INTA 2024-25', VERDE2);

      let count = 0;
      rankingCards.forEach(card => {
        if (count >= 3) return;
        const nombre = card.querySelector('[style*="font-weight:700"]')?.textContent?.trim();
        const rend   = card.querySelector('[style*="font-size:1.2rem"]')?.textContent?.trim();
        const nota   = card.querySelector('[style*="font-style:italic"]')?.textContent?.trim()?.slice(0,80);
        if (!nombre || nombre.includes('⚠️')) return;

        checkPage(16);
        const medal = count === 0 ? '🥇' : count === 1 ? '🥈' : '🥉';
        doc.setFillColor(...(count === 0 ? DORADO : CLARO));
        doc.roundedRect(ML, y, W, 12, 2, 2, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica','bold');
        doc.setTextColor(...NEGRO);
        doc.text(`${medal} ${nombre}`, ML+2, y+5);
        doc.setFontSize(8);
        doc.setFont('helvetica','normal');
        doc.setTextColor(...GRIS);
        if (rend) doc.text(`Rendimiento relativo: ${rend}`, ML+2, y+10);
        if (nota) doc.text(nota + '...', PW/2, y+10, { maxWidth: W/2-2 });
        y += 14;
        count++;
      });
      saltoLinea(4);
    }

    // ── PRONÓSTICO 7 DÍAS ─────────────────────────────────
    const pronRows = document.querySelectorAll('.pr:not(.hdr)') || [];
    if (pronRows.length > 0) {
      checkPage(60);
      seccion('📅 Pronóstico 7 días · Open-Meteo', VERDE);

      // Encabezado tabla
      doc.setFillColor(...CLARO);
      doc.rect(ML, y, W, 7, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica','bold');
      doc.setTextColor(...GRIS);
      ['Fecha','T°suelo','Hum%','ET₀','Lluvia','Score'].forEach((h,i) => {
        doc.text(h, ML+2+i*30, y+4.5);
      });
      y += 8;

      let banda = false;
      let dias = 0;
      pronRows.forEach(row => {
        if (dias >= 7) return;
        const celdas = row.querySelectorAll('span, div');
        const textos = Array.from(row.children).map(c => c.textContent.trim());
        if (textos.length < 3) return;

        checkPage(7);
        if (banda) { doc.setFillColor(250,248,244); doc.rect(ML,y-4,W,6.5,'F'); }
        doc.setFontSize(7.5);
        doc.setFont('helvetica','normal');
        doc.setTextColor(...NEGRO);
        textos.slice(0,6).forEach((t,i) => {
          doc.text(t.slice(0,12), ML+2+i*30, y);
        });
        y += 6;
        banda = !banda;
        dias++;
      });
      saltoLinea(4);
    }

    // ── FOOTER ───────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      // Línea footer
      doc.setFillColor(...VERDE);
      doc.rect(0, PH-14, PW, 14, 'F');
      doc.setFillColor(...DORADO);
      doc.rect(0, PH-14, PW, 1, 'F');
      doc.setTextColor(200, 220, 200);
      doc.setFontSize(7);
      doc.setFont('helvetica','normal');
      doc.text('AgroMotor · Motor Agronómico de Decisión · Lógica agronómica INTA Argentina', ML, PH-7);
      doc.text(`Página ${p} de ${totalPages}`, PW-ML, PH-7, { align:'right' });
      doc.setTextColor(...DORADO);
      doc.text('agromotor.com.ar', PW/2, PH-7, { align:'center' });
    }

    // ── GUARDAR ───────────────────────────────────────────
    const cultNombre  = cultivo !== '—' ? cultivo.replace(/\s/g,'_') : 'lote';
    const fechaArchivo = ahora.toISOString().split('T')[0];
    const nombreArchivo = `AgroMotor_Reporte_${cultNombre}_${fechaArchivo}.pdf`;

    doc.save(nombreArchivo);

    amToast('✅ Reporte PDF generado y descargado', 'ok');

  } catch(e) {
    console.error('PDF error:', e);
    amToast('⚠️ Error al generar PDF. Verificá que el lote tenga datos cargados.', 'err');
  } finally {
    btn.innerHTML = textoOriginal;
    btn.disabled = false;
  }
}

// ════════════════════════════════════════════════════════
// CACHE localStorage — Persistencia de datos del lote
// ════════════════════════════════════════════════════════
