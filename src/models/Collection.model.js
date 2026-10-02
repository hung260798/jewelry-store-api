const mongoose = require("mongoose");
const Product = require("./Product.model");
const { generateUniqueSlug, slugify } = require("../utils/misc.util");
const productSchema = Product.schema;
const { Schema, model } = mongoose;

const CollectionSchema = new Schema(
  {
    name: {
      type: "string",
      required: true,
    },
    description: {
      type: String,
    },
    image: {
      type: "string",
    },
    coverImage: {
      type: "string",
    },
    products: {
      type: [productSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    slug: {
      type: "string",
    },
  },
  {
    timestamps: {
      createdAt: "createdDate",
      updatedAt: "modifiedDate",
    },
  },
);

CollectionSchema.index({ name: 1 });

CollectionSchema.pre("save", async function (next) {
  if (this.isNew) {
    this.slug = await generateUniqueSlug(this.name, this.constructor);
  } else if (this.isModified("name")) {
    const newSlug = slugify(this.name, this.constructor);
    if (this.slug !== newSlug) {
      this.slug = newSlug;
    }
  }
  next();
});

const Collection = model("Collection", CollectionSchema);

module.exports = Collection;
