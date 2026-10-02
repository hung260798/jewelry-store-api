/**
 * Migration script: Add createdDate to collections (fix)
 * Note: Collection model uses timestamps with aliases:
 *   createdAt -> createdDate
 *   updatedAt -> modifiedDate
 *
 * Usage: node scripts/fix-collection-created-date.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Collection = require("../src/models/Collection.model");

const mongoConnect = process.env.MONGODB_URI || process.env.MONGODB_URL;

if (!mongoConnect) {
  console.error(
    "❌ Error: Neither MONGODB_URI nor MONGODB_URL environment variable is set",
  );
  console.error("ℹ️  Please configure one of these variables in your .env file");
  process.exit(1);
}

const START_2022 = new Date("2022-01-01T00:00:00.000Z");
const END_2024 = new Date("2024-12-31T23:59:59.999Z");

function getRandomDateBetween(startDate, endDate) {
  const start = startDate.getTime();
  const end = endDate.getTime();
  const randomTime = Math.floor(Math.random() * (end - start + 1)) + start;
  return new Date(randomTime);
}

async function fixCollectionCreatedDate() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(mongoConnect, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    console.log("\n📋 Fetching collections missing createdAt...");
    const collections = await Collection.find().select("_id createdAt").lean();
    const toFix = collections.filter((c) => !c.createdAt);
    console.log(`📊 Found ${toFix.length} collections to fix (out of ${collections.length} total)`);

    if (toFix.length === 0) {
      console.log("ℹ️  No collections need fixing - all have createdAt");
      return;
    }

    let updatedCount = 0;

    for (let index = 0; index < toFix.length; index++) {
      const collection = toFix[index];
      const randomDate = getRandomDateBetween(START_2022, END_2024);

      // Use native MongoDB collection API to ensure field is set
      const result = await Collection.collection.updateOne(
        { _id: collection._id },
        { $set: { createdAt: randomDate } },
      );

      if (result.modifiedCount > 0) {
        updatedCount += 1;
      }

      console.log(
        `✅ ${index + 1}/${toFix.length} Added createdAt ${collection._id} -> ${randomDate.toISOString()}`,
      );
    }

    console.log("\n" + "=".repeat(60));
    console.log("📈 FIX COMPLETE");
    console.log("=".repeat(60));
    console.log(`✅ Collections matched: ${toFix.length}`);
    console.log(`✅ Collections fixed: ${updatedCount}`);
    console.log(`📅 Date range: 2022-01-01 to 2024-12-31`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Fix failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
}

fixCollectionCreatedDate();
