const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Path to the uploads folder
const uploadDir = path.join(__dirname, '../../public/uploads');

// Ensure that the uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true }); // Creates the folder if it doesn't exist
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use the uploads directory to store the file
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Set the filename to be the current timestamp and the original file name
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

module.exports = upload;
