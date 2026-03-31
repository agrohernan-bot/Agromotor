// ════════════════════════════════════════════════════════
// AGROMOTOR — economia.js
// Economía de campaña · DolarAPI tiempo real
// Márgenes HOY vs COSECHA · Punto de equilibrio
// Fertilización NPK · Maquinaria productividad
// ════════════════════════════════════════════════════════

let EC_DOLAR = { oficial:1080, blue:1085, mep:1090, ccl:1095, ts:null };

async function ecActualizarDolar() {
  const badge = $('ec-dolar-badge');
  if (badge) badge.textContent = '⟳ actualizando...';
  try {
    // DolarAPI — gratis, sin key, CORS ok
    const res = await Promise.race([
      fetch('https://dolarapi.com/v1/dolares'),
      new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),8000))
    ]);
    if (!res.ok) throw new Error('HTTP '+res.status);
    const datos = await res.json();

    // Parsear respuesta
    datos.forEach(d => {
      const c = d.casa?.toLowerCase();
      const v = d.venta ?? d.compra;
      if (!v) return;
      if (c === 'oficial')   EC_DOLAR.oficial = v;
      else if (c === 'blue') EC_DOLAR.blue    = v;
      else if (c === 'bolsa' || c === 'mep') EC_DOLAR.mep = v;
      else if (c === 'contadoconliqui' || c === 'ccl') EC_DOLAR.ccl = v;
    });
    EC_DOLAR.ts = new Date();

    // Mostrar panel
    ecRenderDolar();
    if (badge) badge.textContent = `✅ Dólar actualizado ${EC_DOLAR.ts.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}`;
    ecCalc();

  } catch(e) {
    console.warn('DolarAPI:', e.message);
    if (badge) badge.textContent = '⚠️ Dólar no disponible — usando referencia';
    ecRenderDolar();
    ecCalc();
  }
}

function ecRenderDolar() {
  const ts = EC_DOLAR.ts
    ? EC_DOLAR.ts.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})
    : 'Referencia';

  $('ec-dolar-panel').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem;margin-bottom:.5rem">
      <div style="background:rgba(74,140,92,.08);border-radius:8px;padding:.6rem .8rem;text-align:center">
        <div style="font-size:.62rem;color:rgba(74,46,26,.5);font-weight:600;text-transform:uppercase;letter-spacing:.08em">Oficial</div>
        <div style="font-size:1.2rem;font-weight:700;color:var(--canopy)">$${EC_DOLAR.oficial.toLocaleString('es-AR')}</div>
      </div>
      <div style="background:rgba(74,46,26,.06);border-radius:8px;padding:.6rem .8rem;text-align:center">
        <div style="font-size:.62rem;color:rgba(74,46,26,.5);font-weight:600;text-transform:uppercase;letter-spacing:.08em">Blue</div>
        <div style="font-size:1.2rem;font-weight:700;color:var(--warn)">$${EC_DOLAR.blue.toLocaleString('es-AR')}</div>
      </div>
      <div style="background:rgba(42,90,140,.06);border-radius:8px;padding:.6rem .8rem;text-align:center">
        <div style="font-size:.62rem;color:rgba(74,46,26,.5);font-weight:600;text-transform:uppercase;letter-spacing:.08em">MEP</div>
        <div style="font-size:1.2rem;font-weight:700;color:#2A5A8C">$${EC_DOLAR.mep.toLocaleString('es-AR')}</div>
      </div>
      <div style="background:rgba(42,90,140,.04);border-radius:8px;padding:.6rem .8rem;text-align:center">
        <div style="font-size:.62rem;color:rgba(74,46,26,.5);font-weight:600;text-transform:uppercase;letter-spacing:.08em">CCL</div>
        <div style="font-size:1.2rem;font-weight:700;color:#2A5A8C">$${EC_DOLAR.ccl.toLocaleString('es-AR')}</div>
      </div>
    </div>
    <div style="font-size:.68rem;color:rgba(74,46,26,.4);text-align:center">
      Fuente: DolarAPI · Actualizado: ${ts}
    </div>`;
}

function ecActualizarCultivo() {
  const cult = gv('ec-cultivo') || 'Soja';
  const costos = EC_COSTOS_BASE[cult] || EC_COSTOS_BASE.Soja;
  const info   = EC_COSECHA_INFO[cult] || EC_COSECHA_INFO.Soja;
  const rend   = EC_REND_BASE[cult] || 3.2;

  // Cargar costos por defecto
  if ($('ec-semilla'))   $('ec-semilla').value   = costos.semilla;
  if ($('ec-fertil'))    $('ec-fertil').value     = costos.fertil;
  if ($('ec-agroquim'))  $('ec-agroquim').value   = costos.agroquim;
  if ($('ec-siembra'))   $('ec-siembra').value    = costos.siembra;
  if ($('ec-cosecha'))   $('ec-cosecha').value    = costos.cosecha;
  if ($('ec-otros'))     $('ec-otros').value      = costos.otros;
  if ($('ec-rend'))      $('ec-rend').value       = rend;
  if ($('ec-rend-fut'))  $('ec-rend-fut').value   = rend;

  // Actualizar etiqueta futuro
  if ($('ec-futuro-label')) $('ec-futuro-label').textContent = ` — ${info.mes} 2026`;

  // Precio futuro estimado con spread histórico
  const precioDisp = parseFloat($('ec-precio-disp')?.value) || 290;
  if ($('ec-precio-fut')) $('ec-precio-fut').value = Math.max(100, precioDisp + info.spreadHist);

  ecCalc();
}

function ecCalc() {
  const cult     = gv('ec-cultivo') || 'Soja';
  const sup      = gi('ec-sup')     || 100;
  const rendDisp = gi('ec-rend')    || 3.2;
  const rendFut  = gi('ec-rend-fut')|| 3.2;
  const pDisp    = gi('ec-precio-disp') || 290;  // USD/t disponible
  const pFut     = gi('ec-precio-fut')  || 280;  // USD/t futuro
  const info     = EC_COSECHA_INFO[cult] || EC_COSECHA_INFO.Soja;

  // Precio en USD/qq
  const qqFactor  = ecToneladasAqq(cult);
  const pDispQQ   = pDisp / qqFactor;
  const pFutQQ    = pFut  / qqFactor;
  if ($('ec-precio-qq')) $('ec-precio-qq').value = pDispQQ.toFixed(2);
  const spread = pFut - pDisp;
  if ($('ec-spread')) {
    $('ec-spread').value = (spread >= 0 ? '+' : '') + spread.toFixed(0);
    $('ec-spread').style.color = spread >= 0 ? 'var(--ok)' : 'var(--warn)';
  }

  // Costos directos
  const costoDir = gi('ec-semilla') + gi('ec-fertil') + gi('ec-agroquim') +
                   gi('ec-siembra') + gi('ec-cosecha') + gi('ec-otros');

  // Flete (USD/t * rendimiento * km/100)
  const km       = gi('ec-km')        || 30;
  const flTar    = gi('ec-flete-tar') || 8.5;
  const fleteDisp = rendDisp * (flTar * km / 100);
  const fleteFut  = rendFut  * (flTar * km / 100);

  // Comisión sobre ingreso bruto
  const comision  = gi('ec-comision') / 100;
  const secado    = gi('ec-secado');

  // Arrendamiento
  const tenencia = gv('ec-tenencia') || 'propia';
  let arrUSD_Disp = 0, arrUSD_Fut = 0;
  if (tenencia === 'arriendo') {
    const arrQQ     = gi('ec-arriendo-qq') || 10;
    arrUSD_Disp     = arrQQ * pDispQQ;
    arrUSD_Fut      = arrQQ * pFutQQ;
  }
  $('ec-arriendo-box').style.display = tenencia === 'arriendo' ? '' : 'none';

  // INGRESO BRUTO (USD/ha)
  const ingBrutDisp = rendDisp * pDisp;
  const ingBrutFut  = rendFut  * pFut;

  // Gastos de comercialización
  const gasComDisp = ingBrutDisp * comision + fleteDisp + secado;
  const gasComFut  = ingBrutFut  * comision + fleteFut  + secado;

  // COSTO TOTAL
  const costoTotalDisp = costoDir + gasComDisp + arrUSD_Disp;
  const costoTotalFut  = costoDir + gasComFut  + arrUSD_Fut;

  // MARGEN BRUTO (USD/ha)
  const margenDisp = ingBrutDisp - costoTotalDisp;
  const margenFut  = ingBrutFut  - costoTotalFut;

  // MARGEN EN QQ/ha (a precio disponible)
  const margenQQDisp = margenDisp / pDispQQ;
  const margenQQFut  = margenFut  / pFutQQ;

  // Punto de equilibrio (t/ha necesarias para cubrir costos)
  const peDisp = costoTotalDisp / pDisp;
  const peFut  = costoTotalFut  / pFut;

  // Rentabilidad sobre costos
  const rentDisp = margenDisp / costoTotalDisp * 100;
  const rentFut  = margenFut  / costoTotalFut  * 100;

  // Ingreso total lote
  const ingTotalDisp = margenDisp * sup;
  const ingTotalFut  = margenFut  * sup;

  // ── Render resultados ──
  $('ec-r-precio-disp').textContent = `USD ${pDisp}/t`;
  $('ec-r-precio-fut').textContent  = `USD ${pFut}/t`;
  $('ec-r-ing-disp').textContent    = `USD ${ingBrutDisp.toFixed(0)}/ha`;
  $('ec-r-ing-fut').textContent     = `USD ${ingBrutFut.toFixed(0)}/ha`;
  $('ec-r-futuro-mes').textContent  = `Futuro ${info.mes} · ${info.contrato}`;

  // Tabla comparativa
  const fmtUSD = v => v < 0 ? `<span style="color:var(--warn)">(${Math.abs(v).toFixed(0)})</span>` : v.toFixed(0);
  $('ec-tabla-body').innerHTML = `
    <tr><td>Ingreso bruto</td><td class="mn">${ingBrutDisp.toFixed(0)}</td><td class="mn">${ingBrutFut.toFixed(0)}</td></tr>
    <tr><td style="padding-left:1.2rem;color:rgba(74,46,26,.6)">— Costos directos</td><td class="mn">(${costoDir.toFixed(0)})</td><td class="mn">(${costoDir.toFixed(0)})</td></tr>
    <tr><td style="padding-left:1.2rem;color:rgba(74,46,26,.6)">— Comercialización</td><td class="mn">(${gasComDisp.toFixed(0)})</td><td class="mn">(${gasComFut.toFixed(0)})</td></tr>
    ${tenencia==='arriendo'?`<tr><td style="padding-left:1.2rem;color:rgba(74,46,26,.6)">— Arrendamiento</td><td class="mn">(${arrUSD_Disp.toFixed(0)})</td><td class="mn">(${arrUSD_Fut.toFixed(0)})</td></tr>`:''}
    <tr class="hl"><td><strong>Margen bruto (USD/ha)</strong></td>
      <td class="mn"><strong style="color:${margenDisp>=0?'var(--ok)':'var(--warn)'};font-size:1rem">${fmtUSD(margenDisp)}</strong></td>
      <td class="mn"><strong style="color:${margenFut>=0?'var(--ok)':'var(--warn)'};font-size:1rem">${fmtUSD(margenFut)}</strong></td>
    </tr>
    <tr><td><strong>Margen (qq/ha)</strong></td>
      <td class="mn"><strong>${margenQQDisp.toFixed(1)} qq</strong></td>
      <td class="mn"><strong>${margenQQFut.toFixed(1)} qq</strong></td>
    </tr>
    <tr><td>Rentabilidad sobre costos</td>
      <td class="mn" style="color:${rentDisp>=0?'var(--ok)':'var(--warn)'}">${rentDisp.toFixed(1)}%</td>
      <td class="mn" style="color:${rentFut>=0?'var(--ok)':'var(--warn)'}">${rentFut.toFixed(1)}%</td>
    </tr>
    <tr><td>Ingreso neto total (${sup} ha)</td>
      <td class="mn" style="font-weight:600">USD ${(ingTotalDisp/1000).toFixed(1)}k</td>
      <td class="mn" style="font-weight:600">USD ${(ingTotalFut/1000).toFixed(1)}k</td>
    </tr>`;

  // KPIs principales
  const colorM = v => v >= 0 ? '' : 'warn';
  $('ec-kpis').innerHTML = `
    <div class="kc ${colorM(margenDisp)}">
      <div class="kl">Margen hoy</div>
      <div class="kv">${margenDisp.toFixed(0)}</div>
      <div class="ku">USD/ha</div>
    </div>
    <div class="kc ${colorM(margenFut)}">
      <div class="kl">Margen cosecha</div>
      <div class="kv">${margenFut.toFixed(0)}</div>
      <div class="ku">USD/ha</div>
    </div>
    <div class="kc neutral">
      <div class="kl">P. equilibrio</div>
      <div class="kv">${peDisp.toFixed(2)}</div>
      <div class="ku">t/ha · hoy</div>
    </div>
    <div class="kc neutral">
      <div class="kl">Margen lote</div>
      <div class="kv">${(ingTotalDisp/1000).toFixed(1)}k</div>
      <div class="ku">USD total (${sup} ha)</div>
    </div>`;

  // Relación insumo/producto (qq de grano para pagar 1 t de urea)
  const precioUrea = 520; // USD/t urea · referencia campaña 2025/26
  const relUreaDisp = precioUrea / (pDisp / 10); // qq de cultivo por t de urea
  const relUreaFut  = precioUrea / (pFut  / 10);
  $('ec-relaciones').innerHTML = `
    <div style="background:rgba(74,46,26,.04);border-radius:8px;padding:.75rem;border:1px solid var(--border)">
      <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--earth);margin-bottom:.5rem">
        ⚖️ Relación insumo/producto — Urea (ref. USD ${precioUrea}/t)
      </div>
      <div style="display:flex;gap:1.5rem;font-size:.82rem;flex-wrap:wrap">
        <span>Precio hoy: <strong>${relUreaDisp.toFixed(1)} qq ${cult}/t Urea</strong> ${relUreaDisp>25?'⚠️ desfavorable':relUreaDisp<18?'✅ muy favorable':'✅ normal'}</span>
        <span>A cosecha: <strong>${relUreaFut.toFixed(1)} qq ${cult}/t Urea</strong> ${relUreaFut>25?'⚠️ desfavorable':relUreaFut<18?'✅ muy favorable':'✅ normal'}</span>
      </div>
    </div>`;

  // Punto de equilibrio semáforo
  const peOk = rendDisp >= peDisp * 1.1;
  const peMar = rendDisp >= peDisp;
  $('ec-breakeven').innerHTML = `
    <div class="alert ${peOk?'ok':peMar?'warn':'danger'}">
      <span class="ai">${peOk?'✅':peMar?'⚠️':'🚫'}</span>
      <div class="ac">
        <strong>Punto de equilibrio: ${peDisp.toFixed(2)} t/ha</strong>
        (precio disponible) · ${peFut.toFixed(2)} t/ha a cosecha<br>
        ${peOk?`Tu rendimiento esperado de ${rendDisp} t/ha está <strong>${((rendDisp/peDisp-1)*100).toFixed(0)}% por encima</strong> del punto de equilibrio — margen positivo asegurado.`
              :peMar?`Tu rendimiento esperado apenas supera el punto de equilibrio. Margen ajustado — monitorear condiciones del lote.`
                    :`Con rendimiento de ${rendDisp} t/ha, el lote <strong>no cubre los costos</strong> a precio disponible. Revisar insumos o escenario de precios.`}
      </div>
    </div>`;

  $('ec-res-placeholder').classList.add('hidden');
  $('ec-res').classList.remove('hidden');
}
