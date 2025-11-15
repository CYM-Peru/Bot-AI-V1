import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
});

/**
 * Get RAG usage statistics with filters
 */
export async function getRagUsageStats(filters: {
  startDate?: Date;
  endDate?: Date;
  advisorId?: string;
  category?: string;
  found?: boolean;
  limit?: number;
  offset?: number;
}) {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramCount = 1;

  if (filters.startDate) {
    conditions.push(`created_at >= $${paramCount}`);
    params.push(filters.startDate);
    paramCount++;
  }

  if (filters.endDate) {
    conditions.push(`created_at <= $${paramCount}`);
    params.push(filters.endDate);
    paramCount++;
  }

  if (filters.advisorId) {
    conditions.push(`advisor_id = $${paramCount}`);
    params.push(filters.advisorId);
    paramCount++;
  }

  if (filters.category) {
    conditions.push(`category = $${paramCount}`);
    params.push(filters.category);
    paramCount++;
  }

  if (filters.found !== undefined) {
    conditions.push(`found = $${paramCount}`);
    params.push(filters.found);
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
        query,
        category,
        chunks_used,
        found,
        embedding_cost_usd,
        completion_cost_usd,
        total_cost_usd,
        advisor_id,
        advisor_name,
        conversation_id,
        customer_phone,
        customer_name,
        created_at
      FROM rag_usage
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const recordsResult = await pool.query(recordsQuery, [...params, limit, offset]);

    // Get total count and sum
    const statsQuery = `
      SELECT
        COUNT(*) as total_count,
        SUM(total_cost_usd) as total_cost,
        SUM(embedding_cost_usd) as total_embedding_cost,
        SUM(completion_cost_usd) as total_completion_cost,
        SUM(chunks_used) as total_chunks_used,
        SUM(CASE WHEN found = true THEN 1 ELSE 0 END) as found_count,
        SUM(CASE WHEN found = false THEN 1 ELSE 0 END) as not_found_count,
        AVG(chunks_used) as avg_chunks_used
      FROM rag_usage
      ${whereClause}
    `;

    const statsResult = await pool.query(statsQuery, params);

    return {
      records: recordsResult.rows,
      stats: {
        totalCount: parseInt(statsResult.rows[0].total_count),
        totalCost: parseFloat(statsResult.rows[0].total_cost || 0),
        totalEmbeddingCost: parseFloat(statsResult.rows[0].total_embedding_cost || 0),
        totalCompletionCost: parseFloat(statsResult.rows[0].total_completion_cost || 0),
        totalChunksUsed: parseInt(statsResult.rows[0].total_chunks_used || 0),
        foundCount: parseInt(statsResult.rows[0].found_count),
        notFoundCount: parseInt(statsResult.rows[0].not_found_count),
        avgChunksUsed: parseFloat(statsResult.rows[0].avg_chunks_used || 0),
      }
    };
  } catch (error) {
    console.error('[RagUsage] Error getting stats:', error);
    throw error;
  }
}
