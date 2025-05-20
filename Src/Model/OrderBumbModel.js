const mongoose = require('mongoose');

const orderBumpSchema = new mongoose.Schema({
  targetProduct: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'targetProductModel'
  },
  targetProductModel: {
    type: String,
    required: true,
    enum: ['Course', 'DigitalProduct']
  },

  bumpProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DigitalProduct',
    required: true
  },

  displayName: {
    type: String,
    required: true
  },
  description: {  
    type: String,
    trim: true,
    default: ""
  },
  bumpPrice: {
    type: Number,
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  },
  minCartValue: Number,

  displays: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 }
}, { timestamps: true });

// Auto-calculate conversion rate
orderBumpSchema.virtual('conversionRate').get(function() {
  return this.displays > 0 
    ? Math.round((this.conversions / this.displays) * 100)
    : 0;
});

module.exports = mongoose.model('OrderBump', orderBumpSchema);