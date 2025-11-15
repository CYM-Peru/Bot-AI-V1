import { postgresCrmDb } from '../crm/db-postgres';

async function investigateAdCards() {
  const pool = postgresCrmDb.pool;

  console.log('\n=== INVESTIGATING AD CARDS ===\n');

    // Query 0: Check for conversations with partial ad data
    const partialAdQuery = `
      SELECT
        COUNT(*) FILTER (WHERE ad_ctwa_clid IS NOT NULL) as con_ad_ctwa_clid,
        COUNT(*) FILTER (WHERE ad_source_id IS NOT NULL) as con_ad_source_id,
        COUNT(*) FILTER (WHERE campaign_id IS NOT NULL) as con_campaign_id,
        COUNT(*) FILTER (WHERE ad_ctwa_clid IS NULL AND ad_source_id IS NOT NULL) as sin_clid_pero_con_source_id,
        COUNT(*) FILTER (WHERE ad_ctwa_clid IS NULL AND campaign_id IS NOT NULL) as sin_clid_pero_con_campaign
      FROM crm_conversations
      WHERE phone NOT IN (SELECT phone_number FROM excluded_phone_numbers);
    `;

    const partialAdResult = await pool.query(partialAdQuery);
    console.log('🔍 Conversaciones con datos parciales de anuncios:');
    console.log(partialAdResult.rows[0]);
    console.log('');

    // Query 1: Count conversations with and without ad tracking
    const countQuery = `
      SELECT
        COUNT(*) FILTER (WHERE ad_ctwa_clid IS NOT NULL) as con_anuncio,
        COUNT(*) FILTER (WHERE ad_ctwa_clid IS NULL) as sin_anuncio,
        COUNT(DISTINCT ad_source_id) FILTER (WHERE ad_ctwa_clid IS NOT NULL) as anuncios_unicos
      FROM crm_conversations
      WHERE phone NOT IN (SELECT phone_number FROM excluded_phone_numbers);
    `;

    const countResult = await pool.query(countQuery);
    console.log('📊 Estadísticas generales:');
    console.log(countResult.rows[0]);
    console.log('');

    // Query 1.5: Check campaign_id breakdown
    const campaignBreakdownQuery = `
      SELECT
        campaign_id,
        COUNT(*) as total_conversions,
        COUNT(*) FILTER (WHERE ad_ctwa_clid IS NOT NULL) as con_clid,
        COUNT(*) FILTER (WHERE ad_ctwa_clid IS NULL) as sin_clid
      FROM crm_conversations
      WHERE phone NOT IN (SELECT phone_number FROM excluded_phone_numbers)
        AND campaign_id IS NOT NULL
      GROUP BY campaign_id
      ORDER BY total_conversions DESC;
    `;

    const campaignBreakdownResult = await pool.query(campaignBreakdownQuery);
    console.log('📊 Desglose por campaign_id:');
    campaignBreakdownResult.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. campaign_id: ${row.campaign_id}`);
      console.log(`   Total conversiones: ${row.total_conversions}`);
      console.log(`   Con CLID: ${row.con_clid}`);
      console.log(`   Sin CLID: ${row.sin_clid}`);
      console.log('');
    });

    // Query 2: List all unique ad_source_id with their counts
    const adsQuery = `
      SELECT
        ad_source_id,
        ad_source_type,
        COUNT(*) as conversions,
        json_agg(DISTINCT phone) as phones
      FROM crm_conversations
      WHERE ad_ctwa_clid IS NOT NULL
        AND phone NOT IN (SELECT phone_number FROM excluded_phone_numbers)
      GROUP BY ad_source_id, ad_source_type
      ORDER BY conversions DESC;
    `;

    const adsResult = await pool.query(adsQuery);
    console.log('📢 Anuncios únicos encontrados:');
    console.log(`Total de anuncios únicos: ${adsResult.rows.length}`);
    console.log('');

    adsResult.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ad_source_id: ${row.ad_source_id}`);
      console.log(`   ad_source_type: ${row.ad_source_type}`);
      console.log(`   conversions: ${row.conversions}`);
      console.log(`   phones (primeros 3): ${row.phones.slice(0, 3).join(', ')}`);
      console.log('');
    });

  process.exit(0);
}

investigateAdCards().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
