#!/usr/bin/env node

/**
 * Sovereign Production State Verification
 * 
 * This script performs a live check of the production-readiness state:
 * 1. Environment Variable Presence
 * 2. MongoDB Connectivity (Live Test)
 * 3. Frontend Build Artifacts Presence
 * 4. OpenAI/Gemini Lazy-Init Safety
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Colors for output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const NC = '\x1b[0m';

async function verifyState() {
    console.log(`${BLUE}═══ Sovereign Production State Verification ═══${NC}\n`);

    let overallSuccess = true;

    // 1. Load Environment
    console.log(`${BLUE}1. Loading Environment...${NC}`);
    const envProdPath = path.join(process.cwd(), '.env.production');
    const envPath = path.join(process.cwd(), '.env');
    
    if (fs.existsSync(envProdPath)) {
        console.log(`  ✅ Found .env.production`);
        dotenv.config({ path: envProdPath });
    } else if (fs.existsSync(envPath)) {
        console.log(`  ⚠️  .env.production missing, falling back to .env`);
        dotenv.config({ path: envPath });
    } else {
        console.log(`  ❌ No environment file found!`);
        overallSuccess = false;
    }

    // 2. Check Critical Env Vars
    console.log(`\n${BLUE}2. Checking Critical Variables...${NC}`);
    const criticalVars = ['MONGODB_URI', 'JWT_SECRET', 'PORT'];
    criticalVars.forEach(v => {
        if (process.env[v]) {
            console.log(`  ✅ ${v} is set`);
        } else {
            console.log(`  ❌ ${v} is MISSING`);
            overallSuccess = false;
        }
    });

    // 3. Test MongoDB Connection
    console.log(`\n${BLUE}3. Testing MongoDB Connectivity...${NC}`);
    if (process.env.MONGODB_URI) {
        try {
            console.log(`  ⏳ Attempting to connect to MongoDB...`);
            await mongoose.connect(process.env.MONGODB_URI, {
                serverSelectionTimeoutMS: 5000
            });
            console.log(`  ✅ MongoDB connected successfully!`);
            await mongoose.disconnect();
        } catch (err) {
            console.log(`  ❌ MongoDB Connection FAILED: ${err.message}`);
            console.log(`  ${YELLOW}Tip: Ensure 0.0.0.0/0 is whitelisted in MongoDB Atlas.${NC}`);
            overallSuccess = false;
        }
    } else {
        console.log(`  ❌ Skipping MongoDB test (URI missing)`);
    }

    // 4. Check Build Artifacts
    console.log(`\n${BLUE}4. Checking Build Artifacts...${NC}`);
    const nextDir = path.join(process.cwd(), 'client', '.next');
    if (fs.existsSync(nextDir)) {
        const buildIdPath = path.join(nextDir, 'BUILD_ID');
        if (fs.existsSync(buildIdPath)) {
            const buildId = fs.readFileSync(buildIdPath, 'utf8').trim();
            console.log(`  ✅ Frontend build artifacts found (Build ID: ${buildId})`);
        } else {
            console.log(`  ⚠️  .next directory exists but BUILD_ID is missing (partial build?)`);
        }
    } else {
        console.log(`  ❌ Frontend build artifacts (.next) NOT FOUND.`);
        console.log(`  ${YELLOW}Note: Run 'npm run build' to generate artifacts.${NC}`);
        overallSuccess = false;
    }

    // 5. Verify Lazy-Init Pattern
    console.log(`\n${BLUE}5. Verifying Lazy-Init Pattern...${NC}`);
    try {
        const openaiUtil = require('../server/utils/openai');
        if (typeof openaiUtil.getOpenAIClient === 'function') {
            console.log(`  ✅ OpenAI lazy-init utility verified`);
        } else {
            console.log(`  ❌ OpenAI lazy-init utility MISSING or INVALID`);
            overallSuccess = false;
        }
    } catch (err) {
        console.log(`  ❌ Error verifying lazy-init: ${err.message}`);
        overallSuccess = false;
    }

    console.log(`\n${BLUE}══════════════════════════════════════════════${NC}`);
    if (overallSuccess) {
        console.log(`\n${GREEN}✅ PRE-DEPLOYMENT VERIFICATION PASSED${NC}`);
        console.log(`The state is consistent and ready for production.\n`);
        process.exit(0);
    } else {
        console.log(`\n${RED}❌ PRE-DEPLOYMENT VERIFICATION FAILED${NC}`);
        console.log(`Please address the issues listed above.\n`);
        process.exit(1);
    }
}

verifyState();
