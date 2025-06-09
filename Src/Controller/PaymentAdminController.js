// controllers/PaymentAdminController.js
const Payment = require("../Model/PurchaseModal");
const FailedPayment = require("../Model/FailedPaymentModal");
const User = require("../Model/UserModel");
const Course = require("../Model/CourseModel");
const DigitalProduct = require("../Model/DigitalProductModal");
const razorpay = require("../Config/RazorpayConfig");
const { sendPaymentSuccessEmail } = require("../utils/sendMail");
const generateInvoice = require("../Utils/generateInvoice");
const { generateResetToken } = require("../Config/ResetToken");
const {
  updateContactWithPaymentStatus,
} = require("../Services/contactService");

const getPaymentSummary = async (req, res) => {
  try {
    const [total, success, failed, reconciled] = await Promise.all([
      Payment.countDocuments(),
      Payment.countDocuments({ status: "Success" }),
      Payment.countDocuments({ status: "Failed" }),
      Payment.countDocuments({ status: "Reconciled" }),
    ]);

    res.json({
      success: true,
      total,
      success,
      failed,
      reconciled,
      successRate:
        total > 0 ? (((success + reconciled) / total) * 100).toFixed(2) : 0,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: "Failed to get payment stats" });
  }
};
// Get list of failed payments
const getFailedPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const failedPayments = await FailedPayment.find({ resolved: false })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const count = await FailedPayment.countDocuments({ resolved: false });

    res.json({
      success: true,
      data: failedPayments,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Failed to get failed payments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve failed payments",
    });
  }
};

async function handleSuccessfulReconciliation(payment) {
  try {
    console.log("Payment object:", payment);

    // NORMALIZE CUSTOMER DATA (handles both root-level and nested customer data)
    const customer = {
      email: payment.customer?.email || payment.email,
      phone: payment.customer?.phone || payment.phone,
      username: payment.customer?.username || payment.username,
    };

    // VALIDATION
    if (!customer.email) {
      throw new Error("Customer email is required");
    }

    // UPDATE PAYMENT STATUS AND STANDARDIZE STRUCTURE
    const updatedPayment = await Payment.findByIdAndUpdate(
      payment._id,
      {
        $set: {
          status: "Reconciled",
          failureReason: null,
          reconciledAt: new Date(),
          email: payment.email,
          phone: payment.phone,
          username: payment.username,
          customer: {
            email: customer.email,
            phone: customer.phone,
            username: customer.username,
          },
        },
      },
      { new: true }
    );

    // USER HANDLING
    let user = await User.findOne({ email: customer.email });
    let isNewUser = false;

    if (!user) {
      try {
        user = new User({
          email: customer.email,
          username: customer.username,
          phone: customer.phone,
          orders: [payment.orderId],
          reconciledPayments: 1,
        });
        await user.save();
        isNewUser = true;
      } catch (userError) {
        throw new Error(`User creation failed: ${userError.message}`);
      }
    } else {
      await User.updateOne(
        { email: customer.email },
        {
          $addToSet: { orders: payment.orderId },
          $inc: { reconciledPayments: 1 },
          $set: {
            phone: customer.phone || user.phone,
            username: customer.username || user.username,
          },
        }
      );
    }

    await updateContactWithPaymentStatus(payment.email, "Reconciled", {
      username: payment.username,
      phone: payment.phone,
    });

    // COURSE ENROLLMENT AND EMAIL
    if (payment.productType === "Course") {
      try {
        const course = await Course.findById(payment.productId);
        if (course) {
          const invoicePath = await generateInvoice(updatedPayment, course);
          const resetLink = isNewUser
            ? `${
                process.env.FRONTEND_URL
              }/set-password?token=${await generateResetToken(user)}&email=${
                user.email
              }`
            : null;

          await sendPaymentSuccessEmail(
            user,
            user.email,
            updatedPayment,
            course,
            invoicePath,
            resetLink
          );
        }
      } catch (emailError) {
        console.error("Email sending failed (non-critical):", emailError);
      }
    }

    // MARK ALL DUPLICATE FAILED PAYMENTS AS RESOLVED
    await FailedPayment.updateMany(
      { orderId: payment.orderId }, // Target all records with this order ID
      {
        resolved: true,
        resolvedAt: new Date(),
        resolutionNotes: `Automatically reconciled with payment ${payment._id}`,
      }
    );

    return updatedPayment;
  } catch (error) {
    console.error("Reconciliation failed:", {
      error: error.message,
      paymentId: payment._id,
      customerData: {
        email: payment.customer?.email || payment.email,
        phone: payment.customer?.phone || payment.phone,
      },
    });
    await updateContactWithPaymentStatus(payment.email, "Failed", {
      username: payment.username,
      phone: payment.phone,
    }).catch((e) => console.error("Failed to update contact status:", e));

    throw error;
  }
}

const reconcilePayments = async (req, res) => {
  try {
    const { paymentIds } = req.body;

    if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment IDs provided",
      });
    }

    const results = await Promise.allSettled(
  paymentIds.map(async (orderId) => {  
    try {
      const payment = await Payment.findOne({
        orderId: orderId,  
      });

      console.log("Payment document:", {
        _id: payment?._id,
        status: payment?.status,
        orderId: payment?.orderId,
        razorpay_payment_id: payment?.razorpay_payment_id,
      });

      if (!payment) {
        console.log(
          `❌ Skipping: Order ${orderId} not found in database`
        );
        return {
          orderId,  
          status: "skipped",
          reason: "Not found",
        };
      }

      if (!["Failed", "Pending"].includes(payment.status)) {
        console.log(
          `❌ Skipping: Payment status is ${payment.status} (expected Failed/Pending)`
        );
        return {
          orderId,  // Changed from paymentId to orderId
          status: "skipped",
          reason: `Status is ${payment.status}`,
        };
      }

      if (!payment.razorpay_payment_id) {
        console.log(
          `⚠️ No Razorpay payment ID found for order ${orderId}, will try to fetch by order ID`
        );
      }

      let rzpPayment;
      
      try {
        if (payment.razorpay_payment_id) {
          console.log(
            `🔍 Fetching Razorpay payment by ID: ${payment.razorpay_payment_id}`
          );
          rzpPayment = await razorpay.payments.fetch(payment.razorpay_payment_id);
        } else {
          console.log(
            `🔍 Fetching Razorpay payments for order: ${orderId}`
          );
          const payments = await razorpay.orders.fetchPayments(orderId);
          rzpPayment = payments.items[0]; 
          
          if (rzpPayment) {
            await Payment.updateOne(
              { orderId },
              { $set: { razorpay_payment_id: rzpPayment.id } }
            );
          }
        }

        if (!rzpPayment) {
          throw new Error("No payment found in Razorpay");
        }

        console.log("Razorpay Payment Details:", {
          id: rzpPayment.id,
          status: rzpPayment.status,
          amount: rzpPayment.amount / 100,
          currency: rzpPayment.currency,
          captured: rzpPayment.captured,
          method: rzpPayment.method,
          created_at: new Date(rzpPayment.created_at * 1000).toISOString(),
        });

        if (rzpPayment.amount !== payment.amount * 100) {
          console.log(
            `❌ Amount mismatch (Razorpay: ${rzpPayment.amount / 100}, DB: ${
              payment.amount
            })`
          );
          return {
            orderId,  
            status: "failed",
            reason: `Amount mismatch (Razorpay: ${
              rzpPayment.amount / 100
            }, DB: ${payment.amount})`,
          };
        }

        if (rzpPayment.status === "captured") {
          console.log(
            `✅ Payment captured at Razorpay - proceeding with reconciliation`
          );
          await handleSuccessfulReconciliation(payment);
          return {
            orderId,  
            status: "success",
            amount: rzpPayment.amount / 100,
            currency: rzpPayment.currency,
            razorpay_payment_id: rzpPayment.id, 
          };
        } else {
          console.log(
            `❌ Razorpay status is ${rzpPayment.status} (expected "captured")`
          );
          return {
            orderId,
            status: "failed",
            reason: `Razorpay status: ${rzpPayment.status}`,
            gatewayStatus: rzpPayment.status,
          };
        }
      } catch (rzpError) {
        console.error(`🔥 Razorpay fetch error for order ${orderId}:`, rzpError);
        return {
          orderId,
          status: "error",
          error: rzpError.message,
          stack: rzpError.stack,
        };
      }
    } catch (err) {
      console.error(`🔥 Error processing order ${orderId}:`, err);
      return {
        orderId,  
        status: "error",
        error: err.message,
        stack: err.stack,
      };
    }
  })
);

const succeeded = results.filter(
  (r) => r.status === "fulfilled" && r.value.status === "success"
);
const failed = results.filter(
  (r) => r.status === "fulfilled" && r.value.status === "failed"
);
const skipped = results.filter(
  (r) => r.status === "fulfilled" && r.value.status === "skipped"
);
const errors = results.filter((r) => r.status === "rejected");

const response = {
  success: true,
  summary: {
    total: paymentIds.length,
    succeeded: succeeded.length,
    failed: failed.length,
    skipped: skipped.length,
    errors: errors.length,
  },
  details: {
    succeeded: succeeded.map((r) => r.value),
    failed: failed.map((r) => r.value),
    skipped: skipped.map((r) => r.value),
    errors: errors.map((r) => r.reason),
  },
};

    console.log("Reconciliation completed:", JSON.stringify(response.summary));
    res.json(response);
  } catch (error) {
    console.error("Bulk reconciliation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reconcile payments",
      error: error.message,
    });
  }
};
// Retry a specific failed payment
const retryFailedPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const failedPayment = await FailedPayment.findById(paymentId);

    if (!failedPayment) {
      return res.status(404).json({
        success: false,
        message: "Failed payment record not found",
      });
    }

    if (failedPayment.resolved) {
      return res.status(400).json({
        success: false,
        message: "This payment has already been resolved",
      });
    }

    // Different handling based on context
    if (failedPayment.context === "order_bump_processing") {
      // Retry creating order bump payments
      await Payment.create(failedPayment.paymentData);

      await FailedPayment.findByIdAndUpdate(paymentId, {
        resolved: true,
        resolutionNotes: "Successfully retried order bump processing",
      });

      return res.json({
        success: true,
        message: "Order bump payment successfully retried",
      });
    } else if (failedPayment.context === "failed_payment_logging") {
      // Retry logging the failed payment
      await Payment.findOneAndUpdate(
        { orderId: failedPayment.orderId },
        failedPayment.paymentData,
        { upsert: true }
      );

      await FailedPayment.findByIdAndUpdate(paymentId, {
        resolved: true,
        resolutionNotes: "Successfully logged failed payment",
      });

      return res.json({
        success: true,
        message: "Failed payment successfully logged",
      });
    }

    // Default case - mark as manually resolved
    await FailedPayment.findByIdAndUpdate(paymentId, {
      resolved: true,
      resolutionNotes: "Manually resolved by admin",
    });

    res.json({
      success: true,
      message: "Payment marked as resolved",
    });
  } catch (error) {
    console.error("Failed payment retry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retry payment processing",
    });
  }
};

// Get detailed payment information
const getPaymentDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const payment = await Payment.findOne({ orderId })
      .populate("productId")
      .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    let rzpPayment = null;
    if (payment.razorpay_payment_id) {
      try {
        rzpPayment = await razorpay.payments.fetch(payment.razorpay_payment_id);
      } catch (rzpError) {
        console.error("Failed to fetch Razorpay payment:", rzpError);
      }
    }

    // Get user details
    const user = await User.findOne({ email: payment.email }).lean();

    res.json({
      success: true,
      data: {
        payment,
        rzpPayment,
        user,
      },
    });
  } catch (error) {
    console.error("Failed to get payment details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve payment details",
    });
  }
};

module.exports = {
  getPaymentSummary,
  reconcilePayments,
  getFailedPayments,
  retryFailedPayment,
  getPaymentDetails,
};
