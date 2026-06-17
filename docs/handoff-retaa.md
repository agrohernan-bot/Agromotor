# Handoff — Módulo Densidad ReTAA

> Sesión 2026-06-17 · Resumen para retomar el trabajo (Codex u otro agente).

## Qué se hizo

Integramos la densidad de siembra **observada a campo** (Relevamiento de Tecnología
Agrícola Aplicada, Bolsa de Cereales) en AgroMotor. Origen: briefing de Hernán Ferrari
+ prototipo `retaa-v3.html`. Resuelve el reclamo de colegas que no coincidían con las
densidades recomendadas por zona: ahora ven el dato real relevado en su subregión, con
fuente, no una recomendación teórica.

## Archivos nuevos (núcleo compartido)

- `js/densidad-retaa-db.js` → `window.AM_RETAA_DB`: 15 subregiones × 6 cultivos
  (maíz, soja, girasol, trigo, cebada, sorgo), con dosis N/P, nivel tecnológico,
  tendencia multicampaña y bandera de calidad ◉ real / ◎ estimado / ◈ sorgo.
- `js/densidad-retaa.js` → `window.AM_RETAA`: `getSubregion(lat,lon)`, `calcular(opts)`,
  `derivarFecha`, `prepararDesdeLote`, `renderTendencia`. **Solo lectura**, hereda
  lat/lon/cultivo/fecha del lote activo vía `amGetLoteActivo()`.

## Archivos modificados

- `js/nav.js`: `densidad-retaa-db.js` + `densidad-retaa.js` agregados como dependencias
  (en orden db→lógica→consumidor) de `cultivares` y `siembra-variable` en `modLazy`.
- `js/cultivares.js`: `cvRenderReTAA()` invocada desde `cvActualizar()`. Tarjeta con
  densidad **editable** + tendencia.
- `js/siembra-variable.js`: cartel de referencia ReTAA en la prescripción (6 cultivos)
  + autollenado de los campos `sem/m²` distribuidos por zona NDVI **solo en maíz/girasol**.
- `app.html`: tarjeta `cv-retaa-card` en el panel de Cultivares.
- `tests/state-contract.test.js`: 6 tests de comportamiento nuevos.

## Decisiones importantes (respetar)

1. **NO se siguió la arquitectura del briefing** (asumía ES modules / `import` /
   `loadModule` / `gv()`). Se tradujo al patrón real de AgroMotor: IIFE + globals con
   prefijo + carga lazy por `nav.js` + `amGetLoteActivo()`.
2. **SV solo autollena maíz/girasol**: los campos de Siembra Variable están en `sem/m²`
   (rango 2–15), ReTAA da `mil pl/ha` o `kg sem/ha`. La conversión limpia solo existe
   para maíz/girasol (entran en rango). Soja/trigo/cebada (kg/ha, necesitan PMS) y sorgo
   (~24 sem/m², fuera de rango) quedan **solo como cartel de referencia**.
3. **Bug del prototipo corregido**: el sorgo dividía la densidad ÷1000 (mostraba
   0,2 mil pl/ha en vez de 190). Hay test de regresión.
4. Encuadre: ReTAA es **dato observado, editable**, no imposición.

## Estado

- **21/21 tests** verde (`node --test tests/state-contract.test.js`).
- Versionado: **assetVersion 149**, `config.js?v=148` (bump dual respetado).
- 3 commits pusheados a `main` (fundación → Cultivares → Siembra Variable). En producción.

## Pendientes

- **Sorgo regional es estimado (◈)** — conseguir el PDF ReTAA de sorgo para reemplazar
  por dato real ◉.
- La densidad editable en Cultivares (`cv-retaa-dens-edit`) **no se persiste al lote**
  todavía — es display/referencia.
- Maíz tiene una sola campaña (2021/22, año seco): referencia válida pero conviene
  sumar campañas.
- Falta verificación en browser logueado (la SPA requiere login Supabase + lote con
  coords); se verificó sintaxis + tests + smoke test del gráfico.

## Aparte (no relacionado al módulo)

- Se limpió código muerto en `pulverizacion.js` y se movió el PDF de orden de mezcla a `docs/`.
- El hook `check-sql-files.py` (de un plugin) falla en cada edición por ruta inexistente —
  no afecta nada, conviene sacarlo del `settings.json`.
