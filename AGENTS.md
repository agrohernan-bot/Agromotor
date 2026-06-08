# AgroMotor — Reglas críticas para agentes

Guía rápida de las reglas que más frecuentemente se rompen. Para la arquitectura completa, leer [CLAUDE.md](./CLAUDE.md).

---

## Arranque real

```
app.html + js/cache.js + js/nav.js   ← arranque real
js/app.js                            ← NO cargado, no usar como referencia
```

## Estado de lote

```js
const lote = amGetLoteActivo();   // puede retornar null — siempre null-chequear
if (!lote) return;

// Heredar datos del lote (no pedir de vuelta al usuario)
const cultivo = lote.data?.cultivo || 'soja';
const coord   = lote.data?.coord;
const fecha   = lote.data?.fechaSiembra || '';

// Persistir cambios
lote.data.miCampo = valor;
amGuardarLotesEstado();

// Sanear estado corrupto (solo cuando necesario)
amNormalizarEstadoLotes();
```

**No escribir `window.AM_LOTES` ni `window.AM_LOTE_ACTIVO` directamente.**

## Versionado — siempre los dos juntos

```
js/config.js   →  assetVersion: 'N+1'
app.html       →  config.js?v=N
```

No tocar `sw.js` para cambiar versión de caché; se actualiza automáticamente.

## Globals — usar prefijos

| ❌ No | ✅ Sí |
|---|---|
| `window.showTab` | `window.cosShowTab` |
| `window.limpiarHistorial` | `window.cosLimpiarHistorial` |
| `window.exportPDF` | `window.cosExportPDF` |
| `window.calcBuffer` | `window.pulvCalcBuffer` |

Prefijos por módulo: `cos*`, `pulv*`, `sv*`, `dl*`, `as*`, `plagas*` / `amPlagas*`, `sat*`.

## Tests — correr antes de pushear

```bash
node --test tests/state-contract.test.js   # debe dar 10/10
```

## Módulos grandes — tocar con cuidado

- `app.html` (~4.820 líneas) — 15 paneles + lógica inline
- `js/pulverizacion.js` (~4.285 líneas) — no refactorizar sin necesidad concreta
- `js/cache.js`, `js/nav.js` — contratos cruzados con todos los módulos

---

Para detalles de cada punto: [CLAUDE.md](./CLAUDE.md) y [docs/STATE_CONTRACT.md](./docs/STATE_CONTRACT.md).
