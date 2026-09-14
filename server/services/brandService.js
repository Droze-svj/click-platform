const mongoose = require('mongoose');
const BrandProfile = require('../models/BrandProfile');

/**
 * Brand Service - Manages Creator Style DNA and Brand Profiles.
 *
 * Profiles are per-user and persisted in MongoDB (models/BrandProfile). The
 * ELITE_PRESETS below are read-only built-ins shown to everyone; they are not
 * stored per user and cannot be edited or deleted.
 *
 * History: getProfiles/saveProfile/deleteProfile used to operate on a single
 * process-memory array shared across all users — getProfiles ignored its userId
 * argument and returned everyone's saved profiles, and a restart dropped them.
 * That is why /api/brand was never mounted.
 */
class BrandService {
  constructor() {
    this.presets = [
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

  /**
   * Shape a stored document like the preset objects the client already renders.
   */
  _serialize(doc) {
    const dna = typeof doc.dna?.toObject === 'function' ? doc.dna.toObject() : (doc.dna || {});
    // assetAffinity is a Map on the schema; the client expects a plain object.
    if (dna.assetAffinity instanceof Map) dna.assetAffinity = Object.fromEntries(dna.assetAffinity);
    return {
      id: String(doc._id),
      name: doc.name,
      description: doc.description,
      isAiOptimized: doc.isAiOptimized,
      isElite: false,
      lastTrained: doc.lastTrained ? new Date(doc.lastTrained).getTime() : null,
      dna,
    };
  }

  /**
   * The built-in elite presets plus this user's own saved profiles.
   * Scoped by userId — a user never sees another user's profiles.
   */
  async getProfiles(userId) {
    if (!userId) return [...this.presets];
    const owned = await BrandProfile.find({ userId }).sort({ createdAt: -1 }).lean();
    return [...this.presets, ...owned.map((d) => this._serialize(d))];
  }

  /**
   * Persist a new profile owned by userId. `id`/`userId`/`isElite` from the
   * client body are ignored — the owner comes from the authenticated request
   * and elite status is never client-assignable.
   */
  async saveProfile(userId, profileData = {}) {
    if (!userId) throw new Error('userId is required to save a brand profile');
    const doc = await BrandProfile.create({
      userId,
      name: profileData.name || 'Untitled Profile',
      description: profileData.description || '',
      isAiOptimized: !!profileData.isAiOptimized,
      dna: profileData.dna || {},
      lastTrained: Date.now(),
    });
    return this._serialize(doc);
  }

  /**
   * Delete one of this user's own profiles. Scoped by userId so a caller can't
   * delete someone else's, and presets (which have no document) are untouched.
   * Returns { success: false } when nothing matched.
   */
  async deleteProfile(userId, profileId) {
    if (!userId || !profileId) return { success: false };
    if (!mongoose.Types.ObjectId.isValid(profileId)) return { success: false };
    const res = await BrandProfile.deleteOne({ _id: profileId, userId });
    return { success: res.deletedCount > 0 };
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
    // Accumulate how far accepted style moved from the current DNA — this is
    // the real drift signal (normalized magnitude of change), not a random.
    let driftAccum = 0;
    let driftN = 0;
    telemetryHistory.forEach(session => {
      if (session.styleDeltas && typeof session.styleDeltas.cpm === 'number') {
        if (currentDNA.cpm) {
          driftAccum += Math.abs(session.styleDeltas.cpm - currentDNA.cpm) / Math.max(1, currentDNA.cpm);
          driftN++;
        }
        evolvedCPM += (session.styleDeltas.cpm - evolvedCPM) * factor;
      }
    });
    const sentimentDrift = driftN > 0
      ? Math.round(Math.min(5, (driftAccum / driftN) * 5) * 100) / 100
      : 0;

    return {
      ...currentDNA,
      cpm: Math.round(evolvedCPM * 10) / 10,
      sentimentDrift // 0-5 index derived from real accepted-style movement
    };
  }
}

module.exports = new BrandService();
