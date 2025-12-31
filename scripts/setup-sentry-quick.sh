#!/bin/bash

# Quick Sentry Setup Guide
# This script will guide you through setting up Sentry

echo "🔧 Sentry Setup Guide"
echo ""
echo "Sentry helps you track errors in production."
echo ""
echo "Steps:"
echo "1. Go to https://sentry.io/signup/"
echo "2. Create a free account"
echo "3. Create a new project (select 'Node.js')"
echo "4. Copy your DSN (looks like: https://xxxxx@xxxxx.ingest.sentry.io/xxxxx)"
echo ""
read -p "Have you created your Sentry account and project? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    read -p "Enter your Sentry DSN: " SENTRY_DSN
    
    if [ ! -z "$SENTRY_DSN" ]; then
        echo ""
        echo "✅ DSN received: ${SENTRY_DSN:0:30}..."
        echo ""
        echo "Next steps:"
        echo "1. Go to Render.com dashboard"
        echo "2. Click your service → Environment tab"
        echo "3. Click 'Add Environment Variable'"
        echo "4. Key: SENTRY_DSN"
        echo "5. Value: $SENTRY_DSN"
        echo "6. Click 'Save Changes'"
        echo "7. Render.com will auto-redeploy"
        echo ""
        echo "After deployment, check logs for: '✅ Sentry initialized'"
    else
        echo "❌ No DSN provided"
    fi
else
    echo ""
    echo "📝 Here's what to do:"
    echo ""
    echo "1. Visit: https://sentry.io/signup/"
    echo "2. Sign up for free account"
    echo "3. Create new project → Select 'Node.js'"
    echo "4. Copy the DSN"
    echo "5. Run this script again with your DSN"
    echo ""
    echo "Or manually add to Render.com:"
    echo "   - Go to Render.com → Your Service → Environment"
    echo "   - Add: SENTRY_DSN = your-dsn-here"
fi

