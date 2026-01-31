#!/bin/bash

echo "🔧 Fixing React Frontend Issues"
echo "==============================="

# Navigate to frontend directory
cd frontend-integration

echo "🛑 Killing React development server..."
pkill -f "react-scripts" || true
pkill -f "npm start" || true
sleep 3

echo "🧹 Clearing React caches..."
rm -rf node_modules/.cache
rm -rf .next/cache 2>/dev/null || true
npm cache clean --force

echo "📦 Reinstalling dependencies..."
rm -rf node_modules package-lock.json
npm install

echo "🚀 Starting fresh React development server..."
echo "Server will be available at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start





