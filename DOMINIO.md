# Configurar dominio propio (`agromotor.com.ar`)

AgroMotor está migrado a Vercel. El dominio público debe resolverse desde Vercel.

## Checklist

- Dominio comprado en NIC.ar: `agromotor.com.ar`
- Proyecto asignado en Vercel: `agromotor.com.ar` y `www.agromotor.com.ar`
- SSL: automático desde Vercel
- Deploy activo: `vercel.json`
- Supabase Auth:
  - Site URL: `https://agromotor.com.ar`
  - Redirect URLs: `https://agromotor.com.ar/**`, `https://agromotor.com.ar/app.html`, `https://www.agromotor.com.ar/**`

## Verificación rápida

```bash
nslookup agromotor.com.ar
nslookup www.agromotor.com.ar
```

En Vercel, ambos dominios tienen que figurar como válidos y con certificado activo.
