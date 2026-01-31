#!/bin/bash

echo "🚀 WHOP AI V3 - Quick Start Script"
echo "=================================="

# Set environment variables
export NODE_ENV=development
export PORT=5001

echo "📋 Starting server with:"
echo "   NODE_ENV: $NODE_ENV"
echo "   PORT: $PORT"
echo "   Memory: 2GB heap"
echo ""

# Start server
echo "🔄 Starting server..."
node --max-old-space-size=2048 server/index.js

echo ""
echo "✅ Server started! Test with:"
echo "curl http://localhost:5001/api/health"
echo "curl http://localhost:5001/api/video/voice-hooks/library"





