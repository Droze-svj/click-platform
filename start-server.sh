#!/bin/bash

echo "🚀 WHOP AI V3 Server Startup Script"
echo "==================================="

# Set environment variables
export NODE_ENV=development
export PORT=5001

# Kill any existing processes
echo "🛑 Killing existing processes..."
pkill -f "node server/index.js" || true
pkill -f "npm start" || true
sleep 2

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Please create a .env file with your configuration."
    echo "See .env.example for template."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start server with increased memory
echo "🚀 Starting server with 2GB memory limit..."
echo "Server will be available at: http://localhost:5001"
echo "API Documentation: http://localhost:5001/api-docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

node --max-old-space-size=2048 server/index.js





