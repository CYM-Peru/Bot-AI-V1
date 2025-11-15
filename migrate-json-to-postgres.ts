#!/usr/bin/env -S npx tsx

/**
 * Script de migración de datos de JSON a PostgreSQL
 * Migra campaigns, metrics y sessions sin perder datos existentes
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
});

interface MigrationStats {
  campaigns: { existing: number; inserted: number; skipped: number };
  metrics: { existing: number; inserted: number; skipped: number };
  sessions: { existing: number; inserted: number; skipped: number };
}

async function migrateCampaigns(): Promise<{ existing: number; inserted: number; skipped: number }> {
  console.log('\n📋 Migrando Campaigns...');

  const jsonPath = path.join(process.cwd(), 'data', 'campaigns.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  const existingResult = await pool.query('SELECT COUNT(*) FROM campaigns');
  const existing = parseInt(existingResult.rows[0].count);

  let inserted = 0;
  let skipped = 0;

  for (const campaign of jsonData.campaigns) {
    try {
      // Insertar campaign
      const result = await pool.query(
        `INSERT INTO campaigns (
          id, name, whatsapp_number_id, template_name, language, recipients,
          variables, status, created_at, created_by, throttle_rate, started_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO NOTHING`,
        [
          campaign.id,
          campaign.name,
          campaign.whatsappNumberId,
          campaign.templateName,
          campaign.language || 'es',
          JSON.stringify(campaign.recipients),
          JSON.stringify(campaign.variables || {}),
          campaign.status,
          campaign.createdAt,
          campaign.createdBy,
          campaign.throttleRate,
          campaign.startedAt || null,
          campaign.completedAt || null,
        ]
      );

      if (result.rowCount && result.rowCount > 0) {
        inserted++;

        // Insertar message details
        for (const phone of campaign.recipients) {
          await pool.query(
            `INSERT INTO campaign_message_details (
              campaign_id, phone, status
            ) VALUES ($1, $2, $3)
            ON CONFLICT (campaign_id, phone) DO NOTHING`,
            [campaign.id, phone, 'pending']
          );
        }
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`Error migrando campaign ${campaign.id}:`, error);
      skipped++;
    }
  }

  console.log(`  ✅ Existentes en PostgreSQL: ${existing}`);
  console.log(`  ➕ Insertados desde JSON: ${inserted}`);
  console.log(`  ⏭️  Omitidos (duplicados): ${skipped}`);

  return { existing, inserted, skipped };
}

async function migrateMetrics(): Promise<{ existing: number; inserted: number; skipped: number }> {
  console.log('\n📊 Migrando Conversation Metrics...');

  const jsonPath = path.join(process.cwd(), 'data', 'conversation-metrics.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  const existingResult = await pool.query('SELECT COUNT(*) FROM conversation_metrics');
  const existing = parseInt(existingResult.rows[0].count);

  let inserted = 0;
  let skipped = 0;

  for (const metric of jsonData.metrics) {
    try {
      const result = await pool.query(
        `INSERT INTO conversation_metrics (
          id, conversation_id, advisor_id, queue_id, channel_type, channel_id,
          started_at, first_response_at, ended_at, message_count, response_count,
          satisfaction_score, tags, status, transferred_to, transferred_from,
          transferred_at, session_duration, average_response_time
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (id) DO NOTHING`,
        [
          metric.id,
          metric.conversationId,
          metric.advisorId,
          metric.queueId || null,
          metric.channelType || 'other',
          metric.channelId || null,
          metric.startedAt,
          metric.firstResponseAt || null,
          metric.endedAt || null,
          metric.messageCount || 0,
          metric.responseCount || 0,
          metric.satisfactionScore || null,
          JSON.stringify(metric.tags || []),
          metric.status || 'completed',
          metric.transferredTo || null,
          metric.transferredFrom || null,
          metric.transferredAt || null,
          metric.sessionDuration || null,
          metric.averageResponseTime || null,
        ]
      );

      if (result.rowCount && result.rowCount > 0) {
        inserted++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`Error migrando metric ${metric.id}:`, error);
      skipped++;
    }
  }

  console.log(`  ✅ Existentes en PostgreSQL: ${existing}`);
  console.log(`  ➕ Insertados desde JSON: ${inserted}`);
  console.log(`  ⏭️  Omitidos (duplicados): ${skipped}`);

  return { existing, inserted, skipped };
}

async function migrateSessions(): Promise<{ existing: number; inserted: number; skipped: number }> {
  console.log('\n⏱️  Migrando Advisor Sessions...');

  const jsonPath = path.join(process.cwd(), 'data', 'crm-sessions.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  const existingResult = await pool.query('SELECT COUNT(*) FROM advisor_sessions');
  const existing = parseInt(existingResult.rows[0].count);

  let inserted = 0;
  let skipped = 0;

  for (const session of jsonData.sessions) {
    try {
      const result = await pool.query(
        `INSERT INTO advisor_sessions (
          id, advisor_id, conversation_id, start_time, end_time, duration
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING`,
        [
          session.id,
          session.advisorId,
          session.conversationId,
          session.startTime,
          session.endTime || null,
          session.duration || null,
        ]
      );

      if (result.rowCount && result.rowCount > 0) {
        inserted++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`Error migrando session ${session.id}:`, error);
      skipped++;
    }
  }

  console.log(`  ✅ Existentes en PostgreSQL: ${existing}`);
  console.log(`  ➕ Insertados desde JSON: ${inserted}`);
  console.log(`  ⏭️  Omitidos (duplicados): ${skipped}`);

  return { existing, inserted, skipped };
}

async function verifyMigration(): Promise<void> {
  console.log('\n🔍 Verificando migración final...\n');

  const campaigns = await pool.query('SELECT COUNT(*) FROM campaigns');
  const metrics = await pool.query('SELECT COUNT(*) FROM conversation_metrics');
  const sessions = await pool.query('SELECT COUNT(*) FROM advisor_sessions');

  console.log('📊 Totales en PostgreSQL después de migración:');
  console.log(`  Campaigns: ${campaigns.rows[0].count}`);
  console.log(`  Metrics: ${metrics.rows[0].count}`);
  console.log(`  Sessions: ${sessions.rows[0].count}`);
}

async function main() {
  console.log('🚀 Iniciando migración de datos de JSON a PostgreSQL');
  console.log('='.repeat(60));

  try {
    const stats: MigrationStats = {
      campaigns: await migrateCampaigns(),
      metrics: await migrateMetrics(),
      sessions: await migrateSessions(),
    };

    await verifyMigration();

    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
