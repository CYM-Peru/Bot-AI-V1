/**
 * Script para sincronizar TODOS los nombres de Bitrix24
 * para conversaciones existentes sin bitrix_id
 */

import fs from 'fs';
import { Bitrix24Client } from './src/integrations/bitrix24.js';
import { createBitrixService } from './server/crm/services/bitrix.js';
import { postgresCrmDb as crmDb } from './server/crm/db-postgres.js';

async function syncAllBitrixNames() {
  console.log('🔄 Iniciando sincronización masiva de nombres desde Bitrix24...\n');

  // 1. Leer tokens de Bitrix
  const secretsPath = '/opt/flow-builder/server/.secrets/bitrix-tokens.json';
  const tokens = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));

  // 2. Crear cliente de Bitrix24
  const bitrixClient = new Bitrix24Client({
    domain: 'azaleiaperu.bitrix24.com',
    accessToken: tokens.access_token,
    onTokenRefresh: async () => {
      // Re-leer tokens si se refrescan
      const updated = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));
      return updated.access_token;
    }
  });

  // 3. Crear servicio de Bitrix
  const bitrixService = createBitrixService(bitrixClient);

  // 4. Obtener conversaciones a sincronizar
  const conversations = await crmDb.getAllConversations();
  const toSync = conversations.filter(c =>
    !c.bitrixId || c.contactName === c.phone || c.contactName === 'whatsapp'
  );

  console.log(`📊 Total conversaciones: ${conversations.length}`);
  console.log(`🔍 Conversaciones a sincronizar: ${toSync.length}\n`);

  let found = 0;
  let notFound = 0;
  let errors = 0;

  // 5. Sincronizar cada conversación
  for (let i = 0; i < toSync.length; i++) {
    const conv = toSync[i];

    try {
      console.log(`[${i + 1}/${toSync.length}] Buscando ${conv.phone}...`);

      const contact = await bitrixService.lookupByPhone(conv.phone);

      if (contact?.ID) {
        const fullName = `${contact.NAME || ''} ${contact.LAST_NAME || ''}`.trim();

        // Actualizar conversación con datos de Bitrix
        await crmDb.updateConversationMeta(conv.id, {
          contactName: fullName || conv.phone,
          bitrixId: contact.ID.toString(),
        });

        console.log(`  ✅ Encontrado: ${fullName || 'Sin nombre'} (ID: ${contact.ID})`);
        found++;
      } else {
        console.log(`  ⚠️  No encontrado en Bitrix`);
        notFound++;
      }

      // Esperar 200ms entre llamadas para no sobrecargar Bitrix API
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`  ❌ Error:`, error instanceof Error ? error.message : error);
      errors++;
    }
  }

  console.log('\n📊 Resumen Final:');
  console.log(`  ✅ Encontrados: ${found} (${(found/toSync.length*100).toFixed(1)}%)`);
  console.log(`  ⚠️  No encontrados: ${notFound} (${(notFound/toSync.length*100).toFixed(1)}%)`);
  console.log(`  ❌ Errores: ${errors}`);
  console.log(`\n✅ Sincronización completada`);
}

syncAllBitrixNames()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
