const express = require("express")
const saleRoute = express.Router()

const { getCourseDetails } = require("../Controller/SaleController")

saleRoute.get("/buy-course/course/:courseId", getCourseDetails)

module.exports = saleRoute