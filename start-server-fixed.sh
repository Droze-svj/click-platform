#!/bin/bash

echo "🚀 Starting WHOP AI V3 Server with CORS Fixes"
echo "============================================="

# Set environment variables
export NODE_ENV=development
export PORT=5001

# Kill any existing processes (more aggressively)
echo "🛑 Killing existing processes..."
pkill -9 -f "node.*server/index.js" 2>/dev/null || true
pkill -9 -f "node.*--max-old-space-size" 2>/dev/null || true
sleep 3

# Check if port is still in use
if lsof -i :5001 > /dev/null 2>&1; then
    echo "❌ Port 5001 still in use. Force killing..."
    lsof -ti :5001 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

echo "🚀 Starting server with CORS allowing localhost:3000..."
echo "Server will be available at: http://localhost:5001"
echo "CORS configured for development"
echo ""

# Start server
exec node --max-old-space-size=2048 server/index.js





