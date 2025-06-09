const mongoose = require('mongoose');

const failedPaymentSchema = new mongoose.Schema({
  // Core identifiers
  orderId: { type: String, required: true, index: true },
  razorpayPaymentId: { type: String, index: true },
  
  // Product reference
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  productType: { 
    type: String, 
    enum: ['Course', 'DigitalProduct', 'Bundle', 'Other'],
    required: true,
    default: 'Course' // Add default value
  },
  
  // Financial details
  amount: { type: Number, required: true, default: 0 }, // Add default
  currency: { type: String, default: 'INR' },

  status: {
    type: String,
    enum: ["Failed", "Pending", "Success"],
    default: "Failed",
    required: true,
  },
  
  // Error information
  error: { type: String, required: true, default: 'Unknown error' }, // Add default
  errorCode: String,
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
      'other'
    ],
    default: 'other'
  },
  
  // Customer info
  customer: {
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    userId: mongoose.Schema.Types.ObjectId,
    username: { type: String, default: '' } // Added username
  },
  
  // Resolution tracking
  resolved: { type: Boolean, default: false, index: true },
  resolvedAt: Date,
  resolvedBy: mongoose.Schema.Types.ObjectId,
  resolutionNotes: String,
  
  // Additional metadata
  paymentData: { type: mongoose.Schema.Types.Mixed, default: {} } // For any additional data
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true }
});

// Indexes (keep existing ones)
failedPaymentSchema.index({ createdAt: -1 });
failedPaymentSchema.index({ productId: 1, resolved: 1 });
failedPaymentSchema.index({ 'customer.email': 1 });

const FailedPayment = mongoose.model('FailedPayment', failedPaymentSchema);

module.exports = FailedPayment;