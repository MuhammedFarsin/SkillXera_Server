const axios = require("axios");
const crypto = require("crypto");

const trackPurchase = async (payment, course, orderBumps = []) => {
  try {
    const accessToken = process.env.FB_PIXEL_ACCESS_TOKEN;
    const pixelId = process.env.FB_PIXEL_ID;

    const eventData = {
      event_name: "Purchase",
      event_time: Math.floor(new Date().getTime() / 1000),
      user_data: {
        em: [hashSHA256(payment.email)],
        ph: [hashSHA256(payment.phone.toString())],
      },
      custom_data: {
        currency: "INR",
        value: payment.amount,
        content_name: course.title,
        content_category: "Course",
        content_ids: [course._id.toString()],
        content_type: "product",
      },
      action_source: "website"
    };

    // Add Order Bumps
    if (orderBumps.length > 0) {
      eventData.custom_data.contents = [
        {
          id: course._id.toString(),
          quantity: 1,
          item_price: payment.amount,
        },
        ...orderBumps.map((bump) => ({
          id: bump.toString(),
          quantity: 1,
        })),
      ];
    }

    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
      {
        data: [eventData],
      }
    );

    console.log("Facebook Pixel tracked:", response.data);
  } catch (error) {
    console.error("Facebook Pixel tracking error:", error.message);
  }
};

function hashSHA256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

module.exports = { trackPurchase };
