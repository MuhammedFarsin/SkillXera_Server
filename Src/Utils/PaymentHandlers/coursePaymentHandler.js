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
  order_id, // Generic parameter name (works for both Razorpay and Cashfree)
  payment_id, // Generic parameter name
  gateway, // 'razorpay' or 'cashfree'
  productId,
  username,
  email,
  phone,
  amount,
  orderBumps,
  payment, // The payment document
  res,
}) => {
  try {

     console.log('this is orderid',order_id)
    console.log('this is productId',productId)
    console.log('this is the email',email)
    console.log('this is the order bumps',orderBumps)
    console.log('this is payment',payment)
    // Validate required parameters
    if (!order_id || !productId || !email || !payment) {
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
          orderId: order_id,
          productId: productId,
          productType: "Course",
          amount,
          email,
          phone,
          username,
          reason: `User creation failed: ${userError.message}`,
          context: "user_creation",
          gateway,
        });
        throw userError;
      }
    }

    // Get course details
    const course = await Course.findById(productId);
    if (!course) {
      await logFailedPayment({
        orderId: order_id,
        productId: productId,
        productType: "Course",
        amount,
        email,
        phone,
        username,
        reason: "Course not found",
        context: "course_not_found",
        gateway,
      });
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if already paid
    const existingPayment = await Payment.findOne({
      email,
      productId: productId,
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
          orderId: order_id,
          productId: productId,
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
          gateway,
        });
        throw bumpError;
      }
    }

    // Create course snapshot
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

    // Gateway-specific payment details
    const paymentUpdate = {
      status: "Success",
      amount: amount,
      orderBumps: processedBumps,
      productType: "Course",
      productSnapshot: courseSnapshot,
      paidAt: new Date(),
    };

    if (gateway === 'razorpay') {
      paymentUpdate.razorpay_payment_id = payment_id;
      paymentUpdate.razorpay_order_id = order_id;
    } else if (gateway === 'cashfree') {
      paymentUpdate.cf_payment_id = payment_id;
      paymentUpdate.cf_order_id = order_id;
    }

    // Update payment record
    const updatedPayment = await Payment.findByIdAndUpdate(
      payment._id,
      { $set: paymentUpdate },
      { new: true }
    );

    // Enroll user
    if (!user.orders.includes(order_id)) {
      user.orders.push(order_id);
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
      orderId: order_id,
      paymentId: payment_id,
      gateway,
      productId: productId,
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
      referenceId: order_id,
    });
  }
};

// Process course order bumps
async function processCourseOrderBumps(orderBumps) {
  const processedBumps = [];

  for (const bump of orderBumps) {
    let bumpData;

    // Case 1: if bump is a string or ObjectId → treat it as bump ID
    if (typeof bump === 'string' || bump instanceof require('mongoose').Types.ObjectId) {
      bumpData = await OrderBump.findById(bump).populate("bumpProduct");
      if (!bumpData) {
        console.warn(`Order bump ${bump} not found`);
        continue;
      }
    }

    // Case 2: if bump is an object → assume it contains productId etc.
    else if (typeof bump === 'object' && bump.productId) {
      bumpData = await OrderBump.findOne({ bumpProduct: bump.productId }).populate("bumpProduct");
      if (!bumpData) {
        console.warn(`Order bump for product ${bump.productId} not found`);
        continue;
      }
    } else {
      console.warn(`Invalid bump format: ${JSON.stringify(bump)}`);
      continue;
    }

    if (!bumpData.bumpProduct) {
      throw new Error(`Bump product not found for bump ${bumpData._id}`);
    }

    processedBumps.push({
      bumpId: bumpData._id,
      productId: bumpData.bumpProduct._id,
      title: bumpData.displayName,
      amount: bumpData.bumpPrice,
      fileUrl: bumpData.bumpProduct.fileUrl || undefined,
      externalUrl: bumpData.bumpProduct.externalUrl || undefined,
      contentType: bumpData.bumpProduct.fileUrl ? "file" : "link",
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
