#!/bin/bash

# Update .env.production with generated secrets
# This script helps add missing secrets to .env.production

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

ENV_FILE=".env.production"

echo -e "${BLUE}🔧 Updating .env.production with generated secrets...${NC}"
echo ""

# Generate secrets if not provided
JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 32)}
SESSION_SECRET=${SESSION_SECRET:-$(openssl rand -base64 32)}
ENCRYPTION_KEY=${ENCRYPTION_KEY:-$(openssl rand -base64 32)}

# Check if .env.production exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  .env.production not found. Creating from template...${NC}"
    if [ -f "env.production.template" ]; then
        cp env.production.template "$ENV_FILE"
        echo -e "${GREEN}✅ Created .env.production from template${NC}"
    else
        echo -e "${RED}❌ env.production.template not found!${NC}"
        exit 1
    fi
fi

# Update JWT_SECRET if it's a placeholder
if grep -q "JWT_SECRET=your-super-secret" "$ENV_FILE" || ! grep -q "^JWT_SECRET=" "$ENV_FILE"; then
    if grep -q "^JWT_SECRET=" "$ENV_FILE"; then
        sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$ENV_FILE"
    else
        echo "JWT_SECRET=$JWT_SECRET" >> "$ENV_FILE"
    fi
    echo -e "${GREEN}✅ Updated JWT_SECRET${NC}"
else
    echo -e "${YELLOW}⚠️  JWT_SECRET already set (skipping)${NC}"
fi

# Update SESSION_SECRET if needed
if ! grep -q "^SESSION_SECRET=" "$ENV_FILE"; then
    echo "SESSION_SECRET=$SESSION_SECRET" >> "$ENV_FILE"
    echo -e "${GREEN}✅ Added SESSION_SECRET${NC}"
fi

# Update ENCRYPTION_KEY if needed
if ! grep -q "^ENCRYPTION_KEY=" "$ENV_FILE"; then
    echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> "$ENV_FILE"
    echo -e "${GREEN}✅ Added ENCRYPTION_KEY${NC}"
fi

# Check for OPENAI_API_KEY
if ! grep -q "^OPENAI_API_KEY=" "$ENV_FILE" || grep -q "OPENAI_API_KEY=sk-your" "$ENV_FILE"; then
    echo -e "${YELLOW}⚠️  OPENAI_API_KEY needs to be set manually${NC}"
    echo -e "${BLUE}💡 Add your OpenAI API key to .env.production:${NC}"
    echo "   OPENAI_API_KEY=sk-your-actual-key-here"
fi

echo ""
echo -e "${GREEN}✅ .env.production updated!${NC}"
echo ""
echo -e "${BLUE}📝 Next steps:${NC}"
echo "  1. Add OPENAI_API_KEY to .env.production if not set"
echo "  2. Review other environment variables"
echo "  3. Run: npm run validate:production"
echo ""


