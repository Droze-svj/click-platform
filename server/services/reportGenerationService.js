// Report Generation Service
// Automated white-label reports with agency branding (PDF/Excel/CSV)

const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const Workspace = require('../models/Workspace');
const WhiteLabelPortal = require('../models/WhiteLabelPortal');
const logger = require('../utils/logger');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/**
 * Generate client report
 */
async function generateClientReport(agencyWorkspaceId, clientWorkspaceId, format = 'pdf', options = {}) {
  try {
    const {
      startDate,
      endDate,
      includeROI = true,
      includeGrowth = true,
      includeHighlights = true,
      includePlatforms = true
    } = options;

    // Get portal branding
    const portal = await WhiteLabelPortal.findOne({
      workspaceId: agencyWorkspaceId,
      clientId: clientWorkspaceId
    });

    const clientWorkspace = await Workspace.findById(clientWorkspaceId);
    const agencyWorkspace = await Workspace.findById(agencyWorkspaceId);

    // Get data
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const posts = await ScheduledPost.find({
      clientWorkspaceId,
      scheduledTime: dateFilter,
      status: { $in: ['posted', 'scheduled'] }
    }).lean();

    // Calculate metrics
    const metrics = calculateMetrics(posts);
    const roi = includeROI ? calculateROI(posts, clientWorkspace) : null;
    const growth = includeGrowth ? calculateGrowth(posts, startDate, endDate) : null;
    const highlights = includeHighlights ? getHighlights(posts) : null;
    const platformBreakdown = includePlatforms ? getPlatformBreakdown(posts) : null;

    // Generate report based on format
    switch (format.toLowerCase()) {
      case 'pdf':
        return await generatePDFReport({
          agencyWorkspace,
          clientWorkspace,
          portal,
          metrics,
          roi,
          growth,
          highlights,
          platformBreakdown,
          dateRange: { startDate, endDate }
        });
      case 'excel':
      case 'xlsx':
        return await generateExcelReport({
          agencyWorkspace,
          clientWorkspace,
          portal,
          metrics,
          roi,
          growth,
          highlights,
          platformBreakdown,
          posts,
          dateRange: { startDate, endDate }
        });
      case 'csv':
        return await generateCSVReport({
          agencyWorkspace,
          clientWorkspace,
          portal,
          metrics,
          roi,
          growth,
          highlights,
          platformBreakdown,
          posts,
          dateRange: { startDate, endDate }
        });
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    logger.error('Error generating report', { error: error.message, agencyWorkspaceId, clientWorkspaceId });
    throw error;
  }
}

/**
 * Calculate metrics
 */
function calculateMetrics(posts) {
  const posted = posts.filter(p => p.status === 'posted');
  
  return {
    totalPosts: posts.length,
    posted: posted.length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    totalEngagement: posted.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0),
    totalReach: posted.reduce((sum, p) => sum + (p.analytics?.impressions || 0), 0),
    totalClicks: posted.reduce((sum, p) => sum + (p.analytics?.clicks || 0), 0),
    averageEngagement: posted.length > 0 
      ? Math.round(posted.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0) / posted.length)
      : 0,
    averageReach: posted.length > 0
      ? Math.round(posted.reduce((sum, p) => sum + (p.analytics?.impressions || 0), 0) / posted.length)
      : 0
  };
}

/**
 * Calculate ROI
 */
function calculateROI(posts, clientWorkspace) {
  const posted = posts.filter(p => p.status === 'posted');
  const totalEngagement = posted.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0);
  const totalClicks = posted.reduce((sum, p) => sum + (p.analytics?.clicks || 0), 0);

  // Estimate value (this would be configurable)
  const engagementValue = 0.01; // $0.01 per engagement
  const clickValue = 0.10; // $0.10 per click

  const estimatedValue = (totalEngagement * engagementValue) + (totalClicks * clickValue);
  
  // Get client subscription cost (placeholder)
  const monthlyCost = 100; // This would come from actual billing data
  const daysInPeriod = 30;
  const periodCost = (monthlyCost / 30) * daysInPeriod;

  const roi = periodCost > 0 ? ((estimatedValue - periodCost) / periodCost) * 100 : 0;

  return {
    estimatedValue: Math.round(estimatedValue * 100) / 100,
    periodCost: Math.round(periodCost * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    totalEngagement,
    totalClicks
  };
}

/**
 * Calculate growth
 */
function calculateGrowth(posts, startDate, endDate) {
  if (!startDate || !endDate) return null;

  const periodDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
  const previousStart = new Date(startDate);
  previousStart.setDate(previousStart.getDate() - periodDays);
  const previousEnd = new Date(startDate);

  // This would compare with previous period
  // For now, return placeholder
  return {
    postsGrowth: 0,
    engagementGrowth: 0,
    reachGrowth: 0
  };
}

/**
 * Get highlights
 */
function getHighlights(posts) {
  const posted = posts.filter(p => p.status === 'posted');
  
  const topPost = posted
    .sort((a, b) => (b.analytics?.engagement || 0) - (a.analytics?.engagement || 0))[0];

  const topPlatform = getTopPlatform(posted);

  return {
    topPost: topPost ? {
      platform: topPost.platform,
      engagement: topPost.analytics?.engagement || 0,
      date: topPost.scheduledTime
    } : null,
    topPlatform,
    totalPosts: posted.length,
    bestDay: getBestDay(posted)
  };
}

function getTopPlatform(posts) {
  const platformEngagement = {};
  posts.forEach(post => {
    const platform = post.platform;
    platformEngagement[platform] = (platformEngagement[platform] || 0) + (post.analytics?.engagement || 0);
  });

  const sorted = Object.entries(platformEngagement).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? { platform: sorted[0][0], engagement: sorted[0][1] } : null;
}

function getBestDay(posts) {
  const dayEngagement = {};
  posts.forEach(post => {
    const day = new Date(post.scheduledTime).toLocaleDateString('en-US', { weekday: 'long' });
    dayEngagement[day] = (dayEngagement[day] || 0) + (post.analytics?.engagement || 0);
  });

  const sorted = Object.entries(dayEngagement).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? { day: sorted[0][0], engagement: sorted[0][1] } : null;
}

function getPlatformBreakdown(posts) {
  const breakdown = {};
  posts.forEach(post => {
    if (!breakdown[post.platform]) {
      breakdown[post.platform] = {
        posts: 0,
        engagement: 0,
        reach: 0,
        clicks: 0
      };
    }
    breakdown[post.platform].posts++;
    breakdown[post.platform].engagement += post.analytics?.engagement || 0;
    breakdown[post.platform].reach += post.analytics?.impressions || 0;
    breakdown[post.platform].clicks += post.analytics?.clicks || 0;
  });

  return Object.entries(breakdown).map(([platform, data]) => ({
    platform,
    ...data,
    averageEngagement: data.posts > 0 ? Math.round(data.engagement / data.posts) : 0
  }));
}

/**
 * Generate PDF report
 */
async function generatePDFReport(data) {
  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];

  doc.on('data', chunk => chunks.push(chunk));
  doc.on('end', () => {});

  // Header with branding
  if (data.portal?.branding?.logo) {
    // Would add logo here
  }

  doc.fontSize(24).text(
    `${data.clientWorkspace.name} Performance Report`,
    { align: 'center' }
  );

  if (data.dateRange.startDate && data.dateRange.endDate) {
    doc.fontSize(12).text(
      `${new Date(data.dateRange.startDate).toLocaleDateString()} - ${new Date(data.dateRange.endDate).toLocaleDateString()}`,
      { align: 'center' }
    );
  }

  doc.moveDown(2);

  // Metrics
  doc.fontSize(18).text('Key Metrics', { underline: true });
  doc.fontSize(12);
  doc.text(`Total Posts: ${data.metrics.totalPosts}`);
  doc.text(`Posted: ${data.metrics.posted}`);
  doc.text(`Total Engagement: ${data.metrics.totalEngagement.toLocaleString()}`);
  doc.text(`Total Reach: ${data.metrics.totalReach.toLocaleString()}`);
  doc.text(`Average Engagement: ${data.metrics.averageEngagement.toLocaleString()}`);

  // ROI
  if (data.roi) {
    doc.moveDown();
    doc.fontSize(18).text('ROI Analysis', { underline: true });
    doc.fontSize(12);
    doc.text(`Estimated Value: $${data.roi.estimatedValue.toLocaleString()}`);
    doc.text(`Period Cost: $${data.roi.periodCost.toLocaleString()}`);
    doc.text(`ROI: ${data.roi.roi.toFixed(2)}%`);
  }

  // Highlights
  if (data.highlights) {
    doc.moveDown();
    doc.fontSize(18).text('Highlights', { underline: true });
    doc.fontSize(12);
    if (data.highlights.topPost) {
      doc.text(`Top Post: ${data.highlights.topPost.platform} - ${data.highlights.topPost.engagement.toLocaleString()} engagement`);
    }
    if (data.highlights.topPlatform) {
      doc.text(`Top Platform: ${data.highlights.topPlatform.platform} - ${data.highlights.topPlatform.engagement.toLocaleString()} engagement`);
    }
  }

  // Platform Breakdown
  if (data.platformBreakdown) {
    doc.moveDown();
    doc.fontSize(18).text('Platform Breakdown', { underline: true });
    doc.fontSize(12);
    data.platformBreakdown.forEach(platform => {
      doc.text(`${platform.platform}: ${platform.posts} posts, ${platform.engagement.toLocaleString()} engagement`);
    });
  }

  // Footer
  doc.moveDown(3);
  doc.fontSize(10).text(
    `Generated by ${data.agencyWorkspace.name}`,
    { align: 'center' }
  );

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

/**
 * Generate Excel report
 */
async function generateExcelReport(data) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Performance Report');

  // Header
  worksheet.mergeCells('A1:D1');
  worksheet.getCell('A1').value = `${data.clientWorkspace.name} Performance Report`;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  let row = 3;

  // Metrics
  worksheet.getCell(`A${row}`).value = 'Key Metrics';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 14 };
  row++;

  worksheet.getCell(`A${row}`).value = 'Total Posts';
  worksheet.getCell(`B${row}`).value = data.metrics.totalPosts;
  row++;
  worksheet.getCell(`A${row}`).value = 'Posted';
  worksheet.getCell(`B${row}`).value = data.metrics.posted;
  row++;
  worksheet.getCell(`A${row}`).value = 'Total Engagement';
  worksheet.getCell(`B${row}`).value = data.metrics.totalEngagement;
  row++;
  worksheet.getCell(`A${row}`).value = 'Total Reach';
  worksheet.getCell(`B${row}`).value = data.metrics.totalReach;
  row++;
  worksheet.getCell(`A${row}`).value = 'Average Engagement';
  worksheet.getCell(`B${row}`).value = data.metrics.averageEngagement;
  row += 2;

  // ROI
  if (data.roi) {
    worksheet.getCell(`A${row}`).value = 'ROI Analysis';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 14 };
    row++;
    worksheet.getCell(`A${row}`).value = 'Estimated Value';
    worksheet.getCell(`B${row}`).value = data.roi.estimatedValue;
    row++;
    worksheet.getCell(`A${row}`).value = 'Period Cost';
    worksheet.getCell(`B${row}`).value = data.roi.periodCost;
    row++;
    worksheet.getCell(`A${row}`).value = 'ROI';
    worksheet.getCell(`B${row}`).value = `${data.roi.roi}%`;
    row += 2;
  }

  // Platform Breakdown
  if (data.platformBreakdown) {
    worksheet.getCell(`A${row}`).value = 'Platform Breakdown';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 14 };
    row++;
    
    worksheet.getCell(`A${row}`).value = 'Platform';
    worksheet.getCell(`B${row}`).value = 'Posts';
    worksheet.getCell(`C${row}`).value = 'Engagement';
    worksheet.getCell(`D${row}`).value = 'Reach';
    worksheet.getRow(row).font = { bold: true };
    row++;

    data.platformBreakdown.forEach(platform => {
      worksheet.getCell(`A${row}`).value = platform.platform;
      worksheet.getCell(`B${row}`).value = platform.posts;
      worksheet.getCell(`C${row}`).value = platform.engagement;
      worksheet.getCell(`D${row}`).value = platform.reach;
      row++;
    });
  }

  // Posts sheet
  if (data.posts && data.posts.length > 0) {
    const postsSheet = workbook.addWorksheet('Posts');
    postsSheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Platform', key: 'platform', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Engagement', key: 'engagement', width: 12 },
      { header: 'Reach', key: 'reach', width: 12 },
      { header: 'Clicks', key: 'clicks', width: 12 }
    ];

    data.posts.forEach(post => {
      postsSheet.addRow({
        date: new Date(post.scheduledTime).toLocaleDateString(),
        platform: post.platform,
        status: post.status,
        engagement: post.analytics?.engagement || 0,
        reach: post.analytics?.impressions || 0,
        clicks: post.analytics?.clicks || 0
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Generate CSV report
 */
async function generateCSVReport(data) {
  const lines = [];

  // Header
  lines.push(`${data.clientWorkspace.name} Performance Report`);
  if (data.dateRange.startDate && data.dateRange.endDate) {
    lines.push(`${new Date(data.dateRange.startDate).toLocaleDateString()} - ${new Date(data.dateRange.endDate).toLocaleDateString()}`);
  }
  lines.push('');

  // Metrics
  lines.push('Key Metrics');
  lines.push(`Total Posts,${data.metrics.totalPosts}`);
  lines.push(`Posted,${data.metrics.posted}`);
  lines.push(`Total Engagement,${data.metrics.totalEngagement}`);
  lines.push(`Total Reach,${data.metrics.totalReach}`);
  lines.push(`Average Engagement,${data.metrics.averageEngagement}`);
  lines.push('');

  // ROI
  if (data.roi) {
    lines.push('ROI Analysis');
    lines.push(`Estimated Value,${data.roi.estimatedValue}`);
    lines.push(`Period Cost,${data.roi.periodCost}`);
    lines.push(`ROI,${data.roi.roi}%`);
    lines.push('');
  }

  // Platform Breakdown
  if (data.platformBreakdown) {
    lines.push('Platform Breakdown');
    lines.push('Platform,Posts,Engagement,Reach,Clicks');
    data.platformBreakdown.forEach(platform => {
      lines.push(`${platform.platform},${platform.posts},${platform.engagement},${platform.reach},${platform.clicks}`);
    });
    lines.push('');
  }

  // Posts
  if (data.posts && data.posts.length > 0) {
    lines.push('Posts');
    lines.push('Date,Platform,Status,Engagement,Reach,Clicks');
    data.posts.forEach(post => {
      lines.push(`${new Date(post.scheduledTime).toLocaleDateString()},${post.platform},${post.status},${post.analytics?.engagement || 0},${post.analytics?.impressions || 0},${post.analytics?.clicks || 0}`);
    });
  }

  return Buffer.from(lines.join('\n'), 'utf-8');
}

module.exports = {
  generateClientReport
};


