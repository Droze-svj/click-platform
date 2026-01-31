#!/bin/bash

echo "🧪 MANUAL VOICE HOOKS SYSTEM TEST"
echo "=================================="
echo ""

BASE_URL="http://localhost:5001"

echo "🔍 Testing Server Health..."
curl -s "$BASE_URL/api/health" | jq '.' 2>/dev/null || echo "❌ Server not responding"
echo ""

echo "📚 Testing Voice Hooks Library..."
curl -s "$BASE_URL/api/video/voice-hooks/library" | jq '.success' 2>/dev/null || echo "❌ Library failed"
echo ""

echo "🎯 Testing Voice Hook Templates..."
curl -s "$BASE_URL/api/video/voice-hooks/templates" | jq '.success' 2>/dev/null || echo "❌ Templates failed"
echo ""

echo "🤖 Testing AI Voice Hook Generation..."
curl -s -X POST "$BASE_URL/api/video/voice-hooks/generate-dynamic" \
  -H "Content-Type: application/json" \
  -d '{"content":"Amazing tech tutorial","style":"energetic","platform":"youtube"}' | jq '.success' 2>/dev/null || echo "❌ AI generation failed"
echo ""

echo "🛍️ Testing Voice Hook Marketplace..."
curl -s "$BASE_URL/api/video/voice-hooks/marketplace" | jq '.success' 2>/dev/null || echo "❌ Marketplace failed"
echo ""

echo "📊 Testing Performance Analytics..."
curl -s -X POST "$BASE_URL/api/video/voice-hooks/analyze-performance" \
  -H "Content-Type: application/json" \
  -d '{"voiceHookId":"intro_attention","videoMetrics":{"views":10000}}' | jq '.success' 2>/dev/null || echo "❌ Analytics failed"
echo ""

echo "🎬 Testing Voice Hook Sequences..."
curl -s -X POST "$BASE_URL/api/video/voice-hooks/create-sequence" \
  -H "Content-Type: application/json" \
  -d '{"videoDuration":300,"contentType":"tutorial"}' | jq '.success' 2>/dev/null || echo "❌ Sequences failed"
echo ""

echo "✅ Manual testing complete!"
echo ""
echo "💡 If any tests show errors, ensure server is running:"
echo "./quick-start.sh"





