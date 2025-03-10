const mongoose = require("mongoose");

const lectureSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  videoUrl: { type: String, required: true },
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
