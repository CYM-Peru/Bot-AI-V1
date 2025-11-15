/**
 * Script para consolidar conversaciones duplicadas
 *
 * Problema: Existen múltiples conversaciones para el mismo phone + displayNumber
 * con diferentes channelConnectionId (UUID vs phoneNumberId)
 *
 * Solución: Consolidar en una sola conversación por phone + phoneNumberId
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CRM_DB_PATH = path.join(__dirname, '..', 'data', 'crm.json');
const BACKUP_PATH = path.join(__dirname, '..', 'data', `crm.backup_${Date.now()}.json`);

// Mapeo de UUIDs internos → phoneNumberId real de WhatsApp
const CONNECTION_MAPPING = {
  '9170aac0-8135-4579-8052-c3a914a336f3': '741220429081783',  // 6193636
  '9cb25d6e-a945-4822-9cac-5c18f365ca71': '857608144100041',  // 6193638
  '3f8a5bc1-9d42-4e1f-a7c3-1234567890ab': '894677177051432',  // 966748784
};

function normalizeChannelConnectionId(channelConnectionId) {
  if (!channelConnectionId) return null;

  // Si es un UUID interno, convertir a phoneNumberId
  if (CONNECTION_MAPPING[channelConnectionId]) {
    return CONNECTION_MAPPING[channelConnectionId];
  }

  // Si ya es un phoneNumberId (solo números), dejarlo como está
  return channelConnectionId;
}

function consolidateConversations() {
  console.log('📂 Leyendo base de datos...');
  const rawData = fs.readFileSync(CRM_DB_PATH, 'utf-8');
  const db = JSON.parse(rawData);

  console.log(`📊 Total de conversaciones: ${db.conversations.length}`);
  console.log(`📊 Total de mensajes: ${db.messages.length}`);

  // Backup
  console.log('💾 Creando backup...');
  fs.writeFileSync(BACKUP_PATH, rawData, 'utf-8');
  console.log(`✅ Backup creado: ${BACKUP_PATH}`);

  // Normalizar channelConnectionId de todas las conversaciones
  console.log('\n🔄 Normalizando channelConnectionId...');
  db.conversations = db.conversations.map(conv => ({
    ...conv,
    channelConnectionId: normalizeChannelConnectionId(conv.channelConnectionId)
  }));

  // Agrupar conversaciones por phone + channel + channelConnectionId
  const groups = {};
  const conversationMap = {}; // oldId -> newId

  db.conversations.forEach(conv => {
    const key = `${conv.phone}__${conv.channel}__${conv.channelConnectionId || 'null'}`;

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(conv);
  });

  console.log('\n🔍 Analizando duplicados...');
  let duplicatesFound = 0;
  let conversationsToKeep = [];
  let conversationsToRemove = new Set();

  Object.entries(groups).forEach(([key, convs]) => {
    if (convs.length > 1) {
      duplicatesFound++;
      const [phone, channel, channelId] = key.split('__');
      console.log(`\n⚠️  Duplicado encontrado:`);
      console.log(`   📞 Teléfono: ${phone}`);
      console.log(`   📱 Canal: ${channel}`);
      console.log(`   🔗 channelConnectionId: ${channelId}`);
      console.log(`   📋 ${convs.length} conversaciones:`);

      // Ordenar por más reciente primero
      convs.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

      // Mantener la más reciente
      const keeper = convs[0];
      conversationsToKeep.push(keeper);

      console.log(`   ✅ MANTENER: ${keeper.id} (${new Date(keeper.lastMessageAt).toLocaleString()})`);

      // Marcar las demás para remover y mapear sus IDs
      convs.slice(1).forEach(conv => {
        conversationsToRemove.add(conv.id);
        conversationMap[conv.id] = keeper.id;
        console.log(`   ❌ ELIMINAR: ${conv.id} (${new Date(conv.lastMessageAt).toLocaleString()})`);
      });
    } else {
      // No hay duplicados, mantener la conversación
      conversationsToKeep.push(convs[0]);
    }
  });

  console.log(`\n📊 Resumen:`);
  console.log(`   🔍 Duplicados encontrados: ${duplicatesFound}`);
  console.log(`   ✅ Conversaciones a mantener: ${conversationsToKeep.length}`);
  console.log(`   ❌ Conversaciones a eliminar: ${conversationsToRemove.size}`);

  // Reasignar mensajes de conversaciones eliminadas a las mantenidas
  console.log('\n🔄 Reasignando mensajes...');
  let messagesReassigned = 0;
  db.messages = db.messages.map(msg => {
    if (conversationMap[msg.convId]) {
      messagesReassigned++;
      return { ...msg, convId: conversationMap[msg.convId] };
    }
    return msg;
  });
  console.log(`   ✅ ${messagesReassigned} mensajes reasignados`);

  // Eliminar mensajes huérfanos (de conversaciones que no existen)
  const validConvIds = new Set(conversationsToKeep.map(c => c.id));
  const messagesBefore = db.messages.length;
  db.messages = db.messages.filter(msg => validConvIds.has(msg.convId));
  const orphanMessages = messagesBefore - db.messages.length;
  if (orphanMessages > 0) {
    console.log(`   🗑️  ${orphanMessages} mensajes huérfanos eliminados`);
  }

  // Actualizar conversaciones
  db.conversations = conversationsToKeep;

  // Asegurar que todas las conversaciones tengan ticketNumber
  console.log('\n🎫 Asignando números de ticket...');
  let ticketsAssigned = 0;
  db.conversations.forEach(conv => {
    if (conv.ticketNumber === null || conv.ticketNumber === undefined) {
      db.lastTicketNumber = (db.lastTicketNumber || 0) + 1;
      conv.ticketNumber = db.lastTicketNumber;
      ticketsAssigned++;
    }
  });
  console.log(`   ✅ ${ticketsAssigned} tickets asignados`);

  // Guardar base de datos consolidada
  console.log('\n💾 Guardando base de datos consolidada...');
  fs.writeFileSync(CRM_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

  console.log('\n✅ ¡Consolidación completada!');
  console.log(`📊 Estadísticas finales:`);
  console.log(`   📋 Conversaciones: ${db.conversations.length}`);
  console.log(`   💬 Mensajes: ${db.messages.length}`);
  console.log(`   🎫 Último ticket: ${db.lastTicketNumber || 0}`);
  console.log(`\n💾 Backup guardado en: ${BACKUP_PATH}`);
}

// Ejecutar
try {
  consolidateConversations();
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
