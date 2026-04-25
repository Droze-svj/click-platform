# Music Licensing Compliance System

## Overview

Comprehensive licensing system for tracking, logging, and enforcing music track usage across the platform, ensuring compliance with provider terms and user attestations.

## Features

### 1. **License Logging** (`musicLicenseLoggingService.js`)

**What Gets Logged:**
- Track ID and source (licensed, AI-generated, user upload)
- Provider information (Soundstripe, Artlist, etc.)
- License type (platform, per-user, per-export, per-end-user, user-owned, AI-generated)
- User/project/workspace IDs
- Render timestamp
- Export details (format, resolution, platform)
- Attribution requirements
- Restrictions

**Usage:**
```javascript
// Log single track usage
await logTrackUsage({
  trackId: "track_id",
  source: "licensed",
  userId: "user_id",
  projectId: "project_id",
  renderId: "render_id",
  exportFormat: "mp4",
  exportResolution: "1080p",
  exportPlatform: "youtube"
});

// Log multiple tracks from render
await logRenderUsage(tracks, renderContext);
```

### 2. **Provider License Registration** (`musicLicenseRegistrationService.js`)

**When Registration Happens:**
- Automatically called at render time for `per_export` and `per_end_user` licenses
- Can be triggered manually for compliance verification

**Supported Providers:**
- Soundstripe
- Artlist
- HookSounds

**Registration Process:**
1. Check if registration required (based on license type)
2. Get provider configuration and authentication
3. Call provider API with usage details
4. Store registration response and license ID
5. Update usage log with registration status

**API:**
```
POST /api/music-licensing/register/:usageLogId
```

### 3. **Automatic Attribution** (`musicAttributionService.js`)

**Features:**
- Generates attribution text for tracks requiring it
- Combines multiple attributions for renders
- Adds attribution to video descriptions
- Can be embedded in video metadata

**Attribution Format:**
- Default: `Music: "Track Title" by Artist via Provider`
- Custom attribution text if provided by provider
- Combined for multiple tracks: `Track1 | Track2 | Track3`

**API:**
```
GET /api/music-licensing/attributions/:renderId
POST /api/music-licensing/attributions/generate-description
```

### 4. **Restrictions Enforcement** (`musicRestrictionsService.js`)

**Restrictions:**
- **Raw Audio Download**: Licensed tracks cannot be downloaded as raw audio
- **Export in Video Only**: Licensed tracks can only be exported within video

**Validation:**
- Checks before allowing download
- Validates export requests
- Blocks restricted operations

**API:**
```
GET /api/music-licensing/track/:trackId/restrictions
GET /api/music-licensing/track/:trackId/can-download
POST /api/music-licensing/validate-export
```

### 5. **User-Uploaded Music** (`music-user-uploads.js`)

**Features:**
- Separate "My Music" area for user uploads
- License attestation checkbox (required)
- Privacy enforcement (tracks stay private per user/workspace)
- Self-attested ownership
- Optional attribution settings

**Model Fields:**
- `licenseAttestation`: Boolean (user attests ownership)
- `attestationDate`: Date of attestation
- `requiresAttribution`: Boolean
- `attributionText`: Custom attribution text
- `isPublic`: Always false for user uploads (enforced)

**Privacy:**
- User tracks are never shared with others
- `isPublic` is automatically set to false and cannot be changed
- Tracks are scoped to user and workspace

**API:**
```
POST /api/music/user-uploads - Upload track (requires attestation)
GET /api/music/user-uploads - Get user's tracks
PUT /api/music/user-uploads/:trackId - Update track
DELETE /api/music/user-uploads/:trackId - Delete track
```

## API Endpoints

### License Logging
- `POST /api/music-licensing/log/usage` - Log single track usage
- `POST /api/music-licensing/log/render` - Log multiple tracks from render
- `GET /api/music-licensing/usage` - Get user's usage logs
- `GET /api/music-licensing/statistics` - Get usage statistics

### License Registration
- `POST /api/music-licensing/register/:usageLogId` - Register usage with provider

### Attribution
- `GET /api/music-licensing/attributions/:renderId` - Get attributions for render
- `POST /api/music-licensing/attributions/generate-description` - Generate description with attributions

### Restrictions
- `GET /api/music-licensing/track/:trackId/restrictions` - Get track restrictions
- `GET /api/music-licensing/track/:trackId/can-download` - Check download permission
- `POST /api/music-licensing/validate-export` - Validate export request

### User Uploads
- `POST /api/music/user-uploads` - Upload user track (requires attestation)
- `GET /api/music/user-uploads` - Get user's tracks
- `PUT /api/music/user-uploads/:trackId` - Update track
- `DELETE /api/music/user-uploads/:trackId` - Delete track

## Integration Workflow

### Render Time

1. **Validate Export**
   ```
   POST /api/music-licensing/validate-export
   ```
   - Check if all tracks can be exported
   - Block if any track has restrictions

2. **Log Usage**
   ```
   POST /api/music-licensing/log/render
   ```
   - Log all tracks used in render
   - Store complete usage information

3. **Register Licenses** (if required)
   - Automatic for `per_export` and `per_end_user` licenses
   - Call provider API
   - Store registration IDs

4. **Generate Attributions**
   ```
   GET /api/music-licensing/attributions/:renderId
   ```
   - Get all required attributions
   - Add to video description
   - Embed in metadata if needed

### Download Prevention

Before allowing raw audio download:
```
GET /api/music-licensing/track/:trackId/can-download?source=licensed
```

If `allowed: false`, block the download and show message.

## Data Models

### MusicLicenseUsage
Tracks all music usage with:
- Track and provider information
- License type and ID
- User/project context
- Render details
- Registration status
- Attribution information
- Restrictions
- Compliance status

### Music (Updated)
Added fields for user uploads:
- `licenseAttestation`: Boolean
- `attestationDate`: Date
- `requiresAttribution`: Boolean
- `attributionText`: String
- `workspaceId`: ObjectId

Pre-save hook ensures user uploads are always private.

## Compliance Features

### Audit Trail
- Complete logging of all track usage
- Timestamps for all operations
- Provider registration records
- Compliance status tracking

### Dispute Resolution
- Usage logs provide proof of proper licensing
- Registration IDs from providers
- Complete context (user, project, render)
- Export details for verification

### Restrictions Enforcement
- Automatic validation before operations
- Clear error messages
- Blocked operations logged

### Attribution Compliance
- Automatic generation
- Required attributions tracked
- Added to exports automatically
- Verification in usage logs

## Best Practices

1. **Always log usage before rendering**
2. **Register licenses immediately when required**
3. **Include attributions in all exports**
4. **Validate exports before processing**
5. **Keep usage logs for audit purposes**
6. **Enforce restrictions consistently**
7. **Require attestation for user uploads**
8. **Never share user-uploaded tracks**

## Privacy & Security

- User uploads are private by design
- Usage logs are scoped to users
- Provider API keys secured
- Registration data encrypted
- Access controls on all endpoints







