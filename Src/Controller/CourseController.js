const Course = require("../Model/CourseModel");
const Purchase = require("../Model/PurchaseModal");
const User = require("../Model/UserModel");
const SalesPage = require("../Model/SalesModal");
const CheckoutPage = require("../Model/CheckoutModal");
const DigitalProduct = require("../Model/DigitalProductModal");
const ThankYouPage = require("../Model/ThankyouModal");
const OrderBump = require("../Model/OrderBumbModel");

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
    const { title, description, route, buyCourse, regularPrice, salesPrice } =
      req.body;

    if (
      !title ||
      !description ||
      !route ||
      !buyCourse ||
      !regularPrice ||
      !salesPrice ||
      !req.files ||
      !req.files.images
    ) {
      return res.status(400).json({
        message: "All fields, at least 3 images, and a video are required",
      });
    }

    const imagePaths = req.files.images.map(
      (file) => `/uploads/${file.filename}`
    );

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
      regularPrice,
      salesPrice,
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
    const courseId = req.params.courseId;
    console.log(courseId);
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: "Internal server Error..." });
  }
};

const updateCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const {
      title,
      route,
      buyCourse,
      regularPrice,
      salesPrice,
      description,
      existingImages,
    } = req.body;

    // Ensure files exist before accessing them
    const imageFiles = req.files?.images || [];

    if (
      !title ||
      !route ||
      !buyCourse ||
      !regularPrice ||
      !salesPrice ||
      !description
    ) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    const existingCourse = await Course.findById(courseId);
    if (!existingCourse) {
      return res.status(404).json({ message: "Course not found!" });
    }

    // Parse existing images and videos from request (if sent as JSON string)
    let parsedExistingImages = existingImages
      ? JSON.parse(existingImages)
      : existingCourse.images || [];

    // Fix: Append new images instead of replacing
    const newImagePaths = [
      ...parsedExistingImages,
      ...imageFiles.map((file) => `/uploads/${file.filename}`),
    ];

    // Update the course
    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      {
        title,
        route,
        buyCourse,
        regularPrice,
        salesPrice,
        description,
        images: newImagePaths,
      },
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
    const { title, description, duration, contentType, embedCode } = req.body;

    // Validate required fields
    if (!title || !duration) {
      return res
        .status(400)
        .json({ message: "Title and duration are required" });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const module = course.modules.id(moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    // Create new lecture object
    const newLecture = {
      _id: new mongoose.Types.ObjectId(),
      title,
      description,
      duration: Number(duration),
      contentType,
      createdAt: new Date(),
    };

    // Handle file upload or embed code
    if (contentType === "file") {
      if (!req.files?.video) {
        return res
          .status(400)
          .json({ message: "Video file is required for file upload" });
      }
      newLecture.videoUrl = `/videos/${req.files.video[0].filename}`;
    } else if (contentType === "embed") {
      if (!embedCode) {
        return res
          .status(400)
          .json({ message: "Embed code is required for embedded content" });
      }
      newLecture.embedCode = embedCode;
    } else {
      return res.status(400).json({ message: "Invalid content type" });
    }

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

    res
      .status(200)
      .json({ message: "Lecture and video file deleted successfully" });
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

    res.status(200).json(lecture);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const EditLecture = async (req, res) => {
  try {
    const { courseId, moduleId, lectureId } = req.params;
    const { title, description, duration } = req.body;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const module = course.modules.id(moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    const lecture = module.lectures.id(lectureId);
    if (!lecture) return res.status(404).json({ message: "Lecture not found" });

    if (title) lecture.title = title;
    if (description) lecture.description = description;
    if (duration) lecture.duration = Number(duration);

    if (req.files && req.files.video) {
      if (lecture.videoUrl) {
        const oldVideoPath = path.join(
          __dirname,
          "..",
          "public",
          "video",
          lecture.videoUrl
        );
        console.log(oldVideoPath);
        if (fs.existsSync(oldVideoPath)) {
          fs.unlinkSync(oldVideoPath);
        }
      }
      lecture.videoUrl = `/videos/${req.files.video[0].filename}`;
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

const getModuleLecture = async (req, res) => {
  try {
    const { courseId, moduleId, lectureIndex } = req.params;

    // Find the course
    const course = await Course.findById(courseId);
    if (!course || !course.modules || course.modules.length === 0) {
      return res.status(404).json({ message: "Course or modules not found" });
    }

    // Find the module
    const module = course.modules.find(
      (mod) => mod._id.toString() === moduleId
    );
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

const getUserCourses = async (req, res) => {
  try {
    const { userId } = req.params;
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found");
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.orders.length) {
      return res
        .status(404)
        .json({ message: "You haven’t purchased any courses yet." });
    }

    // Find successful purchases
    const payments = await Purchase.find({
      orderId: { $in: user.orders },
      status: "Success",
    });

    if (!payments.length) {
      return res
        .status(404)
        .json({ message: "No successful purchases found." });
    }

    const courses = payments.map((payment) => ({
      orderId: payment.orderId,
      course: {
        ...payment.courseSnapshot,
        images: payment.courseSnapshot?.images || [], // Ensure images is always an array
        modules: payment.courseSnapshot?.modules || [], // Ensure modules is always an array
      },
      purchaseDate: payment.createdAt,
    }));

    return res.status(200).json({ courses });
  } catch (error) {
    console.error("Error fetching user courses:", error);
    res.status(500).json({ message: "Error fetching user courses", error });
  }
};

const userCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user || !user.orders || user.orders.length === 0) {
      return res
        .status(403)
        .json({ message: "No purchase found for this user" });
    }

    const purchase = await Purchase.findOne({ orderId: { $in: user.orders } });

    if (!purchase || !purchase.courseSnapshot) {
      return res.status(403).json({ message: "No valid purchase found" });
    }

    if (purchase.courseSnapshot.courseId.toString() !== courseId) {
      return res
        .status(403)
        .json({ message: "You have not purchased this course." });
    }

    res.status(200).json(purchase.courseSnapshot);
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const showCourses = async (req, res) => {
  try {
    const { userId } = req.params; // Assuming user ID is available from auth middleware
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch all purchased course IDs from user's orders
    const userOrders = await Purchase.find({
      orderId: { $in: user.orders },
      status: "Success",
    });
    const purchasedCourseIds = userOrders.map((order) =>
      order.courseId.toString()
    );

    // Fetch all courses that the user has NOT purchased
    const courses = await Course.find({ _id: { $nin: purchasedCourseIds } });

    if (!courses || courses.length === 0) {
      return res.status(200).json({ message: "No new courses available" });
    }

    res.status(200).json({ courses });
  } catch (error) {
    console.error("Error fetching courses:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
const getBuyCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!courseId) {
      res.status(400).json({ message: "CourseId not Found...!" });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      res.status(401).json({ message: "Course did not found...!" });
    }

    res.status(200).json({ course });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const createSalesPage = async (req, res) => {
  try {
    const { type, id } = req.params;

    // Validate required fields
    const requiredFields = [
      "lines",
      "smallBoxContent",
      "buttonContent",
      "checkBoxHeading",
      "FirstCheckBox",
      "secondCheckBoxHeading",
      "SecondCheckBox",
      "Topic",
      "ThirdSectionSubHeading",
    ];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    if (!req.files?.mainImage) {
      return res.status(400).json({ message: "Main image is required" });
    }

    // Process main image
    const mainImage = req.files.mainImage[0].filename;

    // Process bonus images
    const bonusImages = [];
    if (req.files.bonusImages) {
      const bonusTitles = Array.isArray(req.body.bonusTitles)
        ? req.body.bonusTitles
        : JSON.parse(req.body.bonusTitles || "[]");

      const bonusPrices = Array.isArray(req.body.bonusPrices)
        ? req.body.bonusPrices
        : JSON.parse(req.body.bonusPrices || "[]");

      req.files.bonusImages.forEach((file, index) => {
        bonusImages.push({
          image: file.filename,
          title: bonusTitles[index] || `Bonus ${index + 1}`,
          price: bonusPrices[index] || "0",
        });
      });
    }

    // Helper function to parse fields that might be JSON strings
    const parseField = (field, defaultValue) => {
      if (field === undefined) return defaultValue;
      if (typeof field === "string") {
        try {
          return JSON.parse(field);
        } catch {
          return field;
        }
      }
      return field;
    };

    // Create the sales page
    const newSalesPage = new SalesPage({
      linkedTo: {
        kind: type === "course" ? "Course" : "DigitalProduct",
        item: id,
      },
      lines: parseField(req.body.lines, []),
      section5Lines: parseField(req.body.section5Lines, []),
      mainImage,
      bonusImages,
      embedCode: req.body.embedCode,
      smallBoxContent: req.body.smallBoxContent,
      buttonContent: req.body.buttonContent,
      checkBoxHeading: req.body.checkBoxHeading,
      FirstCheckBox: parseField(req.body.FirstCheckBox, []),
      secondCheckBoxHeading: req.body.secondCheckBoxHeading,
      SecondCheckBox: parseField(req.body.SecondCheckBox, []),
      SecondCheckBoxConcluding: req.body.SecondCheckBoxConcluding,
      Topic: req.body.Topic,
      ThirdSectionSubHeading: req.body.ThirdSectionSubHeading,
      ThirdSectionDescription: parseField(req.body.ThirdSectionDescription, []),
      AfterButtonPoints: {
        description: parseField(req.body.AfterButtonPoints?.description, []),
      },
      offerContent: req.body.offerContent,
      offerLimitingContent: req.body.offerLimitingContent,
      lastPartHeading: req.body.lastPartHeading,
      lastPartContent: req.body.lastPartContent,
      faq: parseField(req.body.faq, []),
    });

    await newSalesPage.save();

    return res.status(201).json({
      success: true,
      message: "Sales page created successfully",
      data: {
        salesPageId: newSalesPage._id,
        linkedTo: newSalesPage.linkedTo,
        bonusImages: newSalesPage.bonusImages,
      },
    });
  } catch (error) {
    console.error("Error creating sales page:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const GetSalesPage = async (req, res) => {
  try {
    const { type, id } = req.params;

    const salesPage = await SalesPage.findOne({
      "linkedTo.kind": type === "digital-product" ? "DigitalProduct" : "Course",
      "linkedTo.item": id,
    });

    if (!salesPage) {
      return res.status(404).json({ message: "Sales page not found." });
    }
    return res.status(200).json(salesPage);
  } catch (error) {
    console.error("GetSalesPage Error:", error);
    return res.status(500).json({ message: "Internal Server Error...!" });
  }
};

const updateSalesPage = async (req, res) => {
  try {
    const { type, id } = req.params;

    const existing = await SalesPage.findOne({
      "linkedTo.kind": type === "digital-product" ? "DigitalProduct" : "Course",
      "linkedTo.item": id,
    });

    if (!existing) {
      return res.status(404).json({ message: "Sales page not found." });
    }

    // Enhanced parsing function
    const parseField = (field, defaultValue = []) => {
      try {
        if (typeof field === "string") {
          const parsed = JSON.parse(field);
          return Array.isArray(parsed) ? parsed : defaultValue;
        }
        if (Array.isArray(field)) return field;
        return defaultValue;
      } catch (e) {
        return defaultValue;
      }
    };

    // Parse lines first to ensure validation passes
    const lines = parseField(req.body.lines);
    if (!lines || lines.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one line is required." });
    }

    // Handle main image
    let mainImage = existing.mainImage;
    if (req.files && req.files["mainImage"]) {
      mainImage = req.files["mainImage"][0].filename;
    }

    // Handle bonus images - more robust implementation
    const currentBonusImages = existing.bonusImages || [];

    // Get the submitted titles and prices
    const existingTitles = req.body.existingBonusTitles
      ? Array.isArray(req.body.existingBonusTitles)
        ? req.body.existingBonusTitles
        : JSON.parse(req.body.existingBonusTitles || "[]")
      : [];

    const existingPrices = req.body.existingBonusPrices
      ? Array.isArray(req.body.existingBonusPrices)
        ? req.body.existingBonusPrices
        : JSON.parse(req.body.existingBonusPrices || "[]")
      : [];

    // Rebuild the bonusImages array
    const updatedBonusImages = [];

    // Match existing images with their updated titles/prices
    existingTitles.forEach((title, index) => {
      if (currentBonusImages[index]) {
        updatedBonusImages.push({
          image: currentBonusImages[index].image, // Keep original filename
          title: title || "",
          price: existingPrices[index] || "",
        });
      }
    });

    // Handle new bonus images
    if (req.files && req.files["bonusImages"]) {
      const newTitles = req.body.newBonusTitles
        ? Array.isArray(req.body.newBonusTitles)
          ? req.body.newBonusTitles
          : JSON.parse(req.body.newBonusTitles || "[]")
        : [];

      const newPrices = req.body.newBonusPrices
        ? Array.isArray(req.body.newBonusPrices)
          ? req.body.newBonusPrices
          : JSON.parse(req.body.newBonusPrices || "[]")
        : [];

      req.files["bonusImages"].forEach((file, index) => {
        updatedBonusImages.push({
          image: file.filename,
          title: newTitles[index] || "",
          price: newPrices[index] || "",
        });
      });
    }

    // Update the document

    const parseAfterButtonPoints = (field) => {
      try {
        if (typeof field === "string") {
          const parsed = JSON.parse(field);
          return {
            description: Array.isArray(parsed?.description)
              ? parsed.description
              : [],
          };
        }
        return {
          description: Array.isArray(field?.description)
            ? field.description
            : [],
        };
      } catch (e) {
        return { description: [] };
      }
    };

    // Update fields with proper parsing
    existing.lines = lines;
    existing.section5Lines = parseField(req.body.section5Lines);
    existing.embedCode = req.body.embedCode || "";
    existing.smallBoxContent = req.body.smallBoxContent || "";
    existing.buttonContent = req.body.buttonContent || "";
    existing.checkBoxHeading = req.body.checkBoxHeading || "";
    existing.FirstCheckBox = parseField(req.body.FirstCheckBox);
    existing.secondCheckBoxHeading = req.body.secondCheckBoxHeading || "";
    existing.SecondCheckBox = parseField(req.body.SecondCheckBox);
    existing.Topic = req.body.Topic || "";
    existing.ThirdSectionSubHeading = req.body.ThirdSectionSubHeading || "";
    existing.ThirdSectionDescription = parseField(
      req.body.ThirdSectionDescription
    );
    existing.AfterButtonPoints = parseAfterButtonPoints(
      req.body.AfterButtonPoints
    );
    existing.offerContent = req.body.offerContent || "";
    existing.offerLimitingContent = req.body.offerLimitingContent || "";
    existing.SecondCheckBoxConcluding = req.body.SecondCheckBoxConcluding || "";
    existing.lastPartHeading = req.body.lastPartHeading || "";
    existing.lastPartContent = req.body.lastPartContent || "";
    existing.faq = parseField(req.body.faq);
    existing.mainImage = mainImage;
    existing.bonusImages = updatedBonusImages;

    await existing.save();

    return res.status(200).json({
      success: true,
      message: "Sales page updated successfully.",
      data: {
        salesPageId: existing._id,
        courseId: existing.courseId,
      },
    });
  } catch (error) {
    console.error("Error updating sales page:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const createCheckout = async (req, res) => {
  try {
    const { topHeading, subHeading } = req.body;
    const { type, id } = req.params; // Changed from courseId to id
    const checkoutImageFile = req.files?.checkoutImage?.[0];

    // Validate required fields
    if (!topHeading || !subHeading || !checkoutImageFile) {
      return res.status(400).json({
        success: false,
        message: "Top heading, sub heading, and image are required",
        code: "MISSING_FIELDS",
      });
    }

    // Process lines (handle both array and single string)
    const lines = Array.isArray(req.body.lines)
      ? req.body.lines.filter((line) => line.trim() !== "")
      : req.body.lines
      ? [req.body.lines.trim()]
      : [];

    if (lines.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one content line is required",
        code: "MISSING_LINES",
      });
    }

    // Validate type
    const validTypes = ["course", "digital-product"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product type",
        code: "INVALID_TYPE",
      });
    }

    // Verify the referenced product exists
    const ProductModel = type === "course" ? Course : DigitalProduct;
    const productExists = await ProductModel.exists({ _id: id });
    if (!productExists) {
      return res.status(404).json({
        success: false,
        message: `${type} not found`,
        code: "PRODUCT_NOT_FOUND",
      });
    }

    // Create new checkout page
    const newCheckout = new CheckoutPage({
      linkedTo: {
        kind: type,
        item: id,
      },
      topHeading: topHeading.trim(),
      subHeading: subHeading.trim(),
      checkoutImage: checkoutImageFile.filename,
      lines,
      isActive: true,
    });

    await newCheckout.save();

    return res.status(201).json({
      success: true,
      message: "Checkout page created successfully",
      data: {
        checkoutId: newCheckout._id,
        productId: id,
        type,
      },
    });
  } catch (error) {
    console.error("Checkout Creation Error:", error);

    // Handle duplicate key error (unique index violation)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Checkout page already exists for this product",
        code: "DUPLICATE_CHECKOUT",
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.values(error.errors).map((e) => e.message),
        code: "VALIDATION_ERROR",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

const getDigitalProduct = async (req, res) => {
  try {
    const fetchedDigitalProduct = await DigitalProduct.find();

    if (!fetchedDigitalProduct) {
      res.status(400).json({ message: "Not have any digital product..." });
    }

    res.status(200).json({
      products: fetchedDigitalProduct,
      message: "Successfully fetched...",
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error...!" });
  }
};

const addDigitalProduct = async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.name || !req.body.regularPrice || !req.body.category) {
      return res.status(400).json({
        message: "Name, regular price, and category are required",
      });
    }

    // Validate price values
    if (
      isNaN(req.body.regularPrice) ||
      parseFloat(req.body.regularPrice) <= 0
    ) {
      return res.status(400).json({
        message: "Regular price must be a positive number",
      });
    }

    if (
      req.body.salePrice &&
      (isNaN(req.body.salePrice) ||
        parseFloat(req.body.salePrice) >= parseFloat(req.body.regularPrice))
    ) {
      return res.status(400).json({
        message: "Sale price must be less than regular price",
      });
    }

    // Validate content type
    if (!["file", "link"].includes(req.body.contentType)) {
      return res.status(400).json({
        message: "Content type must be either 'file' or 'link'",
      });
    }

    // Validate based on content type
    if (req.body.contentType === "file" && !req.file && !req.body.fileUrl) {
      return res.status(400).json({
        message: "File is required for file products",
      });
    }

    if (req.body.contentType === "link" && !req.body.externalUrl) {
      return res.status(400).json({
        message: "External URL is required for link products",
      });
    }

    // Handle file upload if present
    let fileUrl = req.body.fileUrl;
    if (req.body.contentType === "file" && req.file) {
      const uploadResult = await uploadFileToCloud(req.file);
      fileUrl = uploadResult.secure_url;
    }

    // Create new product
    const newProduct = new DigitalProduct({
      name: req.body.name,
      description: req.body.description,
      regularPrice: parseFloat(req.body.regularPrice),
      salePrice: req.body.salePrice ? parseFloat(req.body.salePrice) : null,
      category: req.body.category,
      status: req.body.status || "active",
      [req.body.contentType === "file" ? "fileUrl" : "externalUrl"]:
        req.body.contentType === "file" ? fileUrl : req.body.externalUrl,
    });

    // Save to database
    const savedProduct = await newProduct.save();

    // Return success response
    return res.status(201).json({
      message: "Digital product added successfully",
      product: savedProduct,
    });
  } catch (error) {
    console.error("Error adding digital product:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteDigitalProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Valid Product ID is required" });
    }

    // Delete the digital product
    const deletedProduct = await DigitalProduct.findByIdAndDelete(productId);

    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete associated pages
    await CheckoutPage.deleteOne({
      "linkedTo.kind": "digital-product",
      "linkedTo.item": productId,
    });

    await ThankYouPage.deleteOne({
      "linkedTo.kind": "digital-product",
      "linkedTo.item": productId,
    });

    await SalesPage.deleteOne({
      $or: [
        { "linkedTo.kind": "digital-product", "linkedTo.item": productId },
        { "linkedTo.kind": "DigitalProduct", "linkedTo.item": productId },
      ],
    });

    return res.status(200).json({
      message: "Product and associated pages deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product and pages:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const changeProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate input
    if (!id) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    if (!status || !["active", "inactive"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Status must be either 'active' or 'inactive'" });
    }

    // Update the product status
    const updatedProduct = await DigitalProduct.findByIdAndUpdate(
      id,
      { status },
      { new: true } // Return the updated document
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json({
      message: "Product status updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error changing product status:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getEditProductDetails = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const product = await DigitalProduct.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Format the response to match what the frontend expects
    const responseData = {
      name: product.name,
      description: product.description,
      regularPrice: product.regularPrice,
      salePrice: product.salePrice || "",
      category: product.category,
      fileUrl: product.fileUrl || "",
      externalUrl: product.externalUrl || "",
      contentType: product.fileUrl ? "file" : "link",
      status: product.status,
    };

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching product details:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
const UpdateProductDetails = async (req, res) => {
  try {
    const { productId } = req.params;
    const formData = req.body;
    const file = req.file;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Check if product exists
    const existingProduct = await DigitalProduct.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Prepare update data
    const updateData = {
      name: formData.name,
      description: formData.description,
      regularPrice: parseFloat(formData.regularPrice),
      salePrice: formData.salePrice ? parseFloat(formData.salePrice) : null,
      category: formData.category,
      status: formData.status,
      contentType: formData.contentType,
    };

    // Handle file/link updates
    if (formData.contentType === "file") {
      if (file) {
        const uploadResult = await uploadFileToCloud(file);
        updateData.fileUrl = uploadResult.secure_url;
        updateData.externalUrl = undefined;
      } else if (!existingProduct.fileUrl) {
        return res.status(400).json({ message: "File is required" });
      }
    } else {
      if (!formData.externalUrl) {
        return res.status(400).json({ message: "External URL is required" });
      }
      updateData.externalUrl = formData.externalUrl;
      updateData.fileUrl = undefined;
    }

    const updatedProduct = await DigitalProduct.findByIdAndUpdate(
      productId,
      updateData,
      { new: true }
    );

    return res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const CheckSalesPage = async (req, res) => {
  try {
    const salesPage = await SalesPage.findOne({
      "linkedTo.kind": "DigitalProduct",
      "linkedTo.item": req.params.id,
    });
    res.json({ exists: !!salesPage });
  } catch (error) {
    res.status(500).json({ message: "Error checking sales page" });
  }
};

const CheckCheckoutPage = async (req, res) => {
  try {
    const { type, id } = req.params;

    // Find checkout page by linked product ID
    const checkoutPage = await CheckoutPage.findOne({
      "linkedTo.kind":
        type === "digital-product" ? "digital-product" : "course",
      "linkedTo.item": id,
    });

    res.json({ exists: !!checkoutPage });
  } catch (error) {
    console.error("Error checking checkout page:", error);
    res.status(500).json({
      success: false,
      message: "Error checking checkout page",
    });
  }
};
const GetEditCheckoutDetails = async (req, res) => {
  try {
    const { type, id } = req.params;

    // Validate request parameters
    if (!type || !id) {
      return res.status(400).json({
        success: false,
        message: "Type and ID are required parameters",
      });
    }

    // Find the checkout page using the correct schema fields
    const checkoutPage = await CheckoutPage.findOne({
      "linkedTo.kind": type,
      "linkedTo.item": id,
    }).populate("orderBump thankYouPage");

    if (!checkoutPage) {
      return res.status(404).json({
        success: false,
        message: "Checkout page not found for this product",
        data: null,
      });
    }

    // Return the data in expected format
    res.status(200).json({
      success: true,
      message: "Checkout page details retrieved successfully",
      data: {
        topHeading: checkoutPage.topHeading,
        subHeading: checkoutPage.subHeading,
        checkoutImage: checkoutPage.checkoutImage,
        lines: checkoutPage.lines,
        orderBump: checkoutPage.orderBump,
        thankYouPage: checkoutPage.thankYouPage,
      },
    });
  } catch (error) {
    console.error("Error in GetEditCheckoutDetails:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching checkout page details",
    });
  }
};

const CheckThankoutPage = async (req, res) => {
  try {
    const { type, id } = req.params;

    const existingPage = await ThankYouPage.findOne({
      "linkedTo.kind": type,
      "linkedTo.item": id,
    });

    res.status(200).json({
      success: true,
      exists: !!existingPage,
      data: existingPage || null,
    });
  } catch (error) {
    console.error("Error in CheckThankoutPage:", error);
    res.status(500).json({
      success: false,
      message: "Error checking thank you page existence",
    });
  }
};

const getEditThankyouPage = async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!type || !id) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: type or id",
      });
    }

    const page = await ThankYouPage.findOne({
      "linkedTo.kind": type,
      "linkedTo.item": id,
    });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Thank You Page not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: page,
    });
  } catch (error) {
    console.error("Error in getEditThankyouPage:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching Thank You Page",
    });
  }
};

const createThankyouPage = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { title, embedCode, note, isActive } = req.body;

    const existingPage = await ThankYouPage.findOne({
      "linkedTo.kind": type,
      "linkedTo.item": id,
    });

    if (existingPage) {
      return res.status(400).json({
        success: false,
        message: "Thank you page already exists for this item",
      });
    }

    const newPage = new ThankYouPage({
      linkedTo: {
        kind: type,
        item: id,
      },
      title,
      embedCode,
      note,
      isActive,
    });

    await newPage.save();

    res.status(200).json({
      success: true,
      message: "Thank you page created successfully",
      data: newPage,
    });
  } catch (error) {
    console.error("Error in createThankyouPage:", error);
    res.status(500).json({
      success: false,
      message: "Error creating thank you page",
    });
  }
};

const updateThankyouPage = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { title, embedCode, note, isActive } = req.body;

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID",
      });
    }

    if (!["course", "digital-product"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be 'course' or 'digital-product'",
      });
    }

    if (!title || !embedCode) {
      return res.status(400).json({
        success: false,
        message: "Title and Embed Code are required.",
      });
    }

    const updatedPage = await ThankYouPage.findOneAndUpdate(
      {
        "linkedTo.kind": type,
        "linkedTo.item": id,
      },
      {
        title,
        embedCode,
        note,
        isActive,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedPage) {
      return res.status(404).json({
        success: false,
        message: "Thank You Page not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Thank You Page updated successfully",
      data: updatedPage,
    });
  } catch (error) {
    console.error("Error in updateThankyouPage:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating Thank You Page",
    });
  }
};

const getAllOrderBumps = async (req, res) => {
  try {
    const orderBumps = await OrderBump.find()
      .populate('targetProduct', 'title name')
      .populate('bumpProduct', 'name price');

    return res.status(200).json({
      success: true,
      data: orderBumps
    });
  } catch (error) {
    console.error("Error in getAllOrderBumps:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching order bumps",
    });
  }
};

// Create new order bump
const CreateOrderBumps = async (req, res) => {
  try {
    const {
      displayName,
      description,
      bumpPrice,
      targetProduct,
      targetProductModel,
      bumpProduct,
      isActive,
      minCartValue
    } = req.body;

    if (!displayName || !bumpPrice || !targetProduct || !bumpProduct) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Create new order bump
    const newOrderBump = new OrderBump({
      displayName,
      description,
      bumpPrice,
      targetProduct,
      targetProductModel,
      bumpProduct,
      isActive: isActive === 'true' || isActive === true,
      minCartValue: minCartValue || 0,
      image: req.file?.path || null
    });

    await newOrderBump.save();

    return res.status(201).json({
      success: true,
      message: "Order bump created successfully",
      data: newOrderBump
    });
  } catch (error) {
    console.error("Error in CreateOrderBumps:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating order bump",
    });
  }
};

// Get single order bump for editing
const GetEditOrderBump = async (req, res) => {
  try {
    const orderBump = await OrderBump.findById(req.params.id)
      .populate('targetProduct', 'title name')
      .populate('bumpProduct', 'name price');

    if (!orderBump) {
      return res.status(404).json({
        success: false,
        message: "Order bump not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: orderBump
    });
  } catch (error) {
    console.error("Error in GetEditOrderBump:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching order bump",
    });
  }
};

// Update order bump
const UpdateOrderBump = async (req, res) => {
  try {
    const {
      displayName,
      description,
      bumpPrice,
      targetProduct,
      targetProductModel,
      bumpProduct,
      isActive,
      minCartValue
    } = req.body;

    const updateData = {
      displayName,
      description,
      bumpPrice,
      targetProduct,
      targetProductModel,
      bumpProduct,
      isActive: isActive === 'true' || isActive === true,
      minCartValue: minCartValue || 0
    };

    if (req.file) {
      updateData.image = req.file.path;
    }

    const updatedBump = await OrderBump.findByIdAndUpdate(
      req.params.id,
      updateData, 
      { new: true }
    );

    if (!updatedBump) {
      return res.status(404).json({
        success: false,
        message: "Order bump not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order bump updated successfully",
      data: updatedBump
    });
  } catch (error) {
    console.error("Error in UpdateOrderBump:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating order bump",
    });
  }
};

// Delete order bump
const DeleteOrderBump = async (req, res) => {
  try {
    const deletedBump = await OrderBump.findByIdAndDelete(req.params.id);

    if (!deletedBump) {
      return res.status(404).json({
        success: false,
        message: "Order bump not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order bump deleted successfully"
    });
  } catch (error) {
    console.error("Error in DeleteOrderBump:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting order bump",
    });
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
  getUserCourses,
  userCourse,
  showCourses,
  getBuyCourseDetails,
  createSalesPage,
  GetSalesPage,
  updateSalesPage,
  createCheckout,
  getDigitalProduct,
  addDigitalProduct,
  deleteDigitalProduct,
  changeProductStatus,
  getEditProductDetails,
  UpdateProductDetails,
  CheckSalesPage,
  CheckCheckoutPage,
  GetEditCheckoutDetails,
  CheckThankoutPage,
  getEditThankyouPage,
  createThankyouPage,
  updateThankyouPage,
  getAllOrderBumps,
  CreateOrderBumps,
  GetEditOrderBump,
  UpdateOrderBump,
  DeleteOrderBump,
};
