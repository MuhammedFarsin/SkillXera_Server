const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const { generateResetToken } = require("../Config/ResetToken");

dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  requireTLS: true,
  auth: {
    user: process.env.MAIL,
    pass: process.env.MAIL_PASS,
  },
});

const sendOtpEmail = async (toEmail, otp) => {
  try {
    const mailOptions = {
      from: process.env.MAIL,
      to: toEmail,
      subject: "Account Verification CodeNumber",
      html: `<h3><span style='color: #23a925;'>SkillXera</span></h3>
             <h5>Account Verification CodeNumber 📩</h5>
             <h1>${otp}</h1>`,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
};

const sendPaymentSuccessEmail = async (
  user,
  toEmail,
  courseDetails,
  paymentId,
  invoicePath
) => {
  try {
    let additionalContent = "";
    if (typeof toEmail !== "string") {
      console.error("Invalid email format:", toEmail);
      throw new Error("Invalid recipient email format");
    }

    toEmail = toEmail.replace(/^'+|'+$/g, "").trim();

    if (!user.password) {
      // Generate reset token
      const resetToken = await generateResetToken(user);
      const resetLink = `${process.env.FRONTEND_URL}/set-password?token=${resetToken}&email=${toEmail}`;

      additionalContent = `
        <p><b>Important: Set Up Your Password!</b></p>
        <p>You now have access to <b>${courseDetails.title}</b>, but before you can start learning, you need to <b>set up a password</b> for secure login.</p>
        <p><a href="${resetLink}" style="color: #007bff; font-weight: bold;">Click here to set your password</a> and begin your journey.</p>
        <p>This step is required to ensure a smooth and secure experience.</p>
      `;
    } else {
      additionalContent = `
        <p><b>You're all set! 🚀</b></p>
        <p>You can access your course anytime by clicking the link below:</p>
        <p><a href="${process.env.FRONTEND_URL}/home" style="color: #007bff; font-weight: bold;">Start Learning Now</a></p>
      `;
    }

    const mailOptions = {
      from: process.env.MAIL,
      to: toEmail,
      subject: "Course Access - Start Learning Now!",
      html: `
        <h3><span style='color: #23a925;'>SkillXera</span></h3>
        <h5>🎉 Congratulations! Your payment was successful.</h5>
        <p>You have successfully purchased <b>${courseDetails.title}</b>.</p>
        <p><b>Payment ID:</b> ${paymentId}</p>
        <br/>
        ${additionalContent}
        <p>We’re excited to have you onboard! 🚀</p>
      `,
      attachments: [{ filename: "invoice.pdf", path: invoicePath }],
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log("Payment success email sent:", info.response);
  } catch (error) {
    console.error("Error sending payment success email:", error);
    throw new Error("Failed to send payment success email");
  }
};

module.exports = { sendOtpEmail, sendPaymentSuccessEmail };
