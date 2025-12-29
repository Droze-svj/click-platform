# Music Licensing Integration Guide

## Overview

This system integrates with royalty-free music licensing providers (Soundstripe, Artlist, HookSounds, etc.) to provide access to their music catalogs directly within the platform. The integration supports SaaS catalog embedding, which allows users to browse and use tracks in their videos.

## Important Licensing Considerations

⚠️ **CRITICAL**: Before integrating with any provider, ensure their plan explicitly allows:
1. **SaaS Catalog Embedding** - The ability to embed their catalog in your product
2. **API Access** - Programmatic access to their music library
3. **User Access** - Your users can use the tracks in their videos

Not all plans allow catalog embedding. Verify this with each provider before integration.

## Supported Providers

### 1. Soundstripe
- **API Documentation**: https://docs.soundstripe.com/
- **SaaS Integration**: Available on Enterprise plans
- **API Endpoint**: `https://api.soundstripe.com/v1`
- **Features**: Search, preview, download, license validation

### 2. Artlist
- **API Documentation**: https://artlist.io/api-docs
- **SaaS Integration**: Available on Business plans
- **API Endpoint**: `https://api.artlist.io/v2`
- **Features**: Search, preview, download, license validation

### 3. HookSounds
- **API Documentation**: Contact for API access
- **SaaS Integration**: Available on commercial licenses
- **Features**: Similar to Artlist implementation

## Architecture

### Models

1. **MusicLicense** (`server/models/MusicLicense.js`)
   - Stores licensed tracks from external providers
   - Tracks license status, usage, and metadata
   - Ensures only tracks with SaaS embedding permission are stored

2. **MusicProviderConfig** (`server/models/MusicProviderConfig.js`)
   - Stores API credentials for each provider
   - Manages provider configuration and status
   - Validates SaaS embedding permissions

3. **Music** (`server/models/Music.js`)
   - Extended to support licensed tracks
   - Links to MusicLicense via `licenseId`
   - Tracks provider and providerTrackId

### Services

**musicLicensingProviderService.js**
- Abstract base class for providers
- Provider-specific implementations (Soundstripe, Artlist, HookSounds)
- Unified search across all providers
- License validation and usage tracking

### API Routes

**User Routes** (`/api/music-licensing`)
- `GET /providers` - Get available providers
- `GET /search` - Search tracks across providers
- `GET /track/:provider/:trackId` - Get track details
- `POST /track/:provider/:trackId/use` - Track usage
- `GET /licensed-tracks` - Get all licensed tracks
- `GET /license/:id/validate` - Validate license

**Admin Routes** (`/api/admin/music-licensing`)
- `POST /provider` - Configure provider
- `GET /providers` - Get all provider configs
- `PUT /provider/:provider/enable` - Enable/disable provider
- `DELETE /provider/:provider` - Delete provider config

## Setup Instructions

### 1. Obtain API Credentials

Contact each provider to obtain:
- API Key
- API Secret (if required)
- Confirmation that SaaS catalog embedding is allowed
- API documentation and endpoints

### 2. Configure Provider

```bash
POST /api/admin/music-licensing/provider
{
  "provider": "soundstripe",
  "apiKey": "your_api_key",
  "apiSecret": "your_api_secret",
  "apiBaseUrl": "https://api.soundstripe.com/v1",
  "catalogEnabled": true,
  "allowedLicenseTypes": ["saas_catalog"]
}
```

### 3. Environment Variables (Optional)

You can also set default configurations via environment variables:

```env
SOUNDSTRIPE_API_KEY=your_key
SOUNDSTRIPE_API_SECRET=your_secret
ARTLIST_API_KEY=your_key
ARTLIST_API_SECRET=your_secret
```

### 4. Verify License Permissions

The system automatically validates that tracks allow SaaS embedding before storing them. Only tracks with `allowsEmbedding: true` or `allowsSaaSIntegration: true` are stored.

## Usage Examples

### Search for Tracks

```javascript
GET /api/music-licensing/search?query=energetic&genre=electronic&mood=happy

Response: {
  tracks: [
    {
      providerTrackId: "12345",
      provider: "soundstripe",
      title: "Upbeat Electronic",
      artist: "Artist Name",
      genre: ["electronic"],
      mood: ["happy"],
      duration: 180,
      bpm: 128,
      previewUrl: "https://...",
      thumbnailUrl: "https://..."
    }
  ]
}
```

### Get Track Details

```javascript
GET /api/music-licensing/track/soundstripe/12345

Response: {
  track: {
    providerTrackId: "12345",
    title: "Upbeat Electronic",
    artist: "Artist Name",
    duration: 180,
    previewUrl: "https://...",
    requiresAttribution: true,
    attributionText: "Music by Artist Name"
  }
}
```

### Use Track in Video

```javascript
POST /api/music-licensing/track/soundstripe/12345/use
{
  "contentId": "video_id"
}

// Then use in video processing
POST /api/video/upload
{
  "video": file,
  "musicLicenseId": "license_id"
}
```

## License Validation

The system performs multiple levels of validation:

1. **Provider Configuration**: Checks if provider allows SaaS embedding
2. **Track License**: Validates individual track license
3. **Expiration**: Checks if license has expired
4. **Usage Tracking**: Tracks usage for compliance

## Usage Tracking

All track usage is tracked for:
- Compliance with provider requirements
- Analytics and reporting
- License expiration monitoring

## Attribution

Tracks that require attribution will include `attributionText` that should be displayed in the video or video metadata.

## Error Handling

The system handles:
- Invalid API credentials
- Expired licenses
- Network errors
- Rate limiting
- Unauthorized access attempts

## Best Practices

1. **Always validate licenses** before allowing track usage
2. **Track all usage** for compliance
3. **Respect attribution requirements**
4. **Monitor license expiration**
5. **Cache track metadata** to reduce API calls
6. **Handle rate limits** gracefully
7. **Log all API interactions** for debugging

## Security

- API keys are stored securely (not returned in API responses)
- License validation prevents unauthorized usage
- Usage tracking ensures compliance
- Admin routes require authentication

## Troubleshooting

### Provider Not Working

1. Check API credentials are correct
2. Verify SaaS embedding is enabled in provider account
3. Check API endpoint URLs
4. Review error logs

### Tracks Not Appearing

1. Ensure `catalogEnabled: true` in provider config
2. Check license validation status
3. Verify tracks allow SaaS embedding
4. Check provider API status

### License Validation Failing

1. Verify license hasn't expired
2. Check provider account status
3. Ensure track allows embedding
4. Review provider API documentation

## Future Enhancements

- Caching layer for better performance
- Background sync of catalog
- Advanced filtering and recommendations
- User favorites and playlists
- Download queue management
- License renewal automation







