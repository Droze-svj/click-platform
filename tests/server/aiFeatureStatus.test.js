const { aiFeatureStatus, summarize } = require('../../server/utils/aiFeatureStatus');

const find = (arr, key) => arr.find((f) => f.feature === key);

describe('aiFeatureStatus', () => {
  it('all disabled with an empty env', () => {
    const s = aiFeatureStatus({});
    expect(s.every((f) => f.state === 'disabled')).toBe(true);
  });

  it('single-var feature: enabled when the key is set', () => {
    expect(find(aiFeatureStatus({ ELEVENLABS_API_KEY: 'x' }), 'voiceDubbing').state).toBe('enabled');
  });

  it('paired feature: enabled only when BOTH vars are set', () => {
    expect(find(aiFeatureStatus({ EYE_CONTACT_API_URL: 'u' }), 'eyeContact').state).toBe('misconfigured');
    expect(find(aiFeatureStatus({ EYE_CONTACT_API_URL: 'u', EYE_CONTACT_API_KEY: 'k' }), 'eyeContact').state).toBe('enabled');
  });

  it('misconfigured reports exactly which vars are missing', () => {
    const f = find(aiFeatureStatus({ OBJECT_REMOVAL_API_URL: 'u' }), 'objectRemoval');
    expect(f.state).toBe('misconfigured');
    expect(f.missing).toEqual(['OBJECT_REMOVAL_API_KEY']);
  });

  it('either-provider feature: HeyGen alone enables it; Sora needs key + gateway', () => {
    expect(find(aiFeatureStatus({ HEYGEN_API_KEY: 'x' }), 'aiAvatar').state).toBe('enabled');
    expect(find(aiFeatureStatus({ SORA_API_KEY: 'x' }), 'aiAvatar').state).toBe('misconfigured'); // gateway missing
    expect(find(aiFeatureStatus({ SORA_API_KEY: 'x', SORA_GATEWAY_URL: 'u' }), 'aiAvatar').state).toBe('enabled');
  });

  it('ignores whitespace-only values', () => {
    expect(find(aiFeatureStatus({ ELEVENLABS_API_KEY: '   ' }), 'voiceDubbing').state).toBe('disabled');
  });

  it('summarize splits enabled vs misconfigured', () => {
    const s = summarize({ ELEVENLABS_API_KEY: 'x', EYE_CONTACT_API_URL: 'u' });
    expect(s.enabled).toContain('voiceDubbing');
    expect(s.misconfigured.map((m) => m.feature)).toContain('eyeContact');
  });
});
