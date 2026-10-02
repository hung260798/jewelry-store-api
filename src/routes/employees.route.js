const router = require("express").Router();
const bcrypt = require("bcrypt");
const JWT = require("jsonwebtoken");
const Joi = require("joi");

const Employee = require("../models/Employee.model");

const { allowPositions, devLog } = require("../utils/misc.util");
const {
  encodeAccessToken: encodeToken,
  encodeRefreshToken,
} = require("../utils/jwt.util");

const {
  validateByJoi,
  SortOrderSchema2,
  phoneRegex,
  IdStr2,
} = require("../utils/validation.util");

router.get(
  "/personal",
  ...allowPositions("employee"),
  async (req, res, next) => {
    try {
      if (!req.user) {
        return next({ status: 401, message: "Unauthorized" });
      }
      const user = await Employee.findById(req.user._id)
        .select("-refreshToken")
        .exec();
      if (!user) {
        return next({ status: 404, message: "User not found" });
      }
      res.status(200).json({ ok: true, result: user });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/logout", ...allowPositions("employee"), async (req, res, next) => {
  try {
    // const employee = await Employee.findById(req.user._id);
    // employee.refreshToken = undefined;
    // await employee.save();
    res.status(200).json({ message: "OK" });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/",
  ...allowPositions("employee"),
  validateByJoi({
    query: Joi.object({
      employeeId: IdStr2,
      email: Joi.string(),
      firstName: Joi.string(),
      lastName: Joi.string(),
      phoneNumber: Joi.string(),
      birthdayFrom: Joi.date().allow(null, ""),
      birthdayTo: Joi.date()
        .allow(null, "")
        .greater(Joi.ref("birthdayFrom"))
        .messages({
          "date.greater": "birthdayTo must be after birthdayFrom",
        }),
      address: Joi.string(),
      skip: Joi.number().integer().min(0),
      limit: Joi.number().integer().min(0).max(30),
      sortBy: Joi.string().valid(
        "firstName",
        "lastName",
        "email",
        "birthday",
        "address",
        "phoneNumber",
        "_id",
        "id",
      ),
      sortOrder: SortOrderSchema2,
      fields: Joi.array().items(
        Joi.string().valid(
          "firstName",
          "lastName",
          "email",
          "birthday",
          "address",
          "phoneNumber",
          "gender",
          "imageUrl",
          "createdDate",
          "createdBy",
          "updatedDate",
          "updatedBy",
          "Locked",
          "isAdmin",
          "isDeleted",
          // //"roles",
          "lastActivity",
          "note",
        ),
      ),
    }),
  }),
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
        birthdayFrom,
        birthdayTo,
        skip = 0,
        limit = 20,
        sortOrder,
        fields = [
          "firstName",
          "lastName",
          "email",
          "birthday",
          "address",
          "phoneNumber",
          "gender",
          "imageUrl",
          "createdDate",
          "createdBy",
          "updatedDate",
          "updatedBy",
          "Locked",
          "isAdmin",
          "isDeleted",
          // //"roles",
          "lastActivity",
          "note",
        ],
      } = req.parsedData.query;

      // console.log("fields", fields);

      const sortPattern = {};
      if (sortBy && sortOrder) {
        sortPattern[sortBy] = sortOrder;
      }
      sortPattern.Locked ??= 1;
      sortPattern.isDeleted ??= 1;
      sortPattern._id ??= 1;

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

      let results = await Employee.find(query)
        .collation({ locale: "vi", strength: 2 })
        .sort(sortPattern)
        .select(fields.join(" "))
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();
      let amountResults = await Employee.countDocuments(query);
      res.json({ results: results, amountResults: amountResults });
    } catch (error) {
      next(error);
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
    try {
      let response = {};
      let code = 200;
      const id = req.params.id;
      let employee = await Employee.findById(id, {
        password: 0,
        refreshToken: 0,
      }).exec();
      if (employee) {
        response = { result: employee, ok: true };
        code = 200;
      } else {
        response = { ok: false };
        code = 404;
      }
      res.status(code).json(response);
    } catch (error) {
      next({ status: 500, message: error.message });
    }
  },
);

router.post(
  "/",
  ...allowPositions("employee"),
  validateByJoi({
    body: Joi.object({
      firstName: Joi.string().max(50).required(),
      lastName: Joi.string().max(50).required(),
      email: Joi.string().email().max(80).required(),
      phoneNumber: Joi.string().regex(phoneRegex).required(),
      password: Joi.string().min(3).max(50).required(),
      address: Joi.string().max(500).required(),
      // Non-required fields
      birthday: Joi.date().min("1-1-1900"),
      imageUrl: Joi.string().allow("", null), // Thường thì string không bắt buộc nên cho phép rỗng/null
      Locked: Joi.boolean().default(false),
      isDeleted: Joi.boolean().default(false),
      note: Joi.string(),
      isAdmin: Joi.boolean().default(false),
      // _id: Joi.string(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { email, phoneNumber } = req.body;
      const userExist = await Employee.findOne({
        $or: [{ email }, { phoneNumber }],
      });
      if (userExist) {
        return next({
          status: 400,
          message: "Email or Phone Number already exists",
        });
      }
      const employee = new Employee(req.body);
      const result = await employee.save();
      const _ = require("lodash");
      res.status(200).send({
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
  ...allowPositions("employee"),
  validateByJoi({
    params: Joi.object({
      id: IdStr2.required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const employeeId = req.params.id;
      if (employeeId === req.user._id) {
        return next({ status: 400, message: "You cannot delete yourself" });
      }
      const found = await Employee.findByIdAndDelete(employeeId)
        .select("-password -refreshToken")
        .exec();
      if (!found) {
        return next({ status: 404, message: "Không tìm thấy" });
      }
      res.status(200).json({ ok: true, result: found });
    } catch (error) {
      return next({ status: 500, message: "Error", error: error.message });
    }
  },
);

router.patch(
  "/:id",
  ...allowPositions("employee"),
  validateByJoi({
    body: Joi.object({
      firstName: Joi.string().max(50),
      lastName: Joi.string().max(50),
      email: Joi.string().email().max(80),
      phoneNumber: Joi.string().regex(phoneRegex), // Thay bằng logic PhoneStr nếu có regex riêng
      password: Joi.string().min(3).max(50),
      oldPassword: Joi.string().min(3).max(50),
      confirmPassword: Joi.ref("password"),
      address: Joi.string().max(500),
      birthday: Joi.date().min("1-1-1900"),
      gender: Joi.string(),
      imageUrl: Joi.string().allow("", null),
      Locked: Joi.boolean(),
      note: Joi.string().allow(""),
      isDeleted: Joi.boolean(),
      _id: Joi.string(),
    })
      .with("password", "oldPassword")
      .with("password", "confirmPassword"),
    params: Joi.object({
      id: IdStr2.required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const employeeId = req.params.id;
      const body = req.body;
      let targetEmployee = null;
      // Check if the "password" field is present in the request body
      if (body.password) {
        targetEmployee =
          await Employee.findById(employeeId).select("+password");
      } else {
        targetEmployee = await Employee.findById(employeeId);
      }
      if (!targetEmployee) {
        return next({ status: 404, message: "Không tìm thấy" });
      }

      // Check if user wanna change the password
      if (body.password) {
        // console.log("targetEmployee", targetEmployee);
        const { password, oldPassword, confirmPassword } = body;
        const isPasswordMatch = await targetEmployee.isValidPass(oldPassword);
        if (!isPasswordMatch) {
          return next(new Error("Old password is incorrect"));
        }
        if (password !== confirmPassword) {
          return next(
            new Error("New password and confirm password do not match"),
          );
        }
        // Hash password
        const salt = await bcrypt.genSalt(10);
        body.password = await bcrypt.hash(password, salt);
      }

      // Check if the new phone number already exists
      if (body.phoneNumber) {
        const phoneNumExisted = await Employee.findOne({
          phoneNumber: body.phoneNumber,
          _id: { $ne: employeeId }, // Exclude the current Employee from the check
        });

        if (phoneNumExisted) {
          return res.status(400).json({
            ok: false,
            message: "Phone number already exists",
          });
        }
      }

      // Check if the new email already exists
      if (body.email) {
        const emailExisted = await Employee.findOne({
          email: body.email,
          _id: { $ne: employeeId }, // Exclude the current Employee from the check
        });

        if (emailExisted) {
          return res.status(400).json({
            ok: false,
            message: "Email already exists",
          });
        }
      }

      // Check if record is soft-deleted
      if (body.isDeleted) {
        if (targetEmployee.isDeleted) {
          const delRs = await Employee.deleteOne({ _id: employeeId });
          res.status(200).json({ ok: true, deleteResult: delRs });
          return;
        }
      }

      const updatedItem = await Employee.findByIdAndUpdate(
        employeeId,
        { $set: body },
        { new: true, select: "-password -refreshToken" },
      );

      if (!updatedItem) {
        return res.status(410).json({ ok: false, message: "Object not found" });
      }
      res.status(200).json({ ok: true, result: updatedItem });
    } catch (err) {
      devLog(err);
      next(err);
    }
  },
);

router.post(
  "/refreshToken",
  validateByJoi({
    body: Joi.object({
      refreshToken: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.sendStatus(401);
      }
      JWT.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        async (err, data) => {
          try {
            if (err) {
              return res
                .status(401)
                .json({ message: "refreshToken is not a valid Token" });
            }
            const { sub: _id, firstName, lastName } = data;

            const employee = await Employee.findOne({
              _id: _id,
              refreshToken: refreshToken,
            });

            if (!employee) {
              return res
                .status(401)
                .json({ message: "refreshToken not match with id!" });
            }

            const token = encodeToken(_id, firstName, lastName, "Employee");
            res.json({ token });
          } catch {
            res.status(500).json({ message: "System's failed" });
          }
        },
      );
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/login",
  validateByJoi({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required().min(3).max(100),
    }),
  }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const employee = await Employee.findOne({ email })
        .select("+password")
        .exec();
      if (!employee) {
        return res
          .status(401)
          .json({ message: "Tên đăng nhập hoặc mật khẩu không chính xác" });
      }
      const isPasswordMatch = await employee.isValidPass(password);
      if (!isPasswordMatch) {
        return res
          .status(401)
          .json({ message: "Tên đăng nhập hoặc mật khẩu không chính xác" });
      }
      const { _id, firstName, lastName } = employee;
      const id = _id.toString();
      const token = encodeToken(id, firstName, lastName, "Employee");
      const refreshToken = encodeRefreshToken(
        id,
        firstName,
        lastName,
        "Employee",
      );

      employee.refreshToken = refreshToken;
      await employee.save();
      res.status(201).json({
        token,
        refreshToken,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/login/profile",
  ...allowPositions("employee"),
  async (req, res, next) => {
    try {
      const id = req.user._id;
      if (!id) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const employee = await Employee.findById(id)
        .select("-password -refreshToken")
        .exec();
      if (!employee) {
        next({ message: "No user", status: 404 });
      }
      res.status(200).json(employee);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
