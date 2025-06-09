const express = require("express");
const saleRoute = express.Router();

const {
  getSalesDetails,
  SaleCreateCashfreeOrder,
  SaleCreateRazorpayOrder,
  SaleVerifyCashfreeOrder,
  SaleVerifyRazorpayPayment,
  GetCheckoutPage,
  getThankyouPage
} = require("../Controller/SaleController");

saleRoute.get("/get-sales-page/:type/:id", getSalesDetails);
saleRoute.get("/get-checkout-page-details/:type/:id", GetCheckoutPage);
saleRoute.post("/salespage/create-cashfree-order", SaleCreateCashfreeOrder);
saleRoute.post("/salespage/verify-cashfree-payment", SaleVerifyCashfreeOrder);
saleRoute.post("/salespage/create-razorpay-order", SaleCreateRazorpayOrder);
saleRoute.post("/salespage/verify-razorpay-payment", SaleVerifyRazorpayPayment);
saleRoute.get("/get-thank-you-page/:type/:id", getThankyouPage)

module.exports = saleRoute;
