#!/bin/bash

echo "🧪 Testing Login API Endpoint"
echo "============================="

# Test health endpoint first
echo "🏥 Testing server health..."
curl -s http://localhost:5001/api/health | jq '.status' 2>/dev/null || echo "❌ Server not responding"

echo ""
echo "🔐 Testing login with test credentials..."

# Test login with test credentials
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "email": "test@example.com",
    "password": "Test123"
  }' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || echo "❌ Login test failed"

echo ""
echo "🔐 Testing login with your email..."

# Test login with the user's email
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "email": "dariovuma@gmail.com",
    "password": "Test123"
  }' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || echo "❌ Login test failed"

echo ""
echo "✅ Test complete - check the responses above!"





