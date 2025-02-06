const mongoose = require("mongoose");

const ModuleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  sections: [{ type: mongoose.Schema.Types.ObjectId, ref: "Section" }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Module", ModuleSchema);
