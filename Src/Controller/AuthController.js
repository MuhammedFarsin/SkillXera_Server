const User = require("../Model/UserModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../Config/jwtConfig");
const {sendOtpEmail} = require("../Utils/sendMail");
const dotenv = require("dotenv");
const crypto = require("crypto")
const Contact = require("../Model/ContactModel");

const tempUsers = {};

dotenv.config();

const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
    });

    res.json({
      success: true,
      accessToken,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error...!" });
  }
};
const signup = async (req, res) => {
  try {
    const { username, email, password, confirmPassword, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists!" });
    }
    

    console.log(password !== confirmPassword);
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match!" });
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000);
    tempUsers[email] = {
      username,
      email,
      password,
      confirmPassword,
      phone,
      otp: generatedOtp,
    };
    await sendOtpEmail(email, generatedOtp);
    console.log(`OTP for ${email}:`, generatedOtp);
    return res
      .status(200)
      .json({ tempUsers, message: "OTP sent to your email" });
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ message: "Internal Server Error...!" });
  }
};
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!tempUsers[email]) {
      return res
        .status(400)
        .json({ message: "OTP expired! Please request a new one." });
    } 
    const { otp: storedOtp, otpExpiresAt } = tempUsers[email];

    if (new Date() > otpExpiresAt) {
      delete tempUsers[email];
      return res
        .status(400)
        .json({ message: "OTP has expired. Please request a new one." });
    }

    if (storedOtp !== Number(otp)) {
      return res.status(400).json({ message: "Invalid OTP!" });
    }

    const hashedPassword = await bcrypt.hash(tempUsers[email].password, 10);

    const newUser = new User({
      username: tempUsers[email].username,
      email: tempUsers[email].email,
      phone: tempUsers[email].phone,
      password: hashedPassword,
    });

    await newUser.save();
    let existingContact = await Contact.findOne({ email });

    if (existingContact) {
      // If a contact exists, update it to link with the new user
      existingContact.user = newUser._id;
      await existingContact.save();
    } else {
      // Otherwise, create a new contact
      existingContact = new Contact({
        username: tempUsers[email].username,
        email: tempUsers[email].email,
        phone: tempUsers[email].phone,
        user: newUser._id,
      });
      await existingContact.save();
    }

    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    delete tempUsers[email];

    return res.status(201).json({
      message: "User registered successfully!",
      user: newUser,
      contact: existingContact,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    return res.status(500).json({ message: "Internal Server Error...!" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!tempUsers[email]) {
      return res
        .status(400)
        .json({ message: "User not found! Please sign up again." });
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000);
    const otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000);

    tempUsers[email].otp = generatedOtp;
    tempUsers[email].otpExpiresAt = otpExpiresAt;

    await sendOtpMail(email, generatedOtp);
    console.log(`Resent OTP for ${email}:`, generatedOtp);

    return res
      .status(200)
      .json({ message: "OTP resent successfully! OTP expires in 5 minutes." });

  } catch (error) {

    console.error("Resend OTP Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const verifyMailForgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Please provide an email" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000);
    const generatedOtp = Math.floor(100000 + Math.random() * 900000);

    tempUsers[email] = { otp: generatedOtp, otpExpiresAt };

    await sendOtpEmail(email, generatedOtp);

    res.status(200).json({ tempUsers,message: "Reset password email sent successfully" });
    console.log(`Your OTP for ${email}:`, generatedOtp);

  } catch (error) {

    console.error("Error in OTP generation or email sending:", error);
    return res.status(500).json({ message: "Internal Server Error" });

  }
};

const verifyOtpForgetPassword = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!tempUsers[email] || tempUsers[email].otp !== Number(otp)) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    const otpExpiresAt = tempUsers[email].otpExpiresAt;

    if (new Date() > otpExpiresAt) {
      delete tempUsers[email];
      return res.status(400).json({ message: "OTP expired" });
    }

    return res.status(200).json({ message: "OTP verified successfully" });

  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const { email } = req.body; 
    if (!newPassword) {
      return res.status(400).json({ message: "New password is required." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({ message: "Password has been successfully reset" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}; 
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token required" });
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    // console.log('this is decoded :',decoded)
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const newAccessToken = generateAccessToken(user);
    res.status(200).json({ accessToken: newAccessToken });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
const logout =  async (req, res) => {
  try {
    res.clearCookie('refreshToken')
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

const setPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await User.findOne({ email }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (!user.passwordResetToken || !user.passwordResetExpires) {
      return res.status(400).json({ message: "Token missing or invalid" });
    }

    if (user.passwordResetExpires < Date.now()) {
      return res.status(400).json({ message: "Token expired" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    if (hashedToken !== user.passwordResetToken) {
      return res.status(400).json({ message: "Invalid token" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
    });

    return res.status(200).json({
      message: "Password set successfully.",
      accessToken,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    console.error("Error in setPassword:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


module.exports = {
  signin,
  signup,
  verifyOtp,
  resendOtp,
  verifyMailForgetPassword,
  verifyOtpForgetPassword,
  resetPassword,
  refreshToken,
  logout,
  setPassword
};
