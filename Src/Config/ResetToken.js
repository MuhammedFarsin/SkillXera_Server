const crypto = require("crypto");
const User = require("../Model/UserModel");

// Generate and store a hashed reset token
const generateResetToken = async (user) => {
  if (user.passwordResetToken && user.passwordResetExpires > Date.now()) {
    console.log("Reusing existing valid reset token.");
    return null; 
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  console.log("Generated Token:", resetToken);
  console.log("Hashed Token for DB:", hashedToken);

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = Date.now() + 15 * 60 * 1000; 

  await user.save();
  return resetToken;
};


// Verify token by comparing hashed versions
const verifyResetToken = async (email, token) => {
  const user = await User.findOne({ email });

  if (!user || !user.passwordResetToken || user.passwordResetExpires < Date.now()) {
    throw new Error("Invalid or expired reset token.");
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  if (hashedToken !== user.passwordResetToken) {
    throw new Error("Invalid reset token.");
  }

  return user;
};

module.exports = { generateResetToken, verifyResetToken };
