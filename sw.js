// ════════════════════════════════════════════════════════
// AGROMOTOR — Service Worker v1.0
// Estrategia: Cache-First para assets locales
//             Network-First para APIs externas
//             Offline fallback para uso en campo
// ════════════════════════════════════════════════════════

const CACHE_NAME    = 'agromotor-v46';
const CACHE_CDN     = 'agromotor-cdn-v1';

// Assets locales — se pre-cachean en el install
const ASSETS_LOCAL = [
  './',
  './index.html',
  './app.html',
  './css/agromotor.css',
  './css/cosecha.css',
  './js/config.js',
  './js/core.js',
  './js/login.js',
  './js/cache.js',
  './js/nav.js',
  './js/pdf.js',
  './js/siembra.js',
  './js/siembra-apis.js',
  './js/economia.js',
  './js/fertilizacion.js',
  './js/nutricion.js',
  './js/maquinaria.js',
  './js/hidrico.js',
  './js/cultivares.js',
  './js/cultivares-extra.js',
  './js/decision.js',
  './js/asistente.js',
  './js/plagas.js',
  './js/pulverizacion.js',
  './js/cosecha.js',
  './js/seguimiento.js',
  './js/fertilizacion-optima.js',
  './js/balance-nutricional.js',
  './js/mapa.js',
  './js/siembra-variable.js',
  './css/siembra-variable.css',
  './js/alerta-sanitaria.js',
  './js/dashboard-ux.js',
  './js/pdf-modulo.js',
  './js/onboarding.js',
  './css/alerta-sanitaria.css',
  './manifest.json',
];

// CDN externos — se cachean en primer uso (Stale While Revalidate)
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'unpkg.com',
];

// APIs de datos — siempre Network First (datos en tiempo real)
const API_HOSTS = [
  'api.open-meteo.com',
  'power.larc.nasa.gov',
  'rest.isric.org',
  'nominatim.openstreetmap.org',
  'dolarapi.com',
  'api.bcra.gob.ar',
  'supabase.co',
  'api.anthropic.com',
  'monitorsiogranos.magyp.gob.ar',       // cosecha: precio FOB granos
  'api.estadisticasbcra.com',            // cosecha: tipo de cambio + tasas BCRA
  'api.openlandmap.org',                 // suelo: P/K/Zn OpenLandMap
  'idecor-ws.mapascordoba.gob.ar',       // suelo: P IDECOR Córdoba
  'infra.datos.gob.ar',                  // cosecha: BADLAR + plazo fijo (CSV SSPM)
];

// ── INSTALL: pre-cachear assets locales ───────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_LOCAL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Error en install:', err))
  );
});

// ── ACTIVATE: limpiar caches viejos ───────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CACHE_CDN)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia según origen ────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar GET
  if (request.method !== 'GET') return;

  // APIs de datos → Network First (con fallback offline)
  if (API_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // CDN externos → Stale While Revalidate
  if (CDN_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(staleWhileRevalidate(request, CACHE_CDN));
    return;
  }

  // Assets locales → Cache First
  event.respondWith(cacheFirst(request));
});

// ── ESTRATEGIAS ───────────────────────────────────────

// Cache First: sirve del cache, si no está busca en red y cachea
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback(request);
  }
}

// Stale While Revalidate: sirve del cache Y actualiza en background
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// Network First: intenta red, si falla sirve del cache
async function networkFirst(request) {
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      )
    ]);

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

// Fallback offline: respuesta JSON informativa para APIs,
// o el index.html para navegación
async function offlineFallback(request) {
  const url = new URL(request.url);

  // Si es navegación → devolver app shell cacheada
  if (request.mode === 'navigate') {
    const cached = await caches.match('./index.html');
    return cached || new Response('AgroMotor — Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Si es una API → JSON con mensaje de offline
  if (request.headers.get('accept')?.includes('application/json') ||
      API_HOSTS.some(h => url.hostname.includes(h))) {
    return new Response(
      JSON.stringify({ error: 'offline', message: 'Sin conexión. Los datos en tiempo real no están disponibles.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response('Sin conexión', { status: 503 });
}

// ── MENSAJE desde la app (para forzar update) ─────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
