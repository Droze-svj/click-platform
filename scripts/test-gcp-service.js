// scripts/test-gcp-service.js - Dry run check for GCP Vertex AI service
const gcpVertex = require('../server/services/gcpVertexService');

console.log('🤖 Testing gcpVertexService initialization...');
const configured = gcpVertex.isConfigured();
console.log(`GCP Service Configured: ${configured}`);

if (!configured) {
  console.log('ℹ️ GCP Service is unconfigured (normal in dev environment).');
  console.log('Click backend will automatically fall back to local virtual environment runners.');
} else {
  console.log('✅ GCP Service is fully configured!');
  console.log('GCP Project ID:', process.env.GCP_PROJECT_ID);
  console.log('GCP Region:', process.env.GCP_REGION);
  console.log('GCS Bucket:', process.env.GCS_BUCKET_NAME);
}

console.log('\n✅ GCP service loaded without syntax or runtime errors during initialization.');
process.exit(0);
