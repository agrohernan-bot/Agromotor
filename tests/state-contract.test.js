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
  ];

  for (const relPath of modules) {
    assert.match(read(relPath), /amGetLoteActivo/, `${relPath} debe usar amGetLoteActivo`);
  }
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

test('Fenologia seguimiento usa datos heredados y dispara calculo automatico', () => {
  const app = read('app.html');
  const nav = read('js/nav.js');

  assert.match(app, /function fsPrepararDetalleLote\(\)\s*{\s*fsUsarLote\(\);/);
  assert.match(nav, /if \(typeof fsPrepararDetalleLote === 'function'\) fsPrepararDetalleLote\(\);[\s\S]*if \(typeof fsCalcular === 'function'\) fsCalcular\(\);/);
  assert.match(app, /La fenologia se genera automaticamente con datos del lote y de la planificacion/);
});

test('Sanidad y plagas mantienen compuerta fenologica antes de alarmar', () => {
  const plagas = read('js/plagas.js');
  const sanitaria = read('js/alerta-sanitaria.js');

  assert.match(plagas, /stageInVuln\(stageCode,pest\.vuln\)/);
  assert.match(plagas, /fuera de la ventana vulnerable[\s\S]*sin alarma/);
  assert.match(sanitaria, /stageInVuln\(stageCode,dis\.vuln\)/);
  assert.match(sanitaria, /fuera de la ventana vulnerable[\s\S]*sin alarma/);
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
