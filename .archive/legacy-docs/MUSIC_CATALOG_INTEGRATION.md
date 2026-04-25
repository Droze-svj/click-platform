# Music Catalog Integration Guide

## Overview

Unified music catalog system that integrates licensed tracks, AI-generated music, and user uploads into a single searchable interface.

## Features

### 1. **Unified Catalog Search**

Search across all music sources:
- **Licensed Tracks**: From providers like Soundstripe, Artlist, HookSounds
- **AI-Generated**: Music created via Mubert, Soundraw APIs
- **User Uploads**: User-uploaded tracks

**API Endpoint:**
```
GET /api/music-catalog/search?q=query&genre=electronic&mood=energetic&page=1&limit=50
```

**Query Parameters:**
- `q` - Search query (title, artist, tags)
- `genre` - Filter by genre
- `mood` - Filter by mood
- `bpm` - Filter by BPM
- `duration` - Filter by duration
- `vocals` - Filter by vocals/instrumental (true/false)
- `source` - Filter by source (licensed, ai_generated, user_upload, all)
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "tracks": [
      {
        "id": "track_id",
        "title": "Track Title",
        "artist": "Artist Name",
        "genre": ["electronic"],
        "mood": ["energetic"],
        "duration": 180,
        "bpm": 128,
        "previewUrl": "https://...",
        "thumbnailUrl": "https://...",
        "provider": "soundstripe",
        "source": "licensed",
        "license": {
          "allowsCommercialUse": true,
          "allowsSocialPlatforms": true,
          "allowsMonetization": true,
          "requiresAttribution": false,
          "platforms": ["youtube", "tiktok", "instagram", "facebook", "twitter", "linkedin"]
        },
        "isFavorite": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "totalPages": 3
    },
    "sources": {
      "licensed": 50,
      "aiGenerated": 30,
      "userUploads": 20
    }
  }
}
```

### 2. **Track Details & License Information**

Get detailed track information including usage permissions.

**API Endpoint:**
```
GET /api/music-catalog/track/:trackId?source=licensed
GET /api/music-catalog/track/:trackId/license?source=licensed
```

**License Information:**
```json
{
  "trackId": "track_id",
  "title": "Track Title",
  "artist": "Artist Name",
  "license": {
    "allowsCommercialUse": true,
    "allowsSocialPlatforms": true,
    "allowsMonetization": true,
    "requiresAttribution": false,
    "attributionText": null,
    "platforms": ["youtube", "tiktok", "instagram", "facebook", "twitter", "linkedin"]
  },
  "usagePermissions": {
    "commercialUse": true,
    "socialPlatforms": true,
    "monetization": true,
    "platforms": ["youtube", "tiktok", "instagram", "facebook", "twitter", "linkedin"],
    "requiresAttribution": false,
    "attributionText": null
  },
  "tooltip": "Safe for monetized social videos under Click's license"
}
```

### 3. **Preview Streaming**

Stream preview audio with range request support.

**API Endpoint:**
```
GET /api/music-catalog/track/:trackId/preview?source=licensed
```

**Features:**
- Supports HTTP range requests for seeking
- Cached preview URLs (1 hour TTL)
- Respects provider caching limits
- Automatic proxying for external URLs

### 4. **Download for Editing**

Get download URL for in-app editing (respects provider limits).

**API Endpoint:**
```
POST /api/music-catalog/track/:trackId/download
Body: { "source": "licensed" }
```

**Response:**
```json
{
  "url": "https://...",
  "temporary": true,
  "expiresAt": "2024-01-01T12:00:00Z"
}
```

**Note:** Some licensed tracks may only allow preview streaming, not full downloads. In such cases, the preview URL is returned with `temporary: true`.

### 5. **Favorites**

Add tracks to favorites for quick access.

**API Endpoints:**
```
POST /api/music-catalog/track/:trackId/favorite
Body: { "source": "licensed" }
```

### 6. **Available Filters**

Get all available filter options (genres, moods, sources).

**API Endpoint:**
```
GET /api/music-catalog/filters
```

**Response:**
```json
{
  "filters": {
    "genres": ["electronic", "pop", "rock", "jazz", ...],
    "moods": ["energetic", "calm", "dramatic", "happy", ...],
    "sources": ["licensed", "ai_generated", "user_upload"]
  }
}
```

## Provider Authentication

### User Session Registration

The system automatically handles user/session registration with providers:

1. **Platform-Level Auth**: Most providers use platform API keys
2. **User-Specific Sessions**: Some providers require user registration
3. **Automatic Handling**: Authentication happens automatically on first catalog access

**Implementation:**
- `musicProviderAuthService.js` - Handles provider authentication
- `musicCatalogAuthService.js` - Manages catalog access
- Automatic session registration on catalog search

## Frontend Integration

### Music Panel in Editor

**Recommended UI Components:**

1. **Search Bar**
   - Text search with autocomplete
   - Filter dropdowns (genre, mood, BPM, duration)
   - Source toggle (all, licensed, AI-generated, user uploads)

2. **Track List**
   - Thumbnail/cover art
   - Title, artist, duration
   - Preview button (inline player)
   - Favorite button
   - License indicator (tooltip with permissions)

3. **Track Details**
   - Full license information
   - Usage permissions tooltip
   - Download button (if available)
   - Add to project button

4. **Inline Preview**
   - Waveform visualization
   - Play/pause controls
   - Seek bar
   - Volume control

### Usage Permissions Tooltip

Display tooltip with license information:
- **Text**: "Safe for monetized social videos under Click's license"
- **Details**: Shows commercial use, monetization, platform coverage
- **Attribution**: Shows if attribution is required

### Example UI Flow

1. User opens Music panel in editor
2. System authenticates with providers (automatic)
3. User searches/browses catalog
4. User previews track (inline player)
5. User checks license tooltip
6. User adds track to project
7. Track is downloaded/streamed for editing
8. Track is added to video timeline

## Caching & Performance

### Preview Caching
- Preview URLs cached for 1 hour
- Reduces API calls to providers
- Respects provider caching limits

### Search Results
- Results cached based on query + filters
- Cache invalidation on new uploads/generations
- Pagination for large result sets

## Provider Limits & Compliance

### Caching Limits
- Previews: Cached for 1 hour max
- Downloads: Temporary URLs expire based on provider policy
- Redistribution: Tracks only available within Click platform

### Usage Tracking
- Track usage counts tracked
- Last used timestamp recorded
- Analytics available for optimization

## Error Handling

### Common Errors

1. **Provider Not Configured**
   - Error: "Provider not configured"
   - Solution: Configure provider in admin settings

2. **Authentication Failed**
   - Error: "No authenticated music providers available"
   - Solution: Check API keys and provider configuration

3. **Track Not Found**
   - Error: "Track not found"
   - Solution: Track may have been removed or not accessible

4. **Preview Not Available**
   - Error: "Preview not available"
   - Solution: Some tracks may not have preview URLs

## Best Practices

1. **Always check license before use**
   - Verify commercial use permission
   - Check platform coverage
   - Note attribution requirements

2. **Use previews for selection**
   - Stream previews instead of downloading
   - Only download when track is added to project

3. **Respect provider limits**
   - Don't cache beyond TTL
   - Don't redistribute outside platform
   - Track usage properly

4. **Handle authentication gracefully**
   - Cache authentication state
   - Re-authenticate on errors
   - Show user-friendly error messages

## Future Enhancements

- [ ] Real-time preview streaming
- [ ] Advanced filtering (key, tempo, etc.)
- [ ] Playlist creation and management
- [ ] Track recommendations based on video content
- [ ] Batch download for offline editing
- [ ] Collaborative playlists
- [ ] Track versioning (different lengths/edits)







