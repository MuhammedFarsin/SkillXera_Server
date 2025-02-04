const express = require("express");
const {
  signin,
  signup,
  verifyOtp,
  resendOtp,
  verifyMailForgetPassword,
  verifyOtpForgetPassword,
  resetPassword,
  refreshToken,
  logout
} = require("../Controller/AuthController");
const { authenticateAccessToken, authenticateRefreshToken } = require("../Middleware/jwtAuth");
const userRoute = express.Router();

userRoute.post("/signin", signin);
userRoute.post("/signup", signup);
userRoute.post("/verify-otp", verifyOtp);
userRoute.post("/resend-otp", resendOtp);
userRoute.post("/verify-mail-forget-password", verifyMailForgetPassword);
userRoute.post("/verify-otp-forget-password", verifyOtpForgetPassword);

userRoute.post("/reset-password", authenticateAccessToken, resetPassword);

userRoute.post("/refresh-token", authenticateRefreshToken, refreshToken);
userRoute.post("/logout", logout);

module.exports = userRoute;
