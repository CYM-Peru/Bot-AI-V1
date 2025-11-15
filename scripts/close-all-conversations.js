/**
 * Script para cerrar todas las conversaciones activas/attending
 *
 * Cambia el estado de todas las conversaciones "active" o "attending" a "archived"
 * y limpia assignedTo/assignedAt para que el bot pueda responder cuando el cliente escriba de nuevo
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CRM_DB_PATH = path.join(__dirname, '..', 'data', 'crm.json');
const BACKUP_PATH = path.join(__dirname, '..', 'data', `crm.backup_close_all_${Date.now()}.json`);

function closeAllConversations() {
  console.log('📂 Leyendo base de datos...');
  const rawData = fs.readFileSync(CRM_DB_PATH, 'utf-8');
  const db = JSON.parse(rawData);

  console.log(`📊 Total de conversaciones: ${db.conversations.length}`);

  // Backup
  console.log('💾 Creando backup...');
  fs.writeFileSync(BACKUP_PATH, rawData, 'utf-8');
  console.log(`✅ Backup creado: ${BACKUP_PATH}`);

  // Contar conversaciones activas/attending
  const activeConversations = db.conversations.filter(conv =>
    conv.status === 'active' || conv.status === 'attending'
  );

  console.log(`\n📋 Conversaciones a cerrar: ${activeConversations.length}`);

  if (activeConversations.length === 0) {
    console.log('✅ No hay conversaciones abiertas para cerrar');
    return;
  }

  // Cerrar todas las conversaciones activas/attending
  let closed = 0;
  db.conversations = db.conversations.map(conv => {
    if (conv.status === 'active' || conv.status === 'attending') {
      closed++;
      console.log(`   ✓ Cerrando conversación ${conv.id} (${conv.contactName || conv.phone})`);
      return {
        ...conv,
        status: 'archived',
        assignedTo: null,
        assignedAt: null,
      };
    }
    return conv;
  });

  console.log(`\n✅ ${closed} conversaciones cerradas`);

  // Guardar base de datos
  console.log('\n💾 Guardando base de datos...');
  fs.writeFileSync(CRM_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

  console.log('\n✅ ¡Todas las conversaciones han sido cerradas!');
  console.log(`📊 Estadísticas:`)
  console.log(`   📋 Total conversaciones: ${db.conversations.length}`);
  console.log(`   ✅ Cerradas: ${closed}`);
  console.log(`   📁 Archivadas total: ${db.conversations.filter(c => c.status === 'archived').length}`);
  console.log(`\n💾 Backup guardado en: ${BACKUP_PATH}`);
}

// Ejecutar
try {
  closeAllConversations();
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
