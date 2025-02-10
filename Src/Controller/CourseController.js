const Course = require("../Model/CourseModel");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const getCourse = async (req, res) => {
  try {
    const courses = await Course.find();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const createCourse = async (req, res) => {
  try {
    const { title, description, route, price } = req.body;

    if (
      !title ||
      !description ||
      !route ||
      !price ||
      !req.files ||
      req.files.length < 3
    ) {
      return res
        .status(400)
        .json({ message: "All fields and at least 3 images are required" });
    }

    // Store only relative paths in MongoDB (avoiding absolute paths)
    const imagePaths = req.files.map((file) => `/uploads/${file.filename}`);

    // Check if the course already exists
    const existingCourse = await Course.findOne({ title });
    if (existingCourse) {
      return res.status(400).json({ message: "Course already exists" });
    }

    // Create and save the new course
    const newCourse = new Course({
      title,
      description,
      route,
      price,
      images: imagePaths,
    });

    const course = await newCourse.save();

    res.status(201).json({ message: "Course saved successfully", course });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const courseId = req.params.Id;
    const course = await Course.findByIdAndDelete(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json({ message: "Course deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getEditCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: "Internal server Error..." });
  }
};

const updateCourse = async (req, res) => {
  try {
    const { course } = req.params;
    const { title, route, price, description, existingImages } = req.body;
    const imageFiles = req.files;

    if (!title || !route || !price || !description) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    const existingCourse = await Course.findById(course);
    if (!existingCourse) {
      return res.status(404).json({ message: "Course not found!" });
    }

    let parsedExistingImages = [];
    if (existingImages) {
      try {
        parsedExistingImages = JSON.parse(existingImages);
      } catch (error) {
        console.error("Error parsing existingImages:", error);
      }
    }

    const newImagePaths = imageFiles.map((file) => `/uploads/${file.filename}`);

    const updatedImages = [...parsedExistingImages, ...newImagePaths];

    const updatedCourse = await Course.findByIdAndUpdate(
      course,
      { title, route, price, description, images: updatedImages },
      { new: true }
    );

    res
      .status(200)
      .json({ message: "Course updated successfully!", course: updatedCourse });
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getModules = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId).select("modules");
    if (!course) return res.status(404).json({ message: "Course not found" });

    res.status(200).json({
      message: "Modules retrieved successfully",
      modules: course.modules,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const addModule = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Module title is required" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const newModule = {
      _id: new mongoose.Types.ObjectId(),
      title,
      lectures: [],
      createdAt: new Date(),
    };

    course.modules.push(newModule);
    await course.save();
    res
      .status(201)
      .json({ message: "Module added successfully", module: newModule });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteModule = async (req, res) => {
  try {
    const { courseId, moduleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Course ID" });
    }
    if (!mongoose.Types.ObjectId.isValid(moduleId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Module ID" });
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      { $pull: { modules: { _id: new mongoose.Types.ObjectId(moduleId) } } }, // Ensure moduleId is ObjectId
      { new: true }
    );

    if (!updatedCourse) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    return res
      .status(200)
      .json({
        success: true,
        message: "Module deleted successfully",
        updatedCourse,
      });
  } catch (error) {
    console.error("Error deleting module:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getEditModule = async (req, res) => {
  try {
    const { courseId, moduleId } = req.params;

    // Find the course by ID and return only the required module
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Find the module inside the course
    const module = course.modules.id(moduleId);

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    res.status(200).json({ message: "Module retrieved successfully", module });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const updateModule = async (req, res) => {
  try {
    const { courseId, moduleId } = req.params;
    const { title } = req.body;

    // Find the course by ID
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Find the module inside the course
    const module = course.modules.id(moduleId);

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Update module title
    module.title = title;

    // Save the updated course
    await course.save();

    res.status(200).json({ message: "Module updated successfully", module });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  getCourse,
  createCourse,
  deleteCourse,
  getEditCourse,
  updateCourse,
  getModules,
  addModule,
  deleteModule,
  getEditModule,
  updateModule
};
