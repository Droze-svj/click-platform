import { VideoMetadata } from '../types/editor';

export function generateSmartMetadata(
  transcript: string,
  scenes: { startTime: number; title: string }[]
): VideoMetadata {
  // Mocking AI-generated semantic metadata

  return {
    titles: {
      curiosityGap: `Why ${transcript.split(' ').slice(0, 3).join(' ')} changes everything...`,
      seoWinner: `How to master ${transcript.split(' ').slice(0, 5).join(' ')} (2026 Guide)`,
      minimalist: `${transcript.split(' ').slice(0, 2).join(' ')}: The Truth.`
    },
    description: {
      summary: `In this video, we explore the core concepts of ${transcript.split(' ').slice(0, 10).join(' ')}.`,
      timestamps: scenes.map(s => ({ time: s.startTime, label: s.title })),
      hashtags: ['#ai', '#contentcreation', '#viral', '#videoediting']
    },
    abTestSuggestions: [
      { thumbnailTime: 2.5, concept: 'Extreme close-up with "Shocked" expression' },
      { thumbnailTime: 15.0, concept: 'Bright text overlay: "DON\'T DO THIS"' }
    ]
  };
}
