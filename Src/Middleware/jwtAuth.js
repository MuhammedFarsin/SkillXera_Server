const { verifyAccessToken, verifyRefreshToken } = require("../Config/jwtConfig");

// Middleware to authenticate access token
const authenticateAccessToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: "Access token is required",
      code: "MISSING_TOKEN"
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded; 
    next();
  } catch (err) {
    console.error("Access token error:", err);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false,
        message: "Access token expired",
        code: "TOKEN_EXPIRED" 
      });
    }

    return res.status(401).json({ 
      success: false,
      message: "Invalid access token",
      code: "INVALID_TOKEN"
    });
  }
};

// Middleware to authenticate refresh token
const authenticateRefreshToken = (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ 
      success: false,
      message: "Refresh token is required",
      code: "MISSING_REFRESH_TOKEN"
    });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Refresh token error:", err);
    return res.status(403).json({ 
      success: false,
      message: "Invalid or expired refresh token",
      code: "INVALID_REFRESH_TOKEN"
    });
  }
};

// Middleware to check admin role
const isAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ 
      success: false,
      message: "Access denied. Admins only",
      code: "ADMIN_REQUIRED"
    });
  }
  next();
};

module.exports = {
  authenticateAccessToken,
  authenticateRefreshToken,
  isAdmin,
};