# 📸 Cómo subir imágenes para campañas de WhatsApp

## Problema resuelto

El problema con las campañas que no llegaban era que la URL de la imagen devolvía **HTTP 403 Forbidden**. WhatsApp aceptaba el mensaje inicialmente pero fallaba al descargar la imagen.

## Solución: Media Upload de WhatsApp

Ahora puedes subir imágenes directamente a WhatsApp y obtener un `media_id` permanente que NO expira.

---

## Opción 1: Usar el script automático (RECOMENDADO)

### 1. Descarga o prepara tu imagen

Asegúrate de tener la imagen en tu computadora.

### 2. Ejecuta el script de upload

```bash
cd /opt/flow-builder
node /tmp/test-media-upload-real.js TU_IMAGEN.jpg
```

O sigue los pasos manuales a continuación.

---

## Opción 2: Upload manual con código

### Paso 1: Sube tu imagen a WhatsApp

Crea un archivo `/tmp/upload-mi-imagen.js`:

```javascript
import fs from 'fs';
import { uploadMedia } from '/opt/flow-builder/src/api/whatsapp-sender.ts';

const config = {
  accessToken: "TU_ACCESS_TOKEN",
  phoneNumberId: "865074343358032", // Tu número de WhatsApp
  apiVersion: "v20.0",
  baseUrl: "https://graph.facebook.com"
};

async function upload() {
  // Lee tu imagen
  const imageBuffer = fs.readFileSync('/ruta/a/tu/imagen.jpg');

  const result = await uploadMedia(
    config,
    imageBuffer,
    'image/jpeg', // o 'image/png'
    'mi-imagen.jpg'
  );

  if (result.ok && result.body) {
    console.log('✅ Media ID:', result.body.id);
    console.log('');
    console.log('Copia este JSON para tu campaña:');
    console.log('[');
    console.log('  {');
    console.log('    "type": "header",');
    console.log('    "parameters": [');
    console.log('      {');
    console.log('        "type": "image",');
    console.log('        "image": {');
    console.log(`          "id": "${result.body.id}"`);
    console.log('        }');
    console.log('      }');
    console.log('    ]');
    console.log('  }');
    console.log(']');
  }
}

upload();
```

Ejecuta:
```bash
npx tsx /tmp/upload-mi-imagen.js
```

### Paso 2: Usa el media_id en tu campaña

Cuando crees una campaña en el panel, en el campo **"variables"**, usa:

```json
[
  {
    "type": "header",
    "parameters": [
      {
        "type": "image",
        "image": {
          "id": "TU_MEDIA_ID_AQUI"
        }
      }
    ]
  }
]
```

**Ejemplo con el media_id de prueba:**

```json
[
  {
    "type": "header",
    "parameters": [
      {
        "type": "image",
        "image": {
          "id": "1554285675747431"
        }
      }
    ]
  }
]
```

---

## Opción 3: Usar el endpoint HTTP (requiere autenticación)

### Endpoint

```
POST http://localhost:3001/api/campaigns/media/upload
```

### Headers

```
Cookie: connect.sid=TU_SESSION_COOKIE
Content-Type: multipart/form-data
```

### Body (form-data)

- `file`: tu archivo de imagen
- `whatsappNumberId`: 865074343358032

### Respuesta exitosa

```json
{
  "success": true,
  "mediaId": "1554285675747431",
  "fileName": "mi-imagen.jpg",
  "mimeType": "image/jpeg",
  "size": 45678
}
```

---

## Tipos de archivos soportados

- **Imágenes**: JPG, PNG (máx 5MB)
- **Videos**: MP4 (máx 16MB)
- **Documentos**: PDF (máx 100MB)
- **Audio**: MP3, AAC (máx 16MB)

---

## Ventajas del media_id

✅ **NO expira** - Puedes usarlo cuantas veces quieras
✅ **Sin errores 403** - La imagen está hospedada en WhatsApp
✅ **Más rápido** - WhatsApp no necesita descargar la imagen
✅ **Más confiable** - No depende de URLs externas

---

## Logs de campaña

Para verificar que la imagen se está usando correctamente:

```bash
pm2 logs flowbuilder | grep "Using media_id"
```

Deberías ver:
```
[Campaigns] 🖼️  Using media_id: 1554285675747431
```

---

## Troubleshooting

### Error: "Media upload error 403"

Significa que estás usando una URL en lugar de media_id. Sube la imagen con el script de arriba.

### Error: "Invalid media_id"

El media_id puede haber expirado (raro). Sube la imagen nuevamente.

### La imagen no llega

1. Verifica que el template tenga un componente HEADER con formato IMAGE
2. Verifica que el media_id sea correcto
3. Revisa los logs: `pm2 logs flowbuilder --lines 50`

---

## Media ID de prueba disponible

Para pruebas rápidas, usa este media_id (imagen roja 1x1):

```
1554285675747431
```

Este media_id está activo y funciona con el número 865074343358032 (961842916).
