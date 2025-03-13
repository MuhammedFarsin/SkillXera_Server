const Course = require("../Model/CourseModel");
const Payment = require("../Model/PurchaseModal");
const Contact = require("../Model/ContactModel");
const Lead = require("../Model/LeadModal");
const User = require("../Model/UserModel");
const dotenv = require("dotenv");
const crypto = require("crypto");
const axios = require("axios");
const { Cashfree } = require("cashfree-pg");
const { sendPaymentSuccessEmail } = require("../Utils/sendMail");
const { generateResetToken } = require("../Config/ResetToken");

dotenv.config();

if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) {
  console.error("Cashfree API Keys are missing!");
  process.exit(1);
}

const CASHFREE_BASE_URL = "https://sandbox.cashfree.com/pg/orders"; // Sandbox URL

const dashboard = async (req, res) => {
  try {
    const totalLeads = await Lead.countDocuments();
    const totalSales = await Payment.countDocuments();
    const ordersGraphData = await Payment.aggregate([
      {
        $match: { status: "Success" },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, // Group by date
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } }, // Sort by date ascending
      {
        $project: {
          _id: 0,
          date: "$_id", // Rename _id to date
          totalOrders: 1,
          totalRevenue: 1,
        },
      },
    ]);

    const leadsGraphData = await Lead.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: 1,
        },
      },
    ]);
    const recentLeads = await Lead.find()
      .sort({ createdAt: -1 }) // Sort by latest first
      .limit(4) // Get only the last 4 leads
      .select("username email phone createdAt");

    const totalRevenueData = await Payment.aggregate([
      {
        $match: { status: "Success" },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" }, // Ensure "amount" is used
        },
      },
    ]);

    // Extract totalRevenue value safely
    const totalRevenue =
      totalRevenueData.length > 0 ? totalRevenueData[0].totalRevenue : 0;

    res.status(200).json({
      ordersGraphData, // Orders and revenue by date
      leadsGraphData, // Leads by date
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

const getCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.status(200).json(course);
  } catch (error) {
    console.error("Error fetching course details:", error);
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
    }

    // Check if the contact already exists to avoid duplicate key error
    let contact = await Contact.findOne({ email });

    if (!contact) {
      contact = new Contact({
        username,
        email,
        phone,
        statusTag: "drop-off",
      });
      await contact.save();
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
          return_url: `http://localhost:5173/sale/payment-success?order_id=${generatedOrderId}&courseId=${courseId}&email=${email}`,
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

const createCashfreeOrderCheckout = async (req, res) => {
  try {
    const { amount, currency, courseId, customer_details } = req.body;

    if (!amount || !currency || !courseId || !customer_details) {
      return res.status(400).json({ error: "Invalid request parameters" });
    }

    const { username, email, phone } = customer_details;

    // Check if the lead already exists
    let lead = await Lead.findOne({ email, courseId });

    if (!lead) {
      lead = await Lead.create({ username, email, phone, courseId });
    }

    let contact = await Contact.findOne({ email });

    if (!contact) {
      contact = new Contact({
        username,
        email,
        phone,
        statusTag: "drop-off",
      });
      await contact.save();
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
          return_url: `http://localhost:5173/payment-success?order_id=${generatedOrderId}&courseId=${courseId}&email=${email}`,
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

    // ✅ Fetch course details
    const courseDetails = await Course.findById(finalCourseId);
    if (!courseDetails) {
      return res
        .status(404)
        .json({ message: "Course not found", status: "failed" });
    }

    // ✅ Check if user exists in the database
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
      cashfree_order_id: order_id,
      status: isPaymentSuccess ? "Success" : "Failed",
      createdAt: created_at,
    };

    const payment = new Payment(paymentData);
    await payment.save();

    // ✅ Update Contact status
    const contact = await Contact.findOne({ email: customer_email });
    if (contact) {
      contact.statusTag = isPaymentSuccess ? "Success" : "failed";
      await contact.save();
    }

    // ✅ Send success email only for successful payments
    if (isPaymentSuccess) {
      await sendPaymentSuccessEmail(
        user,
        customer_email,
        courseDetails,
        order_id
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
        ? "Payment verified, course details sent, and event tracked"
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

// ✅ Hash function for user data encryption

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

const resendAccessCouseLink = async (req, res) => {
  try {
    const { order_id } = req.body;
    console.log(req.body);
    if (!order_id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    // ✅ Fetch payment details
    const payment = await Payment.findOne({ cashfree_order_id: order_id });

    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // ✅ Fetch user details
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
      // ✅ If user exists, ensure the order ID is added to their orders
      if (!user.orders.includes(order_id)) {
        user.orders.push(order_id);
        await user.save();
      }
    }

    // ✅ Fetch course details
    const courseDetails = await Course.findById(payment.courseId);
    if (!courseDetails) {
      return res.status(404).json({ message: "Course not found" });
    }

    // ✅ Resend the email
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

module.exports = {
  getCourseDetails,
  createCashfreeOrder,
  verifyCashfreeOrder,
  getPayments,
  deleteTransaction,
  resendAccessCouseLink,
  dashboard,
  createCashfreeOrderCheckout
};
