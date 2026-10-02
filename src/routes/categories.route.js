const router = require("express").Router();
const { allowPositions } = require("../utils/misc.util");
const { validateByJoi, IdStr2 } = require("../utils/validation.util");
const Category = require("../models/Category.model");
const Joi = require("joi");

router.get(
  "/",
  validateByJoi(
    Joi.object({
      query: Joi.object({
        active: Joi.boolean(),
        isDeleted: Joi.boolean(),
        name: Joi.string(),
        description: Joi.string(),
        skip: Joi.number().integer().min(0),
        limit: Joi.number().integer().min(0).max(50),
        hotDeal: Joi.boolean(),
        topMonth: Joi.boolean(),
        slug: Joi.string(),
        id: Joi.string(),
        sortOrder: Joi.alternatives(Joi.string()).custom((value) => {
          if (value === "1" || value === "asc") {
            return 1;
          }
          if (value === "-1" || value === "desc") {
            return -1;
          }
          return undefined;
        }),
        sortBy: Joi.string().allow(
          "name",
          "createdAt",
          "updatedAt",
          "active",
          "isDeleted",
          "description",
          "_id",
          "id",
          "note",
          "displayOrder",
        ),
        fields: Joi.array().items(
          Joi.string().valid(
            "name",
            "description",
            "id",
            "active",
            "isDeleted",
            "coverImageUrl",
            "promotionPosition",
            "imageUrl",
            "updatedDate",
            "updatedBy",
            "slug",
            "displayOrder",
            "note",
            "parentCategory",
            "parentCategoryDoc",
          ),
        ),
      }),
    }),
  ),
  async (req, res, next) => {
    try {
      const {
        active,
        isDeleted,
        name,
        description,
        hotDeal,
        topMonth,
        slug,
        id,
      } = req.query;

      const {
        skip,
        limit,
        fields = [
          "name",
          "description",
          "id",
          "active",
          "isDeleted",
          "coverImageUrl",
          "promotionPosition",
          "imageUrl",
          "updatedDate",
          "updatedBy",
          "slug",
          "displayOrder",
          "note",
          "parentCategory",
          // "parentCategory",
        ],
      } = req.parsedData.query;

      if (slug) {
        const result = await Category.findOne({ slug: slug }).exec();
        if (result) {
          return res.json({ result: result });
        }
        return res.status(404).json({ message: "no category" });
      }
      if (id) {
        const result = await Category.findById(id);
        if (result) {
          return res.json({ result: result });
        }
        return res.status(404).json({ message: "no category" });
      }
      const query = {
        $and: [
          active === "true" ? { active: true, isDeleted: false } : null,
          active === "false" ? { active: false, isDeleted: false } : null,
          isDeleted === "true" ? { isDeleted: true } : null,
          name ? { name: { $regex: new RegExp(name, "i") } } : null,
          description
            ? { description: { $regex: new RegExp(description, "i") } }
            : null,
          hotDeal ? { promotionPosition: "DEAL" } : null,
          topMonth ? { promotionPosition: "TOP-MONTH" } : null,
        ].filter(Boolean),
      };
      const { sortBy } = req.query;
      const { sortOrder = 1 } = req.parsedData.query;
      const sortPattern = {};
      if (sortBy && sortOrder) {
        sortPattern[sortBy] = sortOrder;
      }
      sortPattern._id ??= 1;
      const mongooseQuery = Category.find(query)
        .select(fields.join(" "))
        .sort(sortPattern);
      if (fields.includes("parentCategoryDoc")) {
        mongooseQuery.populate("parentCategory", "name _id slug");
      }
      if (["name", "description"].includes(sortBy)) {
        mongooseQuery.collation({ locale: "vi", strength: 2 });
      }
      mongooseQuery.skip(Number(skip)).limit(Number(limit));
      const results = await mongooseQuery.exec();
      const amountResults = await Category.countDocuments(query);
      res.json({ results, amountResults });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/:id",
  validateByJoi({
    params: Joi.object({
      id: IdStr2.required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { type } = req.query;
      const itemId = req.params.id;
      let found = null;
      if (type === "slug") {
        found = await Category.findOne({ slug: itemId }).exec();
      } else {
        found = await Category.findById(itemId).exec();
      }
      if (found) {
        return res.send({ message: "Get successfully!!", result: found });
      }
      return res.status(410).send({ ok: false, message: "Object not found" });
    } catch (error) {
      next(error);
      // throw error;
    }
  },
);

router.post(
  "/",
  ...allowPositions("employee"),
  validateByJoi(
    Joi.object({
      body: Joi.object({
        name: Joi.string().required(),
        description: Joi.string(),
        promotionPosition: Joi.array()
          .items(Joi.string().valid("DEAL", "TOP-MONTH", "TOP-WEEK"))
          .default([]),
        active: Joi.boolean().default(true).strict(),
        isDeleted: Joi.boolean().default(false).strict(),
        note: Joi.string(),
        parentCategory: IdStr2,
        displayOrder: Joi.number().default(0),
        coverImageUrl: Joi.string(),
        imageUrl: Joi.string(),
      }),
    }),
  ),
  async (req, res, next) => {
    try {
      const { name } = req.body;
      const categoryExists = await Category.findOne({ name });
      if (categoryExists) {
        return res
          .status(400)
          .send({ ok: false, message: `Category ${name} already exists` });
      }
      const data = new Category(req.body);
      let result = await data.save();
      res.status(201).json({ ok: true, message: "Created", result });
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
      id: IdStr2,
    }).required(),
  }),
  async function (req, res, next) {
    try {
      const itemId = req.params.id;
      const found = await Category.findByIdAndDelete(itemId);
      if (found) {
        return res.send({ message: "Deleted successfully!!", result: found });
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
  validateByJoi({
    params: Joi.object({
      id: IdStr2.required(),
    }),
    body: Joi.object({
      name: Joi.string(),
      description: Joi.string(),
      note: Joi.string().allow(""),
      active: Joi.boolean(),
      isDeleted: Joi.boolean(),
      displayOrder: Joi.number(),
      promotionPosition: Joi.array().items(
        Joi.string().valid("DEAL", "TOP-MONTH", "TOP-WEEK"),
      ),
      parentCategory: IdStr2,
      coverImageUrl: Joi.string(),
      imageUrl: Joi.string(),
    }),
  }),
  async function (req, res, next) {
    try {
      const itemId = req.params.id;
      if (itemId) {
        const update = await Category.findByIdAndUpdate(
          itemId,
          req.body,
        ).exec();
        res
          .status(200)
          .send({ message: "Updated successfully", result: update });
      }
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;

// const { value, error } = Joi.string()
//   .custom((value) => {
//     if (value === "1" || value === "asc") {
//       return 1;
//     }
//     if (value === "-1" || value === "desc") {
//       return -1;
//     }
//     return undefined;
//   })
//   .validate("asc");
// console.log("value", value, "error", error);
