const Payment = require('../../Model/PurchaseModal');
const User = require('../../Model/UserModel');
const Course = require('../../Model/CourseModel');
const OrderBump = require('../../Model/OrderBumbModel');
const { generateResetToken } = require("../../Config/ResetToken");
const generateInvoice = require("../../Utils/generateInvoice");
const { sendPaymentSuccessEmail } = require('../../Utils/sendMail');
const { trackPurchase } = require('../../Services/trackPurchase');
const { updateContactWithPaymentStatus } = require('../../Services/contactService');

const handle = async ({
  razorpay_order_id,
  razorpay_payment_id,
  productId,
  username,
  email,
  phone,
  amount,
  orderBumps,
  payment, 
  res
}) => {
  try {
    // Find or create user
    let user = await User.findOne({ email });
    let resetLink = null;
    let isNewUser = false;

    if (!user) {
      user = new User({
        username,
        email,
        phone,
        orders: [],
        enrolledCourses: [],
      });
      await user.save();
      isNewUser = true;
    }

    // Get course details
    const course = await Course.findById(productId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check for existing successful payment (excluding current payment)
    const existingPayment = await Payment.findOne({
      email,
      productId,
      status: "Success",
      productType: "Course",
      _id: { $ne: payment._id }
    });

    if (existingPayment) {
      return res.status(200).json({
        success: true,
        status: "already_paid",
        message: "You have already purchased this course",
        payment: existingPayment,
      });
    }

    // Update the existing payment record
    const updatedPayment = await Payment.findByIdAndUpdate(
      payment._id,
      {
        $set: {
          status: "Success",
          razorpay_payment_id,
          amount: amount,
          productSnapshot: {
            title: course.title,
            description: course.description,
            images: course.images,
            route: course.route,
            buyCourse: course.buyCourse,
            regularPrice: course.regularPrice,
            salesPrice: course.salesPrice,
            modules: course.modules.map((module) => ({
              title: module.title,
              lectures: module.lectures.map((lecture) => ({
                title: lecture.title,
                description: lecture.description,
                videoUrl: lecture.videoUrl,
                resources: lecture.resources,
                duration: lecture.duration,
              })),
            })),
          }
        }
      },
      { new: true }
    );

    // Handle order bumps
    if (orderBumps && orderBumps.length > 0) {
      await processOrderBumps({
        orderBumps,
        razorpay_order_id,
        username,
        email,
        phone,
      });
    }

    // Enroll user in course
    if (!user.orders.includes(razorpay_order_id)) {
      user.orders.push(razorpay_order_id);
      await user.save();
    }

    // Generate reset link if new user
    if (isNewUser) {
      const resetToken = await generateResetToken(user);
      resetLink = `${process.env.FRONTEND_URL}/set-password?token=${resetToken}&email=${email}`;
    }

    // Update contact status
    await updateContactWithPaymentStatus(email, 'Success', { username, phone });

    // Generate and send invoice
    const invoicePath = await generateInvoice(updatedPayment, course);
    await sendPaymentSuccessEmail(user, user.email, updatedPayment, course, invoicePath);

    // Track purchase
    await trackPurchase(updatedPayment, course, orderBumps);

    return res.status(200).json({
      success: true,
      message: "Course payment verified successfully",
      payment: updatedPayment,
      user,
      resetLink,
    });
  } catch (error) {
    console.error("Payment processing error:", error);
    
    // Update payment status to failed
    await Payment.findByIdAndUpdate(
      payment._id,
      { 
        $set: { 
          status: "Failed",
          failureReason: error.message 
        } 
      }
    );

    // Update contact status
    try {
      if (email) {
        await updateContactWithPaymentStatus(email, "Failed", { username, phone });
      }
    } catch (tagError) {
      console.error("Failed to update contact tags:", tagError);
    }

    return res.status(500).json({
      success: false,
      message: "An error occurred during payment processing",
      error: error.message,
    });
  }
};

async function processOrderBumps({
  orderBumps,
  razorpay_order_id,
  username,
  email,
  phone,
}) {
  for (const bumpId of orderBumps) {
    const bump = await OrderBump.findById(bumpId).populate("bumpProduct");
    if (bump) {
      await Payment.create({
        username,
        email,
        phone: Number(phone),
        productId: bump.bumpProduct._id,
        productType: "DigitalProduct",
        amount: bump.bumpPrice,
        orderId: razorpay_order_id,
        status: "Success",
        paymentMethod: "Razorpay",
        productSnapshot: {
          title: bump.displayName,
          description: bump.description,
          fileUrl: bump.bumpProduct.fileUrl,
          regularPrice: bump.bumpPrice,
          salesPrice: bump.bumpPrice,
        },
        isOrderBump: true,
        parentOrder: razorpay_order_id,
      });
    }
  }
}

const logFailedPayment = async ({ 
  username, 
  email, 
  phone, 
  productId, 
  orderId, 
  amount, 
  productType,
  reason 
}) => {
  try {
    await Payment.findOneAndUpdate(
      { orderId },
      {
        $set: {
          username,
          email,
          phone,
          productId,
          productType,
          amount,
          orderId,
          status: "Failed",
          paymentMethod: "Razorpay",
          failureReason: reason
        }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("Error saving failed payment:", err);
  }
};

module.exports = {
  logFailedPayment,
  handle
};