const fs = require('fs');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ENV_PATH = path.join(__dirname, '../.env.production');

/**
 * 🔐 CLICK PRODUCTION SECRETS SETUP
 * Guided utility to securely populate production credentials
 */

const categories = [
  {
    name: '🔗 Social Platform OAuth (Client Credentials)',
    vars: [
      { key: 'YOUTUBE_CLIENT_ID', label: 'YouTube Client ID' },
      { key: 'YOUTUBE_CLIENT_SECRET', label: 'YouTube Client Secret' },
      { key: 'TIKTOK_CLIENT_KEY', label: 'TikTok Client Key' },
      { key: 'TIKTOK_CLIENT_SECRET', label: 'TikTok Client Secret' },
      { key: 'TWITTER_CLIENT_ID', label: 'Twitter Client ID' },
      { key: 'TWITTER_CLIENT_SECRET', label: 'Twitter Client Secret' },
      { key: 'LINKEDIN_CLIENT_ID', label: 'LinkedIn Client ID' },
      { key: 'LINKEDIN_CLIENT_SECRET', label: 'LinkedIn Client Secret' },
      { key: 'FACEBOOK_APP_ID', label: 'Facebook App ID' },
      { key: 'FACEBOOK_APP_SECRET', label: 'Facebook App Secret' },
      { key: 'INSTAGRAM_CLIENT_ID', label: 'Instagram Client ID' },
      { key: 'INSTAGRAM_CLIENT_SECRET', label: 'Instagram Client Secret' },
    ]
  },
  {
    name: '💰 Whop Monetization & Webhooks',
    vars: [
      { key: 'WHOP_API_KEY', label: 'Whop API Key' },
      { key: 'WHOP_WEBHOOK_SECRET', label: 'Whop Webhook Secret' },
    ]
  },
  {
    name: '🤖 AI Intelligence Layer',
    vars: [
      { key: 'OPENAI_API_KEY', label: 'OpenAI API Key' },
      { key: 'GOOGLE_AI_KEY', label: 'Google Gemini AI Key' },
    ]
  },
  {
    name: '☁️ Cloud Storage (AWS/Cloudinary)',
    vars: [
      { key: 'AWS_ACCESS_KEY_ID', label: 'AWS Access Key ID' },
      { key: 'AWS_SECRET_ACCESS_KEY', label: 'AWS Secret Access Key' },
      { key: 'CLOUDINARY_URL', label: 'Cloudinary URL (cloudinary://...)' },
    ]
  },
  {
    name: '🛡️ Core Security',
    vars: [
      { key: 'OAUTH_ENCRYPTION_KEY', label: 'OAuth Encryption Key (32 chars suggested)' },
    ]
  }
];

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function setup() {
  console.log('\n🚀 SOVEREIGN PRODUCTION SECRETS SETUP');
  console.log('====================================');
  console.log('This script will help you securely populate .env.production.');
  console.log('Leave blank to keep existing or placeholder values.\n');

  let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';

  for (const category of categories) {
    console.log(`\n\x1b[36m--- ${category.name} ---\x1b[0m`);
    for (const v of category.vars) {
      const response = await question(`${v.label}: `);
      if (response && response.trim() !== '') {
        const regex = new RegExp(`^${v.key}=.*`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${v.key}=${response.trim()}`);
        } else {
          envContent += `\n${v.key}=${response.trim()}`;
        }
      }
    }
  }

  fs.writeFileSync(ENV_PATH, envContent);
  console.log('\n✅ .env.production has been updated successfully.');
  console.log('⚠️  Remember to SYNC these values with your Render/Railway dashboard.');
  rl.close();
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
