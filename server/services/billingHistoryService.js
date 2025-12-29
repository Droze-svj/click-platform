// Billing History Service
// Transparent billing history and invoice management

const BillingHistory = require('../models/BillingHistory');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Get user billing history
 */
async function getUserBillingHistory(userId, filters = {}) {
  try {
    const {
      startDate = null,
      endDate = null,
      status = null,
      limit = 50
    } = filters;

    const query = { userId };
    if (startDate || endDate) {
      query['invoice.date'] = {};
      if (startDate) query['invoice.date'].$gte = new Date(startDate);
      if (endDate) query['invoice.date'].$lte = new Date(endDate);
    }
    if (status) query.status = status;

    const history = await BillingHistory.find(query)
      .populate('subscription.tierId', 'name slug')
      .populate('subscription.planId', 'name slug')
      .sort({ 'invoice.date': -1 })
      .limit(limit)
      .lean();

    return history;
  } catch (error) {
    logger.error('Error getting billing history', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get billing summary
 */
async function getBillingSummary(userId, period = 'year') {
  try {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), 0, 1);
    }

    const history = await BillingHistory.find({
      userId,
      'invoice.date': { $gte: startDate },
      status: { $in: ['paid', 'completed'] }
    }).lean();

    const summary = {
      period,
      totalInvoices: history.length,
      totalAmount: history.reduce((sum, h) => sum + (h.invoice.amount.total || 0), 0),
      totalTax: history.reduce((sum, h) => sum + (h.invoice.amount.tax || 0), 0),
      totalDiscount: history.reduce((sum, h) => sum + (h.invoice.amount.discount || 0), 0),
      averageMonthly: period === 'year' 
        ? history.reduce((sum, h) => sum + (h.invoice.amount.total || 0), 0) / 12
        : history.reduce((sum, h) => sum + (h.invoice.amount.total || 0), 0) / history.length,
      byMonth: groupByMonth(history),
      trends: calculateTrends(history)
    };

    return summary;
  } catch (error) {
    logger.error('Error getting billing summary', { error: error.message, userId });
    throw error;
  }
}

/**
 * Group by month
 */
function groupByMonth(history) {
  const grouped = {};

  history.forEach(item => {
    const date = new Date(item.invoice.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!grouped[key]) {
      grouped[key] = {
        month: key,
        count: 0,
        total: 0
      };
    }

    grouped[key].count++;
    grouped[key].total += item.invoice.amount.total || 0;
  });

  return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Calculate trends
 */
function calculateTrends(history) {
  if (history.length < 2) {
    return { trend: 'stable', change: 0 };
  }

  const sorted = history.sort((a, b) => 
    new Date(a.invoice.date) - new Date(b.invoice.date)
  );

  const first = sorted[0].invoice.amount.total || 0;
  const last = sorted[sorted.length - 1].invoice.amount.total || 0;

  const change = first > 0 ? ((last - first) / first) * 100 : 0;

  return {
    trend: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
    change: Math.round(change * 100) / 100
  };
}

/**
 * Get invoice
 */
async function getInvoice(invoiceNumber, userId) {
  try {
    const invoice = await BillingHistory.findOne({
      invoiceNumber,
      userId
    })
      .populate('subscription.tierId', 'name slug')
      .populate('subscription.planId', 'name slug')
      .lean();

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    return invoice;
  } catch (error) {
    logger.error('Error getting invoice', { error: error.message, invoiceNumber });
    throw error;
  }
}

/**
 * Download invoice PDF
 */
async function downloadInvoicePDF(invoiceNumber, userId) {
  try {
    const invoice = await getInvoice(invoiceNumber, userId);
    
    // Would generate PDF
    // For now, return URL
    return {
      url: invoice.documents.invoicePdf || null,
      invoiceNumber: invoice.invoiceNumber
    };
  } catch (error) {
    logger.error('Error downloading invoice PDF', { error: error.message, invoiceNumber });
    throw error;
  }
}

/**
 * Request invoice correction
 */
async function requestInvoiceCorrection(invoiceNumber, userId, correctionData) {
  try {
    const invoice = await BillingHistory.findOne({
      invoiceNumber,
      userId
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Create support ticket for correction
    const BillingSupportService = require('./billingSupportService');
    const ticket = await BillingSupportService.createBillingTicket(userId, {
      subject: `Invoice Correction Request: ${invoiceNumber}`,
      description: correctionData.reason,
      invoiceId: invoiceNumber
    });

    return {
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
      message: 'Correction request submitted. Support will review and respond within 1 hour.'
    };
  } catch (error) {
    logger.error('Error requesting invoice correction', { error: error.message, invoiceNumber });
    throw error;
  }
}

module.exports = {
  getUserBillingHistory,
  getBillingSummary,
  getInvoice,
  downloadInvoicePDF,
  requestInvoiceCorrection
};


