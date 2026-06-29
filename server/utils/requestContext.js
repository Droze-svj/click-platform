// Request-scoped context via AsyncLocalStorage. Lets the logger stamp every log
// line emitted during a request with its requestId (and userId) WITHOUT threading
// them through every function call — so a single user's request can be traced
// across all the services it touches. Set in middleware/requestId.js; read in
// utils/logger.js. Depends on nothing else (no require cycle).
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

/** Run `fn` with `ctx` ({ requestId, userId? }) available to getContext() inside it. */
function runWithContext(ctx, fn) {
  return als.run(ctx || {}, fn);
}

/** The current request's context, or {} outside a request. */
function getContext() {
  return als.getStore() || {};
}

module.exports = { als, runWithContext, getContext };
