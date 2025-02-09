const express = require("express");
const adminRoute = express.Router();
const upload = require("../Config/multerConfig")
const { getCourse, createCourse, deleteCourse, getEditCourse, updateCourse } = require("../Controller/CourseController");
// const {
//   authenticateAccessToken,
//   authenticateRefreshToken,
// } = require("../Middleware/jwtAuth");

// Get all courses
adminRoute.get("/assets/get-courses", getCourse);
adminRoute.post('/assets/add-course', upload.array('images', 3), createCourse);
adminRoute.delete('/assets/delete-course/:Id',deleteCourse)
adminRoute.get("/assets/edit-course/:id", getEditCourse)
adminRoute.put("/assets/update-course/:course",upload.array("images", 3),  updateCourse)

module.exports = adminRoute