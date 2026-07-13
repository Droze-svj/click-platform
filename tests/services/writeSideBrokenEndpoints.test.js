// Regression guards for three write endpoints that 500'd because a route
// imported/called a service function that never existed (found via the
// full write-side runtime sweep):
//   - POST /api/search/advanced          -> advancedSearchService.advancedSearch
//   - POST /.../plugins/register         -> pluginSystemService.validatePlugin
//   - POST /.../plugins/:id/{execute,enable} -> executePlugin / setPluginEnabled

const advancedSearchService = require('../../server/services/advancedSearchService');
const pluginSystemService = require('../../server/services/pluginSystemService');

describe('advancedSearchService.advancedSearch export', () => {
  it('is exported as a function (route imported a missing symbol before)', () => {
    expect(typeof advancedSearchService.advancedSearch).toBe('function');
  });
});

describe('pluginSystemService route-facing adapters', () => {
  it('validatePlugin flags a missing/empty payload', () => {
    expect(pluginSystemService.validatePlugin(undefined)).toEqual({
      valid: false,
      errors: ['Plugin payload is required'],
    });
    const r = pluginSystemService.validatePlugin({ name: 'x' });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('validatePlugin passes a complete plugin', () => {
    expect(
      pluginSystemService.validatePlugin({
        name: 'demo', version: '1.0.0', description: 'd', author: 'a',
      }),
    ).toEqual({ valid: true, errors: [] });
  });

  it('executePlugin rejects an unknown plugin id with a 404', async () => {
    await expect(pluginSystemService.executePlugin('nope@0.0.0', {}))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('setPluginEnabled throws 404 for an unknown plugin id', () => {
    expect(() => pluginSystemService.setPluginEnabled('nope@0.0.0', true))
      .toThrow(/not found/);
  });

  it('register -> setPluginEnabled toggles the registry flag', () => {
    pluginSystemService.registerPlugin(
      { name: 'toggle', version: '9.9.9', description: 'd', hooks: {} },
      { name: 'toggle', version: '9.9.9' },
    );
    expect(pluginSystemService.setPluginEnabled('toggle@9.9.9', false))
      .toEqual({ pluginId: 'toggle@9.9.9', enabled: false });
  });
});
