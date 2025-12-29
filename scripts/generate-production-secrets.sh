#!/bin/bash

# Generate Production Secrets Script
# Generates secure secrets for production deployment

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔐 Generating Production Secrets...${NC}"
echo ""

# Generate JWT Secret
JWT_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}✅ JWT_SECRET generated${NC}"
echo "JWT_SECRET=$JWT_SECRET"
echo ""

# Generate session secret (if needed)
SESSION_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}✅ SESSION_SECRET generated${NC}"
echo "SESSION_SECRET=$SESSION_SECRET"
echo ""

# Generate encryption key (if needed)
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo -e "${GREEN}✅ ENCRYPTION_KEY generated${NC}"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo ""

echo -e "${YELLOW}📝 Add these to your .env.production file:${NC}"
echo ""
echo "JWT_SECRET=$JWT_SECRET"
echo "SESSION_SECRET=$SESSION_SECRET"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo ""

echo -e "${BLUE}💡 Tip: Keep these secrets secure and never commit them to version control!${NC}"


