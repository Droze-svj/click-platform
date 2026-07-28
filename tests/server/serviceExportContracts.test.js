// Service↔service export contracts (the MED tier of the export-mismatch sweep).
//
// Same bug-class as routeServiceContracts.test.js but for service-to-service
// imports: a service destructured a function a sibling service didn't export →
// undefined → TypeError when that code path ran. This pins the exports the fixed
// callers depend on, and asserts every touched importer still LOADS (catches a
// bad require path / throwing edit).

function fns(modPath, names) {
  const mod = require(modPath);
  for (const n of names) expect(typeof mod[n]).toBe('function');
}

describe('target services export what their callers import (MED sweep)', () => {
  it('aiVideoEditingService: detectSceneChanges / analyzeSentimentAndEmotions / detectSilencePeriods', () => {
    fns('../../server/services/aiVideoEditingService', [
      'detectScenes', 'detectSceneChanges', 'analyzeSentimentAndEmotions', 'detectSilencePeriods',
    ]);
  });
  it('approvalKanbanService.getApprovalStatus', () => {
    fns('../../server/services/approvalKanbanService', ['getApprovalStatus']);
  });
  it('audioChangePointDetection.combineChangePoints', () => {
    fns('../../server/services/audioChangePointDetection', ['combineChangePoints']);
  });
  it('aiTemplateService.validateAgainstGuardrails', () => {
    fns('../../server/services/aiTemplateService', ['validateAgainstGuardrails']);
  });
  it('shotClusteringService.clusterBySimilarity', () => {
    fns('../../server/services/shotClusteringService', ['clusterBySimilarity']);
  });
  it('socketService.emitToUser (realtimeCollaborationService)', () => {
    fns('../../server/services/socketService', ['emitToUser']);
  });
  it('storageService.uploadBuffer (backupService)', () => {
    fns('../../server/services/storageService', ['uploadBuffer']);
  });
  it('contentAdaptationService.adaptContentForPlatform', () => {
    fns('../../server/services/contentAdaptationService', ['adaptContentForPlatform', 'adaptForPlatform']);
  });
  it('webhookService.triggerWorkflowWebhook', () => {
    fns('../../server/services/webhookService', ['triggerWorkflowWebhook', 'sendWebhook']);
  });
  it('tokenRefreshService.getValidAccessToken', () => {
    fns('../../server/services/tokenRefreshService', ['getValidAccessToken']);
  });
  it('twitterOAuthService.refreshToken / getAccessTokenForAccount', () => {
    fns('../../server/services/twitterOAuthService', ['refreshToken', 'getAccessTokenForAccount']);
  });
  it('contentCalendarService.getOptimalPostingTimes', () => {
    fns('../../server/services/contentCalendarService', ['getOptimalPostingTimes']);
  });

  // Namespace-call variant (svc.method() where method was unexported) — the
  // "double-check" pass found these reachable-but-missed instances.
  it('videoProgressService.createJob/updateJob (routes/video/advanced.js job facade)', () => {
    fns('../../server/services/videoProgressService', ['createJob', 'updateJob', 'startTracking', 'complete', 'fail']);
  });
  it('twitterOAuthService.postTweet (routes/oauth/twitter.js)', () => {
    fns('../../server/services/twitterOAuthService', ['postTweet']);
  });
  it('aeoMetadataService.buildAEOPayload (routes/phase8.js)', () => {
    fns('../../server/services/aeoMetadataService', ['buildAEOPayload']);
  });
  it('aiVideoEditingService.detectKeyMoments (autoClipService)', () => {
    fns('../../server/services/aiVideoEditingService', ['detectKeyMoments', 'buildClipPlan']);
  });
  it('videoCaptionService.generateAutoCaptions (sovereignToolboxService auto-captions tool)', () => {
    fns('../../server/services/videoCaptionService', ['generateAutoCaptions']);
  });
  it('governanceLedgerService.recordAction (fiscalAutonomy + neuralBroadcaster)', () => {
    fns('../../server/services/governanceLedgerService', ['recordAction']);
  });
  it('advancedEvergreenService.detectEvergreenContent (contentAnalytics)', () => {
    fns('../../server/services/advancedEvergreenService', ['detectEvergreenContent']);
  });
  it('slaTrackingService.getSLAStatus (agencyService per-workspace rollup)', () => {
    fns('../../server/services/slaTrackingService', ['getSLAStatus', 'checkSLAStatus']);
  });
});

describe('touched importer modules load without throwing', () => {
  it.each([
    '../../server/services/agenticWorkflowService',
    '../../server/services/aiVideoAnalysisService',
    '../../server/services/advancedKanbanService',
    '../../server/services/audioChangePointDetectionAdvanced',
    '../../server/services/automatedComplianceService',
    '../../server/services/abVariantService',
    '../../server/services/backupService',
    '../../server/services/enhancedWorkflowService',
    '../../server/services/musicBeatSyncService',
    '../../server/services/oauthHealthCheck',
    '../../server/services/realtimeCollaborationService',
    '../../server/services/shotClusteringOptimizations',
    '../../server/services/automationService',
    '../../server/services/sceneWorkflowService',
    '../../server/services/visualAudioFusionAdvanced',
    '../../server/services/audienceGrowthSyncService',
    '../../server/services/platformAnalyticsService',
    '../../server/services/calendarAnalyticsService',
    '../../server/services/calendarRescheduleService',
    '../../server/services/bulkCampaignService',
    '../../server/services/unifiedContentPipelineService',
  ])('%s', (p) => {
    expect(() => require(p)).not.toThrow();
  });
});
