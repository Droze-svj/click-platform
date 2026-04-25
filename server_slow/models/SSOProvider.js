// SSO Provider Model

const mongoose = require('mongoose');

const ssoProviderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['saml', 'oidc', 'google', 'microsoft', 'okta'],
    required: true,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  // SAML configuration
  saml: {
    ssoUrl: String,
    certificate: String,
    issuer: String,
    entityId: String,
  },
  // OIDC configuration
  oidc: {
    clientId: String,
    clientSecret: String,
    authorizationUrl: String,
    tokenUrl: String,
    userInfoUrl: String,
    redirectUri: String,
    scopes: [String],
  },
  // Provider-specific settings
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // Attribute mapping
  attributeMapping: {
    email: String,
    name: String,
    firstName: String,
    lastName: String,
    id: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

ssoProviderSchema.index({ type: 1, enabled: 1 });
ssoProviderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SSOProvider', ssoProviderSchema);






