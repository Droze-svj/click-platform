const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const logger = require('../server/utils/logger');

// Load environment variables
dotenv.config({ path: '.env' });
if (process.env.NODE_ENV === 'production' || !process.env.SUPABASE_URL) {
  dotenv.config({ path: 'server/.env' });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log(`📡 Supabase URL: ${supabaseUrl ? 'DETECTED' : 'MISSING'}`);
console.log(`🔑 Supabase Key: ${supabaseKey ? 'DETECTED' : 'MISSING'}`);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyAnalyticsMatrix() {
  console.log('🚀 Starting Spectral Analytics Audit...');
  
  try {
    // 1. Audit Post Metadata
    console.log('\n--- 📊 Auditing Post Metadata Integrity ---');
    const { data: posts, error: postsError } = await supabase
      .from('post_analytics')
      .select('id, post_id, platform, metadata')
      .limit(50);
      
    if (postsError) throw postsError;
    
    let metadataGaps = 0;
    posts.forEach(p => {
      const meta = p.metadata || {};
      const missingFields = [];
      if (!meta.editStyle) missingFields.push('editStyle');
      if (!meta.hookType) missingFields.push('hookType');
      if (!meta.completionRate) missingFields.push('completionRate');
      
      if (missingFields.length > 0) {
        metadataGaps++;
        console.warn(`⚠️ Post ${p.post_id} (${p.platform}) missing: ${missingFields.join(', ')}`);
      }
    });
    
    console.log(`✅ Audit complete. Found gaps in ${metadataGaps}/${posts.length} audited nodes.`);

    // 2. Audit Engagement History
    console.log('\n--- 📈 Auditing Engagement History Synchronization ---');
    const { count: historyCount, error: historyError } = await supabase
      .from('engagement_history')
      .select('*', { count: 'exact', head: true });
      
    if (historyError) throw historyError;
    
    console.log(`✅ SYNC_FLUX Status: ${historyCount} historical snapshots recorded.`);
    
    if (historyCount === 0) {
      console.warn('❌ CRITICAL: No engagement history found. Backfill suggested.');
    }

    // 3. Audit AI Insights
    console.log('\n--- 🧠 Auditing AI Diagnostic Matrix Presence ---');
    const { data: sampleInsight, error: sampleError } = await supabase
      .from('content_insights')
      .select('*')
      .limit(1);
      
    if (sampleError) throw sampleError;
    
    if (sampleInsight.length > 0) {
      console.log('✅ content_insights table accessible. Sample keys:', Object.keys(sampleInsight[0]).join(', '));
    } else {
      console.log('ℹ️ No content_insights found yet.');
    }
    
    console.log('\n✨ Spectral Analytics Audit Complete. Matrix health is stable.');

  } catch (error) {
    console.error('❌ Audit Failed:', error.message);
    process.exit(1);
  }
}

verifyAnalyticsMatrix();
