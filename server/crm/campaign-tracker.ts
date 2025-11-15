// @ts-ignore - pg types not available but runtime works fine
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

interface CampaignTrackingRecord {
  conversationId: string;
  customerPhone: string;
  customerName?: string;
  initialMessage: string;
  detectedKeyword?: string;
  keywordGroupId?: string;
  keywordGroupName?: string;
  campaignSource?: string;
  campaignName?: string;
  campaignMedium?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
  utmContent?: string;
  utmTerm?: string;
  flowId?: string;
  flowName?: string;
  // Referral data from WhatsApp Click-to-Ad
  referralSourceUrl?: string;
  referralSourceId?: string;
  referralSourceType?: string;
  referralHeadline?: string;
  referralBody?: string;
  referralMediaType?: string;
  referralImageUrl?: string;
  referralVideoUrl?: string;
  referralThumbnailUrl?: string;
  ctwaClid?: string;
}

/**
 * Extract campaign parameters from message
 * Supports formats like:
 * - "source=fb campaign=mayo medium=ad"
 * - "utm_source=google utm_campaign=promo"
 */
function extractCampaignParams(message: string): {
  campaignSource?: string;
  campaignName?: string;
  campaignMedium?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
  utmContent?: string;
  utmTerm?: string;
} {
  const params: any = {};

  // Extract source= pattern
  const sourceMatch = message.match(/source[=:]([^\s&]+)/i);
  if (sourceMatch) params.campaignSource = decodeURIComponent(sourceMatch[1]);

  // Extract campaign= pattern
  const campaignMatch = message.match(/campaign[=:]([^\s&]+)/i);
  if (campaignMatch) params.campaignName = decodeURIComponent(campaignMatch[1]);

  // Extract medium= pattern
  const mediumMatch = message.match(/medium[=:]([^\s&]+)/i);
  if (mediumMatch) params.campaignMedium = decodeURIComponent(mediumMatch[1]);

  // Extract UTM parameters
  const utmSourceMatch = message.match(/utm_source[=:]([^\s&]+)/i);
  if (utmSourceMatch) params.utmSource = decodeURIComponent(utmSourceMatch[1]);

  const utmCampaignMatch = message.match(/utm_campaign[=:]([^\s&]+)/i);
  if (utmCampaignMatch) params.utmCampaign = decodeURIComponent(utmCampaignMatch[1]);

  const utmMediumMatch = message.match(/utm_medium[=:]([^\s&]+)/i);
  if (utmMediumMatch) params.utmMedium = decodeURIComponent(utmMediumMatch[1]);

  const utmContentMatch = message.match(/utm_content[=:]([^\s&]+)/i);
  if (utmContentMatch) params.utmContent = decodeURIComponent(utmContentMatch[1]);

  const utmTermMatch = message.match(/utm_term[=:]([^\s&]+)/i);
  if (utmTermMatch) params.utmTerm = decodeURIComponent(utmTermMatch[1]);

  return params;
}

/**
 * Register campaign tracking when first message arrives
 */
export async function registerCampaignTracking(record: CampaignTrackingRecord): Promise<void> {
  try {
    // Extract campaign parameters from message
    const campaignParams = extractCampaignParams(record.initialMessage);

    await pool.query(
      `INSERT INTO campaign_tracking (
        conversation_id,
        customer_phone,
        customer_name,
        initial_message,
        detected_keyword,
        keyword_group_id,
        keyword_group_name,
        campaign_source,
        campaign_name,
        campaign_medium,
        utm_source,
        utm_campaign,
        utm_medium,
        utm_content,
        utm_term,
        flow_id,
        flow_name,
        referral_source_url,
        referral_source_id,
        referral_source_type,
        referral_headline,
        referral_body,
        referral_media_type,
        referral_image_url,
        referral_video_url,
        referral_thumbnail_url,
        ctwa_clid,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW())`,
      [
        record.conversationId,
        record.customerPhone,
        record.customerName || null,
        record.initialMessage,
        record.detectedKeyword || null,
        record.keywordGroupId || null,
        record.keywordGroupName || null,
        record.campaignSource || campaignParams.campaignSource || null,
        record.campaignName || campaignParams.campaignName || null,
        record.campaignMedium || campaignParams.campaignMedium || null,
        campaignParams.utmSource || null,
        campaignParams.utmCampaign || null,
        campaignParams.utmMedium || null,
        campaignParams.utmContent || null,
        campaignParams.utmTerm || null,
        record.flowId || null,
        record.flowName || null,
        record.referralSourceUrl || null,
        record.referralSourceId || null,
        record.referralSourceType || null,
        record.referralHeadline || null,
        record.referralBody || null,
        record.referralMediaType || null,
        record.referralImageUrl || null,
        record.referralVideoUrl || null,
        record.referralThumbnailUrl || null,
        record.ctwaClid || null,
      ]
    );

    console.log(`[CampaignTracker] Registered tracking for conversation ${record.conversationId}`);
    if (record.detectedKeyword) {
      console.log(`[CampaignTracker] Detected keyword: "${record.detectedKeyword}"`);
    }
    if (campaignParams.campaignSource || campaignParams.utmSource) {
      console.log(`[CampaignTracker] Campaign source: ${campaignParams.campaignSource || campaignParams.utmSource}`);
    }
  } catch (error) {
    console.error('[CampaignTracker] Error registering campaign tracking:', error);
    // Don't throw - we don't want to break the flow execution
  }
}

/**
 * Get campaign tracking statistics
 */
export async function getCampaignStats(filters: {
  startDate?: Date;
  endDate?: Date;
  campaignSource?: string;
  campaignName?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramCount = 1;

  // ALWAYS exclude test/staff phone numbers
  conditions.push(`customer_phone NOT IN (SELECT phone_number FROM excluded_phone_numbers)`);

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

  if (filters.campaignSource) {
    conditions.push(`(campaign_source = $${paramCount} OR utm_source = $${paramCount})`);
    params.push(filters.campaignSource);
    paramCount++;
  }

  if (filters.campaignName) {
    conditions.push(`(campaign_name = $${paramCount} OR utm_campaign = $${paramCount})`);
    params.push(filters.campaignName);
    paramCount++;
  }

  if (filters.keyword) {
    conditions.push(`detected_keyword = $${paramCount}`);
    params.push(filters.keyword);
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
        conversation_id,
        customer_phone,
        customer_name,
        initial_message,
        detected_keyword,
        keyword_group_name,
        campaign_source,
        campaign_name,
        campaign_medium,
        utm_source,
        utm_campaign,
        referral_source_url,
        referral_source_id,
        referral_source_type,
        referral_headline,
        referral_body,
        referral_media_type,
        referral_image_url,
        referral_video_url,
        referral_thumbnail_url,
        ctwa_clid,
        created_at
      FROM campaign_tracking
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const recordsResult = await pool.query(recordsQuery, [...params, limit, offset]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM campaign_tracking
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, params);

    // Get keyword aggregations - ONLY key phrases (frases clave), not single words
    // Key phrases have 3+ words, single words are filtered out
    const keywordAggQuery = `
      SELECT
        detected_keyword,
        keyword_group_name,
        COUNT(*) as count
      FROM campaign_tracking
      ${whereClause}${whereClause ? ' AND' : 'WHERE'} detected_keyword IS NOT NULL
        AND array_length(string_to_array(detected_keyword, ' '), 1) >= 3
      GROUP BY detected_keyword, keyword_group_name
      ORDER BY count DESC
      LIMIT 20
    `;

    const keywordAggResult = await pool.query(keywordAggQuery, params);

    // Get campaign aggregations (exclude Unknown sources)
    const campaignAggQuery = `
      SELECT
        COALESCE(campaign_source, utm_source, 'Directo/Orgánico') as source,
        COALESCE(campaign_name, utm_campaign, 'Sin campaña') as campaign,
        COUNT(*) as count
      FROM campaign_tracking
      ${whereClause}${whereClause ? ' AND' : 'WHERE'} (campaign_source IS NOT NULL OR utm_source IS NOT NULL)
      GROUP BY COALESCE(campaign_source, utm_source, 'Directo/Orgánico'), COALESCE(campaign_name, utm_campaign, 'Sin campaña')
      ORDER BY count DESC
      LIMIT 20
    `;

    const campaignAggResult = await pool.query(campaignAggQuery, params);

    // Get referral/ad aggregations (Meta ads data)
    const referralAggQuery = `
      SELECT
        referral_source_type,
        referral_source_id,
        referral_headline,
        referral_media_type,
        ctwa_clid,
        COUNT(*) as count
      FROM campaign_tracking
      ${whereClause}${whereClause ? ' AND' : 'WHERE'} referral_source_type IS NOT NULL
      GROUP BY referral_source_type, referral_source_id, referral_headline, referral_media_type, ctwa_clid
      ORDER BY count DESC
      LIMIT 20
    `;

    const referralAggResult = await pool.query(referralAggQuery, params);

    // IMPORTANT: Also get ad tracking data from crm_conversations table
    // This captures data from WhatsApp webhook referral field
    // ALSO includes detected keywords from keyword_usage table
    // Group by ad_source_id to combine all conversions from same ad
    const crmReferralQuery = `
      SELECT
        MAX(c.ad_source_type) as referral_source_type,
        c.ad_source_id as referral_source_id,
        MAX(c.ad_source_url) as referral_source_url,
        MAX(c.ad_headline) as referral_headline,
        MAX(c.ad_body) as referral_body,
        MAX(c.ad_media_type) as referral_media_type,
        MAX(c.ad_image_url) as referral_image_url,
        MAX(c.ad_video_url) as referral_video_url,
        MAX(c.ad_thumbnail_url) as referral_thumbnail_url,
        MAX(c.ad_ctwa_clid) as ctwa_clid,
        COUNT(DISTINCT c.id) as count,
        json_agg(DISTINCT jsonb_build_object(
          'keyword', ku.matched_keyword,
          'group', ku.keyword_group_label
        ) ORDER BY jsonb_build_object('keyword', ku.matched_keyword, 'group', ku.keyword_group_label))
        FILTER (WHERE ku.matched_keyword IS NOT NULL) as detected_keywords
      FROM crm_conversations c
      LEFT JOIN keyword_usage ku ON ku.conversation_id = c.id
      WHERE c.ad_ctwa_clid IS NOT NULL
        AND c.phone NOT IN (SELECT phone_number FROM excluded_phone_numbers)
      GROUP BY c.ad_source_id
      ORDER BY count DESC
      LIMIT 20
    `;

    const crmReferralResult = await pool.query(crmReferralQuery);

    // Combine referral stats from both tables
    const combinedReferralStats = [
      ...referralAggResult.rows,
      ...crmReferralResult.rows
    ];

    // Sort by count descending and limit to top 20
    combinedReferralStats.sort((a, b) => parseInt(b.count) - parseInt(a.count));
    const topReferralStats = combinedReferralStats.slice(0, 20);

    return {
      records: recordsResult.rows,
      totalCount: parseInt(countResult.rows[0].total_count),
      keywordStats: keywordAggResult.rows,
      campaignStats: campaignAggResult.rows,
      referralStats: topReferralStats,
    };
  } catch (error) {
    console.error('[CampaignTracker] Error getting stats:', error);
    throw error;
  }
}
