#!/bin/bash

# Get Free AI API Keys Script
# Interactive script to help users get API keys for free AI providers

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔑 Free AI API Keys Setup Guide${NC}"
echo ""
echo "This script will help you get API keys for free AI model providers."
echo "These keys unlock higher limits and better features."
echo ""

# Function to open URL
open_url() {
    if command -v open &> /dev/null; then
        open "$1"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$1"
    else
        echo "Please open: $1"
    fi
}

# OpenRouter
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}1. OpenRouter${NC}"
echo -e "${GREEN}   Free Tier: 50 requests/day (no key needed)${NC}"
echo -e "${GREEN}   With Key: Higher limits, priority access${NC}"
echo ""
echo "   Steps:"
echo "   1. Visit: https://openrouter.ai/keys"
echo "   2. Sign up or log in"
echo "   3. Create a new API key"
echo "   4. Copy the key"
echo ""
read -p "   Open OpenRouter keys page? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open_url "https://openrouter.ai/keys"
fi
read -p "   Enter your OpenRouter API key (or press Enter to skip): " OPENROUTER_KEY
if [ ! -z "$OPENROUTER_KEY" ]; then
    echo "OPENROUTER_API_KEY=$OPENROUTER_KEY" >> .env.production
    echo -e "${GREEN}   ✅ OpenRouter key added to .env.production${NC}"
fi
echo ""

# Hugging Face
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}2. Hugging Face${NC}"
echo -e "${GREEN}   Free Tier: 1000 requests/day${NC}"
echo -e "${GREEN}   With Key: Higher limits, access to more models${NC}"
echo ""
echo "   Steps:"
echo "   1. Visit: https://huggingface.co/settings/tokens"
echo "   2. Sign up or log in"
echo "   3. Create a new token (read access)"
echo "   4. Copy the token"
echo ""
read -p "   Open Hugging Face tokens page? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open_url "https://huggingface.co/settings/tokens"
fi
read -p "   Enter your Hugging Face API token (or press Enter to skip): " HF_KEY
if [ ! -z "$HF_KEY" ]; then
    echo "HUGGINGFACE_API_KEY=$HF_KEY" >> .env.production
    echo -e "${GREEN}   ✅ Hugging Face key added to .env.production${NC}"
fi
echo ""

# Cerebras
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}3. Cerebras${NC}"
echo -e "${GREEN}   Free Tier: 1M tokens/day (no key needed)${NC}"
echo -e "${GREEN}   With Key: Higher limits, priority access${NC}"
echo ""
echo "   Steps:"
echo "   1. Visit: https://www.cerebras.ai/api-access"
echo "   2. Sign up for API access"
echo "   3. Get your API key"
echo "   4. Copy the key"
echo ""
read -p "   Open Cerebras API access page? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open_url "https://www.cerebras.ai/api-access"
fi
read -p "   Enter your Cerebras API key (or press Enter to skip): " CEREBRAS_KEY
if [ ! -z "$CEREBRAS_KEY" ]; then
    echo "CEREBRAS_API_KEY=$CEREBRAS_KEY" >> .env.production
    echo -e "${GREEN}   ✅ Cerebras key added to .env.production${NC}"
fi
echo ""

# Replicate
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}4. Replicate${NC}"
echo -e "${GREEN}   Free Tier: \$5 credits for new users${NC}"
echo -e "${GREEN}   With Key: Access to premium models${NC}"
echo ""
echo "   Steps:"
echo "   1. Visit: https://replicate.com/account/api-tokens"
echo "   2. Sign up or log in"
echo "   3. Create a new API token"
echo "   4. Copy the token"
echo ""
read -p "   Open Replicate API tokens page? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open_url "https://replicate.com/account/api-tokens"
fi
read -p "   Enter your Replicate API token (or press Enter to skip): " REPLICATE_KEY
if [ ! -z "$REPLICATE_KEY" ]; then
    echo "REPLICATE_API_KEY=$REPLICATE_KEY" >> .env.production
    echo -e "${GREEN}   ✅ Replicate key added to .env.production${NC}"
fi
echo ""

# Summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Summary${NC}"
echo ""
echo "API keys have been added to .env.production"
echo ""
echo "Next steps:"
echo "  1. Review .env.production to verify keys"
echo "  2. Validate keys: npm run validate:free-ai-keys"
echo "  3. Test generation: Use the free AI models API"
echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""


