"use strict";
/**
 * API Client Utilities
 *
 * Provides a centralized API client for making authenticated requests to the backend API.
 * Handles token management, request/response interceptors, and error handling.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.API_URL = void 0;
exports.apiGet = apiGet;
exports.clearApiCache = clearApiCache;
exports.apiPost = apiPost;
exports.apiPut = apiPut;
exports.apiPatch = apiPatch;
exports.apiDelete = apiDelete;
exports.handleApiError = handleApiError;
exports.setAuthToken = setAuthToken;
exports.clearAuthToken = clearAuthToken;
exports.getAuthToken = getAuthToken;
exports.isAuthenticated = isAuthenticated;
var axios_1 = __importDefault(require("axios"));
var apiResponse_1 = require("../utils/apiResponse");
function resolveBaseUrl() {
    var envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
    // Debug instrumentation disabled
    // If you're running the frontend locally, always prefer same-origin proxy (/api)
    // to avoid CORS, mixed-host issues, and "invisible" auth failures.
    if (typeof window !== 'undefined') {
        var host = window.location.hostname;
        var isLocal = host === 'localhost' || host === '127.0.0.1';
        var isRemoteRender = !!envUrl && envUrl.includes('onrender.com');
        var isDirectLocalApi = !!envUrl &&
            (envUrl.startsWith('http://localhost:5001') ||
                envUrl.startsWith('http://127.0.0.1:5001') ||
                envUrl.startsWith('https://localhost:5001') ||
                envUrl.startsWith('https://127.0.0.1:5001'));
        if (isLocal && (isRemoteRender || isDirectLocalApi)) {
            // Debug instrumentation disabled
            return '/api';
        }
    }
    var finalUrl = envUrl || '/api';
    // Debug instrumentation disabled
    return finalUrl;
}
/**
 * API base URL from environment variables.
 * Exported for use in components that need the URL directly.
 */
// Prefer same-origin proxy by default (see `client/next.config.js` rewrites).
// This makes local development reliable even if the Render backend is down.
exports.API_URL = resolveBaseUrl();
/**
 * Creates and configures an Axios instance with default settings.
 *
 * @returns Configured Axios instance
 *
 * @example
 * ```typescript
 * const api = createApiClient()
 * const response = await api.get('/users')
 * ```
 */
// Request queuing with concurrency limits to prevent timeouts
var activeRequests = 0;
var MAX_CONCURRENT_REQUESTS = 3;
var requestQueue = [];
// Retry configuration
var MAX_RETRIES = 2;
var RETRY_DELAY_MS = 1000;
// 429 (Rate Limit) should NOT be retried immediately - it needs a longer wait
// Only retry server errors and timeouts, not rate limits
var RETRYABLE_STATUS_CODES = [500, 502, 503, 504, 408];
var RATE_LIMIT_STATUS_CODE = 429;
// In development, use shorter delay; in production, respect server's retry-after header
var RATE_LIMIT_RETRY_DELAY_MS = process.env.NODE_ENV === 'development' ? 5000 : 60000; // 5s dev, 60s prod
function rateLimitRequest(requestFn) {
    return new Promise(function (resolve, reject) {
        requestQueue.push({ fn: requestFn, resolve: resolve, reject: reject });
        processQueue();
    });
}
function processQueue() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, fn, resolve, reject;
        return __generator(this, function (_b) {
            // If we're at max concurrency or queue is empty, don't process
            if (activeRequests >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) {
                return [2 /*return*/];
            }
            _a = requestQueue.shift(), fn = _a.fn, resolve = _a.resolve, reject = _a.reject;
            activeRequests++;
            // Execute the request with retry logic
            executeWithRetry(fn, 0)
                .then(function (result) { return resolve(result); })
                .catch(function (error) { return reject(error); })
                .finally(function () {
                activeRequests--;
                // Process next request after a small delay to prevent overwhelming the server
                setTimeout(function () { return processQueue(); }, 10);
            });
            return [2 /*return*/];
        });
    });
}
function executeWithRetry(requestFn, retryCount) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1, retryAfter, waitTime_1, shouldRetry;
        var _a, _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    _h.trys.push([0, 2, , 8]);
                    return [4 /*yield*/, requestFn()];
                case 1: return [2 /*return*/, _h.sent()];
                case 2:
                    error_1 = _h.sent();
                    if (!(((_a = error_1 === null || error_1 === void 0 ? void 0 : error_1.response) === null || _a === void 0 ? void 0 : _a.status) === RATE_LIMIT_STATUS_CODE)) return [3 /*break*/, 5];
                    // In development, don't retry rate limits - just fail fast to avoid making it worse
                    if (process.env.NODE_ENV === 'development') {
                        console.warn('⏸️ API: Rate limited (429) in development. Skipping retry to prevent further rate limiting.');
                        throw error_1;
                    }
                    retryAfter = ((_c = (_b = error_1 === null || error_1 === void 0 ? void 0 : error_1.response) === null || _b === void 0 ? void 0 : _b.headers) === null || _c === void 0 ? void 0 : _c['retry-after']) || ((_e = (_d = error_1 === null || error_1 === void 0 ? void 0 : error_1.response) === null || _d === void 0 ? void 0 : _d.headers) === null || _e === void 0 ? void 0 : _e['Retry-After']);
                    waitTime_1 = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, RATE_LIMIT_RETRY_DELAY_MS) : RATE_LIMIT_RETRY_DELAY_MS;
                    if (!(retryCount === 0)) return [3 /*break*/, 4];
                    console.warn("\u23F8\uFE0F API: Rate limited (429). Waiting ".concat(waitTime_1 / 1000, "s before retry..."));
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, waitTime_1); })];
                case 3:
                    _h.sent();
                    return [2 /*return*/, executeWithRetry(requestFn, retryCount + 1)];
                case 4:
                    // Already retried once, don't retry again
                    console.error('⛔ API: Rate limit exceeded. Please wait before making more requests.');
                    throw error_1;
                case 5:
                    shouldRetry = (retryCount < MAX_RETRIES &&
                        ((_f = error_1 === null || error_1 === void 0 ? void 0 : error_1.response) === null || _f === void 0 ? void 0 : _f.status) &&
                        RETRYABLE_STATUS_CODES.includes(error_1.response.status)) || (retryCount < MAX_RETRIES &&
                        (error_1 === null || error_1 === void 0 ? void 0 : error_1.code) === 'ECONNABORTED' // Timeout
                    );
                    if (!shouldRetry) return [3 /*break*/, 7];
                    recordTelemetry('retry', { url: requestFn.name, attempt: retryCount + 1, error: error_1.message });
                    console.log("\uD83D\uDD04 API: Retrying request (attempt ".concat(retryCount + 1, "/").concat(MAX_RETRIES, ") after ").concat(RETRY_DELAY_MS, "ms delay"));
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, RETRY_DELAY_MS * (retryCount + 1)); })]; // Exponential backoff
                case 6:
                    _h.sent(); // Exponential backoff
                    return [2 /*return*/, executeWithRetry(requestFn, retryCount + 1)];
                case 7:
                    recordTelemetry('error', { url: requestFn.name, status: (_g = error_1.response) === null || _g === void 0 ? void 0 : _g.status, message: error_1.message });
                    throw error_1;
                case 8: return [2 /*return*/];
            }
        });
    });
}
// Advanced Monitoring: set window.__CLICK_API_DEBUG__ = true to enable verbose logging
// Metrics and logs are stored in window.__CLICK_API_TELEMETRY__ for real-world audit
if (typeof window !== 'undefined') {
    window.__CLICK_API_TELEMETRY__ = {
        logs: [],
        metrics: { totalRequests: 0, totalErrors: 0, totalRetries: 0, avgLatency: 0 },
        lastError: null
    };
}
var _apiDebug = function () { return (typeof window !== 'undefined' && window.__CLICK_API_DEBUG__ === true); };
function recordTelemetry(type, data) {
    if (typeof window === 'undefined')
        return;
    var tel = window.__CLICK_API_TELEMETRY__;
    if (!tel)
        return;
    var logEntry = __assign({ type: type, timestamp: new Date().toISOString() }, data);
    tel.logs.push(logEntry);
    if (tel.logs.length > 100)
        tel.logs.shift(); // Cap at 100 entries
    if (type === 'request')
        tel.metrics.totalRequests++;
    if (type === 'error') {
        tel.metrics.totalErrors++;
        tel.lastError = logEntry;
    }
    if (type === 'retry')
        tel.metrics.totalRetries++;
    if (_apiDebug()) {
        console.log("[API_DEBUG] ".concat(type.toUpperCase(), ":"), data);
    }
}
var sendApiDebugLog = function (message, data) { return recordTelemetry('request', __assign({ message: message }, data)); };
function createApiClient() {
    // Helpful runtime warning: if you're on localhost but still pointing at Render,
    // you will keep seeing 500s/timeouts. The local proxy setup is the intended default.
    if (typeof window !== 'undefined') {
        var host = window.location.hostname;
        var envUrl = process.env.NEXT_PUBLIC_API_URL;
        if ((host === 'localhost' || host === '127.0.0.1') && envUrl && envUrl.includes('onrender.com')) {
            // eslint-disable-next-line no-console
            console.warn('[api] You are running locally but NEXT_PUBLIC_API_URL points to Render. ' +
                'Forcing baseURL to "/api" (local proxy) so you can keep testing. ' +
                'To make this permanent, unset NEXT_PUBLIC_API_URL or set it to "/api".');
            sendApiDebugLog('proxy_fallback_warning', {
                host: host,
                envUrl: envUrl,
                warning: 'Using local proxy instead of Render URL'
            });
        }
    }
    var client = axios_1.default.create({
        baseURL: resolveBaseUrl(),
        headers: {
            'Content-Type': 'application/json',
        },
        timeout: 45000, // 45 seconds (increased for slow database operations)
    });
    // Enhanced request interceptor with comprehensive debugging
    client.interceptors.request.use(function (config) {
        var _a;
        var requestStartTime = Date.now();
        config.metadata = { startTime: requestStartTime };
        recordTelemetry('request', { url: config.url, method: config.method });
        // Enhanced logging (only in development to reduce spam)
        if (process.env.NODE_ENV === 'development') {
            if (_apiDebug())
                console.log('🔍 API: Request interceptor triggered for:', config.url);
        }
        // Get auth token with SSR safety check
        var authToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (process.env.NODE_ENV === 'development') {
            if (_apiDebug())
                console.log('🔍 API: Token available:', !!authToken, 'length:', (authToken === null || authToken === void 0 ? void 0 : authToken.length) || 0, 'isDevToken:', authToken === null || authToken === void 0 ? void 0 : authToken.startsWith('dev-jwt-token-'));
        }
        // Always ensure token is set in development (only in browser)
        /*
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development' && !authToken) {
          const devToken = 'dev-jwt-token-' + Date.now()
          localStorage.setItem('token', devToken)
          config.headers.Authorization = `Bearer ${devToken}`
          if (process.env.NODE_ENV === 'development') {
            console.log('🔧 API: Auto-generated dev token for request:', config.url)
          }
        } else */ if (authToken) {
            config.headers.Authorization = "Bearer ".concat(authToken);
            if (process.env.NODE_ENV === 'development') {
                if (_apiDebug())
                    console.log('🔍 API: Authorization header added');
            }
        }
        else {
            /* no auth token */
        }
        // Attach the user's chosen UI language so the server can localize AI
        // output. Reads from the same localStorage slot usePreferences uses.
        try {
            if (typeof window !== 'undefined') {
                var prefRaw = localStorage.getItem('click-user-preferences');
                if (prefRaw) {
                    var lang = (_a = JSON.parse(prefRaw)) === null || _a === void 0 ? void 0 : _a.language;
                    if (lang && typeof lang === 'string')
                        config.headers['X-Click-Language'] = lang;
                }
            }
        }
        catch ( /* preferences corrupted — fall back to Accept-Language */_b) { /* preferences corrupted — fall back to Accept-Language */ }
        // Debug logging (with SSR safety checks)
        if (typeof window !== 'undefined') {
            sendApiDebugLog('api_request_start', {
                url: config.url,
                method: config.method,
                headers: __assign(__assign({}, config.headers), { authorization: config.headers.Authorization ? '[REDACTED]' : undefined }),
                data: config.data ? JSON.stringify(config.data).substring(0, 500) + '...' : null,
                timeout: config.timeout,
                hasToken: !!localStorage.getItem('token'),
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                referrer: typeof document !== 'undefined' ? document.referrer : 'unknown',
                currentPath: window.location.pathname
            });
        }
        return config;
    }, function (error) {
        var _a, _b;
        sendApiDebugLog('api_request_error', {
            error: error.message,
            stack: error.stack,
            config: {
                url: (_a = error.config) === null || _a === void 0 ? void 0 : _a.url,
                method: (_b = error.config) === null || _b === void 0 ? void 0 : _b.method
            }
        });
        return Promise.reject(error);
    });
    // Enhanced response interceptor with detailed logging and error handling
    client.interceptors.response.use(function (response) {
        var _a, _b;
        var duration = Date.now() - ((_a = response.config.metadata) === null || _a === void 0 ? void 0 : _a.startTime);
        recordTelemetry('response', { url: response.config.url, status: response.status, duration: duration });
        if (_apiDebug())
            console.log('🔍 API: Response received for:', response.config.url, 'status:', response.status, 'duration:', duration + 'ms');
        // Debug logging disabled to prevent console spam
        // fetch('http://127.0.0.1:5561/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', ...).catch(() => {})
        // Debug logging
        sendApiDebugLog('api_response_success', {
            url: response.config.url,
            method: response.config.method,
            status: response.status,
            statusText: response.statusText,
            duration: duration,
            responseSize: JSON.stringify(response.data).length,
            responseKeys: Object.keys(response.data || {}),
            hasData: !!response.data,
            dataType: typeof response.data,
            headers: response.headers,
            cached: ((_b = response.request) === null || _b === void 0 ? void 0 : _b.fromCache) || false
        });
        return response;
    }, function (error) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2;
        var duration = ((_b = (_a = error.config) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.startTime) ? Date.now() - error.config.metadata.startTime : 0;
        // Filter out noisy 401s that are part of auth probing
        var isAuthProbe = /\/auth\/(me|refresh)/i.test(((_c = error.config) === null || _c === void 0 ? void 0 : _c.url) || '');
        if (!isAuthProbe) {
            recordTelemetry('error', {
                url: (_d = error.config) === null || _d === void 0 ? void 0 : _d.url,
                status: (_e = error.response) === null || _e === void 0 ? void 0 : _e.status,
                message: error.message,
                duration: duration
            });
        }
        console.error('🔍 API: Response error for:', (_f = error.config) === null || _f === void 0 ? void 0 : _f.url, 'duration:', duration + 'ms', 'error:', error.message);
        // Enhanced error logging
        var responseStatus = (_g = error.response) === null || _g === void 0 ? void 0 : _g.status;
        sendApiDebugLog('api_response_error', {
            url: (_h = error.config) === null || _h === void 0 ? void 0 : _h.url,
            method: (_j = error.config) === null || _j === void 0 ? void 0 : _j.method,
            duration: duration,
            error: {
                message: error.message,
                code: error.code,
                status: responseStatus,
                statusText: (_k = error.response) === null || _k === void 0 ? void 0 : _k.statusText,
                data: (_l = error.response) === null || _l === void 0 ? void 0 : _l.data,
                headers: (_m = error.response) === null || _m === void 0 ? void 0 : _m.headers
            },
            isTimeout: error.code === 'ECONNABORTED',
            isNetworkError: !error.response,
            isServerError: responseStatus ? responseStatus >= 500 : false,
            isClientError: responseStatus ? responseStatus >= 400 && responseStatus < 500 : false,
            retryCount: ((_o = error.config) === null || _o === void 0 ? void 0 : _o.retryCount) || 0,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            online: typeof navigator !== 'undefined' ? navigator.onLine : true,
            connectionType: typeof navigator !== 'undefined' ? ((_p = navigator.connection) === null || _p === void 0 ? void 0 : _p.effectiveType) || 'unknown' : 'unknown'
        });
        // Enhanced error handling for database timeouts and server errors
        if (((_q = error.response) === null || _q === void 0 ? void 0 : _q.status) === 500) {
            var errorMessage = ((_r = error.response.data) === null || _r === void 0 ? void 0 : _r.error) || error.message;
            var requestUrl = ((_s = error.config) === null || _s === void 0 ? void 0 : _s.url) || 'unknown';
            // In development, provide detailed error information
            if (process.env.NODE_ENV === 'development') {
                console.error('🔧 [API] 500 Internal Server Error:', {
                    url: requestUrl,
                    method: (_t = error.config) === null || _t === void 0 ? void 0 : _t.method,
                    error: errorMessage,
                    responseData: (_u = error.response) === null || _u === void 0 ? void 0 : _u.data,
                    stack: error.stack
                });
                // If it's a dev user and we get a 500, it might be a route that needs dev user handling
                var token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                var isDevToken = token && token.startsWith('dev-jwt-token-');
                if (isDevToken) {
                    console.warn('🔧 [API] 500 error with dev token - this route might need dev user handling:', requestUrl);
                    console.warn('🔧 [API] Check server logs for more details. The route handler may need to check for dev users.');
                }
            }
            if ((errorMessage === null || errorMessage === void 0 ? void 0 : errorMessage.includes('buffering timed out')) || (errorMessage === null || errorMessage === void 0 ? void 0 : errorMessage.includes('timeout'))) {
                // Create a more user-friendly error for database timeouts
                var enhancedError = new Error('The server is experiencing temporary issues. Please try again in a moment.');
                enhancedError.name = 'DatabaseTimeoutError';
                enhancedError.originalError = error;
                enhancedError.isRetryable = true;
                return Promise.reject(enhancedError);
            }
            // For other 500 errors, provide a user-friendly message
            var userFriendlyError = new Error(process.env.NODE_ENV === 'development'
                ? "Server error: ".concat(errorMessage, " (").concat(requestUrl, ")")
                : 'An error occurred on the server. Please try again later.');
            userFriendlyError.name = 'ServerError';
            userFriendlyError.originalError = error;
            userFriendlyError.response = error.response;
            userFriendlyError.config = error.config;
            return Promise.reject(userFriendlyError);
        }
        // Handle 429 Rate Limiting - don't retry immediately, log warning
        if (((_v = error.response) === null || _v === void 0 ? void 0 : _v.status) === 429) {
            var retryAfter = ((_x = (_w = error.response) === null || _w === void 0 ? void 0 : _w.headers) === null || _x === void 0 ? void 0 : _x['retry-after']) || ((_z = (_y = error.response) === null || _y === void 0 ? void 0 : _y.headers) === null || _z === void 0 ? void 0 : _z['Retry-After']);
            var waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : RATE_LIMIT_RETRY_DELAY_MS;
            console.warn("\u23F8\uFE0F API: Rate limited (429). Server suggests waiting ".concat(waitTime / 1000, "s. Please reduce request frequency."));
        }
        // Handle 401 Unauthorized.
        //
        // ROOT-CAUSE NOTE: previously, ANY 401 from ANY authed endpoint wiped
        // the token and bounced the user to /login. That meant a single
        // background widget hitting a route that legitimately 401's for this
        // user (admin-only feature, in-flight token race, momentary DB hiccup,
        // a route requiring email verification while another doesn't, etc.)
        // killed the entire session. Users reported "I keep getting logged out"
        // even though their /auth/me was fine.
        //
        // The token is only DEFINITIVELY invalid when /auth/me itself rejects
        // it. For every other endpoint, surface the 401 to the caller and let
        // it render its own error / show a "feature unavailable" state. The
        // session stays intact and useAuth's own /auth/me poll is the single
        // source of truth for "are you logged in".
        if (((_0 = error.response) === null || _0 === void 0 ? void 0 : _0.status) === 401 || ((_1 = error.response) === null || _1 === void 0 ? void 0 : _1.status) === 403) {
            var token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            var isDevToken = process.env.NODE_ENV === 'development' && token && token.startsWith('dev-jwt-token-');
            var requestUrl = ((_2 = error.config) === null || _2 === void 0 ? void 0 : _2.url) || 'unknown';
            // 401 on auth-form submissions just means "wrong credentials" —
            // surface to the form, don't bounce.
            var isAuthFormSubmission = /\/auth\/(login|register|refresh|2fa\/)/i.test(requestUrl);
            if (isAuthFormSubmission) {
                return Promise.reject(error);
            }
            // Only treat /auth/me as authoritative for "session is dead". Every
            // other endpoint may 401 or 403 for non-session reasons (route-level
            // perms, deleted resource the user no longer owns, etc.).
            var isSessionProbe = /\/auth\/me(\?|$)/i.test(requestUrl);
            if (!isSessionProbe) {
                return Promise.reject(error);
            }
            if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && window.__CLICK_API_DEBUG__) {
                console.warn('🔧 [API] 401 from /auth/me — token is invalid, signing out');
            }
            if (!isDevToken && typeof window !== 'undefined') {
                localStorage.removeItem('token');
                try {
                    localStorage.removeItem('user');
                }
                catch ( /* ignore */_3) { /* ignore */ }
                if (!window.__clickRedirectingToLogin) {
                    window.__clickRedirectingToLogin = true;
                    try {
                        window.history.pushState({}, '', '/login');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                    }
                    catch (_4) {
                        window.location.href = '/login';
                    }
                    setTimeout(function () { delete window.__clickRedirectingToLogin; }, 2000);
                }
            }
            else if (isDevToken) {
                console.warn('🔧 [API] 401 with dev token preserved (likely backend restart with rotated secret).');
            }
        }
        return Promise.reject(error);
    });
    return client;
}
/**
 * Default API client instance.
 * Use this for most API requests throughout the application.
 */
exports.api = createApiClient();
// Request caching for frequently accessed endpoints
var cache = new Map();
var CACHE_DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default
var CACHE_ENABLED_ENDPOINTS = [
    '/subscription/status',
    '/templates',
    '/workflows/suggestions',
    '/dashboard',
    '/library/items',
    '/analytics/dashboard',
    '/analytics/overview',
    '/style-profile/insights',
    '/integrations',
];
// In-flight request dedup: when 2+ components fire the SAME GET in the same
// tick (e.g. AILearningIndicator + usePerformerInsights both calling
// /style-profile/insights on dashboard mount), they share the same in-flight
// promise instead of each issuing its own HTTP request. The map key is the
// same as the cache key, and the entry is deleted as soon as the request
// settles so a later call still hits the network (or cache) normally.
var inFlight = new Map();
function getCacheKey(endpoint, config) {
    var params = (config === null || config === void 0 ? void 0 : config.params) ? JSON.stringify(config.params) : '';
    return "".concat(endpoint).concat(params);
}
function getCachedResponse(key) {
    var cached = cache.get(key);
    if (!cached)
        return null;
    var now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
        cache.delete(key);
        return null;
    }
    return cached.data;
}
function setCachedResponse(key, data, ttl) {
    if (ttl === void 0) { ttl = CACHE_DEFAULT_TTL; }
    cache.set(key, { data: data, timestamp: Date.now(), ttl: ttl });
}
function shouldCache(endpoint) {
    return CACHE_ENABLED_ENDPOINTS.some(function (enabledEndpoint) { return endpoint.startsWith(enabledEndpoint); });
}
/**
 * Makes a GET request to the API with optional caching.
 *
 * @param endpoint - API endpoint (without base URL)
 * @param config - Optional Axios request configuration
 * @param useCache - Whether to use cache (default: true for enabled endpoints)
 * @returns Promise resolving to the response data
 *
 * @example
 * ```typescript
 * const users = await apiGet('/users')
 * const user = await apiGet('/users/123')
 * ```
 */
function apiGet(endpoint_1, config_1) {
    return __awaiter(this, arguments, void 0, function (endpoint, config, useCache) {
        var cacheKey, shouldUseCache, cached, isShareable, existing, promise;
        var _this = this;
        if (useCache === void 0) { useCache = true; }
        return __generator(this, function (_a) {
            cacheKey = getCacheKey(endpoint, config);
            shouldUseCache = useCache && shouldCache(endpoint);
            // Check cache first
            if (shouldUseCache) {
                cached = getCachedResponse(cacheKey);
                if (cached !== null) {
                    return [2 /*return*/, cached];
                }
            }
            isShareable = !(config === null || config === void 0 ? void 0 : config.signal) && !(config === null || config === void 0 ? void 0 : config.headers);
            if (isShareable) {
                existing = inFlight.get(cacheKey);
                if (existing)
                    return [2 /*return*/, existing];
            }
            promise = rateLimitRequest(function () { return __awaiter(_this, void 0, void 0, function () {
                var response;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, exports.api.get(endpoint, config)
                            // Cache successful GET requests
                        ];
                        case 1:
                            response = _a.sent();
                            // Cache successful GET requests
                            if (shouldUseCache && response.status === 200) {
                                setCachedResponse(cacheKey, response.data);
                            }
                            return [2 /*return*/, response.data];
                    }
                });
            }); });
            if (isShareable) {
                inFlight.set(cacheKey, promise);
                // Always clear on settle (success OR failure) so a later call can retry.
                promise.finally(function () { inFlight.delete(cacheKey); });
            }
            return [2 /*return*/, promise];
        });
    });
}
/**
 * Clear cache for a specific endpoint or all cache
 *
 * @param endpoint - Optional endpoint to clear (if not provided, clears all)
 */
function clearApiCache(endpoint) {
    if (endpoint) {
        // Clear all cache entries that start with this endpoint
        var keys = Array.from(cache.keys());
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var key = keys_1[_i];
            if (key.startsWith(endpoint)) {
                cache.delete(key);
            }
        }
    }
    else {
        cache.clear();
    }
}
/**
 * Makes a POST request to the API.
 *
 * @param endpoint - API endpoint (without base URL)
 * @param data - Request payload
 * @param config - Optional Axios request configuration
 * @returns Promise resolving to the response data
 *
 * @example
 * ```typescript
 * const newUser = await apiPost('/users', { name: 'John', email: 'john@example.com' })
 * ```
 */
function apiPost(endpoint, data, config) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, rateLimitRequest(function () { return __awaiter(_this, void 0, void 0, function () {
                    var response;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, exports.api.post(endpoint, data, config)];
                            case 1:
                                response = _a.sent();
                                return [2 /*return*/, response.data];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Makes a PUT request to the API.
 *
 * @param endpoint - API endpoint (without base URL)
 * @param data - Request payload
 * @param config - Optional Axios request configuration
 * @returns Promise resolving to the response data
 *
 * @example
 * ```typescript
 * const updatedUser = await apiPut('/users/123', { name: 'Jane' })
 * ```
 */
function apiPut(endpoint, data, config) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, rateLimitRequest(function () { return __awaiter(_this, void 0, void 0, function () {
                    var response;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, exports.api.put(endpoint, data, config)];
                            case 1:
                                response = _a.sent();
                                return [2 /*return*/, response.data];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Makes a PATCH request to the API.
 *
 * @param endpoint - API endpoint (without base URL)
 * @param data - Request payload
 * @param config - Optional Axios request configuration
 * @returns Promise resolving to the response data
 *
 * @example
 * ```typescript
 * const patchedUser = await apiPatch('/users/123', { name: 'Jane' })
 * ```
 */
function apiPatch(endpoint, data, config) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, rateLimitRequest(function () { return __awaiter(_this, void 0, void 0, function () {
                    var response;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, exports.api.patch(endpoint, data, config)];
                            case 1:
                                response = _a.sent();
                                return [2 /*return*/, response.data];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Makes a DELETE request to the API.
 *
 * @param endpoint - API endpoint (without base URL)
 * @param config - Optional Axios request configuration
 * @returns Promise resolving to the response data
 *
 * @example
 * ```typescript
 * await apiDelete('/users/123')
 * ```
 */
function apiDelete(endpoint, config) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, rateLimitRequest(function () { return __awaiter(_this, void 0, void 0, function () {
                    var response;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, exports.api.delete(endpoint, config)];
                            case 1:
                                response = _a.sent();
                                return [2 /*return*/, response.data];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Handles API errors and extracts user-friendly error messages.
 *
 * @param error - Error object (typically an AxiosError)
 * @returns User-friendly error message
 *
 * @example
 * ```typescript
 * try {
 *   await apiGet('/users')
 * } catch (error) {
 *   const message = handleApiError(error)
 *   console.error(message)
 * }
 * ```
 */
function handleApiError(error) {
    return (0, apiResponse_1.extractApiError)(error).message;
}
/**
 * Sets the authentication token for all future API requests.
 *
 * @param token - JWT token string
 *
 * @example
 * ```typescript
 * setAuthToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
 * ```
 */
function setAuthToken(token) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
    }
}
/**
 * Removes the authentication token and clears authorization headers.
 *
 * @example
 * ```typescript
 * clearAuthToken()
 * ```
 */
function clearAuthToken() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
    }
}
/**
 * Gets the current authentication token.
 *
 * @returns JWT token string or null if not set
 *
 * @example
 * ```typescript
 * const token = getAuthToken()
 * if (token) {
 *   console.log('User is authenticated')
 * }
 * ```
 */
function getAuthToken() {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('token');
    }
    return null;
}
/**
 * Checks if the user is authenticated (has a valid token).
 *
 * @returns True if authenticated, false otherwise
 *
 * @example
 * ```typescript
 * if (isAuthenticated()) {
 *   // Make authenticated request
 * }
 * ```
 */
function isAuthenticated() {
    return !!getAuthToken();
}
