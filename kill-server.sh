#!/bin/bash

echo "🛑 Killing existing server processes..."
echo "====================================="

# Kill all node processes running the server
pkill -f "node.*server/index.js" || echo "No server processes found"
pkill -f "node.*--max-old-space-size" || echo "No memory-limited processes found"

# Wait a moment
sleep 3

# Check if port 5001 is still in use
if lsof -i :5001 > /dev/null 2>&1; then
    echo "❌ Port 5001 still in use. Trying to kill more aggressively..."
    lsof -ti :5001 | xargs kill -9 2>/dev/null || echo "Could not kill process on port 5001"
    sleep 2
fi

# Check again
if lsof -i :5001 > /dev/null 2>&1; then
    echo "❌ Port 5001 is still occupied"
    lsof -i :5001
else
    echo "✅ Port 5001 is now free"
fi





