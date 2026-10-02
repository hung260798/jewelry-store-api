const router = require("express").Router();
const {
  validateByJoi,
  IdStr2,
  SortOrderSchema2,
} = require("../utils/validation.util");

const { allowPositions, optionalAuth } = require("../utils/misc.util");
const Product = require("../models/Product.model");
const Order = require("../models/Order.model");
const { slugify, generateUniqueSlug, devLog } = require("../utils/misc.util");
const queriesUtil = require("../utils/queries.util");
const Customer = require("../models/Customer.model");
const Cart = require("../models/Cart.model");
const Collection = require("../models/Collection.model");
const Joi = require("joi");
const {
  deleteFileFromGCS,
  getFileNameFromGCSUrl,
} = require("../services/gcs.service");

/**
 * @typedef { ProductDoc & {totalQuantity: number}} ProductWithQty
 */

/**@param {string} slug  */
async function findProductBySlug(slug) {
  const found = await Product.findOne({ slug: slug })
    .populate("category")
    .populate("supplier")
    .lean({ virtuals: true })
    .exec();
  return found;
}

/**
 * @typedef {{_id:string;productName:string;price:number;totalQuantity:number;unitSold:number}} UnitSold
 */

/**
 * Lấy danh sách sản phẩm cùng với số lượng đơn vị đã bán
 * @param {{productSort:unknown; productSkip?:number; productLimit?:number}} [options={}]
 * @returns {Promise.<Array.<UnitSold>>}
 */
async function getUnitSoldTable(options = {}) {
  const {
    productSort = { _id: 1 },
    productSkip = 0,
    productLimit = 10,
  } = options;
  const unitSoldTable = await Order.aggregate([
    {
      $match: {
        $expr: {
          $eq: ["$status", "COMPLETED"],
        },
      },
    },
    { $unwind: "$orderDetails" },
    {
      $lookup: {
        from: "products",
        localField: "orderDetails.productId",
        foreignField: "_id",
        as: "productSold",
      },
    },
    { $unwind: "$productSold" },
    {
      $group: {
        _id: "$productSold._id",
        productName: { $first: "$productSold.name" },
        price: { $first: "$productSold.price" },
        totalQuantity: { $sum: "$orderDetails.quantity" },
      },
    },
    {
      $project: {
        _id: 1,
        productName: 1,
        price: 1,
        totalQuantity: 1,
        unitSold: { $add: ["$totalQuantity", 0] },
      },
    },
    { $sort: productSort },
    { $skip: productSkip },
    { $limit: productLimit },
  ]);
  return unitSoldTable;
}

/**
 * Find sold amount of a product
 * @param {Product} product - product to find sold amount
 * @returns {number} number of sold product
 */
async function getSoldAmount(product) {
  /**
   * @type {ProductWithQty[]}
   */
  const unitSoldTable = await getUnitSoldTable();
  // Tìm theo id sản phẩm trong mảng sp
  const targetProduct = unitSoldTable.find((soldProduct) => {
    return product._id.toString() === soldProduct._id.toString();
  });
  let unitSold = 0;
  if (targetProduct) {
    unitSold = targetProduct.totalQuantity;
  }
  return unitSold;
}

router.get(
  "/",
  optionalAuth,
  validateByJoi(
    Joi.object({
      query: Joi.object({
        categoryId: Joi.array().items(IdStr2),
        supplierId: Joi.array().items(IdStr2),
        productName: Joi.string(),
        fromPrice: Joi.number()
          .integer()
          .min(0)
          .max(10 ** 11),
        toPrice: Joi.number()
          .integer()
          .min(0)
          .max(10 ** 11),
        fromDiscount: Joi.number().integer().min(0).max(100),
        toDiscount: Joi.number().integer().min(0).max(100),
        fromStock: Joi.number()
          .integer()
          .min(0)
          .max(10 ** 5),
        toStock: Joi.number()
          .integer()
          .min(0)
          .max(10 ** 5),
        skip: Joi.number().integer().min(0),
        limit: Joi.number().integer().min(0).max(10_000),
        sortBy: Joi.string().valid(
          "_id",
          "id",
          "name",
          "state",
          "stock",
          "discount",
          "price",
          "createdDate",
          "createdAt",
          "createdBy",
          "categoryId",
          "supplierId",
        ),
        sortOrder: SortOrderSchema2,
        active: Joi.boolean(),
        isDeleted: Joi.boolean(),
        createdDateFrom: Joi.string(),
        createdDateTo: Joi.string(),
        fieldsIncluded: Joi.array().items(
          Joi.string().valid(
            "name",
            "description",
            "id",
            "active",
            "isDeleted",
            "price",
            "stock",
            "discount",
            "category",
            "supplier",
            "createdDate",
            "updatedDate",
            "images",
            "imageUrl",
            "amountSold",
          ),
        ),
      }),
    }),
  ),
  async function getProducts(req, res, next) {
    try {
      const {
        active,
        isDeleted,
        categoryId,
        supplierId,
        productName,
        fromPrice,
        toPrice,
        fromDiscount,
        toDiscount,
        fromStock,
        toStock,
        hotDeal,
        topMonth,
        sortBy,
        createdDateFrom,
        createdDateTo,
      } = req.query;

      const {
        skip = 0,
        limit = 10,
        sortOrder = 1,
        fieldsIncluded = [
          "name",
          "description",
          "id",
          "active",
          "isDeleted",
          "price",
          "stock",
          "discount",
          "categoryId",
          "supplierId",
          "createdDate",
          "updatedDate",
          "images",
          "imageUrl",
          "amountSold",
          "slug",
          "total",
          "averageRate",
        ],
      } = req.parsedData.query;

      const queryFilter = {
        $and: [
          active === "true" ? { active: true } : null,
          active === "false" ? { active: false } : null,
          isDeleted === "true" ? { isDeleted: true } : null,
          isDeleted === "false" ? { isDeleted: false } : null,
          categoryId ? { categoryId: { $in: categoryId } } : null,
          supplierId ? { supplierId: { $in: supplierId } } : null,
          fromPrice ? { price: { $gte: Number(fromPrice) } } : null,
          toPrice ? { price: { $lte: Number(toPrice) } } : null,
          productName
            ? { name: { $regex: new RegExp(productName, "i") } }
            : null,
          fromStock ? { stock: { $gte: Number(fromStock) } } : null,
          toStock ? { stock: { $lte: Number(toStock) } } : null,
          fromDiscount ? { discount: { $gte: Number(fromDiscount) } } : null,
          toDiscount ? { discount: { $lte: Number(toDiscount) } } : null,
          hotDeal ? { promotionPosition: "DEAL" } : null,
          topMonth ? { promotionPosition: "TOP-MONTH" } : null,
          createdDateFrom
            ? { createdDate: { $gte: new Date(createdDateFrom) } }
            : null,
          createdDateTo
            ? { createdDate: { $lte: new Date(createdDateTo) } }
            : null,
        ].filter(Boolean),
      };
      // Enforce visibility rules: only employees may view inactive or deleted products
      const isEmployee = req.user && req.user.position === "employee";
      if (!isEmployee) {
        // If a non-employee explicitly requests deleted or inactive products, forbid the request
        if (isDeleted === "true" || active === "false") {
          return next({ status: 403, clientMessage: "Not allowed to request deleted or inactive products" });
        }
        // Otherwise, ensure only active, non-deleted products are returned
        queryFilter.$and.push({ isDeleted: false }, { active: true });
      }
      const sortPattern = {};
      if (sortBy && sortOrder) {
        sortPattern[sortBy] = sortOrder;
      }
      sortPattern.isDeleted ??= 1;
      sortPattern._id ??= 1;

      const mongooseQuery = Product.find(queryFilter)
        .populate({
          path: "category",
          select: "_id name",
        })
        .populate({
          path: "supplier",
          select: "_id name",
        })
        .select(`${fieldsIncluded.join(" ")}`)
        .lean({ virtuals: true })
        .sort(sortPattern)
        .collation({ locale: "vi", strength: 2 })
        .skip(skip)
        .limit(limit);
      let products = await mongooseQuery.exec();

      /** @type {ProductWithQty[]} */
      const arrayOfUnitSold = await Order.aggregate()
        // .match({ status: "COMPLETED" })
        .unwind("$orderDetails")
        .lookup({
          from: "products",
          localField: "orderDetails.productId",
          foreignField: "_id",
          as: "productSold",
        })
        .unwind("$productSold")
        .group({
          _id: "$productSold._id",
          productName: { $first: "$productSold.name" },
          price: { $first: "$productSold.price" },
          totalQuantity: { $sum: "$orderDetails.quantity" },
        });
      // Map the amountSold array to create a dictionary of ID-quantity pairs
      /** @type {Record.<string,number>} */
      const amountSoldDict = arrayOfUnitSold.reduce((dict, item) => {
        dict[item._id.toString()] = item.totalQuantity;
        return dict;
      }, []);

      // Add the "amountSold" field to each item in the "results" array
      products = products.map((product) => {
        const amountSoldQuantity = amountSoldDict[product._id.toString()] || 0;
        return {
          ...product,
          amountSold: amountSoldQuantity,
        };
      });
      const countKey = queriesUtil.buildCountKey({
        collection: "products",
        query: req.query,
      });
      const amountOfProducts = await queriesUtil.getCollectionCount({
        filter: queryFilter,
        key: countKey,
        model: Product,
        ttl: 60,
      });
      res.json({ results: products, amountResults: amountOfProducts });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/favorite", ...allowPositions("customer"), (req, res, next) => {
  const customerId = req.user._id;
  if (!customerId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  Customer.findById(customerId)
    .then((customer) => {
      if (!customer) {
        return res.status(404).json({ error: "Customer does not exist" });
      }
      res.json({ results: customer.favoriteProducts });
    })
    .catch(next);
});

// router.get("/testGetSoldUnitTable", handlers.testGetSoldUnitTable);

router.get(
  "/:id",
  optionalAuth,
  validateByJoi({ params: Joi.object({ id: IdStr2.required() }) }),
  async (req, res, next) => {
    try {
      const { type } = req.query;
      const idOrSlug = req.params.id;
      let found = await Product.findOne({
        [type === "slug" ? "slug" : "_id"]: idOrSlug,
      })
        .populate({ path: "category", select: "_id name" })
        .populate({ path: "supplier", select: "_id name" })
        .lean({ virtuals: true });
      if (!found) {
        return res.status(404).send({ ok: false, message: "Object not found" });
      }
      // Restrict deleted/inactive product access to employees
      const isEmployee = req.user && req.user.position === "employee";
      if (!isEmployee && (found.isDeleted === true || found.active === false)) {
        return res.status(404).send({ ok: false, message: "Object not found" });
      }
      found.amountSold = getSoldAmount(found);
      return res.status(200).json({ result: found });
    } catch (error) {
      next(error);
    }
  },
);

router.post("/orderp/:orderId/stock", async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    // Find the order by ID
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    // Update the stock for each product in the order details
    for (const orderDetail of order.orderDetails) {
      const productId = orderDetail.productId;
      const quantity = orderDetail.quantity;
      // Find the product by ID
      const product = await Product.findById(productId);
      if (!product) {
        devLog(`Product not found for order detail: ${orderDetail._id}`);
        continue;
      }
      product.stock -= quantity;
      await product.save();
    }
    res.json({ message: "Stock updated successfully" });
  } catch (error) {
    devLog(error);
    next(error);
  }
});

router.post("/orderm/:orderId/stock", async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);
    if (!order) {
      return next({ status: 404, message: "Order not found" });
    }
    // Update the stock for each product in the order details
    for (const orderDetail of order.orderDetails) {
      const productId = orderDetail.productId;
      const quantity = orderDetail.quantity;
      const product = await Product.findById(productId);
      if (!product) {
        devLog(`Product not found for order detail: ${orderDetail._id}`);
        continue;
      }
      product.stock += quantity;
      await product.save();
    }
    res.json({ message: "Stock updated successfully" });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  ...allowPositions("employee"),
  validateByJoi(
    Joi.object({
      body: Joi.object({
        name: Joi.string().max(200).required(),
        price: Joi.number().integer().positive().required(),
        categoryId: IdStr2.required(),
        supplierId: IdStr2.required(),
        stock: Joi.number().integer().min(0).default(0),
        discount: Joi.number().integer().min(0).max(75).default(0),
        images: Joi.array().items(Joi.string()).default([]),
        imageUrl: Joi.string().default(""),
      }),
    }),
  ),
  async (req, res, next) => {
    try {
      const product = new Product(req.body);
      product.createdDate = new Date();
      product.updatedDate = product.createdDate;
      product.slug = slugify(product.name);
      const fullProduct = await product.save();
      res.status(200).json({
        success: true,
        message: "Created successfully",
        result: fullProduct,
      });
    } catch (error) {
      devLog(error);
      next(error);
    }
  },
);

router.delete(
  "/:id",
  ...allowPositions("employee"),
  validateByJoi({ params: Joi.object({ id: IdStr2.required() }) }),
  async (req, res, next) => {
    try {
      const itemId = req.params.id;
      let found = await Product.findById(itemId);
      if (!found) {
        return res.status(404).json({ ok: false, message: "Object not found" });
      }
      if (!found.isDeleted) {
        const updateResult = await Product.updateOne(
          { _id: itemId },
          { $set: { isDeleted: true } },
        );
        return res.status(200).json({ ok: true, result: updateResult });
      }
      const product = await Product.findById(itemId);
      if (product.imageUrl) {
        deleteFileFromGCS(getFileNameFromGCSUrl(product.imageUrl)).catch(
          devLog,
        );
      }
      if (Array.isArray(product.images)) {
        const deleteImagePromises = product.images.map((imageUrl) =>
          deleteFileFromGCS(getFileNameFromGCSUrl(imageUrl)),
        );
        Promise.all(deleteImagePromises).catch(devLog);
      }
      const deleteResult = await Product.deleteOne({ _id: itemId });
      return res.status(200).json({ ok: true, result: deleteResult });
    } catch (error) {
      devLog(error);
      return next({ status: 500, message: "Product not found" });
    }
  },
);

router.patch(
  "/:id",
  ...allowPositions("employee"),
  validateByJoi(
    Joi.object({
      body: Joi.object({
        name: Joi.string().max(200),
        price: Joi.number().integer().positive(),
        discount: Joi.number().integer().min(0).max(75),
        stock: Joi.number().integer().min(0),
        categoryId: IdStr2,
        supplierId: IdStr2,
        imageUrl: Joi.string(),
        images: Joi.array().items(Joi.string()),
      }),
      params: Joi.object({
        id: IdStr2.required(),
      }),
    }),
  ),
  async function updateProduct(req, res, next) {
    try {
      const itemId = req.params.id;
      const itemBody = req.body;
      const { name } = itemBody;
      const product = await Product.findById(itemId);
      if (!product) {
        return next({ status: 404, message: "Object not found" });
      }
      if (name != null && name !== product.name) {
        console.log("name", name);
        itemBody.slug = await generateUniqueSlug(name, Product);
      }

      // const updatedProduct = await Product.findByIdAndUpdate(itemId, itemBody, {
      //   new: true,
      // });
      for (const key in itemBody) {
        product[key] = itemBody[key];
      }
      await product.save();
      try {
        await updateProductInOtherCollections(product.toObject());
      } catch (error) {
        throw Error("Update other collections error:" + error.message);
      }
      res.status(200).send({ ok: "Updated successfully", result: product });
    } catch (error) {
      devLog(error);
      next({ status: 500, message: "Cannot update product" });
    }
  },
);

/**
 *
 * @param {ProductDoc} product
 */
async function updateProductInOtherCollections(product) {
  // Cập nhật thông tin sản phẩm trong các collection khác nếu cần thiết
  try {
    await Cart.updateMany(
      { "products.product._id": product._id },
      { $set: { "products.$[item].product": product } },
      { arrayFilters: [{ "item.product._id": product._id }] },
    ).exec();
  } catch (e) {
    console.log(e);
    const er = Error("Synchronize product in Cart error :", e.message);
    er.stack = e.stack;
    throw er;
  }
  try {
    await Collection.updateMany(
      { "products._id": product._id },
      { $set: { "products.$[item]": product } },
      { arrayFilters: [{ "item._id": product._id }] },
    ).exec();
  } catch (e) {
    const er = Error("Synchronize product in Collection error :", e.message);
    er.stack = e.stack;
    throw er;
  }
}

router.get(
  "/slug/:slug",
  // optionalAuth,
  validateByJoi(
    Joi.object({
      params: Joi.object({
        slug: Joi.string().required(),
      }),
    }),
  ),
  async (req, res, next) => {
    try {
      const slug = req.params.slug;
      const product = await findProductBySlug(slug);
      if (!product) {
        return next({ status: 404, message: "Object not found" });
      }
      // Restrict deleted/inactive product access to employees
      const isEmployee = req.user && req.user.position === "employee";
      if (!isEmployee && (product.isDeleted === true || product.active === false)) {
        return next({ status: 404, message: "Object not found" });
      }
      product.amountSold = await getSoldAmount(product);
      res.status(200).json({ result: product });
    } catch (error) {
      devLog(error);
      next({ status: 500, message: "Server error" });
    }
  },
);

module.exports = router;
