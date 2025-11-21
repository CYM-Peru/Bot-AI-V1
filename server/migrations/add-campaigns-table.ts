/**
 * Migration: Add campaigns table for PostgreSQL
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'azaleia_crm',
  user: process.env.POSTGRES_USER || 'azaleia_user',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('[Migration] Creating campaigns table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        whatsapp_number_id TEXT NOT NULL,
        template_name TEXT NOT NULL,
        language TEXT DEFAULT 'es',
        recipients JSONB NOT NULL,
        variables JSONB DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at BIGINT NOT NULL,
        created_by TEXT,
        throttle_rate INTEGER DEFAULT 1000,
        started_at BIGINT,
        completed_at BIGINT,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        post_response_action TEXT,
        response_bot_flow_id TEXT,
        post_bot_action TEXT,
        post_bot_queue_id TEXT,
        db_created_at TIMESTAMP DEFAULT NOW(),
        db_updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('[Migration] ✅ campaigns table created successfully');

    // Create index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);
    `);

    console.log('[Migration] ✅ Indexes created successfully');

  } catch (error) {
    console.error('[Migration] ❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate()
  .then(() => {
    console.log('[Migration] ✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Migration] ❌ Migration failed:', error);
    process.exit(1);
  });
