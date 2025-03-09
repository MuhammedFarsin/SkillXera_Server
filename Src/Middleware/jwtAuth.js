const { verifyAccessToken, verifyRefreshToken } = require("../Config/jwtConfig");

// Middleware to authenticate access token
const authenticateAccessToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ message: "Access token is required" });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded; // Attach user data to request
    next();
  } catch (err) {
    console.error("Access token error:", err);
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
};

// Middleware to authenticate refresh token
const authenticateRefreshToken = (req, res, next) => {
  const refreshToken = req.cookies.refreshToken; // Assuming the refresh token is stored in cookies
  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token is required" });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    req.user = decoded; // Attach user data to request
    next();
  } catch (err) {
    console.error("Refresh token error:", err);
    return res.status(403).json({ message: "Invalid or expired refresh token" });
  }
};

// Middleware to check admin role
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: "Access denied. Admins only" });
  }
  next();
};

module.exports = {
  authenticateAccessToken,
  authenticateRefreshToken,
  isAdmin,
};
