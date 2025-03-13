const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const ACCESS_TOKEN_EXPIRE_TIME = "7d";
const REFRESH_TOKEN_EXPIRE_TIME = "14d";

// Generate Access Token (Include isAdmin field)
const generateAccessToken = (user) => {
  return jwt.sign(
    { _id: user._id, username: user.username, email: user.email, isAdmin: user.isAdmin },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRE_TIME }
  );
};

// Generate Refresh Token (Include isAdmin field)
const generateRefreshToken = (user) => {
  return jwt.sign(
    { _id: user._id, username: user.username, email: user.email, isAdmin: user.isAdmin },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRE_TIME }
  );
};

// Verify Tokens
const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
