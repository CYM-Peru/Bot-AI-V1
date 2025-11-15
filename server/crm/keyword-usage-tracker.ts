// @ts-ignore - pg types not available but runtime works fine
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

interface KeywordUsageRecord {
  flowId: string;
  flowName: string;
  nodeId: string;
  keywordGroupId: string;
  keywordGroupLabel: string;
  matchedKeyword: string;
  customerPhone: string;
  customerName?: string;
  conversationId: string;
}

/**
 * Register keyword match in database
 */
export async function registerKeywordUsage(record: KeywordUsageRecord): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO keyword_usage (
        flow_id,
        flow_name,
        node_id,
        keyword_group_id,
        keyword_group_label,
        matched_keyword,
        customer_phone,
        customer_name,
        conversation_id,
        matched_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        record.flowId,
        record.flowName,
        record.nodeId,
        record.keywordGroupId,
        record.keywordGroupLabel,
        record.matchedKeyword,
        record.customerPhone,
        record.customerName || null,
        record.conversationId
      ]
    );

    console.log(`[KeywordUsage] Registered: "${record.matchedKeyword}" in group "${record.keywordGroupLabel}" (${record.flowName})`);
  } catch (error) {
    console.error('[KeywordUsage] Error registering keyword usage:', error);
    // Don't throw - we don't want to break the flow execution
  }
}

/**
 * Get keyword usage statistics with filters
 */
export async function getKeywordUsageStats(filters: {
  startDate?: Date;
  endDate?: Date;
  flowId?: string;
  keywordGroupId?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramCount = 1;

  if (filters.startDate) {
    conditions.push(`matched_at >= $${paramCount}`);
    params.push(filters.startDate);
    paramCount++;
  }

  if (filters.endDate) {
    conditions.push(`matched_at <= $${paramCount}`);
    params.push(filters.endDate);
    paramCount++;
  }

  if (filters.flowId) {
    conditions.push(`flow_id = $${paramCount}`);
    params.push(filters.flowId);
    paramCount++;
  }

  if (filters.keywordGroupId) {
    conditions.push(`keyword_group_id = $${paramCount}`);
    params.push(filters.keywordGroupId);
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
        flow_id,
        flow_name,
        node_id,
        keyword_group_id,
        keyword_group_label,
        matched_keyword,
        customer_phone,
        customer_name,
        conversation_id,
        matched_at
      FROM keyword_usage
      ${whereClause}
      ORDER BY matched_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const recordsResult = await pool.query(recordsQuery, [...params, limit, offset]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM keyword_usage
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, params);

    // Get keyword aggregations
    const aggregationQuery = `
      SELECT
        matched_keyword,
        keyword_group_label,
        keyword_group_id,
        COUNT(*) as usage_count
      FROM keyword_usage
      ${whereClause}
      GROUP BY matched_keyword, keyword_group_label, keyword_group_id
      ORDER BY usage_count DESC
      LIMIT 50
    `;

    const aggregationResult = await pool.query(aggregationQuery, params);

    // Get flow aggregations
    const flowAggregationQuery = `
      SELECT
        flow_id,
        flow_name,
        COUNT(*) as usage_count
      FROM keyword_usage
      ${whereClause}
      GROUP BY flow_id, flow_name
      ORDER BY usage_count DESC
    `;

    const flowAggregationResult = await pool.query(flowAggregationQuery, params);

    return {
      records: recordsResult.rows,
      totalCount: parseInt(countResult.rows[0].total_count),
      keywordStats: aggregationResult.rows,
      flowStats: flowAggregationResult.rows
    };
  } catch (error) {
    console.error('[KeywordUsage] Error getting stats:', error);
    throw error;
  }
}
