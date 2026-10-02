const passport = require("passport");

/**
 * @typedef {import("express").Handler} Handler
 * @typedef {import("express").Router} Router
 */
exports.devLog = function (...args) {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
};

/**
 *
 * @param {string} from
 * @param {string} to
 * @param {"IN"|"OUT"} type
 * @returns
 */
exports.getQueryDateTime = (from, to, type = "IN") => {
  const fromDate = new Date(from);
  const tmpToDate = new Date(to);
  const toDate = new Date(tmpToDate.setDate(tmpToDate.getDate() + 1));
  let query = {};
  if (type === "IN") {
    const compareFromDate = { $gte: ["$createdDate", fromDate] };
    const compareToDate = { $lt: ["$createdDate", toDate] };
    query = {
      $expr: { $and: [compareFromDate, compareToDate] },
    };
  } else {
    const compareFromDate = { $lt: ["$createdDate", fromDate] };
    const compareToDate = { $gt: ["$createdDate", toDate] };
    query = {
      $expr: { $or: [compareFromDate, compareToDate] },
    };
  }
  return query;
};

/**
 *
 * @param {string} text text to slugify
 * @description Slugify a string by converting it to lowercase, removing accents, and replacing spaces with hyphens.
 * @returns
 */
exports.slugify = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

const slugify = exports.slugify;

exports.generateUniqueSlug = async function (name, Model) {
  const slug = slugify(name);
  let uniqueSlug = slug;
  let count = 1;
  while (await Model.exists({ slug: uniqueSlug })) {
    uniqueSlug = `${slug}-${count++}`;
  }
  return uniqueSlug;
};

/**
 *
 * @param  {...string} positions
 * @returns {(import("express").RequestHandler)[]}
 */
exports.allowPositions = (...positions) => {
  return [
    passport.authenticate("jwt", { session: false }),
    (req, res, next) => {
      const userPosition = req.user.position;
      if (!positions.map((s) => s.toLowerCase()).includes(userPosition)) {
        return next({ status: 403, clientMessage: "User's not allowed to access" });
      }
      next();
    },
  ];
};

/**
 * Optional authentication middleware.
 * If a valid JWT is provided, `req.user` will be populated. Otherwise request proceeds anonymously.
 */
exports.optionalAuth = (req, res, next) => {
  return passport.authenticate("jwt", { session: false }, (err, user) => {
    if (err) return next(err);
    if (user) req.user = user;
    return next();
  })(req, res, next);
};

exports.OrderStatus = [
  "WAITING",
  "ECONFIRMED",
  "DELIVERING",
  "COMPLETED",
  "CANCELED",
];

exports.PaymentTypes = ["CASH", "CREDIT CARD", "MOMO", "VNPAY"];
