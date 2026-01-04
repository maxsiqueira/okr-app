#!/bin/bash

# Ion Dashboard Startup Script
# Starts both Vite dev server and Jira Proxy

echo "🚀 Starting Ion Strategic Dashboard..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start proxy in background
echo "🔌 Starting Proxy Server..."
node server/proxy.js &
PROXY_PID=$!

# Give proxy time to start
sleep 2

# Start Vite
echo "⚡ Starting Vite Dev Server..."
npm run vite

# Cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $PROXY_PID 2>/dev/null
    exit 0
}

trap cleanup EXIT INT TERM
