// contactService.js
const Contact = require('../Model/ContactModel');
const Tag = require('../Model/TagModel');

// Define the helper function first
const ensureTagExists = async (tagName) => {
  let tag = await Tag.findOne({ name: tagName });
  if (!tag) {
    tag = await Tag.create({ name: tagName });
  }
  return tag;
};

// Main exported function
exports.updateContactWithPaymentStatus = async (email, status, userDetails = {}) => {
  try {
    // Validate input
    if (!email || !status) throw new Error('Email and status are required');

    // Initialize or reset tags array if needed
    await Contact.updateOne(
      { email, $or: [{ tags: { $exists: false } }, { tags: null }] },
      { $set: { tags: [] } },
      { upsert: true }
    );

    // Prepare tags to remove
    const tagsToRemove = [];
    let statusTag;

    // Handle payment completion statuses (Success/Failed)
    if (status === 'Success' || status === 'Failed') {
      // 1. Remove opposite status tag
      const oppositeStatus = status === 'Success' ? 'Failed' : 'Success';
      const oppositeTag = await Tag.findOne({ name: oppositeStatus });
      if (oppositeTag) tagsToRemove.push(oppositeTag._id);

      // 2. Always remove drop-off tag for completed payments
      const dropOffTag = await Tag.findOne({ name: 'drop-off' });
      if (dropOffTag) tagsToRemove.push(dropOffTag._id);

      // 3. Get/create the current status tag
      statusTag = await ensureTagExists(status);
    } 
    // Handle drop-off status
    else if (status === 'drop-off') {
      // Remove payment status tags (Success/Failed)
      const successTag = await Tag.findOne({ name: 'Success' });
      const failedTag = await Tag.findOne({ name: 'Failed' });
      if (successTag) tagsToRemove.push(successTag._id);
      if (failedTag) tagsToRemove.push(failedTag._id);

      // Get/create drop-off tag
      statusTag = await ensureTagExists(status);
    }

    // Remove unwanted tags
    if (tagsToRemove.length > 0) {
      await Contact.updateOne(
        { email },
        { $pull: { tags: { $in: tagsToRemove } } }
      );
    }

    // Add new status tag and update contact details
    const result = await Contact.findOneAndUpdate(
      { email },
      { 
        $set: { 
          statusTag: status,
          ...(userDetails.username && { username: userDetails.username }),
          ...(userDetails.phone && { phone: userDetails.phone })
        },
        $addToSet: { tags: statusTag._id }
      },
      { new: true, upsert: true }
    );

    return result;
  } catch (error) {
    console.error('Error updating contact:', error);
    throw error;
  }
};