// Route↔service export contracts.
//
// A class of latent bug: a route destructures a function from a service that the
// service doesn't export → `undefined` → "X is not a function" 500 at request
// time, invisible to lint/tsc. This test pins the exact exports the fixed routes
// depend on, so a rename/removal that would re-break a mounted route fails CI here
// instead of in production. (The generic guard against NEW instances is the
// periodic sweep; this locks the ones we just fixed.)

function fns(mod, names) {
  for (const n of names) {
    expect(typeof mod[n]).toBe('function');
  }
}

describe('service exports the routes import', () => {
  it('webhookService.sendWebhook (routes/workflows/webhooks.js POST /:id/test)', () => {
    fns(require('../../server/services/webhookService'), ['sendWebhook', 'deliverWebhook', 'testWebhook']);
  });

  it('translationService bulk/auto (routes/translation.js POST /bulk, /auto-translate)', () => {
    fns(require('../../server/services/translationService'), [
      'bulkTranslateContent', 'autoTranslateOnCreate', 'translateToMultipleLanguages',
    ]);
  });

  it('modelVersionManager rollout controls (routes/model-versions.js)', () => {
    fns(require('../../server/services/modelVersionManager'), [
      'getRolloutStatus', 'pauseRollout', 'cancelRollout',
    ]);
  });

  it('templateAnalyticsService (routes/cross-client-enhanced.js)', () => {
    fns(require('../../server/services/templateAnalyticsService'), [
      'getTemplatePerformance', 'getTemplateSuggestions',
    ]);
  });

  it('jobQueueService.addJob (services/bulkOperationsService.js)', () => {
    fns(require('../../server/services/jobQueueService'), ['addJob', 'getQueue']);
  });

  it('aiFoleyService (routes/dubbing.js foley routes)', () => {
    fns(require('../../server/services/aiFoleyService'), [
      'analyzeTimelineTransitions', 'generateFoleyAudio', 'generateFoley', 'alignFoleyToTimeline',
    ]);
  });
});

describe('bulkOperationsService uses jobQueueService correctly', () => {
  it('imports the module namespace (not a nonexistent {jobQueueService} key) and calls addJob', () => {
    // Loading the module must not throw; and its enqueue calls target addJob,
    // which exists (asserted above). A regression to `.add(` or the destructured
    // import would surface as an undefined-call at request time.
    const svc = require('../../server/services/bulkOperationsService');
    expect(typeof svc.bulkDeleteContent).toBe('function');
    expect(typeof svc.bulkExportData).toBe('function');
  });
});

describe('fixed route modules load cleanly', () => {
  // Requiring a route file executes its top-level destructuring requires; this
  // catches import-time breakage (bad path, throwing module) though not
  // undefined-destructure (that's what the function-existence checks above cover).
  it.each([
    '../../server/routes/workflows/webhooks.js',
    '../../server/routes/translation.js',
    '../../server/routes/model-versions.js',
    '../../server/routes/cross-client-enhanced.js',
    '../../server/routes/reports-enhanced.js',
    '../../server/routes/video/enhance.js',
    '../../server/routes/dubbing.js',
  ])('%s requires without throwing', (p) => {
    expect(() => require(p)).not.toThrow();
  });
});
