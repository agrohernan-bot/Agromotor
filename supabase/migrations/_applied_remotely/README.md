# Migraciones ya aplicadas en producción

Los archivos en esta carpeta **NO deben correrse nuevamente**.
Ya fueron aplicados en el proyecto Supabase remoto (Agromotor — xsbaqlqztppdpdcjgazz).

## 003_mercadopago.sql
- Contenido: tablas `subscriptions` y `payments` + constraint de planes
- Aplicado remotamente como migración 008 (via Supabase MCP)
- Fecha: mayo 2026

⚠️  Si corrés `supabase db push` o `supabase migration up`, asegurate de que
    estos archivos **no** estén en la carpeta `migrations/` raíz.
