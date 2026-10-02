const express = require("express");
const {
  validateByJoi,
  SortOrderSchema2,
  IdStr2,
} = require("../utils/validation.util");
const { allowPositions } = require("../utils/misc.util");
const Slide = require("../models/Slide.model");
const { devLog } = require("../utils/misc.util");
const Joi = require("joi");
const router = express.Router();


router.get(
  "/",
  validateByJoi(
    Joi.object({
      query: Joi.object({
        title: Joi.string(),
        summary: Joi.string(),
        url: Joi.string(),
        imageUrl: Joi.string().uri(),
        active: Joi.boolean(),
        note: Joi.string(),
        // skip: numberOrNumericStringWithRange(0, 1000),
        // limit: numberOrNumericStringWithRange(0, 1000),
        skip: Joi.number().min(0).max(1000),
        limit: Joi.number().min(0).max(1000),
        sortBy: Joi.string(),
        sortOrder: SortOrderSchema2,
      }),
    }),
  ),
  async (req, res, next) => {
    try {
      const { title, summary, active, sortBy = "_id" } = req.query;
      const { skip, limit, sortOrder = 1 } = req.parsedData.query;
      devLog("req.query", req.query);
      const query = {
        $and: [
          title && {
            $regexMatch: { input: "$title", regex: title, options: "i" },
          },
          summary && {
            $regexMatch: { input: "$summary", regex: summary, options: "i" },
          },
          // sortOrder ? { price: { $gte: Number(sortOrder) } } : null,
          active === "true" && { active: true },
          active === "false" && { active: false },
        ].filter(Boolean),
      };

      const results = await Slide.find(query)
        .sort({ active: 1, [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit);

      const amountResults = await Slide.countDocuments(query);
      res.json({ results: results, amountResults: amountResults });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/",
  ...allowPositions("employee"),
  validateByJoi(
    Joi.object({
      body: Joi.object({
        title: Joi.string().required(),
        summary: Joi.string().required(),
        url: Joi.string().required(),
        imageUrl: Joi.string().required(),
        sortOrder: Joi.number().default(1),
        active: Joi.boolean().default(true),
        note: Joi.string().default(""),
      }),
    }),
  ),
  async (req, res, next) => {
    try {
      const newItem = req.body;
      const data = new Slide(newItem);
      let result = await data.save();
      res
        .status(200)
        .json({ success: true, message: "Created successfully", result });
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
        title: Joi.string(),
        summary: Joi.string(),
        url: Joi.string(),
        imageUrl: Joi.string().uri(),
        sortOrder: Joi.number(),
        active: Joi.boolean(),
        note: Joi.string(),
      }),
    }),
  ),
  async (req, res, next) => {
    try {
      const itemId = req.params.id;
      const itemBody = req.body;
      const itemUpdated = await Slide.findByIdAndUpdate(
        itemId,
        {
          $set: itemBody,
        },
        { new: true },
      );
      if (!itemUpdated) {
        return res
          .status(404)
          .json({ message: "Can't find document", result: null });
      }
      res
        .status(200)
        .send({ message: "Updated successfully", result: itemUpdated });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:id",
  ...allowPositions("employee"),
  validateByJoi(
    Joi.object({
      params: Joi.object({ id: IdStr2.required() }),
    }),
  ),
  async (req, res, next) => {
    try {
      const itemId = req.params.id;
      let found = await Slide.findByIdAndDelete(itemId);
      if (found) {
        return res
          .status(200)
          .send({ message: "Deleted Succesfully!!", found });
      }
      return res.status(410).send({ ok: false, message: "Object not found" });
    } catch(error) {
      next(error);
    }
  },
);

module.exports = router;
