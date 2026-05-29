// AGROMOTOR — fertilizacion.js
// Calculadora NPK · Fertilizantes comerciales · Costos USD

// ── FERTILIZACIÓN ──
(function() {
  window.AM = window.AM || {};
  window.AM.fertilizacion = {};

  function updRend(){
    const c=(gv('s-cultivo')||'Soja'),r=DB.rendR[c];
    if($('f-lbl-cult')) $('f-lbl-cult').textContent = c;
    const sl=$('f-rend');sl.min=r[0];sl.max=r[1];sl.value=((r[0]+r[1])/2).toFixed(1);sv('sv-rend',sl.value+' t/ha');
  }
  function calcFert(){
    const cult=(gv('s-cultivo')||'Soja'),rend=+gv('f-rend'),sup=gi('f-sup')||1;
    if($('f-lbl-cult')) $('f-lbl-cult').textContent = cult;
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

  // Exponer a global por retrocompatibilidad HTML
  window.updRend = updRend;
  window.calcFert = calcFert;

// ── MAQUINARIA ──
window.TC = window.TC || [];
let _maqTolvasPropias = [];

function maqStorageKey(){
  const uid=(typeof AM_SESION!=='undefined'&&AM_SESION&&AM_SESION.id)?AM_SESION.id:'local';
  return 'am_maquinaria_propias_v1_'+uid;
}
function maqAviso(msg,tipo='ok'){
  if(typeof amToast==='function')amToast(msg,tipo);
  else alert(msg);
}
function maqLeerPropias(){
  try{
    const raw=localStorage.getItem(maqStorageKey());
    const arr=raw?JSON.parse(raw):[];
    return Array.isArray(arr)?arr.filter(m=>m&&m.id&&m.nombre):[];
  }catch(_){return[]}
}
function maqGuardarPropiasLista(arr){
  localStorage.setItem(maqStorageKey(),JSON.stringify(arr));
}
function maqSyncPropias(){
  const sel=$('m-maq');
  if(!sel||!sel.options||!DB||!DB.maqs)return;
  const actual=sel.value;
  const propias=maqLeerPropias();
  for(let i=sel.options.length-1;i>=0;i--){
    if(sel.options[i].dataset.propia==='1')sel.remove(i);
  }
  propias.forEach(m=>{
    DB.maqs[m.id]={a:+m.a||9,t:(m.t||[]).map(t=>({n:t.n||'Tolva',v:+t.v||0})).filter(t=>t.v>0),f:m.f||'Máquina propia cargada por el usuario.'};
    const opt=document.createElement('option');
    opt.value=m.id;opt.textContent='Propia · '+m.nombre;opt.dataset.propia='1';
    sel.insertBefore(opt,sel.querySelector('option[value="custom"]'));
  });
  if(actual&&DB.maqs[actual])sel.value=actual;
}
function loadMaq(){
  maqSyncPropias();
  const m=DB.maqs[gv('m-maq')];
  if(!m)return;
  $('m-ancho').value=m.a;
  window.TC=m.t.map(t=>({...t,prod:'Soja',pct:100,dosis:80}));
  const ficha=$('m-ficha');
  if(ficha){
    ficha.innerHTML=`<span class="ai">ℹ️</span><div class="ac">${m.f||'Ficha técnica no disponible.'}</div>`;
  }
  renderTC();
}
function renderTC(){
  if(!window.TC.length){
    $('m-tolvas').innerHTML='<div class="alert info"><span class="ai">ℹ️</span><div class="ac">La fuente trae ficha técnica, pero no litros de tolva normalizados. La calculadora puede estimar capacidad teórica por ancho y velocidad; para autonomía por recarga usá Máquina personalizada o cargá las tolvas cuando tengas el dato.</div></div>';
    return;
  }
  $('m-tolvas').innerHTML=window.TC.map((t,i)=>`
    <div class="tr"><div class="trh"><span class="trn">📦 ${t.n}</span><span class="trv">${(t.v/1000).toFixed(1)} m³ · ${t.v.toLocaleString()} L</span></div>
    <div class="grid-3">
      <div class="fg" style="margin-bottom:0"><label>Producto</label>
        <select onchange="window.TC[${i}].prod=this.value;syncD(${i})">
          ${Object.keys(DB.dosis).map(p=>`<option value="${p}" ${p===t.prod?'selected':''}>${p}</option>`).join('')}
        </select></div>
      <div class="fg" style="margin-bottom:0"><label>Dosis (kg/ha)</label>
        <input type="number" id="md-${i}" value="${DB.dosis[t.prod]||80}" min="0" max="500" onchange="window.TC[${i}].dosis=+this.value||0"></div>
      <div class="fg" style="margin-bottom:0"><label>% llenado</label>
        <div class="sw"><input type="range" min="10" max="100" value="100" oninput="window.TC[${i}].pct=+this.value;sv('mp-${i}',this.value+'%')"><span class="sv" id="mp-${i}">100%</span></div></div>
    </div></div>`).join('');
  window.TC.forEach((t,i)=>t.dosis=DB.dosis[t.prod]||80);
}
function syncD(i){const e=$(`md-${i}`);if(e){e.value=DB.dosis[window.TC[i].prod]||80;window.TC[i].dosis=+e.value}}

function maqNuevaPropia(){
  _maqTolvasPropias=[{n:'T1 Principal',v:4000},{n:'T2 Secundaria',v:2000}];
  $('mc-nombre').value='';
  $('mc-ancho').value=$('m-ancho')?.value||9;
  $('mc-ficha').value='';
  $('m-custom-panel').classList.remove('hidden');
  maqRenderTolvasPropias();
}
function maqCancelarPropia(){
  $('m-custom-panel').classList.add('hidden');
}
function maqAgregarTolva(){
  _maqTolvasPropias.push({n:'T'+(_maqTolvasPropias.length+1),v:1000});
  maqRenderTolvasPropias();
}
function maqQuitarTolva(i){
  _maqTolvasPropias.splice(i,1);
  maqRenderTolvasPropias();
}
function maqRenderTolvasPropias(){
  const cont=$('mc-tolvas');if(!cont)return;
  cont.innerHTML=_maqTolvasPropias.map((t,i)=>`
    <div class="grid-3 mc-tolva-row" data-i="${i}" style="align-items:end;margin-bottom:.45rem">
      <div class="fg" style="margin-bottom:0"><label>Nombre</label><input type="text" class="mc-tolva-n" value="${t.n||''}" placeholder="T${i+1}"></div>
      <div class="fg" style="margin-bottom:0"><label>Capacidad (L)</label><input type="number" class="mc-tolva-v" value="${t.v||0}" min="0" step="50"></div>
      <div style="display:flex;align-items:end"><button type="button" class="btn btn-s" onclick="maqQuitarTolva(${i})">Quitar</button></div>
    </div>`).join('') || '<div class="alert info"><span class="ai">ℹ️</span><div class="ac">Agregá al menos una tolva para calcular autonomía por recarga.</div></div>';
}
function maqGuardarPropia(){
  const nombre=($('mc-nombre')?.value||'').trim();
  const ancho=+($('mc-ancho')?.value||0);
  if(!nombre){maqAviso('Poné un nombre para la máquina.','warn');return}
  if(!ancho||ancho<=0){maqAviso('Revisá el ancho de labor.','warn');return}
  const tolvas=Array.from(document.querySelectorAll('.mc-tolva-row')).map((row,i)=>({
    n:(row.querySelector('.mc-tolva-n')?.value||('T'+(i+1))).trim(),
    v:+(row.querySelector('.mc-tolva-v')?.value||0)
  })).filter(t=>t.v>0);
  if(!tolvas.length){maqAviso('Cargá al menos una tolva con capacidad en litros.','warn');return}
  const id='usr_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
  const ficha=($('mc-ficha')?.value||'').trim();
  const arr=maqLeerPropias();
  arr.push({id,nombre,a:ancho,t:tolvas,f:ficha||`Máquina propia: ${nombre}. ${tolvas.length} tolva${tolvas.length!==1?'s':''}, ${tolvas.reduce((s,t)=>s+t.v,0).toLocaleString('es-AR')} L totales.`});
  maqGuardarPropiasLista(arr);
  maqSyncPropias();
  $('m-maq').value=id;
  $('m-custom-panel').classList.add('hidden');
  loadMaq();
  maqAviso('Máquina guardada en tu nómina.','ok');
}
function maqEliminarPropia(){
  maqSyncPropias();
  const sel=$('m-maq');if(!sel)return;
  const opt=sel.options[sel.selectedIndex];
  if(!opt||opt.dataset.propia!=='1'){maqAviso('Seleccioná primero una máquina propia para quitarla.','warn');return}
  if(!confirm('¿Quitar esta máquina de tu nómina?'))return;
  const arr=maqLeerPropias().filter(m=>m.id!==sel.value);
  maqGuardarPropiasLista(arr);
  delete DB.maqs[sel.value];
  sel.value='mixia';
  maqSyncPropias();
  loadMaq();
  maqAviso('Máquina quitada.','ok');
}

document.addEventListener('DOMContentLoaded',maqSyncPropias);

  window.loadMaq = loadMaq;
  window.renderTC = renderTC;
  window.syncD = syncD;
  window.maqNuevaPropia = maqNuevaPropia;
  window.maqCancelarPropia = maqCancelarPropia;
  window.maqAgregarTolva = maqAgregarTolva;
  window.maqQuitarTolva = maqQuitarTolva;
  window.maqGuardarPropia = maqGuardarPropia;
  window.maqEliminarPropia = maqEliminarPropia;
})();
