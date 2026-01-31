#!/bin/bash
echo "Stopping existing server..."
pkill -f "node.*server/index.js" || true
pkill -f "react-scripts" || true
pkill -f "npm start" || true
sleep 3

echo "Starting server..."
cd "/Users/orlandhino/WHOP AI V3"
NODE_ENV=development PORT=5001 node --max-old-space-size=2048 server/index.js