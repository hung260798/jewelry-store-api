const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const bcrypt = require("bcrypt");
const { devLog } = require("../utils/misc.util");

// Mongoose Datatypes:
// https://mongoosejs.com/docs/schematypes.html

// Validator
// https://mongoosejs.com/docs/validation.html#built-in-validators
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

const employeeSchema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: {
      type: String,
      validate: {
        validator: function (value) {
          const emailRegex = /^([\w-.]+@([\w-]+\.)+[\w-]{2,4})?$/;
          return emailRegex.test(value);
        },
        message: `{VALUE} is not a valid email!`,
        // or:
        // message: (props) => `{props.value} is not a valid email!`,
      },
      required: [true, "email is required"],
      unique: true,
    },
    phoneNumber: {
      type: String,
      validate: {
        validator: function (value) {
          const phoneRegex =
            /^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/;
          return phoneRegex.test(value);
        },
        message: `{VALUE} is not a valid phone!`,
        // or:
        // message: (props) => `{props.value} is not a valid email!`,
        unique: true,
      },
    },
    password: { type: String, required: true, select: false },
    address: { type: String, required: true },
    birthday: { type: Date },
    gender: { type: String, default: "male" },
    imageUrl: { type: String },
    lastActivity: { type: Date, default: Date.now },
    isAdmin: { type: Boolean, default: false },
    Locked: { type: Boolean, default: false },
    note: { type: String },
    createdDate: { type: Date, default: Date.now },
    createdBy: createdBySchema,
    updatedDate: { type: Date },
    updatedBy: updatedBySchema,
    refreshToken: { type: String },
    // // roles: [],
    isDeleted: { type: Boolean, default: false },
  },
  {
    versionKey: false,
  },
);

employeeSchema.index({ email: 1 });
employeeSchema.index({ firstName: 1, lastName: 1 });

// Virtuals
employeeSchema.virtual("fullName").get(function () {
  return this.firstName + " " + this.lastName;
});

employeeSchema.pre("save", async function (next) {
  try {
    // Only hash password if it has been modified
    if (!this.isModified("password")) {
      return next();
    }
    // generate salt key
    const salt = await bcrypt.genSalt(10); // 10 ký tự
    // generate password = salt key + hash key
    const hashPass = await bcrypt.hash(this.password, salt);
    // override password
    this.password = hashPass;
    next();
  } catch (err) {
    next(err);
  }
});


employeeSchema.methods.isValidPass = async function (pass) {
  try {
    return bcrypt.compare(pass, this.password);
  } catch (err) {
    console.log("pass, this.password", pass, this.password);
    throw err;
  }
};

const Employee = model("Employee", employeeSchema);
module.exports = Employee;
