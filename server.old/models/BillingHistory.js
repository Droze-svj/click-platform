// Billing History Model
// Transparent billing history and invoice management

const mongoose = require('mongoose');

const billingHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invoiceNumber: {
    type: String,
    unique: true,
    required: true
  },
  // Invoice details
  invoice: {
    date: {
      type: Date,
      required: true
    },
    period: {
      start: Date,
      end: Date
    },
    amount: {
      subtotal: Number,
      tax: Number,
      discount: Number,
      total: Number,
      currency: { type: String, default: 'USD' }
    },
    items: [{
      description: String,
      quantity: Number,
      unitPrice: Number,
      total: Number
    }]
  },
  // Payment details
  payment: {
    method: {
      type: String,
      enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'other']
    },
    transactionId: String,
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    paidAt: Date,
    refundedAt: Date,
    refundAmount: Number
  },
  // Subscription details
  subscription: {
    tierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UsageBasedTier'
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgencyScalePlan'
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly']
    }
  },
  // Usage details
  usage: {
    aiMinutes: Number,
    clients: Number,
    profiles: Number,
    overage: {
      aiMinutes: Number,
      clients: Number,
      profiles: Number,
      cost: Number
    }
  },
  // Documents
  documents: {
    invoicePdf: String, // URL to PDF
    receiptPdf: String // URL to receipt
  },
  // Status
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'draft'
  },
  // Notes
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

billingHistorySchema.index({ userId: 1, 'invoice.date': -1 });
billingHistorySchema.index({ 'payment.status': 1, 'invoice.date': -1 });
// invoiceNumber already has unique: true which creates an index

billingHistorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Generate invoice number if new
  if (this.isNew && !this.invoiceNumber) {
    this.invoiceNumber = generateInvoiceNumber();
  }
  
  next();
});

function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `INV-${year}${month}-${random}`;
}

module.exports = mongoose.model('BillingHistory', billingHistorySchema);


