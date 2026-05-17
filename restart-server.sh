#!/bin/bash
echo "Stopping existing server..."
pkill -f "node.*server/index.js" || true
pkill -f "react-scripts" || true
pkill -f "npm start" || true
sleep 3

echo "Starting server..."
# Get the absolute path of the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"
NODE_ENV=development PORT=5001 node --max-old-space-size=2048 server/index.js