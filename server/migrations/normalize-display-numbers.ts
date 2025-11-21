/**
 * Migration: Normalize display_number format in crm_conversations
 *
 * Problem: Meta/WhatsApp sends display_phone_number in inconsistent formats:
 * - "+51 1 6193636" (with spaces)
 * - "51961842916" (without +)
 * - "+51 961842916" (correct format)
 *
 * This script normalizes all existing display numbers to have consistent format:
 * - Remove all whitespace
 * - Ensure it starts with "+"
 */

import { Pool } from 'pg';

/**
 * Normalize displayNumber format for consistency
 */
function normalizeDisplayNumber(displayNumber: string | null): string | null {
  if (!displayNumber) return null;

  // Remove all whitespace characters
  let normalized = displayNumber.replace(/\s+/g, '');

  // Ensure it starts with "+"
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }

  return normalized;
}

async function migrateDisplayNumbers() {
  const pool = new Pool({
    user: process.env.POSTGRES_USER || 'whatsapp_user',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'flowbuilder_crm',
    password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
  });

  try {
    console.log('🔍 Starting display_number normalization...\n');

    // Get all conversations with display_number
    const result = await pool.query(
      'SELECT id, phone, display_number FROM crm_conversations WHERE display_number IS NOT NULL ORDER BY created_at DESC'
    );

    console.log(`📊 Found ${result.rows.length} conversations with display_number\n`);

    let updatedCount = 0;
    let unchangedCount = 0;
    const changes: Array<{ phone: string; old: string; new: string }> = [];

    // Process each conversation
    for (const row of result.rows) {
      const oldNumber = row.display_number;
      const newNumber = normalizeDisplayNumber(oldNumber);

      if (oldNumber !== newNumber) {
        // Update the display_number
        await pool.query(
          'UPDATE crm_conversations SET display_number = $1, updated_at = $2 WHERE id = $3',
          [newNumber, Date.now(), row.id]
        );

        changes.push({
          phone: row.phone,
          old: oldNumber,
          new: newNumber || ''
        });

        updatedCount++;
      } else {
        unchangedCount++;
      }
    }

    console.log('✅ Migration completed!\n');
    console.log(`📈 Statistics:`);
    console.log(`   - Total conversations: ${result.rows.length}`);
    console.log(`   - Updated: ${updatedCount}`);
    console.log(`   - Unchanged: ${unchangedCount}\n`);

    if (changes.length > 0) {
      console.log('📝 Changes made:');
      changes.forEach((change, index) => {
        console.log(`   ${index + 1}. Phone: ${change.phone}`);
        console.log(`      Old: "${change.old}"`);
        console.log(`      New: "${change.new}"`);
      });
    }

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
migrateDisplayNumbers()
  .then(() => {
    console.log('\n✅ Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
