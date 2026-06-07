// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AGROMOTOR â€” Service Worker v1.0
// Estrategia: Cache-First para assets locales
//             Network-First para APIs externas
//             Offline fallback para uso en campo
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const CACHE_NAME    = 'agromotor-v131';
const CACHE_CDN     = 'agromotor-cdn-v1';

// Assets locales - se pre-cachean en el install
const ASSETS_LOCAL = [
  './',
  './index.html',
  './app.html',
  './favicon.svg',
  './favicon-48.png',
  './favicon-96.png',
  './apple-touch-icon.png',
  './css/agromotor.css',
  './css/cosecha.css',
  './css/dashboard.css',
  './css/alerta-sanitaria.css',
  './css/clientes.css',
  './css/lote-nuevo.css',
  './css/siembra-variable.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './js/store.js',
  './js/config.js',
  './js/core.js',
  './js/login.js',
  './js/cache.js',
  './js/modo-switch.js',
  './js/campanas.js',
  './js/enso.js',
  './js/alertas.js',
  './js/barbecho.js',
  './js/fenologia.js',
  './js/informe-cierre.js',
  './js/nav.js',
  './js/pdf.js',
  './js/pdf-modulo.js',
  './js/onboarding.js',
  './js/siembra.js',
  './js/siembra-apis.js',
  './js/economia.js',
  './js/graficos-economia.js',
  './js/comparador-campana.js',
  './js/nutricion.js',
  './js/maquinaria.js',
  './js/hidrico.js',
  './js/graficos-hidrico.js',
  './js/cultivares.js',
  './js/cultivares-extra.js',
  './js/decision.js',
  './js/asistente.js',
  './js/plagas.js',
  './js/pulverizacion.js',
  './js/cosecha.js',
  './js/seguimiento.js',
  './js/mapa.js',
  './js/siembra-variable.js',
  './js/rotacion.js',
  './js/alerta-sanitaria.js',
  './js/clientes.js',
  './js/dashboard.js',
  './js/dashboard-lotes.js',
  './js/dashboard-ux.js',
  './js/lote-nuevo.js',
  './js/bitacora.js',
  './js/rendimiento-predictor.js',
  './js/notificaciones.js',
  './js/malezas.js',
  './js/huella-carbono.js',
  './js/historial-campanas.js',
  './js/siembra-planificacion.js',
  './css/siembra-planificacion.css',
  './manifest.json',
];
// CDN externos â€” se cachean en primer uso (Stale While Revalidate)
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'unpkg.com',
];

// APIs de datos â€” siempre Network First (datos en tiempo real)
const API_HOSTS = [
  'api.open-meteo.com',
  'power.larc.nasa.gov',
  'rest.isric.org',
  'nominatim.openstreetmap.org',
  'dolarapi.com',
  'api.bcra.gob.ar',
  'supabase.co',
  'monitorsiogranos.magyp.gob.ar',       // cosecha: precio FOB granos
  'api.estadisticasbcra.com',            // cosecha: tipo de cambio + tasas BCRA
  'api.openlandmap.org',                 // suelo: P/K/Zn OpenLandMap
  'idecor-ws.mapascordoba.gob.ar',       // suelo: P IDECOR CÃ³rdoba
  'infra.datos.gob.ar',                  // cosecha: BADLAR + plazo fijo (CSV SSPM)
];

// â”€â”€ INSTALL: pre-cachear assets locales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_LOCAL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Error en install:', err))
  );
});

// â”€â”€ ACTIVATE: limpiar caches viejos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ FETCH: estrategia segÃºn origen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar GET
  if (request.method !== 'GET') return;

  // Permite forzar una limpieza total visitando /app.html?clear-sw=1.
  if (url.searchParams.has('clear-sw')) {
    event.respondWith((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      return fetch(request);
    })());
    return;
  }

  // HTML y navegaciones â†’ Network First para no dejar la app clavada en un shell viejo.
  if (request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/app.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // APIs de datos â†’ Network First (con fallback offline)
  if (API_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // CDN externos â†’ Stale While Revalidate
  if (CDN_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(staleWhileRevalidate(request, CACHE_CDN));
    return;
  }

  // Assets locales â†’ Cache First
  event.respondWith(cacheFirst(request));
});

// â”€â”€ ESTRATEGIAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Cache First: sirve del cache, si no estÃ¡ busca en red y cachea
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
// o el index.html para navegaciÃ³n
async function offlineFallback(request) {
  const url = new URL(request.url);

  // Si es navegaciÃ³n â†’ devolver app shell cacheada
  if (request.mode === 'navigate') {
    const cached = await caches.match('./index.html');
    return cached || new Response('AgroMotor â€” Sin conexiÃ³n', {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Si es una API â†’ JSON con mensaje de offline
  if (request.headers.get('accept')?.includes('application/json') ||
      API_HOSTS.some(h => url.hostname.includes(h))) {
    return new Response(
      JSON.stringify({ error: 'offline', message: 'Sin conexiÃ³n. Los datos en tiempo real no estÃ¡n disponibles.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response('Sin conexiÃ³n', { status: 503 });
}

// â”€â”€ MENSAJE desde la app (para forzar update) â”€â”€â”€â”€â”€â”€â”€â”€â”€
self.addEventListener('message', event => {
  const data = event.data;
  if (data === 'skipWaiting' || data?.type === 'SKIP_WAITING') self.skipWaiting();
});



