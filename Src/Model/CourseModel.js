const mongoose = require("mongoose");

const lectureSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  // For uploaded videos
  videoUrl: { type: String },
  // For embedded videos
  embedCode: { type: String },
  // To track content type
  contentType: { 
    type: String, 
    required: true,
    enum: ['file', 'embed'], 
    default: 'file' 
  },
  resources: [{ type: String }],
  duration: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

const moduleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  lectures: [lectureSchema],
  createdAt: { type: Date, default: Date.now },
});

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  images: { type: [String], required: true },
  route : { type: String, required: true },
  buyCourse : { type: String, required: true },
  regularPrice: { type: Number, default: 0 },
  salesPrice: { type: Number, default: 0 },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  modules: [moduleSchema],
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  createdAt: { type: Date, default: Date.now },
});

const Course = mongoose.model("Course", courseSchema);
module.exports = Course;
