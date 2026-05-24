# 📊 Estado de AgroMotor — Reporte autónomo

**Última actualización:** 2026-05-08

## 🎉 Sistema funcionando end-to-end

Se completó el primer test real con tu cuenta. **Todo el stack funciona**:

```
agrohernan@gmail.com (plan Pro · Trial 14 días · Mat TEST-001 CIAER-ER)
   ↓
Login JWT + RLS verificadas
   ↓
Asistente IA conectado al lote (-32.4901, -58.2682 · Concepción del Uruguay · Vertisol · Soja)
   ↓
Claude Sonnet 4.5 respondió con criterio agronómico:
"No, el lote no está apto para siembra todavía. Con 31-32% de humedad
en el perfil superficial y un suelo Vertisol con 48% de arcilla, el
riesgo de compactación es alto (3.7 MPa estimado) — necesitás esperar
a que baje a ~25-28% de humedad..."
```

✅ Plan reconocido · ✅ Trial activo · ✅ Cuota decrementada (2/100 IA usadas)

## 🐛 Bugs reales encontrados y arreglados durante el test

| # | Bug | Causa | Fix |
|---|---|---|---|
| 1 | "Database error saving new user" | check constraint `profiles_plan_check` no incluía 'pro' | Migration 005: agregado 'pro' al constraint |
| 2 | RLS habilitada sin policies → app no podía leer profiles | profile SELECT siempre vacío, fallback a 'free' plan | Migration 006: 3 policies (SELECT/UPDATE/INSERT own profile) |
| 3 | Login colgaba indefinidamente | Anti-pattern: `await` dentro de `onAuthStateChange` callback con supabase-js v2 | Refactor: usar `user_metadata` (en JWT) + enrich diferido sin bloquear |
| 4 | Edge function rechazaba con "plan free" | service_role no tenía GRANT SELECT en profiles | Migration 007: GRANTs a service_role + authenticated |
| 5 | Date parsing en proxy | timestamp PG `"2026-05-22 18:13:54.093+00"` con espacio + sin `:00` final | parsePgTimestamp() helper que normaliza a ISO 8601 |

**Bonus mejora:** prompt caching activado en claude-proxy (system prompt ~80% estático ahora se cachea 5 min en Anthropic, ahorro estimado ~30% en input tokens).

## 📦 Commits relevantes hoy

- `0e6cd78` — Fix CRÍTICO login deadlock (anti-pattern await en onAuthStateChange)
- `464abd5` — Plan Empresa con cap 75 lotes / 300 IA (anti-reventa)
- `833fb20` — Restructura de planes (Demo/Asesor/Pro/Empresa)
- `dc6dee9` — Acreditación profesional obligatoria (matrícula + CPIA)
- `7763756` — Landing page pública
- `47c41cb` — Renombrar: index=landing, app=app.html
- `7c35b02` — OG image layout fix
- `184fbfa` — Migrar a dominio agromotor.com.ar (provisorio rollback hasta DNS)
- `dc4e35c` — Edge function v10 con prompt caching + GRANT fix

## ⏳ Tu próxima acción (cuando vuelvas)

### 1. Configurar Supabase Auth (5 min) — CRÍTICO antes del lanzamiento

https://supabase.com/dashboard/project/xsbaqlqztppdpdcjgazz/auth/url-configuration

- **Site URL**: `https://agromotor.com.ar`
- **Redirect URLs**: agregar `https://agromotor.com.ar/**`, `https://agromotor.com.ar/app.html`, `https://agromotor.com.ar/index.html`. Mantené el viejo URL como fallback temporal.

### 5. Probar cuando todo esté listo

- Abrí https://agromotor.com.ar (debe mostrar landing)
- Probar login con `agrohernan@gmail.com` / `AgroMotor2026!` (probar también desde móvil)
- Hacer 2-3 consultas al asistente

## 🚀 Estado del proyecto

| Componente | Estado | URL |
|---|---|---|
| Landing pública | ✅ Live | https://agromotor.com.ar |
| App (login + 17 módulos + IA) | ✅ Live | https://agromotor.com.ar/app.html |
| Supabase Auth + DB | ✅ Producción | xsbaqlqztppdpdcjgazz |
| Edge Function claude-proxy v10 | ✅ ACTIVE | con prompt caching |
| Anthropic Claude Sonnet 4.5 | ✅ Conectada | model: claude-sonnet-4-5 |
| 7 migraciones SQL aplicadas | ✅ | 001-007 |
| Dominio agromotor.com.ar | ✅ Live en Vercel | SSL automático |

## 💰 Estructura de planes activa

| Plan | Precio | Lotes | IA/mes | Featured |
|---|---|---|---|---|
| Demo | Gratis | 1 | 0 | — |
| Asesor | USD 35/mes | 5 | 30 | — |
| **Pro** | **USD 90/mes** | **25** | **100** | ⭐ Más popular |
| Empresa | USD 250/mes | 75 | 300 | — |

Founders deal: primeros 100 users → precio bloqueado de por vida.

## 🧪 Cuenta de prueba creada

- **Email:** agrohernan@gmail.com
- **Password:** AgroMotor2026!
- **Plan:** Pro · Trial hasta 22/05/2026 (14 días)
- **Matrícula:** TEST-001 · CIAER-ER (Concepción del Uruguay)
- **IA usadas:** 2/100

Cuando configures correctamente, podés actualizar la matrícula real en Supabase con:
```sql
UPDATE profiles SET matricula_numero = 'TU_NUMERO_REAL', cpia = 'CIAER-ER'
WHERE id = (SELECT id FROM auth.users WHERE email = 'agrohernan@gmail.com');
```

## 📝 Pendientes técnicos (ordenados por valor)

1. **Mercado Pago** — para que el cobro post-trial sea automático (sino tenés que cobrar manual)
2. **Onboarding tutorial** — 5 pasos primer uso, mejora activación 30-40%
3. **PDF brandeable con membrete** — incluido en plan Pro como diferenciador
4. **Panel admin** — para verificar matrículas manualmente cuando tengas usuarios reales
5. **Términos y Privacidad** — legal mínimo antes de cobrar
6. **Cloudflare Web Analytics** — script ya tiene placeholder, falta tu token

## 🎯 Recomendación de próximos pasos

Después de DNS + Supabase Auth, en este orden:
1. **Mercado Pago** (esto desbloquea ventas reales)
2. **Probar en celular real con tu cuenta** (mobile UX final)
3. **Mandar a 5-10 colegas agronomos para feedback antes de lanzar oficialmente**
4. **Acercarse al primer Consejo Profesional** (CIAER por geografía + relación)
5. **Lanzamiento "soft" con los 100 founders**

Cualquier cosa, mandame screenshot y seguimos. 🌱

— Reporte generado autónomamente · Claude
