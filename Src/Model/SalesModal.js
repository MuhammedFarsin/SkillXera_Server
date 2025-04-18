const mongoose = require("mongoose");

const salesPageSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },

    lines: {
      type: [String],
      required: true,
      validate: [(val) => val.length > 0, "At least one line is required"],
    },

    section5Lines: {
      type: [String],
      default: [],
    },

    ctaText: { type: String, required: true },
    ctaHighlight: { type: String },

    mainImage: {
      type: String,
      required: true,
    },

    bonusImages: [
      {
        image: { type: String, required: true },
        title: { type: String, required: true },
      },
    ],

    embedCode: {
      type: String,
    },

    smallBoxContent: {
      type: String,
      required: true,
    },
    buttonContent: {
      type: String,
      required: true,
    },
    checkBoxHeading: {
      type: String,
      required: true,
    },

    FirstCheckBox: [
      {
        description: { type: String, required: true },
      },
    ],

    secondCheckBoxHeading: {
      type: String,
      required: true,
    },

    SecondCheckBox: [
      {
        description: { type: String, required: true },
      },
    ],

    SecondCheckBoxConcluding: {
      type: String,
    },

    Topic: {
      type: String,
      required: true,
    },

    ThirdSectionSubHeading: {
      type: String,
      required: true,
    },

    ThirdSectionDescription: {
      type: [String],
      default: [],
    },

    AfterButtonPoints: {
      description: {
        type: [String],
        default: [],
      },
    },

    offerContent: {
      type: String,
    },

    offerLimitingContent: {
      type: String,
    },

    lastPartHeading: {
      type: String,
    },

    lastPartContent: {
      type: String,
    },

    faq: [
      {
        question: { type: String, required: true },
        answer: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

const SalesPage = mongoose.model("SalesPage", salesPageSchema);

module.exports = SalesPage;
