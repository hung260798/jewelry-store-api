const router = require("express").Router();
const { allowPositions, devLog } = require("../utils/misc.util");
const {
  validateByJoi,
  SortOrderSchema2,
  IdStr2,
} = require("../utils/validation.util");

const Collection = require("../models/Collection.model");
const Joi = require("joi");

/**
 * @typedef {{_id: string,
 *  name: string,
 *  price: string,
 *  categoryId: string,
 *  supplierId: string,
 *  discount: number,
 *  stock: number,
 *  active: boolean,
 *  isDeleted: boolean,
 * }} ProductDoc
 *
 */

/**
 * @typedef { ProductDoc & {totalQuantity: number}} ProductWithQty
 */

router.get(
  "/",
  validateByJoi({
    query: Joi.object({
      status: Joi.string().allow("active", "inactive").lowercase(),
      name: Joi.string(),
      description: Joi.string(),
      skip: Joi.number()
        .min(0)
        .max(10 ** 10),
      limit: Joi.number().min(0).max(30),
      sortBy: Joi.string(),
      sortOrder: SortOrderSchema2,
      productsLimit: Joi.number().min(0).max(10).default(5),
      productFields: Joi.string(), // New query parameter for product fields selection
    }),
  }),
  async (req, res, next) => {
    try {
      const {
        active,
        isDeleted,
        name,
        status,
        description,
        sortBy,
        productFields,
      } = req.query;
      const {
        skip = 0,
        limit = 10,
        sortOrder,
        productsLimit,
      } = req.parsedData.query;

      // Build the query object
      const query = {
        $and: [
          active === "true" ? { active: true } : null,
          active === "false" ? { active: false } : null,
          isDeleted === "true" ? { isDeleted: true } : null,
          isDeleted === "false" ? { isDeleted: false } : null,
          name ? { name: { $regex: new RegExp(name, "i") } } : null, // Rename productName to "name"
          description
            ? { description: { $regex: new RegExp(description, "i") } }
            : null,
          status ? { status } : null,
        ].filter(Boolean), // Remove null values
      };

      // Build the sort object
      const sortPattern = {};
      if (sortBy && sortOrder) {
        sortPattern[sortBy] = sortOrder;
      }
      sortPattern.isDeleted ??= 1;
      sortPattern._id ??= 1;
      const mongooseQuery = Collection.find(query)
        .select({
          products: { $slice: productsLimit },
        }) 
        .sort(sortPattern);
      if (["name", "description"].includes(sortBy)) {
        mongooseQuery.collation({ locale: "vi", strength: 2 });
      }
      mongooseQuery.skip(skip).limit(limit);
      const collections = await mongooseQuery.exec();
      const amountResults = collections.length;
      res.json({ results: collections, ok: true, amountResults });
    } catch (error) {
      next({ status: 500, message: error.message });
    }
  },
);

router.get(
  "/slug/:slug",
  validateByJoi({
    params: Joi.object({
      slug: Joi.string().required(),
    }),
  }),
  async function (req, res, next) {
    try {
      const {
        params: { slug },
      } = req;
      const collection = await Collection.findOne({ slug })
        .select({ products: { $slice: 5 } })
        .exec();
      if (!collection) {
        return res.status(404).json({ ok: false, message: "Object not found" });
      }
      res.json({ result: collection });
    } catch (error) {
      next({ status: 500, message: error.message });
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
  async function (req, res, next) {
    try {
      const {
        params: { id },
      } = req;
      const collection = await Collection.findById(id)
        .select({ products: { $slice: 5 } })
        .exec();
      res.json({ result: collection });
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
      description: Joi.string(),
      name: Joi.string().required(),
      image: Joi.string().default(""),
      coverImage: Joi.string().default(""),
      status: Joi.string().allow("active", "inactive").default("active"),
    }),
  }),
  async function (req, res, next) {
    try {
      const { body } = req;
      const collection = new Collection(body);
      const result = await collection.save();
      res.json({ result, message: "Created" });
    } catch (error) {
      next({ status: 500, message: error.message });
    }
  },
);

router.patch(
  "/:id",
  ...allowPositions("employee"),
  validateByJoi({
    body: Joi.object({
      name: Joi.string(),
      description: Joi.string(),
      image: Joi.string(),
      coverImage: Joi.string(),
      status: Joi.string().allow("active", "inactive"),
    }),
    params: Joi.object({
      id: IdStr2.required(),
    }),
  }),
  async function (req, res, next) {
    try {
      const {
        params: { id },
        body,
      } = req;
      const collection = await Collection.findById(id);
      for (const key in body) {
        collection[key] = body[key];
      }
      const result = await collection.save();
      // const result = await Collection.findByIdAndUpdate({ _id: id }, body, {
      //   new: true,
      // });
      res.json({ result, message: "Updated successfully" });
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
  async function (req, res, next) {
    try {
      const {
        params: { id },
      } = req;
      const result = await Collection.deleteOne({ _id: id }).exec();
      res.json({ result });
    } catch (error) {
      next({ status: 500, message: error.message });
    }
  },
);

module.exports = router;
