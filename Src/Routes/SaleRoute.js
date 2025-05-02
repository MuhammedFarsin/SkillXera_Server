const express = require("express");
const saleRoute = express.Router();

const {
  getCourseDetails,
  SaleCreateCashfreeOrder,
  SaleCreateRazorpayOrder,
  SaleVerifyCashfreeOrder,
  SaleVerifyRazorpayPayment,
  GetCheckoutPage,
} = require("../Controller/SaleController");

saleRoute.get("/get-sales-page/course/:courseId", getCourseDetails);
saleRoute.get("/buy-course/course/:courseId", GetCheckoutPage);
saleRoute.post("/salespage/create-cashfree-order", SaleCreateCashfreeOrder);
saleRoute.post("/salespage/verify-cashfree-payment", SaleVerifyCashfreeOrder);
saleRoute.post("/salespage/create-razorpay-order", SaleCreateRazorpayOrder);
saleRoute.post("/salespage/verify-razorpay-payment", SaleVerifyRazorpayPayment);

module.exports = saleRoute;
