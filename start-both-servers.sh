#!/bin/bash

echo "🚀 STARTING BOTH SERVERS - WHOP AI V3"
echo "===================================="

# Kill any existing processes
echo "🛑 Killing existing processes..."
pkill -f "node.*server/index.js" || true
pkill -f "react-scripts" || true
pkill -f "npm start" || true
sleep 3

# Start backend server in background
echo "🚀 Starting backend server (port 5001)..."
cd "/Users/orlandhino/WHOP AI V3"
NODE_ENV=development PORT=5001 node --max-old-space-size=2048 server/index.js &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Test backend
echo "🧪 Testing backend..."
curl -s http://localhost:5001/api/health | jq '.status' 2>/dev/null || echo "❌ Backend not responding"

# Start frontend server
echo "🚀 Starting frontend server (port 3000)..."
cd "frontend-integration"
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ SERVERS STARTED!"
echo "=================="
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:5001"
echo ""
echo "📧 Login credentials:"
echo "   Email: dariovuma@gmail.com"
echo "   Password: Test123"
echo ""
echo "🎬 Ready for voice hooks platform!"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
wait $FRONTEND_PID $BACKEND_PID





