const Course = require("../Model/CourseModel");
const dotenv = require("dotenv");
const axios = require("axios");
const { Cashfree } = require("cashfree-pg");

dotenv.config();

if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) {
  console.error("Cashfree API Keys are missing!");
  process.exit(1); // Stop server if keys are missing
}

const CASHFREE_BASE_URL = "https://sandbox.cashfree.com/pg/orders"; // Sandbox URL

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
    const { amount, currency, customer_details } = req.body;

    if (!amount || !currency || !customer_details) {
      return res.status(400).json({ error: "Invalid request parameters" });
    }

    const response = await axios.post(
      `${CASHFREE_BASE_URL}`,
      {
        order_amount: amount,
        order_currency: currency,
        customer_details: {
          customer_id: customer_details.customer_id,
          customer_email: customer_details.customer_email,
          customer_phone: customer_details.customer_phone,
        },
        order_meta: {
          return_url:
            "http://localhost:5173/sale/payment-success?order_id={order_id}",
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
    });
  } catch (error) {
    console.error("Cashfree API Error:", error.response?.data || error);
    res.status(500).json({ error: "Payment initiation failed" });
  }
};

// ✅ Verify Cashfree Payment
const verifyCashfreeOrder = async (req, res) => {
  try {
    console.log("Verifying Cashfree order...");

    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const response = await axios.get(
      `https://sandbox.cashfree.com/pg/orders/${order_id}`,
      {
        headers: {
          "x-client-id": process.env.CASHFREE_CLIENT_ID,
          "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
          "x-api-version": "2022-09-01",
        },
      }
    );

    if (response.data && response.data.order_status === "PAID") {
      res.json({ message: "Payment verified successfully", status: "success" });
    } else {
      res
        .status(400)
        .json({ message: "Payment verification failed", status: "failed" });
    }
  } catch (error) {
    console.error("Cashfree Payment Verification Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  getCourseDetails,
  createCashfreeOrder,
  verifyCashfreeOrder,
};
