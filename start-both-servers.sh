#!/bin/bash

echo "🚀 STARTING BOTH SERVERS - CLICK PLATFORM"
echo "========================================"

# Kill any existing processes
echo "🛑 Killing existing processes..."
pkill -f "node.*server/index.js" || true
pkill -f "next-dev" || true
pkill -f "npm run dev" || true
sleep 3

# Get the absolute path to the project root
PROJECT_ROOT="/Users/dariovuma/Documents/WHOP_AI_V3"

# Start backend server in background
echo "🚀 Starting backend server (port 5001)..."
cd "$PROJECT_ROOT/server" || exit
NODE_ENV=development PORT=5001 node --max-old-space-size=2048 index.js &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Test backend
echo "🧪 Testing backend..."
curl -s http://localhost:5001/api/health | jq '.status' 2>/dev/null || echo "❌ Backend not responding"

# Start frontend server
echo "🚀 Starting frontend server (port 3010)..."
cd "$PROJECT_ROOT/client" || exit
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ SERVERS STARTED!"
echo "=================="
echo "🌐 Frontend: http://localhost:3010"
echo "🔧 Backend:  http://localhost:5001"
echo ""
echo "📧 Login credentials:"
echo "   Email: dariovuma@gmail.com"
echo "   Password: Test123"
echo ""
echo "🎬 Ready for video editing platform!"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
wait $FRONTEND_PID $BACKEND_PID





