/**
 * 🐛 BUG FIX #1: Cleanup Script for Ghost Sessions
 *
 * This script closes all unclosed sessions in the database.
 * Run this ONCE to clean up the 2,321 existing ghost sessions.
 *
 * Usage:
 *   POSTGRES_PASSWORD=azaleia_pg_2025_secure npx tsx server/migrations/cleanup-ghost-sessions.ts
 */

import pg from 'pg';

const { Pool } = pg;

async function cleanupGhostSessions() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'flowbuilder_crm',
    user: process.env.POSTGRES_USER || 'whatsapp_user',
    password: process.env.POSTGRES_PASSWORD,
    max: 5,
  });

  try {
    console.log('[Cleanup] 🔍 Searching for unclosed sessions...\n');

    // 1. Count unclosed sessions
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM advisor_sessions WHERE end_time IS NULL'
    );
    const totalUnclosed = parseInt(countResult.rows[0].total);

    console.log(`[Cleanup] Found ${totalUnclosed} unclosed session(s)\n`);

    if (totalUnclosed === 0) {
      console.log('[Cleanup] ✅ No ghost sessions to clean up!');
      await pool.end();
      return;
    }

    // 2. Get breakdown by advisor
    const breakdownResult = await pool.query(`
      SELECT
        u.name as advisor_name,
        COUNT(*) as unclosed_count
      FROM advisor_sessions asess
      JOIN users u ON u.id = asess.advisor_id
      WHERE asess.end_time IS NULL
      GROUP BY u.name
      ORDER BY unclosed_count DESC
    `);

    console.log('[Cleanup] 📊 Breakdown by advisor:');
    for (const row of breakdownResult.rows) {
      console.log(`  - ${row.advisor_name}: ${row.unclosed_count} session(s)`);
    }
    console.log('');

    // 3. Close all unclosed sessions
    console.log('[Cleanup] 🔒 Closing all unclosed sessions...\n');

    const updateResult = await pool.query(`
      UPDATE advisor_sessions
      SET
        end_time = EXTRACT(EPOCH FROM updated_at) * 1000,
        duration = (EXTRACT(EPOCH FROM updated_at) * 1000) - start_time
      WHERE end_time IS NULL
      RETURNING id, advisor_id
    `);

    const closedCount = updateResult.rows.length;

    console.log(`[Cleanup] ✅ Successfully closed ${closedCount} session(s)!\n`);

    // 4. Verify cleanup
    const verifyResult = await pool.query(
      'SELECT COUNT(*) as remaining FROM advisor_sessions WHERE end_time IS NULL'
    );
    const remaining = parseInt(verifyResult.rows[0].remaining);

    if (remaining === 0) {
      console.log('[Cleanup] ✅ Verification successful - all sessions are now closed!');
    } else {
      console.log(`[Cleanup] ⚠️  Warning: ${remaining} session(s) still unclosed`);
    }

  } catch (error) {
    console.error('[Cleanup] ❌ Error during cleanup:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanupGhostSessions()
  .then(() => {
    console.log('\n[Cleanup] 🎉 Cleanup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Cleanup] 💥 Cleanup failed:', error);
    process.exit(1);
  });
