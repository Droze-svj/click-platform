# In-Editor Music Editing Tools

## Overview

Comprehensive music editing tools for the video editor timeline, including trim, fade, volume automation, ducking, smart alignment, and multi-track support.

## Features

### 1. **Basic Timeline Controls**

#### Track Management
- Add/remove tracks from timeline
- Position tracks at specific start times
- Layer tracks (multiple music layers)
- Mute/solo individual tracks

#### Trimming
- Trim start: `sourceStartTime` - where track starts in source audio
- Trim end: `sourceEndTime` - where track ends in source audio
- Real-time trimming on timeline

#### Fade In/Out
- Configurable fade duration
- Smooth transitions
- Applied during audio processing

**API:**
```
PUT /api/music-editing/tracks/:trackId
Body: {
  "fadeIn": { "enabled": true, "duration": 2 },
  "fadeOut": { "enabled": true, "duration": 3 }
}
```

#### Volume Automation
- Keyframe-based volume automation
- Points defined by time and volume (dB)
- Smooth interpolation between points

**Example:**
```json
{
  "volumeAutomation": [
    { "time": 0, "volume": -18 },
    { "time": 5, "volume": 0 },
    { "time": 30, "volume": -12 }
  ]
}
```

#### Loop Options
- Enable/disable looping
- Set loop count
- Auto-loop when track is shorter than video

**API:**
```
PUT /api/music-editing/tracks/:trackId
Body: {
  "loop": { "enabled": true, "count": 3 }
}
```

### 2. **Smart Features**

#### Fit to Video Length
Automatically adjusts track duration to match video:
- If track is shorter: enables looping
- If track is longer: trims to video length

**API:**
```
POST /api/music-editing/tracks/:trackId/fit-to-video
Body: { "videoDuration": 120 }
```

#### Automatic Ducking Under Speech
Automatically lowers music volume when speech is detected:
- Uses scene detection for speech activity
- Configurable sensitivity (0-1)
- Configurable duck amount (dB reduction)
- Creates volume automation points

**API:**
```
POST /api/music-editing/tracks/:trackId/auto-ducking
Body: {
  "videoContentId": "content_id",
  "enabled": true,
  "sensitivity": 0.7,
  "duckAmount": -18
}
```

### 3. **Smart Alignment**

#### Scene Boundary Alignment
Snap track to scene boundaries:
- Start of scene
- End of scene
- Center of scene

**API:**
```
POST /api/music-editing/tracks/:trackId/align
Body: {
  "alignmentType": "scene_boundary",
  "sceneId": "scene_id",
  "alignTo": "start" // or "end", "center"
}
```

#### Beat Alignment to Key Moments
Aligns track beats to key moments:
- Uses track BPM
- Finds best alignment point
- Calculates beat offset

**API:**
```
POST /api/music-editing/tracks/:trackId/align
Body: {
  "alignmentType": "key_moment",
  "contentId": "content_id"
}
```

#### Snap to Nearest Scene Boundary
Automatically snaps track to nearest scene boundary.

**API:**
```
POST /api/music-editing/tracks/:trackId/align
Body: {
  "alignmentType": "snap",
  "contentId": "content_id"
}
```

#### Chorus/Hook Alignment
Aligns track chorus to specific scene (e.g., hook scene).

**API:**
```
POST /api/music-editing/tracks/:trackId/align
Body: {
  "alignmentType": "chorus",
  "sceneId": "scene_id"
}
```

### 4. **Editing Presets**

Pre-configured editing settings for common scenarios.

#### System Presets

1. **Background Bed at -18 dB**
   - Volume: -18 dB
   - Auto-ducking enabled
   - Fits to video length
   - Use case: Background music for vlogs/tutorials

2. **Beat Drop at 3 Seconds**
   - Fade-in over 3 seconds
   - Volume: -12 dB initially
   - Alignment: Key moment
   - Use case: Intro/highlight moments

3. **Smooth Fade Out**
   - Fade-out over last 5 seconds
   - Use case: Outro/transitions

4. **Foreground Music**
   - Full volume (0 dB)
   - No ducking
   - Use case: Foreground/highlight music

**API:**
```
GET /api/music-editing/presets?useCase=background
POST /api/music-editing/tracks/:trackId/preset
Body: { "presetId": "preset_id" }
```

### 5. **Multiple Tracks & Stems**

#### Music Tracks
- Stack multiple music layers
- Each track has independent volume, fade, automation
- Layer ordering (higher layer = on top)
- Mute/solo per track

#### SFX Tracks
Support for sound effects:
- Types: whoosh, click, transition, impact, ambient, custom
- Independent volume and fade controls
- Positioned on timeline

**API:**
```
POST /api/music-editing/tracks
POST /api/music-editing/sfx
GET /api/music-editing/tracks?projectId=xxx
```

### 6. **Audio Processing & Rendering**

#### Process Individual Track
Applies all edits (trim, fade, volume, automation) to track.

**Internal:** Used during rendering, can be called directly for preview.

#### Render Final Mix
Combines all tracks (music + SFX) into final audio mix.

**API:**
```
POST /api/music-editing/render
Body: { "projectId": "project_id" }
```

## API Endpoints

### Track Management
- `POST /api/music-editing/tracks` - Add track to timeline
- `GET /api/music-editing/tracks?projectId=xxx` - Get all tracks
- `PUT /api/music-editing/tracks/:trackId` - Update track
- `DELETE /api/music-editing/tracks/:trackId` - Remove track

### Audio Processing
- `POST /api/music-editing/tracks/:trackId/fit-to-video` - Fit to video length
- `POST /api/music-editing/tracks/:trackId/auto-ducking` - Apply auto-ducking
- `POST /api/music-editing/tracks/:trackId/align` - Align track
- `POST /api/music-editing/tracks/:trackId/preset` - Apply preset
- `POST /api/music-editing/render` - Render final mix

### Presets
- `GET /api/music-editing/presets` - Get available presets

### SFX
- `POST /api/music-editing/sfx` - Add SFX track

## Data Models

### MusicTrack
- Timeline positioning (startTime, duration)
- Source trimming (sourceStartTime, sourceEndTime)
- Volume and automation
- Fade in/out
- Loop settings
- Auto-ducking configuration
- Alignment information
- Layer ordering
- Mute/solo

### SFXTrack
- SFX type and file URL
- Timeline positioning
- Volume and fade controls
- Layer ordering
- Mute

### MusicEditingPreset
- Preset configuration
- Use case tags
- Public/system presets
- Usage tracking

## Usage Examples

### Add Background Music with Auto-Ducking

1. Add track to timeline
2. Apply "Background Bed at -18 dB" preset
3. Enable auto-ducking for video content
4. Track automatically ducks under speech

### Align Beat Drop to Scene

1. Add track with high-energy music
2. Identify key moment scene
3. Align beat to key moment
4. Track starts with beat aligned to scene start

### Multi-Layer Music Mix

1. Add background track (layer 0, -18 dB)
2. Add foreground track (layer 1, 0 dB)
3. Add SFX (whoosh at transition, layer 2)
4. Mix and render final audio

### Fit Track to Video

1. Add track (may be shorter or longer than video)
2. Call fit-to-video endpoint with video duration
3. Track automatically loops or trims to match video length

## Technical Implementation

### Audio Processing
- Uses FFmpeg for audio processing
- Applies filters: trim, fade, volume, automation
- Processes tracks individually then mixes

### Smart Alignment
- Integrates with scene detection system
- Uses BPM from track metadata
- Calculates optimal alignment points
- Updates track startTime based on alignment

### Auto-Ducking
- Analyzes scene audio features for speech
- Creates volume automation points
- Applies ducking during speech segments
- Smooth transitions between ducked/normal levels

## Future Enhancements

- [ ] Real-time preview of edits
- [ ] Waveform visualization
- [ ] Beat detection for automatic alignment
- [ ] Keyframe editor UI
- [ ] Audio effects (reverb, EQ, etc.)
- [ ] Stem separation (separate instruments)
- [ ] Collaborative editing
- [ ] Undo/redo for edits
- [ ] Export individual tracks
- [ ] Audio effects library







