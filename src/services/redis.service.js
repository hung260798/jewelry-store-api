const { createClient } = require("redis");
const { devLog } = require("../utils/misc.util");

exports.client = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

const client = exports.client;

client.on("error", (err) => {
  devLog("Redis error", err);
});

exports.connectRedis = async function () {
  try {
    if (!client.isOpen) {
      await client.connect();
    }
  } catch (error) {
    devLog("Cannot connect redis\n", error);
  }
  return client;
};
