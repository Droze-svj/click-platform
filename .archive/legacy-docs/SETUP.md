# Setup Guide

## Prerequisites

- Node.js 18+ and npm
- MongoDB (local or cloud instance like MongoDB Atlas)
- FFmpeg (for video processing)
- OpenAI API key (for AI features)
- WHOP API key (for subscription management)

## Installation

### 1. Run Setup Script

```bash
./setup.sh
```

Or manually:

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..

# Create upload directories
mkdir -p uploads/{videos,clips,thumbnails,quotes}
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: A random secret for JWT tokens
- `OPENAI_API_KEY`: Your OpenAI API key
- `WHOP_API_KEY`: Your WHOP API key
- `WHOP_API_URL`: WHOP API endpoint (default: https://api.whop.com/api/v2)

### 3. Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html

### 4. Start MongoDB

If using local MongoDB:
```bash
mongod
```

Or use MongoDB Atlas (cloud) and update `MONGODB_URI` in `.env`.

## Running the Application

### Development Mode

Start both backend and frontend:
```bash
npm run dev
```

Or separately:
```bash
# Backend (port 5000)
npm run dev:server

# Frontend (port 3000)
npm run dev:client
```

### Production Mode

```bash
# Build frontend
npm run build

# Start server
npm start
```

## Features Overview

### 1. Auto Video Clipper
- Upload long-form videos
- Automatically detects highlights
- Generates short clips (60 seconds)
- Adds captions and thumbnails

### 2. Text-to-Content Generator
- Paste articles or transcripts
- Generates social media posts for multiple platforms
- Creates blog summaries
- Suggests viral post ideas

### 3. Quote Card Designer
- Auto-detects memorable quotes
- Generates branded graphics
- Customizable colors and styles
- Niche-specific templates

### 4. Content Scheduler
- Schedule posts across 10+ platforms
- Calendar view
- Bulk scheduling
- Platform-specific optimization

### 5. Performance AI
- Weekly performance reports
- Best-performing content analysis
- Platform recommendations
- Engagement insights

### 6. Niche Packs
- Pre-configured templates by niche
- Brand customization
- Color palettes
- Hashtag suggestions

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Video Processing
- `POST /api/video/upload` - Upload video
- `GET /api/video/:contentId/status` - Check processing status
- `GET /api/video` - List user videos

### Content Generation
- `POST /api/content/generate` - Generate content from text
- `GET /api/content/:contentId` - Get generated content
- `GET /api/content` - List all content

### Quote Cards
- `POST /api/quote/generate` - Generate quote cards
- `GET /api/quote/content/:contentId` - Get quote cards for content

### Scheduler
- `POST /api/scheduler/schedule` - Schedule a post
- `GET /api/scheduler` - Get scheduled posts
- `GET /api/scheduler/calendar` - Calendar view
- `PUT /api/scheduler/:postId` - Update post
- `DELETE /api/scheduler/:postId` - Delete post

### Analytics
- `GET /api/analytics/performance` - Performance metrics
- `GET /api/analytics/weekly-report` - Weekly report
- `GET /api/analytics/content/:contentId` - Content performance

### Niche & Branding
- `GET /api/niche/packs` - Get all niche packs
- `PUT /api/niche/select` - Select niche
- `GET /api/niche/my-pack` - Get user's niche pack
- `PUT /api/niche/brand` - Update brand settings

### Subscription
- `POST /api/subscription/verify` - Verify WHOP subscription
- `GET /api/subscription/status` - Get subscription status
- `POST /api/subscription/webhook` - WHOP webhook handler

## Troubleshooting

### Video Processing Fails
- Ensure FFmpeg is installed and in PATH
- Check file size limits in `.env`
- Verify video format is supported (mp4, mov, avi, mkv, webm)

### OpenAI API Errors
- Verify API key is correct
- Check API quota/credits
- Ensure model access (gpt-4)

### MongoDB Connection Issues
- Verify MongoDB is running
- Check connection string format
- Ensure network access if using cloud MongoDB

### WHOP Integration
- Verify API key and endpoint
- Check webhook URL is accessible
- Test in WHOP sandbox mode first

## Next Steps

1. Set up WHOP product and webhooks (see `WHOP_INTEGRATION.md`)
2. Configure platform APIs for actual posting (Instagram Graph API, Twitter API, etc.)
3. Set up production hosting (Heroku, AWS, etc.)
4. Configure file storage (AWS S3, Cloudinary, etc.)
5. Add email notifications
6. Implement payment processing if needed







