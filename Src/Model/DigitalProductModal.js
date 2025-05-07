// models/DigitalProduct.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const digitalProductSchema = new Schema({
  name: String,
  description: String,
  regularPrice: Number,
  salePrice: Number,
  category: String,
  // Can be either file or link
  fileUrl: String,    // For file downloads
  externalUrl: String, // For external links
  status: {
    type: String,
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const DigitalProduct = mongoose.model('DigitalProduct', digitalProductSchema);

module.exports = DigitalProduct;