"use strict";
const Joi = require("joi");
const _ = require("lodash");
const { isValidObjectId } = require("mongoose");

const phoneRegex =
  /^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/;

exports.phoneRegex = phoneRegex;

exports.IdStr2 = Joi.string().custom((value) => {
  if (!isValidObjectId(value)) {
    throw new Error("ObjectId không hợp lệ");
  }
  return value;
});

exports.SortOrderSchema2 = Joi.alternatives(Joi.string()).custom((value) => {
  if (value === "1" || value === "asc") {
    return 1;
  }
  if (value === "-1" || value === "desc") {
    return -1;
  }
  return undefined;
});

/**
 *
 * @param {import("joi").AnySchema} schema
 * @returns
 */
exports.validateByJoi = (schema = Joi.any()) => {
  return (req, res, next) => {
    try {
      if (!Joi.isSchema(schema)) {
        schema = Joi.object(schema);
      }
      const { query, params, body } = req;
      req.parsedData = {};
      const { value, error } = schema.validate(
        { query, params, body },
        { stripUnknown: true, abortEarly: false },
      );
      if (error) throw error;
      _.merge(req.parsedData, value);
      next();
    } catch (error) {
      next({ ...error, status: 400, clientMessage: "Dữ liệu không hợp lệ" });
    }
  };
};
