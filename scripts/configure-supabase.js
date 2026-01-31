// Supabase Configuration Helper
// Run this after setting up Supabase to configure Click

const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🔧 CLICK SUPABASE CONFIGURATION HELPER');
console.log('=====================================');
console.log('');

const questions = [
  {
    key: 'SUPABASE_URL',
    question: 'Enter your Supabase Project URL (https://xxxxx.supabase.co):',
    example: 'https://abcdefghijklmnop.supabase.co'
  },
  {
    key: 'SUPABASE_ANON_KEY',
    question: 'Enter your Supabase anon/public key:',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    question: 'Enter your Supabase service_role key (for admin operations):',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  {
    key: 'DATABASE_URL',
    question: 'Enter your PostgreSQL connection string:',
    example: 'postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres'
  }
];

function prompt(question, example) {
  return new Promise((resolve) => {
    process.stdout.write(`${question}\nExample: ${example}\n> `);
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

async function configure() {
  console.log('This script will help you configure Click to use Supabase.');
  console.log('You need to provide the values from your Supabase project settings.');
  console.log('');

  const config = {};

  for (const q of questions) {
    let answer;
    do {
      answer = await prompt(q.question, q.example);
      if (!answer) {
        console.log('This field is required. Please try again.');
      }
    } while (!answer);

    config[q.key] = answer;
  }

  // Create or update .env file
  const envPath = path.join(__dirname, '..', 'server', '.env');
  let envContent = '';

  // Read existing .env if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    // Remove existing Supabase configs
    envContent = envContent.split('\n').filter(line =>
      !line.startsWith('SUPABASE_') && !line.startsWith('DATABASE_URL')
    ).join('\n');
  }

  // Add new Supabase configuration
  envContent += '\n\n# Supabase Configuration\n';
  for (const [key, value] of Object.entries(config)) {
    envContent += `${key}=${value}\n`;
  }

  // Write the updated .env file
  fs.writeFileSync(envPath, envContent.trim());

  console.log('');
  console.log('✅ Configuration saved to server/.env');
  console.log('');
  console.log('🎯 NEXT STEPS:');
  console.log('1. Set up your database schema: node scripts/setup-supabase.js');
  console.log('2. Generate Prisma client: npx prisma generate');
  console.log('3. Restart your server: npm run dev:server');
  console.log('');
  console.log('Your Click app will now use Supabase instead of MongoDB! 🚀');

  process.exit(0);
}

configure().catch(console.error);










