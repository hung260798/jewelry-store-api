const mongoose = require("mongoose");
const { generateUniqueSlug } = require("../utils/misc.util");
const { Schema, model } = mongoose;

const createdBySchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
  firstName: { type: String },
  lastName: { type: String },
});

const updatedBySchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
  firstName: { type: String },
  lastName: { type: String },
});

const CategorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: String,
    promotionPosition: { type: Array },
    coverImageUrl: { type: String },
    displayOrder: { type: Number },
    active: { type: Boolean }, //auto-fill
    isDeleted: { type: Boolean }, //auto-fill
    //auto-fill
    createdDate: {
      type: Date,
    },
    createdBy: createdBySchema, //auto-fill
    //auto-fill
    updatedDate: {
      type: Date,
    },
    updatedBy: updatedBySchema, //auto-fill
    note: { type: String },
    imageUrl: { type: String },
    parentCategory: { type: Schema.Types.ObjectId, ref: "Category" },
    slug: { type: String, unique: true }, // auto-calculated
  },
  {
    versionKey: false,
    query: {
      byName(name) {
        return this.where({ name: new RegExp(name, "i") });
      },
      bySlug(slug) {
        return this.where({ slug: slug });
      },
    },
  },
);

CategorySchema.pre("save", function (next) {
  if (!this.createdDate) {
    this.createdDate = new Date();
  }
  next();
});

CategorySchema.pre("save", function (next) {
  this.updatedDate = new Date();
  next();
});

CategorySchema.pre("save", async function (next) {
  if (this.isModified("name")) {
    this.slug = await generateUniqueSlug(this.name, this.constructor);
  }
  next();
});


const Category = model("Category", CategorySchema);
module.exports = Category;

