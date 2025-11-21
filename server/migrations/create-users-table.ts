/**
 * Migration: Create users table in PostgreSQL
 * Migrates from data/admin/users.json to PostgreSQL
 */

import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

async function createUsersTable() {
  console.log('[Migration] Creating users table...');

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) NOT NULL DEFAULT 'asesor',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        is_bot BOOLEAN DEFAULT FALSE,
        phone_number_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    console.log('[Migration] ✅ users table created successfully');

    // Create indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_users_is_bot ON users(is_bot);
    `);

    console.log('[Migration] ✅ Indexes created successfully');

  } catch (error) {
    console.error('[Migration] ❌ Error creating users table:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createUsersTable()
  .then(() => {
    console.log('[Migration] Users table migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Migration] Migration failed:', error);
    process.exit(1);
  });
