#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export NODE_ENV=development
export PORT=5001
export REDIS_URL=

echo "Starting Backend..."
nohup node server/index.js > backend.log 2>&1 &
echo $! > backend.pid

echo "Starting Frontend..."
cd client
nohup npm run dev -- --port 3010 > ../client.log 2>&1 &
echo $! > ../client.pid

echo "Processes started. Check backend.log and client.log for details."
