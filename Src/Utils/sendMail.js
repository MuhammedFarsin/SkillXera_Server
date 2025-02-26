const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
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

const sendPaymentSuccessEmail = async (toEmail, courseDetails, paymentId) => {
  console.log(courseDetails)
  try {
    const mailOptions = {
      from: process.env.MAIL,
      to: toEmail,
      subject: "Payment Successful - Course Access Details",
      html: `
        <h3><span style='color: #23a925;'>SkillXera</span></h3>
        <h5>Congratulations! 🎉 Your payment was successful.</h5>
        <p><b>Course Name:</b> ${courseDetails.title}</p>
        <p><b>Description:</b> ${courseDetails.description}</p>
        <p><b>Course Link:</b> <a href="${courseDetails.route}">Click here to access</a></p>
        <p><b>Payment ID:</b> ${paymentId}</p>
        <br/>
        <p>Thank you for choosing SkillXera!</p>
      `,
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

