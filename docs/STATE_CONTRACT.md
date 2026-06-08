# AgroMotor State Contract

Este documento define las fuentes de verdad de estado local para evitar que los modulos se pisen entre si. Antes de crear una nueva clave `localStorage`, revisar este contrato.

## Principios

- La fuente principal de lote activo es `window.AM_LOTES` + `window.AM_LOTE_ACTIVO`, persistida por `js/cache.js`.
- Para leer el lote activo, preferir `window.amGetLoteActivo()` cuando exista. El helper normaliza el estado antes de devolver el lote.
- Los modulos pueden leer el lote activo, pero solo deben escribir cambios persistentes del lote a traves de `amGuardarLotesEstado()` cuando exista.
- La planificacion de campaña vive dentro de `lote.data`; los modulos de monitoreo deben heredar desde ahi y no pedir de nuevo cultivo, fecha o coordenadas.
- Las claves `am_*` globales son compatibilidad legacy o cache operativo. No deben ser la fuente primaria si existe dato en `lote.data`.
- Las caches externas deben tener prefijo claro y vencimiento cuando corresponda.

Nota de arquitectura: `js/app.js` no esta cargado por `app.html` en la version actual. El arranque real vive en `app.html`, `js/cache.js` y `js/nav.js`; no usar `js/app.js` como fuente de verdad hasta migrarlo o retirarlo formalmente.

## Lotes

### `am_lotes_v2_{userId}`

Dueño de escritura: `js/cache.js`, `js/lote-nuevo.js`, `js/dashboard-lotes.js`.

Fallback legacy: `am_global_lotes_v2`.

Forma:

```json
{
  "lotes": [
    {
      "id": "string",
      "nombre": "string",
      "polygon": [{ "lat": -31.0, "lng": -58.0 }],
      "geojson": { "type": "Feature", "geometry": { "type": "Polygon" } },
      "data": {}
    }
  ],
  "activo": "loteId"
}
```

Campos recomendados en `lote.data`:

```json
{
  "coord": "-31.42650,-58.26000",
  "superficie": 152.5,
  "cultivo": "Trigo",
  "fechaSiembra": "2026-06-07",
  "fechaSiembraReal": "2026-06-07",
  "sueloTipo": "Vertisol",
  "clienteId": "string",
  "clienteNombre": "string",
  "planificacionSiembra": {
    "Trigo": "2026-06-07",
    "Soja": "2026-11-10"
  },
  "campanasActivas": {
    "planfina": "fina-2026",
    "plangruesa": "gruesa-2026"
  },
  "satMonitor": {
    "fecha": "2026-06-07T18:00:00.000Z",
    "ndvi": 0.62,
    "cv": 14.2,
    "anomaliasPct": 8.5,
    "severidad": "media",
    "fuente": "Sentinel-2 · Agromonitoring"
  }
}
```

Reglas:

- `AM_LOTE_ACTIVO` debe ser siempre un `id` presente en `AM_LOTES`.
- `js/cache.js` ejecuta `amNormalizarEstadoLotes()` al cargar y antes de persistir para corregir un activo inexistente o una lista vacia.
- Si se elimina el lote activo, el nuevo activo debe ser el primer lote disponible o `default`.
- Las coordenadas se guardan como string `lat,lon` para compatibilidad, pero los mapas deben preferir `polygon`/`geojson` cuando existan.

Helpers publicos:

- `amGetLoteActivo()` devuelve el objeto de lote activo ya validado.
- `amNormalizarEstadoLotes()` corrige `AM_LOTES`/`AM_LOTE_ACTIVO` sin refrescar UI por si un modulo necesita sanear estado antes de operar.

## Campañas

### `am_campana_activa_id`

Dueño de escritura: `js/campanas.js`, `js/cache.js` solo como sincronizacion al cambiar lote.

Forma: string con el id de campaña activa.

### IndexedDB `am_campanas_db` / store `campanas`

Dueño de escritura: `js/campanas.js`.

Fallback localStorage: `am_campanas_v2`.

Campos principales:

```json
{
  "id": "string",
  "lote_id": "string",
  "estado": "planificacion|activa|cosechado|archivado",
  "modo": "fina|gruesa|monitoreo",
  "cultivo": "Trigo",
  "fecha_siembra": "2026-06-07",
  "campana_anterior_id": "string|null"
}
```

## Store UI legacy

### `am_store_state`

Dueño de escritura: `js/store.js`.

Uso: estado simple de UI y compatibilidad. No reemplaza a `AM_LOTES`.

```json
{
  "cultivo": "Soja",
  "fecha": "2026-06-07",
  "coordenadas": "-31.0,-58.0",
  "loteId": "default"
}
```

## Clientes

### `am_clientes_v1_{userId}`

Dueño de escritura: `js/clientes.js`.

Fallback legacy: `am_clientes_v1`.

Forma:

```json
[
  {
    "id": "string",
    "nombre": "string",
    "notas": "string",
    "creadoEn": "ISO date"
  }
]
```

Regla: los lotes guardan `clienteId` y `clienteNombre` dentro de `lote.data`.

## SoilGrids

### `sg_full_{loteId}`

Dueño de escritura: `js/siembra-apis.js`.

Consumidores: dashboard/monitoreo, mapas, suelo.

Forma:

```json
{
  "ts": 1710000000000,
  "data": {
    "ph": 6.2,
    "textura": "Vertisol",
    "clay": 48,
    "sand": 12,
    "soc": 14.2,
    "n": 1.3,
    "da": 1.25,
    "cec": 32
  }
}
```

Regla: si se actualiza SoilGrids, persistir tambien los campos normalizados en `lote.data` (`sg-ph`, `sg-textura`, `sg-clay`, etc.).

## Fenología e hídrico

Claves legacy/cache:

- `am_fen_activo`
- `am_fen_kc_hoy`
- `am_fen_etapa_hoy`
- `am_fen_gdd_acum`
- `am_fen_agua_perfil`
- `am_hidrico_ultimo`

Dueños de escritura: `js/fenologia.js`, `js/hidrico.js`.

Regla: monitoreo debe calcular desde lote/campaña cuando pueda. Estas claves son cache operativo para módulos legacy y PDF.

## Sanidad

Plagas y enfermedades no deben pedir cultivo, fecha o coordenadas si hay lote activo. Deben derivar:

1. `lote.data.cultivo` o cultivo planificado/activo.
2. `lote.data.fechaSiembraReal` / `fechaSiembra` / `planificacionSiembra`.
3. `polygon`/`geojson`/`coord`.

Las alertas solo son alarmas cuando coinciden:

- condiciones ambientales favorables,
- ventana estacional,
- etapa fenologica vulnerable.

## Mapas satelitales

### `lote.data.satMonitor`

Dueño de escritura: `js/mapa.js`.

Forma:

```json
{
  "fecha": "ISO date",
  "ndvi": 0.62,
  "cv": 14.2,
  "anomaliasPct": 8.5,
  "severidad": "baja|media|alta",
  "fuente": "Sentinel-2 · Agromonitoring|Modelo AgroMotor"
}
```

Regla: el modulo puede usar grilla temporal en memoria, pero solo persiste resumen compacto en el lote.

## Claves legacy a no extender

No crear nuevas dependencias fuertes sobre estas claves si se puede leer desde `lote.data`:

- `am_lote_nombre`
- `am_lote_awc_mm`
- `am_siembra_cultivo`
- `am_siembra_fecha`
- `am_cultivo`
- `am_siembra_lat`
- `am_siembra_lon`
- `am_campana_id`

## Checklist para nuevos módulos

- Leer primero `AM_LOTES` + `AM_LOTE_ACTIVO`.
- Si existe, usar `amGetLoteActivo()` en lugar de repetir busquedas manuales.
- Escribir resumen persistente dentro de `lote.data`.
- Usar prefijo propio si se necesita cache local (`modulo_nombre_*`).
- Documentar la clave en este archivo.
- No exponer funciones globales con nombres genéricos.
- Si se expone global, usar prefijo de módulo (`mapaSat*`, `dl*`, `sv*`, etc.).
