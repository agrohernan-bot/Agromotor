# Guardrails de fertilizacion liquida en surco

Fuentes incorporadas desde Google Drive:

- `Especificacion Tecnica Fertilizacion Liquida.docx`
  - Drive ID: `1in244CzHUKhC-S07SFHi8ayRxUXs6Pyv`
  - Uso en AgroMotor: diferenciar fertilizacion starter en surco de nutricion masiva/base, y advertir riesgo de fitotoxicidad cerca de semilla.
- `Especificacion Tecnica de Uso y Compatibilidad de Productos.docx`
  - Drive ID: `1W1h6hitQ-ikbrMZ6LQi74qrUXNOq0hEf`
  - Uso en AgroMotor: bloquear productos o mezclas no compatibles operativamente con sistemas de dosificacion liquida en surco.

## Reglas implementadas

1. Starter vs nutricion masiva
   - Starter: producto liquido, homogeneo, formulado/recomendado para aplicacion localizada en linea de siembra.
   - Nutricion masiva: urea, MAP, KCl, fuentes de reposicion/base o dosis que exceden una logica starter.
   - Resultado: advertencia trazable en Nutricion y Siembra si el plan nutricional podria confundirse con una aplicacion liquida starter en surco.

2. Fitotoxicidad cerca de semilla
   - Dispara con alta carga salina, alta CE, indice salino alto, alto N/P o dosis superior a rango starter.
   - Resultado: advertencia con motivo agronomico concreto: riesgo de menor emergencia, perdida de stand o dano inicial.

3. Bloqueo operativo
   - Bloquea solidos en suspension, sedimentos, precipitados/decantacion, formulaciones no completamente liquidas o productos que requieren agitacion permanente.
   - Resultado: veredicto `incompatible` en Pulverizacion para mezclas en surco afectadas.

4. Mezclas no validadas
   - La compatibilidad individual no se asume como compatibilidad de mezcla.
   - Resultado: bloqueo si una mezcla en surco incluye componentes marcados como no validados para tanque/equipo.

La implementacion viva esta en `js/surco-guardrails.js` y se consume desde `js/nutricion.js`, `js/siembra.js` y `js/pulverizacion.js`.
