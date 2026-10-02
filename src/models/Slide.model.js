const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const SlideSchema = new Schema(
  {
    title: { type: String, required: true },
    summary: { type: String, required: true },
    url: { type: String, required: true },
    imageUrl: { type: String },
    sortOrder: { type: Number, required: true },
    active: { type: Boolean, required: true },
    note: { type: String },
    createdDate: {
      type: Date,
    },
    createdBy: { type: Object },
    updatedDate: {
      type: Date,
    },
    updatedBy: { type: Object },
  },
  {
    versionKey: false,
  }
);

const Slide = model("Slide", SlideSchema);

module.exports = Slide;
