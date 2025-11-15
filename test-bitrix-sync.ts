import { postgresCrmDb as crmDb } from './server/crm/db-postgres.js';
import { bitrixService } from './server/crm/services/bitrix.js';

async function test() {
  console.log('🧪 Probando sincronización de Bitrix (solo 10 conversaciones)...\n');

  const conversations = await crmDb.listConversations({});
  const toSync = conversations.filter(c =>
    !c.bitrixId || c.contactName === c.phone || c.contactName === 'whatsapp'
  ).slice(0, 10);

  console.log(`📊 Probando con ${toSync.length} conversaciones\n`);

  for (let i = 0; i < toSync.length; i++) {
    const conv = toSync[i];
    console.log(`[${i + 1}/${toSync.length}] Buscando ${conv.phone}...`);

    try {
      const contact = await bitrixService.lookupByPhone(conv.phone);
      if (contact?.ID) {
        const fullName = `${contact.NAME || ''} ${contact.LAST_NAME || ''}`.trim();
        console.log(`  ✅ Encontrado: ${fullName || 'Sin nombre'} (ID: ${contact.ID})`);

        await crmDb.updateConversationMeta(conv.id, {
          contactName: fullName || conv.phone,
          bitrixId: contact.ID.toString(),
        });
      } else {
        console.log(`  ⚠️  No encontrado en Bitrix`);
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error instanceof Error ? error.message : error);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n✅ Prueba completada');
  process.exit(0);
}

test();
