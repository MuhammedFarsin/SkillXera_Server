const Payment = require('../../Model/PurchaseModal');
const User = require('../../Model/UserModel');
const DigitalProduct = require('../../Model/DigitalProductModal');
const OrderBump = require('../../Model/OrderBumbModel');
const { updateContactTags } = require('../../Services/contactService');

exports.handle = async ({
  razorpay_order_id,
  razorpay_payment_id,
  productId,
  username,
  email,
  phone,
  amount,
  orderBumps,
  res
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find or create user
    let user = await User.findOne({ email }).session(session);
    if (!user) {
      user = new User({
        username,
        email,
        phone,
        orders: [],
      });
      await user.save({ session });
    }

    // Get digital product details
    const digitalProduct = await DigitalProduct.findById(productId).session(session);
    if (!digitalProduct) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Digital product not found",
      });
    }

    // Check for existing successful payment
    const existingPayment = await Payment.findOne({
      email,
      productId,
      status: "Success",
      productType: "DigitalProduct",
    }).session(session);

    if (existingPayment) {
      await session.abortTransaction();
      return res.status(200).json({
        success: true,
        status: "already_paid",
        message: "You have already purchased this digital product",
        payment: existingPayment,
      });
    }

    // Create payment record
    const payment = new Payment({
      username,
      email,
      phone: Number(phone),
      productId,
      productType: "DigitalProduct",
      amount,
      orderId: razorpay_order_id,
      status: "Success",
      paymentMethod: "Razorpay",
      productSnapshot: {
        title: digitalProduct.name,
        description: digitalProduct.description,
        regularPrice: digitalProduct.regularPrice,
        salesPrice: digitalProduct.salePrice,
        category: digitalProduct.category,
        fileUrl: digitalProduct.fileUrl,
        externalUrl: digitalProduct.externalUrl,
      },
    });
    await payment.save({ session });

    // Handle order bumps if any
    if (orderBumps.length > 0) {
      await processOrderBumps({
        orderBumps,
        razorpay_order_id,
        username,
        email,
        phone,
        session
      });
    }

    // Add order to user's orders
    if (!user.orders.includes(razorpay_order_id)) {
      user.orders.push(razorpay_order_id);
      await user.save({ session });
    }

    // Update contact tags
    await updateContactTags(email, "Success", session);

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Digital product payment verified successfully",
      payment,
      user,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

async function processOrderBumps({
  orderBumps,
  razorpay_order_id,
  username,
  email,
  phone,
  session
}) {
  for (const bumpId of orderBumps) {
    const bump = await OrderBump.findById(bumpId)
      .populate("bumpProduct")
      .session(session);
    
    if (bump) {
      const bumpPayment = new Payment({
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
      await bumpPayment.save({ session });
    }
  }
}