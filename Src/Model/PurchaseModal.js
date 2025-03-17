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
  
});

const Payment = mongoose.model("Payment", PaymentSchema);
module.exports = Payment;
