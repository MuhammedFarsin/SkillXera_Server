const mongoose = require("mongoose");

const salesPageSchema = new mongoose.Schema(
  {
    linkedTo: {
      kind: {
        type: String,
        enum: ["Course", "DigitalProduct"],
        required: true
      },
      item: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "linkedTo.kind"
      }
    },
    lines: {
      type: [String],
      required: true,
      validate: [(val) => val.length > 0, "At least one line is required"]
    },
    section5Lines: {
      type: [String],
      default: []
    },
    mainImage: {
      type: String,
      required: true
    },
    bonusImages: [
      {
        image: { type: String, required: true },
        title: { type: String, required: true },
        price: { type: String, required: true }
      }
    ],
    embedCode: String,
    smallBoxContent: {
      type: String,
      required: true
    },
    buttonContent: {
      type: String,
      required: true
    },
    checkBoxHeading: {
      type: String,
      required: true
    },
    FirstCheckBox: [
      {
        description: { type: String, required: true }
      }
    ],
    secondCheckBoxHeading: {
      type: String,
      required: true
    },
    SecondCheckBox: [
      {
        description: { type: String, required: true }
      }
    ],
    SecondCheckBoxConcluding: String,
    Topic: {
      type: String,
      required: true
    },
    ThirdSectionSubHeading: {
      type: String,
      required: true
    },
    ThirdSectionDescription: [String],
    AfterButtonPoints: {
      description: [String]
    },
    offerContent: String,
    offerLimitingContent: String,
    lastPartHeading: String,
    lastPartContent: String,
    faq: [
      {
        question: { type: String, required: true },
        answer: { type: String, required: true }
      }
    ]
  },
  { timestamps: true }
);

const SalesPage = mongoose.model("SalesPage", salesPageSchema);
module.exports = SalesPage;