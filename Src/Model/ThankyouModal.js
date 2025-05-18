const mongoose = require("mongoose");

const thankYouPageSchema = new mongoose.Schema(
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
        refPath: "linkedTo.kind"
      }
    },
    title: {
      type: String,
      required: true
    },
    embedCode: {
      type: String,
      required: true
    },
    note: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Ensure one thank-you page per linked item
thankYouPageSchema.index({ "linkedTo.kind": 1, "linkedTo.item": 1 }, { unique: true });

// Virtual population for the linked item
thankYouPageSchema.virtual("product", {
  ref: function () {
    return this.linkedTo.kind;
  },
  localField: "linkedTo.item",
  foreignField: "_id",
  justOne: true
});

const ThankYouPage = mongoose.model("ThankYouPage", thankYouPageSchema);

module.exports = ThankYouPage;
