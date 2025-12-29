#!/bin/bash

# Interactive Production Setup Script
# This script guides you through setting up production environment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Click - Production Setup Interactive Guide          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to prompt for input
prompt() {
    local prompt_text="$1"
    local default_value="$2"
    local var_name="$3"
    
    if [ -n "$default_value" ]; then
        read -p "$(echo -e ${CYAN}$prompt_text${NC} [${YELLOW}$default_value${NC}]): " input
        eval "$var_name=\${input:-$default_value}"
    else
        read -p "$(echo -e ${CYAN}$prompt_text${NC}): " input
        eval "$var_name=\$input"
    fi
}

# Function to prompt for secret (hidden input)
prompt_secret() {
    local prompt_text="$1"
    local var_name="$2"
    
    read -sp "$(echo -e ${CYAN}$prompt_text${NC}): " input
    echo ""
    eval "$var_name=\$input"
}

echo -e "${BLUE}This script will help you configure your production environment.${NC}"
echo -e "${YELLOW}You can press Enter to use default values or skip optional items.${NC}"
echo ""

# Check if .env.production exists
if [ -f .env.production ]; then
    echo -e "${YELLOW}⚠️  .env.production already exists.${NC}"
    read -p "Do you want to overwrite it? (y/N): " overwrite
    if [[ ! $overwrite =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Keeping existing .env.production${NC}"
        exit 0
    fi
fi

# Start configuration
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Server Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

prompt "Enter your domain name (e.g., click.example.com)" "" DOMAIN
prompt "Enter frontend URL" "https://$DOMAIN" FRONTEND_URL
prompt "Enter backend port" "5001" PORT

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Database Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "Choose database option:"
echo "1) MongoDB Atlas (Recommended for production)"
echo "2) Local MongoDB"
read -p "Enter choice [1]: " db_choice
db_choice=${db_choice:-1}

if [ "$db_choice" = "1" ]; then
    prompt "Enter MongoDB Atlas connection string" "" MONGODB_URI
else
    prompt "Enter local MongoDB URI" "mongodb://localhost:27017/click" MONGODB_URI
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Security Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Generate JWT secret if not provided
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "change-this-secret-key-minimum-32-characters")
    echo -e "${GREEN}✅ Generated JWT secret${NC}"
else
    prompt_secret "Enter JWT secret (or press Enter to generate)" JWT_SECRET
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "change-this-secret-key-minimum-32-characters")
        echo -e "${GREEN}✅ Generated JWT secret${NC}"
    fi
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: AWS S3 Configuration (Optional but Recommended)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

read -p "Configure AWS S3? (y/N): " configure_s3
if [[ $configure_s3 =~ ^[Yy]$ ]]; then
    prompt "Enter AWS Access Key ID" "" AWS_ACCESS_KEY_ID
    prompt_secret "Enter AWS Secret Access Key" AWS_SECRET_ACCESS_KEY
    prompt "Enter S3 Bucket Name" "" AWS_S3_BUCKET
    prompt "Enter AWS Region" "us-east-1" AWS_REGION
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Redis Configuration (Optional but Recommended)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

read -p "Configure Redis? (y/N): " configure_redis
if [[ $configure_redis =~ ^[Yy]$ ]]; then
    prompt "Enter Redis URL" "redis://localhost:6379" REDIS_URL
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 6: OAuth Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "We'll configure OAuth for each platform. You can skip any you don't need."

# LinkedIn
read -p "Configure LinkedIn OAuth? (y/N): " configure_linkedin
if [[ $configure_linkedin =~ ^[Yy]$ ]]; then
    prompt "Enter LinkedIn Client ID" "" LINKEDIN_CLIENT_ID
    prompt_secret "Enter LinkedIn Client Secret" LINKEDIN_CLIENT_SECRET
    LINKEDIN_CALLBACK_URL="https://$DOMAIN/api/oauth/linkedin/callback"
fi

# Facebook
read -p "Configure Facebook OAuth? (y/N): " configure_facebook
if [[ $configure_facebook =~ ^[Yy]$ ]]; then
    prompt "Enter Facebook App ID" "" FACEBOOK_APP_ID
    prompt_secret "Enter Facebook App Secret" FACEBOOK_APP_SECRET
    FACEBOOK_CALLBACK_URL="https://$DOMAIN/api/oauth/facebook/callback"
fi

# TikTok
read -p "Configure TikTok OAuth? (y/N): " configure_tiktok
if [[ $configure_tiktok =~ ^[Yy]$ ]]; then
    prompt "Enter TikTok Client Key" "" TIKTOK_CLIENT_KEY
    prompt_secret "Enter TikTok Client Secret" TIKTOK_CLIENT_SECRET
    TIKTOK_CALLBACK_URL="https://$DOMAIN/api/oauth/tiktok/callback"
fi

# YouTube
read -p "Configure YouTube OAuth? (y/N): " configure_youtube
if [[ $configure_youtube =~ ^[Yy]$ ]]; then
    prompt "Enter YouTube Client ID" "" YOUTUBE_CLIENT_ID
    prompt_secret "Enter YouTube Client Secret" YOUTUBE_CLIENT_SECRET
    YOUTUBE_CALLBACK_URL="https://$DOMAIN/api/oauth/youtube/callback"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 7: AI & Other Services${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

prompt_secret "Enter OpenAI API Key" OPENAI_API_KEY

read -p "Configure Sentry for error tracking? (y/N): " configure_sentry
if [[ $configure_sentry =~ ^[Yy]$ ]]; then
    prompt "Enter Sentry DSN" "" SENTRY_DSN
fi

read -p "Configure email service? (y/N): " configure_email
if [[ $configure_email =~ ^[Yy]$ ]]; then
    prompt "Enter SMTP Host" "smtp.gmail.com" SMTP_HOST
    prompt "Enter SMTP Port" "587" SMTP_PORT
    prompt "Enter SMTP User" "" SMTP_USER
    prompt_secret "Enter SMTP Password" SMTP_PASS
    prompt "Enter From Email" "noreply@$DOMAIN" SMTP_FROM
fi

# Generate .env.production file
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Generating .env.production file...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cat > .env.production << EOF
# Production Environment Variables
# Generated by setup-production-interactive.sh on $(date)

# ============================================
# SERVER CONFIGURATION
# ============================================
NODE_ENV=production
PORT=$PORT
FRONTEND_URL=$FRONTEND_URL
APP_URL=$FRONTEND_URL

# ============================================
# DATABASE
# ============================================
MONGODB_URI=$MONGODB_URI

# ============================================
# SECURITY
# ============================================
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=30d

EOF

# Add AWS S3 if configured
if [[ $configure_s3 =~ ^[Yy]$ ]]; then
    cat >> .env.production << EOF
# ============================================
# AWS S3 STORAGE
# ============================================
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_S3_BUCKET=$AWS_S3_BUCKET
AWS_REGION=$AWS_REGION

EOF
fi

# Add Redis if configured
if [[ $configure_redis =~ ^[Yy]$ ]]; then
    cat >> .env.production << EOF
# ============================================
# REDIS CACHING
# ============================================
REDIS_URL=$REDIS_URL

EOF
fi

# Add OAuth configurations
cat >> .env.production << EOF
# ============================================
# OAUTH - LINKEDIN
# ============================================
EOF

if [[ $configure_linkedin =~ ^[Yy]$ ]]; then
    cat >> .env.production << EOF
LINKEDIN_CLIENT_ID=$LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET=$LINKEDIN_CLIENT_SECRET
LINKEDIN_CALLBACK_URL=$LINKEDIN_CALLBACK_URL
EOF
else
    cat >> .env.production << EOF
# LINKEDIN_CLIENT_ID=
# LINKEDIN_CLIENT_SECRET=
# LINKEDIN_CALLBACK_URL=
EOF
fi

cat >> .env.production << EOF

# ============================================
# OAUTH - FACEBOOK (also used for Instagram)
# ============================================
EOF

if [[ $configure_facebook =~ ^[Yy]$ ]]; then
    cat >> .env.production << EOF
FACEBOOK_APP_ID=$FACEBOOK_APP_ID
FACEBOOK_APP_SECRET=$FACEBOOK_APP_SECRET
FACEBOOK_CALLBACK_URL=$FACEBOOK_CALLBACK_URL
EOF
else
    cat >> .env.production << EOF
# FACEBOOK_APP_ID=
# FACEBOOK_APP_SECRET=
# FACEBOOK_CALLBACK_URL=
EOF
fi

cat >> .env.production << EOF

# ============================================
# OAUTH - TIKTOK
# ============================================
EOF

if [[ $configure_tiktok =~ ^[Yy]$ ]]; then
    cat >> .env.production << EOF
TIKTOK_CLIENT_KEY=$TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET=$TIKTOK_CLIENT_SECRET
TIKTOK_CALLBACK_URL=$TIKTOK_CALLBACK_URL
EOF
else
    cat >> .env.production << EOF
# TIKTOK_CLIENT_KEY=
# TIKTOK_CLIENT_SECRET=
# TIKTOK_CALLBACK_URL=
EOF
fi

cat >> .env.production << EOF

# ============================================
# OAUTH - YOUTUBE
# ============================================
EOF

if [[ $configure_youtube =~ ^[Yy]$ ]]; then
    cat >> .env.production << EOF
YOUTUBE_CLIENT_ID=$YOUTUBE_CLIENT_ID
YOUTUBE_CLIENT_SECRET=$YOUTUBE_CLIENT_SECRET
YOUTUBE_CALLBACK_URL=$YOUTUBE_CALLBACK_URL
EOF
else
    cat >> .env.production << EOF
# YOUTUBE_CLIENT_ID=
# YOUTUBE_CLIENT_SECRET=
# YOUTUBE_CALLBACK_URL=
EOF
fi

cat >> .env.production << EOF

# ============================================
# AI MODELS - OPENAI
# ============================================
OPENAI_API_KEY=$OPENAI_API_KEY

EOF

# Add Sentry if configured
if [[ $configure_sentry =~ ^[Yy]$ ]]; then
    cat >> .env.production << EOF
# ============================================
# MONITORING & ERROR TRACKING
# ============================================
SENTRY_DSN=$SENTRY_DSN

EOF
fi

# Add Email if configured
if [[ $configure_email =~ ^[Yy]$ ]]; then
    cat >> .env.production << EOF
# ============================================
# EMAIL
# ============================================
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM=$SMTP_FROM

EOF
fi

cat >> .env.production << EOF
# ============================================
# RATE LIMITING
# ============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=info

# ============================================
# FEATURE FLAGS
# ============================================
ENABLE_ANALYTICS=true
ENABLE_MONITORING=true
ENABLE_CACHING=true
EOF

echo -e "${GREEN}✅ .env.production file created successfully!${NC}"
echo ""

# Validate configuration
echo -e "${BLUE}Validating configuration...${NC}"
if command -v node &> /dev/null; then
    if [ -f scripts/validate-production-env.js ]; then
        node scripts/validate-production-env.js
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Configuration validated successfully!${NC}"
        else
            echo -e "${YELLOW}⚠️  Configuration validation found some issues. Please review.${NC}"
        fi
    fi
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Production environment configuration complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "1. Review .env.production file"
echo "2. Run: npm run validate:production"
echo "3. Run: npm run test:oauth:all (to test OAuth configuration)"
echo "4. Proceed with deployment using: npm run deploy:build"
echo ""


