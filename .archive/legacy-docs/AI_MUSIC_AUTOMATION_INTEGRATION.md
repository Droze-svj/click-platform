# AI Music Generation - Automation Integration

## Overview

AI music generation is now fully integrated into the automation workflow system, allowing automatic music generation when scenes are detected.

## Automation Action

### `generate_music_for_scenes`

Automatically generates AI music for detected scenes using smart recommendations.

**Configuration:**
```javascript
{
  type: "generate_music_for_scenes",
  config: {
    contentId: "content_id", // Optional, uses context if not provided
    useRecommendations: true, // Use smart recommendations (default: true)
    provider: "mubert", // AI music provider
    autoDownload: false // Auto-download when ready (default: false)
  }
}
```

## Example Automation Rules

### 1. Auto-Generate Music After Scene Detection

```javascript
{
  name: "Auto-generate music for scenes",
  trigger: {
    type: "event",
    event: "scenes_processed"
  },
  actions: [
    {
      type: "generate_music_for_scenes",
      config: {
        useRecommendations: true,
        provider: "mubert"
      }
    }
  ]
}
```

### 2. Generate Music with Audio Criteria

```javascript
{
  name: "Generate music for high-energy scenes",
  trigger: {
    type: "event",
    event: "scenes_processed"
  },
  conditions: [
    {
      field: "audioFeatures.energy",
      operator: "greater_than",
      value: 0.7
    }
  ],
  actions: [
    {
      type: "generate_music_for_scenes",
      config: {
        useRecommendations: true,
        provider: "mubert",
        autoDownload: true
      }
    }
  ]
}
```

## Workflow Integration

### Scene Detection → Music Generation Pipeline

1. **Video Upload** → Triggers `video_uploaded` event
2. **Scene Detection** → Detects scenes, triggers `scenes_processed` event
3. **Music Generation** → Automation generates music for each scene
4. **Auto-Download** (optional) → Downloads when generation completes
5. **Video Processing** → Uses generated music in video processing

## Smart Recommendations

The system automatically analyzes each scene and recommends:

- **Mood**: Based on audio energy and scene type
- **Genre**: Based on scene labels and content
- **Intensity**: Based on motion levels
- **BPM**: Based on scene characteristics
- **Duration**: Matches scene duration

## Benefits

1. **Fully Automated**: No manual intervention needed
2. **Context-Aware**: Music matches scene characteristics
3. **Scalable**: Handles multiple scenes efficiently
4. **Cost-Optimized**: Uses recommendations to reduce failed generations
5. **Integrated**: Works seamlessly with existing workflows

## Usage Tracking

All automated music generation is tracked:
- Generation records stored in database
- Cost tracking per generation
- Usage analytics available
- Queue status monitoring







