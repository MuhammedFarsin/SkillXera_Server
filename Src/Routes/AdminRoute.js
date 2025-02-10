const express = require("express");
const adminRoute = express.Router();
const upload = require("../Config/multerConfig")
const { getCourse, createCourse, deleteCourse, getEditCourse, updateCourse, getModules, addModule, deleteModule, getEditModule, updateModule } = require("../Controller/CourseController");
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
adminRoute.get("/assets/courses/get-modules/:courseId",getModules)
adminRoute.post("/assets/course/add-module/:courseId",addModule)
adminRoute.delete("/assets/courses/delete-module/:courseId/:moduleId",deleteModule)
adminRoute.get("/assets/course/edit-module/:courseId/:moduleId",getEditModule)
adminRoute.put("/assets/course/edit-module/:courseId/:moduleId",updateModule)

module.exports = adminRoute