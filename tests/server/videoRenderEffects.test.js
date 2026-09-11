const {
  compileTimelineEffects,
  buildAudioMix,
  buildVideoOutputOptions,
  VOICE_PRESETS,
} = require('../../server/services/videoRenderService');
const videoEnhancer = require('../../server/utils/videoEnhancer');

describe('Video Render Effects & Attention Features (Parity & Upgrades)', () => {
  describe('compileTimelineEffects (Manual & Auto Parity)', () => {
    it('returns an empty array when given null or empty effects', () => {
      expect(compileTimelineEffects([])).toEqual([]);
      expect(compileTimelineEffects(null)).toEqual([]);
      expect(compileTimelineEffects(undefined)).toEqual([]);
    });

    it('compiles dynamic punch-in zoom / kinetic zoom with time gating', () => {
      const effects = [
        {
          name: 'Dynamic Punch-In',
          type: 'retention',
          startTime: 1.5,
          endTime: 2.5,
          intensity: 80,
          enabled: true,
        },
      ];
      const filters = compileTimelineEffects(effects, { width: 1080, height: 1920 });
      expect(filters).toHaveLength(1);
      const f = filters[0];
      expect(f).toContain("crop=w='iw/if(between(t\\,1.500\\,2.500)");
      expect(f).toContain('scale=1080:1920:eval=frame');
    });

    it('compiles action camera shake / jitter with sinusoidal displacement', () => {
      const effects = [
        {
          name: 'Action Camera Shake',
          type: 'motion',
          startTime: 0.5,
          endTime: 1.2,
          intensity: 60,
          enabled: true,
        },
      ];
      const filters = compileTimelineEffects(effects, { width: 1920, height: 1080 });
      expect(filters).toHaveLength(1);
      const f = filters[0];
      expect(f).toContain('crop=w=iw-20:h=ih-20:x=');
      expect(f).toContain('sin(t*30)*between(t\\,0.500\\,1.200)');
      expect(f).toContain('cos(t*26)*between(t\\,0.500\\,1.200)');
      expect(f).toContain('scale=1920:1080');
    });

    it('compiles cyber glitch with rgbashift and noise', () => {
      const effects = [
        {
          name: 'Cyber Glitch Pop',
          type: 'glitch',
          startTime: 2.0,
          endTime: 2.8,
          intensity: 75,
          enabled: true,
        },
      ];
      const filters = compileTimelineEffects(effects);
      expect(filters.length).toBeGreaterThanOrEqual(2);
      expect(filters.some(f => f.includes('rgbashift') && f.includes('between(t\\,2.000\\,2.800)'))).toBe(true);
      expect(filters.some(f => f.includes('noise') && f.includes('between(t\\,2.000\\,2.800)'))).toBe(true);
    });

    it('compiles flash cuts with brightness and saturation boost', () => {
      const effects = [
        {
          name: 'High Energy Flash Cut',
          type: 'style',
          startTime: 3.0,
          endTime: 3.3,
          intensity: 90,
          enabled: true,
        },
      ];
      const filters = compileTimelineEffects(effects);
      expect(filters).toHaveLength(1);
      expect(filters[0]).toMatch(/eq=brightness=[0-9.]+:saturation=[0-9.]+:enable='between\(t\\,3\.000\\,3\.300\)'/);
    });

    it('compiles dynamic punch-in zoom / kinetic zoom with custom zoom factor from params', () => {
      const effects = [
        {
          name: 'Dynamic Punch-In',
          type: 'retention',
          startTime: 1.5,
          endTime: 2.5,
          intensity: 100,
          params: { zoom: 140 },
          enabled: true,
        },
      ];
      const filters = compileTimelineEffects(effects, { width: 1080, height: 1920 });
      expect(filters).toHaveLength(1);
      const f = filters[0];
      expect(f).toContain("crop=w='iw/if(between(t\\,1.500\\,2.500)\\,1.400\\,1)'");
      expect(f).toContain('scale=1080:1920:eval=frame');
    });

    it('compiles action camera shake with frequency and intensity params', () => {
      const effects = [
        {
          name: 'Action Camera Shake',
          type: 'motion',
          startTime: 0.5,
          endTime: 1.2,
          intensity: 100,
          params: { intensity: 15, frequency: 45 },
          enabled: true,
        },
      ];
      const filters = compileTimelineEffects(effects, { width: 1920, height: 1080 });
      expect(filters).toHaveLength(1);
      const f = filters[0];
      expect(f).toContain('sin(t*45)*between(t\\,0.500\\,1.200)');
      expect(f).toContain('crop=w=iw-20:h=ih-20:x=');
      expect(f).toContain('scale=1920:1080');
    });

    it('compiles neural bloom and glow with unsharp and brightness lift without destructive blur', () => {
      const effects = [
        {
          name: 'Viral Glow Bloom',
          type: 'retention',
          startTime: 1.0,
          endTime: 2.0,
          intensity: 80,
          enabled: true,
        },
      ];
      const filters = compileTimelineEffects(effects);
      expect(filters.length).toBe(2);
      expect(filters[0]).toContain('unsharp=5:5:');
      expect(filters[1]).toContain('eq=brightness=');
    });

    it('compiles intentional blur transitions with gblur', () => {
      const effects = [
        {
          name: 'Blur Transition',
          type: 'transition',
          startTime: 2.0,
          endTime: 2.5,
          intensity: 70,
          enabled: true,
        },
      ];
      const filters = compileTimelineEffects(effects);
      expect(filters).toHaveLength(1);
      expect(filters[0]).toContain('gblur=sigma=');
    });

    it('compiles film light leaks and burns with warm color shift', () => {
      const effects = [
        {
          name: 'Light Leak Gold',
          type: 'overlay',
          startTime: 0,
          endTime: 1.5,
          intensity: 85,
          enabled: true,
        },
      ];
      const filters = compileTimelineEffects(effects);
      expect(filters.length).toBe(2);
      expect(filters[0]).toContain('colorchannelmixer=rr=');
      expect(filters[1]).toContain('eq=brightness=');
    });

    it('skips disabled effects or invalid time ranges', () => {
      const effects = [
        { name: 'Punch Zoom', type: 'motion', startTime: 2, endTime: 1, enabled: true },
        { name: 'Shake', type: 'motion', startTime: 1, endTime: 2, enabled: false },
      ];
      const filters = compileTimelineEffects(effects);
      expect(filters).toEqual([]);
    });
  });

  describe('VOICE_PRESETS & buildAudioMix (Vocal Intelligibility & Clarity)', () => {
    it('includes studio-presence and viral-hype presets', () => {
      expect(VOICE_PRESETS).toHaveProperty('studio-presence');
      expect(VOICE_PRESETS).toHaveProperty('viral-hype');
      expect(VOICE_PRESETS['studio-presence']).toContain('equalizer=f=3400');
      expect(VOICE_PRESETS['viral-hype']).toContain('equalizer=f=3500');
    });

    it('strictly clamps dynaudnorm max amplification factor m <= 100 across all presets', () => {
      for (const [name, chain] of Object.entries(VOICE_PRESETS)) {
        const match = chain.match(/dynaudnorm=[^,]*:m=(\d+)/);
        if (match) {
          const m = parseInt(match[1], 10);
          expect(m).toBeLessThanOrEqual(100);
        }
      }
    });

    it('activates studio-presence when voiceClarity is requested without explicit preset', () => {
      const mix = buildAudioMix({ voiceClarity: true });
      expect(mix.preset).toBe('studio-presence');
      expect(mix.voice).toBe(VOICE_PRESETS['studio-presence']);
    });

    it('respects explicit audioPreset when set', () => {
      const mix = buildAudioMix({ audioPreset: 'viral-hype', voiceClarity: true });
      expect(mix.preset).toBe('viral-hype');
      expect(mix.voice).toBe(VOICE_PRESETS['viral-hype']);
    });

    it('preserves neutral defaults when no audio options given', () => {
      const mix = buildAudioMix({});
      expect(mix.preset).toBeNull();
      expect(mix.voice).toBeNull();
    });
  });

  describe('videoEnhancer (Retina Edge Sharpening & Denoising)', () => {
    it('generates high fidelity options with higher quality CRF and preset for ultra profile', () => {
      const std = videoEnhancer.getHighFidelityOptions(false);
      const ultra = videoEnhancer.getHighFidelityOptions(true);
      expect(std).toContain('-crf 18');
      expect(std).toContain('-preset slow');
      expect(ultra).toContain('-crf 16');
      expect(ultra).toContain('-preset veryslow');
    });

    it('returns adaptive sharpening and sensor denoising filters', () => {
      const metadata = {
        streams: [
          { codec_type: 'video', width: 1920, height: 1080, bit_rate: '4000000', nb_frames: 300 },
        ],
        format: { duration: 10 },
      };
      const filters = videoEnhancer.getEnhancementFilters(metadata, { isUltra: true });
      expect(filters.length).toBeGreaterThanOrEqual(2);
      expect(filters.some(f => f.includes('unsharp'))).toBe(true);
      expect(filters.some(f => f.includes('colorlevels') || f.includes('hqdn3d'))).toBe(true);
    });
  });

  describe('buildVideoOutputOptions (Ultra & Master Encoding)', () => {
    it('generates expected flags for software ultra quality profile', () => {
      const opts = buildVideoOutputOptions({
        family: 'sw',
        codec: 'libx264',
        crf: 16,
        preset: 'veryslow',
        bitrateMbps: 35,
      });
      const joined = opts.join(' ');
      expect(joined).toContain('-crf 16');
      expect(joined).toContain('-preset veryslow');
      expect(joined).toContain('-maxrate 35M');
      expect(joined).toContain('-movflags +faststart');
      expect(joined).toContain('-pix_fmt yuv420p');
    });

    it('generates expected flags for nvenc hardware acceleration with ultra quality', () => {
      const opts = buildVideoOutputOptions({
        family: 'nvenc',
        codec: 'libx264',
        crf: 16,
        preset: 'slow',
        bitrateMbps: 35,
      });
      const joined = opts.join(' ');
      expect(joined).toContain('-cq 16');
      expect(joined).toContain('-rc vbr');
      expect(joined).toContain('-maxrate 35M');
      expect(joined).toContain('-bufsize 70M');
    });
  });
});
