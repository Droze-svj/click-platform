#!/bin/bash

# Script to add missing environment variables to .env.production

ENV_FILE=".env.production"

# Check if .env.production exists, if not create from template
if [ ! -f "$ENV_FILE" ]; then
    if [ -f "env.production.template" ]; then
        cp env.production.template "$ENV_FILE"
        echo "✅ Created .env.production from template"
    else
        echo "❌ env.production.template not found"
        exit 1
    fi
fi

# Check if NEXT_PUBLIC_API_URL is missing or set to default
if ! grep -q "^NEXT_PUBLIC_API_URL=" "$ENV_FILE" || grep -q "^NEXT_PUBLIC_API_URL=.*localhost" "$ENV_FILE"; then
    # Check if we're in development or production context
    if [ -f ".env" ]; then
        # Try to get the API URL from .env or use default
        EXISTING_URL=$(grep "^NEXT_PUBLIC_API_URL=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'")
        if [ -n "$EXISTING_URL" ] && [[ ! "$EXISTING_URL" == *"localhost"* ]]; then
            API_URL="$EXISTING_URL"
        else
            # Default production URL (user should update this)
            API_URL="https://api.yourdomain.com/api"
        fi
    else
        API_URL="https://api.yourdomain.com/api"
    fi
    
    # Remove existing NEXT_PUBLIC_API_URL if present
    sed -i.bak '/^NEXT_PUBLIC_API_URL=/d' "$ENV_FILE"
    
    # Add the new one (find a good place to add it, after FRONTEND_URL or at the top)
    if grep -q "^FRONTEND_URL=" "$ENV_FILE"; then
        # Add after FRONTEND_URL
        sed -i.bak "/^FRONTEND_URL=/a\\
NEXT_PUBLIC_API_URL=$API_URL
" "$ENV_FILE"
    else
        # Add at the top of server configuration section
        sed -i.bak "/^# ============================================\$/,/^# SERVER CONFIGURATION\$/,/^# ============================================\$/{
            /^# ============================================\$/a\\
NEXT_PUBLIC_API_URL=$API_URL
}" "$ENV_FILE" 2>/dev/null || echo "NEXT_PUBLIC_API_URL=$API_URL" >> "$ENV_FILE"
    fi
    
    # Clean up backup file
    rm -f "${ENV_FILE}.bak"
    
    echo "✅ Added NEXT_PUBLIC_API_URL=$API_URL to $ENV_FILE"
    echo "⚠️  Please update this URL with your actual production API URL"
else
    echo "✅ NEXT_PUBLIC_API_URL already configured"
fi

echo ""
echo "Current NEXT_PUBLIC_API_URL value:"
grep "^NEXT_PUBLIC_API_URL=" "$ENV_FILE" || echo "Not found"



