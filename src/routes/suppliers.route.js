const { Router } = require("express");
const Joi = require("joi");
const {
  validateByJoi,
  IdStr2,
  phoneRegex,
} = require("../utils/validation.util");
const { allowPositions } = require("../utils/misc.util");
const Supplier = require("../models/Supplier.model");

const router = Router();

router.get(
  "/",
  validateByJoi(
    Joi.object({
      query: Joi.object({
        name: Joi.string(),
        email: Joi.string(),
        phoneNumber: Joi.string(),
        address: Joi.string(),
        skip: Joi.number().min(0).max(1000),
        limit: Joi.number().min(0).max(1000),
      }),
    }),
  ),
  async (req, res, next) => {
    try {
      const {
        active,
        isDeleted,
        name,
        email,
        phoneNumber,
        address,
        skip,
        limit,
        sortBy,
        sortOrder,
      } = req.query;

      const query = {
        $and: [
          active === "true" ? { active: true, isDeleted: false } : null,
          active === "false" ? { active: false, isDeleted: false } : null,
          isDeleted === "true" ? { isDeleted: true } : null,
          name ? { name: { $regex: new RegExp(name, "i") } } : null,
          email ? { email: { $regex: new RegExp(email, "i") } } : null,
          phoneNumber
            ? { phoneNumber: { $regex: new RegExp(phoneNumber, "i") } }
            : null,
          address ? { address: { $regex: new RegExp(address, "i") } } : null,
        ].filter(Boolean),
      };

      const sorts = sortBy && sortOrder ? { [sortBy]: sortOrder } : {};

      let results = await Supplier.find(query)
        .sort({ isDeleted: 1, ...sorts })
        .skip(Number(skip))
        .limit(Number(limit));

      let amountResults = await Supplier.countDocuments(query);

      res.json({ results, amountResults });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/:id",
  validateByJoi(
    Joi.object({
      params: Joi.object({ id: IdStr2.required() }),
    }),
  ),
  async (req, res, next) => {
    try {
      // const { type } = req.query;
      const itemId = req.params.id;
      let found = await Supplier.findOne({
        _id: itemId,
      }).lean({ virtuals: true });
      if (!found) {
        res.status(500).send({ ok: false, message: "Object not found" });
        return;
      }
      return res.status(200).json({ result: found });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/",
  ...allowPositions("employee"),
  validateByJoi(
    Joi.object({
      body: Joi.object({
        id: Joi.number(),
        name: Joi.string().required().max(100),
        email: Joi.string().required().max(50),
        phoneNumber: Joi.string().regex(phoneRegex).required(),
        address: Joi.string().required().max(100),
      }),
    }),
  ),
  async (req, res, next) => {
    try {
      const { email, phoneNumber } = req.body;

      const supplierExists = await Supplier.findOne({
        $or: [{ email }, { phoneNumber }],
      });

      if (supplierExists) {
        return res.status(400).send({
          ok: false,
          message: "Email or Phone Number already exists",
        });
      } else {
        const newItem = req.body;
        const data = new Supplier(newItem);
        let result = await data.save();
        return res
          .status(200)
          .send({ ok: true, message: "Created succesfully", result: result });
      }
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:id",
  ...allowPositions("employee"),
  validateByJoi(
    Joi.object({
      params: Joi.object({ id: IdStr2.required() }),
      body: Joi.object({
        name: Joi.string().max(100),
        email: Joi.string().max(50),
        phoneNumber: Joi.string().regex(phoneRegex),
        address: Joi.string().max(100),
      }),
    }),
  ),
  async (req, res, next) => {
    try {
      const itemId = req.params.id;
      const itemBody = req.body;
      const found = await Supplier.findByIdAndUpdate(itemId, itemBody);
      if (found) {
        return res.status(200).json({
          ok: true,
          message: "Updated Successfully!!",
          result: found,
        });
      }
      return res.status(404).json({ ok: false, message: "Item not found" });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:id",
  ...allowPositions("employee"),
  validateByJoi(Joi.object({ params: Joi.object({ id: IdStr2.required() }) })),
  async (req, res, next) => {
    try {
      const itemId = req.params.id;
      let found = await Supplier.findByIdAndDelete(itemId);
      if (found) {
        return res.status(200).json({
          ok: true,
          message: "Deleted Successfully!!",
          result: found,
        });
      }
      return res.status(500).json({ ok: true, message: "Delete Error!!" });
    } catch (e) {
      next(e);
    }
  },
);

module.exports = router;
