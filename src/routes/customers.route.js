const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const _ = require("lodash");

const Customer = require("../models/Customer.model");
const { allowPositions } = require("../utils/misc.util");
const {
  validateByJoi,
  SortOrderSchema2,
  phoneRegex,
  IdStr2,
} = require("../utils/validation.util");
const {
  encodeAccessToken: encodeToken,
  encodeRefreshToken,
} = require("../utils/jwt.util");
const { getCollectionCount, buildCountKey } = require("../utils/queries.util");

router.get(
  "/",
  ...allowPositions("employee"),
  validateByJoi(
    Joi.object({
      query: Joi.object({
        Locked: Joi.boolean(),
        email: Joi.string().max(100),
        firstName: Joi.string().max(50),
        lastName: Joi.string().max(50),
        phoneNumber: Joi.string(),
        birthdayFrom: Joi.string(),
        birthdayTo: Joi.string(),
        createdDateFrom: Joi.string(),
        createdDateTo: Joi.string(),
        address: Joi.string().max(60),
        skip: Joi.number().min(0).integer(),
        limit: Joi.number().min(0).max(1000).integer(),
        sortOrder: SortOrderSchema2,
        sortBy: Joi.string().allow(
          "firstName",
          "lastName",
          "phoneNumber",
          "birthday",
          "address",
          "_id",
          "id",
          "createdDate",
        ),
        fields: Joi.array()
          .items(
            Joi.string().valid(
              "firstName",
              "lastName",
              "email",
              "phoneNumber",
              "address",
              "birthday",
              "createdDate",
              "createdBy",
              "Locked",
              "note",
              "lastActivity",
              "shippingAddress",
              "sex",
            ),
          )
          .max(15),
      }),
    }),
  ),
  async (req, res, next) => {
    try {
      const {
        Locked,
        email,
        firstName,
        lastName,
        phoneNumber,
        address,
        sortBy,
      } = req.query;

      const {
        sortOrder,
        birthdayFrom,
        birthdayTo,
        createdDateFrom,
        createdDateTo,
        skip = 0,
        limit = 10,
        fields = [
          "firstName",
          "lastName",
          "email",
          "phoneNumber",
          "address",
          "birthday",
          "createdDate",
          "createdBy",
          "Locked",
          "note",
          "lastActivity",
          "shippingAddress",
          "sex",
          "imageUrl",
          "avatar",
        ],
      } = req.parsedData.query;

      // filters
      const query = {
        $expr: {
          $and: [
            Locked && { $eq: ["$Locked", Locked] },
            email && {
              $regexMatch: { input: "$email", regex: email, options: "i" },
            },
            firstName && {
              $regexMatch: {
                input: "$firstName",
                regex: firstName,
                options: "i",
              },
            },
            lastName && {
              $regexMatch: {
                input: "$lastName",
                regex: lastName,
                options: "i",
              },
            },
            birthdayFrom && { $gte: ["$birthday", birthdayFrom] },
            birthdayTo && { $lte: ["$birthday", birthdayTo] },
            createdDateFrom && {
              $gte: ["$createdDate", new Date(createdDateFrom)],
            },
            createdDateTo && {
              $lte: ["$createdDate", new Date(createdDateTo)],
            },
            address && {
              $regexMatch: {
                input: "$address",
                regex: address,
                options: "i",
              },
            },
            phoneNumber && {
              $regexMatch: {
                input: "$phoneNumber",
                regex: phoneNumber,
                options: "i",
              },
            },
          ].filter(Boolean),
        },
      };
      const sortPattern = {};
      if (sortBy && sortOrder) {
        sortPattern[sortBy] = sortOrder;
      }
      sortPattern.Locked ??= 1;
      sortPattern._id ??= 1;

      const _ = require("lodash");
      const selectedFields = _.fromPairs(
        fields
          .filter((field) => field !== "password" && field !== "refreshToken")
          .map((field) => [field, 1]),
      );

      const results = await Customer.find(query, {
        favoriteProducts: { $slice: -5 },
        ...selectedFields,
      })
        .sort(sortPattern)
        // sort ignore case in Vietnamese, strength = 3 by default
        // https://www.mongodb.com/docs/manual/reference/collation/
        .collation({ locale: "vi", caseLevel: false })
        .skip(skip)
        .limit(limit);
      const countKey = buildCountKey({
        collection: "customers",
        query: req.query,
      });
      const amountResults = await getCollectionCount({
        filter: query,
        key: countKey,
        model: Customer,
        ttl: 60,
      });
      // let amountResults = await Customer.countDocuments(query);
      res.json({ results: results, amountResults: amountResults });
    } catch (error) {
      next({ status: 500, message: error.message });
    }
  },
);

router.get(
  "/:id",
  ...allowPositions("employee"),
  validateByJoi({
    params: Joi.object({
      id: IdStr2.required(),
    }),
  }),
  async (req, res, next) => {
    let data = null;
    try {
      const itemId = req.params.id;
      let customer = await Customer.findById(itemId, {
        password: 0,
        refreshToken: 0,
      });
      data = customer
        ? { status: 200, json: { ok: true, result: customer } }
        : { status: 404, json: { ok: false, message: "Object not found" } };
      res.status(data.status).json(data.json);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/",
  validateByJoi(
    Joi.object({
      body: Joi.object({
        firstName: Joi.string().required().max(50),
        lastName: Joi.string().required().max(50),
        email: Joi.string().email().required().max(50),
        phoneNumber: Joi.string().regex(phoneRegex).required(),
        address: Joi.string().max(500),
        birthday: Joi.date().min(new Date(1900, 0, 1)),
        password: Joi.string().required().max(100).min(3).required(),
        Locked: Joi.boolean().default(false),
        bio: Joi.string().default(""),
        sex: Joi.string().allow("MAN", "WOMAN", "OTHER").default("MAN"),
      }),
    }),
  ),
  async (req, res, next) => {
    try {
      const { email, phoneNumber, password } = req.body;
      const customerExists = await Customer.findOne({
        $or: [{ email: email }, { phoneNumber: phoneNumber }],
      });
      if (customerExists) {
        return res.status(400).send({
          ok: false,
          message: "Email or Phone Number already exists",
        });
      }
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);
      const customer = new Customer({ ...req.body, password: hashed });
      const result = await customer.save();
      return res.status(200).send({
        ok: true,
        message: "Created succesfully",
        result: _.omit(result.toObject(), ["password", "refreshToken"]),
      });
    } catch (error) {
      next({ status: 500, message: error.message });
    }
  },
);

router.delete(
  "/:id",
  ...allowPositions("Employee"),
  validateByJoi({
    params: Joi.object({
      id: IdStr2.required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const itemId = req.params.id;
      let found = await Customer.findByIdAndDelete(itemId);
      if (found) {
        return res.status(200).send({
          message: "Deleted Succesfully!!",
          result: _.omit(found.toObject(), ["refreshToken", "password"]),
        });
      }
      return res.status(410).send({ ok: false, message: "Object not found" });
    } catch (error) {
      next({ status: 500, message: error.message });
    }
  },
);

router.patch(
  "/personal",
  ...allowPositions("customer"),
  validateByJoi({
    body: Joi.object({
      firstName: Joi.string().max(50),
      lastName: Joi.string().max(50),
      email: Joi.string().email().max(50),
      phoneNumber: Joi.string().regex(phoneRegex),
      address: Joi.string().max(500),
      birthday: Joi.date().min(new Date(1900, 0, 1)),
      Locked: Joi.boolean(),
      bio: Joi.string(),
      sex: Joi.string().allow("MAN", "WOMAN", "OTHER"),
      oldPassword: Joi.string().min(3).max(100),
      password: Joi.string().max(100).min(3),
      confirmPassword: Joi.ref("password"),
    })
      .with("confirmPassword", ["password", "oldPassword"])
      .with("password", "oldPassword"),
  }),
  async (req, res, next) => {
    try {
      const customerId = req.user._id;
      const { password, phoneNumber, email } = req.body;
      // Check if the "password" field is present in the request body
      if (password) {
        const { oldPassword, confirmPassword } = req.body;
        const target = await Customer.findById(customerId);
        if (!target) {
          next({ status: 404, message: "Object not found" });
          return;
        }
        const isCorrectPassword = await bcrypt.compare(
          oldPassword,
          target.password,
        );
        if (!isCorrectPassword || password !== confirmPassword) {
          next({ status: 401, message: "Password is not correct" });
          return;
        }
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password, salt);
        req.body.password = hashed;
      }

      // Check if the phone number already exists
      if (phoneNumber) {
        const phoneExist = await Customer.findOne({
          phoneNumber: phoneNumber,
          _id: { $ne: customerId }, // Exclude the current customer from the check
        });

        if (phoneExist) {
          next({ status: 400, message: "Phone number already exists" });
          return;
        }
      }
      // Check if the email already exists
      if (email) {
        const existingEmail = await Customer.findOne({
          email: email,
          _id: { $ne: customerId }, // Exclude the current customer from the check
        });

        if (existingEmail) {
          next({ status: 400, message: "Email already exists" });
          return;
        }
      }

      const updatedItem = await Customer.findByIdAndUpdate(
        customerId,
        { $set: req.body },
        { new: true, projection: { password: 0, refreshToken: 0 } },
      );

      if (!updatedItem) {
        return res.status(404).json({ ok: false, message: "Object not found" });
      }
      res.status(200).json({ ok: true, result: updatedItem });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id",
  ...allowPositions("Employee", "Customer"),
  validateByJoi({
    body: Joi.object({
      firstName: Joi.string().max(50),
      lastName: Joi.string().max(50),
      email: Joi.string().email().max(50),
      phoneNumber: Joi.string().regex(phoneRegex),
      address: Joi.string().max(500),
      birthday: Joi.date().min(new Date(1900, 0, 1)),
      Locked: Joi.boolean(),
      bio: Joi.string(),
      sex: Joi.string().allow("MAN", "WOMAN", "OTHER"),
      oldPassword: Joi.string().min(3).max(100),
      password: Joi.string().max(100).min(3),
      confirmPassword: Joi.ref("password"),
    })
      .with("confirmPassword", ["password", "oldPassword"])
      .with("password", "oldPassword"),
    params: Joi.object({
      id: IdStr2.required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const itemId = req.params.id;
      const itemBody = req.body;
      const { password, phoneNumber, email } = itemBody;
      // Check if the "password" field is present in the request body
      if (password) {
        const { oldPassword, confirmPassword } = itemBody;
        const target = await Customer.findById(itemId);
        if (!target) {
          next({ status: 410, message: "Object not found" });
          return;
        }
        const isCorrectPassword = await bcrypt.compare(
          oldPassword,
          target.password,
        );
        if (!isCorrectPassword || password !== confirmPassword) {
          next({ status: 401, message: "Password is not correct" });
          return;
        }
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password, salt);
        itemBody.password = hashed;
      }

      // Check if the phone number already exists
      if (phoneNumber) {
        const existingPhoneNumber = await Customer.findOne({
          phoneNumber: phoneNumber,
          _id: { $ne: itemId }, // Exclude the current customer from the check
        });

        if (existingPhoneNumber) {
          next({ status: 400, message: "Phone number already exists" });
          return;
        }
      }
      // Check if the email already exists
      if (email) {
        const existingEmail = await Customer.findOne({
          email: email,
          _id: { $ne: itemId }, // Exclude the current customer from the check
        });

        if (existingEmail) {
          next({ status: 400, message: "Email already exists" });
          return;
        }
      }

      const updatedItem = await Customer.findByIdAndUpdate(
        itemId,
        { $set: itemBody },
        { new: true, projection: { password: 0, refreshToken: 0 } },
      );

      if (updatedItem) {
        return res.status(200).json({ ok: true, result: updatedItem });
      } else {
        next({ status: 404, message: "Object not found" });
      }
    } catch (err) {
      next(err);
    }
  },
);

router.post("/refreshToken", (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.sendStatus(401);
  }
  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    async (err, data) => {
      try {
        if (err) {
          return next({ status: 403, message: "Invalid refresh token" });
        }
        const { sub, firstName, lastName } = data;
        const employee = await Customer.findOne({
          _id: sub,
          refreshToken: refreshToken,
        });
        if (!employee) {
          return next({
            status: 401,
            message: "refreshToken and id's not match!",
          });
        }

        const token = encodeToken(sub, firstName, lastName, "Customer");
        res.json({ token: token });
      } catch (error) {
        return next({ status: 500, message: error.message });
      }
    },
  );
});

router.post(
  "/login",
  validateByJoi({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(3).max(31).required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const customer = await Customer.findOne({ email })
        .select("+password")
        .exec();
      if (!customer) {
        return next({ status: 404, message: "User not found" });
      }
      const isPasswordMatch = await customer.isValidPass(password);
      if (!isPasswordMatch) {
        return next({ status: 401, message: "Password is incorrect" });
      }
      const { _id, firstName, lastName } = customer;
      const id = _id.toString();
      const token = encodeToken(id, firstName, lastName, "Customer");
      const refreshToken = encodeRefreshToken(
        id,
        firstName,
        lastName,
        "Customer",
      );
      await Customer.findByIdAndUpdate(id, {
        $set: { refreshToken: refreshToken },
      });
      res.status(200).json({
        token,
        refreshToken,
      });
    } catch (err) {
      return next({ status: 500, ...err });
    }
  },
);

router.get(
  "/login/profile",
  // passport.authenticate("jwt", { session: false }),
  ...allowPositions("Customer"),
  async (req, res, next) => {
    try {
      const customer = await Customer.findById(req.user._id, {
        password: 0,
        refreshToken: 0,
        favoriteProducts: { $slice: -5 },
      });
      if (!customer) {
        return next({ status: 404, message: "Not found" });
      }
      res.status(200).json(customer);
    } catch (err) {
      const msg = typeof err?.message === "string" ? err.message : "";
      return next({ status: 500, message: msg });
    }
  },
);

module.exports = router;
