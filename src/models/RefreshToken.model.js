const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  role: {
    type: String,
    lowercase: true,
    enum: ["employee", "customer"],
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 30 * 24 * 60 * 60, // Tự động xóa khỏi DB sau 30 ngày (TTL Index)
  },
});

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);
