const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const bcrypt = require("bcrypt");
const Product = require("./Product.model");

const shippingSchema = new Schema({
  phone: { type: String },
  receiverName: { type: String },
  note: { type: String },
  ward: { type: String },
  district: { type: String },
  city: { type: String },
  isActive: { type: Boolean },
  wardNumber: { type: String },
  districtNumber: { type: String },
  cityNumber: { type: String },
});
const createdBySchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee", require: true },
  firstName: { type: String },
  lastName: { type: String },
});
const createdByCustomerSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: "Customer", require: true },
  firstName: { type: String },
  lastName: { type: String },
});
const updatedBySchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee", require: true },
  firstName: { type: String },
  lastName: { type: String },
});

const customerSchema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: {
      type: String,
      validate: {
        validator: function (value) {
          const emailRegex = /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/;
          return emailRegex.test(value);
        },
        message: `{VALUE} is not a valid email`,
      },
      required: [true, "email is required"],
    },
    password: { type: String, required: true, select: false }, // select: false để ẩn trường này khi truy vấn
    phoneNumber: {
      type: String,
      validate: {
        validator: function (value) {
          const phoneRegex =
            /^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/;
          return phoneRegex.test(value);
        },
        message: `{VALUE} is not a valid phone number`,
      },
    },
    address: { type: String, require: true },
    birthday: { type: Date },
    Locked: { type: Boolean },
    createdDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    createdBy: createdBySchema || createdByCustomerSchema,
    imageUrl: { type: String },
    updatedDate: {
      type: Date,
    },
    updatedBy: updatedBySchema,
    note: { type: String },
    lastActivity: { type: Date },
    refreshToken: { type: String },
    shippingAddress: [shippingSchema],
    bio: { type: String },
    sex: {
      type: String,
      required: true,
      default: "MAN",
      validate: {
        validator: (value) => {
          if (["MAN", "WOMAN", "OTHER"].includes(value)) {
            return true;
          }
          return false;
        },
        message: `Status: {VALUE} is invalid!`,
      },
    },
    favoriteProducts: {
      type: [Product.schema],
      default: [],
    },
  },
  {
    versionKey: false,
    methods: {
      hideSensitive() {
        this.password = undefined;
        this.refreshToken = undefined;
        return this;
      },
      toGetDto() {
        return this.hideSensitive();
      },
    },
  },
);

// customerSchema.pre("save", async function (next) {
//   try {
//     // generate salt key
//     const salt = await bcrypt.genSalt(10); // 10 ký tự
//     // generate password = salt key + hash key
//     const hashPass = await bcrypt.hash(this.password, salt);
//     // override password
//     this.password = hashPass;
//     next();
//   } catch (err) {
//     next(err);
//   }
// });

customerSchema.methods.isValidPass = async function (pass) {
  try {
    const isMatched = await bcrypt.compare(pass, this.password);
    return isMatched;
  } catch (err) {
    throw new Error(err);
  }
};

// // Check password from client
// employeeSchema.methods.comparePassword = function comparePassword(checkPassword) {
//   return bcrypt.compareSync(checkPassword, this.password);
// };

customerSchema.index({ email: 1 });
customerSchema.index({ firstName: 1 });
customerSchema.index({ lastName: 1 });
const Customer = model("Customer", customerSchema);
module.exports = Customer;
