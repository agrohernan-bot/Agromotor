# 🌐 Configurar dominio propio (`agromotor.com.ar`)

Pasos para que la app responda en `agromotor.com.ar` en vez de `agrohernan-bot.github.io/Agromotor/`.

## 1. Comprar el dominio en NIC.ar (15 min)

1. Andá a https://nic.ar
2. Buscá `agromotor.com.ar` y verificá que esté libre
3. Iniciá sesión con tu CUIT/CUIL (clave fiscal AFIP nivel 2 o 3)
4. Comprá el dominio (~ARS 15.000/año al momento de escribir esto, abril 2026)
5. Pago vía VEP / tarjeta argentina

## 2. Configurar DNS en NIC.ar (5 min)

Una vez comprado, andá a "Mis dominios" → seleccioná `agromotor.com.ar` → "Editar zona DNS" y agregá:

```
Tipo  | Nombre  | Valor                              | TTL
------+---------+-------------------------------------+------
A     | @       | 185.199.108.153                    | 3600
A     | @       | 185.199.109.153                    | 3600
A     | @       | 185.199.110.153                    | 3600
A     | @       | 185.199.111.153                    | 3600
CNAME | www     | agrohernan-bot.github.io           | 3600
```

(Las 4 IPs son los servidores de GitHub Pages; el CNAME redirige `www.agromotor.com.ar` al subdominio raíz.)

## 3. Configurar el dominio en GitHub (2 min)

1. Andá a https://github.com/agrohernan-bot/Agromotor/settings/pages
2. En "Custom domain" escribí `agromotor.com.ar`
3. Save
4. Marcá la casilla "Enforce HTTPS" (después de que GitHub valide el dominio, ~10 min)

## 4. El archivo CNAME del repo

Ya está preparado en `CNAME` (raíz del repo). Cuando completes el paso 3, GitHub lo crea automáticamente. Si lo hacés manual, asegurate que el archivo `CNAME` contenga **una sola línea**:

```
agromotor.com.ar
```

## 5. Esperar propagación DNS (24-48h)

DNS puede tardar hasta 48h en propagar globalmente, pero NIC.ar suele resolver en 1-3h en Argentina.

Verificá con:

```bash
dig agromotor.com.ar +short
# Debería devolver: 185.199.108.153, 185.199.109.153, etc.
```

## 6. Actualizar URLs en el código

Una vez que `https://agromotor.com.ar` responda, actualizar en el repo:

- `index.html`: `og:url`, `canonical` → `https://agromotor.com.ar/`
- `app.html`: `og:url` → `https://agromotor.com.ar/app.html`
- `og-image.html`: el footer URL → `agromotor.com.ar`
- `og-image.png`: regenerarlo después del cambio
- `manifest.json`: opcional, agregar `scope` y `id`

## ✅ Estado

- [x] CNAME file creado en repo (placeholder)
- [ ] Dominio comprado en NIC.ar (PENDIENTE — vos)
- [ ] DNS configurado en NIC.ar (PENDIENTE — vos)
- [ ] Custom domain configurado en GitHub Pages (PENDIENTE — vos)
- [ ] HTTPS forzado en GitHub Pages (PENDIENTE — automático tras paso anterior)
- [ ] URLs en el código actualizadas (PENDIENTE — yo cuando avises)

## 💡 Tip

Si querés un atajo SIN comprar dominio inmediatamente: podés usar `agromotor.netlify.app` (Netlify ofrece subdominios gratis con SSL) o `agromotor.vercel.app`. Pero para ir con Consejos Profesionales, el `.com.ar` es mucho más profesional.
