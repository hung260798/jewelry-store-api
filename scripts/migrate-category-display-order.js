/**
 * Migration script: Rename categories.sortOrder to categories.displayOrder
 *
 * Usage: node scripts/migrate-category-display-order.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("../src/models/Category.model");

const mongoConnect = process.env.MONGODB_URI || process.env.MONGODB_URL;

if (!mongoConnect) {
  console.error("❌ Error: Neither MONGODB_URI nor MONGODB_URL environment variable is set");
  console.error("ℹ️  Please configure one of these variables in your .env file");
  process.exit(1);
}

async function migrateCategoryDisplayOrder() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(mongoConnect, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    const filter = { sortOrder: { $exists: true } };
    const updatePipeline = [
      {
        $set: {
          displayOrder: "$sortOrder",
        },
      },
      {
        $unset: "sortOrder",
      },
    ];

    console.log("\n📋 Updating categories: copying sortOrder into displayOrder and removing sortOrder...");
    const result = await Category.updateMany(filter, updatePipeline);

    const matched = result.matchedCount ?? result.n ?? 0;
    const modified = result.modifiedCount ?? result.nModified ?? 0;

    console.log(`✅ Categories matched: ${matched}`);
    console.log(`✅ Categories updated: ${modified}`);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
}

migrateCategoryDisplayOrder();
