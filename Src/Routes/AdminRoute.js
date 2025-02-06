const express = require("express");
const adminRoute = express.Router();
const upload = require("../Config/multerConfig")
const { getCourse, createCourse } = require("../Controller/CourseController");
const {
  authenticateAccessToken,
  authenticateRefreshToken,
} = require("../Middleware/jwtAuth");

// Get all courses
adminRoute.get("/assets/get-courses", getCourse);
adminRoute.post('/assets/add-course', upload.array('images', 3), createCourse);

module.exports = adminRoute