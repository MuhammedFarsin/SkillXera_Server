const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  { 
    username : { type: String, required: true},
    email: { type: String, required: true },
    phone: { type: Number, required: true },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }], 
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

const Contact = mongoose.model("Contact", contactSchema);

module.exports = Contact;
