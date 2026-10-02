const express = require("express");
const Joi = require("joi");

const { allowPositions } = require("../utils/misc.util");
const {
  validateByJoi,
  SortOrderSchema2,
  IdStr2,
} = require("../utils/validation.util");
const Feature = require("../models/Feature.model");

const router = express.Router();

router.get(
  "/",
  validateByJoi({
    query: Joi.object({
      title: Joi.string(),
      summary: Joi.string(),
      active: Joi.boolean(),
      skip: Joi.number().integer().min(0),
      limit: Joi.number().integer().min(0),
      sortBy: Joi.string(),
      sortOrder: SortOrderSchema2,
    }),
  }),
  async (req, res, next) => {
    try {
      const { title, summary, active, skip, limit, sortBy = "_id" } = req.query;

      const { sortOrder = 1 } = req.parsedData.query;

      const query = {
        $expr: {
          $and: [
            title && {
              $regexMatch: { input: "$title", regex: title, options: "i" },
            },
            summary && {
              $regexMatch: { input: "$summary", regex: summary, options: "i" },
            },
            // sortOrder ? { price: { $gte: Number(sortOrder) } } : null,
            active === "true" ? { active: true } : null,
            active === "false" ? { active: false } : null,
          ].filter(Boolean),
        },
      };

      const sortPattern = {};
      if (sortBy && sortOrder) {
        sortPattern[sortBy] = sortOrder;
      }
      sortPattern.active ??= -1;
      sortPattern._id ??= 1;

      let results = await Feature.find(query)
        .sort(sortPattern)
        .skip(skip)
        .limit(limit);

      let amountResults = await Feature.countDocuments(query);
      res.json({ results: results, amountResults: amountResults });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/",
  ...allowPositions("employee"),
  validateByJoi({
    body: Joi.object({
      title: Joi.string().required(),
      summary: Joi.string().required(),
      url: Joi.string().required(),
      imageUrl: Joi.string().required(),
      active: Joi.boolean().default(true),
      note: Joi.string().default(""),
      isDeleted: Joi.boolean().default(false),
    }),
  }),
  async (req, res, next) => {
    try {
      const newItem = req.body;
      const data = new Feature(newItem);
      let result = await data.save();
      res
        .status(200)
        .json({ success: true, message: "Created successfully", result });
    } catch (error) {
      next(error);
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
      const itemId = req.params.id;
      let found = await Feature.findByIdAndDelete(itemId);
      if (found) {
        return res
          .status(200)
          .send({ message: "Deleted Succesfully!!", found });
      }
      return res.status(410).send({ ok: false, message: "Object not found" });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:id",
  ...allowPositions("employee"),
  // validateRequest(
  //   yup.object({
  //     params: yup.object({ id: IdStr.required() }),
  //     body: yup.object({
  //       title: yup.string(),
  //       summary: yup.string(),
  //       url: yup.string(),
  //       imageUrl: yup.string(),
  //       active: yup.boolean(),
  //       note: yup.string(),
  //       isDeleted: yup.boolean(),
  //     }),
  //   }),
  // ),
  validateByJoi({
    params: Joi.object({
      id: IdStr2.required(),
    }),
    body: Joi.object({
      title: Joi.string(),
      summary: Joi.string(),
      url: Joi.string(),
      imageUrl: Joi.string(),
      active: Joi.boolean(),
      note: Joi.string(),
      isDeleted: Joi.boolean(),
    }),
  }),
  async (req, res, next) => {
    try {
      const itemId = req.params.id;
      const itemBody = req.body;
      if (itemId) {
        await Feature.findByIdAndUpdate(itemId, {
          $set: itemBody,
        });
        let itemUpdated = await Feature.findById(itemId);
        return res
          .status(200)
          .send({ message: "Updated successfully", result: itemUpdated });
      }
      return res.status(400).json({ error: "Item ID is required" });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
