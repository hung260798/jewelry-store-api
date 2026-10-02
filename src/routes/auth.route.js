// TODO: Integrate
const express = require("express");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const { promisify } = require("util");

const RefreshToken = require("../models/RefreshToken.model");
const Employee = require("../models/Employee.model");
const Customer = require("../models/Customer.model");
const { encodeAccessToken: encodeToken, encodeRefreshToken } = require("../utils/jwt.util");
const { validateByJoi } = require("../utils/validation.util");
const { allowPositions } = require("../utils/misc.util");


const jwtVerifyAsync = promisify(jwt.verify);
const router = express.Router();


// ==========================================
// 1. TẠO MỚI TOKEN (ĐĂNG NHẬP)
// POST /api/v1/auth/tokens
// ==========================================
router.post(
  "/tokens",
  validateByJoi({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).max(100).required(),
      role: Joi.string()
        .lowercase()
        .allow("employee", "customer")
        .default("employee"),
    }),
  }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      let { role } = req.body;
      role = role.toLowerCase();
      const Model = role === "employee" ? Employee : Customer;
      const user = await Model.findOne({ email: email })
        .select("+password")
        .exec();
      if (!user || user.isDeleted) {
        return res
          .status(401)
          .json({ message: "Email hoặc mật khẩu không đúng" });
      }
      const isPasswordValid = await user.isValidPass(password);
      if (!isPasswordValid) {
        return res
          .status(401)
          .json({ message: "Email hoặc mật khẩu không đúng" });
      }

      const { _id, firstName, lastName } = user;
      const userId = _id.toString();
      const accessToken = encodeToken(userId, firstName, lastName, role);
      const refreshToken = encodeRefreshToken(
        userId,
        firstName,
        lastName,
        role,
      );

      // Lưu vào MongoDB
      await new RefreshToken({ userId, token: refreshToken, role }).save();

      // Gửi Refresh Token qua HttpOnly Cookie
      // res.cookie("refreshToken", refreshToken, {
      //   httpOnly: true,
      //   secure: process.env.NODE_ENV === "production",
      //   sameSite: "strict",
      //   maxAge: 30 * 24 * 60 * 60 * 1000,
      // });

      // Trả về Access Token cho Frontend
      return res.status(201).json({ token: accessToken, refreshToken });
    } catch (error) {
      next(error);
    }
  },
);

// ==========================================
// 2. CẬP NHẬT TOKEN (REFRESH TOKEN)
// PUT /api/v1/auth/tokens
// ==========================================
router.put("/tokens", async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Không tìm thấy Refresh Token" });
    }

    // Kiểm tra token có hợp lệ trong DB không
    const storedToken = await RefreshToken.findOne({ token: refreshToken });
    if (!storedToken) {
      return res.status(403).json({ message: "Refresh Token đã bị thu hồi" });
    }

    // Xác thực JWT
    const decoded = await jwtVerifyAsync(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const { fullName, sub, position } = decoded;
    if (
      !fullName ||
      !sub ||
      !position ||
      typeof fullName !== "string" ||
      typeof position !== "string" ||
      typeof sub !== "string"
    ) {
      return res
        .status(400)
        .json({ message: "Token thiếu thông tin cần thiết" });
    }
    const [firstName, lastName] = fullName.split(" - ");
    decoded.firstName ??= firstName;
    decoded.lastName ??= lastName;
    decoded.userId = typeof sub === "string" ? sub : sub.toString();
    // Cấp Access Token mới
    const newAccessToken = encodeToken(
      decoded.userId,
      decoded.firstName,
      decoded.lastName,
      position,
    );

    return res.status(200).json({ token: newAccessToken });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 3. XÓA 1 TOKEN (ĐĂNG XUẤT THIẾT BỊ HIỆN TẠI)
// DELETE /api/v1/auth/tokens
// ==========================================
// TODO: Check error
router.delete(
  "/tokens",
  ...allowPositions("employee", "customer"),
  async (req, res, next) => {
    try {
      const refreshToken = req.body.refreshToken;

      if (!refreshToken) {
        return res.status(204).end(); // Không có token, coi như đã xóa thành công
      }

      // Xóa khỏi MongoDB
      await RefreshToken.findOneAndDelete({ token: refreshToken });

      // Xóa cookie ở trình duyệt
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      });

      return res
        .status(200)
        .json({ message: "Đã xóa token thành công (Đăng xuất)" });
    } catch (error) {
      next(error);
    }
  },
);

// ==========================================
// 4. XÓA TẤT CẢ TOKEN CỦA USER (ĐĂNG XUẤT MỌI THIẾT BỊ)
// DELETE /api/v1/auth/tokens/all
// Yêu cầu: Phải đính kèm Access Token hợp lệ để biết user là ai
// ==========================================
// TODO: Check error
router.delete(
  "/tokens/all",
  ...allowPositions("customer", "employee"),
  async (req, res, next) => {
    try {
      // `req.user` lấy từ middleware authenticateToken
      const userId = req.user._id;
      const position = req.user.position;

      // Hủy toàn bộ token của user này trong DB
      await RefreshToken.deleteMany({ userId: userId, role: position });

      // Xóa cookie thiết bị hiện tại
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      });

      return res
        .status(200)
        .json({ message: "Đã hủy toàn bộ phiên đăng nhập trên mọi thiết bị" });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
