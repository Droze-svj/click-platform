"use strict";
/**
 * Standardized API Response Handler
 *
 * This module provides utilities for extracting and handling API responses
 * in a consistent manner across the application.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractApiData = extractApiData;
exports.extractApiError = extractApiError;
exports.extractApiErrorLegacy = extractApiErrorLegacy;
exports.isApiSuccess = isApiSuccess;
/**
 * Extracts the data payload from an API response.
 *
 * @template T - The expected type of the data
 * @param response - API response object (Axios response or plain object)
 * @returns The extracted data or null if not found
 *
 * @remarks
 * Handles multiple response formats:
 * - Standard format: `{ success: true, data: ... }`
 * - Direct data format: Direct object or array
 * - Axios response format: `response.data`
 *
 * @example
 * ```typescript
 * const response = await axios.get('/api/users');
 * const users = extractApiData<User[]>(response);
 * ```
 */
function extractApiData(response) {
    // Handle axios response object
    if (response === null || response === void 0 ? void 0 : response.data) {
        var apiResponse = response.data;
        // Standard format: { success: true, data: ... }
        if (apiResponse.success !== undefined) {
            return apiResponse.data || null;
        }
        // Direct data (backward compatibility)
        return apiResponse;
    }
    // Already extracted data
    if ((response === null || response === void 0 ? void 0 : response.success) !== undefined) {
        return response.data || null;
    }
    // Direct data
    return response;
}
/**
 * Enhanced API error extraction with comprehensive error handling
 *
 * @param error - Error object (Axios error, Error instance, or plain object)
 * @param context - Additional context for better error messages
 * @returns A comprehensive error object with user-friendly message and metadata
 */
function extractApiError(error, context) {
    var message = 'An error occurred';
    var code;
    var details;
    var retryable = false;
    var severity = 'medium';
    var category = 'unknown';
    try {
        // Handle network errors
        if (!(error === null || error === void 0 ? void 0 : error.response) && (error === null || error === void 0 ? void 0 : error.code)) {
            category = 'network';
            switch (error.code) {
                case 'NETWORK_ERROR':
                case 'ERR_NETWORK':
                    message = 'Network connection failed. Please check your internet connection.';
                    retryable = true;
                    severity = 'medium';
                    break;
                case 'TIMEOUT':
                case 'ECONNABORTED':
                    message = 'Request timed out. Please try again.';
                    retryable = true;
                    severity = 'low';
                    break;
                case 'ERR_CONNECTION_REFUSED':
                    message = 'Server is currently unavailable. Please try again later.';
                    retryable = true;
                    severity = 'high';
                    break;
                default:
                    message = 'Network error occurred. Please try again.';
                    retryable = true;
            }
        }
        // Handle HTTP errors
        else if (error === null || error === void 0 ? void 0 : error.response) {
            var status_1 = error.response.status;
            code = status_1;
            details = error.response.data;
            // Extract error from response data
            if (error.response.data) {
                var apiResponse = error.response.data;
                message = apiResponse.error || apiResponse.message || message;
            }
            // Handle specific HTTP status codes
            switch (status_1) {
                case 400:
                    category = 'validation';
                    message = message || 'Invalid request. Please check your input.';
                    severity = 'low';
                    break;
                case 401:
                    category = 'authentication';
                    message = 'Your session has expired. Please sign in again.';
                    severity = 'medium';
                    retryable = false;
                    break;
                case 403:
                    category = 'authorization';
                    message = 'You don\'t have permission to perform this action.';
                    severity = 'medium';
                    break;
                case 404:
                    category = 'not_found';
                    message = 'The requested resource was not found.';
                    severity = 'low';
                    break;
                case 429:
                    category = 'rate_limit';
                    message = 'Too many requests. Please wait a moment and try again.';
                    retryable = true;
                    severity = 'low';
                    break;
                case 500:
                case 502:
                case 503:
                case 504:
                    category = 'server';
                    message = 'Server error occurred. Please try again later.';
                    retryable = true;
                    severity = 'high';
                    break;
                default:
                    category = 'http';
                    severity = status_1 >= 500 ? 'high' : 'medium';
                    retryable = status_1 >= 500;
            }
        }
        // Handle direct data errors
        else if (error === null || error === void 0 ? void 0 : error.data) {
            var apiResponse = error.data;
            message = apiResponse.error || apiResponse.message || message;
            category = 'api';
        }
        // Handle error instances or strings
        else if ((error === null || error === void 0 ? void 0 : error.message) || typeof error === 'string') {
            message = typeof error === 'string' ? error : error.message;
            category = 'application';
            // Check for specific error patterns
            if (message.includes('timeout')) {
                retryable = true;
                severity = 'low';
                category = 'timeout';
            }
            else if (message.includes('network') || message.includes('fetch')) {
                retryable = true;
                severity = 'medium';
                category = 'network';
            }
        }
        // Override retryable based on context if provided
        if ((context === null || context === void 0 ? void 0 : context.retryable) !== undefined) {
            retryable = context.retryable;
        }
        // Enhance message with context
        if (context === null || context === void 0 ? void 0 : context.operation) {
            message = "".concat(context.operation, " failed: ").concat(message);
        }
    }
    catch (parseError) {
        // If error parsing fails, return a safe fallback
        console.warn('[extractApiError] Error parsing failed:', parseError);
        message = 'An unexpected error occurred while processing the error response.';
        category = 'parse_error';
        severity = 'medium';
    }
    return {
        message: message,
        code: code,
        details: details,
        retryable: retryable,
        severity: severity,
        category: category
    };
}
/**
 * Legacy function for backward compatibility
 * @deprecated Use extractApiError for enhanced error handling
 */
function extractApiErrorLegacy(error) {
    var result = extractApiError(error);
    return result.message;
}
/**
 * Checks if an API response indicates success.
 *
 * @param response - API response object
 * @returns True if the response indicates success, false otherwise
 *
 * @remarks
 * Checks for:
 * - `response.data.success === true`
 * - `response.success === true`
 * - Valid HTTP status code (200-299)
 *
 * @example
 * ```typescript
 * const response = await axios.get('/api/users');
 * if (isApiSuccess(response)) {
 *   // Handle success
 * }
 * ```
 */
function isApiSuccess(response) {
    var _a;
    if (((_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.success) !== undefined) {
        return response.data.success === true;
    }
    if ((response === null || response === void 0 ? void 0 : response.success) !== undefined) {
        return response.success === true;
    }
    // Assume success if no error status code
    return !(response === null || response === void 0 ? void 0 : response.status) || (response.status >= 200 && response.status < 300);
}
