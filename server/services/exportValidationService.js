// Export Validation Service
// Validate exports before processing, estimate size, preview

const logger = require('../utils/logger');

/**
 * Validate export request
 */
async function validateExportRequest(userId, exportData) {
  try {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      estimatedSize: 0,
      estimatedTime: 0,
      recordCount: 0
    };

    // Validate type
    if (!exportData.type) {
      validation.valid = false;
      validation.errors.push('Export type is required');
    }

    // Validate format
    if (!exportData.format) {
      validation.valid = false;
      validation.errors.push('Export format is required');
    }

    // Validate filters
    if (exportData.filters) {
      const filterValidation = validateFilters(exportData.filters);
      validation.errors.push(...filterValidation.errors);
      validation.warnings.push(...filterValidation.warnings);
    }

    // Estimate record count
    if (validation.valid) {
      validation.recordCount = await estimateRecordCount(userId, exportData);
    }

    // Estimate size and time
    if (validation.valid && validation.recordCount > 0) {
      validation.estimatedSize = estimateFileSize(validation.recordCount, exportData.format);
      validation.estimatedTime = estimateProcessingTime(validation.recordCount, exportData.type);
      
      // Warn if export is very large
      if (validation.estimatedSize > 100 * 1024 * 1024) { // 100MB
        validation.warnings.push('This export will be large (>100MB). Consider using filters to reduce size.');
      }

      // Warn if export will take long
      if (validation.estimatedTime > 300) { // 5 minutes
        validation.warnings.push('This export may take several minutes to process.');
      }
    }

    return validation;
  } catch (error) {
    logger.error('Error validating export request', { error: error.message, userId });
    return {
      valid: false,
      errors: ['Validation failed. Please try again.'],
      warnings: [],
      estimatedSize: 0,
      estimatedTime: 0,
      recordCount: 0
    };
  }
}

/**
 * Validate filters
 */
function validateFilters(filters) {
  const validation = {
    errors: [],
    warnings: []
  };

  // Check date ranges
  if (filters.startDate && filters.endDate) {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    
    if (start > end) {
      validation.errors.push('Start date must be before end date');
    }

    const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      validation.warnings.push('Date range exceeds 1 year. Export may be very large.');
    }
  }

  // Check platform filters
  if (filters.platforms && Array.isArray(filters.platforms)) {
    if (filters.platforms.length === 0) {
      validation.warnings.push('No platforms selected. Export may be empty.');
    }
  }

  return validation;
}

/**
 * Estimate record count
 */
async function estimateRecordCount(userId, exportData) {
  try {
    // Would query actual database to estimate
    // For now, return placeholder
    const Content = require('../models/Content');
    const query = buildQuery(exportData.filters || {});
    const count = await Content.countDocuments({ userId, ...query });
    return count;
  } catch (error) {
    logger.error('Error estimating record count', { error: error.message });
    return 0;
  }
}

/**
 * Build query from filters
 */
function buildQuery(filters) {
  const query = {};

  if (filters.platform) {
    query.platform = filters.platform;
  }

  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.createdAt.$lte = new Date(filters.endDate);
    }
  }

  if (filters.status) {
    query.status = filters.status;
  }

  return query;
}

/**
 * Estimate file size
 */
function estimateFileSize(recordCount, format) {
  // Rough estimates per record (in bytes)
  const bytesPerRecord = {
    csv: 500,
    excel: 1000,
    pdf: 2000,
    json: 800,
    xml: 1200,
    zip: 500 // compressed
  };

  const bytesPerRecordForFormat = bytesPerRecord[format] || 500;
  return recordCount * bytesPerRecordForFormat;
}

/**
 * Estimate processing time (in seconds)
 */
function estimateProcessingTime(recordCount, type) {
  // Rough estimates (seconds per 1000 records)
  const secondsPer1000 = {
    content: 10,
    analytics: 15,
    reports: 20,
    assets: 30,
    bulk: 25
  };

  const secondsPer1000ForType = secondsPer1000[type] || 15;
  return Math.ceil((recordCount / 1000) * secondsPer1000ForType);
}

/**
 * Generate export preview
 */
async function generateExportPreview(userId, exportData, limit = 10) {
  try {
    const Content = require('../models/Content');
    const query = buildQuery(exportData.filters || {});
    
    const preview = await Content.find({ userId, ...query })
      .limit(limit)
      .select('title platform status createdAt')
      .lean();

    return {
      preview,
      total: await Content.countDocuments({ userId, ...query }),
      shown: preview.length
    };
  } catch (error) {
    logger.error('Error generating export preview', { error: error.message });
    return { preview: [], total: 0, shown: 0 };
  }
}

module.exports = {
  validateExportRequest,
  generateExportPreview
};


