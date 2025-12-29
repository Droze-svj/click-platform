# AI-Generated Music Integration Guide

## Overview

This system integrates with AI music generation APIs (Mubert, Soundraw) as an alternative to traditional music licensing. AI-generated music offers:

- **No Copyright Issues**: Each track is unique and generated on-demand
- **Simplified Licensing**: Automatic licensing with generation
- **Unlimited Tracks**: Generate as many tracks as needed
- **Customization**: Full control over mood, genre, tempo, etc.

## Legal Must-Haves Checklist

Before integrating, confirm with each provider:

### ✅ Commercial Use
- [ ] Provider explicitly allows commercial use
- [ ] No additional fees for commercial projects
- [ ] License covers all business use cases

### ✅ Social Platforms Coverage
- [ ] YouTube (including monetized channels)
- [ ] TikTok
- [ ] Instagram (posts, stories, reels)
- [ ] Facebook
- [ ] Twitter/X
- [ ] LinkedIn
- [ ] Snapchat
- [ ] Other platforms you need

### ✅ User Monetization
- [ ] Users can monetize content with AI-generated music
- [ ] No revenue sharing required
- [ ] Works with YouTube Partner Program
- [ ] Works with TikTok Creator Fund

### ✅ SaaS Integration License
- [ ] Enterprise/blanket license available
- [ ] Allows embedding generation API in your product
- [ ] Allows your users to generate and use tracks
- [ ] No per-user or per-track licensing needed
- [ ] License covers resale/distribution through your platform

## Supported Providers

### 1. Mubert
- **Website**: https://mubert.com/
- **API Docs**: https://mubert.com/developers/api-reference/
- **License Options**: 
  - Free: Limited, watermarked
  - Commercial: Full commercial rights
  - Enterprise: SaaS integration, unlimited
- **Key Features**: Real-time generation, mood-based, high quality

### 2. Soundraw
- **Website**: https://soundraw.io/
- **API Docs**: https://soundraw.io/api-docs
- **License Options**:
  - Free: Limited tracks
  - Commercial: Full commercial rights
  - Enterprise: API access, SaaS integration
- **Key Features**: Genre-based, customizable BPM, royalty-free

## Configuration

### Step 1: Obtain API Credentials

Contact each provider to obtain:
- API Key
- API Secret (if required)
- Enterprise/SaaS license confirmation
- License coverage documentation

### Step 2: Configure Provider

```bash
POST /api/admin/ai-music/provider
{
  "provider": "mubert",
  "apiKey": "your_api_key",
  "apiSecret": "your_api_secret",
  "licenseType": "enterprise",
  "enterpriseLicense": true,
  "allowsCommercialUse": true,
  "allowsSocialPlatforms": true,
  "supportedPlatforms": ["all"],
  "allowsMonetization": true,
  "allowsSaaSIntegration": true,
  "requiresAttribution": false
}
```

### Step 3: Verify License Coverage

```bash
POST /api/ai-music/validate-license
{
  "provider": "mubert",
  "commercialUse": true,
  "socialPlatforms": true,
  "monetization": true,
  "saasIntegration": true,
  "platform": "youtube"
}
```

## Usage

### Generate Music Track

```javascript
POST /api/ai-music/generate
{
  "provider": "mubert",
  "mood": "energetic",
  "genre": "electronic",
  "duration": 60,
  "bpm": 128,
  "intensity": "high"
}

Response: {
  generationId: "507f1f77bcf86cd799439011",
  jobId: "job_12345",
  status: "processing",
  estimatedTime: 30,
  licenseInfo: {
    allowsCommercialUse: true,
    allowsSocialPlatforms: true,
    allowsMonetization: true,
    requiresAttribution: false
  }
}
```

### Check Generation Status

```javascript
GET /api/ai-music/generations/:generationId/status

Response: {
  status: "completed",
  progress: 100,
  trackId: "track_12345",
  downloadUrl: "https://..."
}
```

### Download and Store Track

```javascript
POST /api/ai-music/generations/:generationId/download

Response: {
  music: {
    id: "507f1f77bcf86cd799439012",
    title: "AI Generated - energetic electronic",
    artist: "mubert AI",
    genre: "electronic",
    mood: "energetic",
    file: {
      url: "https://...",
      duration: 60
    },
    license: "external-provider"
  }
}
```

### Get Available Styles

```javascript
GET /api/ai-music/providers/mubert/styles

Response: {
  styles: {
    moods: ["energetic", "calm", "happy", "sad", ...],
    genres: ["electronic", "pop", "rock", ...],
    intensities: ["low", "medium", "high"]
  }
}
```

## License Validation

The system automatically validates licenses before generation:

1. **Commercial Use**: Must be enabled
2. **Social Platforms**: Must be enabled
3. **Monetization**: Must be enabled for user-generated content
4. **SaaS Integration**: Must be enabled for embedding in your platform

If any requirement is not met, generation is blocked with an error message.

## Advantages Over Traditional Licensing

| Feature | Traditional Licensing | AI Generation |
|---------|----------------------|---------------|
| Copyright Risk | Medium (need to verify each track) | None (unique tracks) |
| Track Selection | Limited catalog | Unlimited |
| Licensing Complexity | Per-track verification | Automatic with generation |
| Customization | Limited to available tracks | Full control |
| Cost | Per-track or subscription | Per-generation or unlimited |
| Attribution | Often required | Usually not required |

## Best Practices

1. **Validate License Before Generation**: Always validate license coverage
2. **Store License Info**: Save license information with each generation
3. **Monitor Usage**: Track generation counts and costs
4. **Handle Errors**: Gracefully handle generation failures
5. **Cache Results**: Cache completed tracks to reduce API calls
6. **User Education**: Inform users about license coverage

## Cost Considerations

- **Per-Generation Pricing**: Some providers charge per track generated
- **Subscription Plans**: Monthly/annual plans for unlimited generation
- **Enterprise Licenses**: Fixed fee for SaaS integration
- **Rate Limits**: Monitor API usage to avoid overage fees

## Integration with Existing System

AI-generated tracks are stored in the same `Music` model as other tracks:

- `license: 'external-provider'`
- `provider: 'mubert' | 'soundraw'`
- `providerTrackId`: Generation ID or track ID

This allows AI-generated tracks to be used seamlessly with:
- Video processing
- Scene-based automation
- User playlists
- All existing music features

## Troubleshooting

### Generation Fails

1. Check API credentials
2. Verify license allows SaaS integration
3. Check rate limits
4. Review provider API status

### License Validation Fails

1. Verify enterprise license is enabled
2. Check license type (must be 'commercial' or 'enterprise')
3. Confirm SaaS integration is allowed
4. Review provider documentation

### Quality Issues

1. Adjust generation parameters (mood, genre, intensity)
2. Try different providers
3. Use longer durations for better quality
4. Specify BPM for tempo matching

## Legal Disclaimer

⚠️ **Important**: Always verify license terms directly with providers. This guide provides general information but does not constitute legal advice. Ensure your specific use case is covered by the provider's license agreement.







