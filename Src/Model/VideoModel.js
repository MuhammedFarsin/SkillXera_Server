const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Video", VideoSchema);
