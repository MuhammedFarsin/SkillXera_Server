const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Define upload directories
const imageUploadDir = path.join(__dirname, "../../public/uploads");

// Ensure upload directories exist
if (!fs.existsSync(imageUploadDir)) fs.mkdirSync(imageUploadDir, { recursive: true });

// Helper function to sanitize file names
const sanitizeFileName = (fileName) => {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, imageUploadDir);
    } else {
      cb(new Error("Invalid file type!"), false);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const baseName = sanitizeFileName(path.basename(file.originalname, ext));
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

// Multer middleware for handling both images and videos
const upload = multer({
  storage,
  limits: { fileSize: 5000 * 1024 * 1024 }, // 5GB max for videos
  fileFilter: (req, file, cb) => {
    const allowedImages = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    if (allowedImages.includes(file.mimetype) || allowedVideos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type!"), false);
    }
  },
});

// Handle multiple files (both images and videos)
const uploadMiddleware = upload.fields([
  { name: "images", maxCount: 5 },
]);

module.exports = uploadMiddleware;
