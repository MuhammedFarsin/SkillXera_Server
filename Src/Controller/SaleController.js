const Course = require("../Model/CourseModel");
const Payment = require("../Model/PurchaseModal");
const Contact = require("../Model/ContactModel");
const Lead = require("../Model/LeadModal");
const User = require("../Model/UserModel");
const dotenv = require("dotenv");
const crypto = require("crypto");
const axios = require("axios");
const { Cashfree } = require("cashfree-pg");
const Razorpay = require("razorpay")
const { sendPaymentSuccessEmail } = require("../Utils/sendMail");
const { generateResetToken } = require("../Config/ResetToken");

dotenv.config();

const razorpay = new Razorpay({
  key_id : process.env.RAZORPAY_KEY_ID, 
  key_secret : process.env.RAZORPAY_SECRET_ID
});

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET_ID) {
  console.error("❌ Razorpay keys are missing. Check your environment variables.");
}


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
          return_url: `http://localhost:5173/payment-success?order_id=${generatedOrderId}&courseId=${courseId}&email=${email}&gateway=cashfree`,
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
      paymentMethod: "Cashfree"
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
const SaleCreateCashfreeOrder = async (req, res) => {
  try {
    console.log('this is calling')
    const { amount, currency, courseId, customer_details } = req.body;
    console.log(req.body)
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
    console.log('this is the courseId', courseId)
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
          return_url: `http://localhost:5173/sale/payment-success?order_id=${generatedOrderId}&courseId=${courseId}&email=${email}&gateway=cashfree`,
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
    console.log('this is the response ',response.data)


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

const SaleVerifyCashfreeOrder = async (req, res) => {
  try {
    console.log('is this calling')
    const { order_id, courseId, email } = req.body;
    console.log(req.body)
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
    console.log("Final Course ID:", finalCourseId);


    const courseDetails = await Course.findById(finalCourseId);
    if (!courseDetails) {
      return res
        .status(404)
        .json({ message: "Course not found", status: "failed" });
    }
    console.log(courseDetails)
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
      paymentMethod: "Cashfree"
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
          value: courseDetails.salesPrice,
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


const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, currency, courseId, customer_details } = req.body;

    // 🛑 Improved Validation
    if (typeof amount !== "number" || !currency || !courseId || !customer_details) {
      return res.status(400).json({ error: "Invalid request parameters" });
    }

    const { username, email, phone } = customer_details;
    console.log(customer_details)

    // 🔍 Check for existing Lead
    let lead = await Lead.findOne({ email, courseId });
    if (!lead) {
      lead = await Lead.create({ username, email, phone, courseId });
    }

    // 🔍 Check for existing Contact
    let contact = await Contact.findOne({ email });
    if (!contact) {
      contact = await Contact.create({ username, email, phone, statusTag: "drop-off" });
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
        courseId
      }
    };
    

    const order = await razorpay.orders.create(options);
    console.log("✅ Order:", order);

    res.status(200).json({ data: order });

  } catch (error) {
    console.error("❌ Razorpay Error Details:", error.error || error);
    res.status(500).json({ 
      error: error.error?.description || "Payment gateway error" 
    });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId } = req.body;
    console.log(req.body)

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid Payment Details" });
    }
    const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
    console.log("✅ Razorpay Order Details:", razorpayOrder);

    const { username, email } = razorpayOrder.notes;
    const phone = Number(razorpayOrder.notes.phone);



    const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET_ID)
    .update(String(razorpay_order_id) + "|" + String(razorpay_payment_id))
    .digest("hex");
  
    const isPaymentSuccess = generated_signature === razorpay_signature;
    
    if (!isPaymentSuccess) {
      return res.status(400).json({ success: false, message: "Payment Verification Failed" });
    }

    // ✅ Check if the user already paid for the course
    const existingPayment = await Payment.findOne({ email, courseId, status: "Success" });

    if (existingPayment) {
      return res.status(201).json({
        status: "already_paid",
        message: "You have already purchased this course.",
        payment: existingPayment,
      });
    }

    // ✅ Fetch course details
    const courseDetails = await Course.findById(courseId);
    if (!courseDetails) {
      return res.status(404).json({ message: "Course not found", status: "failed" });
    }

    // ✅ Check if user exists
    let user = await User.findOne({ email });

    let resetLink = null;
    if (!user) {
      user = new User({
        username,
        email,
        phone,
        orders: [razorpay_order_id],
      });

      await user.save();
    } else {
      if (!user.orders.includes(razorpay_order_id)) {
        user.orders.push(razorpay_order_id);
        await user.save();
      }
    }

    if (!user.password) {
      const resetToken = await generateResetToken(user);
      if (resetToken) {
        resetLink = `${process.env.FRONTEND_URL}/set-password?token=${resetToken}&email=${email}`;
        await user.save();
      }
    }

    // ✅ Save payment details
    const paymentData = {
      username,
      email,
      phone,
      courseId,
      amount: courseDetails.regularPrice,
      orderId: razorpay_order_id,
      status: "Success",
      createdAt: new Date(),
      paymentMethod: "Razorpay",
    };

    const payment = new Payment(paymentData);
    await payment.save();

    // ✅ Update Contact status
    const contact = await Contact.findOne({ email });
    if (contact) {
      contact.statusTag = "Success";
      await contact.save();
    }

    // ✅ Send success email
    await sendPaymentSuccessEmail(user, email, courseDetails, razorpay_order_id);

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
        value: courseDetails.regularPrice,
        currency: "INR",
        order_id: razorpay_order_id,
        content_name: courseDetails.title,
        content_ids: [courseId],
        content_type: "product",
      },
      action_source: "website",
    };
    console.log('this is the fb pixelData',fbPixelData)

    const fbResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.FB_PIXEL_ID}/events?access_token=${process.env.FB_ACCESS_TOKEN}`,
      { data: [fbPixelData] }
    );

    console.log("Facebook Pixel Response:", fbResponse.data);

    return res.json({
      message: "Payment verified, course details sent, and event tracked",
      status: "success",
      payment,
      user,
      resetLink,
    });
  } catch (error) {
    console.error("Razorpay Payment Verification Error:", error.message || error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
const SaleCreateRazorpayOrder = async (req, res) => {
  try {
    console.log('this is calling')
    const { amount, currency, courseId, customer_details } = req.body;

    // 🛑 Improved Validation
    if (typeof amount !== "number" || !currency || !courseId || !customer_details) {
      return res.status(400).json({ error: "Invalid request parameters" });
    }

    const { username, email, phone } = customer_details;
    console.log(customer_details)

    // 🔍 Check for existing Lead
    let lead = await Lead.findOne({ email, courseId });
    if (!lead) {
      lead = await Lead.create({ username, email, phone, courseId });
    }

    // 🔍 Check for existing Contact
    let contact = await Contact.findOne({ email });
    if (!contact) {
      contact = await Contact.create({ username, email, phone, statusTag: "drop-off" });
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
        courseId
      }
    };
    

    const order = await razorpay.orders.create(options);
    console.log("✅ Order:", order);

    res.status(200).json({ data: order });

  } catch (error) {
    console.error("❌ Razorpay Error Details:", error.error || error);
    res.status(500).json({ 
      error: error.error?.description || "Payment gateway error" 
    });
  }
};

const SaleVerifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId } = req.body;
    console.log(req.body)

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid Payment Details" });
    }
    const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
    console.log("✅ Razorpay Order Details:", razorpayOrder);

    const { username, email } = razorpayOrder.notes;
    const phone = Number(razorpayOrder.notes.phone);



    const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET_ID)
    .update(String(razorpay_order_id) + "|" + String(razorpay_payment_id))
    .digest("hex");
  
    const isPaymentSuccess = generated_signature === razorpay_signature;
    
    if (!isPaymentSuccess) {
      return res.status(400).json({ success: false, message: "Payment Verification Failed" });
    }

    // ✅ Check if the user already paid for the course
    const existingPayment = await Payment.findOne({ email, courseId, status: "Success" });

    if (existingPayment) {
      return res.status(201).json({
        status: "already_paid",
        message: "You have already purchased this course.",
        payment: existingPayment,
      });
    }

    // ✅ Fetch course details
    const courseDetails = await Course.findById(courseId);
    if (!courseDetails) {
      return res.status(404).json({ message: "Course not found", status: "failed" });
    }

    // ✅ Check if user exists
    let user = await User.findOne({ email });

    let resetLink = null;
    if (!user) {
      user = new User({
        username,
        email,
        phone,
        orders: [razorpay_order_id],
      });

      await user.save();
    } else {
      if (!user.orders.includes(razorpay_order_id)) {
        user.orders.push(razorpay_order_id);
        await user.save();
      }
    }

    if (!user.password) {
      const resetToken = await generateResetToken(user);
      if (resetToken) {
        resetLink = `${process.env.FRONTEND_URL}/set-password?token=${resetToken}&email=${email}`;
        await user.save();
      }
    }

    // ✅ Save payment details
    const paymentData = {
      username,
      email,
      phone,
      courseId,
      amount: courseDetails.regularPrice,
      orderId: razorpay_order_id,
      status: "Success",
      createdAt: new Date(),
      paymentMethod: "Razorpay",
    };

    const payment = new Payment(paymentData);
    await payment.save();

    // ✅ Update Contact status
    const contact = await Contact.findOne({ email });
    if (contact) {
      contact.statusTag = "Success";
      await contact.save();
    }

    // ✅ Send success email
    await sendPaymentSuccessEmail(user, email, courseDetails, razorpay_order_id);

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
    console.log('this is the fb pixelData',fbPixelData)

    const fbResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.FB_PIXEL_ID}/events?access_token=${process.env.FB_ACCESS_TOKEN}`,
      { data: [fbPixelData] }
    );

    console.log("Facebook Pixel Response:", fbResponse.data);

    return res.json({
      message: "Payment verified, course details sent, and event tracked",
      status: "success",
      payment,
      user,
      resetLink,
    });
  } catch (error) {
    console.error("Razorpay Payment Verification Error:", error.message || error);
    return res.status(500).json({ message: "Internal Server Error" });
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
    const payment = await Payment.findOne({ orderId: order_id });

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
  SaleCreateCashfreeOrder,
  SaleVerifyCashfreeOrder,
  getPayments,
  deleteTransaction,
  resendAccessCouseLink,
  dashboard,
  createRazorpayOrder,
  verifyRazorpayPayment,
  SaleCreateRazorpayOrder,
  SaleVerifyRazorpayPayment
};
