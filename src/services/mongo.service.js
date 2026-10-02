const { default: mongoose } = require("mongoose");

const retryTimeoutMs = 20_000; // 20 seconds
const defaultMaxPoolSize = Number(process.env.MONGODB_MAX_POOL_SIZE || 25);
const defaultMinPoolSize = Number(process.env.MONGODB_MIN_POOL_SIZE || 6);
const defaultConnectTimeoutMs = Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 10_000);
const defaultSocketTimeoutMs = Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45_000);
const defaultServerSelectionTimeoutMs = Number(
  process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5_000,
);
const defaultMaxIdleTimeMs = Number(process.env.MONGODB_MAX_IDLE_TIME_MS || 300_000);

mongoose.set("strictQuery", false);

function buildMongoOptions(overrides = {}) {
  const maxPoolSize = Number(overrides.maxPoolSize ?? defaultMaxPoolSize);
  const minPoolSize = Number(overrides.minPoolSize ?? defaultMinPoolSize);
  return {
    family: 4,
    maxPoolSize: Number.isFinite(maxPoolSize) && maxPoolSize > 0 ? maxPoolSize : 25,
    minPoolSize: Number.isFinite(minPoolSize) && minPoolSize > 0 ? minPoolSize : 6,
    connectTimeoutMS: Number.isFinite(defaultConnectTimeoutMs) && defaultConnectTimeoutMs > 0
      ? defaultConnectTimeoutMs
      : 10_000,
    socketTimeoutMS: Number.isFinite(defaultSocketTimeoutMs) && defaultSocketTimeoutMs > 0
      ? defaultSocketTimeoutMs
      : 45_000,
    serverSelectionTimeoutMS: Number.isFinite(defaultServerSelectionTimeoutMs) && defaultServerSelectionTimeoutMs > 0
      ? defaultServerSelectionTimeoutMs
      : 5_000,
    maxIdleTimeMS: Number.isFinite(defaultMaxIdleTimeMs) && defaultMaxIdleTimeMs > 0
      ? defaultMaxIdleTimeMs
      : 300_000,
  };
}

const connectWithRetry = (exports.connectWithRetry = async function () {
  try {
    await mongoose.connect(process.env.MONGODB_URL, buildMongoOptions());
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error(
      "❌ MongoDB connection failed, retrying in 20s...",
      err.message,
    );
    setTimeout(connectWithRetry, retryTimeoutMs);
  }
});

// Optional: handle disconnections after initial success
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected! Retrying in 20s...");
  setTimeout(connectWithRetry, retryTimeoutMs);
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB error:", err);
  setTimeout(connectWithRetry, retryTimeoutMs);
});

module.exports = {
  buildMongoOptions,
  connectWithRetry,
};
