const Course = require("../Model/CourseModel")


const getCourse = async (req, res) => {
    try {
        const courses = await Course.find()
        res.json(courses)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}
const createCourse = async (req, res) => {
  try {
    const { title, description, route, price } = req.body;

    if (!title || !description || !route || !price || !req.files || req.files.length < 3) {
      return res.status(400).json({ message: "All fields and 3 images are required" });
    }

    // Get file paths of uploaded images
    const imagePaths = req.files.map(file => file.path);

    // Check if the course already exists
    const existingCourse = await Course.findOne({ title });
    if (existingCourse) {
      return res.status(400).json({ message: "Course already exists" });
    }

    // Create and save the course
    const newCourse = new Course({
      title,
      description,
      route,
      price,
      images: imagePaths, // Store array of image paths
    });

    const course = await newCourse.save();
    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
    getCourse,
    createCourse
}