// AGROMOTOR — maquinaria.js
// Productividad · Autonomía tolvas · Jornada · ROI · Crucianelli

function calcMaq(){
  const a=gi('m-ancho'),v=gi('m-vel'),ef=+gv('m-efic')||.85;
  const hs=gi('m-hs'),tr=gi('m-rec'),pe=gi('m-precio'),mg=gi('m-margen');
  TC.forEach((t,i)=>{const e=$(`md-${i}`);if(e)t.dosis=+e.value||0});
  const cT=(a*v*ef)/10;
  let hpc=[],ti=[];
  for(const t of TC){
    if(t.prod==='Vacío'||!t.dosis){ti.push({...t,ha:Infinity});continue}
    const d=DB.prods[t.prod];if(d==null){ti.push({...t,ha:Infinity});continue}
    const ve=t.v*(t.pct/100),kg=ve*d,ha=kg/t.dosis;
    hpc.push(ha);ti.push({...t,ha,ve,kg});
  }
  const hl=hpc.length?Math.min(...hpc):Infinity;
  let hd=0,rc=0;
  if(hl<Infinity){
    const hpc2=hl/cT,hr=tr/60;let td=hs,ha=0,r=0;
    while(td>0){const tf=Math.min(hpc2,td);ha+=tf*cT;td-=tf;if(td>hr){td-=hr;r++}else break}
    hd=ha;rc=r;
  }else hd=cT*hs;
  const hp=rc*(tr/60),cr=hd/hs;
  $('m-ph').classList.add('hidden');$('m-res').classList.remove('hidden');
  $('m-kpis').innerHTML=`
    <div class="kc"><div class="kl">Ha/jornada</div><div class="kv">${hd.toFixed(1)}</div></div>
    <div class="kc"><div class="kl">Cap. teórica</div><div class="kv">${cT.toFixed(2)}</div><div class="ku">ha/h</div></div>
    <div class="kc ${rc>3?'warn':''}"><div class="kl">Recargas</div><div class="kv">${rc}</div><div class="ku">${hp.toFixed(1)}h perdidas</div></div>`;
  $('m-aut').innerHTML=ti.map(t=>{
    if(t.prod==='Vacío'||!t.dosis)return'';
    const lim=t.ha===hl;
    return`<div style="margin-bottom:.75rem;padding:.75rem;border-radius:8px;border:1px solid ${lim?'rgba(184,122,32,.4)':'var(--border)'};background:${lim?'rgba(184,122,32,.05)':'transparent'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem">
        <div style="font-weight:600;font-size:.84rem">${t.n} → ${t.prod}</div>
        ${lim?'<span style="font-size:.66rem;background:rgba(184,122,32,.15);color:#7A4A10;padding:.18rem .55rem;border-radius:10px;font-weight:700">TOLVA LIMITANTE</span>':''}
      </div>
      <div style="display:flex;gap:1.2rem;font-size:.79rem;color:rgba(74,46,26,.6)">
        <span>Vol: <b style="font-family:'DM Mono',monospace">${t.ve?.toFixed(0)||'—'} L</b></span>
        <span>Kg: <b style="font-family:'DM Mono',monospace">${t.kg?.toFixed(0)||'—'} kg</b></span>
        <span>Aut.: <b style="font-family:'DM Mono',monospace;color:var(--canopy)">${t.ha===Infinity?'∞':t.ha.toFixed(1)+' ha'}</b></span>
      </div></div>`;
  }).join('');
  $('m-jorn').innerHTML=`<table class="dt"><tbody>
    <tr><td>Horas de jornada</td><td class="mn">${hs} h</td></tr>
    <tr><td>Horas efectivas</td><td class="mn">${(hs-hp).toFixed(1)} h</td></tr>
    <tr><td>Horas en recargas</td><td class="mn">${hp.toFixed(1)} h (${rc} × ${tr} min)</td></tr>
    <tr><td>Productividad real</td><td class="mn">${cr.toFixed(2)} ha/h</td></tr>
    <tr class="hl"><td>Ha por jornada</td><td class="mn">${hd.toFixed(1)} ha</td></tr>
    </tbody></table>`;
  if(pe>0&&mg>0){
    const hpb=pe/mg,jpb=Math.ceil(hpb/hd);
    $('m-roi').classList.remove('hidden');
    $('m-roi-c').innerHTML=`<div class="rg">
      <div class="kc neutral"><div class="kl">Ha para payback</div><div class="kv">${hpb.toFixed(0)}</div><div class="ku">hectáreas</div></div>
      <div class="kc neutral"><div class="kl">Jornadas payback</div><div class="kv">${jpb}</div><div class="ku">días de trabajo</div></div>
    </div>`;
  }
}

// ════════════════════════════════════════════════════════
// NASA POWER — CONTEXTO CLIMÁTICO HISTÓRICO
// Comunidad: AG (Agriculture) · 30 años de datos ERA5
// URL: https://power.larc.nasa.gov/api/temporal/climatology/point
// ════════════════════════════════════════════════════════
