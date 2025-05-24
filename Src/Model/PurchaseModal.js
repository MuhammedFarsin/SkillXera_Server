const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  // Customer Information
  username: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: Number, required: true },

  // Product Reference (Supports both courses and digital products)
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "productType", // Dynamic reference based on productType
  },
  productType: {
    type: String,  
    required: true,
    enum: ["Course", "DigitalProduct"], // Explicit types
    default: "Course", // Backward compatibility
  },

  // Payment Details
  amount: { type: Number, required: true },
  orderId: { type: String, required: true },
  status: {
    type: String,
    enum: ["Pending", "Success", "Failed"],
    default: "Pending",
  },
  createdAt: { type: Date, default: Date.now },
  paymentMethod: {
    type: String,
    enum: ["Razorpay", "Cashfree"],
    required: true,
  },

  productSnapshot: {
    title: { type: String, required: true },
    description: String,
    images: [String],
    regularPrice: { type: Number, required: true },
    salesPrice: { type: Number, required: true },

    route: String,
    buyCourse: String,
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
      required: function () {
        return this.productType === "Course";
      },
    },

    fileUrl: {
      type: String,
      required: function () {
        return this.productType === "DigitalProduct";
      },
    },
    externalUrl: String,
    contentType: {
      type: String,
      enum: ["file", "link"],
      required: function () {
        return this.productType === "DigitalProduct";
      },
    },
  },
});

PaymentSchema.index({ productId: 1, productType: 1 });
PaymentSchema.index({ email: 1, status: 1 });

const Payment = mongoose.model("Payment", PaymentSchema);
module.exports = Payment;
