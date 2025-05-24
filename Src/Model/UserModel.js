const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: Number, required: true, min: 1000000000, max: 999999999999 },
    password: { type: String, required: false },
    refreshToken: { type: String },
    isAdmin: { type: Boolean, default: false },
    enrolledCourses: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Course",
      default: [],
    },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
