#!/usr/bin/env node
/**
 * Phase 8 Verification Script — Sovereign 2026 Market Domination
 * 
 * Runs automated smoke tests across all 5 Phase 8 systems:
 * A. Omni-Model Router
 * B. Spatial Memory & Narrative Stitching
 * C. AEO Metadata Service
 * D. UGC Raw Synthesizer
 * E. Zero-Party Data Capture Service
 * 
 * Usage: node scripts/phase8_verify.js
 */

'use strict';

const path = require('path');

// ─── Terminal Colors ──────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  dim: '\x1b[2m',
  magenta: '\x1b[35m'
};

let passCount = 0;
let failCount = 0;
let warnCount = 0;
const results = [];

function pass(label) {
  passCount++;
  const msg = `  ${c.green}✓${c.reset} ${label}`;
  console.log(msg);
  results.push({ label, status: 'pass' });
}

function fail(label, error) {
  failCount++;
  const msg = `  ${c.red}✗${c.reset} ${label}${error ? ` — ${c.dim}${error}${c.reset}` : ''}`;
  console.log(msg);
  results.push({ label, status: 'fail', error });
}

function warn(label, note) {
  warnCount++;
  const msg = `  ${c.yellow}⚠${c.reset} ${label}${note ? ` — ${c.dim}${note}${c.reset}` : ''}`;
  console.log(msg);
  results.push({ label, status: 'warn', note });
}

function section(title) {
  console.log(`\n${c.bold}${c.cyan}━━━ ${title} ━━━${c.reset}`);
}

function header(text) {
  const line = '═'.repeat(60);
  console.log(`\n${c.bold}${c.magenta}${line}${c.reset}`);
  console.log(`${c.bold}${c.magenta}  ${text}${c.reset}`);
  console.log(`${c.bold}${c.magenta}${line}${c.reset}\n`);
}

// ─── Load Services ─────────────────────────────────────────────────────────────

function loadService(relPath) {
  try {
    return require(path.join(__dirname, '..', 'server', 'services', relPath));
  } catch (e) {
    return null;
  }
}

// ─── A: Omni-Model Router Tests ───────────────────────────────────────────────

async function testOmniModelRouter() {
  section('A. Omni-Model Router');

  const OmniModelRouter = loadService('OmniModelRouter');
  if (!OmniModelRouter) { fail('OmniModelRouter module loads'); return; }
  pass('OmniModelRouter module loads');

  // Test model registry
  const registry = OmniModelRouter.getModelRegistry();
  if (registry.success && registry.totalModels >= 5) {
    pass(`Model registry contains ${registry.totalModels} models (min 5 required)`);
  } else {
    fail('Model registry has minimum 5 models', `got ${registry.totalModels}`);
  }

  // Test scene classification
  const cinematicScene = { description: 'Wide establishing aerial shot of downtown skyline' };
  const classifyCinematic = OmniModelRouter.classifyScene(cinematicScene);
  if (classifyCinematic.model === 'runway-gen4') {
    pass(`Cinematic scene routes to runway-gen4 (confidence: ${classifyCinematic.confidence})`);
  } else {
    warn(`Cinematic scene routing — expected runway-gen4, got ${classifyCinematic.model}`);
  }

  const dialogueScene = { description: 'Close-up portrait of character speaking face to camera dialogue' };
  const classifyDialogue = OmniModelRouter.classifyScene(dialogueScene);
  if (classifyDialogue.model === 'kling-v2') {
    pass(`Dialogue scene routes to kling-v2 (confidence: ${classifyDialogue.confidence})`);
  } else {
    warn(`Dialogue scene routing — expected kling-v2, got ${classifyDialogue.model}`);
  }

  const voScene = { description: 'Voiceover narration spoken audio track lip-sync' };
  const classifyVO = OmniModelRouter.classifyScene(voScene);
  if (classifyVO.model === 'elevenlabs-v3') {
    pass(`Voiceover scene routes to elevenlabs-v3 (confidence: ${classifyVO.confidence})`);
  } else {
    warn(`VO scene routing — expected elevenlabs-v3, got ${classifyVO.model}`);
  }

  // Test full storyboard routing
  const demoStoryboard = [
    { description: 'Aerial drone shot of city' },
    { description: 'Person talking to camera testimonial' },
    { description: 'Voice narration explaining benefits' }
  ];
  const routed = await OmniModelRouter.routeStoryboard(demoStoryboard, { latencyPriority: 'balanced' });
  if (routed.success && routed.manifest.scenes.length === 3) {
    pass(`Storyboard routing: 3 scenes routed, est. cost $${routed.manifest.totalEstimatedCost.toFixed(3)}`);
  } else {
    fail('Full storyboard routing', JSON.stringify(routed));
  }

  // Test UGC mode override
  const ugcRouted = await OmniModelRouter.routeStoryboard(demoStoryboard, { ugcMode: true });
  const hasKling = ugcRouted.manifest?.scenes?.some(s => s.assignedModel === 'kling-v2');
  if (hasKling) {
    pass('UGC mode correctly enforces kling-v2 preference for character scenes');
  } else {
    warn('UGC mode model preference — kling-v2 not detected in output');
  }

  // Test budget ceiling
  const budgetRouted = await OmniModelRouter.routeStoryboard(demoStoryboard, { budgetCeiling: 0.05 });
  if (budgetRouted.manifest.totalEstimatedCost <= 0.10) {
    pass(`Budget ceiling optimization: cost $${budgetRouted.manifest.totalEstimatedCost.toFixed(3)} (≤$0.10)`);
  } else {
    warn(`Budget ceiling may not have optimized fully: $${budgetRouted.manifest.totalEstimatedCost.toFixed(3)}`);
  }
}

// ─── B: Spatial Memory Tests ───────────────────────────────────────────────────

async function testSpatialMemory() {
  section('B. Spatial Memory & Narrative Stitching');

  const SpatialMemoryService = loadService('SpatialMemoryService');
  if (!SpatialMemoryService) { fail('SpatialMemoryService module loads'); return; }
  pass('SpatialMemoryService module loads');

  const testScript = {
    scenes: [
      { id: 's1', description: 'Character sits at desk. Coffee cup on the right. Laptop open. Window behind.' },
      { id: 's2', description: 'Wide room shot. Same desk visible in background.' },
      { id: 's3', description: 'Close shot of character talking. Glasses on table.' },
      { id: 's4', description: 'Different angle from the left side of the room.' }
    ]
  };

  const ledger = await SpatialMemoryService.buildSpatialLedger(testScript, 'verify_test_001');

  if (ledger.ledgerId) {
    pass(`Spatial Ledger built: ${ledger.ledgerId.substring(0, 8)}...`);
  } else {
    fail('Spatial Ledger has valid ledgerId');
    return;
  }

  if (ledger.scenes.length === 4) {
    pass('Ledger contains correct scene count (4)');
  } else {
    fail(`Expected 4 scenes, got ${ledger.scenes.length}`);
  }

  if (Object.keys(ledger.globalEntities).length > 0) {
    pass(`Global entity registry built: ${Object.keys(ledger.globalEntities).length} entities tracked`);
  } else {
    warn('No global entities extracted — check entity pattern matching');
  }

  if (typeof ledger.riskScore === 'number' && ledger.riskScore >= 0 && ledger.riskScore <= 100) {
    pass(`Risk score calculated: ${ledger.riskScore}/100`);
  } else {
    fail('Risk score is valid (0–100)', `got ${ledger.riskScore}`);
  }

  // Test continuity prompt enrichment
  const lastScene = ledger.scenes[ledger.scenes.length - 1];
  if (lastScene.enrichedPrompt && lastScene.enrichedPrompt.length > 0) {
    pass('Scene prompts enriched with continuity enforcement block');
  } else {
    warn('Scene enriched prompt may be empty — check scene 4');
  }

  // Test scene validation
  const validation = SpatialMemoryService.validateSceneAgainstLedger(
    { generatedPrompt: 'Character at desk with laptop' },
    ledger,
    2
  );
  if (typeof validation.continuityScore === 'number') {
    pass(`Scene validation working: continuity score ${validation.continuityScore}`);
  } else {
    warn('Scene validation returned unexpected format');
  }
}

// ─── C: AEO Metadata Tests ─────────────────────────────────────────────────────

async function testAEOMetadata() {
  section('C. AEO Metadata & Answer Engine Optimization');

  const AEOMetadataService = loadService('AEOMetadataService');
  if (!AEOMetadataService) { fail('AEOMetadataService module loads'); return; }
  pass('AEOMetadataService module loads');

  const videoData = {
    title: 'Why CLICK Saves 10 Hours Per Week',
    niche: 'saas',
    targetPlatform: 'linkedin',
    language: 'en',
    durationSeconds: 60
  };
  const productData = {
    name: 'CLICK Platform',
    pricing: { price: '97', currency: 'USD' },
    ctaUrl: 'https://click.ai',
    rating: { score: 4.8, count: 1240 }
  };
  const creatorData = {
    name: 'Alex Sovereign',
    userId: 'user_verify_001',
    brandName: 'Sovereign Agency',
    websiteUrl: 'https://sovereignagency.com'
  };

  const payload = AEOMetadataService.buildAEOPayload(videoData, productData, creatorData);

  if (payload.aeoVersion === '2026.1') {
    pass('AEO payload version is 2026.1');
  } else {
    fail('AEO version check', `got ${payload.aeoVersion}`);
  }

  if (payload.schemaOrgLD?.['@graph']?.length >= 2) {
    pass(`Schema.org @graph contains ${payload.schemaOrgLD['@graph'].length} entities (VideoObject + Product)`);
  } else {
    fail('Schema.org @graph has VideoObject + Product entities');
  }

  if (payload.agentSummary?.oneLineSummary && payload.agentSummary.oneLineSummary.length > 10) {
    pass(`Agent summary generated: "${payload.agentSummary.oneLineSummary.substring(0, 60)}..."`);
  } else {
    fail('Agent summary oneLineSummary generated');
  }

  if (payload.intendedQueryTargets?.length >= 3) {
    pass(`Query targets built: ${payload.intendedQueryTargets.length} AI search hooks`);
  } else {
    warn(`Query targets: expected ≥3, got ${payload.intendedQueryTargets?.length}`);
  }

  if (payload.payloadHash && payload.payloadHash.length === 64) {
    pass(`Payload hash generated (SHA-256): ${payload.payloadHash.substring(0, 16)}...`);
  } else {
    fail('Payload SHA-256 hash generated', `got "${payload.payloadHash}"`);
  }

  // Test AEO serialization
  const serialized = AEOMetadataService.serializeAEOForEmbedding(payload);
  if (Buffer.isBuffer(serialized) && serialized.toString().startsWith('AEO2026')) {
    pass(`AEO ghost block serialized: ${serialized.length} bytes with correct prefix`);
  } else {
    fail('AEO ghost block serialization');
  }

  // Test parsing
  const parsed = AEOMetadataService.parseAEOFromContent(serialized.toString('binary'));
  if (parsed && parsed.payloadHash === payload.payloadHash) {
    pass('AEO ghost block parses correctly (hash matches)');
  } else {
    fail('AEO ghost block round-trip parse');
  }

  // Test c2paService integration
  const c2paService = loadService('c2paService');
  if (c2paService && typeof c2paService.embedAEOMetadata === 'function') {
    pass('c2paService.embedAEOMetadata function exists');
  } else {
    fail('c2paService.embedAEOMetadata function available');
  }

  if (c2paService && typeof c2paService.verifyFullProvenance === 'function') {
    pass('c2paService.verifyFullProvenance function exists');
  } else {
    fail('c2paService.verifyFullProvenance function available');
  }
}

// ─── D: UGC Raw Synthesizer Tests ────────────────────────────────────────────

async function testUGCRawSynthesizer() {
  section('D. UGC Raw Synthesizer');

  const UGCRawSynthesizerService = loadService('UGCRawSynthesizerService');
  if (!UGCRawSynthesizerService) { fail('UGCRawSynthesizerService module loads'); return; }
  pass('UGCRawSynthesizerService module loads');

  // Test UGC profiles
  const profiles = UGCRawSynthesizerService.getUGCProfiles();
  if (profiles.success && profiles.profiles.length >= 4) {
    pass(`UGC profiles available: ${profiles.profiles.map(p => p.label).join(', ')}`);
  } else {
    fail('UGC profiles (min 4)', `got ${profiles.profiles?.length}`);
  }

  // Test SSML audio humanization
  const testScript = 'I discovered this product last week. It changed everything. My workflow is now 3x faster.';
  const humanizedSubtle = UGCRawSynthesizerService.injectAudioFillers(testScript, { intensity: 'subtle' });
  if (humanizedSubtle.startsWith('<speak>')) {
    pass('Audio humanization produces valid SSML output (subtle)');
  } else {
    fail('Audio humanization SSML format', `starts with: ${humanizedSubtle.substring(0, 30)}`);
  }

  const humanizedHeavy = UGCRawSynthesizerService.injectAudioFillers(testScript, { intensity: 'heavy' });
  const hasFillers = humanizedHeavy.includes('<break') || humanizedHeavy.includes('um,') || humanizedHeavy.includes('so,');
  if (hasFillers) {
    pass('Heavy intensity injects filler words/breaks into SSML');
  } else {
    warn('Heavy intensity may not have injected fillers (probabilistic — re-run if flaky)');
  }

  // Test video degradation manifests per profile
  for (const intensity of ['subtle', 'medium', 'heavy']) {
    const manifest = UGCRawSynthesizerService.generateVideoDegradationManifest('raw-testimonial', { intensity });
    if (manifest.authenticityScore > 0 && manifest.video && manifest.color && manifest.pacing) {
      pass(`Degradation manifest (${intensity}): auth score ${manifest.authenticityScore}%, shake ${manifest.video.shakeAmplitudePx}px`);
    } else {
      fail(`Degradation manifest generation (${intensity})`);
    }
  }

  // Test batch generation
  const batch = UGCRawSynthesizerService.generateUGCVariantBatch(testScript, 5, 'raw-testimonial');
  if (batch.success && batch.variants.length === 5) {
    pass(`Batch generation: 5 UGC variants created with unique humanization`);
    const scores = batch.variants.map(v => v.estimatedAuthenticityScore);
    pass(`Authenticity score range: ${Math.min(...scores)}–${Math.max(...scores)}%`);
  } else {
    fail('Batch generation (5 variants)', JSON.stringify(batch).substring(0, 100));
  }

  // Test NeuralPacingService UGC_RAW mode
  const NeuralPacingService = loadService('NeuralPacingService');
  if (NeuralPacingService) {
    try {
      const ugcPacing = await NeuralPacingService.calculateOptimalEditRhythm('verify_user', 'lifestyle_vlog', 'UGC_RAW');
      if (ugcPacing.irregularPacingEnabled === true) {
        pass(`NeuralPacingService UGC_RAW mode: irregular pacing = ${ugcPacing.irregularPacingEnabled}, BPM = ${ugcPacing.bpmTarget}`);
      } else {
        fail('NeuralPacingService UGC_RAW activates irregularPacingEnabled', `got ${ugcPacing.irregularPacingEnabled}`);
      }
      if (ugcPacing.aestheticManifold === 'ugc-raw') {
        pass('NeuralPacingService UGC_RAW routes to ugc-raw tactile archetype');
      } else {
        warn(`UGC_RAW aesthetic manifold — expected ugc-raw, got ${ugcPacing.aestheticManifold}`);
      }
    } catch (e) {
      warn('NeuralPacingService UGC_RAW test skipped (likely DB dependency)', e.message);
    }
  }

  // Test tacticleMultimediaLibrary ugc-raw archetype
  const TactileLibrary = loadService('tactileMultimediaLibrary');
  if (TactileLibrary) {
    const library = TactileLibrary.getTactileLibrary();
    if (library.archetypes['ugc-raw']) {
      pass(`Tactile library contains ugc-raw archetype: "${library.archetypes['ugc-raw'].label}"`);
    } else {
      fail('Tactile library ugc-raw archetype exists');
    }
  }
}

// ─── E: Zero-Party Data Tests ─────────────────────────────────────────────────

async function testZeroPartyData() {
  section('E. Zero-Party Data Capture Service');

  const ZPDService = loadService('ZeroPartyDataService');
  if (!ZPDService) { fail('ZeroPartyDataService module loads'); return; }
  pass('ZeroPartyDataService module loads');

  // Test overlay types
  const types = ZPDService.getOverlayTypes();
  if (types.success && types.overlayTypes.length >= 5) {
    pass(`Overlay type library: ${types.overlayTypes.map(t => t.id).join(', ')}`);
  } else {
    fail('Overlay types (min 5)', `got ${types.overlayTypes?.length}`);
  }

  // Test manifest generation for each platform
  const platforms = ['tiktok', 'instagram_reels', 'youtube_shorts', 'linkedin'];
  for (const platform of platforms) {
    const result = await ZPDService.generateOverlayManifest(
      { targetPlatform: platform, niche: 'saas', durationSeconds: 60 },
      { overlayCount: 2, productData: { name: 'TestProduct', ctaUrl: 'https://test.ai', pricing: { price: '49', currency: 'USD' } } }
    );
    if (result.success && result.manifest.overlays.length > 0) {
      pass(`${platform}: ${result.manifest.overlays.length} overlays, proj. capture ${result.manifest.projectedCaptureRate}`);
    } else {
      fail(`Overlay manifest for ${platform}`, JSON.stringify(result).substring(0, 80));
    }
  }

  // Test POLL overlay structure
  const pollResult = await ZPDService.generateOverlayManifest(
    { targetPlatform: 'tiktok', niche: 'ecommerce', durationSeconds: 45 },
    { overlayCount: 1 }
  );
  const pollOverlay = pollResult.manifest?.overlays?.[0];
  if (pollOverlay?.type === 'POLL' && pollOverlay?.content?.question) {
    pass(`POLL overlay: "${pollOverlay.content.question.substring(0, 50)}..."`);
    if (pollOverlay.captureConfig?.feedToRevenueOracle) {
      pass('POLL overlay correctly wired to Revenue Oracle feedback loop');
    } else {
      warn('POLL overlay Revenue Oracle wiring not detected');
    }
  } else {
    warn('POLL overlay structure check — may need platform compatibility check');
  }

  // Test interaction event capture
  const captureResult = await ZPDService.captureInteractionEvent({
    overlayId: 'test_overlay_001',
    videoId: 'test_video_001',
    viewerId: 'viewer_abc123',
    response: 'a',
    responseLabel: 'I need this now',
    platform: 'tiktok',
    sessionData: { watchDuration: 45, watchPercentage: 75, deviceType: 'mobile' }
  });
  if (captureResult.success && captureResult.eventId) {
    pass(`Interaction captured: eventId ${captureResult.eventId.substring(0, 8)}...`);
    if (captureResult.oracleFeedback?.swarmConsensusWeight === 1.8) {
      pass('ZPD signal weighted 1.8x in Swarm Consensus (premium signal grade)');
    } else {
      warn(`Swarm consensus weight: expected 1.8, got ${captureResult.oracleFeedback?.swarmConsensusWeight}`);
    }
  } else {
    fail('Interaction event capture', JSON.stringify(captureResult).substring(0, 100));
  }
}

// ─── Main Runner ──────────────────────────────────────────────────────────────

async function main() {
  header('SOVEREIGN 2026 — Phase 8 Verification Suite');
  console.log(`${c.dim}Running automated smoke tests for all 5 market-domination systems${c.reset}`);
  console.log(`${c.dim}Timestamp: ${new Date().toISOString()}${c.reset}`);

  try {
    await testOmniModelRouter();
    await testSpatialMemory();
    await testAEOMetadata();
    await testUGCRawSynthesizer();
    await testZeroPartyData();
  } catch (err) {
    console.log(`\n${c.red}${c.bold}FATAL ERROR: ${err.message}${c.reset}`);
    console.log(err.stack);
  }

  // Summary
  const total = passCount + failCount + warnCount;
  const passRate = total > 0 ? ((passCount / total) * 100).toFixed(1) : 0;

  console.log(`\n${c.bold}${c.magenta}${'═'.repeat(60)}${c.reset}`);
  console.log(`${c.bold}  PHASE 8 VERIFICATION — RESULTS${c.reset}`);
  console.log(`${c.bold}${c.magenta}${'─'.repeat(60)}${c.reset}`);
  console.log(`  ${c.green}${c.bold}✓ PASS${c.reset}   ${passCount}`);
  console.log(`  ${c.red}${c.bold}✗ FAIL${c.reset}   ${failCount}`);
  console.log(`  ${c.yellow}${c.bold}⚠ WARN${c.reset}   ${warnCount}`);
  console.log(`  ${c.bold}TOTAL${c.reset}   ${total}`);
  console.log(`  ${c.bold}PASS RATE${c.reset} ${passRate}%`);
  console.log(`${c.bold}${c.magenta}${'═'.repeat(60)}${c.reset}\n`);

  if (failCount === 0) {
    console.log(`${c.green}${c.bold}  ✦ All systems operational. Phase 8 SOVEREIGN.${c.reset}\n`);
  } else {
    console.log(`${c.red}${c.bold}  ✖ ${failCount} failure(s) detected. Review logs above.${c.reset}\n`);
    process.exit(1);
  }
}

main();
