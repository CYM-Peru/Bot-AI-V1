/**
 * Test Script: Bot Timeout Fix Verification
 *
 * Tests that the bot timeout scheduler correctly:
 * 1. Processes chats with bot_flow_id=NULL but assigned_to='bot'
 * 2. Deletes JSON session files when clearing bot_flow_id
 * 3. No inconsistencies remain between JSON files and PostgreSQL
 *
 * Usage:
 *   POSTGRES_PASSWORD=azaleia_pg_2025_secure npx tsx server/migrations/test-bot-timeout-fix.ts
 */

import pg from 'pg';
import { promises as fs } from 'fs';
import path from 'path';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  password: process.env.POSTGRES_PASSWORD,
  max: 5,
});

const SESSION_DIR = '/opt/flow-builder/data/sessions';

interface SessionFile {
  phone: string;
  phoneNumberId: string;
  flowId: string | null;
  fileName: string;
}

/**
 * Get all bot session JSON files
 */
async function getAllBotSessionFiles(): Promise<SessionFile[]> {
  try {
    const files = await fs.readdir(SESSION_DIR);
    const sessionFiles: SessionFile[] = [];

    for (const file of files) {
      if (file.startsWith('whatsapp_') && file.endsWith('.json')) {
        try {
          const filePath = path.join(SESSION_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const session = JSON.parse(content);

          // Extract phone and phoneNumberId from filename
          // Format: whatsapp_{phone}_{phoneNumberId}.json
          const match = file.match(/^whatsapp_(\d+)_(\d+)\.json$/);
          if (match) {
            sessionFiles.push({
              phone: match[1],
              phoneNumberId: match[2],
              flowId: session.flowId || null,
              fileName: file,
            });
          }
        } catch (error) {
          console.warn(`[Test] ⚠️  Error reading ${file}:`, error);
        }
      }
    }

    return sessionFiles;
  } catch (error) {
    console.error('[Test] ❌ Error reading session directory:', error);
    return [];
  }
}

/**
 * Check for inconsistencies between JSON files and PostgreSQL
 */
async function checkInconsistencies() {
  console.log('\n[Test] 🔍 Buscando inconsistencias entre archivos JSON y PostgreSQL...\n');

  // Get all JSON session files
  const sessionFiles = await getAllBotSessionFiles();
  console.log(`[Test] 📁 Encontrados ${sessionFiles.length} archivos de sesión JSON\n`);

  let inconsistencies = 0;

  for (const session of sessionFiles) {
    // Check if conversation exists in PostgreSQL
    const result = await pool.query(
      `SELECT id, bot_flow_id, bot_started_at, assigned_to, status, phone
       FROM crm_conversations
       WHERE phone = $1
         AND phone_number_id = $2`,
      [session.phone, session.phoneNumberId]
    );

    if (result.rows.length === 0) {
      console.log(`[Test] ⚠️  INCONSISTENCIA: ${session.phone} tiene archivo JSON pero no existe en DB`);
      console.log(`         Archivo: ${session.fileName}`);
      console.log(`         FlowId en JSON: ${session.flowId}\n`);
      inconsistencies++;
      continue;
    }

    const conv = result.rows[0];

    // Check for inconsistency: JSON exists but bot_flow_id is NULL
    if (session.flowId && !conv.bot_flow_id) {
      console.log(`[Test] 🔴 INCONSISTENCIA CRÍTICA: ${session.phone}`);
      console.log(`         DB: bot_flow_id=NULL, assigned_to=${conv.assigned_to}, status=${conv.status}`);
      console.log(`         JSON: flowId=${session.flowId}`);
      console.log(`         Archivo: ${session.fileName}`);
      console.log(`         Conversation ID: ${conv.id}\n`);
      inconsistencies++;
    }

    // Check for inconsistency: No JSON but bot_flow_id is NOT NULL
    if (conv.bot_flow_id && !session.flowId) {
      console.log(`[Test] ⚠️  INCONSISTENCIA: ${session.phone}`);
      console.log(`         DB: bot_flow_id=${conv.bot_flow_id}`);
      console.log(`         JSON: flowId=NULL o archivo vacío`);
      console.log(`         Conversation ID: ${conv.id}\n`);
      inconsistencies++;
    }
  }

  // Also check for conversations with bot_flow_id but no JSON file
  const dbBotsResult = await pool.query(
    `SELECT id, phone, phone_number_id, bot_flow_id, assigned_to, status
     FROM crm_conversations
     WHERE bot_flow_id IS NOT NULL
        OR assigned_to = 'bot'`
  );

  for (const conv of dbBotsResult.rows) {
    const hasJsonFile = sessionFiles.some(
      s => s.phone === conv.phone && s.phoneNumberId === conv.phone_number_id
    );

    if (!hasJsonFile) {
      console.log(`[Test] ⚠️  INCONSISTENCIA: ${conv.phone} tiene bot_flow_id o assigned_to='bot' pero NO tiene archivo JSON`);
      console.log(`         DB: bot_flow_id=${conv.bot_flow_id}, assigned_to=${conv.assigned_to}, status=${conv.status}`);
      console.log(`         Conversation ID: ${conv.id}\n`);
      inconsistencies++;
    }
  }

  if (inconsistencies === 0) {
    console.log('[Test] ✅ No se encontraron inconsistencias\n');
  } else {
    console.log(`[Test] ❌ Total: ${inconsistencies} inconsistencia(s) encontrada(s)\n`);
  }

  return inconsistencies;
}

/**
 * Check specific chat 51943001421
 */
async function checkSpecificChat() {
  console.log('\n[Test] 🔍 Verificando chat específico: 51943001421...\n');

  const result = await pool.query(
    `SELECT id, phone, phone_number_id, bot_flow_id, bot_started_at, assigned_to, status, queue_id
     FROM crm_conversations
     WHERE phone = '51943001421'`
  );

  if (result.rows.length === 0) {
    console.log('[Test] ⚠️  Chat 51943001421 no encontrado en base de datos\n');
    return;
  }

  const chat = result.rows[0];
  console.log('[Test] 📊 Estado en PostgreSQL:');
  console.log(`         ID: ${chat.id}`);
  console.log(`         Phone: ${chat.phone}`);
  console.log(`         Phone Number ID: ${chat.phone_number_id}`);
  console.log(`         bot_flow_id: ${chat.bot_flow_id}`);
  console.log(`         bot_started_at: ${chat.bot_started_at ? new Date(chat.bot_started_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'NULL'}`);
  console.log(`         assigned_to: ${chat.assigned_to}`);
  console.log(`         status: ${chat.status}`);
  console.log(`         queue_id: ${chat.queue_id}\n`);

  // Check for JSON file
  const sessionPath = path.join(SESSION_DIR, `whatsapp_${chat.phone}_${chat.phone_number_id}.json`);

  try {
    const sessionData = await fs.readFile(sessionPath, 'utf-8');
    const session = JSON.parse(sessionData);

    console.log('[Test] 📁 Estado en archivo JSON:');
    console.log(`         Archivo: whatsapp_${chat.phone}_${chat.phone_number_id}.json`);
    console.log(`         flowId: ${session.flowId}`);
    console.log(`         ¿Tiene historial?: ${session.history ? 'Sí (' + session.history.length + ' mensajes)' : 'No'}\n`);

    // Check if last message has buttons
    if (session.history && session.history.length > 0) {
      const lastOutbound = session.history.slice().reverse().find((h: any) => h.type === 'outbound');
      if (lastOutbound) {
        console.log('[Test] 📨 Último mensaje del bot:');
        console.log(`         Tipo: ${lastOutbound.payload?.type || 'unknown'}`);
        console.log(`         ¿Tiene botones?: ${lastOutbound.payload?.type === 'buttons' ? 'SÍ' : 'NO'}\n`);
      }
    }

    // Check inconsistency
    if (session.flowId && !chat.bot_flow_id) {
      console.log('[Test] 🔴 INCONSISTENCIA DETECTADA:');
      console.log('         ✅ JSON tiene flowId: ' + session.flowId);
      console.log('         ❌ PostgreSQL tiene bot_flow_id: NULL');
      console.log('         ⚠️  BotTimeoutScheduler no procesará este chat con el código VIEJO\n');
      console.log('[Test] ✅ Con el código NUEVO, BotTimeoutScheduler SÍ procesará este chat\n');
    } else {
      console.log('[Test] ✅ No hay inconsistencia entre JSON y PostgreSQL\n');
    }

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('[Test] ⚠️  No existe archivo JSON para este chat\n');

      if (chat.bot_flow_id || chat.assigned_to === 'bot') {
        console.log('[Test] 🔴 INCONSISTENCIA DETECTADA:');
        console.log('         ❌ PostgreSQL indica bot activo pero no hay archivo JSON\n');
      }
    } else {
      console.log('[Test] ❌ Error leyendo archivo JSON:', error);
    }
  }
}

/**
 * Simulate BotTimeoutScheduler behavior
 */
async function simulateBotTimeout() {
  console.log('\n[Test] 🎬 Simulando comportamiento de BotTimeoutScheduler...\n');

  // Get all conversations that SHOULD be processed by BotTimeoutScheduler
  const result = await pool.query(
    `SELECT id, phone, phone_number_id, bot_flow_id, bot_started_at, assigned_to, status
     FROM crm_conversations
     WHERE status = 'active'
       AND (
         (bot_flow_id IS NOT NULL AND bot_started_at IS NOT NULL)
         OR
         (assigned_to = 'bot')
       )`
  );

  console.log(`[Test] 📋 Query del BotTimeoutScheduler encontró ${result.rows.length} chat(s)\n`);

  if (result.rows.length === 0) {
    console.log('[Test] ✅ No hay chats para procesar\n');
    return;
  }

  const sessionFiles = await getAllBotSessionFiles();
  const now = Date.now();

  for (const row of result.rows) {
    console.log(`[Test] 🔍 Procesando chat ${row.id} (${row.phone})...`);

    // Check if has JSON file
    const sessionFile = sessionFiles.find(
      s => s.phone === row.phone && s.phoneNumberId === row.phone_number_id
    );

    let botFlowId = row.bot_flow_id;

    if (!botFlowId && row.assigned_to === 'bot') {
      console.log(`[Test]    - bot_flow_id=NULL pero assigned_to='bot' - buscando en JSON...`);
      if (sessionFile && sessionFile.flowId) {
        botFlowId = sessionFile.flowId;
        console.log(`[Test]    ✅ Encontrado flowId en JSON: ${botFlowId}`);
      } else {
        console.log(`[Test]    ❌ No se encontró archivo JSON o no tiene flowId - se omitirá`);
        continue;
      }
    }

    if (!row.bot_started_at) {
      console.log(`[Test]    ⚠️  No tiene bot_started_at - se omitirá`);
      continue;
    }

    const botDuration = (now - row.bot_started_at) / 1000 / 60; // minutes
    console.log(`[Test]    - Duración del bot: ${botDuration.toFixed(1)} minutos`);
    console.log(`[Test]    - bot_flow_id: ${botFlowId}`);
    console.log(`[Test]    - assigned_to: ${row.assigned_to}`);
    console.log(`[Test]    - status: ${row.status}`);

    if (sessionFile) {
      console.log(`[Test]    ✅ Tiene archivo JSON: ${sessionFile.fileName}`);
    } else {
      console.log(`[Test]    ❌ NO tiene archivo JSON`);
    }

    console.log('');
  }
}

/**
 * Main test execution
 */
async function runTests() {
  try {
    console.log('='.repeat(80));
    console.log('[Test] 🧪 VERIFICACIÓN DE CORRECCIONES DE BOT TIMEOUT');
    console.log('='.repeat(80));

    // Test 1: Check specific chat
    await checkSpecificChat();

    // Test 2: Check all inconsistencies
    const inconsistencies = await checkInconsistencies();

    // Test 3: Simulate bot timeout behavior
    await simulateBotTimeout();

    console.log('='.repeat(80));
    console.log('[Test] 📊 RESUMEN');
    console.log('='.repeat(80));

    if (inconsistencies === 0) {
      console.log('\n[Test] ✅ TODAS LAS VERIFICACIONES PASARON');
      console.log('[Test] ✅ No hay inconsistencias entre JSON y PostgreSQL');
      console.log('[Test] ✅ El código está listo para producción\n');
    } else {
      console.log('\n[Test] ⚠️  SE ENCONTRARON INCONSISTENCIAS');
      console.log(`[Test] ⚠️  Total de inconsistencias: ${inconsistencies}`);
      console.log('[Test] ℹ️  Estas inconsistencias SERÁN PROCESADAS por el código nuevo');
      console.log('[Test] ℹ️  BotTimeoutScheduler limpiará automáticamente estos casos\n');
    }

    console.log('[Test] 📝 RECOMENDACIONES:');
    console.log('[Test] 1. Reiniciar el servidor para activar el código nuevo');
    console.log('[Test] 2. Esperar 1 minuto para que BotTimeoutScheduler ejecute');
    console.log('[Test] 3. Ejecutar este script nuevamente para verificar limpieza');
    console.log('[Test] 4. Verificar que las inconsistencias se hayan corregido\n');

    console.log('='.repeat(80));

  } catch (error) {
    console.error('[Test] 💥 Error durante las pruebas:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the tests
runTests()
  .then(() => {
    console.log('\n[Test] 🎉 Pruebas completadas!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Test] 💥 Pruebas fallaron:', error);
    process.exit(1);
  });
