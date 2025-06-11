const Payment = require("../../Model/PurchaseModal");
const FailedPayment = require("../../Model/FailedPaymentModal");
const User = require("../../Model/UserModel");
const Course = require("../../Model/CourseModel");
const OrderBump = require("../../Model/OrderBumbModel");
const { generateResetToken } = require("../../Config/ResetToken");
const generateInvoice = require("../../Utils/generateInvoice");
const { sendPaymentSuccessEmail } = require("../../utils/sendMail");
const { trackPurchase } = require("../../Services/trackPurchase");
const {
  updateContactWithPaymentStatus,
} = require("../../Services/contactService");

const handleCoursePayment = async ({
  razorpay_order_id,
  razorpay_payment_id,
  courseId,
  username,
  email,
  phone,
  amount,
  orderBumps,
  payment,
  res,
}) => {
  try {
    // Validate required parameters
    if (!razorpay_order_id || !courseId || !email || !payment) {
      throw new Error("Missing required payment parameters");
    }

    // Find or create user
    let user = await User.findOne({ email });
    let resetLink = null;
    let isNewUser = false;

    if (!user) {
      try {
        user = new User({
          username,
          email,
          phone,
          orders: [],
        });
        await user.save();
        isNewUser = true;
      } catch (userError) {
        await logFailedPayment({
          orderId: razorpay_order_id,
          productId: courseId,
          productType: "Course",
          amount,
          email,
          phone,
          username,
          reason: `User creation failed: ${userError.message}`,
          context: "user_creation",
        });
        throw userError;
      }
    }

    // Get course details
    const course = await Course.findById(courseId);
    if (!course) {
      await logFailedPayment({
        orderId: razorpay_order_id,
        productId: courseId,
        productType: "Course",
        amount,
        email,
        phone,
        username,
        reason: "Course not found",
        context: "course_not_found",
      });
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if already paid
    const existingPayment = await Payment.findOne({
      email,
      productId: courseId,
      status: "Success",
      productType: "Course",
      _id: { $ne: payment._id },
    });

    if (existingPayment) {
      return res.status(200).json({
        success: true,
        status: "already_paid",
        message: "You have already purchased this course",
        payment: existingPayment,
      });
    }

    // Process order bumps
    let processedBumps = [];
    if (orderBumps && orderBumps.length > 0) {
      try {
        processedBumps = await processCourseOrderBumps(orderBumps);
      } catch (bumpError) {
        await logFailedPayment({
          orderId: razorpay_order_id,
          productId: courseId,
          productType: "Course",
          amount,
          email,
          phone,
          username,
          reason: `Order bump processing failed: ${bumpError.message}`,
          context: "order_bump_processing",
          paymentData: {
            orderBumps,
            errorDetails: bumpError.stack,
          },
        });
        throw bumpError;
      }
    }

    // Create course snapshot
    // In handleCoursePayment function, update the courseSnapshot creation:
    const courseSnapshot = {
      title: course.title,
      description: course.description,
      images: course.images,
      route: course.route,
      buyCourse: course.buyCourse,
      regularPrice: course.regularPrice,
      salesPrice: course.salesPrice,
      modules: course.modules?.map((module) => ({
        title: module.title,
        lectures: module.lectures?.map((lecture) => ({
          title: lecture.title,
          description: lecture.description,
          embedCode: lecture.embedCode,
          contentType: lecture.contentType,
          resources: lecture.resources,
          duration: lecture.duration,
          _id: lecture._id,
        })),
        _id: module._id,
      })),
    };

    // Update payment record
    const updatedPayment = await Payment.findByIdAndUpdate(
      payment._id,
      {
        $set: {
          status: "Success",
          razorpay_payment_id,
          amount: amount,
          orderBumps: processedBumps,
          productType: "Course",
          productSnapshot: courseSnapshot,
          paidAt: new Date(),
        },
      },
      { new: true }
    );

    // Enroll user
    if (!user.orders.includes(razorpay_order_id)) {
      user.orders.push(razorpay_order_id);
      await user.save();
    }

    // Generate reset link if new user
    if (isNewUser) {
      const resetToken = await generateResetToken(user);
      resetLink = `${process.env.FRONTEND_URL}/set-password?token=${resetToken}&email=${email}`;
    }

    // Post-payment actions in parallel
    await Promise.all([
      updateContactWithPaymentStatus(user.email, "Success", {
        username,
        phone,
      }),
      (async () => {
        const invoicePath = await generateInvoice(updatedPayment, course);
        await sendPaymentSuccessEmail(
          user,
          user.email,
          updatedPayment,
          course,
          invoicePath
        );
      })(),
      trackPurchase(updatedPayment, course, orderBumps),
    ]);

    return res.status(200).json({
      success: true,
      message: "Course payment verified successfully",
      payment: updatedPayment,
      user,
      resetLink,
    });
  } catch (error) {
    console.error("Course payment processing error:", error);

    const failureData = {
      orderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      productId: courseId,
      productType: "Course",
      amount,
      error: error,
      context: error.context || "payment_processing",
      paymentData: {
        originalPaymentId: payment?._id,
        orderBumps,
        errorDetails: error.stack,
      },
      customer: {
        email,
        phone: phone || "",
        username,
      },
    };

    await Promise.all([
      Payment.findByIdAndUpdate(payment?._id, {
        $set: {
          status: "Failed",
          failureReason: error.message,
          errorDetails: {
            stack: error.stack,
            context: error.context,
          },
        },
      }),
      logFailedPayment(failureData),
      email
        ? updateContactWithPaymentStatus(email, "Failed", {
            username,
            phone,
          })
        : Promise.resolve(),
    ]);

    return res.status(500).json({
      success: false,
      message: "An error occurred during course payment processing",
      error: error.message,
      referenceId: razorpay_order_id,
    });
  }
};

// Process course order bumps
async function processCourseOrderBumps(orderBumps) {
  const processedBumps = [];

  for (const bumpId of orderBumps) {
    const bump = await OrderBump.findById(bumpId).populate("bumpProduct");
    if (!bump) {
      console.warn(`Order bump ${bumpId} not found`);
      continue;
    }

    if (!bump.bumpProduct) {
      throw new Error(`Bump product not found for order bump ${bumpId}`);
    }

    processedBumps.push({
      bumpId: bump._id,
      productId: bump.bumpProduct._id,
      title: bump.displayName,
      amount: bump.bumpPrice,
      fileUrl: bump.bumpProduct.fileUrl || undefined,
      externalUrl: bump.bumpProduct.externalUrl || undefined,
      contentType: bump.bumpProduct.fileUrl ? "file" : "link",
    });
  }

  return processedBumps;
}

// Log failed payment (unchanged)
const logFailedPayment = async (data) => {
  try {
    const validContexts = [
      "payment_processing",
      "order_verification",
      "user_creation",
      "email_sending",
      "order_bump",
      "course_not_found",
      "database_error",
      "other",
    ];

    const validatedContext = validContexts.includes(data.context)
      ? data.context
      : "other";

    const failedPayment = {
      orderId: data.orderId || "unknown",
      razorpayPaymentId: data.razorpayPaymentId || "",
      productId: data.productId || null,
      productType: "Course", // Force to Course
      amount: data.amount || 0,
      error: data.error?.message || String(data.error || "Unknown error"),
      stackTrace: data.error?.stack || new Error().stack,
      context: validatedContext,
      paymentData: data.paymentData || {},
      customer: {
        email: data.customer?.email || data.email,
        phone: data.customer?.phone || data.phone,
        username: data.customer?.username || data.username,
        userId: data.customer?.userId || null,
      },
    };

    await FailedPayment.create(failedPayment);
  } catch (err) {
    console.error("CRITICAL: Failed to save failed payment:", err);
    console.error("Failure details:", JSON.stringify(data, null, 2));
  }
};

module.exports = {
  handleCoursePayment,
  logFailedPayment,
};
