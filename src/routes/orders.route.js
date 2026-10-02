const router = require("express").Router();
const passport = require("passport");
const {
  validateByJoi,
  SortOrderSchema2,
  phoneRegex,
  IdStr2,
} = require("../utils/validation.util");
const {
  PaymentTypes,
  OrderStatus,
  allowPositions,
} = require("../utils/misc.util");

const crypto = require("crypto");
const axios = require("axios");
const moment = require("moment");
const _ = require("lodash");

const { buildCountKey, getCollectionCount } = require("../utils/queries.util");
const { devLog } = require("../utils/misc.util");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const Joi = require("joi");

const WEBSHOP_URL = process.env.WEB_SHOP_URL || `http://localhost:4444`;

const jwtAuth = passport.authenticate("jwt", { session: false });

router.get(
  ["/", "/v2"],
  ...allowPositions("employee"),
  validateByJoi(
    Joi.object({
      query: Joi.object({
        orderId: IdStr2,
        customerId: IdStr2,
        methodPay: Joi.string().valid(...PaymentTypes),
        status: Joi.string().valid(...OrderStatus),
        shippingAddress: Joi.string(),
        employee: IdStr2,
        createdDateFrom: Joi.date(),
        createdDateTo: Joi.date(),
        shippedDateFrom: Joi.date(),
        shippedDateTo: Joi.date(),
        skip: Joi.number().min(0).integer(),
        limit: Joi.number().min(0).integer(),
        sortBy: Joi.string().allow(
          "createdDate",
          "shippedDate",
          "description",
          "shippingAddress",
          "paymentType",
          "status",
          "note",
          "customer.firstName",
          "customer.lastName",
          "total",
        ),
        sortOrder: SortOrderSchema2,
        fields: Joi.array().items(
          Joi.string().allow(
            "createdDate",
            "shippedDate",
            "description",
            "shippingAddress",
            "contactInformation",
            "paymentType",
            "status",
            "customer",
            "employee",
            "position",
            "orderDetails",
            "note",
            "customer.firstName",
            "customer.lastName",
            "total",
          ),
        ),
      }),
    }),
  ),
  async function getOrdersV2(req, res, next) {
    try {
      const {
        orderId,
        customerId,
        methodPay,
        status,
        shippingAddress,
        employee,
        sortBy,
        createdDateFrom,
        createdDateTo,
        shippedDateFrom,
        shippedDateTo,
      } = req.query;
      const {
        skip = 0,
        limit = 10,
        sortOrder,
        fields = [
          "createdDate",
          "shippedDate",
          "description",
          "shippingAddress",
          "contactInformation",
          "paymentType",
          "status",
          "customer",
          "employee",
          "position",
          "orderDetails",
          "note",
          "total",
        ],
      } = req.parsedData.query;

      const mongoQuery = {
        // Can not use empty array with $and
        $and: [
          orderId && { _id: orderId },
          customerId && { customerId },
          methodPay && { paymentType: methodPay },
          status && { status },
          shippingAddress && { shippingAddress },
          employee && { employee },
          createdDateFrom && { createdDate: { $gte: createdDateFrom } },
          createdDateTo && { createdDate: { $lte: createdDateTo } },
          shippedDateFrom && { createdDate: { $gte: shippedDateFrom } },
          shippedDateTo && { createdDate: { $lte: shippedDateTo } },
        ].filter(Boolean),
      };

      const sortPattern = {};
      if (typeof sortBy === "string" && !!sortOrder) {
        sortPattern[sortBy] = sortOrder;
      }
      sortPattern.createdDate ??= -1;
      sortPattern._id ??= +1;

      const selectCustomer = fields.some((value) =>
        value.startsWith("customer"),
      );

      const selectEmployee = fields.some((value) =>
        value.startsWith("employee"),
      );

      const selectOrderDetails = fields.some(
        (value) => value === "orderDetails" || value === "total",
      );

      const sortLater =
        (typeof sortBy === "string" &&
          !!sortOrder &&
          (sortBy.startsWith("customer.") ||
            sortBy.startsWith("employee.") ||
            sortBy === "total")) ||
        selectOrderDetails;

      const results = await Order.aggregate(
        [
          { $match: _.merge({}, ...mongoQuery.$and) },
          !sortLater && [
            { $sort: sortPattern },
            { $skip: skip },
            { $limit: limit },
          ],
          selectCustomer && [
            {
              $lookup: {
                from: "customers",
                foreignField: "_id",
                localField: "customerId",
                as: "customer",
              },
            },
            {
              $unwind: { path: "$customer", preserveNullAndEmptyArrays: true },
            },
          ],
          selectEmployee && [
            {
              $lookup: {
                from: "employees",
                foreignField: "_id",
                localField: "employeeId",
                as: "employee",
              },
            },
            {
              $unwind: { path: "$employee", preserveNullAndEmptyArrays: true },
            },
          ],
          selectOrderDetails && [
            {
              $unwind: {
                path: "$orderDetails",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                from: "products",
                localField: "orderDetails.productId",
                foreignField: "_id",
                as: "orderDetails.product",
              },
            },
            {
              $unwind: "$orderDetails.product",
            },
            {
              $set: {
                "orderDetails.product.total": {
                  $divide: [
                    {
                      $multiply: [
                        "$orderDetails.product.price",
                        { $subtract: [100, "$orderDetails.product.discount"] },
                      ],
                    },
                    100,
                  ],
                },
              },
            },
            {
              $group: {
                _id: "$_id",
                customer: { $first: "$customer" },
                employee: { $first: "$employee" },
                createdDate: { $first: "$createdDate" },
                shippedDate: { $first: "$shippedDate" },
                status: { $first: "$status" },
                shippingAddress: { $first: "$shippingAddress" },
                contactInformation: { $first: "$contactInformation" },
                position: { $first: "$position" },
                paymentType: { $first: "$paymentType" },
                orderDetails: { $push: "$orderDetails" },
              },
            },
          ],
          fields.includes("total") && {
            $set: {
              total: {
                $reduce: {
                  input: "$orderDetails",
                  initialValue: 0,
                  in: {
                    $add: [
                      "$$value",
                      {
                        $multiply: [
                          "$$this.price",
                          "$$this.quantity",
                          { $subtract: [100, "$$this.discount"] },
                          1 / 100,
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
          sortLater && [
            { $sort: sortPattern },
            { $skip: skip },
            { $limit: limit },
          ],
          {
            $project: _.fromPairs(_.map(fields, (field) => [field, 1])),
          },
          {
            $project: {
              customer: {
                password: 0,
                refreshToken: 0,
                createdBy: 0,
                createdDate: 0,
                updatedBy: 0,
                updatedDate: 0,
                favoriteProducts: 0,
              },
              employee: {
                password: 0,
                refreshToken: 0,
                createdBy: 0,
                createdDate: 0,
                updatedBy: 0,
                updatedDate: 0,
              },
            },
          },
        ]
          .filter(Boolean)
          .flat(1),
      )
        .collation({ locale: "vi" })
        .exec();

      const countKey = buildCountKey({
        collection: "orders",
        query: req.query,
      });
      const amountResults = await getCollectionCount({
        filter: mongoQuery,
        key: countKey,
        model: Order,
        ttl: 60,
      });
      res.json({ results, amountResults });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/personal",
  ...allowPositions("customer"),
  async (req, res, next) => {
    try {
      const { _id: customerId } = req.user;
      const query = { customerId };
      const personalOrders = await Order.find(query)
        .populate({
          path: "orderDetails.product",
          populate: { path: "category" },
        })
        .populate("employee", "firstName lastName")
        .exec();
      const amountResults = await Order.countDocuments(query);
      res.send({ results: personalOrders, amountResults: amountResults });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/:id",
  ...allowPositions("employee"),
  validateByJoi(
    Joi.object({
      params: Joi.object({
        id: IdStr2.required(),
      }),
    }),
  ),
  async function getOrderDetail(req, res, next) {
    try {
      const { id } = req.params;
      const result = await Order.findById(id)
        .populate({
          path: "orderDetails.product",
          populate: { path: "category" },
        })
        .populate(
          "customer",
          "-password -refreshToken -birthday -createdDate -createdBy -updatedDate -updatedBy -bio -favoriteProducts",
        )
        .populate(
          "employee",
          "-password -refreshToken -createdDate -createdBy -updatedDate -updatedBy",
        )
        .exec();

      res.json({ result });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/",
  ...allowPositions("customer"),
  (req, res, next) => {
    req.body.customerId = req.user._id;
    next();
  },
  validateByJoi(
    Joi.object({
      body: Joi.object({
        description: Joi.string(),
        shippingAddress: Joi.string().required(),
        paymentType: Joi.string()
          .valid(...PaymentTypes)
          .default("CASH"),
        status: Joi.string()
          .valid(...OrderStatus)
          .default("WAITING"),
        customerId: IdStr2.required(),
        employeeId: IdStr2,
        orderDetails: Joi.array()
          .items(
            Joi.object({
              productId: IdStr2.required(),
              quantity: Joi.number().integer().min(1).required(),
            }),
          )
          .min(1)
          .required(),
        contactInformation: Joi.object({
          address: Joi.string().required(),
          firstName: Joi.string().required(),
          lastName: Joi.string().required(),
          phoneNumber: Joi.string().regex(phoneRegex).required(),
        }).required(),
        position: Joi.object({
          lat: Joi.string(),
          lng: Joi.string(),
          name: Joi.string(),
        }),
        note: Joi.string(),
      }),
    }),
  ),
  async function createOrder(req, res, next) {
    try {
      const newOrder = new Order({
        ...req.body,
        customerId: req.body.customerId ?? req.user._id,
      });
      newOrder.orderDetails.forEach((od) => {
        od.price = od.price ?? od.product.price;
        od.discount = od.discount ?? od.product.discount;
      });
      const savedOrder = await newOrder.save();
      await Promise.all(
        newOrder.orderDetails.map(({ productId, quantity }) =>
          Product.findByIdAndUpdate(
            productId,
            {
              $inc: { stock: -quantity },
            },
            {
              new: false,
            },
          ).exec(),
        ),
      );
      res.json({
        ok: true,
        result: savedOrder,
      });
    } catch (err) {
      return next(err);
    }
  },
);

router.post(
  "/v2",
  ...allowPositions("employee"),
  validateByJoi(
    Joi.object({
      body: Joi.object({
        description: Joi.string(),
        shippingAddress: Joi.string().required(),
        paymentType: Joi.string()
          .valid(...PaymentTypes)
          .default("CASH"),
        status: Joi.string()
          .valid(...OrderStatus)
          .default("WAITING"),
        customerId: IdStr2.required(),
        employeeId: IdStr2,
        orderDetails: Joi.array()
          .items(
            Joi.object({
              productId: IdStr2.required(),
              quantity: Joi.number().integer().min(1).required(),
            }),
          )
          .min(1)
          .required(),
        contactInformation: Joi.object({
          address: Joi.string().required(),
          firstName: Joi.string().required(),
          lastName: Joi.string().required(),
          phoneNumber: Joi.string().regex(phoneRegex).required(),
        }).required(),
        position: Joi.object({
          lat: Joi.string(),
          lng: Joi.string(),
          name: Joi.string(),
        }),
        note: Joi.string(),
      }),
    }),
  ),
  async function createOrderV2(req, res, next) {
    try {
      const newOrder = new Order({
        ...req.body,
        customerId: req.body.customerId,
      });
      const savedOrder = await newOrder.save();
      await Promise.all(
        newOrder.orderDetails.map(({ productId, quantity }) =>
          Product.findByIdAndUpdate(
            productId,
            {
              $inc: { stock: -quantity },
            },
            {
              new: false,
            },
          ).exec(),
        ),
      );
      res.json({
        ok: true,
        result: savedOrder,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id",
  jwtAuth,
  validateByJoi(
    Joi.object({
      body: Joi.object({
        description: Joi.string(),
        shippingAddress: Joi.string(),
        paymentType: Joi.string().valid(...PaymentTypes),
        status: Joi.string().valid(...OrderStatus),
        customerId: IdStr2,
        employeeId: IdStr2,
        orderDetails: Joi.array()
          .items(
            Joi.object({
              productId: IdStr2.required(),
              quantity: Joi.number().integer().min(1).required(),
            }),
          )
          .min(1),
        contactInformation: Joi.object({
          address: Joi.string(),
          firstName: Joi.string(),
          lastName: Joi.string(),
          phoneNumber: Joi.string().regex(phoneRegex),
        }),
        position: Joi.object({
          lat: Joi.string(),
          lng: Joi.string(),
          name: Joi.string(),
        }),
        note: Joi.string(),
      }),
      params: Joi.object({ id: IdStr2.required() }),
    }),
  ),
  async function updateOrder(req, res, next) {
    try {
      const oldOrder = await Order.findById(req.params.id);
      const status = req.body.status;
      let newOrder = null;
      if (status === "ECONFIRMED" && oldOrder.status === "WAITING") {
        const employeeId = req.user._id ?? req.body.employeeId;
        if (!employeeId) {
          res.status(400).json({ error: "Cần thông tin employee" });
          return;
        }
        req.body.employeeId = employeeId;
      } else if (
        status === "CANCELED" &&
        ["WAITING", "ECONFIRMED"].includes(oldOrder.status)
      ) {
        await Promise.all(
          newOrder.orderDetails.map(({ productId, quantity }) =>
            Product.findByIdAndUpdate(
              productId,
              {
                $inc: { stock: +quantity },
              },
              {
                new: false,
              },
            ),
          ),
        );
      } else if (status === "COMPLETED" && oldOrder.status === "ECONFIRMED") {
        req.body.shippedDate = new Date();
      }
      newOrder = await Order.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        {
          new: true,
        },
      );
      res.json(newOrder);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/:id",
  ...allowPositions("employee"),
  validateByJoi({
    params: Joi.object({ id: IdStr2.required() }),
  }),
  async function deleteOrder(req, res, next) {
    try {
      const { id } = req.params;
      const deleteResult = await Order.findByIdAndDelete(id);
      res.json({ result: deleteResult });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/q/1", ...allowPositions("employee"), async (req, res, next) => {
  try {
    const { status } = req.query;
    /** @type {unknown[]} */
    const result = await Order.find(
      { status: status },
      {
        createdDate: 1,
        status: 1,
        paymentType: 1,
        orderDetails: 1,
        customerId: 1,
        employeeId: 1,
      },
    )
      .populate({
        path: "orderDetails.product",
        select: { name: 1, price: 1, discount: 1, stock: 1 },
      })
      .populate({ path: "customer", select: "firstName lastName" })
      .populate({ path: "employee", select: "firstName lastName" });

    res.send(result);
  } catch (err) {
    next(err);
  }
});

router.get("/q/2", ...allowPositions("employee"), async (req, res, next) => {
  try {
    const { status, date } = req.query;
    const fromDate = new Date(date);
    const toDate = new Date(new Date(date).setDate(fromDate.getDate() + 1));

    const compareStatus = { $eq: ["$status", status] };
    const compareFromDate = { $gte: ["$createdDate", fromDate] };
    const compareToDate = { $lt: ["$createdDate", toDate] };

    let result = await Order.aggregate([
      {
        $match: {
          $expr: { $and: [compareStatus, compareFromDate, compareToDate] },
        },
      },
    ]).project({
      _id: 1,
      status: 1,
      paymentType: 1,
      createdDate: 1,
      orderDetails: 1,
      employeeId: 1,
      customerId: 1,
    });
    result = await Order.populate(result, [
      { path: "employee" },
      { path: "customer" },
      {
        path: "orderDetails.product",
        select: { name: 0, price: 1, discount: 1 },
      },
    ]);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

router.get("q/3", ...allowPositions("employee"), async (req, res, next) => {
  try {
    let { status, fromDate, toDate } = req.query;
    fromDate = new Date(fromDate);
    const tmpToDate = new Date(toDate);
    toDate = new Date(tmpToDate.setDate(tmpToDate.getDate() + 1));

    // devLog('fromDate', fromDate);
    // devLog('toDate', toDate);

    const compareStatus = { $eq: ["$status", status] };
    const compareFromDate = { $gte: ["$createdDate", fromDate] };
    const compareToDate = { $lt: ["$createdDate", toDate] };

    await Order.aggregate([
      {
        $match: {
          $expr: { $and: [compareStatus, compareFromDate, compareToDate] },
        },
      },
    ])
      .project({
        _id: 1,
        status: 1,
        paymentType: 1,
        createdDate: 1,
        orderDetails: 1,
        employeeId: 1,
        customerId: 1,
      })
      .then((result) =>
        Order.populate(result, [
          { path: "employee" },
          { path: "customer" },
          {
            path: "orderDetails.product",
            select: { name: 1, price: 1, discount: 1 },
          },
        ])
          .then((data) => {
            res.send(data);
          })
          .catch((err) => {
            next(err);
          }),
      )
      .catch((err) => {
        res.status(400).send({ message: err.message });
      });
  } catch (err) {
    next(err);
  }
});

router.post("/pay/create_momo_url", (req, res, next) => {
  devLog("req:", req.body);
  const endpoint = "https://test-payment.momo.vn/v2/gateway/api/create";
  const partnerCode = "MOMOBKUN20180529";
  const accessKey = "klm05TvNBzhg7h7j";
  const secretKey = "at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa";
  const orderInfo = "Thanh toán qua MoMo";
  const amount = req.body.amount;
  const orderId = `${Date.now()}`;
  const redirectUrl = `${WEBSHOP_URL}/success-payment`;
  const ipnUrl = `${WEBSHOP_URL}/success-payment`;
  const extraData = "";

  const requestBody = {
    partnerCode,
    partnerName: "Test",
    storeId: "MomoTestStore",
    requestId: `${Date.now()}`,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    lang: "vi",
    extraData,
    requestType: "payWithATM",
  };

  const rawHash = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestBody.requestId}&requestType=${requestBody.requestType}`;

  requestBody.signature = crypto
    .createHmac("sha256", secretKey)
    .update(rawHash)
    .digest("hex");

  execPostRequest(endpoint, requestBody)
    .then((result) => {
      const payUrl = result.payUrl;
      res.json({ urlPay: payUrl });
    })
    .catch(next);
});

router.post("/pay/create_vnpay_url", (req, res) => {
  devLog("««««« req.body »»»»»", req.body);
  const ipAddr =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;

  const config = require("config");
  const tmnCode = config.get("vnPay.vnp_TmnCode");
  const secretKey = config.get("vnPay.vnp_HashSecret");
  const vnpUrl = config.get("vnPay.vnp_Url");
  const returnUrl = `${WEBSHOP_URL}/success-payment`;

  const date = moment(); // Use moment to get the current date and time

  const createDate = date.format("YYYYMMDDHHmmss"); // Format the date using moment
  const orderId = date.format("HHmmss"); // Format the time using moment

  const amount = req.body.amount * 100;

  let orderInfo = req.body.orderDescription;
  let orderType = req.body.orderType;
  let locale = req.body.language;
  if (!locale || locale === "") {
    locale = "vn";
  }
  const currCode = "VND";
  const vnp_Params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Locale: locale,
    vnp_CurrCode: currCode,
    vnp_TxnRef: orderId,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: orderType,
    vnp_Amount: amount,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
    vnp_BankCode: "NCB",
  };

  const sortedParams = sortObject(vnp_Params);
  const signData = new URLSearchParams(sortedParams).toString();
  const hmac = crypto.createHmac("sha512", secretKey);
  sortedParams["vnp_SecureHash"] = hmac
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");
  const vnpUrlWithParams =
    vnpUrl + "?" + new URLSearchParams(sortedParams).toString();

  res.send({ urlPay: vnpUrlWithParams });
});

router.use((err, req, res, next) => {
  next(new Error(`order route error:, ${err.message}`));
});

function execPostRequest(url, data) {
  return axios
    .post(url, data, {
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(JSON.stringify(data)).toString(),
      },
      timeout: 5000,
      timeoutErrorMessage: "Request timeout",
    })
    .then((response) => response.data);
}

function sortObject(obj) {
  const sortedObj = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sortedObj[key] = obj[key];
    });
  return sortedObj;
}

module.exports = router;
