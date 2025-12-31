#!/bin/bash

# Test YouTube Video Upload
# This script tests uploading a video to YouTube

SERVICE_URL="https://click-platform.onrender.com"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "📹 YouTube Video Upload Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if token is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Authentication token is required${NC}"
    echo ""
    echo "Usage:"
    echo "  ./scripts/test-youtube-upload.sh YOUR_TOKEN [VIDEO_FILE_PATH]"
    echo ""
    echo "To get a token:"
    echo "  ./scripts/complete-youtube-oauth-flow.sh"
    echo ""
    exit 1
fi

TOKEN="$1"
VIDEO_FILE="${2:-}"

echo -e "${CYAN}Using token: ${TOKEN:0:50}...${NC}"
echo ""

# Check if video file is provided
if [ -z "$VIDEO_FILE" ]; then
    echo -e "${YELLOW}⚠️  No video file provided${NC}"
    echo ""
    echo "This script requires a video file to upload."
    echo ""
    echo "Usage:"
    echo "  ./scripts/test-youtube-upload.sh YOUR_TOKEN /path/to/video.mp4"
    echo ""
    echo "Example:"
    echo "  ./scripts/test-youtube-upload.sh YOUR_TOKEN ~/Videos/test-video.mp4"
    echo ""
    echo -e "${CYAN}Note:${NC} The video file must be:"
    echo "  - A valid video format (MP4, MOV, AVI, etc.)"
    echo "  - Under YouTube's size limits"
    echo "  - Accessible from your machine"
    echo ""
    exit 1
fi

# Check if video file exists
if [ ! -f "$VIDEO_FILE" ]; then
    echo -e "${RED}❌ Error: Video file not found: $VIDEO_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Video file found: $VIDEO_FILE${NC}"
FILE_SIZE=$(du -h "$VIDEO_FILE" | cut -f1)
echo -e "${CYAN}File size: $FILE_SIZE${NC}"
echo ""

# Get video metadata
echo -e "${BLUE}📋 Video Upload Details${NC}"
read -p "Video title: " VIDEO_TITLE
read -p "Video description (optional): " VIDEO_DESCRIPTION
read -p "Privacy status (public/unlisted/private) [public]: " PRIVACY_STATUS
PRIVACY_STATUS=${PRIVACY_STATUS:-public}

echo ""
echo -e "${YELLOW}⚠️  Ready to upload:${NC}"
echo "  Title: $VIDEO_TITLE"
echo "  Description: ${VIDEO_DESCRIPTION:-None}"
echo "  Privacy: $PRIVACY_STATUS"
echo "  File: $VIDEO_FILE"
echo ""
read -p "Continue with upload? (y/N): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo -e "${YELLOW}Cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}🔄 Uploading video to YouTube...${NC}"
echo ""

# Note: This is a simplified example. In production, you'd need to:
# 1. Convert the video file to base64 or use multipart/form-data
# 2. Handle the file upload properly
# 3. Show upload progress

# For now, we'll show the API call structure
echo -e "${CYAN}API Call Structure:${NC}"
echo "POST $SERVICE_URL/api/oauth/youtube/upload"
echo "Headers:"
echo "  Authorization: Bearer $TOKEN"
echo "  Content-Type: multipart/form-data"
echo "Body:"
echo "  videoFile: [video file]"
echo "  title: $VIDEO_TITLE"
echo "  description: ${VIDEO_DESCRIPTION:-}"
echo "  options: { privacyStatus: $PRIVACY_STATUS }"
echo ""

echo -e "${YELLOW}⚠️  Note:${NC} The actual upload requires proper multipart/form-data handling."
echo "This is typically done from a frontend application or using a tool like curl with proper file handling."
echo ""
echo -e "${CYAN}Example curl command (requires proper multipart handling):${NC}"
echo "curl -X POST '$SERVICE_URL/api/oauth/youtube/upload' \\"
echo "  -H 'Authorization: Bearer $TOKEN' \\"
echo "  -F 'videoFile=@$VIDEO_FILE' \\"
echo "  -F 'title=$VIDEO_TITLE' \\"
echo "  -F 'description=${VIDEO_DESCRIPTION:-}' \\"
echo "  -F 'options[privacyStatus]=$PRIVACY_STATUS'"
echo ""
echo -e "${CYAN}Or use a tool like Postman or a frontend application for proper file upload.${NC}"

