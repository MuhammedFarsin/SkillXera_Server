const mongoose = require("mongoose");

const checkoutPageSchema = new mongoose.Schema(
  {
    linkedTo: {
      kind: {
        type: String,
        enum: ["course", "digital-product"],
        required: true,
      },
      item: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "linkedTo.kind",
      },
    },
    topHeading: {
      type: String,
      required: true,
      trim: true,
    },
    subHeading: {
      type: String,
      required: true,
      trim: true,
    },
    checkoutImage: {
      type: String,
      required: true,
    },
    lines: [
      {
        type: String,
        required: true,
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
    orderBumps: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "OrderBump",
      },
    ],

    thankYouPage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ThankYouPage",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

checkoutPageSchema.index(
  { "linkedTo.kind": 1, "linkedTo.item": 1 },
  { unique: true }
);

checkoutPageSchema.virtual("product", {
  ref: function () {
    return this.linkedTo.kind;
  },
  localField: "linkedTo.item",
  foreignField: "_id",
  justOne: true,
});

const CheckoutPage = mongoose.model("CheckoutPage", checkoutPageSchema);

module.exports = CheckoutPage;
