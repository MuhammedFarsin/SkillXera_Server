const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    // Basic Customer Info
    username: String,
    email: String,
    phone: String,

    // Core Product Reference
    productId: mongoose.Schema.Types.ObjectId,
    productType: {
      type: String,
      enum: ["Course", "DigitalProduct"],
      default: "Course",
    },

    // Payment Transaction Details
    amount: Number,
    orderId: {
      type: String,
      unique: true, // This creates an index automatically
      required: true,
    },
    razorpay_payment_id: String,
    razorpay_signature: String,
    status: {
      type: String,
      enum: [
        "Pending",
        "Success",
        "Failed",
        "Reconciled",
        "Refunded",
        "Captured",
      ],
      default: "Pending",
    },
    paymentMethod: {
      type: String,
      enum: ["Razorpay", "Cashfree"],
    },
    failureReason: String,

    // Order Bump Integration
    isOrderBump: {
      type: Boolean,
      default: false,
    },
    parentOrder: String,
    orderBumps: [
      {
        bumpId: mongoose.Schema.Types.ObjectId,
        productId: mongoose.Schema.Types.ObjectId,
        title: String,
        amount: Number,
        fileUrl: String,
        externalUrl: String,
        contentType: String,
      },
    ],

    // Product State at Time of Purchase
    productSnapshot: {
      title: String,
      description: String,
      images: [String],
      regularPrice: Number,
      salesPrice: Number,
      route: String,
      buyCourse: String,

      // Course Structure
      modules: [
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

      // Digital Product Details
      fileUrl: String,
      externalUrl: String,
      contentType: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes (excluding orderId since it's already indexed via 'unique: true')
PaymentSchema.index({ email: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ "orderBumps.bumpId": 1 });
PaymentSchema.index({ createdAt: -1 });
PaymentSchema.index({ productId: 1, productType: 1 });

// Virtual for total amount (main product + order bumps)
PaymentSchema.virtual("totalAmount").get(function () {
  const bumpsTotal =
    this.orderBumps?.reduce((sum, bump) => sum + (bump.amount || 0), 0) || 0;
  return (this.amount || 0) + bumpsTotal;
});

module.exports = mongoose.model("Payment", PaymentSchema);
