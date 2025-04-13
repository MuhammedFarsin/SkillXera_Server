const mongoose = require("mongoose");

const checkoutPageSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    topHeading: {
      type: String,
      required: true,
    },
    subHeading: {
      type: String,
      required: true,
    },
    checkoutImage: {
      type: String, // store image URL or filename here
      required: true,
    },
    lines: {
      type: [String], // array of rich text strings
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const CheckoutPage = mongoose.model("CheckoutPage", checkoutPageSchema);

module.exports = CheckoutPage
