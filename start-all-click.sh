#!/bin/bash
echo "🚀 Starting all Click Platform servers..."

# Port cleanup
echo "🛑 Cleaning up ports..."
lsof -ti:5001,3000,3010 | xargs kill -9 2>/dev/null || true
sleep 2

# Start Backend
echo "📡 Starting Backend (Port 5001)..."
NODE_ENV=development PORT=5001 node --max-old-space-size=2048 server/index.js > backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend
echo "⏳ Waiting for backend to initialize..."
sleep 15

# Start Next.js Client (Main Platform)
echo "📱 Starting Next.js Client (Port 3000)..."
cd client && npm run dev > ../client.log 2>&1 &
CLIENT_PID=$!
cd ..

echo "✅ All servers launched!"
echo "📡 Backend: http://localhost:5001"
echo "📱 Client: http://localhost:3000 (Premium Landing Page)"
echo "---"
echo "View logs with: tail -f backend.log client.log"
