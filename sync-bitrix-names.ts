/**
 * Script para sincronizar nombres de Bitrix24 para conversaciones existentes
 * que no tienen bitrix_id o tienen el teléfono como nombre
 */

import { postgresCrmDb as crmDb } from './server/crm/db-postgres.js';
import { bitrixService } from './server/crm/services/bitrix.js';

async function syncBitrixNames() {
  console.log('🔄 Iniciando sincronización de nombres desde Bitrix24...\n');

  // Obtener todas las conversaciones sin bitrix_id
  const conversations = await crmDb.listConversations({});

  const toSync = conversations.filter(c =>
    !c.bitrixId || c.contactName === c.phone || c.contactName === 'whatsapp'
  );

  console.log(`📊 Total conversaciones: ${conversations.length}`);
  console.log(`🔍 Conversaciones a sincronizar: ${toSync.length}\n`);

  let found = 0;
  let notFound = 0;
  let errors = 0;

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

      // Esperar 100ms entre llamadas para no sobrecargar Bitrix API
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`  ❌ Error:`, error instanceof Error ? error.message : error);
      errors++;
    }
  }

  console.log('\n📊 Resumen:');
  console.log(`  ✅ Encontrados: ${found}`);
  console.log(`  ⚠️  No encontrados: ${notFound}`);
  console.log(`  ❌ Errores: ${errors}`);
  console.log(`\n✅ Sincronización completada`);
}

syncBitrixNames()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
