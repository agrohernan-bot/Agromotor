# Walkthrough — Mejoras de Usabilidad y Reparaciones en AgroMotor (Fase 2)

Se completaron con éxito las mejoras técnicas y de usabilidad del ciclo del cultivo, siguiendo la devolución técnica de Codex y priorizando la precisión agronómica y la robustez del sistema.

---

## Cambios Realizados

### 1. Calculadora de Semillas (kg/ha ⇄ pl/m²)
- **Módulo Cultivares (`app.html` & `js/cultivares.js`)**:
  - Se agregó una interfaz interactiva de calculadora de semillas en la tarjeta ReTAA con inputs para `PMS (g)`, `PG (%)` y `Logro (%)`.
  - Se implementó `window.cvCalcularEquivalenciaSemilla()` para realizar la conversión dinámica basada en el cultivo:
    - **Grano Fino/Soja** (Trigo, Cebada, Soja): La densidad original está en `kg sem/ha`. La calculadora calcula las **plantas logradas/m²**:
      $$\text{plantas/m²} = \frac{\text{Dosis (kg/ha)} \times \text{PG\%} \times \text{logro\%}}{\text{PMS(g)} \times 100}$$
    - **Grano Grueso** (Maíz, Girasol): La densidad original está en `mil pl/ha` (o `sem/m²`). La calculadora calcula la **dosis en kg/ha**:
      $$\text{Dosis (kg/ha)} = \frac{\text{mil pl/ha} \times \text{PMS(g)} \times 10}{\text{PG\%} \times \text{logro\%}}$$
  - Se guardan `semillaPMS`, `semillaPG` y `semillaLogro` en `lote.data` compartiéndose de manera nativa entre módulos.

- **Módulo Siembra Variable (`js/siembra-variable.js`)**:
  - Se modificó `renderPrescrip()` para cambiar dinámicamente las unidades de la tabla de prescripción a `kg/ha` (rango `30–300 kg/ha`, paso `5`) cuando el cultivo es trigo, cebada o soja, manteniendo la escala `sem/m²` (`2–15`) para maíz o girasol.
  - Se implementó `svDistribuirPorZonaKgHa()` para distribuir la dosis sugerida en kg/ha por zonas.
  - Se ajustó `calcTotales()` para calcular y acumular el total en kg de forma directa para granos finos/soja, y en miles de semillas para granos gruesos.

### 2. Corrección de Exportaciones en Siembra Variable
- **GeoJSON, CSV y CSV de Monitor (`js/siembra-variable.js`)**:
  - Se dinamizaron las propiedades de GeoJSON y cabeceras de CSV: se exporta `dosis_semilla_kg_ha` o `Dosis_semilla_kg_ha` cuando el cultivo del lote activo es trigo, cebada o soja, y `dosis_semilla_sem_m2` o `Dosis_semilla_sem_m2` en cultivos de grueso.
  - En la exportación a monitor VRA (`exportarCSVMonitor`), se corrigió el cálculo de la dosis:
    - Para **trigo/cebada/soja**, `Seed_Rate_ha` se asigna directamente a la dosis ingresada en `kg/ha` (evitando la multiplicación incorrecta por 10,000 que duplicaba la escala para la maquinaria). `Seed_Rate_m2` se calcula estimativamente usando el PMS del lote (`Dosis * 100 / PMS`).
    - Para **maíz/girasol**, se mantiene la multiplicación `Seed_Rate_m2 * 10000` para exportar en semillas/ha.

### 3. Buscador por Localidad en Lote Nuevo
- **Módulo Lote Nuevo (`js/lote-nuevo.js`)**:
  - Se agregó un input `#lnv-search-box` y un botón `"🔍 Buscar"` en el modal de creación de lotes arriba del mapa.
  - Se implementó `window.lnvBuscarLocalidad()` que consume de forma limitada la API pública de Nominatim para geocodificar la búsqueda del usuario y reposicionar el mapa (`setView`) en la coordenada correspondiente.
  - **Atribución legal**: Se inyectó la atribución de copyright obligatoria de OpenStreetMap: `Datos de búsqueda por © OpenStreetMap contributors`.
  - **Filtro geográfico**: Se limitó el endpoint de búsqueda a Argentina añadiendo el parámetro `&countrycodes=ar`, mejorando la velocidad y exactitud de geocodificación.

### 4. Reparación de Inconsistencias de PDF
- **Módulo PDF (`js/pdf-modulo.js`)**:
  - Se corrigió la lectura del campo de días de estrés en etapas críticas para leer la propiedad correcta `d.diasEtCritica ?? d.diasEtCrit`.
  - Se corrigió la sección de **Observaciones Automáticas** para que lea `d.notasAuto` (el array de notas automáticas).
  - Se creó la sección **Observaciones del Profesional** que verifica si `d.notas` (string) tiene contenido e imprime de forma justificada el texto multilínea mediante `splitTextToSize(d.notas, ctx.W - 6)`.

---

## Verificación y Pruebas

### Pruebas Automatizadas
Se incorporaron cuatro tests unitarios en la suite central `tests/state-contract.test.js` para asegurar el correcto funcionamiento matemático y la robustez de las integraciones:
1. `Calculadora de semillas cvCalcularEquivalenciaSemilla calcula dosis equivalentes para Maiz y Trigo`: Verifica que la calculadora compute correctamente los `kg/ha` equivalentes en maíz y las `pl/m²` en trigo utilizando la fórmula de Codex.
2. `Siembra Variable cambia de escala a kg y calcula totales para Trigo vs Maiz`: Valida que la prescripción de siembra variable se adapte de forma dinámica e independiente a `kg` o `miles` según el cultivo del lote activo.
3. `Buscador de lote nuevo consulta a Nominatim con filtro countrycodes=ar`: Valida que la URL de geocodificación de Nominatim esté bien estructurada y contenga la restricción de país.
4. `pdfInformeCierre procesa notas de cierre manuales y automaticas correctamente`: Valida la exportación limpia del reporte final en PDF y que procese las observaciones manuales tipo string sin lanzar excepciones de sintaxis.

Ejecución del test suite:
```bash
node --test tests/state-contract.test.js
```
**Resultado**: `27/27 tests passing` en verde sin regresiones.
