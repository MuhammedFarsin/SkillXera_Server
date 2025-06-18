const Course = require("../Model/CourseModel");
const Payment = require("../Model/PurchaseModal");
const Contact = require("../Model/ContactModel");
const SalesPage = require("../Model/SalesModal");
const CheckoutPage = require("../Model/CheckoutModal");
const OrderBump = require("../Model/OrderBumbModel");
const { emitNewLead } = require("../socket");
const Lead = require("../Model/LeadModal");
const User = require("../Model/UserModel");
const Tag = require("../Model/TagModel");
const DigitalProduct = require("../Model/DigitalProductModal");
const dotenv = require("dotenv");
const crypto = require("crypto");
const axios = require("axios");
const fs = require("fs");
const { Cashfree } = require("cashfree-pg");
const coursePaymentHandler = require("../Utils/PaymentHandlers/coursePaymentHandler");
const digitalProductPaymentHandler = require("../Utils/PaymentHandlers/digitalProductPaymentHandler");
const { sendPaymentSuccessEmail } = require("../utils/sendMail");
const { generateResetToken } = require("../Config/ResetToken");
const generateInvoice = require("../Utils/generateInvoice");
const razorpay = require("../Config/RazorpayConfig");
const {
  updateContactWithPaymentStatus,
} = require("../Services/contactService");
const ThankYouPage = require("../Model/ThankyouModal");

dotenv.config();

if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) {
  console.error("Cashfree API Keys are missing!");
  process.exit(1);
}

const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL;

const dashboard = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = {};

    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lt: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    const totalLeads = await Lead.countDocuments(dateFilter);
    const totalSales = await Payment.countDocuments(dateFilter);

    const ordersGraphData = await Payment.aggregate([
      { $match: { status: { $in: ["Success", "Reconciled"] }, ...dateFilter } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          totalOrders: 1,
          totalRevenue: 1,
        },
      },
    ]);

    const leadsGraphData = await Lead.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", count: 1 } },
    ]);

    const recentLeads = await Lead.find(dateFilter)
      .sort({ createdAt: -1 })
      .limit(4)
      .select("username email phone createdAt");

    const totalRevenueData = await Payment.aggregate([
      { $match: { status: { $in: ["Success", "Reconciled"] }, ...dateFilter } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
        },
      },
    ]);

    const totalRevenue =
      totalRevenueData.length > 0 ? totalRevenueData[0].totalRevenue : 0;

    res.status(200).json({
      ordersGraphData,
      leadsGraphData,
      totalLeads,
      totalSales,
      recentLeads,
      totalRevenue,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ message: "Internal Server Error...!" });
  }
};

const getSalesDetails = async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!["course", "digital-product"].includes(type)) {
      return res.status(400).json({ message: "Invalid type parameter" });
    }

    const kind = type === "course" ? "Course" : "DigitalProduct";

    const salesPage = await SalesPage.findOne({
      "linkedTo.kind": kind,
      "linkedTo.item": id,
    }).populate("linkedTo.item");

    if (!salesPage) {
      return res.status(404).json({ message: "Sales page not found" });
    }

    res.status(200).json(salesPage);
  } catch (error) {
    console.error("Error fetching sales page:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const createCashfreeOrder = async (req, res) => {
  try {
    const { amount, currency, courseId, customer_details } = req.body;

    if (!amount || !currency || !courseId || !customer_details) {
      return res.status(400).json({ error: "Invalid request parameters" });
    }

    const { username, email, phone } = customer_details;

    // Check if the lead already exists
    let lead = await Lead.findOne({ email, courseId });

    if (!lead) {
      // Create a new lead if not exists
      lead = await Lead.create({ username, email, phone, courseId });

      // Emit socket event for new lead
      emitNewLead({
        _id: lead._id,
        username,
        email,
        phone,
        courseId,
        createdAt: lead.createdAt,
      });
    }

    // 🔍 Check for existing Contact
    let dropOffTag = await Tag.findOne({ name: "drop-off" });
    if (!dropOffTag) {
      dropOffTag = await Tag.create({ name: "drop-off" });
    }

    // 🔍 Check for existing Contact
    let contact = await Contact.findOne({ email });
    if (!contact) {
      contact = await Contact.create({
        username,
        email,
        phone,
        statusTag: "drop-off",
        tags: [dropOffTag._id],
      });
    }

    // Generate a unique order ID
    const generatedOrderId = `ORDER_${Date.now()}`;

    const response = await axios.post(
      `${CASHFREE_BASE_URL}`,
      {
        order_amount: amount,
        order_currency: currency,
        order_id: generatedOrderId,
        courseId,
        customer_details: {
          customer_id: `CF_${Date.now()}`,
          customer_name: username,
          customer_email: email,
          customer_phone: phone,
        },
        order_meta: {
          return_url: `${process.env.FRONTEND_URL}/payment-success?order_id=${generatedOrderId}&courseId=${courseId}&email=${email}&gateway=cashfree`,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": process.env.CASHFREE_CLIENT_ID,
          "X-Client-Secret": process.env.CASHFREE_CLIENT_SECRET,
          "x-api-version": "2022-09-01",
        },
      }
    );

    res.json({
      payment_session_id: response.data.payment_session_id,
      cf_order_id: response.data.order_id,
      courseId: courseId,
    });
  } catch (error) {
    console.error("Cashfree API Error:", error.response?.data || error);
    res.status(500).json({ error: "Payment initiation failed" });
  }
};

const verifyCashfreeOrder = async (req, res) => {
  try {
    const { order_id, courseId, email } = req.body;
    if (!order_id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const existingPayment = await Payment.findOne({
      email,
      courseId,
      status: "Success",
    });

    if (existingPayment) {
      return res.status(201).json({
        status: "already_paid",
        message: "You have already purchased this course.",
        payment: existingPayment,
      });
    }

    const response = await axios.get(
      `https://sandbox.cashfree.com/pg/orders/${order_id}`,
      {
        headers: {
          accept: "application/json",
          "x-client-id": process.env.CASHFREE_CLIENT_ID,
          "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
          "x-api-version": "2022-09-01",
        },
      }
    );

    const orderData = response.data;
    const paymentStatus = orderData?.order_status;
    const isPaymentSuccess = paymentStatus === "PAID";
    const { order_amount, customer_details, created_at } = orderData;
    const { customer_name, customer_email, customer_phone } = customer_details;

    let finalCourseId = courseId;

    if (!finalCourseId) {
      const existingPayment = await Payment.findOne({ email: customer_email });
      if (existingPayment) {
        finalCourseId = existingPayment.courseId;
      }
      if (!finalCourseId) {
        const matchedCourse = await Course.findOne({ price: order_amount });
        if (matchedCourse) {
          finalCourseId = matchedCourse._id.toString();
        }
      }
    }

    if (!finalCourseId) {
      return res.status(404).json({
        message: "Course ID could not be determined",
        status: "failed",
      });
    }

    const courseDetails = await Course.findById(finalCourseId);
    if (!courseDetails) {
      return res
        .status(404)
        .json({ message: "Course not found", status: "failed" });
    }

    let user = await User.findOne({ email: customer_email });

    let resetLink = null;
    if (!user) {
      user = new User({
        username: customer_name,
        email: customer_email,
        phone: customer_phone,
        orders: isPaymentSuccess ? [order_id] : [],
      });

      await user.save();
    } else {
      if (isPaymentSuccess && !user.orders.includes(order_id)) {
        user.orders.push(order_id);
        await user.save();
      }
    }

    if (!user.password) {
      const resetToken = await generateResetToken(user);
      if (resetToken) {
        resetLink = `${process.env.FRONTEND_URL}/set-password?token=${resetToken}&email=${customer_email}`;
        await user.save();
      }
    }

    // ✅ Save payment details
    const paymentData = {
      username: customer_name,
      email: customer_email,
      phone: customer_phone,
      courseId: finalCourseId,
      amount: order_amount,
      orderId: order_id,
      status: isPaymentSuccess ? "Success" : "Failed",
      createdAt: created_at,
      paymentMethod: "Cashfree",
      courseSnapshot: {
        courseId: courseDetails._id,
        title: courseDetails.title,
        description: courseDetails.description,
        images: courseDetails.images,
        route: courseDetails.route,
        buyCourse: courseDetails.buyCourse,
        regularPrice: courseDetails.regularPrice,
        salesPrice: courseDetails.salesPrice,
        modules: courseDetails.modules.map((module) => ({
          title: module.title,
          lectures: module.lectures.map((lecture) => ({
            title: lecture.title,
            description: lecture.description,
            videoUrl: lecture.videoUrl,
            resources: lecture.resources,
            duration: lecture.duration,
          })),
        })),
      },
    };

    const payment = new Payment(paymentData);
    await payment.save();

    // ✅ Update Contact status
    // ✅ Update Contact status and tags
    const contact = await Contact.findOne({ email: customer_email });

    if (contact) {
      contact.statusTag = isPaymentSuccess ? "Success" : "Failed";

      // ✅ Ensure tags array exists
      if (!Array.isArray(contact.tags)) {
        contact.tags = [];
      }

      // ✅ Fetch or Create required tags
      let failedTag = await Tag.findOne({ name: "Failed" });
      if (!failedTag) {
        failedTag = await Tag.create({ name: "Failed" });
      }

      let successTag = await Tag.findOne({ name: "Success" });
      if (!successTag) {
        successTag = await Tag.create({ name: "Success" });
      }

      let dropOffTag = await Tag.findOne({ name: "drop-off" });

      // ✅ Remove "Drop-off" tag if it exists
      if (dropOffTag) {
        contact.tags = contact.tags.filter(
          (tag) => tag.toString() !== dropOffTag._id.toString()
        );
      }

      if (isPaymentSuccess) {
        // ✅ Remove "Failed" tag and add "Success"
        contact.tags = contact.tags.filter(
          (tag) => tag.toString() !== failedTag._id.toString()
        );

        if (!contact.tags.includes(successTag._id.toString())) {
          contact.tags.push(successTag._id);
        }
      } else {
        // ✅ Remove "Success" tag and add "Failed"
        contact.tags = contact.tags.filter(
          (tag) => tag.toString() !== successTag._id.toString()
        );

        if (!contact.tags.includes(failedTag._id.toString())) {
          contact.tags.push(failedTag._id);
        }
      }

      await contact.save();
    }
    const invoicePath = await generateInvoice(payment, courseDetails);

    if (!fs.existsSync(invoicePath)) {
      console.error("❌ Invoice file is missing:", invoicePath);
    } else {
      console.log("✅ Invoice file exists, proceeding with email...");
    }

    // ✅ Send success email only for successful payments
    if (isPaymentSuccess) {
      await sendPaymentSuccessEmail(
        user,
        customer_email,
        courseDetails,
        order_id,
        invoicePath
      );

      // ✅ Send Facebook Pixel Purchase Event
      const fbPixelData = {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: `${process.env.FRONTEND_URL}/payment-success`,
        user_data: {
          em: [hash(customer_email)],
          ph: [hash(customer_phone)],
        },
        custom_data: {
          value: order_amount,
          currency: "INR",
          order_id: order_id,
          content_name: courseDetails.title,
          content_ids: [finalCourseId],
          content_type: "product",
        },
        action_source: "website",
      };

      const fbResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${process.env.FB_PIXEL_ID}/events?access_token=${process.env.FB_ACCESS_TOKEN}`,
        { data: [fbPixelData] }
      );

      console.log("Facebook Pixel Response:", fbResponse.data);
    }

    return res.json({
      message: isPaymentSuccess
        ? "Payment verified, courseDetails details sent, and event tracked"
        : "Payment verification failed",
      status: isPaymentSuccess ? "success" : "failed",
      payment,
      user,
      resetLink,
    });
  } catch (error) {
    console.error(
      "Cashfree Payment Verification Error:",
      error.response?.data || error.message || error
    );
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
const SaleCreateCashfreeOrder = async (req, res) => {
  try {
    const { amount, currency, productId, type, customer_details, orderBumps } =
      req.body;
    const {
      customer_name: username,
      customer_email: email,
      customer_phone: phone,
    } = customer_details || {};
    if (
      !amount ||
      !currency ||
      !productId ||
      !username ||
      !email ||
      !phone ||
      !["course", "digitalProduct"].includes(type)
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    if (amount < 100) {
      return res.status(400).json({
        success: false,
        error: "Amount must be at least ₹1",
      });
    }

    // Handle lead creation
    let lead = await Lead.findOne({ email, productId, type });
    if (!lead) {
      lead = await Lead.create({
        username,
        email,
        phone,
        productId,
        type,
      });
      emitNewLead({
        _id: lead._id,
        username,
        email,
        phone,
        productId,
        type,
        createdAt: lead.createdAt,
      });
    }

    // Update contact system
    await updateContactWithPaymentStatus(email, "drop-off", {
      username,
      phone,
    });

    // Generate unique order ID
    const orderId = `CF_ORDER_${Date.now()}_${Math.floor(
      Math.random() * 1000
    )}`;

    // Create Cashfree order
    const response = await axios.post(
      CASHFREE_BASE_URL,
      {
        order_amount: amount,
        order_currency: currency,
        order_id: orderId,
        customer_details: {
          customer_id: `CF_CUST_${Date.now()}`,
          customer_name: username,
          customer_email: email,
          customer_phone: phone,
        },
        order_meta: {
           return_url: `${req.body.return_url}`
        },
        order_note: JSON.stringify({
          email,
          productId,
          orderBumps: orderBumps || [],
        }),
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": process.env.CASHFREE_CLIENT_ID,
          "X-Client-Secret": process.env.CASHFREE_CLIENT_SECRET,
          "x-api-version": "2022-09-01",
        },
        timeout: 10000,
      }
    );

    if (!response.data || !response.data.payment_session_id) {
      return res.status(500).json({
        success: false,
        error: "Failed to create Cashfree order",
      });
    }

    // Get product details
    const ProductModel = type === "course" ? Course : DigitalProduct;
    const product = await ProductModel.findById(productId).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    const productSnapshot = {
      title: product.title || product.name,
      description: product.description,
      regularPrice: product.regularPrice || product.price,
      salesPrice: product.salesPrice || product.price,
    };

    if (type === "course") {
      productSnapshot.modules = product.modules || [];
      productSnapshot.route = product.route;
      productSnapshot.buyCourse = product.buyCourse;
      productSnapshot.images = product.images || [];
    } else {
      productSnapshot.contentType = product.fileUrl ? "file" : "link";
      productSnapshot.fileUrl = product.fileUrl || undefined;
      productSnapshot.externalUrl = product.externalUrl || undefined;
    }

    await Payment.create({
      username,
      email,
      phone: Number(phone),
      amount,
      orderId,
      productId,
      type,
      paymentMethod: "Cashfree",
      status: "Pending",
      productSnapshot,
      metadata: {
        cf_session_id: response.data.payment_session_id,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        id: response.data.order_id,
        payment_session_id: response.data.payment_session_id,
        amount: response.data.order_amount,
        currency: response.data.order_currency,
      },
    });
  } catch (error) {
    console.error("Cashfree order creation error:", {
      message: error.message,
      response: error.response?.data,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      publicMessage: "Payment initiation failed. Please try again.",
    });
  }
};

const SaleVerifyCashfreeOrder = async (req, res) => {
  let paymentRecord;
  try {
    const { order_id, productId, type } = req.body;
    console.log(req.body);

    // Basic validation
    if (!order_id || !productId || !["course", "digitalProduct"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment details",
      });
    }

    paymentRecord = await Payment.findOne({ orderId: order_id });
    if (!paymentRecord) {
      throw new Error("Payment record not found in database");
    }

    const response = await axios.get(`${CASHFREE_BASE_URL}/${order_id}`, {
      headers: {
        accept: "application/json",
        "x-client-id": process.env.CASHFREE_CLIENT_ID,
        "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
        "x-api-version": "2022-09-01",
      },
      timeout: 10000,
    });

    const orderData = response.data;
    const paymentStatus = orderData?.order_status;
    const isPaymentSuccess = paymentStatus === "PAID";

    let isCaptured = false;
    let captureDetails = null;
    try {
      const paymentsResponse = await axios.get(
        `https://sandbox.cashfree.com/pg/orders/${order_id}/payments`,
        {
          headers: {
            accept: "application/json",
            "x-client-id": process.env.CASHFREE_CLIENT_ID,
            "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
            "x-api-version": "2022-09-01",
          },
        }
      );
      isCaptured = paymentsResponse.data.some(p => p.payment_status === 'SUCCESS');
      if (isCaptured) {
        captureDetails = paymentsResponse.data.find(p => p.payment_status === 'SUCCESS');
      }
    } catch (e) {
      console.error("Error checking payment capture status:", e);
    }

    // Handle captured but failed verification
    if (isCaptured && !isPaymentSuccess) {
      await Payment.updateOne(
        { orderId: order_id },
        {
          $set: {
            status: "CapturedButFailed",
            capturedAt: new Date(),
            failureReason: "Payment captured but verification failed",
            requiresReconciliation: true,
            updatedAt: new Date(),
          },
        }
      );

      await logFailedPayment({
        orderId: order_id,
        gateway: 'cashfree',
        paymentId: captureDetails?.cf_payment_id,
        productId,
        productType: type === 'course' ? 'course' : 'digitalProduct',
        amount: paymentRecord.amount,
        error: new Error(`Payment captured but verification failed. Status: ${paymentStatus}`),
        context: "order_verification",
        customer: {
          email: paymentRecord.email,
          phone: paymentRecord.phone,
          username: paymentRecord.username,
        },
        paymentData: {
          originalStatus: paymentStatus,
          isCaptured: true,
          capturedAmount: paymentRecord.amount,
          gatewayResponse: orderData,
          captureDetails,
        },
      });

      return res.status(400).json({
        success: false,
        status: "captured_but_failed",
        message: "Payment received but processing failed. Support has been notified.",
        contactSupport: true,
      });
    }

    // Verify amount matches
    if (orderData.order_amount !== paymentRecord.amount) {
      await Payment.updateOne(
        { orderId: order_id },
        {
          $set: {
            status: isCaptured ? "CapturedButFailed" : "Failed",
            failureReason: `Amount mismatch (expected ${paymentRecord.amount}, got ${orderData.order_amount})`,
            requiresReconciliation: isCaptured,
            updatedAt: new Date(),
          },
        }
      );

      await logFailedPayment({
        orderId: order_id,
        gateway: 'cashfree',
        paymentId: captureDetails?.cf_payment_id,
        productId,
        productType: type === 'course' ? 'course' : 'digitalProduct',
        amount: paymentRecord.amount,
        error: new Error(`Amount mismatch (expected ${paymentRecord.amount}, got ${orderData.order_amount})`),
        context: "amount_verification",
        customer: {
          email: paymentRecord.email,
          phone: paymentRecord.phone,
          username: paymentRecord.username,
        },
        paymentData: {
          isCaptured,
          expectedAmount: paymentRecord.amount,
          receivedAmount: orderData.order_amount,
          gatewayResponse: orderData,
          captureDetails,
        },
      });

      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch",
        requiresReconciliation: isCaptured,
      });
    }

    // Parse order notes
    let notes = {};
    try {
      if (orderData.order_note) {
        let jsonStr = orderData.order_note;
        if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
          jsonStr = jsonStr.slice(1, -1);
        }
        const decodedNotes = jsonStr
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        notes = JSON.parse(decodedNotes);
      }
    } catch (e) {
      console.error("Failed to parse order notes:", {
        originalNote: orderData.order_note,
        error: e.message,
      });
    }
    const orderBumps = notes.orderBumps || [];

    // Update payment record
    const updatedPayment = await Payment.findOneAndUpdate(
      { orderId: order_id },
      {
        $set: {
          status: "Success",
          paidAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            ...paymentRecord.metadata,
            cf_payment_status: paymentStatus,
            cf_transaction_id: orderData.cf_payment_id,
          },
        },
      },
      { new: true }
    );

    if (paymentRecord.productType === "Course") {
      return await coursePaymentHandler.handleCoursePayment({
        order_id,
        payment_id: orderData.cf_payment_id,
        gateway: "cashfree",
        productId,
        username: notes.username || paymentRecord.username,
        email: notes.email || paymentRecord.email,
        phone: notes.phone || paymentRecord.phone,
        amount: paymentRecord.amount,
        orderBumps,
        payment: updatedPayment,
        res,
      });
    } else {
      return await handleDigitalProductPayment({
        order_id,
        payment_id: orderData.cf_payment_id,
        gateway: "cashfree",
        productId,
        username: notes.username || paymentRecord.username,
        email: notes.email || paymentRecord.email,
        phone: notes.phone || paymentRecord.phone,
        amount: paymentRecord.amount,
        orderBumps,
        payment: updatedPayment,
        res,
      });
    }
  } catch (error) {
    console.error("Cashfree payment verification error:", {
      message: error.message,
      stack: error.stack,
      orderId: req.body.order_id,
    });

    let isCaptured = false;
    let captureDetails = null;
    try {
      const paymentsResponse = await axios.get(
        `https://sandbox.cashfree.com/pg/orders/${req.body.order_id}/payments`,
        {
          headers: {
            accept: "application/json",
            "x-client-id": process.env.CASHFREE_CLIENT_ID,
            "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
            "x-api-version": "2022-09-01",
          },
        }
      );
      isCaptured = paymentsResponse.data.some(p => p.payment_status === 'SUCCESS');
      if (isCaptured) {
        captureDetails = paymentsResponse.data.find(p => p.payment_status === 'SUCCESS');
      }
    } catch (e) {
      console.error("Final capture check failed:", e);
    }

    if (isCaptured) {
      await Payment.updateOne(
        { orderId: req.body.order_id },
        {
          $set: {
            status: "CapturedButErrored",
            capturedAt: new Date(),
            failureReason: error.message,
            requiresReconciliation: true,
            updatedAt: new Date(),
          },
        }
      );
    }

    await logFailedPayment({
      orderId: req.body.order_id,
      gateway: 'cashfree',
      paymentId: captureDetails?.cf_payment_id,
      productId: req.body.productId,
      productType: req.body.type === 'course' ? 'course' : 'digitalProduct',
      amount: paymentRecord?.amount || req.body.amount,
      error: error,
      context: isCaptured ? "captured_but_errored" : "payment_verification",
      customer: paymentRecord
        ? {
            email: paymentRecord.email,
            phone: paymentRecord.phone,
            username: paymentRecord.username,
          }
        : {
            email: req.body.email,
            phone: req.body.phone,
          },
      paymentData: {
        isCaptured,
        captureDetails,
        errorDetails: error.stack,
      },
    });

    return res.status(500).json({
      success: false,
      message: "Payment processing failed",
      error: error.message,
      publicMessage:
        "We encountered an issue verifying your payment. Please contact support.",
      requiresReconciliation: isCaptured,
    });
  }
};

const hash = (data) => {
  return crypto.createHash("sha256").update(data).digest("hex");
};
const getPayments = async (req, res) => {
  try {
    const paymentData = await Payment.find();

    if (!paymentData) {
      res.status(400).json({ message: "No course found...!" });
    }

    res.status(200).json({ payment: paymentData });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ message: "No valid contacts selected for deletion." });
    }

    await Payment.deleteMany({ _id: { $in: ids } });

    res.status(200).json({ message: "Contacts deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error...!" });
  }
};

const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, currency, courseId, customer_details } = req.body;

    // 🛑 Improved Validation
    if (
      typeof amount !== "number" ||
      !currency ||
      !courseId ||
      !customer_details
    ) {
      return res.status(400).json({ error: "Invalid request parameters" });
    }

    const { username, email, phone } = customer_details;
    console.log(customer_details);

    // 🔍 Check for existing Lead
    let lead = await Lead.findOne({ email, courseId });

    if (!lead) {
      // Create a new lead if not exists
      lead = await Lead.create({ username, email, phone, courseId });

      // Emit socket event for new lead
      emitNewLead({
        _id: lead._id,
        username,
        email,
        phone,
        courseId,
        createdAt: lead.createdAt,
      });
    }

    // 🔍 Check for existing Contact
    let dropOffTag = await Tag.findOne({ name: "drop-off" });
    if (!dropOffTag) {
      dropOffTag = await Tag.create({ name: "drop-off" });
    }

    // 🔍 Check for existing Contact
    let contact = await Contact.findOne({ email });
    if (!contact) {
      contact = await Contact.create({
        username,
        email,
        phone,
        statusTag: "drop-off",
        tags: [dropOffTag._id],
      });
    }

    // 💰 Convert amount to paise
    const amountInPaise = Math.round(amount * 100);

    // 🛒 Create Razorpay Order
    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        username,
        email,
        phone,
        courseId,
      },
    };

    const order = await razorpay.orders.create(options);
    console.log("✅ Order:", order);

    res.status(200).json({ data: order });
  } catch (error) {
    console.error("❌ Razorpay Error:", error); // Log full error
    res
      .status(500)
      .json({ error: error?.error?.description || "Internal Server Error" });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      courseId,
    } = req.body;
    console.log(req.body);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Payment Details" });
    }

    const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
    console.log("✅ Razorpay Order Details:", razorpayOrder);

    const { username, email } = razorpayOrder.notes;
    const phone = Number(razorpayOrder.notes.phone);

    // ✅ Generate & verify signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET_ID)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isPaymentSuccess = generated_signature === razorpay_signature;

    // ✅ Fetch course details
    const courseDetails = await Course.findById(courseId);
    if (!courseDetails) {
      return res
        .status(404)
        .json({ message: "Course not found", status: "failed" });
    }

    // ✅ Check if the user exists
    let user = await User.findOne({ email });
    let resetLink = null;

    if (!user) {
      user = new User({ username, email, phone, orders: [] });
      await user.save();
    }

    // ✅ Handle **FAILED** payments
    if (!isPaymentSuccess) {
      console.log(
        "❌ Payment verification failed for order:",
        razorpay_order_id
      );

      // Save failed payment details
      const failedPayment = new Payment({
        username,
        email,
        phone,
        courseId,
        amount: courseDetails.regularPrice,
        orderId: razorpay_order_id,
        status: "Failed",
        createdAt: new Date(),
        paymentMethod: "Razorpay",
        courseSnapshot: {
          courseId: courseDetails._id,
          title: courseDetails.title,
          description: courseDetails.description,
          images: courseDetails.images,
          route: courseDetails.route,
          buyCourse: courseDetails.buyCourse,
          regularPrice: courseDetails.regularPrice,
          salesPrice: courseDetails.salesPrice,
          modules: courseDetails.modules.map((module) => ({
            title: module.title,
            lectures: module.lectures.map((lecture) => ({
              title: lecture.title,
              description: lecture.description,
              videoUrl: lecture.videoUrl,
              resources: lecture.resources,
              duration: lecture.duration,
            })),
          })),
        },
      });

      await failedPayment.save();

      // Fetch the "Drop-off" tag
      let failedTag = await Tag.findOne({ name: "Failed" });
      if (!failedTag) {
        failedTag = await Tag.create({ name: "Failed" });
      }
      let dropOffTag = await Tag.findOne({ name: "drop-off" });

      // Fetch or create the "Failed" tag

      // ✅ Update contact status and tag
      const contact = await Contact.findOne({ email });

      if (contact) {
        contact.statusTag = "Failed";

        if (!Array.isArray(contact.tags)) {
          contact.tags = [];
        }

        if (dropOffTag) {
          contact.tags = contact.tags.filter(
            (tag) => tag.toString() !== dropOffTag._id.toString()
          );
        }

        if (!contact.tags.includes(failedTag._id)) {
          contact.tags.push(failedTag._id);
        }

        await contact.save();
      }

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
        status: "failed",
        payment: failedPayment,
      });
    }

    const existingPayment = await Payment.findOne({
      email,
      courseId,
      status: "Success",
    });

    if (existingPayment) {
      return res.status(201).json({
        status: "already_paid",
        message: "You have already purchased this course.",
        payment: existingPayment,
      });
    }

    // ✅ Save successful payment
    const payment = new Payment({
      username,
      email,
      phone,
      courseId,
      amount: courseDetails.regularPrice,
      orderId: razorpay_order_id,
      status: "Success",
      createdAt: new Date(),
      paymentMethod: "Razorpay",
      courseSnapshot: {
        courseId: courseDetails._id,
        title: courseDetails.title,
        description: courseDetails.description,
        images: courseDetails.images,
        route: courseDetails.route,
        buyCourse: courseDetails.buyCourse,
        regularPrice: courseDetails.regularPrice,
        salesPrice: courseDetails.salesPrice,
        modules: courseDetails.modules.map((module) => ({
          title: module.title,
          lectures: module.lectures.map((lecture) => ({
            title: lecture.title,
            description: lecture.description,
            videoUrl: lecture.videoUrl,
            resources: lecture.resources,
            duration: lecture.duration,
          })),
        })),
      },
    });

    await payment.save();

    // ✅ Update user's orders
    if (!user.orders.includes(razorpay_order_id)) {
      user.orders.push(razorpay_order_id);
      await user.save();
    }

    // ✅ Generate reset password link if user has no password
    if (!user.password) {
      const resetToken = await generateResetToken(user);
      if (resetToken) {
        resetLink = `${process.env.FRONTEND_URL}/set-password?token=${resetToken}&email=${email}`;
        await user.save();
      }
    }

    // Fetch the "Success" tag
    let successTag = await Tag.findOne({ name: "Success" });
    if (!successTag) {
      successTag = await Tag.create({ name: "Success" });
    }

    // Fetch the "Drop-off" tag
    let dropOffTag = await Tag.findOne({ name: "drop-off" });

    const contact = await Contact.findOne({ email });

    if (contact) {
      contact.statusTag = "Success";

      // Ensure tags array exists
      if (!Array.isArray(contact.tags)) {
        contact.tags = [];
      }

      if (dropOffTag) {
        contact.tags = contact.tags.map((tag) =>
          tag.toString() === dropOffTag._id.toString() ? successTag._id : tag
        );
      }

      if (!contact.tags.includes(successTag._id)) {
        contact.tags.push(successTag._id);
      }

      await contact.save();
    }
    const invoicePath = await generateInvoice(payment, courseDetails);

    if (!fs.existsSync(invoicePath)) {
      console.error("❌ Invoice file is missing:", invoicePath);
    } else {
      console.log("✅ Invoice file exists, proceeding with email...");
    }

    // Now send the email
    await sendPaymentSuccessEmail(
      user,
      email,
      courseDetails,
      razorpay_order_id,
      invoicePath
    );

    // ✅ Track with Facebook Pixel
    const fbPixelData = {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: `${process.env.FRONTEND_URL}/payment-success`,
      user_data: {
        em: [hash(email)],
        ph: user.phone ? [hash(String(user.phone))] : [],
      },
      custom_data: {
        value: courseDetails.salesPrice,
        currency: "INR",
        order_id: razorpay_order_id,
        content_name: courseDetails.title,
        content_ids: [courseId],
        content_type: "product",
      },
      action_source: "website",
    };

    console.log("📢 Facebook Pixel Data:", fbPixelData);

    const fbResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.FB_PIXEL_ID}/events?access_token=${process.env.FB_ACCESS_TOKEN}`,
      { data: [fbPixelData] }
    );

    console.log("✅ Facebook Pixel Response:", fbResponse.data);

    return res.json({
      message: "Payment verified, course details sent, and event tracked",
      status: "success",
      payment,
      user,
      resetLink,
    });
  } catch (error) {
    console.error(
      "❌ Razorpay Payment Verification Error:",
      error.message || error
    );
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
const SaleCreateRazorpayOrder = async (req, res) => {
  try {
    // Validate input
    const { amount, currency, productId, customer_details, type, orderBumps } =
      req.body;
    const { username, email, phone } = customer_details || {};

    if (
      !amount ||
      !currency ||
      !productId ||
      !username ||
      !email ||
      !phone ||
      !type
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    if (amount < 100) {
      return res.status(400).json({
        success: false,
        error: "Amount must be at least ₹1",
      });
    }

    // Handle lead creation
    let lead = await Lead.findOne({ email, productId });
    if (!lead) {
      lead = await Lead.create({ username, email, phone, productId });
      emitNewLead({
        _id: lead._id,
        username,
        email,
        phone,
        productId,
        createdAt: lead.createdAt,
      });
    }

    // Update contact system
    await updateContactWithPaymentStatus(email, "drop-off", {
      username,
      phone,
    });

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount,
      currency,
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
      notes: {
        username,
        email,
        phone,
        productId,
        type,
        orderBumps: JSON.stringify(orderBumps || []),
      },
    });

    if (!order) {
      return res.status(500).json({
        success: false,
        error: "Failed to create Razorpay order",
      });
    }

    // Get product details
    const ProductModel = type === "course" ? Course : DigitalProduct;
    const product = await ProductModel.findById(productId).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    const productSnapshot = {
      title: product.title || product.name,
      description: product.description,
      regularPrice: product.regularPrice || product.price,
      salesPrice: product.salesPrice || product.price,
    };

    if (type === "course") {
      productSnapshot.modules = product.modules || [];
      productSnapshot.route = product.route;
      productSnapshot.buyCourse = product.buyCourse;
      productSnapshot.images = product.images || [];
    } else {
      productSnapshot.contentType = product.fileUrl ? "file" : "link";
      productSnapshot.fileUrl = product.fileUrl || undefined;
      productSnapshot.externalUrl = product.externalUrl || undefined;
    }

    // Create payment record
    await Payment.create({
      username,
      email,
      phone: Number(phone),
      amount: amount / 100,
      orderId: order.id,
      productId,
      productType: type === "course" ? "Course" : "DigitalProduct",
      paymentMethod: "Razorpay",
      status: "Pending",
      productSnapshot,
    });

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

const SaleVerifyRazorpayPayment = async (req, res) => {
  let paymentRecord;
  try {
    // Validate input
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      productId,
      type,
    } = req.body;

    // Basic validation
    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !productId ||
      !type
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment details",
      });
    }

    // 1. First find the payment record
    paymentRecord = await Payment.findOne({ orderId: razorpay_order_id });
    if (!paymentRecord) {
      throw new Error("Payment record not found in database");
    }

    // 2. Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET_ID)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      // Update payment status first
      await Payment.updateOne(
        { orderId: razorpay_order_id },
        {
          $set: {
            status: "Failed",
            failureReason: "Signature verification failed",
            updatedAt: new Date(),
          },
        }
      );

      // Then log the failure
      await coursePaymentHandler.logFailedPayment({
        orderId: razorpay_order_id,
        productId,
        productType: paymentRecord.productType,
        amount: paymentRecord.amount,
        reason: "Signature verification failed",
        context: "signature_verification",
        customer: {
          email: paymentRecord.email,
          phone: paymentRecord.phone,
          username: paymentRecord.username,
        },
      });

      return res.status(400).json({
        success: false,
        message: "Payment verification failed - invalid signature",
      });
    }

    // 3. Fetch order details from Razorpay
    const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
    const notes = razorpayOrder.notes || {};
    const orderBumps = notes.orderBumps ? JSON.parse(notes.orderBumps) : [];

    // 4. Verify payment status
    if (razorpayOrder.status !== "paid") {
      await Payment.updateOne(
        { orderId: razorpay_order_id },
        {
          $set: {
            status: "Failed",
            failureReason: "Payment not completed",
            updatedAt: new Date(),
          },
        }
      );

      await coursePaymentHandler.logFailedPayment({
        orderId: razorpay_order_id,
        productId,
        productType: paymentRecord.productType,
        amount: paymentRecord.amount,
        reason: "Payment not completed",
        context: "payment_status_check",
        customer: {
          email: paymentRecord.email,
          phone: paymentRecord.phone,
          username: paymentRecord.username,
        },
      });

      return res.status(400).json({
        success: false,
        message: "Payment not completed",
      });
    }

    // 5. Verify amount matches
    if (razorpayOrder.amount / 100 !== paymentRecord.amount) {
      await Payment.updateOne(
        { orderId: razorpay_order_id },
        {
          $set: {
            status: "Failed",
            failureReason: "Amount mismatch",
            updatedAt: new Date(),
          },
        }
      );

      await coursePaymentHandler.logFailedPayment({
        orderId: razorpay_order_id,
        productId,
        productType: paymentRecord.productType,
        amount: paymentRecord.amount,
        reason: `Amount mismatch (expected ${paymentRecord.amount}, got ${
          razorpayOrder.amount / 100
        })`,
        context: "amount_verification",
        customer: {
          email: paymentRecord.email,
          phone: paymentRecord.phone,
          username: paymentRecord.username,
        },
      });

      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch",
      });
    }

    // 6. All checks passed - update to success
    const updatedPayment = await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        $set: {
          status: "Success",
          razorpay_payment_id,
          razorpay_signature,
          paidAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (paymentRecord.productType === "Course") {
      return await coursePaymentHandler.handleCoursePayment({
        order_id: razorpay_order_id, // matches handleCoursePayment parameter name
        payment_id: razorpay_payment_id,
        productId: productId, // changed from courseId to productId
        gateway: "razorpay",
        username: notes.username || paymentRecord.username,
        email: notes.email || paymentRecord.email,
        phone: notes.phone || paymentRecord.phone,
        amount: razorpayOrder.amount / 100,
        orderBumps,
        payment: updatedPayment,
        res,
      });
    } else {
      return await handleDigitalProductPayment({
        razorpay_order_id,
        razorpay_payment_id,
        productId,
        username: notes.username || paymentRecord.username,
        email: notes.email || paymentRecord.email,
        phone: notes.phone || paymentRecord.phone,
        amount: razorpayOrder.amount / 100,
        orderBumps,
        payment: updatedPayment,
        res,
      });
    }
  } catch (error) {
    console.error("Payment verification error:", error);

    try {
      await coursePaymentHandler.logFailedPayment({
        orderId: req.body.razorpay_order_id,
        productId: req.body.productId,
        productType:
          paymentRecord?.productType ||
          (req.body.type === "course" ? "Course" : "DigitalProduct"),
        amount: paymentRecord?.amount || 0,
        reason: error.message,
        context: "payment_verification",
        customer: paymentRecord
          ? {
              email: paymentRecord.email,
              phone: paymentRecord.phone,
              username: paymentRecord.username,
            }
          : null,
        errorDetails: error.stack,
      });

      if (paymentRecord) {
        await Payment.updateOne(
          { orderId: req.body.razorpay_order_id },
          {
            $set: {
              status: "Failed",
              failureReason: error.message,
              errorDetails: error.stack,
              updatedAt: new Date(),
            },
          }
        );
      }
    } catch (logError) {
      console.error("Failed to log failed payment:", logError);
    }

    return res.status(500).json({
      success: false,
      message: "Payment processing failed",
      error: error.message,
    });
  }
};
const resendAccessCouseLink = async (req, res) => {
  try {
    const { order_id } = req.body;
    console.log(req.body);
    if (!order_id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const payment = await Payment.findOne({ _id: order_id });

    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    const user = await User.findOne({ email: payment.email });
    if (!user) {
      user = new User({
        username: payment.username,
        email: payment.email,
        phone: payment.phone,
        orders: [order_id],
      });

      await user.save();
    } else {
      if (!user.orders.includes(order_id)) {
        user.orders.push(order_id);
        await user.save();
      }
    }

    const courseDetails = await Course.findById(payment.courseId);
    if (!courseDetails) {
      return res.status(404).json({ message: "Course not found" });
    }

    await sendPaymentSuccessEmail(user, payment.email, courseDetails, order_id);

    return res.json({
      message: "Resend email successfully sent",
      status: "success",
    });
  } catch (error) {
    console.error("Error resending payment email:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const GetCheckoutPage = async (req, res) => {
  try {
    const { type, id } = req.params;

    // Validate 'type'
    const validTypes = ["course", "digital-product"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid type parameter" });
    }

    // Fetch the checkout page
    const checkoutPage = await CheckoutPage.findOne({
      "linkedTo.kind": type,
      "linkedTo.item": id,
      isActive: true,
    }).populate({
      path: "product",
      model: type === "course" ? "Course" : "DigitalProduct",
    });

    if (!checkoutPage) {
      return res.status(404).json({ error: "Checkout page not found" });
    }

    // Fetch active order bumps for the product
    const orderBumps = await OrderBump.find({
      targetProduct: id,
      targetProductModel: type === "course" ? "Course" : "DigitalProduct",
      isActive: true,
    }).populate("bumpProduct");

    res.json({
      data: {
        checkoutPage,
        product: checkoutPage.product,
        orderBumps,
      },
    });
  } catch (error) {
    console.error("Error fetching checkout page details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getThankyouPage = async (req, res) => {
  try {
    const { id, type } = req.params;

    // Validate type
    if (!["course", "digital-product"].includes(type)) {
      return res.status(400).json({
        success: false,
        error: "Invalid product type. Must be 'course' or 'digital-product'",
      });
    }

    // Find thank you page linked to this product
    const thankyouPageDetails = await ThankYouPage.findOne({
      "linkedTo.kind": type,
      "linkedTo.item": id,
    });

    if (!thankyouPageDetails) {
      console.log(`No thank you page found for ${type} with ID: ${id}`);
      return res.status(404).json({
        success: false,
        error: "Thank you page not found for this product",
      });
    }

    res.status(200).json({
      success: true,
      data: thankyouPageDetails,
    });
  } catch (error) {
    console.error("Error fetching thank you page details:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};
module.exports = {
  getSalesDetails,
  createCashfreeOrder,
  verifyCashfreeOrder,
  SaleCreateCashfreeOrder,
  SaleVerifyCashfreeOrder,
  getPayments,
  deleteTransaction,
  resendAccessCouseLink,
  dashboard,
  createRazorpayOrder,
  verifyRazorpayPayment,
  SaleCreateRazorpayOrder,
  SaleVerifyRazorpayPayment,
  GetCheckoutPage,
  getThankyouPage,
};
