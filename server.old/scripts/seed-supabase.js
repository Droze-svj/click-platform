const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function seedSupabase() {
  
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Get a test user (or use a default one)
  const { data: users } = await supabase.from('profiles').select('id').limit(1);
  const userId = users?.[0]?.id || '00000000-0000-0000-0000-000000000000';

  

  // 2. Create sample posts
  const posts = [
    {
      author_id: userId,
      title: 'POV: You stopped wasting hours editing',
      content: 'This is a test post about editing automation.',
      platform: 'tiktok',
      status: 'published',
      tags: ['editing', 'automation', 'creator'],
      categories: ['tutorial']
    },
    {
      author_id: userId,
      title: 'The editing mistake that cost me 1M views',
      content: 'Sharing my biggest failures so you don\'t repeat them.',
      platform: 'instagram',
      status: 'published',
      tags: ['tips', 'growth', 'mistakes'],
      categories: ['educational']
    },
    {
      author_id: userId,
      title: '✦ I automated my entire content pipeline',
      content: 'Full breakdown of my Sovereign setup.',
      platform: 'youtube',
      status: 'published',
      tags: ['ai', 'pipeline', 'workflow'],
      categories: ['vlog']
    }
  ];

  const { data: createdPosts, error: postError } = await supabase
    .from('posts')
    .insert(posts)
    .select();

  if (postError) {
    
    process.exit(1);
  }

  

  // 3. Create sample analytics
  const analytics = createdPosts.map((post, i) => ({
    post_id: post.id,
    views: [284000, 112000, 61000][i],
    likes: [38000, 9800, 5400][i],
    shares: [4200, 1100, 780][i],
    comments: [2800, 640, 390][i],
    engagement_rate: [15.8, 10.3, 10.8][i],
    metadata: {
      completionRate: [71, 58, 64][i],
      hookDropOff: [12, 29, 22][i],
      editStyle: ['Bold Kinetic', 'Minimal White', 'Neon Glow'][i],
      hookType: ['question', 'stat', 'curiosity-gap'][i]
    },
    posted_at: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString()
  }));

  const { error: analyticsError } = await supabase
    .from('post_analytics')
    .insert(analytics);

  if (analyticsError) {
    
  } else {
    
  }

  
}

seedSupabase().catch(err => {
  
  process.exit(1);
});
