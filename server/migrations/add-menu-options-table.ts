import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

async function migrate() {
  try {
    console.log('[Migration] Creating menu_option_selections table...');

    // Create menu_option_selections table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_option_selections (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        node_id VARCHAR(255) NOT NULL,
        option_id VARCHAR(255) NOT NULL,
        option_label TEXT NOT NULL,
        selected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb,
        CONSTRAINT menu_option_selections_unique UNIQUE (session_id, node_id, option_id, selected_at)
      );
    `);

    // Create indexes for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_menu_selections_node_option
      ON menu_option_selections (node_id, option_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_menu_selections_selected_at
      ON menu_option_selections (selected_at DESC);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_menu_selections_session
      ON menu_option_selections (session_id);
    `);

    console.log('[Migration] ✅ menu_option_selections table created successfully');

  } catch (error) {
    console.error('[Migration] ❌ Error creating menu_option_selections table:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate();
