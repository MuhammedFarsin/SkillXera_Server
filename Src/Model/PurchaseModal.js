const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: Number, required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
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
  courseSnapshot: {
    courseId: mongoose.Schema.Types.ObjectId,
    title: String,
    description: String,
    images: [String],
    route: String,
    buyCourse: String,
    regularPrice: Number,
    salesPrice: Number,
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
          }
        ]
      }
    ]
  }
  
});

const Payment = mongoose.model("Payment", PaymentSchema);
module.exports = Payment;
