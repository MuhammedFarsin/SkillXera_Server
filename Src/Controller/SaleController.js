const Course = require("../Model/CourseModel");
const Payment = require("../Model/PurchaseModal");
const Contact = require("../Model/ContactModel")
const Lead = require("../Model/LeadModal")
const User = require("../Model/UserModel");
const dotenv = require("dotenv");
const crypto = require("crypto");
const axios = require("axios");
const { Cashfree } = require("cashfree-pg");
const { sendPaymentSuccessEmail } = require("../Utils/sendMail");

dotenv.config();

if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) {
  console.error("Cashfree API Keys are missing!");
  process.exit(1); // Stop server if keys are missing
}

const CASHFREE_BASE_URL = "https://sandbox.cashfree.com/pg/orders"; // Sandbox URL

const dashboard = async (req, res) => {
  try {
    // Fetch order statistics
    const totalOrders = await Payment.countDocuments();
    const totalRevenue = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Fetch leads statistics
    const totalLeads = await Lead.countDocuments();
    const leadsGraphData = await Lead.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).then((data) => data.map((item) => ({ date: item._id, count: item.count })));

    res.status(200).json({
      totalOrders,
      totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
      totalLeads,
      leadsGraphData,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error...!" });
  }
};


// Change to production when going live

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
          return_url: `http://localhost:5173/sale/payment-success?order_id=${generatedOrderId}&courseId=${courseId}`,
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
    console.log("Verifying Cashfree order...");

    const { order_id, courseId } = req.body;
    console.log("This is coming from the frontend:", courseId);

    if (!order_id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    // ✅ Fetch order details from Cashfree
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

    if (orderData && orderData.order_status === "PAID") {
      const { order_amount, customer_details, created_at } = orderData;
      const { customer_name, customer_email, customer_phone } =
        customer_details;

      let finalCourseId = courseId;

      // ✅ Determine courseId if missing
      if (!finalCourseId) {
        const existingPayment = await Payment.findOne({
          email: customer_email,
        });
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

      if (!user) {
        // ✅ If user doesn't exist, create a new user (WITHOUT PASSWORD)
        user = new User({
          username: customer_name,
          email: customer_email,
          phone: customer_phone,
          orders: [order_id], // ✅ Store the order ID
        });

        await user.save();
      } else {
        // ✅ If user exists, update their order list
        if (!user.orders.includes(order_id)) {
          user.orders.push(order_id);
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
        status: "Success",
        createdAt: created_at,
      };

      console.log("Payment Data to Save:", paymentData);

      const payment = new Payment(paymentData);
      await payment.save();

      // ✅ Send success email
      await sendPaymentSuccessEmail(
        user,
        customer_email,
        courseDetails,
        order_id
      );

      return res.json({
        message: "Payment verified and course details sent",
        status: "success",
      });
    } else {
      return res
        .status(400)
        .json({ message: "Payment verification failed", status: "failed" });
    }
  } catch (error) {
    console.error(
      "Cashfree Payment Verification Error:",
      error.response?.data || error.message || error
    );
    return res.status(500).json({ message: "Internal Server Error" });
  }
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
    console.log(req.body)
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
      // ✅ If user does not exist, create a new user (WITHOUT PASSWORD)
      user = new User({
        username: payment.username,
        email: payment.email,
        phone: payment.phone,
        orders: [order_id],
      });

      await user.save();
    }else {
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

    return res.json({ message: "Resend email successfully sent", status: "success" });
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
  dashboard
};
