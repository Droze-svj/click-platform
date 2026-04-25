const { nanoid } = require('nanoid');

/**
 * Brand Service - Manages Creator Style DNA and Brand Profiles.
 */
class BrandService {
  constructor() {
    this.profiles = [
      {
        id: 'preset-apple',
        name: 'The Minimalism of Apple',
        description: 'Clean, airy, and high-precision aesthetic. Focuses on negative space and serif typography.',
        isAiOptimized: true,
        isElite: true,
        lastTrained: Date.now(),
        dna: {
          cpm: 4.2,
          visualDensity: 2.5,
          assetAffinity: { 'minimalist': 0.9, 'cinematic': 0.1 },
          audioDuckingPreference: -14,
          foleyFrequency: 1.2,
          preferredTransitions: ['crossfade', 'none'],
          preferredFonts: ['SF Pro', 'Inter'],
          theme: 'cinematic',
          driftSensitivity: 10,
          preferredAssetFolders: ['minimal-tech', 'clean-interiors'],
          preferredMusicGenres: ['ambient', 'modern-classical']
        }
      },
      {
        id: 'preset-beast',
        name: 'The Energy of MrBeast',
        description: 'High-retention, rapid-paced editing with bold graphics and constant movement.',
        isAiOptimized: true,
        isElite: true,
        lastTrained: Date.now(),
        dna: {
          cpm: 18.5,
          visualDensity: 12.0,
          assetAffinity: { 'high-octane': 0.9, 'pop': 0.1 },
          audioDuckingPreference: -6,
          foleyFrequency: 8.5,
          preferredTransitions: ['zoom', 'glitch', 'whip'],
          preferredFonts: ['Komika Axis', 'Montserrat'],
          theme: 'high-octane',
          driftSensitivity: 40,
          preferredAssetFolders: ['action-broll', 'reaction-cuts'],
          preferredMusicGenres: ['fast-pop', 'hybrid-trap']
        }
      }
    ];
  }

  async getProfiles(userId) {
    // In a real app, we'd query MongoDB/Prisma here filtering by userId or isElite
    return this.profiles;
  }

  async saveProfile(userId, profileData) {
    const newProfile = {
      id: nanoid(),
      ...profileData,
      userId,
      lastTrained: Date.now()
    };
    this.profiles.push(newProfile);
    return newProfile;
  }

  async deleteProfile(userId, profileId) {
    this.profiles = this.profiles.filter(p => !(p.id === profileId && (p.userId === userId || p.isElite)));
    return { success: true };
  }

  /**
   * Calculates "Sentiment Drift" or evolves the DNA based on recent session history.
   */
  async evolveDNA(currentDNA, telemetryHistory) {
    if (!telemetryHistory || telemetryHistory.length === 0) return currentDNA;
    
    // Logic: If user consistently accepts faster pacing, nudge the CPM up.
    // If they override specific fonts, update the affinity.
    const driftSensitivity = currentDNA.driftSensitivity || 20;
    const factor = driftSensitivity / 100;

    let evolvedCPM = currentDNA.cpm;
    telemetryHistory.forEach(session => {
      if (session.styleDeltas && session.styleDeltas.cpm) {
        evolvedCPM += (session.styleDeltas.cpm - evolvedCPM) * factor;
      }
    });

    return {
      ...currentDNA,
      cpm: Math.round(evolvedCPM * 10) / 10,
      sentimentDrift: Math.random() * 5 // Mock drift score
    };
  }
}

module.exports = new BrandService();
