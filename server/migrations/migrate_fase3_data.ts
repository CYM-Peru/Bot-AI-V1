import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  user: 'whatsapp_user',
  host: 'localhost',
  database: 'flowbuilder_crm',
  password: 'azaleia_pg_2025_secure',
  port: 5432,
});

async function migrateWhatsAppConnections() {
  const filePath = path.join(process.cwd(), 'data', 'whatsapp-connections.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  console.log(`[Migration] Migrando ${data.connections.length} conexiones de WhatsApp...`);
  
  for (const conn of data.connections) {
    await pool.query(
      `INSERT INTO whatsapp_connections 
       (id, alias, phone_number_id, display_number, access_token, verify_token, waba_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         alias = EXCLUDED.alias,
         phone_number_id = EXCLUDED.phone_number_id,
         display_number = EXCLUDED.display_number,
         access_token = EXCLUDED.access_token,
         verify_token = EXCLUDED.verify_token,
         waba_id = EXCLUDED.waba_id,
         is_active = EXCLUDED.is_active,
         updated_at = EXCLUDED.updated_at`,
      [
        conn.id,
        conn.alias,
        conn.phoneNumberId,
        conn.displayNumber,
        conn.accessToken,
        conn.verifyToken,
        conn.wabaId,
        conn.isActive,
        conn.createdAt,
        conn.updatedAt
      ]
    );
  }
  
  console.log(`[Migration] ✅ ${data.connections.length} conexiones migradas`);
}

async function migrateSystemUsers() {
  const filePath = path.join(process.cwd(), 'data', 'users.json');
  const users = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  console.log(`[Migration] Migrando ${users.length} usuarios del sistema...`);
  
  for (const user of users) {
    await pool.query(
      `INSERT INTO system_users 
       (id, username, password, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         username = EXCLUDED.username,
         password = EXCLUDED.password,
         role = EXCLUDED.role,
         updated_at = EXCLUDED.updated_at`,
      [
        user.id,
        user.username,
        user.password,
        user.role,
        Date.now(),
        Date.now()
      ]
    );
  }
  
  console.log(`[Migration] ✅ ${users.length} usuarios migrados`);
}

async function main() {
  try {
    await migrateWhatsAppConnections();
    await migrateSystemUsers();
    
    // Verificar
    const connCount = await pool.query('SELECT COUNT(*) FROM whatsapp_connections');
    const userCount = await pool.query('SELECT COUNT(*) FROM system_users');
    
    console.log('');
    console.log('[Migration] 📊 Verificación:');
    console.log(`  - WhatsApp Connections: ${connCount.rows[0].count}`);
    console.log(`  - System Users: ${userCount.rows[0].count}`);
    console.log('');
    console.log('[Migration] ✅ Migración Fase 3 completada');
    
    await pool.end();
  } catch (error) {
    console.error('[Migration] ❌ Error:', error);
    process.exit(1);
  }
}

main();
