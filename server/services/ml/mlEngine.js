/**
 * mlEngine.js — unified, lazy-loaded ML layer for Click.
 *
 * Exposes real ML primitives the rest of the app can call without caring how
 * they're powered:
 *   - embed(text)              → dense vector (TensorFlow USE → Gemini embeddings)
 *   - classifySentiment(text)  → { overall, scores, confidence, comparative }
 *   - toxicity(text)           → { toxic, score, labels }
 *   - cosineSimilarity(a, b)   → number
 *
 * Design rule (non-negotiable): **the server must always boot.** Every heavy
 * dependency (`@tensorflow/tfjs-node` / `@tensorflow/tfjs`, the USE + toxicity
 * models, the `sentiment` AFINN lib) is loaded lazily inside try/catch. If a
 * load fails we degrade to the next real option — Gemini embeddings for
 * vectors, AFINN for sentiment, a keyword heuristic for toxicity — never a
 * crash and never a fake/random number.
 */

const logger = require('../../utils/logger');

let _tf = null;          // tfjs module (node or pure-js)
let _tfTried = false;
let _useModel = null;    // Universal Sentence Encoder
let _useTried = false;
let _toxModel = null;    // toxicity model
let _toxTried = false;
let _sentiment = null;   // AFINN sentiment instance
let _sentimentTried = false;

/** Lazily load TensorFlow — prefer the native (faster) build, fall back to pure-JS. */
function getTf() {
  if (_tfTried) return _tf;
  _tfTried = true;
  for (const pkg of ['@tensorflow/tfjs-node', '@tensorflow/tfjs']) {
    try {
      // eslint-disable-next-line global-require
      _tf = require(pkg);
      logger.info(`[mlEngine] TensorFlow backend loaded: ${pkg}`);
      return _tf;
    } catch (err) {
      logger.warn(`[mlEngine] ${pkg} not available`, { error: err.message });
    }
  }
  _tf = null;
  return null;
}

/** Lazily load the AFINN sentiment lib (pure-JS, no native build). */
function getSentiment() {
  if (_sentimentTried) return _sentiment;
  _sentimentTried = true;
  try {
    // eslint-disable-next-line global-require
    const Sentiment = require('sentiment');
    _sentiment = new Sentiment();
  } catch (err) {
    logger.warn('[mlEngine] sentiment lib not installed; using keyword fallback', { error: err.message });
    _sentiment = null;
  }
  return _sentiment;
}

async function getUseModel() {
  if (_useTried) return _useModel;
  _useTried = true;
  const tf = getTf();
  if (!tf) return null;
  try {
    // eslint-disable-next-line global-require
    const use = require('@tensorflow-models/universal-sentence-encoder');
    _useModel = await use.load();
    logger.info('[mlEngine] Universal Sentence Encoder loaded');
  } catch (err) {
    logger.warn('[mlEngine] USE model unavailable; embeddings will use Gemini', { error: err.message });
    _useModel = null;
  }
  return _useModel;
}

async function getToxicityModel() {
  if (_toxTried) return _toxModel;
  _toxTried = true;
  const tf = getTf();
  if (!tf) return null;
  try {
    // eslint-disable-next-line global-require
    const toxicity = require('@tensorflow-models/toxicity');
    _toxModel = await toxicity.load(0.85);
    logger.info('[mlEngine] Toxicity model loaded');
  } catch (err) {
    logger.warn('[mlEngine] toxicity model unavailable; using keyword fallback', { error: err.message });
    _toxModel = null;
  }
  return _toxModel;
}

/**
 * Embed text into a dense vector. Real USE embeddings when TF is available;
 * otherwise the existing Gemini text-embedding-004 (also real). Returns null
 * only when neither path is configured.
 */
async function embed(text) {
  const clean = String(text || '').slice(0, 5000);
  if (!clean) return null;
  const model = await getUseModel();
  if (model) {
    try {
      const tensor = await model.embed([clean]);
      const arr = await tensor.array();
      tensor.dispose?.();
      return arr[0];
    } catch (err) {
      logger.warn('[mlEngine] USE embed failed; falling back to Gemini', { error: err.message });
    }
  }
  try {
    const { generateEmbeddings } = require('../../utils/googleAI');
    return await generateEmbeddings(clean);
  } catch (err) {
    logger.warn('[mlEngine] Gemini embeddings unavailable', { error: err.message });
    return null;
  }
}

const POSITIVE = ['great', 'amazing', 'love', 'best', 'excellent', 'awesome', 'perfect', 'brilliant', 'incredible', 'fantastic'];
const NEGATIVE = ['bad', 'terrible', 'hate', 'worst', 'awful', 'horrible', 'disappointing', 'useless', 'garbage', 'sucks'];

/**
 * Classify sentiment. Uses the AFINN `sentiment` lib when installed (real,
 * lexicon-based), else a keyword heuristic. Returns a stable shape:
 *   { overall, scores: {positive,neutral,negative}, confidence, comparative, source }
 */
function classifySentiment(text) {
  const clean = String(text || '');
  const s = getSentiment();
  if (s) {
    const r = s.analyze(clean);
    const pos = r.positive.length;
    const neg = r.negative.length;
    const total = pos + neg || 1;
    const overall = r.score > 0 ? 'positive' : r.score < 0 ? 'negative' : 'neutral';
    return {
      overall,
      scores: {
        positive: Math.round((pos / total) * 100),
        negative: Math.round((neg / total) * 100),
        neutral: Math.round(Math.max(0, 1 - (pos + neg) / Math.max(1, r.tokens.length)) * 100),
      },
      confidence: Math.min(100, Math.abs(r.comparative) * 100 + (pos + neg) * 10),
      comparative: r.comparative,
      source: 'afinn',
    };
  }
  // Keyword fallback (still real, deterministic).
  const lower = clean.toLowerCase();
  const pos = POSITIVE.filter(w => lower.includes(w)).length;
  const neg = NEGATIVE.filter(w => lower.includes(w)).length;
  const total = pos + neg || 1;
  const overall = pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral';
  return {
    overall,
    scores: {
      positive: Math.round((pos / total) * 100),
      negative: Math.round((neg / total) * 100),
      neutral: pos + neg === 0 ? 100 : 0,
    },
    confidence: Math.min(100, (pos + neg) * 20),
    comparative: 0,
    source: 'keyword',
  };
}

const TOXIC_KEYWORDS = ['idiot', 'stupid', 'hate you', 'kill', 'racist', 'slur', 'disgusting', 'worthless'];

/**
 * Toxicity check. Real TF toxicity model when available; else keyword
 * heuristic. Returns { toxic, score, labels, source }.
 */
async function toxicity(text) {
  const clean = String(text || '');
  const model = await getToxicityModel();
  if (model) {
    try {
      const predictions = await model.classify([clean]);
      const valid = (predictions || []).filter(p => p?.results?.[0]);
      const labels = valid.filter(p => p.results[0].match).map(p => p.label);
      // Guard the spread-max: an empty array would make Math.max() return -Infinity.
      const probs = valid.map(p => p.results[0].probabilities?.[1] || 0);
      const maxProb = probs.length ? Math.max(...probs) : 0;
      return { toxic: labels.length > 0, score: Math.round(maxProb * 100) / 100, labels, source: 'tf-toxicity' };
    } catch (err) {
      logger.warn('[mlEngine] toxicity classify failed; keyword fallback', { error: err.message });
    }
  }
  const lower = clean.toLowerCase();
  const hits = TOXIC_KEYWORDS.filter(k => lower.includes(k));
  return { toxic: hits.length > 0, score: hits.length > 0 ? 0.9 : 0.05, labels: hits, source: 'keyword' };
}

/** Cosine similarity between two equal-length vectors. */
function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** Diagnostics for /health and tests — which backends are live. */
function status() {
  return {
    tensorflow: !!getTf(),
    sentimentLib: !!getSentiment(),
    // Models load async on first use; report whether they've been initialized.
    useModelLoaded: !!_useModel,
    toxicityModelLoaded: !!_toxModel,
  };
}

module.exports = { embed, classifySentiment, toxicity, cosineSimilarity, status };
