// Distributed Tracing Service

const logger = require('../utils/logger');

// Trace storage (in production, use Jaeger, Zipkin, or similar)
const traces = [];

/**
 * Start trace
 */
function startTrace(traceId, serviceName, operationName, tags = {}) {
  const trace = {
    traceId,
    serviceName,
    operationName,
    startTime: Date.now(),
    tags,
    spans: [],
  };

  traces.push(trace);
  return trace;
}

/**
 * Add span to trace
 */
function addSpan(traceId, spanName, tags = {}) {
  const trace = traces.find(t => t.traceId === traceId);
  if (!trace) {
    return null;
  }

  const span = {
    spanId: generateSpanId(),
    name: spanName,
    startTime: Date.now(),
    tags,
  };

  trace.spans.push(span);
  return span;
}

/**
 * Finish span
 */
function finishSpan(traceId, spanId, tags = {}) {
  const trace = traces.find(t => t.traceId === traceId);
  if (!trace) {
    return null;
  }

  const span = trace.spans.find(s => s.spanId === spanId);
  if (!span) {
    return null;
  }

  span.endTime = Date.now();
  span.duration = span.endTime - span.startTime;
  span.tags = { ...span.tags, ...tags };

  return span;
}

/**
 * Finish trace
 */
function finishTrace(traceId, tags = {}) {
  const trace = traces.find(t => t.traceId === traceId);
  if (!trace) {
    return null;
  }

  trace.endTime = Date.now();
  trace.duration = trace.endTime - trace.startTime;
  trace.tags = { ...trace.tags, ...tags };

  // Keep only last 1000 traces
  if (traces.length > 1000) {
    traces.shift();
  }

  return trace;
}

/**
 * Get trace
 */
function getTrace(traceId) {
  return traces.find(t => t.traceId === traceId);
}

/**
 * Search traces
 */
function searchTraces(filters = {}) {
  let results = [...traces];

  if (filters.serviceName) {
    results = results.filter(t => t.serviceName === filters.serviceName);
  }

  if (filters.operationName) {
    results = results.filter(t => t.operationName === filters.operationName);
  }

  if (filters.minDuration) {
    results = results.filter(t => t.duration >= filters.minDuration);
  }

  if (filters.maxDuration) {
    results = results.filter(t => t.duration <= filters.maxDuration);
  }

  if (filters.startTime) {
    results = results.filter(t => t.startTime >= filters.startTime);
  }

  if (filters.endTime) {
    results = results.filter(t => t.startTime <= filters.endTime);
  }

  return results.sort((a, b) => b.startTime - a.startTime).slice(0, 100);
}

/**
 * Get trace statistics
 */
function getTraceStats(serviceName = null) {
  const filtered = serviceName
    ? traces.filter(t => t.serviceName === serviceName)
    : traces;

  if (filtered.length === 0) {
    return {
      total: 0,
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0,
    };
  }

  const durations = filtered.map(t => t.duration || 0).filter(d => d > 0);
  
  return {
    total: filtered.length,
    avgDuration: durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0,
    minDuration: durations.length > 0 ? Math.min(...durations) : 0,
    maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
    byService: getTracesByService(),
  };
}

/**
 * Get traces by service
 */
function getTracesByService() {
  const byService = {};

  traces.forEach(trace => {
    if (!byService[trace.serviceName]) {
      byService[trace.serviceName] = {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
      };
    }

    byService[trace.serviceName].count++;
    if (trace.duration) {
      byService[trace.serviceName].totalDuration += trace.duration;
    }
  });

  Object.keys(byService).forEach(service => {
    const stats = byService[service];
    stats.avgDuration = stats.count > 0
      ? stats.totalDuration / stats.count
      : 0;
  });

  return byService;
}

/**
 * Generate trace ID
 */
function generateTraceId() {
  return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate span ID
 */
function generateSpanId() {
  return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Export trace in OpenTelemetry format
 */
function exportOpenTelemetry(traceId) {
  const trace = getTrace(traceId);
  if (!trace) {
    return null;
  }

  return {
    traceId: trace.traceId,
    spans: trace.spans.map(span => ({
      traceId: trace.traceId,
      spanId: span.spanId,
      name: span.name,
      startTime: span.startTime,
      endTime: span.endTime,
      duration: span.duration,
      tags: span.tags,
    })),
  };
}

module.exports = {
  startTrace,
  addSpan,
  finishSpan,
  finishTrace,
  getTrace,
  searchTraces,
  getTraceStats,
  generateTraceId,
  exportOpenTelemetry,
};






