const Course = require("../Model/CourseModel");
const Payment = require("../Model/PurchaseModal")
const dotenv = require("dotenv");
const axios = require("axios");
const { Cashfree } = require("cashfree-pg");
const { sendPaymentSuccessEmail } = require("../Utils/sendMail")

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
    const { amount, currency, courseId, customer_details } = req.body;
    console.log(req.body)
    if (!amount || !currency || !courseId || !customer_details) {
      return res.status(400).json({ error: "Invalid request parameters" });
    }

    const generatedOrderId = `ORDER_${Date.now()}`;

    const response = await axios.post(
      `${CASHFREE_BASE_URL}`,
      {
        order_amount: amount, 
        order_currency: currency, 
        order_id: generatedOrderId, 
        courseId,
        customer_details: {
          customer_id: customer_details._id,
          customer_name: customer_details.username, 
          customer_email: customer_details.email,
          customer_phone: customer_details.phone,
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

    console.log('this is server response i need :',response.data.courseId);
    res.json({
      payment_session_id: response.data.payment_session_id,
      cf_order_id: response.data.order_id,
      courseId: courseId 
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

    // Fetch order details from Cashfree
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
    console.log("Cashfree Response:", orderData);

    if (orderData && orderData.order_status === "PAID") {
      const { 
        order_amount, 
        customer_details,
        created_at 
      } = orderData;

      // Extract customer details
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
        return res.status(404).json({ message: "Course ID could not be determined", status: "failed" });
      }

      // Fetch course details
      const courseDetails = await Course.findById(finalCourseId);
      if (!courseDetails) {
        return res.status(404).json({ message: "Course not found", status: "failed" });
      }

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

      await sendPaymentSuccessEmail(customer_email, courseDetails, order_id);

      return res.json({ message: "Payment verified and course details sent", status: "success" });
    } else {
      return res.status(400).json({ message: "Payment verification failed", status: "failed" });
    }
  } catch (error) {
    console.error("Cashfree Payment Verification Error:", error.response?.data || error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};



module.exports = {
  getCourseDetails,
  createCashfreeOrder,
  verifyCashfreeOrder,
};
