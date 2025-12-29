#!/bin/bash

# Setup script for Click environment variables

echo "🚀 Click - Environment Setup"
echo "============================"
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

# Copy .env.example to .env
if [ -f .env.example ]; then
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
else
    echo "❌ .env.example not found!"
    exit 1
fi

# Generate JWT secret
echo ""
echo "🔐 Generating JWT secret..."
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
sed -i.bak "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/" .env
rm .env.bak 2>/dev/null
echo "✅ JWT secret generated"

# Prompt for required values
echo ""
echo "📝 Please fill in the following required values:"
echo ""

# MongoDB
read -p "MongoDB URI [mongodb://localhost:27017/click]: " mongodb_uri
if [ ! -z "$mongodb_uri" ]; then
    sed -i.bak "s|mongodb://localhost:27017/click|$mongodb_uri|" .env
    rm .env.bak 2>/dev/null
fi

# OpenAI API Key
read -p "OpenAI API Key (required for AI features): " openai_key
if [ ! -z "$openai_key" ]; then
    sed -i.bak "s/your-openai-api-key-here/$openai_key/" .env
    rm .env.bak 2>/dev/null
fi

echo ""
echo "📋 Optional configurations:"
echo ""

# Sentry
read -p "Do you want to configure Sentry? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Sentry DSN: " sentry_dsn
    if [ ! -z "$sentry_dsn" ]; then
        sed -i.bak "s|SENTRY_DSN=|SENTRY_DSN=$sentry_dsn|" .env
        sed -i.bak "s|NEXT_PUBLIC_SENTRY_DSN=|NEXT_PUBLIC_SENTRY_DSN=$sentry_dsn|" .env
        rm .env.bak 2>/dev/null
    fi
    read -p "Sentry Org: " sentry_org
    if [ ! -z "$sentry_org" ]; then
        sed -i.bak "s|SENTRY_ORG=|SENTRY_ORG=$sentry_org|" .env
        rm .env.bak 2>/dev/null
    fi
    read -p "Sentry Project: " sentry_project
    if [ ! -z "$sentry_project" ]; then
        sed -i.bak "s|SENTRY_PROJECT=|SENTRY_PROJECT=$sentry_project|" .env
        rm .env.bak 2>/dev/null
    fi
fi

# AWS S3
read -p "Do you want to configure AWS S3? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "AWS Access Key ID: " aws_key
    if [ ! -z "$aws_key" ]; then
        sed -i.bak "s|AWS_ACCESS_KEY_ID=|AWS_ACCESS_KEY_ID=$aws_key|" .env
        rm .env.bak 2>/dev/null
    fi
    read -p "AWS Secret Access Key: " aws_secret
    if [ ! -z "$aws_secret" ]; then
        sed -i.bak "s|AWS_SECRET_ACCESS_KEY=|AWS_SECRET_ACCESS_KEY=$aws_secret|" .env
        rm .env.bak 2>/dev/null
    fi
    read -p "AWS Region [us-east-1]: " aws_region
    if [ ! -z "$aws_region" ]; then
        sed -i.bak "s|AWS_REGION=us-east-1|AWS_REGION=$aws_region|" .env
        rm .env.bak 2>/dev/null
    fi
    read -p "AWS S3 Bucket Name: " aws_bucket
    if [ ! -z "$aws_bucket" ]; then
        sed -i.bak "s|AWS_S3_BUCKET=|AWS_S3_BUCKET=$aws_bucket|" .env
        rm .env.bak 2>/dev/null
    fi
fi

# OAuth
read -p "Do you want to configure OAuth (Twitter/LinkedIn/Facebook)? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Twitter
    read -p "Twitter Client ID: " twitter_id
    if [ ! -z "$twitter_id" ]; then
        sed -i.bak "s|TWITTER_CLIENT_ID=|TWITTER_CLIENT_ID=$twitter_id|" .env
        rm .env.bak 2>/dev/null
    fi
    read -p "Twitter Client Secret: " twitter_secret
    if [ ! -z "$twitter_secret" ]; then
        sed -i.bak "s|TWITTER_CLIENT_SECRET=|TWITTER_CLIENT_SECRET=$twitter_secret|" .env
        rm .env.bak 2>/dev/null
    fi
    
    # LinkedIn
    read -p "LinkedIn Client ID: " linkedin_id
    if [ ! -z "$linkedin_id" ]; then
        sed -i.bak "s|LINKEDIN_CLIENT_ID=|LINKEDIN_CLIENT_ID=$linkedin_id|" .env
        rm .env.bak 2>/dev/null
    fi
    read -p "LinkedIn Client Secret: " linkedin_secret
    if [ ! -z "$linkedin_secret" ]; then
        sed -i.bak "s|LINKEDIN_CLIENT_SECRET=|LINKEDIN_CLIENT_SECRET=$linkedin_secret|" .env
        rm .env.bak 2>/dev/null
    fi
    
    # Facebook
    read -p "Facebook App ID: " facebook_id
    if [ ! -z "$facebook_id" ]; then
        sed -i.bak "s|FACEBOOK_APP_ID=|FACEBOOK_APP_ID=$facebook_id|" .env
        rm .env.bak 2>/dev/null
    fi
    read -p "Facebook App Secret: " facebook_secret
    if [ ! -z "$facebook_secret" ]; then
        sed -i.bak "s|FACEBOOK_APP_SECRET=|FACEBOOK_APP_SECRET=$facebook_secret|" .env
        rm .env.bak 2>/dev/null
    fi
fi

echo ""
echo "✅ Environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Review .env file and update any missing values"
echo "2. Install dependencies: npm run install:all"
echo "3. Start MongoDB"
echo "4. Run: npm run dev"
echo ""






