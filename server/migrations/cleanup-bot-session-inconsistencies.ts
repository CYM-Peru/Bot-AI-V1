/**
 * Cleanup Script: Bot Session Inconsistencies
 *
 * Limpia inconsistencias entre archivos JSON de sesiones del bot y PostgreSQL:
 * 1. Elimina archivos JSON huérfanos (sin conversación en DB)
 * 2. Elimina archivos JSON de conversaciones cerradas
 * 3. Limpia bot_flow_id/assigned_to de conversaciones cerradas sin archivo JSON
 *
 * Usage:
 *   POSTGRES_PASSWORD=azaleia_pg_2025_secure npx tsx server/migrations/cleanup-bot-session-inconsistencies.ts
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
  filePath: string;
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
              filePath,
            });
          }
        } catch (error) {
          console.warn(`[Cleanup] ⚠️  Error reading ${file}:`, error);
        }
      }
    }

    return sessionFiles;
  } catch (error) {
    console.error('[Cleanup] ❌ Error reading session directory:', error);
    return [];
  }
}

/**
 * Clean up orphaned JSON files and closed conversation sessions
 */
async function cleanupInconsistencies() {
  console.log('\n[Cleanup] 🧹 Limpiando inconsistencias entre JSON y PostgreSQL...\n');

  const sessionFiles = await getAllBotSessionFiles();
  console.log(`[Cleanup] 📁 Encontrados ${sessionFiles.length} archivos de sesión JSON\n`);

  let deletedOrphanFiles = 0;
  let deletedClosedConvFiles = 0;
  let clearedDbFields = 0;

  // Step 1: Delete orphaned JSON files (no conversation in DB)
  console.log('[Cleanup] 📋 Paso 1: Eliminando archivos JSON huérfanos (sin conversación en DB)...\n');

  for (const session of sessionFiles) {
    const result = await pool.query(
      `SELECT id, status FROM crm_conversations
       WHERE phone = $1 AND phone_number_id = $2`,
      [session.phone, session.phoneNumberId]
    );

    if (result.rows.length === 0) {
      // No conversation exists - delete JSON file
      try {
        await fs.unlink(session.filePath);
        console.log(`[Cleanup] 🗑️  Eliminado archivo huérfano: ${session.fileName} (${session.phone})`);
        deletedOrphanFiles++;
      } catch (error) {
        console.error(`[Cleanup] ❌ Error eliminando ${session.fileName}:`, error);
      }
    }
  }

  console.log(`[Cleanup] ✅ Eliminados ${deletedOrphanFiles} archivo(s) huérfano(s)\n`);

  // Step 2: Delete JSON files for closed conversations
  console.log('[Cleanup] 📋 Paso 2: Eliminando archivos JSON de conversaciones cerradas...\n');

  // Re-fetch session files (some may have been deleted)
  const remainingFiles = await getAllBotSessionFiles();

  for (const session of remainingFiles) {
    const result = await pool.query(
      `SELECT id, status, bot_flow_id, assigned_to FROM crm_conversations
       WHERE phone = $1 AND phone_number_id = $2`,
      [session.phone, session.phoneNumberId]
    );

    if (result.rows.length > 0) {
      const conv = result.rows[0];

      // If conversation is closed, delete JSON file
      if (conv.status === 'closed') {
        try {
          await fs.unlink(session.filePath);
          console.log(`[Cleanup] 🗑️  Eliminado archivo de conversación cerrada: ${session.fileName} (${session.phone})`);
          deletedClosedConvFiles++;

          // Also clear bot fields in DB if still set
          if (conv.bot_flow_id || conv.assigned_to === 'bot') {
            await pool.query(
              `UPDATE crm_conversations
               SET bot_flow_id = NULL,
                   bot_started_at = NULL,
                   assigned_to = CASE WHEN assigned_to = 'bot' THEN NULL ELSE assigned_to END
               WHERE id = $1`,
              [conv.id]
            );
            console.log(`[Cleanup]    └─ Limpiados campos bot en DB para ${session.phone}`);
            clearedDbFields++;
          }
        } catch (error) {
          console.error(`[Cleanup] ❌ Error eliminando ${session.fileName}:`, error);
        }
      }
    }
  }

  console.log(`[Cleanup] ✅ Eliminados ${deletedClosedConvFiles} archivo(s) de conversaciones cerradas\n`);

  // Step 3: Clear bot fields in DB for closed conversations without JSON file
  console.log('[Cleanup] 📋 Paso 3: Limpiando campos bot en conversaciones cerradas sin archivo JSON...\n');

  const result = await pool.query(
    `SELECT id, phone, phone_number_id, bot_flow_id, assigned_to, status
     FROM crm_conversations
     WHERE status = 'closed'
       AND (bot_flow_id IS NOT NULL OR assigned_to = 'bot')`
  );

  for (const conv of result.rows) {
    // Check if JSON file exists
    const hasJsonFile = remainingFiles.some(
      s => s.phone === conv.phone && s.phoneNumberId === conv.phone_number_id
    );

    if (!hasJsonFile) {
      try {
        await pool.query(
          `UPDATE crm_conversations
           SET bot_flow_id = NULL,
               bot_started_at = NULL,
               assigned_to = CASE WHEN assigned_to = 'bot' THEN NULL ELSE assigned_to END
           WHERE id = $1`,
          [conv.id]
        );
        console.log(`[Cleanup] 🧹 Limpiados campos bot para conversación cerrada ${conv.phone} (sin JSON)`);
        clearedDbFields++;
      } catch (error) {
        console.error(`[Cleanup] ❌ Error limpiando campos para ${conv.phone}:`, error);
      }
    }
  }

  console.log(`\n[Cleanup] ✅ Limpiados campos bot en ${clearedDbFields} conversación(es)\n`);

  // Summary
  console.log('═'.repeat(80));
  console.log('[Cleanup] 📊 RESUMEN DE LIMPIEZA');
  console.log('═'.repeat(80));
  console.log(`[Cleanup] 🗑️  Archivos JSON huérfanos eliminados: ${deletedOrphanFiles}`);
  console.log(`[Cleanup] 🗑️  Archivos JSON de conv. cerradas eliminados: ${deletedClosedConvFiles}`);
  console.log(`[Cleanup] 🧹 Campos bot limpiados en DB: ${clearedDbFields}`);
  console.log(`[Cleanup] ✅ Total de limpieza: ${deletedOrphanFiles + deletedClosedConvFiles + clearedDbFields} operaciones`);
  console.log('═'.repeat(80));
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('═'.repeat(80));
    console.log('[Cleanup] 🧹 LIMPIEZA DE INCONSISTENCIAS DE SESIONES BOT');
    console.log('═'.repeat(80));

    await cleanupInconsistencies();

    console.log('\n[Cleanup] ✅ Limpieza completada exitosamente!');
    console.log('[Cleanup] 📝 Recomendación: Ejecutar test-bot-timeout-fix.ts para verificar\n');

  } catch (error) {
    console.error('\n[Cleanup] ❌ Error durante la limpieza:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the cleanup
main()
  .then(() => {
    console.log('[Cleanup] 🎉 Proceso completado!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Cleanup] 💥 Proceso falló:', error);
    process.exit(1);
  });
