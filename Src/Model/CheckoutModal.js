const mongoose = require("mongoose");

const checkoutPageSchema = new mongoose.Schema(
  {
    linkedTo: {
      kind: {
        type: String,
        enum: ["course", "digital-product"],
        required: true
      },
      item: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'linkedTo.kind'
      }
    },
    topHeading: {
      type: String,
      required: true,
      trim: true
    },
    subHeading: {
      type: String,
      required: true,
      trim: true
    },
    checkoutImage: {
      type: String, // URL or filename
      required: true
    },
    lines: [{
      type: String, // Array of rich text strings
      required: true
    }],
    // Additional fields you might want
    isActive: {
      type: Boolean,
      default: true
    },
    orderBump: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product" // Reference to an optional order bump product
    },
    thankYouPage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ThankYouPage" // Optional reference to a thank you page
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index for faster queries
checkoutPageSchema.index({ 'linkedTo.kind': 1, 'linkedTo.item': 1 }, { unique: true });

// Virtual population (optional)
checkoutPageSchema.virtual('product', {
  ref: function() {
    return this.linkedTo.kind;
  },
  localField: 'linkedTo.item',
  foreignField: '_id',
  justOne: true
});

const CheckoutPage = mongoose.model("CheckoutPage", checkoutPageSchema);

module.exports = CheckoutPage;