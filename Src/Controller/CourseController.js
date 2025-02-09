const Course = require("../Model/CourseModel");
const path = require("path")
const fs = require("fs")

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

    // Validate input fields
    if (!title || !description || !route || !price || !req.files || req.files.length < 3) {
      return res.status(400).json({ message: "All fields and at least 3 images are required" });
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


    res.status(201).json({ message: 'Course saved successfully',course});
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
}

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

    res.status(200).json({ message: "Course updated successfully!", course: updatedCourse });
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


module.exports = {
  getCourse,
  createCourse,
  deleteCourse,
  getEditCourse,
  updateCourse
};
