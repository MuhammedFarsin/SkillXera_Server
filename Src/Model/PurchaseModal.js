const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  // Customer Information
  username: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: Number, required: true },

  // Product Information
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "productType",
  },
  productType: {
    type: String,  
    required: true,
    enum: ["Course", "DigitalProduct"],
    default: "Course",
  },

  // Payment Details
  amount: { type: Number, required: true },
  orderId: { type: String, required: true },
  razorpay_payment_id: String,
  razorpay_signature: String,
  status: { 
    type: String, 
    enum: ["Pending", "Success", "Failed"], 
    default: "Pending" 
  },
  paymentMethod: {
    type: String,
    enum: ["Razorpay", "Cashfree"],
    required: true,
  },
  failureReason: String,
  isOrderBump: { type: Boolean, default: false },
  parentOrder: String,

  // Product Snapshot
  productSnapshot: {
    title: { type: String, required: true },
    description: String,
    images: [String],
    regularPrice: { type: Number, required: true },
    salesPrice: { type: Number, required: true },
    route: String,
    buyCourse: String,
    
    // Course-specific fields
    modules: {
      type: [
        {
          title: String,
          lectures: [
            {
              title: String,
              description: String,
              videoUrl: String,
              resources: [String],
              duration: Number,
            },
          ],
        },
      ],
      required: function() {
        return this.productType === "Course";
      },
    },

    // Digital Product-specific fields
    fileUrl: {
      type: String,
      required: function() {
        return this.productType === "DigitalProduct";
      },
    },
    externalUrl: String,
    contentType: {
      type: String,
      enum: ["file", "link"],
      required: function() {
        return this.productType === "DigitalProduct";
      },
    },
  },

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Indexes
PaymentSchema.index({ productId: 1, productType: 1 });
PaymentSchema.index({ email: 1, status: 1 });
PaymentSchema.index({ orderId: 1 }, { unique: true });

const Payment = mongoose.model("Payment", PaymentSchema);
module.exports = Payment;