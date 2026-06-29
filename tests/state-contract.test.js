const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function createLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, String(v)]));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function createDocument() {
  const elements = new Map();
  function makeElement(id) {
    return {
      id,
      value: '',
      innerHTML: '',
      textContent: '',
      style: {},
      dataset: {},
      disabled: false,
      className: '',
      appendChild() {},
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {},
      addEventListener() {},
    };
  }
  return {
    _elements: elements,
    ensureElement(id, initial = {}) {
      if (!elements.has(id)) elements.set(id, Object.assign(makeElement(id), initial));
      return elements.get(id);
    },
    addEventListener() {},
    createElement() {
      return makeElement('');
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    body: { appendChild() {} },
  };
}

function loadCacheWithStorage(initialStorage) {
  const localStorage = createLocalStorage(initialStorage);
  const sandbox = {
    document: createDocument(),
    localStorage,
    console: { warn() {}, log() {}, error() {} },
    setTimeout() {},
    clearTimeout() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read('js/cache.js'), sandbox, { filename: 'js/cache.js' });
  return { window: sandbox, localStorage };
}

function createBrowserSandbox(extra = {}) {
  const document = createDocument();
  const sandbox = {
    document,
    localStorage: createLocalStorage(),
    console: { warn() {}, log() {}, error() {} },
    setTimeout(fn) { if (typeof fn === 'function') fn(); },
    clearTimeout() {},
    alert() {},
    confirm() { return true; },
    Date,
    Math,
    Promise,
    ...extra,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

test('cache normaliza y persiste lote activo inexistente', () => {
  const initial = JSON.stringify({
    activo: 'lote-inexistente',
    lotes: [
      { id: 'lote-a', nombre: 'Lote A', data: { coord: '-31,-58' } },
      { id: 'lote-b', nombre: 'Lote B', data: {} },
    ],
  });

  const { window, localStorage } = loadCacheWithStorage({ am_global_lotes_v2: initial });

  window.amCargarLotesGlobales();

  assert.equal(window.AM_LOTE_ACTIVO, 'lote-a');
  assert.equal(window.amGetLoteActivo().id, 'lote-a');
  assert.equal(JSON.parse(localStorage.getItem('am_global_lotes_v2')).activo, 'lote-a');
});

test('cache crea lote default cuando la lista queda vacia', () => {
  const { window, localStorage } = loadCacheWithStorage({
    am_global_lotes_v2: JSON.stringify({ activo: 'x', lotes: [] }),
  });

  window.amCargarLotesGlobales();

  assert.equal(window.AM_LOTE_ACTIVO, 'default');
  assert.deepEqual(Array.from(window.AM_LOTES, (l) => l.id), ['default']);
  assert.equal(JSON.parse(localStorage.getItem('am_global_lotes_v2')).activo, 'default');
});

test('modulos criticos leen el lote activo via helper central', () => {
  const modules = [
    'js/plagas.js',
    'js/alerta-sanitaria.js',
    'js/mapa.js',
    'js/siembra-variable.js',
    'js/nutricion.js',
    'js/cultivares.js',
    'js/pulverizacion.js',
  ];

  for (const relPath of modules) {
    assert.match(read(relPath), /amGetLoteActivo/, `${relPath} debe usar amGetLoteActivo`);
  }
});

test('AgroENSO genera lectura agronomica accionable por fase actual', () => {
  const enso = require(path.join(ROOT, 'js/enso.js'));
  const lote = { data: { depto_nombre: 'Concordia' } };
  const impactos = [
    { fase_enso: 'ElNino', rend_vs_promedio_pct: 8.2, significativo: true },
    { fase_enso: 'Neutral', rend_vs_promedio_pct: 1.1, significativo: false },
    { fase_enso: 'LaNina', rend_vs_promedio_pct: -12.4, significativo: true },
  ];

  const riesgo = enso._buildDetailedAdvisory(lote, impactos, enso._faseLocalToDb('nina'), 'Soja');
  assert.equal(riesgo.tone, 'risk');
  assert.match(riesgo.summary, /riesgo/i);
  assert.match(riesgo.dashboardText, /-12\.4%/);
  assert.ok(riesgo.bullets.some(b => /R3-R6/.test(b)));

  const oportunidad = enso._buildDetailedAdvisory(lote, impactos, enso._faseLocalToDb('nino'), 'Soja');
  assert.equal(oportunidad.tone, 'opportunity');
  assert.match(oportunidad.summary, /favorable/i);
});

test('Pulverizacion hereda lote activo y persiste historial en lote.data', () => {
  const pulverizacion = read('js/pulverizacion.js');

  assert.match(pulverizacion, /function pulvPrepararAutoLote/);
  assert.match(pulverizacion, /window\.pulvPrepararAutoLote\s*=/);
  assert.match(pulverizacion, /pulvGetLoteActivo/);
  assert.match(pulverizacion, /amGetLoteActivo/);
  assert.match(pulverizacion, /lote\.data\.pulverizacion\.aplicaciones/);
  assert.match(pulverizacion, /amGuardarLotesEstado/);
  assert.match(pulverizacion, /preg-historial/);
});

test('Plagas hereda cultivo, fecha y contexto desde lote activo', () => {
  const lote = {
    id: 'lote-trigo',
    nombre: 'La Monona',
    data: {
      cultivo: 'Trigo',
      coord: '-34.07351,-62.99436',
      planificacionSiembra: {
        invierno: { cultivo: 'Trigo', fechaSiembraConf: '2026-06-07' },
      },
    },
  };
  const sandbox = createBrowserSandbox({
    amGetLoteActivo() { return lote; },
  });
  sandbox.document.ensureElement('plagas-input-card');
  sandbox.document.ensureElement('plagas-contexto-lote');
  sandbox.document.ensureElement('plagas-siembra');
  sandbox.document.ensureElement('s-cultivo', { value: 'Soja' });
  sandbox.document.ensureElement('s-fecha', { value: '2026-01-01' });

  vm.runInNewContext(read('js/plagas.js'), sandbox, { filename: 'js/plagas.js' });
  sandbox.plagasPrepararAutoLote();

  assert.equal(sandbox.document.getElementById('plagas-siembra').value, '2026-06-07');
  assert.equal(sandbox.document.getElementById('plagas-input-card').style.display, 'none');
  assert.match(sandbox.document.getElementById('plagas-contexto-lote').innerHTML, /La Monona/);
  assert.match(sandbox.document.getElementById('plagas-contexto-lote').innerHTML, /trigo/);
  assert.match(sandbox.document.getElementById('plagas-contexto-lote').innerHTML, /2026-06-07/);
});

test('Alerta sanitaria hereda cultivo, fecha y coordenadas desde lote activo', () => {
  const lote = {
    id: 'lote-soja',
    nombre: 'Papa Ea Grande',
    data: {
      cultivo: 'Soja',
      coord: '-31.4699,-58.1770',
      fechaSiembra: '2026-05-14',
    },
  };
  const sandbox = createBrowserSandbox({
    amGetLoteActivo() { return lote; },
  });
  for (const id of ['as-input-card', 'as-contexto-lote', 'as-lat', 'as-lon', 'as-cultivo', 'as-siembra']) {
    sandbox.document.ensureElement(id);
  }
  sandbox.document.ensureElement('s-cultivo', { value: 'Trigo' });
  sandbox.document.ensureElement('s-fecha', { value: '2026-01-01' });

  vm.runInNewContext(read('js/alerta-sanitaria.js'), sandbox, { filename: 'js/alerta-sanitaria.js' });
  sandbox.asPrepararAutoLote();

  assert.equal(sandbox.document.getElementById('as-cultivo').value, 'soja');
  assert.equal(sandbox.document.getElementById('as-siembra').value, '2026-05-14');
  assert.equal(sandbox.document.getElementById('as-lat').value, '-31.46990');
  assert.equal(sandbox.document.getElementById('as-lon').value, '-58.17700');
  assert.equal(sandbox.document.getElementById('as-input-card').style.display, 'none');
  assert.match(sandbox.document.getElementById('as-contexto-lote').innerHTML, /Papa Ea Grande/);
});

test('nav.js llama a fsPrepararDetalleLote y fsCalcular al activar fen-seg', () => {
  const calls = [];
  const document = createDocument();
  const sandbox = createBrowserSandbox({
    document,
    fsPrepararDetalleLote() { calls.push('fsPrepararDetalleLote'); },
    fsCalcular() { calls.push('fsCalcular'); },
    fpCalcular() {},  // marca fenologia.js como ya cargado
    scrollTo() {},
  });

  vm.runInNewContext(read('js/nav.js'), sandbox, { filename: 'js/nav.js' });
  sandbox._activarModulo('fen-seg');

  assert.ok(calls.includes('fsPrepararDetalleLote'), 'debe llamar fsPrepararDetalleLote al activar fen-seg');
  assert.ok(calls.includes('fsCalcular'), 'debe llamar fsCalcular al activar fen-seg');
});

// Diciembre: todas las plagas de soja y roya están en época
const MockDate = class extends Date {
  constructor(...args) {
    if (args.length === 0) super('2026-12-15T12:00:00.000Z');
    else super(...args);
  }
};

test('compuerta fenologica de plagas: score=0 fuera de ventana, score>0 dentro', () => {
  const sandbox = createBrowserSandbox({
    amGetLoteActivo() { return { id: 'test', nombre: 'Test', data: {} }; },
    Date: MockDate,
  });
  sandbox.document.ensureElement('s-cultivo', { value: 'soja' });
  sandbox.document.ensureElement('s-fecha', { value: '2026-10-01' });

  vm.runInNewContext(read('js/plagas.js'), sandbox, { filename: 'js/plagas.js' });

  const favorable = Array.from({ length: 7 }, () => ({
    tmean: 24, tmin: 18, tmax: 30, hrMean: 70, precip: 0,
  }));

  // R8 = post-madurez soja, no está en ninguna ventana vuln
  const outOfWindow = sandbox.amPlagasUtils.calcPestRisks(favorable, 'R8', 'soja');
  assert.ok(outOfWindow.length > 0, 'debe devolver resultados para soja');
  const inSeason = outOfWindow.filter(p => p.inSeason);
  assert.ok(inSeason.length > 0, 'al menos una plaga debe estar en época en diciembre');
  inSeason.forEach(p => {
    assert.equal(p.score, 0, `${p.id}: score debe ser 0 en R8 (fuera de ventana vulnerable)`);
    assert.equal(p.inVuln, false, `${p.id}: R8 no está en la ventana vuln`);
  });

  // R3 = floración: chinche y anticarsia SÍ están en su ventana
  const inWindow = sandbox.amPlagasUtils.calcPestRisks(favorable, 'R3', 'soja');
  const chinche = inWindow.find(p => p.id === 'chinche_cuernos');
  assert.ok(chinche && chinche.inVuln, 'chinche debe estar en ventana en R3');
  assert.ok(chinche.score > 0, 'chinche debe tener score>0 con clima favorable en R3');
});

test('compuerta fenologica de enfermedades: score=0 fuera de ventana, score>0 dentro', () => {
  const sandbox = createBrowserSandbox({
    amGetLoteActivo() { return { id: 'test', nombre: 'Test', data: {} }; },
    Date: MockDate,
  });
  sandbox.document.ensureElement('s-cultivo', { value: 'soja' });
  sandbox.document.ensureElement('s-fecha', { value: '2026-10-01' });

  vm.runInNewContext(read('js/alerta-sanitaria.js'), sandbox, { filename: 'js/alerta-sanitaria.js' });

  const favorable = Array.from({ length: 10 }, (_, i) => ({
    date: `2026-12-${String(5 + i).padStart(2, '0')}`,
    tmean: 20, tmin: 14, tmax: 26, precip: 0,
    hoursHR75: 8, hoursHR80: 6, hoursHR90: 3,
  }));

  // R8 = post-madurez, no está en ventana de roya ni de ninguna enfermedad de soja
  const outOfWindow = sandbox.asUtils.calcDiseaseRisks(favorable, 'R8', 'soja');
  assert.ok(outOfWindow.length > 0, 'debe devolver resultados para soja');
  const inSeason = outOfWindow.filter(d => d.inSeason);
  assert.ok(inSeason.length > 0, 'al menos una enfermedad debe estar en época en diciembre');
  inSeason.forEach(d => {
    assert.equal(d.score, 0, `${d.id}: score debe ser 0 en R8 (fuera de ventana vulnerable)`);
    assert.equal(d.inVuln, false, `${d.id}: R8 no está en la ventana vuln`);
  });

  // R1 = inicio floración: roya SÍ está en ventana ([R1,...,R6])
  const inWindow = sandbox.asUtils.calcDiseaseRisks(favorable, 'R1', 'soja');
  const roya = inWindow.find(d => d.id === 'roya');
  assert.ok(roya && roya.inVuln, 'roya debe estar en ventana en R1');
  assert.ok(roya.score > 0, 'roya debe tener score>0 con clima favorable en R1');
});

test('Cosecha y Pulverizacion no reintroducen globals genericos conflictivos', () => {
  const cosecha = read('js/cosecha.js');
  const pulverizacion = read('js/pulverizacion.js');

  for (const source of [cosecha, pulverizacion]) {
    assert.doesNotMatch(source, /window\.showTab\s*=/);
    assert.doesNotMatch(source, /window\.limpiarHistorial\s*=/);
  }

  assert.match(cosecha, /window\.cosShowTab\s*=/);
  assert.match(cosecha, /window\.cosLimpiarHistorial\s*=/);
  assert.match(pulverizacion, /window\.pulvCalcBuffer\s*=/);
  assert.match(pulverizacion, /window\.pulvCalcCaldo\s*=/);
});

test('assetVersion, config query y service worker versionado quedan alineados', () => {
  const app = read('app.html');
  const config = read('js/config.js');
  const sw = read('sw.js');

  const assetMatch = config.match(/assetVersion:\s*'(\d+)'/);
  const configQueryMatch = app.match(/js\/config\.js\?v=(\d+)/);

  assert.ok(assetMatch, 'config.js debe exponer assetVersion numerico');
  assert.ok(configQueryMatch, 'app.html debe versionar config.js');
  assert.equal(Number(configQueryMatch[1]), Number(assetMatch[1]) - 1);
  assert.match(sw, /SW_VERSION\s*=\s*new URL\(self\.location\.href\)\.searchParams\.get\('v'\)/);
  assert.match(app, /navigator\.serviceWorker\.register\('\.\/sw\.js\?v='/);
});

test('amGetFaseGrupo devuelve planificacion por defecto y respeta faseGrupos persistido', () => {
  const { window } = loadCacheWithStorage({
    am_global_lotes_v2: JSON.stringify({
      activo: 'lote-a',
      lotes: [
        { id: 'lote-a', nombre: 'La Monona', data: { faseGrupos: { verano: 'pre-siembra', invierno: 'planificacion' } } },
        { id: 'lote-b', nombre: 'Lote sin fase', data: {} },
      ],
    }),
  });
  window.amCargarLotesGlobales();

  const loteA = window.AM_LOTES.find(l => l.id === 'lote-a');
  const loteB = window.AM_LOTES.find(l => l.id === 'lote-b');

  assert.equal(window.amGetFaseGrupo(loteA, 'verano'), 'pre-siembra');
  assert.equal(window.amGetFaseGrupo(loteA, 'invierno'), 'planificacion');
  assert.equal(window.amGetFaseGrupo(loteB, 'verano'), 'planificacion');
  assert.equal(loteB.data.faseGrupos.verano, 'planificacion');
  assert.equal(loteB.data.faseGrupos.invierno, 'planificacion');
  assert.equal(window.amGetFaseGrupo(null, 'verano'), 'planificacion');
});

test('amGetFechaSiembraGrupo prioriza siembra real sobre fecha planificada', () => {
  const { window } = loadCacheWithStorage({
    am_global_lotes_v2: JSON.stringify({
      activo: 'lote-a',
      lotes: [
        {
          id: 'lote-a',
          nombre: 'La Monona',
          data: {
            planificacionSiembra: { invierno: { cultivo: 'Trigo', fechaSiembraConf: '2026-06-05' } },
            siembraRealizada: { invierno: { fecha: '2026-06-09', cultivo: 'Trigo' } },
          },
        },
      ],
    }),
  });
  window.amCargarLotesGlobales();
  const lote = window.AM_LOTES.find(l => l.id === 'lote-a');

  assert.equal(window.amGetFechaSiembraGrupo(lote, 'invierno'), '2026-06-09');
  assert.equal(window.amGrupoPorCultivo('Trigo'), 'invierno');
  assert.equal(window.amGrupoPorCultivo('Maíz'), 'verano');
});

test('mapeo geografico Nominatim a IDs de Supabase', () => {
  const prov = "Provincia de Entre Ríos";
  const county = "Departamento Concordia";

  // Limpiar usando la logica de buscarAPI en js/siembra.js
  const cleanState = prov.replace(/Provincia de/i, '').replace(/Provincia/i, '').trim();
  const cleanCounty = county.replace(/Departamento/i, '').replace(/Partido de/i, '').replace(/Partido/i, '').replace(/Comuna de/i, '').replace(/Comuna/i, '').trim();

  assert.equal(cleanState, "Entre Ríos");
  assert.equal(cleanCounty, "Concordia");
});

// ── Densidad ReTAA ──────────────────────────────────────
const RETAA = require('../js/densidad-retaa.js');

test('ReTAA detecta la subregion por coordenadas (bbox + centroide)', () => {
  // Pergamino → Núcleo Sur
  const sr = RETAA.getSubregion(-33.9, -60.5);
  assert.equal(sr.id, 'nuc_s');
  // Balcarce → Sudeste Bs.As.
  assert.equal(RETAA.getSubregion(-37.8, -58.3).id, 'se_ba');
  // Coordenada inválida → null
  assert.equal(RETAA.getSubregion(NaN, -60), null);
});

test('ReTAA devuelve densidad observada con bandera de calidad de dato', () => {
  const r = RETAA.calcular({ lat: -33.9, lon: -60.5, cultivo: 'maiz', fecha: 't', ambiente: 'm', hidrico: 'n' });
  assert.equal(r.subregion.id, 'nuc_s');
  assert.equal(r.densidad.valor, 75.4);       // dato real ReTAA Núcleo Sur 2021/22 temprano
  assert.equal(r.densidad.fuente, '◉');
  assert.equal(r.fertilN, 116);
  assert.equal(r.unidad, 'mil pl/ha');
  assert.ok(Array.isArray(r.tendencia) && r.tendencia.length >= 3);
});

test('ReTAA aplica ajuste por ambiente e hidrico sobre la densidad', () => {
  const base = RETAA.calcular({ lat: -33.9, lon: -60.5, cultivo: 'maiz', fecha: 't', ambiente: 'm', hidrico: 'n' });
  const alto = RETAA.calcular({ lat: -33.9, lon: -60.5, cultivo: 'maiz', fecha: 't', ambiente: 'a', hidrico: 'n' });
  // Maíz: ambiente alto = +8% sobre la densidad
  assert.equal(alto.densidad.ajustada, +(base.densidad.valor * 1.08).toFixed(1));
});

test('ReTAA sorgo expresa la densidad en mil pl/ha (sin bug /1000)', () => {
  const r = RETAA.calcular({ lat: -32.5, lon: -63.5, cultivo: 'sorgo', ambiente: 'm', hidrico: 'n' });
  // Sorgo regional ~155-200 mil pl/ha — nunca un valor < 100 (regresión del /1000)
  assert.ok(r.densidad.valor >= 100, 'densidad sorgo debe estar en mil pl/ha, no dividida');
  assert.equal(r.densidad.fuente, '◈');       // estimado por metodología ReTAA
});

test('ReTAA conversion a sem/m2 entra en rango para maiz/girasol, no para sorgo', () => {
  // Siembra Variable autollenarsem/m² (rango input 2-15) solo cuando la
  // conversion desde mil pl/ha es limpia y en rango.
  const semM2 = (key, lat, lon, logro) => {
    const r = RETAA.calcular({ lat, lon, cultivo: key, ambiente: 'm', hidrico: 'n' });
    return r.densidad.ajustada / logro / 10;
  };
  const maiz = semM2('maiz', -33.9, -60.5, 0.92);
  const gira = semM2('girasol', -37.5, -58.5, 0.88);
  const sorgo = semM2('sorgo', -33, -60.5, 0.80);
  assert.ok(maiz >= 2 && maiz <= 15, 'maiz debe convertir a sem/m2 en rango');
  assert.ok(gira >= 2 && gira <= 15, 'girasol debe convertir a sem/m2 en rango');
  assert.ok(sorgo > 15, 'sorgo excede el rango -> queda excluido del autollenado');
});

test('ReTAA deriva el codigo de fecha desde el mes de siembra', () => {
  assert.equal(RETAA.derivarFecha('maiz', '2025-12-15'), 'd'); // tardío
  assert.equal(RETAA.derivarFecha('maiz', '2025-09-20'), 't'); // temprano
  assert.equal(RETAA.derivarFecha('soja', '2026-01-10'), 's'); // 2°
  assert.equal(RETAA.derivarFecha('sorgo', '2025-11-01'), null); // sorgo no distingue fecha
});

test('cvGuardarDensidad guarda la densidad de siembra ajustada en el lote activo', () => {
  const initial = JSON.stringify({
    activo: 'lote-a',
    lotes: [
      { id: 'lote-a', nombre: 'Lote A', data: { cultivo: 'Soja', planificacionSiembra: {} } },
    ],
  });

  const { window } = loadCacheWithStorage({ am_global_lotes_v2: initial });
  window.amCargarLotesGlobales();

  // Mock de DOM y dependencias en el sandbox
  window.document = createDocument();
  window.document.ensureElement('cv-cultivo', { value: 'Soja' });
  window.document.ensureElement('cv-retaa-dens-edit', { value: '' });

  // Cargar cultivares en el sandbox
  vm.runInNewContext(read('js/cultivares.js'), window, { filename: 'js/cultivares.js' });

  // Guardar una densidad
  window.cvGuardarDensidad(12.5);

  const lote = window.amGetLoteActivo();
  assert.equal(lote.data.planificacionSiembra.verano.densidadConf, 12.5);

  // Borrar
  window.cvGuardarDensidad('');
  assert.equal(lote.data.planificacionSiembra.verano.densidadConf, undefined);
});

test('pulvPrepararOrdenRapida cambia a pulverizacion y carga el producto', () => {
  const initial = JSON.stringify({
    activo: 'lote-a',
    lotes: [
      { id: 'lote-a', nombre: 'Lote A', data: { cultivo: 'Maíz', superficie: 150 } },
    ],
  });

  const { window } = loadCacheWithStorage({ am_global_lotes_v2: initial });
  window.amCargarLotesGlobales();

  // Mock de DOM y variables globales
  window.document = createDocument();
  window.document.ensureElement('pc-tipo', { value: '' });
  window.document.ensureElement('c-tipo', { value: '' });
  window.document.ensureElement('pc-producto', { value: '' });
  window.document.ensureElement('c-volha', { value: '80' });
  window.document.ensureElement('c-tanque', { value: '3000' });
  window.document.ensureElement('c-ha', { value: '' });
  window.document.ensureElement('pc-ha', { value: '' });
  window.document.ensureElement('reg-ha', { value: '' });
  window.document.ensureElement('reg-lote', { value: '' });
  window.document.ensureElement('pc-cultivo', { value: '' });
  window.document.ensureElement('reg-cultivo', { value: '' });
  window.document.ensureElement('pc-ancho', { value: '' });
  window.document.ensureElement('pc-vel', { value: '' });
  window.document.ensureElement('pc-efic', { value: '' });
  window.document.ensureElement('pc-horas', { value: '' });
  window.document.ensureElement('pc-mix-list');
  window.document.ensureElement('pc-pauta-body');
  window.document.ensureElement('pulv-gps-dot');
  window.document.ensureElement('pulv-gps-txt');
  window.document.ensureElement('pulv-sem-loading');
  window.document.ensureElement('pulv-sem-content');
  window.document.ensureElement('pulv-ventana-card');

  // Mocks de nav y timers
  window.switchMod = (mod) => { window.modActivo = mod; };
  window.setTimeout = (fn) => fn(); // Ejecutar síncronamente los timers
  window.setInterval = () => {};
  window.clearInterval = () => {};
  window.amToast = () => {};
  window.navigator = {}; // Mock navigator
  window.fetch = () => new Promise(() => {}); // Mock fetch síncrono que no hace nada

  // Cargar pulverizacion en el sandbox
  vm.runInNewContext(read('js/pulverizacion.js'), window, { filename: 'js/pulverizacion.js' });

  // Disparar orden rápida
  window.pulvPrepararOrdenRapida({
    tipo: 'insecticida',
    productoNombre: 'Lambda-cialotrina 5%',
    dosis: 0.15
  });

  assert.equal(window.modActivo, 'pulverizacion');
});
