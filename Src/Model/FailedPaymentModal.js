const mongoose = require('mongoose');

const failedPaymentSchema = new mongoose.Schema({
  // Core identifiers
  orderId: { type: String, required: true, index: true },
  
  // Gateway-specific identifiers
  gateway: {
    type: String,
    enum: ['razorpay', 'cashfree', 'other'],
    required: true
  },
  gatewayPaymentId: { type: String, index: true }, // Generic field for both gateways
  gatewayOrderId: { type: String, index: true },   // Generic field for both gateways
  
  // Product reference
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  productType: { 
    type: String, 
    enum: ['course', 'digitalProduct', 'Bundle', 'Other'],
    required: true,
    default: 'Course'
  },
  
  // Financial details
  amount: { type: Number, required: true, default: 0 },
  currency: { type: String, default: 'INR' },
  gatewayAmount: Number,   
  gatewayCurrency: String,  

  // Payment status information
  status: {
    type: String,
    enum: ["Failed", "Pending", "Success", "Authorized", "Captured"],
    default: "Failed",
    required: true,
  },
  gatewayStatus: String,    // Raw status from payment gateway
  
  // Error information
  error: { type: String, required: true, default: 'Unknown error' },
  errorCode: String,
  errorDescription: String, // More detailed error from gateway
  stackTrace: String,
  context: {
    type: String,
    enum: [
      'payment_processing',
      'order_verification',
      'refund_processing',
      'user_creation',
      'email_sending',
      'order_bump',
      'database_error',
      'gateway_error',
      'other'
    ],
    default: 'other'
  },
  
  // Customer info
  customer: {
    email: { type: String, required: true },
    phone: { type: String, default: '' },
    userId: mongoose.Schema.Types.ObjectId,
    username: { type: String, default: '' }
  },
  
  // Resolution tracking
  resolved: { type: Boolean, default: false, index: true },
  resolvedAt: Date,
  resolvedBy: mongoose.Schema.Types.ObjectId,
  resolutionNotes: String,
  resolutionAction: {
    type: String,
    enum: ['retried', 'refunded', 'manual_override', 'ignored', 'other']
  },
  
  // Gateway-specific raw data
  gatewayResponse: { type: mongoose.Schema.Types.Mixed }, // Raw response from gateway
  gatewayError: { type: mongoose.Schema.Types.Mixed },    // Raw error from gateway
  
  // Additional metadata
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  tags: [String] // For categorization/search

}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
failedPaymentSchema.index({ createdAt: -1 });
failedPaymentSchema.index({ productId: 1, resolved: 1 });
failedPaymentSchema.index({ 'customer.email': 1 });
failedPaymentSchema.index({ gateway: 1, status: 1 });
failedPaymentSchema.index({ gatewayStatus: 1 });

// Virtual for gateway-specific URLs (useful for admin interfaces)
failedPaymentSchema.virtual('gatewayUrl').get(function() {
  if (this.gateway === 'razorpay' && this.gatewayPaymentId) {
    return `https://dashboard.razorpay.com/app/payments/${this.gatewayPaymentId}`;
  }
  if (this.gateway === 'cashfree' && this.gatewayOrderId) {
    return `https://merchant.cashfree.com/merchant/payments/${this.gatewayOrderId}`;
  }
  return null;
});

// Pre-save hook to normalize data
failedPaymentSchema.pre('save', function(next) {
  // Ensure gateway identifiers are properly set
  if (this.gateway === 'razorpay') {
    this.gatewayPaymentId = this.gatewayPaymentId || this.razorpay_payment_id;
    this.gatewayOrderId = this.gatewayOrderId || this.razorpay_order_id;
  } else if (this.gateway === 'cashfree') {
    this.gatewayPaymentId = this.gatewayPaymentId || this.cf_payment_id;
    this.gatewayOrderId = this.gatewayOrderId || this.cf_order_id;
  }
  
  // Normalize customer email to lowercase
  if (this.customer?.email) {
    this.customer.email = this.customer.email.toLowerCase().trim();
  }
  
  next();
});

const FailedPayment = mongoose.model('FailedPayment', failedPaymentSchema);

module.exports = FailedPayment;