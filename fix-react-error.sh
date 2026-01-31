#!/bin/bash

echo "🔧 REACT AUTHCONTEXT ERROR FIX"
echo "=============================="

# Check current directory
echo "📍 Current directory: $(pwd)"

if [[ "$(basename $(pwd))" == "WHOP AI V3" ]]; then
    echo "✅ In main project directory"
    FRONTEND_DIR="frontend-integration"
elif [[ "$(basename $(pwd))" == "frontend-integration" ]]; then
    echo "✅ Already in frontend directory"
    FRONTEND_DIR="."
else
    echo "❌ Not in correct directory. Please run from WHOP AI V3 or frontend-integration directory"
    exit 1
fi

echo "🎯 Frontend directory: $FRONTEND_DIR"

# Navigate to frontend directory
cd "$FRONTEND_DIR"

echo "🛑 Killing all React processes..."
pkill -f "react-scripts" || true
pkill -f "npm.*start" || true
sleep 3

echo "🧹 Clearing all React caches and build files..."
rm -rf .next/
rm -rf node_modules/.cache/
rm -rf build/
rm -rf dist/
npm cache clean --force 2>/dev/null || true

echo "🔄 Clearing browser cache hint..."
echo "After restart, do a hard refresh in browser:"
echo "  - Chrome: Ctrl+F5 or Cmd+Shift+R"
echo "  - Firefox: Ctrl+F5"
echo "  - Safari: Cmd+Option+R"

echo ""
echo "🚀 Starting React development server..."
echo "Server will be available at: http://localhost:3000"
echo ""
echo "If you see the AuthContext error again:"
echo "1. Hard refresh your browser (Ctrl+F5)"
echo "2. Clear browser cache for localhost:3000"
echo "3. Try incognito/private browsing mode"
echo ""

npm start





