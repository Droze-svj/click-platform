# Music Catalog - Advanced Features

## Overview

Enhanced music catalog with advanced search, recommendations, playlists, analytics, and real-time synchronization.

## New Features

### 1. **Advanced Search** (`musicCatalogSearchAdvanced.js`)

**Autocomplete & Suggestions:**
- Real-time search suggestions as user types
- Suggestions for tracks, artists, genres, moods
- Cross-source search (licensed, AI-generated, user uploads)

**API:**
```
GET /api/music-catalog/search/suggestions?q=electro&limit=10
```

**Response:**
```json
{
  "suggestions": {
    "tracks": [
      { "id": "...", "title": "Electronic Dreams", "artist": "Artist Name", "source": "licensed" }
    ],
    "artists": [
      { "name": "Artist Name", "source": "licensed" }
    ],
    "genres": [
      { "name": "electronic", "source": "licensed" }
    ],
    "moods": [
      { "name": "energetic", "source": "licensed" }
    ]
  }
}
```

**Popular Search Terms:**
```
GET /api/music-catalog/search/popular-terms?limit=10
```

Returns trending genres and moods based on catalog data.

### 2. **Track Recommendations** (`musicCatalogRecommendations.js`)

**Recommendation Types:**
- **Usage-based**: Based on user's listening/usage patterns
- **Favorites-based**: Similar to user's favorite tracks
- **Similar tracks**: Tracks similar to a specific track
- **Trending**: Currently popular tracks

**API:**
```
GET /api/music-catalog/recommendations?basedOn=usage&limit=20
GET /api/music-catalog/recommendations?basedOn=similar&trackId=xxx&limit=10
GET /api/music-catalog/recommendations?basedOn=trending&limit=20
```

**Content-based Recommendations:**
```
POST /api/music-catalog/recommendations/content
Body: {
  "contentMetadata": {
    "category": "tech",
    "tags": ["tutorial", "coding"],
    "description": "..."
  },
  "limit": 10
}
```

Returns tracks matching the video/content characteristics.

### 3. **Playlists** (`MusicCatalogPlaylist`)

**Features:**
- Create, update, delete playlists
- Add/remove tracks from playlists
- Public/private playlists
- Track ordering and positioning

**API:**
```
POST /api/music-catalog/playlists
Body: {
  "name": "My Playlist",
  "description": "Description",
  "tracks": [
    { "trackId": "xxx", "source": "licensed" }
  ],
  "isPublic": false,
  "tags": ["favorites", "work"]
}

GET /api/music-catalog/playlists
GET /api/music-catalog/playlists/:playlistId
PUT /api/music-catalog/playlists/:playlistId
DELETE /api/music-catalog/playlists/:playlistId

POST /api/music-catalog/playlists/:playlistId/tracks
DELETE /api/music-catalog/playlists/:playlistId/tracks/:trackId
```

### 4. **Popular & Trending Tracks** (`musicCatalogAnalytics.js`)

**Popular Tracks:**
```
GET /api/music-catalog/popular?limit=20&timeRange=week&genre=electronic
```

Returns tracks sorted by usage count, optionally filtered by time range, genre, mood.

**Trending Tracks:**
```
GET /api/music-catalog/trending?limit=20
```

Returns tracks that are gaining popularity (high recent usage relative to age).

**Time Ranges:**
- `all` - All time
- `day` - Last 24 hours
- `week` - Last 7 days
- `month` - Last 30 days
- `year` - Last year

### 5. **Catalog Analytics** (`musicCatalogAnalytics.js`)

**Usage Tracking:**
```
POST /api/music-catalog/track/:trackId/usage
Body: {
  "source": "licensed",
  "contentId": "xxx",
  "projectId": "xxx"
}
```

Tracks when a track is used in a project, incrementing usage counts and updating last used timestamps.

**Catalog Statistics:**
```
GET /api/music-catalog/statistics
```

Returns:
- Total tracks
- Total genres/moods
- Total favorites
- Most used genre/mood
- Top artists
- Total usage count

### 6. **Real-time Catalog Sync** (`musicCatalogSync.js`)

**Incremental Sync:**
Synchronizes new/updated tracks from provider APIs.

**Full Sync:**
Complete catalog synchronization from all providers.

**Scheduled Sync:**
Automatic periodic synchronization (configurable interval).

**API (Admin):**
```
POST /api/admin/music-catalog/sync
Body: {
  "providers": ["soundstripe", "artlist"],
  "fullSync": false,
  "maxTracks": 1000
}

POST /api/admin/music-catalog/sync/incremental
POST /api/admin/music-catalog/sync/full
```

### 7. **Batch Operations**

**Batch Favorites:**
```
POST /api/music-catalog/batch/favorites
Body: {
  "tracks": [
    { "trackId": "xxx", "source": "licensed" },
    { "trackId": "yyy", "source": "licensed" }
  ]
}
```

Adds multiple tracks to favorites at once, returning results for each track (added, skipped, errors).

## Usage Examples

### Search with Autocomplete

1. User types "electro" in search box
2. Frontend calls: `GET /api/music-catalog/search/suggestions?q=electro`
3. Display suggestions dropdown
4. User selects a suggestion or continues typing
5. Full search executed: `GET /api/music-catalog/search?q=electronic`

### Personalized Recommendations

1. User opens catalog
2. Frontend calls: `GET /api/music-catalog/recommendations?basedOn=usage&limit=20`
3. Display "Recommended for You" section
4. User can switch between: Usage, Favorites, Similar, Trending

### Content-based Recommendations

1. User selects video in editor
2. Frontend calls: `POST /api/music-catalog/recommendations/content` with video metadata
3. Display tracks matching video content
4. User selects track
5. Track is used in video

### Playlist Workflow

1. User browses catalog and selects tracks
2. User clicks "Add to Playlist" → Create new playlist
3. Frontend calls: `POST /api/music-catalog/playlists` with selected tracks
4. Playlist created
5. User can add more tracks: `POST /api/music-catalog/playlists/:id/tracks`
6. User can reorder tracks by updating playlist

### Usage Tracking

1. User adds track to video project
2. Frontend calls: `POST /api/music-catalog/track/:id/usage`
3. Usage count incremented, analytics updated
4. Track appears in "Popular" and "Trending" lists
5. Used for personalized recommendations

### Catalog Sync

1. Admin runs incremental sync daily (automated)
2. New tracks from providers added to catalog
3. Existing tracks updated with latest metadata
4. Full sync run weekly or monthly for complete refresh

## Analytics & Insights

### User Statistics

Track user behavior:
- Most favorited genres/moods
- Usage patterns
- Preferred track sources
- Playlist activity

### Catalog Health

Monitor catalog:
- Total tracks per provider
- Sync status and errors
- Usage distribution
- Popular content trends

### Recommendations Performance

Track recommendation effectiveness:
- Click-through rates
- Usage after recommendation
- User feedback
- A/B testing results

## Performance Optimizations

### Caching

- Search suggestions cached
- Popular/trending lists cached
- Recommendations cached per user
- Statistics cached with TTL

### Indexing

- Database indexes on:
  - Genre, mood, tags
  - Usage count, last used
  - User favorites
  - Playlist tracks

### Pagination

- All list endpoints support pagination
- Default limits to prevent overload
- Cursor-based pagination for large datasets

## Future Enhancements

- [ ] Collaborative playlists (team sharing)
- [ ] Playlist templates
- [ ] Smart playlists (auto-updating based on rules)
- [ ] Track collections/albums
- [ ] Advanced filtering (key, tempo, release date)
- [ ] Search history and saved searches
- [ ] Export playlists
- [ ] Playlist sharing (public URLs)
- [ ] Track comments and ratings
- [ ] Similar tracks graph
- [ ] A/B testing for recommendations
- [ ] ML-based recommendation engine







