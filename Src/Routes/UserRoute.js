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
  setPassword,
  logout
} = require("../Controller/AuthController");
const { authenticateAccessToken, authenticateRefreshToken } = require("../Middleware/jwtAuth");
const { getUserCourses, userCourse, showCourses, getBuyCourseDetails } = require("../Controller/CourseController")
const { getCourseDetails, createCashfreeOrder, verifyCashfreeOrder, createRazorpayOrder, verifyRazorpayPayment } = require("../Controller/SaleController")
const userRoute = express.Router();

userRoute.post("/signin", signin);
userRoute.post("/signup", signup);
userRoute.post("/verify-otp", verifyOtp);
userRoute.post("/resend-otp", resendOtp);
userRoute.post("/verify-mail-forget-password", verifyMailForgetPassword);
userRoute.post("/verify-otp-forget-password", verifyOtpForgetPassword);
userRoute.post("/set-password",setPassword)
userRoute.post("/reset-password", authenticateAccessToken, resetPassword);

userRoute.post("/refresh-token", authenticateRefreshToken, refreshToken);

userRoute.get("/user-orders/:userId",authenticateAccessToken, getUserCourses)
userRoute.get("/learn/:courseId",authenticateAccessToken, userCourse)
userRoute.get("/explore/:userId", authenticateAccessToken, showCourses)
userRoute.get("/get-course-buy-details/:courseId", authenticateAccessToken, getBuyCourseDetails)
userRoute.get("/buy-course/course/:courseId", authenticateAccessToken, getCourseDetails);
userRoute.post("/create-cashfree-order",authenticateAccessToken, createCashfreeOrder);
userRoute.post("/verify-cashfree-payment",authenticateAccessToken, verifyCashfreeOrder);
userRoute.post("/create-razorpay-order" ,authenticateAccessToken ,createRazorpayOrder);
userRoute.post("/verify-razorpay-payment" ,authenticateAccessToken ,verifyRazorpayPayment);


userRoute.post("/logout", logout);

module.exports = userRoute;
