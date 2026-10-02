/**
 * Migration script: Set random createdDate and modifiedDate for collections
 *
 * Usage: node scripts/migrate-collection-dates-random.js
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

async function migrateCollectionDatesRandom() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(mongoConnect, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    console.log("\n📋 Fetching all collections...");
    const collections = await Collection.find().select("_id").lean();
    console.log(`📊 Found ${collections.length} collections to update`);

    if (collections.length === 0) {
      console.log("ℹ️  No collections found");
      return;
    }

    let updatedCount = 0;

    for (let index = 0; index < collections.length; index++) {
      const collection = collections[index];
      const randomDate = getRandomDateBetween(START_2022, END_2024);

      const result = await Collection.updateOne(
        { _id: collection._id },
        {
          $set: {
            createdDate: randomDate,
            modifiedDate: randomDate,
          },
        },
      );

      const modified = result.modifiedCount ?? result.nModified ?? 0;
      if (modified > 0) {
        updatedCount += 1;
      }

      console.log(
        `✅ ${index + 1}/${collections.length} Updated ${collection._id} -> ${randomDate.toISOString()}`,
      );
    }

    console.log("\n" + "=".repeat(60));
    console.log("📈 MIGRATION COMPLETE");
    console.log("=".repeat(60));
    console.log(`✅ Collections matched: ${collections.length}`);
    console.log(`✅ Collections updated: ${updatedCount}`);
    console.log(`📅 Date range: 2022-01-01 to 2024-12-31`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
}

migrateCollectionDatesRandom();
