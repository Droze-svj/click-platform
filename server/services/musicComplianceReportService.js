// Music Compliance Report Service
// Generates compliance reports and exports

const logger = require('../utils/logger');
const MusicLicenseUsage = require('../models/MusicLicenseUsage');
const MusicLicense = require('../models/MusicLicense');

/**
 * Generate compliance report
 */
async function generateComplianceReport(userId, workspaceId, options = {}) {
  const {
    startDate,
    endDate,
    includeDetails = true,
    format = 'json' // json, csv, pdf
  } = options;

  try {
    const query = { userId };
    if (workspaceId) query.workspaceId = workspaceId;
    if (startDate || endDate) {
      query.renderTimestamp = {};
      if (startDate) query.renderTimestamp.$gte = new Date(startDate);
      if (endDate) query.renderTimestamp.$lte = new Date(endDate);
    }

    // Get usage logs
    const usageLogs = await MusicLicenseUsage.find(query)
      .sort({ renderTimestamp: -1 })
      .lean();

    // Generate summary
    const summary = generateReportSummary(usageLogs);

    // Generate details
    const details = includeDetails ? usageLogs.map(log => formatUsageLogForReport(log)) : [];

    const report = {
      generatedAt: new Date(),
      period: {
        startDate: startDate || null,
        endDate: endDate || null
      },
      summary,
      details,
      compliance: {
        status: calculateComplianceStatus(usageLogs),
        issues: identifyComplianceIssues(usageLogs)
      }
    };

    // Export in requested format
    if (format === 'csv') {
      return generateCSVReport(report);
    } else if (format === 'pdf') {
      return generatePDFReport(report);
    }

    return report;
  } catch (error) {
    logger.error('Error generating compliance report', {
      error: error.message,
      userId,
      workspaceId
    });
    throw error;
  }
}

/**
 * Generate report summary
 */
function generateReportSummary(usageLogs) {
  const summary = {
    totalUsage: usageLogs.length,
    byProvider: {},
    byLicenseType: {},
    bySource: {},
    attributionRequired: 0,
    registered: 0,
    complianceIssues: 0
  };

  usageLogs.forEach(log => {
    // By provider
    const provider = log.provider || 'unknown';
    summary.byProvider[provider] = (summary.byProvider[provider] || 0) + 1;

    // By license type
    const licenseType = log.licenseType || 'unknown';
    summary.byLicenseType[licenseType] = (summary.byLicenseType[licenseType] || 0) + 1;

    // By source
    summary.bySource[log.source] = (summary.bySource[log.source] || 0) + 1;

    // Attribution required
    if (log.attributionRequired) {
      summary.attributionRequired++;
    }

    // Registered
    if (log.providerLicenseRegistered) {
      summary.registered++;
    }

    // Compliance issues
    if (log.complianceStatus !== 'compliant') {
      summary.complianceIssues++;
    }
  });

  return summary;
}

/**
 * Format usage log for report
 */
function formatUsageLogForReport(log) {
  return {
    renderId: log.renderId,
    renderTimestamp: log.renderTimestamp,
    track: {
      id: log.trackId,
      title: log.trackTitle,
      artist: log.trackArtist,
      source: log.source,
      provider: log.provider
    },
    license: {
      type: log.licenseType,
      registered: log.providerLicenseRegistered,
      licenseId: log.providerLicenseId
    },
    export: {
      format: log.exportFormat,
      resolution: log.exportResolution,
      platform: log.exportPlatform
    },
    attribution: {
      required: log.attributionRequired,
      added: log.attributionAdded,
      text: log.attributionText
    },
    compliance: {
      status: log.complianceStatus,
      notes: log.complianceNotes
    }
  };
}

/**
 * Calculate compliance status
 */
function calculateComplianceStatus(usageLogs) {
  if (usageLogs.length === 0) {
    return 'no_usage';
  }

  const nonCompliant = usageLogs.filter(log => log.complianceStatus !== 'compliant');
  const complianceRate = ((usageLogs.length - nonCompliant.length) / usageLogs.length) * 100;

  if (complianceRate === 100) {
    return 'fully_compliant';
  } else if (complianceRate >= 95) {
    return 'mostly_compliant';
  } else if (complianceRate >= 80) {
    return 'partially_compliant';
  } else {
    return 'non_compliant';
  }
}

/**
 * Identify compliance issues
 */
function identifyComplianceIssues(usageLogs) {
  const issues = [];

  // Missing attribution
  const missingAttribution = usageLogs.filter(
    log => log.attributionRequired && !log.attributionAdded
  );
  if (missingAttribution.length > 0) {
    issues.push({
      type: 'missing_attribution',
      count: missingAttribution.length,
      severity: 'high',
      description: `${missingAttribution.length} tracks require attribution but none was added`
    });
  }

  // Unregistered licenses
  const unregistered = usageLogs.filter(
    log => (log.licenseType === 'per_export' || log.licenseType === 'per_end_user') &&
           !log.providerLicenseRegistered
  );
  if (unregistered.length > 0) {
    issues.push({
      type: 'unregistered_license',
      count: unregistered.length,
      severity: 'high',
      description: `${unregistered.length} licenses require registration but were not registered`
    });
  }

  // Failed compliance
  const failed = usageLogs.filter(log => log.complianceStatus === 'failed');
  if (failed.length > 0) {
    issues.push({
      type: 'failed_compliance',
      count: failed.length,
      severity: 'critical',
      description: `${failed.length} usage logs have compliance failures`
    });
  }

  return issues;
}

/**
 * Generate CSV report
 */
function generateCSVReport(report) {
  const headers = [
    'Render ID',
    'Render Timestamp',
    'Track Title',
    'Artist',
    'Provider',
    'License Type',
    'Registered',
    'Export Format',
    'Platform',
    'Attribution Required',
    'Attribution Added',
    'Compliance Status'
  ];

  const rows = report.details.map(detail => [
    detail.renderId,
    detail.renderTimestamp,
    detail.track.title || '',
    detail.track.artist || '',
    detail.track.provider || '',
    detail.license.type,
    detail.license.registered ? 'Yes' : 'No',
    detail.export.format || '',
    detail.export.platform || '',
    detail.attribution.required ? 'Yes' : 'No',
    detail.attribution.added ? 'Yes' : 'No',
    detail.compliance.status
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return {
    format: 'csv',
    content: csvContent,
    filename: `compliance-report-${Date.now()}.csv`
  };
}

/**
 * Render a compliance report to a real PDF.
 *
 * A music-licensing compliance report is the artifact you hand to a rights
 * holder or platform when a track's use is challenged, so "PDF generation not
 * implemented" (what this returned) made the export button produce a JSON blob
 * claiming to be a PDF.
 *
 * Uses pdfkit, already a dependency and used the same way in valueReportService
 * and five other report services.
 *
 * @param {object} report the output of generateComplianceReport()
 * @returns {Promise<{format:string, content:Buffer, contentType:string, filename:string}>}
 */
async function generatePDFReport(report) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const period = report.period?.startDate || report.period?.endDate
    ? `${report.period.startDate ? new Date(report.period.startDate).toLocaleDateString() : 'start'} — ` +
      `${report.period.endDate ? new Date(report.period.endDate).toLocaleDateString() : 'now'}`
    : 'All time';

  doc.fontSize(20).text('Music Licensing Compliance Report', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#555')
    .text(`Period: ${period}`, { align: 'center' })
    .text(`Generated: ${new Date(report.generatedAt || Date.now()).toLocaleString()}`, { align: 'center' });
  doc.fillColor('black').moveDown();

  const summary = report.summary || {};
  doc.fontSize(16).text('Summary', { underline: true });
  doc.moveDown(0.5).fontSize(12);
  doc.text(`Total tracked uses: ${summary.totalUsage ?? 0}`);
  doc.text(`Requiring attribution: ${summary.attributionRequired ?? 0}`);
  doc.text(`Registered with provider: ${summary.registered ?? 0}`);
  doc.text(`Compliance issues: ${summary.complianceIssues ?? 0}`);
  doc.moveDown(0.5);

  // Breakdown tables — skipped entirely when empty rather than printing a
  // heading with nothing under it.
  for (const [heading, group] of [
    ['By provider', summary.byProvider],
    ['By license type', summary.byLicenseType],
    ['By source', summary.bySource],
  ]) {
    const entries = Object.entries(group || {});
    if (entries.length === 0) continue;
    doc.fontSize(13).text(heading, { underline: true });
    doc.fontSize(11);
    for (const [key, count] of entries) doc.text(`  ${key}: ${count}`);
    doc.moveDown(0.5);
  }

  const details = Array.isArray(report.details) ? report.details : [];
  if (details.length > 0) {
    doc.addPage();
    doc.fontSize(16).text('Usage detail', { underline: true });
    doc.moveDown(0.5).fontSize(10);

    details.forEach((entry, index) => {
      // Roughly 12 entries per page keeps rows from splitting across pages.
      if (index > 0 && index % 12 === 0) doc.addPage();
      const when = entry.renderTimestamp ? new Date(entry.renderTimestamp).toLocaleString() : 'unknown date';
      doc.fontSize(11).text(`${entry.track?.title || 'Untitled'} — ${entry.track?.artist || 'Unknown artist'}`);
      doc.fontSize(9).fillColor('#555')
        .text(`  ${when} · render ${entry.renderId || 'n/a'} · ${entry.track?.provider || entry.track?.source || 'unknown source'}`)
        .text(`  License: ${entry.license?.type || 'unspecified'}`);
      doc.fillColor('black').moveDown(0.3);
    });
  }

  doc.end();

  const content = await new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  return {
    format: 'pdf',
    content,
    contentType: 'application/pdf',
    filename: `compliance-report-${Date.now()}.pdf`,
  };
}

/**
 * Export usage logs for audit
 */
async function exportUsageLogs(userId, workspaceId, options = {}) {
  const {
    startDate,
    endDate,
    format = 'json'
  } = options;

  try {
    const query = { userId };
    if (workspaceId) query.workspaceId = workspaceId;
    if (startDate || endDate) {
      query.renderTimestamp = {};
      if (startDate) query.renderTimestamp.$gte = new Date(startDate);
      if (endDate) query.renderTimestamp.$lte = new Date(endDate);
    }

    const logs = await MusicLicenseUsage.find(query)
      .sort({ renderTimestamp: -1 })
      .lean();

    if (format === 'csv') {
      return generateUsageLogsCSV(logs);
    }

    return {
      format: 'json',
      logs,
      count: logs.length,
      exportedAt: new Date()
    };
  } catch (error) {
    logger.error('Error exporting usage logs', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Generate usage logs CSV
 */
function generateUsageLogsCSV(logs) {
  const headers = Object.keys(logs[0] || {});
  const rows = logs.map(log => headers.map(header => {
    const value = log[header];
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value || '';
  }));

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return {
    format: 'csv',
    content: csvContent,
    filename: `usage-logs-${Date.now()}.csv`
  };
}

module.exports = {
  generateComplianceReport,
  exportUsageLogs
};







