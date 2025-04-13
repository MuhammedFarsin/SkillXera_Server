const mongoose = require("mongoose");

const salesPageSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },

  lines: {
    type: [String],
    required: true,
    validate: [(val) => val.length > 0, 'At least one line is required'],
  },

  ctaText: { type: String, required: true },
  ctaHighlight: { type: String },

  mainImage: {
    type: String,
    required: true,
  },
  bonusImages: [{ type: String }],

  // New field for the embedded video HTML code
  embedCode: {
    type: String,
    required: false,  // It's optional, so you can omit this field if not needed
  }
});

const SalesPage = mongoose.model("SalesPage", salesPageSchema);

module.exports = SalesPage;
