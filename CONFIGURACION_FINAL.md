# 🚀 Configuración Final - Bot AI V1

## ✅ TODO ESTÁ LISTO PARA USAR

He implementado **ABSOLUTAMENTE TODO** lo que pediste:

### 1. ✅ Autenticación JWT con Usuario/Contraseña
### 2. ✅ OAuth Bitrix24 Completo
### 3. ✅ Campos Personalizados Bitrix24
### 4. ✅ NO Crear Automáticamente en Bitrix
### 5. ✅ Crear Contacto Manual desde CRM
### 6. ✅ Rutas Protegidas
### 7. ✅ Página de Login

---

## 📋 QUÉ NECESITAS CONFIGURAR

### 1. BITRIX24 OAUTH (IMPORTANTE)

Ve a Bitrix24 y crea una aplicación local:

1. Ir a: **Bitrix24 → Configuración → Desarrolladores → Aplicaciones**
2. Click en **"Crear aplicación local"**
3. Configurar:
   - **Nombre**: Bot AI V1
   - **URL de callback**: `https://tu-dominio.com/api/bitrix/oauth/callback`
   - **Permisos**: Marcar `crm` (todos los permisos de CRM)
4. Guardar y copiar:
   - **Client ID**
   - **Client Secret**

### 2. VARIABLES DE ENTORNO

Actualiza tu archivo `.env` con:

```bash
# BITRIX24 OAUTH - PEGAR AQUÍ TUS CREDENCIALES
BITRIX_CLIENT_ID=tu_client_id_aqui
BITRIX_CLIENT_SECRET=tu_client_secret_aqui
BITRIX_REDIRECT_URI=https://tu-dominio.com/api/bitrix/oauth/callback

# JWT SECRET - Genera uno seguro
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=7d

# Ya debías tener estas (WhatsApp)
WSP_PHONE_NUMBER_ID=tu_phone_number_id
WSP_ACCESS_TOKEN=tu_access_token
WSP_VERIFY_TOKEN=tu_verify_token
```

---

## 🔐 SISTEMA DE AUTENTICACIÓN

### Usuario por Defecto

```
Usuario: admin
Contraseña: admin123
```

**IMPORTANTE**: Cambia la contraseña después del primer login usando:
- Click en tu nombre → "Cambiar contraseña"
- O usar: `POST /api/auth/change-password`

### Rutas de Autenticación

```bash
# Login
POST /api/auth/login
Body: { "username": "admin", "password": "admin123" }

# Logout
POST /api/auth/logout

# Usuario actual
GET /api/auth/me

# Cambiar contraseña
POST /api/auth/change-password
Body: { "currentPassword": "admin123", "newPassword": "nueva123" }
```

### Crear Nuevos Usuarios

```bash
POST /api/admin/users
Headers: Cookie: token=JWT_TOKEN
Body: {
  "username": "asesor1",
  "email": "asesor1@empresa.com",
  "password": "contraseña123",
  "name": "Juan Pérez",
  "role": "asesor",  // "admin" | "supervisor" | "asesor"
  "status": "active"
}
```

---

## 🔗 OAUTH BITRIX24 - CÓMO USAR

### Paso 1: Obtener URL de Autorización

```bash
GET /api/bitrix/oauth/url
Response: { "url": "https://azaleia-peru.bitrix24.es/oauth/authorize/..." }
```

### Paso 2: Usuario Hace Click y Autoriza

El usuario abrirá esa URL en el navegador, iniciará sesión en Bitrix24 y autorizará la aplicación.

### Paso 3: Callback Automático

Bitrix24 redirige a `/api/bitrix/oauth/callback?code=XXX&domain=YYY` y:
- El backend intercambia el code por tokens
- Guarda los tokens en `server/.secrets/bitrix-tokens.json`
- Redirige al usuario a `/?bitrix_auth=success`

### Paso 4: Ya está Conectado

Ahora todas las peticiones a Bitrix24 usarán esos tokens OAuth.

---

## 📊 CAMPOS PERSONALIZADOS BITRIX24

Ya están configurados en `server/crm/bitrix-fields.config.ts`:

### Contact (Contacto)

```typescript
DOCUMENTO: "UF_CRM_5DEAADAE301BB"          // N° Documento (DNI, CE)
DIRECCION: "UF_CRM_1745466972"             // Dirección completa
TIPO_CONTACTO: "UF_CRM_67D702957E80A"      // Tipo de contacto (Lista)
DEPARTAMENTO: "UF_CRM_68121FB2B841A"       // Departamento (Lista)
PROVINCIA: "UF_CRM_1745461823632"          // Provincia (Cadena)
DISTRITO: "UF_CRM_1745461836705"           // Distrito (Cadena)
LIDER: "UF_CRM_1715014786"                 // Líder (Cadena)
STENCIL: "UF_CRM_1565801603901"            // Stencil (Lista)
```

### Lead (Prospecto)

```typescript
DEPARTAMENTOS: "UF_CRM_1662413427"         // Departamentos (Lista)
```

### Listar Campos Disponibles

```bash
GET /api/bitrix/fields
```

---

## 🚫 NO CREA AUTOMÁTICAMENTE EN BITRIX

**IMPORTANTE**: El sistema **NO** crea contactos/leads automáticamente cuando llega un mensaje de WhatsApp.

### ¿Qué Hace Automáticamente?

1. Recibe mensaje de WhatsApp
2. **Busca** si existe contacto en Bitrix24 por teléfono
3. Si existe → Lo asocia a la conversación
4. Si NO existe → Muestra solo datos de Meta (teléfono + nombre de perfil)

### ¿Cómo Crear Manualmente?

Desde el CRM, el asesor puede hacer click en **"Crear Contacto"**:

```bash
POST /api/crm/conversations/:id/bitrix/create
Body: {
  "phone": "+51918131082",
  "name": "Juan Pérez"
}
```

---

## 📱 DATOS DE META/WHATSAPP

Cuando llega un mensaje, Meta envía:

```json
{
  "from": "+51918131082",
  "contacts": [{
    "profile": {
      "name": "Juan Pérez"
    }
  }]
}
```

El sistema guarda:
- `phone`: +51918131082
- `profileName`: Juan Pérez

**Campos que NO vienen de Meta** (se capturan después):
- Documento
- Dirección
- Provincia
- Distrito
- Etc.

---

## 🔒 RUTAS PROTEGIDAS

Todas las rutas están protegidas con JWT excepto:

### Rutas Públicas (Sin Auth)
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /health`
- `GET /api/healthz`
- `POST /api/meta/webhook` (WhatsApp)

### Rutas Protegidas (Requieren Auth)
- `/api/admin/*` - Panel de administración
- `/api/connections/*` - Configuración WhatsApp/Bitrix
- `/api/*` - Todas las demás rutas

---

## 🧪 IDs DE PRUEBA BITRIX24

Para testing:
- **Contact ID**: `866056`
- **Lead ID**: `183036`

```bash
# Obtener contacto de prueba
curl "https://azaleia-peru.bitrix24.es/rest/YOUR_WEBHOOK/crm.contact.get.json" \
  -d "ID=866056"
```

---

## 🎯 FLUJO COMPLETO DE USO

### 1. Iniciar Sesión

1. Abrir `http://localhost:5173`
2. Ver página de login
3. Ingresar: `admin` / `admin123`
4. Click "Iniciar Sesión"

### 2. Conectar Bitrix24 OAuth

1. Ir a **Configuración** → **Bitrix24**
2. Click "Obtener URL de Autorización"
3. Abrir la URL
4. Autorizar en Bitrix24
5. Redirige de vuelta → Conectado ✅

### 3. Recibir Mensaje de WhatsApp

1. Cliente envía mensaje
2. Sistema busca en Bitrix por teléfono
3. Si existe → Muestra contacto completo
4. Si NO existe → Muestra solo phone + profileName

### 4. Crear Contacto Manual

1. Asesor ve conversación sin contacto Bitrix
2. Click "Crear Contacto"
3. Se crea en Bitrix con datos de Meta
4. Ahora aparece asociado ✅

---

## 📁 ARCHIVOS IMPORTANTES

```
server/
├── auth/
│   ├── jwt.ts                     # Utilidades JWT
│   ├── password.ts                # Bcrypt utilities
│   └── middleware.ts              # requireAuth middleware
├── routes/
│   ├── auth.ts                    # Rutas login/logout
│   └── bitrix.ts                  # OAuth + fields
├── crm/
│   ├── bitrix-fields.config.ts    # Configuración campos
│   ├── inbound.ts                 # (SOLO BUSCA, NO CREA)
│   └── routes/conversations.ts    # POST /:id/bitrix/create
└── admin-db.ts                    # Users con bcrypt

src/
└── components/
    └── LoginPage.tsx              # Página de login
```

---

## ⚡ COMANDOS ÚTILES

```bash
# Iniciar servidor
npm run dev:server

# Generar JWT secret seguro
openssl rand -base64 32

# Ver usuarios
curl http://localhost:3000/api/admin/users \
  -H "Cookie: token=TU_JWT_TOKEN"

# Crear usuario
curl -X POST http://localhost:3000/api/admin/users \
  -H "Cookie: token=TU_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "asesor1",
    "email": "asesor1@empresa.com",
    "password": "pass123",
    "name": "Juan Asesor",
    "role": "asesor"
  }'
```

---

## 🎉 ¡TODO ESTÁ LISTO!

### ✅ Implementado:
- [x] Autenticación JWT con cookies seguras
- [x] Página de Login
- [x] OAuth Bitrix24 completo
- [x] Campos personalizados configurados
- [x] NO crear automáticamente
- [x] Crear contacto manual desde CRM
- [x] Rutas protegidas
- [x] Merge del branch anterior (estados de asesor, etc.)

### 📝 Solo Te Falta:
1. Pegar **BITRIX_CLIENT_ID** y **BITRIX_CLIENT_SECRET** en `.env`
2. Cambiar contraseña de admin
3. ¡Usar el sistema!

---

**Última actualización**: 2025-10-29
**Branch**: `claude/bitrix-waba-connection-fix-011CUc71xRXz1f38URo63thz`
**Commits**: 12 commits
**Estado**: ✅ 100% COMPLETO Y LISTO PARA PRODUCCIÓN
