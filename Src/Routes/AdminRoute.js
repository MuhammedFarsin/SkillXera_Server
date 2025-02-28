const express = require("express");
const adminRoute = express.Router();
const uploadMiddleware = require("../Config/CloudinaryConfig")
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
  getModuleLecture,
} = require("../Controller/CourseController");

const {
  getContacts,
  addContact,
  deleteContact,
  addContactTag,
  getTags,
  addTag,
  deleteTag,
  getEditTag,
  editTag,
  removeContactTag,
  getRemovingTag,
  getEditContact,
  EditContact
} = require("../Controller/CrmController");

const { getPayments, deleteTransaction } = require("../Controller/SaleController")

// Get all courses...
adminRoute.get("/assets/get-courses", getCourse);
adminRoute.post("/assets/add-course", uploadMiddleware, createCourse);
adminRoute.delete("/assets/delete-course/:Id", deleteCourse);
adminRoute.get("/assets/edit-course/:id", getEditCourse);
adminRoute.put(
  "/assets/update-course/:course",
  uploadMiddleware,
  updateCourse
);

//Module...
adminRoute.get("/assets/courses/get-modules/:courseId", getModules);
adminRoute.post("/assets/course/add-module/:courseId", addModule);
adminRoute.delete(
  "/assets/courses/delete-module/:courseId/:moduleId",
  deleteModule
);
adminRoute.get("/assets/course/edit-module/:courseId/:moduleId", getEditModule);
adminRoute.put("/assets/course/edit-module/:courseId/:moduleId", updateModule);

//Lecture...
adminRoute.get("/assets/courses/get-lectures/:courseId/:moduleId", getLectures);
adminRoute.post(
  "/assets/courses/add-lecture/:courseId/:moduleId",
  uploadMiddleware,
  addLecture
);
adminRoute.delete(
  "/assets/courses/delete-lecture/:courseId/:moduleId/:lectureId",
  deleteLecture
);
adminRoute.get(
  "/assets/courses/get-lecture/:courseId/:moduleId/:lectureId",
  getEditLecture
);
adminRoute.put(
  "/assets/courses/edit-lecture/:courseId/:moduleId/:lectureId",
  uploadMiddleware,
  EditLecture
);

//View-Lectures...
adminRoute.get(
  "/assets/courses/watch-lecture/:courseId/:moduleId/:lectureIndex",
  getModuleLecture
);

//Contacts...
adminRoute.get("/crm/contact/get-contacts", getContacts);
adminRoute.post("/crm/contact/add-contact", addContact);
adminRoute.delete("/crm/contact/delete-contact", deleteContact);
adminRoute.post("/crm/contact/set-tag", addContactTag);
adminRoute.get("/crm/contact/:id", getRemovingTag);
adminRoute.delete("/crm/contact/remove-tag", removeContactTag);
adminRoute.get("/crm/contact/get-contact/:contactId", getEditContact)
adminRoute.put("/crm/contact/update-contact/:contactId", EditContact)

//Tags...
adminRoute.get("/crm/tag/get-tags", getTags);
adminRoute.post("/crm/tag/add-tag", addTag);
adminRoute.get("/crm/tag/get-edit-tag/:tagId", getEditTag);
adminRoute.put("/crm/tag/edit-tag/:tagId", editTag);
adminRoute.delete("/crm/tag/delete-tag/:tagId", deleteTag);

//transaction
adminRoute.get("/payments", getPayments)
adminRoute.delete("/sales/transaction/delete-transaction", deleteTransaction)

module.exports = adminRoute;
