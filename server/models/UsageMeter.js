/**
 * UsageMeter — per-user, per-month AI spend & usage meter.
 *
 * costGuard.js reads this to enforce the per-tier monthly AI budget
 * (aiBudgetUsd) and writes to it after every AI call via recordUsage(). The
 * model was previously MISSING, so `require('../models/UsageMeter')` threw, the
 * catch swallowed it, and BOTH the budget check and the usage metering silently
 * no-opped — every user effectively had an unlimited AI budget. Creating it
 * makes the cost-safety layer real.
 *
 * One document per (userId, monthKey) where monthKey is 'YYYY-MM'. Counters are
 * incremented atomically via findOneAndUpdate($inc, upsert:true).
 */

const mongoose = require('mongoose');

const usageMeterSchema = new mongoose.Schema({
  // Stored as String to match how costGuard passes the id
  // (req.user.id || req.user._id.toString()) — works for ObjectId & UUID users.
  userId: { type: String, required: true },
  monthKey: { type: String, required: true }, // 'YYYY-MM'

  aiSpendUsd: { type: Number, default: 0 },
  aiInputTokens: { type: Number, default: 0 },
  aiOutputTokens: { type: Number, default: 0 },
  callCount: { type: Number, default: 0 },
  lastTaskType: { type: String, default: 'unknown' },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

// One meter per user per month; also the hot lookup path in getRemainingBudgetUsd.
usageMeterSchema.index({ userId: 1, monthKey: 1 }, { unique: true });

module.exports = mongoose.models.UsageMeter
  || mongoose.model('UsageMeter', usageMeterSchema);
