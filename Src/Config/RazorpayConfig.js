// config/razorpay.js
const Razorpay = require('razorpay');


if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET_ID) {
  console.error(
    "❌ Razorpay keys are missing. Check your environment variables."
  );
}

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_ID
});

module.exports = razorpayInstance;