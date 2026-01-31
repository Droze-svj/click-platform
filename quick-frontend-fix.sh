#!/bin/bash

echo "🚀 Quick React Frontend Fix"
echo "==========================="

cd frontend-integration

echo "🛑 Stopping React server..."
pkill -f "react-scripts start" || true
sleep 2

echo "🧹 Clearing all caches..."
rm -rf .next/
rm -rf node_modules/.cache/
npm cache clean --force 2>/dev/null || true

echo "🔄 Restarting React development server..."
echo "Opening http://localhost:3000"
echo ""
echo "If you see the AuthContext error again, press Ctrl+C and run:"
echo "cd frontend-integration && rm -rf node_modules && npm install && npm start"
echo ""

npm start





