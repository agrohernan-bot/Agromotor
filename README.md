# 🌾 AgroMotor

> Motor agronómico de decisión exclusivo para Ingenieros Agrónomos matriculados de Argentina.

**🌐 URL pública:** https://agromotor.com.ar
**📦 Repo:** https://github.com/agrohernan-bot/Agromotor

[![Status](https://img.shields.io/badge/status-en%20producci%C3%B3n-success)]() [![Stack](https://img.shields.io/badge/stack-Vanilla%20JS%20%2B%20Supabase-blue)]()

## 📋 Qué es

AgroMotor es una **SPA (single page app)** con 17 módulos del flujo agronómico completo:

```
Planificación  →  Implantación  →  Nutrición  →  Economía  →  Sanidad  →  Avanzado
   (3 mods)      (3 mods)       (3 mods)     (3 mods)     (3 mods)    (2 mods)
```

Datos en tiempo real desde 7 APIs externas (Open-Meteo, NASA POWER, SoilGrids ISRIC, ENSO/NOAA, DolarAPI, BCRA, Agromonitoring) + Asistente IA conectado a Anthropic Claude Sonnet 4.5.

**Exclusivo para profesionales matriculados** — registro requiere número de matrícula y CPIA (Consejo Profesional de Ingeniería Agronómica) declarado bajo juramento.

## 🛠️ Stack técnico

| Capa | Tecnología | Por qué |
|---|---|---|
| **Frontend** | Vanilla JS + HTML + CSS, sin framework | App de 18k LOC, 100% lazy modular, ~50 KB JS inicial |
| **Hosting** | Vercel | Estático, CDN global, deploy automático desde GitHub |
| **DNS / SSL** | Vercel | Dominio agromotor.com.ar con SSL Let's Encrypt automático |
| **Auth + DB** | Supabase (Postgres) | RLS policies, Auth con email + magic link |
| **Edge Functions** | Supabase Edge (Deno) | `claude-proxy`, `mp-crear-suscripcion`, `mp-webhook` |
| **PWA** | Service Worker propio | Cache-first local + Network-first APIs + auto-update |
| **PDF** | jsPDF | Reportes brandeable con membrete profesional |
| **Mapas** | Leaflet + Esri Imagery + OpenStreetMap | Sin API key, mejor performance |
| **Cobros** | Mercado Pago Preapproval (Argentina) | Suscripciones recurrentes en ARS |
| **IA** | Anthropic Claude Sonnet 4.5 | Vía edge function como proxy |

## 📁 Estructura del repo

```
/                       → landing pública (index.html)
/app.html               → la app (SPA con 17 módulos)
/css/                   → CSS
/js/                    → módulos JS (lazy-loaded por nav.js)
  ├── core.js, login.js, cache.js, nav.js
  ├── siembra.js, suelo.js, hidrico.js, ...  (17 módulos)
  ├── pdf.js + pdf-modulo.js                 (reportes brandeable)
  ├── onboarding.js                          (tutorial primer uso)
  └── dashboard-ux.js                        (status badges + offline banner + PWA install)
/supabase/
  ├── migrations/                            (8 migraciones aplicadas)
  └── functions/                             (claude-proxy, mp-*, health-check)
/sw.js                  → Service Worker
/manifest.json          → PWA manifest
/og-image.{html,png}    → social preview
/sitemap.xml, robots.txt → SEO
/STATUS.md              → estado actual + pendientes
```

## 🚀 Cómo desarrollar localmente

```bash
# Clonar
git clone https://github.com/agrohernan-bot/Agromotor.git
cd Agromotor

# Servir local (cualquier static server sirve)
python -m http.server 8000
# o
npx serve .

# Abrir
http://localhost:8000/         → landing
http://localhost:8000/app.html → app

# Para que funcione el login Supabase, las APIs externas se llaman directo
# desde el browser. No hace falta backend local.
```

### Para correr migraciones SQL

Vía Supabase CLI o el dashboard:
```bash
supabase migration up   # local con CLI
# o pegar el SQL en https://supabase.com/dashboard/project/xsbaqlqztppdpdcjgazz/sql
```

### Para deployar Edge Functions

```bash
supabase functions deploy claude-proxy
supabase functions deploy mp-webhook
supabase functions deploy mp-crear-suscripcion
```

## 🔐 Secrets de producción

| Secret | Dónde |
|---|---|
| `CLAUDE_API_KEY` | Supabase secrets (Anthropic console) |
| `MP_ACCESS_TOKEN` | Supabase secrets (Mercado Pago panel) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase auto |
| `SUPABASE_URL` | Supabase auto |

Configuración pública (no secret):
- `js/config.js` → `AM_CONFIG.supabase.url`, `anonKey`, `claudeProxy`, `agromonitoringKey`

## 💰 Modelo comercial

```
Demo        Gratis · 1 lote · solo Siembra
Asesor      USD 35/mes · 5 lotes · IA 30 cons/mes
Pro     ⭐  USD 90/mes · 25 lotes · IA 100 cons/mes · PDF brandeable
Empresa     USD 250/mes · 75 lotes · IA 300 cons/mes · NDVI · API
```

Trial 14 días gratis al registrarse en cualquier plan pago. Cobro automático mensual via Mercado Pago Preapproval.

## 🧠 Lógica agronómica de referencia

- **Cultivares**: RECSO/INTA 2024-25 + Andrade/Enrico (INTA Oliveros)
- **Balance hídrico**: ETC FAO + ENSO/NOAA + reservas iniciales
- **Fertilización**: tablas Echeverría & García (INTA Balcarce)
- **Dosis óptima**: curvas respuesta cuadrática (INTA Marcos Juárez)
- **Plagas**: umbrales INTA + favorabilidad climática
- **Compactación**: modelo MPa por humedad × tráfico (DB interna pampa)

## 🔄 Auto-update

El SW tiene auto-update: cada 60 segundos chequea cambios. Cuando detecta nueva versión, descarga, instala, y notifica al usuario con un toast — la página recarga sola sin que tenga que hacer nada.

## 🎯 Roadmap próximo

- [ ] Mercado Pago activación final (esperando token de producción)
- [ ] Verificar SSL HTTPS Enforced en agromotor.com.ar
- [ ] Panel admin para verificar matrículas profesionales
- [ ] Acuerdos institucionales con CPIAs (descuento del 30% para matriculados)
- [ ] Integración con SIGA / SISA / AFIP factura electrónica
- [ ] App nativa Android (wrap PWA con Capacitor)
- [ ] Versión Uruguay / Paraguay (mismo stack, diferente DB cultivos)

## 📊 Estado del sistema

Ver `STATUS.md` para el estado actual detallado, bugs corregidos, pendientes y comandos útiles.

## 👥 Equipo

| Rol | Persona |
|---|---|
| **Producto + Agronomía** | Ing. Agr. Hernán Ferrari ([@agrohernan-bot](https://github.com/agrohernan-bot)) |
| **Administración + Mercado Pago** | Rodrigo Romero |
| **Desarrollo asistido** | Claude (Anthropic) |

## 📜 Licencia

Propiedad de AgroMotor. Todos los derechos reservados.

---

**¿Preguntas?** hola@agromotor.com.ar
