const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: Number, required: true },
    password: { type: String, required: false },
    refreshToken: { type: String },
    isAdmin: { type: Boolean, default: false },
    orders: [{ type: String }],// Store order IDs
    passwordResetToken: { type: String, select: false }, // Add this
  passwordResetExpires: { type: Date, select: false }, // Add this
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
