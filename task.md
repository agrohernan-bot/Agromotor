# Tareas de Integración y Mejoras en AgroMotor (Fase 2 - Ajustes)

- [x] Corregir las Exportaciones de Siembra Variable
  - [x] Adaptar `_features()` en `js/siembra-variable.js` para exportar `dosis_semilla_kg_ha` en trigo/cebada/soja
  - [x] Adaptar `exportarCSVPresc()` en `js/siembra-variable.js` para usar cabecera dinámica
  - [x] Corregir `exportarCSVMonitor()` en `js/siembra-variable.js` para no multiplicar por 10,000 en trigo/cebada/soja
- [x] Atribución de OSM y countrycodes en Buscador
  - [x] Agregar atribución obligatoria de OpenStreetMap en el modal (`js/lote-nuevo.js`)
  - [x] Agregar el parámetro `&countrycodes=ar` en el fetch de Nominatim (`js/lote-nuevo.js`)
- [x] Guardar task.md y walkthrough.md en la raíz del proyecto
  - [x] Copiar `task.md` a la raíz
  - [x] Copiar `walkthrough.md` a la raíz
- [x] Ampliar Tests Unitarios
  - [x] Test unitario del buscador (URL y parámetros de Nominatim)
  - [x] Test unitario de generación de PDF con notas manuales
- [x] Verificar y Desplegar
  - [x] Ejecutar `node --test tests/state-contract.test.js`
  - [x] Hacer commit y push a producción
