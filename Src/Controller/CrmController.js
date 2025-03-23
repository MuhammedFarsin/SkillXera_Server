const Contact = require("../Model/ContactModel");
const Tag = require("../Model/TagModel");
const mongoose = require("mongoose")
const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find()
  .populate({
    path: "user",
    select: "isAdmin", // Fetch only the isAdmin field
  })
  .populate("tags", "name");

// Filter contacts where the user is either null or not an admin
const nonAdminContacts = contacts.filter(contact => !contact.user || !contact.user.isAdmin);

res.status(200).json(nonAdminContacts);

  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ message: "Internal Server Error..." });
  }
};

const getContactsDetails = async (req, res) => {
  try {
    const { id } = req.params
    const contact = await Contact.findById(id);

    // If contact not found
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    // Return contact details
    res.status(200).json(contact);
    
  } catch (error) {
    res.status(500).json({ message : "Internal Server Error..." })
  }
}


const addContact = async (req, res) => {
  try {
      const { username, email, phone, tags, user } = req.body;

      // Validate provided tags
      const validTags = await Tag.find({ _id: { $in: tags } });

      if (validTags.length !== tags.length) {
          return res.status(400).json({ message: "One or more invalid tags provided." });
      }

      // Create new contact
      const newContact = new Contact({
          username,
          email,
          phone,
          tags,
          user
      });

      // Save contact to database
      await newContact.save();

      // Populate the tags field
      const populatedContact = await Contact.findById(newContact._id)
          .populate("tags", "name"); // Populate only the name field

      // Send success response with populated data
      res.status(201).json({ message: "Contact added successfully", contact: populatedContact });

  } catch (error) {
      console.error("Error adding contact:", error);
      res.status(500).json({ message: "Internal Server Error" });
  }
};
const getEditContact = async (req, res) => {
  try {
    const contactId = req.params.contactId;

    if (!contactId) {
      return res.status(400).json({ message: "Contact ID is required" });
    }

    const contact = await Contact.findById(contactId);

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.status(200).json(contact);
  } catch (error) {
    console.error("Error fetching contact:", error);
    res.status(500).json({ message: "Internal Server Error..." });
  }
};

const EditContact = async (req, res) => {
  try {
    const contactId = req.params.contactId;
    const { username, email, phone, tags } = req.body;

    if (!contactId) {
      return res.status(400).json({ message: "Contact ID is required" });
    }

    const updatedContact = await Contact.findByIdAndUpdate(
      contactId,
      { username, email, phone, tags },
      { new: true, runValidators: true }
    ).populate("tags");

    if (!updatedContact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.status(200).json({ message: "Contact updated successfully", contact: updatedContact });
  } catch (error) {
    console.error("Error updating contact:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

 
const deleteContact = async (req, res) => {
    try {
        const { ids } = req.body; 

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "No valid contacts selected for deletion." });
        }

        await Contact.deleteMany({ _id: { $in: ids } });

        res.status(200).json({ message: "Contacts deleted successfully" });
    } catch (error) {
        console.error("Error deleting contacts:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
const addContactTag = async (req, res) => {
  try {
    const { contactId, tagName } = req.body;

    // Find the existing tag
    const tag = await Tag.findOne({ name: tagName });
    if (!tag) return res.status(404).json({ message: "Tag not found" });

    // Check if the tag already exists for the contact
    const contact = await Contact.findById(contactId);
    if (!contact) return res.status(404).json({ message: "Contact not found" });

    if (contact.tags.includes(tag._id)) {
      return res.status(400).json({ message: "Tag already exists for this contact" });
    }

    // Attach tag if not already present
    await Contact.findByIdAndUpdate(contactId, { $push: { tags: tag._id } });
    console.log(tag)
    res.status(200).json({ message: "Tag attached successfully!", tag });

  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getRemovingTag = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).populate("tags"); // Ensure tags are populated

    if (!contact) {
      return res.status(404).json({ error: "Contact not found." });
    }
    res.json(contact);
  } catch (error) {
    console.error("Error fetching contact:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const removeContactTag = async (req, res) => {
  try {
    let { contactId, tagId } = req.body; // Ensure tagId is used correctly

    if (!contactId || !tagId) {
      return res.status(400).json({ message: "Contact ID and tag ID are required." });
    }

    // Check if contact exists
    const contact = await Contact.findById(contactId);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found." });
    }

    // Remove the tag by its ObjectId
    const updatedContact = await Contact.findByIdAndUpdate(
      contactId,
      { $pull: { tags: tagId } }, // Ensure tagId is in correct format
      { new: true }
    );

    if (!updatedContact) {
      return res.status(404).json({ message: "Contact not found after update." });
    }

    res.status(200).json({ message: "Tag removed successfully", contact: updatedContact });
  } catch (error) {
    console.error("Error removing tag:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


const getTags = async (req, res) => {
  try {
    const tags = await Tag.find();
    res.status(200).json(tags);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const addTag = async (req, res) => {
  try {
    const { name } = req.body;
    const newTag = new Tag({ name });
    await newTag.save();
    res.status(201).json(newTag);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const getEditTag = async (req, res) => {
    try {
        const { tagId } = req.params;
        const tag = await Tag.findById(tagId);

        if (!tag) {
            return res.status(404).json({ message: "Tag not found" });
        }

        res.status(200).json({ tag });
    } catch (error) {
        console.error("Error fetching tag:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const editTag = async (req, res) => {
    try {
        const { tagId } = req.params; // Ensure consistency with the frontend request
        const { name } = req.body;

        const updatedTag = await Tag.findByIdAndUpdate(tagId, { name }, { new: true });

        if (!updatedTag) {
            return res.status(404).json({ message: "Tag not found" });
        }

        res.status(200).json({ updatedTag });
    } catch (error) {
        console.error("Error updating tag:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


const deleteTag = async (req, res) => {
    try {
      const { tagId } = req.params;
      await Tag.findByIdAndDelete(tagId);
      res.status(200).json({ message: "tag deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error" });
    }
}

module.exports = {
  getContacts,
  addContact,
  deleteContact,
  addContactTag,
  getTags,
  addTag,
  deleteTag,
  getEditTag,
  editTag,
  removeContactTag,
  getRemovingTag,
  getEditContact,
  EditContact,
  getContactsDetails
};
