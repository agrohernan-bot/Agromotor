# AgroMotor — Guía para agentes de IA

> Guía técnica de arquitectura y contratos para Claude Code, Codex y cualquier otro agente que trabaje en este repositorio.
> Versión abreviada con reglas críticas: [AGENTS.md](./AGENTS.md).

---

## 1. Cómo arranca la app

La aplicación es una SPA 100% client-side desplegada en Vercel.

**Punto de entrada real:**
```
app.html          ← carga todos los módulos y contiene HTML de los 15 paneles
js/cache.js       ← inicializa AM_LOTES, AM_LOTE_ACTIVO; expone helpers de estado
js/nav.js         ← lazy-loader de módulos; expone switchMod(), _activarModulo()
```

**`js/app.js` fue eliminado** — era código legacy que nunca se cargó en `app.html`. El arranque real sigue siendo `app.html` + `js/cache.js` + `js/nav.js`.

El flujo de carga es:
1. `app.html` parsea → carga `cache.js` (IIFE, expone globals en `window.*`)
2. `cache.js` se ejecuta → `DOMContentLoaded` → `amCargarLotesGlobales()` → `AM_LOTES` poblado
3. `nav.js` se ejecuta → `switchMod()` disponible → módulos se cargan lazy vía `<script>` tag

---

## 2. Estado y lote activo

### API pública de `cache.js`

| Función | Cuándo usarla |
|---|---|
| `amGetLoteActivo()` | Leer el lote activo. Puede retornar `null` si `AM_LOTES` no fue cargado todavía. **Siempre null-chequear el resultado.** |
| `amNormalizarEstadoLotes()` | Solo cuando hay que sanear estado (lote activo inválido, lista vacía). Garantiza al menos el lote `default`. |
| `amGuardarLotesEstado()` | Persistir cambios al lote activo en localStorage. Llamar después de modificar `lote.data`. |
| `amCargarLotesGlobales()` | Reiniciar desde localStorage. Lo llama el sistema; raramente necesario en módulos. |

### Reglas de escritura

- **No escribir `window.AM_LOTES` ni `window.AM_LOTE_ACTIVO` directamente** salvo en `cache.js`, `lote-nuevo.js` y `dashboard-lotes.js` (dueños declarados en `STATE_CONTRACT.md`).
- Los módulos de monitoreo/análisis son **solo lectura**: consumen el lote activo pero no lo modifican.
- Toda lectura de lote en módulos críticos debe pasar por `amGetLoteActivo()`. El test CI verifica esto para plagas, alerta-sanitaria, mapa, siembra-variable, nutricion y cultivares.

### Claves localStorage relevantes

```
am_lotes_v2_{userId}   ← lotes del usuario logueado  { lotes: [...], activo: "id" }
am_global_lotes_v2     ← fallback sin sesión
am_campana_activa_id   ← UUID de campaña activa
```

Ver `docs/STATE_CONTRACT.md` para la forma completa de cada clave y los módulos dueños.

---

## 3. Herencia de datos entre módulos

Los módulos de análisis deben **heredar** cultivo, fecha de siembra, coordenadas y polígono desde el lote activo/campaña. **No volver a pedir esos datos al usuario si ya existen.**

```js
// Patrón correcto
const lote = amGetLoteActivo();
if (!lote) return;
const d = lote.data || {};
const cultivo = d.cultivo || 'soja';
const coord   = d.coord;          // "-31.4,-62.9"
const polygon = lote.polygon;     // GeoJSON
const fecha   = d.planificacionSiembra?.[campaña]?.fechaSiembraConf
             || d.fechaSiembra
             || '';
```

Módulos que implementan esto hoy: `plagas.js` (`plagasPrepararAutoLote`), `alerta-sanitaria.js` (`asPrepararAutoLote`), `fenologia.js` (modo seguimiento via `fsPrepararDetalleLote`), `mapa.js`, `siembra-variable.js`.

---

## 4. Versionado y Service Worker

### La convención activa

```
js/config.js?v=N     ← query param en app.html para cargar config.js
assetVersion: N+1    ← declarado dentro de config.js
SW_VERSION           ← tomado de sw.js?v=assetVersion al registrar el SW
CACHE_NAME           ← 'agromotor-' + SW_VERSION
```

**Ejemplo actual:** `config.js?v=100` en `app.html`, `assetVersion: '101'` en `config.js`. El SW se registra como `sw.js?v=101`, dando `CACHE_NAME = 'agromotor-101'`.

### Protocolo de bump

Cuando se tocan archivos servidos al usuario (JS, CSS, HTML):

```
1. Incrementar assetVersion en js/config.js  (de N+1 a N+2)
2. Actualizar query param en app.html:        config.js?v=N+1
```

El test CI `assetVersion, config query y service worker versionado quedan alineados` falla si los dos valores no cumplen la relación `config_query === assetVersion - 1`.

**No tocar `sw.js` manualmente para cambiar la versión de caché.** El SW la toma del query param automáticamente.

---

## 5. Globals: convención de nombres

No exponer funciones genéricas en `window`. Usar prefijos por módulo:

| Módulo | Prefijo | Ejemplos |
|---|---|---|
| cosecha.js | `cos` | `cosShowTab`, `cosLimpiarHistorial` |
| pulverizacion.js | `pulv` | `pulvCalcBuffer`, `pulvCalcCaldo` |
| siembra-variable.js | `sv` | `svDibujarPoligono` |
| dashboard-lotes.js | `dl` | `dlSgRefrescar` |
| alerta-sanitaria.js | `as` | `asAnalizar`, `asPrepararAutoLote` |
| plagas.js | `amPlagas` / `plagas` | `plagasPrepararAutoLote`, `amAnalizarPlagas` |
| mapa.js | `sat` | `satLoteActivo`, `satRenderMap` |

El test CI `Cosecha y Pulverizacion no reintroducen globals genericos conflictivos` verifica que `window.showTab` y `window.limpiarHistorial` no existan.

---

## 6. Tests

```bash
node --test tests/state-contract.test.js
```

Suite actual: **10 tests, 0 fallos.**

### Qué cubre hoy

| Test | Qué verifica |
|---|---|
| `cache normaliza y persiste lote activo inexistente` | `amCargarLotesGlobales()` corrige y persiste un activo inválido |
| `cache crea lote default cuando la lista queda vacia` | Lista vacía → lote `default` creado |
| `modulos criticos leen el lote activo via helper central` | plagas, alerta-sanitaria, mapa, sv, nutricion, cultivares usan `amGetLoteActivo` |
| `Plagas hereda cultivo, fecha y contexto desde lote activo` | `plagasPrepararAutoLote()` propaga datos del lote sin pedirlos |
| `Alerta sanitaria hereda cultivo, fecha y coordenadas` | `asPrepararAutoLote()` ídem |
| `nav.js llama a fsPrepararDetalleLote y fsCalcular al activar fen-seg` | Activar fenología-seguimiento dispara cálculo automático |
| `compuerta fenologica de plagas` | `calcPestRisks()` retorna score=0 fuera de ventana vuln |
| `compuerta fenologica de enfermedades` | `calcDiseaseRisks()` retorna score=0 fuera de ventana vuln |
| `Cosecha y Pulverizacion no reintroducen globals genericos` | Sin `window.showTab` ni `window.limpiarHistorial` |
| `assetVersion, config query y SW versionados alineados` | `config.js?v=N`, `assetVersion=N+1`, `sw.js?v=assetVersion` |

### Criterio para tests nuevos

Preferir tests de **comportamiento real** (ejecutar el módulo en `node:vm` con DOM mockeado y verificar outputs) por sobre regex sobre código fuente. Ver los tests de plagas/alerta-sanitaria como referencia.

---

## 7. Módulos sensibles

| Archivo | LOC | Por qué cuidado |
|---|---|---|
| `app.html` | ~4.820 | Contiene HTML de los 15 paneles y lógica inline; cambios aquí pueden romper múltiples módulos |
| `js/pulverizacion.js` | ~4.285 | Módulo más grande (3× el segundo); no refactorizar salvo necesidad concreta |
| `js/cache.js` | ~868 | Fuente de verdad del estado de lotes; contratos cruzados con todos los módulos |
| `js/nav.js` | ~532 | Controla lazy-loading y activación de módulos; un error aquí rompe la navegación completa |
| `js/dashboard-lotes.js` | ~1.857 | Dashboard principal; carga datos y llama a `dlSgRefrescar` |
| `js/plagas.js` | ~1.016 | Lógica de riesgo + compuerta fenológica; expone `window.amPlagasUtils` para tests |
| `js/alerta-sanitaria.js` | ~683 | Ídem para enfermedades; expone `window.asUtils` para tests |
| `js/siembra-variable.js` | ~936 | Validación de polígono real (no solo centroide); no simplificar la geometría |

---

## 8. Estilo de cambios

- **Commits chicos y verificables.** Un fix de bug no debería incluir refactors no relacionados.
- **Correr los tests antes de pushear.** El CI corre `node --test tests/state-contract.test.js` en cada push/PR a main.
- **No mezclar fixes funcionales con deuda técnica.** Si se detecta deuda, documentarla o abrirla como paso separado.
- **No usar `--no-verify`.** Si un hook falla, corregir la causa.
- **Bump de versión**: siempre los dos archivos juntos (`config.js` + `app.html`). El test CI lo verifica.
- **Herencia de datos**: antes de añadir un `<input>` que pide cultivo/fecha/coord, verificar si el lote activo ya los tiene.
