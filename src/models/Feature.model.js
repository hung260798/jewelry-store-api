const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const createdBySchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee", require: true },
  firstName: { type: String },
  lastName: { type: String },
});
const updatedBySchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee", require: true },
  firstName: { type: String },
  lastName: { type: String },
});

const FeatureSchema = new Schema(
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
    createdBy: createdBySchema,
    updatedDate: {
      type: Date,
    },
    updatedBy: updatedBySchema,
    isDeleted: { trype: Boolean },
  },
  {
    versionKey: false,
  }
);

const Feature = model("Feature", FeatureSchema);

module.exports = Feature;
