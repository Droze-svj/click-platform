#!/bin/bash

echo "🔄 Force Restarting Backend Server with CORS Fixes"
echo "================================================="

# Kill ALL node processes aggressively
echo "🛑 Killing all Node.js processes..."
pkill -9 -f "node.*server/index.js" 2>/dev/null || true
pkill -9 -f "node.*--max-old-space-size" 2>/dev/null || true
pkill -9 node 2>/dev/null || true

# Wait for processes to die
sleep 5

# Check if port 5001 is still in use
if lsof -i :5001 > /dev/null 2>&1; then
    echo "❌ Port 5001 still in use. Force killing..."
    lsof -ti :5001 | xargs kill -9 2>/dev/null || true
    sleep 3
fi

# Double check
if lsof -i :5001 > /dev/null 2>&1; then
    echo "❌❌ CRITICAL: Cannot free port 5001"
    lsof -i :5001
    exit 1
fi

echo "✅ Port 5001 is free"

# Set environment variables
export NODE_ENV=development
export PORT=5001

echo "🚀 Starting fresh server with CORS fixes..."
echo "Server will be available at: http://localhost:5001"
echo "CORS configured for: http://localhost:3000"
echo ""

# Start server
exec node --max-old-space-size=2048 server/index.js





