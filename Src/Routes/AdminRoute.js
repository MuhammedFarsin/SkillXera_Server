const express = require("express");
const adminRoute = express.Router();
const {videoUpload }= require("../Config/CloudinaryConfig")
const upload = require("../Config/multerConfig");
const {
  getCourse,
  createCourse,
  deleteCourse,
  getEditCourse,
  updateCourse,
  getModules,
  addModule,
  deleteModule,
  getEditModule,
  updateModule,
  getLectures,
  addLecture,
  deleteLecture,
  getEditLecture,
  EditLecture,
  getModuleLecture
} = require("../Controller/CourseController");
// const {
//   authenticateAccessToken,
//   authenticateRefreshToken,
// } = require("../Middleware/jwtAuth");

// Get all courses
adminRoute.get("/assets/get-courses", getCourse);
adminRoute.post("/assets/add-course", upload.array("images", 3), createCourse);
adminRoute.delete("/assets/delete-course/:Id", deleteCourse);
adminRoute.get("/assets/edit-course/:id", getEditCourse);
adminRoute.put(
  "/assets/update-course/:course",
  upload.array("images", 3),
  updateCourse
);
//Module
adminRoute.get("/assets/courses/get-modules/:courseId", getModules);
adminRoute.post("/assets/course/add-module/:courseId", addModule);
adminRoute.delete(
  "/assets/courses/delete-module/:courseId/:moduleId",
  deleteModule
);
adminRoute.get("/assets/course/edit-module/:courseId/:moduleId", getEditModule);
adminRoute.put("/assets/course/edit-module/:courseId/:moduleId", updateModule);
//Lecture
adminRoute.get("/assets/courses/get-lectures/:courseId/:moduleId", getLectures);
adminRoute.post('/assets/courses/add-lecture/:courseId/:moduleId', videoUpload.single('video'),addLecture );
adminRoute.delete("/assets/courses/delete-lecture/:courseId/:moduleId/:lectureId", deleteLecture)
adminRoute.get("/assets/courses/get-lecture/:courseId/:moduleId/:lectureId", getEditLecture)
adminRoute.put("/assets/courses/edit-lecture/:courseId/:moduleId/:lectureId",videoUpload.single("video") ,EditLecture)

adminRoute.get("/assets/courses/watch-lecture/:courseId/:moduleId/:lectureIndex", getModuleLecture)

module.exports = adminRoute;
