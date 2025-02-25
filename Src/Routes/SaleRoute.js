const express = require("express");
const saleRoute = express.Router();

const { getCourseDetails, createCashfreeOrder, verifyCashfreeOrder } = require("../Controller/SaleController");

saleRoute.get("/buy-course/course/:courseId", getCourseDetails);
saleRoute.post("/create-cashfree-order", createCashfreeOrder);
saleRoute.post("/verify-cashfree-payment", verifyCashfreeOrder);

module.exports = saleRoute;
