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
  return {
    addEventListener() {},
    createElement() {
      return {
        appendChild() {},
        classList: { add() {}, remove() {}, toggle() {} },
        setAttribute() {},
        style: {},
      };
    },
    getElementById() {
      return null;
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
