// Content Performance Benchmarking Routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  benchmarkContentPerformance,
  benchmarkUserPerformance,
  compareToSimilarContent,
  getPerformanceTrends,
  predictPerformance,
  saveBenchmarkHistory,
  getBenchmarkHistory,
  comparePeriods,
  checkBenchmarkAlerts
} = require('../services/contentBenchmarkingService');
const {
  createCustomBenchmark,
  getUserBenchmarks,
  updateCustomBenchmark,
  deleteCustomBenchmark,
  evaluateAgainstCustomBenchmarks
} = require('../services/customBenchmarkService');
const {
  createBenchmarkGoal,
  getUserGoals,
  updateGoalProgress,
  deleteGoal
} = require('../services/benchmarkGoalService');
const BenchmarkAlert = require('../models/BenchmarkAlert');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const router = express.Router();

/**
 * GET /api/benchmarking/content/:contentId
 * Benchmark specific content performance
 */
router.get('/content/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { platform } = req.query;

  const benchmark = await benchmarkContentPerformance(req.user._id, contentId, platform);
  sendSuccess(res, 'Content benchmarked', 200, benchmark);
}));

/**
 * GET /api/benchmarking/user
 * Benchmark user's overall performance
 */
router.get('/user', auth, asyncHandler(async (req, res) => {
  const { period = 30 } = req.query;

  const benchmark = await benchmarkUserPerformance(req.user._id, parseInt(period));
  sendSuccess(res, 'User performance benchmarked', 200, benchmark);
}));

/**
 * GET /api/benchmarking/content/:contentId/compare
 * Compare content to similar content
 */
router.get('/content/:contentId/compare', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  const comparison = await compareToSimilarContent(req.user._id, contentId);
  sendSuccess(res, 'Comparison completed', 200, comparison);
}));

/**
 * GET /api/benchmarking/trends
 * Get performance trends over time
 */
router.get('/trends', auth, asyncHandler(async (req, res) => {
  const { period = 90 } = req.query;

  const trends = await getPerformanceTrends(req.user._id, parseInt(period));
  sendSuccess(res, 'Trends retrieved', 200, trends);
}));

/**
 * GET /api/benchmarking/content/:contentId/predict
 * Predict future performance
 */
router.get('/content/:contentId/predict', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  const prediction = await predictPerformance(req.user._id, contentId);
  sendSuccess(res, 'Prediction completed', 200, prediction);
}));

/**
 * POST /api/benchmarking/content/:contentId/save-history
 * Save benchmark history
 */
router.post('/content/:contentId/save-history', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { period = 'weekly' } = req.body;

  const benchmark = await benchmarkContentPerformance(req.user._id, contentId);
  if (benchmark.hasData) {
    await saveBenchmarkHistory(req.user._id, benchmark, period);
  }

  sendSuccess(res, 'History saved', 200);
}));

/**
 * GET /api/benchmarking/history
 * Get benchmark history
 */
router.get('/history', auth, asyncHandler(async (req, res) => {
  const { contentId, platform, period, startDate, endDate } = req.query;

  const history = await getBenchmarkHistory(req.user._id, {
    contentId,
    platform,
    period,
    startDate,
    endDate
  });

  sendSuccess(res, 'History retrieved', 200, { history });
}));

/**
 * POST /api/benchmarking/compare-periods
 * Compare performance across multiple periods
 */
router.post('/compare-periods', auth, asyncHandler(async (req, res) => {
  const { periods } = req.body;

  if (!periods || !Array.isArray(periods) || periods.length < 2) {
    return sendError(res, 'At least 2 periods required', 400);
  }

  const comparison = await comparePeriods(req.user._id, periods);
  sendSuccess(res, 'Periods compared', 200, comparison);
}));

/**
 * POST /api/benchmarking/custom
 * Create custom benchmark
 */
router.post('/custom', auth, asyncHandler(async (req, res) => {
  const benchmark = await createCustomBenchmark(req.user._id, req.body);
  sendSuccess(res, 'Custom benchmark created', 201, benchmark);
}));

/**
 * GET /api/benchmarking/custom
 * Get user's custom benchmarks
 */
router.get('/custom', auth, asyncHandler(async (req, res) => {
  const benchmarks = await getUserBenchmarks(req.user._id);
  sendSuccess(res, 'Benchmarks retrieved', 200, { benchmarks });
}));

/**
 * PUT /api/benchmarking/custom/:id
 * Update custom benchmark
 */
router.put('/custom/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const benchmark = await updateCustomBenchmark(id, req.user._id, req.body);
  sendSuccess(res, 'Benchmark updated', 200, benchmark);
}));

/**
 * DELETE /api/benchmarking/custom/:id
 * Delete custom benchmark
 */
router.delete('/custom/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await deleteCustomBenchmark(id, req.user._id);
  sendSuccess(res, 'Benchmark deleted', 200);
}));

/**
 * GET /api/benchmarking/content/:contentId/custom-evaluation
 * Evaluate content against custom benchmarks
 */
router.get('/content/:contentId/custom-evaluation', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { platform } = req.query;

  const benchmark = await benchmarkContentPerformance(req.user._id, contentId, platform);
  if (!benchmark.hasData) {
    return sendError(res, 'No benchmark data available', 404);
  }

  const evaluation = await evaluateAgainstCustomBenchmarks(
    req.user._id,
    contentId,
    benchmark
  );

  sendSuccess(res, 'Evaluation completed', 200, evaluation);
}));

/**
 * POST /api/benchmarking/alerts
 * Create benchmark alert
 */
router.post('/alerts', auth, asyncHandler(async (req, res) => {
  const alert = new BenchmarkAlert({
    userId: req.user._id,
    ...req.body
  });

  await alert.save();
  sendSuccess(res, 'Alert created', 201, alert);
}));

/**
 * GET /api/benchmarking/alerts
 * Get user's benchmark alerts
 */
router.get('/alerts', auth, asyncHandler(async (req, res) => {
  const alerts = await BenchmarkAlert.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 'Alerts retrieved', 200, { alerts });
}));

/**
 * POST /api/benchmarking/alerts/:id/toggle
 * Toggle alert active status
 */
router.post('/alerts/:id/toggle', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const alert = await BenchmarkAlert.findOneAndUpdate(
    { _id: id, userId: req.user._id },
    { isActive },
    { new: true }
  );

  if (!alert) {
    return sendError(res, 'Alert not found', 404);
  }

  sendSuccess(res, 'Alert updated', 200, alert);
}));

/**
 * DELETE /api/benchmarking/alerts/:id
 * Delete benchmark alert
 */
router.delete('/alerts/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const alert = await BenchmarkAlert.findOneAndDelete({
    _id: id,
    userId: req.user._id
  });

  if (!alert) {
    return sendError(res, 'Alert not found', 404);
  }

  sendSuccess(res, 'Alert deleted', 200);
}));

/**
 * POST /api/benchmarking/goals
 * Create benchmark goal
 */
router.post('/goals', auth, asyncHandler(async (req, res) => {
  const goal = await createBenchmarkGoal(req.user._id, req.body);
  sendSuccess(res, 'Goal created', 201, goal);
}));

/**
 * GET /api/benchmarking/goals
 * Get user's goals
 */
router.get('/goals', auth, asyncHandler(async (req, res) => {
  const { status } = req.query;
  const goals = await getUserGoals(req.user._id, status);
  sendSuccess(res, 'Goals retrieved', 200, { goals });
}));

/**
 * POST /api/benchmarking/goals/update-progress
 * Update goal progress
 */
router.post('/goals/update-progress', auth, asyncHandler(async (req, res) => {
  const result = await updateGoalProgress(req.user._id);
  sendSuccess(res, 'Progress updated', 200, result);
}));

/**
 * DELETE /api/benchmarking/goals/:id
 * Delete goal
 */
router.delete('/goals/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await deleteGoal(id, req.user._id);
  sendSuccess(res, 'Goal deleted', 200);
}));

module.exports = router;

