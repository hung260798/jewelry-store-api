const bcrypt = require("bcrypt");
const JwtStrategy = require("passport-jwt").Strategy;
const LocalStrategy = require("passport-local").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const { jwtSettings } = require("./jwt.util");
const Employee = require("../models/Employee.model");
const Customer = require("../models/Customer.model");
const { isValidObjectId } = require("mongoose");

const passportConfigJWT = new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken("Authorization"),
    secretOrKey: jwtSettings.SECRET,
  },
  async (payload, done) => {
    try {
      let { position, sub: userId } = payload;
      if (typeof position != "string" || !isValidObjectId(userId)) {
        return done(null, false);
      }
      position = position.toLowerCase();
      if (position !== "employee" && position !== "customer") {
        return done(null, false);
      }
      const user = await (
        position === "employee" ? Employee : Customer
      ).findById(userId);
      if (!user) {
        return done(null, false);
      }
      // user.position = position; // Thêm thông tin position vào user object để sử dụng sau này
      return done(null, {...user.toObject(), position });
    } catch (error) {
      done(error, false);
    }
  },
);

const createLocalConfig = (model) => {
  return new LocalStrategy(
    {
      usernameField: "email",
    },
    async (email, password, done) => {
      try {
        const user = await model.findOne({ email });
        if (!user) return done(null, false, { message: "User not found" });
        // console.log("email:", email, "pass:", password, "user", user);

        // const isCorrectPass = await user.isValidPass(password);
        const isCorrectPass = await bcrypt.compare(password, user.password);

        if (!isCorrectPass) {
          // console.log("Incorrect password");
          return done(null, false, {
            message: "Invalid password",
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error, false, { message: error.message });
      }
    },
  );
};

module.exports = {
  passportConfigJWT: passportConfigJWT,
  createLocalConfig: createLocalConfig,
};
