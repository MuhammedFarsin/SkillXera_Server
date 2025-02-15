const Contact = require("../Model/ContactModel");
const Tag = require("../Model/TagModel");

const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().populate("user").populate("tags","name");
    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ message: "Internal Server Error..." });
  }
};

const addContact = async (req, res) => {
    try {
        const { username, email, phone, tags, user } = req.body;

        const validTags = await Tag.find({ _id: { $in: tags } });

        if (validTags.length !== tags.length) {
            return res.status(400).json({ message: "One or more invalid tags provided." });
        }

        const newContact = new Contact({
            username,
            email,
            phone,
            tags,
            user
        });

        // Save contact to database
        await newContact.save();

        // Send success response
        res.status(201).json({ message: "Contact added successfully", contact: newContact });

    } catch (error) {
        console.error("Error adding contact:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
const deleteContact = async (req, res) => {
    try {
        const { ids } = req.body; 
        console.log("IDs to delete:", ids);

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
  getTags,
  addTag,
  deleteTag,
  getEditTag,
  editTag
};
