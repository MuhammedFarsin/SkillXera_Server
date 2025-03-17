const express = require("express");
const saleRoute = express.Router();

const { getCourseDetails,SaleCreateCashfreeOrder, SaleCreateRazorpayOrder, SaleVerifyCashfreeOrder,SaleVerifyRazorpayPayment  } = require("../Controller/SaleController");

saleRoute.get("/buy-course/course/:courseId", getCourseDetails);
saleRoute.post("/salespage/create-cashfree-order", SaleCreateCashfreeOrder);
saleRoute.post("/salespage/verify-cashfree-payment", SaleVerifyCashfreeOrder);
saleRoute.post("/salespage/create-razorpay-order", SaleCreateRazorpayOrder);
saleRoute.post("/salespage/verify-razorpay-payment", SaleVerifyRazorpayPayment);

module.exports = saleRoute;
