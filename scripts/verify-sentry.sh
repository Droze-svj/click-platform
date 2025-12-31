#!/bin/bash

# Verify Sentry Setup
SERVICE_URL="https://click-platform.onrender.com"

echo "🔍 Verifying Sentry Setup"
echo ""

# Check health endpoint for Sentry status
HEALTH=$(curl -s "$SERVICE_URL/api/health")

if echo "$HEALTH" | grep -q "sentry"; then
    echo "✅ Sentry status found in health endpoint"
    echo ""
    echo "Sentry details:"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null | grep -A 5 sentry || echo "$HEALTH" | grep -o '"sentry":[^}]*'
else
    echo "⚠️ Sentry status not found in health endpoint"
    echo "This might mean:"
    echo "  - Service hasn't redeployed yet (wait 2-3 minutes)"
    echo "  - Sentry is configured but not showing in health endpoint"
    echo ""
    echo "Let's check the raw health response:"
    echo "$HEALTH" | head -3
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Check Render.com Logs:"
echo "   - Go to Render.com → Your Service → Logs"
echo "   - Look for: 'Sentry initialized' or 'Sentry DSN configured'"
echo ""
echo "2. Check Sentry Dashboard:"
echo "   - Go to https://sentry.io"
echo "   - Open your project"
echo "   - Check 'Issues' tab (should be empty if no errors)"
echo ""
echo "3. Test Sentry (Optional):"
echo "   - Cause a test error to verify Sentry is tracking"
echo "   - Or wait for real errors to appear"
echo ""

