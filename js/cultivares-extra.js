// ════════════════════════════════════════════════════════
// AGROMOTOR — cultivares-extra.js
// Comparador lado a lado · Stress test hídrico
// GDD y floración estimada · Densidad de siembra
// ════════════════════════════════════════════════════════

let CV_COMP_SELECCIONADOS = [];

function cvAgregarComparador(nombre) {
  const cultivo = gv('cv-cultivo') || 'Soja';
  const c = CV_DB[cultivo]?.find(x => x.nombre === nombre);
  if (!c) return;
  const idx = CV_COMP_SELECCIONADOS.findIndex(x => x.nombre === nombre);
  if (idx >= 0) {
    CV_COMP_SELECCIONADOS.splice(idx, 1);
    const btn = $(`btn-comp-${nombre.replace(/\s/g,'_')}`);
    if (btn) { btn.style.background='rgba(42,90,140,.1)'; btn.style.color='#2A5A8C'; btn.textContent='⚖️ Comparar'; }
  } else {
    if (CV_COMP_SELECCIONADOS.length >= 2) {
      const viejo = CV_COMP_SELECCIONADOS.shift();
      const bv = $(`btn-comp-${viejo.nombre.replace(/\s/g,'_')}`);
      if (bv) { bv.style.background='rgba(42,90,140,.1)'; bv.style.color='#2A5A8C'; bv.textContent='⚖️ Comparar'; }
    }
    CV_COMP_SELECCIONADOS.push(c);
    const btn = $(`btn-comp-${nombre.replace(/\s/g,'_')}`);
    if (btn) { btn.style.background='rgba(42,90,140,.85)'; btn.style.color='white'; btn.textContent='✓ Seleccionado'; }
  }
  if (CV_COMP_SELECCIONADOS.length === 2) {
    cvRenderComparador();
  } else {
    $('cv-comp-card').classList.remove('hidden');
    $('cv-comp-content').innerHTML = `<div style="text-align:center;padding:1.5rem;color:rgba(74,46,26,.5);font-size:.85rem">⚖️ Seleccionaste <strong>${CV_COMP_SELECCIONADOS.length}/2</strong> cultivares. Tocá "Comparar" en otro del ranking.</div>`;
    $('cv-comp-card').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
}

function cvCerrarComparador() {
  CV_COMP_SELECCIONADOS = [];
  $('cv-comp-card').classList.add('hidden');
  document.querySelectorAll('[id^="btn-comp-"]').forEach(btn => {
    btn.style.background='rgba(42,90,140,.1)'; btn.style.color='#2A5A8C'; btn.textContent='⚖️ Comparar';
  });
}

function cvRenderComparador() {
  const [a, b] = CV_COMP_SELECCIONADOS;
  if (!a || !b) return;
  const estLabel = {'A':'🟢 Alta','B':'🟡 Media','C':'🔴 Baja'};
  const sanStars = n => '★'.repeat(n)+'☆'.repeat(5-n);
  const mejor = (va, vb) => va > vb ? ['mejor','peor'] : va < vb ? ['peor','mejor'] : ['neutral','neutral'];
  const colorComp = t => t==='mejor' ? 'background:rgba(42,122,74,.1);color:var(--ok);font-weight:700' : t==='peor' ? 'background:rgba(201,74,42,.06);color:rgba(74,46,26,.4)' : '';
  const [cAr,cBr] = mejor(a.rend, b.rend);
  const [cAs,cBs] = mejor(a.san, b.san);
  const [cAc,cBc] = mejor(a.camp, b.camp);
  const estN = e => e==='A'?3:e==='B'?2:1;
  const [cAe,cBe] = mejor(estN(a.est), estN(b.est));
  const fila = (label,vA,vB,cA,cB) => `<tr><td style="padding:.6rem .8rem;font-size:.78rem;color:rgba(74,46,26,.6)">${label}</td><td style="padding:.6rem .8rem;font-size:.82rem;text-align:center;${colorComp(cA)}">${vA}</td><td style="padding:.6rem .8rem;font-size:.82rem;text-align:center;${colorComp(cB)}">${vB}</td></tr>`;
  const zonasC = a.zonas.filter(z=>b.zonas.includes(z)).map(z=>CV_ZONAS[z]?.label||z);
  const sA = a.zonas.filter(z=>!b.zonas.includes(z)).map(z=>CV_ZONAS[z]?.label||z);
  const sB = b.zonas.filter(z=>!a.zonas.includes(z)).map(z=>CV_ZONAS[z]?.label||z);
  const pts = (cAr==='mejor'?1:0)+(cAs==='mejor'?1:0)+(cAc==='mejor'?1:0)+(cAe==='mejor'?1:0);
  const veredicto = pts>=3 ? `<strong>${a.nombre}</strong> tiene ventaja general.` : pts<=1 ? `<strong>${b.nombre}</strong> tiene ventaja general.` : 'Ambos equivalentes — la elección depende de la prioridad del lote.';

  $('cv-comp-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.8rem;align-items:end">
      <div></div>
      <div style="background:linear-gradient(135deg,var(--canopy),var(--leaf));border-radius:10px;padding:.8rem;text-align:center;color:white">
        <div style="font-size:.6rem;opacity:.7;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.2rem">A</div>
        <div style="font-weight:700;font-size:.85rem">${a.nombre}</div>
        <div style="font-size:.7rem;opacity:.7">${a.empresa}</div>
      </div>
      <div style="background:linear-gradient(135deg,#1A3A6C,#2A5A8C);border-radius:10px;padding:.8rem;text-align:center;color:white">
        <div style="font-size:.6rem;opacity:.7;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.2rem">B</div>
        <div style="font-weight:700;font-size:.85rem">${b.nombre}</div>
        <div style="font-size:.7rem;opacity:.7">${b.empresa}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:rgba(74,46,26,.05)">
        <th style="padding:.5rem .8rem;font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(74,46,26,.5);text-align:left">Indicador</th>
        <th style="padding:.5rem .8rem;font-size:.65rem;color:var(--canopy);text-align:center">${a.nombre.split(' ').slice(0,2).join(' ')}</th>
        <th style="padding:.5rem .8rem;font-size:.65rem;color:#2A5A8C;text-align:center">${b.nombre.split(' ').slice(0,2).join(' ')}</th>
      </tr></thead>
      <tbody>
        ${fila('GM / Tecnología', `${a.gm} · ${a.tec}`, `${b.gm} · ${b.tec}`, 'neutral','neutral')}
        ${fila('Rendimiento relativo', `${a.rend}%`, `${b.rend}%`, cAr, cBr)}
        ${fila('Estabilidad', estLabel[a.est]||a.est, estLabel[b.est]||b.est, cAe, cBe)}
        ${fila('Sanidad foliar', sanStars(a.san), sanStars(b.san), cAs, cBs)}
        ${fila('Campañas de datos', `${a.camp} camp.`, `${b.camp} camp.`, cAc, cBc)}
        ${fila('Precocidad', a.precoz?'⚡ Precoz':'Normal', b.precoz?'⚡ Precoz':'Normal', 'neutral','neutral')}
      </tbody>
    </table>
    ${zonasC.length ? `<div style="margin-top:.7rem;font-size:.74rem;color:rgba(74,46,26,.6);padding:.5rem .8rem;background:rgba(74,46,26,.03);border-radius:8px">✅ Zonas en común: ${zonasC.join(', ')}${sA.length?`<br>🟢 Solo ${a.nombre.split(' ')[0]}: ${sA.join(', ')}`:''}${sB.length?`<br>🔵 Solo ${b.nombre.split(' ')[0]}: ${sB.join(', ')}`:''}
    </div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-top:.7rem">
      <div style="background:rgba(42,122,74,.06);border-radius:8px;padding:.7rem;border-left:3px solid var(--canopy)">
        <div style="font-size:.68rem;font-weight:700;color:var(--canopy);margin-bottom:.3rem">${a.nombre}</div>
        <div style="font-size:.73rem;color:rgba(74,46,26,.65);line-height:1.4;font-style:italic">${a.nota}</div>
      </div>
      <div style="background:rgba(42,90,140,.06);border-radius:8px;padding:.7rem;border-left:3px solid #2A5A8C">
        <div style="font-size:.68rem;font-weight:700;color:#2A5A8C;margin-bottom:.3rem">${b.nombre}</div>
        <div style="font-size:.73rem;color:rgba(74,46,26,.65);line-height:1.4;font-style:italic">${b.nota}</div>
      </div>
    </div>
    <div class="alert info" style="margin-top:.8rem"><span class="ai">⚖️</span><div class="ac"><strong>Veredicto:</strong> ${veredicto}</div></div>`;

  $('cv-comp-card').classList.remove('hidden');
  setTimeout(()=>$('cv-comp-card').scrollIntoView({behavior:'smooth',block:'nearest'}),150);
}

// ════════════════════════════════════════════════════════
// STRESS TEST HÍDRICO — Percentil 20 vs Promedio
// ════════════════════════════════════════════════════════
function bhStressTest() {
  const cultivo = gv('bh-cultivo')||'Soja';
  const rendObj = gi('bh-rend-obj')||3.5;
  const aguaPerf = gi('bh-agua-perfil')||120;
  const precipHist = gi('bh-precip-hist')||580;
  const c = BH_CULTIVOS[cultivo]||BH_CULTIVOS.Soja;
  const etcObj = Math.max(c.etcMin,Math.min(c.etcMax,c.mmPorTon*rendObj));
  const scenarios = [
    {label:'Extremo seco',pct:20,factor:.65,color:'#C94A2A',icon:'🔴'},
    {label:'Año seco',    pct:35,factor:.80,color:'#B87A20',icon:'🟡'},
    {label:'Promedio',   pct:50,factor:1.0, color:'#2A5A8C',icon:'🔵'},
    {label:'Año húmedo', pct:65,factor:1.18,color:'#2A7A4A',icon:'🟢'},
    {label:'Muy húmedo', pct:80,factor:1.35,color:'#1A5A3A',icon:'💧'},
  ];
  const rows = scenarios.map(sc => {
    const prec = Math.round(precipHist*sc.factor);
    const aguaTot = aguaPerf+prec*.75;
    const eta = Math.min(aguaTot,etcObj);
    const rend = Math.max(0,rendObj*(1-c.ky*Math.max(0,1-eta/etcObj)));
    const bw = Math.min(100,(rend/rendObj)*100).toFixed(0);
    const cob = Math.min(100,(aguaTot/etcObj*100)).toFixed(0);
    return `<tr style="border-bottom:1px solid rgba(74,46,26,.07)">
      <td style="padding:.7rem .8rem"><div style="font-weight:600;font-size:.82rem">${sc.icon} ${sc.label}</div><div style="font-size:.68rem;color:rgba(74,46,26,.45)">Percentil ${sc.pct}</div></td>
      <td style="padding:.7rem .8rem;text-align:center;font-family:'DM Mono',monospace">${prec} mm</td>
      <td style="padding:.7rem .8rem;text-align:center">${cob}%</td>
      <td style="padding:.7rem .8rem;min-width:120px">
        <div style="display:flex;align-items:center;gap:.5rem">
          <div style="flex:1;height:8px;background:rgba(74,46,26,.08);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${bw}%;background:${sc.color};border-radius:4px"></div>
          </div>
          <span style="font-family:'DM Mono',monospace;font-size:.85rem;font-weight:700;color:${sc.color};min-width:40px">${rend.toFixed(2)}</span>
        </div>
        <div style="font-size:.65rem;color:rgba(74,46,26,.4);margin-top:.1rem">${(rend/rendObj*100).toFixed(0)}% del obj.</div>
      </td>
    </tr>`;
  }).join('');

  const stressEl = $('bh-stress');
  if (!stressEl) return;
  stressEl.innerHTML = `
    <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--earth);margin-bottom:.6rem">🧪 Stress Test — ${cultivo} · Objetivo ${rendObj} t/ha</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:rgba(74,46,26,.05)">
        <th style="padding:.5rem .8rem;font-size:.65rem;text-transform:uppercase;color:rgba(74,46,26,.5);text-align:left">Escenario</th>
        <th style="padding:.5rem .8rem;font-size:.65rem;text-transform:uppercase;color:rgba(74,46,26,.5);text-align:center">Precip.</th>
        <th style="padding:.5rem .8rem;font-size:.65rem;text-transform:uppercase;color:rgba(74,46,26,.5);text-align:center">Cobertura</th>
        <th style="padding:.5rem .8rem;font-size:.65rem;text-transform:uppercase;color:rgba(74,46,26,.5);text-align:left">Rend. (t/ha)</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div style="margin-top:.5rem;font-size:.7rem;color:rgba(74,46,26,.4);padding:.4rem .7rem;background:rgba(74,46,26,.03);border-radius:6px">
      Percentiles históricos NASA POWER 30 años · FAO Ky=${c.ky} · Agua útil perfil: ${aguaPerf} mm
    </div>`;
  stressEl.classList.remove('hidden');
  stressEl.scrollIntoView({behavior:'smooth',block:'nearest'});
}

// ════════════════════════════════════════════════════════
// GDD Y FECHA DE FLORACIÓN ESTIMADA
// ════════════════════════════════════════════════════════
const GDD_CULTIVOS_FL = {
  Soja:    {base:10, gddFlor:850,  gddMad:1700, label:'IV largo (ref.)'},
  Maíz:    {base: 8, gddFlor:950,  gddMad:1500, label:'Intermedio (ref.)'},
  Trigo:   {base: 0, gddFlor:900,  gddMad:1500, label:'—'},
  Girasol: {base: 6, gddFlor:700,  gddMad:1200, label:'—'},
  Sorgo:   {base:10, gddFlor:800,  gddMad:1400, label:'—'},
};
// GDD mensual histórico pampa base 10°C (NASA POWER 1991-2020)
const GDD_MES_B10 = [310,270,210,115,55,18,20,40,85,165,235,295];
const GDD_MES_B8  = [340,300,240,145,75,32,35,58,108,190,262,322];
const GDD_MES_B0  = [527,490,430,345,265,205,200,225,295,390,465,518];

function bhCalcularGDD() {
  const cultivo  = gv('bh-cultivo')||'Soja';
  const fechaStr = gv('bh-fecha')||new Date().toISOString().split('T')[0];
  const cfg = GDD_CULTIVOS_FL[cultivo]; if(!cfg) return;
  const fechaSiem = new Date(fechaStr);
  const mesIni = fechaSiem.getMonth();
  const diaIni = fechaSiem.getDate();
  const tab = cfg.base>=10?GDD_MES_B10:cfg.base>=8?GDD_MES_B8:GDD_MES_B0;
  let gddAcum=0, mesAct=mesIni, diasAcum=0;
  while(gddAcum<cfg.gddFlor && diasAcum<365){
    const dm = new Date(fechaSiem.getFullYear(),mesAct+1,0).getDate();
    const frac = mesAct===mesIni?(dm-diaIni+1)/dm:1;
    gddAcum += tab[mesAct%12]*frac;
    diasAcum += Math.round(dm*frac);
    if(gddAcum<cfg.gddFlor) mesAct++;
  }
  const fechaFlor = new Date(fechaSiem);
  fechaFlor.setDate(fechaFlor.getDate()+diasAcum);
  const mesFlor = fechaFlor.getMonth();
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const riesgoCalor  = [0,1,11].includes(mesFlor);
  const riesgoHelada = [5,6,7].includes(mesFlor);

  const gddEl = $('bh-gdd'); if(!gddEl) return;
  gddEl.innerHTML = `
    <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--earth);margin-bottom:.6rem">📅 Floración estimada — ${cultivo} (GDD base ${cfg.base}°C · ${cfg.label})</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem;margin-bottom:.8rem">
      <div style="background:linear-gradient(145deg,#0E2016,#173325);border-radius:12px;padding:.9rem;color:white;border:1px solid rgba(109,191,130,.12)">
        <div style="font-size:.6rem;opacity:.6;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.3rem">Siembra</div>
        <div style="font-size:.95rem;font-weight:700">${fechaSiem.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}</div>
      </div>
      <div style="background:linear-gradient(145deg,#1A2A0A,#2A4A15);border-radius:12px;padding:.9rem;color:white;border:1px solid rgba(200,162,85,.2)">
        <div style="font-size:.6rem;opacity:.6;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.3rem">Floración estimada</div>
        <div style="font-size:.95rem;font-weight:700;color:var(--amber)">${fechaFlor.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}</div>
        <div style="font-size:.68rem;opacity:.5">${diasAcum} días · ${cfg.gddFlor} GDD</div>
      </div>
      <div style="background:linear-gradient(145deg,#0A1A2A,#122A4A);border-radius:12px;padding:.9rem;color:white;border:1px solid rgba(74,138,196,.15)">
        <div style="font-size:.6rem;opacity:.6;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.3rem">Mes de floración</div>
        <div style="font-size:.95rem;font-weight:700;color:#7AAEF5">${meses[mesFlor]}</div>
      </div>
    </div>
    ${riesgoCalor?`<div class="alert danger"><span class="ai">🌡️</span><div class="ac"><strong>Riesgo de estrés térmico en floración</strong> — ${meses[mesFlor]} tiene alta frecuencia histórica de días con T°>35°C. El estrés térmico en floración puede reducir fijación de granos 30-60%. Considerá anticipar la siembra.</div></div>`:''}
    ${riesgoHelada?`<div class="alert warn"><span class="ai">❄️</span><div class="ac"><strong>Posible exposición a heladas</strong> — floración en ${meses[mesFlor]} tiene riesgo de heladas en zonas del sur pampeano. Verificar histórico local.</div></div>`:''}
    ${!riesgoCalor&&!riesgoHelada?`<div class="alert ok"><span class="ai">✅</span><div class="ac"><strong>Ventana de floración favorable</strong> — ${meses[mesFlor]} se ubica fuera de los períodos históricos de mayor estrés térmico y heladas en la región pampeana.</div></div>`:''}
    <div style="margin-top:.5rem;font-size:.7rem;color:rgba(74,46,26,.4);padding:.4rem .7rem;background:rgba(74,46,26,.03);border-radius:6px">GDD calculados con promedios NASA POWER 1991-2020 · Zona pampeana núcleo · Para ajuste preciso usar estación meteorológica local</div>`;
  gddEl.classList.remove('hidden');
  gddEl.scrollIntoView({behavior:'smooth',block:'nearest'});
}

// Demo funcional con localStorage (sin backend)
// En producción: reemplazar con Supabase/Firebase Auth
// ════════════════════════════════════════════════════════

// ── PLANES ───────────────────────────────────────────