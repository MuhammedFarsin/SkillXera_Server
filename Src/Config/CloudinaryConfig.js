const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Define the upload directory
const uploadDir = path.join(__dirname, "../../public/videos");

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Helper function to sanitize file names
const sanitizeFileName = (fileName) => {
  // Replace special characters and spaces with underscores
  return fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
};

// Configure Multer for disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Save files in the upload directory
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname); // Get the file extension
    const baseName = sanitizeFileName(path.basename(file.originalname, ext)); // Sanitize the base name
    cb(null, `${baseName}-${uniqueSuffix}${ext}`); // Generate a unique file name
  },
});

// Configure Multer middleware
const videoUpload = multer({
  storage,
  limits: { fileSize: 5000 * 1024 * 1024 }, // Allow up to 5GB files
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["video/mp4", "video/mkv", "video/avi", "video/mov"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Invalid file type. Only MP4, MKV, AVI, and MOV videos are allowed!"), false);
    }
    cb(null, true);
  },
});

module.exports = { videoUpload };