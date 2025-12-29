// Link Click Tracking Model
// Track individual clicks on branded links

const mongoose = require('mongoose');

const linkClickSchema = new mongoose.Schema({
  linkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BrandedLink',
    required: true,
    index: true
  },
  ipAddress: {
    type: String,
    index: true
  },
  userAgent: String,
  referrer: String,
  country: String,
  city: String,
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown']
  },
  browser: String,
  os: String,
  utmSource: String,
  utmMedium: String,
  utmCampaign: String,
  utmTerm: String,
  utmContent: String,
  clickedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

linkClickSchema.index({ linkId: 1, clickedAt: -1 });
linkClickSchema.index({ clickedAt: -1 });

module.exports = mongoose.model('LinkClick', linkClickSchema);


