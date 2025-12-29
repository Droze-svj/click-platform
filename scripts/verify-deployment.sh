#!/bin/bash

# Deployment Verification Script
# Verifies that deployment was successful

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Verifying Production Deployment...${NC}"
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:5001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
HEALTH_ENDPOINT="$API_URL/api/health"

# Check counters
CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to run check
check() {
    local name=$1
    local command=$2
    
    echo -n "  Checking $name... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
        ((CHECKS_PASSED++))
        return 0
    else
        echo -e "${RED}❌${NC}"
        ((CHECKS_FAILED++))
        return 1
    fi
}

# 1. Check if PM2 is running
echo -e "${YELLOW}1. Process Management${NC}"
check "PM2 processes" "pm2 list | grep -q click-api"

# 2. Check application health
echo -e "${YELLOW}2. Application Health${NC}"
check "Health endpoint" "curl -f $HEALTH_ENDPOINT"

# Get health response
HEALTH_RESPONSE=$(curl -s $HEALTH_ENDPOINT || echo "{}")
if echo "$HEALTH_RESPONSE" | grep -q "success"; then
    echo -e "  ${GREEN}✅ Health check response valid${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "  ${RED}❌ Health check response invalid${NC}"
    ((CHECKS_FAILED++))
fi

# 3. Check database connection
echo -e "${YELLOW}3. Database${NC}"
check "MongoDB connection" "mongosh --eval 'db.adminCommand(\"ping\")' --quiet"

# 4. Check Redis (if configured)
if [ -n "$REDIS_URL" ]; then
    echo -e "${YELLOW}4. Redis${NC}"
    check "Redis connection" "redis-cli ping"
fi

# 5. Check Nginx
echo -e "${YELLOW}5. Web Server${NC}"
check "Nginx running" "systemctl is-active --quiet nginx"
check "Nginx config valid" "nginx -t"

# 6. Check SSL certificate
if [ -n "$FRONTEND_URL" ] && [[ "$FRONTEND_URL" == https://* ]]; then
    echo -e "${YELLOW}6. SSL Certificate${NC}"
    DOMAIN=$(echo "$FRONTEND_URL" | sed -e 's|^[^/]*//||' -e 's|/.*$||')
    check "SSL certificate valid" "certbot certificates | grep -q $DOMAIN"
    check "HTTPS accessible" "curl -k -f $FRONTEND_URL > /dev/null"
fi

# 7. Check disk space
echo -e "${YELLOW}7. System Resources${NC}"
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "  ${GREEN}✅ Disk usage: ${DISK_USAGE}%${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "  ${RED}❌ Disk usage: ${DISK_USAGE}% (above 80%)${NC}"
    ((CHECKS_FAILED++))
fi

# 8. Check memory
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ "$MEMORY_USAGE" -lt 90 ]; then
    echo -e "  ${GREEN}✅ Memory usage: ${MEMORY_USAGE}%${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "  ${YELLOW}⚠️  Memory usage: ${MEMORY_USAGE}% (above 90%)${NC}"
    ((CHECKS_FAILED++))
fi

# 9. Check logs for errors
echo -e "${YELLOW}8. Application Logs${NC}"
RECENT_ERRORS=$(pm2 logs click-api --lines 100 --nostream 2>&1 | grep -i "error" | wc -l)
if [ "$RECENT_ERRORS" -lt 10 ]; then
    echo -e "  ${GREEN}✅ Recent errors: $RECENT_ERRORS${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "  ${YELLOW}⚠️  Recent errors: $RECENT_ERRORS (check logs)${NC}"
    ((CHECKS_FAILED++))
fi

# 10. Check API endpoints
echo -e "${YELLOW}9. API Endpoints${NC}"
check "API accessible" "curl -f $API_URL/api/health"
check "API docs accessible" "curl -f $API_URL/api-docs > /dev/null"

# 11. Check OAuth configuration
echo -e "${YELLOW}10. OAuth Configuration${NC}"
if [ -f scripts/verify-oauth.sh ]; then
    if bash scripts/verify-oauth.sh > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅ OAuth configuration valid${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "  ${YELLOW}⚠️  OAuth configuration issues (check manually)${NC}"
        ((CHECKS_FAILED++))
    fi
else
    echo -e "  ${YELLOW}⚠️  OAuth verification script not found${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}📊 Verification Summary${NC}"
echo "  ${GREEN}Passed: $CHECKS_PASSED${NC}"
echo "  ${RED}Failed: $CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Deployment is healthy.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please review and fix issues.${NC}"
    exit 1
fi



