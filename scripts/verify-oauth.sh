#!/bin/bash

# OAuth Configuration Verification Script
# Verifies that OAuth is properly configured for all platforms

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔐 Verifying OAuth Configuration...${NC}"
echo ""

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

CHECKS_PASSED=0
CHECKS_FAILED=0

check_oauth() {
    local platform=$1
    local client_id_var=$2
    local client_secret_var=$3
    local callback_url_var=$4
    
    echo -e "${YELLOW}Checking ${platform}...${NC}"
    
    # Check if variables are set
    if [ -z "${!client_id_var}" ] || [ -z "${!client_secret_var}" ]; then
        echo -e "  ${RED}❌ ${platform} credentials not configured${NC}"
        ((CHECKS_FAILED++))
        return 1
    fi
    
    # Check callback URL format
    if [ -n "${!callback_url_var}" ]; then
        if [[ "${!callback_url_var}" == https://* ]]; then
            echo -e "  ${GREEN}✅ ${platform} credentials configured${NC}"
            echo -e "  ${GREEN}✅ Callback URL: ${!callback_url_var}${NC}"
            ((CHECKS_PASSED++))
            return 0
        else
            echo -e "  ${YELLOW}⚠️  Callback URL should use HTTPS: ${!callback_url_var}${NC}"
        fi
    fi
    
    echo -e "  ${GREEN}✅ ${platform} credentials configured${NC}"
    ((CHECKS_PASSED++))
    return 0
}

# Check Twitter OAuth
check_oauth "Twitter/X" "TWITTER_CLIENT_ID" "TWITTER_CLIENT_SECRET" "TWITTER_CALLBACK_URL"

# Check LinkedIn OAuth
check_oauth "LinkedIn" "LINKEDIN_CLIENT_ID" "LINKEDIN_CLIENT_SECRET" "LINKEDIN_CALLBACK_URL"

# Check Facebook OAuth
check_oauth "Facebook" "FACEBOOK_APP_ID" "FACEBOOK_APP_SECRET" "FACEBOOK_CALLBACK_URL"

# Note: Instagram uses Facebook credentials
if [ -n "$FACEBOOK_APP_ID" ] && [ -n "$FACEBOOK_APP_SECRET" ]; then
    echo -e "${YELLOW}Checking Instagram...${NC}"
    echo -e "  ${GREEN}✅ Instagram uses Facebook credentials (configured)${NC}"
    ((CHECKS_PASSED++))
fi

# Summary
echo ""
echo -e "${BLUE}📊 OAuth Verification Summary${NC}"
echo "  ${GREEN}Passed: $CHECKS_PASSED${NC}"
echo "  ${RED}Failed: $CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All OAuth platforms configured!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some OAuth platforms are not configured.${NC}"
    echo -e "${YELLOW}Please add missing credentials to .env.production${NC}"
    exit 1
fi


