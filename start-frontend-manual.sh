#!/bin/bash

echo "🚀 Starting WHOP AI V3 Frontend (React App)"
echo "==========================================="

# Navigate to frontend directory
cd frontend-integration

echo "📦 Installing dependencies (if needed)..."
npm install

echo "🧹 Clearing cache..."
rm -rf node_modules/.cache
rm -rf .next/cache 2>/dev/null || true
npm cache clean --force

echo "🚀 Starting React development server..."
echo "Server will be available at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start





