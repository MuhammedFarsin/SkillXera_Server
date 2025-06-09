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
    if (!email || !status) throw new Error('Email and status are required');

    let contact = await Contact.findOne({ email });
    
    if (!contact) {
      contact = await Contact.create({
        email,
        username: userDetails.username || '',
        phone: userDetails.phone || null,
        tags: [],
        statusTag: status
      });
    }

    if (!contact.tags) {
      contact.tags = [];
      await contact.save();
    }

    const tagsToRemove = [];
    let statusTag;

    // Handle payment statuses (Success/Failed/Reconciled)
    if (status === 'Success' || status === 'Failed' || status === 'Reconciled') {
      const oppositeStatuses = 
        status === 'Success' ? ['Failed', 'Reconciled'] :
        status === 'Failed' ? ['Success', 'Reconciled'] :
        ['Success', 'Failed'];
      
      const oppositeTags = await Tag.find({ name: { $in: oppositeStatuses } });
      if (oppositeTags.length > 0) {
        tagsToRemove.push(...oppositeTags.map(tag => tag._id));
      }

      const dropOffTag = await Tag.findOne({ name: 'drop-off' });
      if (dropOffTag) tagsToRemove.push(dropOffTag._id);

      statusTag = await ensureTagExists(status);
    } 
    // Handle drop-off status
    else if (status === 'drop-off') {
      const paymentStatusTags = await Tag.find({ 
        name: { $in: ['Success', 'Failed', 'Reconciled'] } 
      });
      if (paymentStatusTags.length > 0) {
        tagsToRemove.push(...paymentStatusTags.map(tag => tag._id));
      }

      statusTag = await ensureTagExists(status);
    }

    // Remove unwanted tags
    if (tagsToRemove.length > 0) {
      await Contact.updateOne(
        { _id: contact._id },
        { $pull: { tags: { $in: tagsToRemove } } }
      );
    }

    // Update contact
    const updateData = {
      statusTag: status,
      ...(userDetails.username && { username: userDetails.username }),
      ...(userDetails.phone && { phone: userDetails.phone })
    };

    if (statusTag) {
      updateData.$addToSet = { tags: statusTag._id };
    }

    const result = await Contact.findByIdAndUpdate(
      contact._id,
      updateData,
      { new: true }
    );

    return result;
  } catch (error) {
    console.error('Error updating contact:', error);
    throw error;
  }
};