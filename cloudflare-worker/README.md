# Cloudflare Worker - WhatsApp Media Proxy

Este worker actúa como proxy para descargar archivos de media de WhatsApp Business API.

## Por qué es necesario

Meta/Facebook bloquea algunas IPs de servidores VPS al intentar descargar desde `lookaside.fbsbx.com`. Este worker usa las IPs de Cloudflare (que NO están bloqueadas) para descargar los archivos.

## Instrucciones de Despliegue (GRATIS)

### 1. Crear cuenta en Cloudflare

1. Ve a https://workers.cloudflare.com/
2. Click **"Sign Up"** (NO requiere tarjeta de crédito)
3. Verifica tu email
4. Click **"Create a Worker"**

### 2. Desplegar el Worker

1. En el editor de Cloudflare Workers, **borra todo el código** que viene por defecto
2. **Copia y pega** el contenido del archivo `whatsapp-media-proxy.js`
3. Click **"Save and Deploy"**
4. **Copia la URL** de tu worker (será algo como: `https://whatsapp-media-proxy.your-username.workers.dev`)

### 3. Probar el Worker

```bash
# Reemplaza YOUR_WORKER_URL con tu URL real
curl -X POST https://YOUR_WORKER_URL/download \
  -H "Content-Type: application/json" \
  -d '{
    "mediaId": "123456789",
    "accessToken": "EAA..."
  }' \
  -o test-image.jpg
```

Si funciona, `test-image.jpg` será la imagen descargada.

### 4. Configurar en tu aplicación

Agrega esta variable al `.env`:

```bash
WHATSAPP_MEDIA_PROXY_URL=https://YOUR_WORKER_URL/download
```

El código de tu aplicación detectará automáticamente esta variable y usará el proxy.

## Límites del Tier Gratuito

- ✅ **100,000 requests/día** (más que suficiente)
- ✅ **No requiere tarjeta de crédito**
- ✅ **No expira**

## Troubleshooting

Si el worker falla, revisa los logs en:
https://dash.cloudflare.com/ > Workers & Pages > [tu worker] > Logs
