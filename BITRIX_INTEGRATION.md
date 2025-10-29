# Integración Bitrix24 - Azaleia Perú

Este documento describe la integración con Bitrix24 CRM para el sistema de WhatsApp Bot AI.

## 📋 Configuración General

- **Portal**: `azaleia-peru.bitrix24.es`
- **WABA**: WhatsApp Business API Oficial (Meta)
- **Entidades**: Contacts (Contactos) y Leads (Prospectos)

## 🔧 Campos Personalizados

### Contact (Contacto)

Los contactos en Bitrix24 incluyen campos estándar y personalizados:

#### Campos Estándar
- `NAME`: Nombre
- `LAST_NAME`: Apellidos
- `PHONE`: Teléfono de trabajo (work phone)

#### Campos Personalizados
- `UF_CRM_5DEAADAE301BB`: N°documento (Cadena) - DNI, CE, etc.
- `UF_CRM_1745466972`: Dirección (Cadena) - Dirección completa
- `UF_CRM_67D702957E80A`: Tipo de contacto (Lista) - Cliente, Prospecto, etc.
- `UF_CRM_68121FB2B841A`: Departamento (Lista) - Departamento del Perú
- `UF_CRM_1745461823632`: Provincia (Cadena) - Provincia
- `UF_CRM_1745461836705`: Distrito (Cadena) - Distrito
- `UF_CRM_1715014786`: Líder (Cadena) - Líder o responsable asignado
- `UF_CRM_1565801603901`: Stencil (Lista) - Stencil o plantilla asignada

### Lead (Prospecto)

Los prospectos incluyen menos campos que los contactos:

#### Campos Estándar
- `TITLE`: Título del lead
- `NAME`: Nombre
- `LAST_NAME`: Apellidos
- `PHONE`: Teléfono de trabajo (work phone)

#### Campos Personalizados
- `UF_CRM_1662413427`: Departamentos (Lista) - Departamentos de interés

## 📊 IDs de Prueba

Para testing y desarrollo:
- **Contact ID**: `866056`
- **Lead ID**: `183036`

Puedes usar estos IDs para probar consultas a Bitrix24:

```bash
# Obtener contacto de prueba
curl "https://azaleia-peru.bitrix24.es/rest/YOUR_WEBHOOK/crm.contact.get.json" \
  -d "ID=866056"

# Obtener lead de prueba
curl "https://azaleia-peru.bitrix24.es/rest/YOUR_WEBHOOK/crm.lead.get.json" \
  -d "ID=183036"
```

## 🔄 Flujo de Sincronización

### Cuando llega un mensaje de WhatsApp

1. **Meta envía webhook** con:
   - `from`: Número de teléfono
   - `contacts[0].profile.name`: Nombre del perfil de WhatsApp

2. **Sistema busca en Bitrix24**:
   - Primero busca en **Contacts** por número de teléfono
   - Si no existe, busca en **Leads** por número de teléfono
   - Si no existe, crea un nuevo **Lead** con los datos disponibles

3. **Datos mapeados automáticamente**:
   - `PHONE`: Número de teléfono del mensaje
   - `NAME` y `LAST_NAME`: Extraídos del `profile.name` (se separa por espacios)
   - `TITLE`: `"Lead [nombre]"` o `"Lead [teléfono]"`

### Datos que NO vienen de Meta

⚠️ **Importante**: Meta/WhatsApp solo envía:
- Número de teléfono
- Nombre del perfil

Los siguientes campos deben ser capturados mediante el flujo conversacional o ya existir en Bitrix24:
- Documento (DNI, CE, etc.)
- Dirección
- Provincia
- Distrito
- Departamento
- Tipo de contacto
- Líder
- Stencil

## 💻 Uso en el Código

### Importar configuración

```typescript
import {
  BITRIX_CONTACT_FIELDS,
  BITRIX_LEAD_FIELDS,
  BITRIX24_CONFIG
} from './server/crm/bitrix-fields.config';
```

### Crear un Lead

```typescript
const leadFields = {
  PHONE: [{ VALUE: phone, VALUE_TYPE: "WORK" }],
  NAME: "Juan",
  LAST_NAME: "Pérez",
  TITLE: "Lead Juan Pérez",
  // Campos personalizados (opcionales)
  [BITRIX_LEAD_FIELDS.DEPARTAMENTOS]: "123", // ID de lista
};

const leadId = await bitrixClient.createLead(leadFields);
```

### Crear un Contact

```typescript
const contactFields = {
  PHONE: [{ VALUE: phone, VALUE_TYPE: "WORK" }],
  NAME: "María",
  LAST_NAME: "García",
  // Campos personalizados (opcionales)
  [BITRIX_CONTACT_FIELDS.DOCUMENTO]: "12345678",
  [BITRIX_CONTACT_FIELDS.DIRECCION]: "Av. Example 123",
  [BITRIX_CONTACT_FIELDS.PROVINCIA]: "Lima",
  [BITRIX_CONTACT_FIELDS.DISTRITO]: "Miraflores",
};

const contactId = await bitrixClient.createContact(contactFields);
```

### Buscar por teléfono

```typescript
// Buscar contacto
const contact = await bitrixClient.findContact({
  filter: { PHONE: "+51918131082" },
  select: ["ID", "NAME", "LAST_NAME", "PHONE",
           BITRIX_CONTACT_FIELDS.DOCUMENTO,
           BITRIX_CONTACT_FIELDS.DIRECCION]
});

// Buscar lead
const lead = await bitrixClient.findLead({
  filter: { PHONE: "+51918131082" },
  select: ["ID", "NAME", "LAST_NAME", "PHONE"]
});
```

## 🔐 Configuración de Webhook

El webhook de Bitrix24 debe configurarse en:

1. Bitrix24 → **Configuración** → **Integraciones** → **Webhook entrante**
2. Permisos necesarios:
   - `crm` (lectura y escritura)
   - Específicamente: `crm.contact.*`, `crm.lead.*`
3. Copiar la URL del webhook

La URL tiene el formato:
```
https://azaleia-peru.bitrix24.es/rest/USER_ID/WEBHOOK_CODE/
```

Configurar en variables de entorno:
```bash
BITRIX24_WEBHOOK_URL=https://azaleia-peru.bitrix24.es/rest/1/abc123xyz/
```

## 📝 Notas Importantes

1. **Campos de tipo Lista**: Los campos marcados como "Lista" requieren el ID del valor de la lista, no el texto. Consulta en Bitrix24 para obtener los IDs válidos.

2. **Formato de teléfono**: Los teléfonos se almacenan en formato internacional con `+` (ej: `+51918131082`)

3. **Búsqueda por teléfono**: La búsqueda sanitiza el número eliminando caracteres especiales excepto `+` y dígitos.

4. **Prioridad**: El sistema busca primero en Contacts, luego en Leads. Si no encuentra, crea un Lead nuevo.

5. **Validación de datos**: Los campos personalizados son opcionales al crear entidades. Solo se requieren los campos estándar (teléfono y nombre).

## 🧪 Testing

Para probar la integración:

```bash
# 1. Configurar webhook en .env
echo "BITRIX24_WEBHOOK_URL=https://azaleia-peru.bitrix24.es/rest/YOUR_WEBHOOK/" >> .env

# 2. Iniciar servidor
npm run dev:server

# 3. Probar búsqueda de contacto de prueba
curl http://localhost:3000/api/bitrix/search \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "contact",
    "phone": "+51918131082"
  }'
```

## 🆘 Troubleshooting

### Error: "Bitrix24 API error: 401"
- Verifica que el webhook URL sea correcto
- Revisa que el webhook tenga permisos de CRM

### Error: "Invalid field"
- Verifica que el ID del campo personalizado sea correcto en tu portal
- Usa `crm.contact.fields` o `crm.lead.fields` para listar campos disponibles

### No se crea el contacto/lead
- Revisa los logs del servidor
- Verifica que los datos estén en el formato correcto
- El campo PHONE debe ser un array de objetos

---

**Última actualización**: 2025-10-29
**Versión**: 1.0.0
