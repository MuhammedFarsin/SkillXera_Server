const Course = require("../Model/CourseModel");
const Purchase = require("../Model/PurchaseModal")
const User = require("../Model/UserModel")
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { cloudinary } = require("../Config/CloudinaryConfig");

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
    const { title, description, route, buyCourse, price } = req.body;
    
    console.log("Uploaded Files:", req.files);

    if (!title || !description || !route || !buyCourse || !price || !req.files || !req.files.images || !req.files.video) {
      return res.status(400).json({ message: "All fields, at least 3 images, and a video are required" });
    }

    // Store image and video paths
    const imagePaths = req.files.images.map((file) => `/uploads/${file.filename}`);
    const videoPath = `/videos/${req.files.video[0].filename}`; // Get first video file

    console.log("Image Paths:", imagePaths);
    console.log("Video Path:", videoPath);

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
      buyCourse,
      price,
      images: imagePaths,
      video: videoPath,
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
  console.log('this is calling');

  try {
    const { course } = req.params;
    const { title, route, buyCourse, price, description, existingImages, existingVideos } = req.body;

    // Ensure files exist before accessing them
    const imageFiles = req.files?.images || []; 
    const videoFiles = req.files?.video || []; 

    if (!title || !route || !buyCourse || !price || !description) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    const existingCourse = await Course.findById(course);
    if (!existingCourse) {
      return res.status(404).json({ message: "Course not found!" });
    }

    // Parse existing images and videos from request (if sent as JSON string)
    let parsedExistingImages = existingImages ? JSON.parse(existingImages) : existingCourse.images || [];
    let parsedExistingVideos = existingVideos ? JSON.parse(existingVideos) : existingCourse.video || "";

    // Fix: Append new images instead of replacing
    const newImagePaths = [
      ...parsedExistingImages, 
      ...imageFiles.map((file) => `/uploads/${file.filename}`)
    ];

    let newVideoPath = parsedExistingVideos;
    if (videoFiles.length > 0) {
      newVideoPath = `/videos/${videoFiles[0].filename}`;
    }

    // Update the course
    const updatedCourse = await Course.findByIdAndUpdate(
      course,
      { title, route, buyCourse, price, description, images: newImagePaths, video: newVideoPath },
      { new: true }
    );

    res.status(200).json({ message: "Course updated successfully!", course: updatedCourse });
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

    return res.status(200).json({
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

const getLectures = async (req, res) => {
  try {
    const { courseId, moduleId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    const module = course.modules.id(moduleId);
    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }
    res.status(200).json({
      message: "Lectures retrieved successfully",
      lectures: module.lectures,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const addLecture = async (req, res) => {
  try {
    const { courseId, moduleId } = req.params;
    const { title, description, duration } = req.body;
    if (!req.files.video) {
      return res.status(400).json({ message: "Video file is required" });
    }

    const videoPath = `/videos/${req.files.video[0].filename}`;; // Relative path for frontend usage

    // Find the course and module
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const module = course.modules.id(moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    // Create new lecture entry
    const newLecture = {
      _id: new mongoose.Types.ObjectId(),
      title,
      description,
      videoUrl: videoPath,
      duration: Number(duration),
      createdAt: new Date(),
    };

    module.lectures.push(newLecture);
    await course.save();

    res.status(201).json({
      message: "Lecture added successfully",
      lecture: newLecture,
    });
  } catch (error) {
    console.error("❌ Error adding lecture:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


const deleteLecture = async (req, res) => {
  try {
    const { courseId, moduleId, lectureId } = req.params;

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Find the module inside the course
    const module = course.modules.id(moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    // Find the lecture inside the module
    const lectureIndex = module.lectures.findIndex(
      (lecture) => lecture._id.toString() === lectureId
    );

    if (lectureIndex === -1) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    // Get video file path before deleting lecture
    const videoPath = module.lectures[lectureIndex].videoUrl; // Assuming `videoUrl` stores the file path
    // Remove the lecture from the module
    module.lectures.splice(lectureIndex, 1);

    // Save the updated course
    await course.save();

    // Delete the video file from local storage
    if (videoPath) {
      const absolutePath = path.join(__dirname, "../../public", videoPath); // Adjust based on your storage directory

      fs.unlink(absolutePath, (err) => {
        if (err) {
          console.error("Failed to delete video file:", err);
        } else {
          console.log("Video file deleted successfully");
        }
      });
    }

    res.status(200).json({ message: "Lecture and video file deleted successfully" });
  } catch (error) {
    console.error("Error deleting lecture:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


const getEditLecture = async (req, res) => {
  try {
    const { courseId, moduleId, lectureId } = req.params;
    
    // Find the course
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Find the module inside the course
    const module = course.modules.id(moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    // Find the lecture inside the module
    const lecture = module.lectures.id(lectureId);
    if (!lecture) return res.status(404).json({ message: "Lecture not found" });

    // Return the lecture data
    res.status(200).json(lecture);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const EditLecture = async (req, res) => {
  try {
    const { courseId, moduleId, lectureId } = req.params;
    const { title, description, duration } = req.body;

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Find the module inside the course
    const module = course.modules.id(moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    // Find the lecture inside the module
    const lecture = module.lectures.id(lectureId);
    if (!lecture) return res.status(404).json({ message: "Lecture not found" });

    // Update lecture fields
    if (title) lecture.title = title;
    if (description) lecture.description = description;
    if (duration) lecture.duration = Number(duration); // Ensure it's a number

    // If a new video is uploaded, delete the old one and update the path
    if (req.files.video) {
      if (lecture.videoUrl) {
        const oldVideoPath = path.join(__dirname, "..", "public", "videos", lecture.videoUrl);
        if (fs.existsSync(oldVideoPath)) {
          fs.unlinkSync(oldVideoPath); // Delete old video
        }
      }
      lecture.videoUrl = `/videos/${req.files.video[0].filename}`; // Store relative path for frontend usage
    }

    await course.save(); // Save the updated course document

    res.status(200).json({
      message: "Lecture updated successfully",
      lecture,
      moduleId,
    });
  } catch (error) {
    console.error("❌ Edit Lecture Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = EditLecture;

const getModuleLecture = async (req, res) => {
  try {
    const { courseId, moduleId, lectureIndex } = req.params;

    // Find the course
    const course = await Course.findById(courseId);
    if (!course || !course.modules || course.modules.length === 0) {
      return res.status(404).json({ message: "Course or modules not found" });
    }

    // Find the module
    const module = course.modules.find(mod => mod._id.toString() === moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    // Validate lectureIndex
    const index = parseInt(lectureIndex);
    if (isNaN(index) || index < 0 || index >= module.lectures.length) {
      return res.status(400).json({ message: "Invalid lecture index" });
    }

    // Get the requested lecture
    const lecture = module.lectures[index];
    if (!lecture) return res.status(404).json({ message: "Lecture not found" });

    // Return the entire module's lectures along with the current lecture index
    res.status(200).json({ lectures: module.lectures, currentIndex: index });

  } catch (error) {
    console.error("Get Lecture Video Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getUserCourse = async ( req, res ) => {
  try {
    const { userId } = req.params;

    // Find the user and get their latest order ID
    const user = await User.findById(userId);
    if (!user || !user.orders.length) {
      return res.status(404).json({ message: "No orders found for this user" });
    }

    const latestOrderId = user.orders[user.orders.length - 1]; // Get the latest order

    // Find the payment record using the order ID
    const payment = await Purchase.findOne({ cashfree_order_id: latestOrderId, status: "Success" });
    if (!payment) {
      return res.status(404).json({ message: "No successful payment found for this order" });
    }

    // Find the course details using the course ID from the payment record
    const course = await Course.findById(payment.courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json({ course });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user course details", error });
  }
}

const userCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!courseId) {
      return res.status(400).json({ message: "CourseId not found..!" });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found...!" });
    }

    return res.status(200).json({ course });

  } catch (error) {
    console.error("Error fetching course:", error);
    return res.status(500).json({ message: "Internal Server Error" });
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
  updateModule,
  getLectures,
  addLecture,
  deleteLecture,
  getEditLecture,
  EditLecture,
  getModuleLecture,
  getUserCourse,
  userCourse
};
