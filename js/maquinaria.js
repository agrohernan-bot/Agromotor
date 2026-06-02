// AGROMOTOR — maquinaria.js
// Productividad · Autonomía tolvas · Jornada · ROI
// Cargar máquina propia · Crucianelli · Agrometal · Apache · Tanzi · Súper Wálter · ERCA · Monumental

(function () {
  window.AM = window.AM || {};
  window.TC = window.TC || [];
  let _maqTolvasPropias = [];
  const MAQ_LABELS = {
    mixia: 'Crucianelli Mixia 13.5 m',
    plantor: 'Crucianelli Plantor 18.9 m',
    drilor: 'Crucianelli Drilor 10 m',
    pionera: 'Crucianelli Pionera 16.38 m',
    gringa: 'Crucianelli Gringa 18.9 m',
    domina: 'Crucianelli Domina 10.5 m',
    agrometalApx: 'Agrometal APX Seed Pro 12.6 m',
    agrometalApxl: 'Agrometal APX-L 19 m',
    agrometalTxPivot: 'Agrometal TX Pivot 2 9.8 m',
    agrometalTxMega: 'Agrometal TX Mega Gen 3 20.47 m',
    agrometalAdx: 'Agrometal ADX Magna 13 m',
    agrometalMx: 'Agrometal MX Max 15 m',
    apache54000: 'Apache 54000 Max 15 m',
    apache27000: 'Apache 27000+ 21 m',
    apache99000: 'Apache 99000 12.4 m',
    tanzi9200evox: 'Tanzi 9200 Air Drill EVOX 18.4 m',
    tanziSpecial3Evox: 'Tanzi Special 3 EVOX 14 m',
    tanziSpecial4: 'Tanzi Special 4 12 m',
    tanziSpecial5: 'Tanzi Special 5 18.9 m',
    superWalterW650Imperial: 'Super Walter W650 Imperial 16 m',
    superWalterW650Autotrailer: 'Super Walter W650 Autotrailer 12 m',
    superWalterW650AirDrill: 'Super Walter W650 Air Drill 12 m',
    superWalterW4500: 'Super Walter W4500 10 m',
    ercaPfPremium: 'ERCA PF Premium 14.7 m',
    ercaLinea7g: 'ERCA Linea 7 G / Serie 6G 18 m',
    ercaLinea7f: 'ERCA Linea 7 F / Serie 6F 15.21 m',
    ercaAirDrillTi13500: 'ERCA Air Drill Ti 13.500 14 m',
    monumentalAd8300: 'Monumental AD-8300 8.3 m',
    monumentalAd12000: 'Monumental AD-12000 11.5 m',
    monumentalAd16000: 'Monumental AD-16000 16 m',
    custom: 'Promedio nacional / personalizada 7 m'
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  function maqStorageKey() {
    const uid = (typeof AM_SESION !== 'undefined' && AM_SESION && AM_SESION.id) ? AM_SESION.id : 'local';
    return 'am_maquinaria_propias_v1_' + uid;
  }
  function maqAviso(msg, tipo) {
    if (typeof amToast === 'function') amToast(msg, tipo || 'ok');
    else alert(msg);
  }
  function maqLeerPropias() {
    try {
      const raw = localStorage.getItem(maqStorageKey());
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(m => m && m.id && m.nombre) : [];
    } catch (_) { return []; }
  }
  function maqGuardarPropiasLista(arr) {
    localStorage.setItem(maqStorageKey(), JSON.stringify(arr));
  }
  function maqRegistrarPropias(propias) {
    propias.forEach(m => {
      DB.maqs[m.id] = {
        a: +m.a || 7,
        t: (m.t || []).map(t => ({ n: t.n || 'Tolva', v: +t.v || 0 })).filter(t => t.v > 0),
        f: m.f || 'Maquina propia cargada por el usuario.'
      };
    });
  }
  function maqOption(value, label, propia) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (propia) opt.dataset.propia = '1';
    return opt;
  }
  function maqRenderSelector() {
    const sel = $('m-maq');
    if (!sel || !DB || !DB.maqs) return;
    const actual = sel.value || 'custom';
    const propias = maqLeerPropias();
    maqRegistrarPropias(propias);
    sel.innerHTML = '';
    Object.keys(DB.maqs).forEach(id => {
      if (id === 'custom' || id.indexOf('usr_') === 0) return;
      sel.appendChild(maqOption(id, MAQ_LABELS[id] || id, false));
    });
    propias.forEach(m => sel.appendChild(maqOption(m.id, 'Propia - ' + m.nombre, true)));
    sel.appendChild(maqOption('custom', MAQ_LABELS.custom, false));
    sel.value = DB.maqs[actual] ? actual : 'custom';
  }

  // ── Sincronizar máquinas propias al selector ──────────────────────────────
  function maqSyncPropias() {
    maqRenderSelector();
  }

  // ── Cargar máquina seleccionada ───────────────────────────────────────────
  function loadMaq() {
    maqSyncPropias();
    const m = DB.maqs[gv('m-maq')];
    if (!m) return;
    $('m-ancho').value = m.a;
    window.TC = m.t.map(t => ({ ...t, prod: 'Soja', pct: 100, dosis: 80 }));
    const ficha = $('m-ficha');
    if (ficha) {
      ficha.innerHTML = '<span class="ai">ℹ️</span><div class="ac">' + (m.f || 'Ficha técnica no disponible.') + '</div>';
    }
    renderTC();
  }

  // ── Renderizar tolvas ─────────────────────────────────────────────────────
  function renderTC() {
    if (!window.TC.length) {
      $('m-tolvas').innerHTML = '<div class="alert info"><span class="ai">ℹ️</span><div class="ac">La fuente no trae litros de tolva normalizados. Para calcular autonomía por recarga usá <strong>Cargar máquina propia</strong> e ingresá las tolvas de tu equipo.</div></div>';
      return;
    }
    $('m-tolvas').innerHTML = window.TC.map((t, i) => `
      <div class="tr"><div class="trh"><span class="trn">📦 ${t.n}</span><span class="trv">${(t.v / 1000).toFixed(1)} m³ · ${t.v.toLocaleString()} L</span></div>
      <div class="grid-3">
        <div class="fg" style="margin-bottom:0"><label>Producto</label>
          <select onchange="window.TC[${i}].prod=this.value;syncD(${i})">
            ${Object.keys(DB.dosis).map(p => '<option value="' + p + '"' + (p === t.prod ? ' selected' : '') + '>' + p + '</option>').join('')}
          </select></div>
        <div class="fg" style="margin-bottom:0"><label>Dosis (kg/ha)</label>
          <input type="number" id="md-${i}" value="${DB.dosis[t.prod] || 80}" min="0" max="500" onchange="window.TC[${i}].dosis=+this.value||0"></div>
        <div class="fg" style="margin-bottom:0"><label>% llenado</label>
          <div class="sw"><input type="range" min="10" max="100" value="100" oninput="window.TC[${i}].pct=+this.value;sv('mp-${i}',this.value+'%')"><span class="sv" id="mp-${i}">100%</span></div></div>
      </div></div>`).join('');
    window.TC.forEach((t, i) => t.dosis = DB.dosis[t.prod] || 80);
  }
  function syncD(i) {
    const e = $('md-' + i);
    if (e) { e.value = DB.dosis[window.TC[i].prod] || 80; window.TC[i].dosis = +e.value; }
  }

  // ── Calcular productividad ────────────────────────────────────────────────
  function calcMaq() {
    const a = gi('m-ancho'), v = gi('m-vel'), ef = +gv('m-efic') || 0.85;
    const hs = gi('m-hs'), tr = gi('m-rec'), pe = gi('m-precio'), mg = gi('m-margen');
    (window.TC || []).forEach((t, i) => { const e = $('md-' + i); if (e) t.dosis = +e.value || 0; });
    const cT = (a * v * ef) / 10;
    let hpc = [], ti = [];
    for (const t of TC) {
      if (t.prod === 'Vacío' || !t.dosis) { ti.push({ ...t, ha: Infinity }); continue; }
      const d = DB.prods[t.prod]; if (d == null) { ti.push({ ...t, ha: Infinity }); continue; }
      const ve = t.v * (t.pct / 100), kg = ve * d, ha = kg / t.dosis;
      hpc.push(ha); ti.push({ ...t, ha, ve, kg });
    }
    const hl = hpc.length ? Math.min(...hpc) : Infinity;
    let hd = 0, rc = 0;
    if (hl < Infinity) {
      const hpc2 = hl / cT, hr = tr / 60; let td = hs, ha = 0, r = 0;
      while (td > 0) { const tf = Math.min(hpc2, td); ha += tf * cT; td -= tf; if (td > hr) { td -= hr; r++; } else break; }
      hd = ha; rc = r;
    } else hd = cT * hs;
    const hp = rc * (tr / 60), cr = hd / hs;
    $('m-ph').classList.add('hidden'); $('m-res').classList.remove('hidden');
    $('m-kpis').innerHTML = `
      <div class="kc"><div class="kl">Ha/jornada</div><div class="kv">${hd.toFixed(1)}</div></div>
      <div class="kc"><div class="kl">Cap. teórica</div><div class="kv">${cT.toFixed(2)}</div><div class="ku">ha/h</div></div>
      <div class="kc ${rc > 3 ? 'warn' : ''}"><div class="kl">Recargas</div><div class="kv">${rc}</div><div class="ku">${hp.toFixed(1)}h perdidas</div></div>`;
    $('m-aut').innerHTML = ti.map(t => {
      if (t.prod === 'Vacío' || !t.dosis) return '';
      const lim = t.ha === hl;
      return `<div style="margin-bottom:.75rem;padding:.75rem;border-radius:8px;border:1px solid ${lim ? 'rgba(184,122,32,.4)' : 'var(--border)'};background:${lim ? 'rgba(184,122,32,.05)' : 'transparent'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem">
          <div style="font-weight:600;font-size:.84rem">${t.n} → ${t.prod}</div>
          ${lim ? '<span style="font-size:.66rem;background:rgba(184,122,32,.15);color:#7A4A10;padding:.18rem .55rem;border-radius:10px;font-weight:700">TOLVA LIMITANTE</span>' : ''}
        </div>
        <div style="display:flex;gap:1.2rem;font-size:.79rem;color:rgba(74,46,26,.6)">
          <span>Vol: <b style="font-family:\'DM Mono\',monospace">${t.ve?.toFixed(0) || '—'} L</b></span>
          <span>Kg: <b style="font-family:\'DM Mono\',monospace">${t.kg?.toFixed(0) || '—'} kg</b></span>
          <span>Aut.: <b style="font-family:\'DM Mono\',monospace;color:var(--canopy)">${t.ha === Infinity ? '∞' : t.ha.toFixed(1) + ' ha'}</b></span>
        </div></div>`;
    }).join('');
    $('m-jorn').innerHTML = `<table class="dt"><tbody>
      <tr><td>Horas de jornada</td><td class="mn">${hs} h</td></tr>
      <tr><td>Horas efectivas</td><td class="mn">${(hs - hp).toFixed(1)} h</td></tr>
      <tr><td>Horas en recargas</td><td class="mn">${hp.toFixed(1)} h (${rc} × ${tr} min)</td></tr>
      <tr><td>Productividad real</td><td class="mn">${cr.toFixed(2)} ha/h</td></tr>
      <tr class="hl"><td>Ha por jornada</td><td class="mn">${hd.toFixed(1)} ha</td></tr>
      </tbody></table>`;
    if (pe > 0 && mg > 0) {
      const hpb = pe / mg, jpb = Math.ceil(hpb / hd);
      $('m-roi').classList.remove('hidden');
      $('m-roi-c').innerHTML = `<div class="rg">
        <div class="kc neutral"><div class="kl">Ha para payback</div><div class="kv">${hpb.toFixed(0)}</div><div class="ku">hectáreas</div></div>
        <div class="kc neutral"><div class="kl">Jornadas payback</div><div class="kv">${jpb}</div><div class="ku">días de trabajo</div></div>
      </div>`;
    }
  }

  // ── Cargar máquina propia ─────────────────────────────────────────────────
  window.maqNuevaPropia = function () {
    _maqTolvasPropias = [{ n: 'T1 Principal', v: 4000 }, { n: 'T2 Secundaria', v: 2000 }];
    $('mc-nombre').value = '';
    $('mc-ancho').value = $('m-ancho')?.value || 7;
    $('mc-ficha').value = '';
    $('m-custom-panel').classList.remove('hidden');
    maqRenderTolvasPropias();
  };
  window.maqCancelarPropia = function () {
    $('m-custom-panel').classList.add('hidden');
  };
  window.maqAgregarTolva = function () {
    _maqTolvasPropias.push({ n: 'T' + (_maqTolvasPropias.length + 1), v: 1000 });
    maqRenderTolvasPropias();
  };
  window.maqQuitarTolva = function (i) {
    _maqTolvasPropias.splice(i, 1);
    maqRenderTolvasPropias();
  };
  function maqRenderTolvasPropias() {
    const cont = $('mc-tolvas'); if (!cont) return;
    cont.innerHTML = _maqTolvasPropias.map((t, i) => `
      <div class="grid-3 mc-tolva-row" data-i="${i}" style="align-items:end;margin-bottom:.45rem">
        <div class="fg" style="margin-bottom:0"><label>Nombre</label><input type="text" class="mc-tolva-n" value="${t.n || ''}" placeholder="T${i + 1}"></div>
        <div class="fg" style="margin-bottom:0"><label>Capacidad (L)</label><input type="number" class="mc-tolva-v" value="${t.v || 0}" min="0" step="50"></div>
        <div style="display:flex;align-items:end"><button type="button" class="btn btn-s" onclick="maqQuitarTolva(${i})">Quitar</button></div>
      </div>`).join('') || '<div class="alert info"><span class="ai">ℹ️</span><div class="ac">Agregá al menos una tolva.</div></div>';
  }
  window.maqGuardarPropia = function () {
    const nombre = ($('mc-nombre')?.value || '').trim();
    const ancho = +($('mc-ancho')?.value || 0);
    if (!nombre) { maqAviso('Poné un nombre para la máquina.', 'warn'); return; }
    if (!ancho || ancho <= 0) { maqAviso('Revisá el ancho de labor.', 'warn'); return; }
    const tolvas = Array.from(document.querySelectorAll('.mc-tolva-row')).map((row, i) => ({
      n: (row.querySelector('.mc-tolva-n')?.value || ('T' + (i + 1))).trim(),
      v: +(row.querySelector('.mc-tolva-v')?.value || 0)
    })).filter(t => t.v > 0);
    if (!tolvas.length) { maqAviso('Cargá al menos una tolva con capacidad en litros.', 'warn'); return; }
    const id = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    const ficha = ($('mc-ficha')?.value || '').trim();
    const arr = maqLeerPropias();
    arr.push({ id, nombre, a: ancho, t: tolvas, f: ficha || 'Máquina propia: ' + nombre + '. ' + tolvas.length + ' tolva' + (tolvas.length !== 1 ? 's' : '') + ', ' + tolvas.reduce((s, t) => s + t.v, 0).toLocaleString('es-AR') + ' L totales.' });
    maqGuardarPropiasLista(arr);
    maqSyncPropias();
    $('m-maq').value = id;
    $('m-custom-panel').classList.add('hidden');
    loadMaq();
    maqAviso('Máquina guardada en tu nómina.', 'ok');
  };
  window.maqEliminarPropia = function () {
    maqSyncPropias();
    const sel = $('m-maq'); if (!sel) return;
    const opt = sel.options[sel.selectedIndex];
    if (!opt || opt.dataset.propia !== '1') { maqAviso('Seleccioná primero una máquina propia para quitarla.', 'warn'); return; }
    if (!confirm('¿Quitar esta máquina de tu nómina?')) return;
    const arr = maqLeerPropias().filter(m => m.id !== sel.value);
    maqGuardarPropiasLista(arr);
    delete DB.maqs[sel.value];
    sel.value = 'mixia';
    maqSyncPropias();
    loadMaq();
    maqAviso('Máquina quitada.', 'ok');
  };

  document.addEventListener('DOMContentLoaded', maqSyncPropias);

  // Exponer globalmente
  window.calcMaq = calcMaq;
  window.loadMaq = loadMaq;
  window.renderTC = renderTC;
  window.syncD = syncD;
  window.maqSyncPropias = maqSyncPropias;
})();
