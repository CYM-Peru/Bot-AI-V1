import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
});

interface TemplateUsageRecord {
  templateName: string;
  templateCategory: string; // 'MARKETING', 'UTILITY', 'AUTHENTICATION'
  advisorId: string;
  advisorName: string;
  conversationId: string;
  customerPhone: string;
  customerName?: string;
  sendingPhoneNumberId?: string;
  sendingDisplayNumber?: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
}

/**
 * Calculate cost based on template category
 * MARKETING templates: $0.0703 USD
 * Other templates (UTILITY, AUTHENTICATION): $0.02 USD
 */
function calculateCost(category: string): number {
  const upperCategory = category.toUpperCase();
  if (upperCategory === 'MARKETING') {
    return 0.0703;
  }
  return 0.02;
}

/**
 * Register template usage in database
 */
export async function registerTemplateUsage(record: TemplateUsageRecord): Promise<void> {
  const cost = calculateCost(record.templateCategory);

  try {
    await pool.query(
      `INSERT INTO template_usage (
        template_name,
        template_category,
        cost_usd,
        advisor_id,
        advisor_name,
        conversation_id,
        customer_phone,
        customer_name,
        sending_phone_number_id,
        sending_display_number,
        status,
        error_message,
        sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
      [
        record.templateName,
        record.templateCategory,
        cost,
        record.advisorId,
        record.advisorName,
        record.conversationId,
        record.customerPhone,
        record.customerName || null,
        record.sendingPhoneNumberId || null,
        record.sendingDisplayNumber || null,
        record.status,
        record.errorMessage || null
      ]
    );

    console.log(`[TemplateUsage] Registered: ${record.templateName} (${record.templateCategory}) - $${cost} USD - ${record.status} - From: ${record.sendingDisplayNumber || record.sendingPhoneNumberId || 'unknown'}`);
  } catch (error) {
    console.error('[TemplateUsage] Error registering template usage:', error);
    // Don't throw - we don't want to break the template sending flow
  }
}

/**
 * Get template usage statistics with filters
 */
export async function getTemplateUsageStats(filters: {
  startDate?: Date;
  endDate?: Date;
  advisorId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramCount = 1;

  if (filters.startDate) {
    conditions.push(`sent_at >= $${paramCount}`);
    params.push(filters.startDate);
    paramCount++;
  }

  if (filters.endDate) {
    conditions.push(`sent_at <= $${paramCount}`);
    params.push(filters.endDate);
    paramCount++;
  }

  if (filters.advisorId) {
    conditions.push(`advisor_id = $${paramCount}`);
    params.push(filters.advisorId);
    paramCount++;
  }

  if (filters.status) {
    conditions.push(`status = $${paramCount}`);
    params.push(filters.status);
    paramCount++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  try {
    // Get records
    const recordsQuery = `
      SELECT
        id,
        template_name,
        template_category,
        cost_usd,
        advisor_id,
        advisor_name,
        conversation_id,
        customer_phone,
        customer_name,
        sending_phone_number_id,
        sending_display_number,
        sent_at,
        status,
        error_message
      FROM template_usage
      ${whereClause}
      ORDER BY sent_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const recordsResult = await pool.query(recordsQuery, [...params, limit, offset]);

    // Get total count and sum
    const statsQuery = `
      SELECT
        COUNT(*) as total_count,
        SUM(cost_usd) as total_cost,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status = 'sent' THEN cost_usd ELSE 0 END) as sent_cost
      FROM template_usage
      ${whereClause}
    `;

    const statsResult = await pool.query(statsQuery, params);

    return {
      records: recordsResult.rows,
      stats: {
        totalCount: parseInt(statsResult.rows[0].total_count),
        totalCost: parseFloat(statsResult.rows[0].total_cost || 0),
        sentCount: parseInt(statsResult.rows[0].sent_count),
        failedCount: parseInt(statsResult.rows[0].failed_count),
        sentCost: parseFloat(statsResult.rows[0].sent_cost || 0),
      }
    };
  } catch (error) {
    console.error('[TemplateUsage] Error getting stats:', error);
    throw error;
  }
}
