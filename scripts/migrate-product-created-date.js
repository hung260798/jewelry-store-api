/**
 * Migration script: Set createdDate for products missing it
 *
 * Usage: node scripts/migrate-product-created-date.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../src/models/Product.model");

const mongoConnect = process.env.MONGODB_URI || process.env.MONGODB_URL;

if (!mongoConnect) {
  console.error("❌ Error: Neither MONGODB_URI nor MONGODB_URL environment variable is set");
  console.error("ℹ️  Please configure one of these variables in your .env file");
  process.exit(1);
}

async function migrateProductCreatedDate() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(mongoConnect, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    const defaultDate = new Date("2025-01-01T00:00:00.000Z");

    const filter = {
      $or: [{ createdDate: { $exists: false } }, { createdDate: null }],
    };

    const update = {
      $set: { createdDate: defaultDate },
    };

    console.log("\n📋 Updating products missing createdDate...");
    const result = await Product.updateMany(filter, update);

    const matched = result.matchedCount ?? result.n ?? 0;
    const modified = result.modifiedCount ?? result.nModified ?? 0;

    console.log(`✅ Products matched: ${matched}`);
    console.log(`✅ Products updated: ${modified}`);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
}

migrateProductCreatedDate();
