/**
 * Script para migrar attachments a PostgreSQL
 * Reconstruye la tabla crm_attachments desde los archivos físicos y las referencias en crm_messages
 */

import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

interface Message {
  id: string;
  conversation_id: string;
  media_url: string;
  media_thumb: string | null;
  type: string;
}

function extractAttachmentId(url: string): string | null {
  const match = url.match(/\/api\/crm\/attachments\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

function detectMimeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.mp4': return 'video/mp4';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.pdf': return 'application/pdf';
    default: return 'application/octet-stream';
  }
}

async function findFileById(id: string, uploadRoot: string): Promise<{ filepath: string; filename: string; size: number; mime: string } | null> {
  try {
    const yearDirs = await fs.readdir(uploadRoot);
    for (const year of yearDirs) {
      const yearPath = path.join(uploadRoot, year);
      const stat = await fs.stat(yearPath);
      if (!stat.isDirectory()) continue;

      const monthDirs = await fs.readdir(yearPath);
      for (const month of monthDirs) {
        const monthPath = path.join(yearPath, month);
        const monthStat = await fs.stat(monthPath);
        if (!monthStat.isDirectory()) continue;

        const files = await fs.readdir(monthPath);
        for (const file of files) {
          if (file.startsWith(id)) {
            const filepath = path.join(monthPath, file);
            const info = await fs.stat(filepath);
            return {
              filepath,
              filename: file,
              size: info.size,
              mime: detectMimeFromFilename(file),
            };
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error searching for file ${id}:`, error);
  }
  return null;
}

async function migrateAttachments() {
  const uploadRoot = path.resolve(process.cwd(), 'data/uploads');

  console.log('[MigrateAttachments] 🚀 Starting attachment migration...');
  console.log(`[MigrateAttachments] 📂 Upload root: ${uploadRoot}`);

  // 1. Get all messages with media_url
  const result = await pool.query<Message>(`
    SELECT id, conversation_id, media_url, media_thumb, type
    FROM crm_messages
    WHERE media_url IS NOT NULL
    ORDER BY timestamp ASC
  `);

  console.log(`[MigrateAttachments] 📊 Found ${result.rows.length} messages with media`);

  let migrated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const msg of result.rows) {
    const attachmentId = extractAttachmentId(msg.media_url);
    if (!attachmentId) {
      console.log(`[MigrateAttachments] ⚠️  Invalid media_url format: ${msg.media_url}`);
      skipped++;
      continue;
    }

    // Check if attachment already exists
    const existing = await pool.query(
      'SELECT id FROM crm_attachments WHERE id = $1',
      [attachmentId]
    );

    if (existing.rows.length > 0) {
      console.log(`[MigrateAttachments] ⏭️  Attachment ${attachmentId} already exists`);
      skipped++;
      continue;
    }

    // Find the physical file
    const fileInfo = await findFileById(attachmentId, uploadRoot);
    if (!fileInfo) {
      console.log(`[MigrateAttachments] ❌ File not found for attachment ${attachmentId}`);
      notFound++;
      continue;
    }

    // Insert attachment record
    try {
      // Detect type from mime
      let type = 'document';
      if (fileInfo.mime.startsWith('image/')) type = 'image';
      else if (fileInfo.mime.startsWith('audio/')) type = 'audio';
      else if (fileInfo.mime.startsWith('video/')) type = 'video';

      await pool.query(`
        INSERT INTO crm_attachments (
          id, message_id, type, url, thumbnail,
          filename, mimetype, size, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        attachmentId,
        msg.id,
        type,
        msg.media_url,
        msg.media_thumb,
        fileInfo.filename,
        fileInfo.mime,
        fileInfo.size,
        Date.now(),
      ]);

      console.log(`[MigrateAttachments] ✅ Migrated attachment ${attachmentId} (${fileInfo.filename})`);
      migrated++;
    } catch (error) {
      console.error(`[MigrateAttachments] ❌ Error inserting attachment ${attachmentId}:`, error);
      skipped++;
    }
  }

  console.log('\n[MigrateAttachments] 📊 Migration Summary:');
  console.log(`  ✅ Migrated: ${migrated}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Not found: ${notFound}`);
  console.log(`  📊 Total: ${result.rows.length}`);

  await pool.end();
}

migrateAttachments().catch((error) => {
  console.error('[MigrateAttachments] Fatal error:', error);
  process.exit(1);
});
