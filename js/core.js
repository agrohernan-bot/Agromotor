// ════════════════════════════════════════════════════════
// AGROMOTOR — core.js
// Helpers compartidos, constantes globales y estado base
// Cargado primero — disponible para todos los módulos
// ════════════════════════════════════════════════════════


// ── HELPERS ──
const $=id=>document.getElementById(id);
function sv(id,val){const e=$(id);if(e)e.textContent=val}
function gv(id){return $(id)?.value}
function gi(id){return parseFloat($(id)?.value)||0}
function setR(id,val,dec=0){const e=$(id);if(!e)return;e.value=Math.round(val*10**dec)/10**dec;e.dispatchEvent(new Event('input'))}

// ── DB ──
const DB={
  hum:{
    Molisol:{Maíz:{n:18,i:24,x:32},Soja:{n:16,i:22,x:30},Girasol:{n:18,i:24,x:30},Trigo:{n:15,i:20,x:28},Cebada:{n:15,i:20,x:28},Sorgo:{n:18,i:24,x:32},Colza:{n:15,i:19,x:25}},
    Vertisol:{Maíz:{n:20,i:28,x:36},Soja:{n:18,i:26,x:34},Girasol:{n:20,i:28,x:36},Trigo:{n:18,i:26,x:34},Cebada:{n:18,i:25,x:32},Sorgo:{n:20,i:28,x:36},Colza:{n:18,i:25,x:32}},
    Alfisol:{Maíz:{n:16,i:22,x:30},Soja:{n:15,i:21,x:28},Girasol:{n:16,i:22,x:30},Trigo:{n:15,i:21,x:28},Cebada:{n:15,i:20,x:28},Sorgo:{n:16,i:22,x:30},Colza:{n:15,i:19,x:25}},
    Entisol:{Maíz:{n:14,i:20,x:28},Soja:{n:12,i:18,x:26},Girasol:{n:14,i:20,x:28},Trigo:{n:12,i:18,x:26},Cebada:{n:12,i:18,x:26},Sorgo:{n:14,i:20,x:28},Colza:{n:12,i:17,x:25}},
    Oxisol:{Maíz:{n:16,i:22,x:30},Soja:{n:15,i:21,x:28},Girasol:{n:16,i:22,x:30},Trigo:{n:15,i:21,x:28},Cebada:{n:15,i:21,x:28},Sorgo:{n:16,i:22,x:30},Colza:{n:15,i:19,x:25}},
  },
  suelo:{Molisol:{cc:34,pm:12,da:1.3},Vertisol:{cc:36,pm:20,da:1.35},Alfisol:{cc:36,pm:16,da:1.4},Entisol:{cc:10,pm:2,da:1.5},Oxisol:{cc:26,pm:10,da:1.2}},
  tMin:{Maíz:10,Soja:12,Girasol:8,Trigo:4,Cebada:4,Sorgo:15,Colza:5},
  tId:{Maíz:18,Soja:20,Girasol:14,Trigo:10,Cebada:8,Sorgo:20,Colza:10},
  prof:{
    Molisol:{Maíz:[3,5,8],Soja:[3,4,6],Girasol:[3,5,7],Trigo:[3,4,6],Cebada:[3,4,6],Sorgo:[2,3,5],Colza:[1,2,3]},
    Vertisol:{Maíz:[3,5,7],Soja:[3,4,6],Girasol:[3,5,7],Trigo:[3,4,6],Cebada:[3,4,6],Sorgo:[2,3,5],Colza:[1,2,3]},
    Alfisol:{Maíz:[4,5,8],Soja:[3,5,7],Girasol:[3,5,8],Trigo:[3,5,7],Cebada:[3,4,6],Sorgo:[3,4,6],Colza:[1,2,3]},
    Entisol:{Maíz:[4,6,9],Soja:[4,5,8],Girasol:[4,6,8],Trigo:[4,5,7],Cebada:[4,5,7],Sorgo:[3,4,6],Colza:[2,3,4]},
    Oxisol:{Maíz:[3,5,8],Soja:[3,4,6],Girasol:[3,5,7],Trigo:[3,4,6],Cebada:[3,4,6],Sorgo:[2,3,5],Colza:[1,2,3]},
  },
  npk:{Maíz:{N:25,P:4,K:3},Soja:{N:0,P:2,K:1.5},Girasol:{N:18,P:3,K:2.5},Trigo:{N:28,P:5,K:4},Cebada:{N:23,P:4,K:3.5},Sorgo:{N:22,P:4,K:3},Colza:{N:35,P:7,K:6}},
  rendR:{Maíz:[4,15],Soja:[1.5,5],Girasol:[1.5,4],Trigo:[2,8],Cebada:[2,7],Sorgo:[3,10],Colza:[1.5,4.5]},
  ferts:{'Urea':{N:46,P:0,K:0},'MAP (Fosfato Monoamónico)':{N:11,P:52,K:0},'DAP (Fosfato Diamónico)':{N:18,P:46,K:0},'KCl (Cloruro de Potasio)':{N:0,P:0,K:60}},
  maqs:{
    mixia:{a:13.5,t:[{n:'T1 Principal',v:9600},{n:'T2 Secundaria',v:4800},{n:'T3 Microgranulado',v:1600}]},
    plantor:{a:9.0,t:[{n:'T1 Principal',v:5600},{n:'T2 Secundaria',v:2800}]},
    drilor:{a:7.5,t:[{n:'T1 Grano Fino',v:3200},{n:'T2 Fertilizante',v:1800}]},
    custom:{a:9.0,t:[{n:'T1',v:4000},{n:'T2',v:2000}]},
  },
  prods:{Soja:0.75,Maíz:0.72,Trigo:0.78,Girasol:0.42,Sorgo:0.70,Urea:0.75,MAP:1.0,'Microgranulado Zn':0.95,Vacío:0},
  dosis:{Soja:80,Maíz:20,Trigo:120,Girasol:4,Sorgo:6,Urea:100,MAP:150,'Microgranulado Zn':20,Vacío:0},
};

// ── COORDS ──
const SPOLY={
  Molisol:[[-68,-25],[-65,-27],[-62,-30],[-59,-33],[-57,-36],[-59,-39],[-62,-40],[-65,-38],[-67,-35],[-68,-30]],
  Vertisol:[[-60,-26],[-58,-28],[-56,-30],[-55,-32],[-57,-34],[-60,-32],[-61,-30],[-60,-26]],
  Entisol:[[-70,-20],[-67,-22],[-64,-24],[-61,-26],[-59,-28],[-61,-31],[-65,-33],[-68,-30],[-70,-25],[-70,-20]],
  Alfisol:[[-65,-38],[-62,-40],[-60,-42],[-58,-44],[-57,-46],[-59,-48],[-63,-47],[-66,-44],[-67,-41],[-65,-38]],
  Oxisol:[[-55,-23],[-54,-25],[-52,-27],[-52,-29],[-54,-30],[-56,-29],[-57,-27],[-55,-23]],
};
function inPoly(lat,lon,p){let d=false,n=p.length,j=n-1;for(let i=0;i<n;i++){const[xi,yi]=p[i],[xj,yj]=p[j];if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))d=!d;j=i}return d}
function detSuelo(lat,lon){for(const[t,p] of Object.entries(SPOLY))if(inPoly(lat,lon,p))return t;return null}
function parsCoord(txt){
  txt=txt.trim();
  const dec=txt.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
  if(dec)return[+dec[1],+dec[2]];
  const dms=txt.match(/(\d+)[°\s]\s*(\d+)['\u2019\s]\s*(\d+(?:[.,]\d+)?)["\u201d]?\s*([NS])\s+(\d+)[°\s]\s*(\d+)['\u2019\s]\s*(\d+(?:[.,]\d+)?)["\u201d]?\s*([EW])/i);
  if(dms){
    let la=+dms[1]+(+dms[2])/60+parseFloat(dms[3].replace(',','.'))/3600;
    let lo=+dms[5]+(+dms[6])/60+parseFloat(dms[7].replace(',','.'))/3600;
    if(dms[4].toUpperCase()==='S')la=-la;if(dms[8].toUpperCase()==='W')lo=-lo;
    return[la,lo];
  }return[null,null];
}

// ── GPS ──
function usarGPS(){
  if(!navigator.geolocation){alert('Geolocalización no disponible.');return}
  const b=$('btn-gps');b.textContent='⟳';b.disabled=true;
  navigator.geolocation.getCurrentPosition(
    p=>{$('s-coord').value=`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`;b.textContent='📍 GPS';b.disabled=false;buscarAPI()},
    ()=>{b.textContent='📍 GPS';b.disabled=false;alert('No se pudo obtener la ubicación GPS.')},
    {enableHighAccuracy:true,timeout:10000}
  );
}

// ── API STATUS ──
function setStatus(msg,loading=true){
  $('api-st').classList.remove('hidden');
  $('api-sp').textContent=loading?'⟳':'';
  $('api-sp').style.animation=loading?'spin 1s linear infinite':'none';
  $('api-msg').textContent=msg;
}

// ── OPEN-METEO ──