const mongoose = require("mongoose");

const SectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  videos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Section", SectionSchema);
