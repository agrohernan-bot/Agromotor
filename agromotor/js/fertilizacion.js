// AGROMOTOR — fertilizacion.js
// Calculadora NPK · Fertilizantes comerciales · Costos USD

// ── FERTILIZACIÓN ──
function updRend(){
  const c=gv('f-cult'),r=DB.rendR[c];
  const sl=$('f-rend');sl.min=r[0];sl.max=r[1];sl.value=((r[0]+r[1])/2).toFixed(1);sv('sv-rend',sl.value+' t/ha');
}
function calcFert(){
  const cult=gv('f-cult'),rend=+gv('f-rend'),sup=gi('f-sup')||1;
  const nS=gi('f-n'),pS=gi('f-p'),kS=gi('f-k');
  const pr={'Urea':gi('f-p-u')||550,'MAP (Fosfato Monoamónico)':gi('f-p-m')||700,'DAP (Fosfato Diamónico)':gi('f-p-d')||750,'KCl (Cloruro de Potasio)':gi('f-p-k')||600};
  const req=DB.npk[cult];
  const nD=Math.max(0,req.N*rend-nS),pD=Math.max(0,req.P*rend-pS),kD=Math.max(0,req.K*rend-kS);
  let cant={},nC=0;
  if(pD>0){const k=Math.min(500,pD/(DB.ferts['MAP (Fosfato Monoamónico)'].P/100));cant['MAP (Fosfato Monoamónico)']=k;nC+=k*(DB.ferts['MAP (Fosfato Monoamónico)'].N/100)}
  if(kD>0)cant['KCl (Cloruro de Potasio)']=Math.min(300,kD/(DB.ferts['KCl (Cloruro de Potasio)'].K/100));
  const nR=Math.max(0,nD-nC);
  if(nR>0&&cult!=='Soja')cant['Urea']=Math.min(500,nR/(DB.ferts['Urea'].N/100));
  let cTot=0,fil='';
  for(const[f,k] of Object.entries(cant)){const c=(k/1000)*(pr[f]||500);cTot+=c;fil+=`<div class="fr"><div class="fn">🧪 ${f}</div><div class="fk">${k.toFixed(1)} kg/ha</div><div style="font-family:'DM Mono',monospace;font-size:.77rem;color:rgba(74,46,26,.5);min-width:68px;text-align:right">${(k*sup).toFixed(0)} kg tot</div><div class="fc">USD ${c.toFixed(2)}/ha</div></div>`}
  if(!fil)fil='<div class="alert ok"><span class="ai">✅</span><div class="ac">El suelo cubre todos los nutrientes para el rendimiento objetivo. No se requiere fertilización adicional.</div></div>';
  const defH=`<table class="dt"><thead><tr><th>Nut.</th><th>Requerido</th><th>Suelo</th><th>Déficit</th><th>Estado</th></tr></thead><tbody>`+
    [['N',req.N*rend,nS,nD],['P',req.P*rend,pS,pD],['K',req.K*rend,kS,kD]].map(([n,t,s,d])=>
      `<tr><td><b>${n}</b></td><td class="mn">${t.toFixed(1)} kg/ha</td><td class="mn">${s} kg/ha</td><td class="mn">${d.toFixed(1)} kg/ha</td><td>${d>0?'<span class="sema r"><div class="sema-dot"></div>Déficit</span>':'<span class="sema v"><div class="sema-dot"></div>OK</span>'}</td></tr>`).join('')+'</tbody></table>';
  $('f-ph').classList.add('hidden');$('f-res').classList.remove('hidden');
  $('f-def').innerHTML=defH;$('f-ferts').innerHTML=fil;
  $('f-costos').innerHTML=`<div class="rg">
    <div class="kc"><div class="kl">Costo/ha</div><div class="kv">USD ${cTot.toFixed(0)}</div></div>
    <div class="kc neutral"><div class="kl">Campaña total</div><div class="kv">USD ${(cTot*sup/1000).toFixed(1)}k</div><div class="ku">${sup} ha</div></div>
    <div class="kc"><div class="kl">Rendimiento obj.</div><div class="kv">${rend}</div><div class="ku">t/ha · ${cult}</div></div>
  </div>`;
  $('f-alertas').innerHTML=cult==='Soja'?'<div class="alert info"><span class="ai">💡</span><div class="ac"><strong>Soja — Fijación biológica de N:</strong> Inoculación con Bradyrhizobium reemplaza la fertilización nitrogenada directa. El N indicado es referencial.</div></div>':'';
}

// ── MAQUINARIA ──
let TC=[];
function loadMaq(){
  const m=DB.maqs[gv('m-maq')];
  $('m-ancho').value=m.a;
  TC=m.t.map(t=>({...t,prod:'Soja',pct:100,dosis:80}));
  renderTC();
}
function renderTC(){
  $('m-tolvas').innerHTML=TC.map((t,i)=>`
    <div class="tr"><div class="trh"><span class="trn">📦 ${t.n}</span><span class="trv">${(t.v/1000).toFixed(1)} m³ · ${t.v.toLocaleString()} L</span></div>
    <div class="grid-3">
      <div class="fg" style="margin-bottom:0"><label>Producto</label>
        <select onchange="TC[${i}].prod=this.value;syncD(${i})">
          ${Object.keys(DB.dosis).map(p=>`<option value="${p}" ${p===t.prod?'selected':''}>${p}</option>`).join('')}
        </select></div>
      <div class="fg" style="margin-bottom:0"><label>Dosis (kg/ha)</label>
        <input type="number" id="md-${i}" value="${DB.dosis[t.prod]||80}" min="0" max="500" onchange="TC[${i}].dosis=+this.value||0"></div>
      <div class="fg" style="margin-bottom:0"><label>% llenado</label>
        <div class="sw"><input type="range" min="10" max="100" value="100" oninput="TC[${i}].pct=+this.value;sv('mp-${i}',this.value+'%')"><span class="sv" id="mp-${i}">100%</span></div></div>
    </div></div>`).join('');
  TC.forEach((t,i)=>t.dosis=DB.dosis[t.prod]||80);
}
function syncD(i){const e=$(`md-${i}`);if(e){e.value=DB.dosis[TC[i].prod]||80;TC[i].dosis=+e.value}}