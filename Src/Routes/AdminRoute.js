const express = require("express");
const adminRoute = express.Router();
const { authenticateAccessToken, isAdmin } = require("../Middleware/jwtAuth")
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
  EditContact,
  getContactsDetails
} = require("../Controller/CrmController");

const { getPayments, deleteTransaction, resendAccessCouseLink, dashboard } = require("../Controller/SaleController")


// Dashboard
adminRoute.get("/sales-data", dashboard)
// Get all courses...
adminRoute.get("/assets/get-courses", authenticateAccessToken,isAdmin, getCourse);
adminRoute.post("/assets/add-course", authenticateAccessToken,isAdmin,uploadMiddleware, createCourse);
adminRoute.delete("/assets/delete-course/:Id",authenticateAccessToken,isAdmin, deleteCourse);
adminRoute.get("/assets/edit-course/:courseId",authenticateAccessToken,isAdmin, getEditCourse);
adminRoute.put(
  "/assets/update-course/:courseId",
  authenticateAccessToken,isAdmin,
  uploadMiddleware,
  updateCourse
);

//Module...
adminRoute.get("/assets/courses/get-modules/:courseId",authenticateAccessToken,isAdmin, getModules);
adminRoute.post("/assets/course/add-module/:courseId",authenticateAccessToken,isAdmin, addModule);
adminRoute.delete(
  "/assets/courses/delete-module/:courseId/:moduleId",
  authenticateAccessToken,isAdmin,
  deleteModule
);
adminRoute.get("/assets/course/edit-module/:courseId/:moduleId",authenticateAccessToken,isAdmin, getEditModule);
adminRoute.put("/assets/course/edit-module/:courseId/:moduleId",authenticateAccessToken,isAdmin, updateModule);

//Lecture...
adminRoute.get("/assets/courses/get-lectures/:courseId/:moduleId",authenticateAccessToken,isAdmin, getLectures);
adminRoute.post(
  "/assets/courses/add-lecture/:courseId/:moduleId",
  authenticateAccessToken,isAdmin,
  uploadMiddleware,
  addLecture
);
adminRoute.delete(
  "/assets/courses/delete-lecture/:courseId/:moduleId/:lectureId",
  authenticateAccessToken,isAdmin,
  deleteLecture
);
adminRoute.get(
  "/assets/courses/get-lecture/:courseId/:moduleId/:lectureId",
  authenticateAccessToken,isAdmin,
  getEditLecture
);
adminRoute.put(
  "/assets/courses/edit-lecture/:courseId/:moduleId/:lectureId",
  authenticateAccessToken,isAdmin,
  uploadMiddleware,
  EditLecture
);

//View-Lectures...
adminRoute.get(
  "/assets/courses/watch-lecture/:courseId/:moduleId/:lectureIndex",
  authenticateAccessToken,isAdmin,
  getModuleLecture
);

//Contacts...
adminRoute.get("/crm/contact/get-contacts",authenticateAccessToken,isAdmin, getContacts);
adminRoute.get("/get-contacts-details/:id",authenticateAccessToken,isAdmin, getContactsDetails);
adminRoute.post("/crm/contact/add-contact",authenticateAccessToken,isAdmin, addContact);
adminRoute.delete("/crm/contact/delete-contact",authenticateAccessToken,isAdmin, deleteContact);
adminRoute.post("/crm/contact/set-tag",authenticateAccessToken,isAdmin, addContactTag);
adminRoute.get("/crm/contact/:id",authenticateAccessToken,isAdmin, getRemovingTag);
adminRoute.delete("/crm/contact/remove-tag",authenticateAccessToken,isAdmin, removeContactTag);
adminRoute.get("/crm/contact/get-contact/:contactId",authenticateAccessToken,isAdmin, getEditContact)
adminRoute.put("/crm/contact/update-contact/:contactId",authenticateAccessToken,isAdmin, EditContact)

//Tags...
adminRoute.get("/crm/tag/get-tags",authenticateAccessToken,isAdmin, getTags);
adminRoute.post("/crm/tag/add-tag",authenticateAccessToken,isAdmin, addTag);
adminRoute.get("/crm/tag/get-edit-tag/:tagId",authenticateAccessToken,isAdmin, getEditTag);
adminRoute.put("/crm/tag/edit-tag/:tagId",authenticateAccessToken,isAdmin, editTag);
adminRoute.delete("/crm/tag/delete-tag/:tagId",authenticateAccessToken,isAdmin, deleteTag);

//transaction
adminRoute.get("/payments",authenticateAccessToken,isAdmin, getPayments)
adminRoute.delete("/sales/transaction/delete-transaction",authenticateAccessToken,isAdmin, deleteTransaction)
adminRoute.post("/sales/transaction/resend-transaction-mail",authenticateAccessToken,isAdmin, resendAccessCouseLink)

module.exports = adminRoute;
