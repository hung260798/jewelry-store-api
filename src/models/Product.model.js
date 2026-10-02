const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const mongooseLeanVirtuals = require("mongoose-lean-virtuals");

const customerRateSchema = new Schema({
  customer: {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", require: true },
    firstName: { type: String },
    lastName: { type: String },
    comment: { type: String },
    imageUrl: { type: String },
  },
  rateNumber: { type: Number },
  createdAt: { type: Date },
});

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
const productSchema = new Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0, default: 0 },
    discount: { type: Number, min: 0, max: 75, default: 0 },
    stock: { type: Number, min: 0, default: 0 },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    imageUrl: { type: String },
    active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdDate: { type: Date, default: Date.now },
    createdBy: createdBySchema,
    updatedDate: { type: Date },
    updatedBy: updatedBySchema,
    note: { type: String, default: "" },
    images: {
      type: [String],
      // validate: {
      //   validator: (arr) => Array.isArray(arr) && arr.length >= 0,
      //   message: "Phải có ảnh sản phẩm",
      // },
      default: [],
    },
    rateInfo: {
      type: [customerRateSchema],
      default: [],
    },
    promotionPosition: { type: [String], default: [] },
    slug: { type: String },
    sold: { type: Number, default: 0, min: 0 },
  },
  {
    versionKey: false,
  },
);

productSchema.index({ name: 1 });
productSchema.index({ price: 1 });

// Total price of Product
productSchema.virtual("total").get(function () {
  return (this.price * (100 - this.discount)) / 100;
});

// Average rate of Product
productSchema.virtual("averageRate").get(function () {
  if (this.rateInfo && this.rateInfo.length > 0) {
    const rates = this.rateInfo
      .map((item) => item.rateNumber)
      .filter((rate) => rate !== null && rate !== undefined); // Extracting all rateNumbers

    if (rates.length === 0) {
      return 0; // or any other default value
    } else {
      const sum = rates.reduce((acc, rate) => acc + rate, 0); // Calculating the sum of rateNumbers
      const average = sum / rates.length; // Calculating the average rateNumber
      return average;
    }
  }

  return 0; // or any other default value
});

// Virtual with Populate
productSchema.virtual("category", {
  ref: "Category",
  localField: "categoryId",
  foreignField: "_id",
  justOne: true,
});

productSchema.virtual("supplier", {
  ref: "Supplier",
  localField: "supplierId",
  foreignField: "_id",
  justOne: true,
});

// Middleware to set updatedDate = createdDate on creation
productSchema.pre("save", function (next) {
  if (this.isNew && !this.updatedDate) {
    this.updatedDate = this.createdDate;
  }
  next();
});

// Config
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });
productSchema.plugin(mongooseLeanVirtuals);

const Product = model("Product", productSchema);
module.exports = Product;

// Product.syncIndexes()
//   .then(() => Product.collection.indexes())
//   .then((indexes) => {/   path: "categoryId",
        //   select: "_id name",
        // })
        // .populate({
        //   path: "supplierId",
        //   select: "_id name",
        // })
//     console.log(indexes);
//   });
